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
async function seedVenueSpacesAndDecor() {
  const spaces = await db.bookSection.findUnique({ where: { slug: "venue-spaces" } });
  const decor = await db.bookSection.findUnique({ where: { slug: "venue-decor" } });
  if (!spaces || !decor) {
    console.log(`  · venue-spaces / venue-decor not found; skipping seed`);
    return;
  }

  // venue-spaces: SETUP cards. Idempotent — skip when ANY subsection
  // already exists under the section (user-added content protected).
  const spacesCount = await db.bookSubsection.count({ where: { sectionId: spaces.id } });
  if (spacesCount === 0) {
    const cards = [
      { slug: "ceremony-room", title: "Ceremony room", space: "Ceremony room", setupStartsAt: "10:00am", setupOwner: "Paintbox Blooms" },
      { slug: "drinks-reception", title: "Drinks reception", space: "Garden lawn", setupStartsAt: "1:30pm", setupOwner: "Venue staff" },
      { slug: "reception-room", title: "Reception room", space: "Main hall", setupStartsAt: "11:00am", setupOwner: "Bridesmaids + venue" },
      { slug: "evening-setup", title: "Evening setup", space: "Main hall", setupStartsAt: "5:30pm", setupOwner: "Best man + venue" },
      { slug: "pack-down", title: "Pack-down", space: "Whole venue", setupStartsAt: "11:00pm", setupOwner: "Bridesmaids + groomsmen" },
    ];
    let order = 0;
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
      await db.bookSetupCard.create({
        data: {
          subsectionId: sub.id,
          space: c.space,
          setupStartsAt: c.setupStartsAt,
          setupOwner: c.setupOwner,
        },
      });
    }
    console.log(`  ✓ ${cards.length} setup cards seeded under venue-spaces`);
  } else {
    console.log(`  ✓ venue-spaces subsections already present (${spacesCount}); skipping seed`);
  }

  // venue-decor: non-BUILD seed (the BUILD cards stay where the
  // v1.31.0 seeder put them, under legacy `venue`).
  const decorCount = await db.bookSubsection.count({ where: { sectionId: decor.id } });
  if (decorCount === 0) {
    const subs = [
      {
        slug: "printed-signage",
        title: "Printed signage (table numbers, menus)",
        kind: "FIELD" as const,
        body: null,
      },
      {
        slug: "florist-brief",
        title: "Florist brief",
        kind: "TEXT" as const,
        body: "Paintbox Blooms — eucalyptus + ivory roses · scope: bouquets, buttonholes, top-table arrangement, ceremony arch.",
      },
      {
        slug: "photo-booth",
        title: "Photo booth",
        kind: "FIELD" as const,
        body: null,
      },
      {
        slug: "decor-inspiration",
        title: "Décor inspiration",
        kind: "TEXT" as const,
        body: "Pinterest mood board · soft palette, candles in mason jars, bistro lighting overhead.",
      },
    ];
    let order = 0;
    for (const s of subs) {
      await db.bookSubsection.create({
        data: {
          sectionId: decor.id,
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          body: s.body,
          order: order++,
        },
      });
    }
    console.log(`  ✓ ${subs.length} venue-decor subsections seeded`);
  } else {
    console.log(`  ✓ venue-decor subsections already present (${decorCount}); skipping seed`);
  }
}

// v1.34.0: seed the three Legal sections with their per-§8.8-§8.10
// subsections. Idempotent — skipped per-section if already populated.
async function seedLegalSections() {
  const before = await db.bookSection.findUnique({ where: { slug: "legal-before" } });
  const day = await db.bookSection.findUnique({ where: { slug: "legal-day" } });
  const after = await db.bookSection.findUnique({ where: { slug: "legal-after" } });
  if (!before || !day || !after) {
    console.log(`  · legal-before/-day/-after not found; skipping seed`);
    return;
  }

  // legal-before
  const beforeCount = await db.bookSubsection.count({ where: { sectionId: before.id } });
  if (beforeCount === 0) {
    let order = 0;
    const notice = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "notice-of-marriage",
        title: "Notice of Marriage",
        kind: "LEGAL",
        order: order++,
      },
    });
    await db.bookLegalCard.create({
      data: {
        subsectionId: notice.id,
        regulator: "Warwickshire Registrar",
        regulatorContact: "warwickshire-registrars@warwickshire.gov.uk",
      },
    });
    const docs = await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "required-documents",
        title: "Required documents",
        kind: "LEGAL",
        order: order++,
      },
    });
    await db.bookLegalCard.create({
      data: {
        subsectionId: docs.id,
        regulator: "Warwickshire Registrar",
      },
    });
    await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "witnesses",
        title: "Witnesses",
        kind: "FIELD",
        order: order++,
      },
    });
    await db.bookSubsection.create({
      data: {
        sectionId: before.id,
        slug: "insurance",
        title: "Insurance",
        kind: "FIELD",
        order: order++,
      },
    });
    console.log(`  ✓ legal-before seeded (4 subsections)`);
  } else {
    console.log(`  ✓ legal-before already present (${beforeCount}); skipping seed`);
  }

  // legal-day
  const dayCount = await db.bookSubsection.count({ where: { sectionId: day.id } });
  if (dayCount === 0) {
    let order = 0;
    await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "pre-ceremony-interview",
        title: "Pre-ceremony interview",
        kind: "FIELD",
        order: order++,
      },
    });
    await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "vows-reference",
        title: "Vows reference",
        kind: "TEXT",
        body: "Vows go here — exchange in the registrar's room before the ceremony begins.",
        order: order++,
      },
    });
    await db.bookSubsection.create({
      data: {
        sectionId: day.id,
        slug: "registration-steps",
        title: "Registration steps",
        kind: "TEXT",
        body: "1. Pre-ceremony interview · 2. Ceremony · 3. Sign register · 4. Witnesses sign · 5. Marriage cert handed over.",
        order: order++,
      },
    });
    console.log(`  ✓ legal-day seeded (3 subsections)`);
  } else {
    console.log(`  ✓ legal-day already present (${dayCount}); skipping seed`);
  }

  // legal-after
  const afterCount = await db.bookSubsection.count({ where: { sectionId: after.id } });
  if (afterCount === 0) {
    let order = 0;
    const pickup = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "marriage-certificate-pickup",
        title: "Marriage certificate pickup",
        kind: "LEGAL",
        order: order++,
      },
    });
    await db.bookLegalCard.create({
      data: {
        subsectionId: pickup.id,
        regulator: "Warwickshire Registrar",
      },
    });
    const nameChange = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "name-change-checklist",
        title: "Name change checklist",
        kind: "LEGAL",
        order: order++,
      },
    });
    await db.bookLegalCard.create({ data: { subsectionId: nameChange.id } });
    const copies = await db.bookSubsection.create({
      data: {
        sectionId: after.id,
        slug: "certified-copies",
        title: "Certified copies",
        kind: "LEGAL",
        order: order++,
      },
    });
    await db.bookLegalCard.create({ data: { subsectionId: copies.id } });
    console.log(`  ✓ legal-after seeded (3 subsections)`);
  } else {
    console.log(`  ✓ legal-after already present (${afterCount}); skipping seed`);
  }
}

// v1.35.0: seed `wedding-party-people` with one OUTFIT card per known
// wedding-party member, and `wedding-party-dayof` with the timeline /
// ring-keepers / day-of TEXT + FIELD subsections from §8.2 of the
// Book expansion plan. Idempotent — both sections seeded
// independently, and a section that already has content is skipped.
async function seedWeddingPartyPeopleAndDayof() {
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

  // wedding-party-people — one OUTFIT card per known member.
  const peopleCount = await db.bookSubsection.count({
    where: { sectionId: people.id },
  });
  if (peopleCount === 0) {
    const members = [
      { personName: "Bryony", role: "Bride" },
      { personName: "Jamie", role: "Groom" },
      { personName: "Aimee Hollingsworth", role: "Maid of Honour" },
      { personName: "Joshua Dickson", role: "Best Man" },
      { personName: "Clara", role: "Flower Girl" },
      { personName: "Torin", role: "Page Boy" },
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
      await db.bookOutfitCard.create({
        data: {
          subsectionId: sub.id,
          personName: m.personName,
          role: m.role,
        },
      });
    }
    console.log(`  ✓ wedding-party-people seeded (${members.length} OUTFIT cards)`);
  } else {
    console.log(
      `  ✓ wedding-party-people already present (${peopleCount}); skipping seed`,
    );
  }

  // wedding-party-dayof — TEXT/FIELD subsections per §8.2.
  const dayofCount = await db.bookSubsection.count({
    where: { sectionId: dayof.id },
  });
  if (dayofCount === 0) {
    const subs = [
      {
        slug: "morning-prep-timeline",
        title: "Morning prep timeline",
        kind: "TEXT" as const,
        body: "Bridesmaids arrive at the bridal suite 11:00.\nGroomsmen arrive at the manor 12:30.\nPhotographer with the groomsmen 12:45.\nPhotographer with the bridesmaids 13:00.",
      },
      {
        slug: "ring-keepers",
        title: "Ring keepers",
        kind: "TEXT" as const,
        body: "Joshua holds both rings until the ceremony.\nHand-off in the groomsmen room at 1:30pm.\nConfirm with Aimee day-of.",
      },
      {
        slug: "pre-ceremony-handoffs",
        title: "Pre-ceremony hand-offs",
        kind: "TEXT" as const,
        body: "Bouquets to bridesmaids 13:30.\nButtonholes to groomsmen 13:00.\nFlower girl petals to Clara 13:45.",
      },
      {
        slug: "wedding-day-cars",
        title: "Wedding-day cars",
        kind: "FIELD" as const,
        body: null,
      },
      {
        slug: "stag-hen-recap",
        title: "Stag & Hen recap",
        kind: "TEXT" as const,
        body: "Stag · …\nHen · …",
      },
    ];
    let order = 0;
    for (const s of subs) {
      await db.bookSubsection.create({
        data: {
          sectionId: dayof.id,
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          body: s.body,
          order: order++,
        },
      });
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
async function seedAccommodationCards() {
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

  // Four sample STAY cards (per §8.11) + one LODGING_GUIDE card.
  const stays = [
    {
      slug: "bridal-suite",
      title: "Bridal Suite",
      propertyName: "Alveston Manor — Bridal Suite",
      occupants: ["Bryony", "Jamie"],
    },
    {
      slug: "bryony-night-before",
      title: "Bryony — night before",
      propertyName: "Alveston Manor — Bridal Suite (early check-in)",
      occupants: ["Bryony"],
    },
    {
      slug: "bridesmaids-night-before",
      title: "Aimee / bridesmaids — night before",
      propertyName: "Alveston Manor — bridesmaid block",
      occupants: ["Aimee Hollingsworth"],
    },
    {
      slug: "groomsmen-night-before",
      title: "Jamie / groomsmen — night before",
      propertyName: "Alveston Manor — groomsmen block",
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
        occupants: s.occupants,
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

// v1.38.0 (P8): seed the Post-wedding section per BOOK-EXPANSION-PLAN
// §8.12. Idempotent — skipped when the section already has content.
async function seedPostWeddingSection() {
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
  const subs = [
    {
      slug: "thank-you-tracking",
      title: "Thank-you tracking",
      kind: "FIELD" as const,
      body: null,
    },
    {
      slug: "vendor-reviews-to-write",
      title: "Vendor reviews to write",
      kind: "TEXT" as const,
      body: "List vendors here as reviews go live (CG Media, Paintbox Blooms, Slaters, Dream Wedding & Events, VistaPrint, Stratford School of Jewellery, Warwickshire Registrar).",
    },
    {
      slug: "photo-video-delivery",
      title: "Photo / video delivery",
      kind: "FIELD" as const,
      body: null,
    },
    {
      slug: "marriage-cert-filing",
      title: "Marriage cert filing",
      kind: "TEXT" as const,
      body: "See `legal-after` → Marriage certificate pickup for the actual paperwork. Track filing-elsewhere actions here (joint accounts, ID, name change) as they roll out.",
    },
  ];
  let order = 0;
  for (const s of subs) {
    await db.bookSubsection.create({
      data: {
        sectionId: section.id,
        slug: s.slug,
        title: s.title,
        kind: s.kind,
        body: s.body,
        order: order++,
      },
    });
  }
  console.log(`  ✓ post-wedding seeded (${subs.length} subsections)`);
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
  await seedVenueSpacesAndDecor();
  await seedLegalSections();
  await seedWeddingPartyPeopleAndDayof();
  await seedAccommodationCards();
  await seedPostWeddingSection();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
