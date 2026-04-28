# Wedding Hub — v1 Acceptance Audit

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
