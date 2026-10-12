// Shared fixture for the Memory Book unit tests: a tiny wedding with one
// of everything, dated so the journey spans a year boundary.

import type { MemorySources } from "@/lib/memories/sources";

export function fixture(): MemorySources {
  return {
    settings: {
      weddingDate: "2026-09-24T14:00:00.000Z",
      ceremonyTime: "2:00pm ceremony",
      venue: "Alveston Manor",
      venueAddress: null,
      coupleLabel: "Spencer · Olwyn-Davis Wedding",
      coupleShort: "Jamie & Bryony's Wedding",
      brideFirst: "Bryony",
      groomFirst: "Jamie",
    },
    guests: [
      {
        id: "g1", firstName: "Wendy", lastName: "Davis", rsvp: "ATTENDING", isChild: false, needsHighchair: false,
        side: "BRIDE", role: null, dietary: [], mealStarter: "Soup", mealMain: "Chicken", mealDessert: "Eton mess",
        householdId: "h1", householdName: "Wendy", groups: ["Bride's Family"], isPlusOne: false,
        createdAt: "2026-04-20T10:00:00.000Z", seatTableName: "Table 1",
        songRequests: [{ title: "Time Warp", artist: null, createdAt: "2026-04-29T10:00:00.000Z" }],
      },
      {
        id: "g2", firstName: "Aimee", lastName: "Hollingsworth", rsvp: "ATTENDING", isChild: false, needsHighchair: false,
        side: "BRIDE", role: "Maid of Honour", dietary: ["Vegetarian"], mealStarter: "Soup", mealMain: "Pithivier", mealDessert: null,
        householdId: "h2", householdName: "Aimee", groups: ["Bridesmaids"], isPlusOne: false,
        createdAt: "2026-04-20T10:00:00.000Z", seatTableName: "Table 1", songRequests: [],
      },
      {
        id: "g3", firstName: "Oscar", lastName: "Sillitto", rsvp: "ATTENDING", isChild: true, needsHighchair: true,
        side: "GROOM", role: null, dietary: [], mealStarter: null, mealMain: null, mealDessert: null,
        householdId: "h3", householdName: "Sillitto", groups: [], isPlusOne: false,
        createdAt: "2026-04-21T10:00:00.000Z", seatTableName: null, songRequests: [],
      },
      {
        id: "g4", firstName: "Chris", lastName: "Fisher", rsvp: "DECLINED", isChild: false, needsHighchair: false,
        side: "BOTH", role: null, dietary: [], mealStarter: null, mealMain: null, mealDessert: null,
        householdId: "h4", householdName: "Fisher", groups: [], isPlusOne: false,
        createdAt: "2026-04-21T10:00:00.000Z", seatTableName: null, songRequests: [],
      },
      {
        id: "g5", firstName: "Plus", lastName: "One", rsvp: "ATTENDING", isChild: false, needsHighchair: false,
        side: "BOTH", role: null, dietary: [], mealStarter: null, mealMain: null, mealDessert: null,
        householdId: "h4", householdName: "Fisher", groups: [], isPlusOne: true,
        createdAt: "2026-04-21T10:00:00.000Z", seatTableName: null, songRequests: [],
      },
    ],
    tables: [
      { id: "t0", name: "Top Table", shape: "HEAD", capacity: 2, seats: [{ index: 0, guestName: "Jamie Spencer" }, { index: 1, guestName: "Bryony-Olwyn Davis" }] },
      { id: "t1", name: "Table 1", shape: "ROUND", capacity: 3, seats: [{ index: 0, guestName: "Wendy Davis" }, { index: 1, guestName: "Aimee Hollingsworth" }, { index: 2, guestName: null }] },
    ],
    tasks: [
      { id: "k1", title: "Book the venue", type: "TASK", status: "DONE", decisionAnswer: null, questionAnswer: null, notes: null, dueDate: null, createdAt: "2025-03-20T10:00:00.000Z", updatedAt: "2025-04-02T10:00:00.000Z", supplierName: "Alveston Manor", sectionSlugs: [] },
      { id: "k2", title: "Decide first dance song", type: "DECISION", status: "DONE", decisionAnswer: "Detectorists — Johnny Flynn", questionAnswer: null, notes: null, dueDate: null, createdAt: "2026-07-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z", supplierName: null, sectionSlugs: [] },
      { id: "k3", title: "Microphone for speeches?", type: "QUESTION", status: "DONE", decisionAnswer: null, questionAnswer: "No — the room is small enough.", notes: null, dueDate: null, createdAt: "2026-08-10T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z", supplierName: "Alveston Manor", sectionSlugs: [] },
      { id: "k4", title: "Old idea", type: "TASK", status: "ARCHIVED", decisionAnswer: null, questionAnswer: null, notes: null, dueDate: null, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-02T10:00:00.000Z", supplierName: null, sectionSlugs: [] },
      { id: "k5", title: "Write thank-you cards", type: "TASK", status: "OPEN", decisionAnswer: null, questionAnswer: null, notes: null, dueDate: null, createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z", supplierName: null, sectionSlugs: [] },
    ],
    events: [
      { id: "e1", title: "Suit Day", startTime: "2026-05-31T00:00:00.000Z", endTime: null, location: "Slaters", notes: null, allDay: true, printable: true, order: 0 },
      { id: "e2", title: "Bridal suite check-in", startTime: "2026-09-23T15:00:00.000Z", endTime: null, location: "Alveston Manor", notes: null, allDay: false, printable: true, order: 0 },
      { id: "e3", title: "Ceremony", startTime: "2026-09-24T14:00:00.000Z", endTime: null, location: "Cedar Room", notes: "Clara and Torin first.", allDay: false, printable: true, order: 0 },
      { id: "e4", title: "Drinks Reception", startTime: "2026-09-24T14:30:00.000Z", endTime: null, location: "Terrace", notes: null, allDay: false, printable: true, order: 1 },
    ],
    suppliers: [
      {
        id: "s1", name: "Alveston Manor", category: "Venue", status: "BOOKED", website: null, notes: "The venue.\n\nMore detail.", amountAgreed: 5390,
        createdAt: "2025-03-01T10:00:00.000Z",
        contacts: [{ name: "Jen Hammocks", role: "Events", primary: true }],
        contracts: [{ signed: true, signedAt: "2025-04-02T00:00:00.000Z" }],
        communications: [{ channel: "email", summary: "Final details meeting booked.", createdAt: "2026-08-04T10:00:00.000Z" }],
      },
      {
        id: "s2", name: "Devon Dens", category: "Honeymoon accommodation", status: "BOOKED", website: "https://www.devondens.co.uk", notes: null, amountAgreed: null,
        createdAt: "2026-08-10T10:00:00.000Z", contacts: [], contracts: [],
        communications: [{ channel: "email", summary: "Hot tub requested.", createdAt: "2026-09-20T10:00:00.000Z" }],
      },
      { id: "s3", name: "Some DJ", category: "DJ", status: "REJECTED", website: null, notes: null, amountAgreed: null, createdAt: "2026-02-01T10:00:00.000Z", contacts: [], contracts: [], communications: [] },
    ],
    payments: [
      { id: "p1", description: "Venue Deposit", amount: 1000, status: "PAID", dueDate: null, paidDate: "2025-04-07T00:00:00.000Z", method: "Bank Transfer", supplierName: "Alveston Manor", notes: null, createdAt: "2026-05-01T10:00:00.000Z" },
      { id: "p2", description: "Devon Dens honeymoon — balance", amount: 606, status: "PAID", dueDate: null, paidDate: "2026-09-07T00:00:00.000Z", method: null, supplierName: null, notes: "Four nights on Dartmoor.", createdAt: "2026-08-20T10:00:00.000Z" },
      { id: "p3", description: "Flowers balance", amount: 603, status: "DUE", dueDate: "2026-09-10T00:00:00.000Z", paidDate: null, method: null, supplierName: "Paintbox Bloom", notes: null, createdAt: "2026-08-20T10:00:00.000Z" },
    ],
    budget: {
      categories: [
        { name: "Venue", estimated: 7360, actual: 7121.5, paid: 7121.5 },
        { name: "Honeymoon", estimated: 0, actual: 0, paid: 0 },
      ],
      totals: { estimated: 7360, actual: 7121.5, paid: 7121.5 },
    },
    playlists: [
      { id: "pl1", name: "Must play", category: "MUST_PLAY", isBlockList: false, songs: [{ title: "Mr Brightside", artist: "The Killers", createdAt: "2026-08-02T10:00:00.000Z" }] },
      { id: "pl2", name: "Do not play", category: "DO_NOT_PLAY", isBlockList: true, songs: [] },
    ],
    book: [
      {
        id: "b1", slug: "food-drink", title: "Food & Drink", subtitle: null, order: 0, createdAt: "2026-05-17T10:00:00.000Z",
        cards: [{ id: "c1", slug: "wedding-breakfast", title: "Wedding breakfast", kind: "MENU", visibility: "EVERYONE", doc: { title: "Wedding breakfast", blocks: [{ kind: "paragraph", spans: [{ text: "Plated at four." }] }] } }],
      },
      {
        id: "b2", slug: "post-wedding", title: "Post-wedding", subtitle: null, order: 1, createdAt: "2026-05-17T10:00:00.000Z",
        cards: [
          { id: "c2", slug: "thank-you-tracking", title: "Thank-you tracking", kind: "FIELD", visibility: "EVERYONE", doc: { title: "Thank-you tracking", blocks: [] } },
          { id: "c3", slug: "marriage-cert-filing", title: "Marriage cert filing", kind: "TEXT", visibility: "EVERYONE", doc: { title: "Marriage cert filing", blocks: [] } },
        ],
      },
      {
        id: "b3", slug: "something-else", title: "Something Else", subtitle: "Unmapped", order: 2, createdAt: "2026-06-01T10:00:00.000Z",
        cards: [{ id: "c4", slug: "a-card", title: "A card", kind: "TEXT", visibility: "EVERYONE", doc: { title: "A card", blocks: [] } }],
      },
      {
        id: "b4", slug: "photography", title: "Photography", subtitle: null, order: 3, createdAt: "2026-05-17T10:00:00.000Z",
        cards: [{ id: "c5", slug: "shot-list", title: "Shot list", kind: "SHOT_LIST", visibility: "EVERYONE", doc: { title: "Shot list", blocks: [] }, shots: { total: 10, captured: 3 } }],
      },
    ],
    files: [{ id: "f1", name: "IMG_1.jpeg", mimeType: "image/jpeg", folder: "Book photos", createdAt: "2026-05-18T10:00:00.000Z" }],
    aiThreads: [
      { id: "a1", title: "Date conflict", createdAt: "2026-07-20T10:00:00.000Z", exchange: { user: "Which date is it?", assistant: "The 24th." } },
      { id: "a2", title: "Empty", createdAt: "2026-07-21T10:00:00.000Z", exchange: null },
    ],
  };
}
