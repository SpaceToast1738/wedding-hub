import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { findMealChoiceLinks, findShotsForGuest, findStaysForGuest } from "@/lib/guest-cross-refs";
import { GuestDetailClient } from "./GuestDetailClient";
import { AddSongRequestInline } from "./AddSongRequestInline";
import { CustomFieldsBlock } from "./CustomFieldsBlock";
import { GuestGroupsControl } from "@/components/ui/GuestGroupsControl";
import type { CustomFieldDef } from "@/lib/custom-fields";

const RSVP_PILL: Record<string, "YES" | "NO" | "PENDING"> = {
  ATTENDING: "YES",
  DECLINED: "NO",
  MAYBE: "PENDING",
  PENDING: "PENDING",
};

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canView(user, "guests"))) notFound();
  const editable = await canEdit(user, "guests");

  const guest = await db.guest.findUnique({
    where: { id },
    include: {
      household: {
        include: {
          guests: {
            where: { archived: false },
            orderBy: [{ isChild: "asc" }, { firstName: "asc" }],
            select: { id: true, firstName: true, lastName: true, rsvp: true },
          },
        },
      },
      tableSeat: { include: { table: { select: { id: true, name: true } } } },
      songRequests: { orderBy: { createdAt: "asc" } },
      // v1.49.0: surface group memberships on the detail page.
      groups: { select: { id: true } },
    },
  });
  if (!guest || guest.archived) notFound();

  // All custom guest groups, for the GuestGroupsControl picker.
  const allGuestGroups = await db.guestGroup.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, colour: true, side: true },
  });

  const siblings = guest.household.guests.filter((g) => g.id !== guest.id);

  // C10: pull definitions for the Guest entity. Order matches the
  // Settings panel (by `order` column).
  const customFieldDefs = await db.customField.findMany({
    where: { entity: "guest" },
    orderBy: { order: "asc" },
  });
  const customFieldDefsTyped: CustomFieldDef[] = customFieldDefs.map((f) => ({
    id: f.id,
    entity: f.entity,
    name: f.name,
    type: f.type as "text" | "number" | "date" | "select",
    options: f.options,
    order: f.order,
  }));
  const customFieldValues =
    (guest.customFieldValues as Record<string, string | number | null> | null) ?? {};

  const detailFields: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Email", value: guest.email || <Empty /> },
    { label: "Phone", value: guest.phone || <Empty /> },
    { label: "Side", value: <span className="capitalize">{guest.side.toLowerCase()}</span> },
    { label: "Role", value: guest.role || <Empty /> },
    { label: "Adult / child", value: guest.isChild ? "Child" : "Adult" },
    { label: "Highchair", value: guest.needsHighchair ? "Yes" : <Empty /> },
    { label: "Children's meal", value: guest.childrenMeal ? "Yes" : <Empty /> },
    {
      label: "Plus-one",
      value: guest.plusOneAllowed
        ? guest.plusOneName
          ? `Allowed — ${guest.plusOneName}`
          : "Allowed"
        : <Empty />,
    },
    {
      label: "Dietary",
      value: guest.dietary.length > 0 ? guest.dietary.join(", ") : <Empty />,
    },
    {
      label: "Tags",
      value: guest.tags.length > 0 ? guest.tags.join(" · ") : <Empty />,
    },
    {
      label: "Table",
      value: guest.tableSeat ? (
        <Link
          href={`/seating#table-${guest.tableSeat.table.id}`}
          className="text-info hover:underline"
          title="Open seating canvas"
        >
          {guest.tableSeat.table.name} · seat {guest.tableSeat.index + 1}
        </Link>
      ) : (
        <Empty />
      ),
    },
    {
      label: "RSVP link",
      value: guest.rsvpUniqueLink ? (
        <a
          href={guest.rsvpUniqueLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:underline truncate inline-block max-w-md"
        >
          {guest.rsvpUniqueLink}
        </a>
      ) : (
        <Empty />
      ),
    },
  ];

  const meals: Array<{ label: string; value: string | null }> = [
    { label: "Starter", value: guest.mealStarter },
    { label: "Main", value: guest.mealMain },
    { label: "Dessert", value: guest.mealDessert },
  ];
  const hasMeals = meals.some((m) => !!m.value);

  // v1.37.5 (P7b/C): cross-module surfaces — STAY cards listing this
  // guest, and MENU option deep-links matching the guest's meal
  // choices. Both are read-time-only queries (forward-only relations
  // per v1.30.5 cross-module-reference rule).
  const stayCardRows = await db.bookStayCard.findMany({
    select: {
      id: true,
      propertyName: true,
      checkInDate: true,
      checkOutDate: true,
      guestIds: true,
      subsection: {
        select: {
          id: true,
          slug: true,
          title: true,
          section: { select: { slug: true } },
        },
      },
    },
  });
  const stays = findStaysForGuest(
    guest.id,
    stayCardRows.map((s) => ({
      cardId: s.id,
      subsectionId: s.subsection.id,
      subsectionSlug: s.subsection.slug,
      subsectionTitle: s.subsection.title,
      sectionSlug: s.subsection.section.slug,
      propertyName: s.propertyName,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      guestIds: s.guestIds,
    })),
  );

  // v1.38.0 (P7b/B): "Photos to capture" — SHOT_LIST shots whose
  // guestIds includes this guest. Same forward-only convention as
  // STAY cards. Sorted by parent-card title then per-shot order.
  const shotRows = await db.bookShot.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      order: true,
      captured: true,
      guestIds: true,
      shotList: {
        select: {
          id: true,
          subsection: {
            select: { slug: true, title: true, section: { select: { slug: true } } },
          },
        },
      },
    },
  });
  const shotsForGuest = findShotsForGuest(
    guest.id,
    shotRows.map((s) => ({
      shotId: s.id,
      shotTitle: s.title,
      shotCategory: s.category,
      shotOrder: s.order,
      shotCaptured: s.captured,
      cardId: s.shotList.id,
      subsectionSlug: s.shotList.subsection.slug,
      subsectionTitle: s.shotList.subsection.title,
      sectionSlug: s.shotList.subsection.section.slug,
      guestIds: s.guestIds,
    })),
  );

  const menuOptionRows = hasMeals
    ? await db.bookMenuOption.findMany({
        select: {
          id: true,
          label: true,
          course: {
            select: {
              courseLabel: true,
              card: {
                select: {
                  id: true,
                  subsection: {
                    select: {
                      slug: true,
                      title: true,
                      section: { select: { slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const mealLinks = findMealChoiceLinks(
    {
      mealStarter: guest.mealStarter,
      mealMain: guest.mealMain,
      mealDessert: guest.mealDessert,
    },
    menuOptionRows.map((o) => ({
      optionId: o.id,
      optionLabel: o.label,
      courseLabel: o.course.courseLabel,
      cardId: o.course.card.id,
      subsectionSlug: o.course.card.subsection.slug,
      subsectionTitle: o.course.card.subsection.title,
      sectionSlug: o.course.card.subsection.section.slug,
    })),
  );
  const mealLinkByCourse = new Map(mealLinks.map((m) => [m.course, m]));

  function shortDateRange(ci: Date | null, co: Date | null): string {
    if (!ci && !co) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (ci && co) return `${fmt(ci)} → ${fmt(co)}`;
    if (ci) return fmt(ci);
    if (co) return `→ ${fmt(co)}`;
    return "";
  }

  return (
    <>
      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        subtitle={guest.household.name}
        actions={
          <Link
            href="/guests"
            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
          >
            ← All guests
          </Link>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusPill status={RSVP_PILL[guest.rsvp] ?? "PENDING"} />
            <span className="text-xs text-ink-tertiary capitalize">
              RSVP: {guest.rsvp.toLowerCase()}
            </span>
          </div>

          {/* Editable form (toggled by the client) */}
          <GuestDetailClient
            guest={{
              id: guest.id,
              householdId: guest.householdId,
              firstName: guest.firstName,
              lastName: guest.lastName,
              email: guest.email,
              phone: guest.phone,
              rsvp: guest.rsvp,
              side: guest.side,
              isChild: guest.isChild,
              needsHighchair: guest.needsHighchair,
              plusOneAllowed: guest.plusOneAllowed,
              plusOneName: guest.plusOneName,
              role: guest.role,
              dietary: guest.dietary.join(", "),
              notes: guest.notes,
            }}
            canEdit={editable}
          />

          {/* Read-only details — stay visible alongside the edit form so the
              user sees what they're changing in context. */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft">
              <h2 className="text-sm font-semibold text-ink-primary">Details</h2>
            </header>
            <dl className="divide-y divide-border-soft text-sm">
              {detailFields.map((f) => (
                <div key={f.label} className="grid grid-cols-3 gap-3 px-4 py-2.5">
                  <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-center">
                    {f.label}
                  </dt>
                  <dd className="col-span-2 text-ink-primary">{f.value}</dd>
                </div>
              ))}
              {/* v1.49.0: guest-group memberships row. Renders chips
                  + popover picker for editors; read-only chips for
                  viewers. Hidden when no groups defined AND guest
                  isn't in any. */}
              {(allGuestGroups.length > 0 || guest.groups.length > 0) && (
                <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
                  <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-center">
                    Guest groups
                  </dt>
                  <dd className="col-span-2">
                    <GuestGroupsControl
                      guestId={guest.id}
                      memberOf={guest.groups.map((g) => g.id)}
                      allGroups={allGuestGroups}
                      canEdit={editable}
                      size="md"
                    />
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Meal choices — v1.37.5: each row deep-links to the
              matching MENU option's parent subsection when one
              exists. Free-text choices that don't match any current
              option still show, just without the link. */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft">
              <h2 className="text-sm font-semibold text-ink-primary">Meal choices</h2>
            </header>
            {hasMeals ? (
              <dl className="divide-y divide-border-soft text-sm">
                {meals.map((m) => {
                  const link = mealLinkByCourse.get(
                    m.label.toLowerCase() as "starter" | "main" | "dessert",
                  );
                  return (
                    <div key={m.label} className="grid grid-cols-3 gap-3 px-4 py-2.5">
                      <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-center">
                        {m.label}
                      </dt>
                      <dd className="col-span-2 text-ink-primary flex items-baseline gap-2">
                        <span>{m.value ?? <Empty />}</span>
                        {link?.matched && (
                          <Link
                            href={`/book/${link.matched.sectionSlug}#${link.matched.subsectionSlug}`}
                            className="text-[11px] text-info hover:underline"
                            title={`View on ${link.matched.subsectionTitle}`}
                          >
                            on menu →
                          </Link>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="px-4 py-4 text-sm text-ink-tertiary italic">
                No meal choices recorded yet.
              </p>
            )}
          </section>

          {/* v1.38.0 (P7b/B): Photos to capture — SHOT_LIST shots
              that list this guest in their guestIds. Hidden when
              none. Captured shots show with strike-through. */}
          {shotsForGuest.length > 0 && (() => {
            const remaining = shotsForGuest.filter((s) => !s.shotCaptured).length;
            return (
              <section className="bg-surface border border-border-soft rounded-md shadow-sm">
                <header className="px-4 py-3 border-b border-border-soft">
                  <h2 className="text-sm font-semibold text-ink-primary">
                    Photos to capture
                    <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                      {remaining} remaining of {shotsForGuest.length}
                    </span>
                  </h2>
                </header>
                <ul className="divide-y divide-border-soft text-sm">
                  {shotsForGuest.map((s) => (
                    <li key={s.shotId} className="px-4 py-2 flex items-baseline gap-2">
                      <span className="flex-shrink-0">{s.shotCaptured ? "✓" : "○"}</span>
                      <Link
                        href={`/book/${s.sectionSlug}#${s.subsectionSlug}`}
                        className={[
                          "hover:text-moss-700 hover:underline truncate flex-1",
                          s.shotCaptured ? "line-through text-ink-tertiary" : "text-ink-primary",
                        ].join(" ")}
                        title={`${s.subsectionTitle} → ${s.shotTitle}`}
                      >
                        {s.shotTitle}
                      </Link>
                      {s.shotCategory && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-canvas border border-border-soft text-ink-tertiary flex-shrink-0">
                          {s.shotCategory}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

          {/* v1.37.5 (P7b/C): Accommodation — STAY cards that list
              this guest in their guestIds. Hidden when none. */}
          {stays.length > 0 && (
            <section className="bg-surface border border-border-soft rounded-md shadow-sm">
              <header className="px-4 py-3 border-b border-border-soft">
                <h2 className="text-sm font-semibold text-ink-primary">
                  Accommodation
                  <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                    {stays.length} {stays.length === 1 ? "stay" : "stays"}
                  </span>
                </h2>
              </header>
              <ul className="divide-y divide-border-soft text-sm">
                {stays.map((s) => (
                  <li key={s.cardId} className="px-4 py-2.5">
                    <Link
                      href={`/book/${s.sectionSlug}#${s.subsectionSlug}`}
                      className="font-medium text-ink-primary hover:text-moss-700 hover:underline"
                    >
                      {s.propertyName || s.subsectionTitle}
                    </Link>
                    {(s.checkInDate || s.checkOutDate) && (
                      <span className="ml-2 text-xs text-ink-tertiary tabular-nums">
                        {shortDateRange(s.checkInDate, s.checkOutDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Notes */}
          {guest.notes && (
            <section className="bg-surface border border-border-soft rounded-md shadow-sm">
              <header className="px-4 py-3 border-b border-border-soft">
                <h2 className="text-sm font-semibold text-ink-primary">Notes</h2>
              </header>
              <pre className="px-4 py-3 text-sm text-ink-primary whitespace-pre-wrap font-sans">
                {guest.notes}
              </pre>
            </section>
          )}

          <CustomFieldsBlock
            guestId={guest.id}
            fields={customFieldDefsTyped}
            values={customFieldValues}
            canEdit={editable}
          />

          {/* Song requests */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-primary">
                Song requests
                <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                  {guest.songRequests.length}
                </span>
              </h2>
              <div className="flex items-center gap-3">
                {editable && <AddSongRequestInline guestId={guest.id} />}
                {guest.songRequests.length > 0 && (
                  <Link href={`/songs?guest=${guest.id}`} className="text-[11px] text-info hover:underline">
                    Manage on Songs →
                  </Link>
                )}
              </div>
            </header>
            {guest.songRequests.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-tertiary italic">None.</p>
            ) : (
              <ul className="divide-y divide-border-soft text-sm">
                {guest.songRequests.map((s) => (
                  <li key={s.id} className="px-4 py-2 text-ink-primary">
                    ♪ {s.title}
                    {s.artist && (
                      <span className="text-ink-tertiary"> — {s.artist}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Other guests in the same household */}
          {siblings.length > 0 && (
            <section className="bg-surface border border-border-soft rounded-md shadow-sm">
              <header className="px-4 py-3 border-b border-border-soft">
                <h2 className="text-sm font-semibold text-ink-primary">
                  Others in {guest.household.name}
                </h2>
              </header>
              <ul className="divide-y divide-border-soft text-sm">
                {siblings.map((s) => (
                  <li key={s.id} className="px-4 py-2 flex items-center gap-2">
                    <Link
                      href={`/guests/${s.id}`}
                      className="text-ink-primary hover:text-moss-700 hover:underline flex-1"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    <StatusPill status={RSVP_PILL[s.rsvp] ?? "PENDING"} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Empty() {
  return <span className="text-ink-tertiary italic">—</span>;
}
