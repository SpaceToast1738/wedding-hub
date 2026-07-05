import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { PageLinkedTasksStrip } from "@/components/ui/PageLinkedTasksStrip";
import { AddHouseholdToggle } from "./AddHouseholdToggle";
import { AddGuestButton, GuestList } from "./GuestList";
import { ArchivedGuestList } from "./ArchivedGuestList";

// v2.5.1 (finding #10): shared touch-target sizing for the plain-Link
// header actions on this page — min-h-[40px] on mobile, dense again
// at sm+. Mirrors the Button primitive's own SIZE_CLASSES convention;
// these aren't Button because they need to stay <Link>s.
const HEADER_LINK_CLASS =
  "inline-flex items-center min-h-[40px] sm:min-h-0 text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700";

// `?archived=1` switches the view from active households to a flat list of
// archived guests with Restore + (couple-only) Delete-permanently actions.
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  if (!(await canView(user, "guests"))) redirect("/");
  const editable = await canEdit(user, "guests");

  const params = await searchParams;
  const showArchived = params.archived === "1";

  if (showArchived) {
    const archived = await db.guest.findMany({
      where: { archived: true },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        household: { select: { id: true, name: true } },
      },
    });

    return (
      <>
        <PageHeader
          title="Archived guests"
          subtitle={
            archived.length === 0
              ? "Nothing archived. Anyone you delete on the main list lands here."
              : `${archived.length} archived guest${archived.length === 1 ? "" : "s"}`
          }
          actions={
            <Link href="/guests" className={HEADER_LINK_CLASS}>
              ← Active guests
            </Link>
          }
        />
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto p-4 sm:p-6">
            <ArchivedGuestList
              guests={archived.map((g) => ({
                id: g.id,
                firstName: g.firstName,
                lastName: g.lastName,
                householdName: g.household.name,
                householdId: g.household.id,
                updatedAt: g.updatedAt,
              }))}
              canEdit={editable}
              canHardDelete={user.isCouple}
            />
          </div>
        </div>
      </>
    );
  }

  // ── Active view ─────────────────────────────────────────────────────
  const [households, archivedCount, allGroups, navTagForPage, taskUsers] = await Promise.all([
    db.household.findMany({
      orderBy: [{ side: "asc" }, { name: "asc" }],
      include: {
        guests: {
          where: { archived: false },
          orderBy: [{ isChild: "asc" }, { firstName: "asc" }],
          include: {
            tableSeat: { include: { table: { select: { id: true, name: true } } } },
            _count: { select: { songRequests: true } },
            // v1.49.0: load each guest's group memberships so the
            // GuestGroupsControl chip + popover renders without a
            // second round-trip per row.
            groups: { select: { id: true } },
          },
        },
      },
    }),
    db.guest.count({ where: { archived: true } }),
    // All custom guest groups for the manage-groups popover.
    db.guestGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, colour: true, side: true },
    }),
    // v1.52.0 (backlog #7): tasks tagged with the page's nav tag
    // surface as a strip below the header.
    db.navTag.findFirst({
      where: { route: "/guests" },
      select: { id: true, name: true },
    }),
    // v1.71.0: users for AddTaskToggle in the strip.
    editable
      ? db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
  ]);

  const linkedTasks = navTagForPage
    ? await db.task.findMany({
        where: { navTags: { some: { id: navTagForPage.id } } },
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      })
    : [];

  const totalGuests = households.reduce((n, h) => n + h.guests.length, 0);
  const attending = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "ATTENDING").length, 0);
  const pending = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "PENDING").length, 0);
  // v2.5.1 (finding #8): header totals used to stop at confirmed/
  // pending/total — maybe and declined were invisible anywhere on the
  // page.
  const maybe = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "MAYBE").length, 0);
  const declined = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "DECLINED").length, 0);

  return (
    <>
      <PageHeader
        title="Guests"
        subtitle={`${attending} confirmed · ${pending} pending · ${maybe} maybe · ${declined} declined · ${totalGuests} total`}
        actions={
          <>
            {archivedCount > 0 && (
              <Link
                href="/guests?archived=1"
                className={HEADER_LINK_CLASS + " text-ink-tertiary"}
                title={`${archivedCount} archived guest${archivedCount === 1 ? "" : "s"}`}
              >
                Archived ({archivedCount})
              </Link>
            )}
            <Link
              href="/guests/catering"
              className={HEADER_LINK_CLASS}
              title="Printable catering brief: totals, course breakdowns, dietary, per-table seating"
            >
              Catering brief
            </Link>
            {editable && (
              <>
                <Link href="/guests/import" className={HEADER_LINK_CLASS}>
                  Import CSV
                </Link>
                <AddHouseholdToggle />
                {/* v2.5.1 (finding #1): the only way to add a single
                    guest used to be opening an existing row's edit
                    form — there was no create affordance in the UI at
                    all. */}
                <AddGuestButton households={households.map((h) => ({ id: h.id, name: h.name }))} />
              </>
            )}
          </>
        }
      />
      {navTagForPage && (
        <PageLinkedTasksStrip
          tasks={linkedTasks}
          navTagName={navTagForPage.name}
          navTagId={navTagForPage.id}
          canEdit={editable}
          users={taskUsers}
        />
      )}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {households.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No households yet. {editable && "Add one above."}
            </p>
          ) : (
            <GuestList households={households} allGroups={allGroups} canEdit={editable} />
          )}
        </div>
      </div>
    </>
  );
}
