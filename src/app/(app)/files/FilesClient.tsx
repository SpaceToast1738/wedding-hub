"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileType,
  Image,
  Lock,
  Paperclip,
  Presentation,
  ScrollText,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import { FileVisibility } from "@prisma/client";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { deleteFile, listUploaderNames, updateFile, uploadFile } from "./actions";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type FileRow = {
  id: string;
  name: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  folder: string | null;
  visibility: FileVisibility;
  createdAt: Date;
  // v2.5.0 (design pass #9): present on every row already (Prisma
  // returns every scalar column by default) — declaring it here just
  // lets the client resolve + display who uploaded each file.
  uploadedById: string | null;
};

/** name/firstName keyed by user id, resolved client-side via listUploaderNames. */
type UploaderMap = Record<string, { name: string | null; firstName: string | null }>;

function uploaderLabel(u: UploaderMap[string] | undefined): string | null {
  if (!u) return null;
  return u.firstName ?? u.name?.split(/\s+/)[0] ?? null;
}

const NO_FOLDER_KEY = "__no_folder__";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const MIME_ICONS: Array<[RegExp, LucideIcon]> = [
  [/^application\/pdf$/, FileText],
  [/^image\//, Image],
  [/word|officedocument\.wordprocessing/, FileType],
  [/excel|officedocument\.spreadsheet/, FileSpreadsheet],
  [/presentation/, Presentation],
  [/zip|compressed/, FileArchive],
  [/^text\//, ScrollText],
];

function iconFor(mime: string): LucideIcon {
  for (const [re, icon] of MIME_ICONS) if (re.test(mime)) return icon;
  return Paperclip;
}

function groupByFolder(files: FileRow[]): Array<{ key: string; label: string; files: FileRow[] }> {
  const map = new Map<string, FileRow[]>();
  for (const f of files) {
    const key = f.folder ?? NO_FOLDER_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  // Named folders first (alpha), unfiled last.
  const named = [...map.keys()].filter((k) => k !== NO_FOLDER_KEY).sort();
  const ordered = [...named, NO_FOLDER_KEY].filter((k) => map.has(k));
  return ordered.map((k) => ({
    key: k,
    label: k === NO_FOLDER_KEY ? "Unfiled" : k,
    files: map.get(k)!,
  }));
}

type TypeFilter = "all" | "image" | "pdf" | "doc" | "other";

function typeBucket(mime: string): TypeFilter {
  if (/^image\//.test(mime)) return "image";
  if (/^application\/pdf$/.test(mime)) return "pdf";
  if (/word|spreadsheet|presentation|officedocument|^text\//.test(mime)) return "doc";
  return "other";
}

// v2.5.0 (design pass #8): human-readable bucket labels for the file
// metadata line. The raw MIME string (e.g. the ~70-char Word docx
// type) wrapped across multiple lines on a narrow phone and buried
// the size/date the user actually wants — reuses the same typeBucket
// classifier the filter pills already use, instead of printing
// file.mimeType verbatim.
const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "File",
  image: "Image",
  pdf: "PDF",
  doc: "Document",
  other: "Other",
};

export function FilesClient({
  files,
  canEdit,
  isCouple,
}: {
  files: FileRow[];
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const folderNames = useMemo(
    () => Array.from(new Set(files.map((f) => f.folder).filter((f): f is string => !!f))).sort(),
    [files],
  );

  // v2.5.0 (design pass #9): resolve uploader names once, client-side.
  // No Prisma relation exists from File → User (uploadedById is a
  // plain scalar column), so this is a follow-up fetch rather than
  // something the server component could have included in the initial
  // `files` prop.
  const [uploaders, setUploaders] = useState<UploaderMap>({});
  useEffect(() => {
    const ids = files.map((f) => f.uploadedById).filter((id): id is string => !!id);
    if (ids.length === 0) return;
    let cancelled = false;
    listUploaderNames(ids)
      .then((map) => {
        if (!cancelled) setUploaders(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [files]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return files;
    return files.filter((f) => typeBucket(f.mimeType) === typeFilter);
  }, [files, typeFilter]);

  const groups = useMemo(() => groupByFolder(filtered), [filtered]);

  // Type counts for filter pills
  const counts = useMemo(() => {
    const c = { all: files.length, image: 0, pdf: 0, doc: 0, other: 0 };
    for (const f of files) c[typeBucket(f.mimeType)]++;
    return c;
  }, [files]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {canEdit && <UploadDropzone folderNames={folderNames} isCouple={isCouple} />}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <Tag label={`All (${counts.all})`} active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
            {counts.image > 0 && <Tag icon={Image} label={`Images (${counts.image})`} active={typeFilter === "image"} onClick={() => setTypeFilter("image")} />}
            {counts.pdf > 0 && <Tag icon={FileText} label={`PDFs (${counts.pdf})`} active={typeFilter === "pdf"} onClick={() => setTypeFilter("pdf")} />}
            {counts.doc > 0 && <Tag icon={FileType} label={`Documents (${counts.doc})`} active={typeFilter === "doc"} onClick={() => setTypeFilter("doc")} />}
            {counts.other > 0 && <Tag icon={FileArchive} label={`Other (${counts.other})`} active={typeFilter === "other"} onClick={() => setTypeFilter("other")} />}
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No files yet. {canEdit && "Drop your first one above."}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No files match this filter.
          </p>
        ) : (
          groups.map((g) => (
            <FolderGroup
              key={g.key}
              label={g.label}
              files={g.files}
              folderNames={folderNames}
              canEdit={canEdit}
              isCouple={isCouple}
              uploaders={uploaders}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FolderGroup({
  label,
  files,
  folderNames,
  canEdit,
  isCouple,
  uploaders,
}: {
  label: string;
  files: FileRow[];
  folderNames: string[];
  canEdit: boolean;
  isCouple: boolean;
  uploaders: UploaderMap;
}) {
  return (
    <section>
      <header className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">
          {label === "Unfiled" ? <span className="italic">Unfiled</span> : label}
        </h2>
        <span className="text-[11px] text-ink-tertiary">
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="bg-surface border border-border-soft rounded-md shadow-sm divide-y divide-border-soft">
        {files.map((f) => (
          <FileItem
            key={f.id}
            file={f}
            folderNames={folderNames}
            canEdit={canEdit}
            isCouple={isCouple}
            uploader={f.uploadedById ? uploaders[f.uploadedById] : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

function FileItem({
  file,
  folderNames,
  canEdit,
  isCouple,
  uploader,
}: {
  file: FileRow;
  folderNames: string[];
  canEdit: boolean;
  isCouple: boolean;
  uploader: UploaderMap[string] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCoupleOnly = file.visibility === FileVisibility.COUPLE_ONLY;
  const confirm = useConfirm();

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${file.name}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      try {
        await deleteFile(file.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  function toggleVisibility() {
    const next = isCoupleOnly ? FileVisibility.EVERYONE : FileVisibility.COUPLE_ONLY;
    startTransition(async () => {
      try {
        await updateFile(file.id, { visibility: next });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  if (editing) {
    return (
      <li className="px-4 py-3 bg-moss-50/30">
        <EditForm
          file={file}
          folderNames={folderNames}
          canSetCoupleOnly={isCouple}
          onCancel={() => setEditing(false)}
          onSubmit={async (patch) => {
            await updateFile(file.id, patch);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  const isImage = /^image\//.test(file.mimeType);
  const uploaderName = uploaderLabel(uploader);
  const MimeIcon = iconFor(file.mimeType);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/30">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${file.id}`}
          alt=""
          className="w-9 h-9 rounded-sm object-cover bg-muted border border-border-soft flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <MimeIcon className="w-4 h-4 flex-shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`/api/files/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-primary hover:text-moss-700 hover:underline truncate"
          >
            {file.name}
          </a>
          {isCoupleOnly && (
            <span
              title="Couple-only — hidden from Aimee, Josh, and the planner"
              className="text-[10px] font-semibold uppercase tracking-wider text-marigold-700 bg-marigold-100 border border-marigold-700/30 px-1.5 py-px rounded-md flex-shrink-0 inline-flex items-center gap-0.5"
            >
              <Lock aria-hidden className="w-3 h-3" />
              Couple
            </span>
          )}
        </div>
        <div className="text-[11px] text-ink-tertiary mt-0.5 flex items-center gap-1.5 flex-wrap">
          {/* v2.5.0 (design pass #9): who uploaded this, once resolved. */}
          {uploaderName && (
            <span className="inline-flex items-center gap-1 text-ink-secondary">
              <Avatar name={uploader?.name ?? uploaderName} size={14} />
              {uploaderName}
            </span>
          )}
          <span>
            {/* v2.5.0 (design pass #8): human bucket label instead of
                the raw MIME string — a long docx/xlsx MIME type used
                to wrap across lines on a narrow phone and bury the
                size/date. */}
            {formatSize(file.sizeBytes)} · {TYPE_LABELS[typeBucket(file.mimeType)]} · {formatDate(file.createdAt)}
          </span>
        </div>
        {error && <div className="text-[11px] text-danger mt-0.5">{error}</div>}
      </div>
      {canEdit && (
        // v2.5.0 (design pass #1): was three hover-only ghost buttons —
        // invisible on touch yet still tappable, so a stray tap on an
        // invisible control could fire delete with zero visible
        // affordance. One always-visible menu button at a proper touch
        // size replaces all three.
        <FileRowMenu
          fileName={file.name}
          isCoupleOnly={isCoupleOnly}
          pending={pending}
          onToggleVisibility={toggleVisibility}
          onEdit={() => setEditing(true)}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

function FileRowMenu({
  fileName,
  isCoupleOnly,
  pending,
  onToggleVisibility,
  onEdit,
  onDelete,
}: {
  fileName: string;
  isCoupleOnly: boolean;
  pending: boolean;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${fileName}`}
        className="px-2 min-w-[40px] justify-center"
      >
        ⋮
      </Button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${fileName}`}
          className="absolute right-0 top-full mt-1 z-20 w-52 bg-surface border border-border-soft rounded-md shadow-lg py-1"
        >
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onToggleVisibility();
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 min-h-[40px] text-sm text-ink-secondary hover:bg-muted text-left cursor-pointer disabled:opacity-50"
          >
            <span aria-hidden className="w-4 flex justify-center">
              {isCoupleOnly ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </span>
            {isCoupleOnly ? "Make visible to everyone" : "Make couple-only"}
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 min-h-[40px] text-sm text-ink-secondary hover:bg-muted text-left cursor-pointer disabled:opacity-50"
          >
            <span aria-hidden className="w-4 text-center">✏️</span>
            Edit
          </button>
          <div className="border-t border-border-soft my-1" />
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 min-h-[40px] text-sm text-danger hover:bg-muted text-left cursor-pointer disabled:opacity-50"
          >
            <span aria-hidden className="w-4 text-center">🗑</span>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EditForm({
  file,
  folderNames,
  canSetCoupleOnly,
  onCancel,
  onSubmit,
}: {
  file: FileRow;
  folderNames: string[];
  canSetCoupleOnly: boolean;
  onCancel: () => void;
  onSubmit: (patch: { name: string; folder: string | null; visibility: FileVisibility }) => Promise<void>;
}) {
  const [name, setName] = useState(file.name);
  const [folder, setFolder] = useState(file.folder ?? "");
  const [visibility, setVisibility] = useState<FileVisibility>(file.visibility);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit({
          name,
          folder: folder.trim() ? folder.trim() : null,
          visibility,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* v2.5.0: Input's `label` prop wires htmlFor/id — the sibling
            <label> here previously had no association, so screen
            readers announced the field as unlabeled. */}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
        <div>
          <Input
            label="Folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            list={`folder-options-${file.id}`}
            disabled={pending}
            placeholder="(unfiled)"
          />
          <datalist id={`folder-options-${file.id}`}>
            {folderNames.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Visibility
        </label>
        <div className="flex gap-2">
          {(
            [
              [FileVisibility.EVERYONE, "Everyone with files access"],
              [FileVisibility.COUPLE_ONLY, "Couple only"],
            ] as const
          ).map(([v, label]) => {
            const active = visibility === v;
            const disabled = pending || (v === FileVisibility.COUPLE_ONLY && !canSetCoupleOnly);
            return (
              <button
                type="button"
                key={v}
                onClick={() => setVisibility(v)}
                disabled={disabled}
                className={[
                  "text-xs px-2.5 py-1 rounded-sm border cursor-pointer transition-colors",
                  active
                    ? "bg-moss-500 text-on-moss border-moss-500"
                    : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                  disabled && !active ? "opacity-50 cursor-not-allowed" : "",
                  "inline-flex items-center gap-1",
                ].join(" ")}
              >
                {v === FileVisibility.COUPLE_ONLY && <Lock aria-hidden className="w-3 h-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function UploadDropzone({
  folderNames,
  isCouple,
}: {
  folderNames: string[];
  isCouple: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [visibility, setVisibility] = useState<FileVisibility>(FileVisibility.EVERYONE);
  const [dragOver, setDragOver] = useState(false);

  // v2.5.0 (design pass #6): the old `{count, total}` progress state
  // never actually advanced during the transfer — `count` was set once
  // and never incremented, so it was a fake progress bar. `pending`
  // (from useTransition, which stays true for the whole awaited async
  // callback) already tells us exactly when an upload is in flight, so
  // there's no separate state to keep in sync — just a plain spinner
  // while `pending` is true.
  async function submit(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    if (folder) fd.set("folder", folder);
    fd.set("visibility", visibility);
    startTransition(async () => {
      try {
        await uploadFile(fd);
        if (inputRef.current) inputRef.current.value = "";
        // v2.5.0 (design pass #6): the app-wide notify() convention
        // exists for exactly this — a completed upload previously gave
        // no confirmation at all beyond the dropzone quietly resetting.
        notify("success", `Uploaded ${list.length} file${list.length === 1 ? "" : "s"}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) submit(e.target.files);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) submit(e.dataTransfer.files);
  }

  return (
    <div className="bg-surface border border-border-soft rounded-md p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <Input
            label="Folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            list="upload-folder-options"
            disabled={pending}
            placeholder="contracts, photos…"
          />
          <datalist id="upload-folder-options">
            {folderNames.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Visibility
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as FileVisibility)}
            disabled={pending || !isCouple}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none disabled:opacity-50"
          >
            <option value={FileVisibility.EVERYONE}>Everyone</option>
            {isCouple && <option value={FileVisibility.COUPLE_ONLY}>Couple only</option>}
          </select>
        </div>
        <div className="text-[11px] text-ink-tertiary leading-tight">
          PDF, images, Word/Excel, txt/csv, zip.
          <br />
          Max 25 MB per file. Drop multiple to batch upload.
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "block border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-moss-500 bg-moss-50"
            : pending
              ? "border-border-soft bg-muted/40 cursor-wait"
              : "border-border-strong bg-canvas hover:border-moss-300 hover:bg-moss-50/40",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onPick}
          disabled={pending}
          className="sr-only"
        />
        {pending ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <span
              aria-hidden
              className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            />
            Uploading…
          </span>
        ) : (
          <span className="text-sm text-ink-secondary">
            <span className="font-medium text-moss-700">Click to upload</span> or drop files here
          </span>
        )}
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
