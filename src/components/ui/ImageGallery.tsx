"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

// v1.63.0: reusable image-gallery component. Replaces the chip-only
// file display BookOutfitCard had since v1.35.0 — that flow showed
// "📎 dress-fitting.jpg" as a text link, which lost the entire point
// of attaching a photo. This component renders actual thumbnails for
// image MIMEs and click-to-zoom lightbox; falls back to chip-text
// for non-image files.
//
// Storage convention. Files are pre-uploaded to /files (Files page,
// 25MB cap, MIME allowlist) and referenced by id in a `fileIds:
// String[]` column on the parent card. The card's edit / view modes
// both render this component; read-only mode hides the affordances.
//
// Three add paths so the gallery suits both "I have a folder of stuff
// already on /files" and "I just took a photo on my phone":
//   1. Direct upload (file input on the card itself).
//   2. Pick from already-uploaded files (dropdown).
//   3. Detach × per thumbnail.
//
// The gallery doesn't own the upload server action — too coupled to
// the parent kind's audit trail. Instead the parent passes `onUpload`
// (a server action wrapper) that takes a single File and returns the
// new id; the parent's action handles the upload + attach + audit.
// onAttach / onDetach work the same way — they're parent-supplied.

const IMAGE_MIME_PREFIX = "image/";

export type GalleryFile = {
  id: string;
  name: string;
  mimeType: string;
};

export function isImageMime(mime: string): boolean {
  return mime.startsWith(IMAGE_MIME_PREFIX);
}

export function ImageGallery({
  fileIds,
  files,
  canEdit,
  pending,
  onUpload,
  onAttach,
  onDetach,
  emptyHint = "No photos attached.",
  uploadLabel = "+ Upload photo",
  attachLabel = "+ Attach existing",
}: {
  fileIds: string[];
  /** All files the current user can see — passed from the page loader.
   *  The gallery filters this to (a) attached files for render and
   *  (b) detached + image-MIME for the "attach existing" picker. */
  files: GalleryFile[];
  canEdit: boolean;
  pending: boolean;
  /** Optional. When omitted, the upload button is hidden — caller
   *  can opt out by passing only attach/detach (e.g. when uploads
   *  are managed elsewhere or a card kind explicitly forbids new
   *  uploads). */
  onUpload?: (file: File) => Promise<void>;
  onAttach: (fileId: string) => void;
  onDetach: (fileId: string) => void;
  emptyHint?: string;
  uploadLabel?: string;
  attachLabel?: string;
}) {
  const filesById = new Map(files.map((f) => [f.id, f]));
  const attached: GalleryFile[] = fileIds
    .map((id) => filesById.get(id))
    .filter((f): f is GalleryFile => Boolean(f));
  // Pre-uploaded files not yet on this card. Hide non-image MIMEs from
  // the "attach existing" picker by default — the use case is photos,
  // not arbitrary file attachments. Callers wanting non-image attach
  // can use the file picker on /files directly.
  const availableForAttach = files.filter(
    (f) => !fileIds.includes(f.id) && isImageMime(f.mimeType),
  );

  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      // Clear so the same filename can be uploaded again.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Lightbox keyboard nav — Esc closes, ←/→ moves between attached
  // images. Only mounted while open so we don't intercept other
  // shortcuts when the lightbox is dormant.
  useEffect(() => {
    if (!lightboxId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxId(null);
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const imageAttached = attached.filter((f) => isImageMime(f.mimeType));
        if (imageAttached.length === 0) return;
        const idx = imageAttached.findIndex((f) => f.id === lightboxId);
        if (idx === -1) return;
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const next = imageAttached[(idx + delta + imageAttached.length) % imageAttached.length];
        if (next) setLightboxId(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxId, attached]);

  return (
    <div className="space-y-2">
      {/* Hidden file input — triggered by the upload button. */}
      {canEdit && onUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={pending || uploading}
        />
      )}

      {attached.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">{emptyHint}</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {attached.map((f) => {
            const isImage = isImageMime(f.mimeType);
            return (
              <li key={f.id} className="relative group">
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setLightboxId(f.id)}
                    className="block w-full aspect-square overflow-hidden rounded-md border border-border-soft bg-canvas hover:border-moss-300 focus:outline-none focus:border-moss-500"
                    title={f.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${f.id}`}
                      alt={f.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <Link
                    href={`/api/files/${f.id}`}
                    className="block w-full aspect-square rounded-md border border-border-soft bg-canvas hover:border-moss-300 flex flex-col items-center justify-center gap-1 px-2 text-center"
                    title={f.name}
                  >
                    <span className="text-2xl">📎</span>
                    <span className="text-[10px] text-ink-secondary truncate w-full">
                      {f.name}
                    </span>
                  </Link>
                )}
                {canEdit && (
                  // v1.66.0 (DR-1): w-8 h-8 + always-visible on touch
                  // (sm:opacity-0). On hover-capable devices the chrome
                  // hides until hover; on touch devices the button stays
                  // visible because there's no hover state. Touch
                  // targets at 32px are still below the 44px ideal but
                  // sit on a 132px+ thumbnail so the wider tap area
                  // around them is forgiving.
                  <button
                    type="button"
                    onClick={() => onDetach(f.id)}
                    disabled={pending}
                    className="absolute top-1 right-1 w-8 h-8 rounded-full bg-surface/90 border border-border-soft text-ink-tertiary hover:text-danger hover:border-danger leading-none text-base shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    aria-label={`Detach ${f.name}`}
                    title={`Detach ${f.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onUpload && (
            <button
              type="button"
              onClick={pickFile}
              disabled={pending || uploading}
              className="text-[11px] text-info hover:underline disabled:opacity-50"
            >
              {uploading ? "Uploading…" : uploadLabel}
            </button>
          )}
          {availableForAttach.length > 0 && !picking && (
            <button
              type="button"
              onClick={() => setPicking(true)}
              disabled={pending}
              className="text-[11px] text-info hover:underline"
            >
              {attachLabel}
            </button>
          )}
          {picking && (
            <div className="flex items-center gap-1.5">
              <select
                defaultValue=""
                disabled={pending}
                onChange={(e) => {
                  if (e.target.value) {
                    startTransition(() => onAttach(e.target.value));
                    setPicking(false);
                  }
                }}
                className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 max-w-[260px]"
              >
                <option value="">— pick a photo —</option>
                {availableForAttach.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPicking(false)}
                disabled={pending}
                className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
              >
                cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox — fullscreen overlay showing the selected image at
          its natural size (capped to viewport). Click anywhere
          outside the image to close. */}
      {lightboxId && (() => {
        const f = attached.find((x) => x.id === lightboxId);
        if (!f) return null;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Photo: ${f.name}`}
            className="fixed inset-0 z-[600] bg-black/85 flex items-center justify-center p-4"
            onClick={() => setLightboxId(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${f.id}`}
              alt={f.name}
              className="max-w-full max-h-full object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightboxId(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
              aria-label="Close lightbox"
            >
              ×
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/40 rounded-md px-3 py-1">
              {f.name}
              {(() => {
                const imgs = attached.filter((x) => isImageMime(x.mimeType));
                if (imgs.length <= 1) return null;
                const idx = imgs.findIndex((x) => x.id === f.id);
                return ` · ${idx + 1} of ${imgs.length} · ← → to navigate`;
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
