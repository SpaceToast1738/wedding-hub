# Wedding Hub — Roadmap

> **Living document.** Updated at the end of each meaningful iteration. The most recent entry is at the top of the [Changelog](#changelog).
>
> **Audience:** Jamie (and Claude resuming a session). The README is for users; this is for whoever's building it.

## Snapshot

- **Wedding date:** 26 September 2026
- **Production URL:** wedding.spencer-net.com (private)
- **Repo:** [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub) · `claude/main` (releases) + `dev` (work-in-progress)
- **Stack:** Next.js 15 · TypeScript · Tailwind v4 · Prisma · Postgres 16 · Auth.js v5 · Caddy · Docker Compose
- **Working tree:** `C:\Users\Admin\Code\wedding-hub` (local SSD). The old `\\TOWER\Jamie Spencer\Claude\wedding-hub` mirror is no longer in use — run `Remove-Item -Recurse -Force "\\TOWER\Jamie Spencer\Claude\wedding-hub"` from a fresh PowerShell to delete it.
- **Current state:** **🟢 LIVE** at https://wedding.spencer-net.com (`claude/main` at **v1.15.0**, promoted 28 Apr 2026). `dev` is ahead at **v1.18.5** with four pending releases: v1.16.0 (task CSV importer + seating guest names), v1.17.0 (countdown breakdown + mobile pass + guest filter/sort), v1.18.0 (decisions surfaced + planner backlog), v1.18.5 (bugfix: edit Q/D). Multi-version plan F1 covers v1.19.0 → v1.25.0+. Standing rule: admin-only. R6 deferred to scheduled agent run on 26 Aug 2026.

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| **A** | Bootable shell — auth, AppShell, Today page, stub pages, /api/health | ✅ Done |
| **B** | All 12 prototype pages ported with server actions, audit logs, permission gates | ✅ Done |
| **C** | Docker stack: Caddy + web + db + backup, hardening, Cloudflare Tunnel alt | ✅ Done |
| **D1** | Real file uploads — multipart action, /api/files/[id] download, MIME allowlist, 25 MB cap | ✅ Done |
| **D2** | Drag-and-drop seating canvas (SVG, pointer-event drag, grid snap, keyboard nudge, view toggle) | ✅ Done |
| **E** | CSV / TSV guest import — column inference, dry-run preview, household merge | ✅ Done |
| **F1** | Catering brief — totals, course breakdowns, dietary aggregate, per-table seating, print stylesheet | ✅ Done |
| **F2** | Photography shot list — checklist within the Wedding Book | ✅ Done |
| **G1** | Spotify playlist sync (read-only mirror) | ✅ Done |
| **G2** | Day-of mode, quick-capture (`C`) modal | ✅ Done |

## Releases

Quick scan of every tagged release. Most recent first; click any version to jump to the full Changelog entry below.

| Version | Date | Headline |
|---|---|---|
| **v1.38.4** | 2026-04-30 | [Wedding Book seed overhaul — every card kind now gets a fully-populated example (OUTFIT items + dates, SETUP items, LEGAL items + name-change checklist, FIELD defs everywhere, RECIPE cocktail, MENU kids/evening/late-night, BUILD welcome bags + favours, plus new Photography + Guest Experience seeders). All 12 card kinds covered.](#2026-04-30--v1384--wedding-book-seed-overhaul) |
| v1.38.3 | 2026-04-30 | [Operator scripts run in production — Dockerfile transpiles `seed-samples-only` + `reset-book` to `scripts-build/`; scripts use a local `PrismaClient` instead of `src/lib/db` so they don't depend on the Next standalone bundle. Invoke with `node scripts-build/scripts/<name>.js`.](#2026-04-30--v1383--operator-scripts-in-production-image) |
| v1.38.2 | 2026-04-30 | [`scripts/reset-book.ts` — destructive Book module reset gated on `CONFIRM_RESET_BOOK=yes`. Wipes + re-seeds every section + subpage; leaves users / tasks / guests / payments untouched.](#2026-04-30--v1382--book-module-reset-script) |
| v1.38.1 | 2026-04-30 | [`scripts/seed-samples-only.ts` — fills empty Book sections + subpages on prod without touching users / tasks / schedule / guests / seating. Section seeders refactored to be importable.](#2026-04-30--v1381--samples-only-prod-backfill-script) |
| v1.38.0 | 2026-04-30 | [Wedding Book closes the arc (P7b/B + P8) — SHOT_LIST gains category / time budget / **guest-list link** · FIELD gains group / helpText / required / numeric + date ranges · RECIPE gains servingsBase + structured `BookRecipeStep` (Json→rows migration) + day-before tag · Post-wedding section seeded · Production backfill script · Guest detail "Photos to capture" reverse query](#2026-04-30--v1380--wedding-book-arc-closes-p7bb--p8) |
| v1.37.5 | 2026-04-30 | [Cross-module wiring (P7b/Part C) — Today widgets for legal deadlines / outfit milestones / open decisions · Guest detail surfaces meal-choice deep-links + accommodation · Budget shows DIY-card linkbacks · Supplier shows "used in setup" rows](#2026-04-30--v1375--cross-module-wiring-p7b-part-c) |
| v1.37.2 | 2026-04-30 | [TEXT card list / blockquote rendering fix — Tailwind v4 has no `@tailwindcss/typography`, so `prose` was a no-op and bullets / numbers / quote borders all disappeared](#2026-04-30--v1372--text-card-list--blockquote-rendering-fix) |
| v1.37.1 | 2026-04-30 | [TEXT card View / Edit toggle — toolbar no longer leaks into read mode after save (matches every other v1.31+ card)](#2026-04-30--v1371--text-card-view--edit-toggle) |
| v1.37.0 | 2026-04-30 | [Wedding Book TEXT cards switch to Tiptap WYSIWYG (P7a) — 10-mark toolbar (Bold / Italic / Underline / H2 / H3 / lists / quote / link / undo / redo) · sanitiser allow-list with enforced `rel`+`target` on every anchor · idempotent SQL backfill for existing TEXT bodies](#2026-04-30--v1370--wedding-book-text-wysiwyg-p7a) |
| v1.36.0 | 2026-04-30 | [Wedding Book STAY + LODGING_GUIDE cards (P6) — one card per accommodation booking with cost / dates / linked guests · recommended-hotels reference card with print stylesheet · Accommodation section seeded with 4 STAY + 1 LODGING_GUIDE around Stratford-upon-Avon](#2026-04-30--v1360--wedding-book-stay--lodging_guide-cards-p6) |
| v1.35.1 | 2026-04-30 | [Migration fix — `CREATE EXTENSION pgcrypto` so `gen_random_bytes()` works in CI's bare Postgres image](#2026-04-30--v1351--migration-fix-pgcrypto) |
| v1.35.0 | 2026-04-30 | [Wedding Book OUTFIT rework (P5) — one card per wedding-party member with fitting timeline / cost / paid status / per-item composition / photos · Wedding Party split into People (OUTFIT cards) + Day-of (TEXT/FIELD timeline)](#2026-04-30--v1350--wedding-book-outfit-rework-p5--wedding-party-split) |
| v1.34.0 | 2026-04-30 | [Wedding Book LEGAL card (P4) — document checklist with deadlines + file attachments · Legal split into Before / Day / After (additive) · FieldLabel + Label lifted to shared `bookCardUi.tsx`](#2026-04-30--v1340--wedding-book-legal-card-p4--legal-split) |
| v1.33.2 | 2026-04-30 | [BOOK-EXPANSION-PLAN.md gains a temporary edit-row layout rule (§10a) so P4–P8 ship correct widths from day one](#2026-04-30--v1332--edit-row-layout-rule-pinned-into-the-card-creation-plan) |
| v1.33.1 | 2026-04-30 | [Edit-row layout pass — BUILD / BAR / SETUP cards switch to two-row grids with per-cell labels so name / supplier / £ all get usable width](#2026-04-30--v1331--edit-row-layout-pass) |
| v1.33.0 | 2026-04-30 | [Wedding Book SETUP card (P3) — per-space spatial walkthrough · Venue split into Spaces / Décor (additive)](#2026-04-30--v1330--wedding-book-setup-card-p3--venue-split) |
| v1.32.2 | 2026-04-30 | [BAR card: per-head pricing + serving timing — handles £2.50/head toast drinks; view groups by timing when set](#2026-04-30--v1322--bar-per-head-pricing--timing) |
| v1.32.1 | 2026-04-30 | [Audit log: 30-day retention sweep + search box on the Settings viewer](#2026-04-30--v1321--audit-log-retention--search) |
| v1.32.0 | 2026-04-30 | [Wedding Book MENU + BAR cards (P2) — food service composition with live guest selection counts, drinks plan with per-head sanity check · BUILD label renamed to "DIY" · audit log viewer now renders human sentences via `formatAuditAction`](#2026-04-30--v1320--wedding-book-menu--bar-cards-p2) |
| v1.31.1 | 2026-04-30 | [BUILD card UX pass — single Edit/View states · live Budget link · `/diy` overview page · £-input · clearer field hints · status-disappear bug fixed](#2026-04-30--v1311--build-card-ux-pass) |
| v1.31.0 | 2026-04-30 | [Wedding Book BUILD card (P1) — DIY production tracker with materials list, sessions log, prototype-blocker warning, copy-to-Budget action](#2026-04-30--v1310--wedding-book-build-card-p1) |
| v1.30.6 | 2026-04-30 | [Track `BOOK-EXPANSION-PLAN.md` in the repo (docs only) — sets the v1.31.0–v1.38.0 arc](#2026-04-30--v1306--track-book-expansion-plan-in-the-repo) |
| v1.30.5 | 2026-04-29 | [Schema cleanup + Topics multi-select · drop legacy `PhotographyShot` and `ScheduleEvent.audience` · combined Wedding Book section + NavTag picker on tasks · NavTag CRUD in Settings · audit-rule standing add + first-pass enrichment](#2026-04-29--v1305--schema-cleanup--topics-multi-select--audit-rule) |
| v1.30.0 | 2026-04-29 | [Tasks ↔ Wedding Book subsection link · picker on task forms + drawer · Linked tasks panel under each card on `/book/[slug]` with per-card search](#2026-04-29--v1300--tasks--wedding-book-subsection-link) |
| v1.29.0 | 2026-04-29 | [Task grouping: None / Assignee / Category / Supplier / Priority / Status · localStorage-persisted dropdown beside Sort · sectioned headers with counts](#2026-04-29--v1290--task-grouping) |
| v1.28.0 | 2026-04-29 | [Task ↔ Supplier link · supplier picker on Task / Question / Decision forms · Linked tasks section on supplier detail · `?supplier=` deep-link from supplier page](#2026-04-29--v1280--task--supplier-link) |
| v1.27.9 | 2026-04-29 | [Tasks polish: drop list container · wider rightmost columns · Type changer in the drawer · all-day events render "All day" instead of "01:00"](#2026-04-29--v1279--tasks-polish-round-3--all-day-display-fix) |
| v1.27.7 | 2026-04-29 | [Guest detail side panel on seating canvas — click a seated guest dot to open](#2026-04-29--v1277--guest-detail-side-panel-on-seating-canvas) |
| v1.27.6 | 2026-04-29 | [Photography migration: PhotographyShot rows → BookShot under a SHOT_LIST card · bespoke route deleted](#2026-04-29--v1276--photography-migration) |
| v1.27.5 | 2026-04-29 | [Mobile nav full `<Link>` revert (Tasks · Guests · sheet items)](#2026-04-29--v1275--mobile-nav-full-link-revert) |
| v1.27.4 | 2026-04-29 | [Tasks visual style match: text-underline List/Board tabs · dynamic category filter pills · Questions filter · "+ View" stub](#2026-04-29--v1274--tasks-visual-style-match-text-tabs--dynamic-category-pills) |
| v1.27.3 | 2026-04-29 | [Tasks polish round 2: full-width table with column headers · centred new-task popout · unified search/filter styling](#2026-04-29--v1273--tasks-polish-round-2-full-width-table--centred-popout--unified-styling) |
| v1.27.2 | 2026-04-29 | [Today page: working task checkbox + broader "My next tasks" priority list](#2026-04-29--v1272--today-page-working-checkbox--broader-task-list) |
| v1.27.1 | 2026-04-29 | [Schedule polish (split date+time, all-day toggle, attendees instead of audience) · seat-drag transform-only ghost · mobile version footer · table-size baseline ROUND-only](#2026-04-29--v1271--schedule-polish--seat-drag-transform--mobile-version--round-only-baseline) |
| v1.27.0 | 2026-04-29 | [Tasks polish: click-to-open right-side drawer · "+ New task" popout · sort options · cleaner search bar](#2026-04-29--v1270--tasks-polish-drawer--popout--sort--search) |
| v1.26.0 | 2026-04-29 | [Modular Wedding Book cards: TEXT · FIELD · RECIPE · SHOT_LIST · OUTFIT (kind picker, per-kind editors, shared chrome)](#2026-04-29--v1260--modular-wedding-book-cards) |
| v1.25.3 | 2026-04-29 | [Seating: table size baseline at 10 seats (capacity tweaks no longer reflow tables)](#2026-04-29--v1253--seating-table-size-baseline-at-10) |
| v1.25.2 | 2026-04-29 | [Mobile nav: service-worker cleanup + Today tab probe-revert to `<Link>` + roadmap "view as"](#2026-04-29--v1252--mobile-nav-sw-cleanup--today-tab-link-probe) |
| v1.25.1 | 2026-04-29 | [Seating: ghost-drag perf (refs not state) · mobile canvas height boost · mobile-only "drag is desktop-only" hint](#2026-04-29--v1251--seating-ghost-drag-perf--mobile-size--desktop-only-hint) |
| v1.25.0 | 2026-04-29 | [Email nudge digests (RSVPs + tasks) · seat-drag grab-offset · mobile navbar plain anchor](#2026-04-29--v1250--email-nudge-digests--seat-drag-offset--mobile-anchor) |
| v1.24.0 | 2026-04-29 | [Print stylesheets for /budget + /payments · BookSection couple-only audience · mobile navbar imperative-routing fix](#2026-04-29--v1240--print-stylesheets--booksection-visibility--mobile-navbar-fix) |
| v1.23.3 | 2026-04-29 | [Seating bugfix: freeze auto-crop viewBox during drag (drift fix)](#2026-04-29--v1233--seating-freeze-viewbox-during-drag) |
| v1.23.2 | 2026-04-29 | [Seating: notes/checklist into collapsible sidebar · auto-crop canvas · disable table-drag on mobile · ceremony save returns result](#2026-04-29--v1232--seating-collapsible-sidebar--canvas-auto-crop--mobile-drag-disable--ceremony-save-result) |
| v1.23.1 | 2026-04-29 | [Seating: notes + checklist global & always visible · obvious Reception/Ceremony tabs](#2026-04-29--v1231--seating-globalize-notes--checklist--obvious-tabs) |
| v1.23.0 | 2026-04-29 | [Seating notes + day-of checklists + ceremony placeholder page + bigger top table](#2026-04-29--v1230--seating-notes--day-of-checklists--ceremony-placeholder) |
| v1.22.10 | 2026-04-29 | [Seating polish: repack-on-shrink, glyph centering, HEAD label spacing, ghost dot during seat-drag, alignment guides during table-drag](#2026-04-29--v12210--seating-polish-repack-glyph-center-label-space-ghost-dot-alignment-guides) |
| v1.22.9 | 2026-04-29 | [Seating bugfix: capacity-shrink server-error overlay, HEAD dots flipped to top edge, dynamic name truncation, pointer-based seat drag](#2026-04-29--v1229--seating-bugfix-capacity-error-head-orientation-name-overlap-canvas-drag) |
| v1.22.8 | 2026-04-29 | [Seating: RSVP glyphs inside seat dots (✓ ? ~ ✗) for colour-blind accessibility](#2026-04-29--v1228--seating-rsvp-glyphs-inside-seat-dots) |
| v1.22.7 | 2026-04-29 | [Seating: RSVP-colored dots, HEAD/RECTANGLE seats, drag-between-seats, resizable grid, uniform S/M/L/XL, visible capacity buttons, click-once focus](#2026-04-29--v1227--seating-rsvp-dots-all-shape-seats-canvas-drag-resizable-grid-uniform-toggles) |
| v1.22.6 | 2026-04-29 | [Seating: snap-to-grid toggle + modify table capacity + pending guests in seat-picker](#2026-04-29--v1226--seating-snap-to-grid-toggle--modify-capacity--pending-in-picker) |
| v1.22.5 | 2026-04-29 | [Bugfix: hydration mismatch (#418/#482) on Today page + persistence race on seating canvas + decoupled dot/label scales](#2026-04-29--v1225--bugfix-hydration-persistence-race-decoupled-seating-scales) |
| v1.22.0 | 2026-04-28 | [Custom fields for Supplier + Task](#2026-04-28--v1220--custom-fields-for-supplier--task) |
| v1.21.0 | 2026-04-28 | [Audit log viewer + sticky search on /suppliers + /tasks](#2026-04-28--v1210--audit-log-viewer--sticky-search-on-suppliers--tasks) |
| v1.20.6 | 2026-04-28 | [Seating: drag-all-guests + RSVP tag in panel](#2026-04-28--v1206--seating-drag-all-guests--rsvp-tag-in-panel) |
| v1.20.5 | 2026-04-28 | [Seating canvas: bigger labels + S/M/L size selector](#2026-04-28--v1205--seating-canvas-bigger-labels--sml-size-selector) |
| v1.20.0 | 2026-04-28 | [Wedding details DB-backed (Settings UI + 10 ref replacements)](#2026-04-28--v1200--wedding-details-db-backed) |
| v1.19.6 | 2026-04-28 | [README rewrite: standing rules, current test pyramid, fix stale phase-status](#2026-04-28--v1196--readme-rewrite) |
| v1.19.5 | 2026-04-28 | [Email deliverability: Reply-To + List-Unsubscribe + DNS docs](#2026-04-28--v1195--email-deliverability-reply-to--list-unsubscribe--dns-docs) |
| v1.19.0 | 2026-04-28 | [Today page redesign + mobile nav fix + IllusCountdown port](#2026-04-28--v1190--today-page-redesign--mobile-nav-fix--illuscountdown-port) |
| v1.18.5 | 2026-04-28 | [Bugfix: edit questions and decisions](#2026-04-28--v1185--bugfix-edit-questions-and-decisions) |
| v1.18.0 | 2026-04-28 | [Decisions surfaced in nav + planner-only backlog catalogued](#2026-04-28--v1180--decisions-surfaced-in-nav--planner-only-backlog-catalogued) |
| v1.17.0 | 2026-04-28 | [Countdown breakdown · mobile pass · guest list filter/sort](#2026-04-28--v1170--countdown-breakdown--mobile-pass--guest-list-filtersort) |
| v1.16.0 | 2026-04-28 | [Task CSV importer + guest names on the seating canvas](#2026-04-28--v1160--task-csv-importer--guest-names-on-the-seating-canvas) |
| v1.15.0 | 2026-04-28 | [Phase R5b: illustrations ported + Custom Fields UI (C6 + C10)](#2026-04-28--v1150--phase-r5b-illustrations-ported--custom-fields-ui-c6--c10) |
| v1.14.0 | 2026-04-28 | [Phase R5a: Bucket C drift decisions (C1 + C4 + C7 + C11)](#2026-04-28--v1140--phase-r5a-bucket-c-drift-decisions-c1--c4--c7--c11) |
| v1.13.0 | 2026-04-28 | [Phase R4c: polish MINORs (B6 + B7 + B9) — Bucket B complete](#2026-04-28--v1130--phase-r4c-polish-minors-b6--b7--b9--bucket-b-complete) |
| v1.12.0 | 2026-04-28 | [Phase R4b: data + UX MINORs (B5 + B8 + B11 + B12)](#2026-04-28--v1120--phase-r4b-data--ux-minors-b5--b8--b11--b12) |
| v1.11.0 | 2026-04-28 | [Phase R4a: workflow polish (B1 + B2 + B3 + B4)](#2026-04-28--v1110--phase-r4a-workflow-polish-b1--b2--b3--b4) |
| v1.10.0 | 2026-04-28 | [Phase R3 follow-on: Postgres-backed integration job + Playwright e2e in CI](#2026-04-28--v1100--phase-r3-follow-on-postgres-integration-job--playwright-e2e-in-ci) |
| v1.9.0 | 2026-04-28 | [Book sections aligned with prototype + Spotify env-var compose fix](#2026-04-28--v190--book-sections-aligned-with-prototype--spotify-env-var-compose-fix) |
| v1.8.0 | 2026-04-28 | [Spotify integration setup guide + status chip on Songs](#2026-04-28--v180--spotify-integration-setup-guide--status-chip) |
| v1.7.0 | 2026-04-28 | [Tier 3 / A: +1s materialise as own Guest rows](#2026-04-28--v170--tier-3-1s-as-own-guest-rows) |
| v1.6.0 | 2026-04-28 | [Tier 2 user-feedback polish: Schedule table view + Wedding Book hub redesign](#2026-04-28--v160--tier-2-user-feedback-polish) |
| v1.5.0 | 2026-04-28 | [Tier 1 user-feedback polish: mobile signout, Settings UI defence, scroll, 4-col Glance, countdown breakdown](#2026-04-28--v150--tier-1-user-feedback-polish) |
| v1.4.0 | 2026-04-28 | [Phase R3 (partial): tests in CI + TESTING.md + integration scaffold](#2026-04-28--v140--phase-r3-partial-tests-in-ci--testingmd--integration-scaffold) |
| v1.3.0 | 2026-04-28 | [Phase R2: magic-link rate limit + archived-guest restore](#2026-04-28--v130--phase-r2-magic-link-rate-limit--archived-guest-restore) |
| v1.2.4 | 2026-04-28 | [Dockerfile copies `.npmrc` — first version of the v1.2.x line that built green in CI](#2026-04-28--v124--dockerfile-copies-npmrc-so-the-legacy-peer-deps-actually-applies-in-ci) |
| _(no tag)_ | 2026-04-28 | v1.2.1 / v1.2.2 / v1.2.3 — three failed CI fix attempts; not tagged on principle (only green-CI SHAs get tags). Documented in the changelog for traceability. |
| **v1.2.0** | 2026-04-28 | [Phase R1: trust restoration (audit fixes + Vitest)](#2026-04-28--v120--phase-r1-trust-restoration-audit-fixes--vitest) |
| v1.1.0 | 2026-04-27 | [At a Glance dashboard](#2026-04-27--v110--at-a-glance-dashboard) |
| v1.0.0 | 2026-04-27 | [🎉 Release-1 design polish across all pages](#2026-04-27--v100--release-1-design-polish-across-all-pages) |
| v0.15.0 | 2026-04-27 | [Phase G2 day-of mode + quick-capture](#2026-04-27--v0150--phase-g2-day-of-mode--quick-capture) |
| v0.14.0 | 2026-04-27 | [Phase G1 Spotify playlist sync](#2026-04-27--v0140--phase-g1-spotify-playlist-sync) |
| v0.13.0 | 2026-04-27 | [Phase F2 photography shot list](#2026-04-27--v0130--phase-f2-photography-shot-list) |
| v0.12.0 | 2026-04-27 | [Import merge + guest detail page + catering letterhead](#2026-04-27--v0120--import-merge--guest-detail-page--catering-letterhead) |
| v0.11.1 | 2026-04-27 | [coerceBool dash placeholder fix](#2026-04-27--v0111--import-stop-warning-on--boolean-placeholders) |
| v0.11.0 | 2026-04-27 | [Phase F1 catering brief](#2026-04-27--v0110--phase-f1-catering-brief-printable-summary) |
| v0.10.0 | 2026-04-27 | [Children's-meal + RSVP link import + cross-page surfaces](#2026-04-27--v0100--childrens-meal--rsvp-link-import-cross-page-surfaces-windows-guide) |
| v0.9.1 | 2026-04-27 | [Import copy: Guest vs User email scope](#2026-04-27--v091--import-copy-clarify-guest-vs-user-email-scope) |
| v0.9.0 | 2026-04-27 | [Phase E feature-complete (real Say I Do CSV)](#2026-04-27--v090--phase-e-feature-complete-real-say-i-do-csv-ingest) |
| v0.8.0 | 2026-04-27 | [Phase E — CSV / TSV guest import (initial)](#2026-04-27--v080--phase-e-csv--tsv-guest-import) |
| v0.7.1 | 2026-04-27 | [Seating-position bugfix](#2026-04-27--v071--bugfix-seating-table-positions-survive-navigation) |
| v0.7.0 | 2026-04-27 | [First/last name + welcome prompt + Settings profile](#2026-04-27--v070--first--last-name-fields--welcome-prompt--settings-profile-panel) |
| v0.6.0 | 2026-04-27 | [Phase D2 — drag-and-drop seating canvas](#2026-04-27--v060--phase-d2-drag-and-drop-seating-canvas) |
| v0.5.0 | 2026-04-27 | [Per-file visibility + file management UX](#2026-04-27--v050--per-file-visibility--file-management-ux) |
| v0.4.1 | 2026-04-27 | [Remove members from Settings](#2026-04-27--v041--remove-from-members-in-settings) |
| v0.4.0 | 2026-04-27 | [Phase D1 file uploads + bootstrap admin + styled email](#2026-04-27--v040--phase-d1-file-uploads--bootstrap-admin--pretty-magic-link-email) |
| v0.3.2 | 2026-04-27 | [🚀 Live on Unraid + post-deploy back-ports](#2026-04-27--v032--live-on-unraid--post-deploy-back-ports) |
| v0.3.1 | 2026-04-27 | [Deploy-readiness fixes](#2026-04-27--v031--deploy-readiness-fixes) |
| v0.3.0 | 2026-04-27 | [Phase C — production deploy stack](#2026-04-27--v030--phase-c--production-deploy) |
| v0.2.0 | 2026-04-27 | [Phase B — domain pages](#2026-04-27--v020--phase-b--domain-pages) |
| v0.1.0 | 2026-04-27 | [Phase A — bootable shell](#2026-04-27--v010--phase-a--bootable-shell) |

**Bold** = currently running in production (`claude/main` tip). _Italics_ = on `dev` only, awaiting promotion.

## What's shipped

### Phase A — Bootable shell
- [src/app/globals.css](src/app/globals.css), [src/app/layout.tsx](src/app/layout.tsx) — Tailwind v4 + token palette ported from `prototype/tokens.css`, dark mode with FOUC prevention
- [src/auth.ts](src/auth.ts), [src/auth.config.ts](src/auth.config.ts), [src/middleware.ts](src/middleware.ts) — Auth.js v5 magic-link, email allow-list, JWT session, audit log on sign-in, couple-only route gating
- [src/app/signin/](src/app/signin) — sign-in / verify / error pages
- [src/lib/db.ts](src/lib/db.ts), [src/lib/permissions.ts](src/lib/permissions.ts), [src/lib/audit.ts](src/lib/audit.ts), [src/lib/format.ts](src/lib/format.ts), [src/lib/actions.ts](src/lib/actions.ts) — shared infra
- [src/components/ui/](src/components/ui) — Button, StatusPill, Avatar, Tag, Input, PageHeader, Toast, ComingSoon
- [src/components/shell/](src/components/shell) — AppShell (RSC), Sidebar, MobileTabBar, AvatarMenu, DarkModeScript
- [src/app/(app)/page.tsx](src/app/(app)/page.tsx) — Today with live RSVP/task/event counts, days-to-wedding
- [src/app/api/health/route.ts](src/app/api/health/route.ts) — DB ping endpoint
- [prisma/seed.ts](prisma/seed.ts) — seeds the 5 named users + sample tasks/events/household/book sections

### Phase B — Domain pages
Each section has server actions wrapped with `requireEdit(section)` + `audit()`, with `revalidatePath` on mutate.

| Page | What works |
|------|------------|
| [Schedule](src/app/(app)/schedule/page.tsx) | CRUD events with audience tags |
| [Tasks](src/app/(app)/tasks/page.tsx) | List + filter (All/Mine/Open/Done), priority dots, status cycle, inline edit |
| [Questions](src/app/(app)/questions/page.tsx) | Open/Answered groups, inline answer textarea |
| [Suppliers](src/app/(app)/suppliers/page.tsx) | Cards grouped by category, status dropdown, agreed amount |
| [Budget](src/app/(app)/budget/page.tsx) (couple) | Categories with line table, planned/actual/paid summary |
| [Payments](src/app/(app)/payments/page.tsx) (couple) | Table with quick "Mark paid", supplier link, status pills |
| [Songs](src/app/(app)/songs/page.tsx) | Playlists by category, song CRUD |
| [Guests](src/app/(app)/guests/page.tsx) | Households grouped by side, RSVP dropdown, dietary, child/+1 flags |
| [Files](src/app/(app)/files/page.tsx) | Reference index (real upload deferred) |
| [Wedding Book](src/app/(app)/book/page.tsx) | Hub + per-section page editor with inline title/body editing |
| [Seating](src/app/(app)/seating/page.tsx) | Table cards, dropdown to assign attending guests (drag canvas deferred) |
| [Settings](src/app/(app)/settings/page.tsx) | Per-user × per-section permission matrix |

### Phase C — Production deploy
- [Dockerfile](Dockerfile) — multi-stage standalone bundle, non-root UID 1000, tini, healthcheck on `/api/health`
- [docker/entrypoint.sh](docker/entrypoint.sh) — `prisma migrate deploy` before app start
- [docker-compose.yml](docker-compose.yml) — 4 services, 2 networks, no host ports for db/web, read-only FS, cap_drop ALL, no-new-privileges
- [caddy/Caddyfile](caddy/Caddyfile) — auto-TLS, HSTS, CSP, COOP/CORP, dotfile blocks, body cap, rate-limit stub
- [.env.production.example](.env.production.example) — every var the compose stack needs
- [src/app/robots.txt/route.ts](src/app/robots.txt/route.ts) + middleware whitelist — `Disallow: /`
- Backup service with **7d / 4w / 12m** pg_dump retention to `./backups/`
- README has full deploy walkthrough, ops commands, hardening notes, Cloudflare Tunnel alternative

### Phase D2 — Seating canvas (v0.6.0)
- [src/app/(app)/seating/SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — SVG canvas, viewBox 1400×900, faint grid pattern, tables drawn as circle (round) / rounded rect (rectangle / head). Visual size scales with capacity.
- Pointer Events for unified mouse/touch drag with `setPointerCapture`. Drag updates local positions only; on `pointerup`, snaps to a 20-unit grid (when within 10 px of a grid point) and commits via `updateTablePosition` server action.
- Click-without-drag focuses the table and opens a side panel with seat assignments (reusing the seat-dropdown UX from the list view) plus a delete button.
- Keyboard accessibility: arrow keys nudge the focused table by 20 units; ⇧+arrow does 80. Tables are tabbable with descriptive aria-labels.
- [src/app/(app)/seating/SeatingClient.tsx](src/app/(app)/seating/SeatingClient.tsx) — view toggle between Canvas and List; choice persists to `localStorage` so it survives reloads.
- [src/app/(app)/seating/actions.ts](src/app/(app)/seating/actions.ts) — new `updateTablePosition(id, x, y, rotation?)` action, gated by `requireEdit("seating")` and audited. `createTable` now spreads new tables across a 3-column / 280×240 grid instead of stacking them all at (0,0).

### Phase D1 — File uploads (v0.4.0)
- [src/lib/uploads.ts](src/lib/uploads.ts) — MIME allowlist, 25 MB cap, content-addressable filename, path-traversal defence
- [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) — `uploadFile` multipart server action (replaces the old reference-only `registerFile`) with on-error rollback of the on-disk write; deletion removes both DB row and physical file
- [src/app/api/files/[id]/route.ts](src/app/api/files/[id]/route.ts) — auth-gated streaming download, `inline` for PDFs/images/text, `attachment` for everything else, RFC 5987 filenames
- [src/app/(app)/files/FilesClient.tsx](src/app/(app)/files/FilesClient.tsx) — drag-and-drop or click-to-upload zone, MIME-aware row icons, click-to-download links
- [next.config.ts](next.config.ts) + [caddy/Caddyfile](caddy/Caddyfile) — body-size budget raised to 26 MB at both layers
- [Dockerfile](Dockerfile) — pre-creates `/app/uploads` with `node:node` ownership so the named volume mounts writable for UID 1000

## Deferred / Backlog

Ranked roughly by usefulness × ease. **Standing rule (28 Apr 2026):**
Wedding Hub is admin-only — planners + couple + wedding party. Guest
data is managed via Say I Do, not in-app. So no items below should
introduce guest-facing surfaces (public RSVP forms, guest portals,
magic links sent to invitees, etc.). If a feature drifts toward giving
guests access, defer to "out of scope" rather than building behind a
feature flag.

### Planner-only feature shortlist (post-v1.17.0)

The user picked these from a wider menu on 28 Apr 2026. Items 5 (public
RSVP form) and 7 (guest portal) were explicitly dropped because they
violate the admin-only rule above.

**Status check (29 Apr 2026):** the planner-only shortlist is mostly
shipped. The seating-canvas pass ballooned into seven follow-up
releases (v1.22.5–v1.22.10 + v1.23.0) as the user dogfooded each
version and surfaced bugs/asks; the print + nudges + Book section
items renumbered down the queue. Current state:

- ~~**Audit log viewer in Settings**~~ — shipped v1.21.0.
- ~~**Search beyond /guests**~~ (Suppliers + Tasks sticky search) —
  shipped v1.21.0.
- ~~**Custom fields for Supplier + Task**~~ — shipped v1.22.0.
- ~~**Seating polish pass**~~ — shipped across v1.22.5–v1.22.10
  (snap-to-grid · capacity edit · pending-in-picker · RSVP-coloured
  dots · HEAD/RECTANGLE seats · canvas drag · resizable grid ·
  uniform S/M/L/XL · RSVP glyphs · repack-on-shrink · ghost dot ·
  alignment guides · click-once focus · hydration fix · bigger top
  table).
- ~~**Seating notes + day-of checklist + ceremony placeholder**~~ —
  shipped v1.23.0.
- ~~**Print stylesheet for /budget + /payments**~~ — shipped v1.24.0.
- ~~**BookSection audience overrides**~~ — shipped v1.24.0.
- ~~**Email reminders / nudges**~~ — shipped v1.25.0.
- ~~**Modular page cards**~~ — shipped v1.26.0 (TEXT · FIELD · RECIPE
  · SHOT_LIST · OUTFIT, photography migration deferred to v1.26.5).
- **Group-coloured ceremony seating** — design pass first. Bumped to
  v1.28.0+. See "Group-coloured ceremony seating (design needed)"
  below for the full requirements + open design questions. ~9 hrs
  estimated once the design pass lands.

**Total scope spent on the planner-only shortlist:** ~36 hrs across
~25 releases (vs. the original 15.5-hr estimate). Two overshoots:
the seating polish pass that ran v1.22.5–v1.23.3 (originally budgeted
~3 hrs for v1.20.5 + v1.20.6, became ~14 hrs through dogfood
iteration) and the modular-cards feature itself which was bigger
than the original Phase F1 plan accounted for once OUTFIT was added.
The user feedback was always specific and actionable so each
iteration was cheap; in hindsight the seating canvas + the Wedding
Book just had more surface area than the original plan modelled.

### Wedding Book expansion (v1.31.0 → v1.38.0)

Comprehensive rebuild of the Wedding Book module — 12 sections, 12
card kinds, Tiptap WYSIWYG editor for TEXT cards. Eight phases,
each a tagged release. Full design + per-phase prompts in
[BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md). Tracked in the
repo from v1.30.6.

While this arc is in flight, the items below remain queued for
v1.39.0+ unless a hotfix forces an out-of-band ship.

### Shovel-ready next (no design pass needed)

These don't need a design pass — just the time to execute. Roughly
in priority order.

- ~~**Mobile-nav full `<Link>` revert**~~ — shipped v1.27.5.
  Tasks / Guests / More-sheet items all back to client-side `<Link>`
  navigation. The SW cleanup from v1.25.2 has been live for a
  release without regressing.
- ~~**Photography migration**~~ — shipped v1.27.6. PhotographyShot
  rows migrated into BookShot under a SHOT_LIST card on the
  Photography section; bespoke /book/photography route deleted
  (resolves through /book/[slug] now). Legacy PhotographyShot
  table retained one release for recoverability — to be dropped
  in v1.28.0.
- ~~**Guest detail side panel on seating canvas**~~ — shipped
  v1.27.7. Click (no drag) a seated guest dot opens a
  GuestDetailPanel in the canvas sidebar with the guest's record
  (RSVP, household, email, dietary, plus-one, notes) and an
  "Open record →" link to the full /guests/[id] page.
- ~~**Task ↔ Supplier link**~~ — shipped v1.28.0. Tasks /
  questions / decisions can optionally link a Supplier; surfaces
  on the supplier detail page (Linked tasks section) and via
  `?supplier=<id>` deep-link on `/tasks`.
- ~~**Task grouping**~~ — shipped v1.29.0. Group dropdown beside
  Sort with None / Assignee / Category / Supplier / Priority /
  Status options.
- **Schema cleanup release.** Drop the legacy `PhotographyShot`
  table (after v1.27.6 verifies clean for one release) and the
  legacy `ScheduleEvent.audience` column (after v1.27.1 verifies).
  ~30 min total. Defer until both predecessors have been live one
  release. Was earmarked v1.28.0 — that slot was used for Task ↔
  Supplier instead; the cleanup is now next vacant slot.

#### New asks captured 30 Apr 2026

- **Tasks linkable to individual cards (inline).** *User-asked while
  reviewing v1.33.x.* Currently Task↔Book linking is at the
  BookSection level (v1.30.5 m2m); user wants the link at the
  individual card / subsection level **and** for the linked tasks
  to display **inline on each card** rather than only at the
  section header.

  Implementation candidates (decide before code):

  1. **m2m Task ↔ BookSubsection alongside the existing section
     m2m.** Adds a second relation; both coexist. Tasks can link to
     either or both. Most flexible.
  2. **Replace the section m2m with a subsection m2m + roll up to
     section-level via the parent relation at read time.** Cleaner
     schema, but it's the v1.30.0 → v1.30.5 reversal so we should
     only do this if the section-level link genuinely isn't useful
     anymore.
  3. **Keep the section m2m, but bucket the existing section-level
     LinkedTasksPanel by a new optional `metadata.cardSlug` field
     on the link.** No new table — uses the metadata bag to scope
     visually. Cheapest but feels hacky.

  **Lean:** option 1. Tasks already carry `bookSections[]` (m2m); a
  parallel `bookSubsections[]` is symmetric and keeps the existing
  read paths intact. ~3 hrs once decided. The §10a edit-row layout
  rule still applies — the inline panel goes at the bottom of the
  card body, mirroring the section-level panel that's already there.

#### New asks captured 29 Apr 2026 (need design / planning)

These came in the user's bulk-asks message. They each need at least
a brief design pass before code starts — not size-able from a
sentence. Captured here so they don't fall off the radar.

- **Tasks ↔ Wedding Book linking.** "Be able to link tasks /
  questions / decisions with wedding book pages. The tasks will
  then also display filtered but searchable under each section."
  - **Schema:** add `Task.bookSubsectionId String?` (nullable, FK to
    `BookSubsection`, `onDelete: SetNull`) — same shape as v1.28.0's
    `Task.supplierId`. The page-level link (`bookSection`) is
    implied by the subsection's parent so we don't need a separate
    column.
  - **UI surfaces:** picker on TaskForm + drawer (mirror the
    Supplier picker shape from v1.28.0). On `/book/[slug]`, render a
    Linked tasks panel under each subsection's editor showing rows
    where `bookSubsectionId === subsection.id` plus a search box
    scoped to that section's tasks.
  - **Open question:** does the link snap to a *section* (page) or a
    *subsection* (card)? Lean subsection — tighter scope, can be
    rolled up to section view. ~3 hrs once decided.
  - Also add navigational subsections to Wedding Book: music,
    reception, ceremony, guests. (Likely just seeding `BookSection`
    rows + slugs — quick once the linking design is set.)
- **Schedule attendees → permission groups.** "For the schedule
  these should follow permissions groups when added instead of
  attendees." Currently v1.27.1's attendee picker is a multi-user
  free pick. The intent: pick from named permission groups (Couple,
  Wedding party, Suppliers, Everyone…) instead. Threads into the
  existing Group-based-permissions backlog item — both probably
  ship together. ~2 hrs once the permission-group model lands.
- **Audit log enrichment.** "Review audit log data to ensure
  capturing is as rich as possible including recent activity."
  Existing audit() utility logs `{ action, entity, entityId,
  metadata }`. Likely-missing surfaces:
  - Diff capture on update events — currently only the entity ID
    is logged. Adding `metadata.before / after` (filtered to
    non-PII columns) gives a real changelog.
  - Recent-activity feed surface (admin sidebar widget?) reading
    the last N audit rows.
  - Cross-entity references — when a task is linked to a supplier,
    log on both sides so the supplier's audit includes the task
    link event.
  - Timestamp visibility — `createdAt` is already there; just need
    a viewer that surfaces it.
  - Likely a v1.30.0 design pass before code. ~3 hrs once scope is
    set.
- ~~**DMARC review (operational, not code).**~~ Reviewed 29 Apr 2026
  on the Outlook 26-Apr-2026 report (3 messages, all DKIM+SPF aligned
  pass via Resend → AWS SES `54.240.3.x`). Current policy is
  `p=none; sp=none; adkim=r; aspf=r; pct=100; fo=0` — monitor-mode
  with relaxed alignment. Mail flow is healthy; no spoofing
  observed. Follow-up actions queued below.

#### DMARC follow-up actions (post-29-Apr-2026 review)

  Operational items, not code. Logged here so they don't fall off
  the radar.

  - [ ] **Verify multi-provider DMARC reporting.** This review only
    saw Outlook's view. Confirm Google / Yahoo / Apple are also
    sending DMARC reports to the `rua=` mailbox — otherwise visibility
    is partial. Wait 1–2 weeks, scan the inbox for reports from
    `noreply-dmarc-support@google.com`, `dmarchelp@yahoo.com`,
    `dmarc-noreply@apple.com`, etc. If a major provider is missing,
    re-check the DMARC record's `rua=` address syntax.
  - [ ] **Add `ruf=` for per-message failure reports** before
    starting the policy ramp. Richer signal during the canary phase.
    DNS update only — same mailbox as `rua=` is fine.
  - [ ] **Begin the `p=none → quarantine → reject` ramp** *after the
    wedding* (post-Sep 2026). Sequence:
    1. `p=quarantine; pct=10` — canary 10% of failing mail.
    2. After 1–2 weeks of clean reports, `pct=25` → `pct=50` → `pct=100`.
    3. After 2–4 weeks at `quarantine; pct=100`, move to `p=reject`.
    4. (Optional) Tighten `adkim=s; aspf=s` only if a specific
       sender lookalike concern emerges — relaxed currently passes
       100% for legitimate senders, so the marginal gain is small.
    5. Hold the ramp at any step if a legitimate sender starts failing.
       Pre-wedding the cost of an invitation email getting quarantined
       is far higher than the marginal anti-spoof gain.

(View-as preview moved to the deferred-backlog block below since it
threads through every permission gate and the actual scope likely
runs above the original 2-hr estimate. See "View as another role
preview (deferred)" further down.)

### Group-coloured ceremony seating (design needed)

*Asked by user, 29 Apr 2026. Substantial enough to warrant a planning
pass before code starts; this section captures the requirements and
open design questions. Will replace this section with a concrete
release plan in the same shape as v1.19.0–v1.23.1 once the design
questions are answered.*

**Goal.** Extend the v1.23.0 ceremony placeholder so seats are
coloured by group (e.g. groomsmen, bride's family, parents,
flower-girls), automatically packed to the correct side of the aisle
(groom or bride), and ordered by priority — priority 1 sits front.

**Requirements (verbatim from the ask):**

- Colour seats by group on the ceremony layout.
- Split into groom side and bride side — per group.
- Built-in flexibility with the sides (UK convention: bride left /
  groom right; US convention: opposite; blended families: rename
  freely).
- Groups must match a "group" concept on the guest list — define
  groups once and tag guests into them.
- Groups ordered by priority — closer to 1 = closer to front.
- Edge cases: flowergirl / flowerboy may need non-standard placement
  (standing at the front, not seated in the audience).

**Schema sketch — not yet decided:**

- New `Group` model: `{ id, name, color, priority Int, side: ENUM(LEFT|RIGHT|EITHER), placement: ENUM(AUDIENCE|ALTAR|PROCESSIONAL|NONE) }`. Side stored as logical LEFT/RIGHT; the `CeremonySeating` singleton holds the visible labels (`leftSideLabel`, `rightSideLabel` — "Bride", "Groom", "Spencer family", whatever).
- Guest membership: `Guest.groupId String?` (one group per guest) vs. a many-to-many `Guest <-> Group` join. **Recommendation:** one-to-many — a "groomsmen" entry doesn't usually overlap with another group for the same person, and the algorithm gets simpler.
- Default groups to seed at install: Bride's family · Groom's family · Bridesmaids · Groomsmen · Officiant · Flower attendants · Other. User can rename / delete / re-prioritise.

**Layout algorithm:**

1. Pull groups by side, sorted by `priority` ascending.
2. For each group, pull its members; respect household boundaries so couples / parties don't get split across rows.
3. Pack into rows starting at row 0 (front). When a group fills a row, wrap to the next.
4. Groups with `placement ≠ AUDIENCE` skip seating entirely; render in a "Wedding party" sidebar/legend instead (so flowergirls/officiant are visible but not in the seat grid).
5. Empty seats at the end of a side render hollow (reserves).

**UI surfaces — open:**

- Group editor lives where? `/guests/groups` (groups are guest metadata) vs. a Settings panel vs. inline on `/seating/ceremony`. **Lean:** `/guests/groups` since the data is guest-scoped.
- Drag-handle priority reorder + colour picker per group (palette tied to app theme tokens — moss / marigold / info / rose / etc.).
- Guest assignment: extend the existing `/guests` filter UI with a Group selector dropdown per row + bulk-assign on the existing filter selection.
- Ceremony layout (`/seating/ceremony`): seat dots fill with their group's colour; click/hover a seat shows the guest name. Side-label config inputs above the SVG. Legend below listing groups + colours + counts.

**Open design questions (must answer before code starts):**

- [ ] One group per guest (m2o) vs. many-to-many. *Recommend:* m2o.
- [ ] Side stored as LEFT/RIGHT + configurable labels vs. hardcoded
      bride/groom. *Recommend:* LEFT/RIGHT + labels for flexibility.
- [ ] Auto-pack only vs. allow manual per-seat overrides (drag a guest
      to a specific seat to break the algorithm's choice).
- [ ] Multi-group conflict resolution (bridesmaid AND bride's family
      — which group wins for the seat?). Probably moot if m2o.
- [ ] Plus-ones (own Guest rows since v1.7.0): inherit parent's
      group? *Recommend:* yes by default, override allowed.
- [ ] Reserve / VIP front-row treatment: special "Reserved" group,
      or just rely on priority=0 always sitting front?
- [ ] Aisle-side preference — front-row family typically sits *on the
      aisle*. Pack from aisle outward, not from outer edge inward.
- [ ] Non-audience groups (flowergirl, officiant): render where?
      Sidebar legend, separate altar zone above the seat grid, or
      just hide and trust the planner to remember?
- [ ] Default group palette + ability to add custom colours.
- [ ] Colour-blind accessibility: pair group colour with a small
      text or icon hint per seat (mirror the v1.22.8 RSVP-glyph
      pattern — short group code in white inside the dot).

**Sizing (very rough — confirm in design pass):**

| Step                                          | Effort  |
|-----------------------------------------------|---------|
| Schema + migration + seed defaults            | ~1 hr   |
| Group editor page (`/guests/groups`)          | ~2 hrs  |
| Guest-assignment UI extension on `/guests`    | ~1 hr   |
| Ceremony layout decision module + tests       | ~2 hrs  |
| Ceremony SVG render with colours + legend     | ~1.5 hrs|
| Side-label config + non-audience sidebar      | ~1 hr   |
| Verification + ROADMAP                        | ~30 min |

**Total estimate: ~9 hrs once design questions are signed off.** Big enough that splitting into v1.27.0 (schema + group editor + guest assignment) and v1.27.5 (ceremony render + colour algorithm) is worth considering.

**What this section deliberately does NOT scope:**

- Per-guest seat assignments / drag-and-drop on the ceremony grid (separate, larger feature — would supersede the auto-pack algorithm).
- Reception canvas integration (groups don't yet affect reception seating; that stays free-form).
- Public-facing seat lookup ("guests can see where they're sitting") — admin-only standing rule applies.

When the open questions are answered, this section gets replaced with a concrete release plan in the same shape as v1.19.0–v1.23.1 above.

### Older / lower-priority backlog

- **Numeric auth code at sign-in (OTP / TOTP / SMS)** — currently
  Auth.js sends a clickable magic-link to the user's email; clicking
  the link signs them in. User asked (29 Apr 2026) for an "auth
  number for login" — an alternative or supplementary code-entry
  flow. Three plausible reads, each design-distinct:
  (a) **Email OTP** — replace the magic-link with a 6-digit code
      typed into the sign-in page. Lower phishing risk than long
      pre-tokenised URLs that some email clients prefetch and burn.
      Auth.js EmailProvider supports this via the `generateVerificationToken`
      callback returning a short numeric code instead of UUID.
  (b) **TOTP / authenticator-app MFA** — second factor on top of the
      magic-link. Couple + planners enrol once via QR code; sign-in
      asks for the 6-digit rotating code from Authy / Google
      Authenticator. Adds `User.totpSecret` (encrypted at rest).
  (c) **SMS code** — twilio / Resend SMS adds a phone-number step.
      More setup, more cost, weakest of the three security-wise.
  *Recommendation:* (a) Email OTP — least new infra, biggest UX
  win on touch devices where copy-pasting a long URL from a mail
  app is fiddly. ~2 hrs to implement once the design pass picks one.
- ~~**Schedule page polish (time entry + all-day + audience rethink)**~~
  — shipped v1.27.1. Split date+time inputs (typeable on desktop),
  `allDay` boolean toggle, attendee multi-picker replaced the persona
  audience.
- **Audit-log enrichment** — the existing audit log captures
  `{ action, entity, entityId, metadata? }` per server action and
  renders raw rows in `AuditLogPanel.tsx`. There's a lot of missing
  context that would make it much more useful for "who changed what
  when". Asks (29 Apr 2026):
  - **Before/after diffs on update actions** — currently a "guest
    update" row tells you *that* something changed but not what.
    Capture the changed-fields snapshot in `metadata` so the panel
    can render "rsvp: PENDING → ATTENDING".
  - **Human-readable entity references** — entityId is a cuid which
    is unhelpful in the panel. Resolve to the entity's display name
    (e.g. guest name, task title, supplier name) at write time and
    cache on the row, OR resolve at read time via a per-entity-type
    join. Latter is cleaner.
  - **IP + user-agent capture** for sign-in / impersonation actions
    so a security review can spot anomalous activity.
  - **Filter UX** beyond the existing date cursor: by user, by entity
    type, by action verb. Sticky-search pattern works (mirror v1.21.0).
  - **Group related changes** — a CSV import currently emits dozens
    of separate "guest create" rows. Roll them into a single
    "imported 47 guests via CSV" entry with an expandable child list.
  - **Retention policy** — currently rows accumulate forever. Decide
    on 12 / 24 month retention, optional purge action, export-before-
    purge for compliance.

  Substantial enough to warrant a design pass; estimated ~5–8 hrs
  depending on which sub-asks ship together. *Asked by user, 29 Apr 2026.*
### "View as another role" preview (deferred)

*Asked by user 29 Apr 2026; deferred from v1.27.x on 29 Apr 2026
after sizing during the implementation window suggested the original
~2 hr estimate was optimistic. This block carries the design context
forward so the next planning pass starts where this one stops.*

**Goal.** Admin impersonation, read-only. Lets the couple (or a
planner) preview the app *as if* they were another user, to verify
per-section visibility + role gates without signing out. Doesn't
actually grant new powers — the underlying user must already have
view-everything rights to toggle previews.

**Sketched implementation:**

- Header dropdown ("Viewing as: Couple ▾") in `AppShell.tsx`'s top
  area or the avatar menu. Lists every entry from `AUTH_ALLOWED_EMAILS`
  alongside the current user's actual identity.
- Selection writes a non-persistent cookie (`viewAsUserId`, session-
  scoped, `httpOnly` so it can't be tampered with from JS).
- Server components read the cookie via `requireUser()` (extended)
  and return an *effective* user shape — same `id` + `email` so
  audit-log entries still attribute to the actual signer-in, but
  with `isCouple` + `role` swapped to the impersonated user's
  values. The override is preview-only: write actions ignore it
  and write under the actual user as today.
- Audit log writes a `view-as` entry on every flip (entity = User,
  entityId = impersonated id, metadata = `{ from, to }`).
- A persistent banner bar at the very top of the page (red-tinted,
  high-contrast) reading "Previewing as Bryony · Switch back" so
  the impersonator never forgets they're not in their own session.

**Risk + scope notes (why deferred):**

- **Threads through every permission gate.** `canEdit` and `canView`
  in `src/lib/permissions.ts` are called on essentially every page.
  Each call needs to honour the override consistently. Missing one
  page means the preview leaks "real" content for an impersonated
  role — silent data leak.
- **Write-action interaction.** Decision needed: do write actions
  fail noisily (toast: "you can't edit while previewing") or silently
  fall back to the actual user's permissions? Either is defensible;
  needs a one-line policy in the design pass.
- **Settings + AvatarMenu interaction.** The Sidebar avatar shows
  the actual user. The "view as" banner shows the previewed user.
  Both need to coexist without confusion.
- **Realistic scope.** Instrumenting every permission-gate call site
  + writing the cookie middleware + UI for the dropdown + banner +
  audit + tests is closer to ~4 hrs than ~2.

**Recommendation when revisited:** start with a single-pass survey
of every `canEdit`/`canView` call in the repo, decide on a single
shared override-aware helper to replace them all, then build the
UI. Don't ship piecemeal.
- **Group-based user permissions** — replace the per-user role enum
  (COUPLE / WEDDING_PARTY / PLANNER / VIEWER) with a more flexible
  group model where the planner can define groups (e.g. "Aimee's
  team", "Ushers", "Couple") and assign per-page permissions to each
  group. Likely shape: new `PermissionGroup` model with
  `{ name, description, permissions Json }` (Json maps page slug →
  `view` / `edit` / `none`), plus `User.permissionGroupId String?`
  that overrides the role-derived defaults when set. Falls back to
  the existing role gates when null so the migration is non-breaking.
  Includes a Settings UI for the couple to manage groups + assign
  users. ~3 hrs once design is signed off.
  *Asked by user, 29 Apr 2026.*
- ~~**Investigate mobile navbar redirect-to-Today**~~ — root cause was
  a stale service worker from a prior deployment at the same domain.
  v1.25.2 mounts a `ServiceWorkerCleanup` component at root that
  unregisters every SW on first paint; v1.25.0 swapped Link → plain
  anchor as a defensive fallback. v1.25.4 plans the graceful Link
  revert now that the SW is cleared.
- ~~**Guest detail side panel on seating canvas**~~ — shipped v1.27.7
  per the design captured here on 29 Apr 2026.
- **Seating constraint rules** — must-sit-together / must-not-sit /
  prefer-group hints, plus violation indicators on the canvas. The
  prototype had a richer rules panel; we shipped the canvas without it
  for v0.6.0.
- **CSV import: update / dedupe modes** — v0.8.0 always creates new
  rows. A future iteration could add "match by email and update
  existing" + "skip duplicates" modes alongside the current "create".
- **Rate-limit on `/api/auth/*`** — Caddyfile stub waiting on a custom
  Caddy build with `xcaddy --with github.com/mholt/caddy-ratelimit`.
  Auth.js token expiry + email allow-list is the current mitigation.
- ~~**Day-of mode**~~ — shipped in v0.15.0.
- ~~**Quick-capture (`C` shortcut) modal**~~ — shipped in v0.15.0
  (Task / Question / Event types; Payment intentionally excluded).
- ~~**Say I Do sync**~~ — covered by the v0.8.0 CSV import path. Just
  export to CSV from Say I Do and paste it into `/guests/import`.
- ~~**Spotify playlist sync**~~ — shipped in v0.14.0 as Phase G1
  (Client Credentials, public-playlist read-only mirror).
- ~~**Glance / At-a-glance dashboard**~~ — shipped in v1.1.0.
- ~~**Custom fields UI in Settings**~~ — shipped for Guest in v1.15.0
  (R5b, C10). Supplier + Task in the planner-only shortlist above.

## Open questions / risks

- **Add the rest of the wedding party to `AUTH_ALLOWED_EMAILS`** — currently only Jamie can sign in. Bryony / Josh / Aimee / planner addresses still need to be collected and added (Compose Manager Plus → Edit Stack → .ENV tab → save → **Up**).
- **Backup verification** — the `backup` container is configured but no run has been observed yet (first scheduled at next `@daily`). Worth checking `/mnt/user/appdata/wedding-hub/backups/` after 24h to confirm it works.
- **Off-site backup** — backups land on the Unraid box. A full Unraid failure would lose them. rclone / restic / parity sync to a second array is still TBD.
- **Sender domain decision** — currently sending from `noreply@spencer-net.com` (apex, DKIM aligns there). If a wedding-themed sender like `noreply@wedding.spencer-net.com` is preferred, add a separate DKIM record on the subdomain in Cloudflare DNS.
- **Cloudflare Access policy alignment** — if a CF Access policy is in front of the hostname, its email allowlist must match `AUTH_ALLOWED_EMAILS`, otherwise users get bounced at Cloudflare's gate before they see the magic-link page.

### Resolved during the 27 April 2026 deploy

- ~~First container start on Unraid not yet verified~~ — done; production stack is up.
- ~~SMTP provider~~ — Resend, configured with API key and DKIM via Cloudflare integration.
- ~~Cloudflared stack must be configured~~ — done; tunnel route → `192.168.50.25:80`.
- ~~Bind-mount permissions~~ — pre-created at `/mnt/user/appdata/wedding-hub/backups` with UID 1000.

## Conventions

- **Server actions** live in `actions.ts` next to the page they serve, gated by `requireEdit("section")`, mutating via Prisma, then `revalidatePath` for the relevant routes.
- **Audit log** every server action that mutates user-visible state. Sign-in already audits.
- **Audit-aware feature design (v1.30.5, refined v1.32.0).** After each feature request, scan for audit / activity-list opportunities. When adding an audit row, enrich its `metadata` with the relevant snapshot fields (titles, key IDs, counts, changed-field names) so the row reads usefully without re-joining the originating entity. **The "what" must be human-readable** — the AuditLogPanel renders rows via `formatAuditAction` ([src/lib/audit-format.ts](src/lib/audit-format.ts)), which either auto-formats from `action + entity + metadata` for known patterns or uses an explicit `metadata.summary` string. Either pattern-match a new action code in the formatter, or supply `metadata.summary` directly. Never ship a new audit call that produces "verb-noun book subsection" in the log viewer.
- **Permission section keys** must match the union in [src/lib/permissions.ts](src/lib/permissions.ts) (`SECTIONS` const).
- **Couple-only routes** are gated in two places — middleware (defence-in-depth) and the page itself (`if (!user.isCouple) redirect("/")`).
- **Forms** use plain `<form action={serverAction}>` with a small client wrapper for `useTransition`-driven pending state. No client-side form libraries in Phase A–C.
- **Branching:** day-to-day work commits to `dev`. When a chunk is ready to release, fast-forward `claude/main` to dev's HEAD, bump `package.json`, update the ROADMAP changelog, and tag `vX.Y.Z` on `claude/main`. Tags are immutable — never re-tag.

## Versioning

Even though this is a private app for one wedding, a small amount of versioning discipline pays for itself when something goes sideways and we need to know *what was deployed last Tuesday*.

### Scheme — light SemVer

`MAJOR.MINOR.PATCH`, single source of truth in [package.json](package.json):

| Bump | When | Examples |
|------|------|----------|
| **PATCH** (`0.3.0` → `0.3.1`) | Bug fix, copy tweak, dep bump that doesn't change behaviour. No schema change. No env change. | Fix a broken Edit button. Bump Next.js patch. Adjust a sidebar label. |
| **MINOR** (`0.3.0` → `0.4.0`) | New feature or finished phase. May add a Prisma migration but it must be **additive** (new table / new nullable column / new optional relation). May add new env vars *with sensible defaults*. | Phase D (file uploads). Add a "completed at" column to Task. Add the day-of mode. |
| **MAJOR** (`0.x.y` → `1.0.0`) | Schema migration that requires data backfill or manual ops, drops or renames columns, breaks the API/UI in a way that needs the user to re-learn something, or adds a required env var without a default. | Rename `Task.tags` to `Task.categories`. Require a new `STORAGE_PROVIDER` env. Move from JWT to database sessions. |
| **Special: `1.0.0`** | Reserved for the moment we're confident the app is good for the wedding day itself. Can land before 26 Sep 2026 — most likely a few weeks before, after the rehearsal data is real. | — |

**Pre-1.0 caveat:** while we're below `1.0.0`, treat MINOR bumps as potentially breaking *if* I'm rushed and need to land something quickly. Document anything that would normally be a MAJOR in the changelog under a **⚠ Breaking** subheading.

### Git tags

Every release tag matches `package.json` exactly:

```bash
# After committing the version bump and updating ROADMAP.md changelog:
git tag -a v0.4.0 -m "Phase D — file uploads"
git push origin v0.4.0
```

Tags are immutable. If you need to re-cut, bump the patch (`v0.4.0` → `v0.4.1`) — never re-tag.

### Docker images

The web image is tagged twice on a release:

```bash
docker build -t wedding-hub-web:0.4.0 -t wedding-hub-web:latest .
```

Compose pins to `:latest` for normal deploys, but you can pin to `:0.4.0` in a temporary override if a newer image is suspect:

```bash
WEB_IMAGE_TAG=0.3.0 docker compose up -d  # (if you parameterise the compose file later)
```

Old images are kept by `docker image ls` until pruned — don't aggressively `docker image prune -a` if you might want to roll back.

### Prisma migrations are part of the version contract

- **Never edit a migration that has been deployed.** Always create a new one (`npx prisma migrate dev --name something`) — even if the change feels small.
- A migration filename's timestamp should monotonically increase across machines — Prisma handles this, just don't reorder the directory.
- The `_prisma_migrations` table on the production DB is the truth about what's applied. `migrate deploy` is idempotent and fast on a no-op.
- If a migration goes wrong in prod, `prisma migrate resolve` is the escape hatch, but **take a backup first** (`docker compose exec backup /backup.sh`).

### Release checklist

When wrapping up a meaningful iteration:

1. **Verify clean** — `npm run typecheck` and `npm run lint` pass; relevant `next build` succeeds.
2. **Bump `package.json` `version`** per the table above. Patches don't always need a release, but completed phases / features do.
3. **Update `ROADMAP.md`:**
   - Move items from *Deferred / Backlog* to *What's shipped* if they landed.
   - Add a new *Changelog* entry at the top of the section, dated, headed with the new version (e.g. `### 2026-05-15 · v0.4.0 — File uploads`).
   - Mention any new migrations and any env-var changes.
4. **Commit** with a Conventional Commits style message: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`. Bigger features that span multiple commits land on a feature branch and get a single squash-merge to `claude/main` so the changelog stays clean.
5. **Tag** the release — `git tag -a vX.Y.Z -m "..."` then `git push --tags`.
6. **Build + push the image** if deploying — tag with both the version and `latest`.
7. **Deploy** — `docker compose pull && docker compose up -d` on the host (or `docker compose up -d --build` if building locally on the host). Watch `docker compose logs -f web` until the migrate-deploy line passes and Next reports ready.

### Current version

`1.9.0` on both `dev` and `claude/main` (promoted 28 Apr 2026 after GHA green; production-confirmed working). The Spotify keys are now flowing into the running container via `compose.environment:` and the new Book sections are seeded.

## Changelog

Most recent entry on top. Add a new entry at the end of every meaningful iteration.

### 2026-04-30 · v1.38.4 — Wedding Book seed overhaul

User-flagged after v1.38.3: "Some sections seem like they haven't been reviewed in a while, I want to update the defaults to be a robust example".

The Book seeders had been added phase-by-phase across the v1.31 → v1.38 arc and never revisited. Many sections shipped as **shells** — empty FIELD cards (no defs), empty SETUP cards (no items), empty LEGAL cards (no items), short pre-WYSIWYG TEXT bodies. Two whole sections (Photography & Videography, Guest Experience) had no seeder at all.

Goal: every one of the 12 card kinds (TEXT, FIELD, RECIPE, SHOT_LIST, OUTFIT, BUILD, MENU, BAR, SETUP, LEGAL, STAY, LODGING_GUIDE) shows up as a fully-populated example out of the box. New users opening `/book/<section>` see what each card kind can carry — not blank placeholders.

**Per-section changes:**

- **Wedding Party — People**: 6 OUTFIT cards previously seeded with only `personName` + `role` now ship with realistic fitting / alterations / pickup dates around 26 Sep 2026, item composition rows (dress + shoes + jewellery + bouquet for Bryony; suit + shirt + tie + cufflinks + buttonhole for Jamie; etc.), per-card costs in pence, paid status, supplier names matching existing Suppliers (Slaters, Paintbox Blooms, Mirror Mirror Bridal). 6 cards × ~4-6 items = ~24 items total.
- **Wedding Party — Day-of**: TEXT bodies converted to HTML with `<h2>`, `<ul>`, `<strong>`, `<blockquote>`. "Stag & Hen recap" got a real template instead of `…`. "Wedding-day cars" FIELD card gained 6 field defs (vehicle, driver, phone, pickup time, etc.) grouped under Vehicles / Schedule / Contingency.
- **Venue — Spaces**: 5 SETUP cards previously empty now ship with **30 setup items** total (Ceremony room: 6 items including aisle runner, arch, posies, registrar's pen; Reception room: 7 items including centerpieces, place cards, table numbers; etc.). Source field matches existing supplier names so the `/suppliers/[id]` "Used in setup" cross-module surface lights up immediately.
- **Venue — Décor**: 2 FIELD cards (Printed signage, Photo booth) gained ~10 field defs each grouped by Order / Design / Day-of / Status. TEXT cards (Florist brief, Décor inspiration) now use HTML headings + bullet lists.
- **Food & Drink**: existing Wedding breakfast MENU + Drinks/bar BAR retained. **New seeders** for Kids menu (1 course × 2 options, isKidsMeal=true), Evening buffet (1 course × 3 options), Late-night snack (1 course × 2 options), Cake (FIELD card with 10 fields covering vendor / design / order / day-of / status), and a **Signature cocktail RECIPE** (Bryony & Jamie's Spritz with structured BookRecipeStep rows, servingsBase=8, day-before pre-batch step). RECIPE was the last card kind without an example seeded — now covered.
- **Photography & Videography** *(new seeder)*: 5 subsections — Photographer brief (FIELD with 12 fields), Engagement shoot (FIELD), Shot list (SHOT_LIST with **24 shots** grouped by Pre-ceremony / Ceremony / Couple portraits / Family formals / Reception, each with estimatedMinutes + linked withWhom names), Album spec (FIELD), Gallery delivery (FIELD).
- **Guest Experience** *(new seeder)*: 5 subsections — Welcome bags (BUILD with 5 materials), Favours (BUILD with 3 materials), Order of service (FIELD with 8 fields), Welcome drinks reception (TEXT WYSIWYG), Thank-you cards plan (TEXT WYSIWYG).
- **Legal — Before**: Notice of Marriage card now has 4 LEGAL items (give-notice for each party + book + pay), Required documents has 6 items (passport + address + decree absolute per person), Witnesses FIELD has 7 fields, Insurance FIELD has 8 fields. Legal due-by-date set to 28 Aug 2026 (≥ 29 days before the wedding).
- **Legal — Day**: Pre-ceremony interview FIELD has 7 fields. Vows reference + Registration steps converted to HTML with the actual legal vows, numbered procedure list, blockquote tips.
- **Legal — After**: Marriage cert pickup has 4 items, **Name change checklist has 12 items** (passport, DVLA, HMRC, banks, pension, employer, GP/dentist, insurance, will, credit-reference agencies, loyalty cards, social media — in priority order), Certified copies tracker has 5 items.
- **Accommodation**: 4 STAY cards now ship with check-in (25 Sep 15:00) / check-out (27 Sep 11:00) dates, costs in pence, booking-reference placeholders, occupant lists. LODGING_GUIDE retained with its 3 Stratford hotels.
- **Post-wedding**: Thank-you tracking FIELD has 10 fields covering design / progress / status. Photo / video delivery FIELD has 12 fields including backup-downloaded toggle. Vendor reviews + Marriage cert filing converted to TEXT WYSIWYG with bulleted vendor lists + downstream filing checklist.

**Cleanup**: legacy `wedding-party` seeder kept (it pre-dates the v1.35.0 split and matches the existing legacy-section policy), but the new sections lead the order. Operator scripts (`seed-samples-only.ts`, `reset-book.ts`) updated to call the two new seeders. `Prisma` namespace added to seed.ts imports for the RECIPE `InputJsonValue` cast.

**Numbers:**
- ~12 sections, ~50 subsections seeded by default (was ~32)
- 30 SETUP items (was 0)
- 26 LEGAL items (was 0)
- 24 SHOT_LIST shots (was 0)
- 8 BUILD material lists with 30+ materials total (was 3 with 3 materials)
- Every FIELD card has defs (was 0 of 6)
- 1 RECIPE example (was 0)

**Verification gate:** typecheck + lint + 363 unit tests + production build all green.

Files: [prisma/seed.ts](prisma/seed.ts) · [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.3 — Operator scripts in the production image

User-flagged after v1.38.2 promotion: `docker exec wedding-hub-web-1 npx tsx scripts/reset-book.ts` failed with `ENOENT: no such file or directory, mkdir '/home/node/.npm'` — the production image runs as the `node` user (no write access to `/home/node/.npm`), `tsx` is a devDependency that's pruned in the runtime image, and the `scripts/` directory was never bundled into the image anyway.

Two fixes:

1. **Scripts use a local `PrismaClient`** instead of importing `db` from `src/lib/db`. The runtime image holds a Next standalone bundle, not the raw `src/` tree, so the `../src/lib/db` import wouldn't resolve at runtime. Mirroring `prisma/seed.ts`'s shape (which already constructs its own client) keeps both scripts self-contained.

2. **Dockerfile transpiles + bundles the operator scripts.** The existing `npx tsc prisma/seed.ts` pattern is extended to a second `tsc` invocation that takes `prisma/seed.ts scripts/seed-samples-only.ts scripts/reset-book.ts` together, with `--rootDir .` so the relative tree is preserved. Output lands in `/app/scripts-build/`. The runner stage `COPY`s `scripts-build/` wholesale so the `require("../prisma/seed")` inside the operator scripts resolves to the co-located `scripts-build/prisma/seed.js`.

After this image rebuilds, the production invocation becomes:

```bash
# Non-destructive:
docker exec wedding-hub-web-1 \
  node scripts-build/scripts/seed-samples-only.js

# Destructive (env flag mandatory):
docker exec -e CONFIRM_RESET_BOOK=yes wedding-hub-web-1 \
  node scripts-build/scripts/reset-book.js
```

No more npm registry calls at runtime, no `tsx` requirement, no `/home/node/.npm` permission issues.

Files: [Dockerfile](Dockerfile) · [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.2 — Book module reset script

User request after the v1.38.1 ship: a script that **resets the Book section** end-to-end. Use case: the v1.38.0 promotion brought twelve sections of new structure, and the couple may want to throw out whatever's currently there and start from a clean seed-default state rather than fix it in place.

`scripts/reset-book.ts` — gated on `CONFIRM_RESET_BOOK=yes` env var (no `--yes` flag, no interactive prompt — explicit env required so accidental shell-history re-runs don't fire it). Prints a count summary of what's about to be deleted, then runs `db.bookSection.deleteMany({})` (cascades pull every Book row down with it), recreates the 12 BookSection rows at correct order, and re-runs the eight section-level seeders that v1.38.1 exported.

What it deletes: every Book row — sections, subsections, every per-kind card (FIELD / RECIPE / SHOT_LIST / OUTFIT / BUILD / MENU / BAR / SETUP / LEGAL / STAY / LODGING_GUIDE) and their child rows.

What it leaves alone: **users, permissions, sessions, tasks, guests, households, seating, song requests, schedule events, suppliers, contracts, payments, budget categories, budget lines, files, audit logs.** The Task ↔ BookSection m2m link rows go away (re-link via the Tasks page after); BudgetLine.buildCards back-references go to zero until new BUILD cards re-link via "Copy materials total to Budget".

Always preceded by a backup recommendation in the script's preamble:

```bash
docker compose exec db pg_dump -U postgres wedding_hub \
  > wedding-hub-pre-book-reset.sql
```

Then to actually run:

```bash
docker compose exec -e CONFIRM_RESET_BOOK=yes web \
  npx tsx scripts/reset-book.ts
```

Files: [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.1 — Samples-only prod backfill script

User-flagged after the v1.38.0 promotion: "I want the samples but don't want to change any other db data such as seating allocations, tasks, guests".

The full `npm run db:seed` is intentionally aggressive — it runs `seedSampleTasks` (4 placeholder tasks), `seedScheduleEvents` (8 day-of placeholders), and `seedUsersAndPermissions` (refreshes user metadata from env). On a populated production those would add noise / churn user records. The Book section seeders are already idempotent (per-section skip-if-content-exists), but they were buried inside `seed.ts`'s `main()` — couldn't be invoked piecemeal.

Fix: refactor `prisma/seed.ts` to **export** the eight section-level seeders (`seedWeddingPartySubsections`, `seedBuildCards`, `seedFoodDrinkCards`, `seedVenueSpacesAndDecor`, `seedLegalSections`, `seedWeddingPartyPeopleAndDayof`, `seedAccommodationCards`, `seedPostWeddingSection`). New script `scripts/seed-samples-only.ts` imports them and runs all eight in sequence + ensures the 12 BookSection rows exist with correct ordering.

Each seeder remains per-section skip-if-content-exists, so populated sections (anything the couple has authored) are no-ops. Empty sections receive their sample subpages (e.g. Post-wedding gets its four placeholders, Wedding Party — People gets six OUTFIT cards for the known wedding-party members).

What the script **does NOT touch**: users, tasks, schedule events, guests, households, seating, songs, payments, suppliers, files. Only Book sections and their child subsection rows.

Run on production after `docker compose pull && up -d`:

```bash
docker compose exec web npx tsx scripts/seed-samples-only.ts
```

Idempotent — safe to re-run.

Files: [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [prisma/seed.ts](prisma/seed.ts) (eight `async function` → `export async function`).

### 2026-04-30 · v1.38.0 — Wedding Book arc closes (P7b/B + P8)

**Final phase of the [Book Expansion arc](BOOK-EXPANSION-PLAN.md).** Combines P7b/Part B (FIELD / RECIPE / SHOT_LIST upgrades) with P8 (Post-wedding section seed + production backfill script). The Book is now feature-complete against the original plan: 12 sections (8 active + 4 deprecated), 12 card kinds (TEXT, FIELD, RECIPE, SHOT_LIST, OUTFIT, BUILD, MENU, BAR, SETUP, LEGAL, STAY, LODGING_GUIDE), TEXT cards with WYSIWYG (v1.37.0–v1.37.2), and read-time cross-module wiring on every page that asks for the data (v1.37.5).

**SHOT_LIST upgrades** — biggest user-facing addition. New `category` and `estimatedMinutes` columns on `BookShot`. Editor now offers a category text input + minutes input alongside the existing fields, and the rendered card groups shots by category with a per-group capture counter and time-budget rollup. Card header shows total estimated minutes when at least one shot has an estimate. **Plus the user's specific ask**: shots gain a `guestIds: String[]` forward link to `Guest.id`, with a multi-select picker in the form. The legacy free-text `withWhom` field stays for non-guest names (vendors, partner-of-cousin). Forward-only relation per the v1.30.5 cross-module-reference rule — reverse query lives at render time on the Guest detail panel.

**Guest detail "Photos to capture"** — new section on `/guests/[id]` listing every shot whose `guestIds` includes this guest. Captured shots show with strike-through; remaining count surfaces in the section header. Each row deep-links to the parent SHOT_LIST card.

**FIELD upgrades** — `BookFieldDef` gains `group`, `helpText`, `required`, `min`, `max`, `dateMin`, `dateMax`. The editor renders fields grouped by `group` (collapsible-style sections); helpText shows on hover via the `ⓘ` icon; required fields show a red asterisk; the "Add field" form has a "More options" toggle exposing the new metadata. Validation enforced server-side in `parseBookFieldValue`: required values throw on empty input, numeric ranges enforce min/max, date ranges enforce dateMin/dateMax in `yyyy-mm-dd`.

**RECIPE upgrades** — `BookRecipe` gains `servingsBase` and a new structured `BookRecipeStep` table (id, instruction, durationMinutes, dayBefore, order). Migration backfills existing `steps` Json arrays into the new table via a SQL `DO` block (idempotent — skips recipes that already have BookRecipeStep rows). Legacy `steps` Json column kept one release as a recoverability buffer. Editor rewritten with View / Edit toggle: header shows servings + active-time + day-before time as stat tiles; view-mode adds a `×1 / ×2 / ×3` scaling toggle; structured edit rows let the couple set per-step duration + tag prep that should happen the day before. Day-before steps render with a marigold pill in view mode.

**Post-wedding section** — new `post-wedding` BookSection seeded at order 12. Four subsections per [§8.12](BOOK-EXPANSION-PLAN.md): Thank-you tracking (FIELD), Vendor reviews to write (TEXT), Photo / video delivery (FIELD), Marriage cert filing (TEXT pointer to legal-after).

**Production backfill** — `scripts/backfill-v1.38.ts` ensures the new sections exist on production with the right ordering. Idempotent: re-runs are no-ops on already-migrated DBs. Doesn't touch couple-edited content. Run once after `prisma migrate deploy` finishes. The seeders in `prisma/seed.ts` are also idempotent — running the seed on a populated prod skips every section that already has subsections.

**Schema migration `20260430100000_book_p7b_part_b_card_upgrades`:**
- FIELD: 7 new nullable / defaulted columns
- SHOT_LIST: 3 new columns (category, estimatedMinutes, guestIds)
- RECIPE: 1 new column (servingsBase) + new BookRecipeStep table + idempotent SQL backfill
- Post-wedding BookSection insert with `ON CONFLICT DO NOTHING`

**21 new unit tests** covering shotListRollups, recipeRollups, findShotsForGuest, and the FIELD validator's required / min / max / dateMin / dateMax enforcement.

**Verification gate:** typecheck + lint + 363 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430100000_book_p7b_part_b_card_upgrades/migration.sql](prisma/migrations/20260430100000_book_p7b_part_b_card_upgrades/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [src/lib/guest-cross-refs.ts](src/lib/guest-cross-refs.ts) · [tests/unit/v1.38-helpers.test.ts](tests/unit/v1.38-helpers.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/app/(app)/book/[slug]/BookFieldsCard.tsx](src/app/(app)/book/[slug]/BookFieldsCard.tsx) · [src/app/(app)/book/[slug]/BookRecipeCard.tsx](src/app/(app)/book/[slug]/BookRecipeCard.tsx) · [src/app/(app)/book/[slug]/BookShotListCard.tsx](src/app/(app)/book/[slug]/BookShotListCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [src/app/(app)/guests/[id]/page.tsx](src/app/(app)/guests/[id]/page.tsx) · [prisma/seed.ts](prisma/seed.ts) · [scripts/backfill-v1.38.ts](scripts/backfill-v1.38.ts).

### 2026-04-30 · v1.37.5 — Cross-module wiring (P7b / Part C)

Second half of [P7](BOOK-EXPANSION-PLAN.md). The Wedding Book stops being a silo: every Book card kind that holds a date / cost / supplier / guest now has a read-time projection on the **page that asks for it**. No new schema; everything is read-time queries against the data already produced by P1–P6. Part B (FIELD / RECIPE / SHOT_LIST card upgrades — including the RECIPE Json→rows migration) splits out to v1.37.6 so this ship stays focused on wiring.

**Two pure-decision modules** with full unit-test coverage:

- [`src/lib/today-widgets.ts`](src/lib/today-widgets.ts) — `nextLegalDeadlines(cards, now, daysAhead)` (folds card `dueByDate` + per-item `expiresAt`, includes overdue items, skips fully-obtained cards), `nextOutfitMilestones(cards, now, daysAhead)` (one row per (card, milestone) within the future window), `oldestOpenDecisions(tasks, limit)` (filter `type=DECISION` + non-closed status, sort dated-soonest-then-oldest-created).
- [`src/lib/guest-cross-refs.ts`](src/lib/guest-cross-refs.ts) — `findStaysForGuest(guestId, stays)` (reverse query for STAY cards listing this guest), `findMealChoiceLinks(guest, options)` (case-insensitive label match, prefers same-course when ambiguous, returns `null` when no match so panel still shows free-text choice).

**26 new unit tests** covering window inclusion / exclusion, sort stability, case + whitespace normalisation, ambiguous-course resolution, and empty-input edge cases.

**Today page** ([src/app/(app)/page.tsx](src/app/(app)/page.tsx) + new [TodayCrossModuleStrip.tsx](src/app/(app)/TodayCrossModuleStrip.tsx)): three new widgets in a 3-column grid below the existing tasks/events row. Auto-hides when all three are empty (quiet day = no blank row). Each row deep-links to the underlying Book card via `/book/<section>#<subsection>` anchors. Day pills colour-code days-remaining: red for overdue, marigold for today / ≤7 days, muted for further out.

**Guest detail page** ([src/app/(app)/guests/[id]/page.tsx](src/app/(app)/guests/[id]/page.tsx)): "Meal choices" rows now render an `on menu →` link beside each guest's free-text choice when it matches a current `BookMenuOption`. New "Accommodation" section appears when one or more STAY cards list the guest in `guestIds` — shows property name + check-in→out date range, links back to the Book.

**Budget page** ([src/app/(app)/budget/BudgetDiyLinks.tsx](src/app/(app)/budget/BudgetDiyLinks.tsx)): "Linked from DIY" panel above the categories shows every BUILD card that has a `budgetLineId` (set by P1's "Copy materials total to Budget" action). Per-row deep-link back to the source DIY card; total at the top so the couple can see the rolled-up DIY spend at a glance. Hidden when no links exist.

**Supplier detail page** ([src/app/(app)/suppliers/[id]/page.tsx](src/app/(app)/suppliers/[id]/page.tsx)): "Used in setup" section appears when any `BookSetupItem.source` matches the supplier's name (case-insensitive). Shows item + space + quantity + packed/placed pills. Hidden when none match. String match (no FK), matching the v1.30.5 cross-module-reference rule.

**Verification gate:** typecheck + lint + 342 unit tests + production build all green on the same SHA.

### 2026-04-30 · v1.37.2 — TEXT card list / blockquote rendering fix

User-flagged on v1.37.1 review: "Some items are not working as expected like bullet points". Root cause: this project's Tailwind v4 setup doesn't include `@tailwindcss/typography`, so the `prose prose-sm` classes I'd added to the editor and `RichTextRead` were no-ops — and Tailwind Preflight resets `<ul>`, `<ol>` to `list-style: none` with zero indent, so bullet markers and numbers disappeared. Same for `<blockquote>`'s left border and `<h2>`/`<h3>` spacing.

Fix: drop the `prose` classes and pin every needed style with explicit Tailwind utility selectors (`[&_ul]:list-disc`, `[&_ol]:list-decimal`, `[&_blockquote]:border-l-2`, etc.). Build one `RICH_TEXT_PROSE_CLASS` constant; share it between the live editor and `RichTextRead` so what-you-see-is-what-you-get across the View / Edit toggle. Covers every tag the sanitiser allow-list permits: paragraph spacing, H2 / H3, bulleted + numbered lists with nested-list margin handling, blockquote, strong / em / u, anchors.

Files: [src/components/ui/RichTextEditor.tsx](src/components/ui/RichTextEditor.tsx).

### 2026-04-30 · v1.37.1 — TEXT card View / Edit toggle

User-flagged on v1.37.0 review: "the save function doesnt hide the editor, you can still edit and update the text". The Tiptap editor was rendered whenever `canEdit` was true — same shape as the pre-v1.37.0 textarea — so the toolbar stayed visible after save. Other v1.31+ card kinds (BUILD / OUTFIT / BAR / MENU / SETUP / LEGAL / STAY / LODGING_GUIDE) all use an explicit View / Edit toggle from v1.31.1 onwards; TEXT was the last hold-out because the textarea didn't visibly mind being always-editable. The richer toolbar makes the inconsistency obvious.

Fix: retrofit the View / Edit toggle onto SubsectionEditor. Default state is read-only — title is `<h3>`, body is `<RichTextRead>`. Clicking **Edit** swaps in `<Input>` + `<RichTextEditor>`. **Cancel** reverts the draft. **Save changes** commits and exits edit mode. Visibility / Delete buttons hide while editing so the action bar stays uncluttered.

`Save changes` is now disabled (rather than hidden) when there are no pending edits — matches the other card editors so the button position doesn't jump.

Files: [src/app/(app)/book/[slug]/SubsectionEditor.tsx](src/app/(app)/book/[slug]/SubsectionEditor.tsx).

### 2026-04-30 · v1.37.0 — Wedding Book TEXT WYSIWYG (P7a)

First half of [P7](BOOK-EXPANSION-PLAN.md). The TEXT card's plain `<textarea>` is replaced with a real WYSIWYG editor authored via Tiptap, with a deliberately small 10-mark toolbar. P7's Parts B (FIELD/RECIPE/SHOT_LIST upgrades) and C (cross-module wiring) are split out to a follow-up ship (v1.37.5) so this release stays focused on the riskiest piece: the migration from plain text to sanitised HTML.

**Toolbar (compile-time constant — cannot be expanded by users):** Bold · Italic · Underline · H2 · H3 · Bullet list · Numbered list · Blockquote · Link · Undo · Redo. Mobile (< 640px) collapses to Bold / Italic / Bullet / Link / "more" sheet revealing the rest. The toolbar set is the schema — there is no path from here to slash menus or block embeds.

**Sanitiser (`src/lib/sanitize-book-html.ts`):** allow-list of the 12 tags above plus `<a>` (with `href`, `rel`, `target`) and `<br>`. Anchors are **always** rewritten to `rel="noopener noreferrer" target="_blank"` regardless of what the author types — no path for a hand-edited link to open in-tab. `class`, `id`, `style`, inline event handlers, `javascript:` and `data:` schemes all stripped. Run on **write** (server-action `updateBookSubsection` enforces) AND on **read** (`RichTextRead` re-sanitises before `dangerouslySetInnerHTML`) as belt-and-braces — defends against any row that slipped through historic versions or a direct DB edit.

**Schema:** `BookSubsection.bodyHtml String?` added (nullable). Legacy `body` column kept one release as a recoverability buffer per the v1.30.5 standing pattern. The TEXT editor stops writing to `body` from this release on; reads prefer `bodyHtml` and fall back to `legacyBodyToHtml(body)` when bodyHtml is null.

**Migration `20260430090000_book_text_html`:** adds the column + idempotent SQL backfill. For every TEXT subsection with non-null body and null bodyHtml, escapes `&`, `<`, `>`, replaces `\n\n` with `</p><p>`, remaining `\n` with `<br>`, and wraps in `<p>…</p>`. Re-runs on rows that already have bodyHtml are a no-op. The same transform lives in TS as `legacyBodyToHtml()` so read-time fallback renders identically.

**Editor (`src/components/ui/RichTextEditor.tsx`):** Tiptap-react + StarterKit + Underline + Link extensions. Heading restricted to H2/H3, `codeBlock`/`code`/`horizontalRule` disabled. Output is HTML; the `onChange` callback gets the editor's `getHTML()` on every keystroke. Read-mode `RichTextRead` component for non-editing contexts. Native `prompt()` for the link-URL dialog — keeps the editor footprint tight and consistent with every other picker on the app.

**Tests (19 new):** `tests/unit/sanitize-book-html.test.ts` covers every allowed/disallowed tag, attribute strip (class/id/style/event handlers), scheme strip (javascript:/data:), forced rel+target overriding author values, empty-href anchor demotion, paragraph + line-break preservation, and the legacy backfill round-trip.

**Bundle impact:** `/book/[slug]` First Load went from 135 kB → 356 kB. Tiptap's prose-mirror dep tree is the bulk of the increase. Acceptable on a private, admin-only tool; flagged as a follow-up if the editor ever shows up on a more public surface.

**Verification gate:** typecheck + lint + 316 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430090000_book_text_html/migration.sql](prisma/migrations/20260430090000_book_text_html/migration.sql) · [src/lib/sanitize-book-html.ts](src/lib/sanitize-book-html.ts) · [tests/unit/sanitize-book-html.test.ts](tests/unit/sanitize-book-html.test.ts) · [src/components/ui/RichTextEditor.tsx](src/components/ui/RichTextEditor.tsx) · [src/app/(app)/book/[slug]/SubsectionEditor.tsx](src/app/(app)/book/[slug]/SubsectionEditor.tsx) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [package.json](package.json) (+ Tiptap pins).

### 2026-04-30 · v1.36.0 — Wedding Book STAY + LODGING_GUIDE cards (P6)

Sixth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two new card kinds rebuild the Accommodation section: **STAY** for bookings the couple makes and pays for (one card per booking), and **LODGING_GUIDE** for the recommended-hotels reference card guests can be pointed at.

**STAY card** — one card per booking. Header strip shows the property + a phase pill (upcoming / current / past), plus a stats grid for check-in date with days-remaining, check-out date, cost, and paid status. Booking ref + nights count surface in a one-line strip below. Body has property contact, free-text occupants list (chips), an inline picker for **linked guests** that ties this booking to existing `Guest.id`s, and notes. The `guestIds` array is a forward link only — no relation defined on the schema, matching the v1.30.5 cross-module-reference convention. The reverse query ("which stay is this guest at?") lights up in P7's guest detail panel.

**LODGING_GUIDE card** — single card with rows for recommended hotels around the venue. Each row carries name + distance + price band (`£` / `££` / `£££`) + phone + website + group-rate code + notes. Built read-mostly — no `obtained` / `paid` flags. Header summarises N hotels with a per-price-band breakdown (`3 × £, 4 × ££, 1 × £££`) so the at-a-glance read works without scrolling.

**Schema:** `STAY` and `LODGING_GUIDE` added to `BookSubsectionKind`. Three new tables — `BookStayCard` (1:1 with subsection, `guestIds: String[]`, `occupants: String[]`), `BookLodgingCard` (1:1) + `BookLodgingItem` (rows). Migration `20260430080000_book_stay_lodging_cards`, additive only — no data migration needed because Accommodation didn't have any structured cards yet.

**Pure helpers:** `stayRollups({ checkInDate, checkOutDate, costPence, paid }, now)` → `{ nights, daysToCheckIn, phase }`. `lodgingRollups({ items })` → `{ itemCount, perPriceBand }`. 11 unit tests covering boundaries (same-day = 0 nights, current/upcoming/past phase pivots on now vs check-in/out, null/empty price labels bucket together).

**Server actions:** `saveStayCard` (single bulk save — one row, no item reconcile) + `saveLodgingCard` (single bulk save with item reconcile). Both audit-enriched per the v1.30.5 standing rule with `changedFields` diff for STAY's nine card-level fields and `itemsAdded` / `Updated` / `Removed` counts for LODGING. New `stay-save` + `lodging-save` patterns in [audit-format.ts](src/lib/audit-format.ts).

**Editors** built against §10a's edit-row layout rule from day one — two-row grids for STAY's header (Property+BookingRef; CheckIn+CheckOut; Cost+PaidBy+Paid), and three-row grids per hotel for LODGING_GUIDE (Name+PriceBand; Distance+Phone; Website+GroupRate). View modes mirror edit. STAY's linked-guest picker reuses the toggle-chip pattern from the seating canvas — clicking adds/removes by `Guest.id`.

**Seed:** Accommodation seeded per [BOOK-EXPANSION-PLAN.md §8.11](BOOK-EXPANSION-PLAN.md) with four STAY cards (Bridal Suite, Bryony night-before, bridesmaids night-before, groomsmen night-before) and one LODGING_GUIDE with three placeholder hotels around Stratford-upon-Avon (Crowne Plaza, Mercure Shakespeare, Premier Inn Central). Idempotent — skipped when the section already has subsections.

**Verification gate:** typecheck + lint + 297 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430080000_book_stay_lodging_cards/migration.sql](prisma/migrations/20260430080000_book_stay_lodging_cards/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [tests/unit/stay-lodging-rollups.test.ts](tests/unit/stay-lodging-rollups.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [src/app/(app)/book/[slug]/BookStayCard.tsx](src/app/(app)/book/[slug]/BookStayCard.tsx) · [src/app/(app)/book/[slug]/BookLodgingCard.tsx](src/app/(app)/book/[slug]/BookLodgingCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.35.1 — Migration fix (pgcrypto)

CI flagged v1.35.0's data migration as failing on the integration-test Postgres image: `function gen_random_bytes(integer) does not exist`. Stock Postgres 16 ships pgcrypto but does **not** pre-load it — the CI test image is bare. Production never ran the broken migration (it died at the migrate-deploy step before reaching anything destructive), so this is a cleanup ship.

Fix: prepend `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to migration `20260430070000_book_outfit_rework`. Idempotent — `IF NOT EXISTS` is a no-op on environments that already have the extension. Re-running the failed CI job picks up the patched migration and replays cleanly.

Files: [prisma/migrations/20260430070000_book_outfit_rework/migration.sql](prisma/migrations/20260430070000_book_outfit_rework/migration.sql).

### 2026-04-30 · v1.35.0 — Wedding Book OUTFIT rework (P5) + Wedding Party split

Fifth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). The OUTFIT card moves from a single card-per-section listing N people, to **one card per person** with their own fitting timeline, cost, paid status, items list, and photos. The Wedding Party section splits into two: `wedding-party-people` (the OUTFIT cards) and `wedding-party-dayof` (timeline / ring keepers / day-of TEXT + FIELD subsections).

**OUTFIT card** — header is the person's name + role chip. Stats strip shows the next milestone with days-remaining (fitting → alterations → pickup), cost, paid-by + paid status, and items collected/total. Fitting-timeline strip highlights whichever step is next. Items list breaks the outfit into pieces (dress / shoes / tie etc.) with their own status pill (`Designed` / `Ordered` / `Fitted` / `Collected`). Photos via `fileIds[]` with attach/detach picker reusing the existing `File` model.

**Schema:** card-level fields move **onto** `BookOutfitCard` — `personName`, `role`, `fittingDate`, `alterationsDueBy`, `pickupDate`, `costPence`, `paidBy`, `paid`, `fileIds`, `notes`. The legacy `BookOutfit` row table is **repurposed** into per-item composition for that one person — gains `itemLabel`, `description`; the legacy `personName` / `role` columns are now nullable and stay populated for one release as a recoverability buffer (matches the v1.30.5 `body` / `bodyHtml` pattern). Migration `20260430070000_book_outfit_rework` includes a data-migration `DO` block that walks every existing card: 0 children skipped, 1 child copies onto parent in place, 2+ children split out into per-person cards under a freshly-inserted `wedding-party-people` section. Idempotent on re-run.

**Pure helper:** `outfitRollups({ fittingDate, alterationsDueBy, pickupDate, items }, now)` → `{ itemCount, collectedCount, percentCollected, nextMilestone, daysToNext }`. Picks the soonest-future milestone, falls back to the most-recent past one when all three are behind, treats today as future (>= now). 8 unit tests covering each branch.

**Server actions:** `saveOutfitCard` (single bulk save with full reconcile — payload covers card-level fields + items list, transactional) + `attachFileToOutfitCard` / `detachFileFromOutfitCard` (per-card photo ops). All audit-enriched per the v1.30.5 standing rule. New `outfit-save`, `outfit-file-attach`, `outfit-file-detach` patterns in [audit-format.ts](src/lib/audit-format.ts) so the audit log reads in human sentences.

**Editor** built against §10a's edit-row layout rule from day one — two-row grids for header (Name+Role; Fitting+Alterations+Pickup; Cost+PaidBy+Paid), and per-item rows (Item+Status; Description+Supplier; reorder/remove). View mirrors edit. Photos picker lives on view mode so a single attach doesn't re-save the whole card.

**Section split (additive):** two new BookSection rows — `wedding-party-people` at order 1, `wedding-party-dayof` at order 2. Legacy `wedding-party` slug stays at the bottom of the order with any couple-edited subsections still intact (the /book index hides empty legacy sections). Seed wires `wedding-party-people` with one OUTFIT card per known wedding-party member (Bryony, Jamie, Aimee, Joshua, Clara, Torin) and `wedding-party-dayof` with the §8.2 layouts (Morning prep timeline · Ring keepers · Pre-ceremony hand-offs · Wedding-day cars · Stag & Hen recap).

**Verification gate:** typecheck + lint + 286 unit tests + production build all green on the same SHA. The data migration sits behind an idempotent gate, so production prod-promote is a fast-forward + Prisma migrate + image rebuild — the migration runs cleanly even if existing prod cards already match the new shape.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430070000_book_outfit_rework/migration.sql](prisma/migrations/20260430070000_book_outfit_rework/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [tests/unit/outfit-rollups.test.ts](tests/unit/outfit-rollups.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [src/app/(app)/book/[slug]/BookOutfitCard.tsx](src/app/(app)/book/[slug]/BookOutfitCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.34.0 — Wedding Book LEGAL card (P4) + Legal split

Fourth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). New `LEGAL` card kind for document checklists with deadlines + optional file attachments, and the `legal-admin` section splits into three timeline-aligned new sections (additive — legacy stays).

**LEGAL card** — one card per coherent deadline group (Notice of Marriage, Required documents, Marriage certificate pickup, Name change checklist, etc.). Header has regulator + contact + due date with days-remaining countdown. Items table has obtained checkbox + obtainedAt date + expiresAt date + optional file picker (reuses the existing `File` model — same 25 MB cap + signed-download flow as suppliers / contracts get for free).

**Two banners** when state warrants them:

- **⚠ Card deadline passed** — when `dueByDate` is in the past AND not every item is obtained.
- **⚠ N items expire before the wedding** — when any item's `expiresAt` is before the wedding date (catches lapsing passports, expiring Notices of Marriage, etc.).

**Schema:** `LEGAL` added to `BookSubsectionKind`. Two new tables — `BookLegalCard` (1:1 with subsection) + `BookLegalItem` (line items, with optional `fileId` FK to `File` with `onDelete: SetNull`). `File.bookLegalItems` back-relation. Migration `20260430060000_book_legal_card`, additive only.

**Pure helper:** `legalRollups({ dueByDate, items }, weddingDate, now)` → `{ itemCount, obtainedCount, percentObtained, daysToDue, isOverdue, expiringBeforeWedding }`. 7 unit tests including overdue + expiry boundaries.

**Server actions:** `saveLegalCard` (single bulk save) + `attachFileToLegalItem` / `detachFileFromLegalItem` (per-row file ops, kept separate so a single PDF attach doesn't re-save the whole card). All audit-enriched per the v1.30.5 standing rule. New `legal-save`, `legal-file-attach`, `legal-file-detach` patterns in [audit-format.ts](src/lib/audit-format.ts).

**Editor** built against §10a's edit-row layout rule from day one — two-row grids for header + per-item, per-cell labels above every input, file picker on a third compact slot, obtained checkbox + reorder/remove on the bottom row.

**Section split — additive.** Three new BookSection rows seeded:

- `legal-before` (order 9) — Notice of Marriage (LEGAL), Required documents (LEGAL), Witnesses (FIELD), Insurance (FIELD).
- `legal-day` (order 10) — Pre-ceremony interview (FIELD), Vows reference (TEXT), Registration steps (TEXT).
- `legal-after` (order 11) — Marriage certificate pickup (LEGAL), Name change checklist (LEGAL), Certified copies (LEGAL).

Legacy `legal-admin` stays at order 8 with whatever subsections live under it. The `/book` index hides empty legacy sections, so once the couple finishes moving content across `legal-admin` quietly drops off the hub. Existing sections (Accommodation, ceremony / reception / logistics legacy) shift down three slots; the seed's upsert with `update: { order }` re-numbers them on re-run.

**Shared helpers (per §10a).** `FieldLabel` + `Label` primitives lifted from BUILD/BAR/SETUP into `src/app/(app)/book/[slug]/bookCardUi.tsx` (renamed from `.ts` since it now exports JSX). BUILD / BAR / SETUP refactored to import from there; LEGAL imports from there too on first build.

**Files:**
- `prisma/schema.prisma` — `LEGAL` enum value, two new tables, `BookSubsection.legalCard` + `File.bookLegalItems` back-relation.
- New: `prisma/migrations/20260430060000_book_legal_card/migration.sql`.
- `prisma/seed.ts` — three new BookSection rows + `seedLegalSections()` (idempotent, per-section gates).
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; `legalRollups()` helper.
- `src/lib/audit-format.ts` — three new patterns.
- `src/app/(app)/book/actions.ts` — `saveLegalCard` + `attachFileToLegalItem` + `detachFileFromLegalItem` + `createBookSubsection` LEGAL branch.
- New: `src/app/(app)/book/[slug]/BookLegalCard.tsx`.
- Renamed: `src/app/(app)/book/[slug]/bookCardUi.ts` → `bookCardUi.tsx` (gained `FieldLabel` + `Label`).
- `BookBuildCard.tsx`, `BookBarCard.tsx`, `BookSetupCard.tsx` — import the shared primitives, drop local copies.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — LEGAL case + extended `Sub` type.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `legalCard.items.file`, fetch wedding date + Files when any LEGAL card present.
- New: `tests/unit/legal-rollups.test.ts` — 7 cases.

Plus a separate **roadmap addition** (per user, while reviewing v1.33.x): "Tasks linkable to individual cards (inline)" added to the `New asks captured 30 Apr 2026` block. Three implementation candidates listed; lean is m2m `Task ↔ BookSubsection` alongside the existing m2m `Task ↔ BookSection`. ~3 hrs once decided.

**Verification:** typecheck + lint clean, 278 unit tests pass (+7 LEGAL rollups), clean `.next` build green.

**Future-card idea logged**: "Dance card" — pairs of dance moments with participants + optional Song FK. Captured in [BOOK-EXPANSION-PLAN.md §13](BOOK-EXPANSION-PLAN.md) (Future card ideas) for post-v1.38.0 consideration.

**Next:** v1.35.0 P5 — OUTFIT rework (one card per person) + Wedding Party split. The largest phase in the arc; data migration on the existing OUTFIT cards.

### 2026-04-30 · v1.33.2 — Edit-row layout rule pinned into the card-creation plan

Docs-only follow-up to v1.33.1. The lessons from cramming six fields into a 12-column row (BAR card, v1.32.2) and the two-row redesign that fixed it (v1.33.1) get pinned into [BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md) as a **temporary standing constraint (§10a)** so P4 (LEGAL), P5 (OUTFIT rework), P6 (STAY + LODGING_GUIDE) ship with proper widths from day one rather than needing UX patches afterwards.

The rule covers six bullets:

1. Two-row grid maximum per editable line.
2. Per-cell labels above every input — `FieldLabel` + `Label` primitives in the per-card files, lifted to a shared module when P4 needs them.
3. Minimum column widths by field type (Name ≥4, £ ≥3, Qty ≥2, etc.).
4. Toggles / flag checkboxes / reorder + remove on a third compact row.
5. View mode mirrors the edit-mode proportions.
6. Helper hints stay on top-of-card fields, not per-line inputs.

Marked **temporary** — re-evaluate after v1.38.0 (last phase of the Book expansion arc): promote to permanent if it's still serving the codebase, or relax if it gets in the way of a card kind we haven't anticipated.

**Files:** `BOOK-EXPANSION-PLAN.md` (new §10a), `package.json` bump, this changelog entry.

**Verification:** typecheck + lint + 271 tests + clean `.next` build all green. No code changed.

**Next:** v1.34.0 P4 — LEGAL card + Legal split, ships against §10a from the start.

### 2026-04-30 · v1.33.1 — Edit-row layout pass

User-reported while reviewing v1.32.2: drinks fields squashed in the BAR card edit row. Six fields packed into a single 12-column grid (category 3, name 3, timing 2, qty 1, unit 1, £ 2) was uncomfortably tight on the ~660 px card width.

**Fix applied to all three multi-field card editors:**

- **BAR ItemEditRow** — 6-field row split into **two grids of 3+4 fields each**. Row 1: Name (6/12) · Category (3/12) · When (3/12). Row 2: Drinks/head or Qty (2/12) · Unit (2/12) · Supplier (4/12) · £ Total or £/head (4/12). Supplier comes back into the main grid (was tucked next to the pricing toggle in v1.32.2). Pricing toggle + reorder/remove stay on the third compact row.

- **SETUP ItemEditRow** — split into two rows. Row 1: Item (6/12) · Qty (2/12) · Location (4/12). Row 2: Source/supplier (6/12) · Pack-down plan (6/12). Packed/placed flags + reorder/remove on the third row.

- **BUILD MaterialEditRow** — split into two rows. Row 1: Material (8/12) · Qty (2/12) · Unit (2/12). Row 2: Supplier (8/12) · £ Total cost (4/12). Ordered/arrived flags + reorder/remove on the third row.

- **MENU OptionEditRow** unchanged — already used a 2-col `label / dietary` grid plus a full-width description row, with comfortable widths.

**Per-cell labels.** Each field now has a small uppercase label above it (`Name`, `Category`, `When`, etc.). Even at narrow widths the row is recognisable at a glance — matches the v1.31.1 BUILD-header pattern with helper hints.

**Common helpers.** Added `FieldLabel` (grid-cell wrapper) + `Label` (label text) primitives in each of the three card files. They're tiny — a copy in each file is fine; promoting to a shared component is overkill until a fourth card needs the same shape (P4 LEGAL likely will, then we'll move them).

**Files:** `BookBarCard.tsx`, `BookSetupCard.tsx`, `BookBuildCard.tsx` — only the edit-row sections. View-mode display + server actions + audit metadata all unchanged.

**Verification:** typecheck + lint clean, 271 unit tests pass, clean `.next` build green. No schema or migration changes — pure client-side layout.

**Next:** v1.34.0 P4 — LEGAL card + Legal section split (the LEGAL card editor will use the same FieldLabel/Label shape from day one, and we'll lift the helpers out into a shared file then).

### 2026-04-30 · v1.33.0 — Wedding Book SETUP card (P3) + Venue split

Third phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two changes that fit naturally together: a new `SETUP` card kind for per-space spatial walkthroughs, and a section split that gives `SETUP` cards (and the v1.31.0 `BUILD` cards) cleaner homes.

**SETUP card** — one card per physical space (Ceremony room / Drinks reception / Reception room / Evening setup / Pack-down). Header has space, setup-start time, owner. Items table with name + quantity + location ("Top of aisle", "Round-table centre"…) + source (autocompletes from Supplier names — read-time string match, no FK) + packed/placed checkbox columns + pack-down plan column. Header progress stat shows `% packed · % placed`.

**Schema:** `SETUP` added to `BookSubsectionKind`. Two new tables — `BookSetupCard` (1:1 with subsection) + `BookSetupItem` (line items). Migration `20260430050000_book_setup_card`, additive only.

**Pure helper:** `setupRollups({ items })` in [src/lib/book-cards.ts](src/lib/book-cards.ts) returns `{ itemCount, packedCount, placedCount, percentPacked, percentPlaced }`. Integer-rounded percentages, 0% on empty cards (no NaN). 5 unit tests cover boundary + empty + 100% cases.

**Server action:** `saveSetupCard(subsectionId, payload)` — the same single-bulk-save pattern as BUILD / MENU / BAR. Audit-enriched per the v1.30.5 standing rule with `{ space, itemsAdded, itemsUpdated, itemsRemoved, headerChanged }`. New `setup-save` pattern in [src/lib/audit-format.ts](src/lib/audit-format.ts) so the audit log reads as "Saved setup card 'Ceremony room' — added 4 items".

**Editor** — `BookSetupCard.tsx`. Same View / Edit toggle as BUILD / MENU / BAR. Per-item row has packed + placed checkboxes (always on the secondary line so the primary grid stays clean). `source` field has a `<datalist>` populated from existing Supplier names. View mode renders an items table with ●/○ for the two flags.

**Section split — additive.** Two new BookSection rows seeded:

- `venue-spaces` (order 3) — five SETUP cards: Ceremony room, Drinks reception, Reception room, Evening setup, Pack-down (all with sample owner + setup time, empty items list).
- `venue-decor` (order 4) — non-BUILD seed: Printed signage (FIELD), Florist brief (TEXT), Photo booth (FIELD), Décor inspiration (TEXT). The v1.31.0 BUILD cards (Centerpieces / Handmade signage / Place cards) **stay where the v1.31.0 seeder put them** under the legacy `venue` section — moving them automatically risks overwriting user edits, so we leave them. Couples can move them via the UI when convenient.

The legacy `venue` section stays at order 2 with whatever subsections live under it. The `/book` index already filters out empty legacy sections, so once a couple finishes moving cards across, `venue` quietly drops off the hub. Existing sections shift down two slots; the seed's upsert with `update: { order }` re-numbers them on re-run.

**Files:**
- `prisma/schema.prisma` — `SETUP` enum value, two new tables, `BookSubsection.setupCard` back-relation.
- New: `prisma/migrations/20260430050000_book_setup_card/migration.sql`.
- `prisma/seed.ts` — `venue-spaces` + `venue-decor` BookSection rows + `seedVenueSpacesAndDecor()` function (idempotent — skip when subsections > 0).
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; `setupRollups()` helper.
- `src/lib/audit-format.ts` — `setup-save` pattern.
- `src/app/(app)/book/actions.ts` — `saveSetupCard` + new `createBookSubsection` SETUP branch.
- New: `src/app/(app)/book/[slug]/BookSetupCard.tsx`.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — SETUP case + extended `Sub` type with `setupCard` shape (incl. `supplierNames` autocomplete list).
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `setupCard.items`, fetch supplier names when any SETUP card present.
- New: `tests/unit/setup-rollups.test.ts` — 5 cases.

**Verification:** typecheck + lint clean, 271 unit tests pass (+5 SETUP rollups), clean `.next` build green.

**Next:** v1.34.0 P4 — LEGAL card + Legal section split (before / day / after).

### 2026-04-30 · v1.32.2 — BAR per-head pricing + timing

User-asked while reviewing v1.32.0/.1 in the wild: drinks have a per-head amount that varies by time of day — e.g. £2.50/head for the toast drink, separate from bottle-priced lines for dinner wine.

Two additions to `BookBarItem`, both nullable / additive:

- **`pricePerHeadPence`** — when set, the line is costed per cover; `quantityPlanned` becomes "drinks per head"; line total = `pricePerHeadPence × confirmedAdults × (quantityPlanned ?? 1)`. `costPence` is ignored in this mode (the editor nulls it out when toggling to per-head).
- **`timing`** — free-text serving moment (Reception / Toast / Dinner / Evening / Late night by default, datalist-style). Used to group items in the view when any are set.

**Editor:**
- New "Pricing" toggle on each item row: **Total** / **Per head**. Toggling switches the £ input between fixed-cost and per-head input. Suffix `/hd` appears on the per-head input. Quantity column relabels to "drinks/head" when per-head is active.
- New `When` column on each row with a datalist of preset timings.
- Supplier moves to the row's secondary line (next to the pricing toggle) to keep the primary 12-column grid clean.

**View mode:**
- If any item has a timing label, items group **by timing** (Reception → Toast → Dinner → Evening → Late night → other), with a per-group cost subtotal.
- If no timings are set, falls back to the v1.32.0 category grouping.
- Per-head items render as `Toast drink · £2.50/head × 1 drinks · £250.00 (line)` with a `need RSVP count` hint when `confirmedAdults` is null.

**Pure helpers + tests:**
- New `barItemTotalPence(item, confirmedAdults)` exported from [src/lib/book-cards.ts](src/lib/book-cards.ts) — single source of truth for line totals (per-head vs fixed). Reused by both the BAR editor view and `barRollups`.
- Per-head items are explicitly excluded from the bottles-per-adult sanity check (still bottles-only).
- 7 new test cases covering per-head computations: drinks-per-head defaulting, costPence ignored when per-head set, mixed bottles + per-head totals, sanity check stability.

**Schema migration:** `prisma/migrations/20260430040000_book_bar_item_per_head/migration.sql` — adds two nullable columns. Existing items render unchanged.

**Seed update:** the sample BAR card now includes a sixth item — "Toast — Prosecco" at £2.50/head, timing "Toast" — so a fresh seed demonstrates both pricing modes side by side. Existing items gain timing labels (Reception / Dinner / Evening) so the timing-grouped view exercises immediately.

**Files:**
- `prisma/schema.prisma` — `BookBarItem.pricePerHeadPence` + `timing`.
- New: `prisma/migrations/20260430040000_book_bar_item_per_head/migration.sql`.
- `prisma/seed.ts` — per-head toast item + timing labels.
- `src/lib/book-cards.ts` — `barItemTotalPence()` helper, `barRollups` updated to use it.
- `src/app/(app)/book/[slug]/BookBarCard.tsx` — `Item` shape extended; `ViewBody` timing-grouped branch; `ItemEditRow` pricing toggle + per-head £ input + timing field + datalist.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — `BookBarCard.items[]` shape extended.
- `src/app/(app)/book/actions.ts` — `barItemPayloadSchema` extended; `saveBarCard` writes the new fields.
- `tests/unit/menu-bar-rollups.test.ts` — 7 new per-head cases.

**Verification:** typecheck + lint clean, 266 unit tests pass (+7 for per-head), clean `.next` build green.

### 2026-04-30 · v1.32.1 — Audit log retention + search

User-asked while reviewing v1.32.0 in the wild. Two operational
quality-of-life additions to the audit log:

**30-day retention.** Audit rows older than 30 days are pruned by a
lazy sweep inside `logAudit()` ([src/lib/audit.ts](src/lib/audit.ts)).
Runs at most once per hour per process — process-local timestamp
gate (`SWEEP_COOLDOWN_MS`). Fire-and-forget after each successful
audit write; errors are logged but never propagate. No new cron
infra required, which suits the admin-only / low-volume profile of
this app. Multi-instance deploys each track their own cooldown,
which is fine — the DELETE is idempotent and indexed.

New `@@index([createdAt])` on `AuditLog` to make the range-DELETE
cheap. The pre-existing `(userId, createdAt)` composite index isn't
useful for a plain "createdAt < cutoff" query without a userId
predicate. Migration `20260430030000_audit_log_createdat_index`,
additive only.

**Search box on `/settings` audit viewer.** New `audit_q` search
param. When set:

- Database filter: case-insensitive substring match against
  `action`, `entity`, and `user.{name,email}`.
- Post-filter in JS: also matches against the `formatAuditAction`
  output (the human "what" sentence) so a search for a card title
  embedded in metadata (like "Centerpieces") finds the row even
  though `cardTitle` lives in the JSON metadata bag.
- Fetch limit raised to 200 candidates while searching; `Older →`
  cursor pagination is hidden when a search is active. A footer
  hint appears at the cap suggesting the user refine the term.
- Plain GET form — no client JS — so the browser's normal
  form-submission flow handles the navigation. "Clear" link exits
  search mode by stripping the `audit_q` param.

**Files:**
- `prisma/schema.prisma` — `@@index([createdAt])` on AuditLog.
- New: `prisma/migrations/20260430030000_audit_log_createdat_index/migration.sql`.
- `src/lib/audit.ts` — retention sweep + cooldown.
- `src/app/(app)/settings/AuditLogPanel.tsx` — search input + filter logic + result-count copy + capped-result hint.
- `src/app/(app)/settings/page.tsx` — `audit_q` searchParam threaded through.

**Verification:** typecheck + lint clean, 259 unit tests pass, clean `.next` build green.

**Next:** v1.33.0 P3 — SETUP card + Venue → Spaces / Décor split.

### 2026-04-30 · v1.32.0 — Wedding Book MENU + BAR cards (P2)

Second phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two new card kinds, plus three out-of-band corrections that landed alongside.

**MENU card** — food service composition. One card per service (wedding breakfast / kids / evening / late-night). Per-course list of options with allergen tags + vegetarian-main / kids-meal flags. Live counts of guest selections per option, computed server-side at render time by case-insensitive label matching against `Guest.mealStarter / mealMain / mealDessert` (no FK to legacy `MealOption` — that table was unwired, free-text from CSV import is the honest source). Allergen aggregation surfaces dietary tags only against guests who matched ≥1 option. Header shows service type, confirmed headcount, per-head price, total cost.

**BAR card** — drinks plan. One card with items grouped by free-text `category` (Reception drink / Wine / Beer / Soft / Spirits…). Per-head sanity check: flags **low** (< 0.5 bottles/adult), **high** (> 1.5), **ok** (in range), **unknown** (no bottle items or no confirmed adult count) — matched on unit `bottle/bottles/btl`. Header shows bar type, tab limit / corkage, total cost, bottles-per-adult.

**Schema:** `MENU` and `BAR` added to `BookSubsectionKind`. Five new tables — `BookMenuCard` + `BookMenuCourse` + `BookMenuOption`, `BookBarCard` + `BookBarItem`. Migration `20260430020000_book_menu_bar_cards`, additive only.

**Pure helpers** in [src/lib/book-cards.ts](src/lib/book-cards.ts):
- `menuRollups(card, guests)` → `{ totalConfirmed, pricePence, perCourseCounts, allergenAggregate }`. 8 unit tests covering label-match + dietary-aggregation + course/field skipping.
- `barRollups(card, confirmedAdults)` → `{ totalCostPence, perCategory, perHeadFlag, bottlesPerAdult }`. 8 unit tests covering boundary at 0.5 / 1.5, unknown branches, multi-category totals.

**Server actions** — `saveMenuCard` + `saveBarCard`. Both follow the v1.31.1 single-bulk-save pattern: payload of full card state; transactional reconcile (rows with `id` starting `new-` create; existing update; missing delete; positions become `order`). All audit-enriched.

**Editors** — `BookMenuCard.tsx` + `BookBarCard.tsx`. Both follow the v1.31.1 View / Edit toggle: pretty read-only display + single Edit / Save / Cancel flow. £ pounds-and-pence inputs (shared via [bookCardUi.ts](src/app/(app)/book/[slug]/bookCardUi.ts)). Helper hints under every header field.

**Seed:** `seedFoodDrinkCards()` adds two cards under `food-drink`:
- "Wedding breakfast" — MENU, 3 courses × 2 options (with realistic dietary tags), £85/head, plated.
- "Drinks & bar" — BAR, 5 sample items across Reception drink / Wine / Beer / Soft, £2,000 tab limit, Prosecco toast.

Both idempotent — re-seed never overwrites real cards.

**Out-of-band corrections shipped this release:**

1. **BUILD card label renamed "Build" → "DIY"** in user-facing strings (kindBadge on the card and the picker label in `BOOK_CARD_KIND_META`). Schema names (`BookSubsectionKind.BUILD`, `BookBuildCard`) unchanged — internal naming.

2. **Audit log viewer now renders human sentences.** New helper [src/lib/audit-format.ts](src/lib/audit-format.ts) `formatAuditAction({ action, entity, metadata })` turns terse codes into readable phrases:
   - "Saved DIY card 'Centerpieces' — added 2 materials, marked prototype done"
   - "Saved menu 'Wedding breakfast' — added 1 option"
   - "Created task 'Confirm final guest count'"
   - "Updated nav tag 'Music'"
   - 30+ pattern matches across BUILD / MENU / BAR / Task / ScheduleEvent / NavTag / BookSubsection / BookSection plus generic CRUD verbs. `metadata.summary` if explicitly supplied takes precedence. `AuditLogPanel` updated to call the helper.

3. **Standing rule refined.** ROADMAP "Audit-aware feature design" now requires the "what" to be human-readable — either pattern-match a new action code in the formatter or supply `metadata.summary` directly. User memory note updated accordingly.

**Files:**
- `prisma/schema.prisma` — MENU + BAR enum values, 5 new tables, BookSubsection back-relations.
- `prisma/seed.ts` — `seedFoodDrinkCards()` + main() call.
- New: `prisma/migrations/20260430020000_book_menu_bar_cards/migration.sql`.
- New: `src/app/(app)/book/[slug]/BookMenuCard.tsx`, `BookBarCard.tsx`.
- New: `src/app/(app)/book/[slug]/bookCardUi.ts` — shared £-input + new-row-id helpers.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — MENU + BAR cases.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load menuCard + barCard, server-side rollups, guest meal fetch.
- `src/app/(app)/book/actions.ts` — `saveMenuCard` + `saveBarCard` + new createBookSubsection branches.
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; rollup helpers.
- New: `src/lib/audit-format.ts`.
- `src/app/(app)/settings/AuditLogPanel.tsx` — uses `formatAuditAction`.
- New: `tests/unit/menu-bar-rollups.test.ts` — 16 cases.
- ROADMAP standing rules block.

**Verification:** typecheck + lint clean, 259 unit tests pass (16 new for MENU/BAR), clean `.next` build green.

**Open question handled inline:** §12 cake — RECIPE vs FIELD. Defaulted as RECIPE in seed if confirmed DIY; couple can toggle the seed kind via UI when they decide on a baker. No migration needed for that swap.

**Next:** v1.33.0 P3 — SETUP card + Venue → Spaces / Décor split.

### 2026-04-30 · v1.31.1 — BUILD card UX pass

User feedback round on v1.31.0. Six items, all addressed:

1. **Confusing Qty / Unit labels** — clearer copy. "Qty" is now the row count (small numeric input); "Unit" has a "ea, m, stems" placeholder. Helper hint under each header field explains what it's for ("How many you're making in total" etc.).
2. **Pounds-and-pence cost input** — replaced the raw pence number input with a £ symbol + decimal text input. Stored as integer pence under the hood; display + entry both in £x.xx.
3. **Live link to Budget line** — new `BookBuildCard.budgetLineId` FK to `BudgetLine` (additive migration, `onDelete: SetNull`). The "Copy materials total to Budget" action now stores the FK on the card and on subsequent clicks **updates the existing line in place** instead of creating a duplicate. View mode shows a moss-green pill: "Linked to Budget · £X.XX [view →] [×]". The × unlinks the card from the line (line stays on `/budget`; couple can delete it there if they want).
4. **Status disappearing on save bug** — root cause was the v1.31.0 header form using `<form action>` with `defaultValue` on the `<select>`, which doesn't update after re-render of an uncontrolled input. Refactored the entire BUILD card to controlled React state with a single Edit / Save / Cancel flow.
5. **Single Edit / Save / Cancel flow** — the user feedback on UX. Card now has two distinct modes:
   - **View mode** — pretty read-only display. Stat strip + status pill + budget pill + materials table (read-only) + notes. Single "Edit" button bottom-right plus "Copy total to Budget" / "Update Budget line" left side.
   - **Edit mode** — every header field becomes editable, materials gain inline edit + reorder + delete + add-row affordances, all field hints visible. Single "Save changes" + "Cancel" buttons bottom-right.
   - Sessions sit *outside* the edit toggle — they're append-only quick log actions. "+ Log session" + per-row trash icon are always available when the user can edit.
6. **`/diy` overview page** — new top-level page (added to nav under People group) listing every BUILD card across the Wedding Book. Each row shows status pill + section + target date + units done/needed + hours + materials total + ordered/arrived percentages. Done cards go to the bottom; everything else sorts by target date (sooner first). Top-line totals strip: project count, units done, hours logged, total materials spend. Click any row to deep-link into the source section anchored at that card.

**Schema:** `BookBuildCard.budgetLineId String?` (nullable FK to `BudgetLine`, `onDelete: SetNull`, indexed). `BudgetLine.buildCards` back-relation. Migration `20260430010000_book_build_budget_link`, additive only.

**Server actions:**
- `copyBuildMaterialsToBudget` rewritten — first call creates the line and stores its FK; later calls update in place.
- New `unlinkBuildBudgetLine` — clears the FK, leaves the line.
- New `saveBuildCard(subsectionId, payload)` — single bulk save replacing the per-row create/update/delete actions for everything except sessions. Server reconciles materials in a transaction: rows with `id` starting `new-` → create; existing ids → update; existing ids missing from payload → delete; positions in the array become the `order` field. Audit logs a single update with `{ headerChanged, materialsAdded, materialsRemoved, materialsUpdated }`.
- Per-row material actions kept as exports for any future inline-edit surface; not used by the editor any more.

**Visual polish:**
- Status options rendered as coloured tone pills: Designing (neutral), Prototyping (blue), Producing (marigold), Done (moss).
- Stat strip cards use bigger fonts, more breathing room, distinct background.
- Materials table read-mode shows ●/○ for ordered/arrived flags instead of checkbox stubs.
- Edit-mode material rows have a single grid layout (12-column) with checkboxes on a separate sub-row.
- Budget pill has a green tone matching the ordering/arrived ●.

**Files:**
- `prisma/schema.prisma` — `BookBuildCard.budgetLineId` + relation + index, `BudgetLine.buildCards` back-relation.
- New: `prisma/migrations/20260430010000_book_build_budget_link/migration.sql`.
- `src/app/(app)/book/actions.ts` — rewrote `copyBuildMaterialsToBudget`, added `unlinkBuildBudgetLine` + `saveBuildCard`.
- `src/app/(app)/book/[slug]/BookBuildCard.tsx` — full rewrite with View/Edit modes, controlled state, £-input, helper hints, budget pill.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — extended `Sub.buildCard` shape with `budgetLineId` + `budgetLine` snapshot.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `buildCard.budgetLine`; coerce Decimal `estimated` to plain number before crossing the client boundary.
- New: `src/app/(app)/diy/page.tsx` — overview page.
- `src/components/shell/nav-config.ts` — `/diy` entry under the People group.

**Verification:** typecheck + lint + 243 unit tests + clean `.next` build green; new `/diy` route built (109 kB shared + 181 B page).

**Next:** v1.32.0 P2 — MENU + BAR cards.

### 2026-04-30 · v1.31.0 — Wedding Book BUILD card (P1)

First phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md) — a new `BUILD` card kind that tracks DIY production projects (centerpieces, place cards, handmade signage, favours, programs) end-to-end inside a single Wedding Book card. **One card per project.**

**Schema:** `BUILD` added to `BookSubsectionKind`. Three new tables — `BookBuildCard` (1:1 with `BookSubsection`), `BookBuildMaterial` (line items per card), `BookBuildSession` (production sessions logged per card). Migration `20260430000000_book_build_card`, additive only.

**Card features:**

- **Header strip** — units done / quantity, hours logged / estimated, status pill, target date with days-remaining countdown.
- **Status options:** Designing → Prototyping → Producing → Done.
- **Materials table** with `ordered` + `arrived` checkbox columns, in-place edit/reorder/remove, supplier + cost.
- **Sessions log** — date, minutes, units completed, optional notes; "+ Log session" prefills today.
- **Prototype-blocker banner** — fires when target is within 30 days and prototype not yet ticked.
- **One-click "Copy materials total to Budget"** — creates a draft `BudgetLine` in a "DIY production" category (find-or-create) with the rolled-up cost. Manual review on `/budget`. No auto-sync per the v1.30.5 cross-module-wiring rule.

**Pure helper.** `buildRollups()` in [src/lib/book-cards.ts](src/lib/book-cards.ts) computes everything the header strip + the prototype-blocker need. Unit-tested with 11 cases including the 30-day boundary, null inputs, and past target dates.

**Audit enrichment** per the v1.30.5 standing rule — every BUILD action logs snapshot fields:
- `build-update` → `{ title, status, quantityNeeded, targetDate, changedFields }`.
- `build-material-{create,update,delete,flag,reorder}` → `{ cardTitle, materialName, … }`.
- `build-session-{create,update,delete}` → `{ cardTitle, minutes, unitsCompleted, sessionDate }`.
- `build-copy-to-budget` → `{ cardTitle, materialCount, totalPence, budgetLineId }`.

**Files:**
- New: `prisma/migrations/20260430000000_book_build_card/migration.sql`.
- `prisma/schema.prisma` — `BUILD` enum value, three new tables, `BookSubsection.buildCard`.
- `prisma/seed.ts` — `seedBuildCards()` adds three sample BUILD cards under `venue` (Centerpieces with 3 materials, Handmade signage, Place cards). Idempotent.
- `src/lib/book-cards.ts` — `buildRollups()` + types + meta entry.
- `src/app/(app)/book/actions.ts` — 11 new BUILD server actions, all gated + audited + result-shape.
- New: `src/app/(app)/book/[slug]/BookBuildCard.tsx` — editor with header form, Materials, Sessions, Copy-to-Budget.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — `case "BUILD"` branch + extended `Sub` type.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `buildCard` with `materials` + `sessions`.
- New: `tests/unit/build-rollups.test.ts` — 11 test cases.

**Verification:** typecheck + lint + 243 unit tests pass (up from 232 with 11 new BUILD-rollup tests), clean `.next` build green.

**Open questions before P1 ships** (from the planning pass): welcome bags / favours / programs DIY status was undecided so they're deferred from the seed. They can be added later via the UI with no schema change.

**Next:** v1.32.0 P2 — MENU + BAR cards.

### 2026-04-30 · v1.30.6 — Track Book expansion plan in the repo

Docs-only release. Adds [BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md) to the repo so future Claude sessions see it on `git status` rather than relying on a working-tree-only file.

The doc defines an eight-phase rebuild of the Wedding Book module: **12 sections (9 active + 3 legacy) and 12 card kinds (5 existing + 7 new), plus a Tiptap WYSIWYG editor for TEXT cards** with a deliberately small mark set. Each phase ships as one tagged release v1.31.0 → v1.38.0:

| Phase | Version | Headline |
|---|---|---|
| P1 | v1.31.0 | BUILD card (DIY production tracker) |
| P2 | v1.32.0 | MENU + BAR cards (Food & Drink rebuild) |
| P3 | v1.33.0 | SETUP card + Venue → Spaces / Décor split |
| P4 | v1.34.0 | LEGAL card + Legal → Before / Day / After split |
| P5 | v1.35.0 | OUTFIT rework (one-card-per-person) + Wedding Party split |
| P6 | v1.36.0 | STAY + LODGING_GUIDE cards (Accommodation rebuild) |
| P7 | v1.37.0 | TEXT WYSIWYG + FIELD/RECIPE/SHOT_LIST upgrades + cross-module wiring |
| P8 | v1.38.0 | Seed refresh + Post-wedding section + production backfill |

Two reconciliations against current state, captured in the planning notes:

- **Task ↔ Book linking is now m2m at BookSection level (v1.30.5)**, not single-FK at BookSubsection level (v1.30.0). Every reference to `Task.bookSubsectionId` in the Book plan reads as "the existing Topics multi-select wires up automatically when new sections are added".
- **Audit-aware feature design is a standing rule** (v1.30.5). Every server action in P1–P8 emits enriched audit metadata (snapshot fields + `changedFields` diff on updates), not just `{ entity, entityId }`.

Sequencing decision: Book plan first, existing backlog (audit log enrichment sweep, permission-group model, ceremony group colours, numeric auth, production-promotion lag) all defer to v1.39.0+.

**Files:** `BOOK-EXPANSION-PLAN.md` (new, ~1300 lines), `ROADMAP.md` (this entry), `package.json` (bump).

**Verification:** typecheck + lint + 232 unit tests + clean `.next` build all green. No code changed.

### 2026-04-29 · v1.30.5 — Schema cleanup · Topics multi-select · audit rule

Three landings in one tagged release.

**1. Schema cleanup.** Two legacy bits dropped after their one-release recoverability buffer elapsed:

- `PhotographyShot` table — data migrated to `BookShot` rows in v1.27.6. New migration: `prisma/migrations/20260429090000_drop_photography_shot/migration.sql`.
- `ScheduleEvent.audience` String[] column — replaced by `attendeeIds` in v1.27.1. Five files touched to remove read fallbacks (`schedule/page.tsx`, `ScheduleClient.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `EventNode.tsx`); `seedScheduleEvents()` rewritten to use real user IDs. New migration: `prisma/migrations/20260429100000_drop_schedule_audience/migration.sql`.
- `TodayEventsCard` and the day-of timeline both lost their persona-based audience filtering and switched to `attendeeIds.includes(currentUserId)` for the "Mine" persona — semantically tighter (matches actual attendees, not role heuristics).

**2. Topics multi-select.** Replaces v1.30.0's single-select Wedding Book subsection link with a unified multi-select that combines BookSections **and** a new user-configurable NavTag list.

- New `NavTag` model + four seeded defaults (Music · Ceremony · Reception · Guests, with optional `route` deep-links to the matching app routes).
- v1.30.0's `Task.bookSubsectionId` rolled up to `Task.bookSections` m2m at the section level (coarser scope per user feedback). v1.30.0 data backfilled to the parent section in the migration.
- New `TopicPicker` component renders a chip row + grouped checkbox dropdown (Wedding Book + Nav tags). Read-only mode renders the chip row without the trigger.
- `TaskForm`, `TaskDrawer`, `AddTaskToggle`, `TaskList` all switched from the v1.30.0 single-select to the new multi-select. `TaskList` group-by gains a "Topic" option that buckets by the union of book sections + nav tags (a task in two topics appears in both).
- `LinkedTasksPanel` extracted from `CardRouter` to its own file and relocated to render once per page (above the cards) on `/book/[slug]`, sourced from the section-level m2m.
- New `Settings → Navigation tags` couple-only block for CRUD on the NavTag list. `nav-tag-actions.ts` server actions follow the result-shape pattern with full audit metadata (`name`, `slug`, `route`, `linkedTaskCount` on delete).

New migration `prisma/migrations/20260429110000_task_topics_links/migration.sql` does it all in one block: NavTag table, both implicit-m2m junction tables (`_BookSectionToTask` + `_NavTagToTask`), backfill from v1.30.0, then drop the v1.30.0 column / FK / index.

**3. New standing rule + first-pass audit enrichment.** User added the rule this turn:

> Audit-aware feature design — after each feature request, scan for audit/activity-list opportunities. When adding an audit row, enrich its metadata with relevant snapshot fields. Logging only `{ entity, entityId }` is the minimum, not the target.

Persisted into the project's Conventions block (so any future plan that ignores it gets caught at review time). Applied to every audit touch-point this release opened:

- `createScheduleEvent` → metadata `{ title, startTime, allDay, attendeeCount }`.
- `updateScheduleEvent` → same snapshot **plus** `{ changedFields }` diff against the pre-update row.
- `deleteScheduleEvent` → `{ title, startTime }` snapshot read pre-delete.
- `createTask` → `{ title, type, supplierId, bookSectionIds, navTagIds }`.
- `updateTask` → `{ title, type, changedFields }` with diff covering 9 task fields including the m2m relations.
- `deleteTask` → `{ title, type }` snapshot pre-delete.
- All NavTag CRUD actions → `{ name, slug, route }` snapshots.

Broader audit sweep (guests, suppliers, payments, files, seating, book cards, plus the recent-activity feed surface) remains the v1.31.0 design item.

**Files modified:**
- `prisma/schema.prisma` — drop PhotographyShot model + ScheduleEvent.audience; drop v1.30.0 Task.bookSubsectionId/relation/index; add NavTag + Task.bookSections + Task.navTags m2m + BookSection.tasks back-relation; remove BookSubsection.tasks.
- `prisma/seed.ts` — drop seedPhotographyShots, rewrite seedScheduleEvents to attendeeIds, add seedNavTags.
- 3 new migrations.
- `src/app/(app)/schedule/actions.ts` — drop audience; enrich audits.
- `src/app/(app)/schedule/page.tsx`, `ScheduleClient.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `EventNode.tsx` — remove audience.
- `src/app/(app)/TodayEventsCard.tsx` — switch from role-based to attendeeIds-based "Mine" filter.
- `src/app/(app)/page.tsx` — pass currentUserId.
- `src/app/(app)/today/day-of/page.tsx` — drop audience read.
- New: `src/app/(app)/tasks/TopicPicker.tsx`.
- `src/app/(app)/tasks/TaskForm.tsx`, `TaskDrawer.tsx`, `AddTaskToggle.tsx`, `TaskList.tsx` — Topics multi-select wiring + group-by topic.
- `src/app/(app)/tasks/actions.ts` — parseTopicKeys + m2m connect/set + enriched audits.
- `src/app/(app)/tasks/page.tsx`, `questions/page.tsx` — fetch BookSections + NavTags.
- `src/app/(app)/book/[slug]/page.tsx` — section-level linked-tasks fetch + render.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — strip per-card panel.
- New: `src/app/(app)/book/[slug]/LinkedTasksPanel.tsx`.
- New: `src/app/(app)/settings/NavTagsBlock.tsx` + `nav-tag-actions.ts`.
- `src/app/(app)/settings/page.tsx` — mount NavTagsBlock.
- `ROADMAP.md` — Conventions block gains the audit rule.

**Verification:** typecheck + lint clean, all 232 unit tests pass, clean `.next` build green. Manual paths exercised in the verification block of the original plan.

### 2026-04-29 · v1.30.0 — Tasks ↔ Wedding Book subsection link

User-asked (29 Apr 2026, the bulk-asks list): "I want to be able to assign task, decisions and questions to the wedding book sections, the tasks will then also display filtered but searchable under each section". Mirrors the v1.28.0 supplier-link shape, scoped to `BookSubsection` instead of `Supplier` — so a task can attach to a specific *card* on a Wedding Book page, not just the page-level section. (Tighter granularity reads better: "what time do we need the catering recipe?" sits next to the recipe card, not floating on the section.)

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)):

```prisma
model Task {
  …
  bookSubsectionId String?
  bookSubsection   BookSubsection? @relation(fields: [bookSubsectionId], references: [id], onDelete: SetNull)
  @@index([bookSubsectionId])
}

model BookSubsection {
  …
  tasks Task[]
}
```

`onDelete: SetNull` — deleting a card doesn't cascade-delete linked tasks (matches v1.28.0 supplier link reasoning).

**Migration:** `prisma/migrations/20260429080000_task_book_subsection_link/migration.sql` — additive: column + FK + index.

**Picker:** new `BookSubsectionOpt` shape exported from `TaskForm` (`{ id, title, sectionTitle }`). The picker option label is `${sectionTitle} · ${title}` so two cards with the same name on different pages stay unambiguous. Threaded through `AddTaskToggle` (create form) and `TaskDrawer` (edit) — both pages (`/tasks` + `/questions`) fetch the flattened list and pass it down. Picker hidden when there are no subsections (fresh installs stay tidy).

**Read side — Linked tasks panel.** `/book/[slug]/page.tsx` fetches all tasks where `bookSubsectionId IN (subsection ids)` and groups them by subsection. Each group is passed to the matching `<CardRouter>` and rendered below its card via a new `LinkedTasksPanel` component — uppercase header strip with title + filtered/total count + a small client-side search input (scoped to the card's tasks) + a "Manage →" link to `/tasks`. Cards with no linked tasks render the panel as null so empty cards stay clean.

**Files:**
- `prisma/schema.prisma` — Task.bookSubsectionId/relation/index, BookSubsection.tasks back-relation.
- `prisma/migrations/20260429080000_task_book_subsection_link/migration.sql` — new.
- `src/app/(app)/tasks/actions.ts` — `bookSubsectionId` in baseSchema + create/update.
- `src/app/(app)/tasks/TaskForm.tsx` — `BookSubsectionOpt` export + side-by-side picker layout (Supplier + Wedding Book card).
- `src/app/(app)/tasks/TaskDrawer.tsx` — bookSubsectionId state + dirty + picker UI.
- `src/app/(app)/tasks/AddTaskToggle.tsx` — `bookSubsections` prop + `defaultBookSubsectionId`.
- `src/app/(app)/tasks/TaskList.tsx` — pass-through to TaskDrawer.
- `src/app/(app)/tasks/page.tsx` + `src/app/(app)/questions/page.tsx` — fetch sections + flattened subsection list, pass down.
- `src/app/(app)/book/[slug]/page.tsx` — fetch linked tasks for visible subsections, group by subsection.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — new `LinkedTasksPanel` component, every kind branch wrapped to render the panel below the card.

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green.

**Out of scope for this release** (intentionally — keeps the slice shippable):
- *Adding "+ New task" affordance directly on each card.* Today the user creates tasks from `/tasks` and links them via the picker. A per-card "+" button is a follow-up — the data path is in place.
- *Section-level (vs subsection-level) link.* The schema is currently subsection-scoped; aggregating to section is a read-side change if needed.
- *Navigational subsections (music / reception / ceremony / guests).* Quick seed-only follow-up — defer until the user asks for the specific seed payload.

### 2026-04-29 · v1.29.0 — Task grouping

User-asked (29 Apr 2026, the bulk-asks list): "Allow task grouping, by assignee, category, supplier, priority, status".

**UI:** new `Group` dropdown on the Tasks page, sitting next to the existing `Sort` dropdown. Six options: **None / Assignee / Category / Supplier / Priority / Status**. Defaults to None (renders the v1.28.x flat list unchanged), persists per-browser via `localStorage[wh_tasks_group]`.

**Render:** when grouping is active, rows split into ordered sections — each with a small uppercase header strip showing the bucket label + a count of rows in that bucket. The list/board toggle is unaffected (Board view always shows status columns; Group only restructures the List view).

**Bucket order**:
- *Assignee* — populated buckets first (alphabetical), Unassigned last.
- *Category* — populated buckets first (alphabetical), Uncategorised last.
- *Supplier* — populated buckets first (alphabetical), No supplier last. Bucket label is `name · category` (matches the picker option label).
- *Priority* — fixed Urgent → High → Medium → Low.
- *Status* — fixed OPEN → IN_PROGRESS → WAITING → DONE → ARCHIVED. Header labels match the existing pill copy (TODO / DOING / WAITING / DONE / ARCHIVED).

**Sort + group are orthogonal.** Within each group section the rows preserve the active Sort key's order — so "Group by Category, Sort by Due date" gives sections per category with each section's rows sorted soonest-first. The same applies for "Smart" (the default sort), which collapses DONE rows to the bottom *within* each group.

**Files:** all changes in `src/app/(app)/tasks/TaskList.tsx`. Added the `GroupKey` type, `GROUP_LABELS` map, `PRIORITY_ORDER` / `STATUS_ORDER` arrays, `suppliersById` lookup, the `groups` `useMemo` that produces ordered `{ key, label, tasks }` sections, the dropdown beside Sort, and the new sectioned render. Original flat-list path is preserved as the `groupKey === "none"` path through the same renderer (single synthetic section with empty label).

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green. Manual: open `/tasks`, set Group → Category, sections appear in alphabetical order with task counts; Group → Supplier, ditto; Group → None, sections collapse back to flat. Refresh — selection persists.

### 2026-04-29 · v1.28.0 — Task ↔ Supplier link

User-asked (29 Apr 2026, the bulk-asks list): "Linked Supplier to a Task / decision or question". Tasks (and questions and decisions, which share the same `Task` row under the hood) can now optionally point at a `Supplier`. The link surfaces in three places:

1. **Supplier picker on the task forms** — both the create form (`AddTaskToggle` → `TaskForm`) and the edit drawer (`TaskDrawer`) gained an optional Supplier dropdown. Hidden when the workspace has no suppliers yet, so fresh installs stay uncluttered. Reusable `SupplierOpt` shape exported from `TaskForm` mirrors the existing `UserOpt`.
2. **Linked tasks section on the supplier detail page** — read-only list under CustomFields and above Payments. Shows TYPE label, title (line-through when DONE), status pill, due-date column. Empty state nudges the user toward the Tasks page. Header link "See all on Tasks →" deep-links into `/tasks?supplier=<id>`.
3. **Server-side filter on `/tasks?supplier=<id>`** — the Tasks page reads the `supplier` searchParam, narrows the prisma query to that supplier, and renders an info banner ("Filtered by supplier: …  · Clear ×") above the FilterTabs. The rest of the search/filter UI stays interactive so the user can pivot from there.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)):

```prisma
model Task {
  …
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  @@index([supplierId])
}

model Supplier {
  …
  tasks Task[]
}
```

`onDelete: SetNull` so deleting a supplier doesn't cascade-delete the tasks/questions/decisions linked to them — the discussion thread about "what should we ask the photographer?" outlives the booking decision.

**Migration:** `prisma/migrations/20260429070000_task_supplier_link/migration.sql` — additive only: nullable column, FK with SET NULL, index for the supplier-detail query.

**Files modified:**
- `prisma/schema.prisma` — Task.supplierId/supplier relation + index, Supplier.tasks back-relation.
- `prisma/migrations/20260429070000_task_supplier_link/migration.sql` — new.
- `src/app/(app)/tasks/actions.ts` — supplierId in baseSchema + create/update.
- `src/app/(app)/tasks/TaskForm.tsx` — SupplierOpt type + supplier picker UI.
- `src/app/(app)/tasks/AddTaskToggle.tsx` — suppliers prop + defaultSupplierId pass-through.
- `src/app/(app)/tasks/TaskDrawer.tsx` — supplierId state + dirty check + picker UI.
- `src/app/(app)/tasks/TaskList.tsx` — suppliers prop pass-through to TaskDrawer.
- `src/app/(app)/tasks/page.tsx` — supplier query, searchParams supplier filter, banner.
- `src/app/(app)/questions/page.tsx` — suppliers prop on AddTaskToggle.
- `src/app/(app)/suppliers/[id]/page.tsx` — fetch tasks include + Linked tasks section.

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green.

### 2026-04-29 · v1.27.9 — Tasks polish round 3 + all-day display fix

User-reported (29 Apr 2026): four small but visible Tasks/Today asks bundled together. Versioned together (skipping v1.27.8) because the type-system changes to `EventLite` would have failed typecheck if shipped half-done.

**Tasks polish:**

1. **Drop the bordered container around the task list.** The mockup renders rows directly on the page background; the v1.27.3-vintage `bg-surface border rounded shadow` wrapper made the list look like a card-within-a-card. Replaced by a bare `<>` fragment so the header strip + rows now sit flat on the canvas, separated only by the existing per-row `border-b border-border-soft`.
2. **Wider rightmost columns.** `gap-3` → `gap-5` on both the header strip and `TaskRow`. Priority cell `w-14` → `w-16`; Status / Due / Category cells `w-20` → `w-24`. The MED/HIGH/LOW pills + status badges + dates + category chips now have a comfortable amount of breathing room and no longer feel squished.
3. **Type changer in the drawer.** `TaskDrawer` was hard-coding `task.type` on save, so a row created as `TASK` could never be converted to `QUESTION` / `DECISION` (or vice versa) without going through the admin-only `updateTask` path. Added a `TYPE_OPTIONS` pill row at the top of the drawer form that mirrors the existing Status / Priority pill styling. The model has always been polymorphic — this just exposes the toggle.

**All-day display fix:**

4. **Upcoming events: render "All day" instead of "01:00" for all-day events.** Pre-fix the Today page's `TodayEventsCard` and the `/today/day-of` timeline both ran `toLocaleTimeString` on the stored `startTime`, which is midnight-UTC for all-day events — that renders as `01:00` in BST and similar offset in other locales. v1.27.1 added `ScheduleEvent.allDay` (and the editor toggle) but never threaded it through to the read-side. Fixed by:
   - Adding `allDay: boolean` to the `EventLite` shape in `TodayEventsCard` and reading it on the time render.
   - Passing `e.allDay` through in `(app)/page.tsx`'s `events.map(...)`.
   - Adding the same conditional on the day-of timeline (`(app)/today/day-of/page.tsx`) where the event row's left-side time block now reads "All day" instead of `00:00`.

**Files:**
- Modified: `src/app/(app)/tasks/TaskList.tsx`, `src/app/(app)/tasks/TaskRow.tsx`, `src/app/(app)/tasks/TaskDrawer.tsx`.
- Modified: `src/app/(app)/TodayEventsCard.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/today/day-of/page.tsx`.

**Verification:** typecheck + lint + 232 unit tests + clean `.next` build all green.

### 2026-04-29 · v1.27.7 — Guest detail side panel on seating canvas

User-asked (29 Apr 2026). Click (no drag) a seated guest dot on the seating canvas → a `GuestDetailPanel` opens in the canvas sidebar with the guest's record. Mirrors the v1.22.x click-vs-drag distinction the existing seat-drag-source uses (4px pointer-move threshold from v1.22.9 — anything under that is treated as a click).

**Wiring:**

- The seating page (`page.tsx`) already fetches every non-archived guest for the AllGuestsPanel. v1.27.7 extends the `select` to include `email · isChild · dietary · plusOneAllowed · plusOneName · notes · household.name` so the detail panel has everything it needs without a separate round-trip on click.
- `SeatingCanvas` gains a `focusedGuestId` state alongside the existing `focusedId` (table). The two are mutually exclusive — clicking a guest closes any focused table, and vice versa. Sidebar selection always shows one entity.
- The seat-source `<circle>`'s `onPointerUp` already had a "plain click — ignore" branch when `!ds.moved`. v1.27.7 swaps that early-return for `setFocusedGuestId(ds.guestId)` so the click opens the panel.

**Panel contents** (read-only summary): full name + RSVP pill + child badge + current table; household name; email; plus-one status (with name if set); dietary chips; notes. An empty-state line ("No extra details on file…") shows when the guest has nothing populated. An **"Open record →"** link sends the planner to `/guests/[id]` for the full editable form — keeping the panel read-only avoids maintaining a second copy of the guest-edit form.

Sidebar mount: same `CollapsiblePanel` shape as the table FocusPanel — title shows "Guest: {firstName}", × button closes, persists open/closed via `wh_seating_panel_guest_focus`.

**Files:**
- New: `src/app/(app)/seating/GuestDetailPanel.tsx`.
- Modified: `src/app/(app)/seating/page.tsx` (fetch the extra fields).
- Modified: `src/app/(app)/seating/SeatingClient.tsx` (extended `AllGuest` type).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` (focusedGuestId state, click handler, sidebar mount).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/seating`, click a seated guest dot → drawer opens with their record. Click another seated guest → swaps to the new one. Click a table → guest panel closes, table FocusPanel opens.

### 2026-04-29 · v1.27.6 — Photography migration

The v1.26.0 modular-cards release deferred the photography migration as a separate step (per the original plan, to keep the v1.26.0 commit focused). This release lands it.

**Migration `20260429060000_photography_to_book_shotlist`** (idempotent — bails if the Photography section already has a SHOT_LIST subsection, or there are no PhotographyShot rows to move):

1. Look up the Photography section by `slug = 'photography'`.
2. Insert one `BookSubsection` with `kind = SHOT_LIST` (slug `shot-list`, title "Shot list") into it, ordered after any existing TEXT subsections.
3. Insert one `BookShotList` linking that subsection.
4. Copy every `PhotographyShot` row → `BookShot`, preserving `title / withWhom / location / notes / captured / capturedAt / order`. New cuid-style IDs prefixed `mig_` so they're recognisable as migration-origin without colliding with anything users add later.

The bespoke route at `src/app/(app)/book/photography/` is **deleted** (`page.tsx`, `ShotsClient.tsx`, `actions.ts`, `PrintShotsButton.tsx`). `/book/photography` continues to work — Next.js routes through the dynamic `/book/[slug]` page now, which renders the migrated SHOT_LIST card via the v1.26.0 `CardRouter`.

`db.photographyShot.findMany` reference in `/book/page.tsx`'s shot-count surface swapped to `db.bookShot.findMany` — same shape, same shot-count UX.

**Legacy retention.** The `PhotographyShot` table is **retained** for one release as a recoverability buffer. v1.28.0's schema-cleanup release drops it (along with `ScheduleEvent.audience` from v1.27.1).

**Files:**
- New: `prisma/migrations/20260429060000_photography_to_book_shotlist/migration.sql`.
- Deleted: `src/app/(app)/book/photography/page.tsx`, `ShotsClient.tsx`, `actions.ts`, `PrintShotsButton.tsx`.
- Modified: `src/app/(app)/book/page.tsx` (PhotographyShot → BookShot count source).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual (post-deploy): open `/book/photography` → renders the migrated shot-list card with all original shots, captured states preserved.

### 2026-04-29 · v1.27.5 — Mobile nav full `<Link>` revert

v1.25.2 probed the mobile-nav `<Link>` revert with the Today tab only — Tasks / Guests / More-sheet items stayed as plain `<a href>` from v1.25.0 as a fallback. The `ServiceWorkerCleanup` mounted at root in v1.25.2 unregisters any inherited stale SW on first paint, so the original cache trap that broke `<Link>` navigation can't re-occur. With v1.25.2 + v1.25.3 + v1.26.0 + v1.27.0–v1.27.4 all having shipped without regression, it's safe to graduate the rest of the tabs back to client-side navigation.

Result: faster perceptual nav (no full page reload), `<Link>` prefetch on hover, and the per-tab branching from v1.25.2 collapses back into one happy path. ([MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx))

### 2026-04-29 · v1.27.4 — Tasks visual style match: text tabs · dynamic category pills

User shared a side-by-side screenshot comparison — the v1.27.3 layout still didn't match the target mockup. User clarified: *"Anything added can stay, I just want the same style."* So this release keeps every feature from v1.27.0–v1.27.3 (search input, sort dropdown, done-circle, category column) and adjusts only the *visual* style:

**1. List/Board → text-underline tabs.** Pre-fix the toggle was a pill pair on the right of the FilterTabs row. Now it sits at the top of the page just below the title, two text labels with active-tab bottom-border accent — matches the mockup exactly. Sits in its own bg-surface band above the search/filter band.

**2. Filter pills become dynamic.** Pre-fix only four hardcoded pills (All / Mine / Open / Done). Now: predefined four (All / Mine / Questions / Done) plus one pill per distinct category tag computed from the current task set's `tags[0]` (alphabetical order, stable across renders), plus a "+ View" placeholder pill for the saved-views feature on the wider backlog. Filters that target a category use a `cat:<name>` value internally so the predefined and category strings can't collide.

**3. New Questions filter.** Replaces "Open" — toggles to QUESTION + DECISION rows so the planner can chase open answers from the Tasks page (the existing Questions page surfaces them too, but having the filter inline is convenient when you're already filtering by category).

**4. "+ View" stub.** Saved-views are a future feature (open-question on whether they should be per-user or shared). The pill is a no-op visual stub so the layout matches the mockup.

**Files:** `src/app/(app)/tasks/FilterTabs.tsx` (dynamic pills + View stub + dropped List/Board pill toggle), `TaskList.tsx` (text List/Board tabs at top, dynamic-category state, `cat:` filter handling), `TaskRow.tsx` (added explicit Category cell to align with the kept column header).

**Verification:** typecheck/lint clean, all 232 unit tests pass, build green. Manual: open `/tasks` → List/Board are now text tabs at the top. Filter row shows dynamic categories ("Budget", "Groom Prep", etc) computed from your real task tags. Click a category pill → list filters. Click "Questions" → switches to questions/decisions.

**Roadmap cleanup landed in this release:** marked Modular page cards (v1.26.0), Schedule polish (v1.27.1), Mobile navbar redirect-to-Today (v1.25.2 SW cleanup) as shipped/resolved in their backlog entries; added a "Shovel-ready next" section listing v1.25.4, v1.26.5, Guest detail seating panel, View-as preview, v1.28.0 schema cleanup with rough sizings.

### 2026-04-29 · v1.27.3 — Tasks polish round 2: full-width table · centred popout · unified styling

Four follow-ups from same-day v1.27.0 dogfood:

**1. Full-width table with column headers.** Pre-fix the list lived inside a `max-w-4xl` column with no header row — so the per-row data (assignee / priority / status / due / category) felt floating. Now the list spans the full page width and gains a hidden-on-mobile header strip with column labels (`Title · Assignee · Priority · Status · Due · Category`) at the top. Column widths align with `TaskRow`'s existing data cells so the row is genuinely table-like.

**2. Centred new-task popout.** v1.27.0's popout was pinned to `right-4 top-16` — fine but felt like an alert dropdown. New layout: full-screen flex centre with backdrop, max-width 680px, dialog content with click-stopPropagation so backdrop click outside dismisses but click inside doesn't. The TaskForm's existing `Type / Priority / Status / Due` row is now visually obvious — addresses the user's "I still want to be able to set between task, decision and question" complaint (the type picker was always there but the right-pinned popout buried it).

**3. Unified search + filter band.** Pre-fix the search input lived on the page background while `FilterTabs` was on `bg-surface` with its own border — two-tone strip the user disliked. Now both share one `bg-surface` parent with a single `border-b` at the bottom; the search input itself sits on `bg-canvas` for input-affordance contrast. The whole band reads as one block.

**4. Unchanged: type picker visibility.** TaskForm's Type select always rendered behind `showType={true}` (default). The user's "I still want to be able to set between task, decision and question" was a visibility complaint — fixed by item #2 (centred popout reveals the form's full layout).

**Files:** `src/app/(app)/tasks/TaskList.tsx` (full-width + header row + unified band), `AddTaskToggle.tsx` (centred popout), `FilterTabs.tsx` (drop the redundant background + border, share parent's).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/tasks` → list now spans page width with column headers. Click "+ New task" → centred popover with all form fields visible including Type. Search + filter pills share the same off-white band.

### 2026-04-29 · v1.27.2 — Today page: working checkbox · broader task list

User feedback (29 Apr 2026): "Today page doesn't have my next upcoming tasks on it and the boxes can't be checked from the today page."

**1. Working checkbox.** Pre-fix the Today page's "My open tasks" card rendered `<input type="checkbox" disabled>` with the aria hint *"open Tasks page to toggle"* — needless friction. New `TodayTaskList` client island (`src/app/(app)/TodayTaskList.tsx`) renders the same list but with a working checkbox. Click → optimistic hide + `setTaskStatus(id, "DONE")` server action + success/error toast. Revert on failure.

**2. Broader "My next tasks" selection.** Pre-fix the server query was narrow (`{ assigneeId: userId } OR { assigneeId: null }`) AND `take: 5` AND ordered by `dueDate asc` (Postgres puts nulls *last* in ascending). For a user with no assigned tasks but lots of dated tasks for others, the section was empty. Now we fetch all open `TASK` rows server-side and pick the user's slice client-side via this priority order:

1. Mine + dated (soonest first).
2. Mine + undated.
3. Unassigned + dated.
4. Unassigned + undated.

If those four buckets are empty, fall through to the next 5 dated tasks of *anyone's* — the section still adds value as a calendar preview rather than going blank. Title relabelled "My next tasks" + count chip now shows `5 of 47` so the user knows the section is a slice.

**Files:**
- New: `src/app/(app)/TodayTaskList.tsx`.
- Modified: `src/app/(app)/page.tsx` (wider fetch, client-side filter, mount the island).

**Verification:** typecheck/lint clean, all 232 unit tests pass, build green. Manual: open `/`, tick a task → row disappears, success toast. Reload → server confirms it's done. Open `/tasks` → same task in DONE filter.

### 2026-04-29 · v1.27.1 — Schedule polish · seat-drag transform · mobile version · ROUND-only baseline

Four user-asked tweaks, bundled because each is small.

**1. Schedule polish.** User feedback (29 Apr 2026): time picker awkward, no all-day option, "Audience" doesn't fit.

- **Split date + time inputs.** Pre-fix events used a single `<input type="datetime-local">` per side, which on desktop forced a clunky combined picker. Now date + time are separate (`<input type="date">` + `<input type="time">`) — both natively typeable on desktop, both render OS-native pickers on mobile.
- **All-day toggle.** New `allDay Boolean` column on `ScheduleEvent`. When checked, the time inputs hide and renderers display "All day" instead of a time range. Stored as midnight-local on `startTime` with `endTime` empty by convention.
- **Attendees replace Audience.** New `attendeeIds String[]` column on `ScheduleEvent`. Pre-fix the persona-based audience pills (couple / party / guests / suppliers) didn't map to anything — neither permissions nor real assignment. New picker reads from the actual User table (couple + planners + wedding party). Renderers fall back to the legacy persona audience for old rows that pre-date the migration. Legacy `audience` column kept on the schema for back-compat read; a future cleanup will drop it.

Migration `20260429050000_schedule_attendees_allday` is additive only. Files touched: `EventForm.tsx`, `EventNode.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `ScheduleClient.tsx`, `AddEventToggle.tsx` (popover pattern same as v1.27.0's AddTaskToggle), `actions.ts`, `page.tsx` (now fetches users), `prisma/schema.prisma`.

New helper `splitDateTime(d)` in `lib/format.ts` returns `{ date: "YYYY-MM-DD", time: "HH:MM" }` for the new form.

**2. Seat-drag ghost: single transform write per move.** v1.25.1 wrote 5 separate SVG attributes per pointermove (circle.cx/cy + glyph.x/y + label.x/y), each invalidating SVG layout. Even at 60 Hz the cumulative cost showed up as drag lag on dense canvases. Fix: wrap the ghost in a single `<g>` with children at (0, 0); per-move work is now one `transform="translate(x y)"` write. Combined with `style="will-change: transform"` the browser composites the translation cheaply, often GPU-accelerated. Ghost now tracks the cursor 1:1 even on layouts with many tables.

**3. Mobile version footer.** Pre-fix the version chip (`v1.27.1`) lived only in the desktop sidebar — mobile users had no way to read it when reporting bugs. Now also renders in the More-sheet footer below the Sign out button. Same `APP_VERSION` constant; just no longer hidden by `display: none` on mobile.

**4. Table-size baseline ROUND-only.** v1.25.3 introduced a 10-seat baseline so capacity tweaks didn't reflow tables, but the user pointed out (29 Apr 2026) that HEAD and RECTANGLE shouldn't have it — their seats sit along edges, where unused capacity creates obvious empty stretches that look odd on a fixed-size table. Fix: scope the baseline to ROUND only; HEAD + RECTANGLE go back to capacity-driven sizing.

**Files:** `src/lib/format.ts`, all `src/app/(app)/schedule/**`, `src/components/shell/MobileTabBar.tsx`, `src/app/(app)/seating/SeatingCanvas.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260429050000_schedule_attendees_allday/`.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green.

### 2026-04-29 · v1.27.0 — Tasks polish: drawer · popout · sort · search

User shared four mockup screenshots (29 Apr 2026) showing the desired Tasks UX. This release brings the page in line with that:

**1. Click-to-open right-side drawer.** Pre-fix clicking a task either did nothing or expanded the row inline (Edit button). Now clicking anywhere on a row opens a 420px right-side drawer with the full task detail + edit form. Status / priority / assignee / due date / category / notes — all editable inline, with `Save changes` / `Cancel` actions and a `Delete` button at the bottom-left. Backdrop click + ESC + × button all dismiss. The list stays visible behind so the user can pivot quickly between tasks. ([TaskDrawer.tsx](src/app/(app)/tasks/TaskDrawer.tsx) — new.)

The done-circle on each row stays a separate click target — it still cycles status without opening the drawer. Avatar + priority chip + status pill + due date + category render inline on desktop (≥sm); the drawer is the only way to edit on touch.

**2. "+ New task" popout instead of inline-expanded form.** Pre-fix the AddTaskToggle rendered the whole new-task form inline in the page-header `actions` slot, which made the header visibly crowded. Now the button stays compact, click → fixed-position popover at top-right (max 640px wide, dimmed backdrop). Same TaskForm inside; backdrop / × / ESC / Cancel all dismiss. ([AddTaskToggle.tsx](src/app/(app)/tasks/AddTaskToggle.tsx))

**3. Sort options.** Pre-fix the page sorted by `status → priority → dueDate` fixed in the server query, with no UI affordance to change. New `Sort` dropdown in the control row offers six choices:

- **Smart** (default — done last, then priority, then due ascending; matches the previous server sort).
- **Due date** — soonest first; null due dates last.
- **Priority** — URGENT → HIGH → MEDIUM → LOW.
- **Title** — alphabetical.
- **Assignee** — by user name (unassigned last).
- **Newest** — by creation order, descending.

Persisted via `wh_tasks_sort` localStorage so the planner's pick survives navigation.

**4. Cleaner search bar.** Pre-fix the search bar lived in its own sticky band above the FilterTabs row, taking 50+ vertical pixels and feeling disconnected. Now it's the leading element of a single control row alongside the sort dropdown — bordered input with `⌕` icon prefix and an inline `×` clear button when populated, max 384px wide so it doesn't dominate. The match-count chip (`12/47`) only shows when the user is actively filtering. List view + Board view toggles stay in their FilterTabs row below. ([TaskList.tsx](src/app/(app)/tasks/TaskList.tsx))

**5. TaskRow restructure.** Removed the inline-expand-edit behaviour (drawer now owns editing). Added per-row status pill (`TODO` / `DOING` / `WAITING` / `DONE`) and category chip on the right edge — matching the column layout from the user's mockup. The Edit/Delete hover affordances are gone — both live in the drawer now.

**Files:**

- New: `src/app/(app)/tasks/TaskDrawer.tsx`.
- Modified: `src/app/(app)/tasks/TaskList.tsx` — sort state, drawer state, control-row layout.
- Modified: `src/app/(app)/tasks/TaskRow.tsx` — click → drawer, dropped inline-edit, added status pill column.
- Modified: `src/app/(app)/tasks/AddTaskToggle.tsx` — popover instead of inline form.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/tasks` → click any task → drawer opens with details. Click "+ New task" → popover at top-right; Cancel → dismisses. Change sort to "Due date" → list reorders; reload → sort persists. Type in search → list filters with match-count chip.

**Roadmap addition:** Schedule page polish (time-entry / all-day toggle / Audience rethink). Logged for v1.27.1.

### 2026-04-29 · v1.26.0 — Modular Wedding Book cards

The largest single feature shipped since the post-audit programme. Wedding Book section pages can now be composed from a library of **typed cards** instead of the pre-v1.26.0 one-shape-fits-all `BookSubsection` (title + freeform body + a vestigial `fields` Json column nothing rendered).

**Five card kinds:**

| Kind | Use case | Storage |
|---|---|---|
| **Text** | Free-form notes, the legacy behaviour | `BookSubsection.body` (existing) |
| **Field** | List of typed fields (text / number / date / select) | `BookFieldDef[]` + `BookSubsection.fields` Json bag |
| **Recipe** | Ingredients + steps + notes (cocktails, centrepieces, bouquets) | `BookRecipe` (1:1) |
| **Shot list** | Photo capture list with checkboxes | `BookShotList` + `BookShot[]` |
| **Outfit** | Per-person outfit rows (items, supplier, status) | `BookOutfitCard` + `BookOutfit[]` |

**Approach: extend not replace.** `BookSubsection` gains a `kind BookSubsectionKind` discriminator (defaults to TEXT). Existing rows behave identically post-migration — no data move needed. Per-kind structured data hangs off new tables via 1:1 / 1:m relations cascaded on subsection delete. The vestigial `fields` Json column is repurposed as the FIELD card's value bag, keyed by `BookFieldDef.id` (mirrors v1.15.0's `Guest.customFieldValues` pattern). No throwaway columns.

**Schema (additive migration `20260429040000_modular_book_cards`):** `BookSubsectionKind` enum, `BookSubsection.kind` column, plus 6 new tables (`BookFieldDef`, `BookRecipe`, `BookShotList`, `BookShot`, `BookOutfitCard`, `BookOutfit`). All standard FK + cascade.

**Pure helpers + tests** at [src/lib/book-cards.ts](src/lib/book-cards.ts):

- `parseBookFieldValue(def, raw)` / `formatBookFieldValue(def, value)` — type-aware parse + display, mirroring v1.15.0's custom-field helpers.
- `validateRecipe`, `validateShot`, `validateOutfit` — canonical-shape normalisers with hard caps to keep Json columns tidy.
- `parseWithWhom`, `parseOutfitItems` — comma-separated free-text → trimmed string array.
- `BOOK_CARD_KIND_META` — display labels + descriptions, single source of truth for the picker UI.

**25 new unit tests** at [tests/unit/book-cards.test.ts](tests/unit/book-cards.test.ts) — every helper + every kind's validator. **Total tests: 207 → 232.**

**Server actions** at [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) — 12 new action exports, all returning a typed `BookActionResult` (`{ ok: true } | { ok: false; error: string }`) so production-redacted throws don't masquerade as silent failures (v1.22.9 / v1.23.2 pattern). `createBookSubsection` now seeds the matching per-kind row at creation time so renderers never see a missing relation.

**UI components:**

- [CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) — switches on `subsection.kind` and renders the matching editor. TS exhaustiveness guard so a future schema enum addition fails the build.
- [CardChrome.tsx](src/app/(app)/book/[slug]/CardChrome.tsx) — shared title-input + visibility-badge + delete row. Used by the four new editors so they don't duplicate the chrome.
- [BookFieldsCard.tsx](src/app/(app)/book/[slug]/BookFieldsCard.tsx) — type-aware row inputs (text / number / date / select), inline add-field form.
- [BookRecipeCard.tsx](src/app/(app)/book/[slug]/BookRecipeCard.tsx) — two-column ingredients + steps lists with reorder ↑/↓ + delete, plus notes textarea.
- [BookShotListCard.tsx](src/app/(app)/book/[slug]/BookShotListCard.tsx) — checkboxes + inline add/edit forms; same UX shape as the bespoke `/book/photography` ShotsClient that's still live.
- [BookOutfitCard.tsx](src/app/(app)/book/[slug]/BookOutfitCard.tsx) — per-person rows with name + role + items + supplier + status + notes.
- [AddSubsectionToggle.tsx](src/app/(app)/book/[slug]/AddSubsectionToggle.tsx) — pill-row kind picker. Each pill shows the kind's description on hover; only TEXT exposes a body textarea inline (other kinds start empty and grow via their dedicated editor).
- TEXT cards keep the existing `SubsectionEditor` unchanged — zero behaviour change for the legacy use.

**Deferred to v1.26.5:** photography route migration. `/book/photography` continues to render via its bespoke `ShotsClient` for now — generic SHOT_LIST cards exist for *other* sections. v1.26.5 will migrate `PhotographyShot` rows → `BookShot` rows under a single shot-list card on the Photography section, then delete the bespoke route. The legacy `PhotographyShot` table stays in place for one extra release as a recoverability buffer.

**Files:**

- New: `prisma/migrations/20260429040000_modular_book_cards/migration.sql`.
- New: `src/lib/book-cards.ts`, `tests/unit/book-cards.test.ts`.
- New: 5 card editor components + `CardRouter.tsx` + `CardChrome.tsx` under `src/app/(app)/book/[slug]/`.
- Modified: `prisma/schema.prisma` (kind enum + 6 tables + 4 relations).
- Modified: `src/app/(app)/book/actions.ts` (12 new actions, `createBookSubsection` seeds per-kind data).
- Modified: `src/app/(app)/book/[slug]/page.tsx` (eager-loads per-kind nested data, dispatches to CardRouter).
- Modified: `src/app/(app)/book/[slug]/AddSubsectionToggle.tsx` (kind picker).

**Reused patterns:**

- C1/v1.14.0 `BookSubsectionVisibility` — every card inherits the existing couple-only gating.
- C10/v1.15.0 `Guest.customFieldValues` Json bag — same shape for FIELD card values.
- v0.13.0 `PhotographyShot` UX — ported to SHOT_LIST card editor.
- v1.22.9 / v1.23.2 result-shape returns — every new action.
- `Task.type` enum (TASK / QUESTION / DECISION) — kind-discriminator pattern blueprint.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green.

**Manual smoke (post-deploy):**

- Open `/book/[any-section]` → click "+ New card" → pick "Recipe" → enter title + slug → Create. Recipe card appears with empty ingredients/steps. Add 5 ingredients, 4 steps, save → reload → state persists.
- Add a Field card → add 3 field defs (text, date, select) → fill values → reload → values persist.
- Add a Shot list card → add 3 shots → tick the middle one → reload → captured state persists.
- Add an Outfit card → add Bryony / Jamie / Best man → reload → all three render with their items.
- Toggle a card to couple-only → non-couple sees no card.
- Open `/book/photography` → still works as before (bespoke route, legacy data) — pending v1.26.5 migration.

### 2026-04-29 · v1.25.3 — Seating: table size baseline at 10 seats

User feedback (29 Apr 2026): "When resizing the seat numbers, table size should remain the same, size the tables to fit 10 seats but allow for more."

Pre-fix the `tableSize` helper scaled tables linearly with capacity for all sizes, so a tweak from 8 → 10 seats grew the table noticeably and reflowed the surrounding canvas. Annoying when the planner is just adjusting head-counts mid-planning.

Fix: introduce `SIZE_BASELINE_CAP = 10` and clamp the sizing input to `Math.max(capacity, 10)`. Tables with ≤10 seats render at the same size; tables with >10 seats grow linearly so dots don't overlap. ROUND, HEAD, RECTANGLE all share the baseline.

Net effect on real layouts: typical wedding tables (6 / 8 / 10) all render at the same size — the 10-seat size — and changing capacity within that range only repositions the dots around the now-fixed perimeter. A 12-seat table is bigger than a 10-seat one, but the bigger-than-baseline jump only happens once you cross 10.

**Files:** [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — `tableSize()` helper.

**Verification:** typecheck/lint clean, 207 unit tests pass, build green. Manual: open `/seating`, change a table's capacity 8 → 9 → 10 → 11 → 12 → the table stays the same size at 8/9/10, then grows at 11+.

### 2026-04-29 · v1.25.2 — Mobile nav: SW cleanup + Today Link probe

User confirmed (29 Apr 2026) that v1.25.0's plain `<a href>` navbar **works in incognito mode** but stays broken in normal browsing. Classic stale-service-worker fingerprint — incognito starts with a clean SW slate. The app has never registered a service worker, so any active one on the user's domain came from a previous deployment of *something* (the prototype maybe) and was happily intercepting fetches with stale chunks.

**1. Service-worker cleanup.** New `<ServiceWorkerCleanup />` client component mounted in the root layout. On first paint it calls `navigator.serviceWorker.getRegistrations()` and unregisters every entry, then drops every Cache Storage entry. Idempotent — once cleared, subsequent loads find nothing. Safe to leave in place permanently as defensive infrastructure.

**2. Today tab probe-revert to `<Link>`.** Now that the SW cause is being cleared, start graduating back to client-side navigation. The Today tab is the lowest-blast-radius candidate because it's where users land anyway — even if the revert breaks something users won't be stranded somewhere unfamiliar. Per the plan: revert one tab at a time, deploy, verify on a real (non-incognito) device. If Today nav works, the next commit reverts the rest.

The remaining tabs (Tasks, Guests) and More-sheet items stay as plain `<a href>` for now. The MobileTabBar code branches on `tab.href === "/"` to pick `<Link>` for Today and `<a>` for the rest.

**3. Roadmap addition: "View as another role" preview.** User-asked (29 Apr 2026). Admin impersonation, read-only — lets the couple or planner preview the app as if they were another user, to verify per-section visibility + role gates without signing out. Logged in the backlog with a sketched implementation: header dropdown sets a non-persistent cookie, server components read the override before applying gates, every flip audit-logged.

**Files:**
- New: `src/components/shell/ServiceWorkerCleanup.tsx`.
- Modified: `src/app/layout.tsx` — mount the cleanup.
- Modified: `src/components/shell/MobileTabBar.tsx` — Today branches to `<Link>`.
- Modified: `ROADMAP.md` — "View as" backlog entry.

**Verification:** typecheck/lint clean, all 207 unit tests pass, build green. Manual (post-deploy): hard-reload prod on a real (non-incognito) device → DevTools Application → Service Workers tab → none registered. Tap Today tab from another page → navigates client-side (no flash of white). If green, ship v1.25.3 reverting Tasks + Guests + sheet items.

### 2026-04-29 · v1.25.1 — Seating: ghost-drag perf · mobile size · desktop-only hint

Three same-day follow-ups from v1.25.0 dogfood.

**1. Ghost-drag tracks the cursor at native rate.** v1.25.0's grab-offset preservation made an existing perf bug obvious: the ghost dot during a seat drag lagged behind the cursor on canvases with multiple tables. Root cause: `setSeatDrag({ ...seatDrag, cursorX, cursorY })` on every pointermove triggered a full re-render of `SeatingCanvas` (every table, every seat dot, every drop-zone, every alignment guide). On a 10×8 layout that's ~80 reconciliation cycles per move; at 120 Hz pointer rate, React couldn't keep up.

Fix: render the ghost via **imperative DOM updates against refs** instead of state-driven re-renders. The ghost is purely visual — its position can be updated by setting SVG attributes directly. Three new refs (`ghostCircleRef`, `ghostGlyphRef`, `ghostLabelRef`) are written to in `onPointerMove`. State only updates for the one-shot `moved` transition (when drag exceeds the 4px threshold) and for `dragOverSeatId` (which highlights the destination seat) — that's also throttled to once-per-RAF so `findSeatAt`'s O(n*m) walk doesn't dominate either. A `cursorPosRef` holds the latest cursor in SVG userspace; a small `useLayoutEffect` runs on the `moved` transition to seed the ghost's first paint at the live cursor (no flash of (0,0) before the next pointermove writes refs). Ghost now tracks the cursor 1:1.

**2. Mobile canvas size boost.** Pre-fix `min-h-[400px]` left the canvas tiny on tall phones with lots of empty viewport below. Bumped to `min-h-[60vh] lg:min-h-[400px]` — on mobile the canvas takes 60% of the viewport, on lg+ it stays at 400px since the flex-row layout means width is the constraint. Also wrapped the canvas + new banner in a `flex-col` parent so they share the area cleanly.

**3. Mobile-only "drag is desktop-only" hint.** v1.23.2 disabled table drag on coarse-pointer devices but the explanation was buried inside the canvas-settings panel (collapsed by default). Now a small marigold-tinted banner sits above the canvas on mobile (`lg:hidden` + `isCoarsePointer` gate) saying *"Tap a table to focus. Drag-to-reposition is desktop-only."* The canvas-settings panel's body text also branches on `isCoarsePointer` so a user opening it gets the same instruction in long-form.

**Files:** [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — refs + useLayoutEffect for ghost, RAF throttle for findSeatAt, canvas wrapper restructure, banner.

**Verification:** typecheck/lint clean, all 207 unit tests pass, build green. Manual: open `/seating` with 5+ tables, grab a seat dot, move the cursor in fast circles → ghost tracks 1:1. Drop on another seat → assignment fires. Resize browser to phone width → banner appears, canvas takes ~60% of viewport.

### 2026-04-29 · v1.25.0 — Email nudge digests · seat-drag offset · mobile anchor

Three things, with the first being the v1.25.0 main feature.

**1. Email nudge digests.** Manually-triggered "RSVPs to chase" + "Overdue tasks" digest emails sent to the couple + planners. Pure decision module + per-row 7-day cooldown, mirrors the v1.11.0 csv-merge pattern (decisions and tests live independently of the action layer):

- New `src/lib/nudge-digest.ts` — pure functions: `decideUnconfirmedRsvpDigest(guests, now)`, `decideOverdueTaskDigest(tasks, now)`, `sortOverdueTasksForEmail`, plus the 7-day `nudgeEligible` predicate. Filters out plus-ones (the host carries the nudge), archived guests, DONE/ARCHIVED tasks, future-dated tasks, and anything nudged within the cooldown window.
- New `src/app/(app)/settings/nudge-actions.ts` — `getDigestPreview()` + `sendDigestEmail(kind)`. Returns a typed `SendResult` object instead of throwing (production-redaction pattern). Uses the same Nodemailer transport as `auth.ts`'s magic-link sender. Stamps `lastNudgedAt` on every included row in the same transaction so they don't reappear in the next 7 days. Audit-logged. Couple-only.
- New `src/app/(app)/settings/NudgesPanel.tsx` — couple-only Settings panel. Two cards (RSVPs / Tasks) with eligibility count, the first 5 names/titles, and a "Send digest" button. Uses `getDigestPreview` to keep the count fresh on mount.
- New schema column: `Task.lastNudgedAt DateTime?` (mirrors the existing `Guest.lastNudgedAt`). Migration `20260429030000_task_last_nudged_at` is additive.
- 19 new unit tests in `tests/unit/nudge-digest.test.ts` covering: eligibility-window math, RSVP filter (PENDING + MAYBE included, ATTENDING/DECLINED excluded, archived excluded, plus-ones excluded), overdue-task filter (only TASK type, only past-due, only OPEN/IN_PROGRESS/BLOCKED), priority-then-due-date sort. **Total test count: 188 → 207.**

Cron-triggered nudges deferred per the original plan; manual-trigger is honest about who's chasing what.

**2. Seat-drag grab-offset preserved.** v1.22.10 ghost dot rendered at the raw cursor position regardless of where the user actually clicked the seat. If they grabbed the dot off-centre, the ghost "jumped" to cursor-centre on first move. Fix: at pointerdown, compute the cursor's offset from the seat's world-space centre (applying the table's rotation), store on `seatDrag`, and render the ghost at `cursor − offset`. Same primitive the table-drag has used since the start — the ghost stays exactly where the user grabbed it.

**3. Mobile navbar — plain `<a href>` anchors.** v1.24.0 tried `router.push` to bypass whatever was eating the `<Link>` clicks; user reports it still didn't navigate. Going to the most defensive possible primitive: native browser anchors with no client-side routing involvement. Triggers a full page reload (slower than client routing — fine on mobile where transitions are perceptible anyway). If even this fails, the issue is below the app layer (CDN cache / service worker / device-specific) and the next investigation step shifts off-code. ([MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx))

**Files:**

- New: `src/lib/nudge-digest.ts`, `tests/unit/nudge-digest.test.ts`.
- New: `src/app/(app)/settings/nudge-actions.ts`, `src/app/(app)/settings/NudgesPanel.tsx`.
- New: `prisma/migrations/20260429030000_task_last_nudged_at/migration.sql`.
- Modified: `prisma/schema.prisma` — `Task.lastNudgedAt`.
- Modified: `src/app/(app)/settings/page.tsx` — mount `NudgesPanel` couple-only.
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` — `seatDrag` carries `offsetX/offsetY`; ghost render uses `cursor − offset`.
- Modified: `src/components/shell/MobileTabBar.tsx` — plain anchors throughout.

**Roadmap additions:** numeric auth code at sign-in (OTP / TOTP / SMS) — design pass needed first, three plausible interpretations enumerated.

**Verification:** typecheck/lint clean, all 207 unit tests pass, clean `.next` build green. Manual: open `/settings` as couple → "Nudges" panel shows N eligible RSVPs / tasks → click Send → toast confirms send + recipient count → reload → counts decrease (those rows now have `lastNudgedAt` stamped). Drag a seat off-centre on the canvas → ghost stays anchored to the grab point. Tap a tab on mobile → navigates (full page reload).

### 2026-04-29 · v1.24.0 — Print stylesheets · BookSection visibility · mobile navbar fix

Three planner-only-shortlist items, bundled. Two are small additive features; one is a defensive fix for a recurring user-reported bug.

**1. Print stylesheets for `/budget` + `/payments`.** Both pages get the same treatment as `/schedule` and `/guests/catering`:

- A new `<PrintButton />` shared client component (hoisted from the per-page duplicate that was on `/schedule`) goes in the page-header actions on `/budget` + `/payments`.
- A `print-only-block` letterhead at the top of each page — couple label + date + venue, hidden on screen, visible on print.
- New `.budget-page` and `.payments-page` blocks in `globals.css`'s `@media print` section (mirroring `.schedule-page` + `.catering-page`): full-width, black ink, lighter table borders, `f0f0f0` table headers.

Both pages are couple-only at the route level (the existing `redirect("/")` for non-couple), so the print path inherits that gate — no extra permission check needed in the stylesheet.

**2. `BookSection.visibility` couple-only override.** Mirrors the C1/v1.14.0 BookSubsection visibility — a couple can now hide a whole section (not just individual pages within it). Migration `20260429020000_book_section_visibility` is additive: `BookSection.visibility BookSubsectionVisibility @default(EVERYONE)`. Reuses the existing `BookSubsectionVisibility` enum to avoid duplication.

Read-side filters added at:
- `/book` hub: `findMany({ where: user.isCouple ? undefined : { visibility: "EVERYONE" } })` collapses non-couple results to public-only sections.
- `/book/[slug]` detail: `notFound()` if the section is `COUPLE_ONLY` and the visitor isn't couple — keeps the section's existence invisible (better than redirecting to `/book` which would reveal it ever existed).

Write-side: new `setBookSectionVisibility(id, visibility)` action mirrors `setBookSubsectionVisibility` (couple-only gate, audit log, revalidate). New `<SectionVisibilityToggle>` component renders next to the section header — a single button that toggles `🔒 Couple-only` ↔ `👥 Public` and shows the current state on its label. Couple-only at every layer.

**3. Mobile navbar imperative-routing fix.** User reported (twice) that clicking any item in the mobile tab bar on prod takes them to `/`. Inspected `MobileTabBar.tsx`, `nav-config.ts`, middleware, layout overlays — couldn't reproduce in source: hrefs are correct, no obvious overlay sitting at the tab-bar's z-index, no service worker. Possible culprits: prefetched stale routes, a click intercept somewhere I can't see, or environment-specific oddness.

Defence-in-depth fix: bypass `<Link>`'s default click handling. Each tab + sheet item now has an explicit `onClick={(e) => { e.preventDefault(); router.push(tab.href); }}`. `useRouter()` from `next/navigation` is the same primitive Link uses internally — the difference is that the `onClick` runs *before* Link's own click logic, and `e.preventDefault()` stops Link from then re-navigating. Whatever was eating the Link click is bypassed; navigation goes through `router.push` directly.

Includes a non-production `console.log("[MobileTabBar] tab click → ", href)` so if it's still broken in prod we can see exactly what fires from devtools mobile mode. The diagnostic is `process.env.NODE_ENV !== "production"` gated so it's stripped from the prod bundle.

**Files:**

- New: `src/components/ui/PrintButton.tsx` — shared.
- New: `prisma/migrations/20260429020000_book_section_visibility/migration.sql`.
- New: `src/app/(app)/book/[slug]/SectionVisibilityToggle.tsx`.
- Modified: `src/app/(app)/budget/page.tsx`, `src/app/(app)/payments/page.tsx` — print button + letterhead + class.
- Modified: `src/app/globals.css` — two new `@media print` blocks.
- Modified: `prisma/schema.prisma` — `BookSection.visibility` column.
- Modified: `src/app/(app)/book/page.tsx`, `src/app/(app)/book/[slug]/page.tsx` — read filters.
- Modified: `src/app/(app)/book/actions.ts` — `setBookSectionVisibility` action.
- Modified: `src/components/shell/MobileTabBar.tsx` — imperative router.push on every tab + sheet item.

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/budget` → header shows Print button → click → browser print dialog opens with full-width black-on-white layout. Open `/book` as couple → toggle a section to couple-only → sign in as non-couple → section is gone from the hub and `/book/[slug]` 404s.

### 2026-04-29 · v1.23.3 — Seating: freeze viewBox during drag

Tiny bugfix to v1.23.2's auto-crop. Pre-fix the cropped viewBox was a `useMemo` that depended on `positions`, which updates on every pointermove during a drag. Two consequences:

1. **Visual jitter** — the canvas zoomed/shifted on every cursor tick.
2. **Drift** — `clientToSvg` reads the live viewBox to map screen coords to SVG userspace; when the viewBox grew because the dragged table approached an edge, the mapping shifted and the table accelerated away from the cursor (positive feedback loop: bigger viewBox → bigger SVG-coord delta per cursor pixel → table moves further → viewBox grows again).

Fix: compute the bounds via `useMemo` as before (`computedViewBox`), but mirror them into a `stableViewBox` state that only updates when **no drag is active**. Effect runs whenever `computedViewBox` or `drag`/`seatDrag` change — the drag-end transition fires the update so the post-drop layout settles into a freshly cropped viewBox without an extra render. Adding/deleting tables and revalidations from the server still update the viewBox immediately because they happen outside any drag.

Net effect: the user's stated intent ("canvas resizes when more tables are added or moved") is preserved — the resize just defers to drag-release.

**Verification:** typecheck/lint clean, 188 tests pass, build green. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

### 2026-04-29 · v1.23.2 — Seating: collapsible sidebar · canvas auto-crop · mobile drag disable · ceremony save result

Four follow-ups from same-day v1.23.1 dogfood.

**1. Notes + checklist moved into the canvas right-hand sidebar; every sidebar section is now collapsible with persisted state.** The user wanted the day-of checklist + notes alongside the Selected-table / Guests / Settings panels rather than at the top of the page. New `CollapsiblePanel` component wraps each section with a clickable header, ▾/▸ arrow, and per-key localStorage persistence (race-safe `loaded` gate, same pattern as the dot/label scale toggles). Five panels in the sidebar: **Selected table** (only when one's focused) · **Notes** · **Day-of checklist** (with done/total badge in the header right-slot) · **Guests** · **Canvas settings** (collapsed by default — most users don't tweak snap/scale/grid often).

`FocusPanel` and `AllGuestsPanel` were renamed to `*Body` variants that emit only their inner content; the outer card chrome is now the CollapsiblePanel's responsibility, so we don't double up borders.

**2. List view also gets the panels, at the top.** Same content cards (Notes + Day-of checklist) render as a two-column collapsible strip above the list, since list view doesn't have a sidebar. Persistence keys are shared with the canvas-side render so a planner's open/closed picks carry across views.

**3. Auto-crop the canvas to the actual tables.** Pre-fix the SVG always rendered 1400×900 even when only the top-left corner was occupied — tables were tiny on tablets and phones. Now compute a bounding box around all tables (including their seat dots' radial extent for ROUND, edge-attached extent for HEAD/RECTANGLE) plus a `CROP_PADDING` of 80px, and use that as the SVG's `viewBox`. Empty canvas falls back to the full 1400×900. `clientToSvg` updated to honour the cropped viewBox so drag math doesn't drift.

**4. Disable table drag on coarse-pointer (touch) devices.** Pre-fix mobile users would accidentally drag tables when trying to scroll or tap. Now `window.matchMedia("(pointer: coarse)").matches` gates `dragEnabled`; touch devices get tap-to-focus only. Cursor style follows. Seat-to-seat drag inside a table is unchanged (still works on touch via the v1.22.9 pointer-event handler) — that's the assignment workflow, which is genuinely useful on mobile.

**5. Ceremony save action returns a result instead of throwing.** User reported "Seating settings didn't persist for ceremony" after v1.23.0/1. Same root cause as v1.22.9's capacity bug: in production Next.js redacts thrown server-action errors and surfaces them as the generic "Server Components render" overlay rather than reaching the client's `try/catch`. Refactored `updateCeremonySeating` to return `{ ok: true } | { ok: false; error: string }`; client checks `res.ok` and shows the real error toast. Also added a server-side `console.error` so the underlying Prisma message lands in container logs (most likely culprit if persistence still fails: the v1.23.0 migration hasn't applied to that environment yet).

**Files:**

- New: `src/app/(app)/seating/CollapsiblePanel.tsx`.
- Modified: `src/app/(app)/seating/SeatingPlanPanel.tsx` — exports `NotesContent`, `ChecklistContent`, `checklistRightSlot` instead of the v1.23.1 wrapper component.
- Modified: `src/app/(app)/seating/SeatingClient.tsx` — accepts `seatingNotes` + `seatingChecklist` props, renders panels in list view, passes through to canvas.
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` — new sidebar layout (5 collapsibles), coarse-pointer detection, viewBox auto-crop, `clientToSvg` fix, renamed `FocusPanel`/`AllGuestsPanel` → `*Body`.
- Modified: `src/app/(app)/seating/page.tsx` — drops the top-of-page `SeatingPlanPanel` mount, threads notes/checklist data through `SeatingClient`.
- Modified: `src/app/(app)/seating/actions.ts` — `updateCeremonySeating` now returns `SaveResult`; result-shape exported as `SaveResult`.
- Modified: `src/app/(app)/seating/ceremony/CeremonyClient.tsx` — handles the new result shape.

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating` → sidebar shows 4–5 collapsible panels → click a header → state persists across reload. Open with 2 tables in the top-left → canvas auto-crops to fit them. Open on a phone → cursor stays as pointer, dragging a table doesn't move it.

### 2026-04-29 · v1.23.1 — Seating: globalise notes + checklist · obvious tabs

Two follow-ups from v1.23.0 same-day dogfood. Both UX corrections — the v1.23.0 design got the data model right but the placement wrong.

**1. Notes + checklist are now global to the seating plan, always visible.** Pre-fix v1.23.0 attached notes + checklist to each individual Table row (per-table) AND made the plan-level notes-only panel collapsible. User feedback: one shared list for the whole plan, on screen at all times, not per table.

Changes:

- New `WeddingSettings.seatingChecklist Json?` (additive migration `20260429010000_seating_checklist_global`). Pairs with the existing `seatingNotes` from v1.23.0.
- New `updateSeatingChecklist` server action (mirrors `updateSeatingNotes`).
- New `SeatingPlanPanel` component renders both notes and checklist side-by-side at the top of `/seating`, always visible. Two-column on lg+ screens, stacked on mobile. Notes save explicitly via Save button; checklist toggles save optimistically with rollback on failure (same pattern v1.23.0 used).
- Removed `PlanNotesPanel` (the old collapsible notes-only) and `TableNotesAndChecklist` (the per-table mount). Both files deleted; corresponding mount points in `SeatingCanvas.FocusPanel` and `TableCard` removed.
- `Table.notes` + `Table.checklist` schema columns kept (no data drop); the v1.23.0 server actions `updateTableNotes` / `updateTableChecklist` are now dormant — no UI calls them but they're harmless if called.

**2. Reception ↔ Ceremony tabs.** Pre-fix the only path between `/seating` (reception canvas) and `/seating/ceremony` was a small "Ceremony →" text link tucked in the header actions. Easy to miss. New `SeatingTabs` component renders a clear two-pill tab bar below the page header on both pages — moss-active style same as the Mine/Everyone toggle on `TodayEventsCard`. Tab respects current pathname so the right pill highlights without prop drilling.

**Files:**

- New: `src/app/(app)/seating/SeatingPlanPanel.tsx` (~180 LOC).
- New: `src/app/(app)/seating/SeatingTabs.tsx`.
- Removed: `src/app/(app)/seating/PlanNotesPanel.tsx`.
- Removed: `src/app/(app)/seating/TableNotesAndChecklist.tsx`.
- Modified: `src/app/(app)/seating/page.tsx` (mount new panel + tabs, drop old link).
- Modified: `src/app/(app)/seating/ceremony/page.tsx` (mount tabs, drop old link).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx`, `TableCard.tsx` (drop dead per-table mount).
- Modified: `src/app/(app)/seating/actions.ts` (+ `updateSeatingChecklist`).
- Modified: `src/lib/wedding-settings.ts` (+ `seatingChecklist` to type/loader).
- Modified: `prisma/schema.prisma` + new migration `20260429010000_seating_checklist_global`.

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating` → notes + checklist visible at top without clicking anything → toggle a checklist item → reload → state persists. Click Ceremony tab → navigates → tab pill swaps. Click Reception tab → back.

### 2026-04-29 · v1.23.0 — Seating notes + day-of checklists + ceremony placeholder

Two new seating features asked for during the v1.22.x dogfood. First substantial seating release that isn't a bugfix or polish since v1.22.6.

**Per-table notes + day-of checklist.** Each Table row now carries a `notes` text column and a `checklist Json?` column. Notes are free-form (table-size constraints, board-game pairing, dietary clusters, position cues — "this table near the dance floor"). Checklist is an array of `{ id, label, done }` items so the planner can tick off "place cards / menu cards / table number stand / centrepiece / Polaroid camera / board game" on the day. Same UI shape in both the canvas FocusPanel and the list-view TableCard via a shared `TableNotesAndChecklist` component (~200 LOC). Notes save explicitly via a Save button; checklist toggles are optimistic with rollback on action failure.

**Plan-level seating notes.** The user wanted a place for room-wide policy ("min 6 / max 10 per table", board-game allocation across all tables, day-of staffing reminders) that doesn't belong to one specific table. Stored on `WeddingSettings.seatingNotes` (extended the existing singleton — no new model). Renders at the top of `/seating` as a collapsible "Plan notes" disclosure; first line shows in the collapsed state so it's scannable. Empty + read-only viewers see no panel at all.

**Ceremony seating placeholder.** New page at `/seating/ceremony`. Singleton `CeremonySeating` model: `leftRows`, `leftSeatsRow`, `rightRows`, `rightSeatsRow`, `notes`. Form lets the planner configure the dimensions; SVG renders the resulting layout — altar at the top, dashed aisle line down the middle, two grids of moss-green dots either side. Per-seat guest assignments deliberately deferred (the user said "doesn't have to be drag and drop"). Cross-link from the main `/seating` page header. Permission-gated identically to reception seating.

**Bigger top table.** Same release because it shipped alongside the rest. HEAD shape's per-seat width bumped 18→30 + base 80→110, height 70→80. Pre-fix labels on a 2-seat HEAD had only ~58px each; now ~80px/seat — full first names on most weddings without aggressive truncation.

**Schema changes (additive migration `20260429000000_seating_notes_ceremony`):**

```prisma
model Table {
  // ...existing
  notes     String?
  checklist Json?
}
model WeddingSettings {
  // ...existing
  seatingNotes String?
}
model CeremonySeating {
  id            Int @id @default(1)
  leftRows      Int @default(8)
  leftSeatsRow  Int @default(8)
  rightRows     Int @default(8)
  rightSeatsRow Int @default(8)
  notes         String?
  updatedAt     DateTime @updatedAt
}
```

**Files:**

- New: `src/app/(app)/seating/PlanNotesPanel.tsx` (collapsible plan notes).
- New: `src/app/(app)/seating/TableNotesAndChecklist.tsx` (shared notes + checklist component).
- New: `src/app/(app)/seating/ceremony/page.tsx` + `CeremonyClient.tsx`.
- Modified: `src/app/(app)/seating/actions.ts` (4 new server actions).
- Modified: `src/app/(app)/seating/page.tsx` (fetch settings, mount PlanNotesPanel, link to ceremony).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx`, `SeatingClient.tsx`, `TableCard.tsx` (thread notes/checklist + mount the shared component, plus the bigger HEAD sizing).
- Modified: `src/lib/wedding-settings.ts` (add `seatingNotes` to type + loader).

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open a table → fill in a note + add a checklist item → toggle done → reload → both persist. Open `/seating/ceremony` → adjust rows → save → SVG redraws.

### 2026-04-29 · v1.22.10 — Seating polish: repack, glyph center, label space, ghost dot, alignment guides

Five seating-canvas fixes from the v1.22.9 dogfood:

**1. Repack-on-shrink.** Pre-fix the action complained "seats above #N still assigned" if the trailing indices happened to be occupied — even when the table had plenty of leading empties. The user's mental model is *total* occupancy ("4 guests + 8 seats → I should be able to shrink to 4"). Fix: action now repacks. If `occupiedCount <= target`, move every guest currently at a trailing seat into a leading empty slot, then delete trailing seats. Atomic via `db.$transaction`. Only errors when `occupiedCount > target`. ([actions.ts](src/app/(app)/seating/actions.ts))

**2. RSVP glyph centering.** Pre-fix glyphs (✓ ? ~ ✗) were positioned via a fudge offset (`y = cy + 1.4 * dotScale`) that drifted off-center across S/M/L/XL font sizes. Fix: use `dominantBaseline="central"` so the glyph centers vertically regardless of fontSize. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**3. HEAD/RECTANGLE label spacing.** Pre-fix HEAD labels sat too close to the dots (4-5px between dot edge and label baseline at default M scale). Now uses an explicit dot-edge + GAP + font-baseline-correction formula — labels above use `cy - dotR - 4 - 0.2*fontSize`, labels below use `cy + dotR + 4 + 0.8*fontSize`. The 0.2/0.8 factors account for SVG text baseline (visible glyphs extend ~0.8 above and ~0.2 below the baseline). 4px constant pad gives consistent breathing room across scales.

**4. Ghost dot during canvas seat-drag.** Pre-fix the v1.22.9 pointer-event seat-drag had no visual feedback — only the destination seat highlighted; the source seat stayed put. The user couldn't tell if they were actually dragging. Fix: track cursor position in `seatDrag` state, render a ghost `<circle>` at the cursor with the source's RSVP color/glyph + first-name label, opacity 0.7 so it reads as "in flight". Same visual primitive the table-drag has via the `isDragging` check.

**5. Alignment guides during table-drag.** New ask. When the dragged table's centre lines up with another table's centre on either axis (within 4px tolerance), draws a faint dashed marigold line all the way across the canvas. Helps the planner snap rows/columns of tables into formation. Only the matching neighbours render guides — keeps the canvas uncluttered when many tables are in play.

**Verification:** typecheck/lint clean, 188 unit tests pass, build green. Manual: 4-of-8 round table → click - → table shrinks to 4, all guests still seated. Drag a guest → ghost dot follows cursor. Drag a table over an aligned neighbour → dashed line appears.

### 2026-04-29 · v1.22.9 — Seating bugfix: capacity error, HEAD orientation, name overlap, canvas drag

Four fixes from v1.22.7/8 dogfood:

**1. Server-error overlay when shrinking a table.** Pre-fix `updateTableCapacity` threw an `Error` when the user tried to shrink a table with occupied trailing seats. In Next.js production mode, thrown server-action errors are *redacted* and surface as the generic "An error occurred in the Server Components render" overlay rather than reaching the client's `try/catch` for the intended `notify("error", ...)` toast. Fix: action now returns a typed `{ ok: true } | { ok: false; error: string }` result. The client checks `res.ok` and shows the friendly notify-error toast as designed. Both the canvas FocusPanel and the list-view TableCard updated to use the new shape. ([actions.ts](src/app/(app)/seating/actions.ts), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx), [TableCard.tsx](src/app/(app)/seating/TableCard.tsx))

**2. HEAD top-table dots flipped to top edge.** Pre-fix the v1.22.7 HEAD layout placed seats along the bottom edge of the rectangle. By convention the head table sits at the head of the room with guests *facing* the room — so seats render more naturally on the back side (top edge). Adjusted the layout helper accordingly. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — `computeSeatLayouts`)

Per-table orientation toggle (so HEAD can flip back to bottom-edge for unusual layouts) deferred — the user mentioned it as a "should be able to" follow-up.

**3. Dynamic name truncation.** Pre-fix names were truncated at a fixed 10-char cap, which left "Jamie" and "Bryony-Ol…" overlapping when seated next to each other on a 2-seat HEAD table (per-seat horizontal budget was ~58px but each label rendered ~80px wide). Fix: truncation now reads per-seat horizontal budget per shape:

- ROUND keeps the 14-char cap (radial labels have generous space).
- HEAD: `floor(width / capacity / glyphWidth)`.
- RECTANGLE: same but split top/bottom so `perSide = ceil(capacity/2)`.

Floor is 4 chars + ellipsis so labels stay distinguishable. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**4. Canvas seat-to-seat drag now works.** Pre-fix v1.22.7 added an HTML5 `draggable={true}` source on each occupied seat's overlay `<circle>`. SVG element draggability is unreliable across browsers — Chrome/Firefox/Safari each handle it differently and several users couldn't drag a seat at all. Replaced with pointer-event-based drag (same primitive the table-drag already uses). Implementation:

- `onPointerDown` on the seat overlay captures the pointer + records start position. `e.stopPropagation()` so the table-drag handler never fires.
- `onPointerMove` tracks distance; once it exceeds 4px the drag is "official" and `draggingGuestId` flips on (unlocks the existing visual drag-over highlights on other seats).
- `onPointerUp` hit-tests against all seat positions in SVG userspace via a new `findSeatAt(x, y)` helper that also accounts for table rotation. Drop on another seat → `assignGuestToSeat`. Drop outside any seat → unseat (same as dropping on the panel).

The HTML5 drag still works for `AllGuestsPanel → seat` because the source there is a regular HTML `<li>`, which has rock-solid `draggable` support. Only the SVG-source case switched to pointer events. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck/lint clean, 188 unit tests pass, build green. Manual: shrink an occupied table → friendly toast (no overlay). Top-table dots are above the rectangle. Names on a 2-seat HEAD don't overlap. Drag a guest from one canvas seat to another → reseats live.

### 2026-04-29 · v1.22.8 — Seating: RSVP glyphs inside seat dots

Tiny accessibility-and-clarity follow-up to v1.22.7's coloured-dots ask. Hue alone gets ambiguous at small dot sizes and is unreadable for colour-blind users. Each occupied seat dot now carries a white glyph centred inside it:

- ✓ Attending (moss)
- ? Pending (marigold)
- ~ Maybe (info-blue)
- ✗ Declined (muted — rare since declined guests usually don't have a seat)

Glyphs match the AllGuestsPanel tag chars exactly so the visual language is consistent across surfaces. Hidden when `dotScale < 1.4` (S size — the dot is only ~3.5px wide and the glyph would be unreadable; colour alone carries the meaning at S). At M/L/XL the glyph reads cleanly. `pointerEvents="none"` so it doesn't intercept drags. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck + lint clean, 188 tests pass, build green.

### 2026-04-29 · v1.22.7 — Seating: RSVP dots, all-shape seats, canvas drag, resizable grid, uniform toggles

Big seating-canvas pass — eight follow-up asks from v1.22.6 dogfood, all UI-only (no schema). Each is small individually; bundled because they touch the same file.

**1. RSVP-colored seat dots ("attendance markers").** Pre-fix all occupied seats were moss green regardless of whether the guest had confirmed. Now colored by `Guest.rsvp`: moss=ATTENDING, marigold=PENDING, info-blue=MAYBE, muted=DECLINED. Mirrors the AllGuestsPanel tag palette so the visual language is consistent. Seat fetch in `page.tsx` extended to include `rsvp`.

**2. Seat dots on HEAD + RECTANGLE tables.** Pre-fix only round tables rendered per-seat dots — head tables and rectangles showed only the table outline + name + count, so the user couldn't see who sat where. New `computeSeatLayouts(shape, capacity, size, dotScale, labelScale)` helper handles all three shapes:
- ROUND — radial around perimeter (existing layout, refactored).
- HEAD — single row along the front (bottom) edge — guests face the room.
- RECTANGLE — split between top/bottom edges, top gets the extra seat when capacity is odd.

Labels position appropriately for each shape (radial outward for round, below dots for head/rectangle-bottom, above dots for rectangle-top).

**3. Drag between seats on canvas.** Pre-fix only the AllGuestsPanel-row → seat drag worked. Now each occupied seat carries an HTML5 drag-source layer (`draggable`) so the planner can drag a guest from one seat to another (or back to the panel for unseating). The table-drag's `onPointerDown` checks for a `draggable` target and bails so the seat-drag never accidentally starts a table-drag. Existing `assignGuestToSeat` action (B12 transaction from v1.12.0) handles the reseat atomically.

**4. Resizable grid (S/M/L/XL).** Pre-fix the canvas grid was a fixed 20px. New `Grid size` toggle in the side panel — S=10/M=20/L=30/XL=40. Both the visible `<pattern>` and the snap-on-drop math read this value at render time. Persisted via `wh_seating_grid_size`. Keyboard nudge step also follows the new grid size.

**5. Uniform S/M/L/XL with bumped label-M.** Pre-fix the label scale toggle was S/M/L (no XL) and `M=1.4` was "too cramped" per user feedback. All three sizing toggles (dot, label, grid) now share the S/M/L/XL shape. Scale values bumped: S=1.0, M=1.6, L=2.0, XL=2.5 — the new M sits between the old M (1.4) and L (1.8). Old saved values (1.4, 1.8, 2.4) silently fall back to default M=1.6 since they're no longer in the validation set; tradeoff vs. a migration path.

**6. Visible capacity +/- buttons.** Pre-fix the v1.22.6 +/- buttons were 16px inline glyphs that were almost invisible (the user couldn't find them). Replaced with a labelled "Seats" row in the FocusPanel + TableCard headers — 28px buttons with proper hit targets, `bg-canvas/60` row container, and the current capacity number tabular-numbered between them. Both views (canvas FocusPanel + list-view TableCard) get the same row.

**7. Click-once focus.** Pre-fix clicking a table sometimes required two clicks before the FocusPanel appeared. Race condition: the `<g>` is `tabIndex=0` so it gains browser focus on `mousedown` (firing `onFocus` → `setFocusedId(id)`); then the pointerup-toggle would *un*set it on the same click (`cur === id ? null : id`). Removed the toggle: clicks always set; deselection happens via the × button. Also: clicking a seat's drag-source still focuses the table even though the table-drag bails.

**8. (incidental) Component refactor.** Three-up scale toggles (dot/label/grid) now share a `<ScaleToggle>` component instead of three near-identical inline blocks; cuts ~50 lines.

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: click a HEAD table → dots visible along bottom edge. Open a round table, click +/- → capacity changes. Drag a guest from one seat to another → reseats. Try Grid=XL → grid widens, snap snaps to 40px.

### 2026-04-29 · v1.22.6 — Seating: snap-to-grid toggle + modify capacity + pending in picker

Three small seating-canvas asks from the v1.22.0 dogfood. All UI/UX continuations of v1.20.5 / v1.20.6 — no schema changes.

**1. Snap-to-grid toggle.** Pre-fix the canvas had a "soft snap" that only fired when the drop landed within ±10px of a grid point — almost never in practice. Replaced with an explicit `Snap to grid on drop` checkbox in the canvas side panel, persisted to localStorage (`wh_seating_snap_to_grid`), default on. When on, every drop snaps to the nearest 20px grid intersection — easy alignment of multiple tables. When off, drops land wherever the cursor was. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**2. Modify table capacity on existing tables.** Pre-fix the only way to change capacity was to delete and recreate the table (losing assignments). New `updateTableCapacity(tableId, newCapacity)` server action ([actions.ts](src/app/(app)/seating/actions.ts)) handles both directions:
- **Grow:** appends new Seat rows for the missing indices. Round-table layout reflows because seat angles depend on capacity — that's expected.
- **Shrink:** only allowed if all trailing seats (index ≥ newCapacity) are empty. If any are still assigned, the action throws with `"Can't shrink to N: M seats above #N are still assigned. Unseat first."` so the planner knows to unseat before shrinking. Never destructive of assignments.

UI: small +/- buttons next to the seated/capacity count in both the canvas FocusPanel and the list-view TableCard header. Bounds at 1..40 (matches the existing `createTable` schema).

**3. Pending guests in the seat-picker dropdown.** Pre-fix the FocusPanel + TableCard dropdowns only listed `ATTENDING` guests (the AllGuestsPanel from v1.20.6 included pending, but only via drag — most users picked through the dropdown). Filter relaxed to `rsvp !== "DECLINED"`, so PENDING and MAYBE now appear. Options are prefixed with `?` (pending) or `~` (maybe) to distinguish from confirmed picks. Attending stays unprefixed (the common case). ([SeatingClient.tsx](src/app/(app)/seating/SeatingClient.tsx), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx), [TableCard.tsx](src/app/(app)/seating/TableCard.tsx))

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating`, click a table, hit `+` — new seat appears immediately. Hit `−` on an occupied trailing seat — error toast. Toggle snap off, drop a table mid-grid — stays put. Dropdown lists PENDING entries with `?` prefix.

### 2026-04-29 · v1.22.5 — Bugfix: hydration / persistence race / decoupled seating scales

Three small fixes in one release. All client-state issues, no schema or migrations. User-reported during the v1.22.0 dogfood.

**1. React #418 / #482 on Today page.** `CountdownCard` is a client component that called `new Date()` at render time and passed it to `buildBreakdown(unit, now, target)`. Server-render and first client-paint produced different millisecond values, so React's hydration check threw #418 (text mismatch) followed by #482 (server render error during recovery). The crash was visible whenever the user navigated back to `/` from another page.

Fix: defer `now` to a `useState<Date | null>(null)` populated inside `useEffect` on mount. Render a muted "—" placeholder before `now` lands, so SSR markup matches the first client paint exactly. The 60-second tick interval continues to work as before. ([CountdownCard.tsx](src/app/(app)/CountdownCard.tsx))

**2. "Doesn't save my seat label size settings."** Same race in two places — `CountdownCard.unit` and `SeatingCanvas.labelScale`. On mount, the load `useEffect` and the save `useEffect` both fired in the same paint cycle. The save fired first with the default state value, overwriting whatever the user had previously saved, before the load could read and `setState` the saved value.

Fix: introduce a `loaded` boolean flag. The load effect sets `loaded = true` after reading. The save effect early-returns `if (!loaded)`. Net effect: the first save only happens after the user has actually changed the value, never on mount. Applied to both files. ([CountdownCard.tsx](src/app/(app)/CountdownCard.tsx), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**3. "Bigger seats but not bigger labels."** v1.20.5's S/M/L scale toggle on the seating canvas controlled dot radius, dot offset, label offset, and font size all together. The user wanted to scale the seat dots up (so occupied/empty status reads from across the room) without making the names so big they crash into adjacent seats.

Fix: split into two independent toggles persisted under separate localStorage keys (`wh_seating_dot_scale` + `wh_seating_label_scale`). Dot scale gains an XL=2.4 step for chunky dots; label scale stays at S/M/L. The label offset formula now adds dot-scaled clearance + label-scaled breathing room (`labelOffset = dotOffset + 3.5*dotScale + 8*labelScale`), so picking L dots + S labels keeps the names tucked tight against the dots. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/`, navigate to `/tasks`, navigate back — no hydration error in the console. Open `/seating`, set dot=L + label=S, reload — both selections persist.

### 2026-04-28 · v1.22.0 — Custom fields for Supplier + Task

C10/v1.15.0 introduced custom-fields infrastructure but only wired it for Guest. This release extends to Supplier and Task. The infra was built generically; the work was unlocking the entity dropdown + plumbing two more rendering surfaces + two more write actions.

**Schema:** additive Prisma migration adds `customFieldValues Json?` to Supplier and Task — same shape as Guest got in v1.15.0. Existing rows aren't touched (column nullable).

**Settings panel** ([CustomFieldsPanel.tsx](src/app/(app)/settings/CustomFieldsPanel.tsx)): entity dropdown unlocked from `Guest` only to `{Guest, Supplier, Task}`. Action schema (`custom-fields-actions.ts`) now accepts the new entities. `revalidateForEntity` helper fans out `/guests` / `/suppliers` / `/tasks` + `/questions` paths after a definition changes.

**Shared block:** the C10 Guest-coupled `CustomFieldsBlock` was refactored into [src/components/ui/CustomFieldsBlock.tsx](src/components/ui/CustomFieldsBlock.tsx) — takes an `onSave(fieldId, rawValue)` callback so the parent decides which server action to call. Guest variant became a thin wrapper that pre-binds `setGuestCustomField`. Same shape for Supplier (new wrapper at `suppliers/[id]/CustomFieldsBlock.tsx` pre-binds `setSupplierCustomField`).

**Supplier wiring:** `/suppliers/[id]` page fetches `CustomField` defs scoped to `entity: "supplier"` and renders the block below the existing detail sections. Server action `setSupplierCustomField` ([suppliers/actions.ts](src/app/(app)/suppliers/actions.ts)) gates on `requireEdit("suppliers")`, validates via the existing `parseCustomFieldValue` (4 types: text/number/date/select), rejects mismatched `field.entity` so a Guest field can't accidentally land on a Supplier row.

**Task wiring:** Tasks have no detail page (edit happens inline in the list or in the QuestionsClient row), so the custom-fields block renders inside `TaskForm` as a section below the main form. Only shown when editing an existing task (a `taskId` is in scope) and at least one task-scoped def exists. New `setTaskCustomField` action ([tasks/actions.ts](src/app/(app)/tasks/actions.ts)) uses the same polymorphic permission gate as `setTaskStatus` / `deleteTask` — dispatches to either `requireEdit("tasks")` (for TASK rows) or `requireEdit("questions")` (for QUESTION/DECISION rows). Task defs are loaded at the page level (tasks/page.tsx + questions/page.tsx) and threaded down through TaskList → TaskRow → TaskForm + QuestionsClient → Section → Row → TaskForm.

**Files changed:** 9 modified, 2 new (shared CustomFieldsBlock + suppliers wrapper). 1 additive Prisma migration. Existing 18 unit tests on the parser still cover the type matrix; no new tests needed for the entity-routing layer (gates run server-side and existing permissions integration test catches dispatch bugs).

### 2026-04-28 · v1.21.0 — Audit log viewer + sticky search on /suppliers + /tasks

Three surface-only additions bundled because they all extend existing patterns. No schema, no new server actions, no new tests — purely UI-side reads.

**Audit log viewer in Settings.** Couple-only — non-couple users see the section header so they know it exists, but no rows. Server component fetches the most-recent 50 `AuditLog` rows (or 50 before a cursor passed via `?audit_before=…`); each row shows timestamp + who (user name, falls back to email, or "system") + what (e.g. "create supplier", "update guest"), plus a one-line summary of the metadata Json (truncated). Pagination is cursor-based via "Older →" link — simpler than infinite scroll for a settings panel that's collapsed by default in usage. Reuses the v1.21.0+ surface-only constraints — no new audit data, no filters in v1, just surfacing what every server action already writes via `audit()`.

**Suppliers sticky search** at [SuppliersClient.tsx](src/app/(app)/suppliers/SuppliersClient.tsx). New thin client wrapper mirrors the v1.12.0 `GuestList` pattern: sticky `top-0` search input above the existing categorised card grid. Filters by name + category + status + notes (case-insensitive substring). Counter shows `N/M` while filtering; "×" clears. The page becomes a server data-fetcher that hands suppliers + edit gate to the client.

**Tasks sticky search** added to [TaskList.tsx](src/app/(app)/tasks/TaskList.tsx). New search input above the existing FilterTabs row, transient (not persisted to localStorage — search queries are usually ad-hoc and a stale query on next visit would surprise). Filters by title + tags + notes. Plays nicely with the existing filter (mine/open/done) and view (list/board) toggles.

**Files changed:** 4 modified (settings/page.tsx, suppliers/page.tsx, tasks/TaskList.tsx, ROADMAP), 2 new (AuditLogPanel.tsx, SuppliersClient.tsx). 188 unit tests + 5 e2e + build all green.

### 2026-04-28 · v1.20.6 — Seating: drag-all-guests + RSVP tag in panel

v0.6.0 shipped click-to-assign drag from the unseated panel onto a seat. Pre-v1.20.6 the side panel only showed *attending unseated* guests, and there was no way to drag a seated guest to a different seat (you had to click the seat → "unassign" → click another seat → assign). This release extends drag in both directions and surfaces RSVP state at a glance.

**All-guests panel.** Replaces the legacy `UnseatedPanel` (~25 lines) with a richer `AllGuestsPanel`. Now shows every non-archived guest, ordered by usefulness for seating: attending-unseated first (most actionable), then attending-seated, then pending, then maybe, then declined. Each row carries an RSVP tag (`✓` moss for ATTENDING, `?` marigold for PENDING, `~` info for MAYBE, `✗` muted for DECLINED) and a small "currently at X" subscript when the guest is seated.

**Show declined toggle.** Declined guests hidden by default since they don't get seats; the count is shown next to the header with a "show / hide" link if the user wants to scan the full list. "Show all N" link expands the list past the first 18 visible rows so a 50-guest wedding doesn't crowd the side rail.

**Drag wiring.** HTML5 drag-and-drop, since SVG `<g>` and `<circle>` elements both fire `onDragStart` / `onDragOver` / `onDrop` in modern browsers. Pattern:
- **Panel rows** are `draggable={canEdit}`. `onDragStart` writes the guest id into `dataTransfer` and pushes it to component state for visual feedback (the dragged row goes 40% opacity).
- **Seat dots** stay visual-only (`pointerEvents="none"`) so the table-drag pointer events still work. While a guest is being dragged, the canvas renders a wider transparent drop-zone circle behind each seat (radius `Math.max(14, 8*labelScale)` — forgiving target). The drop zone has `onDragOver` (preventDefault, required for `onDrop` to fire), `onDragEnter`/`onDragLeave` (track which seat the user is hovering — the dot turns marigold when valid drop), and `onDrop` (calls `assignGuestToSeat(seatId, guestId)`).
- **Panel itself** is also a drop target. Dropping a guest there calls `assignGuestToSeat(currentSeatId, null)` — unseat. No-op if the guest wasn't seated.

**Action reuse.** The action's transaction (B12, v1.12.0) already handles the "two simultaneous drops on the same seat" case atomically via the `Guest.tableSeatId @unique` constraint. No action change needed; just new UI hooked up to the same entry point. Errors surface via the v1.12.0 toast bus instead of crashing.

**HEAD-shaped tables** unchanged — no radial seat layout; legacy `<select>` dropdown in the FocusPanel still handles those.

**Files changed:** 3 (page.tsx query, SeatingClient.tsx props, SeatingCanvas.tsx panel + drop wiring). No schema; no new tests (UI-only behaviour layered on the existing B12 transaction integration test).

### 2026-04-28 · v1.20.5 — Seating canvas: bigger labels + S/M/L size selector

v1.16.0 added first-name labels next to occupied seat dots on round tables. Defaults were conservative — `dotR=3.5`, `fontSize=9`, label radius `+18` — readable at 100% zoom on a desktop monitor but cramped on phones, smaller monitors, or when the user zooms out the canvas. User asked for both larger defaults and a size selector.

**Implementation.** Single `labelScale` state in [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx). Three sizes: S = 1.0 (pre-v1.20.5 default — kept as a small option for power users), M = 1.4 (new default), L = 1.8 (chunky). Dot radius, font size, and the radial label offset all scale together so the size step feels cohesive — pre-v1.20.5 only fontSize would have scaled, leaving label and dot fighting for the same pixel.

**Persistence.** localStorage `wh_seating_label_scale`. SSR renders M (default 1.4); a `useEffect` on mount restores the saved value. Mirrors the dark-mode + tasks-view-toggle patterns elsewhere.

**Selector UI.** S/M/L pill toggle in the canvas's right-hand side panel (the empty-state slot when no table is focused). Same visual language as the CountdownCard's M/W/D toggle and TodayEventsCard's Mine/Everyone toggle so the toggle vocabulary stays consistent across the app.

**HEAD-shaped tables** unchanged — they don't have the radial seat layout, so the labels don't apply. The table-name label inside the rectangle is enough.

**Files changed:** 1 (SeatingCanvas.tsx). No schema, no new tests (pure visual + state).

### 2026-04-28 · v1.20.0 — Wedding details DB-backed

Pre-v1.20.0, every reference to the wedding date / venue / couple names read straight from `WEDDING_DATE` / `WEDDING_VENUE` / `WEDDING_COUPLE` env vars at module scope. Editing meant a redeploy. This release centralises the read into a DB-backed singleton with a Settings UI; the user can now edit any of the eight fields without touching the server.

**Schema:** new `WeddingSettings` model — singleton enforced via `id Int @id @default(1)`. Eight fields: `weddingDate`, `ceremonyTime`, `venue`, `venueAddress`, `coupleLabel` (long form, used on schedule letterhead + sign-in email), `coupleShort` (possessive form, used inside the Today countdown card), `brideFirst`, `groomFirst`. Additive Prisma migration; seed inserts the bootstrap row from env-var defaults so an empty DB still boots reasonably.

**Loader at [src/lib/wedding-settings.ts](src/lib/wedding-settings.ts).** `getWeddingSettings()` is React.cache-wrapped — pages on the same render share one DB hit. Falls through to env-var defaults if the row is missing or the DB is unreachable, so a hiccup mid-render shows generic content rather than crashing the page. Exports `formatWeddingDate` and `formatWeddingDateShort` helpers so a single change rolls everywhere.

**Settings panel at [WeddingSettingsPanel.tsx](src/app/(app)/settings/WeddingSettingsPanel.tsx).** Couple-only — server action gates on `user.isCouple === true` (mirrors A2's settings lockdown from v1.2.0). Non-couple users see read-only values. Edit toggles inline form with all eight fields; save calls `updateWeddingSettings` which upserts the row + audit-logs + revalidates every page that reads settings (`/`, `/glance`, `/schedule`, `/today/day-of`, `/guests/catering`, `/settings`).

**Replaced 10 references** that previously read env vars or hardcoded "Jamie & Bryony" strings:
- [src/app/(app)/page.tsx](src/app/(app)/page.tsx) — Today countdown reads `wedding.weddingDate`, `wedding.venue`, `wedding.coupleShort`.
- [src/app/(app)/glance/page.tsx](src/app/(app)/glance/page.tsx) — `daysUntil` now takes a Date from settings.
- [src/app/(app)/schedule/page.tsx](src/app/(app)/schedule/page.tsx) — print letterhead uses `wedding.coupleLabel` + `wedding.venue`.
- [src/app/(app)/today/day-of/page.tsx](src/app/(app)/today/day-of/page.tsx) — hero band reads from settings.
- [src/app/(app)/guests/catering/page.tsx](src/app/(app)/guests/catering/page.tsx) — letterhead uses `wedding.coupleLabel` + `wedding.venueAddress ?? wedding.venue`.
- [src/components/shell/Sidebar.tsx](src/components/shell/Sidebar.tsx) — header reads `${brideFirst} & ${groomFirst} · ${formatWeddingDateShort}`. Made the Sidebar an async server component to support the await.
- [src/app/layout.tsx](src/app/layout.tsx) — switched from static `metadata` to async `generateMetadata` so the document description picks up edits.
- [src/app/signin/page.tsx](src/app/signin/page.tsx) — heading + "contact X or Y" copy.
- [src/app/signin/error/page.tsx](src/app/signin/error/page.tsx) — error messages substitute couple names dynamically.
- [src/auth.ts](src/auth.ts) — magic-link email subject + body (text + HTML) interpolate bride/groom names + formatted wedding date.

Env vars stay as the seed source so an empty DB still boots — they're now bootstrap-only; live config lives in Settings. The README's "Email deliverability" section already documented the relevant subset; no doc change needed for env vars.

**Files changed:** 12 modified, 4 new (`wedding-settings.ts`, `wedding-settings-actions.ts`, `WeddingSettingsPanel.tsx`, `wedding-settings.test.ts`). 1 additive migration. 2 new unit tests (188 total). e2e + build green.

### 2026-04-28 · v1.19.6 — README rewrite

Doc-only release. The README had drifted significantly from the actual state of the codebase; the user requested a full review. Findings (12+) were addressed in a single rewrite pass.

**Major drift fixed:**
- Stale "Phase A" / "Phase B" / "Phase C" status section claimed Phase C was current — actually shipped before v1.0.0. Replaced with a brief "Status" section pointing at ROADMAP.md (the living changelog) and REMEDIATION-PLAN.md (post-audit programme).
- "Deferred for future work" listed 8 items every single one of which had shipped (file uploads → D1, seating canvas → D2, CSV import → E, shot list → F2, Spotify → G1, catering export → F1, day-of → G2, quick-capture → G2). Section deleted.
- Components / lib file inventory was missing ~15 files added since Phase A (Toaster, Illustrations, EventMotifIcon, csv-merge, budget, custom-fields, dark-mode, last-edited-fields, notify, plus-one, rate-limit, spotify, supplier-follow-up, …). Rewritten from scratch.
- "Allow-list of 5" hardcoded number replaced with "env-list".
- Workflow trigger said `main`/`dev`; actually `claude/main`/`dev`.

**Sections added:**
- **Standing rules** at the top: admin-only, never tag broken builds, ROADMAP-update-before-done, fast-forward promote.
- **Test pyramid** in the Status section (190 unit + 1 integration + 5 e2e) and useful-scripts table.
- **Permission model** rewritten to cover the bootstrap-admin flow (first sign-in → couple), couple-gated writes (A2/A6 lockdowns), audit logging.
- **Image rollback** examples now show `:vX.Y.Z` and `:sha-<short>` tag patterns; one-off migration / Studio commands simplified to `npx prisma`.

No code, no tests, no schema changes — pure documentation pass.

### 2026-04-28 · v1.19.5 — Email deliverability: Reply-To + List-Unsubscribe + DNS docs

User reported magic-link emails landing in spam. Code-side fix is small (the body was already clean — inline CSS, text alternative, no spam-trigger words); the real lever is DNS auth on the sending domain. Two-pronged release:

**Code:** [src/auth.ts](src/auth.ts) `transport.sendMail` call gains a `replyTo` (defaults to `EMAIL_REPLY_TO` env var or falls through to `EMAIL_FROM`) and a `List-Unsubscribe` header (RFC 2369, mailto: form). Both reduce Gmail's spam-classifier weight on transactional auth mail. New `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header pairs with it for one-click handling per RFC 8058.

**Docs:** new "Email deliverability" section in [README.md](README.md) with the Resend domain-verification flow (SPF + DKIM TXT records on `spencer-net.com`), DMARC observe-mode TXT, and a verification checklist (`Authentication-Results: dkim=pass spf=pass dmarc=pass` in raw headers).

The DNS records themselves are user-side ops work — Resend's dashboard generates the per-account values. After the records propagate, mail sent from `Jamie & Bryony <hello@spencer-net.com>` will be SPF/DKIM-authenticated and stop landing in spam. Code change is the smaller half (~10% impact); DNS is the bigger half (~80%).

No schema changes; no new tests (purely config + headers).

### 2026-04-28 · v1.19.0 — Today page redesign + mobile nav fix + IllusCountdown port

The user sent a mockup for the homepage and pointed out mobile nav was broken after v1.17.0's responsive pass. This release rebuilds the Today page to match the mockup, unifies the mobile breakpoint, and ports the IllusCountdown SVG that v1.15.0's C6 had skipped.

**Today page — three-column equal grid.** The pre-v1.19.0 layout had a full-width countdown band at top with a 2/3 + 1/3 grid below (My tasks + RSVPs/Upcoming). Replaced with a single 3-column row at `lg:` breakpoint where each card has `h-full` so they line up to the tallest. Cards stack on mobile.

- **Column 1 — CountdownCard:** Marigold-tinted (`bg-marigold-100/60`) card with the new `IllusCountdown` watermark top-right at 18% opacity. Inside: "UNTIL THE WEDDING" caps label + M/W/D unit toggle on one row; giant primary number + unit label below; secondary breakdown segments (when unit=W or M) at smaller text underneath; couple label + `${date} · ${venue}` muted line at the bottom. The `ceremonyLabel` prop is gone — the schedule covers ceremony time, the countdown card is now about the date itself.
- **Column 2 — My open tasks:** Header with `{N} open` count chip; list of 5 tasks with priority dot column (1×7 colored bar), disabled checkbox (so the visual matches the mockup; live toggling stays on `/tasks`), title, due date (overdue dates in red). Footer link "See all {totalTaskCount} tasks →" — the total is a fresh DB count.
- **Column 3 — Upcoming events:** [TodayEventsCard](src/app/(app)/TodayEventsCard.tsx) restyled to match the column. Header reads "Upcoming events" (was "Upcoming"); Mine/Everyone toggle styled as a pill group matching the countdown card's M/W/D toggle; default persona flipped to **Mine** (better default for wedding-party users; couple flips to Everyone in one click). Audience tags rendered below each event title. Footer link "Full schedule →".

The pre-v1.19.0 standalone "RSVPs · {N} pending" card is gone — the snapshot strip below the grid already shows the breakdown.

**Mobile nav fix.** v1.17.0's mobile pass used Tailwind `sm:` (640px) for new responsive rules but `globals.css` swapped sidebar/tabbar at 720px. The 640–720px band saw both nav modes plus desktop-styled hover-fades. Unified `globals.css` at 640px. Plus: `MobileTabBar.tsx` active-state now treats `/today/*` as part of the Today tab's scope, so `/today/day-of` highlights the Today tab on mobile (it showed nothing before).

**Files changed:** 5 modified (page, CountdownCard, TodayEventsCard, globals.css, MobileTabBar) + 1 new SVG (IllusCountdown in [Illustrations.tsx](src/components/ui/Illustrations.tsx)). No schema changes; no new tests (visual + state).

### 2026-04-28 · v1.18.5 — Bugfix: edit questions and decisions

v1.18.0 surfaced decisions in the nav, which made an existing bug visible: questions and decisions could be created (via the `+ New` toggle) and resolved (via `AnswerForm`), but never edited. The shared Task model already had `updateTask` and `deleteTask` actions; the gap was purely that `QuestionsClient.tsx` rendered no Edit/Delete buttons on each row — only the AnswerForm.

Refactored each list row into a stateful `Row` component (mirrors `TaskRow.tsx`) with Edit + Delete buttons that render full-opacity on touch and hover-fade on desktop (the v1.17.0 mobile-pass pattern). Edit toggles the row into an inline `TaskForm` re-using the same form the `+ New` toggle uses for creation. Delete confirms then calls `deleteTask`, which is already polymorphic per A5 (v1.2.0) — the gate auto-dispatches to `requireEdit("questions")` for QUESTION/DECISION rows.

Page query extended to pass `notes` and `tags` to the client so the edit form can populate them. No schema changes; no new server actions.

### 2026-04-28 · v1.18.0 — Decisions surfaced in nav + planner-only backlog catalogued

Two small things that fix a discoverability gap and pin the next chunk of work in the ROADMAP.

**Decisions are now visible.** The Task model has supported a `DECISION` type since the beginning — with its own icon (△), its own filter chip on the /questions page, even its own metadata field (`decisionAnswer`). But the sidebar nav said "Questions", the count badge only counted `QUESTION`-typed tasks, and the page title said "Questions" — so users (correctly) believed decisions had nowhere to live. Three small changes:
- [nav-config.ts](src/components/shell/nav-config.ts) renames the entry to "Questions & Decisions".
- [AppShell.tsx](src/components/shell/AppShell.tsx) `getCounts` now counts `type IN (QUESTION, DECISION) AND status != DONE` for the badge.
- [questions/page.tsx](src/app/(app)/questions/page.tsx) header reads "Questions & Decisions" and the subtitle splits the count into questions vs decisions. The "+ New question" button became "+ New" with the type-picker visible (`showType={true}`) so creating a Decision from this page is one click.

No data migration — the rows have always been there, they're just discoverable now.

**Planner-only backlog catalogued.** ROADMAP's *Deferred / Backlog* section gained a "Planner-only feature shortlist (post-v1.17.0)" subsection with six items the user picked from a wider menu: audit log viewer in Settings, search beyond /guests, custom fields for Supplier + Task, print stylesheet for /budget + /payments, email reminders / nudges (planner-facing only), BookSection audience overrides. Two items from the original menu (public RSVP form, guest portal) were explicitly dropped under a new standing rule:

> **Wedding Hub is admin-only — planners + couple + wedding party. Guest data is managed via Say I Do, not in-app.**

Recorded as a top-of-section note so future feature drafts default to "planner-facing" rather than "guest-facing".

**Files changed:** 3 modified, 0 new. No schema changes. Tests untouched (existing tests still pass — this is purely surface).

### 2026-04-28 · v1.17.0 — Countdown breakdown · mobile pass · guest list filter/sort

Three user-asked items bundled.

**Countdown card breakdown redesign.** Pre-v1.17.0, the countdown showed a giant primary number (e.g. "4") + small "+ 2 weeks 3 days" leftover line — visually inconsistent: the "4" dominated and the "1 day" got buried at text-xs. Now renders as inline equally-prominent segments — `4 months · 2 weeks · 3 days` with each number at the same large font and a muted dot separator. Single-unit cases (just days) collapse to one segment naturally. Same toggle (M / W / D) controls the most-prominent unit; finer-grained leftovers always render at the same prominence. The toggle buttons themselves got bigger tap targets on mobile (text-xs px-3 py-1) while keeping the compact desktop look (sm:text-[10px] sm:px-2 sm:py-0.5).

**Mobile usability pass.** A focused audit of the codebase found 20 issues across three tiers; this release picks the highest-leverage Tier 1 + Tier 2 fixes:
- [CountdownCard](src/app/(app)/CountdownCard.tsx) min-width unblocks shrink to <320px (was `min-w-[200px]`, now `min-w-0 sm:min-w-[200px]`).
- [ScheduleTable](src/app/(app)/schedule/ScheduleTable.tsx) hides the Where + Audience columns at `<md` and echoes location into the Event cell with a 📍 prefix, so mobile users still see the venue without a horizontal-scroll dance.
- [TaskRow](src/app/(app)/tasks/TaskRow.tsx) and ScheduleTable's edit/delete actions used `opacity-0 group-hover:opacity-100` — invisible on touch. Now visible by default, hover-fade reserved for desktop (`sm:opacity-0 sm:group-hover:opacity-100`).
- [QuickCapture](src/components/shell/QuickCapture.tsx) modal pulled in to `pt-6` on mobile (was `pt-20` everywhere — pushed input below iPhone SE viewport).
- [TaskList](src/app/(app)/tasks/TaskList.tsx) auto-switches to list view on first load when window width <640px. The kanban board can't be used on touch (no drag), and columns crush at narrow widths.
- [today/day-of](src/app/(app)/today/day-of/page.tsx) hero band is `sticky top-0` on mobile so the venue + date stay visible while scrolling. Desktop keeps the static layout (plenty of room).

The remaining audit findings (PermissionMatrix mobile rework, generic Button size bumps, TaskBoard column headers) are tracked but not blocking — the surfaces above cover the day-of mobile use case (wedding-party members on-site).

**Guest list filtering, sorting, default preference.** [GuestList](src/app/(app)/guests/GuestList.tsx) gains four dropdowns under the search bar: Sort (5 options — household name asc/desc, side, size desc/asc), RSVP filter (5 — all + 4 statuses), Side filter (4), Show filter (3 — all / has-children / has-dietary). All filter logic runs client-side against the SSR payload, so changes are instant. Two localStorage slots: `wh_guests_view_current` (last-used, restored every visit) and `wh_guests_view_default` (explicit user-pinned default). UI exposes "Save as default" when the current state diverges from the saved default, "✓ default" when they match, and a "Reset to default" / "Reset" link when the current state isn't empty. The household-passes-filter rule is "any guest matches" — hiding a household because half its members declined would lose the host.

**Files changed:** 7 modified, 0 new. No schema changes. 186 unit tests still passing; e2e green; build clean.

### 2026-04-28 · v1.16.0 — Task CSV importer + guest names on the seating canvas

First post-audit feature release. Two user-requested pieces of polish on top of v1.15.0.

**Task CSV importer.** New `/tasks/import` route ([page.tsx](src/app/(app)/tasks/import/page.tsx) + [TaskImportClient.tsx](src/app/(app)/tasks/import/TaskImportClient.tsx)) mirrors the v0.8.0 guest importer pattern: paste CSV/TSV, columns auto-mapped (heuristic in [csv.ts](src/lib/csv.ts) recognises Title / Type / Priority / Status / Due / Assignee / Tags / Notes plus common synonyms — Description, Kind, Urgency, State, Deadline, Owner, Labels, Comments), preview with row-by-row validation, commit creates Task / Question / Decision rows. Coercion helpers handle UK-style `DD/MM/YYYY` dates as well as ISO; assignee emails resolve against the User table at preview time so the user sees "matched" vs "no user with this email — importing unassigned" before clicking Import. 19 new unit tests cover the coercion + heuristic matrix.

The `/tasks` page header gets an "Import CSV" link next to the existing "+ Add task" toggle — gated on `canEdit("tasks")` like the rest of the write surface.

**Guest names on the seating canvas.** Builds on v1.14.0's C7 per-seat dots: each occupied seat now renders the guest's first name as a small text label just outside the dot, anchored away from the table centre so the text reads outward. Names truncate to 10 chars (catches "Christopher" → "Christoph…"). Empty seats stay as just the dot. HEAD-shaped tables unchanged (they don't have the radial seat layout the labels assume).

**Files changed:** 4 modified, 3 new. 19 new unit tests (186 total). Build, lint, typecheck, e2e all green. No schema changes.

### 2026-04-28 · v1.15.0 — Phase R5b: illustrations ported + Custom Fields UI (C6 + C10)

The two larger-surface items from the user's Bucket C build list. Both shipped together because they're orthogonal — illustrations touch presentation, custom fields touch data — and bundling kept the deploy cycle short.

**C6 — Illustration set with light/dark variants per scene.** The prototype (`prototype/illustrations.jsx`) had 19 SVG components using CSS-variable theming, none of which had ever made it into production — empty states shipped as plain `<p>No items yet.</p>` text. This release ports 14 of them into [src/components/ui/Illustrations.tsx](src/components/ui/Illustrations.tsx) (the 6 motif icons in v1.14.0's `EventMotifIcon` already covered the 16px set). Variable substitution: prototype's `var(--moss-500)` → production's `var(--color-moss-500)`; same for marigold, surface, etc. Theming carries through to dark mode automatically.

Wired into:
- **Wedding Book hub** — `bookSceneFor(slug)` resolves a 44px scene illustration per known section slug (wedding-party, venue, food-drink, photography, guest-experience, legal-admin, accommodation). Falls through to the existing emoji glyph for legacy/user-created sections.
- **Empty states** — new shared `<EmptyState illustration={…} title body action />` component renders the SVG + a friendlier title/body. Used at `/schedule` (no events), `/seating` (no tables), `/payments` (no payments), `/tasks` (no tasks match filter), `/guests` search-with-no-results.

**C10 — Custom Fields UI.** The `CustomField` registry table existed in the schema with zero references in code. This release wires it end-to-end for **Guest** (other entities can be added later by extending the entity dropdown).

- **Schema:** additive Prisma migration adds `Guest.customFieldValues Json?` for the per-guest value bag. Keyed by `CustomField.id`.
- **Pure helpers** at [src/lib/custom-fields.ts](src/lib/custom-fields.ts) — `parseCustomFieldValue` validates against the field's type (`text` / `number` / `date` / `select`), throws structured errors that the toast UX surfaces. `formatCustomFieldValue` for display ("—" for null, en-GB locale for numbers, "1 Sep 2026" for dates). `mergeCustomFieldValue` merges into the existing JSON without mutation; `null` value drops the key entirely. 18 unit tests.
- **Settings panel** at [CustomFieldsPanel.tsx](src/app/(app)/settings/CustomFieldsPanel.tsx) — couple-only CRUD for definitions. Add field with name + type + (for `select`) comma-separated options. Non-couple users see a read-only list so they understand what's available.
- **Guest detail block** at [guests/[id]/CustomFieldsBlock.tsx](src/app/(app)/guests/[id]/CustomFieldsBlock.tsx) — renders one row per definition with click-to-edit inline forms. Type-correct inputs (`<input type="number">`, `<input type="date">`, `<select>` with options). Errors surface as toasts via the v1.12.0 `notify` bus.
- **Server action** at [guests/actions.ts](src/app/(app)/guests/actions.ts) — `setGuestCustomField(guestId, fieldId, rawValue)` re-validates server-side (never trust the client), writes the typed value into the JSON column, audits the change.

**Files changed:** 11 modified, 5 new, 1 migration. 18 new unit tests (167 total). Build, lint, typecheck, e2e all green.

**Bucket C final tally — 8/12 shipped:** C1, C4, C6, C7, C8, C9, C10, C11. Accepted as drift / deferred: C2, C3, C5, C12. Every item from REMEDIATION-PLAN's Bucket C now has a closed status. Only **R6** (backup hardening + restore drill) remains in the post-audit programme.

### 2026-04-28 · v1.14.0 — Phase R5a: Bucket C drift decisions (C1 + C4 + C7 + C11)

The user walked through the 12 Bucket C drift items and assigned a decision per row. C8 and C9 marked resolved (already shipped earlier — v1.9.0 expanded the Wedding Book hub to 7+3 cards; v1.3.0's A3 implementation includes opportunistic prune so a separate cron isn't needed at our scale). C2, C3, C12 deferred. C5 accepted as drift (covered by R6's restore-drill plan). C6 + C10 deferred to R5b — both have unexpectedly clean footholds (prototype already has 19 illustration components ready to port; schema already has a `CustomField` registry table) but each touches a meaningful chunk of UI and benefits from a focused session.

**C1 — Wedding Book per-page audience overrides.** Adds `BookSubsection.visibility EVERYONE|COUPLE_ONLY` (additive Prisma migration, mirrors `FileVisibility`). Read path: non-couple users get filtered to `EVERYONE` rows on `/book/[slug]` so the couple can stash Hen Do plans without Josh seeing them. Write path: a new `setBookSubsectionVisibility` action gates on `user.isCouple === true` (same pattern as the v1.2.0 A6 file-visibility lockdown — non-couple editors can edit content, but only the couple decides what's couple-only). UI: the [SubsectionEditor](src/app/(app)/book/[slug]/SubsectionEditor.tsx) shows a 🔒 "Couple only" pill in the header for any couple-only page, plus a "Make couple-only" / "Make public" button for the couple. Errors roll back via the toast bus.

**C4 — Per-field manual-edit tracking.** Adds `Guest.lastEditedFields Json?` (in the same migration as C1 to save a round-trip) — shape is `{ "fieldName": "<ISO timestamp>" }`. Pure helpers at [src/lib/last-edited-fields.ts](src/lib/last-edited-fields.ts) (`diffEditedFields`, `mergeEditedFields`, `daysSinceEdited`); the [updateGuest](src/app/(app)/guests/actions.ts) action now diffs the next payload against the existing row and stamps only fields that actually changed (arrays compared order-insensitively, null/undefined/empty-string treated equivalent so spurious form re-saves don't pollute the map). The B1 import preview reads the map and appends a warning per row when a diff would overwrite a field manually edited in the last 14 days — surfaces inline via the existing warnings render path with a "you edited dietary 3 days ago — re-importing will overwrite (untick to keep)" message that points at the per-field opt-out. 17 new unit tests cover the diff/merge/days-since matrix.

**C7 — Round-table per-seat position dots.** [SeatingCanvas](src/app/(app)/seating/SeatingCanvas.tsx) now renders one small dot per seat just outside each round table's circumference, evenly spaced (with seat 0 at "twelve o'clock" matching how a host reads round tables). Filled (moss) = occupied, outlined (canvas) = empty. Lets the eye scan the canvas for free seats without focusing each table. Pure SVG, theme-aware via existing CSS variables. No-op for HEAD-shaped tables.

**C11 — Schedule event motif icons.** Six 16px SVG icons ported from [prototype/illustrations.jsx](prototype/illustrations.jsx) into [EventMotifIcon.tsx](src/components/ui/EventMotifIcon.tsx) (ring / candle / plate / camera / bouquet / suitcase). The pure `classifyEventMotif(title)` heuristic does word-boundary regex matching — case-insensitive, falls through to `null` (no icon) for unrecognised titles rather than guessing. Plurals handled (`portraits` → camera, `photos` → camera). "Wedding Breakfast" intentionally classifies as plate, not ring (ring is reserved for the explicit ceremony/vow keywords). Wired into [EventNode](src/app/(app)/schedule/EventNode.tsx) (timeline view) and [ScheduleTable](src/app/(app)/schedule/ScheduleTable.tsx) (table view); the existing prototype's CSS-variable theming carries through to dark mode automatically. 8 new unit tests lock the title-to-motif contract.

**Files changed:** 9 modified, 3 new, 1 migration. 25 new unit tests (149 total). e2e + build green.

**Bucket C status after v1.14.0:**
- ✅ Resolved: C8 (v1.9.0), C9 (v1.3.0), C1, C4, C7, C11 (v1.14.0)
- 🟡 R5b deferred: C6 (illustrations), C10 (custom fields UI)
- 🟠 Deferred / accepted drift: C2, C3, C5, C12
- 6/12 shipped; 2 in queue; 4 acknowledged drift.

### 2026-04-28 · v1.13.0 — Phase R4c: polish MINORs (B6 + B7 + B9) — Bucket B complete

The last three Bucket B items from REMEDIATION-PLAN. Three small surface improvements that close out R4 and the post-audit programme to one less than zero unresolved findings (v1 audit's 9 MAJORs and ~10 MINORs all triaged: most shipped, the rest accepted as drift in Bucket C).

**B6 — Quick-capture event time picker.** The `C` modal used to silently drop captured Events at "now + 1 hour, rounded to top of hour" with no way to edit before submit — Jamie surfaced this with the "I just typed it and it disappeared into next month somewhere" friction. The modal now shows a `<input type="datetime-local">` when the type tab is "Event", defaulting to next round hour but visible and editable. A "↺" reset button puts it back if the user changes their mind. The action's schema gained an optional `startTime` string; the action parses it as local time and falls through to the old "next round hour" default if absent or unparseable, so existing call sites keep working.

**B7 — Mobile day-of scroll-to-NOW.** On a phone, opening `/today/day-of` mid-ceremony used to land the user at the start of the day — they had to scroll past ten past-events to find what was actually happening. New tiny client component [ScrollToCurrent.tsx](src/app/(app)/today/day-of/ScrollToCurrent.tsx) takes a target id and `scrollIntoView({ behavior: "smooth", block: "center" })`s on mount. The page picks the most-relevant target — `now` if present, else `next` — and threads the id through. Smooth scroll is intentional (the visible motion tells the user "we adjusted the scroll for you" rather than just appearing to load slowly).

**B9 — Inline song-request add on guest detail.** The guest detail's Songs section was read-only with a "Manage on Songs →" deep-link — fine for batch entry, friction for the "while I'm looking at Aunt Margaret's row, just type her request" flow Aimee surfaced. New [AddSongRequestInline.tsx](src/app/(app)/guests/[id]/AddSongRequestInline.tsx) renders a tiny inline form in the section header (title + optional artist + Add + ×). On submit, fires the new `addSongRequestForGuest` server action ([guests/actions.ts](src/app/(app)/guests/actions.ts)) which is gated on `requireEdit("guests")` and writes via `db.songRequest.create` with an audit row. Errors toast via the B5 notify bus rather than throwing. The page revalidates so the new entry appears in the list above without a manual reload.

**Files changed:** 5 modified, 2 new. No schema changes. Build, lint, typecheck, all 126 unit tests, 5 e2e specs all green.

**Bucket B final tally:** 11/13 shipped (B1 + B2 + B3 + B4 in v1.11.0; B5 + B8 + B11 + B12 in v1.12.0; B6 + B7 + B9 in v1.13.0). B10 + B13 were already done before R4 started. Every item from REMEDIATION-PLAN's Bucket B is now closed.

**Next phases (REMEDIATION-PLAN sequencing):** R5 (Bucket C drift decisions — C1 audience overrides, C7 round-table seat dots, C9 magic-link prune cron, others deferred or accepted) and R6 (backup hardening + restore drill). The post-audit work that started with v1.2.0 is approaching its planned end.

### 2026-04-28 · v1.12.0 — Phase R4b: data + UX MINORs (B5 + B8 + B11 + B12)

The second batch of REMEDIATION-PLAN Bucket B. v1.11.0 was the three MAJORs; v1.12.0 is the four MINORs that, together, lift daily-use friction and close the last data-integrity gap surfaced by the audit.

**B12 — `assignGuestToSeat` race-condition window.** The action used to do `updateMany` (clear other guests off the seat) followed by `update` (assign the new guest) as two separate Prisma calls. With two simultaneous drags onto the same seat, both could clear and both could try to assign — leaving the DB in a half-applied state until the unique constraint on `Guest.tableSeatId` fired. Now wrapped in `db.$transaction([…])` so either both updates land or the unique constraint rejects the second offender atomically. New integration test at [tests/integration/seating.test.ts](tests/integration/seating.test.ts) fires two parallel `assignGuestToSeat` calls and asserts exactly one guest ends up at the target seat. (Postgres serialisation may also cleanly serialise the two transactions — both outcomes are acceptable; the test asserts the *invariant*, not a specific timing.)

**B8 — Sticky search on `/guests`.** Aimee surfaced this — the guest list scrolled forever once we hit ~50 households. New thin client wrapper [GuestList.tsx](src/app/(app)/guests/GuestList.tsx) wraps the list with a sticky search input above the household blocks. Filters case-insensitively against household name and each guest's first/last/full name. Client-side because the full guest list is already in the SSR payload — no need for a round-trip per keystroke. Counter shows `N/M` matching while a query is active; "×" button clears.

**B11 — Dark mode persistence per-account.** Pre-B11 the toggle wrote to localStorage only — sign in on a new device and you're back to light. Additive Prisma migration adds `User.darkMode Boolean?` (nullable so existing rows aren't forced to commit). New server action `setDarkModePreference` in [(app)/actions.ts](src/app/(app)/actions.ts); pure decision helper [src/lib/dark-mode.ts](src/lib/dark-mode.ts) (`resolveDarkMode`) covers the precedence rule (DB > localStorage > light). [AvatarMenu](src/components/shell/AvatarMenu.tsx) gets the user's `darkMode` prop, syncs DB → localStorage on mount (so the next page-load's pre-hydration script paints right), and fires the action on toggle. 7 new unit tests on the precedence matrix.

**B5 — Global server-action error UX.** The audit's last MINOR — raw `throw new Error("Forbidden: …")` from `requireEdit` was surfacing as Next's red error overlay in dev and a generic error page in prod. Two-layer fix: (1) [(app)/error.tsx](src/app/(app)/error.tsx) catches anything thrown from the (app) tree and renders a friendly card — detects "Forbidden:" prefix and shows a 🔒 + the bare message, otherwise generic "Something went wrong" with the raw message in dev only and a "Try again" button. (2) Lightweight toast bus at [src/lib/notify.ts](src/lib/notify.ts) (window-event based — no Provider plumbing) + [Toaster](src/components/ui/Toaster.tsx) component mounted in AppShell. The seating drag handlers ([TableCard](src/app/(app)/seating/TableCard.tsx), [SeatingCanvas](src/app/(app)/seating/SeatingCanvas.tsx)) now toast on errors instead of swallowing them silently — the most obvious B12 race window users would actually feel.

**Files changed:** 13 modified, 7 new, 1 migration. 7 new unit tests + 2 new integration tests (seating race + cascade). Build size +0.3 KB shared (Toaster component). e2e specs untouched (no new auth-redirect surfaces).

**Bucket B status after v1.12.0:** B1, B2, B3, B4, B5, B8, B11, B12 shipped (8/13). B10 + B13 already done before R4 started (2/13). Remaining for R4c: B6 (quick-capture event time picker), B7 (mobile schedule scroll-to-NOW), B9 (inline song-request on guest detail) — 3 polish MINORs, ~2.5 hrs.

### 2026-04-28 · v1.11.0 — Phase R4a: workflow polish (B1 + B2 + B3 + B4)

Closes the first batch of Bucket B from REMEDIATION-PLAN — the three MAJORs plus one ergonomic dependency. Each ships with a regression test per the standing rule.

**B1 — CSV import per-field diff.** Re-importing a CSV that matches an existing guest used to be all-or-nothing: the preview said "merge" and you took it on faith. The new flow extracts a pure decision module ([src/lib/csv-merge.ts](src/lib/csv-merge.ts) — `decideGuestMerge`) that both `previewImport` and `commitImport` consume; preview rows now carry `fieldDiffs` showing every "old → new" pair the merge would apply, and the UI in [ImportClient.tsx](src/app/(app)/guests/import/ImportClient.tsx) renders an expandable disclosure beneath each merge row with a checkbox per field. Un-tick a field and that overwrite is skipped on commit — surfaced as `optOut: { rowIndex: ["dietary"] }` plumbed through the action. The post-import success card reports how many fields were preserved by opt-outs. The audit metadata records the count too, so a future operator can grep for "user un-ticked dietary on 3 merge rows in the Apr 28 import". Closes the "anxiety on re-import" friction Bryony surfaced. Backed by 21 new unit tests covering the diff/opt-out matrix.

**B2 — `BudgetLine.actual` recomputes from `Payment` rows.** The budget page used to show a stored `actual` that drifted from the `Payment` records linked via FK — log a £500 payment and the line still said £450 because nobody updated `actual`. New rule: `actual` is a manual override. When non-null, it wins; when null, the page sums `Payment.amount` for that line. Pure decision logic in [src/lib/budget.ts](src/lib/budget.ts) (`computeActual`, `isManualOverride`, `sumOfPayments`); both [BudgetClient.tsx](src/app/(app)/budget/BudgetClient.tsx) and [glance/page.tsx](src/app/(app)/glance/page.tsx) now use it. The line edit form labels the state ("Manual override active. Clear 'Actual' to recompute from payments…" vs "Actual is computed from N payments. Set a value to pin a manual override."), and computed totals get a subtle "Σ" badge in the table so the user can tell at a glance which lines are pinned vs derived. One additive Prisma migration adds `@@index([budgetLineId])` to `Payment` so the per-line aggregate doesn't sequential-scan on every render. 11 new unit tests on the computeActual matrix.

**B3 — Supplier follow-up auto-creates a Task.** Logging a supplier comm with a `followUpAt` date used to silently store the date and nothing else — Jamie had to remember to manually create a Task or the follow-up vanished. Now the comm + auto-task land in a single `db.$transaction`: pure decision in [src/lib/supplier-follow-up.ts](src/lib/supplier-follow-up.ts) (`decideFollowUpTask`) returns the Task payload (title `Follow up: <supplier>`, due = `followUpAt`, assignee = comm creator, tags `["supplier-follow-up", "supplier:<id>", "comm:<id>"]`), the action in [suppliers/actions.ts](src/app/(app)/suppliers/actions.ts) creates both atomically. Tag-based linkage avoids a schema change for now; if the soft FK proves clunky we can promote to `Task.sourceCommId` in R5. The comm log entry in [SupplierDetailClient.tsx](src/app/(app)/suppliers/[id]/SupplierDetailClient.tsx) gets a "Task ↗" pill linking to `/tasks` next to the existing "Follow-up <date>" pill. Audit log records both the comm-create and the task-create with cross-references in metadata. 4 new unit tests for the decision contract.

**B4 — Supplier card last-message summary.** Suppliers list now shows a muted "Last (channel, relative date): <summary truncated to 80 chars>" line on each card, so you can scan the list and see who you last spoke to without clicking in. [suppliers/page.tsx](src/app/(app)/suppliers/page.tsx) extends the query with `include: { communications: { take: 1, orderBy: { createdAt: "desc" } } }`; [SupplierCard.tsx](src/app/(app)/suppliers/SupplierCard.tsx) renders. No render at all when the supplier has no comms — negative-space cruft would just clutter the cards.

**Files changed:** 12 modified, 4 new, 1 migration. 36 new unit tests (119 total). Build size unchanged.

**Out of scope, deferred to R4b/R4c:** B5 global error UX, B6 quick-capture event time picker, B7 mobile schedule scroll-to-NOW, B8 guest search, B9 inline song-request on guest detail, B11 dark-mode persistence, B12 seating race-condition transaction. B10 + B13 already done in prior releases.

### 2026-04-28 · v1.10.0 — Phase R3 follow-on: Postgres integration job + Playwright e2e in CI

Closes the two open items from the original R3 scope (`T2` integration tests against a real DB and `T3` Playwright e2e). v1.4.0 wired Vitest + a TESTING.md plan; v1.10.0 actually runs both new tiers on every PR.

**`integration` job** — a new GHA job in [.github/workflows/build.yml](.github/workflows/build.yml) that boots `postgres:16-alpine` as a service container, runs `prisma migrate deploy`, and executes `npm run test:integration` against a real database. Catches regressions that unit tests with mocked `loadPermissions` can't see — e.g. cascade behaviour on the `Guest.parentGuestId` self-relation, or a Prisma schema field that compiles fine but doesn't actually exist after migrate. Postgres health-check ensures the container is ready before tests run; runs in parallel with `verify` (typecheck + lint + unit) so total CI wall-clock doesn't grow much.

**`e2e` job** — a Playwright job needing both `verify` and `integration` (no point in running browsers if static checks failed). Caches `~/.cache/ms-playwright` keyed on the `@playwright/test` version, so subsequent runs reuse the Chromium binary instead of re-downloading ~150 MB. The `webServer` block in [playwright.config.ts](playwright.config.ts) auto-starts `npm run dev` (or `start` in CI) and waits for `/api/health` before tests fire. On failure the HTML report is uploaded as an artifact (retention 7 days) so a failed PR check links straight to the trace viewer.

**First specs in [e2e/auth-redirect.spec.ts](e2e/auth-redirect.spec.ts)** — five anonymous-flow tests covering the audit's permissions matrix at the routing layer. `/` bounces to `/signin`; `/guests` bounces to `/signin?callbackUrl=...` with the original target preserved; `/budget` bounces to `/signin` (auth gate fires before the couple-only gate); `/api/health` is publicly reachable; `/signin` renders without authentication. These are the regression net for `src/middleware.ts` — couple-only redirects from `/budget` and per-section `canView` gates remain at the unit + integration tier, where they're cheaper to assert.

**`build` job depends on `[verify, integration, e2e]`** — Docker images are not built (and definitely not tagged) unless every test tier is green. Combined with the standing rule from v1.2.x ("never tag a build until GHA goes green on the same SHA"), this means a release tag is now a hard guarantee that unit + integration + e2e all passed against the SHA that produced the image.

**Files:**
- New: [.github/workflows/build.yml](.github/workflows/build.yml) (`integration` + `e2e` jobs added; `build` rewired)
- New: [playwright.config.ts](playwright.config.ts), [e2e/auth-redirect.spec.ts](e2e/auth-redirect.spec.ts)
- Modified: [package.json](package.json) (`@playwright/test` devDep, `test:e2e` + `test:e2e:ui` scripts, version bump)
- Modified: [.gitignore](.gitignore) (`/playwright-report`, `/test-results`, `/playwright/.cache`)

**Out of scope, deferred to a later phase:** Playwright specs covering authenticated flows (would require seeding a session in CI — adds friction; punted until R4 or later when a richer fixture story is needed). Per-row visibility integration tests (B-tier polish; not blocked by R3).

### 2026-04-28 · v1.9.0 — Book sections aligned with prototype + Spotify env-var compose fix

Two unrelated changes bundled because both shipped on `dev` before the v1.9.0 tag was cut.

**Bug fix: `docker-compose.yml` didn't forward `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` to the web container.** Latent since v0.14.0 (when Spotify launched). `next dev` on the dev box reads `.env` directly, so local builds always saw the keys — but production only forwards env vars that are explicitly listed in the `web` service's `environment:` block. The Spotify keys were never on that list, so the production container ran with `SPOTIFY_CLIENT_ID=undefined` no matter what was in `.env`. Surfaced when the user added the keys, restarted the stack, and `docker exec wedding-hub-web-1 printenv | grep SPOTIFY` came back empty.

Fix in [docker-compose.yml](docker-compose.yml) — two new lines on the `web` service:

```yaml
SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID:-}
SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET:-}
```

**Production deploy needs a manual compose-file edit** (Compose Manager Plus on Unraid keeps its own copy; the repo's compose file isn't auto-pulled). In CMP → Edit Stack → YAML tab, add the two lines to the `web` service's `environment:` block. Save → Up. After that the `printenv` check will show the values and the Settings → Spotify integration chip will flip to ✓ Configured.

**Book sections aligned with prototype.** The v1.4.0 seed shipped 5 Wedding Book sections (Ceremony, Reception, Logistics, Photography, Wedding party) but the design brief in `prototype/WeddingBookPage.jsx` defines 7 canonical sections (Wedding Party, Venue, Food & Drink, Photography, Guest Experience, Legal & Admin, Accommodation). The v1.0.0 audit flagged the gap as a **MINOR** under design fidelity (`Wedding Book hub has 5 not 7 cards`). v1.9.0 closes it.

**Seed change** ([prisma/seed.ts](prisma/seed.ts) `seedBookSections`):

- Adds 5 new sections matching the prototype: `venue`, `food-drink`, `guest-experience`, `legal-admin`, `accommodation`. Orders 2, 3, 5, 6, 7 respectively.
- Renames `photography` from "Photography & Shot list" → "Photography & Videography" (slug stays the same, so the `/book/photography` custom route still resolves to the shot-list checklist).
- Renames `wedding-party` from "Wedding party" → "Wedding Party" (capitalisation only).
- Sets the prototype set to orders 1–7.
- Keeps the 3 v1.4.0 legacy sections (Ceremony, Reception, Logistics) but pushes their orders to 8–10 so they sort to the bottom of the hub. They aren't deleted — any subsection content the user added survives, and the user can delete them via the UI later if they want a clean 7-card hub.

Re-running the seed (`docker compose exec web node prisma/seed.js`) is idempotent: existing rows have title + order refreshed, new rows are added, no subsection content is touched. Production picks the changes up after the next deploy + seed run.

**[SECTION_META](src/app/(app)/book/page.tsx)** updated with accent / glyph / description for all 10 slugs (5 new + 5 existing). Accent palette and descriptions ported directly from `prototype/WeddingBookPage.jsx` BOOK_SECTIONS:

| Slug | Accent | Glyph | Description |
|---|---|---|---|
| wedding-party | moss-100 | 👰 | Outfits, roles, stag & hen, ring keepers |
| venue | moss-50 | 🏛 | Ceremony, reception, signage, centrepieces |
| food-drink | marigold-100 | 🍽 | Breakfast, evening food, cake, drinks |
| photography | moss-100 | 📷 | Package, shot list, locations, day-of contact |
| guest-experience | marigold-100 | 🎉 | Pixel Party, table games, photo booth, favours |
| legal-admin | moss-50 | 📜 | Notice of marriage, documents, witnesses |
| accommodation | marigold-100 | 🛏 | Bridal suite, bridesmaids, groomsmen |

**Production deploy:** code-only release plus a one-time seed re-run. After `docker compose pull && up -d`:

```bash
docker compose exec web node prisma/seed.js
```

Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.9.0 SHA.

### 2026-04-28 · v1.8.0 — Spotify integration setup guide + status chip

The Spotify config is env-var-driven (we explicitly scrapped storing it in the DB in v1.7.0 / item I). v1.8.0 closes the discoverability gap that surfaced when the user couldn't tell whether their newly-added env vars were live: a status chip on the Songs page header, a full setup-guide panel in Settings.

**[SpotifySettingsPanel.tsx](src/app/(app)/settings/SpotifySettingsPanel.tsx)** — server component on Settings between MyProfilePanel and the permission matrix. Two states:

- **Configured** (`isSpotifyConfigured()` returns true): green `✓ Configured` chip, brief explainer, and a **collapsed** setup-steps `<details>` for reference.
- **Not configured**: amber `⚠ Not configured` chip, and the setup steps **expanded by default** so the path-to-fix is in the user's face.

Setup-guide depth differs by tier:
- **Couple-tier:** full step-by-step — Spotify Developer dashboard → create app → copy ID/secret → Compose Manager Plus → .ENV tab → Save → Up (with the explicit caveat that **Save alone doesn't recreate the container** and `docker compose up -d` is what picks up new env vars). Fifth step: verify with `docker compose exec web printenv | grep SPOTIFY`. Final step: link a playlist URL on /songs.
- **Non-couple:** "🔒 Setup requires server-level env-var access. Ask Jamie or Bryony to flip it on." — gives them context without exposing infra detail.

The panel includes the Client-Credentials-public-playlist caveat ("during each sync the playlist must be public on Spotify") so this isn't a debugging surprise later.

**Status chip on /songs** ([page.tsx](src/app/(app)/songs/page.tsx)) — `🎵 Spotify ✓` (moss) or `🎵 Spotify off` (marigold) in the header `actions` slot, deep-linking to `/settings#spotify-integration`. The panel has `id="spotify-integration"` + `scroll-mt-24` so the anchor lands cleanly below the page header.

No schema, no env, no code-path changes — purely additive UI. Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.8.0 SHA.

### 2026-04-28 · v1.7.0 — Tier 3 / A: +1s as own Guest rows

The biggest of the user-feedback items: a +1 used to be a string field on the host (`Guest.plusOneName`) that didn't show up in any totals. From v1.7.0 a +1 is materialised as a real `Guest` row linked to the host via a new self-relation, and shows up everywhere a real guest does — Today, Glance, catering brief, seating canvas. Schema is additive; no env changes.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma) + [migration](prisma/migrations/20260428200000_add_guest_parent_for_plus_one/migration.sql)):

```
parentGuestId   String?
parentGuest     Guest?         @relation("PlusOneOf", fields: [parentGuestId], references: [id], onDelete: Cascade)
plusOnes        Guest[]        @relation("PlusOneOf")
@@index([parentGuestId])
```

`ON DELETE CASCADE` so a hard-delete of the host (couple-only path) takes the +1 with it. The soft-archive path is handled in `actions.ts` so the +1 inherits archived state explicitly via a `$transaction`.

**Materialisation logic** ([src/lib/plus-one.ts](src/lib/plus-one.ts) — pure function, 14 unit tests at [tests/unit/plus-one.test.ts](tests/unit/plus-one.test.ts)):

- Pure `decidePlusOneAction(host, child)` returns one of `noop` / `create` / `update` / `archive`.
- Decision rules:
  - `host.plusOneAllowed=true` AND `host.plusOneName.trim() !== ""` → child should exist
  - First materialisation → `create` with `splitFullName(plusOneName)` for first/last, inherit host's householdId / side / rsvp
  - Existing child + sync → `update` (also re-derives first/last from the host's plusOneName, so the host's field stays the source of truth for the +1's display name)
  - `plusOneAllowed` flips to `false` OR name cleared → `archive` the +1 (don't hard-delete; preserves dietary / meal / song-request data if the user later flips it back on)
  - Host is itself a +1 (`parentGuestId` set) → `noop` with `host_is_plus_one` reason
- DB-aware `syncPlusOne` wrapper in [actions.ts](src/app/(app)/guests/actions.ts) does the I/O.

**Lifecycle cascade** (also in actions.ts):

- `createGuest` → `syncPlusOne(created.id)` after the create. Materialises the +1 immediately if conditions are met.
- `updateGuest` → forces `plusOneAllowed=false / plusOneName=null` if the row being edited is itself a +1, then `syncPlusOne`.
- `setGuestRsvp` → `syncPlusOne(id)` so host RSVP changes cascade to the +1.
- `deleteGuest` (soft archive) → `$transaction` that archives both the host and any +1 rows in one go, freeing both seats.
- `restoreGuest` → symmetric `$transaction` to bring the +1 back alongside the host.
- `hardDeleteGuest` → no change (FK cascade handles the +1).

**UI** ([HouseholdBlock.tsx](src/app/(app)/guests/HouseholdBlock.tsx) + [GuestForm.tsx](src/app/(app)/guests/GuestForm.tsx)):

- New `reorderHostsAndPlusOnes` helper groups +1 rows immediately after their host in the household block (orphan +1s go to the bottom).
- +1 rows render with a `+1 of {host.firstName}` info chip (info colour, hover tooltip explaining the cascade behaviour) and visual indent (`pl-10 bg-canvas/40`).
- `GuestForm` takes a new `isPlusOne` prop. When true: first-name, last-name, plus-one-allowed checkbox, plus-one-name input are all `disabled`, with an explanatory banner at the top of the form ("First/last name come from the host's Plus-one name field — edit it there to rename"). Other fields (RSVP, dietary, meal, notes) stay editable so the +1 can have its own preferences.
- Delete confirm copy adapted: archiving a +1 directly suggests toggling the host's plusOneAllowed instead.

**Totals — no special-casing needed.** Today / Glance / Catering brief / Seating canvas all query `Guest` rows directly — the +1 row is a real row, so it shows up in every count without a code change. RSVP donut, "X attending of Y invited", dietary aggregates, per-table seating: all just work.

**Tests** (`npm test` now reports 83 passing across 6 files):

- 14 new cases in `tests/unit/plus-one.test.ts` cover create / update / archive / no-op paths plus the recursion guard.

Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.7.0 SHA.

### 2026-04-28 · v1.6.0 — Tier 2 user-feedback polish

Two visual / structural upgrades from the user-feedback list. No schema, env, or test changes.

**D — Schedule Table | Timeline toggle.** [`/schedule`](src/app/(app)/schedule/page.tsx) now offers two views, persisted per-device via `localStorage` (`wh_schedule_view`):

- **Timeline** (default, unchanged) — vertical timeline with sticky day headers and node markers. Print-friendly.
- **Table** — flat sortable table with When / Event / Where / Audience / actions columns. Useful when there are 20+ events and the timeline becomes long to scroll. Inline edit reuses `EventForm` so the data model stays single.

Wired through a new client component [`ScheduleClient.tsx`](src/app/(app)/schedule/ScheduleClient.tsx) that holds the view state; the server `page.tsx` query is unchanged. Print stylesheet keeps the timeline behaviour regardless of selected view (the toggle lives under `no-print`).

**E — Wedding Book hub card redesign** ([`/book`](src/app/(app)/book/page.tsx)). Match the prototype's BookCard treatment:

- **Accent backgrounds** per section (moss-50 / moss-100 / marigold-100) — looked up by slug from a code-side `SECTION_META` map. User-created sections fall back to a neutral default. No schema migration.
- **Glyph spot** in the top-left corner (💍 ceremony, 🥂 reception, 🗓 logistics, 📷 photography, 👰 wedding-party). Top-right keeps the `→` indicator the prototype uses.
- **Descriptions** under the section title (e.g. *"Order of service, vows, readings, music"*) — also from `SECTION_META`.
- **Hover lift** — `hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`. Matches the prototype's effect.
- **Display font** for the title, semi-bold; subtitle in `text-ink-secondary`; meta count in `text-ink-tertiary`.
- **Wider container** (`max-w-[960px]`) and **auto-fill grid** (`minmax(260px, 1fr)`) to mirror the prototype's 2/3-column layout depending on viewport.

The Photography card still surfaces the shot-list progress (`X of Y captured`) instead of subsection count — that's the special-case logic from v0.13.0 (Phase F2), preserved.

What's still off-spec vs the prototype: real SVG illustrations, full audience picker on subsections, 7-card hub (we have 5). All deferred per the audit report's design-fidelity findings.

Verified: typecheck, lint, build, 69/69 tests, clean `npm ci`. Holding promote until GHA confirms green.

### 2026-04-28 · v1.5.0 — Tier 1 user-feedback polish

Six small fixes from the live-use review (Tier 1 of the issues raised after R3). No schema or env changes.

**Mobile sign-out (G).** The `Sidebar` (which contains `AvatarMenu` → Sign out) has `display: none` at ≤720px viewport — so mobile users had **no path to sign out**. [MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx) now takes a `signOutAction` prop and renders Sign out as the last item in the More sheet, separated by a divider. AppShell threads the existing `signOutAction` server action through.

**Settings UI defence-in-depth for permission elevation (F).** The audit's A2 (settings self-elevation BLOCKER) was fixed server-side in v1.2.0 — `setPermission`, `setUserCouple`, and `removeUser` all throw `Forbidden` for non-couple callers. But the UI still showed clickable Couple checkboxes and permission selects to non-couple users with `EDIT(settings)`, who would only see the error at submit time. Now [PermissionMatrix.tsx](src/app/(app)/settings/PermissionMatrix.tsx) takes `currentUserIsCouple` and disables the controls accordingly:
- Read-only banner explains why for non-couple viewers
- Couple checkbox + section selects gain `disabled` + tooltip when current user isn't couple
- Member × button only renders for couple-tier callers
- Server gates from v1.2.0 still hold — this is purely UI honesty

**Settings page scroll feel (H).** Three issues addressed:
- Page wrapper changed from `overflow-auto` (both axes) to `overflow-y-auto overflow-x-hidden`. Stops the trackpad-wobble when two scroll axes fight.
- The permission matrix's `<thead>` is now `sticky top-0 z-20`, so column labels stay anchored while scrolling vertically through a long member list. Background colour explicit per cell so the sticky header is opaque.
- Member column already had `sticky left-0` — z-index bumped to 30 so it sits above the now-sticky thead at the corner.

**Glance dashboard, 4 long columns (B).** [glance/page.tsx](src/app/(app)/glance/page.tsx) grid switched from `repeat(auto-fit, minmax(280px, 1fr))` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Each card is taller and narrower at desktop width; stacks on phone, pairs on tablet.

**Countdown card multi-unit breakdown (C).** [CountdownCard.tsx](src/app/(app)/CountdownCard.tsx) now shows full precision regardless of the toggle:
- `days` — single unit (e.g. `120 days`)
- `weeks` — primary + remainder (e.g. `17 weeks` with `+ 1 day` underneath)
- `months` — primary + multi-remainder (e.g. `4 months` with `+ 2 weeks 3 days` underneath)

The big-number aesthetic stays; precision is in a small subtitle line. Helper functions (`addMonths`, `ceilDays`, `buildBreakdown`) are inline; could be lifted to `src/lib/format.ts` if reused elsewhere.

**Repo hygiene.** Deleted [src/app/(app)/schedule/EventRow.tsx](src/app/(app)/schedule/EventRow.tsx) — orphan since the v1.0.0 schedule timeline rewrite (replaced by `EventNode.tsx` + `ScheduleTimeline.tsx`, no remaining imports). Consolidated `AUDIT-BRIEF.md` + `AUDIT-PLAN.md` + `AUDIT-REPORT.md` into a single [AUDIT.md](AUDIT.md) — same content, three sections, easier to find. References in REMEDIATION-PLAN, ROADMAP, and TESTING all updated.

Verified: typecheck, lint, build, 69/69 tests, clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at this SHA.

### 2026-04-28 · v1.4.0 — Phase R3 (partial): tests in CI + TESTING.md + integration scaffold

Test-depth phase from the [post-audit plan](REMEDIATION-PLAN.md). No user-visible features; locks in the test substrate so future fixes can't regress quietly.

**T5 — CI gates the image build on tests passing** ([.github/workflows/build.yml](.github/workflows/build.yml)). Renamed workflow to `Test, build, and publish image`. Split into two jobs:

- `verify` — installs deps with the same flags as the Dockerfile (so we exercise the same install path, including the `.npmrc legacy-peer-deps=true` from the v1.2.x cascade), generates the Prisma client, runs typecheck → lint → unit tests in order.
- `build` — only runs `needs: verify`. Same docker-build steps as before.

A green Docker image of broken-code typecheck/lint/test will no longer ship to GHCR. Branch trigger updated to `claude/main` (was `main` — the legacy default-branch reference that meant `claude/main` pushes weren't actually triggering a build for the entire session).

**T4 — [TESTING.md](TESTING.md)** codifies the test strategy and the pre-promote smoke checklist. Persona walkthroughs (Bryony / Jamie / Josh / Aimee) for the full pre-wedding rehearsal. The "automated gates must pass + GHA green on same SHA" rule is now written down and references CLAUDE.md.

**T2 — integration-test scaffold** ([vitest.config.integration.ts](vitest.config.integration.ts) + [tests/integration/permissions.test.ts](tests/integration/permissions.test.ts)). Separate Vitest config so unit tests stay fast (`npm test` in <1s); integration tests run via `npm run test:integration` against a real Postgres set via `DATABASE_URL`. Tests self-skip when the env var isn't set (or doesn't look "test"-y), so the scaffold is safe on a dev machine without Docker. Five permission-resolver scenarios covered: EDIT user, NONE user, no Permission row, couple-only-section denial, couple-tier passes everywhere. CI wiring for the integration job is **not** in this release — that's a follow-on with the Playwright phase. Local-run instructions documented in TESTING.md.

**T3 — Playwright e2e deferred.** Scaffolding Playwright that's reliable on Windows AND in GHA is a session-of-its-own. Tracked in [REMEDIATION-PLAN.md](REMEDIATION-PLAM.md) §3-T3.

**Verified:** typecheck, lint, build, 69/69 unit tests pass, integration runner skips cleanly without `DATABASE_URL`, full clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at this SHA — first release where the green-CI-first rule was set up *before* the new test gates landed, so this is also the test of whether the new GHA pipeline itself works.

### 2026-04-28 · v1.3.0 — Phase R2: magic-link rate limit + archived-guest restore

Second remediation phase from the [post-audit plan](REMEDIATION-PLAN.md). Closes the two MAJOR audit findings deferred from R1 because they needed schema or UI work.

**A3 — magic-link rate limit.** New `MagicLinkAttempt` table tracks send attempts; up to 5 per hour per email. Checked in [src/auth.ts](src/auth.ts) `sendVerificationRequest` *before* the SMTP send and *before* the allowlist check (so timing doesn't leak which addresses are on the allowlist). Rejected attempts log a `magic_link_rate_limited` audit entry with the `retryAfterSec` value; the user sees a "Too many sign-in attempts — try again in N seconds" error. Per-IP limiting is documented in the brief but skipped — the auth callback doesn't ergonomically expose the request IP, and the AUTH_ALLOWED_EMAILS allowlist already caps the realistic attack surface to ~5 addresses. Can be added later at the middleware layer if real abuse appears.

Decision logic split into a pure function ([src/lib/rate-limit.ts](src/lib/rate-limit.ts) `decideRateLimit`) and a thin DB-aware wrapper (`checkAndRecordAttempt`). The pure function gets 9 unit tests; the wrapper is integration territory. Pruning of expired rows happens opportunistically inside the same `Promise.all` as the count + oldest-attempt query, so the table stays tiny without a separate cron.

**A4 — archived-guest restore.** [`deleteGuest`](src/app/(app)/guests/actions.ts) was a hard delete; the audit's persona walkthrough flagged the lack of undo as a real risk on the wedding day. Now soft-deletes (set `archived = true`, free the seat). Two new actions:

- `restoreGuest(id)` — flip `archived` back to `false`. Their seat does NOT auto-reassign; they come back unseated and the user reseats them.
- `hardDeleteGuest(id)` — actual `db.guest.delete`. Couple-only (gated explicitly on `user.isCouple`, audit-logged as `guests_denied` if a non-couple user tries). Requires the row to already be `archived = true` — you can't skip the soft-delete step.

UI: `/guests?archived=1` switches to a flat list of archived guests with Restore and (couple-only) Delete-forever buttons. Active view gets an "Archived (N)" link in the header that only shows when `N > 0`. Implemented as a server-component branch in [page.tsx](src/app/(app)/guests/page.tsx) with a small client component [ArchivedGuestList.tsx](src/app/(app)/guests/ArchivedGuestList.tsx) handling the actions.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds the `MagicLinkAttempt` model. Two indexes — `(identifier, createdAt)` for the rate-limit check, and `(createdAt)` for the prune. Migration [20260428100000_add_magic_link_attempt](prisma/migrations/20260428100000_add_magic_link_attempt/migration.sql) is purely additive — runs on `prisma migrate deploy` at next prod boot.

**Tests** ([tests/unit/rate-limit.test.ts](tests/unit/rate-limit.test.ts)) — 9 new cases for `decideRateLimit`: zero attempts, below threshold, at-max-1, at-threshold, above threshold, retry-after computation against window start, full-window fallback when oldest is missing, custom max + window overrides. 69 unit tests total now (60 → 69).

Verified: typecheck + lint + build + 69/69 tests + clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at the v1.3.0 SHA.

### 2026-04-28 · v1.2.4 — Dockerfile copies .npmrc (so the legacy-peer-deps actually applies in CI)

v1.2.3's `.npmrc` was at the project root and worked locally — but the GHA build still failed with a different error:

```
npm error code EUSAGE
npm error Missing: nodemailer@7.0.13 from lock file
```

Cause: the Dockerfile `deps` stage copies `package.json package-lock.json* ./` into the image, but **not `.npmrc`**. So `npm ci` inside the alpine image runs without `legacy-peer-deps=true`, sees the unresolvable optional-peer conflict, decides nodemailer@7.0.13 *must* exist, looks for it in the lockfile, doesn't find it, fails EUSAGE.

The local `npm ci` worked because the project-root `.npmrc` was visible. The Docker `npm ci` didn't have the file in scope.

**Fix:** [Dockerfile](Dockerfile) line 7 now copies `.npmrc*` alongside `package.json` and `package-lock.json*`. The `*` glob makes it tolerant of the file being absent on future restructures. Commented inline so the next reader knows why.

This is the genuinely-final fix for the four-version cascade. Building locally with `docker build --target deps` would have caught this immediately — the new standing rule in [CLAUDE.md](CLAUDE.md) is to run that step before promoting any release that touches deps.

Verified: typecheck, lint, build, 60/60 tests, `npm ci` clean from a wiped `node_modules`. Holding promote until GHA on `dev` confirms green.

### 2026-04-28 · v1.2.3 — .npmrc legacy-peer-deps + revert nodemailer to v6

Honest entry: v1.2.2's nodemailer-7 bump didn't fix CI either — it just swapped which peer-dep was unhappy. The third CI log gave us the full picture:

```
While resolving: next-auth@5.0.0-beta.25
  peerOptional nodemailer@"^6.6.5" from next-auth@5.0.0-beta.25  ← wants v6
Found: nodemailer@7.0.13
  peerOptional nodemailer@"^7.0.7" from @auth/core@0.41.2        ← wants v7
Conflicting peer dependency: nodemailer@6.10.1 / 7.0.13
```

**The fundamental problem:** `next-auth@5.0.0-beta.25` and `@auth/core@0.41.2` (cascaded via `@auth/prisma-adapter@2.11.2`) declare **mutually-incompatible** nodemailer peer ranges. There is **no** nodemailer version that satisfies both. v1.2.1 had `^6.x` (broke @auth/core); v1.2.2 had `^7.x` (broke next-auth).

But: **both ranges are `peerOptional`.** Neither package eagerly requires nodemailer at runtime — the declaration is purely advisory. npm 10's strict mode rejects the conflict anyway during `npm ci`; npm 10 on Windows happens to be lax about it; npm 10.8.2 on `node:20-alpine` enforces it. That asymmetry is the entire reason CI failed while local builds passed three times running.

**Fix (v1.2.3):**

1. **New [`.npmrc`](.npmrc) at the repo root** with `legacy-peer-deps=true`. This tells npm to skip the optional-peer conflict check, matching the Windows resolver behaviour. Documented in the file with the full rationale so future Claude doesn't delete it.
2. **Revert `nodemailer` to `^6.9.16`** (which `npm install` resolved to `^6.10.1`). next-auth is what actually `require`s nodemailer at runtime, via `next-auth/providers/nodemailer`. Sticking with the version next-auth tested against is safer than v7.
3. **Keep the JWT augmentation fix from v1.2.2** ([src/auth.config.ts](src/auth.config.ts) — `next-auth/jwt` path with side-effect import). That was the right structural fix regardless of the nodemailer version.
4. **Keep the vitest 2.x pin from v1.2.1.** Independent precaution, no harm in keeping it.

**Standing rule reinforced in [CLAUDE.md](CLAUDE.md):** before tagging a release with dep changes, watch GHA go green on the same SHA before fast-forwarding `claude/main`. The Windows-vs-Alpine npm asymmetry has burned us three times now.

Verified on a fully wiped `node_modules` from `npm ci`: typecheck clean, lint clean, 60/60 tests, build clean. Holding promotion until GHA confirms green.

### 2026-04-28 · v1.2.2 — Bump nodemailer to v7 + fix JWT augmentation (real CI fix)

Honest entry: v1.2.1's vitest pin didn't fix CI. The actual cause was hidden one layer deeper.

The full v1.2.1 GHCR build log surfaced the real error:

```
npm error code EUSAGE
npm error Missing: nodemailer@7.0.13 from lock file
```

Root cause: `@auth/prisma-adapter@2.11.2` cascaded `@auth/core@0.41.2`, which requires `nodemailer ^7.0.7` as an optional peer. Our `package.json` pinned `nodemailer ^6.9.16`. Local `npm ci` on Windows (npm 10.x) silently tolerated the conflict; CI `npm ci` on `node:20-alpine` (npm 10.8.2) strictly rejected it.

**Three coordinated changes:**

1. **Bump `nodemailer` to `^7.0.13`** ([package.json](package.json)). Our usage (`nodemailer.createTransport(...)` + `transport.sendMail(...)`) is API-stable across v6 → v7; no runtime code change needed.
2. **Move JWT type augmentation from `@auth/core/jwt` to `next-auth/jwt`** ([src/auth.config.ts](src/auth.config.ts)). With `@auth/core@0.41+` nested inside `next-auth/node_modules/`, the old `@auth/core/jwt` path no longer resolves at the project root. Added a side-effect `import "next-auth/jwt"` so TypeScript's module-resolution sees the module before the `declare module` augmentation pass.
3. **Standing rule in [CLAUDE.md](CLAUDE.md)** — before tagging a release that changes deps, run `npm ci` against a fresh `node_modules` AND prefer `docker build --target deps` against linux/amd64. The Windows `npm install` resolver is more permissive than `node:20-alpine`'s.

Verified clean from a wiped `node_modules`:
- `npm ci --no-audit --no-fund` succeeds (~37s)
- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` 60/60 passing
- `npm run build` clean Next bundle

The vitest 2.x pin from v1.2.1 stays — it's still the right call (vitest 4.x is too new for routine CI use, and 2.x is widely battle-tested), but it wasn't the cause of the failure.

### 2026-04-28 · v1.2.1 — Pin Vitest to v2.x to fix Docker build

v1.2.0's `npm ci --no-audit --no-fund` failed inside the Docker `deps` stage on `node:20-alpine`:

```
ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci --no-audit --no-fund"
       did not complete successfully: exit code: 1
```

Vitest 4.x (released Oct 2025) installed cleanly on the Windows dev box but a transitive dep failed quietly under Alpine's musl libc. Local builds were green; the GHCR image build was broken.

**Fix:** downgrade `vitest` and `@vitest/ui` to `^2.1.9` and regenerate `package-lock.json` against the v2 dep tree. Vitest 2.x is widely battle-tested on Alpine and used by countless CI pipelines on `node:20-alpine`. Our test files use only stable APIs (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`) that are identical across v2 → v4, so no test code changed. Verified `npm ci` from a clean `node_modules` tree succeeds locally; verified `npm test` (60/60), `npm run typecheck`, `npm run lint`, `npm run build` all clean.

**Standing rule added to [CLAUDE.md](CLAUDE.md):** don't upgrade Vitest casually. Test `docker build --target deps` on linux/amd64 before merging any future major bump. Same caution for `tinypool`, `@vitest/snapshot`, and the Vite version that rides along.

Patch bump only — no functional change to the running app, only to the build tooling. The R1 fixes from v1.2.0 carry through unchanged.

### 2026-04-28 · v1.2.0 — Phase R1: trust restoration (audit fixes + Vitest)

First remediation phase from the [post-audit plan](REMEDIATION-PLAN.md). Six fixes that close every audit-flagged permission/data-leak class, plus the project's first automated test suite. No schema changes; no env changes.

**Two BLOCKER-class privilege escalations closed** (escalated from MAJOR after static verification revealed worse-than-audit-described behaviour):

- **A2 — settings self-elevation.** `setPermission`, `setUserCouple`, and `removeUser` in [src/app/(app)/settings/actions.ts](src/app/(app)/settings/actions.ts) were gated only by `requireEdit("settings")`. A non-couple user with `EDIT(settings)` could call `setUserCouple(myOwnId, true)` and self-promote to couple-tier. All three now require `user.isCouple === true` explicitly. Denied attempts log a `settings_denied` audit entry with the target action and reason.
- **A6 — file visibility leak.** `updateFile` in [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) had no `isCouple` check on visibility transitions at all. A non-couple user with `EDIT(files)` could flip a `COUPLE_ONLY` file to `EVERYONE` and read couple-only documents. Now any visibility transition touching `COUPLE_ONLY` (in either direction) requires couple-tier, with denied attempts logged as `files_denied`.

**Four smaller audit findings closed:**

- **A1 — list-page `canView` gates.** [src/app/(app)/tasks/page.tsx](src/app/(app)/tasks/page.tsx), [questions/page.tsx](src/app/(app)/questions/page.tsx), [book/page.tsx](src/app/(app)/book/page.tsx), and [guests/page.tsx](src/app/(app)/guests/page.tsx) now redirect to `/` when the caller lacks `canView` for the section. Sidebar nav already hid these for blocked users; the routes themselves were reachable by URL. Mirrors the pattern already in use at `/guests/[id]` and `/guests/catering`.
- **A5 — polymorphic Task gate.** `setTaskStatus` and `deleteTask` in [src/app/(app)/tasks/actions.ts](src/app/(app)/tasks/actions.ts) operate on the `Task` model that stores TASK / QUESTION / DECISION rows. They now read the row's `type` first and dispatch to `requireEdit("tasks")` or `requireEdit("questions")` accordingly. Closes the cross-section gate gap a user with `EDIT(tasks)` + `NONE(questions)` could exploit via crafted requests.

**Test infrastructure (T1) shipped:**

- [vitest.config.ts](vitest.config.ts) with the `@/*` path alias matching tsconfig.
- `npm test` and `npm run test:watch` scripts.
- 60 unit tests across four files:
  - [tests/unit/permissions.test.ts](tests/unit/permissions.test.ts) — 17 tests covering `canView` / `canEdit` for every (section, level, isCouple) combination, including F1 escalation reproductions for tasks/questions/book/guests.
  - [tests/unit/csv-merge.test.ts](tests/unit/csv-merge.test.ts) — 33 tests for the import coercers and helpers (`coerceBool`, `coerceRsvp`, `coerceSide`, `coerceChild`, `coerceDietary`, `coerceTags`, `splitFullName`, `inferField`, `dedupeKey`, `isEmptyValue`, `nonEmptyOrNull`, `detectSeparator`).
  - [tests/unit/spotify.test.ts](tests/unit/spotify.test.ts) — 8 tests for `parsePlaylistId` (URL-with-?si=, bare URL, `spotify:` URI, bare ID, whitespace, junk inputs) and `isSpotifyConfigured`.
  - [tests/unit/smoke.test.ts](tests/unit/smoke.test.ts) — runner-wired-up sanity check.

Tests run in <1s after the first cold start. Future audit findings should land alongside a regression test that would have caught them.

**Out of scope for R1** (deferred to R2/R3 per the [remediation plan](REMEDIATION-PLAN.md) §4): magic-link rate limit (A3), archived-guest restore UI (A4), permission integration test against a real DB (T2), Playwright e2e (T3), TESTING.md (T4), backup verification cron (T5), all Bucket B and C items.

Verified: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` all clean.

### 2026-04-27 · v1.1.0 — At a Glance dashboard

The `/glance` route was a "Coming soon" stub from Phase A onwards. v1.1.0 turns it into a real big-picture dashboard built entirely from live Prisma queries — no client-side mocks, no data duplication, no new schema.

**Five cards, role-aware** ([glance/page.tsx](src/app/(app)/glance/page.tsx)):

1. **RSVPs** — SVG donut showing confirmed / pending / declined as three-arc segments with rounded line caps and tokenised CSS-variable strokes (so dark mode picks up the right palette automatically). Centre shows attending count + "of N total". A list of the four most recently updated guests with confirmed/declined status pills sits below.
2. **Budget** (couple-only) — `Decimal` aggregates from `BudgetLine._sum` for planned/actual/paid. Stacked progress bar (paid moss + committed marigold) plus three small stats. Non-couple users see a Wedding-day countdown card with a "🔒 Budget is restricted to Jamie & Bryony" footer instead, so the page stays balanced for everyone.
3. **Payments due** (couple-only) — next 30 days, sorted by `dueDate`, joined with `Supplier.name`. Non-couple users see "My open tasks" instead.
4. **Recent activity** — last 8 audit-log entries joined with the originating user. Action codes are mapped to human-readable phrases (`rsvp` → "set an RSVP to attending", `quickcapture` → "quick-captured a task", `spotify_sync` → "synced 47 tracks from Spotify"). Couple-only entities (`Payment` / `BudgetLine` / `BudgetCategory`) are redacted to "updated a private page" with reduced opacity for non-couple viewers.

**Implementation notes:**

- Six parallel queries via `Promise.all` (groupBy on Guest.rsvp, recent guests, payments, budget aggregate, my tasks, audit log). The non-couple branch resolves to `[]` / `null` for the couple-only queries to keep the parallel shape uniform.
- The `describeActivity` helper is intentionally dumb: any unknown action falls through to `${action} a ${entity}` rather than exposing raw codes. Future actions don't break the page.
- `RsvpDonut` calculates arc lengths from `total` directly so it stays accurate as RSVPs land. Three-arc stroke offsets stack end-to-end starting from 12 o'clock.
- `View all →` links route to the underlying domain page so the dashboard is a launchpad, not a dead end.

No schema changes; no env-var changes. typecheck + lint + build all clean.

### 2026-04-27 · v1.0.0 — Release-1 design polish across all pages

A focused pass through every domain page to close the gap between the prototype and the live app. After this release, the design audit produces "no significant gaps" — pages have moved from functional to polished.

**Today** ([page.tsx](src/app/(app)/page.tsx) + [CountdownCard.tsx](src/app/(app)/CountdownCard.tsx) + [TodayEventsCard.tsx](src/app/(app)/TodayEventsCard.tsx))
- Countdown card has a months/weeks/days segmented toggle, persisted to `localStorage` (`wh_countdown_unit`).
- "Mine" / "Everyone" persona filter on the upcoming-events card; "Mine" matches `ScheduleEvent.audience` against the session-user role with sensible aliases (couple ↔ bride/groom, wedding_party ↔ party, planner ↔ suppliers).
- New RSVP / catering snapshot strip beneath the columns: invited / attending / pending / declined / dietary / children + highchairs — picked up via a `groupBy` on `Guest.rsvp` and a single dietary flatten.

**Tasks** ([TaskBoard.tsx](src/app/(app)/tasks/TaskBoard.tsx))
- New `Board` view alongside `List`. Three columns (To do / Doing / Done) with subtle accent left-borders. `WAITING` shows in Doing; `ARCHIVED` is hidden.
- Each card: priority dot, title, due-date (with overdue red), tag chips (max 2), assignee avatar, and three move buttons that change status with one click. No drag-drop in v1.0 — the click-to-move buttons are accessible and keyboard-friendly, which beats half-broken DnD.
- View choice persists to `localStorage` (`wh_tasks_view`).

**Schedule** ([ScheduleTimeline.tsx](src/app/(app)/schedule/ScheduleTimeline.tsx) + [EventNode.tsx](src/app/(app)/schedule/EventNode.tsx))
- Vertical timeline with a left-aligned hairline rule and round node markers on each event. Events grouped by calendar day with a sticky date header.
- Print button on the page header — reuses the existing `@media print` plumbing via a new `.schedule-page` print scope and a print-only letterhead. Schedule prints clean on A4 with day headers preserved and edit affordances hidden.

**Suppliers detail** ([suppliers/[id]/page.tsx](src/app/(app)/suppliers/[id]/page.tsx) + [SupplierDetailClient.tsx](src/app/(app)/suppliers/[id]/SupplierDetailClient.tsx))
- Click any supplier name → full detail page with status, agreed/paid/outstanding tiles, **contacts** (with mailto + tel links + primary toggle that auto-unmarks others), **contracts** (signed-or-pending pill, amount, signed-on date, notes), **communications log** (channel icon, summary, follow-up date, relative time), and a read-only payment list linked to `/payments`.
- Five new server actions (`createSupplierContact`, `createSupplierContract`, `createSupplierCommunication`, plus `delete*` siblings), all gated by `requireEdit("suppliers")` and audited.
- Setting a contact as Primary auto-clears any other primary on that supplier — used by the day-of-mode contacts panel which picks the primary contact.

**Questions** ([QuestionsClient.tsx](src/app/(app)/questions/QuestionsClient.tsx))
- Search box + Type filter pills (All / Questions / Decisions) + Priority filter pills (All / High / Med / Low). Filters compose; empty result state is preserved per filter set.
- Section headers (Open / Answered) only render when their bucket has items after filtering, so the page never has lonely "Open" headings.

**Budget** ([BudgetClient.tsx](src/app/(app)/budget/BudgetClient.tsx))
- Categories are collapsible — header shows line count + per-category Planned/Paid subtotals on wide viewports.
- Summary bar gains a stacked progress bar: paid (moss) layered over committed/actual (marigold), with percentage labels and an "⚠ Actual exceeds planned by £X" callout when applicable.

**Files** ([FilesClient.tsx](src/app/(app)/files/FilesClient.tsx))
- Type filter pills (All / Images / PDFs / Documents / Other) with live counts.
- Image files render inline thumbnails (via `/api/files/[id]`) replacing the 🖼 icon — couple can scan a folder of photos visually rather than by filename.

**Songs** ([PlaylistCard.tsx](src/app/(app)/songs/PlaylistCard.tsx) + new `moveSong` action)
- Each song shows its position number and reveals up/down arrow buttons on hover — matches the photography shot list reorder pattern.
- Spotify-synced rows are still safe to reorder; a re-sync wholesale-replaces synced rows so the order resets to Spotify's, which is intentional and documented.

**Wedding party section** ([prisma/seed.ts](prisma/seed.ts))
- New `wedding-party` BookSection with five seeded subsections (Roles / Outfits / Ring keepers / Stag & Hen / Day-of logistics). Idempotent: only seeds when the section is empty, so re-running `db:seed` never overwrites real notes.
- Renders through the existing `/book/[slug]` editor — no special-case route needed, in contrast to `/book/photography` which has a custom checklist UI.

**Book on-page anchors** ([book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx))
- Sticky "On this page" pill row at the top of every section with subsection links. Each `SubsectionEditor` renders an `id={sub.slug}` and `scroll-mt-24` so anchor navigation lands cleanly below the page header.

**Why 1.0.0** — the original criterion was "good for the wedding day itself, after the rehearsal data is real." The data is real (CSV imports landed), the day-of view is wired, every page in the prototype has a faithful counterpart, and the polish gap from the design audit has been closed. There's still a deferred backlog (audit log viewer, custom-fields UI, seating constraints, glance dashboard) but none of it is load-bearing for the wedding. Pre-1.0 caveat in the versioning section is satisfied. We're calling 1.0.0 from here.

No schema changes; no env-var changes. typecheck + lint + build all clean.

### 2026-04-27 · v0.15.0 — Phase G2: day-of mode + quick-capture

Two of the prototype's signature features finally shipped: a day-of dashboard for the wedding day itself, and a global keyboard shortcut for fast capture from anywhere in the app.

**Day-of mode** lives at [`/today/day-of`](src/app/(app)/today/day-of/page.tsx), reachable from a "◉ Day-of mode" button on the Today header. The page shows:

- **Hero band** with the wedding date, venue, and viewer name. On the wedding day itself the strapline reads *"Today is the day"* — outside the day a yellow "Preview mode" banner makes it explicit you're looking ahead, and the timeline still works because the now/next/past classification runs against the current clock.
- **Live timeline** of every `ScheduleEvent` between 00:00 and 23:59 of the wedding date. Each event is classified `past` / `now` / `next` / `upcoming` from current time vs `startTime` + `endTime` (or +30 min for events without an end). The single `next` is computed in a second pass — the first upcoming after the last `past`/`now`. Past events are struck through and dimmed; the now event gets a marigold band + `NOW` chip; the next event gets a moss band + `NEXT` chip.
- **Day-of contacts** pulled from `Supplier`s with status `BOOKED` or `PAID`, joining their primary contact (or first contact) where a phone number exists. Each row is a `<a href="tel:…">` so on a phone the contact can be one-tapped — that's the whole point on the day.
- **Catering today** — totals, adults / children / kids' meals / highchairs / dietary requirements. Reuses the same query shape as the catering brief, just inline. Links out to `/guests/catering` for the full printable.
- **Open quickly** — direct links to Shot list, Seating chart, Schedule, Guests, Songs.

**Quick-capture** is the global `C` shortcut promised since Phase A. Implementation:

- [QuickCapture.tsx](src/components/shell/QuickCapture.tsx) — client component mounted once in [AppShell](src/components/shell/AppShell.tsx). Listens to `keydown` on `window` and opens when `C` (no modifiers) fires outside an input / textarea / select / contenteditable — so typing "C" into a real form field never pops the modal.
- Three target types: `Task`, `Question`, `Event`. Single text input, Enter to submit, Esc to dismiss. Click outside the modal also dismisses (when not pending). Auto-focus the input on open.
- Captured rows route to the right table via [src/app/(app)/actions.ts](src/app/(app)/actions.ts):
  - `Task` → `db.task.create({ type: TASK, status: OPEN, priority: MEDIUM, assigneeId: <self> })` + revalidate `/tasks` and `/`.
  - `Question` → same, but `type: QUESTION`, revalidates `/questions`.
  - `Event` → `db.scheduleEvent.create` with `startTime` defaulted to the next round hour, revalidates `/schedule`. The user picks a real time on the destination page if they want.
- Each capture is gated by `requireEdit("tasks" | "questions" | "schedule")` so the permission matrix still applies — viewers see the modal but get a permission error on submit.
- Audited as `quickcapture` with `{ source: "quickcapture" }` metadata so we can grep the audit log later.
- Success surfaces a 1.4s green toast at the bottom of the screen — `✓ Task added: <title>`.
- Payments are deliberately NOT a capture type: they need a supplier + amount that don't fit one text field. Capture as a Task with "pay X" instead.

No schema changes; no env-var changes. Verified with typecheck + lint + build.

### 2026-04-27 · v0.14.0 — Phase G1: Spotify playlist sync

The Spotify field on `Playlist` had been in the schema since Phase B but un-wired. v0.14.0 connects it: paste a Spotify playlist URL on any local Playlist, click **Sync**, and Wedding Hub mirrors the tracks as `Song` rows with `spotifyUri` set. Click a song title to open it in Spotify. The `Songs` page becomes a shareable read-only mirror — the couple keeps curating in Spotify (where the editing UX is good), the planner / DJ / wedding party get a stable URL.

**Auth model: Client Credentials.** App-to-app auth, no per-user OAuth dance. The trade-off is that Spotify's Client Credentials token can ONLY read public playlists — so the couple must flip the playlist to public during a sync (they can flip it back to private after; we cache the tracks locally). Documented in the env-example. Future iteration could add user-OAuth (`playlist-read-private`) if anyone hits this friction.

**Implementation** ([src/lib/spotify.ts](src/lib/spotify.ts)):
- Token cache with 30s expiry buffer to dodge race conditions during a sync.
- Pagination with `?limit=100`; hard cap of 10 pages (≤1000 tracks) as a runaway guard.
- `parsePlaylistId()` accepts the full URL (with `?si=` tracking param), the `spotify:playlist:` URI, or a bare base62 ID.
- Strips local files and non-track items (podcasts, episodes) — they'd have no `spotifyUri` the DJ could play anyway.
- Surfaces 404 with a "make sure the playlist is public" message rather than a generic "not found".
- Surfaces 429 with the `Retry-After` so the user knows when to retry.

**Sync semantics** ([actions.ts](src/app/(app)/songs/actions.ts) `syncPlaylistFromSpotify`):
- **Wholesale replace** of synced songs (rows where `spotifyUri IS NOT NULL`). Spotify is the source of truth — re-running sync mirrors the current state, including removed songs.
- **Manually-added songs preserved** (no `spotifyUri`). Guest requests / planner additions still show up alongside the synced list.
- New songs are appended after any manually-added ones (max-order + 1 onwards) so manual entries keep their slot order.
- Each sync stamps `Playlist.lastSyncedAt`, `lastSyncError`, `lastSyncedSongs`. Failed syncs persist the error message so the user sees it on reload.
- Audit-logged with `spotify_sync` (success) / `spotify_sync_fail` (error) actions and `tracks` / `error` metadata.

**UI** ([PlaylistCard.tsx](src/app/(app)/songs/PlaylistCard.tsx)):
- New panel under the playlist header — visible only when Spotify is configured OR the playlist already has a Spotify ID. Hidden on do-not-play / block lists (Spotify mirroring would defeat the purpose).
- States: not configured (with env-var hint), no URL linked (Link button), linked and never synced (Sync now button), linked and synced ("Synced 3m ago" + Re-sync button), error (red ⚠ banner with Spotify's message).
- Each synced song renders the title as a hyperlink that opens the track in Spotify, plus a tiny 🎵 marker.
- Confirm dialog before sync mentions how many synced songs will be replaced and how many manually-added ones will survive.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds three nullable columns to `Playlist`: `lastSyncedAt`, `lastSyncError`, `lastSyncedSongs`. Migration `20260427200000_add_playlist_sync_metadata` is purely additive.

**Env** ([.env.example](.env.example)) introduces optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`. Both blank → entire sync UI is hidden, so existing deployments without these vars look exactly the same as before.

Verified: typecheck + lint + build all clean.

### 2026-04-27 · v0.13.0 — Phase F2: photography shot list

A printable, tickable shot list for the photographer, sitting under the Wedding Book.

**New page** at [`/book/photography`](src/app/(app)/book/photography/page.tsx) — opens from the new **Photography & Shot list** card on `/book`. Each shot has:
- Title (e.g. *Couple portraits*)
- "With whom" — comma-separated names rendered as moss chips
- Location — short label (Garden / Library / Front lawn)
- Notes — free-text
- A captured/planned checkbox the photographer ticks on the day

The header shows live progress (`3 of 6 captured · 3 planned`), and the same count surfaces on the Photography card on the Book hub so the couple can see at a glance how the day went.

**Reorder** with up/down arrow buttons per row (visible on hover, accessible via focus). Implemented as an order-field swap with the neighbour, not a full renumber, so reorder is one transaction regardless of list length.

**Print mode** (`Print` button → `window.print()`) reuses the global `@media print` stylesheet established by the catering brief. The print stylesheet:
- Hides the Wedding Book back-link, action buttons, and reorder/edit/delete affordances (`.no-print`)
- Renders the print-only letterhead (*Shot list — Jamie & Bryony*)
- Forces a square hollow-checkbox so the photographer can tick rows with a pen on paper
- Avoids page-breaking inside the shot list block (`.print-break-avoid`)

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds a standalone `PhotographyShot` table — title, `withWhom: String[]`, location, notes, captured boolean, capturedAt timestamp, order int. No FK to Guest deliberately: shot lists describe people by display name, and we don't want a deleted Guest to silently remove a planned shot. Migration `20260427190000_add_photography_shot` is purely additive — `migrate deploy` creates the table on next prod boot.

**Permissions:** lives under the existing `book` permission section. No new section key needed; couple + party + planner all get edit access via the standard `Permission` row matrix.

**Seed** ([prisma/seed.ts](prisma/seed.ts)) idempotently inserts the six prototype shots if and only if the `PhotographyShot` table is empty — a re-seed never overwrites real data added through the UI. The `BookSection` row with slug `photography` is upserted alongside the other sections so the card appears on the hub.

Verified: typecheck + lint + build all clean. No env-var changes.

### 2026-04-27 · v0.12.0 — Import merge + guest detail page + catering letterhead

Three pieces of feedback in one minor bump:

**1. Import duplicates were not merging.** The user re-imported their Say I Do CSV after RSVPs came in and got a household with four guests where there should have been two — two complete rows plus two stub rows showing only the new RSVP chip. The previous importer always called `db.guest.create`, so any row whose name+household matched an existing guest produced a second row instead of merging into the first.

Fix: at preview and commit time, the importer now builds a dedupe key of `householdName|firstName|lastName` (case-insensitive) and uses it to detect existing guests in target households. The preview shows a `merge` chip on rows that will land on an existing guest, and the summary distinguishes new vs merging counts (`23 new · 4 merging into existing`).

The merge-update has well-defined field semantics:
- **Strings** (email, phone, role, plus-one name, meal courses, RSVP link): overwrite only when the new value is non-empty — never blank existing data with a partial second import.
- **Booleans** (isChild, needsHighchair, childrenMeal, plusOneAllowed): OR semantics — never downgrade `true → false`.
- **Side**: overwrite only when the new value differs from the default `BOTH`.
- **RSVP**: overwrite only when the new value isn't `PENDING` — confirmed RSVPs are never reset to pending on re-import.
- **Arrays** (dietary, tags): case-insensitive union; existing order preserved.
- **Notes**: append rather than overwrite, deduped on substring match.
- **Seat**: only assign if the existing row is unseated.
- **Song requests**: skip titles already on this guest (case-insensitive title match).

If the same import contains multiple rows with the same name+household (rare but possible), later rows merge into the first one created in this run instead of creating yet another duplicate. The success page now shows separate "Created N · Merged into M" counts.

**2. New guest detail page.** Click any guest name on `/guests` and a new `/guests/[id]` page opens with their full details — RSVP, side, role, adult/child + highchair + kids-meal flags, plus-one, dietary, tags, table assignment, RSVP link, three-course meal choices, free-text notes, song requests, and other guests in the same household. The page has an "Edit" button that surfaces the existing GuestForm inline for full editing, an inline RSVP dropdown (same as the list view), and a delete button that returns to `/guests` after confirmation. Guards: `canView("guests")` to load, `canEdit("guests")` to mutate. Read-only mode hides the action buttons and shows a "you don't have edit access" notice.

**3. Catering brief letterhead redesign.** The previous header (`Catering brief` h1 + `Jamie & Bryony · {date}` subtitle) didn't match the design brief from the prototype. Restyled to use the prototype's letterhead pattern: couple name as the primary heading (`Spencer · Olwyn-Davis Wedding`), a row underneath with date + venue on the left and "Generated 27 April 2026" on the right, and a heavier 2px ink-primary rule beneath. Couple name and venue are read from `WEDDING_COUPLE` and `WEDDING_VENUE` env vars (with sensible defaults baked in for the current build) so the same brief works for any couple without code changes.

No schema changes; additive refactor only. Verified with typecheck + lint + build.

### 2026-04-27 · v0.11.1 — Import: stop warning on "-" boolean placeholders

User pasted their real Say I Do CSV into Preview and every single row had two warnings:
- `couldn't parse "highchair" value "-", treating as no`
- `couldn't parse "children's meal" value "-", treating as no`

**Cause:** Say I Do uses `-` as the "not applicable" placeholder in the Q7 (highchair) and Q8 (children's-meal) columns when the question doesn't apply (i.e., for adults). My `coerceBool` had `"-"` in neither the truthy nor falsy set, so it returned `null` and the import action emitted a per-row warning. Result: 22 rows × 2 warnings = visual noise that drowned out real issues.

**Fix:** extend `FALSY` to include the standard empty-placeholder set (`-`, `—`, `n/a`, `n.a.`, `na`, `none`). The semantic intent on those rows is "no, not applicable" — boolean coercion now succeeds with `false`, no warning.

`coerceChild` already handled `-` correctly via its own `CHILD_MAP` since v0.9.0; this fix just brings `coerceBool` into the same convention so highchair, children's meal, and plus-one columns all behave the same way.

Patch bump only — no schema change, no API change. The same CSV in v0.11.1 will preview clean (only real warnings will surface).

### 2026-04-27 · v0.11.0 — Phase F1: catering brief (printable summary)

Opens Phase F. Single new page at [`/guests/catering`](src/app/(app)/guests/catering/page.tsx) — a venue-ready summary that uses the data the Phase E import landed in the DB.

**Page sections:**
1. **Action bar** (hidden in print) — back-to-Guests link + "Print / save as PDF" button that calls `window.print()`.
2. **Headline tiles** — Attending, Adults, Children, Children's meals, Highchairs.
3. **Three-course breakdowns** — separate tables for Starters, Mains, Desserts. Each lists every distinct meal choice with its count, plus a "(no choice recorded)" row at the bottom for any guests who haven't filled in that course yet. Counts sum to the attending total so the venue can sanity-check the numbers.
4. **Dietary requirements** — flattened across all guests' `dietary[]` arrays, with a count per requirement. Sorted descending.
5. **Per-table breakdown** — every Table (sorted by name with natural ordering, so "Table 10" comes after "Table 2"), each rendered as its own card with seat number, guest name, three-course choices, and a notes column combining dietary tags + child / kids-meal / highchair flags. "Unassigned" guests appear at the end as a final block.

**Print stylesheet** ([src/app/globals.css](src/app/globals.css)):
- `.no-print`, `.desktop-sidebar`, `.mobile-tabbar` hidden in `@media print`.
- `.print-only-block` only visible in print (used for the "Generated DD MMM YYYY" footer line).
- `.print-break-before` / `.print-break-after` / `.print-break-avoid` helpers for explicit page-break control.
- `@page` directive sets A4 portrait with 16mm × 14mm margins.
- Body forced to black-on-white; tables get a flat grey header so they print fairly on a B/W laser.

**Linking**: new "Catering brief" button in the Guests page header — visible to anyone with view permission on `guests`, not just edit-tier users.

**Aggregation logic**: meal-choice counts use exact-string equality (Say I Do exports are byte-identical across rows, so this is fine in practice). Dietary requirements and meals are tallied with sort-by-count-descending so the most common items surface at the top. Guests without a table assignment go into an "Unassigned" group at the end, sorted alphabetically.

Photography shot list (Phase F2) deferred to its own iteration — needs a new Prisma model and probably its own UI under the Wedding Book section.

### 2026-04-27 · v0.10.0 — Children's-meal + RSVP link import, cross-page surfaces, Windows guide

**Schema** ([20260427180000_guest_kids_meal_and_relax_link](prisma/migrations/20260427180000_guest_kids_meal_and_relax_link/migration.sql)):
- New `Guest.childrenMeal Boolean @default(false)` for the Q8 question — couples can now see at-a-glance which child guests need the children's-meal option for the venue's catering count.
- Drops the `Guest_rsvpUniqueLink_key` unique index. Say I Do issues per-PARTY RSVP URLs (Tia and Torin share a link), which would have failed `@unique`. The column itself stays — just the constraint is relaxed.

**Importer** ([src/lib/csv.ts](src/lib/csv.ts), [src/app/(app)/guests/import/actions.ts](src/app/(app)/guests/import/actions.ts)):
- New `childrenMeal` field type, heuristics: `/^q\d+.*(children|kids?).*meal/i`, `/^children('?s)?\s*meal$/i`, `/^kids?\s*meal$/i`. Boolean coercion via existing `coerceBool`.
- New `rsvpLink` field type, heuristics: `/^(unique|rsvp|sayido|say\s*i\s*do)\s*(link|url)$/i`. Stored as `Guest.rsvpUniqueLink`.
- Both pre-selected by default for the user's actual Say I Do CSV columns.

**Cross-page surfaces** — answers "do imports interact with the Songs/Seating pages?":
- **Songs**: new "Guest requests" section above the curated playlists ([src/app/(app)/songs/GuestRequestsSection.tsx](src/app/(app)/songs/GuestRequestsSection.tsx)) listing all `SongRequest` rows where `playlistId IS NULL` (the imported ones). Grouped by guest; same person with three Q3/Q5/Q9 requests shows as one block with three lines. Page subtitle counts them.
- **Guests page**: per-guest row now shows a **table chip** (linking to `/seating`) when the guest has a `tableSeatId`, a **songs count chip** (linking to `/songs`) when they've made requests, a **kids-meal badge** alongside Child / Highchair, and an **RSVP-link icon** opening the Say I Do URL externally.
- Required including `tableSeat.table` and `_count: { songRequests }` in the household query — small data-volume bump for a big UX win.

**UI**:
- Import preview row now shows the **Kids meal** badge alongside Child / Highchair when applicable.
- New collapsible "How do I get the CSV out of a downloaded file? (Windows guide)" `<details>` block on the import page — step-by-step instructions for the right-click → Notepad → Ctrl+A → copy → paste flow, plus an Excel/Sheets alternative.

**Tested against the user's actual Say I Do CSV**: all 21 columns now have a sensible mapping (some auto-detected, some default to *Ignore* with the user choosing whether to override). After import, Q8-flagged child guests show the kids-meal badge; the per-party Unique link from Say I Do appears as a clickable RSVP icon on each guest row in their household; Q3/Q5/Q9 song requests appear in the new Songs page section; auto-created tables show inline as chips on guest rows.

### 2026-04-27 · v0.9.1 — Import copy: clarify Guest vs User email scope

User caught that a v0.9.0 chat message implied the duplicate-email check spanned both Guest and User accounts. The code itself only ever queried `db.guest` (User accounts and Guest rows are separate tables, no FK linking them) — but the warning copy and confirm dialog were ambiguous about which table the check covered. This iteration tightens that copy in three places:

- The preview row-warning now reads "another Guest row already has this email — importing will create a second guest row" (was "email already exists in DB").
- The confirm dialog explicitly notes "User sign-in accounts are stored separately and aren't checked here."
- The info banner at the top of the import page calls out the separation up-front, so the question doesn't even come up while staring at a preview.

No code-behaviour change; just docs / UI copy. Patch bump only.

### 2026-04-27 · v0.9.0 — Phase E feature-complete: real Say I Do CSV ingest

User loaded their actual Say I Do export and it didn't work end-to-end with the v0.8.0 importer. This iteration upgrades the importer to handle the messy, real-world shape of that file.

**Schema:** additive migration `20260427170000_add_guest_meal_fields` adds `mealStarter`, `mealMain`, `mealDessert` (all nullable text) to `Guest`. The existing `mealCourse` FK relation stays for now — never wired to UI, free-text is a more honest match for Say I Do's long meal descriptions.

**Parser ([src/lib/csv.ts](src/lib/csv.ts))** — new field types and heuristics:
- `fullName` — single "Guest Name" column, split on first whitespace at commit time. Hyphenated firsts ("Bryony-Olwyn Davis") survive.
- `tableName` — table assignments. Recognises "Table", "Seat Table", etc.
- `mealStarter` / `mealMain` / `mealDessert` — match `Q\d+: starter / main meal / desert` (typo and all) plus straight `Starter` / `Main` / `Dessert`.
- `needsHighchair` — `Q\d+: highchair`.
- `songRequest` — `Q\d+: song`. Multi-column allowed: Q3, Q5, Q9 all map to song requests; each non-empty value becomes its own `SongRequest` row.
- `tags` — pipe-delimited "Groups" column (Immediate Family|Bryony's side|Wedding party). Stored on `Guest.tags`.
- `notes` — multi-column allowed; concatenated with their header labels when more than one column maps here.
- New `coerceChild` — recognises "Adult"/"Child"/"Kid"/"Minor" alongside the generic boolean strings.
- `coerceDietary` now strips "None"/"N.a."/"Non"/"-" placeholders so they don't end up as actual dietary requirements.
- `inferSideFromTags` — when there's no explicit side column but the Groups column has tags like "Bryony's side" or "Jamie's side", infer the guest's side from there.

**Commit action ([src/app/(app)/guests/import/actions.ts](src/app/(app)/guests/import/actions.ts))**:
- Uses `splitFullName` to derive first/last when only `fullName` is mapped.
- Resolves `tableName` by find-or-create. New tables get capacity = max(targetCount, 8); names containing "head" get `TableShape.HEAD`; everything else `ROUND`. Seats are created up to capacity. Each guest gets the next free seat in their table — bookkeeping happens locally to avoid clashes within one import batch.
- Multi-column song requests → `db.songRequest.createMany` linked to the new guest.
- Multi-column notes → concatenated with header labels.
- Pre-flight existence checks now cover households, tables, AND emails — duplicate emails surface as preview warnings (still imported, but flagged so the user knows).

**Preview UI ([src/app/(app)/guests/import/ImportClient.tsx](src/app/(app)/guests/import/ImportClient.tsx))**:
- New columns: Table (with new/seat chip), Meals · Songs (compact `S/M/D` and `♪ N` indicators with full-text tooltips on hover).
- Confirm dialog summarises new tables + duplicate-email count, not just households.
- Success page shows tables-auto-seated count and song-requests count alongside guests.

**Display:** [src/app/(app)/guests/HouseholdBlock.tsx](src/app/(app)/guests/HouseholdBlock.tsx) — guest rows now show meal trio (🍲 starter · 🍽 main · 🍰 dessert) inline below the contact line, truncated to 3 words with full-text tooltip on hover.

**Verified against real data:** the Say I Do export the user shared (22 attending guests, 6 unique tables, 35+ song requests across Q3/Q5/Q9, 3-course meal choices, mixed Adult/Child rows) maps cleanly with all heuristics auto-detecting correctly.

### 2026-04-27 · v0.8.0 — Phase E: CSV / TSV guest import

The Guests page now has an **Import CSV** button in its header (couple-tier and anyone with `guests:edit`). Lands on `/guests/import` — a paste-and-preview flow that handles:

- **CSV or TSV** — auto-detected from the header line. Quoted fields, escaped quotes (`""` → `"`), and embedded commas are all handled. (Multi-line cells inside quotes also work, though Say I Do exports rarely use them.)
- **Column auto-inference** — header heuristics map "First Name", "Email Address", "+1", "Dietary Requirements", etc. to known fields. The user can override any guess via per-column dropdowns. Required: First name, Last name. Everything else is optional.
- **Live dry-run preview** — for every parsed row, shows the coerced values + per-row errors (missing required fields, oversize names) and warnings (malformed email, unparseable boolean). The preview shows the first 12 rows by default with a "Show all" toggle for bigger imports.
- **Household resolution** — rows sharing a household name go to the same household. Existing households (matched by exact name) get merged into; new households are created. Newly-created households inherit the dominant `side` value from their members. Rows without a household name get a per-guest household named `"FirstName LastName"` so they don't get dumped into one giant pile.
- **Commit in a single server action** — wraps household creation + guest insertion in a transaction-friendly pattern. Skips rows with errors (the preview already showed them); creates everything else. Audited as `import` on the Guest entity with a metadata blob containing counts and new-household names.

New module [src/lib/csv.ts](src/lib/csv.ts) holds the parser, column-inference heuristics, and value coercion (boolean, side, RSVP, dietary). Shared client + server so the page's live preview parses the same way the commit action does.

Subsumes the "Say I Do sync" backlog item — Say I Do exports CSV, paste it here.

### 2026-04-27 · v0.7.1 — Bugfix: seating table positions survive navigation

User report: tables didn't always hold their dragged position when switching from canvas to list view, or navigating to other pages and back.

**Cause:** `updateTablePosition` deliberately skipped `revalidatePath('/seating')` to avoid a perceived drag-flicker concern. Result: the page's server-side `tables` data stayed at its original snapshot. When `SeatingCanvas` unmounted (Canvas → List toggle, or navigation away) its local position state was destroyed; on remount it re-seeded from the stale prop and tables snapped back to their pre-drag positions.

**Fix:** added `revalidatePath('/seating')` at the end of the action. The flicker concern was overblown — the canvas's local-position-priority `useEffect` already preserves the latest local state when the prop refreshes (see `prev[t.id] ?? { x: t.posX, y: t.posY }`), so revalidation is invisible during a session and *correct* after navigation.

### 2026-04-27 · v0.7.0 — First / last name fields + welcome prompt + Settings profile panel

The User model now has dedicated `firstName` and `lastName` columns alongside the legacy `name` (which is auto-synced as `${firstName} ${lastName}` whenever the named-fields are set, so existing display sites — sidebar, members matrix, avatar initials — keep working without touching their queries).

**First-time prompt.** Signing in for the first time used to leave you with a `name=null` row that displayed as your bare email. Now the `(app)` layout server-component runs a fresh DB lookup on every render and redirects to `/welcome` if neither `firstName` nor `name` is set. `/welcome` lives outside the `(app)` group, so the redirect doesn't loop. The form prefills from the legacy `name` field when present (split on first space) so seed-bootstrapped users don't have to retype.

**Settings → Your profile.** A new panel above the permission matrix lets the signed-in user rename themselves any time. Same `setMyName` action backs both the welcome flow and the inline edit — single source of truth for validation (1–80 chars, both required) and audit logging.

**Seed update.** `prisma/seed.ts` now sets `firstName` + `lastName` on the placeholder rows alongside the auto-derived `name`. Existing production rows get the new columns as NULL via the additive migration; their `name` field stays populated (so they still display correctly until they next sign in and hit the welcome flow).

**Migration:** `20260427160000_add_user_name_fields` adds the two NULLable columns. No data backfill needed — the legacy `name` column remains the canonical display source until firstName lands.

### 2026-04-27 · v0.6.0 — Phase D2: drag-and-drop seating canvas

The Seating page now has a real canvas. Tables render as SVG shapes (circle for round, rounded rectangle for rectangle/head) at their `posX`/`posY` coordinates, sized by capacity. Drag with mouse or touch — Pointer Events with `setPointerCapture` so a fast flick doesn't lose the grab. On drop, positions snap to a 20-unit grid (only if within 10 px tolerance, so deliberate off-grid placements survive). Position changes commit via a new `updateTablePosition` server action that's audited but doesn't `revalidatePath` (would interrupt the drag flow); the page revalidates on assign / create / delete as before.

Click-without-drag focuses a table → side panel slides in with the seat-assignment dropdowns (same UX as the existing list view, just relocated). Keyboard nudging on the focused table: arrow keys = 20 units, ⇧+arrow = 80. Tables are tabbable with aria-labels reading "Table X, N of M seated".

View toggle (Canvas | List) lives at the top right of the Seating page; the choice persists to `localStorage` so reloads keep your preference. The list view (existing `TableCard` grid) is unchanged and remains the better mobile / accessibility option.

`createTable` now positions new tables in a 3-column / 280×240 grid based on existing count, so they no longer stack at (0,0). Existing tables in production keep their stored positions.

Seating constraint rules (must-sit-together / must-not / prefer-group) are deferred to a future iteration — captured in the backlog.

### 2026-04-27 · v0.5.0 — Per-file visibility + file management UX

**New `FileVisibility` enum and `File.visibility` column** (additive migration `20260427150000_add_file_visibility`, default `EVERYONE`). Couple-only files are filtered out of the list query for non-couple users and rejected with a 404 by the download route — non-couple users can't even probe whether a private file exists. The page subtitle shows non-couple users a *"N hidden (couple-only)"* hint so they know files exist but they're not allowed to see them.

**Files page rebuilt** with proper management affordances:
- **Grouped by folder** — named folders sort alpha, "Unfiled" appears at the bottom
- **Hover-revealed actions per row** — toggle visibility (🔒/🔓), Edit (rename + move folder + visibility), Delete (×)
- **Inline edit form** — name, folder (datalist autocompleting against existing folders), visibility radio buttons (couple-only is gated to actual couple-tier users)
- **Multi-file upload** — drop or click to upload several at once; each goes through the same validate → write → DB-insert path with per-file error handling
- **Visibility selector on the upload zone** (couple-tier users only) so private docs land private from the start
- **Couple-only chip** — `🔒 Couple` badge on rows so it's obvious at a glance which files are private

Server actions consolidated: `uploadFile` (now multi), `updateFile(id, patch)` covering rename / move / visibility / any combination, `deleteFile`. All gated by `requireEdit("files")` and audited.

### 2026-04-27 · v0.4.1 — Remove-from-members in Settings

Small follow-up to v0.4.0. The Settings → permission matrix now has a hover-revealed `×` button on every row (except your own). Clicking it confirms, then atomically deletes the user's `Permission` rows + `User` row inside a transaction. `Account` and `Session` rows cascade automatically via the FKs in [schema.prisma](prisma/schema.prisma); `AuditLog` rows keep their history with `userId` set to NULL because the relation is optional. Self-removal is refused server-side as a defence-in-depth check on top of the UI's hidden button.

Replaces the `psql DELETE FROM "User"` workaround for cleaning up the placeholder seed users — admins can now do it from the UI.

### 2026-04-27 · v0.4.0 — Phase D1 file uploads + bootstrap admin + pretty magic-link email

**Three things in one bump.** First production minor since going live this morning.

**Phase D1 — file uploads.** The Files page now actually accepts files instead of letting users register references to files-elsewhere. Drag-and-drop or click-to-upload, 25 MB cap, MIME allowlist (PDF / common images / Office docs / txt+csv / zip), content-addressable storage on the existing `uploads:` named volume. Downloads stream through `/api/files/[id]` with a session + `canView("files")` gate; safe types (PDFs, images, text) render inline, others force `attachment`. Body-size budget raised at all three layers — Caddy, Next, app — to 26 MB. The Dockerfile now pre-creates `/app/uploads` with `node:node` ownership so the volume initialises writable for UID 1000.

**Bootstrap admin.** The first user to actually authenticate gets promoted to couple-tier automatically (predicate: `count(User where isCouple=true AND emailVerified IS NOT NULL) === 0`). After that, new sign-ins join as VIEWER and the existing admin promotes them via the Settings matrix. No env var, no SQL surgery. Replaces an earlier (rejected) `COUPLE_EMAILS` design — see the feedback memory if you're tempted to introduce another env-var enumeration of users.

**Pretty magic-link email.** Replaced the one-paragraph placeholder with a proper inline-CSS HTML email — wedding-themed (moss-green CTA, Fraunces-fallback serif heading, soft canvas background), 600 px table layout that stacks on mobile, plain-text fallback for clients that strip HTML. Subject unchanged.

Phase D split: D1 (uploads) ✅ shipped here, D2 (drag-drop seating canvas) is the next chunk.

### 2026-04-27 · v0.3.2 — 🚀 Live on Unraid + post-deploy back-ports

The app is **live in production at https://wedding.spencer-net.com**. Jamie signed in via Resend-delivered magic link; full 4-service stack stable on the Unraid box behind a Cloudflare Tunnel.

Issues caught during the live deploy that have now been back-ported to the repo:

- **`db` service: removed `user: "999:999"`.** `postgres:16-alpine`'s built-in `postgres` user is UID 70. Forcing 999 made `initdb` fail with "Operation not permitted" on the data dir.
- **`db` healthcheck: `start_period: 10s` → `60s`, `retries: 5` → `10`.** `initdb`'s shutdown checkpoint takes ~22s on a slow Unraid array (sync=21s observed). The old timing made the orchestrator give up before postgres was actually ready.
- **`public/.gitkeep` committed** so the Dockerfile `COPY /app/public ./public` succeeds even though the project has no static assets yet.
- **`Dockerfile`: `--chown=nextjs:nodejs` → `--chown=node:node`** to match the `USER node` directive (the `nextjs` user was removed when we adopted alpine's prebuilt `node` user but the chown args were left dangling).
- **`CLAUDE.md` added at repo root** — context file for future Claude Code sessions, covering the Unraid topology, do-not-do list, branching, and where-to-look-when-things-break table. Generated from the deploy-session debrief.

Live deploy decisions (no repo change required, captured here for the record):

- **Cloudflare Tunnel** + Resend for SMTP (apex sender, DKIM via Cloudflare integration)
- **GHCR private package**, Unraid host logged in with classic PAT (`read:packages`)
- **Compose Manager Plus** stack at `/boot/config/plugins/compose.manager/projects/wedding-hub/`
- **Caddy static IP `192.168.50.25` on `br0`**, tunnel routes `wedding.spencer-net.com` → that IP:80
- **Allowed users:** just Jamie for now; rest added when their addresses are confirmed

### 2026-04-27 · Deploy-config rewired for Cloudflare Tunnel + GHCR
On `dev`, no version bump (deployment-environment changes only — app code unchanged from v0.3.1).
- Caddy now runs in Tunnel mode: `auto_https off`, listens on `:80` only, joins `br0` macvlan with static IP `192.168.50.25`. Real client IP read from `CF-Connecting-IP`. `caddy/Caddyfile` rewritten; the prior auto-TLS variant is recoverable from git history.
- `web` service pulls `ghcr.io/spacetoast1738/wedding-hub:dev` with `pull_policy: always` instead of building locally on Unraid. CI workflow at [.github/workflows/build.yml](.github/workflows/build.yml) builds and pushes on every push to `main`/`dev`, tagging by branch + short SHA + `:latest` (default branch only).
- All bind-mount paths absolute under `/mnt/user/appdata/wedding-hub/` so Compose Manager Plus (which stores stack YAML on `/boot` USB) doesn't try to resolve relative `./` against the USB.
- `TLS_EMAIL` removed from `.env.production.example` (no Let's Encrypt). `EMAIL_FROM` default → `noreply@spencer-net.com`.
- README deploy section rewritten for the Tunnel + GHCR flow: `docker compose pull` instead of `--build`, prerequisite checklist (cloudflared stack, br0, free LAN IP, SMTP), updated routine ops including image-rollback recipe.
- Risks list updated: dropped DNS+port-forward concern, added cloudflared-stack-must-exist and macvlan-IP-collision concerns.

### 2026-04-27 · Repo published to GitHub
Not a code release — organisational milestone. No version bump.
- The session's work was reconstructed into four phase-aligned commits and pushed to [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub):
  - `4fdc332` `feat: Phase A — bootable shell` (tag **v0.1.0**)
  - `0fe9c4f` `feat: Phase B — domain pages` (tag **v0.2.0**)
  - `c275223` `feat: Phase C — production deploy stack` (tag **v0.3.0**)
  - `6c2999d` `feat: v0.3.1 — deploy-readiness fixes` (tag **v0.3.1**)
- `claude/main` holds the four tagged releases. New `dev` branch tracks work in progress; one chore commit on it (`e7c4f03`) tracks `package-lock.json` and adds `.claude/` to `.gitignore`.
- Working tree is now at `C:\Users\Admin\Code\wedding-hub` under git. The old TOWER mirror at `\\TOWER\Jamie Spencer\Claude\wedding-hub` is no longer used — flagged for manual removal (this Claude session's harness was holding it open and the safety rail blocked the recursive delete).
- Memory updated: `ROADMAP.md` is the canonical living plan; the standing rule to update it every iteration carries forward.

### 2026-04-27 · v0.3.1 — Deploy-readiness fixes
- **Initial Prisma migration committed** at `prisma/migrations/20260427120000_init/` so first-boot `migrate deploy` actually creates the schema (the prior state would have left a fresh DB empty)
- **Log rotation** — `x-logging` anchor referenced by all 4 compose services: `json-file` driver, `max-size: 10m`, `max-file: 3`. 30 MB ceiling per service.
- **Version pill in the sidebar** — `v0.3.1` shown below the avatar menu, sourced from `package.json` via `src/lib/version.ts` (build-time inline, no runtime FS read)
- **Health endpoint** now returns `{ ok, version, db }` so `curl /api/health` confirms what's deployed
- ROADMAP risks updated: DNS / Cloudflare Tunnel and bind-mount perms are now called out as pre-deploy gates
- Verified: `docker compose config` ✓, migration SQL validates clean

### 2026-04-27 · v0.3.0 — Phase C — Production deploy
- Multi-stage Dockerfile: deps → builder (next build + prisma generate + seed transpile) → runner (alpine + tini + non-root + healthcheck)
- entrypoint.sh runs `prisma migrate deploy` before booting the app
- docker-compose.yml with `caddy`, `web`, `db`, `backup` on `edge` + `internal` networks; no host ports for db/web; read-only FS, cap_drop ALL, no-new-privileges
- Caddyfile with auto-TLS, HSTS / CSP / X-Frame-Options / Permissions-Policy / COOP / CORP, dotfile + scan probe blocks, 4 MB body cap, commented rate-limit stub
- `/robots.txt` route + middleware whitelist
- Backup service: pg_dump daily, 7d / 4w / 12m retention to host bind-mount
- `.env.production.example`, `.dockerignore` tightened
- README has deploy walkthrough, ops commands, hardening notes, Cloudflare Tunnel alt
- ROADMAP.md created (this document)
- Verified: `docker compose config` ✓, `tsc --noEmit` ✓, `next lint` ✓ (no warnings), `next build` ✓ (21 routes, +`/robots.txt`)
- **Not yet verified:** end-to-end `docker build` (Docker Desktop daemon was off — first build on the Unraid host is the real smoke test)

### 2026-04-27 · v0.2.0 — Phase B — Domain pages
- 12 sections fully ported with server actions, Zod validation, `requireEdit`, `audit()`, `revalidatePath`
- Shared helpers in `src/lib/actions.ts` and `src/lib/format.ts`
- Patterns: inline-edit rows with hover-revealed Edit/Delete, `<form action={serverAction}>` + `useTransition` client wrappers
- Deferred: file upload backend, seating canvas, CSV import, photography shot list, day-of mode, quick-capture, Spotify
- Verified: `tsc --noEmit` ✓, `next lint` ✓, `next build` ✓ (20 routes; settings is the heaviest at 19 kB / 119 kB first-load)

### 2026-04-27 · v0.1.0 — Phase A — Bootable shell
- App Router scaffolding, Tailwind v4 with tokens from `prototype/tokens.css`, dark mode with FOUC script
- Auth.js v5 magic-link with email allow-list, JWT session, custom sign-in / verify / error pages
- Middleware redirects unauthenticated users + gates couple-only routes
- AppShell (RSC) + Sidebar + MobileTabBar + AvatarMenu, with permission-filtered nav
- 7 UI primitives + ComingSoon stub component
- Today page wired to real Prisma queries
- 12 stub pages so all sidebar links work
- `/api/health` endpoint, README quickstart, `db:reset` script
- Seed script: 5 named users, permissions, sample tasks/events/household/book sections
- Verified: `npm install` (361 packages) ✓, `tsc --noEmit` ✓, `next lint` ✓, `next build` ✓ (20 routes, middleware 82.9 kB)
