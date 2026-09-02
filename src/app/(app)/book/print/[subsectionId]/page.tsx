// v2.14.0: one Book card as a clean, printable page — the "download as
// PDF" half of share/export (the browser's Save-as-PDF is the PDF
// engine; no PDF library). Same gate as the section page: book VIEW
// plus the COUPLE_ONLY wall for non-couple users.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/actions";
import { canView } from "@/lib/permissions";
import { loadCardExport } from "@/lib/core/book-export";
import { cardToDoc } from "@/lib/book-card-doc";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { PrintButton } from "@/components/ui/PrintButton";
import { DocView } from "../DocView";

export default async function PrintCardPage({
  params,
}: {
  params: Promise<{ subsectionId: string }>;
}) {
  const { subsectionId } = await params;
  const user = await requireUser();
  if (!(await canView(user, "book"))) notFound();
  const card = await loadCardExport(subsectionId);
  if (!card) notFound();
  if (card.visibility === "COUPLE_ONLY" && !user.isCouple) notFound();

  const doc = cardToDoc(card);
  const wedding = await getWeddingSettings();
  const footer = `${wedding.brideFirst} & ${wedding.groomFirst} · Wedding Hub · ${card.sectionTitle}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 print:p-0 print:max-w-none">
      <div className="no-print flex items-center justify-between gap-3 mb-5">
        <Link
          href={`/book/${card.sectionSlug}#${card.slug}`}
          className="text-xs text-ink-tertiary hover:text-ink-primary"
        >
          ← Back to {card.sectionTitle}
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>
      <div className="bg-surface border border-border-soft rounded-lg shadow-sm p-6 print:border-0 print:shadow-none print:p-0">
        <DocView doc={doc} footer={footer} />
      </div>
    </div>
  );
}
