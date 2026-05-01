// v1.42.0: parallel resolver to src/lib/group-members.ts but for
// **wedding guests** rather than admin users. PermissionGroup
// bundles app users for permission / scheduling purposes;
// GuestGroup bundles guests for organisational purposes (ceremony
// seating colour-coding, RSVP follow-up cohorts, "after-party
// invitees" filters).
//
// Built-in virtual guest groups computed from Guest.side:
//   "bride-side" — Guest.side === "BRIDE"
//   "groom-side" — Guest.side === "GROOM"
//   "both-sides" — Guest.side === "BOTH"
//
// Custom DB-backed groups carry a `name`, `slug`, optional
// `description`, optional `colour` (hex string used by the seating
// canvas), and explicit `members: Guest[]`.
//
// Reference format mirrors PermissionGroup:
//   "builtin:<slug>"  — virtual side-based group
//   "group:<slug>"    — DB-backed GuestGroup by slug
//   "guest:<id>"      — individual guest (for completeness; rarely
//                       useful since guests don't have a "Mine"
//                       filter the way users do)

export type GuestShape = {
  id: string;
  firstName: string;
  lastName: string;
  side?: string | null;
  archived?: boolean;
};

export type GuestGroupShape = {
  id: string;
  slug: string;
  name: string;
  colour?: string | null;
  members: Array<{ id: string }>;
};

export const BUILTIN_GUEST_GROUPS = [
  { slug: "bride-side", name: "Bride's side" },
  { slug: "groom-side", name: "Groom's side" },
  { slug: "both-sides", name: "Both sides" },
] as const;

export type BuiltinGuestGroupSlug = (typeof BUILTIN_GUEST_GROUPS)[number]["slug"];

export const BUILTIN_GUEST_GROUP_SLUGS = new Set<string>(
  BUILTIN_GUEST_GROUPS.map((g) => g.slug),
);

export function guestDisplayName(g: GuestShape): string {
  return [g.firstName, g.lastName].filter(Boolean).join(" ").trim() || "(unnamed guest)";
}

export function resolveBuiltinGuestGroup(
  slug: BuiltinGuestGroupSlug | string,
  guests: GuestShape[],
): GuestShape[] {
  const active = guests.filter((g) => !g.archived);
  switch (slug) {
    case "bride-side":
      return active.filter((g) => g.side === "BRIDE");
    case "groom-side":
      return active.filter((g) => g.side === "GROOM");
    case "both-sides":
      return active.filter((g) => g.side === "BOTH");
    default:
      throw new Error(`Unknown built-in guest-group slug: ${slug}`);
  }
}

/**
 * Resolve a guest-group reference to the matching Guest[] subset.
 * Reference shapes:
 *   "builtin:<slug>"  — built-in side-based group
 *   "group:<slug>"    — DB-backed GuestGroup by slug
 *   "guest:<id>"      — single guest by id
 *
 * Unknown references return an empty array.
 */
export function resolveGuestGroupMembers(
  ref: string,
  guests: GuestShape[],
  customGroups: GuestGroupShape[],
): GuestShape[] {
  if (ref.startsWith("builtin:")) {
    const slug = ref.slice("builtin:".length);
    if (!BUILTIN_GUEST_GROUP_SLUGS.has(slug)) return [];
    return resolveBuiltinGuestGroup(slug, guests);
  }
  if (ref.startsWith("group:")) {
    const slug = ref.slice("group:".length);
    const group = customGroups.find((g) => g.slug === slug);
    if (!group) return [];
    const memberIds = new Set(group.members.map((m) => m.id));
    return guests.filter((g) => memberIds.has(g.id) && !g.archived);
  }
  if (ref.startsWith("guest:")) {
    const id = ref.slice("guest:".length);
    const g = guests.find((x) => x.id === id && !x.archived);
    return g ? [g] : [];
  }
  return [];
}

export function resolveGuestGroupMembersUnion(
  refs: string[],
  guests: GuestShape[],
  customGroups: GuestGroupShape[],
): GuestShape[] {
  const seen = new Set<string>();
  const out: GuestShape[] = [];
  for (const ref of refs) {
    for (const m of resolveGuestGroupMembers(ref, guests, customGroups)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

/**
 * For a given guest, list every group reference they belong to —
 * built-in (side-based) plus DB-backed. Used for "this guest is in:"
 * displays on the guest-detail page.
 */
export function guestGroupsForGuest(
  guestId: string,
  guests: GuestShape[],
  customGroups: GuestGroupShape[],
): string[] {
  const out: string[] = [];
  const g = guests.find((x) => x.id === guestId);
  if (!g) return out;
  for (const bg of BUILTIN_GUEST_GROUPS) {
    if (resolveBuiltinGuestGroup(bg.slug, [g]).length > 0) {
      out.push(`builtin:${bg.slug}`);
    }
  }
  for (const cg of customGroups) {
    if (cg.members.some((m) => m.id === guestId)) {
      out.push(`group:${cg.slug}`);
    }
  }
  return out;
}

/**
 * Validate a hex-colour string, returning the normalised form (lower
 * case, leading #) when valid and `null` when not. Accepts 3- and 6-
 * digit hex with or without leading #. Empty string maps to null —
 * the colour picker uses null to mean "no colour set".
 */
export function normaliseHexColour(input: string | null | undefined): string | null {
  if (!input) return null;
  const t = input.trim();
  if (!t) return null;
  const stripped = t.startsWith("#") ? t.slice(1) : t;
  // Accept 3 or 6 hex digits.
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(stripped)) return null;
  // Expand #abc → #aabbcc so storage is canonical.
  const expanded =
    stripped.length === 3
      ? stripped.split("").map((c) => c + c).join("")
      : stripped;
  return `#${expanded.toLowerCase()}`;
}
