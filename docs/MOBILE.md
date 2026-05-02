# Mobile compatibility conventions

**Status:** v1.66.0 (DR-1). Last updated 2 May 2026.

This document codifies the mobile-rendering rules for Wedding Hub. The codebase pivots between mobile and desktop at **640px** (Tailwind's `sm:`) — Sidebar hidden below, MobileTabBar hidden above. Both pivot at the same breakpoint to avoid the dual-nav window pre-v1.19.0 had.

DR-1 (the v1.66.0 sweep) audited every page for the patterns below and fixed the worst offenders. New code should follow these conventions; future audits should re-check the same points.

---

## Layout chrome

### Page padding
- **Use `p-4 sm:p-6`** on the inner content wrapper — 16px on mobile (more breathing room when the viewport is 320-414px wide), 24px on desktop.
- Don't use bare `p-6` on a page-level wrapper; it eats too much horizontal space on phones.
- The page-level scroll container (the one with `overflow-auto`) is fine without padding — put padding on the inner `max-w-…mx-auto` div.

### Stacking the AppShell
- `<AppShell>` mounts `<Sidebar>` (desktop), `<MobileTabBar>` (mobile, h-14 / 56px), `<QuickCapture>`, `<Toaster>`, and `<ConfirmProvider>` once.
- `main` gets `padding-bottom: 56px` on mobile via the global `@media (max-width: 639px)` rule so page content clears the tabbar.
- Anything else fixed-bottom on mobile must clear the tabbar — see below.

---

## Fixed-bottom elements

The MobileTabBar is at `z-[200]` and `h-14`. Anything that lives in the bottom 56px of the viewport on mobile must either:

- **Sit above the tabbar.** Use `bottom-20 sm:bottom-X` for the desktop value. The +56-to-80 difference clears the tabbar with breathing room.
- **OR be at a higher z-index.** Use `z-[250]` or above.
- **OR be styled with `pb-20 sm:pb-4`** if it's a wrapper meant to overlap the tabbar (Toaster does this — pinned bottom-right with extra padding-bottom on mobile).

Examples:
- `<Toaster>` — `z-[250]`, `pb-20 sm:pb-4` (v1.66.0 fix; pre-fix sat behind the tabbar at z-100).
- `<QuickCapture>` success toast — `bottom-20 sm:bottom-6` (v1.66.0 fix).
- `<ConfirmDialog>` — `z-[500]`, full-viewport backdrop, modal renders centred. No tabbar interference.
- `<TaskDrawer>` — `z-[401]`, `fixed inset-0 right-0`, full-screen on mobile. Covers the tabbar; desktop slides in from the right at `w-[420px]`.

---

## Touch targets

Apple HIG / Material both recommend **44px minimum**. Wedding Hub leans denser for keyboard / mouse usage; mobile-critical interactions get bumped to at least **40px**.

- **Destructive confirm buttons** (`<ConfirmDialog>`): `text-sm py-2.5 min-h-[40px]`. Bumped in v1.66.0 — pre-fix were 28px (`text-xs py-1.5`).
- **Modal × close button** (`<AddNewModal>`): 36px (`w-9 h-9`). Bumped in v1.66.0.
- **Image gallery detach ×** (`<ImageGallery>`): 32px. Always-visible on touch (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`); below the 44px ideal but on a 132px+ thumbnail with forgiving margin.
- **Mobile tab bar items**: `flex-1` × `h-14` (56px tall). Generous on purpose — these are the primary nav.
- **Phone-call links** (`/today/day-of`): `gap-2.5 py-2.5` (~44px row height). `tel:` href triggers the OS dialler.

The default `<Button>` component (`size="md"` ~32px) is below the threshold but is shared with desktop visual density. The design pass (Phase B) is the right place to address this systematically — until then, mobile-critical sites use inline classes that override the default.

---

## Tables

Every `<table>` must be wrapped in a horizontal-scroll container OR have a sane mobile fallback. The convention:

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm min-w-[560px]">
    {/* rows */}
  </table>
</div>
```

`min-w` on the table forces it to stay readable rather than collapsing into squished columns; the wrapper handles the overflow with native horizontal scrolling.

DR-1 fixed three tables that lacked the wrapper: `BookBuildCard` materials, `guests/catering` per-table breakdown + dietary + meal-choice tables.

Tables that summarise data with 2-4 short columns (`AuditLogPanel`, `BudgetClient` summary tiles) don't need `min-w` — they fit narrow viewports natively.

---

## Drag-drop / canvas surfaces

The seating canvas (`<SeatingCanvas>`) is an SVG-based drag-drop interface. **It's unusable on touch devices** — the drag conflicts with page scroll, the layout is too dense for a 360px viewport, and there's no pinch-zoom built in.

DR-1 fix: `SeatingClient` defaults to **list view** on first visit when `window.innerWidth < 640`. The user's saved-view preference still wins (so they can opt back into canvas if they really want), but the first-visit default is now sane.

Future drag-drop surfaces should follow the same pattern: provide a list / table fallback and auto-default to it on mobile.

---

## Modals + drawers

- **AddNewModal** (`<AddNewModal>`) — `max-w-[480/560/680px]`, `w-full`, `px-4 my-8` outer padding. Adapts naturally to mobile (full-width within the 16px gutter). `pt-6 sm:pt-0` anchors to the top on mobile (ensures the modal is visible above the virtual keyboard).
- **ConfirmDialog** (`<ConfirmDialog>`) — same shape, `max-w-[460px]`. Buttons bumped for touch in v1.66.0.
- **TaskDrawer** — `w-full sm:w-[420px]`, `fixed right-0 top-0 bottom-0`. Full-screen on mobile (covers the tabbar), 420px slide-in on desktop.
- **MobileTabBar "More" sheet** — bottom sheet, `max-h-[70vh] overflow-auto`, drag-handle hint at the top (decorative).

---

## Page-specific notes

### `/today/day-of`
The wedding-day primary surface. Hero band sticks to the top on mobile (`sticky top-0 sm:static`) so the venue + date are always visible. Phone contacts use `tel:` links with 44px row height. Single-column layout on mobile; 3-column grid on `lg:`.

### `/seating`
List view default on mobile (DR-1). Canvas remains for desktop. The view toggle stays visible on every viewport so the user can flip back.

### `/seating/ceremony`
Currently desktop-friendly only — the auto-fill canvas + group-colour rendering is dense. v1.66.0+ ships a lighter mobile read view. Day-of mobile usage is unlikely (it's a planning surface), so this is acceptable for now.

### `/budget`, `/payments`
Tables wrapped in `overflow-x-auto` already. Summary tiles use `flex-wrap` so they reflow on narrow viewports.

### `/book/[slug]` cards
Card editors all use Pattern D (single-draft state, edit ↔ view). Each editor's render adapts naturally — fields stack on narrow viewports. The new `<ImageGallery>` (v1.63.0) uses a 2 / 3 / 4-column responsive grid with thumbnails sized for the viewport.

### `/tasks`
`TaskList` table-header row hidden below `sm:` (`hidden sm:flex`). Per-row layout adapts (priority pill, due date, title stack vertically on mobile). TaskDrawer goes full-screen on mobile.

### `/guests/catering`
Most table-heavy page. DR-1 wrapped all four tables in `overflow-x-auto`; the per-table breakdown gets `min-w-[640px]` so its 6 columns stay readable.

---

## Open items (post-v1.66.0)

- **Day-of mode rehearsal** (DR-3) — book a real walk-through on a real phone with real data. Find friction the audit didn't.
- **Print stylesheets review** (DR-4) — verify catering brief, run-of-day, etc. still print cleanly after the mobile padding changes.
- **Default Button touch-target sweep** — the design pass will likely re-skin Button anyway; defer until then unless real-conditions testing surfaces specific pain.
- **Landscape / iOS-Safari quirks** — virtual keyboard pushing modals, bottom-bar autohide, pull-to-refresh on overscroll. Test in real conditions.

---

End of mobile conventions.
