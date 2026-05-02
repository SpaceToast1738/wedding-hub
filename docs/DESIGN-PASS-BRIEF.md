# Wedding Hub design pass — brief

**Status:** v1.68.0. Last updated 2 May 2026.
**Target release:** v2.0.0.

This document is the entry point for the Claude design pass. It states the goal, the constraints, the materials, the pages, and what's out of scope. Everything else is reference — the three sibling docs (`COMPONENT-INVENTORY.md`, `FORM-PATTERNS.md`, `MOBILE.md`) carry the implementation specifics.

---

## Who's using this app

Wedding Hub is built for **one wedding**: Bryony Olwyn-Davis & Jamie Spencer, 26 September 2026, Alveston Manor (Stratford-upon-Avon, UK). Five admin users:

- **Couple-tier** (full edit on everything): Bryony + Jamie.
- **Wedding party**: Joshua Dickson (best man), Aimee Hollingsworth (maid of honour) — see most things, not budget / payments.
- **Planner**: Bespoke Weddings — like wedding party but with `PLANNER` role.

Standing rule (CLAUDE.md): **admin-only**. No guest-facing surfaces. Wedding guests' RSVP / song requests come in via Say I Do; this app is for the admin team to organise around that data. The design pass should not introduce any public / guest-facing pattern.

---

## What "v2.0" means here

The user picked **(1) visual refresh** + **(3) day-of readiness** as the two arcs leading to wedding day. v2.0 is specifically the **visual refresh** ship.

### The two themes

User direction (2 May 2026): **two complete themes**, each with light + dark modes. **Four combinations total.**

#### Theme 1 — Base
The current moss/marigold/canvas palette polished. Soft, warm, paper-and-ink. Calm chrome that gets out of the way for planning work. Think editorial — Fraunces for display, Inter for body, restrained ornament. Suits intensive admin sessions: budget tables, settings panels, audit logs. **The "default and most days" theme.**

#### Theme 2 — Whimsical Forest
The wedding-day mood. Deeper greens, mossy browns, soft golds, perhaps a hint of mushroom pink or fern. Hand-drawn / woodcut illustration personality where ornament happens (page headers, empty states, hub cards, day-of mode hero). Display type leans into Fraunces' more characterful weights; body type can stay Inter or shift to something with slightly more warmth. Think *forest fable, garden ceremony, candle-lit dinner under fairy lights* — whimsical not gothic, fairy-tale not horror, English country wedding more than enchanted-forest theme park. **The "wedding day and all the magical bits" theme.**

The two themes share the same component contracts (Button, Input, Modal, Drawer, etc.); they reskin via tokens + illustration. A user toggling between themes shouldn't see UI break — they should feel like they're walking from a study into a glade.

### Theme architecture (recommended)

The simplest mechanism that supports 2 themes × 2 modes = 4 combinations:

```css
:root,
[data-theme="base"] { --color-canvas: ...; /* base light */ }

html.dark,
html.dark [data-theme="base"] { --color-canvas: ...; /* base dark */ }

[data-theme="forest"] { --color-canvas: ...; /* forest light */ }

html.dark [data-theme="forest"] { --color-canvas: ...; /* forest dark */ }
```

The existing `html.dark` mechanism stays. A new `data-theme` attribute on `<html>` (set by an inline script in `<head>` similar to `DarkModeScript`) chooses the theme. Default is `base`.

The user-facing toggle lives in Settings — same panel as the existing dark-mode toggle. Persisted via the existing `User.darkMode` pattern: add a `User.theme` enum column (`BASE | FOREST`), default `BASE`. Users keep their preference across devices via the auth session.

Day-of mode (`/today/day-of`) is the natural exception — the hero band can opt into the Forest theme even when the user has Base selected, because it's the "magical bit" surface. This is a one-page override decision the designer should make explicitly.

### Other goals

- **Mobile-first refinement.** v1.66.0 (DR-1) shipped a code-review-driven mobile pass. The design pass should refine it visually — bigger touch targets where it makes sense, better hierarchy at narrow widths, day-of-mode optimisation. Both themes need to work at 320px.
- **Density review.** The app skews dense (text-xs, text-[10px] tracking-wider section labels everywhere). Base can stay dense for the planning work; Forest can relax — the wedding-day eye doesn't need 12 columns of metadata.
- **Print fidelity.** Printable surfaces (catering brief, seating plan, run-of-day, lodging guide) need to keep working in both themes. Print stylesheet pins to a clean black-on-white regardless of theme — don't let theme tokens leak into print colours.

### Non-goals

- **No feature changes.** The app is feature-complete for its purpose. The design pass redesigns the chrome of existing features; it doesn't add or remove any.
- **No API contract changes.** Server actions, audit metadata shapes — all stable. The design pass touches presentation only. The single schema addition allowed is the new `User.theme` enum column for the theme-picker preference.
- **No new component primitives** unless absolutely necessary. The existing inventory in `COMPONENT-INVENTORY.md` is what to reskin. If a new primitive feels needed, flag it explicitly rather than adding silently.
- **No pattern-unification refactors.** `FORM-PATTERNS.md` documents three legitimate form patterns (uncontrolled+action / controlled-per-field / single-draft-state). The pass reskins the inputs / chrome inside whichever pattern is in use; it doesn't unify them.
- **No public-facing surfaces.** See standing rule above.
- **No third theme.** Two is the deliverable; resist the urge to add a "minimal", "high-contrast", or "winter" variant. If a future need surfaces, pick one of the existing two as a base and add a v3.x theme — don't fragment.

---

## Materials available to the pass

| Document | Purpose |
|---|---|
| [`COMPONENT-INVENTORY.md`](./COMPONENT-INVENTORY.md) | Every reusable UI primitive, API surface, used-by table. **Required reading.** |
| [`FORM-PATTERNS.md`](./FORM-PATTERNS.md) | Three legitimate form patterns + decision tree. |
| [`MOBILE.md`](./MOBILE.md) | Breakpoint, touch-target, fixed-bottom-element, table conventions. |
| [`../ROADMAP.md`](../ROADMAP.md) | Full release history; the standing rules section captures every architectural constraint. |
| [`../CLAUDE.md`](../CLAUDE.md) | "What this app is" + "What it isn't." |

---

## Current design tokens

The pass should treat these as the starting point for the **Base theme**. Refining the palette / type scale is in-bounds. The Forest theme is a parallel set — different palette, possibly different type scale — sharing only the structural tokens (radius, shadow tiers, font-family fallback chain).

**Colours (light mode).**

| Token | Value | Purpose |
|---|---|---|
| `--color-canvas` | `#FBF9F4` | Page background — warm off-white. |
| `--color-surface` | `#FFFFFF` | Cards / modals. |
| `--color-muted` | `#F1ECE2` | Subtle fills (sidebar, code blocks). |
| `--color-border-soft` | `#E5DFD2` | Hairline borders. |
| `--color-border-strong` | `#C9C0AC` | Emphatic borders (avatar group rings, drag handles). |
| `--color-ink-primary` | `#2A2620` | Body text. |
| `--color-ink-secondary` | `#5C544A` | Subtle text. |
| `--color-ink-tertiary` | `#8A8175` | Metadata / muted labels. |
| `--color-moss-{50,100,300,500,700,900}` | Sage / forest scale | Primary accent. Used for affirmative actions, attending RSVP, group memberships, calm chrome. |
| `--color-marigold-{100,500,700}` | Mustard scale | Secondary accent. Used for warnings, pending RSVP, "now" pill on day-of. |
| `--color-success` / `--color-warning` / `--color-danger` / `--color-info` | Semantic | Standard pill colours. |

Dark mode mirrors all the above with darker surfaces + brighter inks. Defined in `globals.css` lines 46-78.

**Type.**
- `--font-ui: "Inter", system-ui, sans-serif` — body.
- `--font-display: "Fraunces", Georgia, serif` — page titles, hero numbers, empty-state titles, occasional accents.

Sizing leans dense: `text-xs` (12px) is the body default on cards; `text-sm` (14px) is the form-input default; `text-[10px]` uppercase tracking-wider is the section-label convention; `text-[11px]` is the metadata / chip convention.

**Radius.** `--radius-sm: 6px` (most things), `--radius-md: 10px` (modals), `--radius-lg: 14px` (avatars and large cards).

**Shadow.** Three tiers — `--shadow-sm` (cards), `--shadow-md` (popovers), `--shadow-lg` (modals).

---

## The 12 pages

Each is the redesign target. Brief per-page notes follow.

| Route | What it is | Density |
|---|---|---|
| `/` | Home / Today | Hero countdown card + activity feed + "Mine" task list + RSVP snapshot strip. **Most-visited surface.** |
| `/glance` | KPIs / read-only summary | Big numbers across four columns. Couple-tier only. |
| `/today/day-of` | Day-of mode | Live timeline + on-call contacts + dietary digest. **Wedding-day primary surface.** |
| `/tasks`, `/questions` | Task & question/decision lists | Filterable / sortable / groupable list with drawer for detail. |
| `/schedule` | Run-of-day timeline | Vertical event list with attendee breakdown. |
| `/suppliers`, `/suppliers/[id]` | Supplier directory + detail | Card grid + per-supplier contacts / contracts / log. |
| `/guests`, `/guests/[id]`, `/guests/catering`, `/guests/import` | Guests | Households + nested guest rows. Catering is a print-ready brief; import is a 3-step wizard. |
| `/songs` | Playlists | Bound to Spotify; mostly a list of curated tracks per playlist. |
| `/seating`, `/seating/ceremony` | Seating plans | Drag-drop SVG canvas + list view. Ceremony is a separate side-by-side rows layout. |
| `/budget` | Budget | Categories with line tables, summary tiles, progress bars. |
| `/payments` | Payments tracker | Single table; couple-only. |
| `/files` | File library | Upload dropzone + folder-grouped tile grid. |
| `/book`, `/book/[slug]` | Wedding Book | Hub of 12 illustrated section cards; each section is a stack of typed "card" editors (TEXT/FIELD/RECIPE/SHOT_LIST/OUTFIT/BUILD/MENU/BAR/SETUP/LEGAL/STAY/LODGING_GUIDE). |
| `/diy` | DIY overview | Cross-section view of every BUILD card across the Book. |
| `/settings` | Settings | Profile + wedding details + customisation + access & members + audit log. The longest single page. |

---

## Known pain points (input from the user)

- **Visual identity flat** — the current moss/marigold palette is pleasant but the app doesn't feel ceremonial. The user has explicitly asked for a **whimsical forest** direction as the second theme — leaning into ornament, illustration, character. The Base theme can stay editorial / restrained; the Forest theme is where personality lives. This is the central direction-setter for the pass.
- **Settings page busy** — even after the v1.44.0 SettingsSection grouping, it still reads as a long scroll. Permission management spans three panels (PermissionGroups, GuestGroups, MemberOverrides) — overlap blurs which is which. Both themes should help here, but it's primarily a hierarchy problem rather than a chrome problem.
- **Density skews high.** Lots of `text-[10px]` uppercase tracking-wider section labels, dense table rows. Couple-tier wants this on planning surfaces; day-of and read-only surfaces could relax. Forest theme is the natural place to relax density; Base can stay dense.
- **Empty-state inconsistency** — top-level pages get illustrated `<EmptyState>`; nested-section empties get terse italic text. The pass should validate this two-tier convention is right; Forest theme might want richer ornament on empty states.
- **Today page Snapshot strip** — refactored in v1.60.0 (P4) but still feels like a footer rather than an integrated dashboard tile.
- **Native browser confirms replaced** — v1.62.0 swept all 40 native `confirm()` calls into `<ConfirmDialog>`. Designer should treat this as one component to redesign, not 40.
- **Avatar / photo-first surfaces are new** — guest profile pictures landed in v1.67.0; they're a meaningful identity addition the pass should lean into where appropriate. Forest theme could lean further into avatar-first layouts (face on every guest row, larger avatars on guest detail page).
- **Illustrations** — the existing `Illustrations.tsx` SVGs are functional but generic. Forest theme is the natural place for richer woodcut / botanical illustration; Base can keep the existing minimal style.
- **Day-of-mode** — the wedding-day primary surface. Currently styled like every other page but for the moss-700 hero band. Forest theme is the natural fit for /today/day-of even if the user has Base selected for everything else (see "Theme architecture" above re: page-level overrides).

---

## Constraints + must-haves

### Accessibility floor
- WCAG AA contrast on body text against canvas / surface (current dark mode passes; light mode passes; the pass shouldn't regress).
- Focus rings visible on every interactive element.
- `prefers-reduced-motion: no-preference` gates all animations (existing `:target` flash on book cards already does this).
- 40px minimum touch targets on destructive confirms (already enforced in `ConfirmDialog`); design pass should hold the line on this for any net-new interactive element.

### Dark mode
- Every new colour added must have a dark-mode counterpart in `globals.css`.
- Test every redesigned page in dark mode before claiming done. Don't ship a token that only works in light.

### Print
- Existing print stylesheets in `globals.css` (lines 178+) handle catering brief, payments, budget. The pass shouldn't introduce visual elements that depend on colour to convey meaning (e.g. coloured chips with no text label).

### Tailwind v4
- All styling goes through Tailwind utility classes + `@theme` tokens. No raw CSS files except `globals.css` and per-page `@media print` rules.
- Tokens use `--color-*` / `--font-*` / `--radius-*` / `--shadow-*` prefixes. New tokens should follow the same convention.

---

## What "done" looks like

A v2.0.0 ship that:

1. Compiles green (typecheck + lint + 557+ tests + build).
2. **Both themes** (Base + Forest) render correctly across all 23 pages in **both modes** (light + dark) at 320px / 768px / 1280px viewports. That's 4 × 23 × 3 = 276 visual states. Spot-check at minimum: home, today/day-of, tasks, guests, budget, settings, every Wedding Book card kind, seating canvas + list views.
3. The 4 print stylesheets (catering brief, budget, payments, schedule day-of preview) still print cleanly. Print pins to clean black-on-white regardless of theme/mode.
4. The 11 reusable UI primitives in `COMPONENT-INVENTORY.md` have all been touched (or explicitly skipped with rationale).
5. **Theme picker** in Settings works: user selects Base or Forest; persists to `User.theme`; takes effect on next render. Sits next to the existing dark-mode toggle.
6. ROADMAP.md gains a v2.0.0 entry summarising the changes.
7. **One** schema addition allowed: `User.theme` enum (`BASE | FOREST`, default `BASE`). Migration is purely additive. No other server-action or schema changes.

---

## Practical handoff

### Running the dev server

```sh
cd C:\Users\Admin\Code\wedding-hub
npm install
npm run db:reset    # fresh DB with seed
npm run dev         # http://localhost:3000
```

Sign in via the dev-mode magic link printed to stdout.

### The gate

Before any commit:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

All four green; commit; push to `dev` (never to `claude/main` directly — promotion is a separate fast-forward + tag step).

### Branching

Day-to-day on `dev`. When the pass is complete, fast-forward `claude/main` and tag `v2.0.0`. The user runs `docker compose pull && docker compose up -d` on the Unraid host to deploy.

### What the user expects to do

- Review and approve major directional choices (palette tweaks, font swaps, hierarchy changes) before they ship across all 23 pages.
- Use the daily Claude bug-check session at 09:17 local for spot-checking.
- Real-conditions test on a real phone before declaring v2.0.0 done. The DR-1 mobile pass was code-review-driven; v2.0 is the right time for human testing.

---

## Out of scope (for v2.0; revisit post-wedding)

- Public RSVP form (would need guest-facing auth model — separate ship).
- Guest portal for song requests (same).
- Multi-tenant / multi-wedding support (this is one couple's tool).
- Internationalisation (UK English only; one wedding).
- Mobile native app (the PWA-shaped responsive web app is the deliverable).
- Major architectural rewrites (Tailwind v4 migration, RSC patterns, etc. — already at the bleeding edge where it matters).

---

## After the design pass

Once v2.0 ships, the v2.x arc continues with **Phase C — day-of readiness**:

- DR-2 backup + restore drill
- DR-3 day-of mode rehearsal on a real phone (~5 months pre-wedding)
- DR-4 print stylesheets review (after the design pass settles them)
- DR-5 offline mode / service worker (heavy — defer until clear it's needed)
- DR-6 wedding-day freeze procedure (document; not code)
- DR-7 DMARC follow-ups (operational)

These are sequenced backwards from 26 Sep 2026.

---

End of brief.
