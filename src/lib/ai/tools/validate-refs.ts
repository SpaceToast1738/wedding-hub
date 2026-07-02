// v2.2.0: batched ID validation + name resolution for propose_* tools.
//
// Every propose tool that accepts entity references calls resolveRefs
// BEFORE writing the proposal: (a) so a hallucinated id never lands in
// an AiProposal payload, and (b) so the tool result / review UI can
// show human names ("→ Sarah · Flowers") without a second round of
// queries. Invalid refs come back with the same prefix vocabulary the
// app already uses (parseTopicKeys + attendeeRefs): user:, navTag:,
// bookSection:, guestGroup:, supplier:.

import { db } from "@/lib/db";
import { displayName } from "@/lib/group-members";

export type RefRequest = {
  userIds?: string[];
  navTagIds?: string[];
  bookSectionIds?: string[];
  guestGroupIds?: string[];
  supplierIds?: string[];
};

export type RefNames = {
  users: Map<string, string>;
  navTags: Map<string, string>;
  bookSections: Map<string, string>;
  guestGroups: Map<string, string>;
  suppliers: Map<string, string>;
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

  const [users, navTags, bookSections, guestGroups, suppliers] =
    await Promise.all([
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
    ]);

  const names: RefNames = {
    users: new Map(users.map((u) => [u.id, displayName(u)])),
    navTags: new Map(navTags.map((t) => [t.id, t.name])),
    bookSections: new Map(bookSections.map((s) => [s.id, s.title])),
    guestGroups: new Map(guestGroups.map((g) => [g.id, g.name])),
    suppliers: new Map(suppliers.map((s) => [s.id, s.name])),
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
