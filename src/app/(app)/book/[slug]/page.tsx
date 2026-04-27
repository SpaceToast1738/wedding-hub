import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSubsectionToggle } from "./AddSubsectionToggle";
import { SubsectionEditor } from "./SubsectionEditor";

export default async function BookSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const editable = await canEdit(user, "book");

  const section = await db.bookSection.findUnique({
    where: { slug },
    include: {
      subsections: { orderBy: [{ order: "asc" }, { title: "asc" }] },
    },
  });
  if (!section) notFound();

  return (
    <>
      <PageHeader
        title={section.title}
        subtitle={`Wedding Book · ${section.subsections.length} ${section.subsections.length === 1 ? "page" : "pages"}`}
        actions={editable ? <AddSubsectionToggle sectionId={section.id} /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Link href="/book" className="text-xs text-moss-500 hover:underline inline-block">← Wedding Book</Link>
          {section.subsections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              This section has no pages yet. {editable && "Add one above."}
            </p>
          ) : (
            section.subsections.map((s) => (
              <SubsectionEditor key={s.id} sub={s} canEdit={editable} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
