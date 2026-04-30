"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor, RichTextRead } from "@/components/ui/RichTextEditor";
import { notify } from "@/lib/notify";
import { legacyBodyToHtml } from "@/lib/sanitize-book-html";
import { deleteBookSubsection, setBookSubsectionVisibility, updateBookSubsection } from "../actions";

// v1.37.0: TEXT cards switched to a Tiptap WYSIWYG. The editor authors
// HTML; the server sanitises on write, RichTextRead sanitises on read
// as a belt-and-braces guard. Legacy `body` (plain text) is still
// loaded as a one-release fallback — when bodyHtml is null but body
// isn't, we render the body via legacyBodyToHtml.
//
// v1.37.1: View / Edit toggle pattern (matches every other v1.31+
// card kind). Default state is read-only; clicking Edit opens the
// rich editor. Cancel reverts the draft. Save commits and exits
// edit mode. Fixes the pre-v1.37.1 bug where the toolbar stayed
// visible after saving.

type Sub = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  bodyHtml: string | null;
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
  // Initial HTML: prefer bodyHtml (the new shape). Fall back to
  // legacyBodyToHtml(body) for rows that haven't been re-saved
  // since the migration. Empty when both are null.
  const initialHtml = useMemo(() => {
    if (sub.bodyHtml != null) return sub.bodyHtml;
    if (sub.body != null) return legacyBodyToHtml(sub.body);
    return "";
  }, [sub.body, sub.bodyHtml]);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sub.title);
  const [bodyHtml, setBodyHtml] = useState(initialHtml);
  const [visibility, setVisibility] = useState(sub.visibility);
  const [pending, startTransition] = useTransition();
  const dirty = title !== sub.title || bodyHtml !== initialHtml;

  // Re-sync draft when the underlying sub prop changes (e.g. after a
  // server-action revalidate completes). Mirrors the pattern used in
  // every other v1.31+ card editor.
  useEffect(() => {
    setTitle(sub.title);
    setBodyHtml(initialHtml);
    setVisibility(sub.visibility);
  }, [sub.id, sub.title, sub.visibility, initialHtml]);

  function cancel() {
    setTitle(sub.title);
    setBodyHtml(initialHtml);
    setEditing(false);
  }

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
    fd.set("bodyHtml", bodyHtml);
    startTransition(async () => {
      try {
        await updateBookSubsection(sub.id, fd);
        // Exit edit mode on success. The next render picks up the
        // refreshed sub prop and re-syncs the draft via the useEffect
        // above.
        setEditing(false);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
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
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
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
      {editing ? (
        <RichTextEditor
          value={bodyHtml}
          onChange={setBodyHtml}
          disabled={pending}
          placeholder="Notes…"
        />
      ) : initialHtml ? (
        <RichTextRead html={initialHtml} />
      ) : (
        <p className="text-sm text-ink-tertiary italic">—</p>
      )}
      {canEdit && (
        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-border-soft">
          {!editing && isCouple && (
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
          {!editing && (
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={save}
                disabled={pending || !dirty}
              >
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
