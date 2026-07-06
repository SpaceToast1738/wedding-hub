import Link from "next/link";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { bookSceneFor } from "@/components/ui/Illustrations";
import { AddSectionToggle } from "./AddSectionToggle";
import { SectionReorderControls } from "./SectionReorderControls";

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

// v1.94.1: variety in the card colours for non-canonical sections.
// Originally a slug-hash rotation kept the colour stable per slug,
// but the hash didn't know about neighbours — so the user could end
// up with three same-colour cards in a row.
//
// v1.99.7: switched to a deterministic POSITION-based rotation. The
// section at index 0 gets accent A, index 1 gets B, index 2 gets C,
// then it wraps. This guarantees that no two horizontally-adjacent
// cards (in any column count) ever share a colour, which is the
// visual alternation the user asked for. Canonical-slug accent
// overrides in SECTION_META also retire — the rotation is the
// single source of truth for card backgrounds.
//
// Trade-off: re-ordering sections (▲/▼ buttons) shifts the colour
// of each card. Acceptable — the alternation property is the
// dominant visual concern, and re-ordering is rare.
const ACCENT_ROTATION = [
  "bg-moss-100",
  "bg-marigold-100",
  "bg-moss-50",
] as const;
function accentFor(idx: number): string {
  return ACCENT_ROTATION[idx % ACCENT_ROTATION.length]!;
}

// v1.94.1: keyword-inferred glyph for custom sections. Pre-fix
// every non-canonical section landed on the generic 📖 — visually
// indistinguishable. Now matches against the section's slug + title
// so "venue-spaces" / "Legal — Before the day" / "Wedding Party —
// People" get a meaningful emoji even when bookSceneFor returns null.
function fallbackGlyphFor(slug: string, title: string): string {
  const hay = `${slug} ${title}`.toLowerCase();
  // Ordered by specificity — most distinctive wins.
  if (hay.includes("honeymoon") || hay.includes("flight")) return "✈";
  if (hay.includes("transport") || hay.includes("car") || hay.includes("taxi")) return "🚗";
  if (hay.includes("stag") || hay.includes("hen")) return "🥂";
  if (hay.includes("song") || hay.includes("music") || hay.includes("dj") || hay.includes("band")) return "🎵";
  if (hay.includes("schedule") || hay.includes("timeline") || hay.includes("day-of") || hay.includes("day of")) return "🗓";
  if (hay.includes("photo") || hay.includes("video")) return "📷";
  if (hay.includes("food") || hay.includes("drink") || hay.includes("menu") || hay.includes("bar") || hay.includes("cake") || hay.includes("catering")) return "🍽";
  if (hay.includes("clothing") || hay.includes("outfit") || hay.includes("dress") || hay.includes("attire") || hay.includes("accessor")) return "👗";
  if (hay.includes("wedding party") || hay.includes("wedding-party") || hay.includes("bridesmaid") || hay.includes("groomsman") || hay.includes("best man") || hay.includes("maid of honour")) return "👰";
  if (hay.includes("guest") || hay.includes("favour") || hay.includes("entertainment")) return "🎉";
  if (hay.includes("accommodat") || hay.includes("lodging") || hay.includes("hotel") || hay.includes("suite") || hay.includes("room")) return "🛏";
  if (hay.includes("venue") || hay.includes("ceremony") || hay.includes("reception") || hay.includes("space") || hay.includes("decor")) return "🏛";
  if (hay.includes("post") && hay.includes("wedding")) return "📔";
  return "📖";
}

export default async function BookHubPage() {
  const user = await requireUser();
  if (!(await canView(user, "book"))) redirect("/");
  const editable = await canEdit(user, "book");

  const [allSections, shotCounts] = await Promise.all([
    db.bookSection.findMany({
      // v1.24.0: hide COUPLE_ONLY sections from non-couple users.
      // Mirrors the C1/v1.14.0 subsection filter that's applied at
      // /book/[slug] read time.
      where: user.isCouple ? undefined : { visibility: "EVERYONE" },
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: { _count: { select: { subsections: true } } },
    }),
    // v1.27.6: shot-count surface migrated from PhotographyShot →
    // BookShot. Read every BookShot on every shot-list card under
    // sections (Photography in particular). The hub card uses the
    // total to show captured/total progress.
    //
    // Design-pass fix: pre-fix this counted EVERY BookShot in the
    // database with no scoping, so a SHOT_LIST card added to any
    // other section (a couple could put one anywhere) silently
    // inflated the Photography card's "X of Y captured" number. Scope
    // to shots whose shot-list's subsection actually lives under the
    // photography section.
    db.bookShot.findMany({
      where: { shotList: { subsection: { section: { slug: "photography" } } } },
      select: { captured: true },
    }),
  ]);
  // v1.38.5: hide deprecated / legacy sections from the index when
  // they have zero subsections. The split phases (P3 / P4 / P5) kept
  // the legacy slugs around so existing user content survives, but
  // empty ones add no value to the index — they just clutter. If the
  // couple has authored content under a legacy slug, the section
  // still renders so the content remains discoverable.
  const LEGACY_SLUGS = new Set([
    "wedding-party",
    "venue",
    "ceremony",
    "reception",
    "logistics",
  ]);
  const sections = allSections.filter(
    (s) => !(LEGACY_SLUGS.has(s.slug) && s._count.subsections === 0),
  );
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
        <div className="max-w-[960px] mx-auto p-4 sm:p-6">
          {sections.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No sections yet. {editable && "Add one above."}
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
              {sections.map((s, idx) => {
                // v1.94.1 / v1.99.7: glyph + description come from
                // SECTION_META (canonical slugs) or the keyword-
                // inferred fallback. Accent is ALWAYS position-driven
                // via `accentFor(idx)` so the grid alternates cleanly
                // — pre-v1.99.7 the slug-hash sometimes clustered 3
                // same-colour cards in a row.
                const canonical = SECTION_META[s.slug];
                const meta = {
                  accent: accentFor(idx),
                  glyph: canonical?.glyph ?? fallbackGlyphFor(s.slug, s.title),
                  description: canonical?.description ?? DEFAULT_META.description,
                };
                const isPhoto = s.slug === "photography";
                const subtitle = isPhoto
                  ? shotsTotal === 0
                    ? "Shot list — no shots yet"
                    : `Shot list — ${shotsCaptured} of ${shotsTotal} captured`
                  : `${s._count.subsections} ${s._count.subsections === 1 ? "page" : "pages"}`;
                return (
                  // Design-pass fix: reorder controls used to float
                  // absolutely over the Link's top-right corner — right
                  // where the "→" affordance invites a tap, so a
                  // near-miss on the tiny ▲/▼ buttons landed on the
                  // Link and navigated away instead of reordering. Now
                  // they're a normal (non-overlapping) row stacked
                  // above the card, so there's no shared hit-area with
                  // the Link at all.
                  <div key={s.id} className="flex flex-col gap-1">
                    {editable && (
                      <SectionReorderControls
                        id={s.id}
                        title={s.title}
                        isFirst={idx === 0}
                        isLast={idx === sections.length - 1}
                      />
                    )}
                  <Link
                    href={`/book/${s.slug}`}
                    className={[
                      meta.accent,
                      // v1.94.1: thicker left border in moss tone reads
                      // as a subtle "tab" — gives the card a stronger
                      // anchor point than the previous all-around soft
                      // border, and the moss accent reads as an active
                      // bookmark visually distinct from card chrome.
                      "border border-border-soft border-l-4 border-l-moss-300",
                      "rounded-lg shadow-sm",
                      "p-5 min-h-[160px]",
                      "flex flex-col items-start gap-3 block",
                      // hover lift + shadow, mirrors the prototype's BookCard
                      "transition-all duration-150",
                      "hover:shadow-md hover:-translate-y-0.5 hover:border-l-moss-500",
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="font-display text-lg font-semibold text-ink-primary leading-tight">
                          {s.title}
                        </div>
                        {/* Design-pass fix: the hub grid previously gave
                            no visual signal that a section is couple-only
                            — only the section page itself carried a
                            suffix. The couple scans this grid specifically
                            to check what the wedding party can/can't see,
                            so mirror the same lock-badge treatment used
                            on individual COUPLE_ONLY cards (CardChrome). */}
                        {s.visibility === "COUPLE_ONLY" && (
                          <span className="text-[10px] uppercase tracking-wider text-marigold-700 bg-marigold-100 border border-marigold-700/20 rounded-full px-2 py-0.5 flex-shrink-0 inline-flex items-center gap-1">
                            <Lock aria-hidden className="w-3 h-3" />
                            Couple
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-secondary leading-snug">
                        {/* v1.94.0: DB-stored section subtitle wins;
                            falls through to the hard-coded SECTION_META
                            description so existing sections without a
                            custom subtitle still read the prototype line. */}
                        {s.subtitle ?? meta.description}
                      </div>
                      <div className="text-[11px] text-ink-tertiary mt-2">
                        {subtitle}
                      </div>
                    </div>
                  </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
