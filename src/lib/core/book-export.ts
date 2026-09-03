// v2.14.0: load ONE Wedding Book card in the shape src/lib/book-card-doc
// renders (share / print). Mirrors the per-kind selects read_book_card
// uses — and, like it, never selects money (costs, prices, budget
// links, payments) or file ids. Callers own the auth gate: canView(
// "book") plus the COUPLE_ONLY wall (non-couple callers must not see
// couple-only cards).

import { db } from "@/lib/db";
import type { CardExport } from "@/lib/book-card-doc";

const CHILD_ROW_CAP = 200;

function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function loadCardExport(subsectionId: string): Promise<CardExport | null> {
  const card = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      visibility: true,
      body: true,
      bodyHtml: true,
      fields: true,
      section: { select: { slug: true, title: true } },
    },
  });
  if (!card) return null;

  const base = {
    id: card.id,
    slug: card.slug,
    title: card.title,
    visibility: card.visibility,
    sectionSlug: card.section.slug,
    sectionTitle: card.section.title,
  };

  switch (card.kind) {
    case "TEXT":
      return { ...base, kind: "TEXT", bodyHtml: card.bodyHtml, body: card.body };

    case "FIELD": {
      const defs = await db.bookFieldDef.findMany({
        where: { subsectionId: card.id },
        orderBy: { order: "asc" },
        take: CHILD_ROW_CAP,
        select: { id: true, label: true, type: true, group: true },
      });
      return {
        ...base,
        kind: "FIELD",
        fieldDefs: defs.map((d) => ({ id: d.id, label: d.label, type: String(d.type), group: d.group })),
        values: (card.fields as Record<string, unknown> | null) ?? {},
      };
    }

    case "RECIPE": {
      const r = await db.bookRecipe.findUnique({
        where: { subsectionId: card.id },
        select: {
          ingredients: true,
          notes: true,
          servingsBase: true,
          recipeSteps: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: { instruction: true, durationMinutes: true, dayBefore: true },
          },
        },
      });
      return {
        ...base,
        kind: "RECIPE",
        ingredients: strArray(r?.ingredients),
        steps: (r?.recipeSteps ?? []).map((s) => ({
          instruction: s.instruction,
          durationMinutes: s.durationMinutes,
          dayBefore: s.dayBefore,
        })),
        notes: r?.notes ?? null,
        servingsBase: r?.servingsBase ?? null,
      };
    }

    case "SHOT_LIST": {
      const sl = await db.bookShotList.findUnique({
        where: { subsectionId: card.id },
        select: {
          shots: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              title: true,
              category: true,
              estimatedMinutes: true,
              withWhom: true,
              location: true,
              notes: true,
              captured: true,
            },
          },
        },
      });
      return {
        ...base,
        kind: "SHOT_LIST",
        // withWhom is a String[] column; the Doc wants one string.
        shots: (sl?.shots ?? []).map((s) => ({ ...s, withWhom: s.withWhom.length ? s.withWhom.join(", ") : null })),
      };
    }

    case "OUTFIT": {
      const o = await db.bookOutfitCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          personName: true,
          role: true,
          notes: true,
          outfits: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: { itemLabel: true, description: true, supplier: true, website: true, status: true, notes: true },
          },
        },
      });
      return {
        ...base,
        kind: "OUTFIT",
        personName: o?.personName ?? null,
        role: o?.role ?? null,
        notes: o?.notes ?? null,
        // itemLabel is nullable in the schema; an unlabelled row still
        // deserves a line rather than being dropped.
        items: (o?.outfits ?? []).map((i) => ({ ...i, itemLabel: i.itemLabel ?? "Item" })),
      };
    }

    case "BUILD": {
      const b = await db.bookBuildCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          quantityNeeded: true,
          targetDate: true,
          status: true,
          prototypeDone: true,
          prototypeNotes: true,
          estimatedMinutesPerUnit: true,
          notes: true,
          materials: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              name: true,
              quantity: true,
              unit: true,
              supplier: true,
              website: true,
              ordered: true,
              arrived: true,
              notes: true,
            },
          },
        },
      });
      return {
        ...base,
        kind: "BUILD",
        quantityNeeded: b?.quantityNeeded ?? null,
        targetDate: dateOnly(b?.targetDate),
        status: b?.status ?? null,
        prototypeDone: b?.prototypeDone ?? false,
        prototypeNotes: b?.prototypeNotes ?? null,
        estimatedMinutesPerUnit: b?.estimatedMinutesPerUnit ?? null,
        notes: b?.notes ?? null,
        materials: b?.materials ?? [],
      };
    }

    case "MENU": {
      const m = await db.bookMenuCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          serviceType: true,
          serviceTime: true,
          notes: true,
          courses: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              courseLabel: true,
              options: {
                orderBy: { order: "asc" },
                take: CHILD_ROW_CAP,
                select: { label: true, description: true, dietary: true, isVegetarianMain: true, isKidsMeal: true },
              },
            },
          },
        },
      });
      return {
        ...base,
        kind: "MENU",
        serviceType: m?.serviceType ?? null,
        serviceTime: m?.serviceTime ?? null,
        notes: m?.notes ?? null,
        courses: (m?.courses ?? []).map((c) => ({
          courseLabel: c.courseLabel,
          options: c.options.map((o) => ({
            label: o.label,
            description: o.description,
            dietary: strArray(o.dietary),
            isVegetarianMain: o.isVegetarianMain,
            isKidsMeal: o.isKidsMeal,
          })),
        })),
      };
    }

    case "BAR": {
      const b = await db.bookBarCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          barType: true,
          toastDrink: true,
          notes: true,
          items: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              category: true,
              name: true,
              quantityPlanned: true,
              unit: true,
              supplier: true,
              website: true,
              timing: true,
              notes: true,
            },
          },
        },
      });
      return {
        ...base,
        kind: "BAR",
        barType: b?.barType ?? null,
        toastDrink: b?.toastDrink ?? null,
        notes: b?.notes ?? null,
        items: b?.items ?? [],
      };
    }

    case "SETUP": {
      const s = await db.bookSetupCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          space: true,
          setupStartsAt: true,
          setupOwner: true,
          notes: true,
          items: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              name: true,
              quantity: true,
              location: true,
              source: true,
              website: true,
              packed: true,
              placed: true,
              packDownPlan: true,
              notes: true,
            },
          },
        },
      });
      return {
        ...base,
        kind: "SETUP",
        space: s?.space ?? null,
        setupStartsAt: s?.setupStartsAt ?? null,
        setupOwner: s?.setupOwner ?? null,
        notes: s?.notes ?? null,
        items: s?.items ?? [],
      };
    }

    case "RUNSHEET": {
      const rs = await db.bookRunsheetCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          notes: true,
          rows: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: { time: true, event: true, owner: true, notes: true, done: true },
          },
        },
      });
      return { ...base, kind: "RUNSHEET", notes: rs?.notes ?? null, rows: rs?.rows ?? [] };
    }

    case "STAY": {
      const s = await db.bookStayCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          propertyName: true,
          propertyContact: true,
          bookingReference: true,
          checkInDate: true,
          checkOutDate: true,
          occupants: true,
          notes: true,
        },
      });
      return {
        ...base,
        kind: "STAY",
        propertyName: s?.propertyName ?? null,
        propertyContact: s?.propertyContact ?? null,
        bookingReference: s?.bookingReference ?? null,
        checkInDate: dateOnly(s?.checkInDate),
        checkOutDate: dateOnly(s?.checkOutDate),
        occupants: strArray(s?.occupants),
        notes: s?.notes ?? null,
      };
    }

    case "LODGING_GUIDE": {
      const l = await db.bookLodgingCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          notes: true,
          items: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              name: true,
              distanceFromVenue: true,
              priceRangeLabel: true,
              phone: true,
              website: true,
              groupRateCode: true,
              notes: true,
            },
          },
        },
      });
      return { ...base, kind: "LODGING_GUIDE", notes: l?.notes ?? null, items: l?.items ?? [] };
    }

    case "DRESS_CODE": {
      const d = await db.bookDressCodeCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          dressCode: true,
          summary: true,
          bodyHtml: true,
          colourGuidance: true,
          footwear: true,
          weather: true,
          accessories: true,
        },
      });
      return {
        ...base,
        kind: "DRESS_CODE",
        dressCode: d?.dressCode ?? null,
        summary: d?.summary ?? null,
        bodyHtml: d?.bodyHtml ?? null,
        colourGuidance: d?.colourGuidance ?? null,
        footwear: d?.footwear ?? null,
        weather: d?.weather ?? null,
        accessories: d?.accessories ?? null,
      };
    }

    case "WEDDING_PARTY": {
      const wp = await db.bookWeddingPartyCard.findUnique({
        where: { subsectionId: card.id },
        select: {
          groupLabel: true,
          notes: true,
          members: {
            orderBy: { order: "asc" },
            take: CHILD_ROW_CAP,
            select: {
              id: true,
              name: true,
              role: true,
              cells: { select: { itemId: true, status: true, notes: true } },
            },
          },
          items: { orderBy: { order: "asc" }, take: CHILD_ROW_CAP, select: { id: true, label: true, notes: true } },
        },
      });
      return {
        ...base,
        kind: "WEDDING_PARTY",
        groupLabel: wp?.groupLabel ?? null,
        notes: wp?.notes ?? null,
        members: (wp?.members ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role })),
        items: wp?.items ?? [],
        cells: (wp?.members ?? []).flatMap((m) =>
          m.cells.map((c) => ({ memberId: m.id, itemId: c.itemId, status: String(c.status), notes: c.notes })),
        ),
      };
    }
  }
}
