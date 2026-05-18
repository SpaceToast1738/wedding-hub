"use client";

// v1.91.0: DRESS_CODE card editor. Couple-internal reference for the
// dress-code + colour / footwear / weather / accessory guidance the
// couple gives guests on request.
//
// View / edit toggle mirrors SubsectionEditor (TEXT card) + STAY /
// SETUP cards. Single-row card (no item children); rich text
// `bodyHtml` for long-form guidance below the structured fields;
// ImageGallery for mood-board photos via the standard attach /
// detach / upload paths.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor, RichTextRead } from "@/components/ui/RichTextEditor";
import {
  GalleryHero,
  ImageGallery,
  type GalleryDisplay,
  type GallerySize,
  type HeaderPosition,
} from "@/components/ui/ImageGallery";
import { notify } from "@/lib/notify";
import {
  saveDressCodeCard,
  attachFileToDressCodeCard,
  detachFileFromDressCodeCard,
  uploadAndAttachDressCodeFile,
  setBookSubsectionHeaderFileId,
  setBookSubsectionHeaderPosition,
  setBookSubsectionPhotoDisplay,
  setBookSubsectionPhotoSize,
  setBookSubsectionSlideshowAuto,
  type DressCodeSavePayload,
} from "../actions";
import { CardLinkedTasksPanel, type LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

type CardData = {
  id: string;
  dressCode: string | null;
  summary: string | null;
  bodyHtml: string | null;
  colourGuidance: string | null;
  footwear: string | null;
  weather: string | null;
  accessories: string | null;
  fileIds: string[];
  // v1.99.4: gallery layout props live on BookSubsection — threaded
  // by CardRouter alongside the per-kind payload.
  photoSize: GallerySize;
  photoDisplay: GalleryDisplay;
  headerFileId: string | null;
  headerPosition: HeaderPosition;
  slideshowAuto: boolean;
};

type Props = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  card: CardData;
  files: Array<{ id: string; name: string; mimeType: string }>;
  // v1.92.0: inline linked-tasks panel.
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
};

// Read-mode field row — heading + value paragraph. Returns null when
// the value is empty so the read view collapses to only the populated
// fields (no empty stubs).
function FieldRow({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div>
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <p className="text-sm text-ink-secondary whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function BookDressCodeCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  card,
  files,
  linkedTasks = [],
  users = [],
}: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // v1.99.4: gallery handlers — same v1.95.4 router.refresh after
  // action pattern as OUTFIT / TEXT. Each persists a BookSubsection
  // column owned by the page chrome (not the per-kind card payload),
  // hence the subsectionId-keyed calls.
  function changePhotoSize(next: GallerySize) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoSize(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function changePhotoDisplay(next: GalleryDisplay) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoDisplay(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function pinHeader(fileId: string | null) {
    startTransition(async () => {
      const res = await setBookSubsectionHeaderFileId(subsectionId, fileId);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function changeHeaderPosition(next: HeaderPosition) {
    startTransition(async () => {
      const res = await setBookSubsectionHeaderPosition(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function toggleSlideshowAuto(auto: boolean) {
    startTransition(async () => {
      const res = await setBookSubsectionSlideshowAuto(subsectionId, auto);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }

  // Draft state — held locally so cancel reverts without round-trips.
  const [draft, setDraft] = useState({
    dressCode: card.dressCode ?? "",
    summary: card.summary ?? "",
    bodyHtml: card.bodyHtml ?? "",
    colourGuidance: card.colourGuidance ?? "",
    footwear: card.footwear ?? "",
    weather: card.weather ?? "",
    accessories: card.accessories ?? "",
  });

  // Re-sync the draft when the underlying card prop changes (e.g.
  // after a revalidate completes). Mirrors the SubsectionEditor /
  // SETUP card pattern.
  useEffect(() => {
    setDraft({
      dressCode: card.dressCode ?? "",
      summary: card.summary ?? "",
      bodyHtml: card.bodyHtml ?? "",
      colourGuidance: card.colourGuidance ?? "",
      footwear: card.footwear ?? "",
      weather: card.weather ?? "",
      accessories: card.accessories ?? "",
    });
  }, [card.id, card.dressCode, card.summary, card.bodyHtml, card.colourGuidance, card.footwear, card.weather, card.accessories]);

  function cancel() {
    setDraft({
      dressCode: card.dressCode ?? "",
      summary: card.summary ?? "",
      bodyHtml: card.bodyHtml ?? "",
      colourGuidance: card.colourGuidance ?? "",
      footwear: card.footwear ?? "",
      weather: card.weather ?? "",
      accessories: card.accessories ?? "",
    });
    setEditing(false);
  }

  function save() {
    const payload: DressCodeSavePayload = {
      dressCode: draft.dressCode.trim() || null,
      summary: draft.summary.trim() || null,
      bodyHtml: draft.bodyHtml || null,
      colourGuidance: draft.colourGuidance.trim() || null,
      footwear: draft.footwear.trim() || null,
      weather: draft.weather.trim() || null,
      accessories: draft.accessories.trim() || null,
    };
    startTransition(async () => {
      const res = await saveDressCodeCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Dress code saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const hasAnyContent =
    !!card.dressCode ||
    !!card.summary ||
    !!card.bodyHtml ||
    !!card.colourGuidance ||
    !!card.footwear ||
    !!card.weather ||
    !!card.accessories ||
    card.fileIds.length > 0;

  return (
    <article
      id={slug}
      className="bg-surface border border-border-soft rounded-md shadow-sm p-5 scroll-mt-24"
    >
      <div className="flex items-start gap-2 mb-3">
        <h3 className="text-base font-semibold text-ink-primary flex-1">{title}</h3>
        {/* v1.91.0: dress-code chip in the header — primary "this is
            the headline answer to 'what should I wear?'". */}
        {card.dressCode && !editing && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-marigold-100 text-marigold-700 border border-marigold-700/30 self-center whitespace-nowrap">
            {card.dressCode}
          </span>
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

      {/* v1.99.6: hero pinned to the top of the card. Mirrors the
          CardChrome.mediaBlock pattern used by the 5 kinds that
          render via CardChrome; DRESS_CODE uses a bespoke <article>
          and so renders the hero inline here. */}
      {(() => {
        if (!card.headerFileId) return null;
        if (!card.fileIds.includes(card.headerFileId)) return null;
        const heroFile = files.find((f) => f.id === card.headerFileId);
        if (!heroFile || !heroFile.mimeType.startsWith("image/")) return null;
        return (
          <div className="mb-4">
            <GalleryHero
              file={heroFile}
              position={card.headerPosition}
              editMode={editing}
              pending={pending}
              onPositionChange={changeHeaderPosition}
              onUnpin={() => pinHeader(null)}
            />
          </div>
        );
      })()}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Dress code
              </label>
              <Input
                value={draft.dressCode}
                onChange={(e) => setDraft({ ...draft, dressCode: e.target.value })}
                placeholder="e.g. Smart casual"
                disabled={pending}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Summary
              </label>
              <Input
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="One-line elevator pitch"
                disabled={pending}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Detail
            </label>
            <RichTextEditor
              value={draft.bodyHtml}
              onChange={(html) => setDraft({ ...draft, bodyHtml: html })}
              disabled={pending}
              placeholder="Long-form guidance — example outfits, what we're wearing, anything else worth saying."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Colour guidance
              </label>
              <Input
                value={draft.colourGuidance}
                onChange={(e) => setDraft({ ...draft, colourGuidance: e.target.value })}
                placeholder="e.g. Please avoid white / ivory"
                disabled={pending}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Footwear
              </label>
              <Input
                value={draft.footwear}
                onChange={(e) => setDraft({ ...draft, footwear: e.target.value })}
                placeholder="e.g. Comfortable shoes — ceremony on grass"
                disabled={pending}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Weather
              </label>
              <Input
                value={draft.weather}
                onChange={(e) => setDraft({ ...draft, weather: e.target.value })}
                placeholder="e.g. Outdoor ceremony in September — bring layers"
                disabled={pending}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Accessories
              </label>
              <Input
                value={draft.accessories}
                onChange={(e) => setDraft({ ...draft, accessories: e.target.value })}
                placeholder="e.g. Hats welcome / no fascinators"
                disabled={pending}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasAnyContent && (
            <p className="text-sm text-ink-tertiary italic">
              No dress code guidance yet. {canEdit && "Click Edit to add one."}
            </p>
          )}
          {card.summary && (
            <p className="text-sm text-ink-primary font-medium">{card.summary}</p>
          )}
          {card.bodyHtml && <RichTextRead html={card.bodyHtml} />}
          {(card.colourGuidance || card.footwear || card.weather || card.accessories) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <FieldRow label="Colour guidance" value={card.colourGuidance} />
              <FieldRow label="Footwear" value={card.footwear} />
              <FieldRow label="Weather" value={card.weather} />
              <FieldRow label="Accessories" value={card.accessories} />
            </div>
          )}
        </div>
      )}
      {/* v1.99.4: gallery hoisted out of the view/edit split. The
          gallery's own editMode prop hides management chrome in view
          mode; mode picker / size toggle / star-pin only appear when
          editing. Pre-fix this lived twice (one rich edit instance,
          one read-only view instance) which meant view mode ignored
          the v1.97.0 photoDisplay choice. */}
      {(card.fileIds.length > 0 || (canEdit && editing)) && (
        <div className="mt-3">
          <ImageGallery
            fileIds={card.fileIds}
            files={files}
            canEdit={canEdit}
            pending={pending}
            editMode={editing}
            size={card.photoSize}
            display={card.photoDisplay}
            headerFileId={card.headerFileId}
            slideshowAuto={card.slideshowAuto}
            onSizeChange={changePhotoSize}
            onDisplayChange={changePhotoDisplay}
            onHeaderPin={pinHeader}
            onSlideshowAutoChange={toggleSlideshowAuto}
            onUpload={async (file) => {
              const fd = new FormData();
              fd.set("file", file);
              const res = await uploadAndAttachDressCodeFile(subsectionId, fd);
              if (!res.ok) notify("error", res.error);
            }}
            onAttach={(fileId) => {
              startTransition(async () => {
                const res = await attachFileToDressCodeCard(subsectionId, fileId);
                if (!res.ok) notify("error", res.error);
              });
            }}
            onDetach={(fileId) => {
              startTransition(async () => {
                const res = await detachFileFromDressCodeCard(subsectionId, fileId);
                if (!res.ok) notify("error", res.error);
              });
            }}
          />
        </div>
      )}

      {/* v1.92.0: linked-tasks panel rendered inside the card. */}
      {(linkedTasks.length > 0 || canEdit) && (
        <CardLinkedTasksPanel
          tasks={linkedTasks}
          subsectionId={subsectionId}
          canEdit={canEdit}
          users={users}
        />
      )}

      {canEdit && (
        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border-soft">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save"}
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
