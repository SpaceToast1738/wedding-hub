import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { requireUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { fetchAllHeadcounts } from "@/lib/headcount";
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
  const [categories, suppliers, buildCardsWithBudget, headcounts] = await Promise.all([
    db.budgetCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        lines: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          // B2: payments included so the client can recompute `actual`
          // when it's null (manual override semantics).
          // v1.80.0: + components (with their payments) for composite
          // line rendering. Component-level estimated rolls up to the
          // line; component-level payments roll into the line's actual.
          // v1.82.0: + Payment.status so the Paid column can sum
          // PAID-only payments (matches the v1.82.0 computePaid B2
          // contract). Without status, the column rendered the manual
          // override only and ignored linked PAID payments — bug
          // reported when a £1,000 PAID payment showed under Actual
          // but Paid stayed £0.
          include: {
            payments: { select: { amount: true, status: true } },
            components: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              include: { payments: { select: { amount: true, status: true } } },
            },
          },
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
    // v1.77.0: pre-fetch every PerHeadSource count once. Per-head
    // BudgetLines resolve their estimated total against this map at
    // render time so RSVP changes reflect immediately.
    fetchAllHeadcounts(),
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
            // Prisma Decimal type (keeps the bundle slim). v1.82.0: +
            // payment status so the Paid column can sum PAID-only.
            payments: l.payments.map((p) => ({ amount: p.amount.toString(), status: p.status })),
            // v1.77.0: per-head config flows through to LineRow so
            // the breakdown chip + over-budget warning render.
            perHeadPence: l.perHeadPence,
            headcountSource: l.headcountSource,
            manualHeadcount: l.manualHeadcount,
            // v1.81.0: vendor minimum-cover floor on per-head lines.
            minimumHeadcount: l.minimumHeadcount,
            // v1.80.0: components for composite lines.
            components: l.components.map((cmp) => ({
              id: cmp.id,
              label: cmp.label,
              flatPence: cmp.flatPence,
              perHeadPence: cmp.perHeadPence,
              headcountSource: cmp.headcountSource,
              manualHeadcount: cmp.manualHeadcount,
              // v1.81.0: minimum-cover floor on a sub-component.
              minimumHeadcount: cmp.minimumHeadcount,
              notes: cmp.notes,
              order: cmp.order,
              payments: cmp.payments.map((p) => ({ amount: p.amount.toString(), status: p.status })),
            })),
          })),
        }))}
        suppliers={suppliers}
        buildCardByLineId={buildCardByLineIdObj}
        headcounts={headcounts}
      />
      </div>
    </>
  );
}
