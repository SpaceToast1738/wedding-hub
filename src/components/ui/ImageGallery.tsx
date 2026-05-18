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
//
// v1.97.0: gallery becomes mode-aware. Three display modes:
//   • `gallery` (default): the v1.63.0 grid with v1.96.4 S/M/L sizing.
//   • `header`: one hero image at the top, 16:9, picked from
//     `headerFileId` (or a placeholder + "Pick one in Edit" prompt
//     when not set).
//   • `slideshow`: single-image carousel with prev/next + optional
//     auto-advance (per-card slideshowAuto).
//
// Management chrome (S/M/L toggle, upload button, attach picker,
// detach × per thumb, display-mode picker, header pin button,
// slideshow auto toggle) is gated on a single `editMode` prop —
// view-mode renders the photos and nothing else.

const IMAGE_MIME_PREFIX = "image/";

export type GalleryFile = {
  id: string;
  name: string;
  mimeType: string;
};

export type GallerySize = "sm" | "md" | "lg";
export type GalleryDisplay = "gallery" | "header" | "slideshow";

const SIZE_GRID_CLASSES: Record<GallerySize, string> = {
  sm: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5",
  md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2",
  lg: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
};

export function isImageMime(mime: string): boolean {
  return mime.startsWith(IMAGE_MIME_PREFIX);
}

type Props = {
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
  /** v1.96.4: per-card gallery-mode thumbnail size. */
  size?: GallerySize;
  /** v1.96.4: when provided, renders the S/M/L toggle in edit mode. */
  onSizeChange?: (next: GallerySize) => void;
  /** v1.97.0: display mode router. Defaults to "gallery" (v1.96 behaviour). */
  display?: GalleryDisplay;
  /** v1.97.0: pinned hero image id (header mode only). */
  headerFileId?: string | null;
  /** v1.97.0: per-card slideshow auto-advance (slideshow mode only). */
  slideshowAuto?: boolean;
  /** v1.97.0: edit-mode gate. When false, all management chrome
   *  hides — renders the photos only. Decoupled from `canEdit`
   *  (which is the viewer's permission); callers set this to the
   *  per-render editing-vs-viewing flag. */
  editMode?: boolean;
  /** v1.97.0: display-mode picker handler (edit mode only). */
  onDisplayChange?: (next: GalleryDisplay) => void;
  /** v1.97.0: header-pin handler called from the gallery sub-renderer
   *  (the ⭐ button on each thumb in edit mode). Pass `null` to unpin. */
  onHeaderPin?: (fileId: string | null) => void;
  /** v1.97.0: slideshow auto/manual toggle handler. */
  onSlideshowAutoChange?: (next: boolean) => void;
};

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
  size = "md",
  onSizeChange,
  display = "gallery",
  headerFileId = null,
  slideshowAuto = false,
  editMode = false,
  onDisplayChange,
  onHeaderPin,
  onSlideshowAutoChange,
}: Props) {
  const filesById = new Map(files.map((f) => [f.id, f]));
  const attached: GalleryFile[] = fileIds
    .map((id) => filesById.get(id))
    .filter((f): f is GalleryFile => Boolean(f));
  const attachedImages = attached.filter((f) => isImageMime(f.mimeType));
  // Pre-uploaded files not yet on this card. Hide non-image MIMEs from
  // the "attach existing" picker by default — the use case is photos,
  // not arbitrary file attachments. Callers wanting non-image attach
  // can use the file picker on /files directly.
  const availableForAttach = files.filter(
    (f) => !fileIds.includes(f.id) && isImageMime(f.mimeType),
  );

  const [lightboxId, setLightboxId] = useState<string | null>(null);

  // Lightbox keyboard nav — Esc closes, ←/→ moves between attached
  // images. Only mounted while open so we don't intercept other
  // shortcuts when the lightbox is dormant.
  useEffect(() => {
    if (!lightboxId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxId(null);
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (attachedImages.length === 0) return;
        const idx = attachedImages.findIndex((f) => f.id === lightboxId);
        if (idx === -1) return;
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const next = attachedImages[(idx + delta + attachedImages.length) % attachedImages.length];
        if (next) setLightboxId(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxId, attachedImages]);

  // v1.97.0: edit-mode-only management chrome. Pre-fix all the
  // controls were gated on `canEdit` alone; now they require the
  // parent to flip `editMode={true}` (typically only when the
  // surrounding card is in edit mode).
  const showChrome = canEdit && editMode;

  return (
    <div className="space-y-2">
      {/* v1.97.0: display-mode picker (edit mode only). Sits at the
          top so the picker stays in the same place across modes. */}
      {showChrome && onDisplayChange && (
        <ModePicker
          value={display}
          onChange={onDisplayChange}
          pending={pending}
        />
      )}

      {/* v1.96.4: S/M/L size toggle. Only relevant in gallery mode —
          header / slideshow use fixed sizes. */}
      {showChrome && onSizeChange && display === "gallery" && (
        <SizeToggle value={size} onChange={onSizeChange} pending={pending} />
      )}

      {/* v1.97.0: slideshow auto/manual toggle. Only relevant in
          slideshow mode. */}
      {showChrome && onSlideshowAutoChange && display === "slideshow" && (
        <AutoplayToggle
          value={slideshowAuto}
          onChange={onSlideshowAutoChange}
          pending={pending}
        />
      )}

      {/* Mode router. Each sub-renderer handles its own empty-state
          + lightbox-trigger semantics. */}
      {display === "header" ? (
        <HeaderHero
          attached={attached}
          headerFileId={headerFileId}
          editMode={showChrome}
          emptyHint={emptyHint}
          onOpenLightbox={setLightboxId}
        />
      ) : display === "slideshow" ? (
        <SlideshowCarousel
          images={attachedImages}
          auto={slideshowAuto}
          emptyHint={emptyHint}
          onOpenLightbox={setLightboxId}
        />
      ) : (
        <GalleryGrid
          attached={attached}
          size={size}
          showChrome={showChrome}
          pending={pending}
          onDetach={onDetach}
          onOpenLightbox={setLightboxId}
          headerFileId={headerFileId}
          onHeaderPin={onHeaderPin}
          emptyHint={emptyHint}
        />
      )}

      {/* Management controls — upload / attach. Edit-mode only.
          Always rendered below whatever sub-renderer is active so
          new uploads / attaches reach every mode the same way. */}
      {showChrome && (
        <ManagementControls
          pending={pending}
          onUpload={onUpload}
          uploadLabel={uploadLabel}
          attachLabel={attachLabel}
          availableForAttach={availableForAttach}
          onAttach={onAttach}
        />
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
                if (attachedImages.length <= 1) return null;
                const idx = attachedImages.findIndex((x) => x.id === f.id);
                return ` · ${idx + 1} of ${attachedImages.length} · ← → to navigate`;
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Mode picker ─────────────────────────────────────────────────────

function ModePicker({
  value,
  onChange,
  pending,
}: {
  value: GalleryDisplay;
  onChange: (next: GalleryDisplay) => void;
  pending: boolean;
}) {
  const modes: { id: GalleryDisplay; label: string; hint: string }[] = [
    { id: "gallery", label: "Gallery", hint: "Grid of thumbnails" },
    { id: "header", label: "Header", hint: "One hero image" },
    { id: "slideshow", label: "Slideshow", hint: "Auto-cycling carousel" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mr-1">
        Display
      </span>
      {modes.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            disabled={pending || active}
            aria-pressed={active}
            title={m.hint}
            className={[
              "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border transition-colors",
              active
                ? "bg-moss-500 text-white border-moss-500"
                : "bg-canvas text-ink-tertiary border-border-soft hover:border-moss-300 hover:text-ink-secondary",
            ].join(" ")}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Size toggle (gallery mode only) ────────────────────────────────

function SizeToggle({
  value,
  onChange,
  pending,
}: {
  value: GallerySize;
  onChange: (next: GallerySize) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {(["sm", "md", "lg"] as const).map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={pending || active}
            aria-pressed={active}
            title={`Photo size: ${s === "sm" ? "small" : s === "md" ? "medium" : "large"}`}
            className={[
              "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors",
              active
                ? "bg-moss-500 text-white border-moss-500"
                : "bg-canvas text-ink-tertiary border-border-soft hover:border-moss-300 hover:text-ink-secondary",
            ].join(" ")}
          >
            {s.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ── Autoplay toggle (slideshow mode only) ──────────────────────────

function AutoplayToggle({
  value,
  onChange,
  pending,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        Advance
      </span>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={pending || !value}
        aria-pressed={!value}
        className={[
          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors",
          !value
            ? "bg-moss-500 text-white border-moss-500"
            : "bg-canvas text-ink-tertiary border-border-soft hover:border-moss-300",
        ].join(" ")}
      >
        Manual
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={pending || value}
        aria-pressed={value}
        className={[
          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors",
          value
            ? "bg-moss-500 text-white border-moss-500"
            : "bg-canvas text-ink-tertiary border-border-soft hover:border-moss-300",
        ].join(" ")}
      >
        Auto
      </button>
    </div>
  );
}

// ── Sub-renderer: Gallery grid (the v1.96 default) ─────────────────

function GalleryGrid({
  attached,
  size,
  showChrome,
  pending,
  onDetach,
  onOpenLightbox,
  headerFileId,
  onHeaderPin,
  emptyHint,
}: {
  attached: GalleryFile[];
  size: GallerySize;
  showChrome: boolean;
  pending: boolean;
  onDetach: (fileId: string) => void;
  onOpenLightbox: (id: string) => void;
  headerFileId: string | null;
  onHeaderPin?: (fileId: string | null) => void;
  emptyHint: string;
}) {
  if (attached.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">{emptyHint}</p>;
  }
  return (
    <ul className={`grid ${SIZE_GRID_CLASSES[size]}`}>
      {attached.map((f) => {
        const isImage = isImageMime(f.mimeType);
        const isPinnedHeader = f.id === headerFileId;
        return (
          <li key={f.id} className="relative group">
            {isImage ? (
              <button
                type="button"
                onClick={() => onOpenLightbox(f.id)}
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
            {/* v1.97.0: header-pin ⭐ — only renders in edit mode +
                only on image files (non-image attachments can't be
                heroes). Clicking toggles: pin if unpinned, unpin if
                already pinned. */}
            {showChrome && isImage && onHeaderPin && (
              <button
                type="button"
                onClick={() => onHeaderPin(isPinnedHeader ? null : f.id)}
                disabled={pending}
                className={[
                  "absolute top-1 left-1 w-8 h-8 rounded-full border leading-none text-base shadow-sm transition-opacity",
                  isPinnedHeader
                    ? "bg-marigold-100 text-marigold-700 border-marigold-700/30 opacity-100"
                    : "bg-surface/90 text-ink-tertiary hover:text-marigold-700 hover:border-marigold-700/30 border-border-soft opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                ].join(" ")}
                aria-label={isPinnedHeader ? `Unpin ${f.name} as header` : `Pin ${f.name} as header`}
                title={isPinnedHeader ? "Unpin from header" : "Pin as header image"}
              >
                ★
              </button>
            )}
            {showChrome && (
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
  );
}

// ── Sub-renderer: Header hero ──────────────────────────────────────

function HeaderHero({
  attached,
  headerFileId,
  editMode,
  emptyHint,
  onOpenLightbox,
}: {
  attached: GalleryFile[];
  headerFileId: string | null;
  editMode: boolean;
  emptyHint: string;
  onOpenLightbox: (id: string) => void;
}) {
  if (attached.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">{emptyHint}</p>;
  }
  const hero = headerFileId
    ? attached.find((f) => f.id === headerFileId && isImageMime(f.mimeType))
    : null;
  if (!hero) {
    return (
      <div className="w-full aspect-[16/9] rounded-md border border-dashed border-border-soft bg-canvas flex flex-col items-center justify-center gap-1 text-center px-4">
        <span className="text-2xl">📷</span>
        <span className="text-xs text-ink-secondary font-medium">
          Pick a header image
        </span>
        <span className="text-[10px] text-ink-tertiary">
          {editMode
            ? "★ a thumbnail in Gallery mode to set it as the header."
            : "Open Edit + switch to Gallery mode to choose."}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenLightbox(hero.id)}
      className="block w-full aspect-[16/9] overflow-hidden rounded-md border border-border-soft bg-canvas hover:border-moss-300 focus:outline-none focus:border-moss-500"
      title={hero.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/${hero.id}`}
        alt={hero.name}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </button>
  );
}

// ── Sub-renderer: Slideshow carousel ───────────────────────────────

function SlideshowCarousel({
  images,
  auto,
  emptyHint,
  onOpenLightbox,
}: {
  images: GalleryFile[];
  auto: boolean;
  emptyHint: string;
  onOpenLightbox: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Reset index when the underlying list shrinks (e.g. someone
  // detaches the currently-visible photo while in slideshow mode).
  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  // v1.97.0: auto-advance, 4 seconds per image, pauses on hover.
  // No interval armed when manual mode, single image, or hovered.
  useEffect(() => {
    if (!auto || paused || images.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(t);
  }, [auto, paused, images.length]);

  if (images.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">{emptyHint}</p>;
  }
  const current = images[index] ?? images[0]!;

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => onOpenLightbox(current.id)}
        className="block w-full aspect-[16/9] overflow-hidden rounded-md border border-border-soft bg-canvas hover:border-moss-300 focus:outline-none focus:border-moss-500"
        title={current.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${current.id}`}
          alt={current.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white text-lg leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white text-lg leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 rounded-full px-2 py-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1} of ${images.length}`}
                className={[
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/70",
                ].join(" ")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-renderer: Management (upload + attach) ─────────────────────

function ManagementControls({
  pending,
  onUpload,
  uploadLabel,
  attachLabel,
  availableForAttach,
  onAttach,
}: {
  pending: boolean;
  onUpload?: (file: File) => Promise<void>;
  uploadLabel: string;
  attachLabel: string;
  availableForAttach: GalleryFile[];
  onAttach: (fileId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      {onUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={pending || uploading}
          />
          <button
            type="button"
            onClick={pickFile}
            disabled={pending || uploading}
            className="text-[11px] text-info hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploading…" : uploadLabel}
          </button>
        </>
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
  );
}
