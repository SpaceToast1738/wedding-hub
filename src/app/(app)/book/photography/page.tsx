import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { ShotsClient } from "./ShotsClient";
import { PrintShotsButton } from "./PrintShotsButton";

export default async function PhotographyPage() {
  const user = await requireUser();
  if (!(await canView(user, "book"))) redirect("/");
  const editable = await canEdit(user, "book");

  const shots = await db.photographyShot.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const total = shots.length;
  const captured = shots.filter((s) => s.captured).length;

  return (
    <>
      <PageHeader
        title="Photography & Shot list"
        subtitle={
          total === 0
            ? "Build the must-have shot list for the day"
            : `${captured} of ${total} captured · ${total - captured} planned`
        }
        actions={
          <>
            <Link
              href="/book"
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
            >
              ← Wedding Book
            </Link>
            <PrintShotsButton />
          </>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-5 photography-page">
          {/* Print-only letterhead — hidden on screen, visible in print/PDF. */}
          <div className="print-only-block border-b-2 border-ink-primary pb-3 mb-4">
            <h1 className="font-display text-2xl text-ink-primary">
              Shot list — Jamie &amp; Bryony
            </h1>
            <div className="text-xs text-ink-tertiary mt-1">
              {total} shot{total === 1 ? "" : "s"} · for the photographer on the day
            </div>
          </div>

          {/* Static reference content above the checklist — package, coverage,
              locations, day-of contact. The prototype hard-coded these; we
              put them inline as an editable-via-Wedding-Book TODO note. */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm p-5 space-y-4 no-print">
            <header>
              <h2 className="text-sm font-semibold text-ink-primary">Photographer details</h2>
              <p className="text-[11px] text-ink-tertiary">
                Reference info for the day. Edit by adding subsections to the
                Wedding Book if you want richer text.
              </p>
            </header>
            <Stub label="Package booked" />
            <Stub label="Coverage included" />
            <Stub label="Locations" />
            <Stub label="Day-of contact" />
          </section>

          {/* Shot list — the heart of the page. ShotsClient handles add /
              edit / toggle / reorder / delete. */}
          <ShotsClient shots={shots} canEdit={editable} />

          {/* On-screen progress recap — also helpful as the last block on a
              printout so the photographer can see at a glance how many shots
              they have to work through. */}
          <section className="bg-moss-50 border border-moss-100 rounded-md p-4 text-sm text-moss-700 print-break-avoid">
            <strong className="font-semibold">Tip for the photographer:</strong>{" "}
            tick a row off after capturing it. The day-of viewer is the same UI
            the couple uses, so progress stays in sync without re-typing.
          </section>
        </div>
      </div>
    </>
  );
}

function Stub({ label }: { label: string }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">
        {label}
      </h3>
      <p className="text-sm text-ink-tertiary italic mt-0.5">
        Add details — coming from a future Wedding Book subsection edit.
      </p>
    </div>
  );
}
