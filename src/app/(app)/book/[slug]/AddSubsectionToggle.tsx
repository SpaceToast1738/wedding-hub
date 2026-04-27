"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBookSubsection } from "../actions";

export function AddSubsectionToggle({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ New page</Button>;
  }
  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("sectionId", sectionId);
        startTransition(async () => {
          try {
            await createBookSubsection(fd);
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
      className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm space-y-3"
    >
      <h3 className="text-sm font-semibold text-ink-primary">New page</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Title</label>
          <Input name="title" required autoFocus placeholder="e.g. Photographer brief" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Slug</label>
          <Input name="slug" required pattern="[a-z0-9-]+" placeholder="photographer-brief" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Body</label>
        <textarea name="body" rows={4}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
      </div>
    </form>
  );
}
