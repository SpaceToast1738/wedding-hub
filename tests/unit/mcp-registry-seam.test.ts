// v2.7.0: the registry→MCP mapping seam.
//
// The MCP route maps `toolDefinitions({canWrite})` into MCP tool
// listings and pre-checks `hasTool` before dispatch. protocol.ts is
// tested with injected fakes, so this file is the one place that
// pins the REAL registry's shape to what that mapping assumes:
// non-empty names/descriptions, object input_schema, propose tools
// hidden from read-only listings, and hasTool agreeing with the list.
//
// Importing the registry drags in the tool modules (and their db/
// permissions imports) — mock db and React's cache() the same way
// tests/unit/permissions.test.ts does so no real Prisma client is
// constructed.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

import { hasTool, isProposeTool, toolDefinitions } from "@/lib/ai/tools/registry";

describe("registry → MCP mapping seam", () => {
  it("every definition has the fields the MCP listing maps", () => {
    const defs = toolDefinitions({ canWrite: true });
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) {
      expect(d.name, "tool name").toBeTruthy();
      expect(d.description, `description of ${d.name}`).toBeTruthy();
      expect(d.input_schema, `input_schema of ${d.name}`).toBeTypeOf("object");
      expect(d.input_schema.type, `input_schema.type of ${d.name}`).toBe("object");
    }
  });

  it("read-only listings contain no propose tools", () => {
    const readOnly = toolDefinitions({ canWrite: false });
    expect(readOnly.length).toBeGreaterThan(0);
    for (const d of readOnly) {
      expect(isProposeTool(d.name), `${d.name} leaked into read-only list`).toBe(false);
    }
    // And the full list is strictly larger (propose tools exist).
    expect(toolDefinitions({ canWrite: true }).length).toBeGreaterThan(readOnly.length);
  });

  it("hasTool agrees with the full listing and rejects junk", () => {
    for (const d of toolDefinitions({ canWrite: true })) {
      expect(hasTool(d.name), d.name).toBe(true);
    }
    // apply_proposals is dispatchable (hasTool true) even though it is
    // only LISTED for canApply tokens — the handler self-gates, so
    // dispatch must reach it to return the clean refusal.
    expect(hasTool("apply_proposals")).toBe(true);
    expect(hasTool("dismiss_proposals")).toBe(true);
    expect(hasTool("not_a_real_tool")).toBe(false);
    expect(hasTool("")).toBe(false);
  });

  // v2.8.0: the MCP self-apply pair must never leak into a listing that
  // isn't a canApply token — chat and propose-only MCP tokens included.
  it("apply/dismiss tools appear ONLY in the canApply listing", () => {
    const APPLY = ["apply_proposals", "dismiss_proposals"];
    const names = (opts: { canWrite?: boolean; canApply?: boolean }) =>
      new Set(toolDefinitions(opts).map((d) => d.name));

    const readOnly = names({ canWrite: false });
    const propose = names({ canWrite: true });
    const full = names({ canWrite: true, canApply: true });

    for (const n of APPLY) {
      expect(readOnly.has(n), `${n} leaked into read-only`).toBe(false);
      expect(propose.has(n), `${n} leaked into propose-only`).toBe(false);
      expect(full.has(n), `${n} missing from canApply listing`).toBe(true);
    }
    // canApply is a strict superset (adds exactly the apply pair).
    expect(full.size).toBe(propose.size + APPLY.length);
    // canApply without canWrite must NOT unlock apply tools.
    expect(names({ canWrite: false, canApply: true }).has("apply_proposals")).toBe(false);
  });
});
