# Wedding Hub — Roadmap

> **Living document.** Updated at the end of each meaningful iteration. The most recent entry is at the top of the [Changelog](#changelog).
>
> **Audience:** Jamie (and Claude resuming a session). The README is for users; this is for whoever's building it.

## Snapshot

- **Wedding date:** 26 September 2026
- **Production URL:** wedding.spencer-net.com (private)
- **Repo:** [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub) · `claude/main` (releases) + `dev` (work-in-progress)
- **Stack:** Next.js 15 · TypeScript · Tailwind v4 · Prisma · Postgres 16 · Auth.js v5 · Caddy · Docker Compose
- **Working tree:** `C:\Users\Admin\Code\wedding-hub` (local SSD; the old TOWER mirror has been retired)
- **Current state:** v0.3.1 on `claude/main` — Phase C complete + initial migration committed + log rotation + version pill in the sidebar. Ready to deploy.

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| **A** | Bootable shell — auth, AppShell, Today page, stub pages, /api/health | ✅ Done |
| **B** | All 12 prototype pages ported with server actions, audit logs, permission gates | ✅ Done |
| **C** | Docker stack: Caddy + web + db + backup, hardening, Cloudflare Tunnel alt | ✅ Done |
| **D** | Real file uploads + drag-drop seating canvas | 🟡 Not started |
| **E** | CSV / Say I Do guest import wizards + diff sync UI | 🟡 Not started |
| **F** | Photography shot list, dietary aggregate, catering export PDF | 🟡 Not started |
| **G** | Spotify playlist sync, day-of mode, quick-capture (`C`) modal | 🟡 Not started |

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

## Deferred / Backlog

Ranked roughly by usefulness × ease.

### High value
- **Real file uploads** — multipart server action writing to `/app/uploads` volume; needs body-size bump in `next.config.ts` and probably MIME/size validation. Volume is already wired up. Deferred from Phase B/C.
- **CSV guest import** — paste CSV, column-map UI, dry-run diff, commit. Deferred from Phase B (Guests).
- **Catering export** — printable PDF / page aggregating dietary needs by table for the venue. Deferred from Phase B (Guests / Wedding Book).

### Medium value
- **Drag-and-drop seating canvas** — replaces the dropdown UI. The `Table.posX/posY/rotation` schema fields exist for this. Deferred from Phase B (Seating).
- **Photography shot list** — checklist within Wedding Book section. New model: `PhotographyShot`.
- **Day-of mode** — live timeline with status (now/next/past), on-call contacts, simulated mode for testing. Deferred from Phase A/B (Today).
- **Quick-capture (`C` shortcut) modal** — global capture for task/question/payment/event. Deferred from Phase A (AppShell).

### Lower value
- **Say I Do sync** — diff view + checkbox commit. Probably not worth it unless we know the API or do CSV-export-from-SID-and-import-here.
- **Spotify playlist sync** — Spotify OAuth + playlist mirror. Nice-to-have.
- **Glance / At-a-glance dashboard** — currently a stub.
- **Custom fields UI in Settings** — the schema has `CustomField` but no UI. Defer until something needs it.
- **Rate-limit on `/api/auth/*`** — Caddyfile stub waiting on a custom Caddy build with `xcaddy --with github.com/mholt/caddy-ratelimit`. Auth.js token expiry + email allow-list is the current mitigation.
- **Audit log viewer** — there's data, no UI. Could live under Settings.

## Open questions / risks

- **Real-world emails for the 5 users** — `.env.production.example` and seed.ts use placeholder addresses. Jamie's known (`jspencer1706@outlook.com`); Bryony / Josh / Aimee / planner are unknown. Set `USER_*_EMAIL` and `AUTH_ALLOWED_EMAILS` before first deploy.
- **First-deploy `docker build` not yet validated end-to-end** — local Docker Desktop daemon was off when Phase C landed. Compose config validates and all COPY paths are confirmed; first build on Unraid is the real smoke test.
- **SMTP provider not chosen** — magic-link delivery falls back to logging the URL to the web container's stdout if `EMAIL_SERVER_HOST` is blank. Fine for testing, not for Bryony.
- **DNS + port-forwarding (or Cloudflare Tunnel)** — must be set up before Caddy can complete its first ACME challenge.
- **Bind-mount permissions** — pre-create `./backups` with `chown 1000:1000` before first `docker compose up`, otherwise the backup container can't write.
- **Backup off-host strategy** — backups land on the Unraid box. A full server failure would lose them. rclone / restic / S3 sync of `./backups` is on the user.

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

`0.3.1` — Phase C + deploy-readiness fixes. Next bumps land as part of whichever phase or fix ships next.

## Changelog

Most recent entry on top. Add a new entry at the end of every meaningful iteration.

### 2026-04-27 · Repo published to GitHub
Not a code release — organisational milestone. No version bump.
- The session's work was reconstructed into four phase-aligned commits and pushed to [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub):
  - `4fdc332` `feat: Phase A — bootable shell` (tag **v0.1.0**)
  - `0fe9c4f` `feat: Phase B — domain pages` (tag **v0.2.0**)
  - `c275223` `feat: Phase C — production deploy stack` (tag **v0.3.0**)
  - `6c2999d` `feat: v0.3.1 — deploy-readiness fixes` (tag **v0.3.1**)
- `claude/main` holds the four tagged releases. New `dev` branch tracks work in progress; one chore commit on it (`e7c4f03`) tracks `package-lock.json` and adds `.claude/` to `.gitignore`.
- Working tree is now at `C:\Users\Admin\Code\wedding-hub` under git. The old TOWER mirror (`\\TOWER\Jamie Spencer\Claude\wedding-hub`) is retired.
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
