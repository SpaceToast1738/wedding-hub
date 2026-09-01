// v2.4.0: full-content read of ONE wedding-book card, per kind.
//
// This is the keystone read tool for book proposals: it returns the
// child-row ids (step/shot/item/course/option/member/cell ids) that
// the propose_book_* delta tools must echo back verbatim, plus the
// bodyHtmlHash that book.card.replace_text uses as its staleness
// fence. Money parity: no *Pence, paid/paidBy, budget-link ids, or
// fileIds ever appear in the output — the apply bridges carry those
// through from the live row untouched.

import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
// v2.13.3: shared stripper that also DECODES entities — the local copy
// left `&amp;` in bodyText and it round-tripped onto the site.
import { stripHtml } from "@/lib/html-text";
import type { AiTool } from "./types";

const inputSchema = z.object({
  subsectionId: z.string().optional(),
  sectionSlug: z.string().optional(),
  cardSlug: z.string().optional(),
});

/** Hard cap per child list — a runaway card can't blow the context. */
const CHILD_ROW_CAP = 100;

/** Notes/description fields are unbounded @db.Text columns — clip so
 *  one chatty card can't dominate the tool result. */
function clip(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.length > 500 ? s.slice(0, 500) + "…" : s;
}

function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export const readBookCard: AiTool<typeof inputSchema> = {
  name: "read_book_card",
  description:
    "Read the FULL structured content of ONE Wedding Book card — every field for its kind, including the ids of every child row (recipe steps, shots, outfit/build/bar/setup/lodging items, menu courses + options, wedding-party members/items/cells, FIELD defs). Those child-row ids are the currency for book update proposals: echo them EXACTLY as returned, never invent or alter them. TEXT cards also return bodyHtmlHash — propose_book_card_replace_text requires it as the staleness fence. Money (costs, prices, budget links) is never returned. Target by subsectionId (from read_book) or by sectionSlug + cardSlug.",
  inputSchema,
  progressLabel: "Reading book card…",
  definition: {
    name: "read_book_card",
    description:
      "Read one Wedding Book card's full per-kind content WITH child-row ids — echo those ids EXACTLY in book update proposals. TEXT cards return bodyHtmlHash, needed by propose_book_card_replace_text. Target by subsectionId, or sectionSlug + cardSlug.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "Card id from read_book. Wins over the slug pair when both are given.",
        },
        sectionSlug: { type: "string", description: "Section slug, e.g. 'food-drink'." },
        cardSlug: { type: "string", description: "Card slug within that section." },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "book"))) {
      return { ok: false, error: "The Wedding Book isn't visible to this user." };
    }

    const baseSelect = {
      id: true,
      sectionId: true,
      slug: true,
      title: true,
      kind: true,
      visibility: true,
      bodyHtml: true,
      body: true,
      fields: true,
      fileIds: true,
      section: { select: { slug: true, visibility: true } },
    } as const;

    const card = input.subsectionId
      ? await db.bookSubsection.findUnique({
          where: { id: input.subsectionId },
          select: baseSelect,
        })
      : input.sectionSlug && input.cardSlug
        ? await db.bookSubsection.findFirst({
            where: { slug: input.cardSlug, section: { slug: input.sectionSlug } },
            select: baseSelect,
          })
        : null;

    if (!input.subsectionId && !(input.sectionSlug && input.cardSlug)) {
      return {
        ok: false,
        error: "Provide either subsectionId, or both sectionSlug and cardSlug.",
      };
    }
    if (!card) {
      return { ok: false, error: "No book card matches that reference." };
    }

    // Same wall as assertBookCardWritable on the apply side: the book
    // server actions don't check per-card visibility, so the AI layer
    // must — otherwise a non-couple caller reads cards the UI hides.
    if (
      !ctx.user.isCouple &&
      (card.visibility === "COUPLE_ONLY" || card.section.visibility === "COUPLE_ONLY")
    ) {
      return { ok: false, error: "This card is couple-only." };
    }

    const base = {
      id: card.id,
      sectionId: card.sectionId,
      sectionSlug: card.section.slug,
      title: card.title,
      slug: card.slug,
      kind: card.kind,
      visibility: card.visibility,
    };

    switch (card.kind) {
      case "TEXT": {
        // Hash formula must stay byte-identical to the replace_text
        // apply bridge's recomputation (bodyHtml ?? "" — legacy cards
        // with only `body` hash the empty string on both sides).
        const bodyHtmlHash = createHash("sha256")
          .update(card.bodyHtml ?? "")
          .digest("hex");
        return {
          ok: true,
          data: {
            ...base,
            bodyText: stripHtml(card.bodyHtml ?? card.body).slice(0, 8000),
            bodyHtmlHash,
            photoCount: card.fileIds.length,
          },
        };
      }

      case "FIELD": {
        const defs = await db.bookFieldDef.findMany({
          where: { subsectionId: card.id },
          orderBy: { order: "asc" },
          take: CHILD_ROW_CAP,
          select: {
            id: true,
            label: true,
            type: true,
            options: true,
            required: true,
            group: true,
            helpText: true,
          },
        });
        return {
          ok: true,
          data: {
            ...base,
            fieldDefs: defs.map((d) => ({
              defId: d.id,
              label: d.label,
              type: d.type,
              options: d.options,
              required: d.required,
              group: d.group,
              helpText: clip(d.helpText),
            })),
            values: (card.fields as Record<string, unknown> | null) ?? {},
          },
        };
      }

      case "RECIPE": {
        const recipe = await db.bookRecipe.findUnique({
          where: { subsectionId: card.id },
          select: {
            ingredients: true,
            notes: true,
            servingsBase: true,
            recipeSteps: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
                order: true,
                instruction: true,
                durationMinutes: true,
                dayBefore: true,
              },
            },
          },
        });
        const rawIngredients = recipe?.ingredients;
        return {
          ok: true,
          data: {
            ...base,
            ingredients: Array.isArray(rawIngredients)
              ? (rawIngredients as string[]).slice(0, CHILD_ROW_CAP)
              : [],
            steps: (recipe?.recipeSteps ?? []).map((s) => ({
              stepId: s.id,
              order: s.order,
              instruction: clip(s.instruction),
              durationMinutes: s.durationMinutes,
              dayBefore: s.dayBefore,
            })),
            notes: clip(recipe?.notes),
            servingsBase: recipe?.servingsBase ?? null,
          },
        };
      }

      case "SHOT_LIST": {
        const shotList = await db.bookShotList.findUnique({
          where: { subsectionId: card.id },
          select: {
            shots: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
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
          ok: true,
          data: {
            ...base,
            shots: (shotList?.shots ?? []).map((s) => ({
              shotId: s.id,
              title: s.title,
              category: s.category,
              estimatedMinutes: s.estimatedMinutes,
              withWhom: s.withWhom,
              location: s.location,
              notes: clip(s.notes),
              captured: s.captured,
            })),
          },
        };
      }

      case "OUTFIT": {
        const outfit = await db.bookOutfitCard.findUnique({
          where: { subsectionId: card.id },
          select: {
            personName: true,
            role: true,
            notes: true,
            outfits: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
                itemLabel: true,
                description: true,
                supplier: true,
                website: true,
                status: true,
                notes: true,
              },
            },
          },
        });
        return {
          ok: true,
          data: {
            ...base,
            personName: outfit?.personName ?? null,
            role: outfit?.role ?? null,
            notes: clip(outfit?.notes),
            items: (outfit?.outfits ?? []).map((o) => ({
              itemId: o.id,
              itemLabel: o.itemLabel,
              description: clip(o.description),
              supplier: o.supplier,
              website: o.website,
              status: o.status,
              notes: clip(o.notes),
            })),
          },
        };
      }

      case "BUILD": {
        const build = await db.bookBuildCard.findUnique({
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
                id: true,
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
            // sessions deliberately not selected — they carry human
            // work attribution (loggedById) and no proposal targets them.
          },
        });
        return {
          ok: true,
          data: {
            ...base,
            quantityNeeded: build?.quantityNeeded ?? null,
            targetDate: dateOnly(build?.targetDate),
            status: build?.status ?? null,
            prototypeDone: build?.prototypeDone ?? false,
            prototypeNotes: clip(build?.prototypeNotes),
            estimatedMinutesPerUnit: build?.estimatedMinutesPerUnit ?? null,
            notes: clip(build?.notes),
            materials: (build?.materials ?? []).map((m) => ({
              materialId: m.id,
              name: m.name,
              quantity: m.quantity,
              unit: m.unit,
              supplier: m.supplier,
              website: m.website,
              ordered: m.ordered,
              arrived: m.arrived,
              notes: clip(m.notes),
            })),
          },
        };
      }

      case "MENU": {
        const menu = await db.bookMenuCard.findUnique({
          where: { subsectionId: card.id },
          select: {
            serviceType: true,
            serviceTime: true,
            notes: true,
            courses: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
                courseLabel: true,
                options: {
                  orderBy: { order: "asc" },
                  take: CHILD_ROW_CAP,
                  select: {
                    id: true,
                    label: true,
                    description: true,
                    dietary: true,
                    isVegetarianMain: true,
                    isKidsMeal: true,
                  },
                },
              },
            },
          },
        });
        return {
          ok: true,
          data: {
            ...base,
            serviceType: menu?.serviceType ?? null,
            serviceTime: menu?.serviceTime ?? null,
            notes: clip(menu?.notes),
            courses: (menu?.courses ?? []).map((c) => ({
              courseId: c.id,
              courseLabel: c.courseLabel,
              options: c.options.map((o) => ({
                optionId: o.id,
                label: o.label,
                description: clip(o.description),
                dietary: o.dietary,
                isVegetarianMain: o.isVegetarianMain,
                isKidsMeal: o.isKidsMeal,
              })),
            })),
          },
        };
      }

      case "BAR": {
        const bar = await db.bookBarCard.findUnique({
          where: { subsectionId: card.id },
          select: {
            barType: true,
            toastDrink: true,
            notes: true,
            items: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
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
          ok: true,
          data: {
            ...base,
            barType: bar?.barType ?? null,
            toastDrink: bar?.toastDrink ?? null,
            notes: clip(bar?.notes),
            items: (bar?.items ?? []).map((i) => ({
              itemId: i.id,
              category: i.category,
              name: i.name,
              quantityPlanned: i.quantityPlanned,
              unit: i.unit,
              supplier: i.supplier,
              website: i.website,
              timing: i.timing,
              notes: clip(i.notes),
            })),
          },
        };
      }

      case "SETUP": {
        const setup = await db.bookSetupCard.findUnique({
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
                id: true,
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
          ok: true,
          data: {
            ...base,
            space: setup?.space ?? null,
            setupStartsAt: setup?.setupStartsAt ?? null,
            setupOwner: setup?.setupOwner ?? null,
            notes: clip(setup?.notes),
            items: (setup?.items ?? []).map((i) => ({
              itemId: i.id,
              name: i.name,
              quantity: i.quantity,
              location: i.location,
              source: i.source,
              website: i.website,
              packed: i.packed,
              placed: i.placed,
              packDownPlan: clip(i.packDownPlan),
              notes: clip(i.notes),
            })),
          },
        };
      }

      case "STAY": {
        const stay = await db.bookStayCard.findUnique({
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
          ok: true,
          data: {
            ...base,
            propertyName: stay?.propertyName ?? null,
            propertyContact: stay?.propertyContact ?? null,
            bookingReference: stay?.bookingReference ?? null,
            checkInDate: dateOnly(stay?.checkInDate),
            checkOutDate: dateOnly(stay?.checkOutDate),
            occupants: stay?.occupants ?? [],
            notes: clip(stay?.notes),
          },
        };
      }

      case "LODGING_GUIDE": {
        const lodging = await db.bookLodgingCard.findUnique({
          where: { subsectionId: card.id },
          select: {
            notes: true,
            items: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: {
                id: true,
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
        return {
          ok: true,
          data: {
            ...base,
            notes: clip(lodging?.notes),
            items: (lodging?.items ?? []).map((i) => ({
              itemId: i.id,
              name: i.name,
              distanceFromVenue: i.distanceFromVenue,
              priceRangeLabel: i.priceRangeLabel,
              phone: i.phone,
              website: i.website,
              groupRateCode: i.groupRateCode,
              notes: clip(i.notes),
            })),
          },
        };
      }

      case "DRESS_CODE": {
        const dress = await db.bookDressCodeCard.findUnique({
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
          ok: true,
          data: {
            ...base,
            dressCode: dress?.dressCode ?? null,
            summary: dress?.summary ?? null,
            colourGuidance: dress?.colourGuidance ?? null,
            footwear: dress?.footwear ?? null,
            weather: dress?.weather ?? null,
            accessories: dress?.accessories ?? null,
            bodyText: stripHtml(dress?.bodyHtml).slice(0, 8000),
          },
        };
      }

      case "WEDDING_PARTY": {
        const wp = await db.bookWeddingPartyCard.findUnique({
          where: { subsectionId: card.id },
          select: {
            id: true,
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
            items: {
              orderBy: { order: "asc" },
              take: CHILD_ROW_CAP,
              select: { id: true, label: true, notes: true },
            },
          },
        });
        // Cells are sparse (absent = NEED); flatten the member-nested
        // rows into the memberId × itemId pairs propose_wp_set_cell needs.
        const allCells = (wp?.members ?? []).flatMap((m) =>
          m.cells.map((c) => ({
            memberId: m.id,
            itemId: c.itemId,
            status: c.status,
            notes: clip(c.notes),
          })),
        );
        const cells = allCells.slice(0, CHILD_ROW_CAP);
        return {
          ok: true,
          data: {
            ...base,
            cardId: wp?.id ?? null,
            groupLabel: wp?.groupLabel ?? null,
            notes: clip(wp?.notes),
            members: (wp?.members ?? []).map((m) => ({
              memberId: m.id,
              name: m.name,
              role: m.role,
            })),
            items: (wp?.items ?? []).map((i) => ({
              itemId: i.id,
              label: i.label,
              notes: clip(i.notes),
            })),
            cells,
            // Absent-cell = NEED only holds while the list is complete
            // — once capped, missing entries mean "truncated", not
            // NEED, and set_cell proposals must not assume otherwise.
            ...(allCells.length > CHILD_ROW_CAP
              ? { cellsTruncated: true, cellCount: allCells.length }
              : {}),
          },
        };
      }

      default:
        return { ok: false, error: `Unsupported card kind: ${card.kind}` };
    }
  },
};
