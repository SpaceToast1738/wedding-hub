# Wedding Hub

Private wedding-planning app for Jamie & Bryony — replaces a Notion + Say I Do setup. Used through to the wedding day on **26 September 2026**.

- **Live:** wedding.spencer-net.com (private — magic-link sign-in, allow-list of 5)
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma · Postgres 16 · Auth.js v5

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
npx prisma migrate dev --name init
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
  schema.prisma     ← single source of truth for the data model
  seed.ts           ← seeds 5 users + permissions + sample data

src/
  app/
    (app)/          ← authenticated routes wrapped by AppShell
      page.tsx          → Today
      tasks/, guests/…  → 12 sections (most are stubs in Phase A)
    signin/         ← magic-link sign-in flow
    api/
      auth/[...nextauth]/route.ts
      health/route.ts
  auth.ts           ← Auth.js v5 config (server-only)
  auth.config.ts    ← shared edge-safe config (used by middleware)
  middleware.ts     ← redirects unauthenticated users + gates couple-only routes
  components/
    ui/             ← Button, StatusPill, Avatar, Tag, Input, PageHeader, Toast
    shell/          ← AppShell, Sidebar, MobileTabBar, AvatarMenu
  lib/
    db.ts           ← Prisma client singleton
    permissions.ts  ← canView / canEdit per section
    audit.ts        ← logAudit helper

prototype/          ← original visual reference (vanilla React + inline styles)
```

## Permission model

| Role          | Sections (EDIT)                                                                        | Couple-only sections (Budget, Payments) |
|---------------|----------------------------------------------------------------------------------------|-----------------------------------------|
| Couple        | All                                                                                    | EDIT                                    |
| Wedding party | tasks, questions, schedule, suppliers, guests, seating, songs, files, book             | NONE                                    |
| Planner       | same as wedding party                                                                  | NONE                                    |

Sign-in is restricted to emails in `AUTH_ALLOWED_EMAILS` (csv). Anyone else hits `/signin/error`.

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

The `web` image is built by GitHub Actions on every push to `main` / `dev` and pushed to GHCR — `ghcr.io/spacetoast1738/wedding-hub:dev` (and `:latest` on the default branch). Compose pulls the image; the Unraid box never builds.

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
| Roll back to a specific image | edit `image:` in compose to `ghcr.io/.../wedding-hub:sha-abc1234`, then `docker compose up -d web` |
| Run a one-off migration | `docker compose exec web node ./node_modules/prisma/build/index.js migrate deploy` |
| Open Prisma Studio | `docker compose exec web node ./node_modules/prisma/build/index.js studio` (then port-forward 5555) |
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

## Phase status

- **Phase A (done):** bootable shell — auth, AppShell, Today page with real data, stubs for the other 12 sections, `/api/health`
- **Phase B (done):** all 12 prototype pages ported with server actions, audit logging, and per-section permission gates
- **Phase C (current):** Docker stack — Caddy + web + db + backup — with hardening, retention policy, and Cloudflare Tunnel alternative

### Deferred for future work

The following prototype features were intentionally not ported yet because each one is a substantive sub-project:
- Real file uploads (the `uploads:` Docker volume is wired up; the multipart server action and UI are not)
- Drag-and-drop seating canvas with constraint rules
- CSV / Say I Do guest import wizards + diff sync UI
- Photography shot list + dietary aggregate inside the Wedding Book
- Spotify playlist sync
- Catering export PDF
- Day-of mode for the Today page (live timeline + on-call contacts)
- Quick-capture (`C` shortcut) modal

See `prototype/` for the visual reference each was built against.
