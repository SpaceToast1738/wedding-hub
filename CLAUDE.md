# Wedding Hub — context for Claude Code

A small private Next.js app for Jamie & Bryony's wedding (26 September 2026, Alveston Manor). Five users total: the couple, two wedding-party members, one planner. Hosted on Jamie's Unraid box.

This file gives you (Claude Code) the context you need to work productively on this repo. **Read it before making changes.** [ROADMAP.md](ROADMAP.md) is the living plan + changelog — read that for current state and to understand what's shipped vs deferred.

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

### Auth allowlist
`AUTH_ALLOWED_EMAILS` (CSV) gates sign-in. Set in `.env` on the deploy host. Bouncing happens at the Auth.js callback layer with a friendly redirect to `/signin/error`.

### Caddy is on TWO networks
`caddy` joins both `br0` (static IP `192.168.50.25` for inbound from cloudflared) AND `internal` (so it can reach `web:3000` by service name). When editing the compose, **don't drop either network** from the caddy service or the inbound or upstream side breaks.

### Postgres user is NOT 999
`postgres:16-alpine`'s built-in `postgres` user is UID **70**. **Don't add `user: "999:999"`** (or any UID other than 70) to the `db` service — it makes `initdb` fail with "Operation not permitted" on the data dir.

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
├── ROADMAP.md                        # living plan + changelog (read this!)
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
| `AUTH_ALLOWED_EMAILS` | CSV allowlist | Currently just Jamie; Bryony / Josh / Aimee / planner pending |
| `POSTGRES_PASSWORD` | DB password | Random; in 1Password |
| `DATABASE_URL` | Prisma connection (computed) | Built from `POSTGRES_PASSWORD` |
| `EMAIL_SERVER_*` | SMTP config | Resend (host=`smtp.resend.com`, user=`resend`, password=API key) |
| `EMAIL_FROM` | Sender | `Wedding Hub <noreply@spencer-net.com>` (apex — DKIM aligns) |
| `WEDDING_DATE` | App-level constant | `2026-09-26T14:00:00Z` |

## Common tasks

### Add a new allowed user
Edit `.env` (via Compose Manager Plus → Edit Stack → .ENV tab), append email to `AUTH_ALLOWED_EMAILS=...`, save, click `Pull & Up` (or just **Up**) to recreate `web` with the new env.

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
