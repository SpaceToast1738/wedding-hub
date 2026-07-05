import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canViewMoney } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSubsectionToggle } from "./AddSubsectionToggle";
import { CardRouter } from "./CardRouter";
import { SubsectionCardMenu } from "./SubsectionReorderControls";
import { SectionVisibilityToggle } from "./SectionVisibilityToggle";
import { EditSectionToggle } from "./EditSectionToggle";
import { BookTopicsProvider } from "./BookTopicsContext";
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
  // v1.96.3: also fuels the inline EditTaskDialog (per-row Edit on
  // linked-tasks panels) via BookTopicsContext — TaskForm needs the
  // full users list to populate the AssigneePicker chip toggles.
  const taskUsers = editable
    ? await db.user.findMany({
        orderBy: [{ isCouple: "desc" }, { name: "asc" }],
        select: { id: true, name: true, email: true },
      })
    : [];

  // v1.96.3: option lists for the inline EditTaskDialog. Loaded only
  // when the viewer can edit (no edit affordance otherwise). Three
  // cheap queries — same shapes the /tasks + /questions pages have
  // been loading since v1.30.5 / v1.61.0.
  const [taskSuppliers, taskNavTags, taskGuestGroupsRaw] = editable
    ? await Promise.all([
        db.supplier.findMany({
          orderBy: [{ category: "asc" }, { name: "asc" }],
          select: { id: true, name: true, category: true },
        }),
        db.navTag.findMany({
          orderBy: { order: "asc" },
          select: { id: true, name: true, route: true },
        }),
        db.guestGroup.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            colour: true,
            _count: { select: { members: true } },
          },
        }),
      ])
    : [
        [] as Array<{ id: string; name: string; category: string }>,
        [] as Array<{ id: string; name: string; route: string | null }>,
        [] as Array<{
          id: string;
          name: string;
          colour: string | null;
          _count: { members: number };
        }>,
      ];
  const taskGuestGroups = taskGuestGroupsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    colour: g.colour,
    memberCount: g._count.members,
  }));

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

  // v1.35.0: OUTFIT cards use a file list for the per-card photo
  // picker — single fetch covers them.
  // v1.96.1: TEXT cards get a photo gallery, so any section with a
  // TEXT card also needs the full file list for the attach picker.
  // v2.0.0: LEGAL kind dropped (was UK-centric); the wedding-date
  // passthrough + `hasLegal` predicate retired with it.
  const hasOutfit = section.subsections.some((s) => s.kind === "OUTFIT");
  const hasText = section.subsections.some((s) => s.kind === "TEXT");
  const needFiles = hasOutfit || hasText;
  const allFiles = needFiles
    ? await db.file.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, mimeType: true },
      })
    : ([] as Array<{ id: string; name: string; mimeType: string }>);

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
        subtitle={(() => {
          // v1.94.0: prepend the editable section subtitle when set.
          // Reads "<subtitle> · 3 pages · couple-only" / fallback
          // "Wedding Book · 3 pages" preserves v1.93 behaviour for
          // sections without a custom subtitle.
          const pageCount = `${section.subsections.length} ${section.subsections.length === 1 ? "page" : "pages"}`;
          const couple = section.visibility === "COUPLE_ONLY" ? " · couple-only" : "";
          if (section.subtitle && section.subtitle.trim()) {
            return `${section.subtitle} · ${pageCount}${couple}`;
          }
          return `Wedding Book · ${pageCount}${couple}`;
        })()}
        actions={
          <div className="flex items-center gap-2">
            {/* v1.24.0: section-level visibility toggle, couple-only. */}
            {user.isCouple && (
              <SectionVisibilityToggle
                sectionId={section.id}
                initial={section.visibility}
              />
            )}
            {/* v1.94.0: title + subtitle edit modal. Slug stays stable. */}
            {editable && (
              <EditSectionToggle
                id={section.id}
                initialTitle={section.title}
                initialSubtitle={section.subtitle}
              />
            )}
            {editable && <AddSubsectionToggle sectionId={section.id} />}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        {/* v1.95.0: container widened from max-w-3xl to max-w-5xl so
            the 2-column card grid below has room to breathe.
            v1.95.2: bumped again to max-w-7xl (1280 px) — two side-by-
            side cards at 5xl were noticeably cramped on wide screens. */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
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
              the cards. v1.71.0: + task-add affordance + inline toggle.
              v1.95.1: wrapped in BookTopicsProvider so inline task
              creation here AND in each card's CardLinkedTasksPanel
              (deep inside CardChrome) can pull the section's option
              lists for the TopicPicker — that picker is what emits
              the hidden `topicKeys` inputs that persist the autofill. */}
          <BookTopicsProvider
            bookSections={[
              { id: section.id, title: section.title, slug: section.slug },
            ]}
            bookSubsections={section.subsections.map((s) => ({
              id: s.id,
              title: s.title,
              sectionTitle: section.title,
              slug: s.slug,
              sectionSlug: section.slug,
            }))}
            // v1.96.3: full option lists for the inline EditTaskDialog
            // so the modal's TaskForm can pre-populate every picker
            // (assignees / supplier / topics) without a per-row fetch.
            users={taskUsers}
            suppliers={taskSuppliers}
            navTags={taskNavTags}
            guestGroups={taskGuestGroups}
          >
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
            // v1.95.0: two-column grid. Each card opts in to spanning
            // both columns via its `wide` flag (`md:col-span-2`).
            // Below the `md` breakpoint everything stacks into a
            // single column so phones still get a readable layout.
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.subsections.map((sRaw, subIdx) => {
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
                    // gallery, mirroring the outfitCard pattern from
                    // v1.35.0.
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
                      // v1.93.1: optional per-item cost in pence.
                      costPence: o.costPence,
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
                // v1.95.0: wide cards span both grid columns; narrow
                // cards take a single column. The flag flips via the
                // consolidated SubsectionCardMenu's "Layout" menu
                // (design-pass fix: was two separate glyph-only
                // controls — reorder ▲/▼ and a width ⇆ toggle — folded
                // into one clearly-labeled menu).
                <div
                  key={s.id}
                  className={[
                    // v1.95.2: flex-col + h-full so the card article
                    // grows to fill the grid row height when adjacent
                    // cards stretch the row. Replaces space-y-1 (which
                    // implies static block flow) with explicit flex
                    // gap so the action-row + article can compose
                    // vertically and the article gets flex-1 inside.
                    "flex flex-col gap-1 h-full",
                    sRaw.wide ? "md:col-span-2" : "",
                  ].join(" ")}
                >
                  {editable && (
                    <div className="flex items-center justify-end -mb-2">
                      <SubsectionCardMenu
                        id={s.id}
                        title={s.title}
                        wide={sRaw.wide}
                        isFirst={subIdx === 0}
                        isLast={subIdx === section.subsections.length - 1}
                        showReorder={section.subsections.length > 1}
                      />
                    </div>
                  )}
                  <CardRouter
                    sub={s}
                    canEdit={editable}
                    isCouple={user.isCouple}
                    showMoney={showMoney}
                    budgetCategories={budgetCategories}
                    linkedTasks={subsectionTasksById.get(s.id) ?? []}
                    users={taskUsers}
                    // v1.96.1: full file list for the TEXT-card photo
                    // picker. Pre-loaded above when `hasText` (or any
                    // other file-needing kind) is true.
                    files={allFiles}
                  />
                </div>
              );
            })}
            </div>
          )}
          </BookTopicsProvider>
        </div>
      </div>
    </>
  );
}
