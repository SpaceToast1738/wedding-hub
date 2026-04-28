import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { bookSceneFor } from "@/components/ui/Illustrations";
import { AddSectionToggle } from "./AddSectionToggle";

// Per-section visual treatment to match the prototype's BookCard.
// Schema doesn't carry description / accent / glyph as columns yet, so we
// look them up by slug here. User-created sections fall through to the
// `default` entry — predictable rather than randomly assigned.
//
// Accent values map to existing palette tokens (see prototype/tokens.css
// and src/app/globals.css). Light-mode tints; dark-mode picks up the
// dark-mode variants automatically because the tokens are CSS variables.
const SECTION_META: Record<
  string,
  { accent: string; glyph: string; description: string }
> = {
  // Prototype's 7 canonical sections — accent colours and descriptions
  // ported directly from prototype/WeddingBookPage.jsx BOOK_SECTIONS.
  "wedding-party": {
    accent: "bg-moss-100",
    glyph: "👰",
    description: "Outfits, roles, stag & hen, ring keepers",
  },
  venue: {
    accent: "bg-moss-50",
    glyph: "🏛",
    description: "Ceremony, reception, signage, centrepieces",
  },
  "food-drink": {
    accent: "bg-marigold-100",
    glyph: "🍽",
    description: "Breakfast, evening food, cake, drinks",
  },
  photography: {
    accent: "bg-moss-100",
    glyph: "📷",
    description: "Package, shot list, locations, day-of contact",
  },
  "guest-experience": {
    accent: "bg-marigold-100",
    glyph: "🎉",
    description: "Pixel Party, table games, photo booth, favours",
  },
  "legal-admin": {
    accent: "bg-moss-50",
    glyph: "📜",
    description: "Notice of marriage, documents, witnesses",
  },
  accommodation: {
    accent: "bg-marigold-100",
    glyph: "🛏",
    description: "Bridal suite, bridesmaids, groomsmen",
  },
  // Legacy v1.4.0 slugs — kept so the cards still render meaningfully
  // for installs that haven't been re-seeded or that want to keep the
  // legacy structure alongside the prototype set.
  ceremony: {
    accent: "bg-moss-50",
    glyph: "💍",
    description: "Order of service, vows, readings, music",
  },
  reception: {
    accent: "bg-marigold-100",
    glyph: "🥂",
    description: "Drinks, dinner, speeches, dancing",
  },
  logistics: {
    accent: "bg-moss-50",
    glyph: "🗓",
    description: "Setup, pack-down, supplier arrival times",
  },
};

const DEFAULT_META = {
  accent: "bg-canvas",
  glyph: "📖",
  description: "Reference notes",
};

export default async function BookHubPage() {
  const user = await requireUser();
  if (!(await canView(user, "book"))) redirect("/");
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
        subtitle="Your complete reference for every detail"
        actions={editable ? <AddSectionToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[960px] mx-auto p-6">
          {sections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No sections yet. {editable && "Create one above."}
            </p>
          ) : (
            // Auto-fill grid: cards stay at least 260px wide, expand to fill
            // available width, and stack neatly on narrower viewports.
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {sections.map((s) => {
                const meta = SECTION_META[s.slug] ?? DEFAULT_META;
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
                    className={[
                      meta.accent,
                      "border border-border-soft rounded-lg shadow-sm",
                      "p-5 min-h-[160px]",
                      "flex flex-col items-start gap-3",
                      // hover lift + shadow, mirrors the prototype's BookCard
                      "transition-all duration-150",
                      "hover:shadow-md hover:-translate-y-0.5",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between w-full">
                      {(() => {
                        // C6: prefer the SVG scene illustration when one
                        // exists for this slug. Falls through to the
                        // emoji glyph for legacy/user-created sections.
                        const Scene = bookSceneFor(s.slug);
                        return Scene ? (
                          <Scene size={44} />
                        ) : (
                          <span className="text-3xl leading-none" aria-hidden>
                            {meta.glyph}
                          </span>
                        );
                      })()}
                      <span className="text-sm text-ink-tertiary opacity-50">→</span>
                    </div>
                    <div className="mt-auto">
                      <div className="font-display text-lg font-semibold text-ink-primary leading-tight mb-1">
                        {s.title}
                      </div>
                      <div className="text-xs text-ink-secondary leading-snug">
                        {meta.description}
                      </div>
                      <div className="text-[11px] text-ink-tertiary mt-2">
                        {subtitle}
                      </div>
                    </div>
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
