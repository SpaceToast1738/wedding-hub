// v1.61.1: unit tests for parseTopicKeys.
//
// The function is the single point where the picker's polymorphic
// `topicKeys` payload turns into four typed ID arrays. Tests cover:
//   - each prefix recognised individually (4 happy paths)
//   - mixed payloads with multiple sources
//   - the `__touched__` sentinel (v1.61.1) being silently dropped
//   - unknown prefixes / stray noise being silently dropped
//   - hasTopicKeys true vs. false (the empty-vs-absent distinction
//     that drives whether the server applies the m2m `set:` ops)
//
// This module exists because actions.ts is a server-only file and
// `"use server"` makes everything in it a server action — exporting
// a non-action helper for testing is rejected. v1.61.1 lifted the
// parser into @/lib/task-topics for testability.

import { describe, expect, it } from "vitest";
import {
  parseTopicKeys,
  TOPIC_TOUCHED_SENTINEL,
} from "@/lib/task-topics";

function fd(entries: Array<[string, string]>): FormData {
  const out = new FormData();
  for (const [k, v] of entries) out.append(k, v);
  return out;
}

describe("parseTopicKeys", () => {
  it("returns hasTopicKeys=false when no topicKeys field present", () => {
    const out = parseTopicKeys(fd([["title", "buy stuff"]]));
    expect(out.hasTopicKeys).toBe(false);
    expect(out.bookSectionIds).toEqual([]);
    expect(out.bookSubsectionIds).toEqual([]);
    expect(out.navTagIds).toEqual([]);
    expect(out.guestGroupIds).toEqual([]);
  });

  it("returns hasTopicKeys=true when only the touched sentinel is present", () => {
    // The bug v1.61.1 closes: clearing every chip used to look
    // identical to a partial update. Now the sentinel marks
    // "explicit empty selection" so the server applies a `set: []`
    // and clears the relation.
    const out = parseTopicKeys(fd([["topicKeys", TOPIC_TOUCHED_SENTINEL]]));
    expect(out.hasTopicKeys).toBe(true);
    expect(out.bookSectionIds).toEqual([]);
    expect(out.bookSubsectionIds).toEqual([]);
    expect(out.navTagIds).toEqual([]);
    expect(out.guestGroupIds).toEqual([]);
  });

  it("parses bookSection prefix", () => {
    const out = parseTopicKeys(fd([
      ["topicKeys", "bookSection:abc"],
      ["topicKeys", "bookSection:def"],
    ]));
    expect(out.bookSectionIds).toEqual(["abc", "def"]);
    expect(out.hasTopicKeys).toBe(true);
  });

  it("parses bookSubsection prefix", () => {
    const out = parseTopicKeys(fd([
      ["topicKeys", "bookSubsection:card-1"],
    ]));
    expect(out.bookSubsectionIds).toEqual(["card-1"]);
    expect(out.bookSectionIds).toEqual([]);
  });

  it("parses navTag prefix", () => {
    const out = parseTopicKeys(fd([
      ["topicKeys", "navTag:budget"],
      ["topicKeys", "navTag:guests"],
    ]));
    expect(out.navTagIds).toEqual(["budget", "guests"]);
  });

  it("parses guestGroup prefix (v1.61.0 XL1)", () => {
    const out = parseTopicKeys(fd([
      ["topicKeys", "guestGroup:brides-parents"],
      ["topicKeys", "guestGroup:after-party"],
    ]));
    expect(out.guestGroupIds).toEqual(["brides-parents", "after-party"]);
  });

  it("splits a mixed payload across all four arrays", () => {
    const out = parseTopicKeys(fd([
      ["topicKeys", TOPIC_TOUCHED_SENTINEL],
      ["topicKeys", "bookSection:venue"],
      ["topicKeys", "bookSubsection:ceremony-room"],
      ["topicKeys", "navTag:budget"],
      ["topicKeys", "guestGroup:wedding-party"],
    ]));
    expect(out).toEqual({
      bookSectionIds: ["venue"],
      bookSubsectionIds: ["ceremony-room"],
      navTagIds: ["budget"],
      guestGroupIds: ["wedding-party"],
      hasTopicKeys: true,
    });
  });

  it("silently drops unknown prefixes and stray noise", () => {
    // Forward-compat: a future picker source using an unknown
    // prefix won't crash the parser, just gets ignored.
    const out = parseTopicKeys(fd([
      ["topicKeys", "unknownPrefix:xyz"],
      ["topicKeys", "no-prefix-at-all"],
      ["topicKeys", ""],
      ["topicKeys", "bookSection:keeps-this"],
    ]));
    expect(out.bookSectionIds).toEqual(["keeps-this"]);
    expect(out.bookSubsectionIds).toEqual([]);
    expect(out.navTagIds).toEqual([]);
    expect(out.guestGroupIds).toEqual([]);
    expect(out.hasTopicKeys).toBe(true);
  });

  it("preserves duplicate IDs (caller dedupes if needed)", () => {
    // The picker shouldn't emit duplicates, but the parser is the
    // wrong layer to enforce uniqueness — Prisma's `set:` ops
    // handle duplicates idempotently.
    const out = parseTopicKeys(fd([
      ["topicKeys", "navTag:budget"],
      ["topicKeys", "navTag:budget"],
    ]));
    expect(out.navTagIds).toEqual(["budget", "budget"]);
  });

  it("handles a colon inside the value (treats first `:` as the separator)", () => {
    // Cuid-shaped IDs don't contain colons, but defensive: ID slugs
    // someday could. `slice(prefix.length)` keeps everything after
    // the first `:` so a value like "navTag:foo:bar" yields "foo:bar".
    const out = parseTopicKeys(fd([
      ["topicKeys", "navTag:weird:id"],
    ]));
    expect(out.navTagIds).toEqual(["weird:id"]);
  });
});
