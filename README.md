# Wedding Hub

Private wedding-planning app for Jamie & Bryony — replaces a Notion + Say I Do setup. Used through to the wedding day on **26 September 2026**.

- **Live:** wedding.spencer-net.com (private — magic-link sign-in, env-list of allowed emails)
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma · Postgres 16 · Auth.js v5
- **Tests:** Vitest unit + Postgres integration + Playwright e2e (all gated in CI before image build)
- **Docs:** [ROADMAP.md](ROADMAP.md) (changelog + phase plans) · [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md) (post-audit programme) · [TESTING.md](TESTING.md) (pre-promote checklist)

## Standing rules

- **Admin-only app.** Planners + couple + wedding party only. Guest data is managed via Say I Do — no public RSVP forms or guest portals. Email reminders go to the planner/couple, never to invitees.
- **Never tag a build until GHA goes green on the same SHA.** Pre-promote checklist: `typecheck && lint && test && test:e2e && build`. Migrations run in the integration job too.
- **Update ROADMAP.md before declaring an iteration done.** Every release ends with a changelog entry; the most recent is at the top.
- **Promote `dev → claude/main` via fast-forward, then tag `vX.Y.Z`.** No squash, no rebase. Tags are immutable.

## Local development

### Prerequisites

- Node 20.18+
- Docker (for the Postgres container)

### One-time setup

```bash
# 1. Postgres in a throwaway container
docker run -d --name wh-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=wedding_hub \
  postgres:16

# 2. Env vars
cp .env.example .env.local
# Edit .env.local — at minimum set AUTH_SECRET (run `openssl rand -base64 32`)
# and update USER_*_EMAIL / AUTH_ALLOWED_EMAILS to your real addresses.

# 3. Install + migrate + seed
npm install
npx prisma migrate deploy   # applies all existing migrations
npm run db:seed
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

You'll be redirected to `/signin`. Submit one of the emails from `AUTH_ALLOWED_EMAILS`. Because no SMTP is configured, the magic-link URL is printed straight to the terminal — copy and open it. After clicking the link you land on the **Today** page.

To configure real email delivery, fill in the `EMAIL_SERVER_*` vars in `.env.local`.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit suite (~190 tests, <1s) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:integration` | Postgres-backed integration tests (needs `DATABASE_URL` containing `test` or `local`) |
| `npm run test:e2e` | Playwright e2e specs (Chromium-only). Auto-starts the dev server. |
| `npm run test:e2e:ui` | Playwright in inspector mode |
| `npm run db:migrate:dev` | Create + apply a new migration |
| `npm run db:seed` | Seed users, permissions, sample data |
| `npm run db:reset` | Drop + recreate + reseed the database (destructive) |
| `npm run db:studio` | Open Prisma Studio |

### Health check

```bash
curl http://localhost:3000/api/health
# → {"ok":true,"db":"up"}
```

## Project layout

```
prisma/
  schema.prisma            ← single source of truth for the data model
  seed.ts                  ← idempotent seed (users + permissions + book sections + sample data)
  migrations/              ← additive migrations only — no schema drops or breaking changes

src/
  app/
    (app)/                 ← authenticated routes wrapped by AppShell
      page.tsx                 → Today (countdown + tasks + upcoming + snapshot strip)
      glance/, tasks/, questions/, schedule/, suppliers/, guests/, seating/, songs/,
        book/, files/, budget/, payments/, settings/, today/day-of/  ← live sections
      *.ts (actions.ts)        ← per-section server actions; gated via requireEdit()
    signin/                ← magic-link sign-in flow + bootstrap-admin promotion
    api/
      auth/[...nextauth]/route.ts
      health/route.ts          ← public; used by health checks
      files/[id]/route.ts      ← signed file downloads
  auth.ts                  ← Auth.js v5 config (server-only) — magic-link + rate-limit + audit
  auth.config.ts            ← shared edge-safe config (used by middleware)
  middleware.ts            ← redirects unauthenticated users + gates couple-only routes
  components/
    ui/                    ← Button, Input, Avatar, StatusPill, Tag, PageHeader,
                             Toaster (window-event toast bus), Illustrations
                             (~14 SVG components ported from prototype),
                             EventMotifIcon (heuristic title → 16px SVG)
    shell/                 ← AppShell, Sidebar, MobileTabBar, AvatarMenu, QuickCapture
  lib/                     ← Pure decision modules + shared helpers:
    db.ts                      ← Prisma client singleton
    permissions.ts             ← canView / canEdit per section
    actions.ts                 ← requireUser / requireEdit / audit() helpers
    audit.ts                   ← AuditLog write helper
    csv.ts + csv-merge.ts      ← CSV import: parse, infer mapping, merge decision
    budget.ts                  ← computeActual (B2) — manual override or sum of payments
    custom-fields.ts           ← parse/format/merge typed values (text/number/date/select)
    dark-mode.ts               ← resolveDarkMode (DB > localStorage > default)
    last-edited-fields.ts      ← per-field manual-edit timestamps (C4)
    nudge-digest.ts            ← (planned v1.24.0) — RSVP / overdue-task digest decisions
    notify.ts                  ← window-event toast bus
    plus-one.ts                ← decidePlusOneAction — host edits ↔ +1 row
    rate-limit.ts              ← decideRateLimit — magic-link 5/hour/email
    spotify.ts                 ← parsePlaylistId + Client Credentials sync
    supplier-follow-up.ts      ← decideFollowUpTask (B3)
    wedding-settings.ts        ← (planned v1.20.0) — DB-backed wedding date/venue/couple
    format.ts, version.ts      ← misc helpers

tests/
  unit/                    ← Vitest pure-decision tests (~190; mocks Prisma)
  integration/             ← Postgres-backed (skips when DATABASE_URL doesn't contain "test"/"local")

e2e/                       ← Playwright specs (anonymous-redirect for now)

prototype/                 ← original visual reference (vanilla React + inline styles).
                             Components ported into src/components/ui/Illustrations.tsx
                             (C6, v1.15.0 + v1.19.0 IllusCountdown).
```

## Permission model

Two layers gate access:

1. **Sign-in allow-list:** the magic-link provider checks the email against `AUTH_ALLOWED_EMAILS` (csv). Anyone else hits `/signin/error`. The list is also rate-limited at 5 attempts/hour/email (post-audit fix A3, v1.3.0; tracked in the `MagicLinkAttempt` table).

2. **Per-section permissions:** every section has its own `Permission(userId, section, level)` row. Levels: `NONE | VIEW | EDIT`. The couple short-circuits — `User.isCouple = true` is treated as EDIT-on-everything, including the couple-only sections (Budget, Payments). Page-level routes redirect non-`canView` users to `/`; server actions throw `Forbidden:` when `canEdit` fails (caught by `(app)/error.tsx` for a friendly UX).

| Role          | Default `EDIT` sections                                                       | Budget / Payments       |
|---------------|--------------------------------------------------------------------------------|-------------------------|
| Couple        | All sections + Settings; `isCouple=true` overrides every gate                  | EDIT                    |
| Wedding party | tasks, questions, schedule, suppliers, guests, seating, songs, files, book     | NONE (route redirects)  |
| Planner       | same as wedding party                                                          | NONE                    |
| Viewer        | nothing by default; couple grants per-section access via Settings matrix       | NONE                    |

**Bootstrap admin:** the first user to verify a magic-link sign-in (where `verifiedCoupleCount === 0`) is promoted to `isCouple = true` automatically — they then grant access to the rest of the wedding party via the Settings → Permissions matrix. After that, every new sign-in defaults to `VIEWER` until granted otherwise.

**Couple-gated writes:** a few actions require `user.isCouple === true` even when the caller has `EDIT` on the section (post-audit fixes A2 / A6, v1.2.0):
- `setUserCouple`, `setPermission`, `removeUser` (settings) — only the couple toggles other users' couple-tier or grants permissions.
- `updateFile` visibility transitions involving `COUPLE_ONLY` — non-couple editors can edit content but can't flip a public file to couple-only or vice versa.
- `setBookSubsectionVisibility` (C1, v1.14.0) — same shape for book pages.

All writes are audit-logged via `audit()` (`src/lib/actions.ts`); the AuditLog viewer in Settings (planned v1.21.0) surfaces it.

## Production deployment

The stack runs on the Unraid server via `docker compose`, fronted by **Cloudflare Tunnel** — no public ports on the host, no Let's Encrypt to manage. Cloudflare terminates TLS at the edge and forwards plain HTTP through the tunnel to Caddy, which is reachable only on the LAN.

```
   user → Cloudflare (HTTPS) → Cloudflare Tunnel ─┐
                                                  ▼
                                         ┌─────────────────┐
                                         │   cloudflared   │  br0 macvlan
                                         │ (separate stack)│  (LAN-resident)
                                         └────────┬────────┘
                                                  │ http
                                                  ▼
                                  ┌─────────────────────────┐
                                  │  caddy  192.168.50.25:80│  br0 (static IP)
                                  │  headers, body cap      │  + internal
                                  └────────────┬────────────┘
                                               │ internal network (no host ports)
                                  ┌────────────┴───────┬──────────────┐
                                  ▼                    ▼              ▼
                             ┌─────────┐         ┌─────────┐   ┌──────────────┐
                             │   web   │         │   db    │   │   backup     │
                             │ Next.js │ ──────► │  pg-16  │ ◄─┤ pg_dump +    │
                             │  :3000  │         │  :5432  │   │ retention    │
                             └─────────┘         └─────────┘   └──────────────┘
```

The `web` image is built by GitHub Actions on every push to `claude/main` / `dev` and pushed to GHCR. The build job is gated on three test tiers passing first: typecheck/lint/unit (Vitest), Postgres integration (`prisma migrate deploy` + integration tests against a service-container DB), and Playwright e2e (5 specs, against a built app). A green tag means all three tiers passed against that exact SHA.

Tags published per push:
- `:claude-main` and `:latest` — set on `claude/main` only (latest release branch).
- `:dev` — moved on every `dev` push (current work-in-progress).
- `:vX.Y.Z` — immutable, set when a release tag is pushed.
- `:sha-<short>` — immutable, set on every push to either branch.

Compose pulls the image; the Unraid box never builds.

### First-time deploy on Unraid

#### Prerequisites

1. **Cloudflared running** as a separate stack on Unraid, attached to `br0` macvlan, with a tunnel public hostname (`wedding.spencer-net.com`) configured to forward to `http://192.168.50.25:80`. Set this up in the Cloudflare Zero Trust dashboard.
2. **`br0` macvlan network** exists on the Docker host (Unraid usually creates this automatically when you enable macvlan).
3. **`192.168.50.25`** is free on your LAN — adjust the static IP in `docker-compose.yml` if your subnet differs.
4. **SMTP relay credentials** for magic-link delivery (Resend recommended). Without them, sign-in URLs print to `docker compose logs web`.

#### Stack setup

```bash
# SSH into Unraid, then:
mkdir -p /mnt/user/appdata/wedding-hub
cd /mnt/user/appdata/wedding-hub
git clone -b dev https://github.com/SpaceToast1738/wedding-hub.git .

# Pre-create bind-mount dirs with the right ownership (backup runs as UID 1000):
mkdir -p backups
chown -R 1000:1000 backups

# Fill in env
cp .env.production.example .env
nano .env
# Required: DOMAIN, POSTGRES_PASSWORD, AUTH_SECRET, AUTH_ALLOWED_EMAILS,
# EMAIL_SERVER_* (Resend / Mailgun / etc).
# Generate secrets:
#   openssl rand -base64 32   →  AUTH_SECRET
#   openssl rand -base64 24   →  POSTGRES_PASSWORD

# Pull the latest :dev image and start. The web container's entrypoint
# runs `prisma migrate deploy` before booting Next.js.
docker compose pull
docker compose up -d

# First-time only: seed the 5 known users + sample data.
docker compose exec web node prisma/seed.js
```

Watch logs until everything is green:

```bash
docker compose logs -f web    # ▶ prisma migrate deploy → Applied N migrations → Ready on …
docker compose logs -f caddy  # listening :80, no ACME chatter
```

Then visit `https://wedding.spencer-net.com` (Cloudflare proxies through the tunnel) and sign in with one of the allow-listed addresses.

### Routine ops

| Task | Command |
|---|---|
| Tail web logs | `docker compose logs -f web` |
| Tail Caddy logs | `docker compose logs -f caddy` |
| Update to latest `:dev` build | `docker compose pull web && docker compose up -d web` |
| Roll forward to a tagged release | edit `image:` to `ghcr.io/spacetoast1738/wedding-hub:v1.19.0` (or `:claude-main`, `:latest`), then `docker compose up -d web` |
| Roll back to a known-good SHA | edit `image:` to `ghcr.io/spacetoast1738/wedding-hub:sha-<short>`, then `docker compose up -d web` |
| Run a one-off migration | `docker compose exec web npx prisma migrate deploy` |
| Open Prisma Studio | `docker compose exec web npx prisma studio` (then port-forward 5555) |
| Manual backup now | `docker compose exec backup /backup.sh` |
| Inspect DB | `docker compose exec db psql -U wedding wedding_hub` |
| Restore a backup | `gunzip -c /mnt/user/appdata/wedding-hub/backups/daily/wedding_hub-YYYY-MM-DD.sql.gz \| docker compose exec -T db psql -U wedding wedding_hub` |
| Health check | `docker compose exec web curl -fsS http://127.0.0.1:3000/api/health` |

Backups land in `/mnt/user/appdata/wedding-hub/backups/{daily,weekly,monthly}/` with **7d / 4w / 12m** retention. Snapshot the directory off-box (rclone, restic, parity sync to a second array, etc.) — a full Unraid failure would otherwise lose them.

### Hardening notes

- **No host ports** at all. Caddy listens on `192.168.50.25:80` (LAN-only via br0); the tunnel is the only ingress. db and web have no host bindings.
- **web container** runs as UID 1000, read-only filesystem (with tmpfs for `/tmp` and `/app/.next/cache`), `cap_drop ALL`, `no-new-privileges`.
- **Caddy** strips its `Server` banner, sets HSTS / CSP / X-Frame-Options / Permissions-Policy, blocks dotfile probes, and caps request bodies at 4 MB. Real client IP comes from `CF-Connecting-IP` (set by Cloudflare on every tunnelled request).
- **`/robots.txt`** disallows all crawlers and the page is non-discoverable.
- **Rate-limiting** for `/api/auth/*`: not enabled at the Caddy layer (the `rate_limit` module isn't in stock `caddy:2-alpine`). Cloudflare's WAF + Auth.js per-token expiry + the 5-email allow-list bound the blast radius. If you want a Caddy-level rate-limit, build a custom Caddy with `xcaddy build --with github.com/mholt/caddy-ratelimit`.

### Optional: switch back to direct port-forward

If you ever want to drop Cloudflare and let Caddy terminate TLS itself:

1. Replace `caddy/Caddyfile` with the auto-TLS variant in git history (look for `auto_https on` and `email {$TLS_EMAIL}` in older revisions).
2. Re-add `ports: 80:80, 443:443, 443:443/udp` to the `caddy` service in compose.
3. Drop the `br0` static IP and `auto_https off` config.
4. Add an A record for `${DOMAIN}` and forward 80 + 443 from the router to the Unraid LAN IP.

## Email deliverability

Magic-link emails ship via Resend SMTP. Sending from a custom domain
(`hello@spencer-net.com`) requires SPF + DKIM records on
`spencer-net.com` so receivers (Gmail, Outlook, Apple Mail) accept the
mail as authenticated. Without them, even well-formed transactional
mail lands in Spam.

### Setup checklist

1. **In Resend dashboard** (https://resend.com/domains) → Add Domain
   → enter `spencer-net.com`. Resend generates three DNS records:
   - SPF (TXT @): `v=spf1 include:_spf.resend.com ~all`
     (or appended to existing SPF — only one SPF record allowed per
     domain, multiple is a config error that breaks all of them)
   - DKIM (TXT at `resend._domainkey.spencer-net.com`): the public
     key Resend generates (~250 chars)
   - MX (optional, for bounce handling — skip for transactional only)

2. **Publish the records** via your DNS provider. Wait for propagation
   (Cloudflare <1 hr; some providers up to 24 hr).

3. **Verify in Resend** → Domains → click the domain. Should flip to
   ✓ Verified.

4. **Add DMARC** (recommended, observe-mode first). TXT at
   `_dmarc.spencer-net.com`:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@spencer-net.com; pct=100
   ```
   `p=none` = "tell receivers to do nothing differently, just send me
   reports." After ~2 weeks of clean reports, ramp to `p=quarantine`,
   then `p=reject`.

### Verify it's working

Send yourself a magic link via the live site. View raw headers in
Gmail (`⋮ → Show original`). Confirm:
- `Authentication-Results: ... dkim=pass`
- `Authentication-Results: ... spf=pass`
- `Authentication-Results: ... dmarc=pass` (after step 4)
- `List-Unsubscribe: <mailto:...>` is present (added in v1.19.5)
- `Reply-To: hello@spencer-net.com` (or whatever `EMAIL_REPLY_TO` is)

If `dkim` or `spf` say `none` instead of `pass`, the DNS records
aren't propagated yet (or are missing). Recheck Resend's dashboard.

### Env vars (relevant subset)

- `EMAIL_SERVER_HOST` — `smtp.resend.com`
- `EMAIL_SERVER_PORT` — `587`
- `EMAIL_SERVER_USER` — `resend`
- `EMAIL_SERVER_PASSWORD` — Resend API key (`re_…`)
- `EMAIL_FROM` — `Jamie & Bryony <hello@spencer-net.com>` (must match
  the verified domain)
- `EMAIL_REPLY_TO` — optional override; defaults to the From address.
  Useful if replies should land in a separate inbox

### First-time recipient

Gmail flags first-time senders even with auth. Tell new recipients to
mark "Not spam" once on their first magic link; subsequent emails land
in Inbox.

## Status

The build phases (A–G) and the post-audit programme (R1–R5) all shipped between v0.1.0 and v1.15.0. Current work is feature polish per the F1 plan in [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md) and the per-release changelog in [ROADMAP.md](ROADMAP.md). The most recent release is at the top of the changelog there.

**Test pyramid (current):**
- ~190 unit tests (Vitest) — pure-decision modules in `src/lib/*` plus action-shape contracts.
- 1 Postgres integration test — `assignGuestToSeat` parallel-call invariant (B12 race fix).
- 5 Playwright e2e specs — anonymous-flow redirects (auth gate, callbackUrl preservation, public `/api/health`).

**One scheduled outstanding task:** R6 (backup verification + restore drill) — agent-task fires 26 Aug 2026 (4 weeks before the wedding) so the drill happens against realistic production data rather than seed data. See REMEDIATION-PLAN §R6.

For a one-glance state-of-the-app, open [ROADMAP.md](ROADMAP.md) — the "Current state" line at the top of the document is updated every release.
