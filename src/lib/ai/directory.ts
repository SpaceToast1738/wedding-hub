// v2.2.0: reference directory for the AI planner.
//
// A compact, ID-bearing listing of the entities the AI needs to
// reference in propose_* calls: users (assignees / attendees), nav
// tags, book sections, guest groups, and (v2.4.0) custom field defs.
// Rendered into the VOLATILE (uncached) block of the system prompt on
// every turn, so it's always fresh and never invalidates the cached
// preamble.
//
// Suppliers are deliberately NOT here — the supplier list is the only
// unbounded one (30–50 rows on a real wedding), so it lives behind
// the filterable read_suppliers tool instead of costing every turn.
//
// Size budget: ~550–870 tokens on this app's data. If any list grows
// past that (say 30+ guest groups), consider a cap + "use read_* for
// the rest" note.

import { db } from "@/lib/db";
import { BUILTIN_GROUPS, displayName } from "@/lib/group-members";

export type ReferenceDirectory = {
  users: { id: string; name: string; role: string; isCouple: boolean }[];
  navTags: { id: string; name: string }[];
  bookSections: { id: string; title: string; slug: string }[];
  guestGroups: { id: string; name: string; memberCount: number }[];
  // v2.4.0: custom field defs across all entities — a handful of rows
  // at most, and propose_custom_field_set needs the fieldId + type +
  // select options up front (there's no read tool for defs).
  customFields: {
    id: string;
    entity: string;
    name: string;
    type: string;
    options: string[];
  }[];
};

export async function buildReferenceDirectory(opts: {
  /** COUPLE_ONLY book sections are invisible to non-couple users
   *  everywhere else in the app — same rule here, or the directory
   *  would leak their titles into a wedding-party member's prompt. */
  isCouple: boolean;
}): Promise<ReferenceDirectory> {
  const [users, navTags, bookSections, guestGroups, customFields] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        isCouple: true,
      },
    }),
    db.navTag.findMany({
      // Secondary key breaks order=0 ties so the rendered block stays
      // byte-stable between turns (order defaults to 0 on both models).
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.bookSection.findMany({
      where: opts.isCouple ? undefined : { visibility: "EVERYONE" },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: { id: true, title: true, slug: true },
    }),
    db.guestGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    }),
    // entity → order → name keeps the render byte-stable when two
    // fields share an order value (the @@unique is [entity, name],
    // not [entity, order]).
    db.customField.findMany({
      orderBy: [{ entity: "asc" }, { order: "asc" }, { name: "asc" }],
      select: { id: true, entity: true, name: true, type: true, options: true },
    }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: displayName(u),
      role: u.role,
      isCouple: u.isCouple,
    })),
    navTags,
    bookSections,
    guestGroups: guestGroups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g._count.members,
    })),
    customFields,
  };
}

/** Deterministic plain-text render for the system prompt. One line
 *  per row; key order stable so identical data → identical bytes. */
export function renderReferenceDirectory(dir: ReferenceDirectory): string {
  const lines: string[] = [
    "## Reference directory",
    "",
    "REAL ids — copy them exactly into propose_* tool calls; never invent ids.",
    "",
    "Users (task assignees / event attendees):",
    ...dir.users.map(
      (u) =>
        `- id=${u.id} ${u.name} (${u.role}${u.isCouple ? ", couple" : ""})`,
    ),
    "",
    "Nav tags (task topics):",
    ...(dir.navTags.length
      ? dir.navTags.map((t) => `- id=${t.id} ${t.name}`)
      : ["- (none)"]),
    "",
    "Wedding book sections (task topics):",
    ...(dir.bookSections.length
      ? dir.bookSections.map((s) => `- id=${s.id} ${s.title} (slug ${s.slug})`)
      : ["- (none)"]),
    "",
    "Guest groups (task topics):",
    ...(dir.guestGroups.length
      ? dir.guestGroups.map(
          (g) => `- id=${g.id} ${g.name} (${g.memberCount} members)`,
        )
      : ["- (none)"]),
    "",
    "Custom fields (for propose_custom_field_set):",
    ...(dir.customFields.length
      ? dir.customFields.map(
          (f) =>
            `- id=${f.id} [${f.entity}] ${f.name} (${f.type}${f.options.length ? `: ${f.options.join(" | ")}` : ""})`,
        )
      : ["- (none)"]),
    "",
    `Builtin attendee groups for events (use as attendeeRefs): ${BUILTIN_GROUPS.map((g) => `builtin:${g.slug}`).join(", ")}`,
  ];
  return lines.join("\n");
}
