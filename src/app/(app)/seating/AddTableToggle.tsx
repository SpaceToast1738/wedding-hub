"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTable } from "./actions";

export function AddTableToggle() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ New table</Button>;
  }
  return (
    <form
      action={(fd) => startTransition(async () => { await createTable(fd); setOpen(false); })}
      className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-ink-primary mb-3">New table</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input name="name" required autoFocus placeholder="Table name (e.g. Top Table)" className="sm:col-span-1" />
        <select name="shape" defaultValue="ROUND" className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
          <option value="ROUND">Round</option>
          <option value="RECTANGLE">Rectangle</option>
          <option value="HEAD">Head table</option>
        </select>
        <Input name="capacity" type="number" min="1" max="40" defaultValue="8" placeholder="Capacity" />
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
      </div>
    </form>
  );
}
