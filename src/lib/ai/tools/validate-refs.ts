// v2.2.0: batched ID validation + name resolution for propose_* tools.
//
// Every propose tool that accepts entity references calls resolveRefs
// BEFORE writing the proposal: (a) so a hallucinated id never lands in
// an AiProposal payload, and (b) so the tool result / review UI can
// show human names ("→ Sarah · Flowers") without a second round of
// queries. Invalid refs come back with the same prefix vocabulary the
// app already uses (parseTopicKeys + attendeeRefs): user:, navTag:,
// bookSection:, guestGroup:, supplier:.
//
// v2.4.0: nine new families for the full-surface release — guests,
// households, book cards (subsections), budget categories/lines,
// payments, playlists, tasks, events. Same batched Promise.all shape;
// families you don't request cost nothing.

import { db } from "@/lib/db";
import { displayName } from "@/lib/group-members";

export type RefRequest = {
  userIds?: string[];
  navTagIds?: string[];
  bookSectionIds?: string[];
  guestGroupIds?: string[];
  supplierIds?: string[];
  guestIds?: string[];
  householdIds?: string[];
  /** BookSubsection (card) ids. */
  subsectionIds?: string[];
  budgetCategoryIds?: string[];
  budgetLineIds?: string[];
  paymentIds?: string[];
  playlistIds?: string[];
  taskIds?: string[];
  eventIds?: string[];
};

export type RefNames = {
  users: Map<string, string>;
  navTags: Map<string, string>;
  bookSections: Map<string, string>;
  guestGroups: Map<string, string>;
  suppliers: Map<string, string>;
  guests: Map<string, string>;
  households: Map<string, string>;
  subsections: Map<string, string>;
  budgetCategories: Map<string, string>;
  budgetLines: Map<string, string>;
  payments: Map<string, string>;
  playlists: Map<string, string>;
  tasks: Map<string, string>;
  events: Map<string, string>;
};

function dedupe(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter(Boolean))];
}

/** Batch-load every referenced row. Returns the prefixed invalid refs
 *  plus id→display-name maps for everything that resolved. */
export async function resolveRefs(
  req: RefRequest,
): Promise<{ invalid: string[]; names: RefNames }> {
  const userIds = dedupe(req.userIds);
  const navTagIds = dedupe(req.navTagIds);
  const bookSectionIds = dedupe(req.bookSectionIds);
  const guestGroupIds = dedupe(req.guestGroupIds);
  const supplierIds = dedupe(req.supplierIds);
  const guestIds = dedupe(req.guestIds);
  const householdIds = dedupe(req.householdIds);
  const subsectionIds = dedupe(req.subsectionIds);
  const budgetCategoryIds = dedupe(req.budgetCategoryIds);
  const budgetLineIds = dedupe(req.budgetLineIds);
  const paymentIds = dedupe(req.paymentIds);
  const playlistIds = dedupe(req.playlistIds);
  const taskIds = dedupe(req.taskIds);
  const eventIds = dedupe(req.eventIds);

  const [
    users,
    navTags,
    bookSections,
    guestGroups,
    suppliers,
    guests,
    households,
    subsections,
    budgetCategories,
    budgetLines,
    payments,
    playlists,
    tasks,
    events,
  ] = await Promise.all([
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, name: true, email: true },
        })
      : Promise.resolve([]),
    navTagIds.length
      ? db.navTag.findMany({
          where: { id: { in: navTagIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    bookSectionIds.length
      ? db.bookSection.findMany({
          where: { id: { in: bookSectionIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    guestGroupIds.length
      ? db.guestGroup.findMany({
          where: { id: { in: guestGroupIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    supplierIds.length
      ? db.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    guestIds.length
      ? db.guest.findMany({
          where: { id: { in: guestIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    householdIds.length
      ? db.household.findMany({
          where: { id: { in: householdIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    subsectionIds.length
      ? db.bookSubsection.findMany({
          where: { id: { in: subsectionIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    budgetCategoryIds.length
      ? db.budgetCategory.findMany({
          where: { id: { in: budgetCategoryIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    budgetLineIds.length
      ? db.budgetLine.findMany({
          where: { id: { in: budgetLineIds } },
          select: { id: true, description: true },
        })
      : Promise.resolve([]),
    paymentIds.length
      ? db.payment.findMany({
          where: { id: { in: paymentIds } },
          select: { id: true, description: true },
        })
      : Promise.resolve([]),
    playlistIds.length
      ? db.playlist.findMany({
          where: { id: { in: playlistIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    taskIds.length
      ? db.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    eventIds.length
      ? db.scheduleEvent.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const names: RefNames = {
    users: new Map(users.map((u) => [u.id, displayName(u)])),
    navTags: new Map(navTags.map((t) => [t.id, t.name])),
    bookSections: new Map(bookSections.map((s) => [s.id, s.title])),
    guestGroups: new Map(guestGroups.map((g) => [g.id, g.name])),
    suppliers: new Map(suppliers.map((s) => [s.id, s.name])),
    guests: new Map(
      guests.map((g) => [g.id, `${g.firstName} ${g.lastName}`.trim()]),
    ),
    households: new Map(households.map((h) => [h.id, h.name])),
    subsections: new Map(subsections.map((s) => [s.id, s.title])),
    budgetCategories: new Map(budgetCategories.map((c) => [c.id, c.name])),
    budgetLines: new Map(budgetLines.map((l) => [l.id, l.description])),
    payments: new Map(payments.map((p) => [p.id, p.description])),
    playlists: new Map(playlists.map((p) => [p.id, p.name])),
    tasks: new Map(tasks.map((t) => [t.id, t.title])),
    events: new Map(events.map((e) => [e.id, e.title])),
  };

  const invalid: string[] = [
    ...userIds.filter((id) => !names.users.has(id)).map((id) => `user:${id}`),
    ...navTagIds.filter((id) => !names.navTags.has(id)).map((id) => `navTag:${id}`),
    ...bookSectionIds
      .filter((id) => !names.bookSections.has(id))
      .map((id) => `bookSection:${id}`),
    ...guestGroupIds
      .filter((id) => !names.guestGroups.has(id))
      .map((id) => `guestGroup:${id}`),
    ...supplierIds
      .filter((id) => !names.suppliers.has(id))
      .map((id) => `supplier:${id}`),
    ...guestIds.filter((id) => !names.guests.has(id)).map((id) => `guest:${id}`),
    ...householdIds
      .filter((id) => !names.households.has(id))
      .map((id) => `household:${id}`),
    ...subsectionIds
      .filter((id) => !names.subsections.has(id))
      .map((id) => `bookSubsection:${id}`),
    ...budgetCategoryIds
      .filter((id) => !names.budgetCategories.has(id))
      .map((id) => `budgetCategory:${id}`),
    ...budgetLineIds
      .filter((id) => !names.budgetLines.has(id))
      .map((id) => `budgetLine:${id}`),
    ...paymentIds
      .filter((id) => !names.payments.has(id))
      .map((id) => `payment:${id}`),
    ...playlistIds
      .filter((id) => !names.playlists.has(id))
      .map((id) => `playlist:${id}`),
    ...taskIds.filter((id) => !names.tasks.has(id)).map((id) => `task:${id}`),
    ...eventIds.filter((id) => !names.events.has(id)).map((id) => `event:${id}`),
  ];

  return { invalid, names };
}

export function unknownIdsError(invalid: string[]): string {
  return `Unknown ids: ${invalid.join(", ")}. Use ids from the reference directory (in your system prompt) or a read tool — never invent ids.`;
}

/** Build the one-line human detail string shown on proposal cards,
 *  e.g. "→ Sarah, Jamie · Flowers, Venue & Ceremony · supplier: Bloom & Co". */
export function buildDetailLine(parts: {
  assignees?: string[];
  topics?: string[];
  supplier?: string | null;
  attendees?: string[];
}): string | undefined {
  const segments: string[] = [];
  if (parts.assignees?.length) segments.push(`→ ${parts.assignees.join(", ")}`);
  if (parts.topics?.length) segments.push(parts.topics.join(", "));
  if (parts.supplier) segments.push(`supplier: ${parts.supplier}`);
  if (parts.attendees?.length) segments.push(`attendees: ${parts.attendees.join(", ")}`);
  return segments.length ? segments.join(" · ") : undefined;
}
