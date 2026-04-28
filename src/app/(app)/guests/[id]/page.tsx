import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { GuestDetailClient } from "./GuestDetailClient";
import { AddSongRequestInline } from "./AddSongRequestInline";
import { CustomFieldsBlock } from "./CustomFieldsBlock";
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
    },
  });
  if (!guest || guest.archived) notFound();

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
        <Link href="/seating" className="text-info hover:underline" title="Open seating canvas">
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
            </dl>
          </section>

          {/* Meal choices */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft">
              <h2 className="text-sm font-semibold text-ink-primary">Meal choices</h2>
            </header>
            {hasMeals ? (
              <dl className="divide-y divide-border-soft text-sm">
                {meals.map((m) => (
                  <div key={m.label} className="grid grid-cols-3 gap-3 px-4 py-2.5">
                    <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-center">
                      {m.label}
                    </dt>
                    <dd className="col-span-2 text-ink-primary">
                      {m.value ?? <Empty />}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-4 text-sm text-ink-tertiary italic">
                No meal choices recorded yet.
              </p>
            )}
          </section>

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
                  <Link href="/songs" className="text-[11px] text-info hover:underline">
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
