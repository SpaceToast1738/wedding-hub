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
  await db.weddingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed, weddingDate: date, venueAddress: parsed.venueAddress ?? null },
    update: { ...parsed, weddingDate: date, venueAddress: parsed.venueAddress ?? null },
  });
  await audit(user, {
    action: "update",
    entity: "WeddingSettings",
    entityId: "1",
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
