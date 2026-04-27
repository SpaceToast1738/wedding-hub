import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSectionToggle } from "./AddSectionToggle";

export default async function BookHubPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "book");

  const sections = await db.bookSection.findMany({
    orderBy: [{ order: "asc" }, { title: "asc" }],
    include: { _count: { select: { subsections: true } } },
  });

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
              {sections.map((s) => (
                <Link
                  key={s.id}
                  href={`/book/${s.slug}`}
                  className="bg-surface border border-border-soft rounded-md shadow-sm p-5 hover:shadow-md hover:border-moss-100 transition-shadow"
                >
                  <h2 className="font-display text-lg text-moss-700 mb-1">{s.title}</h2>
                  <div className="text-xs text-ink-tertiary">
                    {s._count.subsections} {s._count.subsections === 1 ? "page" : "pages"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
