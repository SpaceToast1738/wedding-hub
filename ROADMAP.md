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
- **Current state:** **🟢 LIVE** at https://wedding.spencer-net.com (`claude/main` at **v1.2.0**, promoted 28 Apr 2026). Phase R1 — Trust Restoration — shipped: closes 2 BLOCKER-class privilege escalations (settings self-elevation, file visibility leak), 4 smaller audit findings, and adds Vitest with 60 unit tests. R2 (magic-link rate-limit + archived-guest restore UI) is the next remediation phase.

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
| _(unreleased on `dev`)_ | 2026-04-28 | [v1.2.3 — `.npmrc` legacy-peer-deps + revert nodemailer to v6 (CI fix, third attempt)](#2026-04-28--v123--npmrc-legacy-peer-deps--revert-nodemailer-to-v6) |
| v1.2.2 | 2026-04-28 | [Bumped nodemailer to v7 (broke next-auth peer; didn't fix CI)](#2026-04-28--v122--bump-nodemailer-to-v7--fix-jwt-augmentation-real-ci-fix) |
| v1.2.1 | 2026-04-28 | [Pin Vitest to v2.x (didn't actually fix CI)](#2026-04-28--v121--pin-vitest-to-v2x-to-fix-docker-build) |
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

Ranked roughly by usefulness × ease.

### High value
- **Seating constraint rules** — must-sit-together / must-not-sit / prefer-group hints, plus violation indicators on the canvas. The prototype had a richer rules panel; we shipped the canvas without it for v0.6.0.
- **CSV import: update / dedupe modes** — v0.8.0 always creates new rows. A future iteration could add "match by email and update existing" + "skip duplicates" modes alongside the current "create".

### Medium value
- ~~**Day-of mode**~~ — shipped in v0.15.0.
- ~~**Quick-capture (`C` shortcut) modal**~~ — shipped in v0.15.0 (Task / Question / Event types; Payment intentionally excluded).

### Lower value
- ~~**Say I Do sync**~~ — covered by the v0.8.0 CSV import path. Just export to CSV from Say I Do and paste it into `/guests/import`.
- ~~**Spotify playlist sync**~~ — shipped in v0.14.0 as Phase G1 (Client Credentials, public-playlist read-only mirror). User-OAuth for private playlists still possible if needed.
- ~~**Glance / At-a-glance dashboard**~~ — shipped in v1.1.0 (RSVP donut, budget bar, payments due, audit-log activity feed).
- **Custom fields UI in Settings** — the schema has `CustomField` but no UI. Defer until something needs it.
- **Rate-limit on `/api/auth/*`** — Caddyfile stub waiting on a custom Caddy build with `xcaddy --with github.com/mholt/caddy-ratelimit`. Auth.js token expiry + email allow-list is the current mitigation.
- **Audit log viewer** — there's data, no UI. Could live under Settings.

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

`1.2.3` on `dev`, `claude/main` at `v1.2.1`. Holding the promote until GHA confirms green on the same SHA — first time we've followed that rule in this session, after burning v1.2.1 and v1.2.2 by promoting prematurely.

## Changelog

Most recent entry on top. Add a new entry at the end of every meaningful iteration.

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
