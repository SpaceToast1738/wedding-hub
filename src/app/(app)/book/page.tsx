import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSectionToggle } from "./AddSectionToggle";

export default async function BookHubPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "book");

  const [sections, shotCounts] = await Promise.all([
    db.bookSection.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: { _count: { select: { subsections: true } } },
    }),
    // Photography card surfaces shot-list progress instead of subsection count.
    db.photographyShot.findMany({ select: { captured: true } }),
  ]);
  const shotsTotal = shotCounts.length;
  const shotsCaptured = shotCounts.filter((s) => s.captured).length;

  return (
    <>
      <PageHeader
        title="Wedding Book"
        subtitle="Reference notes organised by section"
        actions={editable ? <AddSectionToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {sections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No sections yet. {editable && "Create one above."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((s) => {
                const isPhoto = s.slug === "photography";
                const subtitle = isPhoto
                  ? shotsTotal === 0
                    ? "Shot list — no shots yet"
                    : `Shot list — ${shotsCaptured} of ${shotsTotal} captured`
                  : `${s._count.subsections} ${s._count.subsections === 1 ? "page" : "pages"}`;
                return (
                  <Link
                    key={s.id}
                    href={`/book/${s.slug}`}
                    className="bg-surface border border-border-soft rounded-md shadow-sm p-5 hover:shadow-md hover:border-moss-100 transition-shadow"
                  >
                    <h2 className="font-display text-lg text-moss-700 mb-1">{s.title}</h2>
                    <div className="text-xs text-ink-tertiary">{subtitle}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
