/**
 * v1.38.1 — Wedding Book RESET (destructive).
 *
 *     docker compose exec -e CONFIRM_RESET_BOOK=yes web \
 *       npx tsx scripts/reset-book.ts
 *
 * **DELETES** every Book row — every section, every subsection, every
 * per-kind card (FIELD / RECIPE / SHOT_LIST / OUTFIT / BUILD / MENU /
 * BAR / SETUP / LEGAL / STAY / LODGING_GUIDE) — and re-creates the
 * full seeded structure from scratch. Use when the Book is in a state
 * you'd rather start over from than fix in place.
 *
 * What this script DELETES:
 *   - BookSection (all rows) — cascades to:
 *     - BookSubsection
 *       - BookFieldDef
 *       - BookRecipe + BookRecipeStep
 *       - BookShotList + BookShot
 *       - BookOutfitCard + BookOutfit
 *       - BookBuildCard + BookBuildMaterial + BookBuildSession
 *       - BookMenuCard + BookMenuCourse + BookMenuOption
 *       - BookBarCard + BookBarItem
 *       - BookSetupCard + BookSetupItem
 *       - BookLegalCard + BookLegalItem
 *       - BookStayCard
 *       - BookLodgingCard + BookLodgingItem
 *
 * What this script DOES NOT touch:
 *   ✓ Users / permissions / sessions
 *   ✓ Tasks (the Task ↔ BookSection m2m link rows go away, but Tasks
 *     themselves survive — re-link via the Tasks page)
 *   ✓ Guests / households / seating / song requests
 *   ✓ Schedule events
 *   ✓ Suppliers / contracts / payments / budget categories /
 *     budget lines (BudgetLine.buildCards back-references go to zero
 *     until new BUILD cards are created with a budget link)
 *   ✓ Files (BookLegalItem.fileId → File.onDelete = SetNull means
 *     items disappearing leaves the File rows intact)
 *   ✓ Audit logs (entries referencing the deleted entity ids stay
 *     as historic records — they just point at ids that no longer
 *     resolve)
 *
 * **TAKE A DATABASE BACKUP FIRST.** A pg_dump is your friend:
 *
 *     docker compose exec db pg_dump -U postgres wedding_hub \
 *       > wedding-hub-pre-book-reset.sql
 *
 * Run order:
 *   1. (Optional but strongly recommended) take a pg_dump backup.
 *   2. Run this script with `CONFIRM_RESET_BOOK=yes` set.
 *   3. Refresh /book — every section is repopulated with seed
 *      defaults (and any couple-edited content is gone).
 */

import { PrismaClient } from "@prisma/client";
import {
  seedAccommodationCards,
  seedBuildCards,
  seedFoodDrinkCards,
  seedGuestExperienceCards,
  seedLegalSections,
  seedPhotographyCards,
  seedPostWeddingSection,
  seedVenueSpacesAndDecor,
  seedWeddingPartyPeopleAndDayof,
  seedWeddingPartySubsections,
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

async function summariseBeforeDelete() {
  const [sections, subsections, fields, recipes, shots, outfits, builds, menus, bars, setups, legals, stays, lodgings] =
    await Promise.all([
      db.bookSection.count(),
      db.bookSubsection.count(),
      db.bookFieldDef.count(),
      db.bookRecipe.count(),
      db.bookShot.count(),
      db.bookOutfitCard.count(),
      db.bookBuildCard.count(),
      db.bookMenuCard.count(),
      db.bookBarCard.count(),
      db.bookSetupCard.count(),
      db.bookLegalCard.count(),
      db.bookStayCard.count(),
      db.bookLodgingCard.count(),
    ]);
  console.log("\nCurrent Book state — about to be deleted:");
  console.log(`  ${sections} sections`);
  console.log(`  ${subsections} subsections (subpages)`);
  console.log(`  ${fields} FIELD defs · ${recipes} RECIPE cards · ${shots} SHOT_LIST shots`);
  console.log(`  ${outfits} OUTFIT cards · ${builds} BUILD cards · ${menus} MENU cards`);
  console.log(`  ${bars} BAR cards · ${setups} SETUP cards · ${legals} LEGAL cards`);
  console.log(`  ${stays} STAY cards · ${lodgings} LODGING_GUIDE cards`);
  console.log("");
}

async function deleteEverything() {
  // BookSection has a cascade chain that pulls every Book row down
  // with it. One deleteMany on the parent is enough.
  console.log("→ Deleting all BookSection rows (cascade)…");
  const r = await db.bookSection.deleteMany({});
  console.log(`  ✓ deleted ${r.count} sections (everything below cascades)`);
}

async function recreateSections() {
  console.log("\n→ Re-creating section rows…");
  for (const t of TARGET_SECTIONS) {
    await db.bookSection.create({ data: t });
    console.log(`  ✓ ${t.slug} at order ${t.order}`);
  }
}

async function reseed() {
  console.log("\n→ Filling sections with seed defaults…");
  await seedWeddingPartySubsections();
  await seedBuildCards();
  await seedFoodDrinkCards();
  await seedVenueSpacesAndDecor();
  await seedLegalSections();
  await seedWeddingPartyPeopleAndDayof();
  await seedAccommodationCards();
  await seedPhotographyCards();
  await seedGuestExperienceCards();
  await seedPostWeddingSection();
}

async function main() {
  const confirm = process.env.CONFIRM_RESET_BOOK;
  if (confirm !== "yes") {
    console.error(
      "\n⚠  reset-book.ts will DELETE every Book row and re-seed from scratch.\n" +
        "    Re-run with CONFIRM_RESET_BOOK=yes set if you've taken a backup\n" +
        "    and you really mean it. Take a backup first:\n\n" +
        "        docker compose exec db pg_dump -U postgres wedding_hub \\\n" +
        "          > wedding-hub-pre-book-reset.sql\n",
    );
    process.exit(1);
  }

  console.log("v1.38.1 — Book reset (destructive). Proceeding because CONFIRM_RESET_BOOK=yes.");
  await summariseBeforeDelete();
  await deleteEverything();
  await recreateSections();
  await reseed();
  console.log("\nDone. Open /book to verify the re-seeded structure.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
