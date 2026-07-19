// v2.8.1 (Tier 2, Slice B): couple-only read of the audit log — "what
// changed recently, and who did it?". Renders each row through
// formatAuditAction (the same human-sentence formatter the /settings
// Audit panel + Today feed use) so the model never sees the raw
// metadata blob. The audit log is money-sensitive (payment amounts,
// supplier contract values leak through the sentences) and has no
// per-row visibility filter, so this tool is couple-only.
//
// The audit table is swept to a 30-day retention window (see
// src/lib/audit.ts), so `since` defaults to −30 days and older rows
// simply won't exist.

import { z } from "zod";
import { db } from "@/lib/db";
import { formatAuditAction } from "@/lib/audit-format";
import { displayName } from "@/lib/group-members";
import type { AiTool } from "./types";

const DEFAULT_LIMIT = 25;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const inputSchema = z.object({
  entity: z
    .string()
    .max(64)
    .optional()
    .describe(
      "Only rows for this Prisma model name (e.g. 'Guest', 'Payment', 'Task', 'BudgetLine'). Case-sensitive.",
    ),
  entityId: z
    .string()
    .max(128)
    .optional()
    .describe("Only rows about this specific record id. Pair with `entity`."),
  action: z
    .string()
    .max(64)
    .optional()
    .describe("Only rows with this action code (e.g. 'create', 'update', 'status')."),
  since: z
    .string()
    .max(40)
    .optional()
    .describe("ISO timestamp — only rows at or after this time. Defaults to 30 days ago."),
  until: z
    .string()
    .max(40)
    .optional()
    .describe("ISO timestamp — only rows at or before this time. Defaults to now."),
  limit: z.number().int().min(1).max(50).optional().describe(`Max rows (default ${DEFAULT_LIMIT}).`),
});

export const readActivity: AiTool<typeof inputSchema> = {
  name: "read_activity",
  description:
    "Read the recent activity / audit log — who changed what, newest first, rendered as human sentences (e.g. \"Set payment 'Florist deposit' to PAID\"). Filter by entity (Prisma model name like 'Guest' or 'Payment'), entityId, action code, and a since/until ISO window (defaults to the last 30 days). Answers 'what changed recently?', 'when did the caterer contract get logged?', 'who updated this guest?'. Couple-only — the log carries money-sensitive detail and isn't per-row filtered.",
  inputSchema,
  progressLabel: "Reading the activity log…",
  definition: {
    name: "read_activity",
    description:
      "Read the recent audit log (who changed what, newest first, as human sentences). Filters: entity (Prisma model name), entityId, action, since/until (ISO, default last 30 days), limit. Couple-only.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          description: "Prisma model name, e.g. 'Guest', 'Payment', 'Task'. Case-sensitive.",
        },
        entityId: { type: "string", description: "Specific record id; pair with entity." },
        action: { type: "string", description: "Action code, e.g. 'create', 'update', 'status'." },
        since: { type: "string", description: "ISO timestamp; default 30 days ago." },
        until: { type: "string", description: "ISO timestamp; default now." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: `Default ${DEFAULT_LIMIT}.` },
      },
    },
  },
  async handler(input, ctx) {
    if (!ctx.user.isCouple) {
      return { ok: false, error: "The activity log is couple-only." };
    }

    const since = input.since ? new Date(input.since) : new Date(Date.now() - THIRTY_DAYS_MS);
    if (isNaN(since.getTime())) {
      return { ok: false, error: "`since` is not a valid ISO timestamp." };
    }
    let until: Date | null = null;
    if (input.until) {
      until = new Date(input.until);
      if (isNaN(until.getTime())) {
        return { ok: false, error: "`until` is not a valid ISO timestamp." };
      }
    }

    const take = input.limit ?? DEFAULT_LIMIT;
    const where: Record<string, unknown> = {
      createdAt: { gte: since, ...(until ? { lte: until } : {}) },
    };
    if (input.entity) where.entity = input.entity;
    if (input.entityId) where.entityId = input.entityId;
    if (input.action) where.action = input.action;

    const rows = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        // Actor name only — never the email (matches read_members'
        // omit-email rule). id is selected purely to satisfy displayName's
        // UserShape param; it isn't returned.
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
      },
    });

    return {
      ok: true,
      data: {
        count: rows.length,
        // Flag truncation so the model doesn't treat a full page as the
        // complete history for the window.
        truncated: rows.length === take,
        activity: rows.map((r) => ({
          id: r.id,
          at: r.createdAt.toISOString(),
          actor: r.user ? displayName(r.user) : "system",
          action: r.action,
          entity: r.entity,
          entityId: r.entityId,
          // Human sentence — never the raw metadata (may hold sensitive
          // fields), same formatter the audit UIs use.
          summary: formatAuditAction({
            action: r.action,
            entity: r.entity,
            metadata:
              r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
                ? (r.metadata as Record<string, unknown>)
                : null,
          }),
        })),
      },
    };
  },
};
