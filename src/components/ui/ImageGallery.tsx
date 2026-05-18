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
// v1.97.0: gallery becomes mode-aware. Three display modes (gallery /
// header / slideshow) exclusive — picking header hid the body.
//
// v1.99.4: header is no longer a display mode; it's additive. The
// hero (when there's a pinned image) renders ABOVE whatever body
// mode is picked. Body modes are: gallery (default, the v1.96 grid),
// slideshow (carousel), mosaic (Pinterest-style masonry — new in
// v1.99.4). Slideshow inherits the `size` knob (was gallery-only).
// New `headerPosition` 9-point grid drives CSS object-position on
// the hero.

const IMAGE_MIME_PREFIX = "image/";

export type GalleryFile = {
  id: string;
  name: string;
  mimeType: string;
};

// v1.98.1: extended from 3 buckets (sm/md/lg) to 5 (xs/sm/md/lg/xl).
// xs is for cards stuffed with reference photos where the couple just
// wants to glance at the spread; xl is the "show me one shot prominently
// without switching to a hero" lever.
export type GallerySize = "xs" | "sm" | "md" | "lg" | "xl";
// v1.99.4: dropped "header" (now additive — controlled by headerFileId);
// added "mosaic" (Pinterest-style masonry).
export type GalleryDisplay = "gallery" | "slideshow" | "mosaic";

// v1.99.4: 9-point hero position. Maps to CSS object-position.
export type HeaderPosition =
  | "tl" | "t" | "tr"
  | "l"  | "c" | "r"
  | "bl" | "b" | "br";

const POSITION_CSS: Record<HeaderPosition, string> = {
  tl: "0% 0%",   t: "50% 0%",   tr: "100% 0%",
  l:  "0% 50%",  c: "50% 50%",  r:  "100% 50%",
  bl: "0% 100%", b: "50% 100%", br: "100% 100%",
};

const POSITION_LABELS: Record<HeaderPosition, string> = {
  tl: "Top-left",   t: "Top",     tr: "Top-right",
  l:  "Left",       c: "Centre",  r:  "Right",
  bl: "Bottom-left", b: "Bottom", br: "Bottom-right",
};

const SIZE_GRID_CLASSES: Record<GallerySize, string> = {
  xs: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1",
  sm: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5",
  md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2",
  lg: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
  xl: "grid-cols-1 md:grid-cols-2 gap-4",
};

// v1.99.4: slideshow height per size (was fixed aspect-[16/9]).
const SLIDESHOW_HEIGHTS: Record<GallerySize, string> = {
  xs: "h-[160px]",
  sm: "h-[220px]",
  md: "h-[300px]",
  lg: "h-[400px]",
  xl: "h-[520px]",
};

// v1.99.4: mosaic column count per size. CSS `column-count` flows
// images at natural aspect ratio so the heights stagger naturally.
const MASONRY_COLUMNS: Record<GallerySize, string> = {
  xs: "columns-5",
  sm: "columns-4",
  md: "columns-3",
  lg: "columns-2",
  xl: "columns-1",
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
  /** v1.96.4: per-card gallery-mode thumbnail size.
   *  v1.99.4: also drives slideshow height + mosaic column count. */
  size?: GallerySize;
  /** v1.96.4: when provided, renders the XS-XL toggle in edit mode. */
  onSizeChange?: (next: GallerySize) => void;
  /** v1.97.0: display mode router.
   *  v1.99.4: narrowed — "header" dropped (it's additive now). */
  display?: GalleryDisplay;
  /** v1.97.0: pinned hero image id. v1.99.4: presence of a pin (non-
   *  null + still attached) is what enables the hero — no separate
   *  display mode. */
  headerFileId?: string | null;
  /** v1.99.4: 9-point hero position (object-position). */
  headerPosition?: HeaderPosition;
  /** v1.99.4: hero position picker handler. */
  onHeaderPositionChange?: (next: HeaderPosition) => void;
  /** v1.97.0: per-card slideshow auto-advance (slideshow mode only). */
  slideshowAuto?: boolean;
  /** v1.97.0: edit-mode gate. When false, all management chrome
   *  hides — renders the photos only. Decoupled from `canEdit`
   *  (which is the viewer's permission); callers set this to the
   *  per-render editing-vs-viewing flag. */
  editMode?: boolean;
  /** v1.97.0: display-mode picker handler (edit mode only). */
  onDisplayChange?: (next: GalleryDisplay) => void;
  /** v1.97.0: header-pin handler called from the gallery / mosaic
   *  sub-renderer (the ★ button on each thumb in edit mode). Pass
   *  `null` to unpin. */
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
  headerPosition = "c",
  onHeaderPositionChange,
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

  // v1.99.4: hero resolution. Two guards:
  //   1. `headerFileId` must be non-null (the tied "favourite = header"
  //      switch — no pin, no hero).
  //   2. The pinned file must STILL be attached to the card. Catches
  //      the detach-while-pinned race where someone detaches the
  //      pinned image without the pin being cleared. The pre-fix
  //      setBookSubsectionHeaderFileId validates at write-time only;
  //      this render-level guard handles the visible symptom.
  const hero =
    headerFileId &&
    fileIds.includes(headerFileId)
      ? attached.find((f) => f.id === headerFileId && isImageMime(f.mimeType)) ?? null
      : null;

  // Dedupe: a pinned hero shouldn't double-render in the body.
  const bodyAttached = hero
    ? attached.filter((f) => f.id !== hero.id)
    : attached;
  const bodyImages = bodyAttached.filter((f) => isImageMime(f.mimeType));

  // Pre-uploaded files not yet on this card. Hide non-image MIMEs from
  // the "attach existing" picker by default — the use case is photos,
  // not arbitrary file attachments.
  const availableForAttach = files.filter(
    (f) => !fileIds.includes(f.id) && isImageMime(f.mimeType),
  );

  const [lightboxId, setLightboxId] = useState<string | null>(null);

  // Lightbox keyboard nav — Esc closes, ←/→ moves between attached
  // images (including the hero, so a user opening the hero can flip
  // through the others).
  const allImages = attached.filter((f) => isImageMime(f.mimeType));
  useEffect(() => {
    if (!lightboxId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxId(null);
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (allImages.length === 0) return;
        const idx = allImages.findIndex((f) => f.id === lightboxId);
        if (idx === -1) return;
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const next = allImages[(idx + delta + allImages.length) % allImages.length];
        if (next) setLightboxId(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxId, allImages]);

  // v1.97.0: edit-mode-only management chrome. Pre-fix all the
  // controls were gated on `canEdit` alone; now they require the
  // parent to flip `editMode={true}` (typically only when the
  // surrounding card is in edit mode).
  const showChrome = canEdit && editMode;

  return (
    <div className="space-y-2">
      {/* v1.97.0 / v1.99.4: body-mode picker (edit mode only). Header
          is no longer in this picker — it's controlled by the ★ pin. */}
      {showChrome && onDisplayChange && (
        <ModePicker
          value={display}
          onChange={onDisplayChange}
          pending={pending}
        />
      )}

      {/* v1.96.4 / v1.99.4: size toggle. Now applies across all three
          body modes (gallery thumbs / slideshow height / mosaic column
          count). */}
      {showChrome && onSizeChange && (
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

      {/* v1.99.4: HERO. Only renders when there's a valid pin. Hero is
          additive — body section still renders below. */}
      {hero && (
        <HeaderHero
          hero={hero}
          position={headerPosition}
          editMode={showChrome}
          pending={pending}
          onOpenLightbox={setLightboxId}
          onPositionChange={onHeaderPositionChange}
          onUnpin={() => onHeaderPin?.(null)}
        />
      )}

      {/* v1.99.4: BODY. Routes between gallery / slideshow / mosaic.
          Suppressed in view mode when there are no body files — avoids
          an empty placeholder under the hero. Edit mode keeps it
          rendered so the empty-state hint can show. */}
      {(bodyAttached.length > 0 || showChrome) && (() => {
        if (display === "slideshow") {
          return (
            <SlideshowCarousel
              images={bodyImages}
              size={size}
              auto={slideshowAuto}
              emptyHint={emptyHint}
              onOpenLightbox={setLightboxId}
            />
          );
        }
        if (display === "mosaic") {
          return (
            <MosaicMasonry
              attached={bodyAttached}
              size={size}
              showChrome={showChrome}
              pending={pending}
              onDetach={onDetach}
              onOpenLightbox={setLightboxId}
              headerFileId={headerFileId}
              onHeaderPin={onHeaderPin}
              emptyHint={emptyHint}
            />
          );
        }
        return (
          <GalleryGrid
            attached={bodyAttached}
            size={size}
            showChrome={showChrome}
            pending={pending}
            onDetach={onDetach}
            onOpenLightbox={setLightboxId}
            headerFileId={headerFileId}
            onHeaderPin={onHeaderPin}
            emptyHint={emptyHint}
          />
        );
      })()}

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
                if (allImages.length <= 1) return null;
                const idx = allImages.findIndex((x) => x.id === f.id);
                return ` · ${idx + 1} of ${allImages.length} · ← → to navigate`;
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
  // v1.99.4: dropped Header (now controlled by ★ pin), added Mosaic.
  const modes: { id: GalleryDisplay; label: string; hint: string }[] = [
    { id: "gallery", label: "Gallery", hint: "Grid of thumbnails" },
    { id: "slideshow", label: "Slideshow", hint: "Auto-cycling carousel" },
    { id: "mosaic", label: "Mosaic", hint: "Masonry — natural aspect ratio" },
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

// ── Size toggle (now used in gallery / slideshow / mosaic) ─────────

function SizeToggle({
  value,
  onChange,
  pending,
}: {
  value: GallerySize;
  onChange: (next: GallerySize) => void;
  pending: boolean;
}) {
  const labels: Record<GallerySize, string> = {
    xs: "extra small",
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "extra large",
  };
  return (
    <div className="flex items-center justify-end gap-0.5">
      {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={pending || active}
            aria-pressed={active}
            title={`Photo size: ${labels[s]}`}
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
            {/* v1.97.0 / v1.99.4: header-pin ★ — clicking pins (which
                in v1.99.4 implicitly enables the hero), unpins if
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
                aria-label={isPinnedHeader ? `Unpin ${f.name} from header` : `Favourite ${f.name} as header`}
                title={isPinnedHeader ? "Unpin from header" : "Favourite — show as header"}
              >
                ★
              </button>
            )}
            {showChrome && (
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

// ── Sub-renderer: Mosaic masonry (v1.99.4) ─────────────────────────

function MosaicMasonry({
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
  // v1.99.4: CSS column-count gives Pinterest-style masonry without
  // a JS measurement library. `break-inside-avoid` keeps an image
  // from being split across columns. `gap-2` would only apply to
  // flex/grid; Tailwind's `columns-*` includes a default column-gap
  // so we lean on that + `mb-2` for vertical spacing within columns.
  return (
    <div className={`${MASONRY_COLUMNS[size]} gap-2`}>
      {attached.map((f) => {
        const isImage = isImageMime(f.mimeType);
        const isPinnedHeader = f.id === headerFileId;
        return (
          <div
            key={f.id}
            className="break-inside-avoid mb-2 relative group rounded-md overflow-hidden border border-border-soft bg-canvas"
          >
            {isImage ? (
              <button
                type="button"
                onClick={() => onOpenLightbox(f.id)}
                className="block w-full focus:outline-none"
                title={f.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${f.id}`}
                  alt={f.name}
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </button>
            ) : (
              <Link
                href={`/api/files/${f.id}`}
                className="block px-3 py-4 text-center"
                title={f.name}
              >
                <span className="text-2xl block">📎</span>
                <span className="text-[10px] text-ink-secondary truncate w-full block mt-1">
                  {f.name}
                </span>
              </Link>
            )}
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
                aria-label={isPinnedHeader ? `Unpin ${f.name} from header` : `Favourite ${f.name} as header`}
                title={isPinnedHeader ? "Unpin from header" : "Favourite — show as header"}
              >
                ★
              </button>
            )}
            {showChrome && (
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
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-renderer: Header hero (additive in v1.99.4) ─────────────────

function HeaderHero({
  hero,
  position,
  editMode,
  pending,
  onOpenLightbox,
  onPositionChange,
  onUnpin,
}: {
  hero: GalleryFile;
  position: HeaderPosition;
  editMode: boolean;
  pending: boolean;
  onOpenLightbox: (id: string) => void;
  onPositionChange?: (next: HeaderPosition) => void;
  onUnpin: () => void;
}) {
  // v1.98.1: fixed 260 px height (pre-fix the hero used `aspect-[16/9]`
  // which made the height depend on the card's width — wide cards
  // got tall heroes that pushed the body well below the fold).
  // Bottom-fade via CSS mask so the image visually melts into the
  // body content below rather than ending in a hard rectangle edge.
  // `webkitMaskImage` mirror keeps Safari happy.
  const fadeStyle = {
    maskImage:
      "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
    objectPosition: POSITION_CSS[position],
  } as const;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenLightbox(hero.id)}
        className="block w-full h-[260px] overflow-hidden rounded-md bg-canvas focus:outline-none"
        title={hero.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${hero.id}`}
          alt={hero.name}
          loading="lazy"
          className="w-full h-full object-cover"
          style={fadeStyle}
        />
      </button>
      {/* v1.99.4: edit-mode hero overlay — 9-point position grid +
          unpin shortcut. Positioned bottom-right with backdrop-blur
          so it stays legible across image content. */}
      {editMode && onPositionChange && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <PositionGrid
            value={position}
            onChange={onPositionChange}
            pending={pending}
          />
          <button
            type="button"
            onClick={onUnpin}
            disabled={pending}
            title="Unpin header (un-favourite)"
            aria-label="Unpin header"
            className="w-8 h-8 rounded-full bg-surface/90 backdrop-blur-sm border border-border-soft text-marigold-700 hover:text-ink-primary hover:bg-surface leading-none text-sm shadow-sm flex items-center justify-center"
          >
            ★
          </button>
        </div>
      )}
    </div>
  );
}

// v1.99.4: 9-point position dot grid. Marigold-filled dot = active;
// outline dot = inactive. Each dot ~9px so the whole grid is ~36px ×
// 36px — sits unobtrusively in the hero's bottom-right corner.
function PositionGrid({
  value,
  onChange,
  pending,
}: {
  value: HeaderPosition;
  onChange: (next: HeaderPosition) => void;
  pending: boolean;
}) {
  const rows: HeaderPosition[][] = [
    ["tl", "t", "tr"],
    ["l",  "c", "r"],
    ["bl", "b", "br"],
  ];
  return (
    <div
      className="grid grid-cols-3 gap-0.5 p-1 rounded-sm bg-surface/90 backdrop-blur-sm border border-border-soft"
      role="group"
      aria-label="Header image position"
    >
      {rows.flat().map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            disabled={pending || active}
            aria-pressed={active}
            aria-label={`Position: ${POSITION_LABELS[p]}`}
            title={POSITION_LABELS[p]}
            className={[
              "w-2.5 h-2.5 rounded-full border transition-colors",
              active
                ? "bg-marigold-700 border-marigold-700"
                : "bg-canvas border-border-soft hover:border-marigold-700/50",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

// ── Sub-renderer: Slideshow carousel ───────────────────────────────

function SlideshowCarousel({
  images,
  size,
  auto,
  emptyHint,
  onOpenLightbox,
}: {
  images: GalleryFile[];
  size: GallerySize;
  auto: boolean;
  emptyHint: string;
  onOpenLightbox: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Reset index when the underlying list shrinks (e.g. someone
  // detaches the currently-visible photo while in slideshow mode).
  // v1.99.4: also covers the "pin the current slide" case — when the
  // pinned image is excluded from the body list, the index might
  // overshoot.
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
        className={`block w-full ${SLIDESHOW_HEIGHTS[size]} overflow-hidden rounded-md border border-border-soft bg-canvas hover:border-moss-300 focus:outline-none focus:border-moss-500`}
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
