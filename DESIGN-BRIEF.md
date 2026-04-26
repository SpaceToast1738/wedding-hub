# Wedding Hub — Design Brief

> Hand this to a fresh Claude session set up for design work (Artifacts / UI
> generation). It is intentionally self-contained — the designer does not
> need to read `PLAN.md`. When mockups come back, paste them into the
> engineering session and we'll wire them up.

---

## 1. What you're designing

An **internal planning hub** for the 4–6 people running a wedding (the
couple, best man, a bridesmaid, optionally the planner). It is **not** a
guest-facing site. It replaces a Notion workspace + a paid RSVP tool
(Say I Do) the couple finds overwhelming.

**One sentence:** the calm, opinionated dashboard a small wedding party
opens every day to see what's due, who's RSVP'd, and what's left to spend.

## 2. The hard rule

> **Simplicity beats flexibility.** The couple's exact words:
> *"don't be overwhelming, intuitive, capture key info without burden."*

If a screen could be Notion-shaped (panels, configurable columns, nested
toggles) or could be one fixed, opinionated layout — pick the fixed
layout. We are escaping Notion's surface area, not recreating it.

## 3. Audience, devices, tone

- **Users:** 4–6 non-technical adults, ages roughly 25–55. Couple owns it;
  best man + bridesmaid are casual users who log in a few times a week.
- **Devices:** mobile and desktop are **equal priority**. People will
  update tasks from their phones at the venue and review budget on a laptop
  at home. Design mobile and desktop side by side; do not treat mobile as
  a fallback.
- **Tone:** warm but practical. Wedding-flavoured, not wedding-saturated.
  Think "Linear if it ran a wedding," not "Pinterest board." No script
  fonts in UI chrome, no rose-gold gradients, no confetti. Save any
  flourish for the Today dashboard countdown and an empty-state illustration
  or two.
- **Brand inputs we don't have yet:** no logo, no colour palette, no
  typography lock. Propose a palette and type pairing as part of the
  deliverable. Constraints: WCAG AA contrast, one accent colour, neutral
  greyscale otherwise. Avoid pure black on white — soften it.

## 4. Information architecture

A persistent left sidebar grouped into three subtle bands. The Notion source
had ~70 pages across 12 top-level sections with heavy duplication; this is
the deliberately-flatter replacement. Nothing is lost — see §14 for the
audit of where each Notion page now lives.

12 sidebar entries plus Settings:

**Group 1 — daily use**
1. **Today** — merged home dashboard (replaces Notion's Today + At a Glance)
2. **Tasks** — structured DB; list + board; includes "questions" via tag
3. **Schedule** — structured single events DB. Hovering it reveals a
   fly-out submenu of saved persona/day views (Day Before, Wedding Day,
   Bride, Groom, Bridesmaids, Groomsmen, Flower Girl & Boy, Supplier).
   Clicking a fly-out item applies the saved filter on the same page —
   no separate routes per persona.

**Group 2 — people & money**
4. **Wedding Party** — folder of 7 hubs: Bride, Groom, Bridesmaids,
   Groomsmen, Flower Girl & Boy, Stag Do, Hen Do. Each hub is a hybrid
   page that auto-pulls that person/group's tasks + their filtered
   timeline + their notes. There is no separate "Bride Tasks" page or
   "Bride Timeline" page — those become strips inside the Bride hub.
5. **Suppliers** — structured directory. Vendor detail sheet has tabs:
   Overview / Notes / Contracts / Payments. The Notes tab absorbs what
   used to be standalone vendor pages (Florist, Photo Booth, Venue).
6. **Budget** — structured DB, two-tier (categories → line items)
7. **Payments** — structured DB sorted by due date; line items ↔
   payments are cross-linked
8. **Guests** — structured list with RSVP status

**Group 3 — reference**
9. **Notes** — folder of 6 rich-text doc pages, each one collapsing what
   used to be a Notion sub-tree:
   - **Venue & Setup** (Ceremony · Reception · Evening · Setup &
     Pack-Down · Signage Inventory)
   - **Food & Drink** (Meals incl. kids · Evening Food · Drinks & Bar ·
     Cake)
   - **Photography** (Must-Have Shots checklist · Locations list — vendor
     details live on the Suppliers row, not here)
   - **Guest Experience** (Pixel Party · Table Games · Favours · Guest Book)
   - **Legal & Admin** (Notice of Marriage · Required Docs · Witnesses ·
     Pre-Ceremony · Post-Ceremony — recurring admin chores live in Tasks)
   - **Accommodation** (Bridal Suite · Bridesmaids/Groomsmen Night-Before ·
     Check-in Q&A)
10. **Seating** — drag-drop chart
11. **Files** — uploads grid with 5 fixed sub-folders (Contracts · Menus ·
    Backdrops · Inspiration Images · Seating Drafts)
12. **Tools & Resources** — structured table

**Footer**
- **Settings → Members** — permissions matrix (owner-only)

On mobile the sidebar collapses to a bottom tab bar with 4 fixed tabs
(**Today / Tasks / Schedule / More**) and a centred floating "+" capture
button. Everything else (Wedding Party hubs, Suppliers, Budget, Payments,
Guests, Notes, Seating, Files, Tools, Settings) lives behind **More** as
a grouped list.

## 5. Two page archetypes

The whole app is built from two repeating page shapes. Design each
archetype once and the rest is variation.

### A. Structured page (fixed schema)
Used for: Tasks, Suppliers, Schedule, Seating, Tools, Budget, Payments,
Guests.

Anatomy:
- Page header: title + one primary action button (e.g. "Add task") +
  optional secondary (Import CSV, Export, Print).
- View switcher: List / Board / Calendar where it applies (Tasks =
  List+Board, Schedule = List+Calendar, Suppliers = Directory+Board).
- Filter bar: saved filtered views as pills (e.g. "Wedding Day · Bride"),
  plus a small "+ View" affordance. Active view is bolded, not boxed.
- Body: dense table on desktop, card list on mobile. Inline edit on click.
- Detail panel: opens as a right-hand sheet on desktop, full-screen on
  mobile. Closes on Esc / swipe down.

### B. Document page (rich-text)
Used for: the 6 Notes pages (Venue & Setup, Food & Drink, Photography,
Guest Experience, Legal & Admin, Accommodation).

Anatomy:
- Page header: title (editable inline) + last-edited byline.
- Body: Notion-style block editor — headings, paragraphs, checklists,
  bullet lists, callouts, tables, images, file attachments. **No** toggles,
  no databases-in-pages, no synced blocks. Slash menu only.
- Right rail (desktop only): auto-generated table of contents from H2s,
  sticky on scroll. Hidden on mobile.
- No comment threads in v1.

### C. Hub page (hybrid — Wedding Party only)
Used for: each of the 7 Wedding Party hubs.

Anatomy:
- Header: name, role label, photo placeholder, primary contact (email/phone).
- **Tasks strip** — Tasks DB rows where `assignee = this person` or
  `audience tag = this group`. Inline checkbox to complete; "+ task" inline.
- **Timeline strip** — Schedule DB rows where `persona = this person/group`.
  Time + title + location, grouped by day-tag.
- **Notes body** — rich-text section for outfits, responsibilities, free
  notes. For the Stag/Hen hubs this section also holds the dates,
  organiser, location and attendee list.
- One screen, three live data strips + one document body. The strips read
  from the same Tasks and Schedule databases as the main pages — no
  duplicated state.

## 6. Today dashboard (priority screen — design first)

Today is the merged home page — it absorbs what was a separate "At a
Glance" page in Notion. Single column on mobile, 2–3 columns on desktop.
Cards in this order from top:

1. **Countdown** — large "X days until <couple names>'s wedding" with
   the date underneath. The one place the design can lean warm.
2. **Key facts** — quiet, compact card: venue name + address, ceremony
   time (when set), coordinator name + phone, planner name + email. This
   is the always-on reference that used to live on Notion's At a Glance.
3. **Quick links** — 4 chips, mobile-friendly tap targets: Venue Q&A
   (jumps to Notes → Venue & Setup), Day-Of Contact (jumps to Suppliers
   filtered to wedding-day vendors), Seating chart, RSVP import.
4. **My open tasks** — today + this week. Checkbox + title + due chip.
   Tap to open detail; long-press / swipe to reassign.
5. **Upcoming events** — next 5 from the schedule, filtered to "my
   persona" by default with a quick toggle to "everyone."
6. **RSVPs** — donut or stacked bar of yes / no / maybe / pending +
   "3 changes this week" mini-feed.
7. **Budget snapshot** — single horizontal bar (paid / committed /
   remaining) + total figure in GBP.
8. **Payments due** — next 30 days, grouped by week.
9. **Recent activity** — last 10 audit-log entries, scoped to sections
   the user can see.

A floating "+" capture button on mobile and `c` keyboard shortcut on
desktop opens a single capture bar that asks: "what is this?" → Task /
Question / Payment / Event / Guest, then a 2-field quick form.

## 7. Per-section visual specifics

- **Tasks** — list and kanban (TODO / DOING / DONE). Priority shown as a
  small coloured dot, not a coloured row. Due-soon chips: "Today",
  "Tomorrow", "Fri 12 Sep", overdue in red. Each row has a `kind` field:
  *Task* (default) or *Question*. Question rows render with a leading
  "?" glyph instead of a checkbox, and the row action is "Answer"
  (opens an answer textarea; saving the answer flips the row to Done).
  This is the bin where Notion's "tracked question" pages now live —
  same DB, two semantic uses, no separate Questions section.
- **Schedule** — list grouped by day-tag headers ("Day Before", "Wedding
  Day"). Each event row shows time, title, persona chips, location.
  Calendar view is timeline-style (08:00–24:00 grid) for the wedding day
  itself. Saved persona views (Bride, Groom, Bridesmaids, Groomsmen,
  Flower Girl & Boy, Supplier) appear as bookmark pills above the list
  and as the sidebar fly-out from §4 — clicking either applies the
  filter on the same page rather than navigating elsewhere.
- **Wedding Party hubs** — see §5.C for the page archetype. Visually:
  two-thirds-width column on desktop with the Tasks and Timeline strips
  stacked above the Notes body; mobile stacks them top-to-bottom. The
  strips share their visual style with the parent Tasks and Schedule
  pages so the user immediately recognises them as live data.
- **Suppliers** — directory cards with logo placeholder, name, category,
  status pill (LEAD / BOOKED / PAID / DECLINED). Board view groups by
  status. Card click → detail sheet with **four tabs**: Overview
  (contact, status, addresses), Notes (rich-text — this is where
  Notion's per-vendor pages were absorbed), Contracts (linked Files
  rows), Payments (linked Payments rows; sum + outstanding balance at
  the top).
- **Budget** — two-tier table: categories (collapsible) → line items.
  Right column shows planned vs. actual with a tiny inline bar. Each
  line item exposes a "+ link payment" affordance that opens a Payments
  picker; linked payments roll up into the line item's Actual figure.
  Vendor column links to the Suppliers row.
- **Payments** — flat table sorted by due date; status pill on the right
  (Scheduled / Paid / Overdue). Each row optionally shows the linked
  Budget line item and Vendor as small chips on the left.
- **Notes pages** — see §5.B. The 6 pages each open with a default H2
  outline matching the sections listed in §4 (e.g. Venue & Setup opens
  with H2s "Ceremony", "Reception", "Evening", "Setup & Pack-Down",
  "Signage Inventory"). Users can rename, reorder, or delete these H2s
  freely — they are seeded structure, not enforced. The right-rail TOC
  reflects whatever H2s exist.
- **Files** — single uploads grid; the left rail shows the 5 fixed
  sub-folders (Contracts, Menus, Backdrops, Inspiration Images, Seating
  Drafts). Drag a file onto a folder name to move it. No nested folders.
- **Seating** — desktop-first canvas with draggable round/rectangle
  tables, snap-to-grid, capacity badge that turns red when over. A guest
  drawer on the right with unseated guests listed. Mobile = read-only
  view with table-by-table list.
- **Guests** — list with household grouping (subtle indent, not nested
  rows). RSVP status pill. Bulk-action bar appears on selection. Import
  button opens a 3-step modal (upload → map columns → preview → apply).

## 8. Component inventory (please design these)

Primitives:
- Button (primary / secondary / ghost / destructive; sm / md)
- Input, textarea, select, date picker, checkbox, radio, switch
- Status pill (used for RSVP, supplier status, task status, payment status)
- Avatar + avatar group
- Tag / persona chip
- Tooltip
- Toast
- Modal, right sheet, bottom sheet (mobile)
- Empty state (illustration + one-line copy + primary CTA)
- Skeleton loader

Compound:
- Page header (title, breadcrumb, primary action, overflow menu)
- Filter bar with saved-view pills
- Data table row (desktop) + matching card row (mobile) — same data, two layouts
- Question row (Tasks variant: "?" glyph + Answer action)
- Kanban column + draggable card
- Inline-edit cell
- Quick-capture bar (the "+" overlay)
- Sidebar item (icon + label + count badge + active state) + sidebar
  fly-out submenu (used by Schedule for saved persona views)
- Bottom tab bar (mobile) with centre FAB
- Wedding Party hub strip (compact tasks-or-timeline list with header,
  inline checkbox / time, and "view all" link to the parent DB)
- Tabs (used in Suppliers detail sheet: Overview / Notes / Contracts /
  Payments)
- Right-rail table of contents (Notes pages, desktop only)
- Files folder rail (5 fixed entries with drag-target affordance)
- Permission matrix row (member name + 7 section dropdowns)

## 9. States to cover

For every screen and every component, design these explicitly — engineering
will use whatever you provide; if a state isn't designed it'll get a
default that won't match.

- **Empty** — no data yet, with a clear next action.
- **Loading** — skeleton, never a spinner over content.
- **Error** — inline message + retry, not a toast for page-level failures.
- **Permissioned-out** — the user can see the section name in the sidebar
  but lacks VIEW; show a friendly "ask <owner> for access" page, not a 403.
- **Read-only** — VIEW-level access; same layout, controls hidden, edit
  affordances replaced with copy-to-clipboard where useful.

## 10. Out of scope for the design pass

- Marketing site / landing page (there isn't one — magic-link sign-in is
  the front door).
- Guest-facing RSVP form (guests RSVP via the existing Say I Do tool;
  this app only consumes the CSV).
- Internationalisation (English-only, GBP-only).
- Dark mode (light mode only for v1; design tokens should make a future
  dark mode possible, but don't deliver it).
- Notifications email templates (separate brief later).
- Logo / brand mark.

## 11. Deliverables we want back

Please return, in this order:

1. **Foundation** — colour palette (1 accent + neutrals), type pairing,
   spacing scale, radius/elevation tokens. One artefact, one screen.
2. **Today** — mobile and desktop side by side. All 9 cards from §6.
3. **Sidebar + empty app shell** — desktop with the full tree from §4
   (including the Schedule fly-out and the Wedding Party folder
   expanded); mobile bottom-tab variant with the More sheet open.
4. **Tasks** — list + kanban, both breakpoints, including detail sheet
   and the Question-row variant.
5. **Schedule** — list with day-tag headers; day-of timeline view; the
   sidebar fly-out for saved persona views in its open state.
6. **Wedding Party hub template** — Bride hub as the worked example
   (Tasks strip + Timeline strip + Notes body), both breakpoints. The
   other 6 hubs reuse the same template.
7. **Suppliers** — directory + board + detail sheet with all 4 tabs
   (Overview / Notes / Contracts / Payments).
8. **Budget + Payments** — two-tier Budget table + flat Payments table
   at both breakpoints, plus the "+ link payment" picker UI.
9. **Guests** — list + 3-step import wizard, both breakpoints.
10. **Seating** — desktop canvas; mobile read-only.
11. **Notes page template** — Tiptap editor with seeded H2 outline, slash
    menu open, right-rail TOC visible. Use Venue & Setup as the worked
    example.
12. **Files** — uploads grid with the 5 sub-folders rail.
13. **Settings → Members** — permission matrix.
14. **Component sheet** — every primitive and compound from §8 in a
    single reference page, with all states from §9.

Format preference: React + Tailwind in Artifacts so engineering can lift
the JSX and tokens directly. If that's too heavy, static
HTML+Tailwind is fine.

## 12. Real data to use in mocks (not lorem ipsum)

Use these names so screens feel like the actual product. They're already
in the engineering plan and will appear once seeding runs.

- Couple: **Jamie Spencer** & **Bryony Olwyn-Davis**
- Wedding date: **late September 2026** (use 26 Sep 2026 as a placeholder)
- Venue: **Alveston Manor**, Stratford-upon-Avon
- Planner: **Aimee-Louise Summer**, Bespoke Weddings
- Photographer: **Louis Brough, CG Media**
- Florist: **Naomi Weetman, Paintbox Blooms**
- Photo Booth: **Dream Wedding & Events**
- Sample tasks: "Collect flowers — 23 Sep", "Confirm final guest count —
  19 Sep", "Pay venue balance — 26 Aug"
- Sample line items: Venue £6,500, Photography £1,800, Florist £950,
  Photo Booth £450, Suits £600, Stationery £180

Numbers should ladder up to **~£14,000 planned, ~£3,961 paid**.

## 13. When you're done

Bundle everything into a single message back to the engineering session
("here are the screens and tokens"). The engineering session will turn it
into Tailwind components and start wiring them to the data layer in
`PLAN.md`.

## 14. Appendix — what was simplified from Notion

Reference table for engineering and for the couple's sanity-check. Every
page in the source Notion workspace maps to a destination in this brief.
Total: ~70 Notion pages → 12 sidebar entries + 7 Wedding Party hubs + 6
Notes pages.

| Source Notion page | Where it lives in this brief |
|---|---|
| Table of Contents | The sidebar itself (§4) |
| At a Glance | Today, as Key facts + Quick links cards (§6) |
| Finance Dashboard | Today's Budget snapshot + Payments due cards; deeper view on Budget page |
| Tasks Tracker | Tasks DB (§7) |
| Schedule & Timelines (top-level) | Schedule DB (§7) |
| Day Before Timeline / Wedding Day Timeline | Schedule DB, day-tag header grouping |
| Groom Timeline / Bride Timeline / Bridesmaid Timeline / Groomsmen Timeline / Flower Girl-Boy Timeline / Supplier Timeline | Schedule DB, saved filtered views in sidebar fly-out |
| Wedding Party (top-level) | Sidebar group of 7 hubs |
| Groom (Tasks) / Bride (Tasks) | Wedding Party hubs — Tasks strip |
| Groom outfit notes / Bride outfit notes / Groomsmen / Bridesmaids / Flower Girl & Boy | Wedding Party hubs — Notes body |
| Stag Do / Hen Do | Wedding Party hubs (Stag Do hub, Hen Do hub) — Notes body holds dates / location / organiser / attendees |
| Venue, Décor & Setup (top-level) | Notes → Venue & Setup |
| Ceremony / Reception / Evening Reception / Setup Logistics / Pack-Down Plan / Table Layout & Centrepieces / Signage & Extras | Notes → Venue & Setup, as H2 sections |
| Florist / Photo Booth (vendor pages under Venue/Décor) / Venue (Q&A page) | Suppliers row → Notes tab (per-vendor pages absorbed into the vendor's detail sheet) |
| Food & Drink (top-level) | Notes → Food & Drink |
| Wedding Breakfast / Kids Meals / Evening Food / Drinks & Bar / Cake Project | Notes → Food & Drink, as H2 sections (Cake gets the largest section) |
| Photography & Videography (top-level) | Notes → Photography (shot list + locations only); vendor details on the Suppliers row |
| Package Details / Day Of Contact | Suppliers row (Photography vendor) — Overview + Notes tabs |
| Must Have Shots | Notes → Photography (checklist) |
| Locations | Notes → Photography (list) |
| Guest Experience (top-level) | Notes → Guest Experience |
| Pixel Party / Table Games / Wedding Favours / Photo Booth (guest-facing) / Guest Book | Notes → Guest Experience, as H2 sections |
| Legal & Admin (top-level) | Notes → Legal & Admin |
| Notice of Marriage / Required Documents / Witnesses / Pre-Ceremony Interview / Post-Ceremony Registration | Notes → Legal & Admin, as H2 sections |
| Admin Tasks | Tasks DB with `category = Admin` (recurring chores belong with other tasks, not in a doc page) |
| Accommodation (top-level) | Notes → Accommodation |
| Bridal Suite / Bridesmaids Night-Before / Groomsmen Night-Before | Notes → Accommodation, as H2 sections |
| "What time is check in on the day of the wedding?" (tracked-question page) | Tasks DB row with `kind = Question` — this is the model for every Notion question-page going forward |
| Files, Uploads & Inspiration (top-level) | Files (§4 entry 11) |
| Contracts / Menus / Photobooth Backdrops / Inspiration Images / Seating Plan Drafts | Files → 5 fixed sub-folders (same names) |
| Tools & Resources | Tools & Resources DB |
| Suppliers & Contracts | Suppliers DB |
| Wedding Budget | Budget DB |
| Payments | Payments DB |

Two recurring overlaps worth calling out, because a designer reading the
brief cold should not waste time drawing them twice:

1. **Per-persona content lives in one place.** A Bride task does not
   exist on a Bride Tasks page *and* in the Tasks DB *and* in the Bride
   hub — it exists once in the Tasks DB and is surfaced in the Bride hub
   and in any "Bride" filter of Tasks. Same for Schedule events.
2. **Vendor information lives on the Suppliers row.** There is no
   standalone Florist page, no standalone Photo Booth page, no standalone
   Venue page. Their notes, contracts, and payments are tabs on the
   vendor's detail sheet.
