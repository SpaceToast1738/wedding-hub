// v2.9.2: session-free core for the tightly-scoped wedding-settings
// patch behind propose_settings_update / settings.update.
//
// Unlike the human updateWeddingSettings (a whole-record form save) and
// updateAiMonthlyCap (a single-field form), this core takes a PARTIAL
// patch — only the wedding date and/or the AI monthly cap, the two
// fields the AI write surface exposes. Omitted fields are left
// untouched; venue / couple / names are never AI-writable. It is
// AI-apply-only today (no "use server" wrapper), same pattern as
// updateSupplierContactCore (v2.9.0). Couple-only at apply (the apply
// dispatch checks isCouple before calling in).
//
// Contract (same as src/lib/core/*): no auth here — the caller owns the
// gate; takes an explicit `user`. Never value-import @/lib/actions (it
// would drag @/auth into the tool-registry seam).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/actions";

export type WeddingSettingsPatch = {
  /** Already-parsed Date — the caller validates the string. undefined
   *  leaves the current date untouched. */
  weddingDate?: Date;
  /** Integer pence; null clears the DB override (falls back to the env
   *  default), undefined leaves it untouched. */
  aiMonthlyCapPence?: number | null;
};

export async function updateWeddingSettingsPartialCore(
  user: SessionUser,
  patch: WeddingSettingsPatch,
): Promise<{ id: string }> {
  const before = await db.weddingSettings.findUnique({ where: { id: 1 } });

  const update: { weddingDate?: Date; aiMonthlyCapPence?: number | null } = {};
  const changedFields: string[] = [];
  if (patch.weddingDate !== undefined) {
    update.weddingDate = patch.weddingDate;
    if (!before || before.weddingDate.getTime() !== patch.weddingDate.getTime()) {
      changedFields.push("weddingDate");
    }
  }
  if (patch.aiMonthlyCapPence !== undefined) {
    update.aiMonthlyCapPence = patch.aiMonthlyCapPence;
    if (!before || (before.aiMonthlyCapPence ?? null) !== (patch.aiMonthlyCapPence ?? null)) {
      changedFields.push("aiMonthlyCapPence");
    }
  }

  // upsert with a create fallback for a missing bootstrap row (mirrors
  // the seating-notes core). weddingDate + venue are the only columns
  // without a schema default, so the create carries them from the patch
  // or the env seed default.
  await db.weddingSettings.upsert({
    where: { id: 1 },
    update,
    create: {
      id: 1,
      weddingDate:
        patch.weddingDate ?? new Date(process.env.WEDDING_DATE ?? "2026-09-24T14:00:00Z"),
      venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
      aiMonthlyCapPence: patch.aiMonthlyCapPence ?? null,
    },
  });

  await logAudit({
    userId: user.id,
    action: "update",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      changedFields,
      source: "ai",
      ...(patch.weddingDate !== undefined && { weddingDate: patch.weddingDate.toISOString() }),
    },
  });

  // Flush every page that reads wedding settings (getWeddingSettings is
  // React.cache()-wrapped) — the same broad set the human
  // updateWeddingSettings revalidates, plus /ai for the cap.
  revalidatePath("/");
  revalidatePath("/glance");
  revalidatePath("/schedule");
  revalidatePath("/today/day-of");
  revalidatePath("/guests/catering");
  revalidatePath("/settings");
  revalidatePath("/ai");
  return { id: "1" };
}
