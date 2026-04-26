# Wedding Hub — Plan

Self-hosted, internal wedding-planning hub for the wedding party (4–6 people).
Replaces Notion (too complex to manage) + the couple's current Say I Do
(sayido.com) RSVP tool. The Say I Do data is migrated in via CSV.

> **Critical UX principle: simplicity > flexibility.** The couple's words:
> *"don't be overwhelming, intuitive, capture key info without burden."*
> Notion's complexity is the problem we're escaping. Every design decision
> defaults to opinionated simplicity over Notion-style flexibility.

---

## 1. The wedding (real data, from Notion CSV export)

- **Couple**: Jamie Spencer (groom · jspencer1706@outlook.com) and
  Bryony Olwyn-Davis (bride · bryonyolwyn_davis@hotmail.com).
- **Venue**: Alveston Manor (Macdonald Hotels), Stratford-upon-Avon, Warwickshire.
  - Coordinator: Kate French · 01789 205478 ·
    SpecialEvents.Alveston@macdonald-hotels.co.uk
- **Ceremony**: Civil, Warwickshire Registrar · warwickro@warwickshire.gov.uk · 0300 555 0255.
- **Date**: TBC — likely late September 2026 (a "Collect Flowers" task on
  23 Sep is assigned to Jamie; payment timeline runs through Mar 2026).
- **Scale**: ~50 adults + 3 children.
- **Currency**: GBP (£).
- **Budget**: ~£14,000 actual, ~£3,961 already paid in deposits.

## 2. Wedding party

| Role | Name | Notes |
|---|---|---|
| Bride | Bryony | |
| Groom | Jamie | Project owner |
| Wedding Planner | Aimee-Louise Summer | Bespoke Weddings · admin@bespoke-weddings.com |
| Best Man | TBC | Manages Stag A + Stag B groups |
| Bridesmaids | TBC | |
| Groomsmen | TBC | |
| Flower Girl | Clara | |
| Page Boy | Torin | |
| Ring keepers | Josh (Bryony's), Aimee (Jamie's) | |

The **planning team** (app users) is the couple + best man + bridesmaid
+ optionally the planner = 4–6 magic-link accounts.

## 3. Real suppliers (from Notion export)

| Category | Supplier | Contact |
|---|---|---|
| Venue | Alveston Manor | Kate French · 01789 205478 |
| Registrar | Warwickshire Registrar | 0300 555 0255 |
| Planner | Bespoke Weddings | Aimee-Louise Summer |
| Photography | CG Media | Louis Brough · 07896 632655 · cg_media@outlook.com |
| Florist | Paintbox Blooms | Naomi Weetman · 07557 145216 · contact@paintboxblooms.com |
| Photo Booth | Dream Wedding & Events | Jak & Laura · 01159 986289 |
| Rings | Stratford School of Jewellery | — |
| Suits | Slaters | — |
| Shoes | Converse (matching: bride, groom, flower girl) | — |
| Stationery | VistaPrint | — |
| Insurance | WeddingPlan Insurance | — |
| Current guest mgmt | Say I Do (sayido.com) | £97 — being replaced |
| Other tools used | PixelParty, Prezzo, Hitched | — |

## 4. Locked technical decisions

- **Stack**: Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL.
- **Auth**: magic-link email via Auth.js (Email provider).
- **Permissions**: granular per-section per-user (NONE / VIEW / EDIT / ADMIN).
  Sections: GUESTS, BUDGET, VENDORS, TASKS, SCHEDULE, SEATING, MEMBERS.
- **Hosting**: self-hosted Docker Compose on a VPS, Caddy reverse proxy
  (auto-HTTPS via Let's Encrypt).
- **Files**: local disk volume mounted into the web container.
- **Mobile + desktop**: equal priority, fully responsive.
- **Home screen**: Today / this-week dashboard.
- **Notifications**: daily email digest + per-item email alerts + in-app.
- **Editor model**: hybrid.
  - **Structured pages** (fixed schema, opinionated UI): Tasks, Suppliers,
    Budget, Payments, Guests, Timeline, Seating.
  - **Document pages** (rich-text / Notion-style block editor): Inspiration,
    Décor notes, Legal docs, Accommodation notes, etc.
- **Timeline**: single events DB with multi-tag (Day = *Day Before* /
  *Wedding Day*; Persona = *Bride / Groom / Bridesmaid / Groomsmen /
  Flower Girl / Supplier*) + saved filtered views — replaces the 7 separate
  Notion timelines.
- **Sidebar**: mirrors their current Notion tree as a starter template
  (see §6).
- **Say I Do migration**: CSV import (no public API). Built so a future
  API/webhook adapter can drop in without changing call sites.

## 5. Architecture

Single Next.js app, server actions + route handlers for mutations, Prisma
for data.

```
wedding-hub/
├── app/
│   ├── (auth)/sign-in/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx               # auth guard + nav shell
│   │   ├── page.tsx                 # Today dashboard
│   │   ├── guests/                  # list, detail, CSV import
│   │   ├── budget/                  # categories + line items
│   │   ├── payments/                # scheduled outgoing payments
│   │   ├── vendors/                 # supplier directory
│   │   ├── tasks/                   # task board + list
│   │   ├── schedule/                # timeline with filtered views
│   │   ├── seating/                 # drag/drop chart
│   │   ├── tools/                   # tools & resources
│   │   ├── notes/[slug]/            # rich-text document pages
│   │   └── settings/members/        # invite + permissions matrix
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── guests/import/route.ts
│       └── csv/seed/route.ts        # one-off Notion CSV import
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── permissions.ts               # Section + Level helpers
│   ├── csv/say-i-do.ts
│   ├── csv/notion-export.ts         # 5 Notion DB seed importers
│   └── csv/import.ts                # generic CSV ingest with mapping
├── prisma/schema.prisma
├── components/                      # ui primitives + section blocks
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml           # web + postgres + caddy
│   └── Caddyfile
├── scripts/seed.ts
├── .env.example
└── README.md
```

## 6. Sidebar / navigation (mirrors Notion)

Top-level entries in the app sidebar:

- **Today** (dashboard)
- **At a Glance** (rolled-up views: my tasks, upcoming events, recent payments)
- **Tasks** (DB)
- **Suppliers & Contracts** (DB)
- **Schedule & Timelines** (single DB, filtered views per day/persona)
- **Wedding Party** (rich-text pages: Groom, Bride, Bridesmaids, Groomsmen,
  Flower Girl & Boy, Stag, Hen)
- **Venue, Décor & Setup** (notes: Ceremony, Reception, Evening, Signage,
  Setup Logistics, Pack-Down, Tables & Centrepieces, Florist, Photo Booth)
- **Food & Drink** (notes: Wedding Breakfast, Kids Meals, Evening Food,
  Drinks & Bar, Cake)
- **Photography & Videography** (notes: Package Details, Must-Have Shots,
  Locations, Day-Of Contact)
- **Guest Experience** (notes: Pixel Party, Table Games, Favours, Photo Booth,
  Guest Book)
- **Legal & Admin** (notes: Notice of Marriage, Required Docs, Witnesses,
  Pre-Ceremony Interview, Post-Ceremony Registration)
- **Accommodation** (notes: Bridal Suite, Bridesmaids Night-Before, Groomsmen
  Night-Before)
- **Files, Uploads & Inspiration** (uploads section)
- **Tools & Resources** (DB)
- **Wedding Budget** (DB)
- **Payments** (DB)
- **Settings → Members** (permissions matrix, owner-only)

## 7. Data model (Prisma)

```prisma
model User       { id, email @unique, name, image, createdAt, memberships[] }
model Wedding    { id, name, weddingDate, venueName, venueAddress, currency,
                   coupleNames String, plannerId?, createdAt,
                   memberships[], guests[], vendors[], tasks[], events[] }
model Membership {
  id, userId, weddingId,
  role             Role   // OWNER | MEMBER
  permissions      Json   // { guests:"EDIT", budget:"VIEW", vendors:"NONE", ... }
  invitedAt, acceptedAt
  @@unique([userId, weddingId])
}

model Guest      { id, weddingId, firstName, lastName, email?, phone?,
                   householdId?, plusOneAllowed Bool, dietary?, notes?,
                   externalId?,                     // Say I Do id
                   source GuestSource,              // MANUAL | CSV_SAY_I_DO | CSV_GENERIC
                   role GuestRole?,                 // BRIDE/GROOM/BEST_MAN/BRIDESMAID/...
                   rsvp Rsvp? }
model Household  { id, weddingId, label, address?, guests[] }
model Rsvp       { id, guestId @unique, status (YES|NO|MAYBE|PENDING),
                   attendingCount, mealChoice?, plusOneName?, songRequest?,
                   highchair Bool, childMealChoice?, respondedAt, lastSyncedAt }
model ImportRun  { id, weddingId, source, fileName, mapping Json, rowCount,
                   createdById, createdAt }

// Budget vs. Payments split (CSVs treat them as distinct DBs)
model BudgetCategory { id, weddingId, name, plannedCents Int, sortOrder Int }
model BudgetLineItem { id, weddingId, categoryId, label, plannedCents,
                       actualCents, vendorId?, notes? }
model Payment        { id, weddingId, vendorId?, lineItemId?, label,
                       amountCents, dueDate?, paidDate?, status,
                       method?, reference?, notes? }

model Vendor    { id, weddingId, name, category, contactName?, email?, phone?,
                  websiteUrl?, contractUrl?, address?,
                  status (LEAD|BOOKED|PAID|DECLINED|DECLINED_BY_US),
                  depositCents?, balanceCents?, notes? }

model Task      { id, weddingId, title, description?, assigneeId?, vendorId?,
                  dueDate?, status (TODO|DOING|DONE),
                  priority (LOW|MED|HIGH), category?, ownerSide? }

model ScheduleEvent { id, weddingId, title, location?, startsAt, endsAt?,
                      ownerId?, dayTag (DAY_BEFORE|WEDDING_DAY|OTHER),
                      personas Persona[],   // BRIDE/GROOM/BRIDESMAID/...
                      notes? }

model Tool      { id, weddingId, name, category?, url?, costCents?, notes? }

model Table          { id, weddingId, label, capacity, shape (ROUND|RECT),
                       x Float, y Float }
model SeatAssignment { id, tableId, guestId @unique, seatNumber? }

model Note       { id, weddingId, slug @unique, title, parentSlug?,
                   contentJson Json,           // ProseMirror / Tiptap doc
                   updatedById, updatedAt }

model AuditLog   { id, weddingId, actorId, section, action, targetId,
                   diff Json, createdAt }
model Notification { id, userId, kind, title, body, link?, readAt?, createdAt }

enum Section { GUESTS BUDGET VENDORS TASKS SCHEDULE SEATING NOTES MEMBERS }
enum Level   { NONE VIEW EDIT ADMIN }
```

## 8. Permissions

`lib/permissions.ts` exposes:

- `getMembership(userId, weddingId)` — cached per request.
- `can(membership, section, level)` — `OWNER` always passes;
  `permissions[section]` compared against required level
  (`NONE < VIEW < EDIT < ADMIN`).
- `requireSection(section, level)` — server-side guard for every server
  action / route handler. Throws → 403.
- UI uses the same helper to hide/disable controls.

`MEMBERS` is `ADMIN`-only and restricted to `OWNER` regardless of permissions
JSON — only the couple invites/removes.

## 9. Today dashboard (home screen)

One scroll on mobile, multi-column on desktop:

1. Countdown (days to wedding)
2. **My open tasks today + this week** (with quick-complete checkbox)
3. **Upcoming events** (next 5 from the timeline DB, filtered to my persona by default)
4. **RSVP totals** (yes / no / maybe / pending) and recent changes
5. **Budget**: paid vs. planned bar; **Payments** due in next 30 days
6. **Recent activity** (audit log feed, scoped to sections I can see)

Floating "+" button on mobile (quick-add task / payment / event / guest).
Keyboard `c` on desktop opens the same capture bar.

## 10. Notifications

- **Daily email digest** at 08:00 local time: my tasks due today, overdue,
  events in next 48h.
- **Per-item email alerts**: on assignment, mention in a note, task due-soon
  (24h before), payment due-soon (3 days before).
- **In-app**: bell icon, persistent until dismissed. Same triggers as email.
- Backed by `Notification` model + a queue table; sent via `nodemailer`
  through any SMTP provider configured in `.env`.

## 11. Notion CSV seed import (one-off, on first deploy)

The couple has 5 Notion CSV exports:

1. Tasks Tracker
2. Suppliers & Contracts
3. Wedding Budget
4. Payments
5. Tools & Resources

`lib/csv/notion-export.ts` provides one importer per file with column-name
auto-detect against the Notion default headers. Run via
`scripts/seed-from-notion.ts <dir>` or via an admin-only `/admin/import`
page that accepts the 5 files and previews a diff before applying.

The same generic CSV pipeline (`lib/csv/import.ts`) handles Say I Do RSVP
imports — the only difference is the column mapping module.

## 12. Deployment

`docker/docker-compose.yml`:

- `web` — built Next.js standalone image (`output: "standalone"`).
- `postgres` — `postgres:16`, named volume `pgdata`.
- `caddy` — reverse proxy, auto-HTTPS via Let's Encrypt.
- `files` volume mounted into `web` for uploads.

`.env`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER_*`,
`EMAIL_FROM`, `APP_DOMAIN`, `UPLOAD_DIR`.

Migrations run via `prisma migrate deploy` in an init container on boot.

## 13. Phased delivery

PRs against `claude/wedding-app-planning-oS4U9`, in order:

1. **Foundation** — Next.js scaffold, Prisma + Postgres in Docker Compose,
   magic-link auth, Wedding/User/Membership, `can()` helper, app shell + sign-in.
2. **Guests + Say I Do CSV import** — Guest/Household/Rsvp models, list UI,
   importer with column-mapping + preview, ImportRun history.
3. **Budget + Payments** — split BudgetLineItem from Payment, dashboard
   cards, due-date sorting.
4. **Vendors + Tasks** — supplier directory (kanban by status), task board
   (TODO/DOING/DONE) + list view, links between them.
5. **Schedule** — single events DB with day + persona tags, saved filtered
   views, print-friendly view.
6. **Seating** — SVG canvas with `dnd-kit`, capacity warnings, print/PNG export.
7. **Notes (rich-text pages)** — Tiptap-based editor for the document pages
   (Wedding Party, Venue, Food, Photography, Guest Experience, Legal,
   Accommodation).
8. **Notifications** — model + cron + SMTP wiring + bell UI.
9. **Permissions polish + production deploy** — per-section UI, audit log
   writes, Caddyfile + production compose, README runbook, Notion CSV
   seed import.

## 14. Verification

- `pnpm test` — unit tests for `permissions.ts`, `csv/say-i-do.ts`,
  `csv/notion-export.ts`.
- `pnpm test:e2e` — Playwright happy paths: sign-in via magic link
  (mailcatcher in dev), invite member, import a Say I Do CSV, edit budget
  as MEMBER without VENDORS access and confirm 403.
- Manual smoke after slice 9: bring up `docker compose up -d` on a clean VM,
  visit `https://<domain>`, complete sign-in, run a real CSV import,
  exercise each section.
- Lint/typecheck gates: `pnpm lint` and `pnpm typecheck` clean before each
  commit.

## 15. Open questions

- Confirm exact wedding date.
- Share the 5 Notion CSV header rows (paste as text — uploads aren't reaching
  the cloud sandbox).
- Confirm best man + bridesmaid names + emails for invites.
- Confirm production domain.
- Confirm SMTP provider for transactional email (Resend / Postmark / Gmail SMTP).
