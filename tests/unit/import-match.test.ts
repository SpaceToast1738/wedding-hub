// v2.15.0: CSV import row → existing guest matching. The cases mirror
// the 5 Aug 2026 incident: renamed parties and placeholder plus-ones
// must still merge; genuinely ambiguous names must NOT silently pick one.

import { describe, expect, it } from "vitest";
import {
  buildGuestIndex,
  findCollision,
  indexGuest,
  resolveImportMatch,
  type ImportRowKey,
  type IndexedGuest,
} from "@/lib/import-match";

const G = (
  id: string,
  first: string,
  last: string,
  household: string,
  extra: Partial<IndexedGuest> = {},
): IndexedGuest => ({
  id,
  firstName: first,
  lastName: last,
  householdName: household,
  email: null,
  rsvpUniqueLink: null,
  ...extra,
});

const ROW = (over: Partial<ImportRowKey>): ImportRowKey => ({
  firstName: "",
  lastName: "",
  email: null,
  rsvpLink: null,
  householdName: null,
  ...over,
});

const LINK = "https://sayido.example/rsvp/abc123";

const GUESTS = [
  G("luke", "Luke", "Maple", "Luke Maple and Guest", { email: "luke@example.com", rsvpUniqueLink: LINK }),
  G("hannah", "Hannah", "Salyer", "Luke Maple and Guest", { rsvpUniqueLink: LINK }),
  G("keith", "Keith", "Spencer", "The Spencers", { email: "keith@example.com" }),
  G("sam1", "Sam", "Smith", "Smiths (bride)", { email: "sam.a@example.com" }),
  G("sam2", "Sam", "Smith", "Smiths (groom)"),
];
const idx = buildGuestIndex(GUESTS);

describe("resolveImportMatch — rule order", () => {
  it("1. exact household + name still wins", () => {
    const m = resolveImportMatch(
      ROW({ firstName: "keith", lastName: "SPENCER", householdName: "the spencers" }),
      idx,
    );
    expect(m).toMatchObject({ rule: "household+name", guest: { id: "keith" } });
  });

  it("2. a renamed party matches through the shared RSVP link + name", () => {
    const m = resolveImportMatch(
      ROW({ firstName: "Luke", lastName: "Maple", householdName: "Maple Party", rsvpLink: LINK }),
      idx,
    );
    expect(m).toMatchObject({ rule: "rsvpLink+name", guest: { id: "luke" } });
  });

  it("2b. the link identifies the PARTY; the name picks the person in it", () => {
    const m = resolveImportMatch(ROW({ firstName: "Hannah", lastName: "Salyer", rsvpLink: LINK }), idx);
    expect(m).toMatchObject({ rule: "rsvpLink+name", guest: { id: "hannah" } });
  });

  it("2c. a link alone with an unknown name does not match (placeholder plus-one with a new real name)", () => {
    // Josh Conn was sitting in the hub as "John Doe(KAT)". A link+name
    // miss must fall through, not attach Josh's row to the wrong person.
    const m = resolveImportMatch(ROW({ firstName: "Josh", lastName: "Conn", rsvpLink: LINK }), idx);
    expect(m).toBeNull();
  });

  it("3. email matches when exactly one guest holds it, case-insensitively", () => {
    const m = resolveImportMatch(
      ROW({ firstName: "Lucas", lastName: "Maple", email: "LUKE@example.com", householdName: "Somewhere else" }),
      idx,
    );
    expect(m).toMatchObject({ rule: "email", guest: { id: "luke" } });
  });

  it("4. a unique name matches across households", () => {
    const m = resolveImportMatch(ROW({ firstName: "Keith", lastName: "Spencer", householdName: "Spencer family" }), idx);
    expect(m).toMatchObject({ rule: "name", guest: { id: "keith" } });
  });

  it("4b. an ambiguous name (two Sam Smiths) never silently picks one", () => {
    expect(resolveImportMatch(ROW({ firstName: "Sam", lastName: "Smith" }), idx)).toBeNull();
  });

  it("returns null for an empty name", () => {
    expect(resolveImportMatch(ROW({ email: "luke@example.com" }), idx)).toBeNull();
  });
});

describe("findCollision — loud duplicates", () => {
  it("flags an unmatched row whose email belongs to an existing guest", () => {
    const c = findCollision(ROW({ firstName: "Lu", lastName: "M", email: "keith@example.com" }), idx);
    expect(c).toMatchObject({ via: "email", guest: { id: "keith" } });
  });

  it("flags an ambiguous name with every candidate", () => {
    const c = findCollision(ROW({ firstName: "sam", lastName: "smith" }), idx);
    expect(c?.via).toBe("name");
    if (c?.via !== "name") return;
    expect(c.guests.map((g) => g.id).sort()).toEqual(["sam1", "sam2"]);
  });

  it("is null for a genuinely new person", () => {
    expect(findCollision(ROW({ firstName: "Josh", lastName: "Conn" }), idx)).toBeNull();
  });
});

describe("indexGuest — a row created mid-import is matchable by later rows", () => {
  it("lets a second row for the same new person merge instead of duplicating", () => {
    const live = buildGuestIndex(GUESTS);
    expect(resolveImportMatch(ROW({ firstName: "Josh", lastName: "Conn", rsvpLink: LINK }), live)).toBeNull();
    indexGuest(live, G("josh", "Josh", "Conn", "Luke Maple and Guest", { rsvpUniqueLink: LINK }));
    expect(resolveImportMatch(ROW({ firstName: "Josh", lastName: "Conn", rsvpLink: LINK }), live)).toMatchObject({
      rule: "rsvpLink+name",
      guest: { id: "josh" },
    });
  });
});
