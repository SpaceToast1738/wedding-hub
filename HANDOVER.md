# Handover — Wedding Hub

A snapshot for whoever picks this up next. Pairs with [CLAUDE.md](CLAUDE.md) (durable conventions) and [ROADMAP.md](ROADMAP.md) (full changelog).

## Where we are right now

- **Latest version:** v1.72.3 (on `dev`)
- **Production:** running v1.59.0 (`claude/main`), promoted 1 May 2026 — `dev` is many releases ahead and ready to be cut over once GHA goes green
- **Branch state:** `dev` is **13 commits ahead** of `claude/main`. No local uncommitted work.
- **Standing rule:** never tag a SHA that hasn't gone green on GHA. Push to `dev` → wait for green → fast-forward `claude/main` → only then tag.

## What's recently shipped

These are the changes from this session, newest first. Worth understanding before touching the affected areas.

| Version | Touch | One-line |
|---|---|---|
| **v1.72.3** | `/guests` polish | Drop the table-wrapper border so rows sit flush like `/tasks` |
| **v1.72.2** | `/guests` polish | Always render the household subheader — solo-household guests no longer look nested under the previous household |
| **v1.72.1** | `/guests` polish | Drop `max-w-7xl`; reshape `PageLinkedTasksStrip` into a flush full-width banner (was a centered floating card) |
| **v1.72.0** | `/guests` redesign | **Big visual change.** Replaced the `HouseholdBlock` card list with a flat table matching `prototype/GuestsPage.jsx`. `HouseholdBlock.tsx` deleted. |
| **v1.71.0** | Tasks + Book | `+ Task` button on every linked-tasks panel (section, card, page strips); inline OPEN↔DONE checkboxes; optional `website` URL on Outfit / Build / Bar / Setup item rows |
| **v1.70.0** | Seating | Ceremony deduplication + household clustering; reception seat drag-swap |
| **v1.69.0** | Auth | **DB-backed invite system replaces the `AUTH_ALLOWED_EMAILS` env CSV.** Settings page has Send / Resend / Revoke. CLAUDE.md still mentions the env path in places — superseded. |

## Things to watch out for

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
