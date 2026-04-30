import { PrismaClient, UserRole, PermissionLevel, RsvpStatus, Side, Priority, TaskStatus, TaskType } from "@prisma/client";

const db = new PrismaClient();

const EDIT_ALL_SECTIONS = [
  "tasks", "questions", "schedule", "suppliers",
  "guests", "seating", "songs", "files", "book", "settings",
  "budget", "payments",
];

const NON_COUPLE_SECTIONS = [
  "tasks", "questions", "schedule", "suppliers",
  "guests", "seating", "songs", "files", "book",
];

type SeedUser = {
  envKey: string;
  fallback: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isCouple: boolean;
};

const USERS: SeedUser[] = [
  { envKey: "USER_JAMIE_EMAIL",   fallback: "jamie@example.com",   firstName: "Jamie",   lastName: "Spencer",       role: UserRole.COUPLE,        isCouple: true  },
  { envKey: "USER_BRYONY_EMAIL",  fallback: "bryony@example.com",  firstName: "Bryony",  lastName: "Olwyn-Davis",   role: UserRole.COUPLE,        isCouple: true  },
  { envKey: "USER_JOSH_EMAIL",    fallback: "josh@example.com",    firstName: "Joshua",  lastName: "Dickson",       role: UserRole.WEDDING_PARTY, isCouple: false },
  { envKey: "USER_AIMEE_EMAIL",   fallback: "aimee@example.com",   firstName: "Aimee",   lastName: "Hollingsworth", role: UserRole.WEDDING_PARTY, isCouple: false },
  { envKey: "USER_PLANNER_EMAIL", fallback: "planner@example.com", firstName: "Bespoke", lastName: "Weddings",      role: UserRole.PLANNER,       isCouple: false },
];

async function seedUsersAndPermissions() {
  for (const u of USERS) {
    const email = (process.env[u.envKey] ?? u.fallback).toLowerCase();
    const name = `${u.firstName} ${u.lastName}`;
    const user = await db.user.upsert({
      where: { email },
      create: { email, name, firstName: u.firstName, lastName: u.lastName, role: u.role, isCouple: u.isCouple },
      update: { name, firstName: u.firstName, lastName: u.lastName, role: u.role, isCouple: u.isCouple },
    });

    const sections = u.isCouple ? EDIT_ALL_SECTIONS : NON_COUPLE_SECTIONS;
    for (const section of sections) {
      await db.permission.upsert({
        where: { userId_section: { userId: user.id, section } },
        create: { userId: user.id, section, level: PermissionLevel.EDIT },
        update: { level: PermissionLevel.EDIT },
      });
    }
    if (!u.isCouple) {
      for (const section of ["budget", "payments"]) {
        await db.permission.upsert({
          where: { userId_section: { userId: user.id, section } },
          create: { userId: user.id, section, level: PermissionLevel.NONE },
          update: { level: PermissionLevel.NONE },
        });
      }
    }
    console.log(`  ✓ user ${email} (${u.role}${u.isCouple ? ", couple" : ""})`);
  }
}

async function seedScheduleEvents() {
  const day = "2026-09-26";
  // v1.30.5: persona-based `audience` was dropped. Resolve real user IDs
  // for the seeded couple + wedding-party so the events arrive with
  // realistic `attendeeIds` instead of legacy persona strings.
  const allUsers = await db.user.findMany({ select: { id: true, isCouple: true, role: true } });
  const coupleIds = allUsers.filter((u) => u.isCouple).map((u) => u.id);
  const partyIds = allUsers.filter((u) => u.role === "WEDDING_PARTY").map((u) => u.id);
  const everyone = allUsers.map((u) => u.id);

  const events: Array<{
    title: string;
    startTime: string;
    attendeeIds: string[];
    order: number;
  }> = [
    { title: "Bridal suite check-in", startTime: `${day}T12:00:00Z`, attendeeIds: [...coupleIds, ...partyIds], order: 1 },
    { title: "Arrival",               startTime: `${day}T13:00:00Z`, attendeeIds: everyone,                  order: 2 },
    { title: "Ceremony",              startTime: `${day}T14:00:00Z`, attendeeIds: everyone,                  order: 3 },
    { title: "Drinks Reception",      startTime: `${day}T14:30:00Z`, attendeeIds: everyone,                  order: 4 },
    { title: "Wedding Breakfast",     startTime: `${day}T16:00:00Z`, attendeeIds: everyone,                  order: 5 },
    { title: "Speeches",              startTime: `${day}T18:00:00Z`, attendeeIds: everyone,                  order: 6 },
    { title: "First Dance",           startTime: `${day}T19:30:00Z`, attendeeIds: everyone,                  order: 7 },
    { title: "Evening Buffet",        startTime: `${day}T20:00:00Z`, attendeeIds: everyone,                  order: 8 },
  ];
  for (const e of events) {
    const existing = await db.scheduleEvent.findFirst({ where: { title: e.title, startTime: new Date(e.startTime) } });
    if (existing) continue;
    await db.scheduleEvent.create({
      data: {
        title: e.title,
        startTime: new Date(e.startTime),
        location: "Alveston Manor",
        attendeeIds: e.attendeeIds,
        order: e.order,
      },
    });
  }
  console.log(`  ✓ ${events.length} schedule events`);
}

async function seedSampleTasks() {
  const jamie = await db.user.findUnique({ where: { email: (process.env.USER_JAMIE_EMAIL ?? "jamie@example.com").toLowerCase() } });
  if (!jamie) return;
  const samples = [
    { title: "Confirm final guest count",                priority: Priority.HIGH, dueDate: new Date("2026-09-19T12:00:00Z") },
    { title: "Pay venue balance",                        priority: Priority.HIGH, dueDate: new Date("2026-08-26T12:00:00Z") },
    { title: "Collect flowers from Paintbox Blooms",     priority: Priority.MEDIUM, dueDate: new Date("2026-09-23T09:00:00Z") },
    { title: "Confirm suit fittings with Slaters",       priority: Priority.MEDIUM, dueDate: new Date("2026-04-30T12:00:00Z") },
  ];
  for (const t of samples) {
    const exists = await db.task.findFirst({ where: { title: t.title } });
    if (exists) continue;
    await db.task.create({
      data: { ...t, type: TaskType.TASK, status: TaskStatus.OPEN, assigneeId: jamie.id },
    });
  }
  console.log(`  ✓ ${samples.length} sample tasks`);
}

async function seedSampleHouseholds() {
  const existing = await db.household.count();
  if (existing > 0) return;
  const h = await db.household.create({ data: { name: "The Spencer Family", side: Side.GROOM } });
  await db.guest.createMany({
    data: [
      { householdId: h.id, firstName: "Robert", lastName: "Spencer", rsvp: RsvpStatus.PENDING, side: Side.GROOM },
      { householdId: h.id, firstName: "Margaret", lastName: "Spencer", rsvp: RsvpStatus.PENDING, side: Side.GROOM },
    ],
  });
  console.log(`  ✓ 1 sample household (2 pending guests)`);
}

async function seedBookSections() {
  // Prototype's 7 canonical sections (orders 1–7). Re-running the seed
  // is upsert-safe: existing rows have their title + order refreshed
  // without touching subsections, and the 5 sections that didn't ship
  // in v1.4.0's seed are added.
  //
  // The 3 v1.4.0 legacy slugs (ceremony / reception / logistics) are
  // kept at orders 8–10 so they don't conflict with the prototype set
  // and still appear at the bottom of the hub. The user can delete
  // them via the UI later if they want a clean 7-card hub. Their
  // content (if any subsections were added) is preserved.
  const sections = [
    // Prototype-aligned set
    { slug: "wedding-party",     title: "Wedding Party",             order: 1 },
    { slug: "venue",             title: "Venue, Décor & Setup",      order: 2 },
    { slug: "food-drink",        title: "Food & Drink",              order: 3 },
    // Photography is a special section — `/book/photography` resolves
    // to a dedicated route with a checklist UI rather than the generic
    // subsection editor. The BookSection row exists so it appears as a
    // card on /book.
    { slug: "photography",       title: "Photography & Videography", order: 4 },
    { slug: "guest-experience",  title: "Guest Experience",          order: 5 },
    { slug: "legal-admin",       title: "Legal & Admin",             order: 6 },
    { slug: "accommodation",     title: "Accommodation",             order: 7 },
    // Legacy v1.4.0 sections — pushed to the bottom of the order so
    // the prototype's 7 lead. Kept (rather than deleted) because they
    // may carry user-added subsection content from prior versions.
    { slug: "ceremony",          title: "Ceremony",                  order: 8 },
    { slug: "reception",         title: "Reception",                 order: 9 },
    { slug: "logistics",         title: "Logistics",                 order: 10 },
  ];
  for (const s of sections) {
    await db.bookSection.upsert({
      where: { slug: s.slug },
      create: s,
      update: { title: s.title, order: s.order },
    });
  }
  console.log(`  ✓ ${sections.length} book sections`);
}

// Seed the Wedding Party subsections only on first run — never overwrite
// real notes the couple has added.
async function seedWeddingPartySubsections() {
  const section = await db.bookSection.findUnique({ where: { slug: "wedding-party" } });
  if (!section) return;
  const existing = await db.bookSubsection.count({ where: { sectionId: section.id } });
  if (existing > 0) {
    console.log(`  ✓ wedding party subsections already present (${existing}); skipping seed`);
    return;
  }
  const subs = [
    { slug: "roles",          title: "Roles",                order: 1, body: "Best Man · Joshua Dickson\nMaid of Honour · Aimee Hollingsworth\nGroomsmen · …\nBridesmaids · …" },
    { slug: "outfits",        title: "Outfits",              order: 2, body: "Suits via Slaters — fitting on …\nDresses ordered from …\nBouquets and buttonholes from Paintbox Blooms" },
    { slug: "ring-keepers",   title: "Ring keepers",         order: 3, body: "Joshua holds both rings until the ceremony.\nHand-off in the groomsmen room at 1:30pm.\nConfirm with Aimee day-of." },
    { slug: "stag-hen",       title: "Stag & Hen",           order: 4, body: "Stag · …\nHen · …" },
    { slug: "day-of",         title: "Day-of logistics",     order: 5, body: "Bridesmaids arrive at the bridal suite 11:00.\nGroomsmen arrive at the manor 12:30.\nPhotographer with the groomsmen 12:45.\nPhotographer with the bridesmaids 13:00." },
  ];
  await db.bookSubsection.createMany({
    data: subs.map((s) => ({ ...s, sectionId: section.id })),
  });
  console.log(`  ✓ ${subs.length} wedding party subsections`);
}

// v1.30.5: PhotographyShot seed removed. Data was migrated to BookShot
// under a SHOT_LIST card on the Photography section in v1.27.6; the
// legacy table was dropped in this release. Sample shots can be added
// via the UI (Wedding Book → Photography → Add card → Shot list) or via
// a follow-up BookShot seeder if recurring sample data becomes useful.

// v1.30.5: seed the four default navigation tags (Music · Ceremony ·
// Reception · Guests). User-configurable via Settings — couple can
// rename / add / remove. Idempotent upsert by slug.
async function seedNavTags() {
  const tags = [
    { slug: "music",     name: "Music",     route: "/songs",            order: 1 },
    { slug: "ceremony",  name: "Ceremony",  route: "/seating/ceremony", order: 2 },
    { slug: "reception", name: "Reception", route: null,                order: 3 },
    { slug: "guests",    name: "Guests",    route: "/guests",           order: 4 },
  ];
  for (const t of tags) {
    await db.navTag.upsert({
      where: { slug: t.slug },
      create: t,
      update: { name: t.name, route: t.route, order: t.order },
    });
  }
  console.log(`  ✓ ${tags.length} nav tags`);
}

// v1.20.0: bootstrap the WeddingSettings singleton from env vars on
// first run. Re-running the seed is upsert-safe: existing fields stay,
// only `updatedAt` ticks. To reset the row to env defaults, delete it
// in Prisma Studio first.
async function seedWeddingSettings() {
  const dateStr = process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z";
  const data = {
    weddingDate: new Date(dateStr),
    ceremonyTime: process.env.WEDDING_CEREMONY_TIME ?? "2:00pm ceremony",
    venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
    venueAddress: process.env.WEDDING_VENUE_ADDRESS ?? null,
    coupleLabel: process.env.WEDDING_COUPLE ?? "Spencer · Olwyn-Davis Wedding",
    coupleShort: process.env.WEDDING_COUPLE_SHORT ?? "Jamie & Bryony's Wedding",
    brideFirst: process.env.WEDDING_BRIDE_FIRST ?? "Bryony",
    groomFirst: process.env.WEDDING_GROOM_FIRST ?? "Jamie",
  };
  await db.weddingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    // Update venue + ceremony defaults from env on re-seed, but
    // preserve any user-edited copy. We do that by NOT updating
    // anything on re-run — once the row exists, Settings UI is the
    // source of truth.
    update: {},
  });
  console.log(`  ✓ wedding settings (${data.coupleLabel})`);
}

// v1.31.0: seed three sample BUILD cards under the legacy `venue`
// section (P3 will move them into `venue-decor` once that section
// exists). Idempotent: skips when there's already at least one
// BookBuildCard in the DB. Real cards added via the UI are never
// overwritten by re-seed.
async function seedBuildCards() {
  const existing = await db.bookBuildCard.count();
  if (existing > 0) {
    console.log(`  ✓ build cards already present (${existing}); skipping seed`);
    return;
  }
  const venue = await db.bookSection.findUnique({ where: { slug: "venue" } });
  if (!venue) {
    console.log(`  · no 'venue' section found; skipping build seed`);
    return;
  }
  const drafts = [
    {
      slug: "centerpieces",
      title: "Centerpieces",
      materials: [
        { name: "Mason jars", quantity: 14, unit: "ea", costPence: 1400, supplier: "Hobbycraft" },
        { name: "Eucalyptus stems", quantity: 30, unit: "stems", costPence: 1500, supplier: "Paintbox Blooms" },
        { name: "Twine", quantity: 1, unit: "spool", costPence: 350 },
      ],
      quantityNeeded: 14,
      estimatedMinutesPerUnit: 10,
    },
    {
      slug: "handmade-signage",
      title: "Handmade signage (welcome, directional)",
      materials: [],
      quantityNeeded: 5,
      estimatedMinutesPerUnit: 45,
    },
    {
      slug: "place-cards",
      title: "Place cards / name places",
      materials: [],
      quantityNeeded: 80,
      estimatedMinutesPerUnit: 4,
    },
  ];
  // Use the next available order so we don't clash with anything
  // existing under venue.
  const last = await db.bookSubsection.findFirst({
    where: { sectionId: venue.id },
    orderBy: { order: "desc" },
  });
  let nextOrder = (last?.order ?? -1) + 1;
  for (const d of drafts) {
    // If a subsection with this slug already exists, skip — the user
    // may have already created one manually with the same slug.
    const existingSub = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: venue.id, slug: d.slug } },
    });
    if (existingSub) continue;
    const sub = await db.bookSubsection.create({
      data: {
        sectionId: venue.id,
        slug: d.slug,
        title: d.title,
        kind: "BUILD",
        order: nextOrder++,
      },
    });
    const card = await db.bookBuildCard.create({
      data: {
        subsectionId: sub.id,
        quantityNeeded: d.quantityNeeded,
        estimatedMinutesPerUnit: d.estimatedMinutesPerUnit,
      },
    });
    let materialOrder = 0;
    for (const m of d.materials) {
      await db.bookBuildMaterial.create({
        data: {
          cardId: card.id,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          costPence: m.costPence,
          supplier: m.supplier,
          order: materialOrder++,
        },
      });
    }
  }
  console.log(`  ✓ ${drafts.length} sample build cards`);
}

// v1.32.0: seed sample MENU + BAR cards under the Food & Drink
// section. Idempotent: skips when there's already at least one
// BookMenuCard or BookBarCard in the DB. Real cards added via the
// UI are never overwritten by re-seed.
async function seedFoodDrinkCards() {
  const existingMenu = await db.bookMenuCard.count();
  const existingBar = await db.bookBarCard.count();
  if (existingMenu > 0 && existingBar > 0) {
    console.log(`  ✓ menu + bar cards already present; skipping seed`);
    return;
  }
  const fnd = await db.bookSection.findUnique({ where: { slug: "food-drink" } });
  if (!fnd) {
    console.log(`  · no 'food-drink' section found; skipping menu+bar seed`);
    return;
  }
  const last = await db.bookSubsection.findFirst({
    where: { sectionId: fnd.id },
    orderBy: { order: "desc" },
  });
  let nextOrder = (last?.order ?? -1) + 1;

  // Wedding breakfast — 3 courses × 2 options.
  if (existingMenu === 0) {
    const breakfastSlug = "wedding-breakfast";
    const breakfastExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: breakfastSlug } },
    });
    if (!breakfastExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: breakfastSlug,
          title: "Wedding breakfast",
          kind: "MENU",
          order: nextOrder++,
        },
      });
      const card = await db.bookMenuCard.create({
        data: {
          subsectionId: sub.id,
          serviceType: "Plated",
          serviceTime: "1:30pm wedding breakfast",
          pricePerHeadPence: 8500,
        },
      });
      const courses = [
        {
          courseLabel: "Starter",
          options: [
            { label: "Tomato soup", description: "Roasted vine tomato, basil oil", dietary: ["V", "GF"] },
            { label: "Prawn cocktail", description: "Marie rose, baby gem", dietary: [] },
          ],
        },
        {
          courseLabel: "Main",
          options: [
            { label: "Roast beef", description: "Yorkshire pud, red wine jus", dietary: [] },
            { label: "Mushroom wellington", description: "Wild mushroom, puff pastry", dietary: ["V"], isVegetarianMain: true },
          ],
        },
        {
          courseLabel: "Dessert",
          options: [
            { label: "Sticky toffee pudding", description: "Vanilla ice cream", dietary: [] },
            { label: "Lemon posset", description: "Shortbread", dietary: ["V"] },
          ],
        },
      ];
      let courseOrder = 0;
      for (const c of courses) {
        const courseRow = await db.bookMenuCourse.create({
          data: { cardId: card.id, courseLabel: c.courseLabel, order: courseOrder++ },
        });
        let optionOrder = 0;
        for (const o of c.options) {
          await db.bookMenuOption.create({
            data: {
              courseId: courseRow.id,
              label: o.label,
              description: o.description,
              dietary: o.dietary,
              isVegetarianMain: ("isVegetarianMain" in o && o.isVegetarianMain) === true,
              order: optionOrder++,
            },
          });
        }
      }
    }
  }

  // Bar plan — sample items by category.
  if (existingBar === 0) {
    const barSlug = "drinks-and-bar";
    const barExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: barSlug } },
    });
    if (!barExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: barSlug,
          title: "Drinks & bar",
          kind: "BAR",
          order: nextOrder++,
        },
      });
      const bar = await db.bookBarCard.create({
        data: {
          subsectionId: sub.id,
          barType: "Drinks tab",
          tabLimitPence: 200000,
          toastDrink: "Prosecco",
        },
      });
      const items = [
        { category: "Reception drink", name: "Prosecco", quantityPlanned: 30, unit: "bottles", costPence: 30000 },
        { category: "Wine", name: "House white (Pinot grigio)", quantityPlanned: 25, unit: "bottles", costPence: 25000 },
        { category: "Wine", name: "House red (Merlot)", quantityPlanned: 20, unit: "bottles", costPence: 20000 },
        { category: "Beer", name: "Bottled lager", quantityPlanned: 60, unit: "bottles", costPence: 18000 },
        { category: "Soft", name: "Soft drinks selection", quantityPlanned: 24, unit: "L", costPence: 4800 },
      ];
      let itemOrder = 0;
      for (const i of items) {
        await db.bookBarItem.create({
          data: { ...i, cardId: bar.id, order: itemOrder++ },
        });
      }
    }
  }

  console.log(`  ✓ menu + bar cards seeded`);
}

async function main() {
  console.log("Seeding Wedding Hub…");
  await seedUsersAndPermissions();
  await seedWeddingSettings();
  await seedScheduleEvents();
  await seedSampleTasks();
  await seedSampleHouseholds();
  await seedBookSections();
  await seedWeddingPartySubsections();
  await seedNavTags();
  await seedBuildCards();
  await seedFoodDrinkCards();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
