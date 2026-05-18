"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RichTextEditor, RichTextRead } from "@/components/ui/RichTextEditor";
import {
  ImageGallery,
  type GalleryDisplay,
  type GallerySize,
} from "@/components/ui/ImageGallery";
import { notify } from "@/lib/notify";
import { legacyBodyToHtml } from "@/lib/sanitize-book-html";
import {
  attachFileToTextCard,
  detachFileFromTextCard,
  setBookSubsectionHeaderFileId,
  setBookSubsectionPhotoDisplay,
  setBookSubsectionPhotoSize,
  setBookSubsectionSlideshowAuto,
  updateBookSubsection,
  uploadAndAttachTextFile,
} from "../actions";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

// v1.37.0: TEXT cards switched to a Tiptap WYSIWYG. The editor authors
// HTML; the server sanitises on write, RichTextRead sanitises on read
// as a belt-and-braces guard. Legacy `body` (plain text) is still
// loaded as a one-release fallback — when bodyHtml is null but body
// isn't, we render the body via legacyBodyToHtml.
//
// v1.37.1: View / Edit toggle pattern (matches every other v1.31+
// card kind). Default state is read-only; clicking Edit opens the
// rich editor. Cancel reverts the draft. Save commits and exits
// edit mode.
//
// v1.97.0: SubsectionEditor migrated to CardChrome. Pre-fix it carried
// its own bespoke <article> chrome + title input + footer because the
// v1.37.0 title-rename UX (only-in-edit-mode) didn't match CardChrome's
// inline-save-on-blur pattern. The v1.95.4 router-refresh fix lived
// inside this article's save handler. v1.97.0 closes the divergence:
//   • Title is now handled by CardChrome (inline, saves on blur).
//   • Delete / Make couple-only handled by CardChrome's footer.
//   • Edit / Cancel / Save lift to the CardChrome.actions slot.
//   • Photos lift to CardChrome.mediaBlock so they render at the top
//     of the card alongside every other gallery-using kind.
//   • Body save posts ONLY bodyHtml — title is owned by CardChrome
//     and shouldn't be clobbered by this action.

type Sub = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  bodyHtml: string | null;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  // v1.96.1: photo gallery on TEXT cards. Default to empty array if
  // an upstream caller doesn't thread it (older callers stay safe).
  fileIds?: string[];
  // v1.96.5: per-card gallery thumbnail size.
  photoSize?: GallerySize;
  // v1.97.0: display mode + mode-specific knobs (header pin / autoplay).
  photoDisplay?: GalleryDisplay;
  headerFileId?: string | null;
  slideshowAuto?: boolean;
};

export function SubsectionEditor({
  sub,
  canEdit,
  isCouple,
  linkedTasks = [],
  users = [],
  files = [],
}: {
  sub: Sub;
  canEdit: boolean;
  // C1: only the couple sees + uses the visibility toggle. Non-couple
  // editors can still edit content; visibility is locked behind the
  // couple gate (server enforces this regardless of UI).
  isCouple: boolean;
  // v1.92.0: render the linked-tasks panel inline within the card.
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
  // v1.96.1: full file list for the photo-attach picker.
  files?: Array<{ id: string; name: string; mimeType: string }>;
}) {
  // Initial HTML: prefer bodyHtml (the new shape). Fall back to
  // legacyBodyToHtml(body) for rows that haven't been re-saved
  // since the v1.37.0 migration.
  const initialHtml = useMemo(() => {
    if (sub.bodyHtml != null) return sub.bodyHtml;
    if (sub.body != null) return legacyBodyToHtml(sub.body);
    return "";
  }, [sub.body, sub.bodyHtml]);

  const [editing, setEditing] = useState(false);
  const [bodyHtml, setBodyHtml] = useState(initialHtml);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dirty = bodyHtml !== initialHtml;

  // Re-sync draft when the underlying sub prop changes (e.g. after a
  // server-action revalidate completes).
  useEffect(() => {
    setBodyHtml(initialHtml);
  }, [sub.id, initialHtml]);

  function cancel() {
    setBodyHtml(initialHtml);
    setEditing(false);
  }

  function save() {
    const fd = new FormData();
    // v1.97.0: body-only save. Title is owned by CardChrome's inline
    // input (saves on blur via updateBookSubsection with just the
    // title field), so posting it here would either be a no-op or
    // race CardChrome's save. Cleaner: each save touches only its
    // own field.
    fd.set("bodyHtml", bodyHtml);
    startTransition(async () => {
      try {
        await updateBookSubsection(sub.id, fd);
        // v1.95.4: force-refresh before the view-mode flip so the
        // RichTextRead view-mode body picks up the freshly-saved
        // `sub.bodyHtml`.
        router.refresh();
        setEditing(false);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  // v1.96.1 / v1.96.5 / v1.97.0 gallery handlers. Each runs inside
  // startTransition + calls router.refresh() on success so the
  // mediaBlock re-renders against fresh BookSubsection state.
  const fileIds = sub.fileIds ?? [];
  const photoSize: GallerySize = sub.photoSize ?? "md";
  const photoDisplay: GalleryDisplay = sub.photoDisplay ?? "gallery";
  function changePhotoSize(next: GallerySize) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoSize(sub.id, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function changePhotoDisplay(next: GalleryDisplay) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoDisplay(sub.id, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function pinHeader(fileId: string | null) {
    startTransition(async () => {
      const res = await setBookSubsectionHeaderFileId(sub.id, fileId);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function toggleSlideshowAuto(auto: boolean) {
    startTransition(async () => {
      const res = await setBookSubsectionSlideshowAuto(sub.id, auto);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function attachFile(fileId: string) {
    startTransition(async () => {
      const res = await attachFileToTextCard(sub.id, fileId);
      if (!res.ok) notify("error", res.error);
      else router.refresh();
    });
  }
  function detachFile(fileId: string) {
    startTransition(async () => {
      const res = await detachFileFromTextCard(sub.id, fileId);
      if (!res.ok) notify("error", res.error);
      else router.refresh();
    });
  }

  // Photo block — only render the wrapper when there's something to
  // show (attached files) OR the viewer can edit (so the empty-state
  // hint + management chrome are still reachable).
  const mediaBlock =
    canEdit || fileIds.length > 0 ? (
      <>
        <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
          Photos ({fileIds.length})
        </strong>
        <ImageGallery
          fileIds={fileIds}
          files={files}
          canEdit={canEdit}
          pending={pending}
          onUpload={async (file) => {
            const fd = new FormData();
            fd.set("file", file);
            const res = await uploadAndAttachTextFile(sub.id, fd);
            if (res.ok) {
              notify("success", "Photo uploaded");
              router.refresh();
            } else {
              notify("error", res.error);
            }
          }}
          onAttach={attachFile}
          onDetach={detachFile}
          size={photoSize}
          onSizeChange={changePhotoSize}
          display={photoDisplay}
          headerFileId={sub.headerFileId ?? null}
          slideshowAuto={sub.slideshowAuto ?? false}
          editMode={editing}
          onDisplayChange={changePhotoDisplay}
          onHeaderPin={pinHeader}
          onSlideshowAutoChange={toggleSlideshowAuto}
        />
      </>
    ) : null;

  return (
    <CardChrome
      subsectionId={sub.id}
      slug={sub.slug}
      initialTitle={sub.title}
      visibility={sub.visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Notes"
      linkedTasks={linkedTasks}
      users={users}
      mediaBlock={mediaBlock}
      hideHousekeeping={editing}
      actions={
        canEdit
          ? editing
            ? (
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
            )
            : (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )
          : undefined
      }
    >
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
    </CardChrome>
  );
}
