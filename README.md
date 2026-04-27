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

## Phase status

- **Phase A (current):** bootable shell — auth, AppShell, Today page with real data, stub pages for the other 12 sections, `/api/health`
- **Phase B:** port the prototype's domain pages with server actions
- **Phase C:** docker-compose stack (Caddy + web + db + backup) for the Unraid deployment

See `prototype/` for the visual reference being ported.
