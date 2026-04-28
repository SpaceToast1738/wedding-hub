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
| **v1.19.6** | 2026-04-28 | [README rewrite: standing rules, current test pyramid, fix stale phase-status](#2026-04-28--v1196--readme-rewrite) |
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
RSVP form) and 7 (guest portal) from the original menu were explicitly
dropped because they violate the admin-only rule above.

- **Audit log viewer in Settings** — data already exists (every server
  action writes an `AuditLog` row); just no UI. Useful when "who changed
  Bryony's RSVP" comes up. ~1 hr.
- **Search beyond /guests** — extend the v1.12.0 sticky-search pattern
  ([GuestList.tsx](src/app/(app)/guests/GuestList.tsx)) to `/suppliers`
  and `/tasks`. Aimee asked for it on guests; the same pattern fits
  both other surfaces. ~1.5 hrs.
- **Custom fields for Supplier + Task** — extends v1.15.0's Guest-only
  registry. The `CustomField.entity` field already supports it; just
  unlock the entity dropdown in the Settings panel + wire two more
  rendering surfaces (`/suppliers/[id]`, `/tasks/[id]` if it exists, or
  the inline TaskRow edit form). ~2 hrs.
- **Print stylesheet for /budget + /payments** — couple-only sheets
  the venue or planner might want as paper. The pattern is already in
  use on `/schedule` and `/guests/catering`. ~1 hr.
- **Email reminders / nudges** — `Guest.lastNudgedAt` is already in the
  schema. Build the "nudge unconfirmed RSVPs" + "follow-up task due
  tomorrow" surfaces. Sends to the planner / couple, not to guests
  (per the standing rule). ~3 hrs.
- **BookSection audience overrides** — currently only BookSubsection
  has `visibility EVERYONE|COUPLE_ONLY` (C1, v1.14.0). Extend to the
  parent BookSection so the couple can hide a whole section, not just
  individual pages. ~1 hr.

### Older / lower-priority backlog

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
