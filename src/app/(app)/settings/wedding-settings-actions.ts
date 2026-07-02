"use server";

// v1.20.0: server action to update the singleton WeddingSettings row.
// Couple-only — same gate as `setUserCouple` / `setPermission` (the
// post-audit lockdown from A2, v1.2.0).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";
import {
  describeApiKey,
  invalidateApiKeyCache,
} from "@/lib/ai/config";

const schema = z.object({
  // Accept either ISO timestamp or YYYY-MM-DD; Date constructor parses both.
  weddingDate: z.string().min(1).max(40),
  ceremonyTime: z.string().min(1).max(80),
  venue: z.string().min(1).max(200),
  venueAddress: z.string().max(500).optional().nullable(),
  coupleLabel: z.string().min(1).max(200),
  coupleShort: z.string().min(1).max(200),
  brideFirst: z.string().min(1).max(80),
  groomFirst: z.string().min(1).max(80),
});

export async function updateWeddingSettings(formData: FormData) {
  const user = await requireUser();
  if (!user.isCouple) {
    throw new Error("Forbidden: only the couple can edit wedding details");
  }
  const parsed = schema.parse({
    weddingDate: formData.get("weddingDate"),
    ceremonyTime: formData.get("ceremonyTime"),
    venue: formData.get("venue"),
    venueAddress: formData.get("venueAddress") || null,
    coupleLabel: formData.get("coupleLabel"),
    coupleShort: formData.get("coupleShort"),
    brideFirst: formData.get("brideFirst"),
    groomFirst: formData.get("groomFirst"),
  });
  const date = new Date(parsed.weddingDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Wedding date must be a valid date or ISO timestamp");
  }
  // v1.64.0 (DP-5): capture changedFields for the audit log. Pre-fix
  // every wedding-settings save logged just `entity: WeddingSettings,
  // entityId: 1` — useless for forensics ("who changed the venue?").
  const before = await db.weddingSettings.findUnique({ where: { id: 1 } });
  await db.weddingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed, weddingDate: date, venueAddress: parsed.venueAddress ?? null },
    update: { ...parsed, weddingDate: date, venueAddress: parsed.venueAddress ?? null },
  });
  const changedFields: string[] = [];
  if (before) {
    if (before.weddingDate.getTime() !== date.getTime()) changedFields.push("weddingDate");
    if (before.ceremonyTime !== parsed.ceremonyTime) changedFields.push("ceremonyTime");
    if (before.venue !== parsed.venue) changedFields.push("venue");
    if ((before.venueAddress ?? null) !== (parsed.venueAddress ?? null)) changedFields.push("venueAddress");
    if (before.coupleLabel !== parsed.coupleLabel) changedFields.push("coupleLabel");
    if (before.coupleShort !== parsed.coupleShort) changedFields.push("coupleShort");
    if (before.brideFirst !== parsed.brideFirst) changedFields.push("brideFirst");
    if (before.groomFirst !== parsed.groomFirst) changedFields.push("groomFirst");
  }
  await audit(user, {
    action: "update",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      changedFields,
      // Snapshot the post-update values for the most-edited fields so
      // an audit reader sees "venue is now Alveston Manor" without
      // re-reading the row.
      weddingDate: date.toISOString(),
      venue: parsed.venue,
    },
  });
  // Invalidate every page that reads wedding settings — the helper at
  // `src/lib/wedding-settings.ts` is React.cache()-wrapped, so
  // revalidating these paths flushes the next request.
  revalidatePath("/");
  revalidatePath("/glance");
  revalidatePath("/schedule");
  revalidatePath("/today/day-of");
  revalidatePath("/guests/catering");
  revalidatePath("/settings");
}

// v2.1.0 phase 4: dedicated action for the AI monthly cap. Split off
// updateWeddingSettings so the AI settings block on /settings can save
// independently of the wedding-details form (which has its own schema
// + audit metadata).
const aiBudgetSchema = z.object({
  aiMonthlyCapPence: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
});

export async function updateAiMonthlyCap(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Only the couple can edit the AI budget cap." };
  }

  const raw = formData.get("aiMonthlyCapPounds");
  let capPence: number | null;
  if (raw === null || raw === "" || raw === "unset") {
    capPence = null;
  } else {
    const pounds = Number(raw);
    if (!Number.isFinite(pounds) || pounds < 0) {
      return { ok: false, error: "Enter a positive number, or leave blank to use the env-default." };
    }
    capPence = Math.round(pounds * 100);
  }

  const parsed = aiBudgetSchema.safeParse({ aiMonthlyCapPence: capPence });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }

  const before = await db.weddingSettings.findUnique({
    where: { id: 1 },
    select: { aiMonthlyCapPence: true },
  });
  await db.weddingSettings.update({
    where: { id: 1 },
    data: { aiMonthlyCapPence: parsed.data.aiMonthlyCapPence ?? null },
  });
  await audit(user, {
    action: "update",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      changedFields: ["aiMonthlyCapPence"],
      previous: before?.aiMonthlyCapPence ?? null,
      next: parsed.data.aiMonthlyCapPence ?? null,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/ai");
  return { ok: true };
}

// v2.1.0 phase 6.1: Anthropic API key edit path.
//
// The full key is never returned from a server action — the panel
// only ever sees the masked describeApiKey() shape. Save accepts
// either a new key (validated as `sk-ant-*`) or a blank string to
// clear the DB value and fall back to the env var.

export type ApiKeyState = { hasKey: boolean; source: "settings" | "env" | "none"; mask: string | null };

export async function readAnthropicApiKeyState(): Promise<ApiKeyState> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { hasKey: false, source: "none", mask: null };
  }
  return describeApiKey();
}

export async function updateAnthropicApiKey(
  formData: FormData,
): Promise<{ ok: true; state: ApiKeyState } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Only the couple can edit the API key." };
  }

  const raw = (formData.get("apiKey") ?? "").toString().trim();
  const clear = formData.get("clear") === "1";

  let nextValue: string | null;
  if (clear || raw === "") {
    nextValue = null;
  } else {
    if (!raw.startsWith("sk-ant-")) {
      return {
        ok: false,
        error: "That doesn't look like an Anthropic key — it should start with 'sk-ant-'.",
      };
    }
    if (raw.length < 20 || raw.length > 500) {
      return { ok: false, error: "Key length looks wrong. Paste the whole value from console.anthropic.com." };
    }
    nextValue = raw;
  }

  const before = await db.weddingSettings.findUnique({
    where: { id: 1 },
    select: { anthropicApiKey: true },
  });
  await db.weddingSettings.update({
    where: { id: 1 },
    data: { anthropicApiKey: nextValue },
  });
  invalidateApiKeyCache();

  await audit(user, {
    action: "update",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      changedFields: ["anthropicApiKey"],
      // NEVER audit the key itself — record just the transition.
      previousSet: Boolean(before?.anthropicApiKey),
      nextSet: Boolean(nextValue),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/ai");
  return { ok: true, state: await describeApiKey() };
}
