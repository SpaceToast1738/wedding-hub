import { describe, expect, it } from "vitest";
import {
  dueDateSuggestionSchema,
  gapAnalysisSchema,
  guestExtractionSchema,
  weddingReviewSchema,
} from "@/lib/ai/output-schemas";

// v2.2.0: Anthropic structured outputs reject any schema whose object
// nodes lack `"additionalProperties": false` — the request 400s before
// the model runs (hit in production 2026-07-02). This walker guards
// every current and future object node in the strict-output schemas.

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  additionalProperties?: unknown;
  required?: unknown;
};

function collectObjectNodes(
  node: JsonSchemaNode,
  path: string,
  out: { path: string; node: JsonSchemaNode }[],
): void {
  if (node.type === "object") out.push({ path, node });
  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      collectObjectNodes(child, `${path}.properties.${key}`, out);
    }
  }
  if (node.items) collectObjectNodes(node.items, `${path}.items`, out);
}

const SCHEMAS: [string, JsonSchemaNode][] = [
  ["guestExtractionSchema", guestExtractionSchema as unknown as JsonSchemaNode],
  ["dueDateSuggestionSchema", dueDateSuggestionSchema as unknown as JsonSchemaNode],
  ["weddingReviewSchema", weddingReviewSchema as unknown as JsonSchemaNode],
  ["gapAnalysisSchema", gapAnalysisSchema as unknown as JsonSchemaNode],
];

describe("ai output schemas — Anthropic strict-output invariants", () => {
  for (const [name, schema] of SCHEMAS) {
    describe(name, () => {
      const objectNodes: { path: string; node: JsonSchemaNode }[] = [];
      collectObjectNodes(schema, name, objectNodes);

      it("has at least one object node (walker sanity)", () => {
        expect(objectNodes.length).toBeGreaterThan(0);
      });

      it("sets additionalProperties: false on every object node", () => {
        for (const { path, node } of objectNodes) {
          expect(node.additionalProperties, `${path} must set additionalProperties: false`).toBe(false);
        }
      });

      it("has a required array on every object node", () => {
        for (const { path, node } of objectNodes) {
          expect(Array.isArray(node.required), `${path} must have a required array`).toBe(true);
        }
      });
    });
  }
});
