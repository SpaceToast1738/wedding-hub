"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deleteBookSubsection, updateBookSubsection } from "../actions";

type Sub = { id: string; slug: string; title: string; body: string | null };

export function SubsectionEditor({ sub, canEdit }: { sub: Sub; canEdit: boolean }) {
  const [title, setTitle] = useState(sub.title);
  const [body, setBody] = useState(sub.body ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = title !== sub.title || body !== (sub.body ?? "");

  function save() {
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    startTransition(async () => {
      await updateBookSubsection(sub.id, fd);
    });
  }

  function onDelete() {
    if (!confirm(`Delete page "${sub.title}"?`)) return;
    startTransition(async () => {
      await deleteBookSubsection(sub.id);
    });
  }

  return (
    <article id={sub.slug} className="bg-surface border border-border-soft rounded-md shadow-sm p-5 scroll-mt-24">
      {canEdit ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="!text-base !font-semibold !border-transparent hover:!border-border-soft focus:!border-moss-500 !p-1 mb-2"
        />
      ) : (
        <h3 className="text-base font-semibold text-ink-primary mb-2">{title}</h3>
      )}
      {canEdit ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.max(4, body.split("\n").length + 1)}
          className="w-full text-sm bg-canvas/50 border border-transparent rounded-sm px-2 py-1.5 outline-none hover:border-border-soft focus:border-moss-500 text-ink-secondary whitespace-pre-wrap"
          placeholder="Notes…"
        />
      ) : (
        <p className="text-sm text-ink-secondary whitespace-pre-wrap">{body || "—"}</p>
      )}
      {canEdit && (
        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-border-soft">
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
          {dirty && (
            <Button variant="primary" size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
