"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/notify";
import { deleteBookSection, updateBookSection } from "../actions";

// v1.94.0: title + subtitle edit for an existing section. Slug stays
// stable (URLs are public-shareable + couple's muscle memory survives
// a rename). Title field was previously edit-locked — couples had to
// re-create + reorder if they wanted to fix a typo. Now both edit
// inline via this modal, surfaced as an "Edit details" button next to
// "+ New card" in the /book/[slug] header.
//
// v1.99.8: section delete also lives here. The deleteBookSection
// server action shipped in v1.4.0 but never had a UI surface — pre-
// fix the only way to remove a section was via Prisma Studio. The
// "Delete section" button sits on the left of the modal footer with
// danger tone; on confirm it dispatches deleteBookSection + bounces
// the user to /book (the section page they're on is about to 404).
export function EditSectionToggle({
  id,
  initialTitle,
  initialSubtitle,
}: {
  id: string;
  initialTitle: string;
  initialSubtitle: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const confirm = useConfirm();

  async function onDelete() {
    if (
      !(await confirm({
        title: `Delete section "${initialTitle}"?`,
        body: "All cards inside this section will be deleted too. This can't be undone.",
        confirmLabel: "Delete section",
        tone: "danger",
      }))
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteBookSection(id);
        // The current page (/book/<slug>) is now stale — navigate to
        // the overview before Next.js tries to re-render against a
        // missing row.
        router.push("/book");
      } catch (err) {
        notify(
          "error",
          err instanceof Error ? err.message : "Couldn't delete section",
        );
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
      <AddNewModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit section details"
        width="md"
      >
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const res = await updateBookSection(id, fd);
              if (res.ok) {
                notify("success", "Section updated");
                setOpen(false);
              } else {
                setError(res.error);
              }
            });
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Title
              </label>
              <Input
                name="title"
                defaultValue={initialTitle}
                required
                autoFocus
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Subtitle{" "}
                <span className="font-normal text-ink-tertiary/70 normal-case">
                  — optional
                </span>
              </label>
              <Input
                name="subtitle"
                defaultValue={initialSubtitle ?? ""}
                maxLength={240}
                placeholder="e.g. Package, shot list, locations, day-of contact"
              />
              <p className="text-[11px] text-ink-tertiary mt-1">
                Shows under the section title on the Wedding Book overview
                and at the top of this page.
              </p>
            </div>
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          {/* v1.99.8: footer = [Delete] (left) / [Cancel] [Save] (right).
              Mirrors the destructive-vs-confirm split used by CardChrome
              and the v1.84/85 budget category edit modal: destructive
              action stays visually distant from the primary CTA. */}
          <div className="flex gap-2 items-center mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={pending}
              className="text-danger hover:bg-danger/10"
            >
              Delete section
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </AddNewModal>
    </>
  );
}
