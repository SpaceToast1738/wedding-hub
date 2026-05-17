import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canViewMoney } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSubsectionToggle } from "./AddSubsectionToggle";
import { CardRouter } from "./CardRouter";
import { SubsectionReorderControls } from "./SubsectionReorderControls";
import { SectionVisibilityToggle } from "./SectionVisibilityToggle";
import { LinkedTasksPanel } from "./LinkedTasksPanel";
import { menuRollups } from "@/lib/book-cards";

export default async function BookSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const editable = await canEdit(user, "book");
  // v1.76.0: gate £ values on BUILD / MENU / BAR / OUTFIT / STAY
  // cards. Threaded down through CardRouter to each card editor.
  const showMoney = await canViewMoney(user);

  const section = await db.bookSection.findUnique({
    where: { slug },
    include: {
      subsections: {
        // C1 (v1.14.0): non-couple users don't see COUPLE_ONLY pages.
        // The couple sees everything. Mirrors File.visibility.
        where: user.isCouple ? undefined : { visibility: "EVERYONE" },
        orderBy: [{ order: "asc" }, { title: "asc" }],
        // v1.26.0: load all per-kind nested data so the CardRouter
        // can render whichever editor matches the subsection's kind.
        // v1.31.0: + buildCard.
        include: {
          fieldDefs: { orderBy: { order: "asc" } },
          // v1.38.0: include structured recipeSteps for the editor.
          recipe: { include: { recipeSteps: { orderBy: { order: "asc" } } } },
          shotList: { include: { shots: { orderBy: { order: "asc" } } } },
          // v1.35.0: OUTFIT rework — pull card-level fields + items.
          // v1.78.0: + budgetLine for the linked-budget chip; + payments
          // per outfit-item for the paid-on-card reciprocal chip.
          outfitCard: {
            include: {
              outfits: {
                orderBy: { order: "asc" },
                include: { payments: { select: { amount: true, status: true } } },
              },
              budgetLine: {
                select: { id: true, description: true, category: { select: { id: true, name: true } } },
              },
            },
          },
          // v1.78.0: + payments per material for the paid-on-card chip.
          buildCard: {
            include: {
              materials: {
                orderBy: { order: "asc" },
                include: { payments: { select: { amount: true, status: true } } },
              },
              sessions: { orderBy: { date: "desc" } },
              budgetLine: {
                select: { id: true, description: true, estimated: true, category: { select: { id: true, name: true } } },
              },
            },
          },
          // v1.32.0: MENU + BAR cards. v1.78.0: + budgetLine.
          menuCard: {
            include: {
              courses: {
                orderBy: { order: "asc" },
                include: { options: { orderBy: { order: "asc" } } },
              },
              budgetLine: {
                select: { id: true, description: true, category: { select: { id: true, name: true } } },
              },
            },
          },
          barCard: {
            include: {
              items: { orderBy: { order: "asc" } },
              budgetLine: {
                select: { id: true, description: true, category: { select: { id: true, name: true } } },
              },
            },
          },
          // v1.33.0: SETUP card.
          setupCard: {
            include: { items: { orderBy: { order: "asc" } } },
          },
          // v1.34.0: LEGAL card + per-item file references.
          legalCard: {
            include: {
              items: {
                orderBy: { order: "asc" },
                include: { file: { select: { id: true, name: true } } },
              },
            },
          },
          // v1.36.0: STAY + LODGING_GUIDE cards. v1.78.0: + budgetLine.
          stayCard: {
            include: {
              budgetLine: {
                select: { id: true, description: true, category: { select: { id: true, name: true } } },
              },
            },
          },
          lodgingCard: {
            include: { items: { orderBy: { order: "asc" } } },
          },
          // v1.91.0: DRESS_CODE card. Single-row card; just include
          // the row by default — no nested children.
          dressCodeCard: true,
          // v1.92.0: WEDDING_PARTY card — members + items + sparse
          // cells (cells are accessed via Member.cells; we flatten in
          // JS below before passing into the editor).
          weddingPartyCard: {
            include: {
              members: { orderBy: { order: "asc" }, include: { cells: true } },
              items: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!section) notFound();
  // v1.24.0: non-couple users can't open a section the couple has
  // marked COUPLE_ONLY. Returning 404 (rather than redirecting to
  // /book) keeps the existence of the section invisible — matches
  // how the hub-page filter hides them from the index.
  if (section.visibility === "COUPLE_ONLY" && !user.isCouple) notFound();

  // v1.71.0: users list for AddTaskToggle embedded in linked-task panels.
  const taskUsers = editable
    ? await db.user.findMany({
        orderBy: [{ isCouple: "desc" }, { name: "asc" }],
        select: { id: true, name: true, email: true },
      })
    : [];

  // v1.78.0: budget categories for the per-card "Link to budget"
  // picker. Couple-only — the picker is hidden for non-money users.
  const budgetCategories = user.isCouple
    ? await db.budgetCategory.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      })
    : [];


  // v1.30.5: pull section-level linked tasks (m2m bookSections relation).
  // Replaces v1.30.0's per-subsection link.
  const linkedTasks = await db.task.findMany({
    where: { bookSections: { some: { id: section.id } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      priority: true,
      dueDate: true,
    },
  });

  // v1.51.0: pull subsection-level (per-card) linked tasks. Independent
  // of the section-level link above; a task can appear on the
  // section-level panel AND on a specific card's inline panel. Bucketed
  // by subsectionId so each card gets its own slice without re-querying.
  const subsectionIds = section.subsections.map((s) => s.id);
  const subsectionTasksRaw =
    subsectionIds.length === 0
      ? []
      : await db.task.findMany({
          where: { bookSubsections: { some: { id: { in: subsectionIds } } } },
          orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            dueDate: true,
            bookSubsections: { select: { id: true } },
          },
        });
  const subsectionTasksById = new Map<string, typeof subsectionTasksRaw>();
  for (const t of subsectionTasksRaw) {
    for (const ss of t.bookSubsections) {
      const arr = subsectionTasksById.get(ss.id) ?? [];
      arr.push(t);
      subsectionTasksById.set(ss.id, arr);
    }
  }

  // v1.32.0: MENU live counts + BAR per-head sanity. Both pull from
  // /guests; cheap because it runs once for the whole section, not
  // per-card. Skipped entirely when the section has no MENU or BAR
  // cards.
  const hasMenu = section.subsections.some((s) => s.kind === "MENU");
  const hasBar = section.subsections.some((s) => s.kind === "BAR");
  const guestMealRows = hasMenu
    ? await db.guest.findMany({
        where: { archived: false, attending: true },
        select: {
          attending: true,
          isChild: true,
          mealStarter: true,
          mealMain: true,
          mealDessert: true,
          dietary: true,
        },
      })
    : [];
  const confirmedAdults = hasBar
    ? await db.guest.count({
        where: { archived: false, attending: true, isChild: false },
      })
    : null;

  // v1.33.0: supplier names for the SETUP card's `source`
  // autocomplete. Sorted alphabetically; cheap because Suppliers
  // is a small table.
  const hasSetup = section.subsections.some((s) => s.kind === "SETUP");
  const supplierNames = hasSetup
    ? (await db.supplier.findMany({ orderBy: { name: "asc" }, select: { name: true } })).map(
        (s) => s.name,
      )
    : [];

  // v1.34.0: wedding date + files list for LEGAL cards' expiry flag
  // and per-item file picker.
  // v1.35.0: OUTFIT cards also use the file list for the per-card
  // photo picker — a single fetch covers both kinds when either is
  // present.
  const hasLegal = section.subsections.some((s) => s.kind === "LEGAL");
  const hasOutfit = section.subsections.some((s) => s.kind === "OUTFIT");
  const needFiles = hasLegal || hasOutfit;
  const [weddingSettings, allFiles] = needFiles
    ? await Promise.all([
        hasLegal ? db.weddingSettings.findUnique({ where: { id: 1 } }) : Promise.resolve(null),
        db.file.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, mimeType: true },
        }),
      ])
    : [null, [] as Array<{ id: string; name: string; mimeType: string }>];
  const legalWeddingDate = weddingSettings?.weddingDate ?? null;

  // v1.36.0: STAY cards need a guest list for the "linked guests"
  // picker. Cheap — runs once per section, only when at least one
  // STAY card is present. Mirrors the LODGING_GUIDE / supplier-name
  // pattern. Archived guests excluded.
  // v1.38.0: SHOT_LIST cards reuse the same picker shape, so a single
  // guests fetch covers both kinds.
  const hasStay = section.subsections.some((s) => s.kind === "STAY");
  const hasShotList = section.subsections.some((s) => s.kind === "SHOT_LIST");
  const sectionGuests = hasStay || hasShotList
    ? (
        await db.guest.findMany({
          where: { archived: false },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      ).map((g) => ({
        id: g.id,
        name: [g.firstName, g.lastName].filter(Boolean).join(" "),
      }))
    : [];

  return (
    <>
      <PageHeader
        title={section.title}
        subtitle={`Wedding Book · ${section.subsections.length} ${section.subsections.length === 1 ? "page" : "pages"}${section.visibility === "COUPLE_ONLY" ? " · couple-only" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {/* v1.24.0: section-level visibility toggle, couple-only. */}
            {user.isCouple && (
              <SectionVisibilityToggle
                sectionId={section.id}
                initial={section.visibility}
              />
            )}
            {editable && <AddSubsectionToggle sectionId={section.id} />}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <Link href="/book" className="text-xs text-moss-500 hover:underline inline-block">← Wedding Book</Link>

          {/* On-page anchor row — quick jumps for long sections.
              v1.92.2: threshold bumped from >1 to >4 so 2-4-card
              sections don't carry a redundant "titles row" above
              cards that are visible on the same screen anyway. */}
          {section.subsections.length > 4 && (
            <nav className="flex flex-wrap gap-1.5" aria-label="On this page">
              <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider self-center mr-1">
                On this page
              </span>
              {section.subsections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.slug}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-canvas border border-border-soft text-ink-secondary hover:text-moss-700 hover:border-moss-300"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          )}

          {/* v1.30.5: section-level linked tasks panel. Renders above
              the cards. v1.71.0: + task-add affordance + inline toggle. */}
          <LinkedTasksPanel
            tasks={linkedTasks}
            canEdit={editable}
            users={taskUsers}
            sectionId={section.id}
          />

          {section.subsections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              This section has no pages yet. {editable && "Add one above."}
            </p>
          ) : (
            section.subsections.map((sRaw, subIdx) => {
              // v1.31.1: Coerce BUILD card's BudgetLine.estimated
              // (Prisma Decimal) to a plain number before crossing
              // the client boundary. CardRouter's `Sub` type expects
              // `estimated: number | null`.
              // v1.32.0: precompute MENU live counts + thread BAR
              // confirmedAdults so the editors render purely off
              // their props (no client-side guest fetch).
              const buildCard = sRaw.buildCard
                ? {
                    ...sRaw.buildCard,
                    budgetLine: sRaw.buildCard.budgetLine
                      ? {
                          id: sRaw.buildCard.budgetLine.id,
                          description: sRaw.buildCard.budgetLine.description,
                          estimated:
                            sRaw.buildCard.budgetLine.estimated == null
                              ? null
                              : Number(sRaw.buildCard.budgetLine.estimated),
                        }
                      : null,
                    // v1.78.0: roll up paid-per-material from linked
                    // payments (PAID status only) for the
                    // reciprocal "📎 paid £X" chip.
                    materials: sRaw.buildCard.materials.map((m) => ({
                      ...m,
                      paidPence: Math.round(
                        m.payments.reduce(
                          (sum, p) =>
                            p.status === "PAID"
                              ? sum + Number(p.amount.toString()) * 100
                              : sum,
                          0,
                        ),
                      ),
                    })),
                    // v1.63.0: thread the file list for the photo
                    // gallery, mirroring the outfitCard / legalCard
                    // pattern from v1.35.0 / v1.34.0.
                    files: allFiles,
                  }
                : null;
              const menuCard = sRaw.menuCard
                ? (() => {
                    const r = menuRollups(
                      {
                        pricePerHeadPence: sRaw.menuCard.pricePerHeadPence,
                        confirmedHeadcount: sRaw.menuCard.confirmedHeadcount,
                        courses: sRaw.menuCard.courses.map((c) => ({
                          id: c.id,
                          courseLabel: c.courseLabel,
                          options: c.options.map((o) => ({
                            id: o.id,
                            label: o.label,
                            dietary: o.dietary,
                            isVegetarianMain: o.isVegetarianMain,
                            isKidsMeal: o.isKidsMeal,
                          })),
                        })),
                      },
                      guestMealRows,
                    );
                    return {
                      ...sRaw.menuCard,
                      optionCounts: r.perCourseCounts,
                      allergenAggregate: r.allergenAggregate,
                      totalConfirmed: r.totalConfirmed,
                      // v1.78.0: budgetLine already on sRaw.menuCard
                      // via spread; re-listed here for type clarity.
                      budgetLine: sRaw.menuCard.budgetLine,
                    };
                  })()
                : null;
              const barCard = sRaw.barCard
                ? { ...sRaw.barCard, confirmedAdults, budgetLine: sRaw.barCard.budgetLine }
                : null;
              const setupCard = sRaw.setupCard
                ? { ...sRaw.setupCard, supplierNames, files: allFiles }
                : null;
              const legalCard = sRaw.legalCard
                ? {
                    ...sRaw.legalCard,
                    weddingDate: legalWeddingDate,
                    files: allFiles,
                  }
                : null;
              // v1.35.0: shape OUTFIT data — flatten outfits → items
              // (renaming the relation), and thread the file list
              // for the per-card photo picker.
              // v1.78.0: + paidPence per item (sum of linked payments).
              const outfitCard = sRaw.outfitCard
                ? {
                    id: sRaw.outfitCard.id,
                    personName: sRaw.outfitCard.personName,
                    role: sRaw.outfitCard.role,
                    costPence: sRaw.outfitCard.costPence,
                    fileIds: sRaw.outfitCard.fileIds,
                    notes: sRaw.outfitCard.notes,
                    items: sRaw.outfitCard.outfits.map((o) => ({
                      id: o.id,
                      itemLabel: o.itemLabel ?? "Outfit",
                      description: o.description,
                      supplier: o.supplier,
                      website: o.website,
                      status: o.status,
                      notes: o.notes,
                      order: o.order,
                      paidPence: Math.round(
                        o.payments.reduce(
                          (sum, p) =>
                            p.status === "PAID"
                              ? sum + Number(p.amount.toString()) * 100
                              : sum,
                          0,
                        ),
                      ),
                    })),
                    files: allFiles,
                    budgetLine: sRaw.outfitCard.budgetLine,
                  }
                : null;
              // v1.36.0: shape STAY data — thread the guest list for
              // the linked-guest picker.
              const stayCard = sRaw.stayCard
                ? {
                    ...sRaw.stayCard,
                    guests: sectionGuests,
                    files: allFiles,
                    budgetLine: sRaw.stayCard.budgetLine,
                  }
                : null;
              const lodgingCard = sRaw.lodgingCard ?? null;
              // v1.38.0: same guest list threads into SHOT_LIST cards.
              const shotList = sRaw.shotList
                ? { ...sRaw.shotList, guests: sectionGuests }
                : null;
              // v1.91.0: DRESS_CODE card shape — single row + threaded
              // file list for the image gallery.
              const dressCodeCard = sRaw.dressCodeCard
                ? { ...sRaw.dressCodeCard, files: allFiles }
                : null;
              // v1.92.0: WEDDING_PARTY card — flatten cells from
              // members.cells into a single sparse array for the
              // matrix editor's lookup map.
              const weddingPartyCard = sRaw.weddingPartyCard
                ? {
                    id: sRaw.weddingPartyCard.id,
                    groupLabel: sRaw.weddingPartyCard.groupLabel,
                    notes: sRaw.weddingPartyCard.notes,
                    members: sRaw.weddingPartyCard.members.map((m) => ({
                      id: m.id,
                      name: m.name,
                      role: m.role,
                      order: m.order,
                    })),
                    items: sRaw.weddingPartyCard.items.map((i) => ({
                      id: i.id,
                      label: i.label,
                      notes: i.notes,
                      order: i.order,
                    })),
                    cells: sRaw.weddingPartyCard.members.flatMap((m) =>
                      m.cells.map((c) => ({
                        memberId: c.memberId,
                        itemId: c.itemId,
                        status: c.status,
                        notes: c.notes,
                      })),
                    ),
                  }
                : null;
              const s = {
                ...sRaw,
                buildCard,
                menuCard,
                barCard,
                setupCard,
                legalCard,
                outfitCard,
                stayCard,
                lodgingCard,
                shotList,
                dressCodeCard,
                weddingPartyCard,
              };
              return (
                // v1.87.0: wrap each card in a Fragment with the
                // reorder buttons sitting just above it. Hidden when
                // the user can't edit the book.
                <div key={s.id} className="space-y-1">
                  {editable && section.subsections.length > 1 && (
                    <SubsectionReorderControls
                      id={s.id}
                      title={s.title}
                      isFirst={subIdx === 0}
                      isLast={subIdx === section.subsections.length - 1}
                    />
                  )}
                  <CardRouter
                    sub={s}
                    canEdit={editable}
                    isCouple={user.isCouple}
                    showMoney={showMoney}
                    budgetCategories={budgetCategories}
                    linkedTasks={subsectionTasksById.get(s.id) ?? []}
                    users={taskUsers}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
