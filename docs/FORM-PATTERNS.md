# Form patterns

**Status:** v1.65.0 (DP-4). Last updated 2 May 2026.

This document codifies which form pattern to use when. Three patterns are legitimate for different complexity tiers; a fourth ("hybrid mid-complexity") is discouraged and should be migrated to one of the three when touched.

The design pass (Phase B) does NOT need to unify these into one pattern — they serve different needs. What it should do is reskin the inputs / buttons / chrome inside whichever pattern is in use.

---

## The decision tree

```
Does the form have ANY field whose value needs to drive conditional UI,
live preview, or multi-step state?
│
├─ NO  ─────► Pattern A (uncontrolled + form action)
│           Examples: SupplierForm, GuestForm, PaymentForm, WeddingSettingsPanel.
│           Sites with edit/cancel that need a baseline-restore? See Pattern D.
│
└─ YES ─────► Is this an "edit ↔ view" toggle pattern (Book card editors)?
              │
              ├─ YES ─► Pattern D (single draft state)
              │       Examples: BookBuildCard, BookSetupCard, BookOutfitCard,
              │       BookMenuCard, BookBarCard, BookLegalCard, BookStayCard,
              │       BookLodgingCard, BookFieldsCard, BookShotListCard,
              │       BookRecipeCard.
              │
              └─ NO  ─► Pattern B (controlled per field)
                      Examples: TaskDrawer, MyProfilePanel, AnswerForm.
                      EventForm should be migrated to this when touched.
```

---

## Pattern A — uncontrolled + form action

**When.** Simple forms (5-10 fields), no conditional UI, no live preview, no field validation that depends on another field's value.

**Shape.**

```tsx
export function ThingForm({ initial, onSubmit, onCancel }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // v1.60.0 (P3): dirty-check via form-level onChange.
  // Save disables when no edits pending. Create path starts dirty.
  const [dirty, setDirty] = useState(!initial);

  async function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        setDirty(false); // baseline reset after successful save
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} onChange={() => setDirty(true)} className="space-y-3">
      <Input name="title" defaultValue={initial?.title ?? ""} required />
      {/* ... */}
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
```

**Rules.**

- Every field uses `defaultValue` (not `value`). React leaves the DOM authoritative; no per-field `useState`.
- Submission goes through `<form action={handleFn}>`, not `onSubmit`.
- The handler reads from `FormData`. The server action accepts `FormData` directly (or a Zod-parsed shape from it).
- Dirty-check via the form-level `onChange={() => setDirty(true)}` listener, **always paired** with `setDirty(false)` after a successful save (so a stray second submit stays disabled).
- Create path (`!initial`) starts dirty so the Save button is immediately useful.

**Pros.** Less boilerplate, fewer re-renders, smaller bundle, naturally compatible with Server Actions.

**Cons.** No way to drive conditional UI off field values without escape hatches. Can't trivially do live previews.

---

## Pattern B — controlled per field

**When.** Edit drawers / dense panels with conditional UI, live preview, or multi-step state. The TaskDrawer is the canonical example: type-changer affects which fields show, status changes affect priority constraints, the topic picker drives a live chip row.

**Shape.**

```tsx
export function ThingDrawer({ thing, onClose }) {
  const [title, setTitle] = useState(thing.title);
  const [type, setType] = useState(thing.type);
  // ... one useState per field
  const [pending, startTransition] = useTransition();

  // Dirty derived from comparing every state to the original.
  const dirty =
    title !== thing.title ||
    type !== thing.type ||
    /* ... */;

  function save() {
    if (!title.trim()) {
      notify("error", "Title is required");
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    fd.set("type", type);
    // ... append every state into FormData
    startTransition(async () => {
      try {
        await updateThing(thing.id, fd);
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }
  // render <input value={title} onChange={(e) => setTitle(e.target.value)} /> per field
}
```

**Rules.**

- Every editable field has a `useState`.
- Dirty-check is a derived boolean comparing each state to the original prop.
- Submission is via a `save()` function that builds `FormData` manually and calls a server action (NOT via `<form action>` — drawers don't have a real form element).
- Validation runs client-side before the action call.

**Pros.** Trivially supports conditional UI, live preview, complex validation. State is centralised and obvious.

**Cons.** Re-renders on every keystroke. Lots of boilerplate per field. Easy to forget to add a field to the dirty-check.

---

## Pattern D — single draft state (edit ↔ view toggle)

**When.** Book card editors — the user toggles between View mode (read-only) and Edit mode (form). Cancel must restore the original; save commits the entire shape; structural lists (materials, items, sessions) need to be reorderable + addable + deletable in-form.

**Shape.**

```tsx
export function BookXCard({ card, ... }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  useEffect(() => {
    setDraft(buildDraft(card));
  }, [card]); // reset draft when prop changes (e.g. after a save+revalidate)
  const [pending, startTransition] = useTransition();

  function cancel() {
    setDraft(buildDraft(card)); // explicit restore to baseline
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      const res = await saveXCard(subsectionId, draftToPayload(draft));
      if (res.ok) { setEditing(false); }
      else { notify("error", res.error); }
    });
  }

  return editing ? (
    <EditBody draft={draft} setDraft={setDraft} ... />
  ) : (
    <ViewBody card={card} ... />
  );
}
```

**Rules.**

- One `useState` for the entire draft object.
- An explicit `buildDraft(card)` function maps the Prisma shape to the editor shape (date strings vs. Date, pence vs. pounds string, etc.).
- An explicit `draftToPayload(draft)` function does the inverse for the server action.
- Cancel restores by re-running `buildDraft(card)` — never trust the in-flight draft to be salvageable.
- The view body is a separate component reading directly from `card`, never from `draft`. View and Edit don't share render code.
- Per-row state (e.g. one BookOutfit item) lives in the draft array; setters use functional updates.

**Pros.** Clean cancel semantics. Single source of truth for the form state. Easy to do "save bumps card prop → useEffect resets draft" reactivity.

**Cons.** More indirection — readers have to follow `card → draft → render → payload → action`. Setters are more verbose.

---

## Pattern C — hybrid (DEPRECATED)

**Don't use.** Some fields controlled, others uncontrolled, dirty-check via a manual `setDirty` flag.

**Why deprecated.** The cognitive overhead of "which fields are which" outweighs the savings. Worse, the dirty-check has to be fired manually from each controlled setter (easy to forget), AND from the form-level onChange (which doesn't fire on controlled-input changes because React absorbs them). Easy to ship a regression where one of the field paths skips the dirty-check.

**The one current example.** `EventForm.tsx`: `allDay` (boolean) and `attendeeRefs` (string[]) are controlled because they drive conditional UI; the rest of the fields are uncontrolled. This was a v1.41.0 / v1.60.0 evolution.

**Migration plan.** Next time `EventForm` is touched for a feature, convert the rest of the fields to controlled state (Pattern B). The form has 9 fields total; ~80 lines of mechanical `useState` + `value=` + `onChange={...}` plumbing. Don't do it as a standalone refactor — pair it with a feature touch.

---

## Anti-patterns

- **Mixing `<form action>` with `e.preventDefault()` `onSubmit`.** Pick one. The action handler is a normal function called with FormData; the onSubmit handler is called with the event and you have to `new FormData(e.currentTarget)` yourself.
- **Pattern A without a dirty-check.** Every form should have one (so users can't double-submit). The `setDirty(true)` form-level onChange is one line; do it.
- **Pattern B with `<form action>`.** The state is in React; FormData round-trip is wasted. Just call the server action with the typed args.
- **Reset-on-save by re-running `buildDraft(card)` synchronously.** The `card` prop hasn't been updated yet at save time; the useEffect-on-card-change is the right place. Pattern D's reset-on-save is implicit, not explicit.

---

End of patterns.
