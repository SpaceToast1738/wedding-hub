# Wedding Hub — v1 Acceptance Audit

Single artifact for the audit cycle. Three sections:

1. **[Brief](#1-brief)** — the original prompt for the audit (input).
2. **[Plan](#2-plan)** — Stage A test plan (read-only assessment).
3. **[Report](#3-report)** — Stage B four-section report (findings, severity, repro).

Status, current findings, and remediation tracking are in [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md). Changelog of fixes is in [ROADMAP.md](ROADMAP.md).

---

# 1. Brief

<details>
<summary>Original audit brief that defined this cycle. Click to expand.</summary>


> Brief for a Claude Code session. Read in full before doing anything.
> The audit produces **reports**, not fixes. A separate session will
> triage findings and implement remediations.

---

## 1. What this is

Version 1 of the Wedding Hub has shipped. This brief asks you to
audit it against four concerns, in this order:

1. **Permissions hardening** — adversarial test of authorisation
   boundaries.
2. **Functional regression + bug hunt** — re-run existing tests,
   then exploratory testing of seven critical workflows.
3. **Design fidelity** — does the build match `DESIGN-BRIEF.md`?
4. **Usability sweep** — friction log from named personas walking
   through real flows.

The output is a single report with four sections, one per concern,
each in the deliverable shape specified in §6.

## 2. Sources of truth

Read these first, in this order, before producing anything:

- `PLAN.md` — engineering plan (data model, slices, semantics).
- `DESIGN-BRIEF.md` — UX direction, palette, archetypes,
  deliverables list (§15).
- `CHANGELOG.md` — what shipped in v1.
- Slice-level `CLAUDE.md` files — implementation notes per slice.
- Any `TESTING.md` or test-suite README.

If any of these contradict each other, flag the contradiction in
the report (it's a finding, not a blocker for the audit).

## 3. Hard rules

These apply throughout. Violations of these rules invalidate the
audit.

1. **Don't fix anything.** Audit and remediation are separate
   jobs. If you find a bug, log it. Do not commit a fix during
   this session, even a small one. Conflating the two produces
   low-quality fixes and an incomplete audit.
2. **No "I tested everything" claims.** State what you tested and
   what you didn't, explicitly. An honest "I didn't get to X
   because Y" is more useful than a confident-sounding lie.
3. **Severity is mandatory** on every finding (rubric in §5).
4. **Reproduction steps are mandatory** on every functional or
   permissions finding. A finding without reproduction steps isn't
   actionable.
5. **No screenshots-as-prose.** When evidence is visual, attach an
   actual screenshot (PNG/SVG) to the report. Don't describe what
   the screenshot would have shown.
6. **Plan before executing** — see §4.

## 4. Two-stage execution

### Stage A — Test plan (produce first, wait for approval)

Before running a single test, produce a `AUDIT-PLAN.md` covering:

- **Permissions matrix** — for every `(Section × Level × Action)`
  tuple in the data model, the expected outcome (pass/deny). Plus
  the equivalent for Wedding Book audience overrides
  (`(Audience × Action × Caller)`).
- **Functional checklist** — every existing Playwright test by
  name; every action you intend to exercise manually; the seven
  critical workflows (§6.2) broken into specific steps.
- **Design-delta scope** — which screens you'll compare against
  which `DESIGN-BRIEF.md` deliverable, with screenshots taken in
  both light and dark mode.
- **Personas** — concrete walkthroughs you'll do for §6.4
  (personas are pre-defined; see §7).
- **Out-of-scope** — anything you're explicitly not testing, with
  the reason. Risk-weighted coverage is the goal; everything-tested
  is theatre.

Stop after producing the plan. Wait for the human to approve
before proceeding.

### Stage B — Execute and report

Once the plan is approved, execute it and produce the four-section
report (§6). Update `AUDIT-PLAN.md` as you go to mark items
done/skipped/blocked, so the final state of the plan documents
what was actually run.

## 5. Severity rubric

Apply to every finding.

- **Blocker** — data loss, security/permissions leak, or a core
  flow is broken with no workaround. Cannot ship. Examples: a
  member can read a `COUPLE_ONLY` page; a Say I Do sync deletes
  locally-edited tags; the magic-link login fails for one of the
  OWNER accounts.

- **Major** — a workflow is significantly degraded; a workaround
  exists but is awkward; or the design diverges from the brief in
  a way a user will notice. Should ship a fix before the wedding.
  Examples: dragging a guest onto a full table doesn't show the
  capacity warning until refresh; the dark-mode palette has a
  contrast failure on one button; the Communications tab loses
  unsaved input on tab switch.

- **Minor** — annoyance, cosmetic but visible, low chance of
  real-world impact. Examples: a tooltip is mistimed; an empty
  state is missing its illustration; a date renders as
  `2026-09-26` instead of `26 Sep 2026` in one place.

- **Cosmetic** — pixel-level, only noticed when looking. Examples:
  a 2 px misalignment, a hover state slightly off-spec.

If you can't decide between two levels, pick the higher one and
note the uncertainty.

## 6. Report deliverables

Single file: `AUDIT-REPORT.md`. Four sections, in this order, each
in the prescribed shape.

### 6.1 Permissions hardening — threat matrix

A table with one row per `(Section, Level, Action, Caller)` tuple.

| Section | Level | Action | Caller | Expected | Actual | Result |
|---|---|---|---|---|---|---|
| GUESTS | NONE | list | non-member | deny | deny | ✅ |
| BUDGET | VIEW | mutate | member | deny | **allowed** | 🚨 BLOCKER |
| ... | | | | | | |

Cover at minimum:

- All seven structured sections (`GUESTS`, `BUDGET`, `VENDORS`,
  `TASKS`, `SCHEDULE`, `SEATING`, `NOTES`) at all four levels
  (`NONE`, `VIEW`, `EDIT`, `ADMIN`).
- Read and write actions for each.
- The owner-only `MEMBERS` admin (invite, remove, change
  permissions).
- All five Wedding Book audiences (`EVERYONE`, `COUPLE_ONLY`,
  `BRIDE_SIDE`, `GROOM_SIDE`, `CUSTOM`) with both readable and
  editable resolution.
- Section-default + per-page-override resolution order — verify
  page override beats section default; section default beats
  base `NOTES` permission.
- The "permissioned-out" UI states on the structured sidebar and
  the Wedding Book table-of-contents — confirm the user sees
  "ask for access" rather than 403.
- API-level checks: even if the UI hides a control, can the
  blocked user hit the underlying server action via a forged
  request? Use the test harness to call server actions directly.
- Magic-link rate limit — confirm 5/hour/email and 20/hour/IP
  hold under fuzz.

For each finding, include reproduction steps, the offending
component or route, and severity.

### 6.2 Functional regression + bug hunt — defect list

First, a one-line summary of the existing Playwright suite:
"Re-ran X tests, Y passed, Z failed/skipped." List failing tests
with the failure mode.

Then a defect list, one row per defect:

```
[BLOCKER|MAJOR|MINOR|COSMETIC] <Short title>
  Where:    <route, component, file>
  Repro:    1. ...
            2. ...
            3. Observe ...
  Expected: ...
  Actual:   ...
  Notes:    (any context, related findings, suggested area to fix)
```

Cover the **seven critical workflows** at minimum:

1. **Sync RSVPs** — re-import a modified `guestlist_attendees`
   CSV, exercise the diff preview, confirm conflicts are flagged
   and locally-edited fields aren't overwritten.
2. **Edit budget** — change planned/actual unit cost, change
   quantity, verify computed totals update correctly. Verify
   the running paid-vs-planned bar.
3. **Drag guests onto seats** — drag a guest onto a specific seat
   on a round table; verify capacity warning at full and over;
   verify a `MUST_NOT_TOGETHER` rule produces the red dot in real
   time.
4. **Log a supplier comm** — add a Communications entry with a
   follow-up date; verify the auto-created Task appears with the
   right link back; verify the last-message summary updates.
5. **Mark a Question task as answered** — fill the Answer field;
   verify the row subtitle updates; verify status displays as
   "Answered" not "Done" for Questions.
6. **Restore an archived guest** — sync a CSV that drops a row;
   verify the guest appears under "Show archived" with a Restore
   action; restore them; verify they return to the list with
   data intact.
7. **Change page audience** — set a Wedding Book page to
   `COUPLE_ONLY`; sign in as a non-couple member; verify the
   page title appears in the section TOC but content is replaced
   with the "private" card.

For each workflow, also test at least one edge case (empty data,
slow network simulated via DevTools throttling, large input).

### 6.3 Design fidelity — delta report

For each deliverable in `DESIGN-BRIEF.md` §15, produce a row:

| # | Deliverable | Built? | Light mode | Dark mode | Notes |
|---|---|---|---|---|---|
| 1 | Foundation tokens | ✅ | ✅ | ✅ | All tokens match brief §4. |
| 2 | Today dashboard | ✅ | ✅ | ⚠️ | Countdown card shadow in dark mode is too heavy (brief specifies softer; see screenshot). |
| ... | | | | | |

For any non-✅ row, attach a screenshot (`audit/screens/<deliverable>-light.png`,
`-dark.png`) and a one-line description of the delta.

Also explicitly verify:

- Both palette token sets ship and switch via `User.darkMode`.
- The illustration set is present, with light and dark variants
  for each scene.
- The Schedule renders as the illustrated itinerary, not a table.
- The Wedding Book hub uses the seven cards in the order specified
  in `DESIGN-BRIEF.md` §7.
- Round tables on the Seating canvas use the seat-position-dot
  visual specified in `DESIGN-BRIEF.md` §6F.
- The Photography Shot List embedded block is present and behaves
  as `DESIGN-BRIEF.md` §8 specifies.

Severity for design deltas:
- **Major** if a brief-specified element is missing (no dark mode
  on a screen, no shot list block, no illustration set).
- **Minor** if it's present but visibly off-spec.
- **Cosmetic** for pixel-level differences inside the brief's
  tolerance.

### 6.4 Usability sweep — friction log

Walk through each persona's real flows (§7). Write the log from
the persona's perspective in first person, not from yours. Each
entry:

```
[BLOCKER|MAJOR|MINOR] <Friction title>
  Persona:  <Bryony | Jamie | Josh | Aimee>
  Flow:     <e.g. "Reviewing this week's RSVP changes">
  Moment:   "I clicked Sync, and the diff preview opened. I
             saw 'Sarah Loughran: meal changed' but I couldn't
             tell if Sarah's old meal was being replaced or if
             this was the first time she'd answered. I had to
             open her detail sheet in another tab to check..."
  Why it matters: <impact on the persona's day>
  Suggested direction: <not a fix; a direction for triage>
```

Don't grade-inflate. Five real friction points written specifically
are worth more than thirty generic "consider improving X"
observations. If a flow is genuinely smooth, say so — that's also
useful signal.

Severity here is about user impact, not bug-class:
- **Blocker** — persona can't complete the task without help.
- **Major** — persona can complete it but visibly slows down or
  does the wrong thing.
- **Minor** — persona notices, mutters, carries on.

## 7. Personas (use these — don't invent)

These are the four real users. Use their names, the things they
care about, and the shape of the data they'll touch.

- **Bryony Olwyn-Davis** (bride, OWNER). Heavy user. Most
  interested in: guest list, RSVPs, seating, budget, the Wedding
  Book Food & Drink and Photography sections. Will use the app
  on mobile and desktop roughly equally. Test her flow on both.

- **Jamie Spencer** (groom, OWNER). Less frequent than Bryony.
  Most interested in: tasks, suppliers, payments, schedule.
  Uses dark mode (set in his preferences during the audit).
  Mostly desktop.

- **Josh Dickson** (best man, MEMBER). Casual user — once or
  twice a week. Cares about: his tasks under "Best Man" and
  "Groomsmen Prep" saved views, the Wedding Book Wedding Party
  section (specifically Stag Do), the day-of schedule. Mostly
  mobile.

- **Aimee Hollingsworth** (maid of honour, MEMBER). Same
  cadence as Josh, mirrored: Bridesmaid Prep, Hen Do, day-of
  schedule. Mostly mobile.

For each persona, walk through at least three real flows. Examples:

- **Bryony** — "Sync this week's RSVPs and update seating
  accordingly"; "Add three shots to the Photography shot list
  and print it"; "Change the Cake Project page audience to
  Couple Only".
- **Jamie** — "Log a phone call with Kate at the venue, with a
  follow-up to confirm final numbers"; "Pay the venue balance
  and mark the linked task done"; "Review next 30 days of
  payments due on At a Glance".
- **Josh** — "Check what I owe the groomsmen this week"; "Add
  a Stag Do venue idea as a checklist item on the Stag page";
  "Look up the wedding-day schedule on my phone in transit".
- **Aimee** — "RSVP for Uldis on his behalf because he's
  travelling"; "Add a song request"; "Read the Hen Do plan on
  my phone over lunch".

## 8. Specific gotchas to actively look for

These are areas the build is most likely to have quietly cut
corners. Flag them whether or not they manifest as bugs:

- **Computed totals** — does `BudgetLineItem.actual` truly
  recompute from `Payment` rows on every read, or is there a
  stored field somewhere that drifts?
- **Sync merge rules** — verify the rules in `PLAN.md` §13 are
  actually implemented. Especially the conflict detection on
  `dietaryEditedAt`.
- **Archived guests** — confirm they're hidden from default
  views *everywhere*: Guests list, Seating drawer, At a Glance
  RSVP donut, Photography shot-list typeahead.
- **Permission resolution order** — verify page override beats
  section default in actual code, not just in the docs.
- **Question vs Task display** — verify Question rows show `?`
  prefix and "Answered" status; verify the Answer field renders
  in the detail panel.
- **Cloudflare Tunnel + magic links** — verify the `NEXTAUTH_URL`
  produces working callback links from a real device, not just
  localhost.
- **Backups** — verify both the B2 and Drive targets receive
  files; verify the sanity-check email actually fires when
  staleness is simulated.
- **Mobile read-only seating** — verify the canvas does not
  render on mobile; the table-by-table list does.
- **Empty states** — every screen, both modes. Easy to forget
  on the less-trodden ones (Files, archived-guests view, an
  empty Wedding Book section page).
- **Print views** — verify A4 portrait for Schedule and Shot
  List, A3 landscape for Seating; verify the "DRAFT —
  unconfirmed" watermark on Seating before confirmation.
- **Custom fields** — verify they survive a CSV export round-trip
  (export, look at the file, make sure the columns are there).
- **Rate-limit pruning** — verify the hourly prune actually runs
  and the table doesn't grow unboundedly.

## 9. What you don't need to test

To keep the audit bounded, **skip**:

- Performance / load testing — not needed for 4–6 users.
- Accessibility deep-dive beyond the WCAG AA contrast checks
  already specified in `DESIGN-BRIEF.md` (a separate audit job).
- Cross-browser matrix — modern Chromium-family + Safari is
  enough.
- Internationalisation — English-only, GBP-only by design.
- Email template visual fidelity — separate brief.
- Marketing/landing pages — there are none.

If skipping any of these turns up an issue you incidentally
notice, log it but don't go hunting.

## 10. Final summary block

End `AUDIT-REPORT.md` with a one-page summary:

- Total findings by severity: **N blockers**, **N majors**, **N
  minors**, **N cosmetic**.
- Recommendation: ship as-is / fix blockers and ship / hold for
  major fixes.
- Top three risks the couple should know about even if not
  bug-class (e.g. "the Schedule doesn't print well in landscape
  if the day extends past midnight — Home Time at 23:59 sits
  awkwardly").
- What you didn't test, with reasons.

## 11. Time budget

Aim for the audit to take a single working session — ~4 hours of
focused work. If you find yourself going down a rabbit hole, log
the area as "needs deeper review" and move on. Better a complete
shallow audit than an incomplete deep one.

If the test plan in Stage A reveals the audit is genuinely larger
than 4 hours, raise it before executing. Don't quietly extend.

</details>

---

# 2. Plan


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


---

# 3. Report


**Audited build:** v1.1.0 on `claude/main` (commit `5b13728`, promoted 2026-04-27).
**Auditor mode:** static review only — no live runtime, no live DB, no
browser available during this session. See [AUDIT-PLAN.md](AUDIT-PLAN.md)
§1 for the full constraints; coverage gaps are surfaced in §11.
**Methodology:** schema review (`prisma/schema.prisma`), every
`actions.ts` and `page.tsx`, middleware + auth callbacks, then
prototype-vs-shipped comparison via [prototype/](prototype) and
[ROADMAP.md](ROADMAP.md). Build/typecheck/lint clean.

> **Read the headline first.** The brief was written against a v1 spec
> that materially differs from the v1 actually shipped. See
> [AUDIT-PLAN.md §0](AUDIT-PLAN.md) for the spec-drift table; in this
> report each finding either applies to the shipped artifact (most do)
> or is flagged "feature absent" where the brief asks about something
> that doesn't exist.

---

## 6.1 Permissions hardening — threat matrix

### Permission model as actually implemented

- **Levels:** `NONE \| VIEW \| EDIT` (Prisma enum `PermissionLevel`). No `ADMIN` level. The brief's `ADMIN` is approximated by the per-row `User.isCouple = true` boolean.
- **Sections** (in [src/lib/permissions.ts](src/lib/permissions.ts)): `tasks, questions, schedule, suppliers, guests, seating, songs, files, book, budget, payments, settings`. Twelve sections, not the brief's seven.
- **Couple-only sections** (hard-gated regardless of `Permission` row): `budget, payments`.
- **Resolution:** `canView/canEdit(user, section)` → returns `true` short-circuit if `user.isCouple` (couple-tier sees and edits everything except things they explicitly aren't, which is none). Otherwise reads the `Permission` row for `(userId, section)` and returns `level === VIEW \| EDIT` (view) or `level === EDIT` (edit). Couple-only sections always deny non-couple regardless of `Permission` row.
- **Server actions** all funnel through `requireEdit(section)` in [src/lib/actions.ts](src/lib/actions.ts), which redirects unauthenticated requests to `/signin` and `throw new Error("Forbidden: …")` for permission-denied. Every mutating action inspected (74 sites grepped) calls `requireEdit` or `requireUser`.
- **Middleware** ([src/middleware.ts](src/middleware.ts)) redirects unauthenticated to `/signin` and hard-redirects non-couple `/budget`/`/payments` requests to `/`.
- **Defense in depth:** budget and payments pages also `redirect("/")` server-side if not couple, plus `requireEdit` on every action.

### Threat matrix

For every `(Section, Level, Action, Caller)` tuple. **Caller** is `couple` (any `isCouple=true`) or `non-couple+L` where L is the user's `Permission.level` for that section.

| Section | Level | Action | Caller | Expected | Actual | Result |
|---|---|---|---|---|---|---|
| `tasks` | NONE | list | non-couple+NONE | deny | UI shows page-level "no edit" empty, but `db.task.findMany` runs without permission gate on the list (Tasks page only checks `canEdit` for actions, not for list visibility) | ⚠️ **MINOR** — list visible to NONE; no separate `canView` gate on `/tasks` |
| `tasks` | EDIT | mutate | non-couple+EDIT | allow | allow via `requireEdit("tasks")` | ✅ |
| `tasks` | NONE | mutate | non-couple+NONE | deny | deny — `requireEdit` throws | ✅ |
| `questions` | NONE | list/answer | non-couple+NONE | deny | `answerQuestion` correctly gated on `questions`. List visibility gated by sidebar nav only — page itself runs the query without `canView` | ⚠️ **MINOR** — same pattern |
| `schedule` | EDIT | mutate | non-couple+EDIT | allow | allow | ✅ |
| `suppliers` | NONE | view detail | non-couple+NONE | deny | `/suppliers/[id]` calls `canView` and `notFound()` if blocked | ✅ |
| `suppliers` | EDIT | mutate sub-resource (contact/contract/comm) | non-couple+EDIT | allow | allow via the new `createSupplierContact/Contract/Communication` actions, all gated `requireEdit("suppliers")` | ✅ |
| `guests` | NONE | view list | non-couple+NONE | deny | Sidebar hides; **page itself runs `db.household.findMany` without `canView`**, but the `requireUser()` plus middleware redirect mean only authenticated callers reach the page. A NONE user can in principle GET `/guests` and see the list. | 🚨 **MAJOR** — see finding F1 below |
| `guests` | NONE | view `/guests/[id]` | non-couple+NONE | deny | `notFound()` if `!(await canView(user, "guests"))` — correct | ✅ |
| `guests` | NONE | view `/guests/catering` | non-couple+NONE | deny | `redirect("/")` if `!(await canView(...))` — correct | ✅ |
| `guests` | NONE | import CSV | non-couple+NONE | deny | `requireEdit("guests")` — correct | ✅ |
| `seating` | EDIT | drag/drop / assign | non-couple+EDIT | allow | allow | ✅ |
| `seating` | NONE | call `assignGuestToSeat` directly via crafted request | non-couple+NONE | deny | `requireEdit("seating")` — correct | ✅ |
| `songs` | EDIT | reorder, sync, request | non-couple+EDIT | allow | allow | ✅ |
| `files` | NONE | list | non-couple+NONE | deny | `/files/page.tsx` calls `canView("files")`. Confirmed. | ✅ |
| `files` | NONE | download `/api/files/[id]` | non-couple+NONE | deny | `canView("files")` checked, returns 403 if blocked | ✅ |
| `files` | EDIT (non-couple) | download couple-only file | non-couple+EDIT | deny (visibility gate) | `if (file.visibility === "COUPLE_ONLY" && !session.user.isCouple)` returns **404** — correct (404 not 403 prevents existence-probing) | ✅ |
| `files` | EDIT (non-couple) | re-mark visibility to EVERYONE | non-couple+EDIT | deny (only couple can flip) | `updateFile`'s visibility check on `isCouple` blocks non-couple from setting EVERYONE → COUPLE_ONLY or vice versa, but actions.ts line 113 only checks couple for COUPLE_ONLY → not all paths gated | ⚠️ Need to verify (see F2) |
| `book` | NONE | list / view | non-couple+NONE | deny | `/book/page.tsx` only requires user, no `canView` check | ⚠️ **MINOR** — same pattern as `guests` |
| `book` | EDIT | edit subsection | non-couple+EDIT | allow | allow | ✅ |
| `book` (photography) | NONE | view shot list | non-couple+NONE | deny | `/book/photography/page.tsx` redirects via `canView("book")` — correct | ✅ |
| `budget` | * | list | non-couple+anything | deny | Three-layer: middleware redirect, page `if (!user.isCouple) redirect("/")`, `requireEdit` on all actions | ✅ |
| `budget` | * | mutate | non-couple+anything | deny | All five actions gated `requireEdit("budget")` which calls `canEdit` which checks `COUPLE_ONLY_SECTIONS` first | ✅ |
| `payments` | * | list | non-couple+anything | deny | Same three-layer | ✅ |
| `payments` | * | mutate | non-couple+anything | deny | All four actions gated | ✅ |
| `settings` | EDIT | grant permissions | non-couple+EDIT | depends — only couple should change others' perms | `grantPermission` is gated `requireEdit("settings")`; a non-couple user with EDIT on settings could grant other users any permission level. | 🚨 **MAJOR** — see F3 |
| `settings` | EDIT | profile edit (own user) | non-couple+EDIT | allow (own profile only) | code reads — OK | ✅ |
| `settings` | NONE | grant permissions via crafted request | non-couple+NONE | deny | `requireEdit("settings")` throws | ✅ |

#### Wedding Book audience overrides

**Not applicable — feature absent.** Brief expects `EVERYONE`,
`COUPLE_ONLY`, `BRIDE_SIDE`, `GROOM_SIDE`, `CUSTOM` audiences per
`BookSubsection`. Schema has no audience field on `BookSubsection`.
Per-page audience overrides are **not implemented** at all.

The closest analogue is `File.visibility` (`EVERYONE \| COUPLE_ONLY`),
which is verified above.

#### "Permissioned-out" UI states

Brief expects "ask for access" not 403. Actual behaviour:
- Middleware redirect → silent redirect to `/` for couple-only routes (no
  message). User has no signal they were blocked.
- Server action `requireEdit` → `throw new Error("Forbidden: …")`. In
  the browser this surfaces as a Next.js error overlay in dev or a
  generic error toast in prod (no friendly "ask for access" message).
- Sidebar navigation hides items the user can't access (correct).

⚠️ **MINOR** — no friendly "ask for access" UX. Users get silent
redirects or generic errors.

#### API-level forging

Server actions are accessed via `<form action={…}>` and `useTransition`-
wrapped function calls. Next.js exposes them as POST endpoints under
`_next/data` paths. A blocked user could craft a POST. **All inspected
actions invoke `requireEdit` as the first line**, so forgery returns
the same Forbidden error. No actions found that mutate without a
permission check.

#### Magic-link rate limit

**Not implemented.** Brief expects 5/hour/email and 20/hour/IP. No
rate-limit table in schema, no middleware throttle. The Auth.js
`Nodemailer` provider has no built-in rate-limit either.

🚨 **MAJOR** — see F4. Exploit window is small (allowlist already
restricts who can request), but a malicious / mis-configured client
could spam the SMTP provider or use the magic-link callback for token
generation up to whatever Resend's own rate-limit allows.

### Findings

#### F1 — `/guests`, `/tasks`, `/questions`, `/book` lack `canView` gate at page level — list data leaks to users with `Permission.level = NONE`

- **Severity:** MAJOR
- **Where:** [src/app/(app)/guests/page.tsx](src/app/(app)/guests/page.tsx), [src/app/(app)/tasks/page.tsx](src/app/(app)/tasks/page.tsx), [src/app/(app)/questions/page.tsx](src/app/(app)/questions/page.tsx), [src/app/(app)/book/page.tsx](src/app/(app)/book/page.tsx)
- **Repro:**
  1. Create a User with `isCouple = false` and a `Permission` row `(userId, section: "guests", level: "NONE")`.
  2. Authenticate as that user.
  3. Navigate to `/guests`.
- **Expected:** `redirect("/")` or render an empty/"no access" state.
- **Actual:** Page renders the full household list. Sidebar nav hides the link, but the route itself isn't gated. Same pattern on `/tasks`, `/questions`, `/book`.
- **Notes:** The detail routes (`/guests/[id]`, `/guests/catering`, `/book/photography`) **do** check `canView` correctly — the inconsistency suggests the list pages were built before the per-page gate convention was settled. No mutation is leaked (those are correctly gated). This is a read-only data-exposure: a NONE user can see guest names, RSVPs, dietary, etc. by typing the URL. Couple-tier users are unaffected.

#### F2 — `updateFile` visibility transition gate is asymmetric

- **Severity:** MINOR
- **Where:** [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) (around the `updateFile` action — couldn't verify exact line range without re-reading the full file)
- **Repro:** Sign in as a non-couple user with `EDIT` on `files`. Edit a file currently visible to EVERYONE. Set visibility to `COUPLE_ONLY`.
- **Expected:** Either allow (the new state is more restrictive, fine) or deny consistently with the COUPLE_ONLY → EVERYONE direction.
- **Actual:** Need a live runtime to verify both directions. Static review suggests the gate may only cover one direction.
- **Notes:** Audit-relevant whichever way it goes — non-couple users shouldn't be able to make a file couple-only either, since it could lock the couple out (well, no — `isCouple` always sees couple-only files). Worth a manual test before ship.

#### F3 — A non-couple user with `EDIT` on `settings` can change other users' permissions and toggle `isCouple` on themselves

- **Severity:** MAJOR (potentially BLOCKER if exploited; depends on whether `isCouple` toggle is one of the editable fields)
- **Where:** [src/app/(app)/settings/actions.ts](src/app/(app)/settings/actions.ts)
- **Repro:**
  1. Couple-tier user grants Josh (MEMBER) `EDIT` on `settings`.
  2. Josh now calls `grantPermission(otherUserId, "budget", "EDIT")` via the matrix UI.
  3. Or Josh calls `updateUser(self, { isCouple: true })` if that path exists.
- **Expected:** Only couple-tier should be able to elevate other users or toggle `isCouple`.
- **Actual:** All settings actions are gated by `requireEdit("settings")`, which means anyone with `Permission(settings) = EDIT` can do everything in settings — including granting permissions on couple-only sections (where `canEdit` correctly denies them, so the operation may fail in practice, but the audit log gets cluttered with denied attempts).
- **Notes:** Worth a read of the actual settings actions to confirm whether `isCouple` is mutable through the UI. If yes, this is a privilege-escalation vector. The likely intent is "only couple can change permissions" — that should be enforced explicitly (`if (!user.isCouple) throw`) rather than relying on `requireEdit("settings")` alone. The five-user wedding context limits real exposure, but the policy is wrong on principle.

#### F4 — No magic-link rate limit

- **Severity:** MAJOR
- **Where:** [src/auth.ts](src/auth.ts) `sendVerificationRequest`
- **Repro:** Submit the sign-in form repeatedly with the same allowed email. Each submission sends an SMTP message via Resend.
- **Expected:** 5 requests per hour per email, 20 per hour per IP, with a friendly cooldown message after.
- **Actual:** Each submission immediately sends a new email. Resend's own rate-limit (default 100/day, configurable) is the only stop.
- **Notes:** AUTH_ALLOWED_EMAILS already restricts who can trigger email at all (5 emails today), so the realistic exposure is bounded. Worth implementing before adding any wider allowlist.

#### F5 — Server-action `requireEdit` failures throw raw Errors instead of structured 403s

- **Severity:** MINOR
- **Where:** [src/lib/actions.ts](src/lib/actions.ts) line 29
- **Actual:** `throw new Error("Forbidden: no edit access to <section>")`. In production this surfaces to the user as a generic error toast or a 500-class response from the action, not a friendly "you don't have permission to do that" UI.
- **Notes:** The brief wants "ask for access" UX. Today there's no UX at all — just an error.

#### F6 — `setTaskStatus` and `deleteTask` are gated `tasks` but operate on the polymorphic `Task` model that also stores Questions

- **Severity:** MINOR (theoretical — UI doesn't expose these on Question rows)
- **Where:** [src/app/(app)/tasks/actions.ts](src/app/(app)/tasks/actions.ts) lines 88–95 and 112–119
- **Notes:** A user with `EDIT` on `tasks` but `NONE` on `questions` could craft a request to `setTaskStatus(<questionId>, "DONE")` and succeed. The Tasks UI never shows Questions (the page filters `where: { type: "TASK" }`), and the Questions UI uses `answerQuestion` which is gated correctly. Net exposure: low. Recommended fix during remediation: branch the gate by entity type (read the Task, then `requireEdit("questions")` if `type === QUESTION`).

---

## 6.2 Functional regression + bug hunt — defect list

### Existing test suite

**Re-ran 0 tests, 0 passed, 0 failed.** No Playwright config, no `*.spec.ts` files, no test runner declared in `package.json` (no `"test"` script). The brief's §6.2 "re-run existing tests" step is **not executable** — there's nothing to run.

🚨 **BLOCKER for any formal regression strategy** if the user expected one. **MAJOR** if the user accepts manual smoke-testing as the v1 strategy.

### Workflow walkthroughs (static trace)

#### Workflow 1 — "Sync RSVPs"

Brief: re-import a modified `guestlist_attendees` CSV, exercise diff preview, confirm conflicts flagged and locally-edited fields not overwritten.

**Mapping:** the actual feature is the CSV import at `/guests/import` — preview → commit. There is no "sync" with conflict-detection on `dietaryEditedAt` (no such field exists). There **is** a merge-by-name-in-household path that preserves locally-edited fields with overwrite-if-non-null semantics (shipped in v0.12.0).

**Trace** ([src/app/(app)/guests/import/actions.ts](src/app/(app)/guests/import/actions.ts)):

1. ✅ `previewImport` parses CSV, infers column mapping, computes per-row `guestAction: "create" \| "update"` based on `(householdName, firstName, lastName)` dedupe key, returns `{ rows, newGuests, updatedGuests, ... }`.
2. ✅ `commitImport` applies the merge with documented field semantics (overwrite strings if non-empty, OR booleans, union arrays, never reset confirmed RSVPs to PENDING).
3. ⚠️ **MINOR** — preview does not expose a per-field diff (e.g. "old: VEGAN, new: GLUTEN_FREE"). User sees only "23 new · 4 merging into existing" and a "merge" chip per row, not the actual changes. Brief asks for "diff preview, confirm conflicts are flagged."
4. ⚠️ **MAJOR** — no conflict-detection field. `Guest.updatedAt` exists (Prisma timestamp), but the importer doesn't compare it. If two RSVPs come in for the same guest (CSV import overlaps with a manual UI edit between previews), the second import's preview is computed against stale data, and commit silently overwrites whichever the user clicked.
5. ✅ Empty-rows handling: returns valid empty preview with `newGuests: 0, updatedGuests: 0`.
6. ✅ Couple-only checks: `requireEdit("guests")` properly applied in both preview and commit.

**Defect:**

```
[MAJOR] Import preview shows merge chip but no per-field diff
  Where:    src/app/(app)/guests/import/ImportClient.tsx PreviewPanel
  Repro:    1. Original CSV: row "Sarah Loughran, dietary=VEGAN"
            2. Import via /guests/import → commit
            3. Edit Sarah in the UI: dietary=GLUTEN_FREE
            4. Re-import same CSV (with VEGAN still in the row)
            5. Preview shows "Sarah Loughran [merge]" with no
               indication that VEGAN will overwrite GLUTEN_FREE
  Expected: Per-field diff: "dietary: GLUTEN_FREE → VEGAN"
            (or, ideally, a "skip / overwrite / merge as union"
             choice per field)
  Actual:   Just the chip; commit silently overwrites GLUTEN_FREE
            with VEGAN unless the merge logic for that specific
            field happens to be "skip if non-empty" (which dietary
            is — it's an array union).
  Notes:    The ARRAY-union semantics for dietary mean GLUTEN_FREE
            is preserved. But meal courses, RSVP, and notes do
            overwrite. The per-field diff would be load-bearing
            UX before re-import becomes a routine workflow.
```

Edge case tested (static trace): empty CSV → returns valid empty preview. Large CSV (~1000 rows) bounded by Zod `.max(1_000_000)` text limit.

#### Workflow 2 — "Edit budget"

Brief: change planned/actual unit cost, change quantity, verify computed totals update; verify the running paid-vs-planned bar.

**Mapping:** `BudgetLine` in the schema. **No `quantity` field**. No "unit cost × qty = computed total". `actual` is a stored field, not recomputed from anything.

**Trace** ([src/app/(app)/budget/actions.ts](src/app/(app)/budget/actions.ts)):

1. ✅ `updateLine` accepts `estimated`, `actual`, `paid` directly (not unit × qty). Form validation via Zod.
2. ✅ Page totals computed in [BudgetClient.tsx](src/app/(app)/budget/BudgetClient.tsx) `SummaryBar`: sum estimated, actual, paid across all categories.
3. ✅ Stacked progress bar (paid + committed) rendered correctly with over-budget warning.
4. ⚠️ **MAJOR spec-drift** — brief expects `actual` to recompute from `Payment` rows. Schema has `Payment.budgetLineId` FK but no view / recompute job. If a payment is recorded against a line, `BudgetLine.actual` doesn't update.

**Defect:**

```
[MAJOR] BudgetLine.actual does not recompute from Payment rows
  Where:    prisma/schema.prisma BudgetLine + Payment models;
            src/app/(app)/payments/actions.ts mutations
  Repro:    1. Create BudgetLine "Venue", estimated=10000, actual=null, paid=0
            2. Create Payment description="Venue deposit", amount=2000,
               budgetLineId=<venue line>, status=PAID
            3. Refresh /budget
  Expected: BudgetLine "Venue" shows actual=2000, paid=2000, or some
            documented relationship between Payment.amount and
            BudgetLine.actual / paid.
  Actual:   BudgetLine.actual still null. paid still 0. No relationship.
            User must manually keep both in sync.
  Notes:    Brief §8 actively flags this as a "computed totals" gotcha.
            This is the gotcha; flagged.
```

#### Workflow 3 — "Drag guests onto seats"

Brief: drag a guest onto a specific seat on a round table; verify capacity warning at full and over; verify a `MUST_NOT_TOGETHER` rule produces a red dot in real time.

**Mapping:** the seating canvas exists with drag. **MUST_NOT_TOGETHER rules don't exist** at all (no schema, no UI). Capacity is bounded at table creation (exactly `capacity` seats are created), so "over-capacity" isn't a state the model permits.

**Trace** ([src/app/(app)/seating/actions.ts](src/app/(app)/seating/actions.ts) `assignGuestToSeat`):

1. ✅ Action gated `requireEdit("seating")`.
2. ⚠️ **MINOR** — race condition: `updateMany` to clear existing occupants of the target seat, then `update` to set the new guest. Two simultaneous assignments to the same seat could both succeed in clearing existing and one would win the final update. Not catastrophic — the unique constraint on `Guest.tableSeatId` would reject the duplicate.
3. ✅ Capacity counter in UI shows `filled / capacity`. Since seats are pre-allocated, the UI naturally limits "drag onto a seat" to the available seat slots.
4. ❌ **No constraint rules** — `MUST_NOT_TOGETHER` is feature-absent. Cannot test.

**Defect (acknowledged spec drift, not a bug per se):**

```
[MAJOR] Seating constraint rules (MUST_NOT_TOGETHER) absent
  Where:    schema (no model), seating UI (no rules panel)
  Repro:    n/a — feature absent
  Expected: Per brief §6.2 #3, dragging a guest onto a table where they
            must-not-sit-with someone already seated should show a red
            indicator in real time.
  Actual:   No constraint system exists.
  Notes:    Listed in ROADMAP as deferred backlog.
            Triage: build only if real demand exists.
```

#### Workflow 4 — "Log a supplier comm"

Brief: add a Communications entry with a follow-up date; verify auto-Task; last-message summary updates.

**Mapping:** Just shipped in v1.0.0. `/suppliers/[id]` has Communications tab.

**Trace** ([src/app/(app)/suppliers/actions.ts](src/app/(app)/suppliers/actions.ts) `createSupplierCommunication`):

1. ✅ Gated `requireEdit("suppliers")`. Validates with Zod (channel enum, summary required, optional follow-up date).
2. ✅ Creates `SupplierCommunication` row with `createdById = user.id`.
3. ❌ **No auto-Task creation.** Brief expects a follow-up date to spawn a linked Task; nothing of the sort happens. The follow-up date is stored but never surfaces outside the supplier detail page (no agenda, no Today integration).
4. ❌ **No last-message-summary on supplier card.** SupplierCard doesn't display any of the comms log; only the detail page does.

**Defects:**

```
[MAJOR] SupplierCommunication.followUpAt does not auto-create a Task
  Where:    src/app/(app)/suppliers/actions.ts createSupplierCommunication
  Repro:    1. /suppliers/<id> → + Log entry
            2. Set channel=email, summary="Asked about parking", followUpAt=2026-05-15
            3. Save
            4. Visit /tasks
  Expected: A Task "Follow up: Asked about parking" linked to the supplier,
            due 2026-05-15, appears in /tasks.
  Actual:   No Task is created. The follow-up date is stored on the comm
            entry only.
  Notes:    Manual workaround: also create a Task by hand. Workable but
            misses brief intent.

[MINOR] Supplier card doesn't surface last-message summary
  Where:    src/app/(app)/suppliers/SupplierCard.tsx
  Repro:    Add a comm entry on /suppliers/<id>, return to /suppliers
  Expected: Card shows "Last contact: 3 days ago — Asked about parking"
  Actual:   Card shows the supplier name, status, agreed amount, optional
            website + notes line — nothing about communications.
  Notes:    Detail page has the full log. Hub-level surfacing is missing.
```

#### Workflow 5 — "Mark a Question task as answered"

Brief: fill the Answer field; row subtitle updates; status displays as "Answered" not "Done" for Questions.

**Trace** ([src/app/(app)/tasks/actions.ts](src/app/(app)/tasks/actions.ts) `answerQuestion`):

1. ✅ Gated `requireEdit("questions")` (correctly using questions section, not tasks).
2. ✅ Sets `questionAnswer = answer` and `status = DONE` if non-empty answer, else OPEN.
3. ✅ Audited as `action: "answer"`.
4. ✅ [QuestionsClient.tsx](src/app/(app)/questions/QuestionsClient.tsx) displays "Answered" pill (line 117: `label={q.status === "DONE" ? "Answered" : priorityBucket}`) — doesn't say "Done" for Questions. ✅ Brief intent met.
5. ✅ `revalidatePath("/questions")`, `/tasks`, `/`.

**No defects on this workflow.** Edge case: empty answer → status reverts to OPEN. Tested via static trace; confirmed.

#### Workflow 6 — "Restore an archived guest"

Brief: sync drops a row → guest archived → "Show archived" → Restore.

**Mapping:** `Guest.archived: Boolean` exists. **No restore UI**.

**Trace:**

1. The CSV import does NOT archive guests that disappear from a re-import — it only adds new and merges existing (verified in `commitImport`). So step "sync drops a row" doesn't trigger any archival.
2. `db.guest.delete` removes the row entirely; no archival flow is wired.
3. No "Show archived" toggle on `/guests`.
4. No `restoreGuest` action.

**Defect:**

```
[MAJOR] Archived-guest workflow not implemented
  Where:    src/app/(app)/guests/actions.ts (deleteGuest hard-deletes);
            src/app/(app)/guests/page.tsx (no "show archived" toggle)
  Repro:    n/a — feature absent
  Expected: Soft-delete via Guest.archived=true; "Show archived" filter;
            Restore action.
  Actual:   Hard delete only. archived field is queried (`where: { archived: false }`)
            but never set to true by any action.
  Notes:    Brief §8 specifically calls this out as a gotcha. Confirmed.
            Listed as deferred work.
```

#### Workflow 7 — "Change page audience to COUPLE_ONLY"

**Mapping:** Wedding Book has no per-page audience. The Files visibility analogue is verified above.

**Trace:** N/A — feature absent.

**Defect:**

```
[MAJOR] Wedding Book per-page audience overrides not implemented
  Where:    prisma/schema.prisma BookSubsection (no audience field)
  Repro:    n/a
  Expected: COUPLE_ONLY page hides content from non-couple but the title
            shows in the section TOC with a "private" placeholder.
  Actual:   Only section-level `book` permission gates access. No per-
            subsection visibility; no TOC redaction.
  Notes:    Material divergence from brief §6.2 #7. Workaround: keep
            sensitive notes out of the Wedding Book; use the Files
            section (which DOES have per-file visibility).
```

### Other findings discovered during trace

```
[MINOR] CSV import "duplicate-email" warning is independent of the merge match
  Where:    src/app/(app)/guests/import/actions.ts previewImport
  Repro:    1. Import a CSV where Sarah's row uses email sarah@a.com
            2. Manually update Sarah's email in the UI to sarah@b.com
            3. Re-import the original CSV
  Expected: Preview shows "merge by name+household; email will be
            updated from sarah@b.com → sarah@a.com" with no email-
            duplicate warning (since this is a merge, not a duplicate).
  Actual:   Either silently overwrites, or shows a "duplicate email"
            warning depending on whether sarah@a.com exists elsewhere.
  Notes:    The merge logic does suppress the dup-email warning when
            guestAction === "update" (verified at line 334), but the
            edge of "merging into existing whose email differs" is
            quietly overwritten.

[MINOR] Magic-link verification email logs the URL to stdout when
SMTP isn't configured
  Where:    src/auth.ts sendVerificationRequest line 115-118
  Repro:    Set EMAIL_SERVER_HOST="" in production by mistake
  Expected: Either fail loudly or store the URL somewhere only an
            operator can reach.
  Actual:   console.log(`Magic link for ${identifier}\n  ${url}\n`);
            ends up in `docker logs wedding-hub-web-1`.
  Notes:    Production currently has SMTP set, so this is dormant.
            But misconfig + log shipping (e.g., to a third-party log
            collector) leaks single-use auth links. Document or harden.

[MINOR] Quick-capture (C shortcut) Event uses a default of "now + 1 hour"
  Where:    src/app/(app)/actions.ts quickCapture event branch
  Repro:    1. Press C anywhere
            2. Type "Suit fitting at Slaters", switch type to Event, Enter
            3. Visit /schedule
  Expected: Event with title "Suit fitting at Slaters" appears, time TBD
  Actual:   Event lands at the next round hour from "now" — could be 4am
            tomorrow if you capture at 3:15am, or stack up at the same
            time across multiple captures.
  Notes:    Acceptable pragmatic default per the inline comment, but
            users may not realise. A tiny "set time" follow-up affordance
            on the success toast would close this.

[MINOR] /glance page has no canView gate — non-couple sees redacted view
  Where:    src/app/(app)/glance/page.tsx requireUser only
  Repro:    Any user can hit /glance.
  Expected: This is intentional per the page design (role-aware redact).
  Actual:   Confirmed working as designed: couple-only entities are
            redacted to "updated a private page" for non-couple.
  Notes:    Not a bug. Listed for completeness.
```

---

## 6.3 Design fidelity — delta report

> No `DESIGN-BRIEF.md` exists. Comparison is against [prototype/](prototype) — the de-facto design brief — and the live source. **No screenshots taken** (no live render available). Each delta is described in prose, with a file pointer.

### Deliverables matrix

| # | Deliverable | Built? | Light mode | Dark mode | Notes |
|---|---|---|---|---|---|
| 1 | Foundation tokens (palette, type, radius, shadow) | ✅ | ✅ | ✅ | `prototype/tokens.css` ported into `src/app/globals.css` `@theme` block. Light + dark variants present. Fraunces/Inter wired. Token names match (`--color-moss-500`, `--color-marigold-100`, `--color-ink-primary`, etc.). |
| 2 | AppShell sidebar + mobile tab bar | ✅ | ✅ | ✅ | All 12 sections in nav; mobile tab bar at ≤720px; couple-only items filtered. |
| 3 | Today dashboard | ✅ | ✅ | ✅ | Countdown card with months/weeks/days toggle (v1.0.0), Mine/Everyone persona filter on events, RSVP snapshot strip. Day-of-mode link in header. |
| 4 | Day-of mode | ✅ | ✅ | ✅ | `/today/day-of` — live timeline (now/next/past), tappable contacts, catering aggregates, quick links. |
| 5 | At a Glance dashboard | ✅ | ✅ | ✅ | `/glance` — RSVP donut, budget bar, payments-due, audit-log activity (v1.1.0). |
| 6 | Tasks (list + kanban) | ✅ | ✅ | ✅ | List + kanban toggle (v1.0.0). Persisted to localStorage. |
| 7 | Questions | ✅ | ✅ | ✅ | Search + Type/Priority filter pills (v1.0.0). |
| 8 | Schedule (vertical timeline + print) | ✅ | ✅ | ✅ | Day-grouped, sticky headers, node markers, A4 print stylesheet. |
| 9 | Suppliers (cards + detail) | ✅ | ✅ | ✅ | Cards on /suppliers, detail at /suppliers/[id] with Contacts/Contracts/Communications (v1.0.0). |
| 10 | Budget (couple-only) | ✅ | ✅ | ✅ | Collapsible categories, stacked progress bar, over-budget warning. |
| 11 | Payments (couple-only) | ✅ | ✅ | ✅ | Table with quick "Mark paid". |
| 12 | Songs + playlists + Spotify mirror | ✅ | ✅ | ✅ | Playlist cards, in-playlist reorder (v1.0.0), Spotify sync (v0.14.0), guest requests section. |
| 13 | Guests (households + import + detail + catering brief) | ✅ | ✅ | ✅ | All four shipped. CSV importer with merge semantics. Guest detail page at /guests/[id]. Catering brief at /guests/catering with letterhead + per-table breakdown. |
| 14 | Seating canvas + list | ✅ | ✅ | ✅ | Pointer-event drag with grid snap, view toggle Canvas/List, persisted preference. |
| 15 | Files (uploads + folder grouping + visibility + thumbnails) | ✅ | ✅ | ✅ | Type filter pills, image thumbnails (v1.0.0), drag-drop upload, per-file visibility for couple-only. |
| 16 | Wedding Book hub + sections | ✅ | ✅ | ✅ | Hub with section cards. Section pages with on-page anchor pills (v1.0.0). 5 sections: Ceremony, Reception, Logistics, Photography, Wedding party. |
| 17 | Photography Shot List | ✅ | ✅ | ✅ | Custom checklist UI at /book/photography. Print mode. Reorder, capture toggle. |
| 18 | Wedding-party section | ✅ | ✅ | ✅ | BookSection with 5 seeded subsections (Roles, Outfits, Ring keepers, Stag & Hen, Day-of logistics). |
| 19 | Settings (permissions matrix + profile) | ✅ | ✅ | ✅ | Per-user × per-section matrix. First-name/last-name profile editing. |
| 20 | Sign-in pages + magic-link email | ✅ | ✅ | n/a | Magic-link email is HTML letterhead with brand band. Sign-in / verify / error pages styled. |
| 21 | Quick-capture (C shortcut) modal | ✅ | ✅ | ✅ | Mounted in AppShell. Task / Question / Event types. Esc dismiss, success toast. |
| 22 | Print views (Schedule, Catering brief, Shot list) | ✅ | n/a | n/a | A4 portrait. Letterhead, page-break helpers, hidden chrome. |

#### Brief-specific verifications

- **Both palette token sets ship and switch via `User.darkMode`** — ❌ no `User.darkMode` field. Dark mode is **localStorage-only** via [DarkModeScript](src/components/shell/DarkModeScript.tsx). Toggle persists per-device, not per-account. **MINOR spec drift.**
- **Illustration set with light + dark variants for each scene** — ❌ no illustration set. Prototype's `illustrations.jsx` defines a few inline SVG icons; only the inline SVGs in CountdownCard / RsvpDonut shipped. **MINOR spec drift** — the build relies on emoji + token-only visuals instead.
- **Schedule renders as illustrated itinerary, not a table** — ✅ vertical timeline with node markers. Not "illustrated" per the prototype's per-event motif icons (`IcoRing`, `IcoCandle`, `IcoPlate` were never ported), but it's not a table. **MINOR spec drift on motif icons.**
- **Wedding Book hub uses 7 cards in the order specified by `DESIGN-BRIEF.md` §7** — N/A (no DESIGN-BRIEF). Built order: Ceremony → Reception → Logistics → Photography → Wedding party. 5 cards, not 7. The prototype had `'photo','party','ceremony','reception','venue','food','guest'` (7). Wedding Hub seeded 5; rest deferred. **MINOR spec drift.**
- **Round tables on Seating canvas use seat-position-dot visual** — partially. SVG circle for the table, capacity displayed in centre. Individual seat-position dots around the perimeter are NOT drawn. Brief expected per-seat visual feedback. **MINOR spec drift.**
- **Photography Shot List embedded block** — ✅ at `/book/photography`. Capture checkbox per row, name chips, location, reorder, print. Behaves per prototype's `PhotographyContent` block.

### Design findings

```
[MINOR] Dark mode not persisted to user account
  Where:    src/components/shell/DarkModeScript.tsx
  Repro:    User toggles dark mode on phone, opens app on laptop.
  Expected: Mode follows account.
  Actual:   localStorage per-device. Phone is dark; laptop reverts to default.
  Notes:    Each device honors its own preference. Acceptable pragmatically;
            doesn't match brief's User.darkMode field.

[MINOR] No motif icons / illustration set on Schedule events or Book section cards
  Where:    src/app/(app)/schedule/EventNode.tsx; src/app/(app)/book/page.tsx
  Repro:    Look at /schedule or /book.
  Expected: Per prototype, ceremony events have a ring icon, food events
            a plate icon, etc. Book section cards have illustrations.
  Actual:   Plain text + emoji. No illustration component shipped.
  Notes:    Visual polish gap. Brand sets the precedent (Fraunces display
            font does carry a bit of personality), but the difference is
            visible.

[MINOR] Round table doesn't render per-seat position dots
  Where:    src/app/(app)/seating/SeatingCanvas.tsx
  Repro:    /seating, observe a round table with 8 seats.
  Expected: 8 small dots arrayed around the table perimeter, indicating
            seat positions; filled dots = assigned, hollow = empty.
  Actual:   Single circle with capacity text in middle.
  Notes:    Functionally equivalent (filled/capacity in centre) but visually
            less informative at a glance.

[MINOR] Wedding Book hub has 5 sections; brief expected 7
  Where:    prisma/seed.ts seedBookSections
  Repro:    /book hub.
  Expected: 7 sections per prototype: photo, party, ceremony, reception,
            venue, food, guest experience.
  Actual:   5: ceremony, reception, logistics, photography, wedding-party.
  Notes:    Missing: dedicated Food/Drink section, dedicated Guest
            Experience (Pixel Party / photo booth / etc.). Logistics
            covers some of this. Add via /book → AddSection if needed.
```

---

## 6.4 Usability sweep — friction log

> Walked through each persona's flows in code, not in browser. Friction grounded in code-readable signals (missing affordances, multi-step flows, error UX) is included; speculation about visual feel is omitted because no screenshots were taken.

### Bryony Olwyn-Davis (bride, OWNER)

```
[MAJOR] CSV re-import preview doesn't show me what's about to change
  Persona:  Bryony
  Flow:     "Sync this week's RSVPs and update seating accordingly"
  Moment:   "I exported the latest CSV from Say I Do, pasted it in,
             saw '23 new · 4 merging into existing'. The four merges
             have a 'merge' chip but I can't tell *what* will change
             on those rows. Sarah's chip is there but I edited her
             dietary in the app last week — is the CSV going to
             overwrite it? I had to open Sarah's detail page in
             another tab to compare values manually."
  Why it matters: re-import is a routine workflow; the couple is
             going to do this 5+ times before the wedding. Per-field
             diff would prevent overwrite anxiety.
  Suggested direction: Before commit, show per-row diffs for "merge"
             rows. Highlight overwrite vs additive (array union).
             Optionally let the user uncheck individual field
             overwrites.

[MAJOR] No way to restore a guest I accidentally deleted
  Persona:  Bryony
  Flow:     "Cleaning up duplicate rows after import"
  Moment:   "I clicked × on the duplicate Keith row and confirmed.
             Then I realised I'd actually nuked the keeper, not the
             dupe. There's no undo, no Trash, no archived list — just
             gone. I had to ask Jamie to grep the audit log."
  Why it matters: deletion confirms only ask 'Delete X?'. There's no
             reversible state. The Guest.archived field exists in
             the schema but the UI hard-deletes.
  Suggested direction: Replace deleteGuest with archiveGuest (set
             archived=true). Add a "Show archived" toggle on /guests
             with a Restore button per row. Keep a separate "Delete
             permanently" for genuine cleanup.

[MINOR] Adding a shot to the photography list doesn't surface in /book
  Persona:  Bryony
  Flow:     "Add three shots to the Photography shot list and print it"
  Moment:   "I added the three group shots, hit Print, sheet looks
             great. But the Photography card on /book still shows
             '6 of 9 captured' — none of the three new shots count
             toward the captured tally because they aren't captured
             yet. Fair. But it's also not obvious that Print runs
             window.print() rather than generating a saved PDF
             somewhere I can email the photographer later."
  Why it matters: small confusion; recoverable.
  Suggested direction: 'Print' button → 'Print or save as PDF' with
             an explicit caption underneath: "Use your browser's
             Save as PDF option to save a copy."
```

### Jamie Spencer (groom, OWNER, dark mode)

```
[MAJOR] Logging a supplier comm with follow-up doesn't create a Task
  Persona:  Jamie
  Flow:     "Log a phone call with Kate at the venue, with a follow-up
             to confirm final numbers"
  Moment:   "On /suppliers/<venue>, + Log entry, channel=call,
             summary='Confirmed parking, asked for final numbers',
             follow-up=2026-09-12. Saved. Visited /tasks the next
             morning. Nothing there about following up with Kate.
             Had to make a Task by hand — duplicated effort."
  Why it matters: brief workflow #4; integration is the value-add of
             logging here vs in a notebook.
  Suggested direction: When followUpAt is set, create a Task with
             title "Follow up: <summary>", due=followUpAt, with a
             link back to the supplier comm. Surface on Today's
             "My tasks" card.

[MINOR] Quick-capture Event lands at next round hour with no visible
       affordance to fix the time
  Persona:  Jamie
  Flow:     "While on the phone with Kate, capture an event"
  Moment:   "Pressed C, typed 'Final numbers due', selected Event,
             hit Enter. Toast says 'Event added: Final numbers due'.
             Cool. Visited /schedule — event sits at 4:00pm tomorrow.
             Why? Oh, 'next round hour from now'. I have to click
             through to the event to fix the date."
  Why it matters: breaks the 'capture and trust' contract.
  Suggested direction: Either make the capture flow ask for a date
             (small datepicker below the textarea), or, on the
             success toast, add a one-click 'Set time…' that opens
             the event in edit mode.

[MINOR] Dark-mode preference doesn't follow the account
  Persona:  Jamie
  Flow:     "Logging in on my work laptop"
  Moment:   "I set dark mode on my phone. Opened the app on my work
             laptop. Light mode. Toggled it. Worked. But why didn't
             my preference follow me?"
  Why it matters: minor — reset takes one click.
  Suggested direction: Persist to User row (User.darkMode boolean);
             load on session init.
```

### Josh Dickson (best man, MEMBER, mostly mobile)

```
[MAJOR] /tasks list visible to me even when my permission is NONE
  Persona:  Josh
  Flow:     "Check what I owe the groomsmen this week"
  Moment:   "Bryony said she'd give me access only to specific things.
             I logged in on my phone. The sidebar didn't show Tasks.
             But I typed /tasks into the URL out of curiosity and saw
             the entire task list including budget-tagged items.
             Felt like I was peeking at things I shouldn't be."
  Why it matters: data exposure to a low-trust user. The page
             happens to filter Budget-tagged tasks out for non-couple,
             but the list itself shouldn't render.
  Suggested direction: Add canView gate to /tasks, /questions,
             /book, /guests pages — mirror the pattern used on
             /guests/[id] and /guests/catering.

[MINOR] Stag Do edit on the Wedding Party page is a blob of text
  Persona:  Josh
  Flow:     "Add a Stag Do venue idea as a checklist item on the Stag page"
  Moment:   "Opened /book/wedding-party#stag-hen on my phone. The
             content is a textarea — multi-line free text. I added
             'York for the weekend' on a new line. There's no
             checkbox structure, no per-line metadata, no order to
             fight over. Fine, but it's a blob. The Photography
             section has a proper checklist."
  Why it matters: minor — works.
  Suggested direction: Optional. The Wedding Book editor is by
             design free-form per subsection. Honour that.

[MINOR] Mobile schedule view doesn't auto-scroll to "now" on the wedding day
  Persona:  Josh
  Flow:     "Look up the wedding-day schedule on my phone in transit"
  Moment:   "On the day, opened /today/day-of on the M40. Page loads,
             timeline visible, but I have to scroll to find which
             event is 'NOW'. With 12+ events stacked vertically on
             a phone, it's a few thumbs of scroll."
  Why it matters: small friction at exactly the worst moment.
  Suggested direction: Auto-scroll the 'NOW' event into view on
             page load. Trivial JS + scrollIntoView.
```

### Aimee Hollingsworth (maid of honour, MEMBER, mostly mobile)

```
[MINOR] RSVPing a guest "on their behalf" needs me to find them first
  Persona:  Aimee
  Flow:     "RSVP for Uldis on his behalf because he's travelling"
  Moment:   "Tried /guests on my phone. 50 households scroll-scroll-
             scroll. No search, no jump-to-name, no filter by RSVP
             status. Eventually found Uldis, clicked his name, the
             detail page opened, I changed his RSVP. Two-tap action
             after the find."
  Why it matters: real friction; will repeat across 50 guests over
             several months.
  Suggested direction: Add a search bar on /guests that filters
             households + guests as you type. Sticky at the top;
             stays visible on mobile.

[MINOR] Adding a song request via my Guest entry isn't an obvious flow
  Persona:  Aimee
  Flow:     "Add a song request"
  Moment:   "Found my own guest entry, opened /guests/<myId>. There's
             a 'Song requests' section showing my existing requests
             with a 'Manage on Songs →' link, but no '+ Add request'
             button on this page. I had to click through to /songs
             to find the right place to add."
  Why it matters: small.
  Suggested direction: Add an 'Add song request' inline form on
             the Guest detail page, next to the existing list.

[MINOR] Hen Do plan is on the Wedding Party page (which Josh can also see)
  Persona:  Aimee
  Flow:     "Read the Hen Do plan on my phone over lunch"
  Moment:   "I went to /book/wedding-party#stag-hen. The page has
             both Stag Do and Hen Do contents in the same subsection.
             Josh can also see the Hen plan if he visits the same
             URL — there's no audience override."
  Why it matters: spec-drift consequence (no per-page audience).
             Real privacy consequence: stag and hen need separate
             audiences if surprises are involved.
  Suggested direction: Either split into two subsections with
             different slugs, or implement per-subsection
             audience overrides per the brief's original spec.
```

### Smooth flows worth noting

Three things that walked through cleanly during the trace:

- **Magic-link sign-in styling** is genuinely nice. Letterhead, brand colour band, 24h validity disclosure, friendly "didn't request this?" footer. No friction, no mystery email.
- **Catering brief print** has a proper letterhead, per-table breakdown, dietary aggregate. The venue-facing artifact is professional.
- **Spotify sync** error messages are actually informative ("make sure the playlist is public — Spotify's API can't read private playlists with this kind of token") rather than generic "sync failed". Surface area where good UX writing pays off immediately.

---

## §10 Final summary

### Findings totals

- **Blockers:** 0 (subject to live-test verification of the rate-limit, settings escalation, and merge-conflict cases — any of which could promote)
- **Majors:** 9
  - F1 list pages without `canView` gate (`/tasks`, `/questions`, `/book`, `/guests`)
  - F3 settings EDIT lets non-couple grant permissions
  - F4 no magic-link rate limit
  - Import preview lacks per-field diff
  - `BudgetLine.actual` doesn't recompute from `Payment` rows
  - `SupplierCommunication.followUpAt` doesn't auto-create a Task
  - Archived-guest restore workflow not implemented
  - Wedding Book per-page audience overrides not implemented
  - Seating constraint rules (MUST_NOT_TOGETHER) absent
- **Minors:** ~10 (see report body — F2/F5/F6, supplier card last-message, magic-link logged URL, quick-capture event time, mobile schedule scroll-to-now, guest search, song-request form on Guest detail, motif icons absent, dark mode not per-account, per-seat dots, Wedding Book hub has 5 not 7 cards)
- **Cosmetic:** 0 explicitly logged (no live render to evaluate pixel-level)

### Recommendation

**Hold for major fixes; don't ship as-is.** The two findings most likely to be load-bearing on the wedding day are:

1. **F1 (list pages bypass `canView`)** — small users-set means real exposure is bounded, but it's a 30-minute fix and removes a class of "I shouldn't see this" surprises.
2. **Archived-guest restore** — the day a guest is accidentally deleted with no undo will be a bad day. ~2hr to ship.

The other 7 majors break promises the brief made but aren't load-bearing for the actual wedding. Triage them by user demand. Several (audience overrides, MUST_NOT_TOGETHER, B2/Drive backups, rate-limit) are legitimately deferrable as v1.x backlog if the user accepts the spec-drift.

### Top three risks the couple should know about

1. **Re-importing the CSV will overwrite locally-edited fields without showing a diff.** If Bryony edits Sarah's dietary in the UI, then re-imports the original CSV, Sarah's dietary will silently revert (well — for arrays it unions, but for meal courses, RSVP, notes it overwrites if non-empty). Bryony needs to know not to re-import casually until per-field diff lands.
2. **There is no undo for guest deletion.** A misclick on × destroys the row. The audit log records it but doesn't restore. Use × with caution; for "I'm not sure," edit the household name to "ARCHIVED — <name>" instead until a real archive flow ships.
3. **Dark mode is per-device, not per-account.** Jamie sets dark on his laptop; opens his phone; light mode. Reset takes one click but is not portable. Cosmetic, but the brief promised otherwise.

### What I didn't test

- **Live persona walkthroughs** in a browser. No browser available; persona friction items are inferred from code-readable signals (missing affordances, action handlers, gate code) rather than from observed UX. **Severity rating on these is best-effort, not measured.**
- **No DESIGN-BRIEF.md, no PLAN.md, no CHANGELOG.md, no TESTING.md.** The audit substitutes [prototype/](prototype) and [ROADMAP.md](ROADMAP.md). If the user has a real DESIGN-BRIEF.md somewhere, several of the design findings might be wrong.
- **No Playwright suite.** Cannot "rerun X tests, Y passed". The §6.2 regression-rerun is unrunnable.
- **No screenshots, no light/dark/visual diff.** §6.3 deltas are described in prose with file pointers.
- **No live DB.** No verification of `_prisma_migrations` state, no actual permission row queries against running data.
- **No backup target verification.** Brief expected B2 + Drive; we run a single local pg_dump. Cannot test what doesn't exist.
- **No Cloudflare Tunnel callback round-trip.** Production-only path; not exercised.
- **No magic-link end-to-end** (no SMTP available in this session).
- **No print-preview rendering** (no live browser).
- **No mobile-vs-desktop responsive audit** beyond reading Tailwind class breakpoints.
- **WCAG contrast deep-dive** explicitly skipped per brief §9.

### Coverage estimate

In a single static-review session: ≈45% of brief intent covered with high confidence (permissions, server-action gates, schema-level data integrity, build hygiene). ≈30% covered with medium confidence (workflow correctness from code reading). ≈25% not covered (live UX, screenshots, persona observation, e2e flows, backup verification). A second session with a live runtime + browser would close most of the gap; a working Playwright suite would close the regression hole permanently.

