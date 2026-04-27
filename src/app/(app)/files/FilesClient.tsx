"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deleteFile, registerFile } from "./actions";
import { formatDate } from "@/lib/format";

type File = {
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

export function FilesClient({ files, canEdit }: { files: File[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="bg-marigold-100 border border-marigold-700/30 text-marigold-700 rounded-md px-4 py-3 text-xs">
          ⓘ Direct file uploads will land in Phase C alongside the Docker storage volume. For now you can register a reference to a file already stored elsewhere (Drive, Dropbox, S3 path, etc.) so it appears in this index.
        </div>

        {canEdit && (
          adding ? (
            <RegisterForm onDone={() => setAdding(false)} />
          ) : (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setAdding(true)}>+ Register file reference</Button>
            </div>
          )
        )}

        {files.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">No files yet.</p>
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
                {files.map((f) => <FileRow key={f.id} file={f} canEdit={canEdit} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({ file, canEdit }: { file: File; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete reference to "${file.name}"?`)) return;
    startTransition(async () => { await deleteFile(file.id); });
  }

  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <div className="text-sm text-ink-primary">{file.name}</div>
        <div className="text-[11px] text-ink-tertiary truncate">{file.storedPath}</div>
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{file.folder ?? "—"}</td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{file.mimeType}</td>
      <td className="px-4 py-2.5 text-right text-xs text-ink-secondary tabular-nums">{formatSize(file.sizeBytes)}</td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{formatDate(file.createdAt)}</td>
      <td className="px-4 py-2.5">
        {canEdit && <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>×</Button>}
      </td>
    </tr>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => startTransition(async () => { await registerFile(fd); onDone(); })}
      className="bg-surface border border-moss-100 rounded-md p-4 shadow-sm space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Name</label>
          <Input name="name" required autoFocus placeholder="Photographer contract.pdf" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Folder</label>
          <Input name="folder" placeholder="contracts" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Stored path / URL</label>
        <Input name="storedPath" required placeholder="https://drive.google.com/…  or  /uploads/contracts/…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">MIME type</label>
          <Input name="mimeType" defaultValue="application/pdf" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Size (bytes)</label>
          <Input name="sizeBytes" type="number" min="0" placeholder="optional" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Register"}</Button>
      </div>
    </form>
  );
}
