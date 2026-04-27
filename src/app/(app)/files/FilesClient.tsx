"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deleteFile, uploadFile } from "./actions";
import { formatDate } from "@/lib/format";

type FileRow = {
  id: string;
  name: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  folder: string | null;
  createdAt: Date;
};

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const MIME_ICONS: Array<[RegExp, string]> = [
  [/^application\/pdf$/, "📄"],
  [/^image\//, "🖼"],
  [/word|officedocument\.wordprocessing/, "📝"],
  [/excel|officedocument\.spreadsheet/, "📊"],
  [/presentation/, "📽"],
  [/zip|compressed/, "🗜"],
  [/^text\//, "📃"],
];

function iconFor(mime: string): string {
  for (const [re, icon] of MIME_ICONS) if (re.test(mime)) return icon;
  return "📎";
}

export function FilesClient({ files, canEdit }: { files: FileRow[]; canEdit: boolean }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {canEdit && <UploadDropzone />}

        {files.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No files yet. {canEdit && "Upload your first one above."}
          </p>
        ) : (
          <div className="bg-surface border border-border-soft rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Folder</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Size</th>
                  <th className="px-4 py-2 text-left">Uploaded</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <FileTableRow key={f.id} file={f} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FileTableRow({ file, canEdit }: { file: FileRow; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${file.name}"?`)) return;
    startTransition(async () => {
      await deleteFile(file.id);
    });
  }

  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <a
          href={`/api/files/${file.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-ink-primary hover:text-moss-700"
        >
          <span className="text-base flex-shrink-0">{iconFor(file.mimeType)}</span>
          <span className="hover:underline truncate">{file.name}</span>
        </a>
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{file.folder ?? "—"}</td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary truncate max-w-[180px]">{file.mimeType}</td>
      <td className="px-4 py-2.5 text-right text-xs text-ink-secondary tabular-nums">
        {formatSize(file.sizeBytes)}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{formatDate(file.createdAt)}</td>
      <td className="px-4 py-2.5">
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
            ×
          </Button>
        )}
      </td>
    </tr>
  );
}

function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [progress, setProgress] = useState<{ name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function submit(file: File) {
    setError(null);
    setProgress({ name: file.name });
    const fd = new FormData();
    fd.set("file", file);
    if (folder) fd.set("folder", folder);
    startTransition(async () => {
      try {
        await uploadFile(fd);
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setProgress(null);
      }
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) submit(f);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) submit(f);
  }

  return (
    <div className="bg-surface border border-border-soft rounded-md p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Folder (optional)
          </label>
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="contracts, menus, photos…"
            disabled={pending}
          />
        </div>
        <div className="text-[11px] text-ink-tertiary leading-tight">
          PDF, images, Word/Excel, txt/csv, zip.<br />
          Max 25 MB per file.
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
          onChange={onPick}
          disabled={pending}
          className="sr-only"
        />
        {progress ? (
          <span className="text-sm text-ink-secondary">Uploading {progress.name}…</span>
        ) : (
          <span className="text-sm text-ink-secondary">
            <span className="font-medium text-moss-700">Click to upload</span> or drop a file here
          </span>
        )}
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
