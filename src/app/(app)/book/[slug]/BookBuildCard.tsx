"use client";

import { useEffect, useState, useTransition } from "react";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ImageGallery } from "@/components/ui/ImageGallery";
import {
  copyBuildMaterialsToBudget,
  createBuildSession,
  deleteBuildSession,
  saveBuildCard,
  unlinkBuildBudgetLine,
  updateBuildSession,
  attachFileToBuildCard,
  detachFileFromBuildCard,
  uploadAndAttachBuildFile,
  type BuildSavePayload,
} from "../actions";
import { buildRollups, type BuildCardShape } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import { FieldLabel, Label } from "./bookCardUi";

// v1.31.0 → v1.31.1: BUILD card editor with a single Edit / View
// state.
//
//   - View mode (default): pretty read-only display. Header rollups +
//     materials table + sessions log.
//   - Edit mode: every header field becomes editable, materials gain
//     inline edit + reorder + delete + add-row affordances. Single
//     "Save changes" + "Cancel" at the bottom.
//
// Sessions sit OUTSIDE the edit toggle — they're append-only quick
// log actions and don't need to be batched into the edit flow. "+ Log
// session" + per-row trash icon are always available when canEdit.
//
// Cost is entered as £ pounds-and-pence (decimal, two-place) and
// stored as integer pence — the conversion happens in this component.
//
// Budget link: when card.budgetLineId is set, view mode shows a small
// "Linked to Budget · £X.XX" pill with a "View →" deep-link and a
// quiet × to unlink (couple/admin only).

const STATUS_OPTIONS = ["Designing", "Prototyping", "Producing", "Done"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_TONE: Record<string, string> = {
  Designing: "bg-canvas border-border-soft text-ink-secondary",
  Prototyping: "bg-info/10 border-info/30 text-info",
  Producing: "bg-marigold-100 border-marigold-700/30 text-marigold-700",
  Done: "bg-moss-50 border-moss-300 text-moss-700",
};

type Material = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  website: string | null;
  costPence: number | null;
  ordered: boolean;
  arrived: boolean;
  notes: string | null;
  order: number;
  // v1.78.0: paid-on-material reciprocal chip — sum of PAID payments
  // linked via Payment.bookBuildMaterialId. Optional so the edit-mode
  // draft state (which doesn't carry payments) still type-checks.
  paidPence?: number;
};

type Session = {
  id: string;
  date: Date;
  minutes: number;
  unitsCompleted: number | null;
  notes: string | null;
};

type CardData = {
  id: string;
  quantityNeeded: number | null;
  targetDate: Date | null;
  status: string | null;
  prototypeDone: boolean;
  prototypeNotes: string | null;
  estimatedMinutesPerUnit: number | null;
  notes: string | null;
  budgetLineId: string | null;
  budgetLine: {
    id: string;
    description: string;
    estimated: number | null; // pre-converted to a plain number on the server
  } | null;
  materials: Material[];
  sessions: Session[];
  /** v1.63.0: photo gallery — File ids attached to this card. */
  fileIds: string[];
};

type BuildCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  /** v1.76.0: when false, hide costPence values + the Materials
   *  spend stat. Edit-mode cost input also hidden but the existing
   *  value is preserved via a hidden input on the row's draft. */
  showMoney?: boolean;
  card: CardData;
  /** v1.63.0: all files the user can see, threaded from the page
   *  loader. <ImageGallery> filters this for thumbnails + the
   *  attach-existing dropdown. */
  files: Array<{ id: string; name: string; mimeType: string }>;
};

function formatGBPFromPence(pence: number | null | undefined): string {
  if (pence == null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

function poundsStringToPence(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/£/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function penceToPoundsString(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100).toFixed(2);
}

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function newMaterialId(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

export function BookBuildCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  showMoney = true,
  card,
  files,
}: BuildCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();

  // ── Draft state — only relevant in edit mode. Reset whenever
  // the underlying card prop changes (after a save/revalidate).
  const [draft, setDraft] = useState(() => buildDraft(card));
  useEffect(() => {
    setDraft(buildDraft(card));
  }, [card]);

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    const payload: BuildSavePayload = {
      quantityNeeded: draft.quantityNeeded,
      targetDate: draft.targetDate || null,
      status: draft.status || null,
      prototypeDone: draft.prototypeDone,
      prototypeNotes: draft.prototypeNotes || null,
      estimatedMinutesPerUnit: draft.estimatedMinutesPerUnit,
      notes: draft.notes || null,
      materials: draft.materials.map((m) => ({
        id: m.id,
        name: m.name.trim(),
        quantity: m.quantity,
        unit: m.unit || null,
        supplier: m.supplier || null,
        website: m.website || null,
        costPence: m.costPence,
        ordered: m.ordered,
        arrived: m.arrived,
        notes: m.notes || null,
      })),
    };
    // Validate locally — empty material names are the most common
    // mistake. Refuse to save if any name is blank.
    const blank = payload.materials.findIndex((m) => !m.name);
    if (blank >= 0) {
      notify("error", `Material #${blank + 1} needs a name.`);
      return;
    }
    startTransition(async () => {
      const res = await saveBuildCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  function copyToBudget() {
    startTransition(async () => {
      const res = await copyBuildMaterialsToBudget(card.id);
      if (res.ok) {
        notify(
          "success",
          card.budgetLineId
            ? "Budget line updated"
            : "Budget line created — review on /budget",
        );
        if (!card.budgetLineId) router.push("/budget");
      } else {
        notify("error", res.error);
      }
    });
  }

  async function unlinkBudget() {
    if (!(await confirm({
      title: "Unlink this card from the Budget line?",
      body: "The line itself stays on /budget.",
      confirmLabel: "Unlink",
    }))) return;
    startTransition(async () => {
      const res = await unlinkBuildBudgetLine(card.id);
      if (res.ok) notify("success", "Unlinked");
      else notify("error", res.error);
    });
  }

  // ── Rollups computed from current state (draft when editing,
  // saved card otherwise) so the header reacts live to edits.
  const cardForRollup: BuildCardShape = editing
    ? {
        quantityNeeded: draft.quantityNeeded,
        estimatedMinutesPerUnit: draft.estimatedMinutesPerUnit,
        prototypeDone: draft.prototypeDone,
        targetDate: draft.targetDate ? new Date(draft.targetDate) : null,
        materials: draft.materials,
        sessions: card.sessions,
      }
    : {
        quantityNeeded: card.quantityNeeded,
        estimatedMinutesPerUnit: card.estimatedMinutesPerUnit,
        prototypeDone: card.prototypeDone,
        targetDate: card.targetDate,
        materials: card.materials,
        sessions: card.sessions,
      };
  const r = buildRollups(cardForRollup);

  const targetDateValue = editing
    ? draft.targetDate
      ? new Date(draft.targetDate)
      : null
    : card.targetDate;
  const daysToTarget =
    targetDateValue
      ? Math.round((targetDateValue.getTime() - Date.now()) / MS_PER_DAY)
      : null;

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="DIY"
    >
      {/* Prototype-blocker banner — shown in both view + edit modes */}
      {r.prototypeBlocker && (
        <div className="mb-4 px-3 py-2 bg-marigold-100 border border-marigold-700/30 rounded-md text-xs text-marigold-700 flex items-baseline gap-2">
          <span aria-hidden>⚠</span>
          <span>
            Prototype not done — target&apos;s only {daysToTarget} day{daysToTarget === 1 ? "" : "s"} away.
          </span>
        </div>
      )}

      {/* Top stat strip — always visible, always read-only display */}
      <div className={`grid grid-cols-2 ${showMoney ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2 mb-4`}>
        <Stat
          label="Units"
          value={`${r.unitsDone}${r.unitsDone || (editing ? draft.quantityNeeded : card.quantityNeeded) ? ` / ${(editing ? draft.quantityNeeded : card.quantityNeeded) ?? "?"}` : ""}`}
        />
        <Stat
          label="Hours"
          value={`${r.hoursLogged}${r.hoursEstimated != null ? ` / ${r.hoursEstimated}` : ""}`}
        />
        {showMoney && (
          <Stat label="Materials" value={formatGBPFromPence(r.materialsTotalPence)} />
        )}
        <Stat
          label="Target"
          value={
            targetDateValue
              ? `${targetDateValue.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${daysToTarget != null ? ` (${daysToTarget}d)` : ""}`
              : "—"
          }
        />
      </div>

      {/* Status pill + budget link — always visible */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <StatusPill status={editing ? draft.status : card.status} />
        {!editing && card.budgetLine && (
          <BudgetPill
            line={card.budgetLine}
            onUnlink={canEdit ? unlinkBudget : undefined}
            pending={pending}
          />
        )}
      </div>

      {/* Body — switches between view + edit */}
      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} showMoney={showMoney} />
      ) : (
        <ViewBody
          card={card}
          subsectionId={subsectionId}
          canEdit={canEdit}
          pending={pending}
          startTransition={startTransition}
          showMoney={showMoney}
          files={files}
        />
      )}

      {/* Sessions — view + edit modes both show; new-session form
          stays accessible without entering Edit mode. */}
      <Sessions
        cardId={card.id}
        sessions={card.sessions}
        canEdit={canEdit}
        pending={pending}
        onMutate={(fn) => startTransition(fn)}
      />

      {/* Footer action bar */}
      {canEdit && (
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border-soft">
          <div className="flex gap-2">
            {!editing && card.materials.length > 0 && (
              <Button variant="ghost" size="sm" onClick={copyToBudget} disabled={pending}>
                {card.budgetLineId ? "Update Budget line" : "Copy total to Budget →"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                  Save changes
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </CardChrome>
  );
}

// ── Helpers — view layout pieces ─────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm text-ink-primary tabular-nums truncate font-medium">
        {value || "—"}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-[11px] uppercase tracking-wider text-ink-tertiary border border-dashed border-border-soft rounded-full px-2 py-0.5">
        No status
      </span>
    );
  }
  const tone = STATUS_TONE[status] ?? STATUS_TONE.Designing;
  return (
    <span className={`text-[11px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${tone}`}>
      {status}
    </span>
  );
}

function BudgetPill({
  line,
  onUnlink,
  pending,
}: {
  line: { id: string; description: string; estimated: number | null };
  onUnlink?: () => void;
  pending: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-moss-50 border border-moss-300 text-moss-700 rounded-full px-2 py-0.5">
      <span>Linked to Budget · {line.estimated != null ? `£${line.estimated.toFixed(2)}` : "—"}</span>
      <Link
        href="/budget"
        className="underline hover:text-moss-500"
        title={`On Budget: ${line.description}`}
      >
        view →
      </Link>
      {onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          disabled={pending}
          aria-label="Unlink Budget"
          title="Unlink Budget"
          className="text-moss-700/60 hover:text-danger leading-none"
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── View body ────────────────────────────────────────────────────

function ViewBody({
  card,
  subsectionId,
  canEdit,
  pending,
  startTransition,
  showMoney,
  files,
}: {
  card: CardData;
  subsectionId: string;
  canEdit: boolean;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  showMoney: boolean;
  files: Array<{ id: string; name: string; mimeType: string }>;
}) {
  return (
    <>
      {/* Materials read-only */}
      <Section title="Materials" count={card.materials.length}>
        {card.materials.length === 0 ? (
          <Empty hint="No materials added yet." />
        ) : (
          // v1.66.0 (DR-1): 7-column table — overflow on mobile.
          // min-w forces the wrapper to scroll instead of squashing.
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold border-b border-border-soft">
                <Th align="left">Material</Th>
                <Th align="right">Qty</Th>
                <Th align="left">Unit</Th>
                <Th align="left">Supplier</Th>
                {showMoney && <Th align="right">Cost</Th>}
                <Th align="center">Ord</Th>
                <Th align="center">Arr</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {card.materials.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 px-2 text-ink-primary">{m.name}</td>
                  <td className="py-1.5 px-2 text-ink-secondary tabular-nums text-right">
                    {m.quantity ?? ""}
                  </td>
                  <td className="py-1.5 px-2 text-ink-secondary">{m.unit ?? ""}</td>
                  <td className="py-1.5 px-2 text-ink-secondary">
                    {m.supplier ?? ""}
                    {m.website && (
                      <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-moss-700 hover:underline ml-1">Link ↗</a>
                    )}
                  </td>
                  {showMoney && (
                    <td className="py-1.5 px-2 text-ink-secondary tabular-nums text-right">
                      {formatGBPFromPence(m.costPence)}
                      {/* v1.78.0: paid-on-material reciprocal chip.
                          Renders below the cost when the material has
                          received payments (PAID status only). Green
                          tick when fully covered, otherwise running
                          total in moss. */}
                      {m.paidPence != null && m.paidPence > 0 && (
                        <div
                          className={
                            "text-[10px] mt-0.5 " +
                            (m.costPence != null && (m.paidPence ?? 0) >= m.costPence
                              ? "text-moss-700 font-semibold"
                              : "text-moss-700")
                          }
                          title={
                            m.costPence != null
                              ? `Paid ${formatGBPFromPence(m.paidPence)} of ${formatGBPFromPence(m.costPence)}`
                              : `Paid ${formatGBPFromPence(m.paidPence)}`
                          }
                        >
                          📎{" "}
                          {m.costPence != null && (m.paidPence ?? 0) >= m.costPence
                            ? `${formatGBPFromPence(m.paidPence)} ✓`
                            : `${formatGBPFromPence(m.paidPence)} paid`}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="py-1.5 px-2 text-center">
                    {m.ordered ? <span className="text-moss-700" aria-label="ordered">●</span> : <span className="text-ink-tertiary/40">○</span>}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {m.arrived ? <span className="text-moss-700" aria-label="arrived">●</span> : <span className="text-ink-tertiary/40">○</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      {/* v1.63.0: photo gallery — centerpieces, place cards, etc.
          Renders thumbnails with a click-to-zoom lightbox; the
          + Upload button on the gallery shortcuts straight from a
          phone's camera roll. Hidden entirely if the card has no
          photos AND the user can't add any. */}
      {(card.fileIds.length > 0 || canEdit) && (
        <Section title="Photos" count={card.fileIds.length}>
          <ImageGallery
            fileIds={card.fileIds}
            files={files}
            canEdit={canEdit}
            pending={pending}
            onUpload={async (file) => {
              const fd = new FormData();
              fd.set("file", file);
              const res = await uploadAndAttachBuildFile(subsectionId, fd);
              if (res.ok) notify("success", "Photo uploaded");
              else notify("error", res.error);
            }}
            onAttach={(fileId) => {
              startTransition(async () => {
                const res = await attachFileToBuildCard(subsectionId, fileId);
                if (res.ok) notify("success", "Photo attached");
                else notify("error", res.error);
              });
            }}
            onDetach={(fileId) => {
              startTransition(async () => {
                const res = await detachFileFromBuildCard(subsectionId, fileId);
                if (res.ok) notify("success", "Photo detached");
                else notify("error", res.error);
              });
            }}
            emptyHint="No photos yet — upload some so everyone can see what these should look like."
          />
        </Section>
      )}

      {(card.notes || card.prototypeNotes) && (
        <Section title="Notes">
          {card.prototypeNotes && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
                Prototype
              </div>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">
                {card.prototypeNotes}
              </p>
            </div>
          )}
          {card.notes && (
            <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
          )}
        </Section>
      )}
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
          {title}
        </strong>
        {count !== undefined && (
          <span className="text-[10px] text-ink-tertiary tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return <p className="text-xs text-ink-tertiary italic">{hint}</p>;
}

function Th({ align, children }: { align: "left" | "right" | "center"; children: React.ReactNode }) {
  return (
    <th className={`py-1.5 px-2 font-bold ${align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"}`}>
      {children}
    </th>
  );
}

// ── Edit body ────────────────────────────────────────────────────

type Draft = {
  quantityNeeded: number | null;
  targetDate: string;
  status: string;
  prototypeDone: boolean;
  prototypeNotes: string;
  estimatedMinutesPerUnit: number | null;
  notes: string;
  materials: Material[];
};

function buildDraft(card: CardData): Draft {
  return {
    quantityNeeded: card.quantityNeeded,
    targetDate: isoDate(card.targetDate),
    status: card.status ?? "",
    prototypeDone: card.prototypeDone,
    prototypeNotes: card.prototypeNotes ?? "",
    estimatedMinutesPerUnit: card.estimatedMinutesPerUnit,
    notes: card.notes ?? "",
    materials: card.materials.map((m) => ({ ...m })),
  };
}

function EditBody({
  draft,
  setDraft,
  pending,
  showMoney,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
  showMoney: boolean;
}) {
  function patch(p: Partial<Draft>) {
    setDraft({ ...draft, ...p });
  }
  function patchMaterial(idx: number, p: Partial<Material>) {
    const next = [...draft.materials];
    next[idx] = { ...next[idx]!, ...p };
    setDraft({ ...draft, materials: next });
  }
  function addMaterial() {
    setDraft({
      ...draft,
      materials: [
        ...draft.materials,
        {
          id: newMaterialId(),
          name: "",
          quantity: null,
          unit: null,
          supplier: null,
          website: null,
          costPence: null,
          ordered: false,
          arrived: false,
          notes: null,
          order: draft.materials.length,
        },
      ],
    });
  }
  function removeMaterial(idx: number) {
    setDraft({ ...draft, materials: draft.materials.filter((_, i) => i !== idx) });
  }
  function moveMaterial(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= draft.materials.length) return;
    const next = [...draft.materials];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setDraft({ ...draft, materials: next });
  }

  return (
    <div className="space-y-4">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Status" hint="Where you are in the build journey.">
          <select
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">— pick a status —</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantity needed" hint="How many you're making in total.">
          <input
            type="number"
            min={0}
            value={draft.quantityNeeded ?? ""}
            onChange={(e) =>
              patch({ quantityNeeded: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={pending}
            placeholder="e.g. 14"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
        <Field label="Target date" hint="When the build needs to be done by.">
          <input
            type="date"
            value={draft.targetDate}
            onChange={(e) => patch({ targetDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
        <Field label="Estimated minutes per unit" hint="Roughly how long one takes.">
          <input
            type="number"
            min={0}
            value={draft.estimatedMinutesPerUnit ?? ""}
            onChange={(e) =>
              patch({ estimatedMinutesPerUnit: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={pending}
            placeholder="e.g. 10"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm self-end pb-1.5">
          <input
            type="checkbox"
            checked={draft.prototypeDone}
            onChange={(e) => patch({ prototypeDone: e.target.checked })}
            disabled={pending}
          />
          <span>Prototype done</span>
        </label>
      </div>

      {/* Materials editor */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Materials ({draft.materials.length})
          </strong>
          <Button variant="ghost" size="sm" onClick={addMaterial} disabled={pending}>
            + Add material
          </Button>
        </div>
        {draft.materials.length === 0 ? (
          <Empty hint="Add at least one material — what you'll need to make this." />
        ) : (
          <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
            {draft.materials.map((m, idx) => (
              <MaterialEditRow
                key={m.id}
                material={m}
                isFirst={idx === 0}
                isLast={idx === draft.materials.length - 1}
                pending={pending}
                showMoney={showMoney}
                onChange={(p) => patchMaterial(idx, p)}
                onRemove={() => removeMaterial(idx)}
                onMoveUp={() => moveMaterial(idx, -1)}
                onMoveDown={() => moveMaterial(idx, 1)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Prototype notes" hint="What worked, what to change before producing.">
          <MentionableTextarea
            value={draft.prototypeNotes}
            onChange={(e) => patch({ prototypeNotes: e.target.value })}
            disabled={pending}
            rows={3}
            placeholder="e.g. Try wider ribbon. Pre-bend wire."
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
          />
        </Field>
        <Field label="Notes" hint="Anything else worth remembering.">
          <MentionableTextarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            disabled={pending}
            rows={3}
            placeholder="e.g. Storage: spare bedroom. Pickup before 10:00."
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-tertiary">{hint}</p>}
    </div>
  );
}

function MaterialEditRow({
  material,
  isFirst,
  isLast,
  pending,
  showMoney,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  showMoney: boolean;
  material: Material;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onChange: (p: Partial<Material>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [costStr, setCostStr] = useState(penceToPoundsString(material.costPence));
  // Sync costStr if the material is replaced wholesale (e.g. from
  // setDraft after a parent prop change). Tracked on `id` because
  // we want to reset only when the row identity changes, not on
  // every typed-character costPence change.
  useEffect(() => {
    setCostStr(penceToPoundsString(material.costPence));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

  function commitCost(s: string) {
    const pence = poundsStringToPence(s);
    onChange({ costPence: pence });
  }

  return (
    <li className="px-3 py-3 bg-canvas/30 space-y-2">
      {/* Row 1 — what + how much: name | qty | unit */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-8">
          <Label>Material</Label>
          <input
            value={material.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={pending}
            placeholder="e.g. Mason jars"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-2">
          <Label>Qty</Label>
          <input
            type="number"
            step="any"
            min={0}
            value={material.quantity ?? ""}
            onChange={(e) =>
              onChange({ quantity: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={pending}
            placeholder="0"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-2">
          <Label>Unit</Label>
          <input
            value={material.unit ?? ""}
            onChange={(e) => onChange({ unit: e.target.value })}
            disabled={pending}
            placeholder="ea, m, stems"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 2 — who from / how much £: supplier | £ cost */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-8">
          <Label>Supplier</Label>
          <input
            value={material.supplier ?? ""}
            onChange={(e) => onChange({ supplier: e.target.value })}
            disabled={pending}
            placeholder="e.g. Hobbycraft"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        {showMoney && (
          <FieldLabel className="sm:col-span-4">
            <Label>Total cost</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
              <input
                type="text"
                inputMode="decimal"
                value={costStr}
                onChange={(e) => setCostStr(e.target.value)}
                onBlur={() => commitCost(costStr)}
                disabled={pending}
                placeholder="0.00"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
              />
            </div>
          </FieldLabel>
        )}
      </div>
      {/* Row 3 — website */}
      <FieldLabel>
        <Label>Website</Label>
        <input
          type="url"
          value={material.website ?? ""}
          onChange={(e) => onChange({ website: e.target.value || null })}
          disabled={pending}
          placeholder="https://…"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
        />
      </FieldLabel>
      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={material.ordered}
              onChange={(e) => onChange({ ordered: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Ordered</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={material.arrived}
              onChange={(e) => onChange({ arrived: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Arrived</span>
          </label>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={pending || isFirst}
            className="text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
            aria-label="Move up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={pending || isLast}
            className="text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
            aria-label="Move down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="text-ink-tertiary hover:text-danger px-1"
            aria-label="Remove"
            title="Remove material"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Sessions — outside the edit toggle ────────────────────────────

function Sessions({
  cardId,
  sessions,
  canEdit,
  pending,
  onMutate,
}: {
  cardId: string;
  sessions: Session[];
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Section title="Sessions" count={sessions.length}>
      <div className="flex justify-end mb-1.5">
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            + Log session
          </Button>
        )}
      </div>
      {adding && (
        <SessionForm
          cardId={cardId}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
          pending={pending}
          onMutate={onMutate}
        />
      )}
      {sessions.length === 0 && !adding ? (
        <Empty hint="No sessions logged yet." />
      ) : sessions.length > 0 ? (
        <ul className="divide-y divide-border-soft text-sm border border-border-soft rounded-md">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              canEdit={canEdit}
              pending={pending}
              onMutate={onMutate}
            />
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function SessionRow({
  session,
  canEdit,
  pending,
  onMutate,
}: {
  session: Session;
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  async function remove() {
    if (!(await confirm({ title: "Delete this session?", confirmLabel: "Delete", tone: "danger" }))) return;
    onMutate(async () => {
      const res = await deleteBuildSession(session.id);
      if (!res.ok) notify("error", res.error);
    });
  }
  if (editing) {
    return (
      <li className="px-3 py-2 bg-canvas/30">
        <SessionForm
          cardId={session.id}
          isEdit
          initial={session}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          pending={pending}
          onMutate={onMutate}
        />
      </li>
    );
  }
  const hours = Math.round((session.minutes / 60) * 10) / 10;
  return (
    <li className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
      <span className="text-ink-tertiary tabular-nums w-20">
        {session.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </span>
      <span className="text-ink-primary tabular-nums w-12 text-right">{hours}h</span>
      {session.unitsCompleted != null && (
        <span className="text-ink-tertiary tabular-nums w-12 text-right">
          {session.unitsCompleted}u
        </span>
      )}
      <span className="flex-1 text-ink-secondary truncate">{session.notes ?? ""}</span>
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
            disabled={pending}
          >
            edit
          </button>
          <button
            type="button"
            onClick={remove}
            className="text-[10px] text-ink-tertiary hover:text-danger px-1"
            disabled={pending}
            aria-label="Remove"
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}

function SessionForm({
  cardId,
  isEdit,
  initial,
  onCancel,
  onDone,
  pending,
  onMutate,
}: {
  cardId: string;
  isEdit?: boolean;
  initial?: Session;
  onCancel: () => void;
  onDone: () => void;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  function submit(formData: FormData) {
    onMutate(async () => {
      const res = isEdit
        ? await updateBuildSession(cardId, formData)
        : await createBuildSession(cardId, formData);
      if (res.ok) {
        notify("success", isEdit ? "Session updated" : "Session logged");
        onDone();
      } else {
        notify("error", res.error);
      }
    });
  }
  return (
    <form
      action={submit}
      className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 mb-2 px-2 py-2 bg-canvas/40 border border-border-soft rounded-md"
    >
      <input
        name="date"
        type="date"
        defaultValue={isoDate(initial?.date ?? new Date())}
        required
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="minutes"
        type="number"
        min={0}
        defaultValue={initial?.minutes ?? 30}
        required
        placeholder="Minutes"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="unitsCompleted"
        type="number"
        min={0}
        defaultValue={initial?.unitsCompleted ?? ""}
        placeholder="Units"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="notes"
        defaultValue={initial?.notes ?? ""}
        placeholder="Notes (optional)"
        className="sm:col-span-2 text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="sm:col-span-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {isEdit ? "Save" : "Log"}
        </Button>
      </div>
    </form>
  );
}
