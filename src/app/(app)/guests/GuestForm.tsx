"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";

const RSVP = ["PENDING", "ATTENDING", "DECLINED", "MAYBE"] as const;
const SIDES = ["BRIDE", "GROOM", "BOTH"] as const;

// v2.5.1 (finding #6): canonical dietary values the catering brief can
// tally cleanly. Anything typed into "Other" still gets counted on
// the catering brief — see the synonym-folding step in
// catering/page.tsx — but picking from this list at entry keeps the
// common cases from fragmenting into "Vegetarian" / "veggie" / "V" in
// the first place.
const DIETARY_CANONICAL = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut allergy"] as const;

// Lower-cased synonym → canonical label, so a guest edited after being
// imported (or typed into "Other" before this UI existed) still lands
// on the right checkbox when the row is reopened.
const DIETARY_SYNONYMS: Record<string, string> = {
  vegetarian: "Vegetarian", veggie: "Vegetarian", veg: "Vegetarian", v: "Vegetarian",
  vegan: "Vegan", vgn: "Vegan",
  "gluten-free": "Gluten-free", "gluten free": "Gluten-free", glutenfree: "Gluten-free", gf: "Gluten-free",
  "dairy-free": "Dairy-free", "dairy free": "Dairy-free", dairyfree: "Dairy-free", df: "Dairy-free",
  "lactose intolerant": "Dairy-free", "lactose-free": "Dairy-free",
  "nut allergy": "Nut allergy", "nut-allergy": "Nut allergy", nuts: "Nut allergy",
  "no nuts": "Nut allergy", "peanut allergy": "Nut allergy", "tree nut allergy": "Nut allergy",
};

function parseDietaryInitial(raw: string | undefined): { selected: Set<string>; other: string } {
  const selected = new Set<string>();
  const other: string[] = [];
  for (const token of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const canonical = DIETARY_SYNONYMS[token.toLowerCase()];
    if (canonical) selected.add(canonical);
    else other.push(token);
  }
  return { selected, other: other.join(", ") };
}

export type GuestInitial = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  rsvp?: string;
  side?: string;
  isChild?: boolean;
  needsHighchair?: boolean;
  plusOneAllowed?: boolean;
  plusOneName?: string;
  role?: string;
  dietary?: string;
  notes?: string;
};

export function GuestForm({
  householdId,
  initial,
  submitLabel = "Add",
  isPlusOne = false,
  onSubmit,
  onCancel,
}: {
  householdId: string;
  initial?: GuestInitial;
  submitLabel?: string;
  // True when editing a +1 row (parentGuestId set on the underlying Guest).
  // Disables the host-managed fields: first/last name (synced from the
  // host's plusOneName), and the plus-one toggle/name (a +1 can't have a
  // +1 of its own). Other fields stay editable so the +1 can have its own
  // dietary, meal, notes, etc.
  isPlusOne?: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // v1.60.0 (P3): dirty-check — see SupplierForm.tsx for the same
  // pattern. Save disables when no edits pending; create path starts
  // dirty since there's no baseline to compare against.
  const [dirty, setDirty] = useState(!initial);
  // v2.5.1 (finding #6): dietary is now canonical checkboxes + a free
  // "Other" field instead of one unconstrained Input — composed back
  // into a single comma string in handle() so the server action's
  // existing string→array parsing (readDietary in ./actions) needs no
  // changes.
  const [dietaryInit] = useState(() => parseDietaryInitial(initial?.dietary));
  const [dietarySelected, setDietarySelected] = useState<Set<string>>(dietaryInit.selected);
  const [dietaryOther, setDietaryOther] = useState(dietaryInit.other);

  async function handle(formData: FormData) {
    setError(null);
    formData.set("householdId", householdId);
    const composedDietary = [
      ...dietarySelected,
      ...dietaryOther.split(",").map((s) => s.trim()).filter(Boolean),
    ].join(", ");
    formData.set("dietary", composedDietary);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} onChange={() => setDirty(true)} className="space-y-3">
      {isPlusOne && (
        <div className="bg-canvas border border-border-soft text-ink-secondary rounded-md px-3 py-2 text-[11px] flex items-start gap-2">
          <span className="text-info flex-shrink-0">🔗</span>
          <span>
            <strong>+1 row.</strong> First/last name come from the host&apos;s &ldquo;Plus-one
            name&rdquo; field — edit it there to rename. RSVP, household, and side
            cascade from the host. Dietary, meal choices, and notes are this guest&apos;s own.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">First name</label>
          <Input name="firstName" required defaultValue={initial?.firstName ?? ""} disabled={isPlusOne} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Last name</label>
          <Input name="lastName" required defaultValue={initial?.lastName ?? ""} disabled={isPlusOne} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Email</label>
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} placeholder="optional" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Phone</label>
          <Input name="phone" defaultValue={initial?.phone ?? ""} placeholder="optional" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">RSVP</label>
          <select name="rsvp" defaultValue={initial?.rsvp ?? "PENDING"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {RSVP.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Side</label>
          <select name="side" defaultValue={initial?.side ?? "BOTH"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {SIDES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Role</label>
          <Input name="role" defaultValue={initial?.role ?? ""} placeholder="e.g. Best Man" />
        </div>
      </div>
      {/* v2.5.1 (finding #6): canonical checkboxes replace the old
          free Input — "Vegetarian" / "veggie" / "V" used to become
          three uncombined counts on the catering brief. */}
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Dietary</label>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-ink-secondary mb-1.5">
          {DIETARY_CANONICAL.map((opt) => (
            <label key={opt} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={dietarySelected.has(opt)}
                onChange={(e) =>
                  setDietarySelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(opt);
                    else next.delete(opt);
                    return next;
                  })
                }
              />
              {opt}
            </label>
          ))}
        </div>
        <Input
          label="Other dietary"
          value={dietaryOther}
          onChange={(e) => setDietaryOther(e.target.value)}
          placeholder="e.g. shellfish allergy (comma-separated)"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-ink-secondary">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" name="isChild" defaultChecked={initial?.isChild} /> Child</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" name="needsHighchair" defaultChecked={initial?.needsHighchair} /> Needs highchair</label>
        <label className={`inline-flex items-center gap-1.5 ${isPlusOne ? "opacity-50" : ""}`}>
          <input type="checkbox" name="plusOneAllowed" defaultChecked={initial?.plusOneAllowed} disabled={isPlusOne} />
          Plus-one allowed
        </label>
      </div>
      <div className={isPlusOne ? "opacity-50" : ""}>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Plus-one name</label>
        <Input
          name="plusOneName"
          defaultValue={initial?.plusOneName ?? ""}
          placeholder={isPlusOne ? "(a +1 can't have a +1)" : "if known"}
          disabled={isPlusOne}
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
        <MentionableTextarea name="notes" rows={2} defaultValue={initial?.notes ?? ""}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>}
        <Button type="submit" variant="primary" size="sm" disabled={pending || !dirty}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
