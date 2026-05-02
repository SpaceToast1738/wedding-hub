"use server";

// v1.20.0: server action to update the singleton WeddingSettings row.
// Couple-only — same gate as `setUserCouple` / `setPermission` (the
// post-audit lockdown from A2, v1.2.0).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";

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
