import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { requireUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { BudgetClient } from "./BudgetClient";
import { BudgetDiyLinks } from "./BudgetDiyLinks";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");
  const wedding = await getWeddingSettings();

  // v1.37.5 (P7b/C): pull every BUILD card with a budget link so the
  // "Linked from DIY" panel can surface the rolled-up totals at the
  // top of the Budget page. Reads from the `BookBuildCard.budgetLineId`
  // FK established in v1.31.1 — no schema changes here.
  const [categories, suppliers, buildCardsWithBudget] = await Promise.all([
    db.budgetCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        lines: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          // B2: payments included so the client can recompute `actual`
          // when it's null (manual override semantics).
          include: { payments: { select: { amount: true } } },
        },
      },
    }),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.bookBuildCard.findMany({
      where: { budgetLineId: { not: null } },
      select: {
        id: true,
        budgetLineId: true,
        budgetLine: { select: { id: true, description: true, estimated: true } },
        subsection: {
          select: { slug: true, title: true, section: { select: { slug: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const diyLinks = buildCardsWithBudget
    .filter((c) => c.budgetLine != null)
    .map((c) => ({
      buildCardId: c.id,
      buildCardTitle: c.subsection.title,
      buildSectionSlug: c.subsection.section.slug,
      buildSubsectionSlug: c.subsection.slug,
      budgetLineId: c.budgetLine!.id,
      budgetLineDescription: c.budgetLine!.description,
      estimated:
        c.budgetLine!.estimated == null ? null : Number(c.budgetLine!.estimated),
    }));

  // v1.57.0 (XL5): per-line BUILD-card linkback chip. Map<lineId,
  // { sectionSlug, subsectionSlug, title }> threaded into LineRow so
  // the row can render a deep-link to the source card. Pre-fix the
  // top-of-page DIY panel was the only surface — line rows showed no
  // sign of the relationship.
  const buildCardByLineId = new Map<string, { sectionSlug: string; subsectionSlug: string; title: string }>();
  for (const c of buildCardsWithBudget) {
    if (c.budgetLineId) {
      buildCardByLineId.set(c.budgetLineId, {
        sectionSlug: c.subsection.section.slug,
        subsectionSlug: c.subsection.slug,
        title: c.subsection.title,
      });
    }
  }
  const buildCardByLineIdObj = Object.fromEntries(buildCardByLineId);

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle="Categories, lines, and totals — couple only"
        actions={<PrintButton />}
      />
      <div className="flex-1 overflow-auto budget-page">
        {/* v1.24.0: print-only letterhead — same shape as /schedule
            and /guests/catering. Hidden on screen, visible on print. */}
        <div className="print-only-block max-w-3xl mx-auto px-6 pt-6 border-b-2 border-ink-primary pb-3 mb-6">
          <h1 className="font-display text-2xl text-ink-primary">{wedding.coupleLabel}</h1>
          <div className="text-xs text-ink-tertiary mt-1">
            Budget · {formatWeddingDate(wedding)} · {wedding.venue}
          </div>
        </div>
        {/* v1.37.5 (P7b/C): DIY linkbacks above the categories so a
            quick-scan reveals which budget lines came from a BUILD
            card. Hidden when there are none. */}
        {diyLinks.length > 0 && (
          <div className="max-w-5xl mx-auto px-6 pt-6 -mb-2">
            <BudgetDiyLinks links={diyLinks} />
          </div>
        )}
        <BudgetClient
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          lines: c.lines.map((l) => ({
            id: l.id,
            description: l.description,
            estimated: l.estimated,
            actual: l.actual,
            paid: l.paid,
            supplierId: l.supplierId,
            notes: l.notes,
            // Pass amounts as strings so the client never imports the
            // Prisma Decimal type (keeps the bundle slim).
            payments: l.payments.map((p) => ({ amount: p.amount.toString() })),
          })),
        }))}
        suppliers={suppliers}
        buildCardByLineId={buildCardByLineIdObj}
      />
      </div>
    </>
  );
}
