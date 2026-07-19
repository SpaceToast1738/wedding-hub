"use server";

// v2.8.0 (§C2): server actions for the enhancement-suggestion panel
// on /ai. Suggestions are agent-filed product feedback (dev backlog),
// not wedding data — see prisma/schema.prisma EnhancementSuggestion.
// Listing mirrors the proposal-visibility rule (authors see their
// own, the couple sees everyone's); triage is couple-only.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireCouple } from "@/lib/actions";
import { canView } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ENHANCEMENT_STATUSES } from "@/lib/ai/tools/suggest-enhancement";

export type EnhancementSuggestionRow = {
  id: string;
  area: string;
  title: string;
  detail: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  createdBy: string;
};

export async function listEnhancementSuggestions(): Promise<EnhancementSuggestionRow[]> {
  const user = await requireUser();
  if (!(await canView(user, "ai_chat"))) return [];

  // Same visibility rule as listPendingProposals: authors see their
  // own rows, the couple sees everyone's (they're the triage layer).
  const where = user.isCouple ? {} : { createdById: user.id };
  const rows = await db.enhancementSuggestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      area: true,
      title: true,
      detail: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      createdBy: { select: { firstName: true, name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    area: r.area,
    title: r.title,
    detail: r.detail,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdBy: r.createdBy.firstName ?? r.createdBy.name ?? r.createdBy.email,
  }));
}

const statusSchema = z.enum(ENHANCEMENT_STATUSES);

export async function setEnhancementStatus(
  id: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireCouple();

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: `Invalid status '${status}'.` };
  }

  const suggestion = await db.enhancementSuggestion.findUnique({
    where: { id },
    select: { id: true, title: true, area: true, status: true },
  });
  if (!suggestion) {
    return { ok: false, error: "Suggestion not found — it may have been removed." };
  }
  if (suggestion.status === parsed.data) return { ok: true };

  await db.enhancementSuggestion.update({
    where: { id },
    data: {
      status: parsed.data,
      // NEW means "not yet triaged" — moving back to NEW clears the
      // review stamp; any other status records when it was decided.
      reviewedAt: parsed.data === "NEW" ? null : new Date(),
    },
  });

  await logAudit({
    userId: user.id,
    action: "enhancement.status_changed",
    entity: "EnhancementSuggestion",
    entityId: suggestion.id,
    metadata: {
      area: suggestion.area,
      title: suggestion.title,
      from: suggestion.status,
      to: parsed.data,
      summary: `Enhancement "${suggestion.title}" moved ${suggestion.status} → ${parsed.data}`,
    },
  });

  revalidatePath("/ai");
  return { ok: true };
}
