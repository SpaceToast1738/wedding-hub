"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBookSection } from "./actions";

export function AddSectionToggle() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ New section</Button>;
  }
  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await createBookSection(fd);
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
      className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-ink-primary mb-3">New section</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Title</label>
          <Input name="title" required autoFocus placeholder="e.g. Photography" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Slug</label>
          <Input name="slug" required pattern="[a-z0-9-]+" placeholder="photography" />
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
      <div className="flex gap-2 justify-end mt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
      </div>
    </form>
  );
}
