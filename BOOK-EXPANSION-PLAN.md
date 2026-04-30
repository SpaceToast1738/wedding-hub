# Wedding Book — Comprehensive Expansion Plan (v3)

> Working document for a series of Claude Code sessions. Scope: full
> rethink and expansion of the Wedding Book — new and split sections,
> new card kinds, refined granularity, WYSIWYG editor for TEXT cards,
> delivered in eight phases. The plan is **iteration-paced, not
> calendar-paced** — phases ship when they're ready, with no global
> freeze deadline.
>
> **Audience:** Jamie + the Claude Code session that picks this up.
>
> **Foundational principle inherited from the project:**
> *simplicity > flexibility.* Every addition below is opinionated,
> bounded, and earns its place against a real task on the real wedding.
>
> **What changed since v2:**
> - TEXT cards get a real WYSIWYG editor (Tiptap, stripped-back).
> - Feature-freeze concept removed entirely. Iteration continues
>   through to the wedding day; risk management shifts from "freeze"
>   to "every change ships green CI before tag" and standing rules
>   already in place.
> - Signage acknowledged as mixed: some DIY (handmade welcome /
>   directional signs), some printed by VistaPrint (table numbers,
>   menus). Seed splits into two subsections.
> - Name places (place cards) confirmed DIY — seeded as a BUILD card.
> - Post-wedding section retained — it's content not deferred work.

---

## 0. Where we are today

The current Wedding Book has:

- **7 sections** (Wedding Party, Venue/Décor/Setup, Food & Drink,
  Photography, Guest Experience, Legal & Admin, Accommodation) plus
  3 legacy sections (Ceremony, Reception, Logistics) at the bottom.
- **5 card kinds**: `TEXT`, `FIELD`, `RECIPE`, `SHOT_LIST`, `OUTFIT`.
- **Card chrome** shared via `CardChrome.tsx`; each kind has its own
  editor component routed by `CardRouter.tsx`.
- **Cross-links**: `Task.bookSubsectionId` (v1.30.0) lets
  tasks/questions/decisions attach to any card.

Most sections are mostly TEXT cards today. The point of this expansion
is to replace freeform text with **typed, opinionated cards** wherever
there's a recurring pattern that's currently being typed by hand, to
align card granularity with how the couple actually thinks about each
item, and to give TEXT — which will remain the most-used kind — a
proper editing experience.

---

## 1. Granularity principle

This is the most important framing in the plan; the rest follows.

**One card per thing-with-a-status.** If a row would have its own
supplier, its own cost, its own due date, and someone might ask
"what's the status of X?" — make it a card, not a row. Tasks already
attach to subsections (v1.30); making something a card means it gets
its own discussion thread, its own attached files, its own visibility
flag, its own audit trail.

Things that **become their own cards**:

- One outfit per person (was: rows on a shared OUTFIT card)
- One stay per booking (was: rows on a shared ACCOMMODATION card)
- One DIY project per build (centerpieces, signage groups, place
  cards all separate BUILD cards)

Things that **stay as rows** on a parent card:

- Materials within a BUILD card
- Sessions logged against a BUILD card
- Items of an outfit (dress / shoes / jewellery / hair piece all on
  one person's OUTFIT card)
- Menu options within a course
- Bar items within a bar plan
- Setup items within a space
- Legal items within a deadline group
- Shots within a shot list
- Recipe steps within a recipe
- Lodging recommendations within a guide

The test: would anyone ever ask "what's the status of the floral
foam?" — no, so it's a row in a Materials list. Would anyone ask
"what's the status of Bryony's dress?" — yes, so it's a card.

---

## 2. Section structure (final shape)

Sections go from 7+3 legacy to **9 active, 3 legacy**. The legacy
three (Ceremony / Reception / Logistics) stay deprecated at the
bottom; they get no new content, and their existing data stays
readable for safety.

| # | Section | Slug | Notes |
|---|---|---|---|
| 1 | Wedding Party — People | `wedding-party-people` | Outfits + roles. **New, replaces single `wedding-party`.** |
| 2 | Wedding Party — Day-of | `wedding-party-dayof` | Prep timeline, hand-offs, ring keepers |
| 3 | Venue — Spaces | `venue-spaces` | SETUP cards per physical space |
| 4 | Venue — Décor | `venue-decor` | BUILD cards (DIY) + florist brief |
| 5 | Food & Drink | `food-drink` | Unchanged slug; expanded cards |
| 6 | Photography & Videography | `photography` | Unchanged slug; expanded SHOT_LIST |
| 7 | Guest Experience | `guest-experience` | Unchanged slug; mix of BUILD + FIELD |
| 8 | Legal — Before the day | `legal-before` | Notice of Marriage, documents, witnesses |
| 9 | Legal — On the day | `legal-day` | Pre-ceremony interview, vows, registration |
| 10 | Legal — After | `legal-after` | Marriage cert pickup, name change, copies |
| 11 | Accommodation | `accommodation` | STAY cards (your bookings) + LODGING_GUIDE (recs) |
| 12 | Post-wedding | `post-wedding` | Thank-yous, vendor reviews, photo delivery |

**Sections deliberately not added:**

- **Travel & Transport** — confirmed out of scope (you're not arranging
  guest transport). Wedding-day cars for the couple/wedding party live
  as FIELD cards on `wedding-party-dayof`.
- **Music & Entertainment** — already covered by the Songs DB and the
  music notes under Guest Experience. Don't duplicate.
- **Budget / Tasks / Suppliers** — these are top-level pages, not Book
  sections. Cross-linked from the Book, not nested into it.

The legacy `ceremony` / `reception` / `logistics` sections stay where
they are at orders 13–15. They get no new seeding. Existing content
remains readable.

---

## 3. Card kinds (final palette)

After v3 refinements: **12 card kinds total** = 5 existing + 7 new.

| Kind | Existing? | Used in |
|---|---|---|
| `TEXT` | ✅ (editor upgraded) | Anywhere — narrative content with rich formatting |
| `FIELD` | ✅ | Reference data (insurance, rings, package details) |
| `RECIPE` | ✅ | DIY cake, signature cocktail |
| `SHOT_LIST` | ✅ | Photography only |
| `OUTFIT` | ✅ but reworked | One card per person |
| `BUILD` | 🆕 P1 | DIY production tracker |
| `MENU` | 🆕 P2 | Wedding breakfast / kids / evening / late-night |
| `BAR` | 🆕 P2 | Drinks plan |
| `SETUP` | 🆕 P3 | Per-space décor placement |
| `LEGAL` | 🆕 P4 | Document checklists with deadlines |
| `STAY` | 🆕 P6 | One card per booking you make |
| `LODGING_GUIDE` | 🆕 P6 | Single card listing recommended hotels |

Each new kind follows the existing pattern:

- One `BookXxxCard` table, 1:1 with `BookSubsection` via
  `subsectionId @unique`.
- Optional 1:m children for line items.
- New value added to `BookSubsectionKind` enum.
- New editor component in `src/app/(app)/book/[slug]/BookXxxCard.tsx`,
  registered in `CardRouter.tsx`.
- Server actions in `src/app/(app)/book/actions.ts` gated via
  `requireEdit("book")`.
- Audit log writes via the existing `audit()` helper.
- Unit tests for any pure-decision logic in `tests/unit/`.
- Migration is additive only; existing rows default to safe values.

---

## 4. New card kinds — schema

### 4.1 `BUILD` — DIY production tracker

For centerpieces, place cards, handmade signage, anything you're
making yourself. **One card per project.**

```prisma
model BookBuildCard {
  id              String          @id @default(cuid())
  subsectionId    String          @unique
  subsection      BookSubsection  @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  quantityNeeded  Int?
  targetDate      DateTime?
  status          String?         // "Designing" | "Prototyping" | "Producing" | "Done"
  prototypeDone   Boolean         @default(false)
  prototypeNotes  String?         @db.Text
  estimatedMinutesPerUnit Int?
  notes           String?         @db.Text
  materials       BookBuildMaterial[]
  sessions        BookBuildSession[]
}

model BookBuildMaterial {
  id          String         @id @default(cuid())
  cardId      String
  card        BookBuildCard  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  name        String
  quantity    Float?
  unit        String?
  supplier    String?
  costPence   Int?
  ordered     Boolean        @default(false)
  arrived     Boolean        @default(false)
  notes       String?
  order       Int            @default(0)
}

model BookBuildSession {
  id              String         @id @default(cuid())
  cardId          String
  card            BookBuildCard  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  date            DateTime
  minutes         Int
  unitsCompleted  Int?
  notes           String?
  loggedById      String?
  createdAt       DateTime       @default(now())
}
```

UI surfaces: header strip with units done / quantity, hours logged /
estimated, status pill, target date. Materials table with `ordered`
and `arrived` checkbox columns. Sessions log with "+ Log session"
button. One-click "Copy materials total to Budget" creates a draft
BudgetLine — manual review, no auto-sync.

### 4.2 `MENU` — food composition with live guest selection

For each food service: wedding breakfast, kids, evening, late-night.
**One card per service.**

```prisma
model BookMenuCard {
  id                  String     @id @default(cuid())
  subsectionId        String     @unique
  subsection          BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  serviceType         String?    // "Plated" | "Buffet" | "Family-style" | "Canapés"
  serviceTime         String?    // "1:30pm wedding breakfast"
  pricePerHeadPence   Int?
  confirmedHeadcount  Int?
  notes               String?    @db.Text
  courses             BookMenuCourse[]
}

model BookMenuCourse {
  id           String   @id @default(cuid())
  cardId       String
  card         BookMenuCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  courseLabel  String   // "Starter" | "Main" | "Dessert" | "Late-night"
  order        Int
  options      BookMenuOption[]
}

model BookMenuOption {
  id               String         @id @default(cuid())
  courseId         String
  course           BookMenuCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)
  label            String
  description      String?        @db.Text
  dietary          String[]       @default([])
  isVegetarianMain Boolean        @default(false)
  isKidsMeal       Boolean        @default(false)
  order            Int            @default(0)
  // Optional FK so guest selections aggregate cleanly.
  mealOptionId     String?
  mealOption       MealOption?    @relation(fields: [mealOptionId], references: [id], onDelete: SetNull)
}
```

UI surfaces: per-course tables with live counts pulled from
`Guest.mealChoice`. Allergen summary aggregated across selections.
Print stylesheet for caterer handover.

### 4.3 `BAR` — drinks plan

Distinct from MENU because the structure is different (no per-guest
selection, glass-counts and bottles matter).

```prisma
model BookBarCard {
  id            String   @id @default(cuid())
  subsectionId  String   @unique
  subsection    BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  barType       String?  // "Open bar" | "Drinks tab to £X" | "Cash bar" | "Wine + toast only"
  tabLimitPence Int?
  toastDrink    String?  // "Champagne" | "Prosecco" | "Sparkling elderflower"
  corkagePence  Int?
  notes         String?  @db.Text
  items         BookBarItem[]
}

model BookBarItem {
  id              String       @id @default(cuid())
  cardId          String
  card            BookBarCard  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  category        String       // "Reception drink" | "Wine" | "Beer" | "Soft" | "Spirits"
  name            String
  quantityPlanned Float?
  unit            String?
  supplier        String?
  costPence       Int?
  notes           String?
  order           Int          @default(0)
}
```

UI surfaces: items grouped by category. "Per-head sanity check" line:
flag if outside 0.5–1.5 bottles/head against confirmed adults.

### 4.4 `SETUP` — per-space décor placement

For Ceremony room, Drinks reception, Reception room, Evening setup,
Pack-down. **One card per space.**

```prisma
model BookSetupCard {
  id              String   @id @default(cuid())
  subsectionId    String   @unique
  subsection      BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  space           String?
  setupStartsAt   String?
  setupOwner      String?  // "Paintbox Blooms" | "Bridesmaids" | "Best man's car"
  notes           String?  @db.Text
  items           BookSetupItem[]
}

model BookSetupItem {
  id           String        @id @default(cuid())
  cardId       String
  card         BookSetupCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  name         String
  quantity     Int?
  location     String?       // "Top of aisle" | "Round-table centre"
  source       String?       // free-text but auto-completes from Supplier names
  packed       Boolean       @default(false)
  placed       Boolean       @default(false)
  packDownPlan String?
  notes        String?
  order        Int           @default(0)
}
```

UI surfaces: header with space, owner, start time. Items table with
two checkbox columns (`packed`, `placed`). Pack-down plan column.
Print stylesheet — single page per space for the venue coordinator
and best man.

### 4.5 `LEGAL` — document checklist with deadline

For each phase of legal admin (before / on the day / after).
**One card per coherent deadline group.**

```prisma
model BookLegalCard {
  id                String  @id @default(cuid())
  subsectionId      String  @unique
  subsection        BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  regulator         String? // "Warwickshire Registrar"
  regulatorContact  String?
  dueByDate         DateTime?
  notes             String? @db.Text
  items             BookLegalItem[]
}

model BookLegalItem {
  id           String          @id @default(cuid())
  cardId       String
  card         BookLegalCard   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  label        String          // "Notice of Marriage — Jamie"
  requiredFor  String?         // "Bride" | "Groom" | "Both" | "Witness"
  obtained     Boolean         @default(false)
  obtainedAt   DateTime?
  expiresAt    DateTime?
  fileId       String?
  file         File?           @relation(fields: [fileId], references: [id], onDelete: SetNull)
  notes        String?
  order        Int             @default(0)
}
```

UI surfaces: deadline strip with days-remaining countdown. Items
table with `obtained` checkbox and optional file picker. Red flag if
`expiresAt < weddingDate`.

### 4.6 `STAY` — one card per booking

For rooms you're booking and paying for. **One card per stay**, not
one card with rows.

```prisma
model BookStayCard {
  id                String  @id @default(cuid())
  subsectionId      String  @unique
  subsection        BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  propertyName      String?
  propertyContact   String?
  bookingReference  String?
  checkInDate       DateTime?
  checkOutDate      DateTime?
  costPence         Int?
  paidBy            String? // "Couple" | "Self" | "Parents"
  paid              Boolean @default(false)
  occupants         String[] @default([])
  guestIds          String[] @default([])  // optional FKs to Guest.id
  notes             String? @db.Text
}
```

UI surfaces: property header with check-in/out and group rate. Cost
line with `paidBy` chip and `paid` toggle. Occupants free-text plus
optional Guest chips (clicking opens guest panel — existing pattern
from seating canvas v1.27.7).

Note on `guestIds`: forward link only. The reverse — telling Guest
detail "this guest is staying at X" — happens via a query at render
time, not denormalisation. See P7.

### 4.7 `LODGING_GUIDE` — guest accommodation reference

Read-mostly reference data. **One card with rows** (this is a list,
not individual things-with-status).

```prisma
model BookLodgingCard {
  id           String  @id @default(cuid())
  subsectionId String  @unique
  subsection   BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  notes        String? @db.Text  // intro / notes from couple
  items        BookLodgingItem[]
}

model BookLodgingItem {
  id                String          @id @default(cuid())
  cardId            String
  card              BookLodgingCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  name              String
  distanceFromVenue String?         // "0.3 miles — 8 min walk"
  priceRangeLabel   String?         // "£" | "££" | "£££"
  phone             String?
  website           String?
  groupRateCode     String?
  notes             String?
  order             Int             @default(0)
}
```

UI surfaces: simple table or card grid. Print stylesheet — a single
sheet to share when guests ask.

### 4.8 OUTFIT — reworked to one card per person

The schema barely changes; the *intent* changes. Currently `OUTFIT`
holds one card with many `BookOutfit` rows. After the rework, each
person gets their own `OUTFIT` card; the existing `BookOutfit` table
becomes the per-item composition (dress + shoes + accessories) for
that one person.

```prisma
model BookOutfitCard {
  id                 String         @id @default(cuid())
  subsectionId       String         @unique
  subsection         BookSubsection @relation(fields: [subsectionId], references: [id], onDelete: Cascade)
  // NEW card-level fields:
  personName         String         // "Bryony" | "Jamie" | "Aimee" | etc.
  role               String?        // "Bride" | "Groom" | "Best Man" | "Bridesmaid" | "Groomsman" | "Flower Girl"
  fittingDate        DateTime?
  alterationsDueBy   DateTime?
  pickupDate         DateTime?
  costPence          Int?
  paidBy             String?        // "Self" | "Couple" | "Parents"
  paid               Boolean        @default(false)
  fileIds            String[]       @default([])
  notes              String?        @db.Text
  outfits            BookOutfit[]   // existing 1:m
}

model BookOutfit {
  id          String         @id @default(cuid())
  cardId      String
  card        BookOutfitCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  // existing fields stay; some get repurposed:
  // personName / role move to the card (see above) — old columns kept
  //   one release as recoverability buffer.
  itemLabel   String         // "Dress" | "Shoes" | "Veil" | "Tie" | "Cufflinks"
  description String?
  supplier    String?
  status      String?        // "Designed" | "Ordered" | "Fitted" | "Collected"
  notes       String?        @db.Text
  order       Int            @default(0)
}
```

Migration is the most delicate piece in the whole plan: existing
rows on the legacy single-card OUTFIT are exploded into one
subsection per row (one card per person). This is a data migration
script, not just schema. See P5 for the detailed approach.

UI surfaces per card: person header with role chip, fitting timeline
strip (fitting → alterations → pickup), cost line with paidBy chip
and paid toggle, items list (dress / shoes / etc.) each with its
own supplier and status, photos. Today page widget surfaces upcoming
fittings.

---

## 5. TEXT card editor — Tiptap WYSIWYG

The biggest *qualitative* change in this plan. TEXT cards are the
most-used kind and currently use a plain textarea, which is friction
for the wedding-party non-developers who'll author most of the
content.

### 5.1 What changes

- Read mode: rendered HTML (was: plain text in a `<p>`).
- Edit mode: a Tiptap WYSIWYG editor replacing the textarea. What
  you see while typing IS the rendered output.
- Storage: the `body` column changes from "plain text" to "HTML
  string". An additive `bodyHtml` column is added; `body` stays
  populated for one release as a recoverability buffer; data
  migration converts existing plain-text bodies to escaped HTML
  paragraphs.

### 5.2 Stripped-back feature set

Tiptap supports a huge surface area; we deliberately enable a small
slice. The toolbar shows exactly these controls and no more:

- **Bold** / **Italic** / **Underline**
- **Heading 2** and **Heading 3** (no H1 — the card title is the H1)
- **Bullet list** / **Numbered list**
- **Blockquote**
- **Link** (with a small popup to set href)
- **Undo** / **Redo**

Explicitly NOT enabled:

- Tables, images, embeds, iframes, code blocks, horizontal rules
- Slash menus, drag handles, mentions, comments
- Custom blocks of any kind
- Colour/highlight controls

This is the "no Notion clone" rule, made concrete. The editor extension
list is a compile-time constant; it can't be expanded by users.

### 5.3 Library + dependencies

- `@tiptap/react` + `@tiptap/starter-kit` (covers most of the marks
  above; starter-kit excludes link/underline by default).
- `@tiptap/extension-link` for links.
- `@tiptap/extension-underline` for underline.
- No CSS framework dep — style with Tailwind v4 via the
  `editor.options.attributes.class` API.

### 5.4 Sanitisation

HTML output goes through a sanitiser before save. Use
`sanitize-html` server-side in the update action to strip anything
outside the allow-list (matching the toolbar). Even though the
toolbar doesn't expose unsafe controls, defence-in-depth: a paste
of arbitrary HTML mustn't become persistent XSS.

Allow-list: `p`, `strong`, `em`, `u`, `h2`, `h3`, `ul`, `ol`, `li`,
`blockquote`, `a` (with `href` + `rel="noopener noreferrer"`,
`target="_blank"` enforced), `br`. Strip everything else.

### 5.5 Rendering on read

`dangerouslySetInnerHTML` is fine here because:

1. The HTML is sanitised on write (above).
2. It is never set from untrusted input (only from server-saved
   data the couple/wedding party authored under audit).
3. Add a final sanitise on read as belt-and-braces.

### 5.6 Mobile

Tiptap works on mobile but the toolbar is the friction point. On
narrow viewports, collapse the toolbar to: Bold, Italic, List,
Link, and a "More" button revealing the rest. Existing mobile
layout patterns from the Tasks drawer should be reused.

### 5.7 Migration

Done in the P7 prompt (existing card upgrades). Approach:

1. Add `bodyHtml String?` column. Default null.
2. Backfill: for every existing `BookSubsection` with `kind=TEXT`
   and a non-null `body`, convert to HTML by:
   - Wrapping the whole thing in `<p>...</p>`
   - Escaping `<`, `>`, `&`
   - Replacing double-newlines with `</p><p>`
   - Replacing single-newlines with `<br>`
3. Render reads from `bodyHtml` if present, else falls back to
   escaped `body` wrapped in `<p>`.
4. Editor saves write `bodyHtml` (sanitised). `body` stops being
   updated from this release onwards.
5. One release later, drop `body` (separate phase, post-P8 if at
   all — no urgency).

---

## 6. Existing card-kind upgrades (besides TEXT)

### 6.1 `FIELD` — typed values + grouping + validation

Today: typed via `BookFieldDef` but rendered as a flat list. Upgrade:

- `BookFieldDef.group String?` — optional grouping label, collapsible
  groups in the editor.
- `BookFieldDef.helpText String?` — caption under each label.
- `BookFieldDef.required Boolean` — server action validates on save.
- For numeric: `min Float?`, `max Float?`.
- For date: `dateMin`, `dateMax`.

### 6.2 `RECIPE` — scaling + step timing + day-before tagging

- `BookRecipe.servingsBase Int?` and a UI scaler.
- Replace `steps Json` with a child table `BookRecipeStep` carrying
  `order, instruction, durationMinutes?, dayBefore Bool`. Data migration
  parses the existing `steps` Json strings into rows. Keep the old
  column for one release as a safety net.
- Total active time surfaces in the header.

### 6.3 `SHOT_LIST` — categories + time budget

- `BookShot.category String?` — free text, grouped in renderer.
- `BookShot.estimatedMinutes Int?` — time-budget rollup at the top.

---

## 7. Cross-module wiring

Card kinds are only powerful when they connect. Each link is **one
query at render time**, not denormalisation, except where explicitly
noted.

| From | To | Connection |
|---|---|---|
| `MENU` option | `Guest.mealChoice` via `MealOption` FK | live counts, allergen summary |
| `MENU` headcount | `Rsvp` aggregate | `confirmedHeadcount` auto-fills |
| `BUILD` materials totals | `BudgetLine` | manual one-click "Copy to Budget" |
| `SETUP` items | `Supplier` | `source` field auto-completes from Supplier names |
| `STAY` occupants | `Guest` | optional FK chips; clicking opens guest panel |
| `STAY.guestIds` | Guest detail | reverse query: "this guest is staying at X" |
| `LEGAL` deadlines | Today page | upcoming-deadline widget |
| `OUTFIT` fittings | Today page | upcoming-fitting widget |
| Any card | `Task` | already wired (v1.30.0) |

---

## 8. Section-by-section seeded layout

### 8.1 Wedding Party — People (`wedding-party-people`)

| Subsection | Card kind |
|---|---|
| Roles overview | `FIELD` |
| Bryony — outfit | `OUTFIT` |
| Jamie — outfit | `OUTFIT` |
| Aimee Hollingsworth — outfit (Maid of Honour) | `OUTFIT` |
| Joshua Dickson — outfit (Best Man) | `OUTFIT` |
| Bridesmaid 1, 2, 3… — outfit (one per) | `OUTFIT` |
| Groomsman 1, 2, 3… — outfit (one per) | `OUTFIT` |
| Clara — outfit (Flower Girl) | `OUTFIT` |
| Torin — outfit (Page Boy) | `OUTFIT` |

### 8.2 Wedding Party — Day-of (`wedding-party-dayof`)

| Subsection | Card kind |
|---|---|
| Morning prep timeline | `TEXT` (WYSIWYG) |
| Ring keepers | `TEXT` |
| Pre-ceremony hand-offs | `TEXT` |
| Wedding-day cars | `FIELD` |
| Stag & Hen recap | `TEXT` |

### 8.3 Venue — Spaces (`venue-spaces`)

| Subsection | Card kind |
|---|---|
| Ceremony room | `SETUP` |
| Drinks reception | `SETUP` |
| Reception room | `SETUP` |
| Evening setup | `SETUP` |
| Pack-down | `SETUP` |

### 8.4 Venue — Décor (`venue-decor`)

| Subsection | Card kind |
|---|---|
| Centerpieces | `BUILD` |
| Handmade signage (welcome, directional) | `BUILD` |
| Printed signage (table numbers, menus) | `FIELD` (VistaPrint order details) |
| Place cards / name places | `BUILD` (DIY) |
| Florist brief | `TEXT` (Paintbox Blooms scope) |
| Photo booth | `FIELD` (Dream Wedding & Events package) |
| Décor inspiration | `TEXT` |

### 8.5 Food & Drink (`food-drink`)

| Subsection | Card kind |
|---|---|
| Wedding breakfast | `MENU` |
| Kids' meal | `MENU` (`isKidsMeal=true` options) |
| Evening food | `MENU` |
| Late-night snack | `MENU` (optional) |
| Drinks & bar | `BAR` |
| Cake | `RECIPE` if DIY, else `FIELD` |
| Catering brief notes | `TEXT` |

### 8.6 Photography & Videography (`photography`)

| Subsection | Card kind |
|---|---|
| Package details | `FIELD` (CG Media — Louis Brough) |
| Must-have shots | `SHOT_LIST` |
| Locations | `TEXT` |
| Day-of contact | `FIELD` |

### 8.7 Guest Experience (`guest-experience`)

| Subsection | Card kind |
|---|---|
| Welcome bags | `BUILD` if DIY, else `FIELD` |
| Favours | `BUILD` if DIY, else `FIELD` |
| Photo booth | `FIELD` |
| Guest book | `FIELD` |
| Pixel Party / table games | `FIELD` |
| Programs / order of service | `BUILD` if DIY, else `FIELD` |
| Music notes | `TEXT` |

### 8.8 Legal — Before the day (`legal-before`)

| Subsection | Card kind |
|---|---|
| Notice of Marriage | `LEGAL` |
| Required documents | `LEGAL` |
| Witnesses | `FIELD` |
| Insurance | `FIELD` (WeddingPlan Insurance) |

### 8.9 Legal — On the day (`legal-day`)

| Subsection | Card kind |
|---|---|
| Pre-ceremony interview | `FIELD` |
| Vows reference | `TEXT` |
| Registration steps | `TEXT` |

### 8.10 Legal — After (`legal-after`)

| Subsection | Card kind |
|---|---|
| Marriage certificate pickup | `LEGAL` |
| Name change checklist | `LEGAL` |
| Certified copies | `LEGAL` |

### 8.11 Accommodation (`accommodation`)

| Subsection | Card kind |
|---|---|
| Bridal Suite | `STAY` |
| Bryony — night before | `STAY` |
| Aimee / bridesmaids — night before | `STAY` (one per stay you're paying for) |
| Jamie / groomsmen — night before | `STAY` |
| Recommended for guests | `LODGING_GUIDE` |

### 8.12 Post-wedding (`post-wedding`)

| Subsection | Card kind |
|---|---|
| Thank-you tracking | `FIELD` |
| Vendor reviews to write | `TEXT` |
| Photo / video delivery | `FIELD` |
| Marriage cert filing | reference back to `legal-after` |

---

## 9. Phased delivery

**Eight phases**, each one shippable as a single Claude Code session
ending in a `dev` push, a green CI run, and a ROADMAP entry. **No
phase requires a breaking schema change.** Migrations are additive.
Phase 1 must come first; Phase 8 must come last. The middle six can
be reordered if priorities shift.

| Phase | Title | Card kinds | Section impact | Est. commits |
|---|---|---|---|---|
| **P1** | BUILD card | BUILD | Venue — Décor, Guest Experience | 4–6 |
| **P2** | MENU + BAR cards | MENU, BAR | Food & Drink (full rebuild) | 6–8 |
| **P3** | SETUP card + Venue split | SETUP | Venue — Spaces (new) + Venue — Décor (new) | 5–7 |
| **P4** | LEGAL card + Legal split | LEGAL | Legal-before / -day / -after (3 new sections) | 5–7 |
| **P5** | OUTFIT rework + Wedding Party split | (OUTFIT reworked) | Wedding Party — People + Day-of (2 new sections) | 7–9 |
| **P6** | STAY + LODGING_GUIDE | STAY, LODGING_GUIDE | Accommodation (rebuilt) | 4–6 |
| **P7** | TEXT WYSIWYG + other existing-card upgrades + cross-module wiring | (all existing) | Today widgets, guest panel, budget linkbacks, **Tiptap editor** | 8–10 |
| **P8** | Seed refresh + Post-wedding section | none new | All sections re-seeded; new Post-wedding section | 3–4 |

P5 is the largest because of the OUTFIT data migration. P7 is also
heavy because it bundles the WYSIWYG migration alongside the
cross-module wiring. If P7 feels too dense, split it: P7a does the
TEXT WYSIWYG migration alone (the riskiest part); P7b does the
remaining card upgrades and cross-module wiring.

---

## 10. Standing constraints (read every prompt against these)

1. **Simplicity > flexibility.** No rich-text block editor in cards.
   No user-configurable card schemas. The card kinds are the schemas.
   The TEXT WYSIWYG editor in P7 is deliberately stripped to ~10
   marks (see §5.2) — it is *not* the start of a slippery slope to
   blocks, embeds, or slash menus.
2. **Admin-only.** No guest-facing flows. No public RSVP. Email
   reminders go to the wedding party only.
3. **Additive migrations only.** No drops, no breaking renames. New
   columns default to safe values so existing rows render unchanged.
   The OUTFIT data migration in P5 and the TEXT body→bodyHtml
   migration in P7 are the two exceptions; both keep the legacy
   columns populated for one release as recoverability buffers.
4. **Respect the test pyramid.** Every new pure-decision module has
   unit tests. Integration tests for any new server actions. No new
   e2e specs unless a flow is genuinely critical.
5. **Audit every write.** Every mutating server action calls `audit()`.
6. **Permission gate every action.** Every server action calls
   `requireEdit("book")`.
7. **No auto-sync between modules.** Cross-module wiring is read-time
   queries or one-click manual actions. (The Spotify mirror is the
   pre-existing exception.)
8. **One ROADMAP changelog entry per ship.**
9. **No new tags until CI is green on the same SHA.**
10. **Sanitise all WYSIWYG-authored HTML on write AND on read.**

### 10a. Edit-row field layout (temporary, v1.33.1 → end of this arc)

Added after v1.33.1 fixed cramped fields that v1.32.2's edit row
introduced. Applies to every new card editor shipped in P4–P8.
Re-evaluate after v1.38.0 — promote to permanent or relax.

Every multi-field edit row (an item / option / line) in a Book card
follows these rules:

1. **Two-row grid maximum.** Don't pack 5+ fields into a single
   12-column row. Cards live in a `max-w-3xl` column (~660 px
   usable); a 1-col field is ~42 px wide and unusable. Split into
   two grids of 3–4 fields each, or three for very busy rows.
2. **Per-cell labels.** Every input has a small uppercase label
   above it (`text-[10px] uppercase tracking-wider text-ink-tertiary
   font-bold`). Even narrow columns are recognisable at a glance.
   Use the `FieldLabel` + `Label` primitives — currently copy-pasted
   in `BookBuildCard.tsx`, `BookBarCard.tsx`, `BookSetupCard.tsx`;
   when P4 lands, lift them into `src/app/(app)/book/[slug]/bookCardUi.tsx`
   alongside the existing £-input helpers.
3. **Minimum column widths per field type** (relative to a 12-col
   row):
   - **Name / label / title**: ≥4 cols (~190 px) — the primary
     thing on the row.
   - **Supplier / source / contact**: ≥4 cols.
   - **£ price inputs**: ≥3 cols. The £ prefix + decimal value +
     optional `/hd` suffix need the space.
   - **Qty (numeric)**: 2 cols minimum.
   - **Unit / short text**: 2 cols minimum.
   - **Free-text "when" / "where" / "category"**: 3 cols minimum.
4. **Toggles + checkboxes + reorder/remove on a third compact row.**
   Pricing-mode toggles, flag checkboxes (ordered/arrived,
   packed/placed, vegetarian-main/kids-meal), and the up/down/×
   buttons all live below the field grid in a single
   `flex items-center justify-between` row. They never take grid
   columns away from the field inputs.
5. **View mode mirrors the same proportions.** When a card switches
   from edit to view, the column widths and grouping should match
   so the user's eye doesn't have to recalibrate.
6. **Helper hints stay on the header fields, not per-row inputs.**
   Hints (the small grey text under the input) belong on top-of-
   card "what is this card for" fields, not on every line item —
   per-line hints add clutter and the placeholder usually carries
   the meaning.

When a P4–P8 prompt is executed, run the resulting editor against
this checklist before declaring done. The v1.33.1 layout in
`BookBarCard.tsx`/`BookSetupCard.tsx`/`BookBuildCard.tsx` is the
canonical reference — copy the shape.

---

There is **no calendar-based feature freeze** in this plan. Risk is
managed by the standing rules above (every change ships green CI; no
breaking migrations; audit on every write; tests gate every release)
not by stopping iteration. If a fix or content change is needed close
to the wedding day, it ships through the same pipeline as everything
else — small, tested, reversible.

---

## 11. Phase prompts

Each prompt is self-contained and assumes the Claude Code session has
read `README.md`, `ROADMAP.md`, `CLAUDE.md`, and this document.

### Shared prompt header (paste into every phase)

```
You are working on the Wedding Hub repo. Standing rules:

- Read README.md, CLAUDE.md, the Snapshot section of ROADMAP.md, and
  BOOK-EXPANSION-PLAN.md before doing anything.
- Branch: work on `dev`.
- All migrations are additive. No drops, no breaking renames. Existing
  rows must render unchanged after the migration. The OUTFIT phase
  (P5) and the TEXT WYSIWYG migration in P7 are the only exceptions
  — see those prompts for the data migration approach.
- Every server action calls `requireEdit("book")` and `audit()`.
- Add unit tests for any pure-decision logic in `tests/unit/`.
- Add integration tests for new server actions in `tests/integration/`.
- Pre-ship gate: `npm run typecheck && npm run lint && npm test &&
  npm run test:integration && npm run test:e2e && npm run build`
  must all be green on the same SHA before tagging.
- End the session by writing a ROADMAP changelog entry at the top of
  the Changelog table, following the existing format.
- Tag as `vX.Y.0` after merge to claude/main, fast-forward only.

Constraint: simplicity > flexibility. No rich-text block editors in
cards (the TEXT WYSIWYG in P7 is a tightly-scoped exception). No
user-configurable schemas. The card kind IS the schema. Admin-only:
no guest-facing flows.
```

### P1 — BUILD card

```
[paste shared header above this line]

P1: ship the BUILD card kind. Target version: v1.31.0.

Goal: track DIY production projects (centerpieces, handmade signage,
place cards, favours) end-to-end inside a single Wedding Book card.
One card per project.

Schema: see §4.1 of BOOK-EXPANSION-PLAN.md. Add `BUILD` to the
BookSubsectionKind enum. Add the three new tables (BookBuildCard,
BookBuildMaterial, BookBuildSession). Wire BookBuildCard? onto
BookSubsection (mirror the existing recipe / shotList / outfitCard
relations) with cascade.

UI: new BookBuildCard.tsx in src/app/(app)/book/[slug]/, registered
in CardRouter.tsx. Header strip: units done / quantity, hours logged
/ estimated, status pill, target date. Materials table with `ordered`
and `arrived` checkbox columns. Sessions log with "+ Log session"
form (date prefilled today, minutes, units completed, notes).

One-click action: "Copy materials total to Budget" creates a draft
BudgetLine with the rolled-up sum and the card's title — couple
reviews and saves on the Budget page. Do NOT auto-sync.

Server actions in src/app/(app)/book/actions.ts:
- createBuildMaterial, updateBuildMaterial, deleteBuildMaterial,
  reorderBuildMaterials
- createBuildSession, updateBuildSession, deleteBuildSession
- updateBuildCard
- copyMaterialsToBudget

Tests:
- tests/unit/build-card.test.ts: rollups (total cost, hours done vs
  estimated, units done vs needed), prototype-blocker logic
  (target date approaches AND prototype not done = warning).
- tests/integration/build-actions.test.ts: each server action with
  a non-couple wedding-party user (EDIT on book) — happy path +
  permission failure for someone with NONE on book.

Seed update: add three BUILD subsections to the existing "Venue, Décor
& Setup" section: "Centerpieces" (3 sample materials, no sessions),
"Handmade signage" (placeholder materials), and "Place cards"
(placeholder for the DIY name places).

Ship: ROADMAP entry "v1.31.0 — Wedding Book BUILD card".
```

### P2 — MENU + BAR cards

```
[paste shared header above this line]

P2: ship MENU and BAR cards. Target version: v1.32.0.

Goal: replace freeform Food & Drink notes with structured cards that
compute headcount × price, surface allergens, and connect live to
guest meal selections.

Schema: see §4.2 and §4.3 of BOOK-EXPANSION-PLAN.md. Add `MENU` and
`BAR` to BookSubsectionKind enum. Add BookMenuCard, BookMenuCourse,
BookMenuOption tables. Add BookBarCard, BookBarItem tables.

UI:
- BookMenuCard.tsx: per-course tables of options with live counts
  read from Guest.mealChoice (joining via the optional MealOption FK
  if set, else by label match within the course). Allergen summary
  at the top. Print stylesheet for caterer handover.
- BookBarCard.tsx: items grouped by category. Total cost. Per-head
  sanity check: flag if outside 0.5–1.5 bottles/head against
  confirmed adult headcount.

Server actions: createMenuCourse, updateMenuCourse, deleteMenuCourse,
reorderMenuCourses, createMenuOption, updateMenuOption,
deleteMenuOption, updateMenuCard, plus BAR equivalents.

Tests:
- tests/unit/menu-rollups.test.ts: headcount × price, allergen
  aggregation, course ordering.
- tests/unit/bar-rollups.test.ts: total cost, per-head sanity.
- tests/integration/menu-bar-actions.test.ts: auth + permission gates.

Seed update: replace existing Food & Drink subsection seed with one
MENU per service (Wedding breakfast: 3 courses × 2 options each;
Kids' meal: 1 course; Evening food: placeholder; Late-night optional),
one BAR (Drinks & bar with sample items), one RECIPE (Cake — DIY)
and one TEXT (Catering brief notes).

Ship: ROADMAP entry "v1.32.0 — Wedding Book MENU + BAR cards".
```

### P3 — SETUP card + Venue section split

```
[paste shared header above this line]

P3: ship the SETUP card AND split the Venue section in two. Target
version: v1.33.0.

Goal: replace freeform setup notes with a per-space spatial walkthrough
(SETUP cards), and split the existing `venue` section into two cleaner
sections: `venue-spaces` (SETUP cards per physical space) and
`venue-decor` (BUILD cards + printed signage + florist brief).

Schema: see §4.4 of BOOK-EXPANSION-PLAN.md. Add `SETUP` to the
BookSubsectionKind enum. Add BookSetupCard, BookSetupItem tables.

Section split (additive — DO NOT delete the legacy `venue` row):
1. Add two new BookSection rows: `venue-spaces` (order 3) and
   `venue-decor` (order 4) — pushing existing sections down.
2. Existing subsections under the legacy `venue` slug stay there;
   the slug becomes a deprecated section.
3. The `/book` index page hides legacy sections with zero
   subsections (verify or add the existing pattern).

UI:
- BookSetupCard.tsx: header with space, owner, setup-start time.
  Items table with `packed` and `placed` checkbox columns. Pack-down
  plan column.
- `source` field on BookSetupItem auto-completes from existing
  Supplier.name values (read-only suggestion list — no FK).
- Print stylesheet: per-space single-page sheet for the venue
  coordinator.

Server actions: createSetupItem, updateSetupItem, deleteSetupItem,
reorderSetupItems, updateSetupCard, toggleSetupItemFlag.

Tests:
- tests/unit/setup-rollups.test.ts: % packed, % placed, ordering.
- tests/integration/setup-actions.test.ts: auth + permission gates.
- tests/integration/section-split.test.ts: confirm legacy `venue`
  rows still render.

Seed update: seed `venue-spaces` with five SETUP cards (Ceremony
room, Drinks reception, Reception room, Evening setup, Pack-down).
Seed `venue-decor` with: BUILD cards already created in P1
(Centerpieces, Handmade signage, Place cards) — link rather than
re-create; FIELD card for "Printed signage (table numbers, menus)"
holding the VistaPrint order details; TEXT card for "Florist brief";
FIELD card for "Photo booth"; TEXT card for "Décor inspiration".

Ship: ROADMAP entry "v1.33.0 — Wedding Book SETUP card + Venue split".
```

### P4 — LEGAL card + Legal section split

```
[paste shared header above this line]

P4: ship LEGAL card AND split the Legal & Admin section into three.
Target version: v1.34.0.

Goal: turn legal admin into three timeline-aligned sections —
`legal-before`, `legal-day`, `legal-after` — using LEGAL cards with
deadlines and file attachments where structure helps, FIELD/TEXT
elsewhere.

Schema: see §4.5 of BOOK-EXPANSION-PLAN.md. Add `LEGAL` to the
BookSubsectionKind enum. Add BookLegalCard, BookLegalItem tables.
BookLegalItem.fileId is an optional FK to the existing File model.

Section split (additive):
1. Add three new BookSection rows: `legal-before` (order 8),
   `legal-day` (order 9), `legal-after` (order 10).
2. The legacy `legal-admin` slug stays as a deprecated section.

UI:
- BookLegalCard.tsx: deadline strip with days-remaining countdown.
  Items table with `obtained` checkbox and optional file picker
  (existing 25 MB cap, signed download). Red flag when expiresAt <
  weddingDate.

Server actions: standard CRUD for items, updateLegalCard,
attachFileToLegalItem, detachFileFromLegalItem.

Tests:
- tests/unit/legal-deadlines.test.ts: days-remaining, expiry flag.
- tests/integration/legal-actions.test.ts: auth + permission gates.
- tests/integration/legal-files.test.ts: file attachment flow.

Seed update: seed all three new sections per §8.8–8.10. Notice of
Marriage points to Warwickshire Registrar.

Ship: ROADMAP entry "v1.34.0 — Wedding Book LEGAL card + Legal split".
```

### P5 — OUTFIT rework + Wedding Party split

```
[paste shared header above this line]

P5: rework OUTFIT to one-card-per-person AND split Wedding Party into
two sections. Target version: v1.35.0.

Goal: every member of the wedding party gets their own OUTFIT card
with their own fitting timeline, cost tracking, and items list.
Wedding Party section splits into `wedding-party-people` (the cards)
and `wedding-party-dayof` (prep timeline + ring keepers + cars).

THIS IS THE LARGEST PHASE. Buffer extra time. The data migration is
the riskiest part of the entire expansion.

Schema: see §4.8 of BOOK-EXPANSION-PLAN.md. Card-level fields move
ONTO BookOutfitCard:
  + personName, role, fittingDate, alterationsDueBy, pickupDate,
    costPence, paidBy, paid, fileIds, notes
The existing BookOutfit row table is repurposed: rows become items
(itemLabel, description, supplier, status, notes, order). The
existing `personName` and `role` columns on BookOutfit are deprecated
but kept for one release as a recoverability buffer.

Section split (additive):
1. Add `wedding-party-people` (order 1) and `wedding-party-dayof`
   (order 2). Push existing sections down.
2. Legacy `wedding-party` slug becomes deprecated.

DATA MIGRATION:
1. For every existing BookOutfitCard with N children:
   a. If 0 or 1 children: leave alone. Copy the single child's
      personName/role onto the card.
   b. If 2+ children: for each child, create a new BookSubsection
      under `wedding-party-people` with title "{personName} — outfit".
      Create a new BookOutfitCard on each new subsection. Copy the
      child's personName/role onto the new card. Move the child to
      its new card's items list, with itemLabel defaulting to
      "Outfit" (since old rows didn't separate items).
2. The original card's subsection becomes empty. Mark for review
   rather than deleting (set body to "Migrated to per-person cards
   — please review and delete this subsection").
3. Old BookOutfit.personName / role columns stay populated for one
   release as a recoverability buffer.

UI:
- BookOutfitCard.tsx (rewritten): person header with role chip,
  fitting timeline strip (fitting → alterations → pickup), cost
  line with paidBy chip and paid toggle, items list with per-item
  supplier and status, photos via fileIds.
- Today page widget data exposed here; widget itself ships in P7.

Server actions: updateOutfitCard, createOutfitItem, updateOutfitItem,
deleteOutfitItem, reorderOutfitItems, attachOutfitFile,
detachOutfitFile.

Tests:
- tests/unit/outfit-card.test.ts: timeline computations, cost rollup,
  paid status.
- tests/integration/outfit-migration.test.ts: data migration runs
  cleanly on a seeded "legacy shape" fixture; idempotent on rerun.
- tests/integration/outfit-actions.test.ts: auth + permission gates.

Seed update: seed `wedding-party-people` with one OUTFIT card per
known wedding-party member (Bryony, Jamie, Aimee, Joshua, Clara,
Torin to start; couple adds the rest via UI). Seed
`wedding-party-dayof` with TEXT/FIELD subsections per §8.2.

Ship: ROADMAP entry "v1.35.0 — Wedding Book OUTFIT rework + Wedding Party split".
```

### P6 — STAY + LODGING_GUIDE

```
[paste shared header above this line]

P6: ship STAY and LODGING_GUIDE cards. Target version: v1.36.0.

Goal: support both kinds of accommodation tracking — bookings the
couple is making and paying for (one STAY card per booking) and
recommended hotels for guests (one LODGING_GUIDE card with rows).

Schema: see §4.6 and §4.7 of BOOK-EXPANSION-PLAN.md. Add `STAY` and
`LODGING_GUIDE` to BookSubsectionKind enum. Add BookStayCard table.
Add BookLodgingCard, BookLodgingItem tables.

BookStayCard.guestIds is a String[] of optional FKs to Guest.id. No
relation defined; lookup happens at render time.

UI:
- BookStayCard.tsx: property header (name, contact, booking ref),
  check-in/out dates, cost line with paidBy chip and paid toggle.
  Occupants free-text plus optional Guest chips (clicking opens
  guest panel — reuse existing pattern from seating canvas).
- BookLodgingCard.tsx: simple table of recommended properties with
  distance, price range, phone, website, group rate. Print
  stylesheet — single sheet ready to share.

Server actions: updateStayCard, addStayOccupant, removeStayOccupant,
linkStayGuest, unlinkStayGuest, updateLodgingCard, createLodgingItem,
updateLodgingItem, deleteLodgingItem, reorderLodgingItems.

Tests:
- tests/unit/stay-card.test.ts: cost rollup, paid logic.
- tests/integration/stay-actions.test.ts: auth + permission gates.
- tests/integration/lodging-actions.test.ts: auth + permission gates.

Seed update: replace Accommodation subsections with STAY cards for
Bridal Suite + relevant night-before stays, plus one LODGING_GUIDE
card seeded with placeholder hotels around Stratford-upon-Avon.

Ship: ROADMAP entry "v1.36.0 — Wedding Book STAY + LODGING_GUIDE cards".
```

### P7 — TEXT WYSIWYG + remaining card upgrades + cross-module wiring

```
[paste shared header above this line]

P7: ship the TEXT card WYSIWYG editor, upgrade the other existing
cards, and wire everything into the rest of the app. Target version:
v1.37.0.

This phase is intentionally bundled because each piece is small but
related. If P7 feels too dense, split into P7a (TEXT WYSIWYG only)
and P7b (everything else). The TEXT migration is the riskiest piece;
it ships first.

PART A — TEXT WYSIWYG (see §5):

1. Schema:
   - Add `BookSubsection.bodyHtml String?` (nullable, default null).
   - Keep `BookSubsection.body` for one release as a recoverability
     buffer. Stop writing to it from this release on.

2. Migration:
   - For every BookSubsection with kind=TEXT and non-null body:
     escape `<`, `>`, `&`; replace `\n\n` with `</p><p>`; replace
     remaining `\n` with `<br>`; wrap the whole thing in `<p>...</p>`;
     write the result to bodyHtml.

3. Editor:
   - Install @tiptap/react, @tiptap/starter-kit,
     @tiptap/extension-link, @tiptap/extension-underline, sanitize-html.
   - New component src/components/ui/RichTextEditor.tsx.
   - Toolbar: Bold, Italic, Underline, H2, H3, Bullet list, Numbered
     list, Blockquote, Link, Undo, Redo. Nothing else.
   - On mobile (< 640px): collapse toolbar to Bold, Italic, List,
     Link, "More" button revealing the rest in a sheet.
   - Output is HTML string, sanitised via sanitize-html on save.
   - Allow-list: p, strong, em, u, h2, h3, ul, ol, li, blockquote, a
     (href + rel="noopener noreferrer" target="_blank"), br.

4. Read mode: render bodyHtml via dangerouslySetInnerHTML (also
   sanitised on read as belt-and-braces). Fall back to the legacy
   body field if bodyHtml is null.

5. Server action:
   - updateTextBody now writes bodyHtml (sanitised). Permission gate
     and audit as usual.

6. Tests:
   - tests/unit/text-sanitise.test.ts: every disallowed tag/attr
     gets stripped; allowed tags pass through.
   - tests/integration/text-migration.test.ts: backfill produces
     valid HTML for every TEXT row in a seeded "legacy shape" fixture;
     idempotent on rerun.
   - tests/integration/text-editor.test.ts: round-trip — load card,
     edit body, save, reload — content matches.

PART B — other existing card upgrades (see §6):

1. FIELD — add `BookFieldDef.group String?`, `helpText String?`,
   `required Boolean`, `min Float?`, `max Float?`, `dateMin`,
   `dateMax`. Editor groups by `group` (collapsible). Server action
   validates on save.

2. RECIPE — add `BookRecipe.servingsBase Int?`. Replace `steps Json`
   with new BookRecipeStep table (order, instruction, durationMinutes?,
   dayBefore Bool). Data migration parses existing steps Json into rows.
   Keep the steps column for one release. UI: scaling control, total
   active time, day-before tag.

3. SHOT_LIST — add `BookShot.category String?` and
   `estimatedMinutes Int?`. Group shots by category. Time-budget
   rollup at the top.

PART C — cross-module wiring (no new schemas):

1. Today page additions:
   - "Open decisions" widget: oldest-open Tasks with type=DECISION,
     capped at 5.
   - "Upcoming legal deadlines" widget: BookLegalCard.dueByDate or
     BookLegalItem.expiresAt within next 30 days.
   - "Upcoming fittings & pickups" widget: BookOutfitCard.fittingDate,
     alterationsDueBy, or pickupDate within next 30 days.
   - Each widget hidden when empty.

2. Guest detail panel:
   - "Meal selection" line if Guest.mealChoice is set, deep-linked
     to the relevant BookMenuOption.
   - "Accommodation" line: query BookStayCard.guestIds — if any STAY
     card lists this guest's id, surface the property name and
     check-in date.

3. Budget page:
   - "Linked from Build cards" mini-section: BudgetLine rows
     created via P1's "Copy materials total to Budget". Group by
     source card with a back-link.

4. Supplier detail page:
   - "Used in setup" mini-section: BookSetupItem rows where
     `source` matches this Supplier.name (string match — no FK).

Helpers: pure decision modules in src/lib/today-widgets.ts and
src/lib/guest-cross-refs.ts. Unit-test both.

Tests:
- tests/unit/today-widgets.test.ts: filter logic for each widget.
- tests/unit/guest-cross-refs.test.ts: STAY → Guest reverse query.
- tests/integration/cross-module.test.ts: end-to-end against seeded DB.

Migration: confirm existing FIELD values still validate; existing
RECIPE steps round-trip through the data migration; existing TEXT
bodies render correctly via the new bodyHtml path AND the legacy
body fallback.

Ship: ROADMAP entry "v1.37.0 — TEXT WYSIWYG editor + existing card upgrades + cross-module wiring".
```

### P8 — Seed refresh + Post-wedding section

```
[paste shared header above this line]

P8: refresh seed data and add the Post-wedding section. Target
version: v1.38.0.

Goal: anyone running `npm run db:seed` on a fresh DB gets the full
expanded structure described in §8, with realistic placeholder
content from the actual suppliers. Add the Post-wedding section
so it's ready to fill out from late September.

Changes:

1. Extend prisma/seed.ts with one section seeder per Wedding Book
   section, each idempotent (skip if subsections > 0). Use the
   layouts in §8.1–§8.12.

2. Use real supplier names (CG Media — Louis Brough, Paintbox Blooms,
   Slaters, Dream Wedding & Events, VistaPrint, Stratford School of
   Jewellery, Warwickshire Registrar) so cross-module wiring lights
   up immediately.

3. Add the Post-wedding section:
   - BookSection slug `post-wedding`, order 12.
   - Subsections per §8.12.

4. Add a one-time backfill script in scripts/backfill-v1.38.ts that
   the couple runs once on the production DB to add new card-kind
   subsections to existing sections without overwriting any of their
   own content. Document it in README.md.

5. Update CLAUDE.md "What this app is" section to describe the
   final expanded card-kind palette (12 kinds, 12 sections).

Tests:
- tests/integration/seed.test.ts: seed runs cleanly twice; second
  run is a no-op.
- tests/integration/seed-shape.test.ts: after seed, every active
  section has at least one card and every card kind appears at least
  once across the full DB.
- tests/integration/backfill-v1.38.test.ts: backfill is idempotent
  and never overwrites user content.

Ship: ROADMAP entry "v1.38.0 — seed refresh + Post-wedding section".
```

---

## 12. Open questions to resolve before P1

- **DIY confirmation list.** The seed assumes:
  - Centerpieces — DIY (BUILD card)
  - Handmade signage — DIY (BUILD card; welcome sign, directional)
  - Printed signage — VistaPrint (FIELD card; table numbers, menus)
  - Place cards / name places — DIY (BUILD card)
  - Welcome bags — open
  - Favours — open
  - Programs / order of service — open

  Confirm the open ones (welcome bags, favours, programs) are DIY
  or vendor-fulfilled, and update §8 before seeding.
- **Cake.** RECIPE if DIY, FIELD if from a baker. Decide before P2.
- **Final wedding-party headcount.** P5 seed needs the names. Couple
  finalises bridesmaids and groomsmen before then.
- **File-attachment volume.** Existing 25 MB-per-file cap is fine;
  confirm disk headroom for ~10 LEGAL scans + ~10 OUTFIT photos.

End of document.
