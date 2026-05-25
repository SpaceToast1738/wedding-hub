/**
 * v1.38.0 — Wedding Book sample-content backfill (sections + subpages).
 *
 *     npx tsx scripts/seed-samples-only.ts
 *
 * Use this on a populated production DB to bring the Book structure
 * up to v1.38.0 (sections + sample subpages) **without** touching
 * any of your existing data. Specifically this script:
 *
 *   ✓ Ensures all 12 BookSection rows exist with the right ordering
 *     (re-orders only — never renames a section the couple has
 *     manually retitled).
 *   ✓ Fills any **empty** section with the sample subpages from the
 *     v1.31.0 → v1.38.0 seed updates (Wedding Party — People with
 *     six OUTFIT cards, Venue — Spaces with five SETUP cards, Legal
 *     — Before/Day/After with their checklists, Accommodation with
 *     four STAY + one LODGING_GUIDE, Post-wedding with four
 *     subpages, etc.). Sections that already have content are
 *     skipped — your authored subpages are never overwritten.
 *
 * What this script does **NOT** touch:
 *
 *   ✗ Users / permissions
 *   ✗ Tasks (won't add the 4 sample tasks the full seed adds)
 *   ✗ Schedule events (won't add the 8 sample day-of events)
 *   ✗ Guests / households / seating
 *   ✗ Songs, payments, suppliers, files, audit logs
 *   ✗ Any section that already has at least one subpage
 *
 * Idempotent — re-runs are safe, no-ops on already-populated
 * sections.
 */

import { PrismaClient } from "@prisma/client";
import {
  seedAccommodationCards,
  seedBuildCards,
  seedFoodDrinkCards,
  seedGuestExperienceCards,
  seedPhotographyCards,
  seedPostWeddingSection,
  seedVenueSpacesAndDecor,
  seedWeddingPartyPeopleAndDayof,
} from "../prisma/seed";

// Local PrismaClient — mirrors prisma/seed.ts. Doesn't import from
// src/lib/db so this script can run inside the production image
// (where src/ is bundled into Next standalone, not as raw JS).
const db = new PrismaClient();

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
  console.log("→ Ensuring section rows + ordering…");
  let created = 0;
  let reordered = 0;
  for (const t of TARGET_SECTIONS) {
    const existing = await db.bookSection.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      // Section doesn't exist on prod — create it. Migration 20260430070000
      // already inserted wedding-party-people; migration 20260430100000
      // inserted post-wedding; everything else needs creating here.
      await db.bookSection.create({ data: t });
      created += 1;
      console.log(`  ✓ created ${t.slug} at order ${t.order}`);
      continue;
    }
    if (existing.order !== t.order) {
      await db.bookSection.update({
        where: { slug: t.slug },
        data: { order: t.order },
      });
      reordered += 1;
      console.log(`  ✓ re-ordered ${t.slug}: ${existing.order} → ${t.order}`);
    }
  }
  console.log(
    `  done — ${created} created, ${reordered} re-ordered, ${TARGET_SECTIONS.length - created - reordered} unchanged`,
  );
}

async function main() {
  console.log("v1.38.0 sample-content backfill — sections + subpages only");
  console.log("(skips users / tasks / schedule / guests / seating)\n");

  await ensureSections();

  // Section-level seeders. Each one is per-section skip-if-content-
  // exists, so re-runs and populated sections are no-ops.
  console.log("\n→ Filling empty sections with sample subpages…");
  // v1.38.5: skip legacy seedWeddingPartySubsections — duplicates
  // wedding-party-people / -dayof. venue-decor seeder runs before
  // BUILD so non-BUILD subsections land first (see seed.ts main()).
  await seedVenueSpacesAndDecor();
  await seedBuildCards();
  await seedFoodDrinkCards();
  // v2.0.0: seedLegalSections retired with LEGAL kind.
  await seedWeddingPartyPeopleAndDayof();
  await seedAccommodationCards();
  await seedPhotographyCards();
  await seedGuestExperienceCards();
  await seedPostWeddingSection();

  console.log("\nDone. Open /book to verify all 12 section cards appear.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
