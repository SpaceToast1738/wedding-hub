// v1.40.0 (backlog #3): pure helpers for resolving "group → user
// list" — both DB-backed PermissionGroup rows and four built-in
// virtual groups computed from User.role / User.isCouple. The
// Schedule attendees picker (backlog #4) and any future "send email
// to group" surface use these.
//
// v1.42.0: UserGroup → PermissionGroup rename. The shape, helpers,
// and ref format ("builtin:<slug>" / "group:<slug>" / "user:<id>")
// stay identical. See src/lib/guest-group-members.ts for the
// parallel resolver that bundles wedding *guests* (a different
// cohort entirely).
//
// Built-in virtual groups always exist regardless of DB state:
//   "everyone"           — all non-archived users
//   "couple"             — User.isCouple === true
//   "wedding-party-role" — User.role === "WEDDING_PARTY"
//   "planners-role"      — User.role === "PLANNER"
//
// Custom groups are surfaced by their `slug` from the UserGroup
// table. A group reference is a single string with the form:
//   - "builtin:everyone" / "builtin:couple" / etc.
//   - "group:<slug>" for a DB-backed UserGroup
//
// Pure: helpers take plain inputs (User-like + UserGroup-like
// shapes) so unit tests don't need a Prisma fixture.

export type UserShape = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role?: string | null;
  isCouple?: boolean;
};

export type PermissionGroupShape = {
  id: string;
  slug: string;
  name: string;
  members: Array<{ id: string }>;
};

// Stable identifiers for the built-in virtual groups. Used as the
// `slug` half of the "builtin:<slug>" group reference. Picker UIs
// use these as the dropdown's first options.
export const BUILTIN_GROUPS = [
  { slug: "everyone", name: "Everyone" },
  { slug: "couple", name: "Couple" },
  { slug: "wedding-party-role", name: "Wedding party (by role)" },
  { slug: "planners-role", name: "Planners (by role)" },
] as const;

export type BuiltinGroupSlug = (typeof BUILTIN_GROUPS)[number]["slug"];

export const BUILTIN_GROUP_SLUGS = new Set<string>(
  BUILTIN_GROUPS.map((g) => g.slug),
);

/**
 * Pretty-print a User row's display name. Prefers firstName + lastName,
 * falls back to `name`, then to `email`.
 */
export function displayName(u: UserShape): string {
  const composed = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  if (u.name && u.name.trim()) return u.name.trim();
  return u.email;
}

/**
 * Resolve a built-in group slug to the matching User[] subset.
 * Throws on an unknown built-in slug — callers should use
 * BUILTIN_GROUP_SLUGS to validate ahead of calling.
 */
export function resolveBuiltinGroup(
  slug: BuiltinGroupSlug | string,
  users: UserShape[],
): UserShape[] {
  switch (slug) {
    case "everyone":
      return [...users];
    case "couple":
      return users.filter((u) => u.isCouple === true);
    case "wedding-party-role":
      return users.filter((u) => u.role === "WEDDING_PARTY");
    case "planners-role":
      return users.filter((u) => u.role === "PLANNER");
    default:
      throw new Error(`Unknown built-in group slug: ${slug}`);
  }
}

/**
 * Resolve any group reference to the matching User[] subset.
 * Reference shapes:
 *   "builtin:<slug>"  — virtual group (everyone / couple / etc.)
 *   "group:<slug>"    — DB-backed UserGroup
 *   "user:<id>"       — individual user (v1.41.0 attendee refs)
 *
 * Unknown references return an empty array — callers that care about
 * the distinction should pre-validate.
 */
export function resolveGroupMembers(
  ref: string,
  users: UserShape[],
  customGroups: PermissionGroupShape[],
): UserShape[] {
  if (ref.startsWith("builtin:")) {
    const slug = ref.slice("builtin:".length);
    if (!BUILTIN_GROUP_SLUGS.has(slug)) return [];
    return resolveBuiltinGroup(slug, users);
  }
  if (ref.startsWith("group:")) {
    const slug = ref.slice("group:".length);
    const group = customGroups.find((g) => g.slug === slug);
    if (!group) return [];
    const memberIds = new Set(group.members.map((m) => m.id));
    return users.filter((u) => memberIds.has(u.id));
  }
  if (ref.startsWith("user:")) {
    const id = ref.slice("user:".length);
    const u = users.find((x) => x.id === id);
    return u ? [u] : [];
  }
  return [];
}

/**
 * Resolve multiple group references and produce the deduplicated
 * union of member ids. Stable order: groups iterate in input order;
 * within a group, users keep their input order.
 */
export function resolveGroupMembersUnion(
  refs: string[],
  users: UserShape[],
  customGroups: PermissionGroupShape[],
): UserShape[] {
  const seen = new Set<string>();
  const out: UserShape[] = [];
  for (const ref of refs) {
    const members = resolveGroupMembers(ref, users, customGroups);
    for (const m of members) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

/**
 * v1.41.0 (backlog #4): legacy-aware attendee resolver. Schedule
 * events store `attendeeRefs: String[]` of group references; older
 * rows fall back to `attendeeIds: String[]` (raw User.id) — those
 * are expanded to `user:<id>` refs on read so the rest of the app
 * sees a single uniform shape.
 *
 * Returns the deduplicated User[] union for an event's attendee
 * refs, expanding all three reference kinds. Empty input returns
 * an empty list.
 */
export function resolveAttendeeRefs(
  event: { attendeeRefs?: string[] | null; attendeeIds?: string[] | null },
  users: UserShape[],
  customGroups: PermissionGroupShape[],
): UserShape[] {
  const refs =
    event.attendeeRefs && event.attendeeRefs.length > 0
      ? event.attendeeRefs
      : (event.attendeeIds ?? []).map((id) => `user:${id}`);
  return resolveGroupMembersUnion(refs, users, customGroups);
}

/**
 * v1.41.0: thin helper for the most common Today-page check —
 * "is this user an attendee of this event?". Same legacy fallback
 * as resolveAttendeeRefs. Cheap because we only iterate refs until
 * we find a match.
 */
export function isAttendee(
  event: { attendeeRefs?: string[] | null; attendeeIds?: string[] | null },
  userId: string,
  users: UserShape[],
  customGroups: PermissionGroupShape[],
): boolean {
  const refs =
    event.attendeeRefs && event.attendeeRefs.length > 0
      ? event.attendeeRefs
      : (event.attendeeIds ?? []).map((id) => `user:${id}`);
  for (const ref of refs) {
    if (ref === `user:${userId}`) return true;
    const members = resolveGroupMembers(ref, users, customGroups);
    if (members.some((u) => u.id === userId)) return true;
  }
  return false;
}

/**
 * For a given user, list every group reference they belong to —
 * built-in plus DB-backed. Useful for "show user's groups" UIs.
 */
export function groupsForUser(
  userId: string,
  users: UserShape[],
  customGroups: PermissionGroupShape[],
): string[] {
  const out: string[] = [];
  const u = users.find((x) => x.id === userId);
  if (!u) return out;
  // Built-ins, in the order they're declared in BUILTIN_GROUPS so
  // pickers display them consistently.
  for (const g of BUILTIN_GROUPS) {
    if (resolveBuiltinGroup(g.slug, [u]).length > 0) {
      out.push(`builtin:${g.slug}`);
    }
  }
  for (const cg of customGroups) {
    if (cg.members.some((m) => m.id === userId)) {
      out.push(`group:${cg.slug}`);
    }
  }
  return out;
}
