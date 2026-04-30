import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSubsectionToggle } from "./AddSubsectionToggle";
import { CardRouter } from "./CardRouter";
import { SectionVisibilityToggle } from "./SectionVisibilityToggle";
import { LinkedTasksPanel } from "./LinkedTasksPanel";

export default async function BookSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const editable = await canEdit(user, "book");

  const section = await db.bookSection.findUnique({
    where: { slug },
    include: {
      subsections: {
        // C1 (v1.14.0): non-couple users don't see COUPLE_ONLY pages.
        // The couple sees everything. Mirrors File.visibility.
        where: user.isCouple ? undefined : { visibility: "EVERYONE" },
        orderBy: [{ order: "asc" }, { title: "asc" }],
        // v1.26.0: load all per-kind nested data so the CardRouter
        // can render whichever editor matches the subsection's kind.
        // v1.31.0: + buildCard.
        include: {
          fieldDefs: { orderBy: { order: "asc" } },
          recipe: true,
          shotList: { include: { shots: { orderBy: { order: "asc" } } } },
          outfitCard: { include: { outfits: { orderBy: { order: "asc" } } } },
          buildCard: {
            include: {
              materials: { orderBy: { order: "asc" } },
              sessions: { orderBy: { date: "desc" } },
            },
          },
        },
      },
    },
  });
  if (!section) notFound();
  // v1.24.0: non-couple users can't open a section the couple has
  // marked COUPLE_ONLY. Returning 404 (rather than redirecting to
  // /book) keeps the existence of the section invisible — matches
  // how the hub-page filter hides them from the index.
  if (section.visibility === "COUPLE_ONLY" && !user.isCouple) notFound();

  // v1.30.5: pull section-level linked tasks (m2m bookSections relation).
  // Replaces v1.30.0's per-subsection link.
  const linkedTasks = await db.task.findMany({
    where: { bookSections: { some: { id: section.id } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      priority: true,
      dueDate: true,
    },
  });

  return (
    <>
      <PageHeader
        title={section.title}
        subtitle={`Wedding Book · ${section.subsections.length} ${section.subsections.length === 1 ? "page" : "pages"}${section.visibility === "COUPLE_ONLY" ? " · couple-only" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {/* v1.24.0: section-level visibility toggle, couple-only. */}
            {user.isCouple && (
              <SectionVisibilityToggle
                sectionId={section.id}
                initial={section.visibility}
              />
            )}
            {editable && <AddSubsectionToggle sectionId={section.id} />}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Link href="/book" className="text-xs text-moss-500 hover:underline inline-block">← Wedding Book</Link>

          {/* On-page anchor row — quick jumps for long sections. */}
          {section.subsections.length > 1 && (
            <nav className="flex flex-wrap gap-1.5" aria-label="On this page">
              <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider self-center mr-1">
                On this page
              </span>
              {section.subsections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.slug}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-canvas border border-border-soft text-ink-secondary hover:text-moss-700 hover:border-moss-300"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          )}

          {/* v1.30.5: section-level linked tasks panel. Renders above
              the cards. Auto-hides when there are no linked tasks. */}
          <LinkedTasksPanel tasks={linkedTasks} />

          {section.subsections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              This section has no pages yet. {editable && "Add one above."}
            </p>
          ) : (
            section.subsections.map((s) => (
              <CardRouter
                key={s.id}
                sub={s}
                canEdit={editable}
                isCouple={user.isCouple}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
