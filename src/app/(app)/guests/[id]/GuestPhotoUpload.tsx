"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  clearGuestProfilePicture,
  uploadGuestProfilePicture,
} from "../actions";

// v1.67.0: per-guest profile-picture upload control. Sits on the
// guest detail page next to the name + RSVP pill. Single hidden
// `<input type="file" accept="image/*">` triggered by clicking the
// avatar (touch-friendly) or the "Upload photo" / "Change photo"
// button.
//
// Why the avatar IS the upload trigger. On mobile especially, the
// most natural affordance is "tap the picture to change it" — same
// pattern as every social-network profile editor. The text button
// stays as a secondary affordance for keyboard users / discoverability.
//
// The component renders the existing <Avatar> at 96px, so the
// initials-fallback path renders identically before the user has
// uploaded anything. After upload, the same `<Avatar pictureFileId>`
// path renders the photo. Server-side revalidation refreshes the
// page on success — the new photo replaces the placeholder
// automatically without the component needing to manage local state.

export function GuestPhotoUpload({
  guestId,
  guestName,
  pictureFileId,
  canEdit,
}: {
  guestId: string;
  guestName: string;
  pictureFileId: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  function pickFile() {
    if (!canEdit) return;
    fileInputRef.current?.click();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadGuestProfilePicture(guestId, fd);
      if (res.ok) notify("success", "Photo updated");
      else notify("error", res.error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: `Remove ${guestName}'s photo?`,
      body: "The file stays on /files — you can reuse it later. The guest goes back to the initials placeholder.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await clearGuestProfilePicture(guestId);
      if (res.ok) notify("success", "Photo removed");
      else notify("error", res.error);
    });
  }

  const hasPhoto = !!pictureFileId;
  const busy = pending || uploading;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={pickFile}
        disabled={!canEdit || busy}
        // The avatar itself is the primary upload affordance. Add a
        // subtle hover ring on hover-capable devices to hint at
        // interactivity; on touch the user sees the explicit text
        // button below so they know it's tappable.
        className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500 disabled:cursor-not-allowed group"
        title={canEdit ? "Click to upload a photo" : guestName}
        aria-label={canEdit ? `Upload photo for ${guestName}` : `${guestName}'s avatar`}
      >
        <Avatar name={guestName} size={96} pictureFileId={pictureFileId} />
        {canEdit && (
          // Camera-icon overlay on hover (desktop) / always (mobile)
          // to cue the user that this is interactive. Sits on top of
          // the avatar at the bottom-right.
          <span
            className="absolute bottom-0 right-0 w-7 h-7 bg-surface border border-border-soft rounded-full flex items-center justify-center text-base shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            aria-hidden
          >
            📷
          </span>
        )}
      </button>

      {canEdit && (
        <div className="flex flex-col gap-1.5 items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={busy}
          />
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="text-xs text-info hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploading…" : hasPhoto ? "Change photo" : "+ Upload photo"}
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="text-xs text-ink-tertiary hover:text-danger disabled:opacity-50"
            >
              Remove photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
