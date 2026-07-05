// v2.2.0: strict-output JSON schemas for the AI one-shot actions.
//
// Anthropic structured outputs (`output_config.format`, type
// "json_schema") require EVERY object node to carry
// `"additionalProperties": false` — a schema without it is rejected
// with a 400 before the model runs. That exact 400 hit production on
// 2026-07-02 ("For 'object' type, 'additionalProperties' must be
// explicitly set to false"), which is why these live here now:
//
//   1. In a plain module (not the "use server" actions file) so the
//      regression test in tests/unit/ai-output-schemas.test.ts can
//      import them and walk every node.
//   2. With `additionalProperties: false` on every object — root
//      AND array-item objects.
//
// `required` does NOT need to list every property — optional keys
// are fine; the constraint only forbids keys outside `properties`.
// Downstream parsers never read unknown keys, so semantics are
// unchanged from the pre-fix schemas.

/** parseGuestList — extraction of pasted guest rows. */
export const guestExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    guests: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          householdName: { type: ["string", "null"] },
          side: { type: "string", enum: ["BRIDE", "GROOM", "BOTH"] },
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          isChild: { type: "boolean" },
          plusOneAllowed: { type: "boolean" },
          plusOneName: { type: ["string", "null"] },
          dietary: { type: ["string", "null"] },
          role: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["firstName", "lastName", "side"],
      },
    },
  },
  required: ["guests"],
} as const;

/** suggestDueDates — one dated suggestion per open task. */
export const dueDateSuggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          taskId: { type: "string" },
          dueDate: {
            type: "string",
            description: "ISO date YYYY-MM-DD.",
          },
          rationale: { type: "string" },
        },
        required: ["taskId", "dueDate", "rationale"],
      },
    },
  },
  required: ["dates"],
} as const;

/** runGapAnalysis — curated-checklist diff against the couple's
 *  current task list + supplier roster. `category` is a label from
 *  the curated checklist baked into the gap-analysis system prompt —
 *  NOT a bookSectionId/navTagId. It's used only to group the button's
 *  result message; it is dropped before a gap becomes a task.create
 *  proposal (see runGapAnalysis in src/app/(app)/ai/actions.ts). */
export const gapAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          rationale: { type: "string" },
        },
        required: ["title", "category", "priority", "rationale"],
      },
      description:
        "At most 8 concrete, missing tasks — one to three per genuinely under-covered category.",
    },
  },
  required: ["gaps"],
} as const;

/** reviewWeddingState — the structured state-of-the-wedding report. */
export const weddingReviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description:
        "One or two sentences summarising overall state. Lead with the outcome, not the process.",
    },
    onTrack: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          note: { type: "string" },
        },
        required: ["area", "note"],
      },
    },
    concerns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          area: { type: "string" },
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["severity", "area", "issue", "suggestion"],
      },
    },
    nextSteps: {
      type: "array",
      items: { type: "string" },
      description: "3–5 concrete actions the couple should tackle this week.",
    },
  },
  required: ["headline", "onTrack", "concerns", "nextSteps"],
} as const;
