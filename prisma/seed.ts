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
  const events = [
    { title: "Bridal suite check-in",  startTime: `${day}T12:00:00Z`, audience: ["couple", "party"], order: 1 },
    { title: "Arrival",                 startTime: `${day}T13:00:00Z`, audience: ["everyone"],         order: 2 },
    { title: "Ceremony",                startTime: `${day}T14:00:00Z`, audience: ["everyone"],         order: 3 },
    { title: "Drinks Reception",        startTime: `${day}T14:30:00Z`, audience: ["everyone"],         order: 4 },
    { title: "Wedding Breakfast",       startTime: `${day}T16:00:00Z`, audience: ["everyone"],         order: 5 },
    { title: "Speeches",                startTime: `${day}T18:00:00Z`, audience: ["everyone"],         order: 6 },
    { title: "First Dance",             startTime: `${day}T19:30:00Z`, audience: ["everyone"],         order: 7 },
    { title: "Evening Buffet",          startTime: `${day}T20:00:00Z`, audience: ["everyone"],         order: 8 },
  ];
  for (const e of events) {
    const existing = await db.scheduleEvent.findFirst({ where: { title: e.title, startTime: new Date(e.startTime) } });
    if (existing) continue;
    await db.scheduleEvent.create({
      data: {
        title: e.title,
        startTime: new Date(e.startTime),
        location: "Alveston Manor",
        audience: e.audience,
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

// Idempotent: only seeds when there are zero shots in the DB. Real shots
// added via the UI are never overwritten by a re-run of `npm run db:seed`.
async function seedPhotographyShots() {
  const existing = await db.photographyShot.count();
  if (existing > 0) {
    console.log(`  ✓ photography shots already present (${existing}); skipping seed`);
    return;
  }
  const shots = [
    { title: "Couple portraits",         withWhom: ["Jamie", "Bryony"],                                  location: "Garden if dry, library if not", notes: null,             order: 1 },
    { title: "Whole wedding party",      withWhom: ["Jamie", "Bryony", "Joshua", "Aimee"],               location: "Front lawn",                    notes: null,             order: 2 },
    { title: "Bride's immediate family", withWhom: ["Bryony", "Torin", "Tia"],                           location: "Drawing room",                  notes: null,             order: 3 },
    { title: "Groom's immediate family", withWhom: ["Jamie", "Tyler"],                                   location: "Library",                       notes: null,             order: 4 },
    { title: "Ring keepers with rings",  withWhom: ["Joshua", "Aimee", "Jamie", "Bryony"],               location: null,                            notes: "Before ceremony", order: 5 },
    { title: "Flower girl & page boy",   withWhom: ["Clara", "Torin"],                                   location: "Garden",                        notes: null,             order: 6 },
  ];
  await db.photographyShot.createMany({ data: shots });
  console.log(`  ✓ ${shots.length} sample photography shots`);
}

async function main() {
  console.log("Seeding Wedding Hub…");
  await seedUsersAndPermissions();
  await seedScheduleEvents();
  await seedSampleTasks();
  await seedSampleHouseholds();
  await seedBookSections();
  await seedWeddingPartySubsections();
  await seedPhotographyShots();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
