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

The whole stack runs on a single Docker host (the Unraid server) via `docker compose`. Four services on two networks:

```
                ┌── 80/443 (host) ──┐
                ▼                    │
      ┌────────────────────┐         │   edge network
      │       caddy        │ ────────┘   (TLS, headers, rate-limit)
      └─────────┬──────────┘
                │ internal network (no host ports)
        ┌───────┴────────┬──────────────┐
        ▼                ▼              ▼
   ┌─────────┐     ┌─────────┐   ┌──────────────┐
   │   web   │     │   db    │   │   backup     │
   │ Next.js │ ──► │  pg-16  │ ◄─┤ pg_dump +    │
   │  :3000  │     │  :5432  │   │ retention    │
   └─────────┘     └─────────┘   └──────────────┘
```

### First-time deploy

```bash
# On the host (Unraid /mnt/user/appdata/wedding-hub or wherever you keep stacks):
git clone https://github.com/SpaceToast1738/wedding-hub.git
cd wedding-hub

# Fill in production env
cp .env.production.example .env
# Edit .env — DOMAIN, TLS_EMAIL, POSTGRES_PASSWORD, AUTH_SECRET,
# AUTH_ALLOWED_EMAILS, EMAIL_SERVER_* (or leave blank for log-only delivery).
# Generate secrets:
#   openssl rand -base64 32   →  AUTH_SECRET
#   openssl rand -base64 24   →  POSTGRES_PASSWORD

# Build + boot. The web container's entrypoint runs `prisma migrate deploy`
# automatically before starting Next.js.
docker compose up -d --build

# First-time only: seed the 5 known users.
docker compose exec web node ./node_modules/prisma/build/index.js db seed
# (or seed manually by upserting User rows from psql)
```

After `docker compose up -d`, Caddy fetches a Let's Encrypt cert for `${DOMAIN}` and starts proxying to `web:3000`. Visit `https://${DOMAIN}` and sign in with one of the allow-listed emails.

### Routine ops

| Task | Command |
|---|---|
| Tail web logs | `docker compose logs -f web` |
| Tail Caddy logs | `docker compose logs -f caddy` |
| Update to latest commit | `git pull && docker compose up -d --build web` |
| Run a one-off migration | `docker compose exec web node ./node_modules/prisma/build/index.js migrate deploy` |
| Open Prisma Studio | `docker compose exec web node ./node_modules/prisma/build/index.js studio` (then port-forward 5555) |
| Manual backup now | `docker compose exec backup /backup.sh` |
| Inspect DB | `docker compose exec db psql -U wedding wedding_hub` |
| Restore a backup | `gunzip -c ./backups/daily/wedding_hub-YYYY-MM-DD.sql.gz \| docker compose exec -T db psql -U wedding wedding_hub` |

Backups land in `./backups/{daily,weekly,monthly}/` with **7d / 4w / 12m** retention. Snapshot the `./backups` directory off-box (rclone, restic, etc.) — the schedule is intentionally on-host so a full server failure is your problem to plan for.

### Hardening notes

- **No host ports for db or web** — only Caddy publishes 80/443. Postgres is reachable only via the `internal` Docker network.
- **web container** runs as UID 1000, read-only filesystem (with tmpfs for `/tmp` and `/app/.next/cache`), `cap_drop ALL`, `no-new-privileges`.
- **Caddy** strips its `Server` banner, sets HSTS / CSP / X-Frame-Options / Permissions-Policy, blocks dotfile probes, and caps request bodies at 4 MB.
- **`/robots.txt`** disallows all crawlers and the page is non-discoverable.
- **Rate-limiting** for `/api/auth/*`: a stub block in the Caddyfile is commented out because the rate-limit module isn't in the stock `caddy:2-alpine` image. If you want it, swap to a custom Caddy build (`xcaddy build --with github.com/mholt/caddy-ratelimit`) and uncomment the block. In the meantime Auth.js's per-token expiry + the email allow-list bound the blast radius.

### Cloudflare Tunnel alternative (no open ports on the host)

If you'd rather not expose 80/443 to the internet at all, run a `cloudflared` tunnel pointing at `caddy:80` (or skip Caddy entirely and point the tunnel at `web:3000`) and let Cloudflare terminate TLS. Add a fifth service to `docker-compose.yml`:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - edge
    depends_on:
      caddy:
        condition: service_started
```

Then remove the `ports:` block from the `caddy` service and set `internal: true` on the `edge` network in compose. Configure the tunnel in the Cloudflare dashboard to send `wedding.spencer-net.com` → `http://caddy:80`. Caddy still handles security headers in this mode, but you can disable its TLS issuance with `auto_https off` in the global Caddyfile block.

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
