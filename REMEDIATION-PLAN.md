# Wedding Hub — Post-audit Remediation Plan

> Triage and execution plan based on [AUDIT-REPORT.md](AUDIT-REPORT.md)
> findings (v1.1.0, audited 2026-04-27) plus the testing-strategy
> conversation that followed. The audit produced reports; this document
> turns them into actionable work items with sizing, dependencies, and
> phase ordering.
>
> **Wedding date:** 26 September 2026 — about 5 months out.
> **Audit budget:** session-by-session. Aim for fix → test → ship cycles
> short enough to run inside Claude Code without big-bang rewrites.

---

## 1. Snapshot

- **Audit results:** 0 BLOCKER, 9 MAJOR, ~10 MINOR, 0 cosmetic.
- **Test infrastructure:** none. No Vitest, no Playwright, no `"test"`
  script. Static checks only (typecheck/lint/build).
- **Spec drift:** material — several brief items either don't exist
  (audience overrides, MUST_NOT_TOGETHER, B2/Drive backups, magic-link
  rate-limit, archived-guest restore) or are implemented differently
  (`BudgetLine.actual` is stored not computed, dark mode is
  localStorage-only, sections are 12 not 7, levels are 3 not 4).
- **Standing rules** ([CLAUDE.md](CLAUDE.md), [ROADMAP.md](ROADMAP.md)):
  every meaningful iteration ends with a ROADMAP changelog entry; no
  `--no-verify`; tags are immutable; promote `dev → claude/main` via
  fast-forward, then tag `vX.Y.Z`.

## 2. Triage

Findings sorted into three buckets. The bucket name controls when the
work happens, not whether.

### Bucket A — fix before next promote (critical for trust)

These are bugs in the shipped artifact that affect data integrity or
the permissions story. Don't promote anything else to `claude/main`
until these are addressed.

> **Status:** A1, A2, A5, A6 shipped in v1.2.0 (Phase R1, 28 Apr 2026).
> A3 and A4 deferred to R2 because they need a schema migration and a
> meaningful UI build respectively.

| ID | Finding | Severity | Size | Status | Notes |
|---|---|---|---|---|---|
| **A1** | F1 — `/tasks`, `/questions`, `/book`, `/guests` list pages bypass `canView` | MAJOR | XS (~30 min) | ✅ shipped v1.2.0 | Mirrors the pattern at `/guests/[id]` and `/guests/catering`. |
| **A2** | F3 — Settings EDIT lets non-couple grant permissions | **BLOCKER** *(escalated)* | S (~1 hr) | ✅ shipped v1.2.0 | `setPermission`, `setUserCouple`, `removeUser` all require `user.isCouple === true` explicitly. Denied attempts logged as `settings_denied`. |
| **A3** | F4 — No magic-link rate limit | MAJOR | S–M (~2 hrs) | 🟡 R2 | Add a `MagicLinkRequest` table; reject if 5+ in last hour for email or 20+ for IP. Hourly prune. |
| **A4** | Guest hard-delete with no undo | MAJOR | S (~1.5 hrs) | 🟡 R2 | Replace `deleteGuest` with `archiveGuest`. Add "Show archived" toggle on `/guests` with `Restore` action. |
| **A5** | F6 — `setTaskStatus`/`deleteTask` polymorphic gate | MINOR | XS (~20 min) | ✅ shipped v1.2.0 | Reads `Task.type` and dispatches `requireEdit("tasks"|"questions")`. |
| **A6** | F2 — `updateFile` visibility transition gate | **BLOCKER** *(escalated)* | XS (~30 min) | ✅ shipped v1.2.0 | Static verification revealed no `isCouple` check at all — non-couple user with EDIT(files) could flip COUPLE_ONLY → EVERYONE. Both transition directions now require couple-tier. |

**Bucket A acceptance:** all five items merged to `dev`, promoted to
`claude/main` as v1.2.0, tagged. Each ships with at least one test
that would have caught it.

### Bucket B — fix before the wedding (workflow improvements)

These hurt ergonomics in real use but don't block the app. Schedule
across multiple sessions; prioritise by which workflow the couple uses
most.

| ID | Finding | Severity | Size | Notes |
|---|---|---|---|---|
| **B1** | CSV import preview: no per-field diff on merge rows | MAJOR | M (~3 hrs) | Add a per-field "old → new" view inside the merge-row expansion. Optionally let user uncheck individual field overwrites. Closes the "anxiety on re-import" friction Bryony raised. |
| **B2** | `BudgetLine.actual` doesn't recompute from `Payment` rows | MAJOR | M–L (~3–4 hrs) | Decision needed: compute on read, or persist + update via Payment hooks. Recommendation: compute on read using a Prisma include + reduce. Stored `actual` becomes "manual override if non-null". |
| **B3** | `SupplierCommunication.followUpAt` doesn't auto-create a Task | MAJOR | S (~1.5 hrs) | When `followUpAt` set, also create a Task with title `Follow up: <summary>`, due=followUpAt, with metadata pointing back to the supplier. Display a chip on the comm entry showing "Task created". |
| **B4** | Supplier card lacks last-message summary | MINOR | XS (~30 min) | Pull most recent `SupplierCommunication.summary` (truncated) into `SupplierCard`. |
| **B5** | F5 — Server-action errors throw raw `Error` | MINOR | S (~1 hr) | Replace `throw new Error("Forbidden")` with a structured "you don't have edit access" UX. Surface a friendly toast rather than a Next error overlay. |
| **B6** | Quick-capture Event lands at next round hour with no time picker | MINOR | S (~1 hr) | Add an inline date+time field to the modal when type=Event, default to next hour but visible/editable. |
| **B7** | Mobile schedule doesn't auto-scroll to NOW | MINOR | XS (~20 min) | `scrollIntoView` on the NOW event on mount (day-of page only). |
| **B8** | No search on `/guests` | MINOR | S (~1.5 hrs) | Sticky search field at top of `/guests`; filters households + guests as you type. Trivial client-side filter. |
| **B9** | Guest detail page has no inline song-request add | MINOR | S (~1 hr) | Add a small `<form>` next to the existing requests list. Reuses existing song-request action. |
| **B10** | Magic-link URL logged to stdout when SMTP unset | MINOR | XS (~10 min) | Already documented; either fail loudly when EMAIL_SERVER_HOST is empty in production (assert-on-boot), or write the link to a dev-only file. |
| **B11** | Dark mode not persisted to user account | MINOR | S (~1.5 hrs) | Add `User.darkMode: Boolean @default(false)`; load on session init; toggle persists via server action. Migration is additive. |
| **B12** | `assignGuestToSeat` has race-condition window | MINOR | S (~1 hr) | Wrap the `updateMany` + `update` in a `db.$transaction([…])` and rely on the `Guest.tableSeatId @unique` constraint to fail noisily on conflict. Add an integration test with two parallel calls. |
| **B13** | Photography print button — clarity that it's `window.print()` | MINOR | XS (~10 min) | Update tooltip / hint copy: "Use your browser's Print → Save as PDF to email a copy." |

**Bucket B acceptance:** track in [ROADMAP.md](ROADMAP.md) as v1.3.0 →
v1.5.0 across multiple sessions. Each item ships with a test where
applicable.

### Bucket C — accept the drift / decide later

These are brief expectations that don't match the shipped artifact.
For each, the user (Jamie) should explicitly decide: build, defer, or
declare out-of-scope.

| ID | Drift item | Recommendation | Rationale |
|---|---|---|---|
| **C1** | Wedding Book per-page audience overrides (`COUPLE_ONLY`/`BRIDE_SIDE`/etc.) | **Build minimal** — add `BookSubsection.visibility EVERYONE\|COUPLE_ONLY` only | Aimee's Hen Do friction is the only real use case; full audience system is over-engineered for 4 members. Mirror the `File.visibility` pattern. ~2 hrs. |
| **C2** | Seating MUST_NOT_TOGETHER constraint rules | **Defer** — leave in ROADMAP backlog | Real demand is unclear at 50 guests; user can manually arrange. Build only if the user actually wants it. |
| **C3** | `BudgetLineItem` quantity × unit cost | **Defer** — not needed | Brief was over-spec'd; current single-amount model is fine for a wedding. |
| **C4** | `dietaryEditedAt` conflict detection on import | **Build minimal** — add `Guest.lastEditedFields Json?` tracking which fields were last manually edited | If we go this route, B1 (per-field diff) gets stronger. ~2 hrs to schema + UI. |
| **C5** | B2 + Google Drive backup targets | **Defer / accept drift** — local pg_dump + manual off-site copy is fine | Brief was prescriptive; the practical risk is Unraid array failure, mitigated by a monthly manual download to laptop. Document the procedure. |
| **C6** | Illustration set with light/dark variants per scene | **Defer / accept drift** — emoji + Fraunces is the de-facto style | Adding illustrations is a significant design lift with low functional payoff. Accept the visual gap. |
| **C7** | Round-table per-seat position dots | **Build** — small visual upgrade | ~1 hr. Real value: at-a-glance read of which seats are open. |
| **C8** | Wedding Book hub: 5 cards, brief expected 7 | **Defer** — let user add via UI as needed | Don't seed Food/Drink + Guest Experience until the user asks. The Book editor lets them add subsections themselves. |
| **C9** | Magic-link prune table cron | **Build with A3** — add to the same migration | Avoid unbounded growth; trivial cron job. |
| **C10** | Custom Fields UI | **Defer / out-of-scope** — schema exists, no UI | Already in ROADMAP backlog as deferred. Real demand unclear. |
| **C11** | Schedule motif icons (ring/candle/plate per event) | **Defer** — current text+colour is fine | Visual polish only. |
| **C12** | A3-landscape Seating print + "DRAFT — unconfirmed" watermark | **Defer** — current Seating canvas is screen-only | The seating canvas isn't print-friendly anyway (drag affordances, hover panels). Print would need a separate render path. Low value before the wedding; the catering brief already has the per-table breakdown for the venue. |

## 3. Test infrastructure plan

Parallel track. Doesn't block fix shipping but should be set up early
so each fix can ship with a regression test.

### T1 — Vitest + pure-function unit tests (~2 hrs)

- Add `vitest` + `@vitest/ui` as devDeps. Add `"test": "vitest"` to package.json.
- Create `tests/unit/` with:
  - `csv-merge.test.ts` — `dedupeKey`, `coerceBool`, `coerceRsvp`, `parseNames`, `parsePlaylistId`. Pure inputs → expected outputs.
  - `permissions.test.ts` — for a fake `(user, section)` pair, assert `canView` / `canEdit` returns the right bool. Doesn't need a DB; mock the `loadPermissions` cache.
  - `format.test.ts` — `formatRelativeDue`, `formatGBP`, etc.
- **Acceptance:** `npm test` runs in <2s, exits 0.

### T2 — Permission integration test (~2 hrs)

- Add `vitest.config.ts` with a setup file that boots a Postgres test DB via `docker run` (or Testcontainers).
- `tests/integration/permissions.test.ts`:
  - For each section × level × isCouple combo, seed a User + Permission row.
  - Call every server action with that session.
  - Assert pass/deny matches expected matrix.
- **Acceptance:** would catch A1, A2 specifically. CI green.
- **Bonus:** also tests the F6 polymorphic-gate fix — assert that `EDIT(tasks)` + `NONE(questions)` cannot delete a Question via crafted action call.

### T3 — Playwright e2e for critical workflows (~4 hrs first, ~30 min per spec after)

- `npx create-playwright@latest`. Run against `npm run dev` with a separate test DB.
- Initial specs:
  - `csv-import.spec.ts` — paste sample CSV, preview, commit, verify Guest count.
  - `supplier-comm.spec.ts` — log a comm with follow-up, verify Task auto-created (after B3 lands).
  - `day-of-mode.spec.ts` — load /today/day-of, verify timeline classifies events correctly given a mocked clock.
  - `permissions-redirect.spec.ts` — sign in as non-couple, navigate to /budget, assert redirect to /.
- **Acceptance:** specs pass on `npm run dev`; wired to GitHub Actions.

### T4 — TESTING.md smoke checklist (~30 min)

- Document a 30-step manual smoke test for each release.
- Group by persona walkthrough (Bryony / Jamie / Josh / Aimee).
- Include the deploy checklist (pre-promote: typecheck + lint + build + vitest + playwright + manual smoke).

### T5 — Backup verification cron (~1 hr)

- Add a weekly cron in the backup container that checks `latest/` is non-empty and recent (<24h).
- On failure, write a sentinel file that the next health check picks up, or send via Resend if EMAIL_SERVER is configured.
- Manual fallback: monthly download to laptop.

## 4. Suggested phasing

Each phase is one or two sessions. Track in [ROADMAP.md](ROADMAP.md) as
the work progresses; bump versions per the existing rules.

### Phase R1 — Trust restoration (next session, ~3–4 hrs total)

→ Ship as **v1.2.0**.

1. **T1** (Vitest scaffold + first few unit tests) — ~2 hrs
2. **A1** (page-level `canView` gates) + matching unit tests — ~30 min
3. **A2** (settings `isCouple` gate) + test — ~1 hr
4. **A5** (polymorphic `setTaskStatus`/`deleteTask` gate) + test — ~20 min
5. ROADMAP changelog entry, promote, tag.

**Outcome:** the audit's read-data-leak class is closed. Test suite
exists. Future audits start from a higher floor.

### Phase R2 — Magic-link rate limit + archived guests (~4 hrs)

→ Ship as **v1.3.0**.

1. **A3** (rate-limit table + middleware + prune cron + C9) — ~2.5 hrs
2. **A4** (archive flow + Show archived + Restore) — ~1.5 hrs
3. Tests for both.

**Outcome:** the two scariest-on-the-day failure modes are fixed.

### Phase R3 — Test depth (~5 hrs)

→ Internal release / no version bump (test infrastructure only).

1. **T2** (permission integration tests) — ~2 hrs
2. **T3** (Playwright scaffold + 4 specs) — ~3 hrs
3. **T4** (TESTING.md) — ~30 min
4. CI wiring.

**Outcome:** every future fix can ship with a regression test in
~30 min. Pre-promote checklist becomes runnable with one command.

### Phase R4 — Workflow polish (multiple sessions)

→ Ship as **v1.4.0** (B1 + B2) and **v1.5.0** (rest of B).

1. **B1** (CSV per-field diff) — ~3 hrs
2. **B2** (Budget actual recompute decision) — ~3–4 hrs
3. **B3** (Supplier follow-up auto-task) — ~1.5 hrs
4. The smaller B items in batches per session.

**Outcome:** the "Bryony anxiety on re-import" and "Jamie ghost-task on
follow-up" frictions are closed. Workflows feel coherent.

### Phase R5 — Spec drift decisions (~3 hrs of decisions + per-item builds)

→ Ship as **v1.6.0** for any items that are built.

1. Walk through Bucket C with the user; mark each as build/defer/out-of-scope.
2. Build the items marked "Build" (C1 audience visibility, C7 seat dots, possibly C4).

**Outcome:** the spec-drift gap is either closed or explicitly accepted
in writing. ROADMAP backlog reflects the final v1 scope.

### Phase R6 — Backup hardening (~2 hrs)

→ No version bump (operational only).

1. **T5** (backup verification cron + alert)
2. Document the manual off-site procedure in [README.md](README.md).
3. Run a real restore against a throwaway DB to verify backups are good.

**Outcome:** if the Unraid array fails on the wedding eve, restore is
possible.

## 5. What this plan deliberately does NOT do

- **No new features.** Every item here is either fixing a finding or
  adding the test infrastructure to keep finding-fixes durable. New
  scope is out until at least Phase R3 lands.
- **No big-bang test rewrite.** Tier-1 unit tests come first because
  they catch the highest-impact bugs per hour. Playwright comes second.
  Component snapshot testing and visual regression are explicitly out
  of scope.
- **No Cloudflare Tunnel or Caddy reconfiguration.** The audit didn't
  flag those as risks; leave them alone.
- **No schema renames.** Spec drift uses different names (`vendors` vs
  `suppliers`, `MEMBERS` vs `wedding_party`); accept the existing names
  rather than churning the schema for cosmetic alignment.

## 6. Open questions for the user

Before Phase R1 starts:

1. **Bucket C decisions** — walk through the 11 spec-drift items and
   mark each. Most can default to "Defer" without harm.
2. **B2 (BudgetLine.actual recompute) approach** — recompute on read
   (simpler, slightly slower) vs. update via Payment hook (more code,
   stays consistent without a join). Recommendation: recompute on
   read.
3. **Test database for T2/T3** — Testcontainers (auto-managed) vs. a
   separate Compose service the developer runs manually? Default to
   Testcontainers if Docker is available locally, else manual.
4. **Anything in Bucket A or B that should jump phases?** e.g. if
   re-import is happening this week, B1 (per-field diff) might be
   urgent enough to pull into R1.

## 7. Doneness criteria

The plan is done when:

- All Bucket A items shipped and tagged.
- All Bucket B items either shipped or moved to v2 backlog with reason.
- All Bucket C items have a build/defer/out-of-scope decision recorded
  in [ROADMAP.md](ROADMAP.md).
- Test suite runs in CI on every push to `dev`.
- Pre-promote checklist exists and is followed for at least one
  release.
- A second audit (or self-audit using the same brief) reports zero
  unresolved BLOCKER or MAJOR findings.

## 8. Time budget

- **Phase R1:** 1 session (~3–4 hrs)
- **Phase R2:** 1 session (~4 hrs)
- **Phase R3:** 1 session (~5 hrs)
- **Phase R4:** 2–3 sessions (~6–8 hrs total)
- **Phase R5:** 1 decision session + 1–2 build sessions (~3–5 hrs)
- **Phase R6:** 1 session (~2 hrs)

**Total:** ~25 hrs of focused work across ~8 sessions, spaced over the
next few weeks. Plenty of headroom before the wedding.

## 9. Coverage cross-check vs the audit

Confirms every audit finding is mapped to either a remediation item or
an explicit accept-the-drift decision. Items added in the v1.2 plan
edit are tagged `(added in cross-check)`.

### From [AUDIT-REPORT.md](AUDIT-REPORT.md) §6.1 — Permissions

| Finding | Plan item |
|---|---|
| F1 — list pages bypass `canView` | A1 |
| F2 — `updateFile` visibility transition gate asymmetric | **A6** *(added in cross-check)* |
| F3 — settings EDIT lets non-couple grant permissions | A2 |
| F4 — no magic-link rate limit | A3 |
| F5 — server-action errors throw raw `Error` | B5 |
| F6 — polymorphic `setTaskStatus` / `deleteTask` gate | A5 |
| Permissioned-out UI silent redirect | B5 (same fix surfaces friendly UX) |

### From [AUDIT-REPORT.md](AUDIT-REPORT.md) §6.2 — Functional defects

| Finding | Plan item |
|---|---|
| Import preview lacks per-field diff | B1 |
| `BudgetLine.actual` not recomputed from `Payment` | B2 |
| `SupplierCommunication.followUpAt` doesn't auto-create Task | B3 |
| Supplier card no last-message summary | B4 |
| Archived-guest workflow not implemented | A4 |
| Wedding Book audience overrides | C1 (build minimal) |
| Seating MUST_NOT_TOGETHER | C2 (defer) |
| CSV import dup-email merge edge | covered by B1 (per-field diff exposes this) |
| Magic-link URL logged to stdout | B10 |
| Quick-capture event time | B6 |
| `/glance` no `canView` gate | not a finding (intentional role-aware redact) |
| `assignGuestToSeat` race condition | **B12** *(added in cross-check)* |

### From [AUDIT-REPORT.md](AUDIT-REPORT.md) §6.3 — Design fidelity

| Finding | Plan item |
|---|---|
| Dark mode not per-account | B11 |
| Motif icons absent | C11 (defer) |
| Per-seat position dots on round tables | C7 (build) |
| Wedding Book hub has 5 not 7 cards | C8 (defer) |
| No illustration set with light/dark variants | C6 (defer) |
| `User.darkMode` field missing | B11 |
| A3-landscape Seating + DRAFT watermark | **C12** *(added in cross-check)* |

### From [AUDIT-REPORT.md](AUDIT-REPORT.md) §6.4 — Persona friction

| Friction | Plan item |
|---|---|
| Bryony — re-import preview lacks per-field diff | B1 |
| Bryony — no undo on guest delete | A4 |
| Bryony — photography print "save as PDF" copy ambiguity | **B13** *(added in cross-check)* |
| Jamie — supplier follow-up doesn't auto-create Task | B3 |
| Jamie — quick-capture event time | B6 |
| Jamie — dark mode not portable across devices | B11 |
| Josh — `/tasks` visible at NONE | A1 |
| Josh — Stag Do edit is a free-text blob | not addressed (intentional Wedding Book free-form design — accept) |
| Josh — mobile schedule no scroll-to-now | B7 |
| Aimee — no search on `/guests` | B8 |
| Aimee — no inline song-request add on Guest detail | B9 |
| Aimee — Hen plan visible to Josh (no audience override) | C1 |

### From [AUDIT-PLAN.md](AUDIT-PLAN.md) §0 — Spec drift table

| Drift | Plan item |
|---|---|
| `PLAN.md` / `DESIGN-BRIEF.md` / `CHANGELOG.md` / `TESTING.md` / slice CLAUDE.mds missing | T4 (TESTING.md) creates one of these; the rest were planning docs that don't need recreating now that v1 has shipped — accept |
| `ADMIN` permission level missing | accepted — `isCouple` Boolean is the super-tier and works in practice |
| Sections (12 vs brief's 7) and `vendors` vs `suppliers` naming | accepted — naming drift only, no churn justified |
| Wedding Book audiences (5 vs binary) | C1 (build minimal binary) |
| OWNER vs MEMBER tier | accepted — `isCouple` + `role` is equivalent |
| Sync RSVPs / `dietaryEditedAt` conflict detection | C4 (build minimal field-edit tracking) + B1 (per-field diff) together address the underlying need |
| `BudgetLine.actual` recompute | B2 |
| Quantity field on `BudgetLine` | C3 (defer — over-spec) |
| `MUST_NOT_TOGETHER` rules | C2 (defer) |
| Archived-guest restore UI | A4 |
| `User.darkMode` field | B11 |
| B2 + Drive backups | C5 (accept drift) + R6 (verification cron + manual off-site procedure) |
| Magic-link rate limit + prune | A3 + C9 |
| Custom Fields UI | C10 (defer) |
| A4-portrait + A3-landscape print views, DRAFT watermark | A4-portrait already shipped (Schedule, Shot list, Catering); A3-landscape Seating → C12 (defer); DRAFT watermark not built (covered by C12 defer) |

### Audit infrastructure findings

| Finding | Plan item |
|---|---|
| No Playwright suite / no `"test"` script | T1 + T2 + T3 (Vitest unit, Vitest integration, Playwright e2e) |
| No formal regression strategy | T4 (TESTING.md) + R3 phase wires CI |

### Final coverage tally

- **Audit findings (numbered F1–F6):** 6/6 mapped ✅
- **Audit defect entries:** 12/12 mapped (1 intentional non-finding for `/glance`) ✅
- **Design deltas:** 7/7 mapped (5 defer, 1 build, 1 already shipped under different name) ✅
- **Persona frictions:** 12/12 mapped (1 accepted as intentional design) ✅
- **Spec-drift items:** 17/17 mapped ✅
- **Test infrastructure:** covered by T1–T5 + R3 phase ✅

Every audit-surface finding has a plan item or an explicit
accept-the-drift decision. Items added during the cross-check (A6,
B12, B13, C12) are tagged so a future auditor can trace them back to
this revision.
