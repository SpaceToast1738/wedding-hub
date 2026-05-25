# Handover — Wedding Hub

A snapshot for whoever picks this up next. Pairs with [CLAUDE.md](CLAUDE.md) (durable conventions) and [ROADMAP.md](ROADMAP.md) (full changelog).

## v2.0.0 — first deliberately breaking schema change (25 May 2026)

**LEGAL card kind dropped.** Two flags for whoever's resuming:

1. **The v2.0.0 migration is data-destructive.** `prisma/migrations/20260525000000_drop_legal_card_kind/migration.sql` runs `DELETE FROM "BookSubsection" WHERE kind = 'LEGAL'` before dropping the `BookLegalCard` + `BookLegalItem` tables. Historical content in the pre-seeded `legal-before` / `legal-day` / `legal-after` sections is gone. **Restoring a pre-v2 backup brings those rows back; re-running the migration cleans them up again.** Forward-fix only — don't try to round-trip schema state.
2. **The seed no longer creates a Legal section.** `seedLegalSections()` retired. Section ordering renumbered: accommodation → 8, post-wedding → 9 (was 11 / 12, with `legal-before/day/after` occupying 8/9/10).

The Today-dashboard "Legal deadlines" widget is also gone; only "Open decisions" remains in `TodayCrossModuleStrip`.

If a future couple wants a generic (non-UK-specific) "documents" / "compliance" tracker, that's a new feature, not a restoration. Don't reach for the v1.34.0 migration as a template — the schema-typing is fine but the audit / Today-widget integration was tightly coupled to UK semantics.

## Where we are right now

- **Latest version:** v2.0.0 (on `dev`, pending push)
- **Production / `claude/main`:** at v1.99.8 (promoted 18 May 2026 — fast-forwarded from v1.96.2 covering v1.96.3 → v1.99.8 in one batch). The v1.99.x series was the Book card design pass (shuffle/hide components, hero pinning, mosaic mode, T/Q/D chips, etc.).
- **Standing rule:** never tag a SHA that hasn't gone green on GHA. Push to `dev` → wait for green → fast-forward `claude/main` → only then tag.
- **Tag history quirk:** v1.96.3 → v1.99.7 shipped without immutable tags. Only v1.99.8 got tagged on `6def128`. Next tag will be v2.0.0.

## What's recently shipped

These are the changes from this session, newest first. Worth understanding before touching the affected areas.

| Version | Touch | One-line |
|---|---|---|
| **v1.75.0** | `/payments` overhaul | **Excel-style multi-row inline grid + receipt attach + link a payment to a BUILD material or outfit-item.** Linking a BUILD material auto-marks it `ordered: true` (side effect of `createPayment`). Schema: `Payment.fileIds`, `bookBuildMaterialId`, `bookOutfitId` (additive migration). |
| **v1.74.0** | `/payments` | Inline payment add (single row) + inline supplier-quick-create — superseded by v1.75.0's grid but `createSupplierQuick` action is still used. |
| **v1.73.0** | `/songs` redesign | Summary card grid + Spotify connection banner + runtime estimate in subtitle |
| **v1.72.3** | `/guests` polish | Drop the table-wrapper border so rows sit flush like `/tasks` |
| **v1.72.2** | `/guests` polish | Always render the household subheader — solo-household guests no longer look nested under the previous household |
| **v1.72.1** | `/guests` polish | Drop `max-w-7xl`; reshape `PageLinkedTasksStrip` into a flush full-width banner (was a centered floating card) |
| **v1.72.0** | `/guests` redesign | **Big visual change.** Replaced the `HouseholdBlock` card list with a flat table matching `prototype/GuestsPage.jsx`. `HouseholdBlock.tsx` deleted. |
| **v1.71.0** | Tasks + Book | `+ Task` button on every linked-tasks panel (section, card, page strips); inline OPEN↔DONE checkboxes; optional `website` URL on Outfit / Build / Bar / Setup item rows |
| **v1.70.0** | Seating | Ceremony deduplication + household clustering; reception seat drag-swap |
| **v1.69.0** | Auth | **DB-backed invite system replaces the `AUTH_ALLOWED_EMAILS` env CSV.** Settings page has Send / Resend / Revoke. CLAUDE.md still mentions the env path in places — superseded. |

## Things to watch out for

### v1.75.0 has a side-effect on BUILD materials

Creating a payment with `bookBuildMaterialId` set will **auto-flip that material's `ordered` flag to true** (only when it was previously false — preserves any pre-existing ordering history). This is intentional and matches the user's "log the receipt → mark it ordered" mental model. If a user accidentally links the wrong material, detaching the link does NOT un-set `ordered` — the user has to manually un-tick the material on the BUILD card. Audit log entry: `build-material-ordered-by-payment`.

### v1.75.0 receipt-on-create is partial

Queued File uploads (selected from device in the inline grid before pressing Enter) currently can't auto-attach because `createPayment` is a form-action returning `void` — we don't have the new payment id at that point. The grid surfaces a `notify("warn", …)` if any queued files were lost. **The user re-attaches via PaymentRow's edit-mode receipt panel.** Already-uploaded files (selected via "Pick existing") work fine — they go through as `fileIds` in FormData.

Cleanest fix when this becomes annoying: promote `createPayment` to return the new payment id, then use `uploadAndAttachReceipt` from the inline grid post-commit. Out of scope for v1.75.0 to keep the change scope contained.

### v1.72.0 dropped functionality on /guests

The old `HouseholdBlock` had inline editing, RSVP toggling, per-row group control, and a four-control filter bar (Sort / RSVP / Side / Show + "save as default"). All of that is **gone** from the list view. Edit now happens at `/guests/[id]`, and filtering is just tag pills + search.

If the heavy filter bar is missed, it can be added back as a popover — the data shape on the page didn't change, so the logic in the old `GuestList.tsx` is still valid (look at git history before v1.72.0 if you need to resurrect any of it).

### Auth conventions in CLAUDE.md are stale in places

CLAUDE.md still describes `AUTH_ALLOWED_EMAILS` as the way to admit users. As of v1.69.0, that's been replaced by an in-app invite flow on the Settings page (`createInvite` / `revokeInvite` / `resendInvite` server actions). The env var is now only the bootstrap fallback — once a real couple-tier user has signed in, the DB takes over. CLAUDE.md is being updated alongside this handover; if you spot lingering staleness, fix it.

### The prototype directory IS the design source-of-truth

`prototype/` contains JSX mockups (one per page) that are the visual target for the v2.0 design pass. When the user says "the design looks different," they mean a page diverges from its `prototype/<Page>.jsx` counterpart. Recent example: v1.72.0 was triggered by a screenshot of `prototype/GuestsPage.jsx` rendered in a browser, with the user noting the live `/guests` page didn't match.

There's an open `docs/DESIGN-PASS-BRIEF.md` describing the full design pass intent (two themes × two modes = four combinations, shipped as v2.0.0). The `/guests` redesign was a one-page early instalment, not the full pass.

### Linked-tasks strip shared across three pages

`PageLinkedTasksStrip` renders on `/songs`, `/seating/ceremony`, and `/guests`. v1.72.1 made it a flush full-width banner. If you tweak the styling, all three pages move together — verify all three before pushing.

### Item-card website field migration is additive

v1.71.0 added `website String?` to `BookOutfit`, `BookBuildMaterial`, `BookBarItem`, `BookSetupItem` via migration `20260510000000_website_on_items`. Pure addition, no data risk on prod migrate. (`BookLodgingItem` already had `website` from v1.36.0.)

## Pending / not started

Nothing in-flight from this session. Items the user has flagged but not started:

- **Header actions on `/guests` don't fully match the prototype.** Prototype has `↗ Catering sheet / ↻ Sync from Say I Do / Import CSV / + Add guest`. Current has `Catering brief / Import CSV / + Add household`. User explicitly said "what we have now is fine" — leave it unless they revisit.
- **Sync from Say I Do** — never built. If the prototype's button is ever wanted, there's no API integration scaffolded.
- **Full design pass (v2.0.0)** — the `/guests` page is the only page that's been brought up to prototype parity in this session. Everything else still uses pre-design-pass styling. See `docs/DESIGN-PASS-BRIEF.md`.

## Quickstart for the next session

1. **Pull `dev`**, check `git log` for any commits since the v1.72.3 SHA documented above.
2. **Read [ROADMAP.md](ROADMAP.md)**'s most recent entry for any context this handover doesn't cover.
3. If user asks "the X page looks different from the design," check `prototype/XPage.jsx` for the target.
4. If asked to bump production: confirm GHA is green on the latest `dev` SHA before fast-forwarding `claude/main`.

## Useful commands

```bash
# Type-check before committing
npx tsc --noEmit

# Production build (catches lint errors GHA would flag)
npm run build

# Full unit test suite
npm test

# Where production is running
ssh tower; cd /boot/config/plugins/compose.manager/projects/wedding-hub
```
