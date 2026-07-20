// v2.9.2: read the wedding-settings singleton — the date/venue/couple
// facts plus the AI monthly cap, the kill-switch states, and whether an
// API key is configured. Motivating case: a wedding-date discrepancy was
// previously only surfaceable via read_stats; this makes settings a
// first-class read (and the counterpart of the tightly-scoped
// propose_settings_update). Couple-only — it exposes the AI cap,
// kill-switches and the api-key-configured flag, which are settings-tier.

import { z } from "zod";
import { db } from "@/lib/db";
import { getWeddingSettings } from "@/lib/wedding-settings";
import type { AiTool } from "./types";

const inputSchema = z.object({});

/** Default fallback cap (pence) when neither the DB override nor the env
 *  is set — mirrors AI_MONTHLY_CAP_PENCE's documented £30 default. */
const DEFAULT_CAP_PENCE = 3000;

export const readSettings: AiTool<typeof inputSchema> = {
  name: "read_settings",
  description:
    "Read the wedding settings: date + ceremony time, venue, couple names, the AI monthly spend cap (the DB override, the effective value, and where it comes from), whether an Anthropic API key is configured, and the AI / MCP kill-switch states. Couple-only. Use this to confirm the canonical wedding date/venue or to check the AI budget cap before proposing a change with propose_settings_update.",
  inputSchema,
  progressLabel: "Reading wedding settings…",
  definition: {
    name: "read_settings",
    description:
      "Read the wedding settings (date, ceremony time, venue, couple names), the AI monthly cap + its source, whether an API key is set, and the AI/MCP kill-switch states. Couple-only.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    if (!ctx.user.isCouple) {
      return { ok: false, error: "Wedding settings are couple-only." };
    }

    const settings = await getWeddingSettings();
    const row = await db.weddingSettings.findUnique({
      where: { id: 1 },
      select: { aiMonthlyCapPence: true, anthropicApiKey: true },
    });

    const now = Date.now();
    const days = Math.max(
      0,
      Math.ceil((settings.weddingDate.getTime() - now) / (24 * 60 * 60 * 1000)),
    );

    // Effective cap resolution mirrors src/lib/ai/guards.ts: DB override,
    // then AI_MONTHLY_CAP_PENCE env, then the hard-coded £30 default.
    const dbCap = row?.aiMonthlyCapPence ?? null;
    const envCapRaw = Number(process.env.AI_MONTHLY_CAP_PENCE);
    const envCap = Number.isFinite(envCapRaw) ? envCapRaw : null;
    const effectiveCapPence = dbCap ?? envCap ?? DEFAULT_CAP_PENCE;
    const capSource: "settings" | "env" | "default" =
      dbCap != null ? "settings" : envCap != null ? "env" : "default";

    return {
      ok: true,
      data: {
        wedding: {
          weddingDate: settings.weddingDate.toISOString(),
          weddingDateShort: settings.weddingDate.toISOString().slice(0, 10),
          daysToWedding: days,
          weeksToWedding: Math.floor(days / 7),
          ceremonyTime: settings.ceremonyTime,
          venue: settings.venue,
          venueAddress: settings.venueAddress,
          coupleLabel: settings.coupleLabel,
          coupleShort: settings.coupleShort,
          brideFirst: settings.brideFirst,
          groomFirst: settings.groomFirst,
        },
        ai: {
          // The raw DB override (null = not set → falls back below).
          monthlyCapPence: dbCap,
          monthlyCapLabel: dbCap != null ? `£${(dbCap / 100).toFixed(2)}` : null,
          effectiveMonthlyCapPence: effectiveCapPence,
          effectiveMonthlyCapLabel: `£${(effectiveCapPence / 100).toFixed(2)}`,
          capSource,
          apiKeyConfigured: Boolean(row?.anthropicApiKey) || Boolean(process.env.ANTHROPIC_API_KEY),
        },
        killSwitches: {
          // Same default-on semantics as the app (config.ts / route.ts):
          // only the literal string "false" disables.
          aiEnabled: process.env.AI_ENABLED !== "false",
          mcpEnabled: process.env.MCP_ENABLED !== "false",
        },
      },
    };
  },
};
