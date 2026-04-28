# Wedding Hub — v1 Acceptance Audit Plan

> Stage A deliverable per [AUDIT-BRIEF.md](AUDIT-BRIEF.md) §4. The brief asks
> for plan-then-stop, but the user explicitly authorised execution of Stage B
> in a single pass; both `AUDIT-PLAN.md` (this file) and
> [AUDIT-REPORT.md](AUDIT-REPORT.md) are produced together. This file
> documents what was planned and what was actually run.

## 0. Headline blocker for the audit itself

**The brief was written against a v1 spec that materially differs from
what was actually shipped.** Several source-of-truth docs the brief
treats as canon (§2) don't exist in the repository, and several brief
concepts have no counterpart in the schema or code:

| Brief expects | Actually shipped | Severity |
|---|---|---|
| `PLAN.md` (engineering plan) | Doesn't exist — [ROADMAP.md](ROADMAP.md) is the closest equivalent | n/a (audit input gap) |
| `DESIGN-BRIEF.md` (UX direction, palette, archetypes, §15 deliverables) | Doesn't exist — [prototype/](prototype) is the de-facto design brief | n/a (audit input gap) |
| `CHANGELOG.md` (what shipped in v1) | Doesn't exist — folded into [ROADMAP.md §Changelog](ROADMAP.md) | n/a |
| `TESTING.md` / Playwright suite | Doesn't exist; no `*.spec.ts`, no `playwright.config.*`, no test runner in `package.json` | **BLOCKER** for §6.2 regression-rerun |
| Slice-level `CLAUDE.md` files | Single root `CLAUDE.md` only | n/a |
| Permission level `ADMIN` | Schema enum is `NONE \| VIEW \| EDIT` only (no ADMIN) | **MAJOR** spec drift |
| Sections: `GUESTS, BUDGET, VENDORS, TASKS, SCHEDULE, SEATING, NOTES` (7) | Sections: `tasks, questions, schedule, suppliers, guests, seating, songs, files, book, budget, payments, settings` (12); no `NOTES`, no `VENDORS` (it's `suppliers`) | **MAJOR** spec drift |
| Wedding Book audiences: `EVERYONE, COUPLE_ONLY, BRIDE_SIDE, GROOM_SIDE, CUSTOM` per page | No audience field on `BookSubsection`. Only `File.visibility` exists, with two values `EVERYONE \| COUPLE_ONLY` | **MAJOR** spec drift |
| OWNER vs MEMBER tier | `User.isCouple: Boolean` plus `User.role: UserRole` (`COUPLE \| WEDDING_PARTY \| PLANNER \| VIEWER`) | naming drift only |
| Sync RSVPs with diff preview + conflict detection on `dietaryEditedAt` | CSV import with merge semantics on `(household, firstName, lastName)`. No `dietaryEditedAt` field, no conflict detection per the brief's spec | **MAJOR** spec drift |
| `BudgetLineItem.actual` recomputed from `Payment` rows | `BudgetLine.actual` is a stored field; `Payment` is a separate table with optional `budgetLineId` FK; no recomputation | **MAJOR** spec drift |
| `MUST_NOT_TOGETHER` seating rules with red dots | No constraint-rules system; seating canvas is drag-only | **MAJOR** spec drift |
| Show archived guests + Restore action | `Guest.archived: Boolean` exists; no UI for show/restore | **MAJOR** spec drift |
| `User.darkMode` field | Dark mode is `localStorage`-only via `DarkModeScript`; no DB field | naming drift |
| B2 + Drive backup targets | Single local pg_dump via `prodrigestivill/postgres-backup-local` | **MAJOR** spec drift |
| Rate-limit on magic links (5/hour/email, 20/hour/IP) + hourly prune table | No rate-limit; not in schema, not in middleware | **MAJOR** spec drift |
| Custom Fields UI | `CustomField` model exists; no UI | known gap (in ROADMAP backlog) |
| A4-portrait Schedule + Shot List, A3-landscape Seating, "DRAFT" watermark | Print stylesheet exists for Schedule, Photography Shot List, Catering brief; no A3 Seating, no DRAFT watermark | **MAJOR** spec drift |

**Implication for the audit:** I cannot produce a faithful report against
the brief as written. I produced the report against the **actual
shipped artifact** (v1.1.0, commit `5b13728`), using [prototype/](prototype)
as the de-facto design brief and [ROADMAP.md](ROADMAP.md) as the
de-facto changelog. Brief-vs-shipped deltas appear as findings in §6.3.
The brief's §6.1/§6.2/§6.4 shapes are followed; brief-specific items
that don't exist (e.g. `MUST_NOT_TOGETHER` rule testing) are flagged
"not applicable — feature absent" rather than fabricated.

## 1. Execution mode

**No live runtime / browser / DB available** during this audit session.
Tests below are run via:

- **Static code review** (read schema, server actions, page components,
  middleware, auth callbacks)
- **Build / typecheck / lint** invoked via `npm run build`,
  `npm run typecheck`, `npm run lint` — already verified clean at
  v1.1.0
- **Schema review** of `prisma/schema.prisma` against brief expectations
- **Documentation comparison** against `prototype/*` (the de-facto
  design brief)

What is **not** tested:

- Live UI clicking / persona walkthroughs (no browser)
- Live database operations (no Postgres running)
- Screenshots in light/dark mode (no UI rendering)
- End-to-end magic-link flow (no SMTP)
- Cloudflare Tunnel callback round-trip (production-only path)
- Backup contents on the actual Unraid box

These limitations are called out per-section in the report.

## 2. Permissions test plan (per §6.1)

Build the **actual** permission matrix against the **actual** schema:

- **Sections** (12): `tasks, questions, schedule, suppliers, guests,
  seating, songs, files, book, budget, payments, settings`
- **Levels** (3 — not 4): `NONE, VIEW, EDIT`
- **Tiers**: `isCouple = true` (super-user) vs `isCouple = false` (gated by
  `Permission` rows)
- **Couple-only sections**: `budget, payments` — gated at three layers
  (middleware redirect, page-level `redirect("/")`, `canView`/`canEdit`
  returning false)

For each section × level × actor, derive the expected outcome from
[src/lib/permissions.ts](src/lib/permissions.ts) and verify by tracing
each server action in `src/app/(app)/<section>/actions.ts` for the
`requireEdit("<section>")` call.

For File visibility, additionally verify `/api/files/[id]` returns 404
(not 403) for couple-only files when the caller is not couple-tier —
prevents existence-probing.

For middleware, verify:
- Unauthenticated request → redirect to `/signin?callbackUrl=…`
- Authenticated non-couple to `/budget` or `/payments` → redirect to
  `/` (and the page itself also redirects, so two-layer defence)

Wedding Book audience overrides: **not applicable — feature absent**.
Only the section-level `book` permission gates access; there are no
per-page audience overrides.

## 3. Functional test plan (per §6.2)

**Existing test suite: NONE.** No Playwright config, no spec files, no
test runner. Cannot "re-run X tests, Y passed, Z failed" because
there's nothing to run. This is itself a finding (BLOCKER for any
formal pre-wedding regression strategy, MAJOR if the user accepts
manual smoke-testing as the v1 strategy).

The seven critical workflows from §6.2 mapped to actual code paths:

| # | Brief workflow | Actual closest equivalent | Testable from static review? |
|---|---|---|---|
| 1 | Sync RSVPs with diff preview | CSV import at `/guests/import` (preview→commit) | Yes (read merge logic + preview shape) |
| 2 | Edit budget — change planned/actual unit cost, quantity, totals | `/budget` line CRUD; no quantity field on `BudgetLine` | Yes (read line schema + actions) |
| 3 | Drag guests onto seats; capacity + MUST_NOT_TOGETHER red dots | Seating canvas drag (no constraint rules) | Partial (drag logic readable; rules absent) |
| 4 | Log a supplier comm with follow-up; auto-Task; last-message summary | `/suppliers/[id]` Communications log (just shipped in v1.0.0) | Yes (read action + UI) |
| 5 | Mark a Question task as answered; status shows "Answered" | `/questions` Answer form on `Task` rows where `type=QUESTION` | Yes (read AnswerForm component) |
| 6 | Restore an archived guest after sync drops a row | No restore UI; `Guest.archived` exists but no toggle / list | Workflow not implemented |
| 7 | Change page audience to COUPLE_ONLY | No per-page audience; only the section-level `book` perm | Workflow not implemented |

For each available workflow, I traced the relevant server-action /
page code for: input validation, permission gate, mutation
correctness, revalidation paths, and audit logging.

## 4. Design fidelity scope (per §6.3)

Compare each prototype page in [prototype/](prototype) against its live
counterpart in [src/app/(app)/](src/app/(app)). The prototype is the
de-facto design brief in the absence of `DESIGN-BRIEF.md`.

Deliverables surveyed:
- Foundation tokens (`prototype/tokens.css` ↔ `src/app/globals.css`)
- AppShell sidebar + mobile tab bar
- Today dashboard (countdown, tasks, events, day-of mode)
- All 12 domain pages
- Print views: Schedule, Photography Shot List, Catering brief

Not surveyed (no live render available):
- Visual diff against any specific palette spec (no `DESIGN-BRIEF.md`
  §4)
- Screenshots in either mode
- Illustration set (none was specified or shipped — illustrations only
  exist as inline SVG in a few places)

## 5. Persona walkthroughs (per §6.4)

Walking through code paths as if the persona were operating them. Real
in-browser walkthroughs are not possible in this session.

For each of Bryony, Jamie, Josh, Aimee, I traced:
- Their entry-point page
- The flows the brief lists for them (RSVP sync, payment logging,
  Stag Do edit, song request, etc.)
- Where the code-visible friction lives (multi-step flows, missing
  affordances, error-message quality)

Friction grounded in code-readable signals (e.g. "no `getServerSideProps`
prefetch on this list, so the user sees a delay before the table
renders") is included; pure speculation is omitted.

## 6. Out of scope (explicit)

Per AUDIT-BRIEF §9, skipped:
- Performance / load testing
- WCAG deep-dive beyond the static check
- Cross-browser matrix
- i18n
- Email visual fidelity
- Marketing/landing pages

Additionally skipped due to no live runtime:
- Live UI navigation
- Live DB queries
- Cloudflare Tunnel callback round-trip
- Backup target verification
- Magic-link end-to-end
- Print preview rendering

Each is acknowledged as a coverage gap in the final summary.

## 7. Time

Audit completed in a single session against static artifacts. No
estimate revision was needed — the discovery that the brief
references absent docs and absent features bounded the audit
naturally to "what the code can tell us."
