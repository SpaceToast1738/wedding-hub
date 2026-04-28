"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { deleteBookSubsection, setBookSubsectionVisibility, updateBookSubsection } from "../actions";

type Sub = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  visibility: "EVERYONE" | "COUPLE_ONLY";
};

export function SubsectionEditor({
  sub,
  canEdit,
  isCouple,
}: {
  sub: Sub;
  canEdit: boolean;
  // C1: only the couple sees + uses the visibility toggle. Non-couple
  // editors can still edit content; visibility is locked behind the
  // couple gate (server enforces this regardless of UI).
  isCouple: boolean;
}) {
  const [title, setTitle] = useState(sub.title);
  const [body, setBody] = useState(sub.body ?? "");
  const [visibility, setVisibility] = useState(sub.visibility);
  const [pending, startTransition] = useTransition();
  const dirty = title !== sub.title || body !== (sub.body ?? "");

  function toggleVisibility() {
    const next = visibility === "COUPLE_ONLY" ? "EVERYONE" : "COUPLE_ONLY";
    setVisibility(next);
    startTransition(async () => {
      try {
        await setBookSubsectionVisibility(sub.id, next);
      } catch (err) {
        // Roll back on failure so the UI reflects DB truth.
        setVisibility(visibility);
        notify("error", err instanceof Error ? err.message : "Couldn't change visibility");
      }
    });
  }

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
      <div className="flex items-start gap-2 mb-2">
        {canEdit ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="!text-base !font-semibold !border-transparent hover:!border-border-soft focus:!border-moss-500 !p-1 flex-1"
          />
        ) : (
          <h3 className="text-base font-semibold text-ink-primary flex-1">{title}</h3>
        )}
        {visibility === "COUPLE_ONLY" && (
          <span
            className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1.5 py-0.5 rounded self-center whitespace-nowrap"
            title="Only Jamie and Bryony can see this page."
          >
            🔒 Couple only
          </span>
        )}
      </div>
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
          {isCouple && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleVisibility}
              disabled={pending}
              title={
                visibility === "COUPLE_ONLY"
                  ? "Make this page visible to everyone with Wedding Book access"
                  : "Hide this page from non-couple users"
              }
            >
              {visibility === "COUPLE_ONLY" ? "Make public" : "Make couple-only"}
            </Button>
          )}
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
