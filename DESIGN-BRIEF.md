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

A persistent left sidebar mirroring the couple's existing Notion tree, so
muscle memory transfers. Group with subtle dividers, not heavy headers.

Top-level sidebar entries (in order):

1. **Today** — home dashboard
2. **At a Glance** — rolled-up views (my tasks, upcoming events, recent payments)
3. **Tasks** — structured list/board
4. **Suppliers & Contracts** — structured directory
5. **Schedule & Timelines** — structured single events DB with filtered views
6. **Wedding Party** — folder of rich-text pages (Bride, Groom, Bridesmaids,
   Groomsmen, Flower Girl & Page Boy, Stag, Hen)
7. **Venue, Décor & Setup** — folder of rich-text pages
8. **Food & Drink** — folder of rich-text pages
9. **Photography & Videography** — folder of rich-text pages
10. **Guest Experience** — folder of rich-text pages
11. **Legal & Admin** — folder of rich-text pages
12. **Accommodation** — folder of rich-text pages
13. **Files, Uploads & Inspiration** — uploads grid
14. **Tools & Resources** — structured table
15. **Wedding Budget** — structured table with category roll-ups
16. **Payments** — structured table sorted by due date
17. **Guests** — structured list with RSVP status
18. **Seating** — drag-drop chart
19. **Settings → Members** — permissions matrix (owner-only)

On mobile the sidebar collapses to a bottom tab bar with 4 fixed tabs
(**Today / Tasks / Guests / More**) and a centred floating "+" capture
button. Everything else lives behind **More**.

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
Used for: every entry under Wedding Party, Venue, Food, Photography,
Guest Experience, Legal, Accommodation.

Anatomy:
- Page header: title (editable inline) + last-edited byline.
- Body: Notion-style block editor — headings, paragraphs, checklists,
  bullet lists, callouts, tables, images, file attachments. **No** toggles,
  no databases-in-pages, no synced blocks. Slash menu only.
- No sidebar widgets, no comment threads in v1.

## 6. Today dashboard (priority screen — design first)

Single column on mobile, 2–3 columns on desktop. In order top to bottom on
mobile:

1. **Countdown card** — large "X days until <couple names>'s wedding"
   with the date underneath. The one place the design can lean warm.
2. **My open tasks** — today + this week. Checkbox + title + due chip.
   Tap to open detail; long-press / swipe to reassign.
3. **Upcoming events** — next 5 from the schedule, filtered to "my
   persona" by default with a quick toggle to "everyone."
4. **RSVPs** — donut or stacked bar of yes / no / maybe / pending +
   "3 changes this week" mini-feed.
5. **Budget snapshot** — single horizontal bar (paid / committed / remaining)
   + total figure in GBP.
6. **Payments due** — next 30 days, grouped by week.
7. **Recent activity** — last 10 audit-log entries, scoped to sections the
   user can see.

A floating "+" capture button on mobile and `c` keyboard shortcut on
desktop opens a single capture bar that asks: "what is this?" → Task /
Payment / Event / Guest, then a 2-field quick form.

## 7. Per-section visual specifics

- **Tasks** — list and kanban (TODO / DOING / DONE). Priority shown as a
  small coloured dot, not a coloured row. Due-soon chips: "Today",
  "Tomorrow", "Fri 12 Sep", overdue in red.
- **Suppliers** — directory cards with logo placeholder, name, category,
  status pill (LEAD / BOOKED / PAID / DECLINED). Board view groups by
  status. Card click → detail sheet with contract download, contacts,
  payment links to Payments section.
- **Schedule** — list grouped by day-tag headers ("Day Before", "Wedding
  Day"). Each event row shows time, title, persona chips, location.
  Calendar view is timeline-style (08:00–24:00 grid) for the wedding day
  itself.
- **Seating** — desktop-first canvas with draggable round/rectangle
  tables, snap-to-grid, capacity badge that turns red when over. A guest
  drawer on the right with unseated guests listed. Mobile = read-only
  view with table-by-table list.
- **Budget** — two-tier table: categories (collapsible) → line items.
  Right column shows planned vs. actual with a tiny inline bar. One total
  row at the bottom.
- **Payments** — flat table sorted by due date; status pill on the right
  (Scheduled / Paid / Overdue).
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
- Kanban column + draggable card
- Inline-edit cell
- Quick-capture bar (the "+" overlay)
- Sidebar item (icon + label + count badge + active state)
- Bottom tab bar (mobile) with centre FAB
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

1. **Foundation:** colour palette (1 accent + neutrals), type pairing,
   spacing scale, radius/elevation tokens. One artefact, one screen.
2. **Today dashboard** — mobile and desktop side by side.
3. **Sidebar + empty app shell** — desktop with the full tree from §4;
   mobile bottom-tab variant.
4. **Tasks** — list + kanban, both breakpoints, including detail sheet.
5. **Guests** — list + import wizard (3 steps), both breakpoints.
6. **Suppliers** — directory + board + detail sheet.
7. **Budget + Payments** — table layouts at both breakpoints.
8. **Schedule** — list + day-of timeline view.
9. **Seating** — desktop canvas; mobile read-only.
10. **Document page** — rich-text editor with slash menu open.
11. **Settings → Members** — permission matrix.
12. **Component sheet** — every primitive and compound from §8 in a
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
