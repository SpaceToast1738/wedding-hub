// v2.4.0: apply bridges for every book.* proposal kind except
// book.card.append (which predates this module and lives with its
// bridge in src/app/(app)/ai/actions.ts).
//
// Contract with applyLoadedProposal: THROW on every failure — the
// caller rolls the status claim back and the proposal stays PENDING.
// Each bridge (1) re-parses the payload through the kind's Zod schema
// so a tampered AiProposal row can't reach the actions, (2) walls off
// COUPLE_ONLY cards via assertBookCardWritable (the book actions gate
// on requireEdit("book") but never check per-card visibility), (3)
// verifies the target card actually has the kind's data, and (4)
// calls the SAME server action a human editor would.
//
// The central hazard here: every save* bulk action REPLACES the
// card's child rows wholesale (rows missing from the input are
// deleted) and every save* payload field is full-replace (null wipes).
// Proposals carry deltas, so each bridge loads the LIVE card and
// reconstructs the complete payload — untouched fields and rows are
// carried through byte-identical. That carry-through is also the
// money invariant: costPence / pricePerHeadPence / tabLimitPence /
// corkagePence / paid / paidBy / fileIds / guestIds / budget links
// are never in an AI payload, always from the live row, so the
// actions' post-save budget resyncs rewrite identical numbers.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  createBookSection,
  createBookSubsection,
  updateBookSubsection,
  setBookFieldValue,
  saveRecipeCard,
  addBookShot,
  updateBookShot,
  toggleBookShotCaptured,
  saveOutfitCard,
  saveBuildCard,
  saveMenuCard,
  saveBarCard,
  saveSetupCard,
  saveStayCard,
  saveLodgingCard,
  saveDressCodeCard,
  saveWeddingPartyCardHeader,
  createWeddingPartyMember,
  createWeddingPartyItem,
  setWeddingPartyCell,
  type RecipeSavePayload,
  type OutfitSavePayload,
  type BuildSavePayload,
  type MenuSavePayload,
  type BarSavePayload,
  type SetupSavePayload,
  type StaySavePayload,
  type LodgingSavePayload,
  type DressCodeSavePayload,
} from "@/app/(app)/book/actions";
import {
  bookSectionCreateSchema,
  bookCardCreateSchema,
  bookCardRenameSchema,
  bookCardReplaceTextSchema,
  bookFieldSetSchema,
  bookRecipeUpdateSchema,
  bookShotAddSchema,
  bookShotUpdateSchema,
  bookOutfitUpdateSchema,
  bookBuildUpdateSchema,
  bookMenuUpdateSchema,
  bookBarUpdateSchema,
  bookSetupUpdateSchema,
  bookStayUpdateSchema,
  bookLodgingUpdateSchema,
  bookDressCodeUpdateSchema,
  bookWpSetCellSchema,
  bookWpAddMemberSchema,
  bookWpAddItemSchema,
  bookWpUpdateHeaderSchema,
} from "@/lib/ai/proposals/schemas";
import {
  ensureOk,
  assertBookCardWritable,
  patchOrCurrent,
} from "@/lib/ai/apply/common";
import { mergeChildren } from "@/lib/ai/proposals/merge-book-children";

type ApplyUser = { id: string; isCouple: boolean };

const STALE_CARD =
  "The card changed since this was proposed — re-read and re-propose.";

/** Same escape + paragraph pattern as bookCardAppendToFormData in
 *  src/app/(app)/ai/actions.ts — AI text becomes allowed-tag HTML
 *  (sanitizeBookHtml re-runs server-side either way, but escaping
 *  here means literal angle brackets in the AI's prose survive). */
function textToBookHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Kind guard for kinds whose data lives ON BookSubsection itself
 *  (TEXT body, FIELD value bag) — there's no per-kind child row whose
 *  absence would catch a mis-targeted proposal, so check explicitly. */
async function assertCardKind(subsectionId: string, expected: string): Promise<void> {
  const sub = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: { kind: true },
  });
  if (!sub) {
    throw new Error(
      "Book card not found — it may have been deleted since the proposal was made.",
    );
  }
  if (sub.kind !== expected) {
    throw new Error(
      `This proposal targets a ${expected} card, but the card is ${sub.kind}.`,
    );
  }
}

export async function applyBookProposal(
  user: ApplyUser,
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "book.section.create": {
      const p = bookSectionCreateSchema.parse(payload);
      // Section-level create — no card to visibility-check; creating
      // sections is plain book-edit tier for humans too.
      const fd = new FormData();
      fd.append("title", p.title);
      if (p.subtitle != null) fd.append("subtitle", p.subtitle);
      const created = await createBookSection(fd);
      return { id: created.id };
    }

    case "book.card.create": {
      const p = bookCardCreateSchema.parse(payload);
      const section = await db.bookSection.findUnique({
        where: { id: p.sectionId },
        select: { visibility: true },
      });
      if (!section) {
        throw new Error(
          "Book section not found — it may have been deleted since the proposal was made.",
        );
      }
      // No subsection exists yet, so assertBookCardWritable can't run —
      // enforce the couple-only wall at the SECTION level instead.
      if (!user.isCouple && section.visibility === "COUPLE_ONLY") {
        throw new Error(
          "This section is couple-only — only the couple can add cards to it.",
        );
      }
      const fd = new FormData();
      fd.append("sectionId", p.sectionId);
      fd.append("title", p.title);
      fd.append("kind", p.kind);
      // body is TEXT-only. The propose tool rejects body on other
      // kinds; if one slips through anyway we just never post it.
      if (p.kind === "TEXT" && p.body) fd.append("body", p.body);
      const created = await createBookSubsection(fd);
      return { id: created.id };
    }

    case "book.card.rename": {
      const p = bookCardRenameSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      // Post ONLY title — updateBookSubsection leaves body/bodyHtml
      // untouched when neither body field is present, so a rename is
      // safe on all 13 kinds.
      const fd = new FormData();
      fd.append("title", p.title);
      await updateBookSubsection(p.subsectionId, fd);
      return { id: p.subsectionId };
    }

    case "book.card.replace_text": {
      const p = bookCardReplaceTextSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      await assertCardKind(p.subsectionId, "TEXT");
      const current = await db.bookSubsection.findUnique({
        where: { id: p.subsectionId },
        select: { title: true, bodyHtml: true },
      });
      if (!current) throw new Error("Book card not found.");
      // Staleness fence: this is the only whole-content overwrite
      // kind, so a human edit between propose and apply would be
      // silently destroyed without it. baseBodyHash was computed from
      // the bodyHtml the AI read; refuse on any drift.
      const liveHash = createHash("sha256")
        .update(current.bodyHtml ?? "", "utf8")
        .digest("hex");
      if (liveHash !== p.baseBodyHash) throw new Error(STALE_CARD);
      const fd = new FormData();
      fd.append("title", current.title);
      fd.append("bodyHtml", textToBookHtml(p.text));
      await updateBookSubsection(p.subsectionId, fd);
      return { id: p.subsectionId };
    }

    case "book.field.set": {
      const p = bookFieldSetSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      await assertCardKind(p.subsectionId, "FIELD");
      // Single-key write into the Json bag — inherently merge-safe.
      // setBookFieldValue validates def ownership + type/required/
      // range server-side and returns a human message on refusal.
      ensureOk(await setBookFieldValue(p.subsectionId, p.defId, p.value));
      return { id: p.subsectionId };
    }

    case "book.recipe.update": {
      const p = bookRecipeUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const recipe = await db.bookRecipe.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { recipeSteps: { orderBy: { order: "asc" } } },
      });
      if (!recipe) {
        throw new Error("This card has no recipe data — is it a RECIPE card?");
      }
      // ingredients is a legacy Json column typed string[] by
      // convention; filter defensively rather than trusting the cast.
      const currentIngredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.filter((v): v is string => typeof v === "string")
        : [];
      const steps = mergeChildren(
        recipe.recipeSteps.map((s) => ({
          id: s.id,
          instruction: s.instruction,
          durationMinutes: s.durationMinutes,
          dayBefore: s.dayBefore,
        })),
        {
          add: (p.addSteps ?? []).map((s) => ({
            instruction: s.instruction,
            durationMinutes: s.durationMinutes ?? null,
            dayBefore: s.dayBefore,
          })),
          update: (p.updateSteps ?? []).map((s) => ({
            id: s.stepId,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            dayBefore: s.dayBefore,
          })),
          removeIds: p.removeStepIds,
        },
      ) as unknown as RecipeSavePayload["steps"];
      const full: RecipeSavePayload = {
        ingredients: p.setIngredients ?? currentIngredients,
        notes: patchOrCurrent(p.notes, recipe.notes),
        servingsBase: patchOrCurrent(p.servingsBase, recipe.servingsBase),
        steps,
      };
      ensureOk(await saveRecipeCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.shot.add": {
      const p = bookShotAddSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const list = await db.bookShotList.findUnique({
        where: { subsectionId: p.subsectionId },
        select: { id: true },
      });
      if (!list) {
        throw new Error("This card has no shot list — is it a SHOT_LIST card?");
      }
      const fd = new FormData();
      fd.append("title", p.title);
      if (p.category != null) fd.append("category", p.category);
      if (p.estimatedMinutes != null) {
        fd.append("estimatedMinutes", String(p.estimatedMinutes));
      }
      if (p.withWhom.length) fd.append("withWhom", p.withWhom.join(", "));
      if (p.location != null) fd.append("location", p.location);
      if (p.notes != null) fd.append("notes", p.notes);
      ensureOk(await addBookShot(list.id, fd));
      return { id: p.subsectionId };
    }

    case "book.shot.update": {
      const p = bookShotUpdateSchema.parse(payload);
      const shot = await db.bookShot.findUnique({
        where: { id: p.shotId },
        include: { shotList: { select: { subsectionId: true } } },
      });
      if (!shot) {
        throw new Error(
          "Shot not found — it may have been deleted since the proposal was made.",
        );
      }
      const subsectionId = shot.shotList.subsectionId;
      await assertBookCardWritable(user, subsectionId);
      // updateBookShot is FULL-ROW-REPLACE (omitted fields wipe), so
      // post every field patch-else-current — including withWhom and
      // guestIds, which the AI can't express but MUST be re-posted or
      // they'd reset to []. Skip the row write entirely when the
      // patch only flips `captured`.
      const touchesRow =
        p.title !== undefined ||
        p.category !== undefined ||
        p.location !== undefined ||
        p.notes !== undefined ||
        p.estimatedMinutes !== undefined;
      if (touchesRow) {
        const fd = new FormData();
        fd.append("title", p.title ?? shot.title);
        const category = patchOrCurrent(p.category, shot.category);
        if (category != null) fd.append("category", category);
        const estimatedMinutes = patchOrCurrent(
          p.estimatedMinutes,
          shot.estimatedMinutes,
        );
        if (estimatedMinutes != null) {
          fd.append("estimatedMinutes", String(estimatedMinutes));
        }
        // parseShotFormData comma-splits withWhom, so names containing
        // commas can't round-trip exactly — same limit as the human form.
        if (shot.withWhom.length) fd.append("withWhom", shot.withWhom.join(", "));
        for (const gid of shot.guestIds) fd.append("guestIds", gid);
        const location = patchOrCurrent(p.location, shot.location);
        if (location != null) fd.append("location", location);
        const notes = patchOrCurrent(p.notes, shot.notes);
        if (notes != null) fd.append("notes", notes);
        ensureOk(await updateBookShot(p.shotId, fd));
      }
      // captured lives on its own action (it stamps capturedAt); only
      // call it when the value actually changes so an already-captured
      // shot doesn't get its timestamp rewritten.
      if (p.captured !== undefined && p.captured !== shot.captured) {
        ensureOk(await toggleBookShotCaptured(p.shotId, p.captured));
      }
      return { id: subsectionId };
    }

    case "book.outfit.update": {
      const p = bookOutfitUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookOutfitCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { outfits: { orderBy: { order: "asc" } } },
      });
      if (!card) {
        throw new Error("This card has no outfit data — is it an OUTFIT card?");
      }
      // costPence per item is carried from the live row (never in a
      // patch); adds start at null. Legacy pre-v1.93 rows can have a
      // null itemLabel — carried as-is, the action's schema refuses
      // and the proposal stays pending (same wall a human save hits).
      const items = mergeChildren(
        card.outfits.map((o) => ({
          id: o.id,
          itemLabel: o.itemLabel,
          description: o.description,
          supplier: o.supplier,
          website: o.website,
          status: o.status,
          notes: o.notes,
          costPence: o.costPence,
        })),
        {
          add: (p.addItems ?? []).map((i) => ({
            itemLabel: i.itemLabel,
            description: i.description ?? null,
            supplier: i.supplier ?? null,
            website: i.website ?? null,
            status: i.status ?? null,
            notes: i.notes ?? null,
            costPence: null,
          })),
          update: (p.updateItems ?? []).map((i) => ({
            id: i.itemId,
            itemLabel: i.itemLabel,
            description: i.description,
            supplier: i.supplier,
            website: i.website,
            status: i.status,
            notes: i.notes,
          })),
          removeIds: p.removeItemIds,
        },
      ) as unknown as OutfitSavePayload["items"];
      const full: OutfitSavePayload = {
        personName: patchOrCurrent(p.personName, card.personName),
        role: patchOrCurrent(p.role, card.role),
        // Money + gallery carried from the live row byte-identical —
        // the post-save syncBudgetLine then rewrites identical values.
        costPence: card.costPence,
        fileIds: card.fileIds,
        notes: patchOrCurrent(p.notes, card.notes),
        items,
      };
      ensureOk(await saveOutfitCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.build.update": {
      const p = bookBuildUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookBuildCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { materials: { orderBy: { order: "asc" } } },
      });
      if (!card) {
        throw new Error("This card has no build data — is it a BUILD card?");
      }
      const materials = mergeChildren(
        card.materials.map((m) => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          supplier: m.supplier,
          website: m.website,
          costPence: m.costPence,
          ordered: m.ordered,
          arrived: m.arrived,
          notes: m.notes,
        })),
        {
          add: (p.addMaterials ?? []).map((m) => ({
            name: m.name,
            quantity: m.quantity ?? null,
            unit: m.unit ?? null,
            supplier: m.supplier ?? null,
            website: m.website ?? null,
            costPence: null,
            ordered: m.ordered,
            arrived: m.arrived,
            notes: m.notes ?? null,
          })),
          update: (p.updateMaterials ?? []).map((m) => ({
            id: m.materialId,
            name: m.name,
            quantity: m.quantity,
            unit: m.unit,
            supplier: m.supplier,
            website: m.website,
            ordered: m.ordered,
            arrived: m.arrived,
            notes: m.notes,
          })),
          removeIds: p.removeMaterialIds,
        },
      ) as unknown as BuildSavePayload["materials"];
      // saveBuildCard, NOT updateBuildCard — the latter's prototypeDone
      // is an unconditional boolean expression that writes false when
      // the field is omitted. saveBuildCard also never touches
      // sessions (loggedById attribution means a human did the work).
      const full: BuildSavePayload = {
        quantityNeeded: patchOrCurrent(p.quantityNeeded, card.quantityNeeded),
        targetDate:
          p.targetDate !== undefined
            ? p.targetDate
            : card.targetDate
              ? card.targetDate.toISOString()
              : null,
        status: patchOrCurrent(p.status, card.status),
        prototypeDone: p.prototypeDone ?? card.prototypeDone,
        prototypeNotes: patchOrCurrent(p.prototypeNotes, card.prototypeNotes),
        estimatedMinutesPerUnit: patchOrCurrent(
          p.estimatedMinutesPerUnit,
          card.estimatedMinutesPerUnit,
        ),
        notes: patchOrCurrent(p.notes, card.notes),
        materials,
      };
      ensureOk(await saveBuildCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.menu.update": {
      const p = bookMenuUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookMenuCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: {
          courses: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      });
      if (!card) {
        throw new Error("This card has no menu data — is it a MENU card?");
      }
      const courseIds = new Set(card.courses.map((c) => c.id));
      const optionToCourse = new Map<string, string>();
      for (const c of card.courses) {
        for (const o of c.options) optionToCourse.set(o.id, c.id);
      }
      const renames = new Map<string, string>();
      for (const r of p.renameCourses ?? []) {
        if (!courseIds.has(r.courseId)) throw new Error(STALE_CARD);
        renames.set(r.courseId, r.courseLabel);
      }
      // Group the flat option deltas per course so each course's
      // options reconcile independently. Unknown ids mean the card
      // changed under the proposal — refuse rather than guess.
      const addsByCourse = new Map<string, Record<string, unknown>[]>();
      for (const a of p.addOptions ?? []) {
        if (!courseIds.has(a.courseId)) throw new Error(STALE_CARD);
        const list = addsByCourse.get(a.courseId) ?? [];
        list.push({
          label: a.label,
          description: a.description ?? null,
          dietary: a.dietary ?? [],
          isVegetarianMain: a.isVegetarianMain ?? false,
          isKidsMeal: a.isKidsMeal ?? false,
        });
        addsByCourse.set(a.courseId, list);
      }
      const updatesByCourse = new Map<
        string,
        ({ id: string } & Record<string, unknown>)[]
      >();
      for (const u of p.updateOptions ?? []) {
        const cId = optionToCourse.get(u.optionId);
        if (!cId) throw new Error(STALE_CARD);
        const list = updatesByCourse.get(cId) ?? [];
        list.push({
          id: u.optionId,
          label: u.label,
          description: u.description,
          dietary: u.dietary,
          isVegetarianMain: u.isVegetarianMain,
          isKidsMeal: u.isKidsMeal,
        });
        updatesByCourse.set(cId, list);
      }
      const removesByCourse = new Map<string, string[]>();
      for (const optionId of p.removeOptionIds ?? []) {
        const cId = optionToCourse.get(optionId);
        if (!cId) throw new Error(STALE_CARD);
        const list = removesByCourse.get(cId) ?? [];
        list.push(optionId);
        removesByCourse.set(cId, list);
      }
      // EVERY current course is re-emitted — a course missing from
      // saveMenuCard's payload is deleted AND cascades its options,
      // which is why the schema has no removeCourseIds at all.
      const courses = card.courses.map((c) => ({
        id: c.id,
        courseLabel: renames.get(c.id) ?? c.courseLabel,
        options: mergeChildren(
          c.options.map((o) => ({
            id: o.id,
            label: o.label,
            description: o.description,
            dietary: o.dietary,
            isVegetarianMain: o.isVegetarianMain,
            isKidsMeal: o.isKidsMeal,
          })),
          {
            add: addsByCourse.get(c.id),
            update: updatesByCourse.get(c.id),
            removeIds: removesByCourse.get(c.id),
          },
        ) as unknown as MenuSavePayload["courses"][number]["options"],
      })) as MenuSavePayload["courses"];
      let newCourseCounter = 0;
      for (const a of p.addCourses ?? []) {
        courses.push({
          id: `new-${newCourseCounter}`,
          courseLabel: a.courseLabel,
          options: [],
        });
        newCourseCounter += 1;
      }
      const full: MenuSavePayload = {
        serviceType: patchOrCurrent(p.serviceType, card.serviceType),
        serviceTime: patchOrCurrent(p.serviceTime, card.serviceTime),
        // Money + headcount config carried from the live row. The
        // action's zod only accepts a 6-value PerHeadSource subset
        // (the two v1.82 age-split values are budget-line-only) — and
        // since saveMenuCard is this column's only writer, the live
        // value is always in-set; if that ever drifts the action
        // refuses and the proposal stays pending. Hence the cast.
        pricePerHeadPence: card.pricePerHeadPence,
        confirmedHeadcount: card.confirmedHeadcount,
        headcountSource:
          card.headcountSource as MenuSavePayload["headcountSource"],
        manualHeadcount: card.manualHeadcount,
        notes: patchOrCurrent(p.notes, card.notes),
        courses,
      };
      ensureOk(await saveMenuCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.bar.update": {
      const p = bookBarUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookBarCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { items: { orderBy: { order: "asc" } } },
      });
      if (!card) {
        throw new Error("This card has no bar data — is it a BAR card?");
      }
      // Per-item money trio (costPence / pricePerHeadPence /
      // headcountSource) carried through the merge — patches never
      // name them; adds start unpriced.
      const items = mergeChildren(
        card.items.map((i) => ({
          id: i.id,
          category: i.category,
          name: i.name,
          quantityPlanned: i.quantityPlanned,
          unit: i.unit,
          supplier: i.supplier,
          website: i.website,
          costPence: i.costPence,
          notes: i.notes,
          pricePerHeadPence: i.pricePerHeadPence,
          timing: i.timing,
          headcountSource: i.headcountSource,
        })),
        {
          add: (p.addItems ?? []).map((i) => ({
            category: i.category,
            name: i.name,
            quantityPlanned: i.quantityPlanned ?? null,
            unit: i.unit ?? null,
            supplier: i.supplier ?? null,
            website: i.website ?? null,
            costPence: null,
            notes: i.notes ?? null,
            pricePerHeadPence: null,
            timing: i.timing ?? null,
            headcountSource: null,
          })),
          update: (p.updateItems ?? []).map((i) => ({
            id: i.itemId,
            category: i.category,
            name: i.name,
            quantityPlanned: i.quantityPlanned,
            unit: i.unit,
            supplier: i.supplier,
            website: i.website,
            timing: i.timing,
            notes: i.notes,
          })),
          removeIds: p.removeItemIds,
        },
      ) as unknown as BarSavePayload["items"];
      const full: BarSavePayload = {
        barType: patchOrCurrent(p.barType, card.barType),
        // Card-level money carried from the live row.
        tabLimitPence: card.tabLimitPence,
        toastDrink: patchOrCurrent(p.toastDrink, card.toastDrink),
        corkagePence: card.corkagePence,
        notes: patchOrCurrent(p.notes, card.notes),
        items,
      };
      ensureOk(await saveBarCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.setup.update": {
      const p = bookSetupUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookSetupCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { items: { orderBy: { order: "asc" } } },
      });
      if (!card) {
        throw new Error("This card has no setup data — is it a SETUP card?");
      }
      const items = mergeChildren(
        card.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          location: i.location,
          source: i.source,
          website: i.website,
          packed: i.packed,
          placed: i.placed,
          packDownPlan: i.packDownPlan,
          notes: i.notes,
        })),
        {
          add: (p.addItems ?? []).map((i) => ({
            name: i.name,
            quantity: i.quantity ?? null,
            location: i.location ?? null,
            source: i.source ?? null,
            website: i.website ?? null,
            packed: i.packed,
            placed: i.placed,
            packDownPlan: i.packDownPlan ?? null,
            notes: i.notes ?? null,
          })),
          update: (p.updateItems ?? []).map((i) => ({
            id: i.itemId,
            name: i.name,
            quantity: i.quantity,
            location: i.location,
            source: i.source,
            website: i.website,
            packed: i.packed,
            placed: i.placed,
            packDownPlan: i.packDownPlan,
            notes: i.notes,
          })),
          removeIds: p.removeItemIds,
        },
      ) as unknown as SetupSavePayload["items"];
      // saveSetupCard never touches fileIds — the gallery is safe by
      // construction here (no carry-through needed).
      const full: SetupSavePayload = {
        space: patchOrCurrent(p.space, card.space),
        setupStartsAt: patchOrCurrent(p.setupStartsAt, card.setupStartsAt),
        setupOwner: patchOrCurrent(p.setupOwner, card.setupOwner),
        notes: patchOrCurrent(p.notes, card.notes),
        items,
      };
      ensureOk(await saveSetupCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.stay.update": {
      const p = bookStayUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookStayCard.findUnique({
        where: { subsectionId: p.subsectionId },
      });
      if (!card) {
        throw new Error("This card has no stay data — is it a STAY card?");
      }
      // Occupants are free-text strings, not ids — set-merge in place,
      // preserving current order, appending adds that aren't present.
      const removedOccupants = new Set(p.removeOccupants ?? []);
      const occupants = card.occupants.filter((o) => !removedOccupants.has(o));
      for (const o of p.addOccupants ?? []) {
        if (!occupants.includes(o)) occupants.push(o);
      }
      // Single-row full-replace action: every untouched scalar comes
      // from the live row, money + paid + guestIds always do.
      const full: StaySavePayload = {
        propertyName: patchOrCurrent(p.propertyName, card.propertyName),
        propertyContact: patchOrCurrent(p.propertyContact, card.propertyContact),
        bookingReference: patchOrCurrent(p.bookingReference, card.bookingReference),
        checkInDate:
          p.checkInDate !== undefined
            ? p.checkInDate
            : card.checkInDate
              ? card.checkInDate.toISOString()
              : null,
        checkOutDate:
          p.checkOutDate !== undefined
            ? p.checkOutDate
            : card.checkOutDate
              ? card.checkOutDate.toISOString()
              : null,
        costPence: card.costPence,
        paidBy: card.paidBy,
        paid: card.paid,
        occupants,
        guestIds: card.guestIds,
        notes: patchOrCurrent(p.notes, card.notes),
      };
      ensureOk(await saveStayCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.lodging.update": {
      const p = bookLodgingUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookLodgingCard.findUnique({
        where: { subsectionId: p.subsectionId },
        include: { items: { orderBy: { order: "asc" } } },
      });
      if (!card) {
        throw new Error(
          "This card has no lodging data — is it a LODGING_GUIDE card?",
        );
      }
      const items = mergeChildren(
        card.items.map((i) => ({
          id: i.id,
          name: i.name,
          distanceFromVenue: i.distanceFromVenue,
          priceRangeLabel: i.priceRangeLabel,
          phone: i.phone,
          website: i.website,
          groupRateCode: i.groupRateCode,
          notes: i.notes,
        })),
        {
          add: (p.addItems ?? []).map((i) => ({
            name: i.name,
            distanceFromVenue: i.distanceFromVenue ?? null,
            priceRangeLabel: i.priceRangeLabel ?? null,
            phone: i.phone ?? null,
            website: i.website ?? null,
            groupRateCode: i.groupRateCode ?? null,
            notes: i.notes ?? null,
          })),
          update: (p.updateItems ?? []).map((i) => ({
            id: i.itemId,
            name: i.name,
            distanceFromVenue: i.distanceFromVenue,
            priceRangeLabel: i.priceRangeLabel,
            phone: i.phone,
            website: i.website,
            groupRateCode: i.groupRateCode,
            notes: i.notes,
          })),
          removeIds: p.removeItemIds,
        },
      ) as unknown as LodgingSavePayload["items"];
      const full: LodgingSavePayload = {
        notes: patchOrCurrent(p.notes, card.notes),
        items,
      };
      ensureOk(await saveLodgingCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.dresscode.update": {
      const p = bookDressCodeUpdateSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookDressCodeCard.findUnique({
        where: { subsectionId: p.subsectionId },
      });
      if (!card) {
        throw new Error(
          "This card has no dress-code data — is it a DRESS_CODE card?",
        );
      }
      // bodyText arrives as plain text and is rendered to allowed-tag
      // HTML here; omitted = keep the current (already-sanitised)
      // bodyHtml verbatim. fileIds aren't in the save payload at all,
      // so the mood-board gallery is safe by construction.
      const bodyHtml =
        p.bodyText === undefined
          ? card.bodyHtml
          : p.bodyText === null
            ? null
            : textToBookHtml(p.bodyText);
      const full: DressCodeSavePayload = {
        dressCode: patchOrCurrent(p.dressCode, card.dressCode),
        summary: patchOrCurrent(p.summary, card.summary),
        bodyHtml,
        colourGuidance: patchOrCurrent(p.colourGuidance, card.colourGuidance),
        footwear: patchOrCurrent(p.footwear, card.footwear),
        weather: patchOrCurrent(p.weather, card.weather),
        accessories: patchOrCurrent(p.accessories, card.accessories),
      };
      ensureOk(await saveDressCodeCard(p.subsectionId, full));
      return { id: p.subsectionId };
    }

    case "book.weddingparty.set_cell": {
      const p = bookWpSetCellSchema.parse(payload);
      const member = await db.bookWeddingPartyMember.findUnique({
        where: { id: p.memberId },
        select: { cardId: true, card: { select: { subsectionId: true } } },
      });
      if (!member) {
        throw new Error(
          "Wedding-party member not found — the card may have changed since the proposal was made.",
        );
      }
      const item = await db.bookWeddingPartyItem.findUnique({
        where: { id: p.itemId },
        select: { cardId: true },
      });
      if (!item) {
        throw new Error(
          "Wedding-party item not found — the card may have changed since the proposal was made.",
        );
      }
      // setWeddingPartyCell doesn't enforce same-card membership (the
      // UI can't cross cards, but AI-supplied ids can) — a cross-card
      // cell would be an orphan no matrix ever renders.
      if (item.cardId !== member.cardId) {
        throw new Error(
          "That member and item belong to different wedding-party cards.",
        );
      }
      const subsectionId = member.card.subsectionId;
      await assertBookCardWritable(user, subsectionId);
      // NEED + empty notes deletes the sparse cell row inside the
      // action — that's its idempotent default state, not a failure.
      ensureOk(
        await setWeddingPartyCell(p.memberId, p.itemId, {
          status: p.status,
          notes: p.notes ?? null,
        }),
      );
      return { id: subsectionId };
    }

    case "book.weddingparty.add_member": {
      const p = bookWpAddMemberSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookWeddingPartyCard.findUnique({
        where: { subsectionId: p.subsectionId },
        select: { id: true },
      });
      if (!card) {
        throw new Error(
          "This card has no wedding-party data — is it a WEDDING_PARTY card?",
        );
      }
      const result = await createWeddingPartyMember(card.id, {
        name: p.name,
        role: p.role ?? null,
      });
      ensureOk(result);
      return { id: result.memberId ?? p.subsectionId };
    }

    case "book.weddingparty.add_item": {
      const p = bookWpAddItemSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookWeddingPartyCard.findUnique({
        where: { subsectionId: p.subsectionId },
        select: { id: true },
      });
      if (!card) {
        throw new Error(
          "This card has no wedding-party data — is it a WEDDING_PARTY card?",
        );
      }
      const result = await createWeddingPartyItem(card.id, {
        label: p.label,
        notes: p.notes ?? null,
      });
      ensureOk(result);
      return { id: result.itemId ?? p.subsectionId };
    }

    case "book.weddingparty.update_header": {
      const p = bookWpUpdateHeaderSchema.parse(payload);
      await assertBookCardWritable(user, p.subsectionId);
      const card = await db.bookWeddingPartyCard.findUnique({
        where: { subsectionId: p.subsectionId },
        select: { groupLabel: true, notes: true },
      });
      if (!card) {
        throw new Error(
          "This card has no wedding-party data — is it a WEDDING_PARTY card?",
        );
      }
      // Full-replace of both fields — carry whichever the patch omits.
      ensureOk(
        await saveWeddingPartyCardHeader(p.subsectionId, {
          groupLabel: patchOrCurrent(p.groupLabel, card.groupLabel),
          notes: patchOrCurrent(p.notes, card.notes),
        }),
      );
      return { id: p.subsectionId };
    }

    default:
      throw new Error(`Unknown book proposal kind: ${kind}`);
  }
}
