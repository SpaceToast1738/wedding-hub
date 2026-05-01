import { PrismaClient, UserRole, PermissionLevel, RsvpStatus, Side, Priority, TaskStatus, TaskType, Prisma } from "@prisma/client";

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
  // v1.41.0: switched from raw User-id arrays (`attendeeIds`) to the
  // polymorphic ref shape (`attendeeRefs`). Built-in groups
  // ("everyone", "couple", "wedding-party-role") let the seed stay
  // declarative — it doesn't have to look up user ids first. The
  // server resolves each ref to a User[] at read time.

  const events: Array<{
    title: string;
    startTime: string;
    attendeeRefs: string[];
    order: number;
  }> = [
    { title: "Bridal suite check-in", startTime: `${day}T12:00:00Z`, attendeeRefs: ["builtin:couple", "builtin:wedding-party-role"], order: 1 },
    { title: "Arrival",               startTime: `${day}T13:00:00Z`, attendeeRefs: ["builtin:everyone"], order: 2 },
    { title: "Ceremony",              startTime: `${day}T14:00:00Z`, attendeeRefs: ["builtin:everyone"], order: 3 },
    { title: "Drinks Reception",      startTime: `${day}T14:30:00Z`, attendeeRefs: ["builtin:everyone"], order: 4 },
    { title: "Wedding Breakfast",     startTime: `${day}T16:00:00Z`, attendeeRefs: ["builtin:everyone"], order: 5 },
    { title: "Speeches",              startTime: `${day}T18:00:00Z`, attendeeRefs: ["builtin:everyone"], order: 6 },
    { title: "First Dance",           startTime: `${day}T19:30:00Z`, attendeeRefs: ["builtin:everyone"], order: 7 },
    { title: "Evening Buffet",        startTime: `${day}T20:00:00Z`, attendeeRefs: ["builtin:everyone"], order: 8 },
  ];
  for (const e of events) {
    const existing = await db.scheduleEvent.findFirst({ where: { title: e.title, startTime: new Date(e.startTime) } });
    if (existing) continue;
    await db.scheduleEvent.create({
      data: {
        title: e.title,
        startTime: new Date(e.startTime),
        location: "Alveston Manor",
        attendeeRefs: e.attendeeRefs,
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
  // v1.33.0: venue split — venue-spaces / venue-decor at 3 / 4.
  // v1.34.0: legal split — legal-before / legal-day / legal-after at
  //   9 / 10 / 11. Legacy `legal-admin` stays at order 8 with any
  //   user-added content; the /book index hides empty legacy sections.
  // v1.35.0: wedding-party split — wedding-party-people /
  //   wedding-party-dayof at 1 / 2. Legacy `wedding-party` slug stays
  //   in place (with any couple-edited subsections) and is pushed
  //   towards the back as a deprecated section.
  // Existing sections shift down; the upsert's `update: { order }`
  // re-numbers them on re-run.
  const sections = [
    // Prototype-aligned set
    { slug: "wedding-party-people", title: "Wedding Party — People",   order: 1 },
    { slug: "wedding-party-dayof",  title: "Wedding Party — Day-of",   order: 2 },
    { slug: "venue-spaces",      title: "Venue — Spaces",            order: 3 },
    { slug: "venue-decor",       title: "Venue — Décor",             order: 4 },
    { slug: "food-drink",        title: "Food & Drink",              order: 5 },
    // Photography is a special section — `/book/photography` resolves
    // to a dedicated route with a checklist UI rather than the generic
    // subsection editor. The BookSection row exists so it appears as a
    // card on /book.
    { slug: "photography",       title: "Photography & Videography", order: 6 },
    { slug: "guest-experience",  title: "Guest Experience",          order: 7 },
    { slug: "legal-before",      title: "Legal — Before the day",    order: 8 },
    { slug: "legal-day",         title: "Legal — On the day",        order: 9 },
    { slug: "legal-after",       title: "Legal — After",             order: 10 },
    { slug: "accommodation",     title: "Accommodation",             order: 11 },
    { slug: "post-wedding",      title: "Post-wedding",               order: 12 },
    // Deprecated split sources — pushed to the bottom so the new
    // sections lead. Kept (not deleted) because they may carry
    // couple-edited subsections from earlier releases. The /book
    // index hides legacy sections that have zero subsections.
    { slug: "wedding-party",     title: "Wedding Party",             order: 12 },
    { slug: "venue",             title: "Venue, Décor & Setup",      order: 13 },
    { slug: "legal-admin",       title: "Legal & Admin",             order: 14 },
    // Legacy v1.4.0 sections — pushed to the bottom of the order so
    // the prototype's 7 lead. Kept (rather than deleted) because they
    // may carry user-added subsection content from prior versions.
    { slug: "ceremony",          title: "Ceremony",                  order: 15 },
    { slug: "reception",         title: "Reception",                 order: 16 },
    { slug: "logistics",         title: "Logistics",                 order: 17 },
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
export async function seedWeddingPartySubsections() {
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

// v1.31.0: seed three sample BUILD cards.
// v1.38.5: target `venue-decor` (the v1.33.0 split target) instead
// of legacy `venue` — the original P1 seeder pre-dated the venue
// split and never got migrated, leaving the BUILD cards orphaned
// under the deprecated section. Idempotent: skips when there's
// already at least one BookBuildCard in the DB. Real cards added
// via the UI are never overwritten by re-seed.
export async function seedBuildCards() {
  const existing = await db.bookBuildCard.count();
  if (existing > 0) {
    console.log(`  ✓ build cards already present (${existing}); skipping seed`);
    return;
  }
  // Prefer venue-decor; fall back to legacy venue for installs that
  // still have it. The BookSection seeder creates venue-decor on
  // every fresh seed, so the fallback is theoretical safety.
  const venue =
    (await db.bookSection.findUnique({ where: { slug: "venue-decor" } })) ??
    (await db.bookSection.findUnique({ where: { slug: "venue" } }));
  if (!venue) {
    console.log(`  · no 'venue-decor' or 'venue' section found; skipping build seed`);
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
export async function seedFoodDrinkCards() {
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

  // v1.38.4: kids menu — single MENU card with one course, two
  // options. isKidsMeal=true on each option so the catering brief
  // surfaces it correctly.
  if (existingMenu === 0) {
    const kidsSlug = "kids-menu";
    const kidsExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: kidsSlug } },
    });
    if (!kidsExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: kidsSlug,
          title: "Kids menu",
          kind: "MENU",
          order: nextOrder++,
        },
      });
      const card = await db.bookMenuCard.create({
        data: {
          subsectionId: sub.id,
          serviceType: "Plated",
          serviceTime: "Same as wedding breakfast",
          pricePerHeadPence: 3500,
          notes: "For under-12s. Confirm count + ages with venue 2 weeks out.",
        },
      });
      const course = await db.bookMenuCourse.create({
        data: { cardId: card.id, courseLabel: "Kids", order: 0 },
      });
      const opts = [
        { label: "Chicken goujons + chips", description: "Garden peas", dietary: [] },
        { label: "Pasta in tomato sauce", description: "With garlic bread", dietary: ["V"] },
      ];
      let optOrder = 0;
      for (const o of opts) {
        await db.bookMenuOption.create({
          data: {
            courseId: course.id,
            label: o.label,
            description: o.description,
            dietary: o.dietary,
            isKidsMeal: true,
            order: optOrder++,
          },
        });
      }
    }

    // Evening buffet — one course, three options.
    const eveningSlug = "evening-buffet";
    const eveningExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: eveningSlug } },
    });
    if (!eveningExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: eveningSlug,
          title: "Evening buffet",
          kind: "MENU",
          order: nextOrder++,
        },
      });
      const card = await db.bookMenuCard.create({
        data: {
          subsectionId: sub.id,
          serviceType: "Buffet",
          serviceTime: "8:00pm — buffet opens",
          pricePerHeadPence: 1800,
          notes: "Self-serve. Caterer keeps it stocked until 9:30pm.",
        },
      });
      const course = await db.bookMenuCourse.create({
        data: { cardId: card.id, courseLabel: "Evening", order: 0 },
      });
      const opts = [
        { label: "Hog roast roll", description: "With apple sauce + crackling", dietary: [] },
        { label: "Veggie burger slider", description: "With mature cheddar", dietary: ["V"] },
        { label: "Loaded fries", description: "Beef chilli or veggie chilli", dietary: [] },
      ];
      let optOrder = 0;
      for (const o of opts) {
        await db.bookMenuOption.create({
          data: {
            courseId: course.id,
            label: o.label,
            description: o.description,
            dietary: o.dietary,
            order: optOrder++,
          },
        });
      }
    }

    // Late-night snack — bacon/sausage rolls, single course, single
    // option each. Tiny + opinionated.
    const lateNightSlug = "late-night-snack";
    const lateNightExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: lateNightSlug } },
    });
    if (!lateNightExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: lateNightSlug,
          title: "Late-night snack",
          kind: "MENU",
          order: nextOrder++,
        },
      });
      const card = await db.bookMenuCard.create({
        data: {
          subsectionId: sub.id,
          serviceType: "Tray service",
          serviceTime: "10:30pm",
          pricePerHeadPence: 600,
          notes: "Soaks up the drinks. Venue staff walks the trays through the dance floor.",
        },
      });
      const course = await db.bookMenuCourse.create({
        data: { cardId: card.id, courseLabel: "Late night", order: 0 },
      });
      const opts = [
        { label: "Bacon rolls", description: "Brown or red sauce on the side", dietary: [] },
        { label: "Halloumi rolls", description: "With chilli jam", dietary: ["V"] },
      ];
      let optOrder = 0;
      for (const o of opts) {
        await db.bookMenuOption.create({
          data: {
            courseId: course.id,
            label: o.label,
            description: o.description,
            dietary: o.dietary,
            order: optOrder++,
          },
        });
      }
    }

    // Cake — FIELD card by default (vendor track). Switch the kind to
    // RECIPE if the couple decides to bake it themselves; the BOOK-
    // EXPANSION-PLAN §12 flagged this as a per-couple call.
    const cakeSlug = "cake";
    const cakeExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: cakeSlug } },
    });
    if (!cakeExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: cakeSlug,
          title: "Cake",
          kind: "FIELD",
          order: nextOrder++,
        },
      });
      const fields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string; required?: boolean }> = [
        { label: "Baker", type: "text", group: "Vendor", helpText: "Leave blank if DIY — and consider switching this card to RECIPE" },
        { label: "Style", type: "text", group: "Design", helpText: "e.g. Three-tier semi-naked, white drip" },
        { label: "Flavours", type: "text", group: "Design", helpText: "e.g. Vanilla & raspberry / lemon / chocolate" },
        { label: "Servings", type: "number", group: "Design", helpText: "Aim for guest count + 10%" },
        { label: "Order placed", type: "date", group: "Order" },
        { label: "Tasting date", type: "date", group: "Order" },
        { label: "Delivery time", type: "text", group: "Day-of", helpText: "e.g. Drop at venue 1:00pm" },
        { label: "Cake stand", type: "text", group: "Day-of", helpText: "Provided by venue or BYO?" },
        { label: "Cost", type: "number", group: "Order" },
        { label: "Status", type: "select", options: ["Researching", "Tasting booked", "Ordered", "Deposit paid", "Paid in full", "Delivered"], group: "Status", required: true },
      ];
      let defOrder = 0;
      for (const f of fields) {
        await db.bookFieldDef.create({
          data: {
            subsectionId: sub.id,
            label: f.label,
            type: f.type,
            options: f.options ?? [],
            group: f.group ?? null,
            helpText: f.helpText ?? null,
            required: f.required ?? false,
            order: defOrder++,
          },
        });
      }
    }

    // Signature cocktail — one RECIPE example so users see the
    // RECIPE card kind in the wild. Light scaling base of 8 servings.
    const cocktailSlug = "signature-cocktail";
    const cocktailExisting = await db.bookSubsection.findUnique({
      where: { sectionId_slug: { sectionId: fnd.id, slug: cocktailSlug } },
    });
    if (!cocktailExisting) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: fnd.id,
          slug: cocktailSlug,
          title: "Signature cocktail — Bryony & Jamie's Spritz",
          kind: "RECIPE",
          order: nextOrder++,
        },
      });
      const recipe = await db.bookRecipe.create({
        data: {
          subsectionId: sub.id,
          ingredients: [
            "60ml Aperol",
            "90ml Prosecco",
            "30ml soda water",
            "Slice of orange",
            "Sprig of rosemary",
            "Ice — plenty",
          ] as Prisma.InputJsonValue,
          // Mirror legacy-Json column for the recoverability buffer.
          steps: [
            "Fill a wine glass to the brim with ice.",
            "Pour in the Aperol, then the Prosecco, then the soda — in that order.",
            "Stir gently with a bar spoon, twice — no more.",
            "Garnish with the orange slice + rosemary.",
            "Serve immediately, before the bubbles settle.",
          ] as Prisma.InputJsonValue,
          notes:
            "Simple, photographable, low-ABV-ish. The rosemary garnish is the wedding signature. Pre-mix Aperol + Prosecco together day-before in batches of 8 servings if pressed for time.",
          servingsBase: 8,
        },
      });
      const recipeSteps = [
        { instruction: "Pre-batch Aperol + Prosecco (without soda) in 8-serving jugs", durationMinutes: 5, dayBefore: true },
        { instruction: "Fill a wine glass to the brim with ice", durationMinutes: 1, dayBefore: false },
        { instruction: "Pour 60ml Aperol + 90ml Prosecco + 30ml soda — in that order", durationMinutes: 1, dayBefore: false },
        { instruction: "Stir gently with a bar spoon, twice", durationMinutes: 1, dayBefore: false },
        { instruction: "Garnish with orange slice + rosemary sprig", durationMinutes: 1, dayBefore: false },
      ];
      let stepOrder = 0;
      for (const s of recipeSteps) {
        await db.bookRecipeStep.create({
          data: {
            recipeId: recipe.id,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            dayBefore: s.dayBefore,
            order: stepOrder++,
          },
        });
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
      // v1.32.2: items mix bottle-priced lines and a per-head toast
      // (£2.50/head × 1 drink) so the editor demonstrates both
      // pricing modes from first run.
      const items = [
        { category: "Reception drink", name: "Welcome bubbly", timing: "Reception", quantityPlanned: 30, unit: "bottles", costPence: 30000, pricePerHeadPence: null },
        { category: "Wine", name: "House white (Pinot grigio)", timing: "Dinner", quantityPlanned: 25, unit: "bottles", costPence: 25000, pricePerHeadPence: null },
        { category: "Wine", name: "House red (Merlot)", timing: "Dinner", quantityPlanned: 20, unit: "bottles", costPence: 20000, pricePerHeadPence: null },
        { category: "Beer", name: "Bottled lager", timing: "Evening", quantityPlanned: 60, unit: "bottles", costPence: 18000, pricePerHeadPence: null },
        { category: "Soft", name: "Soft drinks selection", timing: "Reception", quantityPlanned: 24, unit: "L", costPence: 4800, pricePerHeadPence: null },
        // Per-head toast: £2.50 a drink × adults × 1 drink/head
        { category: "Reception drink", name: "Toast — Prosecco", timing: "Toast", quantityPlanned: 1, unit: null, costPence: null, pricePerHeadPence: 250 },
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

// v1.33.0: seed venue-spaces with five SETUP cards (Ceremony room,
// Drinks reception, Reception room, Evening setup, Pack-down) and
// venue-decor with the non-BUILD subsections (printed signage,
// florist brief, photo booth, décor inspiration). BUILD cards from
// v1.31.0 stay where the v1.31.0 seeder put them (under the legacy
// `venue` section); the user can move them via UI when convenient.
export async function seedVenueSpacesAndDecor() {
  const spaces = await db.bookSection.findUnique({ where: { slug: "venue-spaces" } });
  const decor = await db.bookSection.findUnique({ where: { slug: "venue-decor" } });
  if (!spaces || !decor) {
    console.log(`  · venue-spaces / venue-decor not found; skipping seed`);
    return;
  }

  // venue-spaces: SETUP cards. Idempotent — skip when ANY subsection
  // already exists under the section (user-added content protected).
  // v1.38.4: each SETUP card now ships with 4-7 items so the editor
  // shows a fully-filled card on first open. Source values match
  // existing supplier-name strings so the supplier-detail "Used in
  // setup" cross-module surface lights up immediately.
  const spacesCount = await db.bookSubsection.count({ where: { sectionId: spaces.id } });
  if (spacesCount === 0) {
    type SpaceItem = {
      name: string;
      quantity?: number | null;
      location?: string | null;
      source?: string | null;
      packDownPlan?: string | null;
      notes?: string | null;
    };
    type SpaceCard = {
      slug: string;
      title: string;
      space: string;
      setupStartsAt: string;
      setupOwner: string;
      items: SpaceItem[];
    };
    const cards: SpaceCard[] = [
      {
        slug: "ceremony-room",
        title: "Ceremony room",
        space: "Ceremony room",
        setupStartsAt: "10:00am",
        setupOwner: "Paintbox Blooms",
        items: [
          { name: "Aisle runner", quantity: 1, location: "Centre aisle", source: "VistaPrint", packDownPlan: "Roll up + return to box, pack-down crew" },
          { name: "Ceremony arch (florist)", quantity: 1, location: "Top of aisle", source: "Paintbox Blooms", packDownPlan: "Florist returns 18:00 to dismantle" },
          { name: "Aisle chair posies", quantity: 12, location: "End of every other row", source: "Paintbox Blooms", packDownPlan: "Move to top tables for evening — venue staff" },
          { name: "Signing table linen", quantity: 1, location: "Front-left", source: "Venue staff" },
          { name: "Registrar's pen", quantity: 1, location: "Signing table", notes: "Belongs to Warwickshire Registrar — handed off morning of" },
          { name: "Order of service", quantity: 80, location: "Welcome table", source: "VistaPrint", packDownPlan: "Best man takes box of leftovers home" },
        ],
      },
      {
        slug: "drinks-reception",
        title: "Drinks reception",
        space: "Garden lawn",
        setupStartsAt: "1:30pm",
        setupOwner: "Venue staff",
        items: [
          { name: "Welcome drinks tray (Prosecco)", quantity: 30, location: "Top of garden steps", source: "Venue staff", notes: "30 glasses + 6 spare flutes" },
          { name: "Soft drinks tray", quantity: 12, location: "Top of garden steps", source: "Venue staff" },
          { name: "Lawn games (giant Jenga, croquet)", quantity: 2, location: "Far lawn", source: "Dream Wedding & Events" },
          { name: "Photo booth backdrop", quantity: 1, location: "Pergola corner", source: "Dream Wedding & Events" },
          { name: "Welcome sign (calligraphy)", quantity: 1, location: "Garden gate", source: "VistaPrint", packDownPlan: "Bring inside if rain forecast" },
        ],
      },
      {
        slug: "reception-room",
        title: "Reception room",
        space: "Main hall",
        setupStartsAt: "11:00am",
        setupOwner: "Bridesmaids + venue",
        items: [
          { name: "Centerpieces (mason jars + eucalyptus)", quantity: 14, location: "Round-table centre", source: "DIY (BUILD card)", notes: "From the Centerpieces BUILD card — see Venue — Décor" },
          { name: "Place cards", quantity: 80, location: "Above each cover", source: "DIY (BUILD card)" },
          { name: "Table numbers (printed)", quantity: 14, location: "Round-table centre, behind centerpiece", source: "VistaPrint" },
          { name: "Menu cards", quantity: 80, location: "Above each plate", source: "VistaPrint" },
          { name: "Top-table arrangement", quantity: 1, location: "Top table", source: "Paintbox Blooms" },
          { name: "Cake stand", quantity: 1, location: "Cake table — by main entrance", source: "Venue staff" },
          { name: "Seating chart frame", quantity: 1, location: "Reception entrance", source: "VistaPrint" },
        ],
      },
      {
        slug: "evening-setup",
        title: "Evening setup",
        space: "Main hall",
        setupStartsAt: "5:30pm",
        setupOwner: "Best man + venue",
        items: [
          { name: "Dance floor (LED)", quantity: 1, location: "Centre of hall (after tables move)", source: "Dream Wedding & Events" },
          { name: "DJ booth", quantity: 1, location: "Far end, against the windows", source: "DJ — Marc Robbins" },
          { name: "Bistro lights", quantity: 1, location: "Overhead, X-pattern", source: "Venue staff", notes: "Pre-installed; just switch on" },
          { name: "Late-night snack station", quantity: 1, location: "Welcome table (relocated)", source: "Venue staff" },
          { name: "Bar refresh — beer fridges", quantity: 2, location: "Behind main bar", source: "Venue staff" },
        ],
      },
      {
        slug: "pack-down",
        title: "Pack-down",
        space: "Whole venue",
        setupStartsAt: "11:00pm",
        setupOwner: "Bridesmaids + groomsmen",
        items: [
          { name: "Centerpieces — keep / bin / give away", quantity: 14, location: "All tables", packDownPlan: "Couple keeps 2; rest go home with guests who want them" },
          { name: "Place cards / table numbers", quantity: 94, location: "All tables", packDownPlan: "Bridesmaids gather + bag for the couple's archive box" },
          { name: "Photo prints / signage", quantity: 1, location: "Welcome table + entrance", packDownPlan: "Everything into the archive box — bridesmaids" },
          { name: "Cake leftovers", quantity: 1, location: "Cake table", packDownPlan: "Box up + bring back to bridal suite" },
          { name: "Lost property sweep", quantity: 1, location: "All rooms", packDownPlan: "Best man + groomsmen — final walkthrough at 23:30" },
        ],
      },
    ];
    let order = 0;
    let totalItems = 0;
    for (const c of cards) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: spaces.id,
          slug: c.slug,
          title: c.title,
          kind: "SETUP",
          order: order++,
        },
      });
      const setupCard = await db.bookSetupCard.create({
        data: {
          subsectionId: sub.id,
          space: c.space,
          setupStartsAt: c.setupStartsAt,
          setupOwner: c.setupOwner,
        },
      });
      let itemOrder = 0;
      for (const it of c.items) {
        await db.bookSetupItem.create({
          data: {
            cardId: setupCard.id,
            name: it.name,
            quantity: it.quantity ?? null,
            location: it.location ?? null,
            source: it.source ?? null,
            packDownPlan: it.packDownPlan ?? null,
            notes: it.notes ?? null,
            order: itemOrder++,
          },
        });
        totalItems += 1;
      }
    }
    console.log(`  ✓ ${cards.length} SETUP cards · ${totalItems} items seeded under venue-spaces`);
  } else {
    console.log(`  ✓ venue-spaces subsections already present (${spacesCount}); skipping seed`);
  }

  // venue-decor: non-BUILD seed (the BUILD cards stay where the
  // v1.31.0 seeder put them, under legacy `venue`).
  // v1.38.4: FIELD cards now ship with field defs, and TEXT cards
  // use HTML markup so the WYSIWYG renders bullets / headings.
  const decorCount = await db.bookSubsection.count({ where: { sectionId: decor.id } });
  if (decorCount === 0) {
    type DecorSub = {
      slug: string;
      title: string;
      kind: "TEXT" | "FIELD";
      body?: string | null;
      bodyHtml?: string | null;
      fieldDefs?: Array<{
        label: string;
        type: "text" | "number" | "date" | "select";
        options?: string[];
        group?: string;
        helpText?: string;
        required?: boolean;
      }>;
    };
    const subs: DecorSub[] = [
      {
        slug: "printed-signage",
        title: "Printed signage (table numbers, menus)",
        kind: "FIELD",
        fieldDefs: [
          { label: "Vendor", type: "text", group: "Order", helpText: "Who's printing it (e.g. VistaPrint)" },
          { label: "Order reference", type: "text", group: "Order" },
          { label: "Order placed", type: "date", group: "Order" },
          { label: "Expected delivery", type: "date", group: "Order", helpText: "Aim for ≥ 5 days before the wedding" },
          { label: "Total cost", type: "number", group: "Order", helpText: "£ inclusive of postage" },
          { label: "Table numbers", type: "number", group: "Counts", helpText: "How many table-number cards" },
          { label: "Menu cards", type: "number", group: "Counts" },
          { label: "Order of service", type: "number", group: "Counts" },
          { label: "Welcome / directional signs", type: "number", group: "Counts" },
          { label: "Status", type: "select", options: ["Designing", "Ordered", "Delivered", "Picked up"], group: "Status", required: true },
        ],
      },
      {
        slug: "florist-brief",
        title: "Florist brief",
        kind: "TEXT",
        bodyHtml:
          "<h2>Paintbox Blooms — scope</h2>" +
          "<ul>" +
          "<li><strong>Bridal bouquet</strong> — eucalyptus, ivory roses, dried lavender accents</li>" +
          "<li><strong>Bridesmaid bouquet</strong> ×1 (Aimee) — smaller version of bridal</li>" +
          "<li><strong>Buttonholes</strong> ×4 — Jamie, Joshua, Bryony's dad, Jamie's dad</li>" +
          "<li><strong>Flower-girl petals</strong> — wicker basket of dried rose petals for Clara</li>" +
          "<li><strong>Ceremony arch</strong> — natural greenery + ivory bloom focal points</li>" +
          "<li><strong>Top-table arrangement</strong> — long, low — must not block guest sightlines</li>" +
          "<li><strong>Aisle chair posies</strong> ×12 — every other row</li>" +
          "</ul>" +
          "<h2>Palette</h2>" +
          "<p>Sage green + ivory + soft cream. <em>No</em> bright pink or red. Eucalyptus is the connecting thread.</p>" +
          "<h2>Day-of</h2>" +
          "<p>Drop everything to the bridal suite at <strong>13:00</strong>. Florist returns at <strong>18:00</strong> to dismantle the ceremony arch and re-purpose the aisle posies onto the top table.</p>",
      },
      {
        slug: "photo-booth",
        title: "Photo booth",
        kind: "FIELD",
        fieldDefs: [
          { label: "Vendor", type: "text", group: "Booking", helpText: "Likely Dream Wedding & Events" },
          { label: "Package", type: "text", group: "Booking", helpText: "Hours / props / unlimited prints / etc." },
          { label: "Hours included", type: "number", group: "Booking" },
          { label: "Cost", type: "number", group: "Booking" },
          { label: "Setup time", type: "text", group: "Day-of", helpText: "When does the vendor arrive to set up" },
          { label: "Open from", type: "text", group: "Day-of", helpText: "e.g. 7:00pm" },
          { label: "Close at", type: "text", group: "Day-of" },
          { label: "Backdrop / theme", type: "text", group: "Day-of" },
          { label: "Status", type: "select", options: ["Quote requested", "Booked", "Deposit paid", "Paid in full"], group: "Status", required: true },
        ],
      },
      {
        slug: "decor-inspiration",
        title: "Décor inspiration",
        kind: "TEXT",
        bodyHtml:
          "<h2>Mood</h2>" +
          "<ul>" +
          "<li>Soft palette — sage, ivory, candlelit warmth</li>" +
          "<li>Layered texture: linen runners, mason-jar candles, dried lavender</li>" +
          "<li>Bistro lights overhead — they're already installed at Alveston</li>" +
          "</ul>" +
          "<h2>Pin links</h2>" +
          "<ul>" +
          "<li>Pinterest board: <em>add link</em></li>" +
          "<li>Instagram saves: <em>add link</em></li>" +
          "</ul>" +
          "<blockquote>Less is more — empty horizontal space reads as 'considered', not 'forgotten'. Resist filling every gap.</blockquote>",
      },
    ];
    let order = 0;
    for (const s of subs) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: decor.id,
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          body: s.body ?? null,
          bodyHtml: s.bodyHtml ?? null,
          order: order++,
        },
      });
      if (s.fieldDefs && s.fieldDefs.length > 0) {
        let defOrder = 0;
        for (const d of s.fieldDefs) {
          await db.bookFieldDef.create({
            data: {
              subsectionId: sub.id,
              label: d.label,
              type: d.type,
              options: d.options ?? [],
              group: d.group ?? null,
              helpText: d.helpText ?? null,
              required: d.required ?? false,
              order: defOrder++,
            },
          });
        }
      }
    }
    const fieldCount = subs.reduce((n, s) => n + (s.fieldDefs?.length ?? 0), 0);
    console.log(`  ✓ ${subs.length} venue-decor subsections seeded · ${fieldCount} FIELD defs`);
  } else {
    console.log(`  ✓ venue-decor subsections already present (${decorCount}); skipping seed`);
  }
}

// v1.34.0: seed the three Legal sections with their per-§8.8-§8.10
// subsections. Idempotent — skipped per-section if already populated.
export async function seedLegalSections() {
  const before = await db.bookSection.findUnique({ where: { slug: "legal-before" } });
  const day = await db.bookSection.findUnique({ where: { slug: "legal-day" } });
  const after = await db.bookSection.findUnique({ where: { slug: "legal-after" } });
  if (!before || !day || !after) {
    console.log(`  · legal-before/-day/-after not found; skipping seed`);
    return;
  }

  // legal-before
  // v1.38.4: LEGAL cards get items (per-person checklists), FIELD
  // cards get field defs.
  const beforeCount = await db.bookSubsection.count({ where: { sectionId: before.id } });
  if (beforeCount === 0) {
    let order = 0;

    // Notice of Marriage — items: one per person + the appointment.
    const notice = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "notice-of-marriage",
        title: "Notice of Marriage",
        kind: "LEGAL",
        order: order++,
      },
    });
    const noticeCard = await db.bookLegalCard.create({
      data: {
        subsectionId: notice.id,
        regulator: "Warwickshire Registrar",
        regulatorContact: "warwickshire-registrars@warwickshire.gov.uk · 01926 414109",
        // Notice must be given ≥ 29 days before, valid for 12 months.
        // Aim to give notice ~3-4 months before to absorb any reschedule.
        dueByDate: new Date("2026-08-28T00:00:00Z"),
        notes: "Both parties must give notice in person at their local register office. Bring documents from the 'Required documents' card.",
      },
    });
    const noticeItems = [
      { label: "Bryony — give notice", requiredFor: "Bride", expiresAt: new Date("2027-05-01T00:00:00Z") },
      { label: "Jamie — give notice", requiredFor: "Groom", expiresAt: new Date("2027-05-01T00:00:00Z") },
      { label: "Book registrar for the ceremony", requiredFor: "Both" },
      { label: "Pay registrar fee (~£50)", requiredFor: "Both" },
    ];
    let nOrder = 0;
    for (const i of noticeItems) {
      await db.bookLegalItem.create({
        data: {
          cardId: noticeCard.id,
          label: i.label,
          requiredFor: i.requiredFor,
          expiresAt: i.expiresAt ?? null,
          order: nOrder++,
        },
      });
    }

    // Required documents — items per person.
    const docs = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "required-documents",
        title: "Required documents",
        kind: "LEGAL",
        order: order++,
      },
    });
    const docsCard = await db.bookLegalCard.create({
      data: {
        subsectionId: docs.id,
        regulator: "Warwickshire Registrar",
        notes: "Originals required at the appointment — photocopies not accepted. Take both passports + proofs to the registrar interview.",
      },
    });
    const docItems = [
      { label: "Bryony — passport (or birth cert + photo ID)", requiredFor: "Bride" },
      { label: "Bryony — proof of address (utility bill or bank statement, dated within 3 months)", requiredFor: "Bride" },
      { label: "Bryony — decree absolute (if previously married)", requiredFor: "Bride", notes: "Skip if not applicable" },
      { label: "Jamie — passport (or birth cert + photo ID)", requiredFor: "Groom" },
      { label: "Jamie — proof of address (utility bill or bank statement, dated within 3 months)", requiredFor: "Groom" },
      { label: "Jamie — decree absolute (if previously married)", requiredFor: "Groom", notes: "Skip if not applicable" },
    ];
    let dOrder = 0;
    for (const i of docItems) {
      await db.bookLegalItem.create({
        data: {
          cardId: docsCard.id,
          label: i.label,
          requiredFor: i.requiredFor,
          notes: i.notes ?? null,
          order: dOrder++,
        },
      });
    }

    // Witnesses — FIELD with two-witness shape.
    const witnessSub = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "witnesses",
        title: "Witnesses",
        kind: "FIELD",
        order: order++,
      },
    });
    const witnessFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; group?: string; helpText?: string; required?: boolean; options?: string[] }> = [
      { label: "Witness 1 — name", type: "text", group: "Witness 1", required: true, helpText: "Likely Joshua Dickson" },
      { label: "Witness 1 — relation to couple", type: "text", group: "Witness 1", helpText: "e.g. Best man" },
      { label: "Witness 1 — confirmed?", type: "select", options: ["Pending", "Confirmed", "Stepping in last-minute"], group: "Witness 1" },
      { label: "Witness 2 — name", type: "text", group: "Witness 2", required: true, helpText: "Likely Aimee Hollingsworth" },
      { label: "Witness 2 — relation to couple", type: "text", group: "Witness 2" },
      { label: "Witness 2 — confirmed?", type: "select", options: ["Pending", "Confirmed", "Stepping in last-minute"], group: "Witness 2" },
      { label: "Backup witness", type: "text", group: "Contingency", helpText: "If either witness drops out — best man / dad" },
    ];
    let wOrder = 0;
    for (const f of witnessFields) {
      await db.bookFieldDef.create({
        data: {
          subsectionId: witnessSub.id,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
          group: f.group ?? null,
          helpText: f.helpText ?? null,
          required: f.required ?? false,
          order: wOrder++,
        },
      });
    }

    // Insurance — FIELD.
    const insSub = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "insurance",
        title: "Insurance",
        kind: "FIELD",
        order: order++,
      },
    });
    const insFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; group?: string; helpText?: string; required?: boolean; options?: string[] }> = [
      { label: "Provider", type: "text", group: "Policy", helpText: "e.g. WeddingPlan Insurance" },
      { label: "Policy number", type: "text", group: "Policy" },
      { label: "Cover level", type: "text", group: "Policy", helpText: "e.g. £5k cancellation, £2k supplier failure" },
      { label: "Premium paid", type: "number", group: "Policy" },
      { label: "Effective from", type: "date", group: "Policy" },
      { label: "Effective to", type: "date", group: "Policy" },
      { label: "24h emergency contact", type: "text", group: "Policy" },
      { label: "Status", type: "select", options: ["Researching", "Quoted", "Bought"], group: "Status", required: true },
    ];
    let iOrder = 0;
    for (const f of insFields) {
      await db.bookFieldDef.create({
        data: {
          subsectionId: insSub.id,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
          group: f.group ?? null,
          helpText: f.helpText ?? null,
          required: f.required ?? false,
          order: iOrder++,
        },
      });
    }

    console.log(`  ✓ legal-before seeded (4 subsections · ${noticeItems.length + docItems.length} LEGAL items · ${witnessFields.length + insFields.length} FIELD defs)`);
  } else {
    console.log(`  ✓ legal-before already present (${beforeCount}); skipping seed`);
  }

  // legal-day
  // v1.38.4: Pre-ceremony interview FIELD gets defs; TEXT cards
  // converted to HTML with numbered/bulleted lists.
  const dayCount = await db.bookSubsection.count({ where: { sectionId: day.id } });
  if (dayCount === 0) {
    let order = 0;

    const interviewSub = await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "pre-ceremony-interview",
        title: "Pre-ceremony interview",
        kind: "FIELD",
        order: order++,
      },
    });
    const interviewFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; group?: string; helpText?: string; options?: string[] }> = [
      { label: "Time", type: "text", group: "Schedule", helpText: "Usually 30 min before the ceremony" },
      { label: "Location", type: "text", group: "Schedule", helpText: "Registrar's room at the venue" },
      { label: "Registrar", type: "text", group: "Officials", helpText: "Name of the lead registrar" },
      { label: "Sub-registrar / second", type: "text", group: "Officials" },
      { label: "Witnesses present?", type: "select", options: ["Yes — both", "Only one", "Neither yet"], group: "Officials" },
      { label: "Music handed off?", type: "select", options: ["Pending", "Done"], group: "Logistics", helpText: "Procession / signing / recession tracks confirmed with venue" },
      { label: "Rings handed off to registrar?", type: "select", options: ["Pending", "Done"], group: "Logistics" },
    ];
    let iqOrder = 0;
    for (const f of interviewFields) {
      await db.bookFieldDef.create({
        data: {
          subsectionId: interviewSub.id,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
          group: f.group ?? null,
          helpText: f.helpText ?? null,
          order: iqOrder++,
        },
      });
    }

    await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "vows-reference",
        title: "Vows reference",
        kind: "TEXT",
        bodyHtml:
          "<h2>The legal vows (England & Wales civil ceremony)</h2>" +
          "<p>The registrar leads. Each party repeats after them. <strong>Don't memorise</strong> — they prompt one phrase at a time.</p>" +
          "<blockquote>I solemnly declare that I know not of any lawful impediment why I, <em>[full name]</em>, may not be joined in matrimony to <em>[partner's full name]</em>.</blockquote>" +
          "<blockquote>I call upon these persons here present to witness that I, <em>[full name]</em>, do take thee, <em>[partner's full name]</em>, to be my lawful wedded <em>wife / husband</em>.</blockquote>" +
          "<h2>Personal vows (optional, after the legal ones)</h2>" +
          "<p>Drop personal vows here as you write them. Read aloud to each other in the rehearsal — they should fit on an index card.</p>" +
          "<h2>Crib sheet</h2>" +
          "<p>Print one card each. Keep with the rings.</p>",
        order: order++,
      },
    });

    await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "registration-steps",
        title: "Registration steps",
        kind: "TEXT",
        bodyHtml:
          "<h2>Order of operations</h2>" +
          "<ol>" +
          "<li><strong>Pre-ceremony interview</strong> — couple meets registrar 30 min before. Confirms both parties' details.</li>" +
          "<li><strong>Ceremony</strong> — registrar leads, vows + ring exchange.</li>" +
          "<li><strong>Sign the register</strong> — both parties sign.</li>" +
          "<li><strong>Witnesses sign</strong> — both witnesses sign immediately after.</li>" +
          "<li><strong>Marriage cert handed over</strong> — temporary cert at the venue, full cert posted later (see <strong>Legal — After</strong>).</li>" +
          "</ol>" +
          "<blockquote>If the registrar wants to take photos of the signing — only the couple + witnesses are in those, never guests. Photographer can step closer.</blockquote>",
        order: order++,
      },
    });
    console.log(`  ✓ legal-day seeded (3 subsections · ${interviewFields.length} FIELD defs)`);
  } else {
    console.log(`  ✓ legal-day already present (${dayCount}); skipping seed`);
  }

  // legal-after
  // v1.38.4: each LEGAL card gets items so the checklist is
  // immediately useful. Name-change covers the standard 12 places to
  // update if either party is changing surname.
  const afterCount = await db.bookSubsection.count({ where: { sectionId: after.id } });
  if (afterCount === 0) {
    let order = 0;

    // Marriage certificate pickup.
    const pickup = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "marriage-certificate-pickup",
        title: "Marriage certificate pickup",
        kind: "LEGAL",
        order: order++,
      },
    });
    const pickupCard = await db.bookLegalCard.create({
      data: {
        subsectionId: pickup.id,
        regulator: "Warwickshire Registrar",
        regulatorContact: "warwickshire-registrars@warwickshire.gov.uk · 01926 414109",
        notes: "Full marriage certificate is usually posted within 2-3 weeks of the wedding. Confirm address with registrar at the interview.",
      },
    });
    const pickupItems = [
      { label: "Confirm postal address with registrar", requiredFor: "Both" },
      { label: "Receive full certificate", requiredFor: "Both" },
      { label: "Order extra certified copies (~£11 each)", notes: "Recommended: 3-5 copies for name-change paperwork" },
      { label: "Store original in secure place (fireproof box)", requiredFor: "Both" },
    ];
    let pOrder = 0;
    for (const i of pickupItems) {
      await db.bookLegalItem.create({
        data: {
          cardId: pickupCard.id,
          label: i.label,
          requiredFor: i.requiredFor ?? null,
          notes: i.notes ?? null,
          order: pOrder++,
        },
      });
    }

    // Name change checklist.
    const nameChange = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "name-change-checklist",
        title: "Name change checklist",
        kind: "LEGAL",
        order: order++,
      },
    });
    const nameChangeCard = await db.bookLegalCard.create({
      data: {
        subsectionId: nameChange.id,
        notes: "If either party is changing surname. Tackle in this order — passport first because most other places ask for it as proof.",
      },
    });
    const nameItems = [
      { label: "Passport", notes: "HM Passport Office — needs marriage cert + old passport. Allow 6-10 weeks." },
      { label: "Driving licence (DVLA)", notes: "Free if you're already due a renewal" },
      { label: "HMRC (tax records)", notes: "Update via Personal Tax Account" },
      { label: "Banks / building societies", notes: "List each one in turn" },
      { label: "Pension provider", notes: "Both workplace + personal pensions" },
      { label: "Employer (HR + IT)", notes: "Email signature, payroll, expenses" },
      { label: "GP + dentist", notes: "Health records" },
      { label: "Insurance — home / car / life", notes: "Update policies on renewal" },
      { label: "Will / power of attorney", notes: "If applicable — speak to solicitor" },
      { label: "Credit-reference agencies", notes: "Equifax, Experian, TransUnion" },
      { label: "Loyalty / membership cards", notes: "Lower priority — Tesco Clubcard, Boots, etc." },
      { label: "Social media + email", notes: "Lowest priority — do whenever" },
    ];
    let ncOrder = 0;
    for (const i of nameItems) {
      await db.bookLegalItem.create({
        data: {
          cardId: nameChangeCard.id,
          label: i.label,
          notes: i.notes ?? null,
          order: ncOrder++,
        },
      });
    }

    // Certified copies tracker.
    const copies = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "certified-copies",
        title: "Certified copies",
        kind: "LEGAL",
        order: order++,
      },
    });
    const copiesCard = await db.bookLegalCard.create({
      data: {
        subsectionId: copies.id,
        notes: "Track which institutions you've sent certified copies to + whether they've been returned. Each copy is ~£11 from the GRO.",
      },
    });
    const copyItems = [
      { label: "Order initial batch from GRO (gov.uk)", notes: "Recommended start: 5 copies" },
      { label: "Copy sent to passport office (returned?)", requiredFor: "Both" },
      { label: "Copy sent to bank A (returned?)", requiredFor: "Both" },
      { label: "Copy sent to bank B (returned?)", requiredFor: "Both" },
      { label: "Reorder if running low", notes: "Don't let yourself get stuck mid-name-change" },
    ];
    let cOrder = 0;
    for (const i of copyItems) {
      await db.bookLegalItem.create({
        data: {
          cardId: copiesCard.id,
          label: i.label,
          requiredFor: i.requiredFor ?? null,
          notes: i.notes ?? null,
          order: cOrder++,
        },
      });
    }

    console.log(`  ✓ legal-after seeded (3 subsections · ${pickupItems.length + nameItems.length + copyItems.length} LEGAL items)`);
  } else {
    console.log(`  ✓ legal-after already present (${afterCount}); skipping seed`);
  }
}

// v1.35.0: seed `wedding-party-people` with one OUTFIT card per known
// wedding-party member, and `wedding-party-dayof` with the timeline /
// ring-keepers / day-of TEXT + FIELD subsections from §8.2 of the
// Book expansion plan. Idempotent — both sections seeded
// independently, and a section that already has content is skipped.
export async function seedWeddingPartyPeopleAndDayof() {
  const people = await db.bookSection.findUnique({
    where: { slug: "wedding-party-people" },
  });
  const dayof = await db.bookSection.findUnique({
    where: { slug: "wedding-party-dayof" },
  });
  if (!people || !dayof) {
    console.log(`  · wedding-party-people/-dayof not found; skipping seed`);
    return;
  }

  // wedding-party-people — one OUTFIT card per known member, each
  // pre-populated with realistic fitting / alterations / pickup
  // dates around the 26 Sep 2026 wedding plus per-item composition
  // rows (dress / shoes / accessories) so the UI shows what a
  // fully-filled OUTFIT card looks like out of the box.
  // v1.38.4: enriched from the v1.35.0 minimal seed.
  const peopleCount = await db.bookSubsection.count({
    where: { sectionId: people.id },
  });
  if (peopleCount === 0) {
    type SeedItem = {
      itemLabel: string;
      description?: string | null;
      supplier?: string | null;
      status?: string | null;
      notes?: string | null;
    };
    type SeedMember = {
      personName: string;
      role: string;
      fittingDate?: Date | null;
      alterationsDueBy?: Date | null;
      pickupDate?: Date | null;
      costPence?: number | null;
      paidBy?: string | null;
      paid?: boolean;
      notes?: string | null;
      items: SeedItem[];
    };
    const members: SeedMember[] = [
      {
        personName: "Bryony",
        role: "Bride",
        fittingDate: new Date("2026-08-15T10:00:00Z"),
        alterationsDueBy: new Date("2026-09-12T00:00:00Z"),
        pickupDate: new Date("2026-09-23T00:00:00Z"),
        costPence: 185000,
        paidBy: "Couple",
        paid: false,
        notes: "Ivory + soft sage palette. Veil to be steamed by venue staff morning of.",
        items: [
          { itemLabel: "Dress", description: "Ivory A-line silk, fingertip veil", supplier: "Mirror Mirror Bridal", status: "Ordered" },
          { itemLabel: "Shoes", description: "Ivory block heel, 5cm — comfort over height", supplier: "Rachel Simpson", status: "Ordered" },
          { itemLabel: "Veil", description: "Cathedral-length, scalloped edge", supplier: "Mirror Mirror Bridal", status: "Ordered" },
          { itemLabel: "Jewellery", description: "Pearl drop earrings (something borrowed — Mum)", status: "Designed" },
          { itemLabel: "Bouquet", description: "Eucalyptus + ivory roses", supplier: "Paintbox Blooms", status: "Designed" },
        ],
      },
      {
        personName: "Jamie",
        role: "Groom",
        fittingDate: new Date("2026-08-20T15:00:00Z"),
        alterationsDueBy: new Date("2026-09-15T00:00:00Z"),
        pickupDate: new Date("2026-09-24T00:00:00Z"),
        costPence: 65000,
        paidBy: "Self",
        paid: false,
        notes: "Three-piece in navy. Pocket square to match bridesmaid sage.",
        items: [
          { itemLabel: "Suit", description: "Navy three-piece wool", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Shirt", description: "White, point collar, double cuff", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Tie", description: "Sage green knit", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Shoes", description: "Black oxford, polished by best man", supplier: "Loake (existing)", status: "Collected" },
          { itemLabel: "Cufflinks", description: "Silver knot — gift from Bryony", status: "Designed" },
          { itemLabel: "Buttonhole", description: "White rose + eucalyptus", supplier: "Paintbox Blooms", status: "Designed" },
        ],
      },
      {
        personName: "Aimee Hollingsworth",
        role: "Maid of Honour",
        fittingDate: new Date("2026-08-22T11:00:00Z"),
        alterationsDueBy: new Date("2026-09-12T00:00:00Z"),
        pickupDate: new Date("2026-09-23T00:00:00Z"),
        costPence: 22000,
        paidBy: "Self",
        paid: true,
        items: [
          { itemLabel: "Dress", description: "Sage green, knee-length, halter neck", supplier: "Coast", status: "Ordered" },
          { itemLabel: "Shoes", description: "Nude block heel — own choice", status: "Collected" },
          { itemLabel: "Bouquet", description: "Smaller version of bridal bouquet", supplier: "Paintbox Blooms", status: "Designed" },
        ],
      },
      {
        personName: "Joshua Dickson",
        role: "Best Man",
        fittingDate: new Date("2026-08-20T15:30:00Z"),
        alterationsDueBy: new Date("2026-09-15T00:00:00Z"),
        pickupDate: new Date("2026-09-24T00:00:00Z"),
        costPence: 60000,
        paidBy: "Self",
        paid: false,
        items: [
          { itemLabel: "Suit", description: "Navy two-piece — same fabric as Jamie", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Shirt", description: "White point collar", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Tie", description: "Sage green knit (matching Jamie)", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Shoes", description: "Own black oxfords", status: "Collected" },
          { itemLabel: "Buttonhole", description: "White rose", supplier: "Paintbox Blooms", status: "Designed" },
        ],
      },
      {
        personName: "Clara",
        role: "Flower Girl",
        fittingDate: new Date("2026-09-05T11:00:00Z"),
        pickupDate: new Date("2026-09-19T00:00:00Z"),
        costPence: 4500,
        paidBy: "Parents",
        paid: true,
        notes: "Likely to grow between fitting and the day — buy slightly long, pin if needed.",
        items: [
          { itemLabel: "Dress", description: "Ivory tulle, sage sash to match maid of honour", supplier: "Monsoon", status: "Ordered" },
          { itemLabel: "Shoes", description: "Ivory ballet flats", status: "Ordered" },
          { itemLabel: "Petal basket", description: "Wicker basket + dried rose petals", supplier: "Paintbox Blooms", status: "Designed" },
        ],
      },
      {
        personName: "Torin",
        role: "Page Boy",
        fittingDate: new Date("2026-09-05T11:30:00Z"),
        pickupDate: new Date("2026-09-19T00:00:00Z"),
        costPence: 5500,
        paidBy: "Parents",
        paid: true,
        items: [
          { itemLabel: "Outfit", description: "Navy waistcoat + shorts, white shirt", supplier: "Monsoon", status: "Ordered" },
          { itemLabel: "Tie", description: "Mini sage knit", supplier: "Slaters", status: "Ordered" },
          { itemLabel: "Shoes", description: "Brown lace-up", status: "Ordered" },
        ],
      },
    ];
    let order = 0;
    for (const m of members) {
      const slug =
        m.personName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") + "-outfit";
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: people.id,
          slug,
          title: `${m.personName} — outfit`,
          kind: "OUTFIT",
          order: order++,
        },
      });
      const card = await db.bookOutfitCard.create({
        data: {
          subsectionId: sub.id,
          personName: m.personName,
          role: m.role,
          fittingDate: m.fittingDate ?? null,
          alterationsDueBy: m.alterationsDueBy ?? null,
          pickupDate: m.pickupDate ?? null,
          costPence: m.costPence ?? null,
          paidBy: m.paidBy ?? null,
          paid: m.paid ?? false,
          notes: m.notes ?? null,
        },
      });
      let itemOrder = 0;
      for (const it of m.items) {
        await db.bookOutfit.create({
          data: {
            cardId: card.id,
            itemLabel: it.itemLabel,
            description: it.description ?? null,
            supplier: it.supplier ?? null,
            status: it.status ?? null,
            notes: it.notes ?? null,
            order: itemOrder++,
          },
        });
      }
    }
    const itemCount = members.reduce((n, m) => n + m.items.length, 0);
    console.log(
      `  ✓ wedding-party-people seeded (${members.length} OUTFIT cards · ${itemCount} items)`,
    );
  } else {
    console.log(
      `  ✓ wedding-party-people already present (${peopleCount}); skipping seed`,
    );
  }

  // wedding-party-dayof — TEXT/FIELD subsections per §8.2.
  // v1.38.4: TEXT bodies authored as HTML so the v1.37.0 WYSIWYG
  // viewer renders bullet lists / numbered steps cleanly. Wedding-
  // day cars FIELD card gets six field defs so the card is useful
  // out of the box.
  const dayofCount = await db.bookSubsection.count({
    where: { sectionId: dayof.id },
  });
  if (dayofCount === 0) {
    type DayofSub = {
      slug: string;
      title: string;
      kind: "TEXT" | "FIELD";
      body?: string | null;
      bodyHtml?: string | null;
      fieldDefs?: Array<{
        label: string;
        type: "text" | "number" | "date" | "select";
        options?: string[];
        group?: string;
        helpText?: string;
        required?: boolean;
      }>;
    };
    const subs: DayofSub[] = [
      {
        slug: "morning-prep-timeline",
        title: "Morning prep timeline",
        kind: "TEXT",
        bodyHtml:
          "<h2>Bride side · Bridal suite</h2>" +
          "<ul>" +
          "<li><strong>09:30</strong> — Hair + makeup arrive (Lily James MUA, Mel Hair Co.)</li>" +
          "<li><strong>10:00</strong> — Bryony hair starts</li>" +
          "<li><strong>11:00</strong> — Bridesmaids arrive at the bridal suite</li>" +
          "<li><strong>12:00</strong> — Light lunch in the suite (sandwiches + fizz)</li>" +
          "<li><strong>13:00</strong> — Photographer arrives, candids of the bridesmaids getting ready</li>" +
          "<li><strong>13:30</strong> — Bryony into the dress, photographer captures first look</li>" +
          "</ul>" +
          "<h2>Groom side · Manor</h2>" +
          "<ul>" +
          "<li><strong>12:30</strong> — Groomsmen arrive at the manor</li>" +
          "<li><strong>12:45</strong> — Photographer with the groomsmen — informal</li>" +
          "<li><strong>13:15</strong> — Buttonholes pinned (Best man double-checks)</li>" +
          "<li><strong>13:30</strong> — Jamie + groomsmen take seats in ceremony room</li>" +
          "</ul>",
      },
      {
        slug: "ring-keepers",
        title: "Ring keepers",
        kind: "TEXT",
        bodyHtml:
          "<p><strong>Joshua Dickson (Best Man)</strong> holds both rings until the ceremony.</p>" +
          "<ul>" +
          "<li>Rings stay in the navy ring box (gift from Bryony's mum) — kept in left waistcoat pocket.</li>" +
          "<li>Hand-off in the groomsmen room at <strong>13:30</strong>, just before everyone is seated.</li>" +
          "<li>Confirm with Aimee Hollingsworth on the morning of — she carries the bride's ring during the procession.</li>" +
          "</ul>" +
          "<blockquote>If anything goes wrong: rings can be improvised with a pair of borrowed rings — the legal exchange is the spoken vows, not the metal. Don't panic.</blockquote>",
      },
      {
        slug: "pre-ceremony-handoffs",
        title: "Pre-ceremony hand-offs",
        kind: "TEXT",
        bodyHtml:
          "<p>Paintbox Blooms drops everything to the bridal suite at <strong>13:00</strong>. From there:</p>" +
          "<ul>" +
          "<li><strong>13:00</strong> — Buttonholes to groomsmen (best man delivers to manor)</li>" +
          "<li><strong>13:30</strong> — Bouquets to bridesmaids in the suite</li>" +
          "<li><strong>13:45</strong> — Flower girl petals to Clara (in the wicker basket)</li>" +
          "<li><strong>13:50</strong> — Bryony's bouquet handed over after dress is on</li>" +
          "</ul>",
      },
      {
        slug: "wedding-day-cars",
        title: "Wedding-day cars",
        kind: "FIELD",
        body: null,
        fieldDefs: [
          { label: "Bride's car", type: "text", group: "Vehicles", helpText: "Make / model / colour, e.g. White vintage Rolls" },
          { label: "Bride's car driver", type: "text", group: "Vehicles" },
          { label: "Driver phone", type: "text", group: "Vehicles", helpText: "Day-of contact in case of delay" },
          { label: "Pickup time (bride)", type: "text", group: "Schedule", helpText: "e.g. 13:30 from bridal suite" },
          { label: "Groomsmen car", type: "text", group: "Vehicles" },
          { label: "Backup transport", type: "text", group: "Contingency", helpText: "Taxi firm + number for any cock-ups" },
        ],
      },
      {
        slug: "stag-hen-recap",
        title: "Stag & Hen recap",
        kind: "TEXT",
        bodyHtml:
          "<h2>Stag — log here once it happens</h2>" +
          "<ul>" +
          "<li><strong>When</strong>: TBD</li>" +
          "<li><strong>Where</strong>: TBD</li>" +
          "<li><strong>Organiser</strong>: Joshua Dickson</li>" +
          "<li><strong>Photos / video</strong>: shared album link to drop in here</li>" +
          "</ul>" +
          "<h2>Hen — log here once it happens</h2>" +
          "<ul>" +
          "<li><strong>When</strong>: TBD</li>" +
          "<li><strong>Where</strong>: TBD</li>" +
          "<li><strong>Organiser</strong>: Aimee Hollingsworth</li>" +
          "<li><strong>Photos / video</strong>: shared album link</li>" +
          "</ul>" +
          "<p>Use this card after the events to capture anything worth remembering for the speeches.</p>",
      },
    ];
    let order = 0;
    for (const s of subs) {
      const sub = await db.bookSubsection.create({
        data: {
          sectionId: dayof.id,
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          body: s.body ?? null,
          bodyHtml: s.bodyHtml ?? null,
          order: order++,
        },
      });
      if (s.fieldDefs && s.fieldDefs.length > 0) {
        let defOrder = 0;
        for (const d of s.fieldDefs) {
          await db.bookFieldDef.create({
            data: {
              subsectionId: sub.id,
              label: d.label,
              type: d.type,
              options: d.options ?? [],
              group: d.group ?? null,
              helpText: d.helpText ?? null,
              required: d.required ?? false,
              order: defOrder++,
            },
          });
        }
      }
    }
    console.log(`  ✓ wedding-party-dayof seeded (${subs.length} subsections)`);
  } else {
    console.log(
      `  ✓ wedding-party-dayof already present (${dayofCount}); skipping seed`,
    );
  }
}

// v1.36.0 (P6): seed the Accommodation section with sample STAY +
// LODGING_GUIDE cards per BOOK-EXPANSION-PLAN.md §8.11. Idempotent —
// skipped when the section already has subsections. Real cards added
// via the UI are never overwritten by re-seed.
export async function seedAccommodationCards() {
  const section = await db.bookSection.findUnique({
    where: { slug: "accommodation" },
  });
  if (!section) {
    console.log(`  · accommodation section not found; skipping seed`);
    return;
  }
  const existing = await db.bookSubsection.count({
    where: { sectionId: section.id },
  });
  if (existing > 0) {
    console.log(
      `  ✓ accommodation already populated (${existing}); skipping seed`,
    );
    return;
  }

  // v1.38.4: STAY cards now ship with realistic check-in / check-out
  // dates around the 26 Sep 2026 wedding, plus per-stay cost +
  // booking ref placeholders so the full STAY card UI is visible
  // out of the box. Couple swaps in real ref + cost when booked.
  const stays: Array<{
    slug: string;
    title: string;
    propertyName: string;
    propertyContact?: string;
    bookingReference?: string;
    checkInDate: Date;
    checkOutDate: Date;
    costPence?: number;
    paidBy?: string;
    paid?: boolean;
    occupants: string[];
    notes?: string;
  }> = [
    {
      slug: "bridal-suite",
      title: "Bridal Suite",
      propertyName: "Alveston Manor — Bridal Suite",
      propertyContact: "01789 205478 · alveston.manor@example.com",
      bookingReference: "AM-2026-09-25-BRSUITE",
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-27T11:00:00Z"),
      costPence: 60000,
      paidBy: "Couple",
      paid: false,
      occupants: ["Bryony", "Jamie"],
      notes: "Wedding-night included in venue package — confirm.",
    },
    {
      slug: "bryony-night-before",
      title: "Bryony — night before",
      propertyName: "Alveston Manor — Bridal Suite (early check-in)",
      propertyContact: "01789 205478",
      bookingReference: "AM-2026-09-25-EARLY",
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-26T11:00:00Z"),
      costPence: 18000,
      paidBy: "Couple",
      paid: false,
      occupants: ["Bryony"],
      notes: "Bridesmaids join on the morning, not for the night.",
    },
    {
      slug: "bridesmaids-night-before",
      title: "Aimee / bridesmaids — night before",
      propertyName: "Alveston Manor — bridesmaid twin",
      bookingReference: "AM-2026-09-25-BM01",
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-26T11:00:00Z"),
      costPence: 16000,
      paidBy: "Self",
      paid: true,
      occupants: ["Aimee Hollingsworth"],
    },
    {
      slug: "groomsmen-night-before",
      title: "Jamie / groomsmen — night before",
      propertyName: "Alveston Manor — groomsmen twin",
      bookingReference: "AM-2026-09-25-GM01",
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-26T11:00:00Z"),
      costPence: 16000,
      paidBy: "Self",
      paid: false,
      occupants: ["Jamie", "Joshua Dickson"],
    },
  ];
  let order = 0;
  for (const s of stays) {
    const sub = await db.bookSubsection.create({
      data: {
        sectionId: section.id,
        slug: s.slug,
        title: s.title,
        kind: "STAY",
        order: order++,
      },
    });
    await db.bookStayCard.create({
      data: {
        subsectionId: sub.id,
        propertyName: s.propertyName,
        propertyContact: s.propertyContact ?? null,
        bookingReference: s.bookingReference ?? null,
        checkInDate: s.checkInDate,
        checkOutDate: s.checkOutDate,
        costPence: s.costPence ?? null,
        paidBy: s.paidBy ?? null,
        paid: s.paid ?? false,
        occupants: s.occupants,
        notes: s.notes ?? null,
      },
    });
  }
  // LODGING_GUIDE card with three placeholder hotels around
  // Stratford-upon-Avon. Couple swaps in real picks via the UI.
  const guideSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "recommended-for-guests",
      title: "Recommended for guests",
      kind: "LODGING_GUIDE",
      order: order++,
    },
  });
  const guideCard = await db.bookLodgingCard.create({
    data: {
      subsectionId: guideSub.id,
      notes:
        "A few options around Stratford-upon-Avon. Group rate codes added below where they apply.",
    },
  });
  const hotels = [
    {
      name: "Crowne Plaza Stratford-upon-Avon",
      distanceFromVenue: "0.4 miles — 10 min walk",
      priceRangeLabel: "££",
      phone: "01789 279988",
      website: "https://www.crowneplaza.com/stratford-upon-avon",
    },
    {
      name: "Mercure Shakespeare Hotel",
      distanceFromVenue: "0.5 miles — 12 min walk",
      priceRangeLabel: "££",
      phone: "01789 294997",
      website: "https://www.mercure.com",
    },
    {
      name: "Premier Inn Stratford-upon-Avon Central",
      distanceFromVenue: "0.7 miles — 15 min walk",
      priceRangeLabel: "£",
      phone: "0333 321 9296",
      website: "https://www.premierinn.com",
    },
  ];
  let itemOrder = 0;
  for (const h of hotels) {
    await db.bookLodgingItem.create({
      data: {
        cardId: guideCard.id,
        name: h.name,
        distanceFromVenue: h.distanceFromVenue,
        priceRangeLabel: h.priceRangeLabel,
        phone: h.phone,
        website: h.website,
        order: itemOrder++,
      },
    });
  }
  console.log(
    `  ✓ accommodation seeded (${stays.length} STAY + 1 LODGING_GUIDE w/ ${hotels.length} hotels)`,
  );
}

// v1.38.4: seed the Photography & Videography section. Per BOOK-
// EXPANSION-PLAN §8.5: Brief / Engagement shoot / Shot list / Album
// spec / Gallery delivery. SHOT_LIST gets a starter set of shots
// grouped by category with rough time-budget estimates.
export async function seedPhotographyCards() {
  const section = await db.bookSection.findUnique({ where: { slug: "photography" } });
  if (!section) {
    console.log(`  · photography section not found; skipping seed`);
    return;
  }
  const existing = await db.bookSubsection.count({ where: { sectionId: section.id } });
  if (existing > 0) {
    console.log(`  ✓ photography already populated (${existing}); skipping seed`);
    return;
  }

  let order = 0;

  // Brief — FIELD card with the headline contract details.
  const briefSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "photographer-brief",
      title: "Photographer brief",
      kind: "FIELD",
      order: order++,
    },
  });
  const briefFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string; required?: boolean }> = [
    { label: "Photographer", type: "text", group: "Vendor", helpText: "e.g. CG Media — Louis Brough", required: true },
    { label: "Phone", type: "text", group: "Vendor" },
    { label: "Email", type: "text", group: "Vendor" },
    { label: "Hours of coverage", type: "number", group: "Booking", helpText: "Total hours on the day" },
    { label: "Arrival time", type: "text", group: "Day-of", helpText: "e.g. 11:00 — bridal suite" },
    { label: "Departure time", type: "text", group: "Day-of", helpText: "e.g. 22:00 — first dance + 30 min after" },
    { label: "Second shooter?", type: "select", options: ["Yes", "No"], group: "Booking" },
    { label: "Total fee", type: "number", group: "Booking", helpText: "£ inclusive" },
    { label: "Deposit paid", type: "number", group: "Payments" },
    { label: "Balance due date", type: "date", group: "Payments" },
    { label: "Style", type: "text", group: "Brief", helpText: "Documentary / posed / mixed — one line" },
    { label: "Status", type: "select", options: ["Researching", "Quoted", "Booked", "Deposit paid", "Paid in full"], group: "Status", required: true },
  ];
  let bdOrder = 0;
  for (const f of briefFields) {
    await db.bookFieldDef.create({
      data: {
        subsectionId: briefSub.id,
        label: f.label,
        type: f.type,
        options: f.options ?? [],
        group: f.group ?? null,
        helpText: f.helpText ?? null,
        required: f.required ?? false,
        order: bdOrder++,
      },
    });
  }

  // Engagement shoot — FIELD card.
  const engagementSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "engagement-shoot",
      title: "Engagement shoot",
      kind: "FIELD",
      order: order++,
    },
  });
  const engagementFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string; required?: boolean }> = [
    { label: "Date", type: "date", group: "Schedule" },
    { label: "Location", type: "text", group: "Schedule", helpText: "e.g. Stratford riverside + pub for golden hour" },
    { label: "Duration", type: "number", group: "Schedule", helpText: "Hours" },
    { label: "Outfit ideas", type: "text", group: "Brief", helpText: "Tonal palette, no logos" },
    { label: "Gallery URL", type: "text", group: "Delivery", helpText: "Drop in once delivered" },
    { label: "Status", type: "select", options: ["Planning", "Booked", "Shot", "Delivered"], group: "Status" },
  ];
  let edOrder = 0;
  for (const f of engagementFields) {
    await db.bookFieldDef.create({
      data: {
        subsectionId: engagementSub.id,
        label: f.label,
        type: f.type,
        options: f.options ?? [],
        group: f.group ?? null,
        helpText: f.helpText ?? null,
        order: edOrder++,
      },
    });
  }

  // Shot list — SHOT_LIST card with categories + estimated minutes.
  const shotListSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "shot-list",
      title: "Shot list",
      kind: "SHOT_LIST",
      order: order++,
    },
  });
  const shotList = await db.bookShotList.create({
    data: { subsectionId: shotListSub.id },
  });
  const shots: Array<{
    title: string;
    category: string;
    estimatedMinutes?: number;
    location?: string;
    withWhom?: string[];
    notes?: string;
  }> = [
    // Pre-ceremony
    { title: "Bridesmaids getting ready — candids", category: "Pre-ceremony", estimatedMinutes: 30, location: "Bridal suite", withWhom: ["Bryony", "Aimee Hollingsworth"] },
    { title: "Dress on the hanger", category: "Pre-ceremony", estimatedMinutes: 5, location: "Bridal suite" },
    { title: "Rings + invitation flat-lay", category: "Pre-ceremony", estimatedMinutes: 10, location: "Bridal suite" },
    { title: "Bryony into the dress (back of dress shot)", category: "Pre-ceremony", estimatedMinutes: 15, location: "Bridal suite" },
    { title: "First look with dad", category: "Pre-ceremony", estimatedMinutes: 10, location: "Bridal suite", notes: "Tear-jerker — leave them alone for the first 60s" },
    { title: "Groomsmen getting ready", category: "Pre-ceremony", estimatedMinutes: 15, location: "Manor", withWhom: ["Jamie", "Joshua Dickson"] },
    // Ceremony
    { title: "Guests arriving + being seated", category: "Ceremony", estimatedMinutes: 10, location: "Ceremony room" },
    { title: "Jamie's reaction as Bryony walks in", category: "Ceremony", estimatedMinutes: 5, location: "Ceremony room", notes: "Camera on Jamie's face, NOT the procession" },
    { title: "Procession", category: "Ceremony", estimatedMinutes: 5, location: "Aisle" },
    { title: "Vows + ring exchange", category: "Ceremony", estimatedMinutes: 10, location: "Ceremony room" },
    { title: "First kiss", category: "Ceremony", estimatedMinutes: 2, location: "Ceremony room" },
    { title: "Signing the register", category: "Ceremony", estimatedMinutes: 5, location: "Ceremony room", withWhom: ["Bryony", "Jamie", "Joshua Dickson", "Aimee Hollingsworth"], notes: "Witnesses sign too — keep it natural, not posed" },
    { title: "Recessional", category: "Ceremony", estimatedMinutes: 3, location: "Aisle" },
    // Couple portraits
    { title: "Couple portraits — garden", category: "Couple portraits", estimatedMinutes: 25, location: "Garden lawn", withWhom: ["Bryony", "Jamie"] },
    { title: "Couple portraits — golden hour", category: "Couple portraits", estimatedMinutes: 20, location: "Garden lawn", notes: "Steal them away just before sunset" },
    // Family formals
    { title: "Bryony + parents", category: "Family formals", estimatedMinutes: 5, location: "Garden steps", withWhom: ["Bryony"] },
    { title: "Jamie + parents", category: "Family formals", estimatedMinutes: 5, location: "Garden steps", withWhom: ["Jamie"] },
    { title: "Combined family group", category: "Family formals", estimatedMinutes: 10, location: "Garden steps", notes: "Have a list — ushers herd people" },
    { title: "Wedding party group", category: "Family formals", estimatedMinutes: 10, location: "Garden steps", withWhom: ["Bryony", "Jamie", "Aimee Hollingsworth", "Joshua Dickson", "Clara", "Torin"] },
    // Reception
    { title: "Reception room — empty (before guests)", category: "Reception", estimatedMinutes: 5, location: "Main hall" },
    { title: "Speeches — reactions + key moments", category: "Reception", estimatedMinutes: 30, location: "Main hall", notes: "Cover Bryony, Jamie, parents — both sides" },
    { title: "Cake cutting", category: "Reception", estimatedMinutes: 5, location: "Cake table", withWhom: ["Bryony", "Jamie"] },
    { title: "First dance", category: "Reception", estimatedMinutes: 5, location: "Dance floor", withWhom: ["Bryony", "Jamie"] },
    { title: "Dance floor candids", category: "Reception", estimatedMinutes: 30, location: "Dance floor", notes: "Drop the formals, get the joy" },
  ];
  let shotOrder = 0;
  for (const s of shots) {
    await db.bookShot.create({
      data: {
        shotListId: shotList.id,
        title: s.title,
        category: s.category,
        estimatedMinutes: s.estimatedMinutes ?? null,
        withWhom: s.withWhom ?? [],
        location: s.location ?? null,
        notes: s.notes ?? null,
        order: shotOrder++,
      },
    });
  }

  // Album spec — FIELD.
  const albumSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "album-spec",
      title: "Album spec",
      kind: "FIELD",
      order: order++,
    },
  });
  const albumFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string }> = [
    { label: "Format", type: "text", group: "Spec", helpText: "e.g. 12×12 fine-art lay-flat" },
    { label: "Page count", type: "number", group: "Spec" },
    { label: "Cover material", type: "text", group: "Spec", helpText: "Linen / leather / silk" },
    { label: "Photo selection due", type: "date", group: "Schedule", helpText: "Couple picks from the gallery" },
    { label: "Layout proof due", type: "date", group: "Schedule" },
    { label: "Final delivery target", type: "date", group: "Schedule" },
    { label: "Cost", type: "number", group: "Cost" },
    { label: "Status", type: "select", options: ["Not started", "Selecting photos", "In layout", "Proofing", "Printing", "Delivered"], group: "Status" },
  ];
  let aOrder = 0;
  for (const f of albumFields) {
    await db.bookFieldDef.create({
      data: {
        subsectionId: albumSub.id,
        label: f.label,
        type: f.type,
        options: f.options ?? [],
        group: f.group ?? null,
        helpText: f.helpText ?? null,
        order: aOrder++,
      },
    });
  }

  // Gallery delivery — FIELD.
  const gallerySub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "gallery-delivery",
      title: "Gallery delivery",
      kind: "FIELD",
      order: order++,
    },
  });
  const galleryFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string }> = [
    { label: "Sneak-peek gallery URL", type: "text", group: "Delivery", helpText: "Within 1 week of the wedding" },
    { label: "Sneak-peek date", type: "date", group: "Delivery" },
    { label: "Full gallery URL", type: "text", group: "Delivery", helpText: "Full edit, ~6 weeks post-wedding" },
    { label: "Full gallery date", type: "date", group: "Delivery" },
    { label: "Gallery password", type: "text", group: "Delivery", helpText: "If applicable — stored here for couple's records" },
    { label: "Download deadline", type: "date", group: "Delivery", helpText: "When the gallery comes down" },
    { label: "RAW backup location", type: "text", group: "Backup", helpText: "Where the photographer archives — usually 2 years" },
  ];
  let gOrder = 0;
  for (const f of galleryFields) {
    await db.bookFieldDef.create({
      data: {
        subsectionId: gallerySub.id,
        label: f.label,
        type: f.type,
        options: f.options ?? [],
        group: f.group ?? null,
        helpText: f.helpText ?? null,
        order: gOrder++,
      },
    });
  }

  console.log(`  ✓ photography seeded (${order} subsections · ${shots.length} shots)`);
}

// v1.38.4: seed the Guest Experience section. Per BOOK-EXPANSION-PLAN
// §8.6: welcome bags / favours / order of service / welcome drinks /
// thank-you cards. Mix of BUILD (DIY items) + FIELD (vendor tracks)
// + TEXT (free-form notes).
export async function seedGuestExperienceCards() {
  const section = await db.bookSection.findUnique({ where: { slug: "guest-experience" } });
  if (!section) {
    console.log(`  · guest-experience section not found; skipping seed`);
    return;
  }
  const existing = await db.bookSubsection.count({ where: { sectionId: section.id } });
  if (existing > 0) {
    console.log(`  ✓ guest-experience already populated (${existing}); skipping seed`);
    return;
  }
  let order = 0;

  // Welcome bags — BUILD card.
  const bagsSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "welcome-bags",
      title: "Welcome bags",
      kind: "BUILD",
      order: order++,
    },
  });
  const bagsCard = await db.bookBuildCard.create({
    data: {
      subsectionId: bagsSub.id,
      quantityNeeded: 30,
      estimatedMinutesPerUnit: 6,
      notes: "For out-of-town guests staying at the recommended hotels. Drop at the hotel front desks the day before.",
    },
  });
  const bagsMaterials = [
    { name: "Kraft paper bags", quantity: 30, unit: "bags", costPence: 1500, supplier: "Hobbycraft" },
    { name: "Local map / itinerary card", quantity: 30, unit: "cards", costPence: 1200, supplier: "VistaPrint" },
    { name: "Bottled water", quantity: 30, unit: "bottles", costPence: 1500, supplier: "Tesco" },
    { name: "Local snack (Stratford fudge)", quantity: 30, unit: "packs", costPence: 4500, supplier: "Stratford Fudge Shop" },
    { name: "Hangover kit (paracetamol + mints)", quantity: 30, unit: "kits", costPence: 1500 },
  ];
  let bagMatOrder = 0;
  for (const m of bagsMaterials) {
    await db.bookBuildMaterial.create({
      data: {
        cardId: bagsCard.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        costPence: m.costPence,
        supplier: m.supplier,
        order: bagMatOrder++,
      },
    });
  }

  // Favours — BUILD card.
  const favoursSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "favours",
      title: "Favours",
      kind: "BUILD",
      order: order++,
    },
  });
  const favoursCard = await db.bookBuildCard.create({
    data: {
      subsectionId: favoursSub.id,
      quantityNeeded: 80,
      estimatedMinutesPerUnit: 3,
      notes: "Mini jar of local honey + thank-you tag. One per place setting.",
    },
  });
  const favourMaterials = [
    { name: "Mini honey jars (50g)", quantity: 80, unit: "jars", costPence: 12000, supplier: "Stratford Honey Co." },
    { name: "Hessian twine", quantity: 1, unit: "spool", costPence: 350 },
    { name: "Printed thank-you tags", quantity: 80, unit: "tags", costPence: 2400, supplier: "VistaPrint" },
  ];
  let favMatOrder = 0;
  for (const m of favourMaterials) {
    await db.bookBuildMaterial.create({
      data: {
        cardId: favoursCard.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        costPence: m.costPence,
        supplier: m.supplier,
        order: favMatOrder++,
      },
    });
  }

  // Order of service — FIELD.
  const oosSub = await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "order-of-service",
      title: "Order of service",
      kind: "FIELD",
      order: order++,
    },
  });
  const oosFields: Array<{ label: string; type: "text" | "number" | "date" | "select"; options?: string[]; group?: string; helpText?: string }> = [
    { label: "Vendor", type: "text", group: "Order", helpText: "VistaPrint or local printer" },
    { label: "Quantity", type: "number", group: "Order" },
    { label: "Order placed", type: "date", group: "Order" },
    { label: "Delivery date", type: "date", group: "Order" },
    { label: "Cost", type: "number", group: "Order" },
    { label: "Readings + readers", type: "text", group: "Content", helpText: "List the readings + who's reading each" },
    { label: "Music", type: "text", group: "Content", helpText: "Procession / signing / recession" },
    { label: "Status", type: "select", options: ["Drafting", "Proofread", "Ordered", "Delivered"], group: "Status" },
  ];
  let oOrder = 0;
  for (const f of oosFields) {
    await db.bookFieldDef.create({
      data: {
        subsectionId: oosSub.id,
        label: f.label,
        type: f.type,
        options: f.options ?? [],
        group: f.group ?? null,
        helpText: f.helpText ?? null,
        order: oOrder++,
      },
    });
  }

  // Welcome drinks reception — TEXT WYSIWYG.
  await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "welcome-drinks",
      title: "Welcome drinks reception",
      kind: "TEXT",
      bodyHtml:
        "<h2>Concept</h2>" +
        "<p>Right after the ceremony, on the garden lawn — light, sociable, photogenic.</p>" +
        "<h2>What's served</h2>" +
        "<ul>" +
        "<li>Welcome bubbly (Prosecco) — see <strong>Drinks &amp; bar</strong> card</li>" +
        "<li>Soft drink alternatives (elderflower, sparkling water)</li>" +
        "<li>Canapés — light, finger-food, no cutlery needed</li>" +
        "</ul>" +
        "<h2>Logistics</h2>" +
        "<ul>" +
        "<li><strong>14:30</strong> — venue staff have trays out before guests come up from the ceremony</li>" +
        "<li><strong>15:00</strong> — couple + photographer arrive for portraits between mingling</li>" +
        "<li><strong>15:30</strong> — formal group photos called by ushers</li>" +
        "<li><strong>16:00</strong> — move to wedding breakfast</li>" +
        "</ul>" +
        "<blockquote>If it rains, fall back to the conservatory — venue moves this without prompting.</blockquote>",
      order: order++,
    },
  });

  // Thank-you cards plan — TEXT.
  await db.bookSubsection.create({
    data: {
      sectionId: section.id,
      slug: "thank-you-cards-plan",
      title: "Thank-you cards plan",
      kind: "TEXT",
      bodyHtml:
        "<h2>Approach</h2>" +
        "<p>Hand-written, on cards printed with one of the engagement-shoot photos. Aim to send within <strong>3 months</strong> of the wedding.</p>" +
        "<h2>Card design</h2>" +
        "<ul>" +
        "<li>Front: photo from engagement shoot</li>" +
        "<li>Back: pre-printed signature (Bryony &amp; Jamie) + space for hand-written note</li>" +
        "<li>Vendor: VistaPrint, ~80 cards</li>" +
        "</ul>" +
        "<p>See the <strong>Post-wedding → Thank-you tracking</strong> card for the per-guest checklist (filled out post-wedding, with gift received and date sent).</p>",
      order: order++,
    },
  });

  console.log(`  ✓ guest-experience seeded (${order} subsections · 2 BUILD + 1 FIELD + 2 TEXT)`);
}

// v1.38.0 (P8): seed the Post-wedding section per BOOK-EXPANSION-PLAN
// §8.12. Idempotent — skipped when the section already has content.
export async function seedPostWeddingSection() {
  const section = await db.bookSection.findUnique({ where: { slug: "post-wedding" } });
  if (!section) {
    console.log(`  · post-wedding section not found; skipping seed`);
    return;
  }
  const existing = await db.bookSubsection.count({ where: { sectionId: section.id } });
  if (existing > 0) {
    console.log(`  ✓ post-wedding already populated (${existing}); skipping seed`);
    return;
  }
  // v1.38.4: FIELD cards get defs; TEXT cards get HTML markup.
  type PostSub = {
    slug: string;
    title: string;
    kind: "TEXT" | "FIELD";
    body?: string | null;
    bodyHtml?: string | null;
    fieldDefs?: Array<{
      label: string;
      type: "text" | "number" | "date" | "select";
      options?: string[];
      group?: string;
      helpText?: string;
      required?: boolean;
    }>;
  };
  const subs: PostSub[] = [
    {
      slug: "thank-you-tracking",
      title: "Thank-you tracking",
      kind: "FIELD",
      fieldDefs: [
        { label: "Cards designed", type: "select", options: ["Not started", "Drafting", "Proofing", "Ordered", "Delivered"], group: "Design", required: true },
        { label: "Vendor", type: "text", group: "Design", helpText: "e.g. VistaPrint" },
        { label: "Quantity", type: "number", group: "Design" },
        { label: "Order placed", type: "date", group: "Design" },
        { label: "Cost", type: "number", group: "Design" },
        { label: "Sending strategy", type: "text", group: "Approach", helpText: "e.g. By household, in batches of 20" },
        { label: "Sent — first batch", type: "date", group: "Progress" },
        { label: "Sent — second batch", type: "date", group: "Progress" },
        { label: "Sent — final batch", type: "date", group: "Progress" },
        { label: "All sent?", type: "select", options: ["Not yet", "Yes"], group: "Status", required: true },
      ],
    },
    {
      slug: "vendor-reviews-to-write",
      title: "Vendor reviews to write",
      kind: "TEXT",
      bodyHtml:
        "<h2>Vendors to review (within 2 months)</h2>" +
        "<ul>" +
        "<li><strong>CG Media — Louis Brough</strong> (photography) — Google + Hitched</li>" +
        "<li><strong>Paintbox Blooms</strong> (florist) — Google + Instagram tag</li>" +
        "<li><strong>Slaters</strong> (suit hire) — Google</li>" +
        "<li><strong>Dream Wedding &amp; Events</strong> (photo booth) — Hitched + Facebook</li>" +
        "<li><strong>VistaPrint</strong> (printed signage) — site review only if asked</li>" +
        "<li><strong>Stratford School of Jewellery</strong> (rings) — Google</li>" +
        "<li><strong>Alveston Manor</strong> (venue) — Hitched + Google + Bridebook</li>" +
        "<li><strong>Caterer</strong> (TBD) — Google</li>" +
        "</ul>" +
        "<blockquote>Tick a vendor off as the review goes live. Photographers + venue benefit most from reviews — those are the bookings other couples make based on names + ratings.</blockquote>",
    },
    {
      slug: "photo-video-delivery",
      title: "Photo / video delivery",
      kind: "FIELD",
      fieldDefs: [
        { label: "Photographer", type: "text", group: "Photo", helpText: "Cross-ref the Photography brief" },
        { label: "Sneak-peek delivered", type: "date", group: "Photo", helpText: "Usually within a week" },
        { label: "Sneak-peek URL", type: "text", group: "Photo" },
        { label: "Full gallery delivered", type: "date", group: "Photo", helpText: "Usually 6 weeks post-wedding" },
        { label: "Full gallery URL", type: "text", group: "Photo" },
        { label: "Gallery password", type: "text", group: "Photo" },
        { label: "Album signed off", type: "date", group: "Photo" },
        { label: "Album received", type: "date", group: "Photo" },
        { label: "Videographer", type: "text", group: "Video" },
        { label: "Highlight reel delivered", type: "date", group: "Video" },
        { label: "Full film delivered", type: "date", group: "Video" },
        { label: "Backup downloaded?", type: "select", options: ["Not yet", "Yes — local", "Yes — cloud", "Yes — both"], group: "Backup", required: true, helpText: "Photographer keeps RAWs ~2 years; download your own copy." },
      ],
    },
    {
      slug: "marriage-cert-filing",
      title: "Marriage cert filing",
      kind: "TEXT",
      bodyHtml:
        "<h2>Where this lives</h2>" +
        "<p>The actual paperwork — receiving the certificate, ordering certified copies — is in <strong>Legal — After</strong>. This card is for tracking the <em>downstream</em> filing that uses the certificate.</p>" +
        "<h2>Filing actions</h2>" +
        "<ul>" +
        "<li>Joint bank account opened?</li>" +
        "<li>Joint utilities updated?</li>" +
        "<li>Wills updated to reflect marriage?</li>" +
        "<li>Beneficiaries updated on pensions / insurance / ISAs?</li>" +
        "<li>Mortgage / tenancy agreement updated to joint name?</li>" +
        "<li>Tax codes updated (HMRC)?</li>" +
        "</ul>" +
        "<blockquote>Most of these need a certified copy of the marriage cert. Order 5 from GRO at the same time you collect the certificate — keeps you ahead.</blockquote>",
    },
  ];
  let order = 0;
  let totalDefs = 0;
  for (const s of subs) {
    const sub = await db.bookSubsection.create({
      data: {
        sectionId: section.id,
        slug: s.slug,
        title: s.title,
        kind: s.kind,
        body: s.body ?? null,
        bodyHtml: s.bodyHtml ?? null,
        order: order++,
      },
    });
    if (s.fieldDefs && s.fieldDefs.length > 0) {
      let defOrder = 0;
      for (const d of s.fieldDefs) {
        await db.bookFieldDef.create({
          data: {
            subsectionId: sub.id,
            label: d.label,
            type: d.type,
            options: d.options ?? [],
            group: d.group ?? null,
            helpText: d.helpText ?? null,
            required: d.required ?? false,
            order: defOrder++,
          },
        });
        totalDefs += 1;
      }
    }
  }
  console.log(`  ✓ post-wedding seeded (${subs.length} subsections · ${totalDefs} FIELD defs)`);
}

// v1.40.0 (backlog #3): seed one example custom permission group
// ("After-party") with the COUPLE + WEDDING_PARTY app users as
// initial members. v1.42.0: renamed from UserGroup. Idempotent.
async function seedPermissionGroups() {
  const slug = "after-party";
  const existing = await db.permissionGroup.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  ✓ permission group "${slug}" already present; skipping seed`);
    return;
  }
  const members = await db.user.findMany({
    where: { role: { in: ["COUPLE", "WEDDING_PARTY"] } },
    select: { id: true },
  });
  await db.permissionGroup.create({
    data: {
      slug,
      name: "After-party",
      description:
        "Inner-circle invite for the after-party at the bridal suite once the venue closes.",
      order: 0,
      members: { connect: members.map((m) => ({ id: m.id })) },
    },
  });
  console.log(
    `  ✓ permission group "${slug}" seeded with ${members.length} members`,
  );
}

// v1.43.0: seed sensible default GroupPermission rows on the four
// built-in groups so a fresh DB has working access control out of
// the box. Idempotent — skips writing if a row already exists for
// the (groupKey, section) pair, so manual edits via Settings
// survive a `db:seed` rerun.
//
// Defaults:
//   - couple             → EDIT on every section (couple bypass already
//                          gives them everything; setting EDIT here is
//                          belt-and-braces in case isCouple flips off)
//   - wedding-party-role → VIEW on tasks, schedule, songs, files, book
//   - planners-role      → EDIT on tasks, questions, schedule,
//                          suppliers, guests, seating, songs, files,
//                          book, settings (everything except
//                          budget/payments which are couple-only)
//   - everyone           → no defaults (intentionally empty so
//                          permissions only flow from named groups)
async function seedGroupPermissions() {
  type Seed = { groupKey: string; section: string; level: "EDIT" | "VIEW" };
  const seeds: Seed[] = [
    // Couple — full access. Belt-and-braces; the runtime check
    // already short-circuits on user.isCouple.
    ...["tasks", "questions", "schedule", "suppliers", "guests", "seating", "songs", "files", "book", "budget", "payments", "settings"].map(
      (section) => ({ groupKey: "builtin:couple", section, level: "EDIT" as const }),
    ),
    // Wedding party — VIEW on the day-of-relevant sections.
    ...["tasks", "schedule", "songs", "files", "book"].map((section) => ({
      groupKey: "builtin:wedding-party-role",
      section,
      level: "VIEW" as const,
    })),
    // Planners — EDIT on everything except couple-only sections.
    ...["tasks", "questions", "schedule", "suppliers", "guests", "seating", "songs", "files", "book", "settings"].map(
      (section) => ({ groupKey: "builtin:planners-role", section, level: "EDIT" as const }),
    ),
  ];
  let added = 0;
  let skipped = 0;
  for (const s of seeds) {
    const existing = await db.groupPermission.findUnique({
      where: { groupKey_section: { groupKey: s.groupKey, section: s.section } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.groupPermission.create({
      data: { groupKey: s.groupKey, section: s.section, level: s.level },
    });
    added++;
  }
  console.log(
    `  ✓ group permissions seeded — ${added} added, ${skipped} preserved`,
  );
}

// v1.42.0: seed two example custom guest groups so the seating
// canvas + Settings panel both show the colour-coding pattern out
// of the box. Idempotent — skips per-slug.
async function seedGuestGroups() {
  type GroupSeed = {
    slug: string;
    name: string;
    description: string;
    colour: string;
    side: "BRIDE" | "GROOM";
    order: number;
  };
  const seeds: GroupSeed[] = [
    {
      slug: "spencer-extended",
      name: "Spencer extended family",
      description: "Jamie's extended family — aunts, uncles, cousins on the groom's side.",
      colour: "#7c9c8f",
      side: "GROOM",
      order: 0,
    },
    {
      slug: "olwyn-davis-extended",
      name: "Olwyn-Davis extended family",
      description: "Bryony's extended family — aunts, uncles, cousins on the bride's side.",
      colour: "#c79a91",
      side: "BRIDE",
      order: 1,
    },
  ];
  for (const s of seeds) {
    const existing = await db.guestGroup.findUnique({ where: { slug: s.slug } });
    if (existing) {
      console.log(`  ✓ guest group "${s.slug}" already present; skipping seed`);
      continue;
    }
    // Connect every guest on the matching `side` as initial members.
    // Couple edits via the UI from there.
    const members = await db.guest.findMany({
      where: { side: s.side, archived: false },
      select: { id: true },
    });
    await db.guestGroup.create({
      data: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        colour: s.colour,
        order: s.order,
        members: { connect: members.map((m) => ({ id: m.id })) },
      },
    });
    console.log(
      `  ✓ guest group "${s.slug}" seeded with ${members.length} members`,
    );
  }
}

async function main() {
  console.log("Seeding Wedding Hub…");
  await seedUsersAndPermissions();
  await seedWeddingSettings();
  await seedScheduleEvents();
  await seedSampleTasks();
  await seedSampleHouseholds();
  await seedBookSections();
  // v1.38.5: stop seeding the legacy `wedding-party` section. The
  // v1.35.0 split moved its content to `wedding-party-people` +
  // `wedding-party-dayof`; running both seeders fills the legacy
  // section with content that duplicates the new sections. The
  // BookSection row stays in seedBookSections for back-compat with
  // existing prod databases, but no fresh content goes in.
  // await seedWeddingPartySubsections();  // removed — see comment above
  await seedNavTags();
  // v1.38.5: venue-decor seeder must run before the BUILD seeder so
  // its non-BUILD subsections (Printed signage / Florist brief / etc.)
  // land first. The BUILD seeder appends without colliding because it
  // checks per-slug; but if it ran first, venue-decor would be
  // non-empty and the decor seeder would skip-if-content-exists.
  await seedVenueSpacesAndDecor();
  await seedBuildCards();
  await seedFoodDrinkCards();
  await seedLegalSections();
  await seedWeddingPartyPeopleAndDayof();
  await seedAccommodationCards();
  await seedPhotographyCards();
  await seedGuestExperienceCards();
  await seedPostWeddingSection();
  await seedPermissionGroups();
  await seedGroupPermissions();
  await seedGuestGroups();
  console.log("Done.");
}

// v1.38.6: only run main() when this file is invoked directly
// (`node prisma/seed.js` or `tsx prisma/seed.ts`). When imported by
// the operator scripts (scripts/reset-book.ts, scripts/seed-samples-
// only.ts) the import would otherwise trigger main() to run in
// parallel with the importing script's own main() — same Prisma
// client, two concurrent transactions, P2002 unique-constraint
// violations.
//
// `require.main === module` is the standard CJS guard. The Dockerfile
// transpiles seed.ts to CommonJS, so this works at runtime. In dev
// (`tsx prisma/seed.ts`) it also resolves correctly because tsx
// preserves the same semantics.
if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
