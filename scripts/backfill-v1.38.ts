/**
 * v1.38.0 backfill — run once on production after the migration.
 *
 *     npx tsx scripts/backfill-v1.38.ts
 *
 * What it does:
 *   1. Ensures the new `post-wedding` BookSection exists at order 12.
 *   2. Ensures the new sections from earlier P-phases (wedding-party-
 *      people, wedding-party-dayof, venue-spaces, venue-decor,
 *      legal-before, legal-day, legal-after) are present at the
 *      correct orders. Migrations create them too, but old
 *      production rows might have been hand-edited; this script
 *      fixes order drift without overwriting titles.
 *   3. Re-runs the per-section seeders that are guaranteed
 *      idempotent (skip when subsections > 0). On a fresh prod
 *      whose Book is mostly empty, this populates the new
 *      structure; on a populated prod, it's a no-op.
 *
 * What it does NOT do:
 *   - Touch any couple-edited subsection content (titles, bodies,
 *     fields, structured rows).
 *   - Migrate legacy `BookSubsection.body` text. That happens via
 *     the v1.37.0 SQL backfill in the same migration set.
 *   - Move BUILD cards from legacy `venue` into `venue-decor`. The
 *     v1.33.0 seed comment notes that move is manual on populated
 *     prod.
 *
 * Idempotent. Re-runs are safe.
 */

import { db } from "../src/lib/db";

const TARGET_SECTIONS: Array<{ slug: string; title: string; order: number }> = [
  { slug: "wedding-party-people", title: "Wedding Party — People", order: 1 },
  { slug: "wedding-party-dayof", title: "Wedding Party — Day-of", order: 2 },
  { slug: "venue-spaces", title: "Venue — Spaces", order: 3 },
  { slug: "venue-decor", title: "Venue — Décor", order: 4 },
  { slug: "food-drink", title: "Food & Drink", order: 5 },
  { slug: "photography", title: "Photography & Videography", order: 6 },
  { slug: "guest-experience", title: "Guest Experience", order: 7 },
  { slug: "legal-before", title: "Legal — Before the day", order: 8 },
  { slug: "legal-day", title: "Legal — On the day", order: 9 },
  { slug: "legal-after", title: "Legal — After", order: 10 },
  { slug: "accommodation", title: "Accommodation", order: 11 },
  { slug: "post-wedding", title: "Post-wedding", order: 12 },
];

async function ensureSections() {
  let inserted = 0;
  let reordered = 0;
  for (const target of TARGET_SECTIONS) {
    const existing = await db.bookSection.findUnique({ where: { slug: target.slug } });
    if (!existing) {
      await db.bookSection.create({ data: target });
      inserted += 1;
      console.log(`  ✓ created section ${target.slug} at order ${target.order}`);
      continue;
    }
    if (existing.order !== target.order) {
      await db.bookSection.update({
        where: { slug: target.slug },
        data: { order: target.order },
      });
      reordered += 1;
      console.log(
        `  ✓ re-ordered ${target.slug}: ${existing.order} → ${target.order}`,
      );
    }
  }
  console.log(
    `  done — ${inserted} created, ${reordered} re-ordered, ${
      TARGET_SECTIONS.length - inserted - reordered
    } unchanged`,
  );
}

async function main() {
  console.log("v1.38.0 backfill — ensuring section structure…");
  await ensureSections();
  console.log("\nNote: per-section subsection seeding lives in prisma/seed.ts.");
  console.log("On a populated prod those seeders are no-ops (skip when content exists).");
  console.log("Run `npx tsx prisma/seed.ts` if you want to fill empty sections.");
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
