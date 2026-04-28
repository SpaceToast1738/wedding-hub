# Wedding Hub — Testing

The test strategy is risk-weighted, not coverage-targeted. We test:

1. **Pure functions and helpers** — Vitest, fast, deterministic.
2. **Permission boundaries** — both as unit tests (mocking the DB) and as integration tests (against a real Postgres). The audit found 6 gaps here; we don't ship without coverage.
3. **Critical workflows** — manual smoke before promote, walked from a persona's point of view. Playwright is on the roadmap but not yet wired.
4. **Build hygiene** — typecheck, lint, build, and unit tests run on every push to `dev` and `claude/main` via [.github/workflows/build.yml](.github/workflows/build.yml). The Docker image build is gated on these passing.

---

## Layers

### Unit tests — `npm test`

Vitest, runs in <1s after the first cold start. Covers:

- [tests/unit/permissions.test.ts](tests/unit/permissions.test.ts) — `canView` / `canEdit` for every (section, level, isCouple) combination, including F1 escalation reproductions.
- [tests/unit/csv-merge.test.ts](tests/unit/csv-merge.test.ts) — coercers, helpers, dedupe key.
- [tests/unit/spotify.test.ts](tests/unit/spotify.test.ts) — URL parser + config.
- [tests/unit/rate-limit.test.ts](tests/unit/rate-limit.test.ts) — magic-link rate-limit decision logic.

Add a unit test alongside any new pure function or permission rule. **The bar for shipping a fix is one test that would have caught the bug.**

### Integration tests (T2 — partially shipped, expanded later)

Designed to run against a real Postgres so we catch issues that mocks can hide (Prisma migrations, transaction semantics, real query plans). Currently a scaffolding skeleton; expand alongside the next major feature.

To run locally:
```bash
# 1. Start a throwaway Postgres
docker run -d --name wh-test-pg -p 5433:5432 \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=wedding_hub_test \
  postgres:16-alpine

# 2. Apply migrations
DATABASE_URL="postgresql://postgres:test@localhost:5433/wedding_hub_test" \
  npx prisma migrate deploy

# 3. Run integration tests
DATABASE_URL="postgresql://postgres:test@localhost:5433/wedding_hub_test" \
  npm run test:integration

# 4. Tear down
docker rm -f wh-test-pg
```

In CI, a service container provides the DB. Skipped on local Windows where Docker isn't always available.

### End-to-end tests (T3 — Playwright, deferred)

Not yet wired. Planned 4 specs:
- CSV import → preview → commit
- Supplier comm with follow-up date
- Day-of mode timeline classification
- Permissions redirect (non-couple → `/budget` → bounce to `/`)

Tracking in [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md) §3-T3.

---

## Pre-promote smoke checklist

Before fast-forwarding `dev` → `claude/main`, run through this list manually. Tag only after **GHA goes green on the same SHA** (standing rule in [CLAUDE.md](CLAUDE.md)).

### Automated gates (must pass)

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` clean
- [ ] `rm -rf node_modules && npm ci --no-audit --no-fund` succeeds (catches lockfile drift)
- [ ] `npm run build` clean
- [ ] GHA `verify` job green on the latest dev push
- [ ] GHA `build` job green on the latest dev push (image actually published to GHCR)

### Manual smoke (10–15 min, persona walkthrough)

Log in as the couple-tier user. Check each section briefly:

- [ ] **Today** — countdown shows the right number; toggle months/weeks/days and refresh; persona filter on events still works
- [ ] **At a Glance** — RSVP donut renders; budget bar shows the right paid/committed split; recent activity has entries
- [ ] **Tasks** — list and board views both render; click a status-move button on a card
- [ ] **Questions** — search field filters live; type/priority pills compose
- [ ] **Schedule** — vertical timeline with day grouping; print preview opens cleanly
- [ ] **Suppliers** — click a supplier name; detail page shows contacts/contracts/communications tabs; add a test communication then delete it
- [ ] **Budget** (couple only) — collapse a category; stacked progress bar matches the numbers
- [ ] **Payments** (couple only) — table renders; Mark paid toggles status
- [ ] **Songs** — playlist renders; Spotify panel shows configured/not-configured state correctly; reorder a song
- [ ] **Guests** — household blocks render; click a guest name → detail page; click "Archived (N)" if N > 0; verify Restore works
- [ ] **Seating** — Canvas/List toggle persists; drag a table; assign/unassign a guest
- [ ] **Files** — type filter pills work; image thumbnail visible if any uploaded; visibility toggle present
- [ ] **Wedding Book** — hub renders; Photography Shot list count matches; on-page anchor jumps work on a section page
- [ ] **Settings** — permission matrix renders; profile edit works
- [ ] **Day-of mode** — `/today/day-of` renders without crashing even when no wedding-day events exist
- [ ] **Quick capture** — press `C` from any page; modal opens; Escape dismisses; submit a Task and verify it appears on `/tasks`

### Permission walkthrough (5 min)

Sign out, sign in as a non-couple user (Permission(level=NONE) on something):

- [ ] Section the user has NONE on → URL navigation redirects to `/` (audit F1)
- [ ] `/budget` and `/payments` redirect to `/` (couple-only routes)
- [ ] Settings page doesn't show the "make couple" toggle (couple-only action)

If any item above fails, **don't promote.** Open a ticket, fix on `dev`, re-run the smoke list.

---

## After promote

- [ ] GHA workflow re-runs on the `claude/main` push and stays green
- [ ] On Unraid: `docker compose pull && docker compose up -d`
- [ ] Watch `docker compose logs -f web` until `prisma migrate deploy` line passes and Next reports ready
- [ ] Hit `/api/health` from the production URL — should return `{ ok: true, db: 'up' }`
- [ ] Sign in with one allow-listed email; check the welcome page renders
- [ ] If the release introduced a migration: spot-check `npx prisma studio` (via `docker compose exec web …`) for the new table or columns
- [ ] If the release affected backups (rare): verify `/mnt/user/appdata/wedding-hub/backups/daily/` has a fresh dump within 24h of the next scheduled run

---

## Persona walkthroughs (full pre-wedding rehearsal)

Run once before the wedding (target: ~2 weeks out, after the rehearsal data is real). Each persona walks 3 flows in their typical environment (mobile vs desktop).

### Bryony (bride, OWNER, mobile + desktop)

- [ ] Re-import the latest CSV from Say I Do; verify diff preview surfaces "merging into existing" rows; commit; verify household blocks update
- [ ] Add three shots to the Photography list; print to PDF; confirm the printout reads cleanly with checkboxes intact
- [ ] On mobile, change a Wedding Book page; verify the change persists when reloading on desktop

### Jamie (groom, OWNER, dark mode preferred, mostly desktop)

- [ ] Log a phone call with the venue under Suppliers → Communications, with a follow-up date 2 weeks out
- [ ] Pay the venue balance via Payments; verify it shows as PAID and the supplier card updates
- [ ] Review next 30 days of payments due on `/glance`; confirm the list matches Payments

### Josh (best man, MEMBER, mobile)

- [ ] Check his open tasks under "Best Man" filter on `/tasks`
- [ ] Add a Stag Do venue idea on the Wedding Party → Stag & Hen subsection
- [ ] On the day, open `/today/day-of` on his phone in transit; verify the timeline auto-scrolls (or surfaces) the NOW event

### Aimee (maid of honour, MEMBER, mobile)

- [ ] RSVP for Uldis on his behalf via the guest detail page
- [ ] Add a song request via her own guest entry → Songs page
- [ ] Read the Hen Do plan on the Wedding Party section; confirm she can see it (no per-page audience yet — see C1 in the remediation plan)

If any flow has a friction not in the [audit report](AUDIT-REPORT.md), log it in the relevant section's GitHub issues or in a working `FRICTION-LOG.md`.
