# Wedding Hub — context for Claude Code

A small private Next.js app for Jamie & Bryony's wedding (26 September 2026, Alveston Manor). Five users total: the couple, two wedding-party members, one planner. Hosted on Jamie's Unraid box.

This file gives you (Claude Code) the context you need to work productively on this repo. **Read it before making changes.** Two siblings to read alongside:

- [HANDOVER.md](HANDOVER.md) — snapshot of the current state, what's recently shipped, and "watch out for" notes for whoever's resuming work. Refreshed at the end of major sessions.
- [ROADMAP.md](ROADMAP.md) — living plan + full per-version changelog. Read the most recent entry to understand what's just shipped.

## Stack

- **Next.js 15** (App Router, standalone build) — served on port 3000
- **Auth.js v5** with **email magic links** (Nodemailer / SMTP via Resend)
- **Prisma** + **PostgreSQL 16** (alpine)
- **Caddy 2** as the reverse proxy (security headers, CSP, request body cap)
- **prodrigestivill/postgres-backup-local** for daily dumps with 7d/4w/12m retention

## Where it runs

- **Unraid box** (`Tower`, `192.168.50.98`) on a `br0` macvlan network
- **Cloudflare Tunnel** in front: `wedding.spencer-net.com` → `192.168.50.25:80` (Caddy on br0) → `web:3000` (internal compose network)
- **TLS terminated at Cloudflare's edge** — Caddy serves plain HTTP only (`auto_https off`)
- **Stack manager:** Compose Manager Plus plugin. Stack lives at `/boot/config/plugins/compose.manager/projects/wedding-hub/` on the Unraid host.

## CI/CD

- GitHub Actions ([.github/workflows/build.yml](.github/workflows/build.yml)) builds on push to `claude/main` or `dev`
- Image pushed to **GHCR** as `ghcr.io/spacetoast1738/wedding-hub:<branch>` plus `sha-<short>` tags
- Package is **private**; the Unraid host is logged into GHCR with a classic PAT (`read:packages` scope)
- Production currently tracks the `:dev` tag with `pull_policy: always` — pushing to `dev` + `Pull & Up` in the UI is the deploy flow

## Branching

- **`claude/main`** — tagged releases. Tags are immutable; never re-tag.
- **`dev`** — work in progress. Day-to-day commits land here. Production currently deploys from `:dev`.
- When ready to release, fast-forward `claude/main` to `dev`, bump `package.json`, append a [ROADMAP](ROADMAP.md) changelog entry, then `git tag -a vX.Y.Z`. See the **Versioning** section of ROADMAP for the bump rules.

## Important conventions

### Migrations run automatically
The container entrypoint ([docker/entrypoint.sh](docker/entrypoint.sh)) runs `prisma migrate deploy` on every start. Don't try to run migrations manually inside the container during deploy — it's already happened by the time `web` is healthy.

### Seed is one-shot
[prisma/seed.ts](prisma/seed.ts) creates demo users (`jamie@example.com`, etc.) and sample tasks/events. Run once after first boot:
```bash
docker compose --env-file .env exec web node prisma/seed.js
```
The transpiled `prisma/seed.js` ships in the image — the production container does NOT have `tsx` available, so use `node prisma/seed.js`, not `tsx`.

### Auth: DB invites + bootstrap admin (v1.69.0+)
Sign-in is gated by the **`Invite` table** (DB-backed) — adding new users now happens through the in-app Settings page (Send invite → Resend / Revoke). Server actions: `createInvite` / `resendInvite` / `revokeInvite`. The invite carries the role + `isCouple` flag; on first sign-in `events.signIn` applies them and marks the invite ACCEPTED.

`isAllowed()` in `src/auth.ts` is async and admits anyone with: (a) an existing User row whose `emailVerified` is set, OR (b) a PENDING invite. `AUTH_ALLOWED_EMAILS` is now only the **bootstrap-only** fallback for the very first sign-in before any DB users exist.

**First-sign-in bootstrap:** while no couple-tier user has actually authenticated yet (`count(User where isCouple=true AND emailVerified IS NOT NULL) === 0`), the next user to come through the `signIn` callback gets promoted to COUPLE automatically. After that, new sign-ins go through the invite system. No env-var or SQL surgery needed for the initial admin.

The seed creates `jamie@example.com` etc. as couple-tier rows with `emailVerified=null`, so they don't satisfy the bootstrap predicate — those rows are placeholders, not real signed-in users. Safe to delete from production once a real admin has bootstrapped.

### Design source-of-truth lives in `prototype/`
The `prototype/` directory contains JSX mockups — one per page (`GuestsPage.jsx`, `TasksPage.jsx`, etc.) — that are the visual target for the v2.0 design pass. When the user says "this page doesn't look like the design," they mean it diverges from the matching `prototype/<Page>.jsx`. The full design-pass intent is in [docs/DESIGN-PASS-BRIEF.md](docs/DESIGN-PASS-BRIEF.md). Pages are being brought up to prototype parity incrementally; v1.72.0 brought `/guests` over.

### File uploads land in /app/uploads
Multipart server action at `src/app/(app)/files/actions.ts` writes physical bytes under `UPLOADS_DIR` (defaults to `/app/uploads` in production, `./uploads` in dev). The Dockerfile creates this directory with `node:node` ownership before the named volume mount; downloads go through `src/app/api/files/[id]/route.ts` with a session + `canView("files")` gate. Body-size budget: Caddy `request_body max_size 26MB` → Next `serverActions.bodySizeLimit: "26mb"` → app-level `MAX_UPLOAD_BYTES = 25 MB`. MIME allowlist in `src/lib/uploads.ts` — extending it requires updating `MIME_EXTENSIONS` there.

### Caddy is on TWO networks
`caddy` joins both `br0` (static IP `192.168.50.25` for inbound from cloudflared) AND `internal` (so it can reach `web:3000` by service name). When editing the compose, **don't drop either network** from the caddy service or the inbound or upstream side breaks. `:8090` is the LAN-only MCP listener (v2.7.0) — don't drop it when editing the Caddyfile, and the host copy at `/mnt/user/appdata/wedding-hub/caddy/Caddyfile` must be synced (`caddy validate` the new file first) and caddy restarted when it changes.

### Postgres user is NOT 999
`postgres:16-alpine`'s built-in `postgres` user is UID **70**. **Don't add `user: "999:999"`** (or any UID other than 70) to the `db` service — it makes `initdb` fail with "Operation not permitted" on the data dir.

### Local `npm ci` ≠ CI `npm ci` — verify on Linux before tagging
v1.2.0 → v1.2.1 → v1.2.2 → v1.2.3 was a debugging cascade with one
underlying root: `npm ci` on Windows was silently more permissive than
`npm ci` on `node:20-alpine`. The actual conflict turned out to be
two **peer-OPTIONAL** nodemailer ranges that cannot both be satisfied:

- `next-auth@5.0.0-beta.25` peer-wants `nodemailer ^6.6.5`
- `@auth/core@0.41.2` (cascaded via `@auth/prisma-adapter@2.11.2`)
  peer-wants `nodemailer ^7.0.7`

Both are **optional** at runtime — neither package `require`s
nodemailer eagerly — so the conflict is purely declarative. npm 10.x
strict mode still rejects it in `npm ci`. Fix in the repo:

- [.npmrc](.npmrc) sets `legacy-peer-deps=true`. This matches the
  Windows resolver behaviour and tells the alpine-CI npm to skip
  the optional-peer conflict check. **Don't delete this file.**
- `nodemailer` stays at `^6.10.1` (next-auth's actual runtime peer).
- `next-auth` JWT type augmentation is at `next-auth/jwt` not
  `@auth/core/jwt` (since `@auth/core@0.41+` is now nested inside
  `next-auth/node_modules/`). [src/auth.config.ts](src/auth.config.ts)
  has a side-effect `import "next-auth/jwt"` first so TS can resolve
  the module before `declare module` runs.
- `vitest` pinned to `^2.1.9` (battle-tested on alpine — separate
  precaution from the above, kept for consistency).

**Standing rule:** **never tag a build until GHA goes green on the same
SHA.** Tags are public artifacts that imply shippable releases — broken
builds shouldn't carry version tags, even patches. The flow is:

1. Push to `dev`
2. Wait for GHA green
3. Fast-forward `claude/main` to the green SHA
4. *Then* tag `vX.Y.Z` and push the tag

If a tagged commit turns out to be broken in production, fix forward
with a new patch — don't delete the existing tag (immutability rule
still holds for tagged-and-shipped versions). But don't *create* tags
for SHAs that never went green to begin with.

### Postgres healthcheck `start_period` is 60s
Slow array fsync makes `initdb`'s shutdown checkpoint take ~22s. The compose's `start_period: 60s` + `retries: 10` accounts for that. Don't tighten without testing on the actual array.

### Bind mounts use absolute Unraid paths
The compose uses `/mnt/user/appdata/wedding-hub/...` (not `./`) for bind mounts because Compose Manager Plus stores stacks on `/boot/` (the Unraid USB key — slow, limited writes). Don't switch to relative paths without changing the stack location too.

### `public/.gitkeep` is load-bearing
The Dockerfile has `COPY /app/public ./public`. The project has no static assets yet, so `public/.gitkeep` exists purely to keep the directory tracked in git. Don't delete it without also dropping the COPY.

### Image distribution: GHCR private
Image is private. The Unraid host has cached credentials in `/root/.docker/config.json` from a previous `docker login ghcr.io`. If a deploy fails with "denied" / "unauthorized", the PAT may have expired — regenerate at github.com/settings/tokens with `read:packages` scope.

## File layout (key files)

```
.
├── .github/workflows/build.yml       # GHCR publish on push
├── docker/entrypoint.sh              # runs `prisma migrate deploy` then `node server.js`
├── Dockerfile                        # multi-stage, alpine, USER node (UID 1000)
├── docker-compose.yml                # production stack
├── caddy/Caddyfile                   # production reverse proxy config (Tunnel mode)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                       # transpiled to seed.js at build time
├── public/.gitkeep                   # required so the Dockerfile COPY succeeds (no static assets yet)
├── src/                              # Next.js app
│   └── lib/mcp/                      # MCP server (v2.7.0): protocol + token auth behind /api/mcp — see docs/MCP.md
├── HANDOVER.md                       # current-state snapshot for resuming work
├── ROADMAP.md                        # living plan + changelog (read this!)
├── prototype/                        # JSX mockups — design source-of-truth for v2.0
├── docs/                             # DESIGN-PASS-BRIEF, COMPONENT-INVENTORY, FORM-PATTERNS, MOBILE, MCP
├── README.md                         # user-facing docs
└── .env.production.example
```

## Environment variables

| Var | Purpose | Source |
|---|---|---|
| `DOMAIN` | Public hostname | Hardcoded `wedding.spencer-net.com` |
| `AUTH_SECRET` | Auth.js JWT signing | Random; in 1Password |
| `AUTH_URL` | Public URL (computed) | `https://${DOMAIN}` |
| `AUTH_TRUST_HOST` | Required behind proxies | Hardcoded `"true"` |
| `AUTH_ALLOWED_EMAILS` | Bootstrap-only fallback (v1.69.0+: invites in DB) | Currently just Jamie; new users now invited from Settings |
| `POSTGRES_PASSWORD` | DB password | Random; in 1Password |
| `DATABASE_URL` | Prisma connection (computed) | Built from `POSTGRES_PASSWORD` |
| `EMAIL_SERVER_*` | SMTP config | Resend (host=`smtp.resend.com`, user=`resend`, password=API key) |
| `EMAIL_FROM` | Sender | `Wedding Hub <noreply@spencer-net.com>` (apex — DKIM aligns) |
| `WEDDING_DATE` | App-level constant | `2026-09-26T14:00:00Z` |
| `ANTHROPIC_API_KEY` | AI planner API key (v2.1.0+) | 1Password; missing = AI features off |
| `AI_MONTHLY_CAP_PENCE` | Fallback monthly cap when `WeddingSettings.aiMonthlyCapPence` is null | `3000` (£30) |
| `AI_ENABLED` | Kill-switch for the AI surface | `true` |
| `MCP_ENABLED` | Kill-switch for the LAN MCP endpoint (v2.7.0) | `true` (compose defaults via `:-`) |
| `MCP_LAN_HOST` | Host-header allowlist for the `:8090` MCP listener | `192.168.50.25:8090` (compose defaults via `:-`) |

## Common tasks

### Add a new allowed user
**v1.69.0+:** sign in to production as a couple-tier user, go to **Settings → Invite a member**, enter the email, pick the role, send. The invitee gets a magic-link sign-in email and lands as the role you picked.

(Pre-v1.69.0 path was editing `AUTH_ALLOWED_EMAILS` in `.env` and recreating the stack — still works as the bootstrap fallback if no couple-tier user exists yet, but otherwise superseded.)

### Connect an MCP client
**v2.7.0+:** LAN-only MCP endpoint at `http://192.168.50.25:8090/api/mcp` (Caddy `:8090` → `web:3000`; the public `:80` block 403s it). Generate a bearer token in **Settings → MCP tokens** (couple-only; shown once), then follow [docs/MCP.md](docs/MCP.md) for the exact Claude Code / Claude Desktop (`mcp-remote` bridge) / MCP Inspector setup. Writes only ever create proposals reviewed on `/ai`.

### Push a new build
```bash
git push origin dev
# wait for GHA build (~3 min, faster with cache)
# then on Unraid: Docker → Compose → wedding-hub icon → Pull & Up
```

### Roll back to a previous build
GHA tags every commit as `:sha-<short>`. Edit the compose `image:` line to pin a specific tag, save, **Up**.

### Restore from backup
See [README.md](README.md)'s "Routine ops" section for the `psql` restore command, or look in `/mnt/user/appdata/wedding-hub/backups/{daily,weekly,monthly}/`.

## Things you should NOT do

- **Don't run `prisma migrate dev`** against production — destructive. The pipeline uses `migrate deploy` only.
- **Don't `docker compose down -v`** without exporting backups first — that wipes `pgdata`.
- **Don't commit `.env`** — it has live secrets. `.env.production.example` is the version-controlled template.
- **Don't change `caddy`'s static IP `192.168.50.25`** without updating the Cloudflare Tunnel public hostname route to match.
- **Don't add new public hostnames** to Cloudflare Tunnel without thinking about Cloudflare Access policies — the user might have one in front of `wedding.spencer-net.com`.
- **Don't re-tag** an existing version (`v0.1.0`, `v0.2.0`, etc). Tags are immutable. If a release is broken, bump the patch.
- **Don't bypass ROADMAP updates.** Every meaningful iteration ends with a ROADMAP changelog entry — that's the standing rule for this repo.

## Where to look when things break

| Symptom | First place to look |
|---|---|
| Can't reach the public URL | Cloudflare Tunnel status (Zero Trust → Networks → Tunnels — green dot) |
| 502 / 503 from Cloudflare | `docker logs wedding-hub-caddy-1` then `docker logs wedding-hub-web-1` |
| Magic-link emails not arriving | Resend dashboard → Logs. Then check `EMAIL_SERVER_PASSWORD` is the live API key |
| `prisma migrate` errors at boot | `docker logs wedding-hub-web-1` — entrypoint output is at the top |
| Sign-in says "Email not allowed" | `AUTH_ALLOWED_EMAILS` doesn't include the address. CSV, no spaces |
| DB unhealthy | `docker logs wedding-hub-db-1` — likely the slow-disk healthcheck or a permissions issue |
| `docker pull` denied | GHCR PAT expired — regenerate at github.com/settings/tokens with `read:packages` scope |

## Wedding details (for context-aware suggestions)

- **Date:** 26 September 2026, 2:00pm ceremony
- **Venue:** Alveston Manor
- **Couple:** Jamie & Bryony Spencer
- **Wedding party:** Josh, Aimee
- **Planner:** TBD (allowlist entry exists for `planner@example.com` in seed data; real address pending)

If you're suggesting features, dates, or content, this is the canon to align with.
