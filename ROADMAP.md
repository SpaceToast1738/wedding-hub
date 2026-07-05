# Wedding Hub — Roadmap

> **Living document.** Updated at the end of each meaningful iteration. The most recent entry is at the top of the [Changelog](#changelog).
>
> **Audience:** Jamie (and Claude resuming a session). The README is for users; this is for whoever's building it.

## Snapshot

- **Wedding date:** 26 September 2026
- **Production URL:** wedding.spencer-net.com (private)
- **Repo:** [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub) · `claude/main` (releases) + `dev` (work-in-progress)
- **Stack:** Next.js 15 · TypeScript · Tailwind v4 · Prisma · Postgres 16 · Auth.js v5 · Caddy · Docker Compose
- **Working tree:** `C:\Users\Admin\Code\wedding-hub` (local SSD). The old `\\TOWER\Jamie Spencer\Claude\wedding-hub` mirror is no longer in use — run `Remove-Item -Recurse -Force "\\TOWER\Jamie Spencer\Claude\wedding-hub"` from a fresh PowerShell to delete it.
- **Current state:** **🟢 LIVE** at https://wedding.spencer-net.com (`claude/main` at **v1.59.0**, promoted 1 May 2026 — jumped 32 releases from v1.27.2). `dev` is ahead. Standing rule: admin-only.

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| **A** | Bootable shell — auth, AppShell, Today page, stub pages, /api/health | ✅ Done |
| **B** | All 12 prototype pages ported with server actions, audit logs, permission gates | ✅ Done |
| **C** | Docker stack: Caddy + web + db + backup, hardening, Cloudflare Tunnel alt | ✅ Done |
| **D1** | Real file uploads — multipart action, /api/files/[id] download, MIME allowlist, 25 MB cap | ✅ Done |
| **D2** | Drag-and-drop seating canvas (SVG, pointer-event drag, grid snap, keyboard nudge, view toggle) | ✅ Done |
| **E** | CSV / TSV guest import — column inference, dry-run preview, household merge | ✅ Done |
| **F1** | Catering brief — totals, course breakdowns, dietary aggregate, per-table seating, print stylesheet | ✅ Done |
| **F2** | Photography shot list — checklist within the Wedding Book | ✅ Done |
| **G1** | Spotify playlist sync (read-only mirror) | ✅ Done |
| **G2** | Day-of mode, quick-capture (`C`) modal | ✅ Done |

## Releases

Quick scan of every tagged release. Most recent first; click any version to jump to the full Changelog entry below.

| Version | Date | Headline |
|---|---|---|
| **v2.0.0** | 2026-05-25 | [Drop the LEGAL card kind from the Wedding Book. User: "can we drop the legal stuff from the wedding book, not sure this is UK Centric." The v1.34.0 LEGAL kind was pre-seeded with UK-marriage-law content (Notice of Marriage, registrar contact, per-person marriage certificate pickup, name-change checklist) — not portable, not useful for a non-UK install. Full removal: data-destructive migration `20260525000000_drop_legal_card_kind` deletes every `BookSubsection` where kind='LEGAL' (cascade drops BookLegalCard + BookLegalItem rows), then DROPs the two tables, then recreates `BookSubsectionKind` enum without LEGAL via the rename-recreate-cast-drop pattern. Code surfaces stripped: BookLegalCard.tsx editor (684 lines), `saveLegalCard` / `attachFileToLegalItem` / `detachFileFromLegalItem` server actions, `legalRollups` helper + `LegalCardShape/LegalItemShape/LegalRollups` types + 7 unit tests, CardRouter LEGAL case + Sub.legalCard field + import, `/book/[slug]/page.tsx` include + wedding-date passthrough + `hasLegal` predicate, `/book/page.tsx` `legal-admin` SECTION_META entry + `📜 legal` glyph branch + `legal-admin` LEGACY_SLUGS entry, Today-dashboard `nextLegalDeadlines` helper + `LegalDeadlineCard/Hit` types + 6 unit tests + the `legalCardRows` page fetch + the `LegalWidget` render + the `legalHits` prop on `TodayCrossModuleStrip` (plus retired the `Pill` / `dayPill` helpers used only by that widget), `prisma/seed.ts` `seedLegalSections()` + 3 section entries (`legal-before` / `legal-day` / `legal-after`) + ~380 lines of pre-seeded content, `scripts/reset-book.ts` + `scripts/seed-samples-only.ts` imports + invocations + console-summary lines, 3 legal audit action handlers (legal-save / legal-file-attach / legal-file-detach) in `audit-format.ts` (historical audit rows fall through to the default render), `IllusLegal` SVG illustration + its `bookSceneFor` mapping. `parseISODate` helper (originally inside the LEGAL action block, also a saveStayCard caller) lifted to the top-level helper cluster so the StayCard date round-trip survives the removal. Major-version bump because the schema change is breaking — anyone restoring a pre-v2 backup will hit a migration mismatch unless they re-apply the migration sequence. From 586 → 573 tests; typecheck + build green.](#2026-05-25--v200--drop-legal-card-kind) |
| **v1.99.8** | 2026-05-18 | [Delete-section button surfaces in the Edit Details modal. User: "Cant delete 'People'". The `deleteBookSection` server action has shipped since v1.4.0 but never had a UI surface — the only way to remove a section was via Prisma Studio or a direct SQL DELETE. The v1.94.0 "Edit details" modal (rename + subtitle) seemed like the obvious mount point but originally only carried the rename UX. Now adds a "Delete section" ghost button in the modal footer (left side, danger tone) — confirms via `useConfirm` with the section title + body warning that all cards inside will be deleted too, then dispatches `deleteBookSection(id)` and `router.push('/book')` so the user lands on the overview before Next.js tries to re-render against a missing row. Footer layout is `[Delete section] (left) / [Cancel] [Save] (right)` — destructive action stays visually distant from the primary CTA, mirroring CardChrome + budget category modal conventions. No schema, no actions changed (the action already existed). 586 tests stay green.](#2026-05-18--v1998--delete-section-from-edit-details-modal) |
| **v1.99.7** | 2026-05-18 | [Position-based accent rotation on `/book` section cards so colours always alternate. User: "Colours on this page dont seem to alternate" (screenshot showed three same-colour cards in a row on the Wedding Book overview grid). Pre-fix the canonical 7 slugs had hand-picked accents from `SECTION_META`, and custom slugs went through `fallbackAccentFor(slug)` which hashed the slug → one of three accents. The hash function didn't know about neighbours, so adjacent cards routinely landed on the same colour (e.g. Clothing + Wedding-Party-People + Wedding-Party-Day-of all hashed to `bg-moss-100`). Fix: `accentFor(idx)` walks a fixed 3-element rotation `[bg-moss-100, bg-marigold-100, bg-moss-50]` by position. Guarantees no two horizontally-adjacent cards share a colour in any column count. Trade-off: re-ordering sections via the ▲/▼ buttons shifts colours — acceptable since the alternation property was the dominant visual concern. SECTION_META.accent values retire (still in the type so existing reads don't break) — accent now comes purely from position. Glyph + description still come from SECTION_META for canonical slugs, fall through to `fallbackGlyphFor` / `DEFAULT_META.description` for custom ones. 586 tests stay green.](#2026-05-18--v1997--position-based-accent-rotation) |
| **v1.99.6** | 2026-05-18 | [Hero image pinned to the top of every card, independent of the photos-component position. User: "The image header if applicable needs to render at the top of the page." Pre-fix the hero rendered INSIDE the ImageGallery component, which itself lived inside the "photos" entry of the v1.99.0 ReorderableCardBody registry — so wherever the user reordered "photos" to (e.g. below stats or notes), the hero went too. Fix: lifted the hero render OUT of ImageGallery into a new standalone `<GalleryHero />` exported component. Each editor now resolves the pinned file from `card.headerFileId` + `card.fileIds` and mounts `<GalleryHero />` via `CardChrome.mediaBlock` — that slot sits between the title row and the body children, anchoring the hero to the top regardless of body component order. ImageGallery still receives `headerFileId` (it's still used to dedupe the pinned image out of the body section + light up the ★ on the pinned thumb), but the `headerPosition` + `onHeaderPositionChange` props moved entirely to `<GalleryHero />`. GalleryHero is self-contained: its own lightbox state, its own 3×3 position dot grid, its own unpin ★ button. Swept all 6 ImageGallery-using kinds (TEXT, OUTFIT, DRESS_CODE, SETUP, BUILD, STAY); DRESS_CODE renders the hero inline in its bespoke `<article>` (no CardChrome to pass mediaBlock to). 586 tests stay green.](#2026-05-18--v1996--hero-pinned-to-top-of-card) |
| **v1.99.5** | 2026-05-18 | [Due date moves before status on Book linked-tasks rows. User: "Small addition in this pass, make the dates in the task appear before the status." Pre-fix both linked-tasks panels (`LinkedTasksPanel` at the section level + `CardLinkedTasksPanel` at the per-card level) rendered the row as `[T/Q/D chip] [title] [STATUS pill] [date] [Edit]`. The status pill sat in the middle so the eye had to skip past it to read the due date — but for the couple at a glance "when is this due" matters more than "is this open or done" (the row's other affordances already communicate status: line-through title on done, checkbox state). Swapped the render order to `[T/Q/D chip] [title] [date] [STATUS pill] [Edit]` — date reads first, status sits at the row's right edge as the trailing summary. Two-line change in each file. No schema, no actions, no test churn. 586 tests stay green.](#2026-05-18--v1995--date-before-status-on-linked-tasks) |
| **v1.99.4** | 2026-05-18 | [Photo gallery upgrade — header is additive, 9-point hero positioning, Pinterest mosaic mode, slideshow resize, 4-kind wiring sweep. User: "When an image is favourited, add a header by default, and allow me to position the image in the header, the header is in addition to a slideshow or gallery, can you also add a mosaic mode? With these edits in mind, can we also be able to resize the slideshow, sizes should be the same as the gallery options, think of any gaps and ux bugs you can foresee when your adding this, these options should apply to all cards." Five coordinated changes. **(1) Tied "favourite = header" model.** Clicking ★ on a thumb now both pins the image AND enables the hero — there's no separate "header" display mode to pick. Unpinning removes the hero. One state (headerFileId non-null), simpler mental model. **(2) Header is additive.** Pre-v1.99.4 `photoDisplay` was a 3-way exclusive enum `gallery | header | slideshow`; picking "header" hid the gallery/slideshow body entirely. Now the body is one of `gallery | slideshow | mosaic` AND the hero — when pinned — renders ABOVE it. Body excludes the pinned image to avoid double-rendering. Render-level guard handles the detach-while-pinned race (hero silently doesn't render if the pinned file isn't still attached). **(3) 9-point hero positioning.** New `BookSubsection.headerPosition String @default("center")` column (migration `20260518300000_book_photo_header_position_and_mosaic`, additive). Values: `tl|t|tr|l|c|r|bl|b|br`. Maps to CSS `object-position`. Edit-mode UI: a 3×3 dot grid overlaid bottom-right on the hero — marigold dot = active, click to reposition. New `setBookSubsectionHeaderPosition` server action (same v1.96.4 shape as -PhotoSize). **(4) Mosaic body mode (Pinterest masonry).** New value `"mosaic"` in `photoDisplay` allowlist. CSS `column-count` flows images at natural aspect ratio so heights stagger naturally. Column count scales with `photoSize` (xs:5 → sm:4 → md:3 → lg:2 → xl:1). One-shot layout shift on first paint (intrinsic dimensions not stored) is acknowledged — `loading="lazy"` + `break-inside-avoid` minimise jank. **(5) Slideshow resize.** Pre-fix the carousel was fixed `aspect-[16/9]`. Now height comes from `photoSize`: `xs:160px / sm:220px / md:300px / lg:400px / xl:520px`. The Size toggle now renders for gallery + slideshow + mosaic (was gallery-only). **Migration:** `photoDisplay='header'` rows flip to `'gallery'` — those rows had a pinned image anyway, so the hero still renders post-migration and the body just resolves to a thumb grid. Strictly more visible than the pre-migration state. **4-kind wiring sweep.** Per the v1.97.0 carryover, DRESS_CODE / SETUP / BUILD / STAY didn't thread `photoSize / photoDisplay / headerFileId / slideshowAuto` through to ImageGallery. v1.99.4 finishes that sweep — all 6 ImageGallery-using kinds (TEXT, OUTFIT, DRESS_CODE, SETUP, BUILD, STAY) now share the full prop surface + handler cluster. DRESS_CODE's split view/edit ImageGallery instances consolidated into one. 586 tests stay green.](#2026-05-18--v1994--photo-gallery-upgrade) |
| **v1.99.3** | 2026-05-18 | [WEDDING_PARTY card design upgrade — stats tiles + edit-mode gate + drop redundant group-label input. User: "Lets upgrade the wedding party cards, they dont need a title, they already have one, can we add the square blocks for the stats at the top like the other cards? anything editable should be hidden behind the edit screen." Three coordinated changes brought the WEDDING_PARTY card up to the v1.96.4 OUTFIT design pattern. **(1) Dropped the redundant `groupLabel` input.** Pre-fix every wedding party card carried a `<Input>` placeholder "e.g. Bridesmaids / Groomsmen / Flower girls" alongside CardChrome's inline-editable title (e.g. "Bridesmaids"). Two surfaces for the same identity. The input + the read-mode `<savedGroupLabel>` span are gone; the `saveHeader` is now just a notes saver. Column kept in the DB so historical values aren't destroyed — they're simply not surfaced. **(2) Stats tile row added at the top** matching OUTFIT's `<StatTile>` shape: Sorted (X/Y) · People (N) · Items (N). Pre-fix this info lived as a `text-[11px]` summary chip in the dropped header row. The tile-row registers as the `stats` component in the v1.99.0 layout registry, so couples can reorder it past Matrix or hide it via the existing ↑/↓/👁 chrome. **(3) View / Edit toggle replaces inline-save.** Pre-fix the matrix cells were dropdowns whenever canEdit; member/item rename/reorder/delete affordances + "+Add" buttons + notes textarea were all always-visible. Now everything editable hides until the user clicks Edit: view mode renders status pills (not dropdowns), static names (no ✎ ×▲▼), no add buttons, and a static notes paragraph (or "No notes." italic). Cells still save individually on change (no draft state — matches the pre-fix snappy feel), but the affordance only appears in edit mode. Notes uses a draft so Cancel reverts. The v1.99.1 `layoutEditing` toggle is gone — reorder/hide chrome rides on the new `editing` flag like every other kind. v1.96.4 `hideHousekeeping={editing}` keeps the footer focused on Cancel/Save. 586 tests stay green.](#2026-05-18--v1993--wedding-party-card-design-upgrade) |
| **v1.99.2** | 2026-05-18 | [Task / Question / Decision identifier chip on Book linked-tasks lists. User: "In the task list for each page, can we add an identifier for question task and decision?" Pre-fix the section-level `LinkedTasksPanel` and the per-card `CardLinkedTasksPanel` only showed the type identifier in **read-only** mode — when canEdit was true the row rendered an interactive checkbox in place of the type glyph, so editors lost the ability to tell tasks / questions / decisions apart at a glance. Now a small width-locked `<TaskTypeBadge>` chip renders alongside the checkbox in both modes: `T` (muted canvas — default, no signal) for TASK, `Q` (marigold — matches the "in-progress" tone the tasks panel uses for OPEN) for QUESTION, `D` (info-blue — distinct from the marigold) for DECISION. Width-locked to 22px so the title column aligns across rows of mixed types. Hover title carries the long label. Helper duplicated inline in both panels (rather than extracting to a shared module) — two callers + 30 lines of tone classes — indirection wouldn't pay back. No schema, no actions changed. 586 tests stay green.](#2026-05-18--v1992--task-question-decision-identifier-chip) |
| **v1.99.1** | 2026-05-18 | [SETUP + WEDDING_PARTY cards join the shuffle/hide UX. Two more editors migrate to `<ReorderableCardBody>`: BookSetupCard (default order `[photos, stats, items, notes]` — `items` `alwaysVisible`; stats render as the four tile grid in view mode and as the three header inputs in edit mode so the layout pattern works in both states) and BookWeddingPartyCard (default order `[matrix, notes]` — `matrix` `alwaysVisible` because a WEDDING_PARTY card without the matrix is empty chrome). WEDDING_PARTY uses inline-save throughout (no view/edit toggle), so the reorder chrome is gated by a new local `layoutEditing` state surfaced as a "↕ Layout" / "Done" button in the chrome's `actions` slot (housekeeping hides while layout-editing — same pattern v1.96.4 used to focus Cancel/Save). `componentOrder` + `hiddenComponents` threaded through CardRouter for both kinds. BookFieldsCard skipped — it has a single section (the field list) so there's nothing to reorder; will pick it up once it grows additional sections. Still queued for v1.99.2+: FIELD / RECIPE / BUILD / MENU / BAR / STAY / LODGING / LEGAL / DRESS_CODE / SHOT_LIST. 586 tests stay green.](#2026-05-18--v1991--setup--wedding_party-cards-on-the-shuffle-grid) |
| **v1.99.0** | 2026-05-18 | [Shuffle / hide card-body components — foundation + OUTFIT + TEXT. User: "Allow me to shuffle components of a page around" (originally from v1.98.x, plan-mode design pass landed v1.99.0). New schema columns on BookSubsection — `componentOrder TEXT[]` + `hiddenComponents TEXT[]` (migration `20260518200000_book_subsection_component_layout`, additive with empty-array defaults). Two new server actions `setBookSubsectionComponentOrder` / `setBookSubsectionComponentHidden` mirror the v1.96.4 photo-size pattern (gate + audit + revalidate + idempotent no-op + light validation: max 50 entries, ≤60 char IDs). New shared `<ReorderableCardBody>` widget — caller passes a list of `CardComponent { id, label, node, alwaysVisible? }` in default order; view-mode renders saved-or-default order filtering hidden components; edit-mode renders all with a small ↑/↓/👁 strip per section. `effectiveOrder()` helper appends newly-introduced default IDs to the end of any saved order — adding a section to a kind later "just works" for existing rows. `BookOutfitCard` migrated: components = `photos / stats / body` (photos lifts out of CardChrome.mediaBlock, stats lifts out of the inline mb-4 grid, body covers items + notes). `SubsectionEditor` (TEXT) migrated: components = `photos? / body` (photos optional when canEdit || fileIds.length > 0). `CardChrome.mediaBlock` slot **deprecated** — still in the type signature for backward compat but no editors pass it; will retire in a follow-up once all 14 editors migrate. **Out of scope:** the remaining 12 editors (FIELDS / RECIPE / BUILD / MENU / BAR / SETUP / STAY / LODGING / LEGAL / DRESS_CODE / SHOT_LIST / WEDDING_PARTY) still use their pre-v1.99 fixed body layout — mechanical follow-ups will migrate them one-by-one in v1.99.1+. Approved scope was "all 14 at once" but the per-kind sweep is voluminous (~30-50 lines per editor); shipping the foundation + 2 representative kinds now lets the user verify the pattern before the rest land. 586 tests stay green.](#2026-05-18--v1990--shuffle--hide-card-body-components) |
| **v1.98.1** | 2026-05-18 | [Fix save-after-photo-size-change + XS/XL sizes + header fade. User: "I cant save once an image has been changed size, can you also create a set size for the header and fade it into the note block? Allow me to shuffle components of a page around. Can you add an xs and xl size." Three fixes shipped (shuffle deferred — needs its own design pass). **(1) Bug fix — save-after-toggle.** v1.96.4 introduced `router.refresh()` after each photo-size action; v1.97.0 added the same for display/pin/auto. Pre-fix BookOutfitCard's `useEffect(() => setDraft(buildDraft(card)), [card])` triggered on every parent re-render (each render constructs a fresh `card` object literal in CardRouter, so the ref always changed). Result: any router.refresh during edit mode wiped the in-progress draft → Save read `dirty=false` → no-op. Fix: gate the effect on `if (!editing)` so the draft survives prop churn while edit-mode is open; the editing→false transition still re-syncs against fresh server state. Same latent pattern fixed preemptively across 7 other card editors (BookBarCard, BookBuildCard, BookLegalCard, BookLodgingCard, BookMenuCard, BookSetupCard, BookStayCard) so they don't hit the same bug when their photo-toggles get wired in v1.97.x follow-ups. **(2) XS + XL sizes.** Photo-size toggle goes from 3 buckets (S/M/L) to 5 (XS/S/M/L/XL). XS grid: 4-6-8 cols. XL grid: 1-2 cols. Server action's allowlist + the GallerySize union + CardRouter narrowing all updated to match. **(3) Header mode fade.** Pre-fix the hero used `aspect-[16/9]` which made height vary with card width; wide cards got tall heroes that pushed the body below the fold. Now fixed `h-[260px]`. New CSS-mask bottom-fade (`linear-gradient to bottom, black 75% → transparent 100%`) makes the image visually melt into the body content rather than ending in a hard rectangle edge. **(deferred) Shuffle components.** Reordering the major sections within a card (header / photos / stats / items / notes / linked tasks) needs a design pass — per-card vs per-kind, drag handles vs ↑/↓ buttons, persistence shape. Queuing for v1.99.0. 586 tests stay green.](#2026-05-18--v1981--save-fix--xsxl--header-fade) |
| **v1.98.0** | 2026-05-18 | [@-mention suppliers from any textarea. User: "allow me to tag a vendor by typing in any text box '@'". New shared `<MentionableTextarea>` component (drop-in replacement for `<textarea>`) listens for `@` at word-start, fetches the supplier list lazily on first trigger via a new `loadSuppliersForMention` server action, and pops a filtered dropdown. Arrow keys / Enter / Tab navigate + select; Esc / whitespace / click-outside dismiss. Selecting inserts `@SupplierName ` (with trailing space) at the cursor position. Storage is plain text — no DB migration; existing notes columns persist the string unchanged. Read-side display kept as-is for v1.98.0 (the `@SupplierName` text just sits there); a richer click-through render is a follow-up candidate. **Swept across 23 textareas** in 20 files: every Book card editor's notes field (BookOutfitCard item notes + card notes, BookBarCard, BookBuildCard, BookLegalCard, BookLodgingCard, BookMenuCard, BookRecipeCard, BookSetupCard, BookStayCard, BookWeddingPartyCard, AddSubsectionToggle body), TaskForm + TaskDrawer notes, AnswerForm, EventForm, GuestForm, AddHouseholdToggle, BudgetClient, PaymentForm, SupplierForm + SupplierDetailClient (communication log), SeatingPlanPanel + ceremony's CeremonyClient. CSV-import paste boxes (TaskImportClient / ImportClient) intentionally skipped — those aren't authoring surfaces. **Tiptap (TEXT card body)** — separate code path with its own mention extension; deferred to v1.98.1. Permission: any user with `canView("suppliers")` can mention. No schema migration. 586 tests stay green.](#2026-05-18--v1980--mention-suppliers-from-textareas) |
| **v1.97.0** | 2026-05-18 | [Book card design pass — photos to the top, three display modes, edit-only management, role chip inline. User: "I dont like the 'bride' chip being on its own row, only display size editing in its own screen. Move images to the top of the card, & only show image management in the edit screen, have options to make an image a header or gallery or slideshow. Lets think about the design of these cards." **(1) Three photo display modes.** New schema columns `photoDisplay TEXT NOT NULL DEFAULT 'gallery'`, `headerFileId TEXT`, `slideshowAuto BOOLEAN NOT NULL DEFAULT false` on BookSubsection (migration `20260518100000_book_photo_display_modes`). `<ImageGallery>` pivots from a single grid to a mode-router that picks one of three sub-renderers: `GalleryGrid` (v1.96.4 default, with S/M/L sizing + a ★ pin button per thumb to promote it to header), `HeaderHero` (16:9 hero image picked from `headerFileId`, placeholder + prompt when not pinned), `SlideshowCarousel` (one image at a time, prev/next + dot indicators + per-card Auto/Manual toggle). New `setBookSubsectionPhotoDisplay` / `setBookSubsectionHeaderFileId` / `setBookSubsectionSlideshowAuto` server actions mirror v1.96.4's `setBookSubsectionPhotoSize` (book-edit gate, audit metadata, idempotent no-op). Pin action validates the file is actually attached so a dangling hero is impossible. **(2) Edit-only management.** New `editMode` prop on `<ImageGallery>` is the single gate for every management affordance (S/M/L toggle, upload, attach picker, detach ×, display picker, ★ pin, Auto toggle). View-mode readers see only the photos. **(3) Photos move to top of card.** New `mediaBlock` slot on `CardChrome` renders between the title row and the body children. Per-kind editors lift their gallery into this slot. **(4) Role chip inline with title.** New `headerChips` slot on `CardChrome` renders alongside the kindBadge in the title row. OUTFIT's BRIDE/GROOM chip lifts here; the person+role sub-row deleted entirely (the v1.92.2 redundant-name suppression already hid it in the common case). **(5) SubsectionEditor migrated to CardChrome.** TEXT cards drop their bespoke `<article>` chrome / title input / footer in favour of CardChrome's. Title is now inline-editable on blur (parity with every other kind). Body save posts only `bodyHtml` (no more `title` clobber). Edit / Cancel / Save lift to `CardChrome.actions`. New `kindBadge="Notes"` surfaces. Wired on OUTFIT + TEXT (v1.97.0); other 5 ImageGallery-using kinds (DRESS_CODE / SETUP / BUILD / STAY / LODGING_GUIDE) inherit the gallery prop surface but their editors still need to thread the three new fields — mechanical follow-up. 586 tests stay green.](#2026-05-18--v1970--card-design-pass) |
| **v1.96.5** | 2026-05-18 | [Photo-size S/M/L toggle on TEXT cards. User: "I cant edit the ring image size" — flagged the v1.96.4 limitation where the gallery resize was wired only into BookOutfitCard. SubsectionEditor (the TEXT card path) reads `sub.photoSize` from `BookSubsection` (the v1.96.4 schema column) and passes it as `size` to `<ImageGallery>` along with an `onSizeChange` handler that calls `setBookSubsectionPhotoSize` + `router.refresh()`. Mirrors the v1.96.4 OUTFIT wiring exactly — same defensive `'md'` fallback for unexpected DB values, same v1.95.4 refresh pattern. `CardRouter` TEXT case threads `sub.photoSize` into the constructed `Sub` payload. No schema migration. Other 5 ImageGallery-using card kinds (DRESS_CODE / SETUP / BUILD / STAY / LODGING_GUIDE) still inherit the default `'md'` until each editor is migrated — mechanical follow-up. 586 tests stay green.](#2026-05-18--v1965--text-card-photo-size-toggle) |
| **v1.96.4** | 2026-05-18 | [OUTFIT card layout polish — resizable photos + stats tiles + single action row. User: "Can we make the photo display size customisable. Some of the spacing seems like it can be tightened up, the edit button doesnt need a row to itself. 0 of 2 sorted and the item prices could be spread out too, maybe have a box of their own?" Three coordinated UX fixes. **(1) Per-card photo size.** New schema column `BookSubsection.photoSize String @default("md")` (migration `20260518000000_book_subsection_photo_size`, additive). `<ImageGallery>` gains `size: "sm" \| "md" \| "lg"` + `onSizeChange` props; grid columns scale (`grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5` for sm → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3` for lg). S/M/L toggle pill row renders above the thumb grid when `canEdit && onSizeChange`. New `setBookSubsectionPhotoSize(id, size)` server action — same access tier + audit shape as v1.95.0's `setBookSubsectionWide`. **(2) Edit lifted to chrome footer.** `CardChrome` gains an `actions?: ReactNode` slot + `hideHousekeeping?: boolean`. `BookOutfitCard` drops its own inline Edit-row div and passes `actions={editing ? Cancel + Save : Edit}` + `hideHousekeeping={editing}` to CardChrome. View-mode footer becomes `[Make couple-only] [Delete] [Edit]` (one row instead of two); edit-mode footer becomes `[Cancel] [Save changes]` (housekeeping hidden so the transient state stays focused). **(3) Stats tiles.** Replaced the flat `"0 of 2 sorted · £400 budget · items total: £159"` meta line with a 3-column tile grid. New inline `StatTile` helper — bordered box with small uppercase label + bold value. Tiles render conditionally so a no-money card shows only the Sorted tile. Other 13 card editors keep their inline Edit rows for now — pattern established on OUTFIT, mechanical follow-up to migrate them. 586 tests stay green.](#2026-05-18--v1964--outfit-card-layout-polish) |
| **v1.96.3** | 2026-05-17 | [Edit tasks from Book linked-tasks panels. User: "I want to be able to edit tasks from this screen too" — closes the v1.96.0 deferred ask. Pre-fix the linked-tasks panels on `/book/[slug]` (section level + per-card) could create + status-toggle tasks but offered no way to edit title / assignees / due date / topics / notes / supplier link without bouncing to `/tasks`. Now each row gets a small "Edit" affordance that opens a modal containing the full `TaskForm`. Wiring: (1) New `loadTaskForEdit(id)` server action returns the task with all four m2m relations flattened to ID lists (assignees / bookSections / bookSubsections / navTags / guestGroups) — gated by the task's own type so QUESTION/DECISION rows require EDIT(questions). Lazy-fetched on click rather than per-row at page load. (2) `BookTopicsContext` extended with `users` / `suppliers` / `navTags` / `guestGroups` so TaskForm's pickers pre-populate without per-row queries. (3) `/book/[slug]/page.tsx` loads the three extra option lists (only when editable) + threads through the provider. (4) New `EditTaskDialog` client component handles open → loadTaskForEdit → render TaskForm → updateTask + `router.refresh()` (v1.95.4 pattern). Type picker visible so couples can convert TASK ↔ QUESTION ↔ DECISION inline. (5) Wired into both `CardInlineTaskRow` + `InlineTaskRow`. No schema migration. 586 tests stay green.](#2026-05-17--v1963--edit-tasks-from-book-panels) |
| **v1.96.2** | 2026-05-17 | [Hotfix — repair the v1.96.0 multi-assignee migration that rolled back in prod. Caddy started returning 502s when the web container hit a `prisma migrate deploy` failure loop: `Error: P3009 — The '20260517200000_task_multi_assignee_drop_category' migration started at 2026-05-17 20:45:34 UTC failed`. Root cause: `Task.assigneeId` was declared as `String?` with no Prisma relation back to User, so the column never had a DB-level FK. Historical rows with `assigneeId` pointing at a long-deleted user were tolerated silently — but the v1.96.0 backfill `INSERT INTO "_TaskAssignees" SELECT id, assigneeId FROM Task WHERE assigneeId IS NOT NULL` violated the new junction's `_TaskAssignees_B_fkey` to User and aborted the whole transaction. Fix rewrites the same migration SQL in-place to be idempotent + orphan-safe: `DROP TABLE IF EXISTS "_TaskAssignees"` clears any partial state, the backfill adds `AND EXISTS (SELECT 1 FROM "User" WHERE id = assigneeId)` so orphan rows silently lose their stale assignment, and `ALTER … DROP COLUMN IF EXISTS` tolerates the column having already been dropped by a partial run. **One-time operator recovery on prod**: `docker compose --env-file .env exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260517200000_task_multi_assignee_drop_category';"` to clear the failed-attempt record, then Pull & Up. The re-applied (idempotent) SQL completes cleanly. No new functionality; pure recovery release.](#2026-05-17--v1962--hotfix-v1960-migration-orphans) |
| **v1.96.1** | 2026-05-17 | [TEXT cards get a photo gallery. User: "Allow photos on the 'text' panel." OUTFIT / DRESS_CODE / BUILD / STAY / LODGING_GUIDE cards have shipped `<ImageGallery>` since v1.63.0, but TEXT — the most flexible card kind — was photo-less. New `BookSubsection.fileIds String[] @default([])` column (migration `20260517300000_book_text_file_ids`, additive — no backfill needed since the default is empty). Three new server actions mirror the OUTFIT triple-action pattern: `attachFileToTextCard` / `detachFileFromTextCard` / `uploadAndAttachTextFile`, each gating on `requireEdit("book")` + emitting `text-file-attach` / `-detach` / `-upload` audit rows. `SubsectionEditor` gains the existing `<ImageGallery>` component — same drop-in used by OUTFIT — rendered below the rich-text body. Visible in edit mode + view mode (when files attached). `CardRouter`'s `Sub` type gains `fileIds: string[]`; a new top-level `files` prop on `CardRouter` threads the full file list down for the TEXT photo-attach picker. `/book/[slug]/page.tsx` extends the `needFiles` predicate to include `hasText` so the bulk file fetch runs for TEXT-containing sections too. No breaking changes — non-TEXT kinds keep their per-kind fileIds columns untouched. 586 tests stay green.](#2026-05-17--v1961--text-card-photos) |
| **v1.96.0** | 2026-05-17 | [Multi-assignee tasks + drop category + Q&D from Book panels. User: "Allow tasks to be assigned to multiple people. Remove the category option in tasks. Edit tasks from their linked screen aswell as the tasks page. Allow Questions & Decisions to be made on the item screen too." Three of four asks land in this release; edit-from-linked-screen is queued for v1.96.1. **Schema migration `20260517200000_task_multi_assignee_drop_category`**: implicit-m2m `_TaskAssignees` junction replaces the singular `Task.assigneeId`. Existing rows backfill (`assigneeId` → one junction row) before the column drops, so no data is lost. **Server actions**: `createTask` / `updateTask` accept repeated `assigneeIds` form inputs (TopicPicker-style; `__touched__` marker distinguishes "set to empty" from "field not posted"). Category field + `tags = [category]` write dropped from both. **TaskForm**: single-select assignee `<select>` swapped for a chip-toggle multi-select (`AssigneePicker`). Category input + COMMON_CATEGORIES const + datalist gone. **TaskDrawer**: same — chip-toggle multi-assignee replaces the single select; Category field removed; subtitle no longer renders the category suffix. **Readers updated across 13 files** to render `task.assignees[0]` as primary chip with `+N` overflow suffix when multiple: `/` (Today's "My next tasks" group-by-me filter), `/glance`, `/questions` + QuestionsClient, `/tasks` + TaskBoard + TaskList + TaskRow + TaskDrawer, plus the audit/nudge digest pipeline (`nudge-digest.TaskRow.assignees`, `nudge-actions.ts` select shape). **Book panels — Q&D inline**: `LinkedTasksPanel` + `CardLinkedTasksPanel` switch from `showType={false}` / `"+ Task"` to `showType={true}` / `"+ New"`. The TaskForm's Type picker (Task / Question / Decision) is now visible in the modal so couples can capture Q&D from any Book section page or any card without bouncing to `/questions`. The linked-tasks-panel query already selected `type` and rendered the `Q` / `D` glyphs, so Q&D show up in the same list. **586 tests stay green.**](#2026-05-17--v1960--multi-assignee--category-removal--qd-inline) |
| **v1.95.4** | 2026-05-17 | [Fix TEXT-card body disappearing on save + harden CardChrome title rename. User: "Block text is not displaying after being saved." Screenshots showed a TEXT card ("Rings") with content typed in the editor (H2 headings + paragraphs + tel-link) reverting to the empty-body "—" placeholder after clicking Save changes. Two coordinated fixes: (1) `SubsectionEditor.save()` adds an explicit `router.refresh()` after the `updateBookSubsection` await. Pre-fix `revalidatePath` inside the action invalidated the server cache but didn't always synchronously refresh the calling client component when the action was awaited inside `startTransition` — so `setEditing(false)` flipped the view to read-mode with the stale (pre-save) `sub.bodyHtml` prop, rendering the "—" fallback. `router.refresh()` forces a fresh server fetch before the view-mode flip. (2) `CardChrome.saveTitle()` dropped its `fd.set("body", "")` line. Pre-fix this sent `updateBookSubsection` into the legacy-body branch and wiped both `body` AND `bodyHtml` columns on every title rename. Harmless for the non-TEXT kinds that currently use CardChrome (their body columns are already null), but a footgun the moment any new kind ever ended up routing both flows. Title-only saves now leave the body columns untouched. No schema, no actions changed. 586 tests green.](#2026-05-17--v1954--fix-text-card-body-disappearing) |
| **v1.95.3** | 2026-05-17 | [Add ORDERED status to WEDDING_PARTY matrix dropdown. User: "Add orderd status to wedding party dropdown." Pre-fix the matrix cells offered four states: NEED (default / sparse) → HAVE → ALREADY_OWN → N_A. No way to capture "we've placed the order but it isn't in our hands yet" — a beat that matters for bridesmaid/groomsman accessories which arrive between order and the event. New `ORDERED` slot inserted between NEED and HAVE: marigold tone (matches the "in-progress" pill the tasks panel uses for OPEN — visually distinct from HAVE's moss "done" tone), `→` glyph. Persists as an explicit cell row (only NEED + no-notes collapses to absence in the sparse-storage convention, which still holds). **Doesn't count as "sorted"** in the v1.92.0 `sortedCount` rollup — the chip filter still requires `HAVE / ALREADY_OWN / N_A` so ordered items show as "in progress, not done yet". `Status` type union, `STATUS_META`, `STATUSES` order array (UI + select option order), and the server-side `VALID_CELL_STATUSES` zod allowlist all extended. No schema migration (status was always a free `String` column). 586 tests green.](#2026-05-17--v1953--ordered-status-on-wedding-party-matrix) |
| **v1.95.2** | 2026-05-17 | [Equal-height cards on the section grid + wider container. User: "Where pages differ in sizes make the white space match, header at the top, footer at the bottom content in the middle, also widen the whole thing." After v1.95.0 turned `/book/[slug]` into a 2-column grid, side-by-side cards of different heights left the shorter card at its natural height with empty grid-row background showing below it — the row stretched to the taller card but the shorter card didn't fill it. Now: (1) Grid wrapper div switches from `space-y-1` (static block flow) to `flex flex-col gap-1 h-full` so it fills the row's stretched height. (2) `CardChrome` `<article>` adds `flex flex-col flex-1` — fills the wrapper's available height. Content `{children}` wraps in `<div className="flex-1">` so the body absorbs any extra row space; the linked-tasks panel + action footer get pushed to the article's bottom. Empty space falls between the natural end of the content and the linked-tasks panel — header at top, footer at bottom, content in the middle just as the user asked. (3) `SubsectionEditor` (TEXT cards path) gets the same flex treatment for consistency. (4) Container widened from `max-w-5xl` (1024 px) to `max-w-7xl` (1280 px) — narrow side-by-side cards at 5xl were noticeably cramped on wide screens. No schema, no actions changed.](#2026-05-17--v1952--equal-height-cards--wider-grid) |
| **v1.95.1** | 2026-05-17 | [Fix silently broken Topics autofill on inline task creation from `/book/[slug]`. User: "When creating a task inline with a page, or an item can we autofill the topic according to the location its being created from?" Found a bug: `LinkedTasksPanel` (section level) and `CardLinkedTasksPanel` (card level) both passed `defaultBookSectionIds` / `defaultBookSubsectionIds` to `AddTaskToggle` but **didn't pass the option lists** (`bookSections` / `bookSubsections`). `TaskForm` gates `TopicPicker` rendering on `bookSections.length > 0 || bookSubsections.length > 0 || …` — so the picker never rendered, and because the picker is what emits the hidden `topicKeys` inputs, the IDs never made it into formData. Tasks were getting created with no topics linked. Fix: new `BookTopicsContext` client provider mounted once in `/book/[slug]/page.tsx` carrying `bookSections = [{section}]` + `bookSubsections = section.subsections.map(...)`. Both panels now wrap `AddTaskToggle` in thin context-consumers (`AddTaskToggleWithTopics` / `AddCardTaskToggle`) that pull the lists from context, so the `TopicPicker` renders pre-populated with the right section / card already chip-selected. Context avoids prop-drilling through 14 card editors / `CardChrome` / `CardLinkedTasksPanel`. No schema, no actions changed.](#2026-05-17--v1951--fix-topics-autofill) |
| **v1.95.0** | 2026-05-17 | [Two-column layout on the Wedding Book section page + per-card column-span toggle. User: "In the book section, can we have a two columns, and the option for pages to either use 1 or both columns." `/book/[slug]` previously stacked every card in a single column inside a `max-w-3xl` container — works for OUTFIT / TEXT but wastes a lot of horizontal space on wide cards like WEDDING_PARTY (matrix), MENU (long course lists), BUILD (materials + sessions). New schema column `BookSubsection.wide Boolean @default(false)` (migration `20260517100000_book_subsection_wide`) flags individual cards for column-spanning. New server action `setBookSubsectionWide(id, wide)` flips the flag (same `requireEdit("book")` gate as reorder — layout is cosmetic so no couple-tier restriction). New `SubsectionWidthToggle` client component renders a `⇆ / ⇤⇥` icon button in the same action-row as the existing reorder ▲/▼ buttons; `SubsectionReorderControls` lost its outer flex wrapper so both controls compose into one shared row owned by the page. `/book/[slug]/page.tsx` widened from `max-w-3xl` → `max-w-5xl`, the subsection map is wrapped in `grid grid-cols-1 md:grid-cols-2 gap-4`, and each subsection wrapper gets `md:col-span-2` when `wide=true` so it spans both columns. Below the `md` breakpoint everything stacks into a single column so phones still get a readable layout. Existing cards default to narrow — no layout shift on migration. 586 tests stay green.](#2026-05-17--v1950--two-column-section-grid) |
| **v1.94.2** | 2026-05-17 | [Auto-derive slugs on Wedding Book section + card creation. User: "Can we also remove the forced slug, make the app auto generate the slug." Both `/book` "+ New section" and `/book/[slug]` "+ New card" required a hand-authored URL-safe slug alongside the title (regex `^[a-z0-9-]+$` enforced client-side via `pattern=` AND server-side via Zod) — friction for a non-technical user, and the slug isn't even surfaced as content after creation. New shared `src/lib/slugify.ts` exposes `slugify(input)` (lowercase → `[^a-z0-9]+` → `-` → trim → 60-char cap, matches the existing inline copies in `nav-tag-actions` / `guest-group-actions` / `permission-group-actions`) + `disambiguateSlug(base, isTaken)` (walks `base`, `base-2`, `base-3`, … with a 1000-collision Date.now fallback). `sectionSchema` + `subsectionSchema` drop `slug`; `createBookSection` derives from title and disambiguates against `bookSection.findUnique` (global unique); `createBookSubsection` derives + disambiguates against `bookSubsection.findFirst({sectionId, slug})` (per-section unique — the slug fuels the "On this page" anchor row's `#<slug>` deep-links). `AddSectionToggle` drops the Slug `<Input>`; Title goes controlled so a live `URL: /book/<slug>` preview updates as the couple types (placeholder "section" when title slugifies to empty). `AddSubsectionToggle` same treatment with `Anchor: #<slug>` preview (placeholder "page"). Existing rows untouched — no schema migration, slug-uniqueness constraints preserved. Collision handling moves from the user (who'd hit "slug taken" and retry) to the action (silent `-2` suffix). 586 tests stay green.](#2026-05-17--v1942--auto-derive-book-slugs) |
| **v1.94.1** | 2026-05-17 | [Polish the `/book` overview cards — colour rotation + smart glyphs for custom sections + accent-tab border. User: "Can we also make these look nicer? maybe sort the colouring out when adding extra items." Pre-fix the 7 canonical prototype slugs (`wedding-party`, `venue`, `food-drink`, `photography`, `guest-experience`, `legal-admin`, `accommodation`) had hand-picked accents + SVG illustrations from `SECTION_META` / `bookSceneFor`. Every custom section the couple authored (`clothing`, `wedding-party-people`, `venue-spaces`, `legal-before-the-day`, `legal-after`, `post-wedding`, etc.) fell through to `DEFAULT_META` → flat `bg-canvas` white with a generic 📖 emoji. Three coordinated fixes: (1) **Deterministic accent rotation** — `fallbackAccentFor(slug)` hashes the slug into one of the existing three canonical accents (`bg-moss-100 / bg-moss-50 / bg-marigold-100`). Same slug → same accent forever, so cards don't shift colour on reorder. (2) **Keyword-inferred glyph** — `fallbackGlyphFor(slug, title)` matches against a lowercased `${slug} ${title}` haystack and returns 🏛 / 👗 / 👰 / 📜 / 🛏 / 📷 / 🍽 / 🎉 / 🗓 / 🎵 / 🚗 / ✈ / 🥂 / 📔 / 📖 by topic ("venue-spaces" → 🏛, "Clothing & Accesories" → 👗, "Wedding Party — People" → 👰, "Legal — After" → 📜, "Post-wedding" → 📔). (3) **`bookSceneFor` keyword fallback** — variant slugs that contain a canonical root (e.g. "venue-spaces", "venue-decor", "wedding-party-people", "wedding-party-day-of", "legal-before-the-day") now inherit the parent illustration instead of falling through to `null`. (4) **Accent-tab left border** — `border-l-4 border-l-moss-300` (`hover:border-l-moss-500`) reads as a subtle bookmark / tab spine, gives each card a stronger visual anchor than the previous all-around soft border. No schema, no actions, no data migration. 586 tests stay green.](#2026-05-17--v1941--book-overview-card-polish) |
| **v1.94.0** | 2026-05-17 | [Editable per-section subtitle on Wedding Book + section rename. User: "Can we add a subtitle to the pages". Looking at `/book`, every section card had a hard-coded descriptive line from `SECTION_META[slug].description` ("Reference notes" generic / "Pixel Party, table games, photo booth, favours" for the canonical 7 prototype sections). Couples couldn't edit it — and any custom section they created fell through to the generic "Reference notes" line. Now: new `BookSection.subtitle String?` column (migration `20260517000000_book_section_subtitle`), threaded through `createBookSection` + new `updateBookSection` action (which also exposes title rename — couples previously had no way to fix a section title typo without re-creating + reordering). `AddSectionToggle` modal gets a Subtitle input (optional, max 240, placeholder "e.g. Package, shot list, locations, day-of contact"). New `EditSectionToggle` component renders an "Edit details" button in the `/book/[slug]` header next to "+ New card"; opens a modal with Title + Subtitle inputs. **Slug stays stable** — URLs are public-shareable + couple's bookmark / muscle memory survives a rename. **Render fallthrough:** on `/book`, `section.subtitle ?? meta.description` so existing sections without a custom subtitle still read the prototype line. On `/book/[slug]` the page header subtitle becomes `"<subtitle> · 3 pages · couple-only"` when set; otherwise the v1.93 `"Wedding Book · 3 pages"` is preserved. Audit log captures the v1.30.5 standard `changedFields` + before/after snapshots so renames are forensically clear. 586 tests stay green; no test churn needed (additive UI + persistence).](#2026-05-17--v1940--per-section-subtitle--rename) |
| **v1.93.2** | 2026-05-17 | [Per-item notes on OUTFIT items + view-row UX restructure. User: "review the ux and look of the page Allow me to add notes to each 'outfit' item." `BookOutfit.notes` already existed in the schema + payload — exposed in the UI for the first time. Item edit row gains a 2-row textarea Row 4 ("e.g. waist taken in 1.5cm, due back 12 Sept"); view row surfaces notes as an italic muted line under the structured fields. **View-row restructure** — the previous single-line dense cluster (label · description · supplier · website + cost / paid / status pills competing for space on the right) splits into a deliberate 2-row layout: Row 1 holds label (left, font-medium) + status/cost/paid pills (right); Row 2 holds description · supplier · website link in muted small text; Row 3 holds notes if set. Empty items still collapse to a clean single line because Row 2 only renders when at least one meta field is set. **Status pill always renders** — when `item.status` is null it falls back to "Planned" with the Planned tone, so items always communicate their position in the lifecycle (was: nothing rendered, so couples couldn't see that `0 of 2 sorted` meant the items were still Planned). No schema, no actions, no data migration.](#2026-05-17--v1932--per-item-notes--view-row-restructure) |
| **v1.93.1** | 2026-05-17 | [Per-item cost on OUTFIT items. User: "Add cost to each item." Additive — `BookOutfit.costPence Int?` (migration `20260515300000_outfit_item_cost`), threaded through `outfitItemPayloadSchema` + `saveOutfitCard` persistence + `CardRouter` Sub type + `page.tsx` outfit shape + `BookOutfitCard` Item type / draft / save payload / addItem default. View row gets a small muted `£X.XX` chip next to the status pill when set. Edit row's Row 3 (was just Website full-width) becomes a 2-col grid (Website 8 / Cost 4) when `showMoney` is true; otherwise Website stays full-width. The meta line under the title gains an "items total: £X" chip alongside the existing budget chip when any item has a cost — couple can now see "£400 budget · items total: £375" at a glance for sanity-checking the budget link. **Card-level `costPence` still drives BudgetLine sync** (v1.78.0 `syncBudgetLine`) — per-item costs are additive tracking only; no rollup into the linked BudgetLine in this release.](#2026-05-17--v1931--per-item-cost-on-outfit) |
| **v1.93.0** | 2026-05-14 | [OUTFIT card simplification round 2 — dates gone (use Tasks), card-level paid gone (use Payments), lifecycle is Planned → Purchased → Received → Already own. User: "Lets add planned as an uption, also on the outfit remove the paid. Lets simplify the outfit section, I want to be able to plan each item, mark if we have paid for it, or recieved it, description, supplier and web link, maybe pictures too, remove fitting alterations and pickup, anything with dates as these can be managed via tasks." Migration `20260515200000_outfit_card_simplification` (a) maps existing `BookOutfit.status` values to the new lifecycle (`Designed → Planned`, `Ordered → Purchased`, `Fitted / Collected → Received`, `alreadyOwned=true → Already own`), (b) drops `BookOutfitCard.fittingDate / alterationsDueBy / pickupDate / paid / paidBy` + `BookOutfit.alreadyOwned`. The "Fittings & pickups" Today widget is retired along with `nextOutfitMilestones` + `OutfitMilestoneHit`. `outfitRollups` simplifies to `{ itemCount, collectedCount, percentCollected }` with done-states being Received + Already own. UI: STATUS_OPTIONS = ["Planned", "Purchased", "Received", "Already own"]; stats strip + fitting timeline removed and replaced with a single meta line ("3 of 5 sorted · £400 budget"); per-item Already-own checkbox removed (subsumed by status). Cost field stays (still feeds `BudgetLine.estimated` via v1.78.0 sync). Per-item Payment.bookOutfitId link + `📎 £X paid` chip unchanged.](#2026-05-14--v1930--outfit-card-simplification-round-2) |
| **v1.92.2** | 2026-05-14 | [Drop redundant titles on the section page. User: "also seems to have multiple titles in a section" — screenshot showed `/book/clothing` repeating the same labels three times (section header → "On this page" pills → card title → internal person header). Two fixes: (1) **OUTFIT card** drops its standalone "Bryony" person-header line when the personName is already contained in the card title (heuristic: `title.toLowerCase().includes(personName.toLowerCase())`). The role chip (BRIDE / GROOM / etc) still renders on its own line so the tag info isn't lost; when no personName is set the chip + "No name set" italic still surface. (2) **"On this page" pills** threshold bumped from `> 1` to `> 4` so 2-4-card sections (the common case) don't carry a redundant titles row above cards that sit in the same scroll viewport. Render-only — no schema, no actions, no data migration.](#2026-05-14--v1922--drop-redundant-titles) |
| **v1.92.1** | 2026-05-14 | [Flip the WEDDING_PARTY matrix — people as rows, items as columns. User: "might be better to swap people & Items?" — screenshot showed the v1.92.0 4-people-as-columns layout cutting off the 4th name behind a horizontal scroll. Typical wedding parties are 4-5 people × 3-4 items, so people-as-rows fits in the available width without scroll. Pure render flip: matrix shape + cell save shape unchanged (still `setWeddingPartyCell(memberId, itemId, status)`). `MemberHeader` + `ItemHeader` gain an `orientation` prop so the reorder arrows read as `▲/▼` for rows and `◀/▶` for columns. "+Add person (column)" → "+Add person (row)"; "+Add item (row)" → "+Add item (column)". No schema, no actions, no data migration.](#2026-05-14--v1921--flip-the-wedding-party-matrix) |
| **v1.92.0** | 2026-05-14 | [Course-correct v1.91.0 — drop subsection categorisation + OUTFIT trackingMode + per-item paidBy; new matrix WEDDING_PARTY card; inline linked-tasks panel; OUTFIT gets Purchased + Already-own. User feedback: "remove the subcategorisations, I want to track bridesmaids and groomsmen as a group, in a card where I can list out their names, list out the items they need, and if we have them or not. The outfit section as a whole isn't really working — several options are unnecessary. Status doesn't have a Purchased option, paidBy doesn't account for if we already own something and again doesn't link into the existing finance system. The tasks/questions/decisions section should be **inline within the card** and not look like it's been appended at the bottom." Five coordinated changes: (1) **DROP `BookSubsection.category`** + every UI surface from v1.91.0 (AddSubsectionToggle field, CardChrome inline category strip, SubsectionEditor inline strip, page.tsx group-by-category render). (2) **DROP `BookOutfitCard.trackingMode`** + the FULL/LIGHT toggle UI + all `isLight` branches. (3) **DROP `BookOutfit.paidBy`** (v1.91.0 per-item text field). (4) **ADD `BookOutfit.alreadyOwned Boolean`** — per-item "we already own this" marker. OUTFIT items get an Already-own checkbox in edit mode + a `✓ Already own` chip in view mode. Status options gain `Purchased` (between Designed and Ordered). (5) **NEW `WEDDING_PARTY` card kind** — matrix tracker (items × people) with sparse cell storage. New `BookWeddingPartyCard` + `Member` + `Item` + `Cell` models. Per-cell status (Need / Have / Already own / N/A) saved via standalone `setWeddingPartyCell` action (no draft form). Members + items + matrix cells reorderable + renameable. Card-level groupLabel + notes save on blur. (6) **Inline linked-tasks panel** — `CardLinkedTasksPanel` lifted into its own file; rendered INSIDE the card's `<article>` via CardChrome / direct include for TEXT / OUTFIT / DRESS_CODE / WEDDING_PARTY / FIELD / RECIPE. Other 8 kinds keep the v1.51.0 sibling-render until migrated individually in a follow-up. **OUTFIT → Budget + Payments** wiring unchanged from v1.78.0 (card → BudgetLine sync) + v1.75.0 (Payment.bookOutfitId per-item link) — Already-own is display-only at the item level. Migration `20260515100000_wedding_party_card_outfit_cleanup_drop_categories` drops 3 columns + 1 enum, adds 1 column + 1 enum value + 4 models.](#2026-05-14--v1920--course-correct-v1910) |
| **v1.91.0** | 2026-05-14 | [New DRESS_CODE card kind + OUTFIT-card flexibility + subsection categorisation. User: "We currently have clothing and accessories in detail for where we are making the purchases, but we don't have anything for tracking if bridesmaids, groomsmen have made their purchases etc — Also general clothing guidance for any guests asking. Could we plan out some new cards, maybe also start to categorise the cards…". Three coordinated changes: (1) **OUTFIT card flexibility** — new `BookOutfitCard.trackingMode` enum (`FULL / LIGHT`); LIGHT collapses the editor + read view to "items + status + per-item paidBy" only (hides fitting / alterations / pickup / cost / gallery) so bridesmaid / groomsman cards don't need the deep tracker. New `BookOutfit.paidBy` free-text override per item ("Aimee" / "Couple" / "Parents") so a bridesmaid card can carry mixed responsibility (Dress: Aimee, Bouquet: Couple); chip in view mode falls back to card-level paidBy with `(inh.)` italic suffix. (2) **DRESS_CODE card kind** — new `BookDressCodeCard` model + new `BookSubsectionKind.DRESS_CODE`. Single-row card with structured fields (dress code label, summary, colour guidance, footwear, weather, accessories) + rich-text `bodyHtml` + image gallery. Couple-internal reference. (3) **Subsection categorisation** — `BookSubsection.category` (nullable, indexed); cards on the section page group under uppercase category headers ("BRIDE" / "BRIDESMAIDS" / "GROOMSMEN"). `CardChrome` + `SubsectionEditor` get inline category inputs with datalist autofill from existing categories on the section; `AddSubsectionToggle` gains a category field on create. New server actions `saveDressCodeCard` + `attachFileToDressCodeCard` / `detachFileFromDressCodeCard` / `uploadAndAttachDressCodeFile`; `createBookSubsection` seeds the DRESS_CODE row + persists category; `updateBookSubsection` round-trips category. OUTFIT → Budget sync (v1.78.0) unchanged: card-level `costPence` continues to drive the linked `BudgetLine.estimated` on save. Per-item Payment links (v1.75.0 `Payment.bookOutfitId`) unchanged. Migration `20260515000000_dress_code_outfit_modes_categories` is additive — `trackingMode` defaults to FULL, `paidBy` + `category` start null.](#2026-05-14--v1910--dress-code--outfit-modes--card-categories) |
| **v1.90.1** | 2026-05-14 | [Questions / Decisions edit form gets the Topics picker (parity with Tasks). User: "They don't have the same edit screen". On `/questions`, the inline edit row's `TaskForm` was missing the Topics multi-select (Book sections / Book pages / Nav tags / Guest groups) — `+ New` via `AddTaskToggle` had it because the page only piped the option lists into the create form, not the edit form. Two coordinated fixes in `questions/page.tsx` + `QuestionsClient.tsx`: (1) the task query now `include`s the four m2m relations so each row carries its existing topic-link IDs; (2) the option lists + ID arrays are threaded through `QuestionsClient → Section → Row → TaskForm`. `TaskForm`'s existing guard (`bookSections.length > 0 || …`) now sees non-empty lists and renders the picker, pre-selected with the row's existing links. Save path uses the existing `updateTask` + `parseTopicKeys` — no server changes. No schema; relations exist since v1.30.5 / v1.51.0 / v1.61.0.](#2026-05-14--v1901--questions-edit-form-parity) |
| **v1.90.0** | 2026-05-14 | [Today page polish — cross-module strip no longer leaves blank columns + Recent activity gets entity badges + initials chips. User: "Can we make this look better?" Two render fixes on `/today`: (1) `TodayCrossModuleStrip` switched from a fixed `grid-cols-3` to `auto-fit minmax(280px, 1fr)`, with empty widgets filtered before render — pre-fix, when only Open Decisions had data, the lone card sat alone in column 1 with two empty grid cells reserving column 2+3 space. (2) `RecentActivityFeed` rewrote from a uniform-grey-text list into a scannable two-row column: colour-coded entity glyph badges on the left (£ for Payment / Budget, ✓ for Task, ♥ for Guest / Household, ◆ for Supplier, ❧ for Book, ♪ for Songs, 📎 for File, etc.), monospace `time-ago` column, the formatted sentence, and a trailing initials avatar chip with the actor's full name in the title attr. `divide-y` separators + subtle hover so consecutive entries don't blur together.](#2026-05-14--v1900--today-page-polish) |
| **v1.89.2** | 2026-05-14 | [Folder name on receipt list + grouped picker. User: "Add the folder name to receipts". The receipts panel on /payments showed bare filenames so files with similar names across folders ("invoice.pdf" in Payment receipts vs Catering) were indistinguishable. Now each attached receipt renders the folder as a muted uppercase prefix chip ("PAYMENT RECEIPTS · invoice.pdf"); the "Attach existing file" disclosure groups files under sticky folder headers; the inline grid's `📎 Pick existing` popover does the same. Page query selects `folder` + orders by `folder asc, name asc` so groups arrive pre-sorted. No schema; `File.folder` already exists.](#2026-05-14--v1892--folder-name-on-receipts) |
| **v1.89.1** | 2026-05-14 | [MIME fallback for OneDrive / mail-attached uploads. User reported a known-good PDF ("Jamie Spencer Proposal_signed.pdf", 1 MB, valid `%PDF` magic bytes) failing to upload. Root cause: OneDrive-synced files lose their Content-Type metadata, so the browser sends `file.type` as empty / `application/octet-stream`, which `validateUpload` rejected even though `.pdf` was on the allowlist. Fix: when `file.type` is missing or generic, fall back to inferring MIME from the file extension via a new reverse-lookup of the `MIME_EXTENSIONS` map (`inferMimeFromName`). Error message now includes the filename + the detected type so users can self-diagnose wrong-extension typos. Applies to every upload surface — payment receipts, BUILD/SETUP/STAY galleries, /files general upload.](#2026-05-14--v1891--mime-fallback-onedrive) |
| **v1.89.0** | 2026-05-14 | [Inline receipt upload on payments + multi-file support. User: "File upload inline with receipts i.e. upload receipt & also allow multiple files to be uploaded". Pre-v1.89 the inline payment grid had an "Upload from device" button that queued the picked file locally but couldn't auto-attach (createPayment returned void); users were told via warn-toast to re-upload via the row's edit menu. Fixed: `createPayment` now returns `{ id: string }`; the inline grid chains `uploadAndAttachReceipt` for each queued file after creation. Both the inline grid and `PaymentRow`'s receipts panel now accept multiple files via `<input multiple>` (one click → many uploads). PaymentRow gains an explicit `↑ Upload receipt` button — previously edit-mode could only attach files already in /files. Each file goes through the standard MIME + size validation, audit row, and `Payment.fileIds` append.](#2026-05-14--v1890--inline-receipt-upload--multi-file) |
| **v1.88.0** | 2026-05-14 | [Component fund chip moved to the right-side action column. User: "Can we move the Payment picker 'joint...' to the end of the row where there is more space, after the pricing etc". On composite-line component sub-rows the fund chip sat inline next to the component label, crowding it against the breakdown text. Moved into the last cell (action column), right-aligned, so the chip lines up with the parent line's chip and the label cell can breathe. No schema, no compute changes — purely the chip's render position.](#2026-05-14--v1880--fund-chip-moved-to-action-column) |
| **v1.87.0** | 2026-05-13 | [Reorder sections + pages in the Wedding Book. User: "Allow me to reorder items in the wedding book". Two new server actions in `src/app/(app)/book/actions.ts` — `reorderBookSection(id, delta)` swaps a section with its neighbour on /book; `reorderBookSubsection(id, delta)` swaps a card (BookSubsection) with its neighbour within the same section. Both use the same swap-`order`-in-a-transaction shape as v1.85.0 budget-category reorder and the existing `reorderBuildMaterials`. **UI:** new `SectionReorderControls` client component renders absolutely-positioned `▲ / ▼` buttons over each section card's top-right on /book (couple-only); new `SubsectionReorderControls` renders a thin action row above each card on /book/[slug] (hidden when a section has only one card). Both audit-logged (`book-section-reorder` / `book-subsection-reorder`) with `title` + `delta` + `swappedWith` snapshot per v1.30.5. No schema; `order` columns already existed.](#2026-05-13--v1870--reorder-book-sections--pages) |
| **v1.86.0** | 2026-05-13 | [Funding sources across the finance system. User: "Add a method for joint vs personal / other funded on the budget screen, find a way to calculate, joint budgets and personal budgets etc & roll that into what we currently have with the toggle between actual and planned outage vs what has been paid, work it into the whole finance system". New `FundSource` enum (`JOINT / PERSONAL_BRIDE / PERSONAL_GROOM / OTHER`) + nullable `fundSource` + free-text `fundLabel` columns on `BudgetLine`, `BudgetLineComponent`, AND `Payment` (additive migration, no backfill). New `src/lib/funds.ts` resolver with inheritance chain `payment > component > line` and an "UNASSIGNED" synthetic key for nulls. Bride/groom labels resolve dynamically from `WeddingSettings.brideFirst` / `.groomFirst`. The six pure compute helpers in `src/lib/budget.ts` (`computeActual` / `computePaid` / `computeEstimated` / `computeComponentEstimated` / `computeCompositeActual` / `computeCompositePaid`) gain an optional `filter?: { fund }` param — non-fund-aware call sites pass nothing and behave exactly as pre-v1.86. **/budget UI:** new `FundFilterChips` row above the SummaryBar; new `ByFundStrip` mini-tile row below it (Joint £X · Bryony £Y · Jamie £Z · Other £W — only nonzero buckets visible; clicking narrows the filter); per-line and per-component `FundChipPicker` popovers (radio of four buckets + OTHER text input → `setLineFund` / `setComponentFund` quick-actions); SummaryBar shows a marigold "Filtered" banner when active. URL state: `/budget?fund=JOINT` wins on first render; localStorage `wh_budget_fund_filter` persists. Outstanding toggle (v1.84) stays orthogonal — it operates on the filtered totals. **/payments:** fund select column on `InlinePaymentGrid`, fund picker block on `PaymentForm`, fund chip on `PaymentRow` (resolved via inheritance, italic "(inh.)" when inherited), `?fund=` URL filter on the page. **/glance:** "Paid by fund" line under the Budget card, deep-links into `/budget?fund=<KEY>`. New tests: 18 in `tests/unit/funds.test.ts` + 12 fund-aware cases in `tests/unit/budget.test.ts` (594 total, was 564).](#2026-05-13--v1860--funding-sources) |
| **v1.85.0** | 2026-05-13 | [Rename + reorder budget categories. Category headers on `/budget` gain a `✎` pencil (inline rename — Enter saves, Esc cancels) and `▲ / ▼` reorder buttons (disabled at the ends of the list). Two new server actions: `renameCategory(id, name)` (single-field update with audit `priorName` + `name` diff) and `reorderCategories(orderedIds[])` (transactional `order` rewrite, mirrors v1.80.0 `reorderComponents`). Parent `BudgetClient` owns the ordering: clicking ▲/▼ swaps the id at idx ± 1 and dispatches in one server call. No schema; no migration; `BudgetCategory.order` already existed.](#2026-05-13--v1850--rename--reorder-budget-categories) |
| **v1.84.0** | 2026-05-13 | [Outstanding-mode toggle on /budget. The Outstanding summary tile now offers two interpretations side-by-side: **vs Actual** (default, pre-v1.84 behaviour — `actual − paid`, what's been committed but not yet settled) and **vs Planned** (`planned − paid`, how much more we need to find against the budget). Two-pill toggle inside the Outstanding tile; selection persisted to `localStorage` under `wh_budget_outstanding_mode`. The Actual / Planned / Paid tiles + the stacked progress bar are unchanged — only Outstanding switches denominator. Pure render change; no schema, no compute helpers, no migration.](#2026-05-13--v1840--outstanding-mode-toggle) |
| **v1.83.0** | 2026-05-13 | [Composite-line columns finally render their numbers. **Bug:** the Venue line's Planned cell showed `—` even though its 9 components summed to £5,667 (visible in the category header). Component sub-rows had blank Actual + Paid columns. v1.83.0 surfaces both: parent's Planned cell shows the composite sum with a Σ pill; each component sub-row now renders its own Actual (sum of linked payments) and Paid (PAID-status sum) with Σ pills, falling back to `—` when zero. No schema or compute changes — these values already existed via `effectiveEstimated` and `componentActual`; the rendering just didn't read them out.](#2026-05-13--v1830--composite-line-columns) |
| **v1.82.0** | 2026-05-13 | [Composite-line components grow up (editing + MANUAL + notes), two new headcount sources (adults / children + pending), and the Paid column finally rolls up linked payments. **Bug fix:** linking a PAID payment to a BudgetLine showed it under Actual but Paid stayed £0 — the column rendered the manual `paid` value verbatim. New `computePaid` + `computeCompositePaid` follow the same B2 contract pattern as Actual: manual override wins, else sum of PAID-status payments. **Component editing:** ComponentsPanel rewritten with a shared `ComponentForm` for both add and edit; click Edit on any component row to switch it into an inline form (label, mode, price, source, manual count, minimum, notes). **MANUAL + notes:** components now support MANUAL source + a notes textarea; notes surface a 📝 hint on the row. **New enum values:** `ADULTS_PENDING_OR_CONFIRMED` and `CHILDREN_PENDING_OR_CONFIRMED` — vendors that price adults vs children differently can now isolate either against the "+ pending" RSVP cohort.](#2026-05-13--v1820--components-grow-up--paid-rollup-fix) |
| **v1.81.0** | 2026-05-13 | [Minimum-cover floor on per-head budget lines + components. Vendor minimums ("80 covers regardless of RSVPs") are now first-class. New `minimumHeadcount Int?` on BOTH `BudgetLine` and `BudgetLineComponent` (additive migration). New `applyMinimum(resolved, minimum)` pure helper in `src/lib/budget.ts` — `computeEstimated` + `computeComponentEstimated` factor it before pricing. UI: line variable-cost panel + component add-form both gain a `Min` input (optional). Breakdown chips on `/budget` show the active multiplier in marigold + an `(min, actual N)` annotation when the minimum is doing work. MANUAL source respects the minimum too (a typed number is still floored).](#2026-05-13--v1810--minimum-cover-floor) |
| **v1.80.0** | 2026-05-13 | [Composite budget lines (sub-components). User flagged that the Venue line needs to bundle three different cost shapes — 50 meals × £25, 50 toast drinks × £2.50, one £150 arch — under a single conceptual "Venue" total. New `BudgetLineComponent` model (one-to-many on `BudgetLine`); each component is either flat (£) or per-head (£ × headcount-source). Line's effective estimated = sum of components when components exist; line-level flat/perHead fields are preserved but hidden by the renderer. Payments can target either a line (lump-sum venue payment) OR a specific component (DIY-style "I paid for the foam"). New `Payment.budgetLineComponentId` FK; payment picker on `/payments` is prefix-encoded (`line:<id>` / `comp:<id>`) so a single select offers both levels. Card-to-component link plumbing (5 new `BookXCard.budgetLineComponentId` FK columns) shipped but UI wiring deferred to v1.80.1.](#2026-05-13--v1800--composite-budget-lines) |
| **v1.79.0** | 2026-05-13 | [Payments → budget line picker. User flagged that payments weren't reaching the budget — the `Payment.budgetLineId` FK existed in the schema but no UI surfaced it, so every payment landed as a budget orphan (paid-totals of £3,957+ showing as £0 on `/budget`). `paymentSchema` now accepts `budgetLineId`; `createPayment` + `updatePayment` persist it + revalidate `/budget`. New `📊 Budget line` `<select>` on the InlinePaymentGrid row (categories as `<optgroup>`, lines as `<option>`). PaymentForm gains a matching dropdown so edit-mode can change the link. PaymentRow renders a `📊 <category>` chip in the "Linked / Receipts" column. Page query loads each payment's `budgetLine.category` + categories' lines for the picker. B2 contract takes over from there — actuals on `/budget` recompute live from the sum of linked payments.](#2026-05-13--v1790--payments-to-budget-line-picker) |
| **v1.78.0** | 2026-05-07 | [Close the financial loop — Wedding Book cost-bearing cards (MENU/BAR/OUTFIT/STAY) gain `budgetLineId` FK + auto-resync into the linked BudgetLine on every card save (mirrors v1.31.1 BUILD pattern). Schema migration `20260514000000_card_budget_links_and_menubar_enum` adds the four FKs + new `BookMenuCard.headcountSource` + `manualHeadcount` + `BookBarItem.headcountSource` (PerHeadSource enum from v1.77.0). Backfills: existing `BookMenuCard.confirmedHeadcount` rows → MANUAL; null+priced → ALL_CONFIRMED; per-head BAR items → ADULTS_CONFIRMED. New `syncBudgetLine` helper + 8 new server actions (`linkXCardToBudget` / `unlinkXCardFromBudget` for each of MENU/BAR/OUTFIT/STAY). Page query loads payments per BUILD material + per OUTFIT item; **paid-on-card reciprocal chip** renders on each material/item showing "📎 £X paid" or "📎 £X / £Y ✓" when fully covered (couple-only via the v1.76.0 money gate). Out of scope (v1.78.1 polish): per-card "Link to budget" picker UI; MENU `headcountSource` dropdown in the editor; BAR per-item source picker.](#2026-05-07--v1780--close-the-financial-loop) |
| **v1.77.0** | 2026-05-07 | [Variable / per-head budget lines + over-budget warnings + payments category filter + glance spend pulse. New `PerHeadSource` enum + `BudgetLine.{perHeadPence, headcountSource, manualHeadcount}` (additive migration `20260513000000_per_head_budget_lines`). New `src/lib/headcount.ts` resolver (single source of truth, batched count fetch). `BudgetClient`'s "Variable cost (£ × headcount)" toggle on the line edit form expands inputs for price, source (all invited / confirmed + pending / confirmed / adults / children / manual), and live count preview. View mode shows the breakdown chip ("£50 × 60 confirmed = £3,000") and a `⚠ Over` chip when actual exceeds derived estimated. Category headers carry a "⚠ N over" rollup chip and a `↗ Payments` deep-link to `/payments?category=<id>`. /payments accepts the new `?category=` filter (composable with `?supplier=`). /suppliers/[id] gains an "⚠ Over agreed" warning when committed payments exceed `amountAgreed`. /glance Budget card gets a "Recent spend" pulse strip — this week / this month totals + top 3 categories with deep-links.](#2026-05-07--v1770--variable-budget-rollups--warnings--spend-pulse) |
| **v1.76.0** | 2026-05-07 | [`money` permission gate hides £ values across non-financial surfaces (BUILD/MENU/BAR/OUTFIT/STAY cards, /diy, /suppliers list and detail) for users without it. New `Section` value `"money"`; default for non-couple is NONE so they see project state without prices. Couple promotes specific users (e.g. the planner) to VIEW or EDIT via the existing Settings matrix without unlocking /budget or /payments. Edit-mode money inputs are skipped when hidden but values are preserved via hidden inputs / draft state so non-money editors don't clobber them. Workflow loop (per-head budget rollups, paid-on-BUILD reciprocal display, over-budget warnings, /payments category filter, spend pulse) is the v1.77.0 follow-up.](#2026-05-07--v1760--money-permission-gate) |
| **v1.75.1** | 2026-05-07 | [Inline payment grid simplified to a single row + supplier autofill input — user feedback: 5 visible rows was too many ("only really need one"), and the supplier `<select>` should be a free-text autofill field instead of a dropdown. `InlinePaymentGrid` collapsed to a single row's worth of state; supplier becomes `<input list="payment-suppliers">` with the existing supplier names as `<datalist>` options. On commit, typed supplier names are matched case-insensitively against existing suppliers; unmatched names auto-create via `createSupplierQuick` (category defaults to "Other") — no separate `+ New supplier…` sub-form needed.](#2026-05-07--v1751--single-row-grid--supplier-autofill) |
| **v1.75.0** | 2026-05-07 | [Excel-style payment grid + receipts + book-row linking — `Payment` gains `fileIds: String[]`, `bookBuildMaterialId`, `bookOutfitId` (additive migration `20260512000000_payment_receipts_and_book_links`). New `InlinePaymentGrid.tsx` replaces `InlineAddPaymentRow.tsx`: 5 visible blank rows, **Enter** commits the current row and advances focus, description input has datalist autofill from past payment descriptions, supplier dropdown keeps the v1.74.0 `+ New supplier…` flow, new `🔗` button per row opens a cascading picker (BUILD card → material OR outfit-item), new `📎` button opens a receipt popover. **Linking a BUILD material auto-marks it `ordered: true`** as a side-effect of `createPayment`. New server actions `attachReceiptToPayment` / `detachReceiptFromPayment` / `uploadAndAttachReceipt` mirror the v1.63.0 BUILD card pattern. `PaymentRow` gains a "Linked / Receipts" column with chips that deep-link to the relevant book section, and a receipt-management panel in edit mode. Page query loads BUILD cards + outfit items + files for the pickers; `recentDescriptions` derived from the existing payments query (no extra round-trip). `InlineAddPaymentRow.tsx` deleted.](#2026-05-07--v1750--excel-payment-grid--receipts--book-linking) |
| **v1.74.0** | 2026-05-07 | [Inline payment add + create-supplier-from-payments — replaces the v1.56.0 `AddPaymentToggle` modal with `InlineAddPaymentRow` sitting above the payments table. Description + amount + optional supplier; **Enter submits**; on success fields reset and focus returns to description for fast bulk entry. Supplier select gains a `+ New supplier…` option that expands an inline sub-form (name + category, defaults to "Other"); creating the supplier prepends it to the dropdown and auto-selects it for the in-progress payment. New `createSupplierQuick({name, category})` server action returns the new supplier id (the standard form-action returns void). `AddPaymentToggle.tsx` deleted.](#2026-05-07--v1740--inline-payment-add--inline-supplier-create) |
| **v1.73.0** | 2026-05-07 | [Songs page redesign — match `prototype/SongsPage.jsx`. New `SongsSummaryCards` grid renders one card per playlist (name · count · description, with category-coloured left bar) anchor-linking to that playlist's section. New `SpotifyConnectionBanner` — green gradient strip showing connection state + chips per playlist, visible only when Spotify is configured. Subtitle reformatted from `"X playlists · Y curated songs"` to `"X on the playlist · Y blocked · ~Hh Mm runtime"` with the prototype's 3.5 min/track heuristic. PlaylistCard sections now carry `id="playlist-<id>"` + `scroll-mt-4` so the new anchors land cleanly. Container drops `max-w-4xl` to go edge-to-edge.](#2026-05-07--v1730--songs-page-redesign) |
| **v1.72.3** | 2026-05-02 | [Drop the table-wrapper border on /guests so it matches the borderless row treatment used on /tasks. Remove `border border-border-soft rounded-sm bg-surface` from the table container; the row dividers + household subheader bands carry the visual structure on their own.](#2026-05-02--v1723--drop-guests-table-border) |
| **v1.72.2** | 2026-05-02 | [Always show household subheader on /guests — solo-household guests (e.g. Barry Scott, Gianmarco Schiaffonati) appeared visually nested under the previous household's subheader, since the v1.72.0 logic only rendered the household label when `guests.length > 1`. Now every household gets the muted `bg-muted` rule row with the household name, making boundaries unambiguous regardless of size. Indentation (`pl-7`) still only applies inside multi-member households so single-guest rows don't sit awkwardly indented under their own header.](#2026-05-02--v1722--always-show-household-subheader) |
| **v1.72.1** | 2026-05-02 | [Guests page width + linked-tasks strip polish — drop the `max-w-7xl mx-auto` constraint on `/guests` so the table goes edge-to-edge matching `/tasks`. Reshape `PageLinkedTasksStrip` from a centered card (`mx-auto max-w-5xl rounded-md shadow-sm`) into a flush full-width banner (`bg-surface border-b border-border-soft px-4 sm:px-6`) — same treatment as the supplier-filter banner on `/tasks`. Empty state collapses into the header row instead of a separate paragraph. Affects /songs, /seating/ceremony, /guests.](#2026-05-02--v1721--guests-width--linked-tasks-strip-polish) |
| **v1.72.0** | 2026-05-02 | [Guests page redesign — flat-table layout matching `prototype/GuestsPage.jsx`. Replaces the v1.17.0 `HouseholdBlock` card-based list with a single table (Name · Table · RSVP · Type · Tags · Dietary), household subheader rows when 2+ members, row-click → `/guests/[id]`. Tag-filter pill row above (driven by `allGroups`); compact search box; pills + search live on the same scrolling layer (no sticky-header band). Page subtitle changed from `"X invited · Y attending · Z pending · W declined"` to `"X confirmed · Y pending · Z total"` to match the prototype. `+1` badge on plus-one rows (parentGuestId). Container widened from `max-w-5xl` to `max-w-7xl`. `HouseholdBlock.tsx` deleted (its only consumer was the previous GuestList; inline editing now lives on the per-guest detail page). Sort/RSVP/Side/Show filter selects dropped — tag pills + search cover the common case; the heavier filtering can be re-introduced if the household-card flow is missed. Migration: none.](#2026-05-02--v1720--guests-page-redesign-flat-table) |
| **v1.71.0** | 2026-05-02 | [Inline task add everywhere + website links on all item cards — two quality-of-life features. (1) `+ Task` button added to the section-level `LinkedTasksPanel`, per-card `CardLinkedTasksPanel`, and all three `PageLinkedTasksStrip` instances (/songs, /guests, /seating/ceremony); new tasks are pre-linked to the section, card, or nav-tag respectively. Task rows are now interactive checkboxes (optimistic OPEN↔DONE toggle, `useTransition`). `PageLinkedTasksStrip` split into a server shell + `PageLinkedTasksRows` client component; panels show even when empty so the button is always reachable for editors. `UserOpt` re-exported from `AddTaskToggle`. (2) Optional `website` URL field added to `BookOutfit`, `BookBuildMaterial`, `BookBarItem`, and `BookSetupItem` (additive migration `20260510000000_website_on_items`). Edit mode shows a URL input on each item row; view mode shows a "Link ↗" anchor next to the supplier/source. `CardRouter`'s `Sub` type updated for all four item arrays.](#2026-05-02--v1710--inline-task-add-everywhere--website-links-on-item-cards) |
| **v1.70.0** | 2026-05-02 | [Ceremony deduplication + household clustering + reception seat drag-swap — three seating improvements. Ceremony allocator (`src/lib/ceremony-allocate.ts`): `GroupLite.members` now carries `GuestMember[]` (id · householdId · isChild) instead of a bare count. Deduplication: a guest appearing in multiple groups is allocated only to the lowest-`order` group; later groups show `duplicateCount` in their `GroupAllocation`. Household clustering: members with the same `householdId` are emitted consecutively so families sit together. Row-no-split: on BRIDE/GROOM groups, a multi-member household that won't fit the remaining row seats but fits a full row skips to the next row — gap seats are counted as unfilled. `CeremonyClient` legend shows a duplicate-guest warning banner and per-group `(N↑)` chip when duplicates exist. Reception `TableCard` gains drag-to-reorder seats via the HTML5 drag API — ⣿ handle + `onDragEnter` hover ring; `swapSeats` server action null-then-reassign transaction satisfies the unique constraint.](#2026-05-02--v1700--ceremony-deduplication--household-clustering--reception-seat-drag-swap) |
| **v1.69.0** | 2026-05-02 | [DB-backed invite system + welcome sign-out + couple label fix — replaces `AUTH_ALLOWED_EMAILS` allowlist with an in-app invite flow. New `Invite` model (email · role · isCouple · status · invitedBy). Settings page gains `InviteBlock`: send invite with role preset (Viewer / Wedding party / Planner / Couple), pending invites list with Resend/Revoke. `isAllowed()` in `auth.ts` made async and checks DB (existing user with emailVerified → allow; PENDING invite → allow; ENV fallback for bootstrap). `events.signIn` applies invite role/isCouple to the newly-created User row and marks invite ACCEPTED. Three new server actions (`createInvite` / `revokeInvite` / `resendInvite`) with couple-gate + audit log + HTML invite email via Nodemailer. Welcome page (`/welcome`) gains a "Sign out" server-action link — previously viewers with no firstName/name were trapped (no AppShell, no sign-out). Cosmetic fix: members with `isCouple: true` now display "couple" label in the Members panel (was showing role string).](#2026-05-02--v1690--db-backed-invite-system--welcome-sign-out--couple-label-fix) |
| **v1.68.0** | 2026-05-02 | [Design-pass brief — final piece of pre-2.0 prep documentation. New `docs/DESIGN-PASS-BRIEF.md` captures the goal (visual refresh shipping as v2.0.0), constraints (admin-only, no API changes, accessibility floor, dark-mode parity, print fidelity), and the user's explicit direction: **two themes** (Base + Whimsical Forest) × **two modes** (light + dark) = four combinations. Theme picker via new `User.theme` enum (the only schema change v2.0 is allowed). Designer entry point linking the four reference docs (component inventory, form patterns, mobile, brief).](#2026-05-02--v1680--design-pass-brief) |
| v1.67.0 | 2026-05-02 | [Guest profile pictures — manual upload per guest, replaces the initials placeholder. New `Guest.profilePictureFileId` column (additive migration), three new server actions (`uploadGuestProfilePicture` / `setGuestProfilePicture` / `clearGuestProfilePicture`), `<Avatar>` extended with `pictureFileId` prop. Upload UI on `/guests/[id]` (avatar-as-trigger pattern: tap the photo to upload), photos render on the guest list (HouseholdBlock rows) and the seating side panel. Skipped seating canvas seat-dots (too small to help) and catering-brief print (low marginal value). Originated from "is it possible to link guests with Facebook profile pictures?" — Facebook OAuth blocked by admin-only standing rule + Meta API restrictions; manual upload is the cleanest path.](#2026-05-02--v1670--guest-profile-pictures) |
| v1.66.0 | 2026-05-02 | [DR-1 mobile compatibility pass — first phase of pre-wedding hardening. Added `docs/MOBILE.md` codifying breakpoint / fixed-bottom / touch-target / table / modal / drawer conventions. Fixed five real bugs: Toaster sat behind the MobileTabBar (z-bumped + padding); QuickCapture success toast same; three tables (BookBuildCard materials, /guests/catering breakdown + dietary + meal-choice) lacked `overflow-x-auto`; SeatingCanvas was unusable on touch (now defaults to list view on first-visit mobile). Bumped touch targets on ConfirmDialog buttons (28px → 40px), AddNewModal close × (16px → 36px), ImageGallery detach × (24px → 32px, always-visible on touch). Page-level `p-6` paddings converted to `p-4 sm:p-6` across 18 pages so phones get more breathing room.](#2026-05-02--v1660--mobile-compatibility-pass-dr-1) |
| v1.65.0 | 2026-05-02 | [DP-4 form-pattern audit + DP-6 seed cleanup. New `docs/FORM-PATTERNS.md` codifies three legitimate form patterns (uncontrolled+action / controlled-per-field / single-draft-state) with a decision tree; flags the EventForm hybrid as deprecated for next-touch migration. `prisma/seed.ts` drops 6 legacy section slug seeds (wedding-party / venue / legal-admin / ceremony / reception / logistics) and the orphaned `seedWeddingPartySubsections` function — fresh DBs no longer get cluttered deprecated sections; existing prod data preserved via the `LEGACY_SLUGS` filter on /book. Seed file shrinks 2718 → 2681 lines.](#2026-05-02--v1650--dp-4-form-patterns--dp-6-seed-cleanup) |
| v1.64.0 | 2026-05-02 | [Pre-2.0 design-pass prep batch (DP-2 + DP-3 + DP-5). New `docs/COMPONENT-INVENTORY.md` documents every reusable UI primitive + which pages use what — the design pass's required input. Empty-state convention codified in `Illustrations.tsx` (top-level pages get illustrated `<EmptyState>`; nested-section empties get a single italic paragraph; "Add" verb everywhere). Audit-log final sweep — 9 bare `audit({entity, entityId})` calls enriched with snapshot fields per the v1.30.5 standing rule (`field-delete`, `field-set`, `recipe-update`, `shot-toggle`, `shot-delete`, `outfit-add`, `outfit-update`, `outfit-delete`, wedding-settings update with `changedFields` diff).](#2026-05-02--v1640--design-pass-prep-batch) |
| v1.63.0 | 2026-05-02 | [Image galleries on Wedding Book cards (user request: "centerpieces and clothing"). New reusable `<ImageGallery>` component with thumbnails for image MIMEs, click-to-zoom lightbox (← / → keyboard nav, Esc closes), three add paths (direct upload from camera roll / pick from existing /files / detach), and chip-text fallback for non-image attachments. Wired into BUILD (centerpieces, place cards, signage), OUTFIT (per-person reference photos — replaces v1.35.0's chip-only display), SETUP (space layouts), and STAY (bridal suite, property exterior). Schema gains `fileIds: String[]` on `BookBuildCard` / `BookSetupCard` / `BookStayCard` (additive). New server actions `uploadAndAttach<Kind>File` upload+attach in one step from a phone's camera roll.](#2026-05-02--v1630--image-galleries-on-book-cards) |
| v1.62.0 | 2026-05-02 | [`<ConfirmDialog>` component sweep — replaces all 40 native browser `confirm()` calls across 29 files with a single shared in-app dialog. New `<ConfirmProvider>` mounts at the AppShell level; new `useConfirm()` hook returns a Promise<boolean>. Body accepts `ReactNode` so callers can render structured content (SupplierCard's snapshot fields now render as a definition list instead of `\n`-joined plaintext). Tone supports `default` / `danger`. Esc + backdrop click cancel; cancel button focused on open (safer default for destructive actions). Critical pre-design-pass cleanup — designer redesigns one dialog instead of 40.](#2026-05-02--v1620--confirm-dialog-sweep) |
| v1.61.1 | 2026-05-02 | [Two bugs caught by the daily Claude bug-check session — (1) clearing every chip in the TaskDrawer / TaskForm Topics picker was a silent no-op (zero `topicKeys` entries → `formData.has("topicKeys")` false → server skipped the m2m `set:` ops → existing relations stayed intact). Fixed via a `__touched__` sentinel hidden input always emitted by TopicPicker (when editable) and always appended by TaskDrawer.save(). (2) `parseTopicKeys` had no test coverage despite v1.61.0 adding the `guestGroup:` prefix branch. Extracted to `@/lib/task-topics` (pure module) and covered with 10 new unit tests — total 552 (was 542).](#2026-05-02--v1611--task-topics-parser-bug--coverage) |
| v1.61.0 | 2026-05-02 | [XL1 — tasks-via-guest-groups (closes the last open punch-list item). New Task ↔ GuestGroup m2m mirroring Task ↔ BookSection / BookSubsection / NavTag. TopicPicker gains a fourth "Guest groups" section with colour swatches + member counts; tagged tasks surface on every member's `/guests/[id]` page in a "Tasks via groups" panel with done-bucket-to-bottom ordering and per-row chips showing which group(s) link the task. Read-time query — no auto-sync (v1.30.5 standing rule). Additive migration `_GuestGroupToTask`.](#2026-05-02--v1610--xl1-tasks-via-guest-groups) |
| v1.60.0 | 2026-05-01 | [Polish sweep (P1, P2, P3, P4, P5, P7, P8) — empty-state verb unified ("Create one above" → "Add one above"); supplier-delete confirm enriched with status / agreed amount / last contact; dirty-check on SupplierForm / GuestForm / EventForm (no more double-save mash); Today snapshot strip restructured (label + bits as siblings) so 1280px wraps cleanly; `:target` flash animation on book cards (one-shot, respects prefers-reduced-motion); BookSubsectionKind cast replaced with Zod-validated default; stale `removeUser` cleanup comment fixed. P6 already cleared in v1.53.0.](#2026-05-01--v1600--polish-sweep) |
| v1.59.0 | 2026-05-01 | [Inline "add to group" UX (C2) — each group toggle on the per-user editor card now shows the group's permissions inline ("EDIT: tasks, songs · VIEW: schedule") so the couple can see what ticking the box will grant without bouncing up to the Permission groups panel. Built-in chip row gets the same treatment.](#2026-05-01--v1590--inline-add-to-group-ux) |
| v1.58.0 | 2026-05-01 | [Cross-link sweep round 2 (XL4, XL7) — supplier detail page surfaces BUILD-card backlinks via `BookBuildCard.budgetLine.supplierId`. TaskDrawer chips deep-link to the entity (sections → /book/<slug>; subsections → /book/<sectionSlug>#<slug>; nav-tags → tag.route). XL2 + XL6 audited and confirmed substantially complete from v1.37.5 / per-card-kind shipping; XL1 deferred (needs Task↔GuestGroup schema design).](#2026-05-01--v1580--cross-link-sweep-round-2) |
| v1.57.0 | 2026-05-01 | [Cross-link sweep (XL3, XL5, XL8, XL9, XL10, XL11) — household cards summarise table seating, /budget rows show BUILD-card source chips, /payments + /songs accept supplier/guest deep-link filters, Today list surfaces topic chips next to titles, /seating honours #table-<id> fragments. XL1/2/4/6/7 deferred to v1.58.0 (need schema or larger scope).](#2026-05-01--v1570--cross-link-sweep) |
| v1.56.0 | 2026-05-01 | [Add-New affordances normalised to **popout modal** (reverses v1.55.0). User clarification: "I want the screens to popout". New shared `AddNewModal` wrapper centralises the centred-card + backdrop + Esc/× dismissal pattern. AddTaskToggle, AddEventToggle, AddHouseholdToggle, AddSupplierToggle, AddPlaylistToggle, AddTableToggle, AddPaymentToggle, AddSectionToggle, AddSubsectionToggle all use it.](#2026-05-01--v1560--add-new-affordances-popout-modal) |
| v1.55.0 | 2026-05-01 | [Add-New affordances normalised to inline-expand. `AddTaskToggle` and `AddEventToggle` were the last two pages still using the v1.27.0 fixed-position popover-modal pattern. Converted to the inline-expand card pattern every other page uses (AddHouseholdToggle, AddSupplierToggle, AddPlaylistToggle, AddTableToggle, AddPaymentToggle, AddSection/SubsectionToggle). Same UX everywhere: button → in-place form-card.](#2026-05-01--v1550--add-new-affordances-normalised) |
| v1.54.1 | 2026-05-01 | [Daily bug-check schedule — new `.github/workflows/daily-bug-check.yml` runs at 08:23 UTC every morning: `npm audit` (high+ fails the run), `npm outdated` (informational), TODO/FIXME accumulator, schema/migration drift check, `prisma format --check`. Findings show on the repo's red-❌ indicator; no notifications. Companion in-session Claude review cron fires at 09:17 local daily for the lifetime of the dev shell.](#2026-05-01--v1541--daily-bug-check-schedule) |
| v1.54.0 | 2026-05-01 | [🟡 Notable review fixes (A6–A10, B2–B5, B3 enrichment, C3–C6) — section enum on per-user perms, transactional clearAll, requireEdit gate on book visibility, deprecated `setCeremonyRowGroup` removed, bootstrap-couple race tightened, ceremony revalidatePath fixed, dead code purged, audit-log enrichment on Book CRUD + permission writes including `priorLevel`, reorder buttons (▲▼) on Permission groups + Nav tags, PageLinkedTasksStrip header treatment, `+ Add group` chip relocated.](#2026-05-01--v1540--notable-review-fixes) |
| v1.53.0 | 2026-05-01 | [Critical review fixes (A1–A5, B1, C1) — sign-in code rate limiter no longer double-counts (effective budget is 5 not 2–3); verify page reads email from httpOnly cookie not form (closes per-email rotation attack); pending VerificationToken siblings are invalidated on send; `/api/auth/callback/nodemailer` is now rate-limited; per-user permission overrides win unconditionally (NONE actually denies); slug-rename + delete on PermissionGroup cascades GroupPermission rows; destructive deletes on supplier / household / guest / budget category / line return result-shape with real error toasts.](#2026-05-01--v1530--critical-review-fixes) |
| v1.52.1 | 2026-05-01 | [Docs-only — three-agent code review (security/auth + data integrity + UX/IA) captured as a ranked punch list in the Backlog section. 6 🔴 ship-blockers, 14 🟡 notable, 11 🟢 cross-link opportunities, 8 ✨ polish items, each with file paths + suggested fix.](#2026-05-01--v1521--review-punch-list-captured) |
| v1.52.0 | 2026-05-01 | [Linked-tasks strips on /songs, /seating/ceremony, /guests (backlog #7) — reusable `PageLinkedTasksStrip` reads tasks tagged with a NavTag whose `route` matches the page path. Renders below `PageHeader`, hidden when zero matches. Done tasks bucket to the bottom with a strikethrough; "Manage →" deep-links to /tasks. No schema changes — uses the existing NavTag + Task m2m.](#2026-05-01--v1520--linked-tasks-strips-on-pages) |
| v1.51.0 | 2026-05-01 | [Inline task linking on cards (backlog #8) — parallel `Task ↔ BookSubsection` m2m alongside the existing section-level m2m. TopicPicker on Tasks/Questions gains a "Wedding Book — cards" group; book pages render a compact `LinkedTasksPanel` directly below each card with at least one linked task. Section-level link stays.](#2026-05-01--v1510--inline-task-linking-on-cards) |
| v1.50.0 | 2026-05-01 | [Numeric sign-in code (backlog #6) — sign-in email now contains a 6-digit code AND the magic link; either signs in. `/signin/verify` rewritten as a code-entry form with auto-fill from a short-lived cookie. Token TTL tightened from 24h to 15min, code-entry rate-limit (5 wrong guesses per 15 min) added on a separate bucket of `MagicLinkAttempt`. Audit log captures success / failure / rate-limit outcomes per attempt.](#2026-05-01--v1500--numeric-sign-in-code) |
| v1.49.0 | 2026-05-01 | [`GuestGroupsControl` — reusable chips + popover picker for managing per-guest group memberships. Wired into the guests list (inline pill strip), guest detail page (Details section), and seating canvas detail panel (read-only). Same `toggleGuestGroupMember` action everywhere; couple-only writes.](#2026-05-01--v1490--per-guest-group-affordances) |
| v1.48.0 | 2026-05-01 | [Auto-fill ceremony seating from ordered groups + side constraint. Couple manages an ordered list of guest groups (each with `side: BRIDE / GROOM / BOTH`); allocator walks the list, packing BRIDE groups on LEFT, GROOM on RIGHT, BOTH on whichever side has more space. Reorder buttons in Settings + on /seating/ceremony. Per-row manual assignments deprecated.](#2026-05-01--v1480--auto-fill-from-ordered-groups) |
| v1.47.0 | 2026-05-01 | [Ceremony seating fills by group member count — packs each group's members across its assigned rows aisle-outward. Three seat states: filled (full colour + glyph), spare (faded tint, no glyph — assigned but no member), neutral (unassigned). Legend shows guests-seated / reserved / spare-or-shortfall per group. Row panel surfaces per-row fill counts.](#2026-05-01--v1470--seat-allocation-from-member-count) |
| v1.46.0 | 2026-05-01 | [Group-coloured ceremony seating (backlog #5) — new `CeremonyRow` model maps `(side, rowIndex)` to a `GuestGroup`. Canvas tints every seat in an assigned row with the group's colour and overlays a glyph (first letter) for colour-blind accessibility. Couple-only Row Assignments panel below the SVG; legend lists groups in use with row + member counts.](#2026-05-01--v1460--group-coloured-ceremony-seating) |
| v1.45.2 | 2026-05-01 | [Role select in the per-user editor — `setUserRole` action drives membership in the role-based built-ins (Wedding party / Planners). Built-in member lists now print directive copy explaining how to change membership for each (toggle Couple-tier checkbox, change role, or remove the user) instead of opaque "not editable here". Last-admin lock extended to `setUserRole`.](#2026-05-01--v1452--role-select--directive-copy) |
| v1.45.1 | 2026-05-01 | [Last-admin lock + duplicate-name disambiguator. `setUserCouple` and `removeUser` server-side refuse to leave the running session with zero couple-tier admins; the UI shows a 🔒 chip on the last couple-tier user and disables their toggle/remove. Member lists now show email next to display name so two accounts sharing a name are distinguishable.](#2026-05-01--v1451--last-admin-lock--name-disambiguator) |
| v1.45.0 | 2026-05-01 | [Per-user editor — replace dense PermissionMatrix table with one expandable card per user (matching the spacing of PermissionGroupsBlock). Each card shows group memberships (toggleable for custom groups, read-only chips for built-ins), per-section overrides (default off; tick to override), couple toggle, and remove. New `clearAllUserOverrides` bulk-clear button per user.](#2026-05-01--v1450--per-user-editor) |
| v1.44.0 | 2026-05-01 | [Settings UX overhaul — per-user override matrix is now checkbox-driven (default = inherit from group; tick to override). Page panels grouped under named sections (Your account · Wedding details · Customisation · Access & members · Notifications & log) so the long stream of cards reads as a document with chapters. New `clearPermission` action deletes the override row when unticked.](#2026-05-01--v1440--settings-ux-overhaul) |
| v1.43.1 | 2026-05-01 | [Settings UX patch — explicit `Members` button on every permission group (was hidden behind clicking the title); read-only member list on built-in groups; dropped the sticky `<thead>` + nested-card styling on the per-user override matrix that was causing runaway-scroll feel inside the new collapsed panel. Trimmed wall-of-text description copy.](#2026-05-01--v1431--settings-ux-patch) |
| v1.43.0 | 2026-05-01 | [Group-driven permissions — new `GroupPermission` table attaches per-section levels to each `PermissionGroup` (built-in + custom). Effective level = `max(group, override)` per section; per-user `Permission` rows demoted to an "advanced overrides" panel. Built-in groups now editable for permissions (members still computed from role). Sensible seed defaults on couple / wedding-party / planners.](#2026-05-01--v1430--group-driven-permissions) |
| v1.42.0 | 2026-05-01 | [Two-track group model: rename `UserGroup` → `PermissionGroup` (admin app users) + new `GuestGroup` model (wedding guests, with colour). Settings page splits into two panels — Permission groups + Guest groups. Colour picker on each guest group; foundation for ceremony-seating colour-coding (#5).](#2026-05-01--v1420--permission-groups--guest-groups-split) |
| v1.41.0 | 2026-04-30 | [Schedule attendees rework (backlog #4) — `attendeeIds: String[]` becomes polymorphic `attendeeRefs: String[]` mixing `user:<id>` / `builtin:<slug>` / `group:<slug>` refs. Picker UI splits Groups + Individuals. Today page "Mine" filter resolves group membership server-side. Audit log shows attendee-kind breakdown.](#2026-04-30--v1410--schedule-attendees-rework-backlog-4) |
| v1.40.0 | 2026-04-30 | [User-group model (backlog #3) — `UserGroup` table + `User.groups` m2m + four built-in virtual groups (Everyone / Couple / Wedding party-by-role / Planners-by-role) computed from `User.role`. Couple-only Settings panel for CRUD. Foundation for the Schedule attendees rework (#4).](#2026-04-30--v1400--user-group-model-backlog-3) |
| v1.39.1 | 2026-04-30 | [Recent-activity feed on Today (couple-only) — last 10 audit rows rendered as human sentences via `formatAuditAction` + `timeAgo`. Auto-hides for non-couple users + when log is empty. Closes backlog item #2.](#2026-04-30--v1391--recent-activity-feed) |
| v1.39.0 | 2026-04-30 | [Audit-log enrichment sweep across non-Book modules — budget / seating / songs / guests / suppliers / payments / files / tasks all now emit snapshot fields + `changedFields` diff per the v1.30.5 standing rule. ~34 bare audits enriched. 29 new audit-format tests, 392 total.](#2026-04-30--v1390--audit-log-enrichment-sweep) |
| v1.38.6 | 2026-04-30 | [Critical: `prisma/seed.ts` had an unguarded `main()` call at the bottom that fired whenever the file was imported. Operator scripts (`reset-book.ts`, `seed-samples-only.ts`) import section seeders from it — so every operator-script run kicked off the full seed in parallel, hitting P2002 unique-constraint violations.](#2026-04-30--v1386--seed-ts-double-run-fix) |
| v1.38.5 | 2026-04-30 | [Book index hides empty legacy sections · BUILD seed targets `venue-decor` not legacy `venue` · stop seeding legacy `wedding-party` (the v1.35.0 split made it duplicate)](#2026-04-30--v1385--book-index--seed-de-duplication) |
| v1.38.4 | 2026-04-30 | [Wedding Book seed overhaul — every card kind now gets a fully-populated example (OUTFIT items + dates, SETUP items, LEGAL items + name-change checklist, FIELD defs everywhere, RECIPE cocktail, MENU kids/evening/late-night, BUILD welcome bags + favours, plus new Photography + Guest Experience seeders). All 12 card kinds covered.](#2026-04-30--v1384--wedding-book-seed-overhaul) |
| v1.38.3 | 2026-04-30 | [Operator scripts run in production — Dockerfile transpiles `seed-samples-only` + `reset-book` to `scripts-build/`; scripts use a local `PrismaClient` instead of `src/lib/db` so they don't depend on the Next standalone bundle. Invoke with `node scripts-build/scripts/<name>.js`.](#2026-04-30--v1383--operator-scripts-in-production-image) |
| v1.38.2 | 2026-04-30 | [`scripts/reset-book.ts` — destructive Book module reset gated on `CONFIRM_RESET_BOOK=yes`. Wipes + re-seeds every section + subpage; leaves users / tasks / guests / payments untouched.](#2026-04-30--v1382--book-module-reset-script) |
| v1.38.1 | 2026-04-30 | [`scripts/seed-samples-only.ts` — fills empty Book sections + subpages on prod without touching users / tasks / schedule / guests / seating. Section seeders refactored to be importable.](#2026-04-30--v1381--samples-only-prod-backfill-script) |
| v1.38.0 | 2026-04-30 | [Wedding Book closes the arc (P7b/B + P8) — SHOT_LIST gains category / time budget / **guest-list link** · FIELD gains group / helpText / required / numeric + date ranges · RECIPE gains servingsBase + structured `BookRecipeStep` (Json→rows migration) + day-before tag · Post-wedding section seeded · Production backfill script · Guest detail "Photos to capture" reverse query](#2026-04-30--v1380--wedding-book-arc-closes-p7bb--p8) |
| v1.37.5 | 2026-04-30 | [Cross-module wiring (P7b/Part C) — Today widgets for legal deadlines / outfit milestones / open decisions · Guest detail surfaces meal-choice deep-links + accommodation · Budget shows DIY-card linkbacks · Supplier shows "used in setup" rows](#2026-04-30--v1375--cross-module-wiring-p7b-part-c) |
| v1.37.2 | 2026-04-30 | [TEXT card list / blockquote rendering fix — Tailwind v4 has no `@tailwindcss/typography`, so `prose` was a no-op and bullets / numbers / quote borders all disappeared](#2026-04-30--v1372--text-card-list--blockquote-rendering-fix) |
| v1.37.1 | 2026-04-30 | [TEXT card View / Edit toggle — toolbar no longer leaks into read mode after save (matches every other v1.31+ card)](#2026-04-30--v1371--text-card-view--edit-toggle) |
| v1.37.0 | 2026-04-30 | [Wedding Book TEXT cards switch to Tiptap WYSIWYG (P7a) — 10-mark toolbar (Bold / Italic / Underline / H2 / H3 / lists / quote / link / undo / redo) · sanitiser allow-list with enforced `rel`+`target` on every anchor · idempotent SQL backfill for existing TEXT bodies](#2026-04-30--v1370--wedding-book-text-wysiwyg-p7a) |
| v1.36.0 | 2026-04-30 | [Wedding Book STAY + LODGING_GUIDE cards (P6) — one card per accommodation booking with cost / dates / linked guests · recommended-hotels reference card with print stylesheet · Accommodation section seeded with 4 STAY + 1 LODGING_GUIDE around Stratford-upon-Avon](#2026-04-30--v1360--wedding-book-stay--lodging_guide-cards-p6) |
| v1.35.1 | 2026-04-30 | [Migration fix — `CREATE EXTENSION pgcrypto` so `gen_random_bytes()` works in CI's bare Postgres image](#2026-04-30--v1351--migration-fix-pgcrypto) |
| v1.35.0 | 2026-04-30 | [Wedding Book OUTFIT rework (P5) — one card per wedding-party member with fitting timeline / cost / paid status / per-item composition / photos · Wedding Party split into People (OUTFIT cards) + Day-of (TEXT/FIELD timeline)](#2026-04-30--v1350--wedding-book-outfit-rework-p5--wedding-party-split) |
| v1.34.0 | 2026-04-30 | [Wedding Book LEGAL card (P4) — document checklist with deadlines + file attachments · Legal split into Before / Day / After (additive) · FieldLabel + Label lifted to shared `bookCardUi.tsx`](#2026-04-30--v1340--wedding-book-legal-card-p4--legal-split) |
| v1.33.2 | 2026-04-30 | [BOOK-EXPANSION-PLAN.md gains a temporary edit-row layout rule (§10a) so P4–P8 ship correct widths from day one](#2026-04-30--v1332--edit-row-layout-rule-pinned-into-the-card-creation-plan) |
| v1.33.1 | 2026-04-30 | [Edit-row layout pass — BUILD / BAR / SETUP cards switch to two-row grids with per-cell labels so name / supplier / £ all get usable width](#2026-04-30--v1331--edit-row-layout-pass) |
| v1.33.0 | 2026-04-30 | [Wedding Book SETUP card (P3) — per-space spatial walkthrough · Venue split into Spaces / Décor (additive)](#2026-04-30--v1330--wedding-book-setup-card-p3--venue-split) |
| v1.32.2 | 2026-04-30 | [BAR card: per-head pricing + serving timing — handles £2.50/head toast drinks; view groups by timing when set](#2026-04-30--v1322--bar-per-head-pricing--timing) |
| v1.32.1 | 2026-04-30 | [Audit log: 30-day retention sweep + search box on the Settings viewer](#2026-04-30--v1321--audit-log-retention--search) |
| v1.32.0 | 2026-04-30 | [Wedding Book MENU + BAR cards (P2) — food service composition with live guest selection counts, drinks plan with per-head sanity check · BUILD label renamed to "DIY" · audit log viewer now renders human sentences via `formatAuditAction`](#2026-04-30--v1320--wedding-book-menu--bar-cards-p2) |
| v1.31.1 | 2026-04-30 | [BUILD card UX pass — single Edit/View states · live Budget link · `/diy` overview page · £-input · clearer field hints · status-disappear bug fixed](#2026-04-30--v1311--build-card-ux-pass) |
| v1.31.0 | 2026-04-30 | [Wedding Book BUILD card (P1) — DIY production tracker with materials list, sessions log, prototype-blocker warning, copy-to-Budget action](#2026-04-30--v1310--wedding-book-build-card-p1) |
| v1.30.6 | 2026-04-30 | [Track `BOOK-EXPANSION-PLAN.md` in the repo (docs only) — sets the v1.31.0–v1.38.0 arc](#2026-04-30--v1306--track-book-expansion-plan-in-the-repo) |
| v1.30.5 | 2026-04-29 | [Schema cleanup + Topics multi-select · drop legacy `PhotographyShot` and `ScheduleEvent.audience` · combined Wedding Book section + NavTag picker on tasks · NavTag CRUD in Settings · audit-rule standing add + first-pass enrichment](#2026-04-29--v1305--schema-cleanup--topics-multi-select--audit-rule) |
| v1.30.0 | 2026-04-29 | [Tasks ↔ Wedding Book subsection link · picker on task forms + drawer · Linked tasks panel under each card on `/book/[slug]` with per-card search](#2026-04-29--v1300--tasks--wedding-book-subsection-link) |
| v1.29.0 | 2026-04-29 | [Task grouping: None / Assignee / Category / Supplier / Priority / Status · localStorage-persisted dropdown beside Sort · sectioned headers with counts](#2026-04-29--v1290--task-grouping) |
| v1.28.0 | 2026-04-29 | [Task ↔ Supplier link · supplier picker on Task / Question / Decision forms · Linked tasks section on supplier detail · `?supplier=` deep-link from supplier page](#2026-04-29--v1280--task--supplier-link) |
| v1.27.9 | 2026-04-29 | [Tasks polish: drop list container · wider rightmost columns · Type changer in the drawer · all-day events render "All day" instead of "01:00"](#2026-04-29--v1279--tasks-polish-round-3--all-day-display-fix) |
| v1.27.7 | 2026-04-29 | [Guest detail side panel on seating canvas — click a seated guest dot to open](#2026-04-29--v1277--guest-detail-side-panel-on-seating-canvas) |
| v1.27.6 | 2026-04-29 | [Photography migration: PhotographyShot rows → BookShot under a SHOT_LIST card · bespoke route deleted](#2026-04-29--v1276--photography-migration) |
| v1.27.5 | 2026-04-29 | [Mobile nav full `<Link>` revert (Tasks · Guests · sheet items)](#2026-04-29--v1275--mobile-nav-full-link-revert) |
| v1.27.4 | 2026-04-29 | [Tasks visual style match: text-underline List/Board tabs · dynamic category filter pills · Questions filter · "+ View" stub](#2026-04-29--v1274--tasks-visual-style-match-text-tabs--dynamic-category-pills) |
| v1.27.3 | 2026-04-29 | [Tasks polish round 2: full-width table with column headers · centred new-task popout · unified search/filter styling](#2026-04-29--v1273--tasks-polish-round-2-full-width-table--centred-popout--unified-styling) |
| v1.27.2 | 2026-04-29 | [Today page: working task checkbox + broader "My next tasks" priority list](#2026-04-29--v1272--today-page-working-checkbox--broader-task-list) |
| v1.27.1 | 2026-04-29 | [Schedule polish (split date+time, all-day toggle, attendees instead of audience) · seat-drag transform-only ghost · mobile version footer · table-size baseline ROUND-only](#2026-04-29--v1271--schedule-polish--seat-drag-transform--mobile-version--round-only-baseline) |
| v1.27.0 | 2026-04-29 | [Tasks polish: click-to-open right-side drawer · "+ New task" popout · sort options · cleaner search bar](#2026-04-29--v1270--tasks-polish-drawer--popout--sort--search) |
| v1.26.0 | 2026-04-29 | [Modular Wedding Book cards: TEXT · FIELD · RECIPE · SHOT_LIST · OUTFIT (kind picker, per-kind editors, shared chrome)](#2026-04-29--v1260--modular-wedding-book-cards) |
| v1.25.3 | 2026-04-29 | [Seating: table size baseline at 10 seats (capacity tweaks no longer reflow tables)](#2026-04-29--v1253--seating-table-size-baseline-at-10) |
| v1.25.2 | 2026-04-29 | [Mobile nav: service-worker cleanup + Today tab probe-revert to `<Link>` + roadmap "view as"](#2026-04-29--v1252--mobile-nav-sw-cleanup--today-tab-link-probe) |
| v1.25.1 | 2026-04-29 | [Seating: ghost-drag perf (refs not state) · mobile canvas height boost · mobile-only "drag is desktop-only" hint](#2026-04-29--v1251--seating-ghost-drag-perf--mobile-size--desktop-only-hint) |
| v1.25.0 | 2026-04-29 | [Email nudge digests (RSVPs + tasks) · seat-drag grab-offset · mobile navbar plain anchor](#2026-04-29--v1250--email-nudge-digests--seat-drag-offset--mobile-anchor) |
| v1.24.0 | 2026-04-29 | [Print stylesheets for /budget + /payments · BookSection couple-only audience · mobile navbar imperative-routing fix](#2026-04-29--v1240--print-stylesheets--booksection-visibility--mobile-navbar-fix) |
| v1.23.3 | 2026-04-29 | [Seating bugfix: freeze auto-crop viewBox during drag (drift fix)](#2026-04-29--v1233--seating-freeze-viewbox-during-drag) |
| v1.23.2 | 2026-04-29 | [Seating: notes/checklist into collapsible sidebar · auto-crop canvas · disable table-drag on mobile · ceremony save returns result](#2026-04-29--v1232--seating-collapsible-sidebar--canvas-auto-crop--mobile-drag-disable--ceremony-save-result) |
| v1.23.1 | 2026-04-29 | [Seating: notes + checklist global & always visible · obvious Reception/Ceremony tabs](#2026-04-29--v1231--seating-globalize-notes--checklist--obvious-tabs) |
| v1.23.0 | 2026-04-29 | [Seating notes + day-of checklists + ceremony placeholder page + bigger top table](#2026-04-29--v1230--seating-notes--day-of-checklists--ceremony-placeholder) |
| v1.22.10 | 2026-04-29 | [Seating polish: repack-on-shrink, glyph centering, HEAD label spacing, ghost dot during seat-drag, alignment guides during table-drag](#2026-04-29--v12210--seating-polish-repack-glyph-center-label-space-ghost-dot-alignment-guides) |
| v1.22.9 | 2026-04-29 | [Seating bugfix: capacity-shrink server-error overlay, HEAD dots flipped to top edge, dynamic name truncation, pointer-based seat drag](#2026-04-29--v1229--seating-bugfix-capacity-error-head-orientation-name-overlap-canvas-drag) |
| v1.22.8 | 2026-04-29 | [Seating: RSVP glyphs inside seat dots (✓ ? ~ ✗) for colour-blind accessibility](#2026-04-29--v1228--seating-rsvp-glyphs-inside-seat-dots) |
| v1.22.7 | 2026-04-29 | [Seating: RSVP-colored dots, HEAD/RECTANGLE seats, drag-between-seats, resizable grid, uniform S/M/L/XL, visible capacity buttons, click-once focus](#2026-04-29--v1227--seating-rsvp-dots-all-shape-seats-canvas-drag-resizable-grid-uniform-toggles) |
| v1.22.6 | 2026-04-29 | [Seating: snap-to-grid toggle + modify table capacity + pending guests in seat-picker](#2026-04-29--v1226--seating-snap-to-grid-toggle--modify-capacity--pending-in-picker) |
| v1.22.5 | 2026-04-29 | [Bugfix: hydration mismatch (#418/#482) on Today page + persistence race on seating canvas + decoupled dot/label scales](#2026-04-29--v1225--bugfix-hydration-persistence-race-decoupled-seating-scales) |
| v1.22.0 | 2026-04-28 | [Custom fields for Supplier + Task](#2026-04-28--v1220--custom-fields-for-supplier--task) |
| v1.21.0 | 2026-04-28 | [Audit log viewer + sticky search on /suppliers + /tasks](#2026-04-28--v1210--audit-log-viewer--sticky-search-on-suppliers--tasks) |
| v1.20.6 | 2026-04-28 | [Seating: drag-all-guests + RSVP tag in panel](#2026-04-28--v1206--seating-drag-all-guests--rsvp-tag-in-panel) |
| v1.20.5 | 2026-04-28 | [Seating canvas: bigger labels + S/M/L size selector](#2026-04-28--v1205--seating-canvas-bigger-labels--sml-size-selector) |
| v1.20.0 | 2026-04-28 | [Wedding details DB-backed (Settings UI + 10 ref replacements)](#2026-04-28--v1200--wedding-details-db-backed) |
| v1.19.6 | 2026-04-28 | [README rewrite: standing rules, current test pyramid, fix stale phase-status](#2026-04-28--v1196--readme-rewrite) |
| v1.19.5 | 2026-04-28 | [Email deliverability: Reply-To + List-Unsubscribe + DNS docs](#2026-04-28--v1195--email-deliverability-reply-to--list-unsubscribe--dns-docs) |
| v1.19.0 | 2026-04-28 | [Today page redesign + mobile nav fix + IllusCountdown port](#2026-04-28--v1190--today-page-redesign--mobile-nav-fix--illuscountdown-port) |
| v1.18.5 | 2026-04-28 | [Bugfix: edit questions and decisions](#2026-04-28--v1185--bugfix-edit-questions-and-decisions) |
| v1.18.0 | 2026-04-28 | [Decisions surfaced in nav + planner-only backlog catalogued](#2026-04-28--v1180--decisions-surfaced-in-nav--planner-only-backlog-catalogued) |
| v1.17.0 | 2026-04-28 | [Countdown breakdown · mobile pass · guest list filter/sort](#2026-04-28--v1170--countdown-breakdown--mobile-pass--guest-list-filtersort) |
| v1.16.0 | 2026-04-28 | [Task CSV importer + guest names on the seating canvas](#2026-04-28--v1160--task-csv-importer--guest-names-on-the-seating-canvas) |
| v1.15.0 | 2026-04-28 | [Phase R5b: illustrations ported + Custom Fields UI (C6 + C10)](#2026-04-28--v1150--phase-r5b-illustrations-ported--custom-fields-ui-c6--c10) |
| v1.14.0 | 2026-04-28 | [Phase R5a: Bucket C drift decisions (C1 + C4 + C7 + C11)](#2026-04-28--v1140--phase-r5a-bucket-c-drift-decisions-c1--c4--c7--c11) |
| v1.13.0 | 2026-04-28 | [Phase R4c: polish MINORs (B6 + B7 + B9) — Bucket B complete](#2026-04-28--v1130--phase-r4c-polish-minors-b6--b7--b9--bucket-b-complete) |
| v1.12.0 | 2026-04-28 | [Phase R4b: data + UX MINORs (B5 + B8 + B11 + B12)](#2026-04-28--v1120--phase-r4b-data--ux-minors-b5--b8--b11--b12) |
| v1.11.0 | 2026-04-28 | [Phase R4a: workflow polish (B1 + B2 + B3 + B4)](#2026-04-28--v1110--phase-r4a-workflow-polish-b1--b2--b3--b4) |
| v1.10.0 | 2026-04-28 | [Phase R3 follow-on: Postgres-backed integration job + Playwright e2e in CI](#2026-04-28--v1100--phase-r3-follow-on-postgres-integration-job--playwright-e2e-in-ci) |
| v1.9.0 | 2026-04-28 | [Book sections aligned with prototype + Spotify env-var compose fix](#2026-04-28--v190--book-sections-aligned-with-prototype--spotify-env-var-compose-fix) |
| v1.8.0 | 2026-04-28 | [Spotify integration setup guide + status chip on Songs](#2026-04-28--v180--spotify-integration-setup-guide--status-chip) |
| v1.7.0 | 2026-04-28 | [Tier 3 / A: +1s materialise as own Guest rows](#2026-04-28--v170--tier-3-1s-as-own-guest-rows) |
| v1.6.0 | 2026-04-28 | [Tier 2 user-feedback polish: Schedule table view + Wedding Book hub redesign](#2026-04-28--v160--tier-2-user-feedback-polish) |
| v1.5.0 | 2026-04-28 | [Tier 1 user-feedback polish: mobile signout, Settings UI defence, scroll, 4-col Glance, countdown breakdown](#2026-04-28--v150--tier-1-user-feedback-polish) |
| v1.4.0 | 2026-04-28 | [Phase R3 (partial): tests in CI + TESTING.md + integration scaffold](#2026-04-28--v140--phase-r3-partial-tests-in-ci--testingmd--integration-scaffold) |
| v1.3.0 | 2026-04-28 | [Phase R2: magic-link rate limit + archived-guest restore](#2026-04-28--v130--phase-r2-magic-link-rate-limit--archived-guest-restore) |
| v1.2.4 | 2026-04-28 | [Dockerfile copies `.npmrc` — first version of the v1.2.x line that built green in CI](#2026-04-28--v124--dockerfile-copies-npmrc-so-the-legacy-peer-deps-actually-applies-in-ci) |
| _(no tag)_ | 2026-04-28 | v1.2.1 / v1.2.2 / v1.2.3 — three failed CI fix attempts; not tagged on principle (only green-CI SHAs get tags). Documented in the changelog for traceability. |
| **v1.2.0** | 2026-04-28 | [Phase R1: trust restoration (audit fixes + Vitest)](#2026-04-28--v120--phase-r1-trust-restoration-audit-fixes--vitest) |
| v1.1.0 | 2026-04-27 | [At a Glance dashboard](#2026-04-27--v110--at-a-glance-dashboard) |
| v1.0.0 | 2026-04-27 | [🎉 Release-1 design polish across all pages](#2026-04-27--v100--release-1-design-polish-across-all-pages) |
| v0.15.0 | 2026-04-27 | [Phase G2 day-of mode + quick-capture](#2026-04-27--v0150--phase-g2-day-of-mode--quick-capture) |
| v0.14.0 | 2026-04-27 | [Phase G1 Spotify playlist sync](#2026-04-27--v0140--phase-g1-spotify-playlist-sync) |
| v0.13.0 | 2026-04-27 | [Phase F2 photography shot list](#2026-04-27--v0130--phase-f2-photography-shot-list) |
| v0.12.0 | 2026-04-27 | [Import merge + guest detail page + catering letterhead](#2026-04-27--v0120--import-merge--guest-detail-page--catering-letterhead) |
| v0.11.1 | 2026-04-27 | [coerceBool dash placeholder fix](#2026-04-27--v0111--import-stop-warning-on--boolean-placeholders) |
| v0.11.0 | 2026-04-27 | [Phase F1 catering brief](#2026-04-27--v0110--phase-f1-catering-brief-printable-summary) |
| v0.10.0 | 2026-04-27 | [Children's-meal + RSVP link import + cross-page surfaces](#2026-04-27--v0100--childrens-meal--rsvp-link-import-cross-page-surfaces-windows-guide) |
| v0.9.1 | 2026-04-27 | [Import copy: Guest vs User email scope](#2026-04-27--v091--import-copy-clarify-guest-vs-user-email-scope) |
| v0.9.0 | 2026-04-27 | [Phase E feature-complete (real Say I Do CSV)](#2026-04-27--v090--phase-e-feature-complete-real-say-i-do-csv-ingest) |
| v0.8.0 | 2026-04-27 | [Phase E — CSV / TSV guest import (initial)](#2026-04-27--v080--phase-e-csv--tsv-guest-import) |
| v0.7.1 | 2026-04-27 | [Seating-position bugfix](#2026-04-27--v071--bugfix-seating-table-positions-survive-navigation) |
| v0.7.0 | 2026-04-27 | [First/last name + welcome prompt + Settings profile](#2026-04-27--v070--first--last-name-fields--welcome-prompt--settings-profile-panel) |
| v0.6.0 | 2026-04-27 | [Phase D2 — drag-and-drop seating canvas](#2026-04-27--v060--phase-d2-drag-and-drop-seating-canvas) |
| v0.5.0 | 2026-04-27 | [Per-file visibility + file management UX](#2026-04-27--v050--per-file-visibility--file-management-ux) |
| v0.4.1 | 2026-04-27 | [Remove members from Settings](#2026-04-27--v041--remove-from-members-in-settings) |
| v0.4.0 | 2026-04-27 | [Phase D1 file uploads + bootstrap admin + styled email](#2026-04-27--v040--phase-d1-file-uploads--bootstrap-admin--pretty-magic-link-email) |
| v0.3.2 | 2026-04-27 | [🚀 Live on Unraid + post-deploy back-ports](#2026-04-27--v032--live-on-unraid--post-deploy-back-ports) |
| v0.3.1 | 2026-04-27 | [Deploy-readiness fixes](#2026-04-27--v031--deploy-readiness-fixes) |
| v0.3.0 | 2026-04-27 | [Phase C — production deploy stack](#2026-04-27--v030--phase-c--production-deploy) |
| v0.2.0 | 2026-04-27 | [Phase B — domain pages](#2026-04-27--v020--phase-b--domain-pages) |
| v0.1.0 | 2026-04-27 | [Phase A — bootable shell](#2026-04-27--v010--phase-a--bootable-shell) |

**Bold** = currently running in production (`claude/main` tip). _Italics_ = on `dev` only, awaiting promotion.

## What's shipped

### Phase A — Bootable shell
- [src/app/globals.css](src/app/globals.css), [src/app/layout.tsx](src/app/layout.tsx) — Tailwind v4 + token palette ported from `prototype/tokens.css`, dark mode with FOUC prevention
- [src/auth.ts](src/auth.ts), [src/auth.config.ts](src/auth.config.ts), [src/middleware.ts](src/middleware.ts) — Auth.js v5 magic-link, email allow-list, JWT session, audit log on sign-in, couple-only route gating
- [src/app/signin/](src/app/signin) — sign-in / verify / error pages
- [src/lib/db.ts](src/lib/db.ts), [src/lib/permissions.ts](src/lib/permissions.ts), [src/lib/audit.ts](src/lib/audit.ts), [src/lib/format.ts](src/lib/format.ts), [src/lib/actions.ts](src/lib/actions.ts) — shared infra
- [src/components/ui/](src/components/ui) — Button, StatusPill, Avatar, Tag, Input, PageHeader, Toast, ComingSoon
- [src/components/shell/](src/components/shell) — AppShell (RSC), Sidebar, MobileTabBar, AvatarMenu, DarkModeScript
- [src/app/(app)/page.tsx](src/app/(app)/page.tsx) — Today with live RSVP/task/event counts, days-to-wedding
- [src/app/api/health/route.ts](src/app/api/health/route.ts) — DB ping endpoint
- [prisma/seed.ts](prisma/seed.ts) — seeds the 5 named users + sample tasks/events/household/book sections

### Phase B — Domain pages
Each section has server actions wrapped with `requireEdit(section)` + `audit()`, with `revalidatePath` on mutate.

| Page | What works |
|------|------------|
| [Schedule](src/app/(app)/schedule/page.tsx) | CRUD events with audience tags |
| [Tasks](src/app/(app)/tasks/page.tsx) | List + filter (All/Mine/Open/Done), priority dots, status cycle, inline edit |
| [Questions](src/app/(app)/questions/page.tsx) | Open/Answered groups, inline answer textarea |
| [Suppliers](src/app/(app)/suppliers/page.tsx) | Cards grouped by category, status dropdown, agreed amount |
| [Budget](src/app/(app)/budget/page.tsx) (couple) | Categories with line table, planned/actual/paid summary |
| [Payments](src/app/(app)/payments/page.tsx) (couple) | Table with quick "Mark paid", supplier link, status pills |
| [Songs](src/app/(app)/songs/page.tsx) | Playlists by category, song CRUD |
| [Guests](src/app/(app)/guests/page.tsx) | Households grouped by side, RSVP dropdown, dietary, child/+1 flags |
| [Files](src/app/(app)/files/page.tsx) | Reference index (real upload deferred) |
| [Wedding Book](src/app/(app)/book/page.tsx) | Hub + per-section page editor with inline title/body editing |
| [Seating](src/app/(app)/seating/page.tsx) | Table cards, dropdown to assign attending guests (drag canvas deferred) |
| [Settings](src/app/(app)/settings/page.tsx) | Per-user × per-section permission matrix |

### Phase C — Production deploy
- [Dockerfile](Dockerfile) — multi-stage standalone bundle, non-root UID 1000, tini, healthcheck on `/api/health`
- [docker/entrypoint.sh](docker/entrypoint.sh) — `prisma migrate deploy` before app start
- [docker-compose.yml](docker-compose.yml) — 4 services, 2 networks, no host ports for db/web, read-only FS, cap_drop ALL, no-new-privileges
- [caddy/Caddyfile](caddy/Caddyfile) — auto-TLS, HSTS, CSP, COOP/CORP, dotfile blocks, body cap, rate-limit stub
- [.env.production.example](.env.production.example) — every var the compose stack needs
- [src/app/robots.txt/route.ts](src/app/robots.txt/route.ts) + middleware whitelist — `Disallow: /`
- Backup service with **7d / 4w / 12m** pg_dump retention to `./backups/`
- README has full deploy walkthrough, ops commands, hardening notes, Cloudflare Tunnel alternative

### Phase D2 — Seating canvas (v0.6.0)
- [src/app/(app)/seating/SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — SVG canvas, viewBox 1400×900, faint grid pattern, tables drawn as circle (round) / rounded rect (rectangle / head). Visual size scales with capacity.
- Pointer Events for unified mouse/touch drag with `setPointerCapture`. Drag updates local positions only; on `pointerup`, snaps to a 20-unit grid (when within 10 px of a grid point) and commits via `updateTablePosition` server action.
- Click-without-drag focuses the table and opens a side panel with seat assignments (reusing the seat-dropdown UX from the list view) plus a delete button.
- Keyboard accessibility: arrow keys nudge the focused table by 20 units; ⇧+arrow does 80. Tables are tabbable with descriptive aria-labels.
- [src/app/(app)/seating/SeatingClient.tsx](src/app/(app)/seating/SeatingClient.tsx) — view toggle between Canvas and List; choice persists to `localStorage` so it survives reloads.
- [src/app/(app)/seating/actions.ts](src/app/(app)/seating/actions.ts) — new `updateTablePosition(id, x, y, rotation?)` action, gated by `requireEdit("seating")` and audited. `createTable` now spreads new tables across a 3-column / 280×240 grid instead of stacking them all at (0,0).

### Phase D1 — File uploads (v0.4.0)
- [src/lib/uploads.ts](src/lib/uploads.ts) — MIME allowlist, 25 MB cap, content-addressable filename, path-traversal defence
- [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) — `uploadFile` multipart server action (replaces the old reference-only `registerFile`) with on-error rollback of the on-disk write; deletion removes both DB row and physical file
- [src/app/api/files/[id]/route.ts](src/app/api/files/[id]/route.ts) — auth-gated streaming download, `inline` for PDFs/images/text, `attachment` for everything else, RFC 5987 filenames
- [src/app/(app)/files/FilesClient.tsx](src/app/(app)/files/FilesClient.tsx) — drag-and-drop or click-to-upload zone, MIME-aware row icons, click-to-download links
- [next.config.ts](next.config.ts) + [caddy/Caddyfile](caddy/Caddyfile) — body-size budget raised to 26 MB at both layers
- [Dockerfile](Dockerfile) — pre-creates `/app/uploads` with `node:node` ownership so the named volume mounts writable for UID 1000

## Deferred / Backlog

Ranked roughly by usefulness × ease. **Standing rule (28 Apr 2026):**
Wedding Hub is admin-only — planners + couple + wedding party. Guest
data is managed via Say I Do, not in-app. So no items below should
introduce guest-facing surfaces (public RSVP forms, guest portals,
magic links sent to invitees, etc.). If a feature drifts toward giving
guests access, defer to "out of scope" rather than building behind a
feature flag.

### Pre-2.0 plan — captured 2 May 2026

**Direction.** User picked **(1) visual refresh** for the design pass + **(3) day-of readiness** for the v2.x arc to wedding day. Public-facing surfaces (option 2) deferred until after the wedding.

**Phase A — design-pass readiness (v1.62.0 → v1.69.x).** Cleanup work that makes the design pass a single coherent task instead of 40 fiddly redesigns. Anything visual that has split implementations gets unified to ONE pattern before the designer sees it. Then the design pass redesigns that one pattern and every caller inherits.

| Status | ID | Item | Sizing |
|---|---|---|---|
| ✅ v1.62.0 | DP-1 | `<ConfirmDialog>` sweep — 40 native confirms → one shared component. | shipped |
| open | DP-2 | **Component inventory doc** — short markdown listing every reusable UI primitive (`Button`, `Input`, `Tag`, `StatusPill`, `AddNewModal`, `ConfirmDialog`, `Toaster`, `Avatar`, `EventMotifIcon`, `Illustrations`, etc.) and every page that uses them. Designer's required input. | ~1 hr |
| open | DP-3 | **Empty-state convention** — survey existing patterns (`Illustrations.tsx` on some pages, bare `<p>No items yet.</p>` on others). Pick one. Convert holdouts. | ~2 hrs |
| open | DP-4 | **Form patterns audit** — 3-4 form patterns coexist (TaskDrawer's controlled-state-everywhere, SupplierForm's onChange-dirty-flag, EventForm's hybrid). Designer needs to know which to optimise for; we should pick before they start. | ~30 min audit, then size depends on pick |
| open | DP-5 | **Audit-log enrichment final sweep** — grep for bare `audit({entity, entityId})` calls without metadata. Per-feature enrichment from v1.30.5+ caught most; this is the leftover sweep. | ~1-2 hrs |
| open | DP-6 | **Seed cleanup pass** — `prisma/seed.ts` is ~3000 lines; some legacy section slugs still seeded. Audit + consolidate. | ~2 hrs |
| open | DP-7 | **Production promotion** of v1.60.0 → v1.62.0 (currently 4 ships ahead of `claude/main`). Always promote before structural work. | ~10 min |

**Phase B — design pass (v2.0.0).** External Claude design pass. Receives DP-2 (component inventory) and DP-3/4 (resolved patterns) as input. Outputs a redesigned design language that re-skins the existing components without changing their API contracts. Ship as **v2.0.0** when complete.

**Phase C — day-of readiness (v2.1.x → v2.x.0).** Pre-wedding hardening, sequenced backwards from 26 Sep 2026.

| ID | Item | Sizing | Target |
|---|---|---|---|
| DR-1 | **Mobile pass on `/today/day-of` and ceremony seating** — real-conditions test on a real phone, find friction. Print fallbacks where they make sense (catering brief, seating, run-of-day). | ~3 hrs | v2.1.0 (Jun 2026) |
| DR-2 | **Backup + restore drill** — has the backup script ever been restored? Test on a copy of prod. | ~2 hrs | v2.1.0 (Jun 2026) |
| DR-3 | **Day-of-mode rehearsal** — sit down with the actual day-of-mode page and use it for a fictional wedding morning. Document what's missing. | ~1 hr + sized fixes | Jun-Jul 2026 |
| DR-4 | **Print stylesheets review** — every printable surface (catering brief, seating, run-of-day, lodging guide). Test on real paper. | ~2 hrs | Jul 2026 |
| DR-5 | **Offline mode / service worker** — defer until after design pass since it's heavy. Decision needed by mid-Aug. | ~6-10 hrs | Aug 2026 |
| DR-6 | **Wedding-day freeze procedure** — document what NOT to deploy in the last 7 days. Standing rule but worth writing down. | ~30 min | Sep 2026 |
| DR-7 | **DMARC follow-ups** — operational items already logged below; clear before Aug. | ~1 hr | Aug 2026 |

**Phase D — post-wedding (v2.x+).** Public-facing surfaces if revisited (RSVP form, guest portal, song requests by guest), permission-group framework refinements, ceremony-allocator tuning based on actual headcount.

### Review punch list — captured 1 May 2026 (closed)

**Status: 40/40 cleared** as of v1.61.0 (XL1) + v1.62.0 (P2 substantively replaced by ConfirmDialog sweep). Kept below for history.

After clearing the original backlog (#1–#8 shipped across v1.39.0 →
v1.52.0), three parallel review agents — security/auth, server-side
data integrity, UX/IA/cross-links — produced a single ranked punch
list. Items below carry IDs (`A` = auth, `B` = data, `C` = UX, `XL` =
cross-link, `P` = polish) for easy referencing in commits.

**Suggested cadence.** Land 🔴 Critical as **v1.53.0** before the next
deploy — most are sub-30-line diffs. 🟡 Notable rolls into **v1.54.0**.
🟢 Cross-link sweep slots in as **v1.55.0** (one Promise per page; the
v1.30.5 read-time-query rule means no schema work). ✨ Polish items
trickle in alongside whatever feature work is open.

#### 🔴 Critical (ship-blockers)

| ID | Files | Issue | Fix | Size |
|---|---|---|---|---|
| **A1** | `src/lib/rate-limit.ts:87-135`<br>`src/app/signin/verify/page.tsx:39-71` | Verify-code rate limiter double-counts. `bucket: "guess"` writes a row on the *pre-check* (when `decision.ok`); the page then *also* calls `recordFailedGuess` on a wrong code. One wrong guess = two rows. Effective budget: 2–3 guesses, not 5. | Split `checkGuessLimit()` (read-only) from `recordFailedGuess()` (write-on-fail). Pre-check no longer records. | ~15 lines |
| **A2** | `src/app/signin/verify/page.tsx:28, 66-67`<br>`src/app/signin/page.tsx:24-32` | Verify page trusts the **form-submitted** `email` field, not the httpOnly cookie. Attacker can rotate across known allowlisted emails to get 25 guesses/15min on a 1M-space code; also burns legit users' lockout budget. | Read email from `signin-email` cookie. If absent → redirect to `/signin`. Drop the form `<input>` to read-only display. | ~20 lines |
| **A3** | `src/auth.ts:165-230` | Auth.js `PrismaAdapter` doesn't invalidate prior pending tokens. Two sends within 15 min → two valid 6-digit codes for the same email. | In `sendVerificationRequest`, `db.verificationToken.deleteMany({ where: { identifier } })` *before* the adapter writes the new row. | ~5 lines |
| **A4** | new middleware or `src/middleware.ts` | `/api/auth/callback/nodemailer` has no rate limit — bypasses the verify-page bucket entirely. Direct GET with `?token=...&email=...` is wide open for brute-force. | Add rate-limit middleware on `/api/auth/callback/*` when `?token` is present. Reuse the `bucket: "guess"` machinery. | ~30 lines |
| **A5** | `src/lib/permissions.ts:95-100` | Per-user `NONE` overrides are silently no-ops. `mergeOverrides` does `max(group, override)`, so an override of NONE never lowers the inherited level. The Settings UI still offers NONE on the per-user matrix → ghost UI. | **Decision needed.** Either change `mergeOverrides` to "override wins unconditionally when present" (matches v1.43.0 design intent) and rebuild the unit tests, OR grey out levels weaker than the inherited level in the UI. Lean: behaviour change. | ~30 lines + test updates |
| **B1** | `src/app/(app)/settings/permission-group-actions.ts:86-128, 131-155` | Renaming a `PermissionGroup` slug orphans every `GroupPermission` row keyed on `group:<old-slug>`. `deletePermissionGroup` has the same hazard — rows survive as zombies. | In `updatePermissionGroup`, when slug changes: `updateMany({ where: { groupKey: "group:<old>" }, data: { groupKey: "group:<new>" } })` in the same transaction. In `deletePermissionGroup`, `deleteMany` for the slug. | ~20 lines |
| **C1** | `src/app/(app)/suppliers/SupplierCard.tsx:62-67`<br>`src/app/(app)/guests/HouseholdBlock.tsx:117, 213`<br>`src/app/(app)/budget/BudgetClient.tsx:136-138, 223-227`<br>+ ~5 more | Destructive actions throw raw — silent failures in production. 32 raw throws across 7 action files; Next prod redaction swallows the message → user sees nothing happen. | Migrate each delete action to the v1.30.5 `{ ok, error }` result-shape pattern. Wrap callers in try/catch + `notify("error", res.error)`. | ~80 lines across the sweep |

#### 🟡 Notable (ship soon)

| ID | Files | Issue | Fix |
|---|---|---|---|
| **A6** | `src/auth.ts:91-96, 245-258` | Bootstrap-as-couple race. Two simultaneous first-sign-ins from different allowlisted addresses can both pass `shouldBootstrapAsCouple` and both stamp `isCouple = true`. Low risk for a 5-user app. | Conditional update (`where: { id, isCouple: false }`) + retry, or accept it. |
| **A7** | `src/app/(app)/settings/actions.ts:9-13, 52-56` | `setPermSchema` / `clearPermSchema` use `z.string().min(1)` for `section`. Couple can write rows with section `"made-up-thing"` — never resolves but pollutes the table. `setGroupPermission` already validates with `z.enum(SECTIONS)`. | Same `z.enum(SECTIONS)` on both per-user schemas. |
| **A8** | `src/app/(app)/settings/actions.ts:108-110` | `clearAllUserOverrides` non-transactional. Find-then-deleteMany has a window where another admin's `setPermission` lands between → audit under-reports. | Wrap in `db.$transaction`. |
| **A9** | `src/app/(app)/book/actions.ts:205-251` | `setBookSubsectionVisibility` / `setBookSectionVisibility` use `requireUser`, not `requireEdit("book")`. Couple-tier user with `book` set to NONE can still flip visibility. | Add `requireEdit("book")` before the `isCouple` check. |
| **A10** | `src/app/(app)/seating/actions.ts:521-601` | `setCeremonyRowGroup` writes to the v1.48.0-deprecated `CeremonyRow` table. Action unreferenced from any UI but still exported — stale browser tab could happily write rows. | Delete the export, OR throw with a clear "deprecated as of v1.48.0" message. |
| **B2** | `src/app/(app)/settings/guest-group-actions.ts:89-90, 154-155, 184-185, 239-240, 318-319` | `revalidatePath('/seating')` doesn't reach `/seating/ceremony` (App Router segment scoping). Re-orders + side flips + member toggles look unapplied until hard reload. | Add `revalidatePath('/seating/ceremony')` to every guest-group write. |
| **B3** | `src/app/(app)/book/actions.ts:49, 56, 187, 196, 343, 397, 679, 693, 768, 782, 2100, 2132`<br>`src/app/(app)/settings/permission-group-actions.ts:271-296`<br>`src/app/(app)/settings/actions.ts:34-44` | Audit-log gaps. `deleteBookSection` doesn't read the row first — audit gives an opaque cuid. Several other Book CRUD actions same. `setGroupPermission` and `setPermission` don't capture `priorLevel`. | Pre-read for snapshot, push `changedFields` + `priorLevel` per the v1.30.5 standing rule. |
| **B4** | `prisma/seed.ts:2707-2736` | `seedCeremonyRowAssignments` is dead code — removed from `main()` in v1.48.0 but the function still exists referencing `db.ceremonyRow`. Future operator script importing it would silently re-populate the deprecated table. | Delete the function. |
| **B5** | `src/lib/ceremony-fill.ts` | Fully orphaned. v1.47.0's per-row model; v1.48.0 replaced it with `ceremony-allocate.ts`. Nothing imports it. | Delete the module + its test file. |
| ~~**C2**~~ ✅ v1.59.0 | `src/app/(app)/settings/MemberOverridesBlock.tsx`<br>`src/app/(app)/settings/PermissionGroupsBlock.tsx` | Adding a wedding-party member to a custom group requires bouncing between two panels (MemberOverrides for the user, PermissionGroups for the group's checkbox grid). UX assumes a different mental model from the data model. | ~~Each user-card's expanded view should have an *inline* "Add to group" multi-select (mirroring `GuestGroupsControl` on /guests).~~ Shipped a different fix: the user-card already had toggleable group checkboxes from v1.45.0; what was missing was visibility into what each group grants. Each toggle now shows the perm summary inline. |
| **C3** | `src/app/(app)/settings/PermissionGroupsBlock.tsx`<br>`src/app/(app)/settings/NavTagsBlock.tsx` | Reorder buttons (▲▼) missing on permission groups + nav tags. Schema has `order`; `reorderGuestGroup` exists for guest groups; the others don't. | Add ▲▼ next to Edit/× in each row. New `reorderPermissionGroup` + `reorderNavTag` actions following the existing pattern. |
| **C4** | `src/components/ui/PageLinkedTasksStrip.tsx:77-94` | v1.52.0 strip header reads as metadata, not a section. Same `text-[10px] uppercase tracking-wider font-bold text-ink-tertiary` treatment as column labels. | Bump header to `text-xs font-semibold text-ink-primary`. Add a faint left rule or small icon. |
| **C5** | `src/app/(app)/guests/HouseholdBlock.tsx:306-314`<br>`src/components/ui/GuestGroupsControl.tsx:96-106` | `+ Add group` chip on guests with no memberships is buried in the meta-pill row (next to +1, child, table, song-count). Eye learns to ignore that 10px chip cluster. | When `memberGroups.length === 0` and `canEdit`, render the affordance as right-aligned ghost text aligned with the row's Edit/× action buttons, not in the chip row. |
| **C6** | `src/app/(app)/songs/page.tsx:78` | Spotify chip on /songs deep-links to `/settings#spotify-integration`, but post-v1.44.0 reorg the SpotifySettingsPanel may not have a matching `id` (now nested inside `<SettingsSection title="Wedding details">`). | Verify the anchor resolves; add `id="spotify-integration"` to the panel root if missing. |

#### 🟢 Cross-link opportunities (data exists, just not surfaced)

All fall under the v1.30.5 read-time-query rule. No schema work — just additional `db.X.findMany` calls on existing pages. Bundle as a v1.55.0 cross-module-wiring sweep.

| ID | Page | Surface |
|---|---|---|
| ~~**XL1**~~ ✅ v1.61.0 | `/guests/[id]` | Tasks linked via the guest's groups (their group → that group's tasks). ~~Already loaded; just join.~~ Punch-list reading was wrong — the join didn't exist. v1.61.0 added the new Task ↔ GuestGroup m2m, threaded it through the TopicPicker, and surfaced linked tasks in a "Tasks via groups" panel on each member's detail page. |
| **XL2** | `/guests/[id]` | Files / budget-lines / STAY card linkbacks (some present for suppliers, missing for guests). |
| **XL3** | `/guests` | Household card — summarize "members at N tables (Top, Family-3)". `tableSeat.table` is already in the page query. |
| **XL4** | `/suppliers/[id]` | Files linked to the supplier and BUILD cards whose `budgetLine.supplierId === id`. |
| **XL5** | `/budget` | Line rows don't show their source BUILD card. v1.31.0 "Copy to Budget" creates the link but it's invisible per-row. Thread `Map<lineId, buildCard>` through to LineRow. |
| **XL6** | `/book/[slug]` | BookSubsection cards show inline tasks (v1.51.0) but not linked suppliers (via `setupItem.source`), files, or budget lines. |
| **XL7** | TaskDrawer | TopicPicker chips aren't deep-linked. Add `→ /book/<sectionSlug>#<subsectionSlug>` and `→ /suppliers/<id>` deep-links. |
| **XL8** | `/payments` | Doesn't accept `?supplier=<id>` filter — `/tasks` has it; `/payments` doesn't. SupplierDetail's "Manage on Payments →" lands at the unfiltered list. |
| **XL9** | `/songs` | Doesn't accept `?guest=<id>` filter — coming from a guest detail page loses context. |
| **XL10** | `/` (Today) | Task list doesn't show topic chips. "Wedding Book — Ceremony: confirm officiant arrival" is more actionable than the bare title. |
| **XL11** | `/seating` | Deep-links from guest chips are too coarse — `/seating` instead of `/seating#table-<id>` (no scroll/highlight). |

#### ✨ Polish (low urgency)

| ID | Issue |
|---|---|
| **P1** | Empty-state copy is inconsistent ("Add one below" vs "Add one above" vs "Add your first X"). Pick one direction word per layout. |
| **P2** | Confirm dialogs vary in detail richness — `MemberOverridesBlock` shows full consequence; `SupplierCard` says just `Delete supplier "X"?` despite having FK-related counts already loaded. |
| **P3** | Dirty-check + Save-disabled patterns inconsistent. `TaskDrawer` does it well; `SupplierForm` / `GuestForm` / `EventForm` don't — easy to fire double-saves. |
| **P4** | Today page Snapshot strip wraps awkwardly at 1280px viewport. Either always wrap to a 2-row grid or limit to top-4 with "+ N more" tooltip. |
| **P5** | BookSection anchor jumps don't visually flash the destination card. Add `:target { ... }` or `scroll-margin-top` + brief `animate-pulse`. |
| **P6** | `BudgetClient.tsx:132-133` uses raw `alert()` for "Delete the lines in this category first". Outside the design system, blocks on mobile, no path forward. Disable the Delete button when `lines.length > 0` with a tooltip, or offer "Move N lines to another category" inline. |
| **P7** | Type coercion: `book/actions.ts:69` casts `formData.get("kind")` to `BookSubsectionKind` without Zod validation. Replace with `z.nativeEnum(BookSubsectionKind).default(...)`. |
| **P8** | `removeUser` audit comment lists `Account` / `Session` / `AuditLog` cleanup but not `_PermissionGroupMembers` (which cascades fine via Prisma — comment just stale). |

### Planner-only feature shortlist (post-v1.17.0)

The user picked these from a wider menu on 28 Apr 2026. Items 5 (public
RSVP form) and 7 (guest portal) were explicitly dropped because they
violate the admin-only rule above.

**Status check (29 Apr 2026):** the planner-only shortlist is mostly
shipped. The seating-canvas pass ballooned into seven follow-up
releases (v1.22.5–v1.22.10 + v1.23.0) as the user dogfooded each
version and surfaced bugs/asks; the print + nudges + Book section
items renumbered down the queue. Current state:

- ~~**Audit log viewer in Settings**~~ — shipped v1.21.0.
- ~~**Search beyond /guests**~~ (Suppliers + Tasks sticky search) —
  shipped v1.21.0.
- ~~**Custom fields for Supplier + Task**~~ — shipped v1.22.0.
- ~~**Seating polish pass**~~ — shipped across v1.22.5–v1.22.10
  (snap-to-grid · capacity edit · pending-in-picker · RSVP-coloured
  dots · HEAD/RECTANGLE seats · canvas drag · resizable grid ·
  uniform S/M/L/XL · RSVP glyphs · repack-on-shrink · ghost dot ·
  alignment guides · click-once focus · hydration fix · bigger top
  table).
- ~~**Seating notes + day-of checklist + ceremony placeholder**~~ —
  shipped v1.23.0.
- ~~**Print stylesheet for /budget + /payments**~~ — shipped v1.24.0.
- ~~**BookSection audience overrides**~~ — shipped v1.24.0.
- ~~**Email reminders / nudges**~~ — shipped v1.25.0.
- ~~**Modular page cards**~~ — shipped v1.26.0 (TEXT · FIELD · RECIPE
  · SHOT_LIST · OUTFIT, photography migration deferred to v1.26.5).
- **Group-coloured ceremony seating** — design pass first. Bumped to
  v1.28.0+. See "Group-coloured ceremony seating (design needed)"
  below for the full requirements + open design questions. ~9 hrs
  estimated once the design pass lands.

**Total scope spent on the planner-only shortlist:** ~36 hrs across
~25 releases (vs. the original 15.5-hr estimate). Two overshoots:
the seating polish pass that ran v1.22.5–v1.23.3 (originally budgeted
~3 hrs for v1.20.5 + v1.20.6, became ~14 hrs through dogfood
iteration) and the modular-cards feature itself which was bigger
than the original Phase F1 plan accounted for once OUTFIT was added.
The user feedback was always specific and actionable so each
iteration was cheap; in hindsight the seating canvas + the Wedding
Book just had more surface area than the original plan modelled.

### Wedding Book expansion (v1.31.0 → v1.38.0)

Comprehensive rebuild of the Wedding Book module — 12 sections, 12
card kinds, Tiptap WYSIWYG editor for TEXT cards. Eight phases,
each a tagged release. Full design + per-phase prompts in
[BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md). Tracked in the
repo from v1.30.6.

While this arc is in flight, the items below remain queued for
v1.39.0+ unless a hotfix forces an out-of-band ship.

### Shovel-ready next (no design pass needed)

These don't need a design pass — just the time to execute. Roughly
in priority order.

- ~~**Mobile-nav full `<Link>` revert**~~ — shipped v1.27.5.
  Tasks / Guests / More-sheet items all back to client-side `<Link>`
  navigation. The SW cleanup from v1.25.2 has been live for a
  release without regressing.
- ~~**Photography migration**~~ — shipped v1.27.6. PhotographyShot
  rows migrated into BookShot under a SHOT_LIST card on the
  Photography section; bespoke /book/photography route deleted
  (resolves through /book/[slug] now). Legacy PhotographyShot
  table retained one release for recoverability — to be dropped
  in v1.28.0.
- ~~**Guest detail side panel on seating canvas**~~ — shipped
  v1.27.7. Click (no drag) a seated guest dot opens a
  GuestDetailPanel in the canvas sidebar with the guest's record
  (RSVP, household, email, dietary, plus-one, notes) and an
  "Open record →" link to the full /guests/[id] page.
- ~~**Task ↔ Supplier link**~~ — shipped v1.28.0. Tasks /
  questions / decisions can optionally link a Supplier; surfaces
  on the supplier detail page (Linked tasks section) and via
  `?supplier=<id>` deep-link on `/tasks`.
- ~~**Task grouping**~~ — shipped v1.29.0. Group dropdown beside
  Sort with None / Assignee / Category / Supplier / Priority /
  Status options.
- **Schema cleanup release.** Drop the legacy `PhotographyShot`
  table (after v1.27.6 verifies clean for one release) and the
  legacy `ScheduleEvent.audience` column (after v1.27.1 verifies).
  ~30 min total. Defer until both predecessors have been live one
  release. Was earmarked v1.28.0 — that slot was used for Task ↔
  Supplier instead; the cleanup is now next vacant slot.

#### New asks captured 30 Apr 2026

- **Tasks linkable to individual cards (inline).** *User-asked while
  reviewing v1.33.x.* Currently Task↔Book linking is at the
  BookSection level (v1.30.5 m2m); user wants the link at the
  individual card / subsection level **and** for the linked tasks
  to display **inline on each card** rather than only at the
  section header.

  Implementation candidates (decide before code):

  1. **m2m Task ↔ BookSubsection alongside the existing section
     m2m.** Adds a second relation; both coexist. Tasks can link to
     either or both. Most flexible.
  2. **Replace the section m2m with a subsection m2m + roll up to
     section-level via the parent relation at read time.** Cleaner
     schema, but it's the v1.30.0 → v1.30.5 reversal so we should
     only do this if the section-level link genuinely isn't useful
     anymore.
  3. **Keep the section m2m, but bucket the existing section-level
     LinkedTasksPanel by a new optional `metadata.cardSlug` field
     on the link.** No new table — uses the metadata bag to scope
     visually. Cheapest but feels hacky.

  **Lean:** option 1. Tasks already carry `bookSections[]` (m2m); a
  parallel `bookSubsections[]` is symmetric and keeps the existing
  read paths intact. ~3 hrs once decided. The §10a edit-row layout
  rule still applies — the inline panel goes at the bottom of the
  card body, mirroring the section-level panel that's already there.

#### New asks captured 29 Apr 2026 (need design / planning)

These came in the user's bulk-asks message. They each need at least
a brief design pass before code starts — not size-able from a
sentence. Captured here so they don't fall off the radar.

- **Tasks ↔ Wedding Book linking.** "Be able to link tasks /
  questions / decisions with wedding book pages. The tasks will
  then also display filtered but searchable under each section."
  - **Schema:** add `Task.bookSubsectionId String?` (nullable, FK to
    `BookSubsection`, `onDelete: SetNull`) — same shape as v1.28.0's
    `Task.supplierId`. The page-level link (`bookSection`) is
    implied by the subsection's parent so we don't need a separate
    column.
  - **UI surfaces:** picker on TaskForm + drawer (mirror the
    Supplier picker shape from v1.28.0). On `/book/[slug]`, render a
    Linked tasks panel under each subsection's editor showing rows
    where `bookSubsectionId === subsection.id` plus a search box
    scoped to that section's tasks.
  - **Open question:** does the link snap to a *section* (page) or a
    *subsection* (card)? Lean subsection — tighter scope, can be
    rolled up to section view. ~3 hrs once decided.
  - Also add navigational subsections to Wedding Book: music,
    reception, ceremony, guests. (Likely just seeding `BookSection`
    rows + slugs — quick once the linking design is set.)
- **Schedule attendees → permission groups.** "For the schedule
  these should follow permissions groups when added instead of
  attendees." Currently v1.27.1's attendee picker is a multi-user
  free pick. The intent: pick from named permission groups (Couple,
  Wedding party, Suppliers, Everyone…) instead. Threads into the
  existing Group-based-permissions backlog item — both probably
  ship together. ~2 hrs once the permission-group model lands.
- **Audit log enrichment.** "Review audit log data to ensure
  capturing is as rich as possible including recent activity."
  Existing audit() utility logs `{ action, entity, entityId,
  metadata }`. Likely-missing surfaces:
  - Diff capture on update events — currently only the entity ID
    is logged. Adding `metadata.before / after` (filtered to
    non-PII columns) gives a real changelog.
  - Recent-activity feed surface (admin sidebar widget?) reading
    the last N audit rows.
  - Cross-entity references — when a task is linked to a supplier,
    log on both sides so the supplier's audit includes the task
    link event.
  - Timestamp visibility — `createdAt` is already there; just need
    a viewer that surfaces it.
  - Likely a v1.30.0 design pass before code. ~3 hrs once scope is
    set.
- ~~**DMARC review (operational, not code).**~~ Reviewed 29 Apr 2026
  on the Outlook 26-Apr-2026 report (3 messages, all DKIM+SPF aligned
  pass via Resend → AWS SES `54.240.3.x`). Current policy is
  `p=none; sp=none; adkim=r; aspf=r; pct=100; fo=0` — monitor-mode
  with relaxed alignment. Mail flow is healthy; no spoofing
  observed. Follow-up actions queued below.

#### DMARC follow-up actions (post-29-Apr-2026 review)

  Operational items, not code. Logged here so they don't fall off
  the radar.

  - [ ] **Verify multi-provider DMARC reporting.** This review only
    saw Outlook's view. Confirm Google / Yahoo / Apple are also
    sending DMARC reports to the `rua=` mailbox — otherwise visibility
    is partial. Wait 1–2 weeks, scan the inbox for reports from
    `noreply-dmarc-support@google.com`, `dmarchelp@yahoo.com`,
    `dmarc-noreply@apple.com`, etc. If a major provider is missing,
    re-check the DMARC record's `rua=` address syntax.
  - [ ] **Add `ruf=` for per-message failure reports** before
    starting the policy ramp. Richer signal during the canary phase.
    DNS update only — same mailbox as `rua=` is fine.
  - [ ] **Begin the `p=none → quarantine → reject` ramp** *after the
    wedding* (post-Sep 2026). Sequence:
    1. `p=quarantine; pct=10` — canary 10% of failing mail.
    2. After 1–2 weeks of clean reports, `pct=25` → `pct=50` → `pct=100`.
    3. After 2–4 weeks at `quarantine; pct=100`, move to `p=reject`.
    4. (Optional) Tighten `adkim=s; aspf=s` only if a specific
       sender lookalike concern emerges — relaxed currently passes
       100% for legitimate senders, so the marginal gain is small.
    5. Hold the ramp at any step if a legitimate sender starts failing.
       Pre-wedding the cost of an invitation email getting quarantined
       is far higher than the marginal anti-spoof gain.

(View-as preview moved to the deferred-backlog block below since it
threads through every permission gate and the actual scope likely
runs above the original 2-hr estimate. See "View as another role
preview (deferred)" further down.)

### Group-coloured ceremony seating (design needed)

*Asked by user, 29 Apr 2026. Substantial enough to warrant a planning
pass before code starts; this section captures the requirements and
open design questions. Will replace this section with a concrete
release plan in the same shape as v1.19.0–v1.23.1 once the design
questions are answered.*

**Goal.** Extend the v1.23.0 ceremony placeholder so seats are
coloured by group (e.g. groomsmen, bride's family, parents,
flower-girls), automatically packed to the correct side of the aisle
(groom or bride), and ordered by priority — priority 1 sits front.

**Requirements (verbatim from the ask):**

- Colour seats by group on the ceremony layout.
- Split into groom side and bride side — per group.
- Built-in flexibility with the sides (UK convention: bride left /
  groom right; US convention: opposite; blended families: rename
  freely).
- Groups must match a "group" concept on the guest list — define
  groups once and tag guests into them.
- Groups ordered by priority — closer to 1 = closer to front.
- Edge cases: flowergirl / flowerboy may need non-standard placement
  (standing at the front, not seated in the audience).

**Schema sketch — not yet decided:**

- New `Group` model: `{ id, name, color, priority Int, side: ENUM(LEFT|RIGHT|EITHER), placement: ENUM(AUDIENCE|ALTAR|PROCESSIONAL|NONE) }`. Side stored as logical LEFT/RIGHT; the `CeremonySeating` singleton holds the visible labels (`leftSideLabel`, `rightSideLabel` — "Bride", "Groom", "Spencer family", whatever).
- Guest membership: `Guest.groupId String?` (one group per guest) vs. a many-to-many `Guest <-> Group` join. **Recommendation:** one-to-many — a "groomsmen" entry doesn't usually overlap with another group for the same person, and the algorithm gets simpler.
- Default groups to seed at install: Bride's family · Groom's family · Bridesmaids · Groomsmen · Officiant · Flower attendants · Other. User can rename / delete / re-prioritise.

**Layout algorithm:**

1. Pull groups by side, sorted by `priority` ascending.
2. For each group, pull its members; respect household boundaries so couples / parties don't get split across rows.
3. Pack into rows starting at row 0 (front). When a group fills a row, wrap to the next.
4. Groups with `placement ≠ AUDIENCE` skip seating entirely; render in a "Wedding party" sidebar/legend instead (so flowergirls/officiant are visible but not in the seat grid).
5. Empty seats at the end of a side render hollow (reserves).

**UI surfaces — open:**

- Group editor lives where? `/guests/groups` (groups are guest metadata) vs. a Settings panel vs. inline on `/seating/ceremony`. **Lean:** `/guests/groups` since the data is guest-scoped.
- Drag-handle priority reorder + colour picker per group (palette tied to app theme tokens — moss / marigold / info / rose / etc.).
- Guest assignment: extend the existing `/guests` filter UI with a Group selector dropdown per row + bulk-assign on the existing filter selection.
- Ceremony layout (`/seating/ceremony`): seat dots fill with their group's colour; click/hover a seat shows the guest name. Side-label config inputs above the SVG. Legend below listing groups + colours + counts.

**Open design questions (must answer before code starts):**

- [ ] One group per guest (m2o) vs. many-to-many. *Recommend:* m2o.
- [ ] Side stored as LEFT/RIGHT + configurable labels vs. hardcoded
      bride/groom. *Recommend:* LEFT/RIGHT + labels for flexibility.
- [ ] Auto-pack only vs. allow manual per-seat overrides (drag a guest
      to a specific seat to break the algorithm's choice).
- [ ] Multi-group conflict resolution (bridesmaid AND bride's family
      — which group wins for the seat?). Probably moot if m2o.
- [ ] Plus-ones (own Guest rows since v1.7.0): inherit parent's
      group? *Recommend:* yes by default, override allowed.
- [ ] Reserve / VIP front-row treatment: special "Reserved" group,
      or just rely on priority=0 always sitting front?
- [ ] Aisle-side preference — front-row family typically sits *on the
      aisle*. Pack from aisle outward, not from outer edge inward.
- [ ] Non-audience groups (flowergirl, officiant): render where?
      Sidebar legend, separate altar zone above the seat grid, or
      just hide and trust the planner to remember?
- [ ] Default group palette + ability to add custom colours.
- [ ] Colour-blind accessibility: pair group colour with a small
      text or icon hint per seat (mirror the v1.22.8 RSVP-glyph
      pattern — short group code in white inside the dot).

**Sizing (very rough — confirm in design pass):**

| Step                                          | Effort  |
|-----------------------------------------------|---------|
| Schema + migration + seed defaults            | ~1 hr   |
| Group editor page (`/guests/groups`)          | ~2 hrs  |
| Guest-assignment UI extension on `/guests`    | ~1 hr   |
| Ceremony layout decision module + tests       | ~2 hrs  |
| Ceremony SVG render with colours + legend     | ~1.5 hrs|
| Side-label config + non-audience sidebar      | ~1 hr   |
| Verification + ROADMAP                        | ~30 min |

**Total estimate: ~9 hrs once design questions are signed off.** Big enough that splitting into v1.27.0 (schema + group editor + guest assignment) and v1.27.5 (ceremony render + colour algorithm) is worth considering.

**What this section deliberately does NOT scope:**

- Per-guest seat assignments / drag-and-drop on the ceremony grid (separate, larger feature — would supersede the auto-pack algorithm).
- Reception canvas integration (groups don't yet affect reception seating; that stays free-form).
- Public-facing seat lookup ("guests can see where they're sitting") — admin-only standing rule applies.

When the open questions are answered, this section gets replaced with a concrete release plan in the same shape as v1.19.0–v1.23.1 above.

### Older / lower-priority backlog

- **Numeric auth code at sign-in (OTP / TOTP / SMS)** — currently
  Auth.js sends a clickable magic-link to the user's email; clicking
  the link signs them in. User asked (29 Apr 2026) for an "auth
  number for login" — an alternative or supplementary code-entry
  flow. Three plausible reads, each design-distinct:
  (a) **Email OTP** — replace the magic-link with a 6-digit code
      typed into the sign-in page. Lower phishing risk than long
      pre-tokenised URLs that some email clients prefetch and burn.
      Auth.js EmailProvider supports this via the `generateVerificationToken`
      callback returning a short numeric code instead of UUID.
  (b) **TOTP / authenticator-app MFA** — second factor on top of the
      magic-link. Couple + planners enrol once via QR code; sign-in
      asks for the 6-digit rotating code from Authy / Google
      Authenticator. Adds `User.totpSecret` (encrypted at rest).
  (c) **SMS code** — twilio / Resend SMS adds a phone-number step.
      More setup, more cost, weakest of the three security-wise.
  *Recommendation:* (a) Email OTP — least new infra, biggest UX
  win on touch devices where copy-pasting a long URL from a mail
  app is fiddly. ~2 hrs to implement once the design pass picks one.
- ~~**Schedule page polish (time entry + all-day + audience rethink)**~~
  — shipped v1.27.1. Split date+time inputs (typeable on desktop),
  `allDay` boolean toggle, attendee multi-picker replaced the persona
  audience.
- **Audit-log enrichment** — the existing audit log captures
  `{ action, entity, entityId, metadata? }` per server action and
  renders raw rows in `AuditLogPanel.tsx`. There's a lot of missing
  context that would make it much more useful for "who changed what
  when". Asks (29 Apr 2026):
  - **Before/after diffs on update actions** — currently a "guest
    update" row tells you *that* something changed but not what.
    Capture the changed-fields snapshot in `metadata` so the panel
    can render "rsvp: PENDING → ATTENDING".
  - **Human-readable entity references** — entityId is a cuid which
    is unhelpful in the panel. Resolve to the entity's display name
    (e.g. guest name, task title, supplier name) at write time and
    cache on the row, OR resolve at read time via a per-entity-type
    join. Latter is cleaner.
  - **IP + user-agent capture** for sign-in / impersonation actions
    so a security review can spot anomalous activity.
  - **Filter UX** beyond the existing date cursor: by user, by entity
    type, by action verb. Sticky-search pattern works (mirror v1.21.0).
  - **Group related changes** — a CSV import currently emits dozens
    of separate "guest create" rows. Roll them into a single
    "imported 47 guests via CSV" entry with an expandable child list.
  - **Retention policy** — currently rows accumulate forever. Decide
    on 12 / 24 month retention, optional purge action, export-before-
    purge for compliance.

  Substantial enough to warrant a design pass; estimated ~5–8 hrs
  depending on which sub-asks ship together. *Asked by user, 29 Apr 2026.*
### "View as another role" preview (deferred)

*Asked by user 29 Apr 2026; deferred from v1.27.x on 29 Apr 2026
after sizing during the implementation window suggested the original
~2 hr estimate was optimistic. This block carries the design context
forward so the next planning pass starts where this one stops.*

**Goal.** Admin impersonation, read-only. Lets the couple (or a
planner) preview the app *as if* they were another user, to verify
per-section visibility + role gates without signing out. Doesn't
actually grant new powers — the underlying user must already have
view-everything rights to toggle previews.

**Sketched implementation:**

- Header dropdown ("Viewing as: Couple ▾") in `AppShell.tsx`'s top
  area or the avatar menu. Lists every entry from `AUTH_ALLOWED_EMAILS`
  alongside the current user's actual identity.
- Selection writes a non-persistent cookie (`viewAsUserId`, session-
  scoped, `httpOnly` so it can't be tampered with from JS).
- Server components read the cookie via `requireUser()` (extended)
  and return an *effective* user shape — same `id` + `email` so
  audit-log entries still attribute to the actual signer-in, but
  with `isCouple` + `role` swapped to the impersonated user's
  values. The override is preview-only: write actions ignore it
  and write under the actual user as today.
- Audit log writes a `view-as` entry on every flip (entity = User,
  entityId = impersonated id, metadata = `{ from, to }`).
- A persistent banner bar at the very top of the page (red-tinted,
  high-contrast) reading "Previewing as Bryony · Switch back" so
  the impersonator never forgets they're not in their own session.

**Risk + scope notes (why deferred):**

- **Threads through every permission gate.** `canEdit` and `canView`
  in `src/lib/permissions.ts` are called on essentially every page.
  Each call needs to honour the override consistently. Missing one
  page means the preview leaks "real" content for an impersonated
  role — silent data leak.
- **Write-action interaction.** Decision needed: do write actions
  fail noisily (toast: "you can't edit while previewing") or silently
  fall back to the actual user's permissions? Either is defensible;
  needs a one-line policy in the design pass.
- **Settings + AvatarMenu interaction.** The Sidebar avatar shows
  the actual user. The "view as" banner shows the previewed user.
  Both need to coexist without confusion.
- **Realistic scope.** Instrumenting every permission-gate call site
  + writing the cookie middleware + UI for the dropdown + banner +
  audit + tests is closer to ~4 hrs than ~2.

**Recommendation when revisited:** start with a single-pass survey
of every `canEdit`/`canView` call in the repo, decide on a single
shared override-aware helper to replace them all, then build the
UI. Don't ship piecemeal.
- **Group-based user permissions** — replace the per-user role enum
  (COUPLE / WEDDING_PARTY / PLANNER / VIEWER) with a more flexible
  group model where the planner can define groups (e.g. "Aimee's
  team", "Ushers", "Couple") and assign per-page permissions to each
  group. Likely shape: new `PermissionGroup` model with
  `{ name, description, permissions Json }` (Json maps page slug →
  `view` / `edit` / `none`), plus `User.permissionGroupId String?`
  that overrides the role-derived defaults when set. Falls back to
  the existing role gates when null so the migration is non-breaking.
  Includes a Settings UI for the couple to manage groups + assign
  users. ~3 hrs once design is signed off.
  *Asked by user, 29 Apr 2026.*
- ~~**Investigate mobile navbar redirect-to-Today**~~ — root cause was
  a stale service worker from a prior deployment at the same domain.
  v1.25.2 mounts a `ServiceWorkerCleanup` component at root that
  unregisters every SW on first paint; v1.25.0 swapped Link → plain
  anchor as a defensive fallback. v1.25.4 plans the graceful Link
  revert now that the SW is cleared.
- ~~**Guest detail side panel on seating canvas**~~ — shipped v1.27.7
  per the design captured here on 29 Apr 2026.
- **Seating constraint rules** — must-sit-together / must-not-sit /
  prefer-group hints, plus violation indicators on the canvas. The
  prototype had a richer rules panel; we shipped the canvas without it
  for v0.6.0.
- **CSV import: update / dedupe modes** — v0.8.0 always creates new
  rows. A future iteration could add "match by email and update
  existing" + "skip duplicates" modes alongside the current "create".
- **Rate-limit on `/api/auth/*`** — Caddyfile stub waiting on a custom
  Caddy build with `xcaddy --with github.com/mholt/caddy-ratelimit`.
  Auth.js token expiry + email allow-list is the current mitigation.
- ~~**Day-of mode**~~ — shipped in v0.15.0.
- ~~**Quick-capture (`C` shortcut) modal**~~ — shipped in v0.15.0
  (Task / Question / Event types; Payment intentionally excluded).
- ~~**Say I Do sync**~~ — covered by the v0.8.0 CSV import path. Just
  export to CSV from Say I Do and paste it into `/guests/import`.
- ~~**Spotify playlist sync**~~ — shipped in v0.14.0 as Phase G1
  (Client Credentials, public-playlist read-only mirror).
- ~~**Glance / At-a-glance dashboard**~~ — shipped in v1.1.0.
- ~~**Custom fields UI in Settings**~~ — shipped for Guest in v1.15.0
  (R5b, C10). Supplier + Task in the planner-only shortlist above.

## Open questions / risks

- **Add the rest of the wedding party to `AUTH_ALLOWED_EMAILS`** — currently only Jamie can sign in. Bryony / Josh / Aimee / planner addresses still need to be collected and added (Compose Manager Plus → Edit Stack → .ENV tab → save → **Up**).
- **Backup verification** — the `backup` container is configured but no run has been observed yet (first scheduled at next `@daily`). Worth checking `/mnt/user/appdata/wedding-hub/backups/` after 24h to confirm it works.
- **Off-site backup** — backups land on the Unraid box. A full Unraid failure would lose them. rclone / restic / parity sync to a second array is still TBD.
- **Sender domain decision** — currently sending from `noreply@spencer-net.com` (apex, DKIM aligns there). If a wedding-themed sender like `noreply@wedding.spencer-net.com` is preferred, add a separate DKIM record on the subdomain in Cloudflare DNS.
- **Cloudflare Access policy alignment** — if a CF Access policy is in front of the hostname, its email allowlist must match `AUTH_ALLOWED_EMAILS`, otherwise users get bounced at Cloudflare's gate before they see the magic-link page.

### Resolved during the 27 April 2026 deploy

- ~~First container start on Unraid not yet verified~~ — done; production stack is up.
- ~~SMTP provider~~ — Resend, configured with API key and DKIM via Cloudflare integration.
- ~~Cloudflared stack must be configured~~ — done; tunnel route → `192.168.50.25:80`.
- ~~Bind-mount permissions~~ — pre-created at `/mnt/user/appdata/wedding-hub/backups` with UID 1000.

## Conventions

- **Server actions** live in `actions.ts` next to the page they serve, gated by `requireEdit("section")`, mutating via Prisma, then `revalidatePath` for the relevant routes.
- **Audit log** every server action that mutates user-visible state. Sign-in already audits.
- **Audit-aware feature design (v1.30.5, refined v1.32.0).** After each feature request, scan for audit / activity-list opportunities. When adding an audit row, enrich its `metadata` with the relevant snapshot fields (titles, key IDs, counts, changed-field names) so the row reads usefully without re-joining the originating entity. **The "what" must be human-readable** — the AuditLogPanel renders rows via `formatAuditAction` ([src/lib/audit-format.ts](src/lib/audit-format.ts)), which either auto-formats from `action + entity + metadata` for known patterns or uses an explicit `metadata.summary` string. Either pattern-match a new action code in the formatter, or supply `metadata.summary` directly. Never ship a new audit call that produces "verb-noun book subsection" in the log viewer.
- **Permission section keys** must match the union in [src/lib/permissions.ts](src/lib/permissions.ts) (`SECTIONS` const).
- **Couple-only routes** are gated in two places — middleware (defence-in-depth) and the page itself (`if (!user.isCouple) redirect("/")`).
- **Forms** use plain `<form action={serverAction}>` with a small client wrapper for `useTransition`-driven pending state. No client-side form libraries in Phase A–C.
- **Branching:** day-to-day work commits to `dev`. When a chunk is ready to release, fast-forward `claude/main` to dev's HEAD, bump `package.json`, update the ROADMAP changelog, and tag `vX.Y.Z` on `claude/main`. Tags are immutable — never re-tag.

## Versioning

Even though this is a private app for one wedding, a small amount of versioning discipline pays for itself when something goes sideways and we need to know *what was deployed last Tuesday*.

### Scheme — light SemVer

`MAJOR.MINOR.PATCH`, single source of truth in [package.json](package.json):

| Bump | When | Examples |
|------|------|----------|
| **PATCH** (`0.3.0` → `0.3.1`) | Bug fix, copy tweak, dep bump that doesn't change behaviour. No schema change. No env change. | Fix a broken Edit button. Bump Next.js patch. Adjust a sidebar label. |
| **MINOR** (`0.3.0` → `0.4.0`) | New feature or finished phase. May add a Prisma migration but it must be **additive** (new table / new nullable column / new optional relation). May add new env vars *with sensible defaults*. | Phase D (file uploads). Add a "completed at" column to Task. Add the day-of mode. |
| **MAJOR** (`0.x.y` → `1.0.0`) | Schema migration that requires data backfill or manual ops, drops or renames columns, breaks the API/UI in a way that needs the user to re-learn something, or adds a required env var without a default. | Rename `Task.tags` to `Task.categories`. Require a new `STORAGE_PROVIDER` env. Move from JWT to database sessions. |
| **Special: `1.0.0`** | Reserved for the moment we're confident the app is good for the wedding day itself. Can land before 26 Sep 2026 — most likely a few weeks before, after the rehearsal data is real. | — |

**Pre-1.0 caveat:** while we're below `1.0.0`, treat MINOR bumps as potentially breaking *if* I'm rushed and need to land something quickly. Document anything that would normally be a MAJOR in the changelog under a **⚠ Breaking** subheading.

### Git tags

Every release tag matches `package.json` exactly:

```bash
# After committing the version bump and updating ROADMAP.md changelog:
git tag -a v0.4.0 -m "Phase D — file uploads"
git push origin v0.4.0
```

Tags are immutable. If you need to re-cut, bump the patch (`v0.4.0` → `v0.4.1`) — never re-tag.

### Docker images

The web image is tagged twice on a release:

```bash
docker build -t wedding-hub-web:0.4.0 -t wedding-hub-web:latest .
```

Compose pins to `:latest` for normal deploys, but you can pin to `:0.4.0` in a temporary override if a newer image is suspect:

```bash
WEB_IMAGE_TAG=0.3.0 docker compose up -d  # (if you parameterise the compose file later)
```

Old images are kept by `docker image ls` until pruned — don't aggressively `docker image prune -a` if you might want to roll back.

### Prisma migrations are part of the version contract

- **Never edit a migration that has been deployed.** Always create a new one (`npx prisma migrate dev --name something`) — even if the change feels small.
- A migration filename's timestamp should monotonically increase across machines — Prisma handles this, just don't reorder the directory.
- The `_prisma_migrations` table on the production DB is the truth about what's applied. `migrate deploy` is idempotent and fast on a no-op.
- If a migration goes wrong in prod, `prisma migrate resolve` is the escape hatch, but **take a backup first** (`docker compose exec backup /backup.sh`).

### Release checklist

When wrapping up a meaningful iteration:

1. **Verify clean** — `npm run typecheck` and `npm run lint` pass; relevant `next build` succeeds.
2. **Bump `package.json` `version`** per the table above. Patches don't always need a release, but completed phases / features do.
3. **Update `ROADMAP.md`:**
   - Move items from *Deferred / Backlog* to *What's shipped* if they landed.
   - Add a new *Changelog* entry at the top of the section, dated, headed with the new version (e.g. `### 2026-05-15 · v0.4.0 — File uploads`).
   - Mention any new migrations and any env-var changes.
4. **Commit** with a Conventional Commits style message: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`. Bigger features that span multiple commits land on a feature branch and get a single squash-merge to `claude/main` so the changelog stays clean.
5. **Tag** the release — `git tag -a vX.Y.Z -m "..."` then `git push --tags`.
6. **Build + push the image** if deploying — tag with both the version and `latest`.
7. **Deploy** — `docker compose pull && docker compose up -d` on the host (or `docker compose up -d --build` if building locally on the host). Watch `docker compose logs -f web` until the migrate-deploy line passes and Next reports ready.

### Current version

`1.9.0` on both `dev` and `claude/main` (promoted 28 Apr 2026 after GHA green; production-confirmed working). The Spotify keys are now flowing into the running container via `compose.environment:` and the new Book sections are seeded.

## Changelog

Most recent entry on top. Add a new entry at the end of every meaningful iteration.

### 2026-07-05 · v2.4.2 — Fix chat 400s: history sanitizer orphaned tool_results at the window head

User hit repeating production errors after a few chat messages: `400 … unexpected tool_use_id found in tool_result blocks … Each tool_result block must have a corresponding tool_use block in the previous message`, pointing at `messages.0`.

**Root cause:** `sanitizeHistory`'s final rule ("first message must be role user") violated its own invariant. When the 40-row history window happened to START on an assistant `tool_use` message, the pairing checks correctly kept the tool_use/tool_result pair — then the head rule shifted the assistant off the front, leaving its `tool_result` as `messages[0]`: exactly the orphan the API rejects. v2.4.0's deeper tool chains (12 iterations) made the window boundary land on tool rows far more often, which is why it surfaced now rather than in v2.2.x.

**Fix:** sanitizer moved to [src/lib/ai/sanitize-history.ts](src/lib/ai/sanitize-history.ts) (pure module — the old in-chat.ts copy couldn't be unit-tested without pulling Prisma). Head normalisation now re-checks after EVERY shift: a leading non-user message is dropped, then any tool_results stranded on the new head are stripped (or the whole message dropped if that empties it), repeating until the head is a legal user message. Healing stays read-time, so wedged threads recover on their next message.

**Tests:** new [sanitize-chat-history.test.ts](tests/unit/sanitize-chat-history.test.ts) — 8 cases including the exact production shape (window starting on an assistant tool_use row), mixed tool_result+text heads, dangling tool_use, partial parallel results, stacked leading tool exchanges; every case asserts the two API invariants (head is user with no tool_results; every tool_result resolved by the immediately preceding message). 629 → 637 tests. Verified with a full local `next build` (exit 0) per the standing rule.

### 2026-07-05 · v2.4.1 — Balanced tier moves to Claude Sonnet 5

User: "can we use sonnet 5?" — Sonnet 5 shipped 2026-06-30 (`claude-sonnet-5`): near-Opus-4.8 capability at Sonnet prices, with intro pricing ($2/$10 per MTok) until 2026-08-31, then $3/$15 (identical to Sonnet 4.6's standard rate). Strict upgrade for the chat/parse/summarize/breakdown surfaces.

- [config.ts](src/lib/ai/config.ts): `balanced` tier `claude-sonnet-4-6` → `claude-sonnet-5`. `deep` stays Opus 4.8 for now — Sonnet 5 reportedly gets close, so pointing deep at it later would cut one-shot costs ~5×; revisit after a few weeks of real use.
- [cost.ts](src/lib/ai/cost.ts): pricing entry encoded at the PERMANENT rate (300/1500 US-cents per MTok), not the intro rate — over-reporting during the intro window is safe; under-reporting after September would leak past the budget guard. Historical AiUsage rows untouched per the module's standing rule.
- Foot-gun: the model change invalidates the prompt cache once at deploy (cache is per-model) — expected, same as any tier change.

### 2026-07-05 · v2.4.0 — Full-surface AI planner: every area readable, every area editable via proposals

User: "Also allow the bot to update all cards in the wedding book. Make the AI bot feature full and really as robust as possible to help me plan my wedding, tasks need to be broken down. Everything needs to be really in depth and edit features fully available to the bot across all areas." Built as a multi-agent orchestration: 6 mapping agents + 2 design agents produced the spec, 7 implementation agents built the surface in parallel (disjoint file ownership), and a 26-agent adversarial review (6 finders → 20 findings → per-finding refutation) ran before ship. **All 20 confirmed findings fixed pre-commit. No migrations.**

**35 new proposal kinds** — every one propose-then-approve through the existing review queue, applied via the SAME human server actions:

- **Wedding book (20 kinds — all 13 card kinds now editable):** section/card create, rename (any kind), TEXT full rewrite (`book.card.replace_text`, fenced by a sha256 body hash from the new `read_book_card` so a card edited after the AI read it refuses to apply), FIELD value set, and per-kind DELTA updates for recipe/shot-list/outfit/build/menu/bar/setup/stay/lodging/dress-code/wedding-party. The delta machinery ([merge-book-children.ts](src/lib/ai/proposals/merge-book-children.ts), unit-tested) reconstructs each save action's complete child array from the LIVE rows at apply time — anything the AI didn't name is re-emitted byte-identical (the underlying `save*` actions delete rows missing from their input). Money (`*Pence`, paid flags), budget links, photos, layout, and visibility are never AI-readable or -writable on any card; menu course deletion is excluded (cascades options).
- **Guests (4):** `guest.update` (contact/dietary/role/notes — merge-against-live so omissions never wipe; +1 rows guarded), `guest.set_rsvp` (the ONLY RSVP path — keeps `attending` + the +1 cascade in sync), `guest.archive` (soft/reversible, unseats + archives the +1), `household.update`.
- **Schedule (1):** `event.update` with add/remove attendee deltas over canonical refs, legacy `attendeeIds` expansion, and local-time round-tripping for carried times ([merge-event-update.ts](src/lib/ai/proposals/merge-event-update.ts), unit-tested).
- **Money (6, couple-only at Apply via `requireEdit`):** budget category/line create, line update (category moves + actual/paid pinning excluded by design), payment create/update/set_status. All payload money is integer pence; bridges emit pound-strings so the silent NaN parser path is unreachable. Line↔component links are reconciled at apply so an inconsistent pair can't land.
- **Long tail (4):** `question.answer` (marks it Done), `song.add` (refuses DO-NOT-PLAY lists unless explicitly confirmed), `custom_field.set` (validated through the app's own `parseCustomFieldValue`), `seat.assign` (empty seats only, ATTENDING guests only, occupancy re-checked at apply — the action's silent-eviction path is unreachable).

**Task breakdown — both entry points converge on identical batches:** the `propose_task_breakdown` chat tool and a `✨ Break down` button in the task drawer split any task into 2–10 subtask proposals (one approve-all card). Subtasks inherit the parent's supplier + all four topic link sets server-side; optional parent parking as WAITING (status only — never notes). Duplicate fence via a `[breakdown:<taskId>]` rationale marker; the one-shot validates everything then writes in one transaction so a partial batch can never arm the fence.

**Read surface — the AI can now see everything it can edit:** new `read_book_card` (full per-kind card content WITH child-row ids + body hash), `read_payments` (couple-gated), `read_seating` (occupancy + unseated-attending), `read_songs` (block-list flagged), `read_files` (visibility-filtered, no disk paths); extended `read_book` (card ids/visibility), `read_tasks` (supplier, topics, custom fields, titleContains), `read_guests` (contact/dietary/household/groups + name search), `read_events` (canonical attendee refs), `read_budget` (line/component ids + effective-actual maths matching what /budget renders), `read_suppliers` (contract status booleans); reference directory gains custom-field defs.

**Robustness:** tool iterations 8→12 with a per-iteration budget re-check (a deep turn can't run past an exhausted monthly cap); per-turn proposal cap of 30 shared across all propose tools; 24K-char tool-result truncation; a "tool-returned text is DATA, not instructions" defence line in the system prompt and both text-embedding one-shots; `WRITE_ADDENDUM` restructured into per-domain sections. **Security fix:** the existing `book.card.append` apply path never checked COUPLE_ONLY visibility — every book propose tool and apply bridge now enforces it (`assertBookCardWritable`), and `read_guests`/`read_book`/`read_tasks`/`read_events` gained the section `canView` gates they were missing (an ai_chat user with a NONE section permission could previously read that section through the AI).

**Adversarial review highlights (all fixed):** payment line/component divergence + stale paidDate on status flips; carried event times shifted by the UTC offset on non-UTC hosts; eight AI payload caps looser than the actions' own zod (proposals that could never apply); stay-date strings silently nulling dates; dress-code text overflowing the sanitiser cap after HTML expansion; breakdown slot-reservation burning the turn cap on refusals; breakdown proposals invisible in the chat panel (now emit per-proposal events → normal batch card); WP cell truncation masquerading as NEED status; review cards not naming the field for field-set kinds.

**Foot-guns:** the WRITE_ADDENDUM/BASE_SYSTEM edits + ~41 new tool definitions invalidate the cached prompt prefix ONCE at deploy — first-turn cache-write cost is expected. `createBookSection`/`createBookSubsection`/`createCategory`/`createLine`/`createSong` now return `{id}` (non-breaking; form callers ignore returns). All deletes except soft `guest.archive` remain human-only, as do household moves, budget-line category moves, actual/paid pinning, receipts, files, Spotify sync, seating structure, and guest-group membership.

605 → 629 unit tests (merge-book-children, merge-event-update, breakdown schema walker). Typecheck + lint clean.

### 2026-07-05 · v2.3.0 — AI can manage suppliers; Gap Analysis button

User: "Can we also allow the AI to update the suppliers directly? & manage. And lets add the gap analysis button" — following up on an earlier exploratory answer that gap analysis wasn't a dedicated feature yet, just something chat could reason about ad hoc if asked directly.

**AI supplier management — three new proposal kinds, same propose-then-approve model as everything else:**

- `supplier.create` / `supplier.update` / `supplier.log_communication` added to [proposals/schemas.ts](src/lib/ai/proposals/schemas.ts), each with a Zod payload schema, `humanLabel`, and `summariseProposal` case. `supplier.create` deliberately excludes `amountAgreed` — no read tool surfaces existing amounts to the AI either (`read_suppliers` omits it), so this keeps write parity with read visibility instead of opening a new money-write surface.
- **`supplier.update` is a partial patch**, unlike the real `updateSupplier` action which requires the full record on every call and reads each field as `formData.get(x) || null` — an omitted field would read as null and wipe the existing value. The new async `supplierUpdatePayloadToFormData` bridge in [ai/actions.ts](src/app/(app)/ai/actions.ts) loads the supplier's current row and appends every field every time (the AI's patch value where touched, the current value otherwise) — the same trap `taskUpdatePayloadToFormData` already solved for relations, here for scalars. `amountAgreed` always round-trips the current value untouched.
- **`supplier.log_communication`** reuses `createSupplierCommunication` as-is, including its existing auto-follow-up-task behavior (`decideFollowUpTask`) when `followUpAt` is set — Applying one of these proposals can produce two real rows (the communication + a bonus task) from one click, exactly like the manual form. The review UI's detail line now says so explicitly ("auto-creates a follow-up task · due …") rather than leaving it a surprise.
- `name` is deliberately NOT exposed on `propose_supplier_update`'s tool input — a wrong `supplierId` plus an AI "correction" would silently relabel the wrong vendor, a quieter failure than a wrong status. `createSupplier` now returns `{id}` (non-breaking — its one call site discards the return value) so the apply bridge can link the produced row, matching the existing `createTask`/`createHousehold`/`createGuest` precedent.
- Three new tool files (`propose-supplier-create.ts`, `propose-supplier-update.ts`, `propose-supplier-log-communication.ts`) follow the `propose_task` pattern exactly: `ctx.canWrite` gate, `resolveRefs` validation before writing, structural no-op guard on updates (same as `propose_task_update`). Registered in [registry.ts](src/lib/ai/tools/registry.ts); [system-planner.ts](src/lib/ai/prompts/system-planner.ts)'s write addendum gained a "Managing suppliers" section.

**Gap Analysis — a dedicated feature, not just ad hoc chat reasoning:**

- New `runGapAnalysis()` one-shot in [ai/actions.ts](src/app/(app)/ai/actions.ts), following the `suggestDueDates` shape: gate on `ai_write` → pull up to 100 tasks + 60 supplier categories/statuses → deep-tier call against a fixed curated checklist → up to 8 `task.create` proposals sharing one batchId → `/ai` revalidate.
- The checklist (18 categories: Legal/Admin, Ceremony, Attire, Photography, Catering, Drinks, Flowers, Music, Transport, Accommodation, Stationery, Favors, Hair/Beauty, Insurance, Day-of logistics, Speeches, Rings, Honeymoon — UK-specific admin called out explicitly) is baked into the system prompt so a run is a systematic diff against a fixed rubric, not the model improvising "what weddings need" fresh each time. Timing guidance (12+/4-12/under-4 weeks out) shifts which categories matter as the date approaches. A supplier with BOOKED/PAID status counts as coverage even with few explicit tasks.
- `category` is prompt-guidance and grouping metadata only — used to build the button's "Found N gaps in X, Y, Z" message, then dropped before the gap becomes a `task.create` payload (mirrors how `suggestDueDates`' rationale never gets copied onto the real Task row either).
- New `gapAnalysisSchema` in [output-schemas.ts](src/lib/ai/output-schemas.ts) (`additionalProperties: false` on every node, per the standing rule since the production 400 this exact omission caused) + added to the schema-walker regression test. New `gap-analysis` feature key, rate-limited to 3/hour (matching `review-wedding`'s "deliberate periodic check" framing, not `suggest-due-dates`'s cheaper 5/hour utility framing — the curated checklist makes this prompt noticeably heavier).
- **[GapAnalysisButton.tsx](src/app/(app)/tasks/GapAnalysisButton.tsx)** on `/tasks`, gated the same as Suggest Due Dates (`ai_write`), placed to its left — find what's missing first, then schedule everything including the newly-added tasks.

**Design review**: an independent agent re-verified every claim above against the live code (confirmed `createSupplier`'s only call site discards its return value; confirmed `amountAgreed` has zero write-time gating today, pre-existing and out of scope; confirmed the FormData field names against `createSupplierCommunication`'s actual body) before this shipped.

**Known-accepted**: like `suggestDueDates`, gap analysis doesn't check `read_proposals` before generating — running it twice before Applying could re-propose the same gap twice. Pre-existing limitation class, not a new regression; left unfixed for both features together for a future pass.

605 unit tests (3 new gap-analysis-schema assertions). Typecheck + lint clean.

### 2026-07-05 · v2.2.1 — AI chat renders markdown instead of literal `**`/`##`

User pasted a screenshot: the assistant's "Top 5 Next Actions" reply showed literal `##` and `**` characters instead of a heading and bold text. Root cause: `ChatPanel`'s assistant bubble rendered `{msg.text}` in a plain `whitespace-pre-wrap` div — the model's markdown-formatted output (the system prompt explicitly asks for headings/bullets/bold) was never parsed, just dumped as raw text.

**New [src/components/ai/MarkdownMessage.tsx](src/components/ai/MarkdownMessage.tsx)**, built on `react-markdown` + `remark-gfm` (tables/strikethrough/autolinks) + `remark-breaks` (single `\n` → `<br>`, so short chat-style lines don't run together the way bare CommonMark would). No `rehype-raw` — react-markdown escapes literal HTML in the source by default, so model output can't inject markup; this was a deliberate choice, not an oversight.

Two exports:
- `MarkdownMessage` — full block-level renderer (headings, paragraphs, lists, code, blockquotes) styled with the app's existing `ink-primary`/`ink-secondary`/`border-soft`/`text-info` token classes. Used for the chat transcript, where each assistant turn is its own block.
- `InlineMarkdown` — a lighter variant for short AI-written strings embedded inside existing flowing UI (a `<span>`, a `<li>` next to other inline content) where the block renderer's `<div>`/`<p>` wrapper would be invalid nesting. Overrides `p` to a `Fragment` so it drops in as plain inline content.

**Wired in:**
- [ChatPanel.tsx](src/components/ai/ChatPanel.tsx) — assistant bubbles now use `MarkdownMessage` (user + error bubbles stay plain text; only the model's own prose needs parsing).
- [WeddingReviewPanel.tsx](src/app/(app)/ai/WeddingReviewPanel.tsx) — `headline`, `concerns[].issue`/`suggestion`, `nextSteps[]`, `onTrack[].note` now go through `InlineMarkdown`. These are free-text fields in a strict-JSON schema — `output_config.format` only constrains the JSON *shape*, not whether the model puts `**emphasis**` inside a string value, and unlike `summarizeBookCard`'s prompt, the review/due-date prompts never told it not to.
- [ProposalReviewCard.tsx](src/app/(app)/ai/ProposalReviewCard.tsx) + [ProposalBatchGroup.tsx](src/app/(app)/ai/ProposalBatchGroup.tsx) — the `rationale` line ("Why: …") through `InlineMarkdown`.
- `summary` fields were left alone — they're built deterministically by `summariseProposal()` from structured payload fields (title/priority/due date), not raw model prose, so there's nothing to parse.

**Verification:** rendered the exact text from the reported screenshot through `react-markdown` standalone (`renderToStaticMarkup`) — `##` became a real `<h2>`, `**bold**` became `<strong>`, the numbered list became a proper `<ol>`/`<li>` tree. 602 tests green, typecheck clean. Manual in-app verification still pending — needs the couple's running stack (Postgres + Anthropic key) to actually drive a chat turn; note this explicitly rather than claim it as done.

**Foot-gun:** `react-markdown@10` is ESM-only. It imports fine under Next's bundler and under `tsx`, but don't reach for `require()` on it anywhere.

### 2026-07-03 · v2.2.0 — AI planner: richer proposals, batch approvals, page-aware chat

User: full review of the AI agent + "it can't assign people to tasks, can't assign topics so they show under their sections, and I want one approval for multiple proposed tasks". Review ran as a multi-agent read-only workflow; plan approved with four extras (page-aware chat, thread history, suppliers visibility, AI-sees-pending-proposals).

**P0 bugfix shipped separately as v2.1.1 (`b2fd21c`)**: all three strict-JSON one-shot actions (parse guests, suggest due dates, wedding review) 400'd in production because their `output_config.format` schemas lacked `additionalProperties: false` on object nodes. Schemas moved to [src/lib/ai/output-schemas.ts](src/lib/ai/output-schemas.ts) with a walker regression test.

**Richer proposals — the AI can now assign people, topics, and suppliers:**

- **Reference directory** ([src/lib/ai/directory.ts](src/lib/ai/directory.ts), new): compact ID-bearing listing of users, nav tags, book sections, guest groups (+ builtin attendee groups), rendered into the *uncached* snapshot block of the system prompt on every write-enabled turn (~550–870 tokens). Suppliers deliberately excluded (unbounded) — they get `read_suppliers` instead.
- **`validate-refs.ts`** (new): batched ID validation + name resolution shared by all propose tools. A hallucinated id never reaches an AiProposal payload; resolved names feed the UI detail lines.
- **`propose_task`** now exposes `assigneeIds` / `bookSectionIds` / `navTagIds` / `guestGroupIds` / `supplierId` (the Zod payload schema + FormData bridge supported them since phase 2 — the tool input schema just never surfaced them).
- **`propose_task_update`** gains add/remove **delta** fields for assignees + topics. Deltas (not full sets) because `updateTask` REPLACES all four topic relations as a unit whenever any topicKeys field is posted — the apply bridge loads the task's live relations, merges via the new pure module [merge-task-update.ts](src/lib/ai/proposals/merge-task-update.ts) (unit-tested), and posts the complete merged set *including* card-level bookSubsection links the AI can't even express. Deltas survive concurrent human edits between propose-time and apply-time.
- **`propose_event`** exposes `attendeeRefs` (`user:<id>` validated against users, `builtin:<slug>` against BUILTIN_GROUPS).
- **`read_suppliers`** (new tool): id/name/category/status/primary contact/latest communication + follow-up, filterable, cap 30. Gated on `canView("suppliers")`.
- **Review UIs** show a resolved-names detail line ("→ Sarah · Flowers · supplier: Bloom & Co") on chat cards and /ai rows; names resolved server-side at list time so renames don't stale.

**Batch approvals — one approve action for N proposals:**

- `AiProposal.batchId String?` + index (append-only migration [20260703000000_ai_proposal_batch](prisma/migrations/20260703000000_ai_proposal_batch/migration.sql)). One `randomUUID()` per `runChatTurn` threaded through `ToolContext`; `parseGuestList` + `suggestDueDates` stamp their own per run; `summarizeBookCard` stays a singleton.
- **Bulk server actions** `applyProposals(ids)` / `dismissProposals(ids)`: permission gate once, dedupe, cap 25, **sequential** loop (guest.create household find-or-create must not race), per-item results in input order, failures stay PENDING + retryable, one batch-level audit row on top of the per-item ones, one `/ai` revalidate. Single-proposal actions refactored onto the same `applyLoadedProposal`/`dismissLoadedProposal` helpers.
- **ChatPanel**: >1 proposal in a turn renders ONE `ProposalBatchCard` — checkbox per item (deselection-set state so late-streaming items arrive checked), "Apply selected (n)" + "Dismiss all", per-item status chips, failed items retryable.
- **/ai dashboard**: [grouping.ts](src/lib/ai/proposals/grouping.ts) `groupByBatch` (pure, tested) + [ProposalBatchGroup.tsx](src/app/(app)/ai/ProposalBatchGroup.tsx) with select-all. Singletons keep the existing card.
- **SSE**: no new event type — the assistant message already is the batch boundary; `proposal_created` gains optional `detail` + `batchId`.

**Context upgrades:**

- **Page-aware chat**: ChatPanel sends `usePathname()` with every message; route sanitizes (leading `/`, no CR/LF, ≤200 chars); new threads store `contextRef: "route:<path>"` (the phase-0 field, finally wired); a trailing uncached system block tells the model where the user is, with a human label from [route-context.ts](src/lib/ai/route-context.ts) (longest-prefix match over NAV_GROUPS, unit-tested). "Draft a reminder for this guest" now works without re-explaining.
- **Thread history + resume**: History button in the panel header lists past threads (`listMyThreads`, wired at last); tapping one hydrates the transcript (`getThread` → user/assistant bubbles + tool chips via a client-side label map) and continues the same thread. Past proposals are NOT reconstructed as stale Apply cards — a live pending-count strip links to /ai instead.
- **`read_proposals`** (new tool): the model can see the PENDING queue (summaries via `summariseProposal`, moved to [schemas.ts](src/lib/ai/proposals/schemas.ts) so both the dashboard and the tool share it). Write addendum now instructs: check read_proposals before proposing.

**Guardrails** ([chat.ts](src/lib/ai/chat.ts)): `MAX_TOOL_ITERATIONS` 6→8; `max_tokens` 4096→8192 (`MAX_OUTPUT_TOKENS` const); a `stop_reason === "max_tokens"` mid-turn now yields a visible error instead of silently truncating; prompt nudge to emit parallel propose calls (N proposals in one iteration).

**Foot-guns:**

- The WRITE_ADDENDUM edit invalidates the cached system prefix ONCE at deploy (plus the new tool definitions — tools render before system). First-request cache-write cost is expected, not a regression.
- The directory only renders for `ai_write` callers; read-only chat pays no extra tokens.
- `taskUpdatePayloadToFormData` is now async (loads live relations). Any future caller must await it.
- Bulk apply is sequential by design; 25-cap per call. The ChatPanel/BatchGroup never send more than one batch at a time.
- `read_proposals` mirrors listPendingProposals visibility (authors see own; couple sees all) — keep the two in sync if visibility rules ever change.

**Adversarial review pass** (54-agent workflow: 3 finders → 51 raw findings → per-finding refutation → 41 confirmed). Fixed before ship:

- *History rebuild (2 highs)*: the chat history query took the OLDEST 40 rows (asc+take), so long/resumed threads silently dropped the newest user message → now desc+take+reverse. And a `max_tokens` stop used to persist assistant `tool_use` blocks whose `tool_result` rows never got written, permanently 400-ing the thread → new `sanitizeHistory()` walker strips dangling tool_use / orphan tool_result pairs at rebuild time, healing old wedged threads too.
- *Atomic claim on apply/dismiss*: `updateMany({where: {id, status: PENDING}})` claims the row before the entity create, so two tabs can't double-create; create failure rolls the claim back to PENDING.
- *Error-event handling in the panel*: a terminal error (token/iteration cap) no longer wipes the assistant bubble — streamed text, tool chips and proposal cards stay; the error appends as its own message.
- *Retryable batch failures*: failed items stay checkbox-selectable in both batch UIs (server-side they're still PENDING), instead of being permanently stuck on "failed".
- *Directory visibility leak*: COUPLE_ONLY book sections no longer render into a non-couple user's reference directory.
- *pathname hardening*: charset allowlist (`/^\/[A-Za-z0-9\-_/.]{0,199}$/`) instead of CR/LF stripping — free-text prompt injection via the pathname field is dead; also a 4000-char cap on chat messages.
- *Smaller*: proposal buttons lock while a turn is streaming (prevents the 1→N card remount race), thread `updatedAt` bumps on new messages (history ordering), history counts exclude internal tool rows, empty assistant rows filtered from resume, `read_proposals` flags truncation, no-op task-update patches rejected, BULK_CAP raised to 50 to match the dashboard window, near-bottom guard on autoscroll, focus restore after replies, loadThread failure handling.

Known-accepted (documented, not fixed): relation merge is last-writer-wins under concurrent human edits (deltas minimize the blast radius); `listPendingProposals` take:50 can theoretically split a >50-row batch; entity renames flow into the prompt (inherent to giving the model user data); `updateTask` gates QUESTION-type rows behind the tasks permission (pre-existing app behavior).

582 unit tests → 602 (merge-task-update, proposal-grouping, route-context suites; the output-schemas walker landed with v2.1.1). Typecheck clean.

### 2026-07-02 · v2.1.0 — AI phase 6.1: edit Anthropic API key in Settings

User: *"I want to add it in the website"* — Anthropic API key without having to shell into the Unraid box.

**Schema** ([prisma/migrations/20260702000000_ai_api_key_setting/migration.sql](prisma/migrations/20260702000000_ai_api_key_setting/migration.sql)):

`ALTER TABLE "WeddingSettings" ADD COLUMN "anthropicApiKey" TEXT`. Nullable, no backfill, append-only. Runs in <1 sec at container start.

**Async key resolution** ([src/lib/ai/config.ts](src/lib/ai/config.ts)):

The old `ANTHROPIC_API_KEY` const (env-only, captured at module load) is replaced by `getAnthropicApiKey(): Promise<string | undefined>`. Resolution order: `WeddingSettings.anthropicApiKey` → `process.env.ANTHROPIC_API_KEY` → undefined.

Result is process-local cached for 30 seconds so a chat turn with 3–6 rapid tool calls doesn't hammer the DB. `invalidateApiKeyCache()` is called from the settings save action so a rotation lands on the very next call (bounded by 30s TTL for other worker processes if we ever scale beyond one).

`assertConfigured()` becomes `async` and now returns the resolved key string. The Anthropic SDK client is cached keyed by the key value in both [client.ts](src/lib/ai/client.ts) and [chat.ts](src/lib/ai/chat.ts) — when the key rotates, the next `getClient()` call rebuilds. Never end up with a stale-key SDK sending requests to Anthropic.

**Server action** ([src/app/(app)/settings/wedding-settings-actions.ts](src/app/(app)/settings/wedding-settings-actions.ts)):

`updateAnthropicApiKey(formData)` — couple-only. Accepts either a key that starts with `sk-ant-` (validated for length) OR a blank/clear signal (nulls the DB column, falls back to env). Audit log records the *transition* — `{previousSet: boolean, nextSet: boolean}` — never the key value.

`readAnthropicApiKeyState()` — couple-only. Returns `{hasKey, source: "settings" | "env" | "none", mask: "sk-ant-…xxxx"}`. The full key never leaves the server after save; the panel only ever sees the mask.

**Settings panel** ([src/app/(app)/settings/AiApiKeyPanel.tsx](src/app/(app)/settings/AiApiKeyPanel.tsx)):

New panel above the existing AiBudgetPanel in Settings → AI planner. Shows current status (mask + source), a password-typed input for a new key, Save button, and a Clear button (only when the current key came from Settings, not the env). Save validates prefix client-side and server-side; on server error the message is shown inline. On success, the "current key" line updates to the new mask.

The panel's blurb notes the key is stored in Postgres and only sent to Anthropic in the Authorization header — no third-party pass-through.

**Foot-guns:**

- **The 30-second cache is per-process.** In a single-container deployment (this one) that's fine. If we ever scale to N replicas each will lag up to 30s on rotation. Fine for wedding hub; document it if we ever need instant rotation.
- **Env var still wins if set AND DB is empty.** Blank the input, hit Save (or Clear) — the panel falls back to whatever the env var was set to at container start. If someone deleted the env var without restarting, the process still remembers it. Restart the container to fully purge.
- **Key rotation invalidates every in-flight cached SDK client.** The next call rebuilds. If a chat turn's tool loop is mid-flight when a key rotation happens, the *next* iteration's SDK client is fresh. Not a data-integrity problem — worst case the current turn's remaining calls still use the old key, but the old key was valid when the call started.
- **The key is stored plain in Postgres.** For a self-hosted 5-user app with encrypted-at-rest backups, this is the right tradeoff — app-level encryption would just move the trust boundary to a KEK, which also lives on the same box. If we ever multi-tenant this, revisit.
- **Audit metadata deliberately omits the key.** Even in a "changed" audit row, we log only `previousSet: boolean` / `nextSet: boolean`. Never the value, never the mask. Preserves the invariant that the audit log is safe to view fully.
- **Panel is gated on `user.isCouple`.** Non-couple viewers of `/settings` don't see the panel at all — no leakage of "is a key configured?" state either.

### 2026-07-02 · v2.1.0 — AI phase 6: state-of-the-wedding review

User: *"Can we have a button that reviews the overall state of the wedding — reads all the data on the site?"*

Phase 6 adds one big-picture button on `/ai` that runs a full pass across every data surface and returns a structured "how are we doing?" report. Meant to be run every few weeks — the rate limit is intentionally low (3/hour) and the model is Opus 4.8 (deep tier). Costs ~5–10p per run.

**Server action `reviewWeddingState()`** ([src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts)):

Reads a comprehensive but token-bounded snapshot:

- Tasks by status (all counts), plus every URGENT/HIGH open task (up to 20) and every overdue task (up to 20) as full rows with title + due date + priority.
- Guests by RSVP (aggregate), plus the first 25 PENDING guests by name — the ones who need chasing.
- Schedule: next 10 events (title + date + location).
- Wedding Book sections: title + card count + linked task count per section (spotting a "Décor" section with no cards is a useful signal).
- Suppliers: count per status (SHORTLIST / BOOKED / etc).
- Budget totals + per-category breakdown + top 15 upcoming payments — **only when `canView("budget")` returns true**. A non-couple reviewer gets `"BUDGET: not visible to this reviewer"` in the context and the system prompt explicitly tells the model not to mention any budget figure. Prevents leakage even if the model tries to reason about spend from other signals.

Sends the whole snapshot to Opus 4.8 with a strict-JSON `output_config.format` that requires:
```
{
  headline: string,           // one or two sentences, lead with the outcome
  onTrack: [{area, note}],    // 2–4 things going well
  concerns: [{severity, area, issue, suggestion}],  // severity ranked honestly
  nextSteps: [string]         // 3–5 concrete actions for this week
}
```

System prompt bakes in the anti-padding rule ("do NOT pad the concerns list; if things are going well, return a short array") and the honest severity ladder — `high` risks the day itself, `medium` causes real stress, `low` is polish.

Returns `WeddingReview` with `weeksToWedding`, `generatedAt`, `costPence` for the "how much did this cost" footer.

**Rate limit** ([src/lib/ai/guards.ts](src/lib/ai/guards.ts)): 3 per hour per user. This is expensive, and the couple probably shouldn't run it more than weekly anyway.

**UI** ([src/app/(app)/ai/WeddingReviewPanel.tsx](src/app/(app)/ai/WeddingReviewPanel.tsx)):

Rendered as the top section of `/ai`, above every other AI feature. Pre-run: short blurb + button. Post-run: headline banner with weeks-to-wedding + "generated N min ago", then a colour-coded concerns list (rose = high, amber = medium, slate = low) with area + issue + suggestion per row, then a numbered next-steps list, then on-track bullets, then a small cost footer. "Re-run review" replaces the initial button after the first pass.

Deep-tier calls take ~15–30 seconds. `useTransition` handles the loading state; the button text switches to "Reviewing…" and disables.

**Foot-guns:**

- **The context can be big.** ~5000 tokens on a well-populated wedding (60 open tasks + 100 guests + 30 book cards + a full budget). Opus 4.8 at £5/M input = ~2p input + ~4p output ≈ 6p per call. Cheap for the depth, but a runaway limit-flip could burn the £30/mo cap in a few days. The 3/hour rate limit is the primary guard.
- **The AI can be confidently wrong.** The footer says "sanity-check anything critical before you act" — the couple should treat this as an experienced-friend read, not a plan-of-record. Especially on concerns that reference specific counts or dates, cross-check against the raw pages.
- **PENDING guest list is capped at 25.** Bigger weddings will show "25+" but only feed 25 names to the model. It'll say "you have 25+ unanswered RSVPs" — good enough for a report; the couple opens `/guests` for the full list.
- **Budget visibility gate is doubled.** The DB query only runs when `canView("budget")` is true (nothing sensitive fetched), AND the system prompt tells the model "do not mention any budget number if you were told the budget isn't visible". If a future refactor removes one, the other still holds — never single-layer the money gate.
- **Empty-state weddings look weird.** A fresh install with 0 tasks, 0 guests, 0 events makes the AI produce a report along the lines of "you haven't started". That's technically correct but not useful — consider a client-side "run this once you've added some data" check if this ever comes up.
- **The review isn't persisted.** Transient — closing/reopening `/ai` loses the last run. A `WeddingReview` model + history table would let the couple see trajectory over time. Fine to defer; add if the couple asks.

### 2026-07-02 · v2.1.0 — AI phase 5: Suggest due dates + RSVP reminder drafts

Phase 5 adds two focused one-shots that don't need chat — they answer specific "help me with this" moments right where the couple already is.

**Suggest due dates** ([src/app/(app)/tasks/SuggestDueDatesButton.tsx](src/app/(app)/tasks/SuggestDueDatesButton.tsx), `suggestDueDates` in [src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts)):

Button in the `/tasks` page header (couple/planner only — gated on `canEdit("ai_write")`). One click:

1. Fetches up to 30 open TASK-typed rows with `dueDate: null`.
2. Refuses if none — "every open task already has a due date".
3. Calls the deep tier (Opus 4.8) with the wedding date, days-remaining, and the task list.
4. Uses strict JSON output (`output_config.format`) requiring `{taskId, dueDate, rationale}[]`.
5. Validates every suggested date is in the future AND before the wedding.
6. Emits one `task.update` proposal per valid suggestion (rationale carries the AI's reasoning).
7. Returns `{count, skipped}` — invalid rows (unknown taskId, past date, post-wedding date) go into `skipped` so the couple sees the AI didn't just quietly drop them.

Post-run, the button tooltip shows "✓ Drafted N due-date proposals — Review on /ai →" with a direct link.

**RSVP reminder drafts** ([src/app/(app)/guests/\[id\]/DraftRsvpReminderButton.tsx](src/app/(app)/guests/[id]/DraftRsvpReminderButton.tsx), `draftRsvpReminder` in [actions.ts](src/app/(app)/ai/actions.ts)):

Button on the guest detail page, only rendered when the guest is couple-tier caller AND the guest's RSVP is PENDING or MAYBE. Server action:

1. Loads guest + household name.
2. Refuses on children ("send to the parent instead") and non-PENDING states.
3. Calls the balanced tier with a "60–100 words, warm, sign off as `${brideFirst} & ${groomFirst}`, no subject line, no preamble" system prompt.
4. Passes guest first name, wedding-party role, plus-one status, and side as one summary line.
5. **Returns text, not a proposal.** The AI drafts; the couple copies. No auto-send anywhere in the pipeline.

The button reveals the draft in a textarea (editable inline before copying) with Copy and Regenerate buttons. Copy uses `navigator.clipboard`; on browsers that block it (rare — plain HTTP) the couple can still select-all manually.

Every draft is audit-logged (`ai.rsvp_reminder.drafted` action, guest id + name in metadata) so the couple can see who they've reminded from the AuditLog panel — useful when the same guest ghosts through several nudges.

**New feature labels** ([src/lib/ai/config.ts](src/lib/ai/config.ts)):

`AI_FEATURES.suggestDueDates` and `AI_FEATURES.draftGuestMessage` were already declared in phase 0 as placeholders; phase 5 finally uses them. The usage dashboard on `/ai` picks them up automatically via the `FEATURE_LABELS` map — "Due-date suggestions" and "Message drafts" as their user-facing names.

**Foot-guns:**

- **`suggestDueDates` batches up to 30 tasks.** For a wedding with 40+ open undated tasks, the couple has to run it twice. Simple safeguard against a single Opus call ballooning; if a couple regularly exceeds 30, bump the `take` to 60 (still one Opus call, under 10p at current Opus pricing).
- **Suggested dates are always at the same `YYYY-MM-DD` granularity.** The AI can't propose an hour or specific time; if the couple wants "book venue walk-through, morning", they'll need to add that in the notes themselves after Apply.
- **The RSVP reminder prompt hard-codes the couple's first names via `brideFirst`/`groomFirst`.** If the couple has changed those in Settings mid-planning, older drafts already sent will differ from newly-generated drafts — cosmetic, but worth knowing.
- **Copy-to-clipboard is silent-fail.** Browsers over http reject `navigator.clipboard.writeText`. The textarea is editable + selectable so the fallback exists, but the button silently doesn't flip to "✓ Copied". Add a browser feature-detect if the wedding site ever runs on plain http (currently doesn't — Cloudflare Tunnel forces https).
- **`suggestDueDates` uses Opus.** One call is ~15,000 input tokens (30 tasks × ~400 tokens context + system prompt) + ~4,000 output tokens = ~7p per invocation. Rate limit is 5/hour (from phase 0's `DEFAULT_LIMITS`). At £30/mo cap the couple can run it ~400 times a month — fine.
- **The suggested-dates flow doesn't set a `title` on the proposal review card.** The card summary line reads "due → 2026-08-15" without saying *which* task the AI updated. Fix in a later polish: extend `summariseProposal("task.update", ...)` to look up the task title, either via a proposal-time enrichment (store title in payload metadata) or a review-time join.

### 2026-07-01 · v2.1.0 — AI phase 4: caching, editable cap, usage dashboard, strict JSON

Phase 4 is polish + observability. No new AI capability — every existing surface gets faster, cheaper, more legible, or more reliable.

**Prompt caching** ([src/lib/ai/prompts/system-planner.ts](src/lib/ai/prompts/system-planner.ts), [chat.ts](src/lib/ai/chat.ts:154)):

`buildPlannerSystem()` now returns `Anthropic.TextBlockParam[]` instead of a plain string. The preamble (base rules + write/read addendum — stable across turns for a given user's `canWrite` bit) gets `cache_control: {type: "ephemeral"}`; the wedding snapshot (weeks-to-wedding, task counts, RSVP counts — refetched every turn) lives in a separate trailing block with no marker. Once the preamble grows past Sonnet 4.6's 2K-token cache minimum, subsequent turns bill it at cache-read rates (~0.1×). Watch `usage.cache_read_input_tokens` on turn 2+ — if it's zero, the prefix isn't hitting the minimum yet (currently borderline at ~1200 tokens).

**Editable monthly cap in Settings** ([src/app/(app)/settings/AiBudgetPanel.tsx](src/app/(app)/settings/AiBudgetPanel.tsx), [wedding-settings-actions.ts](src/app/(app)/settings/wedding-settings-actions.ts)):

New couple-only "AI planner" section on `/settings`. `updateAiMonthlyCap(formData)` server action, split off from `updateWeddingSettings` so the two forms save independently and audit metadata reads cleanly. Blank input clears `WeddingSettings.aiMonthlyCapPence` and falls back to `AI_MONTHLY_CAP_PENCE` env (default 3000p = £30). Post-save, both `/settings` and `/ai` revalidate so the header on `/ai` reflects the new cap.

**Usage dashboard** ([src/app/(app)/ai/UsageDashboard.tsx](src/app/(app)/ai/UsageDashboard.tsx)):

Server component that aggregates this calendar month's `AiUsage` rows. Renders (a) a per-feature table — one row per feature, sorted by spend descending, with call count + total tokens + cost pence; (b) a per-day mini bar chart with tooltip-ready titles. Empty state ("no calls yet") shows on fresh installs. Placed above the pending-proposal list on `/ai` so the couple sees where the month's spend went before deciding whether to Apply another chat's worth of proposals.

`FEATURE_LABELS` map lives inside the component — matches the `AI_FEATURES` names from [src/lib/ai/config.ts](src/lib/ai/config.ts) exactly, so any new feature added later automatically shows (as its raw slug until a label is added).

**Strict JSON output for guest-parse** ([src/lib/ai/client.ts](src/lib/ai/client.ts), [src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts) `parseGuestList`):

`SendMessageArgs` now accepts an optional `outputConfig: Anthropic.OutputConfig` that threads through to `client.messages.create({output_config})`. `parseGuestList` uses it with `{format: {type: "json_schema", schema: {...}}}` — the schema wraps a single top-level `guests` array (Anthropic requires an object at the root; the array lives one level down). Replaces the pre-phase-4 "please return a JSON array, no code fences" prompt + the regex-strip hack that peeled backtick fences the model sometimes added anyway. The model is now forced to emit valid JSON matching the schema; empty-guest arrays still surface as `{guests: []}`, handled the same way as before.

**Foot-guns:**

- **Prompt caching invalidates on every byte.** The preamble includes `WRITE_ADDENDUM` vs `READ_ONLY_ADDENDUM` conditional on `canWrite`. That means each user tier gets its own cache entry — fine (both are stable within a session), but if a user's ai_write permission flips mid-conversation the next turn writes a new cache. Anyone editing the addendum text should measure `cache_creation_input_tokens` on the *next* turn to confirm the cache took.
- **JSON schema wrapper level.** Anthropic's `json_schema` format requires an object at the top level. If a future extraction expects a bare array (e.g. `parseTasks` in some hypothetical phase-5 helper), don't ask the AI for `{type: "array"}` at the root — wrap it in an object first.
- **`output_config.effort` and `output_config.format` share the same struct.** If we later want strict JSON *and* effort-tuning on the same call, both go in the same `outputConfig` object. The client wrapper accepts the whole `OutputConfig`, not just `.format`.
- **The usage dashboard sorts by pence, not calls.** A single expensive Opus call outranks 20 Haiku calls. That's the right sort for "where's my money going", but if we ever want a "which features get used" view, add a second sort. Don't overload one table.
- **Editable cap accepts blank = fallback**, but the button says "Save" not "Clear" — a couple hitting Save with an empty field will (correctly) clear the DB row. Rename the button or add a discrete Clear affordance if this bites.
- **Fresh installs have zero AiUsage rows for the first month.** UsageDashboard shows the empty state; UsageBadge on the `/ai` header shows £0.00 / £30.00. Both work correctly, but new operators sometimes think "the AI isn't running" — the smoke-test ping button on `/ai` is the fastest way to prove it is.

### 2026-07-01 · v2.1.0 — AI phase 3: task edits + book summarize + guest paste

Phase 3 broadens the AI surface from "propose new things" to "propose edits" and adds two one-shot surfaces: summarise a wedding-book card and parse a pasted guest list. Same propose-then-approve model — nothing writes to real data until the couple clicks Apply.

**Schema additions** ([src/lib/ai/proposals/schemas.ts](src/lib/ai/proposals/schemas.ts)):

Three new kinds: `task.update` (`{taskId, title?, status?, priority?, dueDate?, notes?}`), `guest.create` (`{firstName, lastName, householdName?, side, email?, phone?, isChild, plusOneAllowed, plusOneName?, dietary?, role?, notes?}`), `book.card.append` (`{subsectionId, heading, text}`). `PROPOSAL_KINDS`, `schemaForKind()`, and `humanLabel()` extended to match.

**New AI tool** ([src/lib/ai/tools/propose-task-update.ts](src/lib/ai/tools/propose-task-update.ts)):

`propose_task_update` — takes a `taskId` (from a prior `read_tasks` call) plus any subset of `{title, status, priority, dueDate, notes}`, plus a mandatory rationale. Validates the taskId exists in the DB before writing the proposal — if the AI hallucinates an id, it gets a clear error back and doesn't produce a broken proposal.

Also gated on `canWrite` at the handler level in addition to registry exposure — belt-and-braces if a future refactor accidentally exposes it.

**Extended applyProposal** ([src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts)):

- `task.update` → parses the patch, builds FormData with just the fields present, calls `updateTaskAction(taskId, formData)`. Returns the same `taskId` as `appliedEntityId` (updates don't produce a new row).
- `guest.create` → looks up an existing household by name (case-insensitive) or creates one via `createHouseholdAction`, then calls `createGuestAction` with the resolved householdId. Handles the two-step create as a single Apply. Both existing actions now return `{id}` (non-breaking — FormData callers ignore returns).
- `book.card.append` → loads the TEXT card's existing `bodyHtml`, wraps the AI's summary in an `<h3>` + `<p>` block (escaping angle brackets so the sanitizer preserves literal text), and posts the updated HTML through `updateBookSubsectionAction`. Rejects non-TEXT kinds.

**Book card summarize** ([src/app/(app)/ai/SummarizeCardButton.tsx](src/app/(app)/ai/SummarizeCardButton.tsx), server action in [actions.ts](src/app/(app)/ai/actions.ts)):

New `summarizeBookCard(subsectionId)` server action. Loads the card's text, strips HTML, caps at 8000 chars, calls the fast tier (`claude-haiku-4-5`) with a "2–4 bullets, ≤80 words" prompt, and creates a `book.card.append` proposal with the result. Refuses on COUPLE_ONLY cards a non-couple user hits; refuses when the card has less than 40 chars.

`<SummarizeCardButton>` mounts inline in [CardRouter's TEXT case](src/app/(app)/book/[slug]/CardRouter.tsx:498) via a Fragment sibling to `SubsectionEditor`. Renders as a small "✨ Summarize card" button under the card body when the user can edit and the card has content. Success shows the draft summary inline plus a link to /ai to Apply.

**Guest list parse** ([src/app/(app)/ai/ParseGuestsPanel.tsx](src/app/(app)/ai/ParseGuestsPanel.tsx), server action in [actions.ts](src/app/(app)/ai/actions.ts)):

New `parseGuestList(pastedText)` server action, couple-only. Uses the balanced tier with a structured-extraction prompt (JSON array of guest rows, no prose, no code fences). Cleans up code fences the model sometimes adds anyway, JSON.parses, safe-parses each row against `guestCreateSchema`, and creates one `guest.create` proposal per valid row. Returns `{count, skipped}` so the panel can show a summary.

`<ParseGuestsPanel>` sits on `/ai` above the pending list, couple-only. Paste box, char counter, "Parse into proposals" button, success/failure inline. After a successful parse the pending list refreshes via `router.refresh()`.

**Non-breaking signature changes**:

- [createTask](src/app/(app)/tasks/actions.ts) returned `{id}` in phase 2.
- Phase 3 adds the same to [createHousehold](src/app/(app)/guests/actions.ts:135) and [createGuest](src/app/(app)/guests/actions.ts:249). FormData callers still ignore returns.

**Foot-guns:**

- **HTML append is additive only.** `book.card.append` never removes or replaces existing content — the couple can end up with duplicate summaries if they Apply the same proposal twice. The proposal moves to APPLIED after the first Apply so this can't happen through the UI, but a future "regenerate summary" flow would need to consider it.
- **The guest-parse prompt is instruction-tuned, not schema-forced.** We ask for JSON in prose; the model occasionally wraps in code fences (handled) or tacks on an explanation before the array (would fail parse). For phase 4 polish, consider `output_config: {format: {type: "json_schema", ...}}` for strict output — SDK 0.109 supports it.
- **Case-insensitive household matching is a heuristic.** If the couple has two households named "Smith" (one bride-side, one groom-side), the parser will merge new Smith guests into whichever came first alphabetically. The alternative — never match, always create — is worse (proliferates duplicate households). Manual dedup on `/guests` is the escape hatch.
- **`updateTaskAction` doesn't return a value** so `applyProposal` uses the input `taskId` as `appliedEntityId`. If the underlying update silently no-ops (e.g. wrong id somehow slipped past our earlier existence check), the Apply looks successful but nothing changed. In practice `updateTask` throws on invalid ids; the audit log is the ground truth.
- **Two model tiers now in use** — Haiku for summarize, Sonnet for chat + parse-guests. If Anthropic changes pricing, both `PRICING_USD_CENTS_PER_MTOK` rows in [src/lib/ai/cost.ts](src/lib/ai/cost.ts) need updating.
- **The Summarize button hides on empty cards.** If a card's `bodyHtml` is present but only whitespace, `Boolean(bodyHtml)` is true and the button shows — the server action then bails with "not enough text". Cosmetic; consider trim-check in the button if it annoys anyone.

### 2026-07-01 · v2.1.0-rc — AI proposals: propose + apply + dismiss (phase 2)

Phase 2 closes the loop between chat and real data. The AI can now say "I'll add that task for you" and it means it — it creates an `AiProposal` row, the panel renders an inline Apply/Dismiss card, one click funnels the write through the couple's existing `createTask` / `createScheduleEvent` server actions with all their usual permission checks and audit trail. The AI never touches the real tables directly.

**Payload schemas** ([src/lib/ai/proposals/schemas.ts](src/lib/ai/proposals/schemas.ts), new):

Central Zod schemas for each proposal kind — `taskCreateSchema` and `eventCreateSchema` — plus `schemaForKind(kind)` and `humanLabel(kind)` helpers. Both the write tool (proposal creation) and applyProposal (proposal application) validate through the same schema, so a tampered `payload` in the DB can't sneak past the apply step. The shapes are forgiving: defaults are applied where the AI usually skips (type/status/priority default to TASK/OPEN/MEDIUM; assigneeIds default to []).

**Write tools** ([src/lib/ai/tools/propose-task.ts](src/lib/ai/tools/propose-task.ts), [propose-event.ts](src/lib/ai/tools/propose-event.ts), new):

Two new AI-callable tools that emit `AiProposal` rows. Both require a mandatory `rationale` (1–2 sentences shown to the reviewer) and are hard-gated on the caller having `ai_write` — the handler returns a permission error even if the tool somehow got exposed to the model. Successful calls return `{ proposalId, kind, title, message }` so the SSE stream can surface the new proposal to the chat panel.

**Registry gate + prompt addendum** ([src/lib/ai/tools/registry.ts](src/lib/ai/tools/registry.ts), [src/lib/ai/prompts/system-planner.ts](src/lib/ai/prompts/system-planner.ts)):

- `toolDefinitions({canWrite})` now returns just the read tools when the caller lacks `ai_write`; the model literally doesn't see the propose_* tools and can't try to call them.
- `buildPlannerSystem(user, {canWrite})` swaps in two different addenda depending on the flag. Read-only callers get "You do not have write permission — tell the user to ask for ai_write access"; write-enabled callers get "You can propose changes but never write directly, include a rationale, don't spray proposals". Prevents the model from apologising about permissions it actually has.

**Chat loop event** ([src/lib/ai/chat.ts](src/lib/ai/chat.ts)):

New `proposal_created` SSE event carrying `{proposalId, kind, title}`, emitted from the tool_use loop right after a successful propose_* handler. Wired to `isProposeTool(name)` in the registry so we don't have to remember to update chat.ts when phase 3 adds more write tools.

**Apply / dismiss actions** ([src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts)):

- `listPendingProposals()` — feeds the /ai dashboard. Non-couple callers see only their own proposals; the couple sees everyone's (helpful when the planner does the chat and the couple does review).
- `applyProposal(id, override?)` — loads the proposal, re-validates payload+override against the kind's schema, converts to `FormData`, and calls `createTaskAction` / `createScheduleEventAction`. The existing actions do the permission check (`requireEdit("tasks")` / `requireEdit("schedule")`), the write, the audit log, and the `revalidatePath`. Apply then updates `AiProposal.status` (APPLIED or EDITED_AND_APPLIED depending on whether an override was provided), sets `appliedEntityId`, and logs its own `ai.proposal.applied` audit row so the review action shows up in the audit history alongside the underlying create.
- `dismissProposal(id)` — same permission gate, sets DISMISSED + reviewedAt + audit row.

Both actions gate on `canEdit("ai_write")` so a wedding-party user without permissions can't apply proposals even if they somehow got the id.

**Non-breaking action signature change**: [createTask](src/app/(app)/tasks/actions.ts) and [createScheduleEvent](src/app/(app)/schedule/actions.ts) now return `{id: created.id}` at the end. Existing FormData callers ignore the return value; applyProposal reads it to link the AiProposal to the row it produced.

**FormData bridge** — `taskPayloadToFormData` and `eventPayloadToFormData` in `actions.ts` are the only awkward part of the reuse strategy. The event helper splits the AI's ISO datetime (`2026-09-15T10:00:00Z`) into the `startDate` / `startTime` fields the existing schedule action expects. Topic links (bookSections / navTags / guestGroups) get bundled into the `topicKeys` array format `parseTopicKeys()` reads.

**Chat panel** ([src/components/ai/ChatPanel.tsx](src/components/ai/ChatPanel.tsx)):

New `LocalProposal` + `ProposalCard` render. Each proposal appears inline under the current assistant bubble with:
- Kind label ("New task" / "New event")
- Title
- Apply button (calls `applyProposal(id)` via server action, updates local state on success)
- Dismiss button (calls `dismissProposal(id)`)
- After Apply/Dismiss: an inline status badge; on error, the error message. The card doesn't disappear so the couple can see what they did in the chat history.

**/ai dashboard** ([src/app/(app)/ai/page.tsx](src/app/(app)/ai/page.tsx)):

Replaces the phase-0 "no proposals yet" placeholder with the actual pending list. Each proposal is a [ProposalReviewCard](src/app/(app)/ai/ProposalReviewCard.tsx) with the summary, rationale, "why the AI suggested this", Apply/Dismiss buttons, and a collapsible "Show details" that pretty-prints the raw payload — useful for spot-checking before Apply. Non-couple viewers with pending proposals but without `ai_write` get an inline "you'll need permission to Apply" message.

**Foot-guns:**

- The FormData bridge is one-way (payload → FormData). If we ever want to *pre-fill* a form UI from an existing proposal (edit-before-apply UX in phase 4), we'll need the inverse. For now editing means composing an `override` object programmatically.
- `applyProposal` merges `{...payload, ...override}` at the top level — nested objects (arrays of assignees, topic ids) get *replaced*, not merged. Callers doing an edit-first flow need to include the full array they want.
- The Apply path revalidates `/ai` but the underlying `createTaskAction` also revalidates `/tasks`, `/questions`, `/`, `/book`. If we ever bulk-apply proposals from the dashboard (proto-batch-apply), those revalidates fire N times. Fine for a 5-user app.
- The system prompt now branches on `canWrite`. That means the *cached* system prefix differs between read-only and write-enabled callers. Once we turn on prompt caching in phase 4, plan the two flavours as separate cache entries — don't try to share a prefix across the boundary.
- If Apply calls `createScheduleEventAction` and it *throws* (e.g. `requireEdit("schedule")` fails because we forgot to grant), the AiProposal stays PENDING. That's intentional — the reviewer sees the error inline and can retry — but it means `AiProposal.status` isn't a reliable "did the AI touch anything?" signal on its own. Use audit rows for that.

### 2026-07-01 · v2.1.0-beta — AI chat + read tools (phase 1)

Continues from the phase-0 foundation earlier the same day. Phase 1 turns the AI surface from scaffolding into something the couple can actually talk to — a global side panel that streams responses token-by-token, with six read tools that let the model reason about real data (tasks, events, guests, wedding book, budget, stats) instead of making things up.

**Read tools** ([src/lib/ai/tools/](src/lib/ai/tools/), new):

- `types.ts` — the `AiTool<TSchema>` contract: name, description, Zod input schema, Anthropic tool definition (raw JSON Schema so we don't pull in `zod-to-json-schema`), handler that takes `(input, ctx)` and returns `{ok, data} | {ok:false, error}`, plus a `progressLabel` shown in the chat panel while the tool runs.
- `read-stats.ts` — the compact snapshot (`buildWeddingContext()` + `renderWeddingContext()`, phase 0). Called at the start of most chats.
- `read-tasks.ts` — filter by status / type / priority / due-date range, plus an `overdue: true` shortcut. Returns id + title + status + priority + due-date + first-line notes + assignee first-names. Task IDs are useful for phase-2 proposal wiring.
- `read-events.ts` — schedule between two dates.
- `read-guests.ts` — filter by RSVP / side / hasDietary / isChild; always returns aggregate counts alongside the filtered list so "how many attending?" doesn't need a full scan of the list.
- `read-book.ts` — without a slug returns the section index; with a slug returns cards in that section (title + kind). `includeBody: true` pulls TEXT card contents (HTML-stripped, capped at 500 chars). Respects COUPLE_ONLY visibility per-caller.
- `read-budget.ts` — per-category totals of estimated / actual / paid, plus the top 10 upcoming payments. Gated on `canView("budget")` — the AI gets `"Budget is couple-only; caller doesn't have access."` back when a non-couple user asks, which the planner prompt tells it to relay honestly.
- `registry.ts` — collects tools, dispatches by name, safe-parses inputs, catches handler throws so the model gets a JSON error blob instead of a crash. Uses `AiTool<any>[]` at the collection boundary because generic invariance can't accept a heterogeneous list.

**System prompt** ([src/lib/ai/prompts/system-planner.ts](src/lib/ai/prompts/system-planner.ts), new):

`buildPlannerSystem(user)` returns a two-part string — a stable "you are a wedding planner..." preamble with ground rules, format guide, and access rules, followed by the current wedding snapshot. The preamble lives at the top of the prefix so once we add `cache_control` (phase 4 polish), the preamble caches and the volatile snapshot at the end doesn't invalidate it.

Notably, the prompt explicitly tells the model *"You cannot write to the app's data yet"* and *"You cannot send emails"* — phase 1 is read-only by contract. Phase 2 relaxes this once the proposal tools ship.

**Streaming chat loop** ([src/lib/ai/chat.ts](src/lib/ai/chat.ts), new):

`runChatTurn({user, threadId, text})` is an async generator that yields structured `ChatEvent`s: `thread` (when a new one gets created), `text` (delta bytes), `tool_start` / `tool_end` (progress markers), `message_end` (per-iteration cost), `done`, `error`. The loop:

1. Reserves budget + rate limit *before* opening the stream.
2. Resolves or creates the thread; asserts caller owns it.
3. Persists the user message.
4. Reconstructs history from `AiMessage` rows — user rows become `{role: "user", content: text}`, assistant rows deserialize `toolCalls` JSON back into `ContentBlock[]`, tool rows deserialize the `ToolResultBlockParam[]` payload we saved. Everything the model sees on turn N was reconstructed from the DB.
5. Streams the Anthropic call; forwards `text_delta` deltas as they arrive.
6. On `stop_reason: "tool_use"`, dispatches each `ToolUseBlock` through the registry, appends `ToolResultBlockParam`s to the message list, persists a `role:"tool"` row for future turns to replay, loops back. Capped at 6 iterations — if the model wants a 7th we abort with an error rather than loop forever.
7. Per iteration: writes `AiUsage` + an `audit(action:"ai.call", entity:"AiUsage", metadata:{...threadId, iteration})` entry. Both are `void Promise.all(...)`'d so a write failure doesn't kill the stream.

**Streaming API route** ([src/app/api/ai/chat/route.ts](src/app/api/ai/chat/route.ts), new):

`POST /api/ai/chat` — auth-gated, honours `AI_ENABLED`. Wraps `runChatTurn()` in a `ReadableStream<Uint8Array>` that writes each event as an SSE frame (`event: <type>\ndata: <json>\n\n`). `runtime: "nodejs"` so the Prisma client + Anthropic SDK work.

**Server actions** ([src/app/(app)/ai/actions.ts](src/app/(app)/ai/actions.ts), new):

`listMyThreads()` and `getThread(threadId)` — read-only, respect `canView("ai_chat")`, only return the caller's own rows. Writes stay behind the `/api/ai/chat` route so token accounting can't be routed around. `tool` rows are filtered out of `getThread`'s transcript — they're internal plumbing, not user-facing.

**Global side panel** ([src/components/ai/](src/components/ai/), new):

- `ChatPanelHost.tsx` — server component. Runs the `auth()` + `canView("ai_chat")` + `AI_ENABLED` check server-side and returns null when any fails. Passes the caller's first name into the client panel.
- `ChatPanel.tsx` — client component. Renders (a) a floating "✨" trigger button bottom-right (bottom-20 on mobile so the tab bar doesn't cover it), (b) a slide-in `<aside>` from the right (380px on desktop, full-width on mobile with a backdrop for click-away close), (c) a message transcript, (d) a textarea with Enter-to-send (Shift+Enter for newline). Mounted via `createPortal(..., document.body)` so it survives client navigation and isn't scoped to any page container.
- SSE parsing lives inline — `res.body.getReader()` + `TextDecoder`, split on `\n\n`, dispatch by `evt.type`. No SSE library needed for one endpoint.
- Tool markers render as small pill-chips under the current assistant bubble ("… Reading tasks…" → "✓ Reading tasks…" when done). Feels like actual work is happening even during the several-second gaps while a tool runs.

`AppShell` mounts `<ChatPanelHost />` once at the layout root, next to `<Toaster />` and `<QuickCapture />`.

**Foot-guns for future me:**

- The chat history in `AiMessage` stores assistant `content` as *both* a text field (for search / display) *and* the full `toolCalls` blob (`ContentBlock[]` as JSON) — the loop rehydrates from `toolCalls` when non-empty because a plain-text-only echo would drop tool_use blocks and confuse the model on the next turn. Never treat `AiMessage.content` alone as the round-trip source.
- `tool` rows persist the entire tool_result batch as a JSON-stringified `ToolResultBlockParam[]`. If the batch is huge (large `read_book` payload with `includeBody:true`), that row is big. Currently fine because our biggest read tool caps output at ~500 chars per card × maybe 20 cards → 10 KB. If a future tool returns megabytes, split the persistence.
- Rate limit for chat: 20 messages / 5 min / user. On a fast conversation with multiple tool iterations per turn, that's per *turn* not per iteration — because we only call `rateLimit()` once at the start of `runChatTurn()`. Watch this if we ever open the app up to non-couple users.
- The `MAX_TOOL_ITERATIONS = 6` cap is a bit tight — a model that wants to `read_stats` → `read_tasks` → `read_events` → `read_guests` → `read_book` → `read_budget` uses all 6 in one turn with no room for a final synthesis. Bump to 8 if we see the abort message in practice.
- SSE bytes flow through Next.js's `Response` stream. In production behind Caddy, `X-Accel-Buffering: no` (already set) prevents buffering; if we ever swap Caddy for nginx, that header keeps working.
- The client panel filters `tool` messages out of the display, but the chat loop still uses them to reconstruct context. If a phase-2 proposal-review UI shows the pending queue *inside* the panel, don't accidentally hide the proposal-generating tool_use markers as well.

### 2026-07-01 · v2.1.0-alpha — AI planner foundation (phase 0)

User: "Can we add AI to the wedding app?" — with a follow-up describing the wanted shape: an AI wedding planner covering timeline management, due-date suggestions, chat, task/content generation, notes summarize, and guest helpers, 12 weeks until the wedding, toddler-limited time. Locked-in decisions from the follow-up: Anthropic API (Claude), propose-then-approve for every write, global side panel for chat, £10–30/month soft cap, per-feature access gating.

Phase 0 lays the foundation only — no chat, no proposals in the UI yet. What ships:

**Schema** (`prisma/migrations/20260701000000_ai_planner_scaffold/migration.sql`, new):

1. New enum `AiProposalStatus` (`PENDING` / `APPLIED` / `DISMISSED` / `EDITED_AND_APPLIED`).
2. New tables `AiThread` (per-user chat threads), `AiMessage` (turns with `role` / `content` / `toolCalls` / per-message token counts), `AiProposal` (the propose-then-approve queue — `kind` + `payload` + `rationale` + `status`, links back to `AiMessage` via `messageId` and to `User` via `createdById`), `AiUsage` (per-call token + pre-computed `costPence` ledger, keyed by `feature` label for per-surface breakdown).
3. `WeddingSettings.aiMonthlyCapPence Int?` — user-editable budget cap; NULL falls through to `AI_MONTHLY_CAP_PENCE` env, then to a 3000-pence (£30) hard default.

Append-only migration — no existing table structure changes, safe on a live prod DB.

**Permissions** (`src/lib/permissions.ts`):

- Added `ai_chat` and `ai_write` to the `SECTIONS` union. `ai_chat` gates the (upcoming) side-panel and read-only tool calls; `ai_write` gates proposal creation + apply — anything that would touch real data. Couple bypass grants both automatically. Wired into both `MemberOverridesBlock` and `PermissionGroupsBlock` label maps so the Settings matrix renders the new toggles.

**AI library** (`src/lib/ai/`, new):

- `config.ts` — three model tiers (`fast` → `claude-haiku-4-5`, `balanced` → `claude-sonnet-4-6`, `deep` → `claude-opus-4-8`), feature label registry, `AI_ENABLED` kill-switch, `assertConfigured()` throwing `AiDisabledError` when the API key is missing.
- `cost.ts` — Anthropic pricing table in USD-cents per 1M tokens, rough £ conversion (`USD_CENT_TO_PENCE = 0.79`), `computeCostPence()` rounds up so aggregate spend is never under-reported to the budget guard.
- `guards.ts` — `budgetGuard()` sums this calendar month's `AiUsage.costPence` and throws `BudgetExceeded` when spent ≥ cap. `rateLimit(userId, feature)` counts recent `AiUsage` rows for a rolling window per feature. `readCapState()` surfaces spent / cap / remaining / weeks-to-wedding for the dashboard.
- `context.ts` — `buildWeddingContext()` snapshots the couple's wedding date, weeks/days remaining, venue, task counts by status (including `overdue`), and guest RSVP counts. `renderWeddingContext()` writes it as a compact text block for the system prompt.
- `client.ts` — `sendMessage()` wraps `client.messages.create`; reserves the budget guard + rate limit *before* the outbound call; uses adaptive thinking (`{type: "adaptive"}`) when requested (only supported "on" mode on Opus 4.7+); writes an `AiUsage` row and an `audit(action: "ai.call", entity: "AiUsage")` entry on every response; returns `{content, stopReason, model, usage, costPence}`.

**Env vars** — `ANTHROPIC_API_KEY`, `AI_MONTHLY_CAP_PENCE`, `AI_ENABLED` added to [.env.production.example](.env.production.example) with a new "AI planner (v2.1.0)" section, and to the [CLAUDE.md](CLAUDE.md) env-vars table.

**Smoke test surface**:

- `src/app/api/ai/ping/route.ts` — POST-only route that auth-gates on `requireUser`, honours `AI_ENABLED`, runs one Haiku call ("Reply with a single word: pong."), returns `{ok, model, costPence, reply}` or a structured error. Costs about a tenth of a pence per call.
- `src/app/(app)/ai/page.tsx` — new `/ai` route, gated on `canView("ai_chat")`. Shows this month's spend vs cap, a placeholder for the proposal review list (phase 2 fills it in), and a "Send test ping" button (client component in `PingButton.tsx`) that hits `/api/ai/ping` so we can confirm the whole pipeline from a browser.

**What's deferred to later phases** (recap of the plan): phase 1 — streaming chat via `/api/ai/chat`, `ChatPanel` mounted at the app-shell layout via a portal, read-tools for tasks/events/guests/book/budget; phase 2 — `propose-task` / `propose-event` tools + review UI + apply/dismiss actions; phase 3 — book summarize + guest helpers; phase 4 — polish + usage dashboard + prompt tuning.

**Foot-guns to watch when phase 1 lands:**

- The SDK types (`@anthropic-ai/sdk@0.109`) already model `{type: "adaptive"}` — no need for the `budget_tokens` escape hatch, which would 400 on Opus 4.8/4.7 anyway. Keep future call sites on adaptive.
- `computeCostPence` uses a static FX rate. If the £/$ rate shifts materially, edit `USD_CENT_TO_PENCE` — do not backfill old rows; they represent what we were charged at the time.
- The rate limits in `guards.ts` count `AiUsage` rows, which get written *after* the call succeeds. Under high concurrency the counter can lag by one or two calls. Fine for a 5-user app; revisit if it ever grows.
- `AiUsage.userId` cascades on user delete. That's intentional — a deleted user's usage rows going away is desirable — but it means the monthly ledger loses history if you delete an account mid-month. If audit continuity matters more than tidy deletes, soft-archive the user instead.

### 2026-05-25 · v2.0.0 — Drop LEGAL card kind

User: "can we drop the legal stuff from the wedding book, not sure this is UK Centric."

The v1.34.0 LEGAL kind was designed around UK marriage law — pre-seeded with "Notice of Marriage" (the 28-day notice the bride/groom files at their local register office), "marriage certificate pickup" per-person, "name-change evidence" for the bride, registrar contact, and a per-card `dueByDate` with a Today-dashboard widget surfacing things within 30 days. Useful for a UK couple; not portable; not useful here either since the actual UK legal admin is already handled out-of-band by the registrar. Drop the whole feature.

**Schema** (`prisma/migrations/20260525000000_drop_legal_card_kind/migration.sql`, new):

1. `DELETE FROM "BookSubsection" WHERE kind = 'LEGAL'` — cascades to `BookLegalCard` (Cascade) → `BookLegalItem` (Cascade). File rows referenced by item.fileId are not affected (SetNull, and the items are dropped anyway).
2. `DROP TABLE "BookLegalItem"`, then `DROP TABLE "BookLegalCard"`.
3. Recreate `BookSubsectionKind` enum without LEGAL via the standard rename-recreate-cast-drop pattern. The pre-cast DROP DEFAULT / post-cast SET DEFAULT dance is required because the column carries `@default(TEXT)` which Postgres needs to detach before re-typing.

**Code surfaces stripped** (16 files touched / deleted):

- `prisma/schema.prisma` — `model BookLegalCard` + `model BookLegalItem` deleted; `legalCard` relation field dropped from `BookSubsection`; `LEGAL` removed from `BookSubsectionKind`; `bookLegalItems` back-relation dropped from `File`.
- `src/app/(app)/book/[slug]/BookLegalCard.tsx` — 684-line editor file deleted.
- `src/lib/book-cards.ts` — `legalRollups()` function + `LegalCardShape` / `LegalItemShape` / `LegalRollups` types + `LEGAL` from `BOOK_CARD_KINDS` + `LEGAL` from `BOOK_CARD_KIND_META`.
- `tests/unit/legal-rollups.test.ts` — full file deleted (was the 7-test suite for `legalRollups`).
- `src/app/(app)/book/actions.ts` — 200-line `saveLegalCard` + 30-line `attachFileToLegalItem` + 30-line `detachFileFromLegalItem` + the `LEGAL` arm in `createBookSubsection`'s kind-seeding switch. `parseISODate` helper (which lived inside the LEGAL block as a closure) lifted to the top-level helper cluster because `saveStayCard` still uses it for checkInDate/checkOutDate.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — `import BookLegalCard` + `"LEGAL"` member of `Sub.kind` + `legalCard` field on `Sub` type + the `case "LEGAL":` render branch.
- `src/app/(app)/book/[slug]/page.tsx` — `legalCard` Prisma include + `hasLegal` predicate + the `weddingSettings` fetch (which only existed for the LEGAL expiry-before-wedding flag) + the per-subsection `legalCard` shaping.
- `src/app/(app)/book/page.tsx` — `legal-admin` SECTION_META entry + `legal` keyword branch in `fallbackGlyphFor` + `legal-admin` from the LEGACY_SLUGS set.
- `src/lib/today-widgets.ts` — `nextLegalDeadlines()` + `LegalDeadlineCard` / `LegalDeadlineHit` types + the `MS_PER_DAY` constant they used.
- `tests/unit/today-widgets.test.ts` — 6 `nextLegalDeadlines` cases dropped; `oldestOpenDecisions` suite untouched.
- `src/app/(app)/page.tsx` — `bookLegalCard.findMany` fetch + `nextLegalDeadlines` call + `legalHits` variable + the legal-deadlines widget render.
- `src/app/(app)/TodayCrossModuleStrip.tsx` — `LegalWidget` sub-component + `LegalDeadlineHit` prop + `Pill` / `dayPill` helpers (only used by LegalWidget). Strip framework + DecisionsWidget unchanged.
- `prisma/seed.ts` — `seedLegalSections()` function (~380 lines) + the 3 section entries (`legal-before` / `legal-day` / `legal-after`) + the main() invocation.
- `scripts/reset-book.ts` + `scripts/seed-samples-only.ts` — `seedLegalSections` import / call + the BookLegalCard/Item references in the doc comment + the LEGAL-card count in the console summary.
- `src/lib/audit-format.ts` — 3 audit action handlers (`legal-save` / `legal-file-attach` / `legal-file-detach`). Historical audit rows referencing these survive in the DB and fall through to the default render at the bottom of the file.
- `src/components/ui/Illustrations.tsx` — `IllusLegal` SVG (notebook-with-quill scene) + its `case "legal-admin"` mapping in `bookSceneFor` + the keyword branch.
- `src/app/(app)/book/[slug]/bookCardUi.tsx` — header comment listing LEGAL trimmed.

**Production impact.**

- Any existing `legal-before` / `legal-day` / `legal-after` sections in production data — including the seeded UK content — get deleted by the migration. User confirmed they're OK losing it (manual export via psql was offered and declined).
- After deploy + migrate, the kind picker on "+ New card" no longer offers Legal. Historical audit rows mentioning `legal-save` etc. still exist but render as the generic fallback.
- Restoring a pre-v2 backup will fail to apply the v2.0.0 migration twice — that's expected. Forward-fix only.

**Why a major version bump.**

This is the first deliberate breaking schema change since the project started. Two tables permanently dropped, an enum value removed, user data destroyed. v1.x = build-up; v2.0 = the first deliberate prune. Subsequent v2.x will continue patch / minor as before.

573 tests pass (down 13 from v1.99.8's 586 — 7 legal-rollups + 6 nextLegalDeadlines). `npx prisma generate` clean. `npx tsc --noEmit` clean. `npm run build` clean.

---

### 2026-05-18 · v1.99.8 — Delete-section from the Edit Details modal

User: "Cant delete 'People'" (referring to the Wedding Party — People section on /book).

The `deleteBookSection(id)` server action has shipped since v1.4.0 — with proper `requireEdit("book")` gating + an audit row snapshot pattern from v1.54.0 — but **never had a UI surface**. Until v1.99.8 the only way to remove a section was via Prisma Studio (`docker compose exec db psql …` then `DELETE FROM "BookSection" WHERE id = '…'`) or hand-rolled SQL on the production DB. Easy to overlook because the create + reorder + rename UX is fully wired; delete was the quiet gap.

**Fix.** Added a "Delete section" button to the v1.94.0 `EditSectionToggle` modal. That modal already exists for renaming + subtitle editing — surfaced as the "Edit details" ghost button on `/book/[slug]`'s header (next to "+ New card"). The delete button:

- Lives on the **left** of the modal footer in danger tone (`text-danger hover:bg-danger/10`). Footer layout: `[Delete section] (left) / [Cancel] [Save] (right)` — destructive action visually distant from the primary CTA. Mirrors CardChrome's housekeeping row + the v1.85 budget-category modal.
- Confirms via `useConfirm` with the section's title in the prompt + a body warning: "All cards inside this section will be deleted too. This can't be undone." The cascade is real — `BookSection → BookSubsection` is a `Cascade` foreign key in `prisma/schema.prisma`, so removing the section drops every card inside it.
- On confirm, dispatches `deleteBookSection(id)` inside `startTransition`. The action revalidates `/book` server-side. After the await, the client calls `router.push("/book")` so the user lands on the overview instead of getting a 404 when Next tries to re-render the now-deleted section page.

No new server action, no schema change. Pure UI surfacing of an action that has shipped for 95 versions. 586 tests stay green.

---

### 2026-05-18 · v1.99.7 — Position-based accent rotation on /book

User: "Colours on this page dont seem to alternate" (screenshot of the Wedding Book overview grid showing three same-colour cards in a row — Clothing & Accessories, Wedding Party — People, Wedding Party — Day-of all rendered in `bg-moss-100`).

**Root cause.** Pre-v1.99.7 each card resolved its accent in two layers:
1. **Canonical slugs** (the prototype's 7) read accent from a hard-coded `SECTION_META[slug].accent`.
2. **Custom slugs** went through `fallbackAccentFor(slug)` — a deterministic hash that mapped slug → one of three accents.

Neither layer knew about neighbours. The hash for custom slugs was deterministic-per-string, so several user-authored slugs that happened to hash to the same modulo bucket clustered together. The screenshot shows the worst case: three custom slugs in row 1 all hashed to `bg-moss-100`, three more in row 2 all to `bg-marigold-100`.

**Fix.** Switched to a **position-based rotation**. New `accentFor(idx)` walks a fixed 3-element list `[bg-moss-100, bg-marigold-100, bg-moss-50]` by index modulo 3. Section 0 gets the first accent, section 1 the second, section 2 the third, then it wraps.

**Property gained.** In any column count (1 / 2 / 3 / N cols), no two horizontally-adjacent cards ever share a colour. Vertical neighbour matches can still happen in a 3-col viewport (where `idx + 3` lands on the same accent), but the visible "3-in-a-row" complaint is resolved — that was the dominant visual concern.

**Trade-off accepted.** Re-ordering sections via the v1.87.0 ▲/▼ buttons now shifts the colour of every card after the moved one. Sections also lose their "stable per-slug" colour identity. Both are acceptable: re-ordering is rare, and the prototype's identity-by-colour was already broken by adjacent-same-colour clusters.

**Code shape.** `SECTION_META.accent` values stay in the type (existing reads compile) but are unused by the renderer. Glyph + description still resolve via `SECTION_META[slug]` for canonical slugs, falling through to `fallbackGlyphFor` / `DEFAULT_META.description` for custom ones — those rotations weren't broken.

No schema, no actions, no test churn. 586 tests stay green.

---

### 2026-05-18 · v1.99.6 — Hero pinned to top of card

User: "The image header if applicable needs to render at the top of the page."

Pre-fix the hero rendered INSIDE the ImageGallery component, which itself lived inside the "photos" entry of the v1.99.0 ReorderableCardBody registry. So wherever the user reordered "photos" to (e.g. below stats, or below notes), the hero went with it — defeating the v1.99.4 design intent of the hero being a top-of-card feature.

**Fix.** Lift the hero render OUT of ImageGallery into a new standalone `<GalleryHero />` exported component:

- `<GalleryHero file={...} position={...} editMode={...} pending={...} onPositionChange={...} onUnpin={...} />`
- Self-contained: owns its own lightbox state (with Esc-to-close), renders its own 3×3 position dot grid, its own unpin ★ button.

Each editor now mounts `<GalleryHero />` via `CardChrome.mediaBlock` — that slot was added in v1.97.0 for top-of-card media, marked deprecated in v1.99.0 when photos moved into the body registry, and now returns to active duty for the hero specifically. The slot renders between the title row and the body children, anchoring the hero to the top of the card regardless of where the user reorders the "photos" component in the body.

**ImageGallery API trimmed.** `headerPosition` + `onHeaderPositionChange` props removed (they only made sense to the hero, which is no longer inside ImageGallery). `headerFileId` stays — ImageGallery still uses it for two things: dedupe the pinned image out of the body section (so it doesn't double-render), and light up the ★ on the corresponding thumb.

**Editor sweep across all 6 ImageGallery-using kinds:**
- TEXT (`SubsectionEditor`), OUTFIT (`BookOutfitCardEditor`), SETUP, BUILD, STAY → pass `<GalleryHero />` to `CardChrome.mediaBlock`.
- DRESS_CODE → uses a bespoke `<article>` (no CardChrome), so the hero renders inline at the top of the body block. Same component, different mount point.

**Hero file resolution** runs in each editor (small closure):

```ts
if (!card.headerFileId) return undefined;
if (!card.fileIds.includes(card.headerFileId)) return undefined;
const heroFile = files.find((f) => f.id === card.headerFileId);
if (!heroFile || !heroFile.mimeType.startsWith("image/")) return undefined;
return <GalleryHero file={heroFile} position={card.headerPosition} editMode={editing} pending={pending} onPositionChange={changeHeaderPosition} onUnpin={() => pinHeader(null)} />;
```

Two guards baked in: pinned file must be in the attached list (defends against detach-while-pinned), and must be an image MIME. Falls through to `undefined` otherwise so the mediaBlock slot doesn't render.

No schema, no actions, no test churn. 586 tests stay green.

---

### 2026-05-18 · v1.99.5 — Date before status on linked-tasks

User: "Small addition in this pass, make the dates in the task appear before the status."

Pre-fix both linked-tasks panels (`LinkedTasksPanel` at the section level + `CardLinkedTasksPanel` at the per-card level) rendered the row as `[T/Q/D chip] [title] [STATUS pill] [date] [Edit]`. The status pill sat between title and date, so the eye had to skip past it to read the due date — but at a glance "when is this due" tends to matter more than the OPEN/DONE state (the title's line-through + the checkbox state already communicate done-ness; the status pill is a redundant double-check).

Swapped the render order in both files to `[T/Q/D chip] [title] [date] [STATUS pill] [Edit]`. Date reads first; status sits at the row's right edge as the trailing summary chip alongside the Edit button.

Two-line change in each file. No schema, no actions, no test churn. 586 tests stay green.

---

### 2026-05-18 · v1.99.4 — Photo gallery upgrade (header additive + position + mosaic + slideshow resize + 4-kind sweep)

User: "When an image is favourited, add a header by default, and allow me to position the image in the header, the header is in addition to a slideshow or gallery, can you also add a mosaic mode? With these edits in mind, can we also be able to resize the slideshow, sizes should be the same as the gallery options, think of any gaps and ux bugs you can foresee when your adding this, these options should apply to all cards."

Five coordinated changes to the photo-gallery system on Book cards.

**(1) Tied "favourite = header" model.** Pre-v1.99.4 the user had to (a) click ★ on a thumb to pin it AND (b) separately switch `display` to "header" via the ModePicker. Now (a) is enough — `headerFileId != null` is the single state. Clicking ★ pins; clicking again unpins (and removes the hero). No separate "header enabled" boolean — one state, simpler mental model.

**(2) Header is additive, not exclusive.** Pre-v1.99.4 `photoDisplay` was a 3-way exclusive enum `gallery | header | slideshow`; picking "header" hid the gallery/slideshow body entirely. Now the body is one of `gallery | slideshow | mosaic` AND the hero — when there's a pinned image — renders ABOVE it. The body filters out the pinned image so it doesn't double-render. Render-level guard in ImageGallery handles the detach-while-pinned race (hero silently doesn't render if the pinned file isn't still in the attached list).

**(3) 9-point hero positioning.** New `BookSubsection.headerPosition String @default("center")` column (migration `20260518300000_book_photo_header_position_and_mosaic`, additive). Values: `tl|t|tr|l|c|r|bl|b|br`. Maps to CSS `object-position` at render time on the hero `<img>`. Edit-mode UI: a 3×3 dot grid overlaid bottom-right on the hero — marigold-filled dot = active, click any other to reposition. Backdrop-blur background so it stays legible across image content. New `setBookSubsectionHeaderPosition` server action (same shape + audit pattern as v1.96.4 `setBookSubsectionPhotoSize`).

**(4) Mosaic body mode (Pinterest masonry).** New value `"mosaic"` in `PHOTO_DISPLAYS` allowlist (`["gallery", "slideshow", "mosaic"]` — "header" dropped). The new MosaicMasonry sub-renderer uses CSS `column-count` so images flow at their natural aspect ratio, heights staggering naturally. Column count scales with `photoSize`: xs:5 / sm:4 / md:3 / lg:2 / xl:1. `break-inside-avoid` keeps an image from being split across columns. Acknowledged limitation: a one-shot layout shift on first paint because intrinsic image dimensions aren't stored on the File table — `loading="lazy"` + `break-inside-avoid` minimise visible jank. Storing image dimensions is queued as a future polish.

**(5) Slideshow gets size.** Pre-v1.99.4 the carousel was fixed `aspect-[16/9]`. Now height comes from `photoSize`: xs:160px / sm:220px / md:300px / lg:400px / xl:520px. Width still fills the container. The existing SizeToggle (which was gallery-mode-only — `display === "gallery"` gated in the parent) now renders for gallery + slideshow + mosaic.

**Migration semantics.** Existing rows with `photoDisplay='header'` flip to `'gallery'` (those rows had a pinned image anyway, so the hero still renders post-migration and the body just resolves to a thumb grid). Strictly more visible than the pre-migration state where header mode hid the body entirely.

**4-kind wiring sweep.** Per the v1.97.0 carryover, DRESS_CODE / SETUP / BUILD / STAY didn't thread `photoSize / photoDisplay / headerFileId / slideshowAuto` through to `<ImageGallery>` — they inherited the prop surface defaults (centre / gallery / null / false) which made the v1.97.0 display modes effectively inoperative on those cards. v1.99.4 finishes that sweep: all 6 ImageGallery-using kinds (TEXT, OUTFIT, DRESS_CODE, SETUP, BUILD, STAY) now share the full prop surface + handler cluster (`changePhotoSize`, `changePhotoDisplay`, `pinHeader`, `changeHeaderPosition`, `toggleSlideshowAuto`). LODGING_GUIDE has no gallery so excluded. DRESS_CODE's split view/edit ImageGallery instances were consolidated into one — pre-fix the view-mode instance always rendered in gallery mode regardless of what the user picked, because it never received the `display` prop.

**Shared narrowing helpers in CardRouter.** `narrowSize / narrowDisplay / narrowHeaderPosition` consolidate the inline defensive guards that pre-v1.99.4 lived as repeated `=== "xs" || === "sm" || …` chains in each case. Pre-fix two cases (TEXT, OUTFIT) had the chain; the four new ones would have added four more copies.

**UX gaps handled:**
- Detach a pinned image → render guard skips the hero silently. Pin persists in DB; user can re-pin or detach properly.
- Pin the only photo → body section suppressed in view mode (no empty placeholder under the hero); edit mode still shows empty hint so the user can attach more.
- Switch to mosaic with 1 image → CSS `column-count` renders as a single full-width tile.
- Slideshow autoplay timer + size change → interval persists (keyed off `fileIds.length`).
- Lightbox keyboard nav — `allImages` now includes the hero (previously gallery-only) so opening the hero and pressing → still flips through siblings.

No schema reads break, no API surface removed (the `header` value still typechecks against the wider `string` server input, just gets normalised by narrowing). 586 tests stay green.

---

### 2026-05-18 · v1.99.3 — WEDDING_PARTY card design upgrade

User: "Lets upgrade the wedding party cards, they dont need a title, they already have one, can we add the square blocks for the stats at the top like the other cards? anything editable should be hidden behind the edit screen."

Three coordinated changes brought BookWeddingPartyCard up to the v1.96.4 / v1.97.0 OUTFIT design pattern.

**(1) Dropped the redundant `groupLabel` input.** Pre-fix every WEDDING_PARTY card carried two surfaces for the same identity: CardChrome's inline-editable title (e.g. "Bridesmaids") at the top of the article, and a `<Input placeholder="e.g. Bridesmaids / Groomsmen / Flower girls">` immediately below it. Couples consistently filled in only the title and left the group-label input blank, then noticed the "No group name set" italic placeholder cluttering the body. Both the input and the read-mode `<savedGroupLabel>` span are now gone — title is the canonical identifier. The DB column `BookWeddingPartyCard.groupLabel` stays so historical values aren't destroyed (the `saveHeader` server action still round-trips it as `card.groupLabel`, just no longer mutated), but it's not surfaced anywhere in the editor.

**(2) Stats tile row at the top.** OUTFIT's v1.96.4 stats tile pattern (Sorted / Budget / Items-total) lands on WEDDING_PARTY too. Three tiles — Sorted (X/Y) · People (N) · Items (N). Pre-fix the same information lived as a `text-[11px]` summary chip ("0 of 8 sorted · 4 people · 2 items") in the dropped header row. Tiles register as the `stats` component in the v1.99.0 layout registry, so couples can reorder the row past the Matrix or hide it entirely via the ↑/↓/👁 chrome.

**(3) View / Edit toggle replaces inline-save.** Pre-v1.99.3 the editor was inline-save throughout: matrix cells were `<select>` dropdowns whenever canEdit; member/item rename + reorder + delete affordances appeared on hover; "+Add person / + Add item" buttons sat permanently at the bottom of the matrix; notes was a textarea. View-mode and edit-mode visually identical, just less interactive. The user asked for a cleaner read view. Now:

- **View mode** (default): status pills (`✓ Have`, `→ Ordered`, `○ Need`, etc.) in place of dropdowns. Static member / item names with no per-row ✎ × ▲ ▼ affordances. No "+Add" buttons. Notes renders as a `whitespace-pre-wrap <p>` paragraph (or "No notes." italic when empty).
- **Edit mode**: full pre-fix behaviour — dropdowns, hover affordances, add buttons, notes textarea. Cells still save individually on click (no draft state — matches the snappy inline feel; saving the matrix as a transaction would mean a single bad cell could lose all the others). Member / item rename is still inline-save inside their respective dialogs. Notes uses a draft so Cancel reverts a half-typed edit.

The v1.99.1 `layoutEditing` toggle is gone — reorder/hide chrome now rides on the new `editing` flag like every other kind. v1.96.4 `hideHousekeeping={editing}` keeps the chrome footer focused on Cancel / Save while editing.

**Save semantics.** Since cells / member renames / item renames all persist as individual server actions on change, `Save changes` only needs to commit the notes draft. When the notes haven't changed, Save is a no-op fast-path (no server roundtrip — just `setEditing(false)`).

No schema, no actions, no data migration. 586 tests stay green.

---

### 2026-05-18 · v1.99.2 — Task / Question / Decision identifier chip

User: "In the task list for each page, can we add an identifier for question task and decision?"

Pre-fix the linked-tasks panels on `/book/[slug]` (`LinkedTasksPanel` at the section level + `CardLinkedTasksPanel` at the card level) only rendered the T/Q/D identifier in **read-only** mode. When canEdit was true the row swapped the glyph for an interactive checkbox — useful for the workflow (one-click status toggle) but it meant the couple, who's editing, could no longer tell tasks / questions / decisions apart at a glance. A row's title alone often doesn't disambiguate ("Floral choices" might be a TASK, a QUESTION, or a DECISION).

**Fix.** New small `<TaskTypeBadge>` chip renders alongside the checkbox in **both** modes:

- `T` — muted canvas tone (TASK is the default, no signal needed)
- `Q` — marigold (matches the in-progress pill the tasks panel uses for OPEN; reads as "needs answer")
- `D` — info-blue (distinct from the marigold; reads as "needs deciding")

Width-locked to 22px and `flex-shrink-0` so the title column stays aligned across rows of mixed types. Hover title carries the long label ("Question" / "Decision" / "Task") for the screen-reader-curious. Bold 9px uppercase with 1px border + 1px padding — small enough not to crowd dense lists, big enough to scan in the peripheral vision while reading titles.

**Why duplicate the helper rather than extract it?** The two callers (LinkedTasksPanel + CardLinkedTasksPanel) sit next to each other in the same directory and the helper is ~30 lines of tone-coded JSX. Extracting to a shared module trades one redirection for the dubious benefit of two callers — kept inline in both files.

No schema, no actions, no test changes. 586 tests stay green.

---

### 2026-05-18 · v1.99.1 — SETUP + WEDDING_PARTY cards on the shuffle grid

Follow-up to v1.99.0. Two more per-kind editors migrate to `<ReorderableCardBody>` so the couple can reorder + hide their major sections on SETUP and WEDDING_PARTY cards (in addition to the v1.99.0 OUTFIT + TEXT).

**`BookSetupCard` migration** — default component order: `[photos, stats, items, notes]`. Photos block lifts out of the ad-hoc `pt-2` block at the bottom of ViewBody and into a top-of-default-order entry (consistent with the OUTFIT pattern). Stats is the most interesting twist: in view mode it renders the four canonical tiles (Space / Setup at / Owner / Progress), in edit mode it renders the three header inputs (space / starts-at / owner) — the same component slot reuses both treatments so the user's chosen position holds regardless of mode. `items` is `alwaysVisible: true` (a setup card without its items list is empty chrome — the whole point of a SETUP card is the walkthrough). Notes is hide-able. Photos entry only shows when `canEdit || fileIds.length > 0` (consistent with v1.96.1 TEXT-photo gating). Edit / Cancel / Save lift into `CardChrome.actions`; v1.96.4 `hideHousekeeping={editing}` keeps the footer focused.

**`BookWeddingPartyCard` migration** — default component order: `[matrix, notes]`. Matrix is `alwaysVisible: true` (a WEDDING_PARTY card without its tracking matrix is empty chrome). Notes is hide-able. Unlike SETUP/OUTFIT/TEXT, this editor uses inline-save throughout (group label saves on blur, cell clicks save individually via `setWeddingPartyCell`) — there's no existing "Edit / Save" toggle for the reorder chrome to ride on. Solution: a new local `layoutEditing` state surfaces as a "↕ Layout" / "Done" button in `CardChrome.actions`. While layout-editing, the housekeeping row hides (same focus pattern v1.96.4 introduced) and the per-section ↑/↓/👁 strip from `<ReorderableCardBody>` renders. The header row (group label input + summary chip) stays outside the registry — it identifies the card rather than being a body component, so reordering it past the matrix would never make sense.

**Threading.** `CardRouter` now passes `sub.componentOrder` + `sub.hiddenComponents` through to both `BookSetupCard` and `BookWeddingPartyCard` (it already did for OUTFIT + TEXT in v1.99.0). The `Sub` type already carried both columns since v1.99.0; no schema changes needed.

**`BookFieldsCard` skipped this release.** The plan had it on the v1.99.1 list, but a closer look showed it only has one section (the FieldList) and no photos / notes blocks of its own — there's literally nothing to reorder or hide. Adding photos / notes blocks would be a meaningful new-feature change rather than the mechanical layout extraction this release is about; deferring until that lands as a deliberate feature decision.

**Still queued for v1.99.2+** (10 editors): FIELD (pending the new-section question above), RECIPE, BUILD, MENU, BAR, STAY, LODGING, LEGAL, DRESS_CODE, SHOT_LIST. Same mechanical pattern as SETUP — extract logical sections into `CardComponent` entries, thread `componentOrder` + `hiddenComponents`, surface reorder/hide via the existing edit-mode (or a `layoutEditing` toggle for inline-save editors).

**Verification.** 586 tests still green. `npx tsc --noEmit` clean. `npm run build` clean.

---

### 2026-05-18 · v1.99.0 — Shuffle / hide card-body components

User: "Allow me to shuffle components of a page around." Originally flagged in v1.98.x and deferred for a design pass; v1.99.0 ships the foundation + 2 representative editor migrations (OUTFIT + TEXT), with the other 12 queued for v1.99.1+ mechanical follow-ups.

**The model.**
Two new columns on BookSubsection:
- `componentOrder TEXT[]` — saved order of component IDs (e.g. `["stats","photos","body"]`). Empty = use the kind's hard-coded default order.
- `hiddenComponents TEXT[]` — IDs that the couple has chosen to hide on this card.

Both default to empty so v1.98.x rows render identically post-migration.

**Server actions** (next to v1.96.4's `setBookSubsectionPhotoSize`):
- `setBookSubsectionComponentOrder(id, order: string[])` — replaces the saved list. Validates ≤50 entries, IDs ≤60 chars.
- `setBookSubsectionComponentHidden(id, componentId, hidden)` — toggles a single ID in/out of the hidden array. Idempotent no-op when already in target state.

Both use the v1.30.5 changedFields audit pattern + `revalidatePath(/book/<slug>)`.

**Shared `<ReorderableCardBody>`** (`src/app/(app)/book/[slug]/ReorderableCardBody.tsx`):
- Caller passes `components: CardComponent[]` in the kind's default order. Each `CardComponent` is `{ id, label, node, alwaysVisible? }`.
- `savedOrder` + `hiddenIds` come from the BookSubsection columns.
- New `effectiveOrder()` helper produces the rendered order: saved-order IDs first (in order), then any default-order IDs not yet in saved (appended at the end). Adding a new component to a kind in a future release auto-appears for existing cards without a data migration.
- View mode: filter hidden, render in effective order, no chrome.
- Edit mode: render everything (hidden sections wear `opacity-50` + "hidden in view mode" caption); each section gets ↑/↓ + 👁/🚫 controls. `alwaysVisible: true` suppresses the hide toggle.

**`BookOutfitCard` migration** — components registry: `[photos, stats, body]` (default order). Photos block lifts OUT of `CardChrome.mediaBlock` and INTO the registry. Stats tiles lift out of the inline `mb-4 grid` and into the registry. `body` is the existing ViewBody/EditBody switch covering items + notes; marked `alwaysVisible` (a body-less OUTFIT card is empty chrome). All three handlers (changePhotoSize / changePhotoDisplay / pinHeader / toggleSlideshowAuto from v1.97.0; new reorderComponents / toggleComponentHidden from v1.99.0) follow the v1.95.4 `router.refresh()` pattern.

**`SubsectionEditor` (TEXT) migration** — components registry: `[photos?, body]`. The photos entry only appears when there's something to show (existing fileIds OR canEdit). Body is `alwaysVisible`. CardChrome's `mediaBlock` slot stops being passed.

**`CardChrome.mediaBlock` deprecation** — kept in the type signature for backward compat with editors not yet migrated; marked unused in OUTFIT + TEXT. Will retire fully in v1.99.x once every gallery-using editor migrates.

**Verification:**
- `npx prisma generate`, `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual on Bryonys Outfit: open → Edit → see ↑/↓ + 👁 chrome on each section. Click Photos' ↓ until Photos sits below Stats. Save. Reload. Order persists.
- Manual: hide Stats. View mode hides it. Edit mode shows it faded with a "hidden in view mode" caption; click 👁 to un-hide.
- Manual on Rings (TEXT): same shuffling between photos + body. Body has no hide toggle (alwaysVisible). With no attached photos + non-editable view, only body renders (photos component isn't built).

**Why phased.** The plan was approved as a single-release sweep of all 14 kinds. Each per-kind editor migration is ~30-50 lines of careful refactor (extracting body sections into discrete component nodes, threading new handlers, dropping mediaBlock). 14 editors × that = 420-700 lines of editor changes in one diff. Shipping the foundation + 2 representative kinds now lets the user verify the pattern + UX before the rest land. Follow-up v1.99.1 + v1.99.2 etc. each migrate 2-4 more editors using the same recipe.

**v1.99.x sweep queue (12 editors):**

| Editor | Estimated components |
|---|---|
| BookFieldsCard | photos? / fields / notes |
| BookRecipeCard | photos? / stats / scale / ingredientsSteps / notes |
| BookBuildCard | photos / stats / materials / sessions / notes |
| BookMenuCard | photos? / stats / allergens / courses / notes |
| BookBarCard | photos? / stats / perHead / items / notes |
| BookSetupCard | photos / stats / items / notes |
| BookStayCard | photos / stats / occupants / notes |
| BookLodgingCard | hotels (no photos column) |
| BookLegalCard | photos? / banners / stats / items |
| BookDressCodeCard | photos / fields / body |
| BookShotListCard | photos? / shots |
| BookWeddingPartyCard | matrix / notes |

### 2026-05-18 · v1.98.1 — Save-fix + XS/XL + header fade

User: "I cant save once an image has been changed size, can you also create a set size for the header and fade it into the note block? Allow me to shuffle components of a page around. Can you add an xs and xl size."

Three fixes shipped here; "shuffle components" deferred to v1.99.0 — it needs a design pass (per-card vs per-kind, drag handles vs ↑/↓ buttons, persistence shape) that doesn't fit a patch release.

**1. Bug — save broken after photo-size toggle.**

Root cause: the v1.96.4 `setBookSubsectionPhotoSize` action (and v1.97.0's `setBookSubsectionPhotoDisplay` / `-HeaderFileId` / `-SlideshowAuto`) calls `router.refresh()` after the server mutation. Pre-fix `BookOutfitCard` had:

```ts
useEffect(() => { setDraft(buildDraft(card)); }, [card]);
```

The `card` object is constructed inline in `CardRouter` (`card={{ id: oc.id, ... }}`) — every parent re-render produces a fresh object reference. The effect therefore fired on every parent re-render, not just when `card` semantically changed. With router.refresh now firing mid-edit (via any photo-toggle click), the cascade was:

1. User clicks S/M/L (or display / pin / auto) → server action → `router.refresh()`
2. Page re-renders → CardRouter re-renders → fresh `card` object handed to BookOutfitCardEditor
3. useEffect fires → `setDraft(buildDraft(card))` → **wipes the in-progress draft**
4. Save button reads `dirty=false` (draft now matches prop) → click no-ops

Fix: gate the effect on `if (!editing)`:

```ts
useEffect(() => {
  if (!editing) setDraft(buildDraft(card));
}, [card, editing]);
```

Now the draft survives any prop churn while edit-mode is open. The `editing → false` transition (via save or cancel) still fires the effect so the view-mode body re-syncs to the freshly-saved card.

**Sweep-fix across the other 7 editors** that used the same `[card]` dep pattern: `BookBarCard`, `BookBuildCard`, `BookLegalCard`, `BookLodgingCard`, `BookMenuCard`, `BookSetupCard`, `BookStayCard`. None of them currently call `router.refresh` during edit mode, but v1.97.0's out-of-scope notes flagged the other 5 gallery-using kinds for the same media-block treatment. Fixing the latent bug now is cheaper than chasing it across 7 editors during later releases. `SubsectionEditor` (TEXT cards) and `BookDressCodeCard` both use primitive-string deps already (`[sub.id, initialHtml]` / `[card.id, card.dressCode, ...]`) — same string ref after refresh, the effect doesn't fire. No fix needed there.

**2. XS + XL sizes.**

Photo size buckets extend from 3 (sm/md/lg) to 5 (xs/sm/md/lg/xl). The two new sizes:

- **xs** — `grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1`. ~50–70 px thumbs. For cards stuffed with reference shots where the couple just wants to glance at the spread.
- **xl** — `grid-cols-1 md:grid-cols-2 gap-4`. ~300+ px thumbs. The "show me one shot prominently in gallery mode without switching to header" lever.

`GallerySize` union widened, `SIZE_GRID_CLASSES` map gains the two new entries, `SizeToggle` renders 5 buttons, server-side `PHOTO_SIZES` allowlist mirrors the union, `CardRouter` narrowing recognises the new values with a defensive `'md'` fallback for anything unexpected.

**3. Header fixed height + bottom-fade.**

Pre-fix `HeaderHero` used `aspect-[16/9]`, which made height proportional to card width — wide-spanning cards got tall heroes that pushed the body below the fold. Now fixed `h-[260px]` regardless of width. Empty-state placeholder gets the same fixed height so the card doesn't reflow when a hero gets pinned.

The fade-into-body effect uses a CSS mask gradient on the `<img>`:

```css
mask-image: linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
-webkit-mask-image: linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
```

The bottom 25% of the image fades from full opacity to transparent so the hero visually melts into the body content rather than ending in a hard rectangle edge. Border + hover-border removed from the header button since they'd compete with the soft fade.

**Verification:**
- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open an OUTFIT card → Edit → toggle S/M/L (no draft wipe) → still in edit mode with edits intact → click Save → persists.
- Manual: switch to header mode with a pinned image → see the 260 px tall hero with the bottom fading into the card body.
- Manual: cycle through XS / SM / MD / LG / XL → grid columns reflow per size.

**Deferred — "shuffle components of a page".** This is a bigger feature than the other three. Open questions:
- Per-card layout (each card stores its own component order) vs per-kind (every OUTFIT looks the same)?
- Drag handles + drag-and-drop or simple ↑/↓ buttons next to each component?
- How does this interact with `mediaBlock` and `actions` which are CardChrome slots, not body children?
- Schema shape — `componentOrder String[]` on BookSubsection or a per-card JSON?

Queueing as v1.99.0 with a proper design pass.

### 2026-05-18 · v1.98.0 — @-mention suppliers from textareas

User: "allow me to tag a vendor by typing in any text box '@'."

The Wedding Hub Supplier table is the canonical vendor directory — every contractor / venue / florist / photographer the couple's working with has a row there. Pre-fix a note that referenced a supplier had to spell the name out long-hand ("Spoke to Slaters today about the dress shoes…") with no way to surface the supplier link from inside the note. The user wants chat-style `@Mention` so they can tag a supplier inline and the picker auto-completes.

**New shared component `src/components/ui/MentionableTextarea.tsx`** — drop-in replacement for `<textarea>`, accepts every native textarea prop (`value`, `defaultValue`, `onChange`, `onKeyDown`, `placeholder`, `rows`, `disabled`, `name`, `className`, etc.) via `TextareaHTMLAttributes<HTMLTextAreaElement>`. Adds two behaviours:

1. **Trigger detection.** On `@` keystroke, if the cursor is at word-start (column 0 or preceded by whitespace) the picker opens. Mid-word `@` (e.g. an email address) doesn't open the picker.
2. **Inline picker.** Floating dropdown anchored below the textarea (`absolute z-50 top-100%`). Shows the supplier list filtered by whatever the user types after the `@`. Filters by name OR category (case-insensitive substring). Empty query shows first 8 suppliers. Arrow keys navigate, Enter or Tab inserts the active option, Esc closes. Click selects.

**Lazy fetch via new `loadSuppliersForMention` server action** (`src/lib/supplier-mentions.ts`). The first `@` keystroke triggers the load; subsequent opens reuse the cached list per-mount. Gates on `canView("suppliers")` — viewers without supplier-view permission get an empty list back (no error, just no picker contents). Returns `{ id, name, category }[]` so the picker can show the category as a muted suffix on each row for disambiguation.

**Insertion shape: plain text `@SupplierName `** (with trailing space — chat-style mention ergonomics). No DB-side structured link. Three reasons:

1. Existing notes columns are plain strings — zero migration to do.
2. Every read-side surface that renders notes (RichTextRead, page views, audit metadata) just displays the string as-is. No parser to bolt on.
3. Couples renaming a supplier later won't break the mention (the text still reads `@OldName`) — but it also won't auto-update. Trade-off accepted; structured tokens with rename-propagation is a v1.98.x candidate.

**Sweep — 23 textareas across 20 files** replaced with `<MentionableTextarea>`:

- **Book card editors:** BookOutfitCard (card notes + per-item notes), BookBarCard, BookBuildCard, BookLegalCard, BookLodgingCard, BookMenuCard, BookRecipeCard, BookSetupCard, BookStayCard, BookWeddingPartyCard, AddSubsectionToggle (new-card body field).
- **Tasks + Q&D:** TaskForm notes, TaskDrawer notes, AnswerForm answer textarea.
- **Schedule + Guests:** EventForm description, GuestForm notes, AddHouseholdToggle notes.
- **Money:** BudgetClient (line notes), PaymentForm.
- **Suppliers:** SupplierForm notes, SupplierDetailClient communication log.
- **Seating:** SeatingPlanPanel reception notes, ceremony/CeremonyClient layout notes.

**CSV-import paste boxes intentionally skipped** — `tasks/import/TaskImportClient.tsx` + `guests/import/ImportClient.tsx` are for raw CSV paste, not authoring. Suppliers don't surface there.

**TEXT card body (Tiptap RichTextEditor) deferred** — Tiptap's own `@tiptap/extension-mention` is the right path there; ships as v1.98.1. Until then, TEXT card bodies remain plain rich text without the mention picker.

**Implementation details worth flagging:**

- The picker uses `selectionStart` to find the trigger position. On insertion, `el.value` is set directly + `setSelectionRange` repositions the caret BEFORE React's controlled re-render to avoid the controlled-input caret-jumps-to-end issue.
- Mousedown on a picker row uses `preventDefault` so the textarea doesn't lose focus before `insertMention` fires.
- Whitespace inside the query closes the picker (Slack / GitHub-style).
- Picker auto-closes if the cursor moves before the trigger position.

No schema migration. 586 tests green; typecheck + build green.

### 2026-05-18 · v1.97.0 — Card design pass

User: "I dont like the 'bride' chip being on its own row, only display size editing in its own screen. Move images to the top of the card, & only show image management in the edit screen, have options to make an image a header or gallery or slideshow. Lets think about the design of these cards."

Five coordinated structural changes to the Book card. Touches schema, the shared ImageGallery component, CardChrome's prop surface, BookOutfitCard layout, and migrates SubsectionEditor from its bespoke `<article>` chrome to CardChrome.

**Clarifying questions** the user resolved before implementation:
- **Slideshow advance**: per-card Auto / Manual toggle. Default Manual.
- **Header default**: placeholder + prompt — no silent "first photo wins".
- **Display-mode picker scope**: every gallery-using card gets all three modes.

**1. Schema migration `20260518100000_book_photo_display_modes`:**
```sql
ALTER TABLE "BookSubsection" ADD COLUMN "photoDisplay" TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE "BookSubsection" ADD COLUMN "headerFileId" TEXT;
ALTER TABLE "BookSubsection" ADD COLUMN "slideshowAuto" BOOLEAN NOT NULL DEFAULT false;
```
Additive — safe defaults so v1.96.x rows render identically. `gallery` mode matches the v1.96 baseline; no pin + manual advance is the no-surprise default.

**2. Server actions** (`src/app/(app)/book/actions.ts`):

Three new helpers, all next to v1.96.4's `setBookSubsectionPhotoSize`. Each: `requireEdit("book")` gate, idempotent no-op when the new value matches `before`, v1.30.5 audit metadata with before/after snapshots, `revalidatePath(/book/<slug>)`.

- `setBookSubsectionPhotoDisplay(id, "gallery" | "header" | "slideshow")`
- `setBookSubsectionHeaderFileId(id, fileId | null)` — additionally validates the supplied fileId is in the union of `BookSubsection.fileIds` (TEXT) ∪ every per-kind `fileIds` (OUTFIT / DRESS_CODE / SETUP / BUILD / STAY). LodgingCard intentionally omitted from the union — no fileIds column.
- `setBookSubsectionSlideshowAuto(id, boolean)`

**3. `<ImageGallery>` refactor.** Becomes a mode-router with three private sub-renderers + an `editMode` gate that controls every piece of management chrome:

- `GalleryGrid` — v1.96.4 grid with S/M/L sizing. Edit mode additionally renders a ★ button per thumb (top-left, marigold when pinned) that calls `onHeaderPin(f.id)` to promote it to header.
- `HeaderHero` — single image at `w-full aspect-[16/9] object-cover rounded-md`. Picks `headerFileId` if attached + image-MIME; otherwise renders the dashed-border placeholder with a "Pick a header image" prompt + edit-mode-only "★ a thumbnail in Gallery mode" hint.
- `SlideshowCarousel` — single image at a time at the same 16:9, dot indicator below + prev/next arrows on hover. When `slideshowAuto && !hovered`, a 4-second interval advances; hover pauses.

Above the mode-router (when `canEdit && editMode`): the display-mode picker (3-button pill row). The size toggle still renders only in `gallery` mode. The Auto/Manual toggle only renders in `slideshow` mode. Upload + Attach controls render below the mode-router.

Pre-v1.97.0 `canEdit` gated management chrome; v1.97.0 introduces `editMode` as the per-render flag so callers can show management only when the surrounding card is in edit mode. Old callers that didn't pass `editMode` default to view-mode chrome (no management), which is the desired safer default.

**4. `CardChrome` slots.** Two new optional props:

- `headerChips?: ReactNode` — rendered inline in the title row between the title and the kindBadge. Per-kind editors pass their kind-specific chip(s) here (e.g. OUTFIT's BRIDE/GROOM role chip).
- `mediaBlock?: ReactNode` — rendered between the title row and the body children. Where the photo gallery lives. Hidden when not provided so cards without photos render unchanged.

Title-row flex changed from `items-start` to `items-center` so chips align nicely on one line; added `flex-wrap` so a long title + many chips can still gracefully wrap on narrow viewports.

**5. `BookOutfitCard`** changes:

- The standalone person+role `<div className="mb-4 flex items-baseline gap-2 flex-wrap">` block is **deleted**. Role chip lifts into `CardChrome.headerChips`. Person name dropped entirely — v1.92.2 already hid it in the common redundant-name case; the rare non-redundant case is rare enough that dropping it removes a bit of clutter at low cost.
- Gallery lifts into `CardChrome.mediaBlock` so photos render at the top of the card. `editMode={editing}` gates all management chrome on the surrounding card's edit state.
- Three new handlers wired to the three new server actions (`changePhotoDisplay`, `pinHeader`, `toggleSlideshowAuto`) — all use the `startTransition` + `router.refresh()` pattern (v1.95.4) so the gallery re-renders against the new DB state without a full navigation.
- `CardData` type gains `photoDisplay: GalleryDisplay`, `headerFileId: string | null`, `slideshowAuto: boolean`.
- `ViewBody` becomes minimal — just receives `card` now, since the gallery + management props all moved out.

**6. `SubsectionEditor` migrated to CardChrome.** Pre-v1.97.0 TEXT cards carried their own bespoke `<article>` chrome + title input + footer because the v1.37.0 title-rename UX (only-in-edit-mode) didn't match CardChrome's inline-save-on-blur pattern. v1.97.0 closes the divergence:

- Title now handled by CardChrome (inline, saves on blur).
- Make couple-only + Delete handled by CardChrome's footer.
- Edit / Cancel / Save lift to `CardChrome.actions` (parity with OUTFIT v1.96.4).
- Photos lift to `CardChrome.mediaBlock`.
- New `kindBadge="Notes"` shows in the title row.
- Body save posts ONLY `bodyHtml` — title is owned by CardChrome's inline save now and shouldn't be clobbered by the body action.

The v1.95.4 router-refresh-after-save pattern is preserved.

**7. `CardRouter`** — `Sub` type gains the three new fields; both TEXT and OUTFIT cases narrow `photoDisplay` to the union with a defensive `"gallery"` fallback, mirroring the v1.96.5 `photoSize` pattern.

**Out of scope** (follow-ups):

- **Other 5 gallery-using kinds** (DRESS_CODE / SETUP / BUILD / STAY / LODGING_GUIDE) inherit the new prop surface but their editors still need to thread the three new fields + move their gallery into `mediaBlock` + wire the three new handlers + adopt `actions`. ~30 lines per editor; mechanical follow-up.
- **Photo reorder** (drag handles inside the gallery). Particularly useful for slideshow mode. v1.97.1 candidate.
- **Per-image captions.** File name is the caption surface today; out of scope for this release.

**Verification:**
- `npx prisma generate`, `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open Bryonys Outfit → title row reads `Bryonys Outfit · BRIDE · OUTFIT` on one line; no sub-row underneath. Photos render at the top of the card with no management chrome visible. Click Edit → S/M/L + display-mode picker surfaces. Switch to header mode without a pin → "Pick a header image" placeholder renders. Switch back to gallery, ★ a thumb, switch to header → hero renders.
- Manual TEXT card (Rings): title now CardChrome-inline (editable on blur). Photo block at the top. Edit / Save in CardChrome's footer alongside Make couple-only / Delete (which hide during edit).

### 2026-05-18 · v1.96.5 — TEXT card photo-size toggle

User: "I cant edit the ring image size" — flagged the v1.96.4 limitation. The schema column (`BookSubsection.photoSize`) and the `<ImageGallery>` size + toggle props all landed in v1.96.4, but only `BookOutfitCard` got wired up; `SubsectionEditor` (the TEXT card path) was queued as a follow-up. v1.96.5 closes that gap.

**SubsectionEditor changes** (`src/app/(app)/book/[slug]/SubsectionEditor.tsx`):
- Imports `GallerySize` type and `setBookSubsectionPhotoSize` action.
- `Sub` type gains `photoSize?: GallerySize` (optional with `"md"` fallback so legacy callers that don't thread the field stay safe).
- New `photoSize` local + `changePhotoSize` handler — same shape as the v1.96.4 OUTFIT wiring. Action call wrapped in `startTransition` + `router.refresh()` on success (v1.95.4 pattern keeps the gallery in sync with DB state before the next render).
- `<ImageGallery>` invocation now passes `size={photoSize} onSizeChange={changePhotoSize}` — the S/M/L pill toggle now renders above the thumb grid in edit mode.

**CardRouter** (`CardRouter.tsx`):
- TEXT case adds `photoSize: sub.photoSize === "sm" || sub.photoSize === "lg" ? sub.photoSize : "md"` to the constructed `Sub` object. Same defensive narrowing the OUTFIT case uses — guards against unexpected DB values without crashing the render.

**Out of scope.** The other five ImageGallery-using kinds (DRESS_CODE / SETUP / BUILD / STAY / LODGING_GUIDE) still inherit the default `"md"` until each editor threads `card.photoSize + onSizeChange` to their gallery. Mechanical follow-up — same 8-line change as TEXT.

No schema migration; the v1.96.4 column carries through. 586 tests green; typecheck + build green.

### 2026-05-18 · v1.96.4 — OUTFIT card layout polish

User: "Can we make the photo display size customisable. Some of the spacing seems like it can be tightened up, the edit button doesnt need a row to itself. 0 of 2 sorted and the item prices could be spread out too, maybe have a box of their own?"

Three coordinated UX fixes on the OUTFIT card (visible in `Bryonys Outfit` / `Jamies Outfit` / `Rings` screenshots). Establishes the `CardChrome.actions` slot pattern + the per-card `photoSize` data model; rest of the 13 card editors stay on their inline-Edit pattern for now.

**1. Per-card photo size.**

Migration `20260518000000_book_subsection_photo_size`:
```sql
ALTER TABLE "BookSubsection" ADD COLUMN "photoSize" TEXT NOT NULL DEFAULT 'md';
```

`String` (not enum) so future buckets are migration-free. Default `'md'` matches the v1.63.0 baseline — unmigrated cards render identically.

`<ImageGallery>` extended:
- New `size?: "sm" | "md" | "lg"` prop (default `"md"`).
- New `onSizeChange?` prop — when provided, renders an S/M/L pill toggle above the thumb grid.
- Grid columns scale per size: `sm` → `grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5` (compact, ~80 px thumbs), `md` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2` (current default ~130 px), `lg` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3` (~200 px gallery-style thumbs).

New `setBookSubsectionPhotoSize(id, size)` server action — same shape as v1.95.0's `setBookSubsectionWide`: `requireEdit("book")` gate (no couple-tier — purely cosmetic), idempotent no-op when `before.photoSize === size`, v1.30.5 audit metadata with `changedFields + photoSizeBefore + photoSizeAfter`, `revalidatePath(/book/<slug>)`. Input validated against the `["sm","md","lg"]` const allowlist.

`BookOutfitCard` wires up: `changePhotoSize(next)` handler calls the action + `router.refresh()` (v1.95.4 pattern); passes `size={card.photoSize} onSizeChange={changePhotoSize}` into the gallery; `CardData` type gains `photoSize: "sm" | "md" | "lg"`.

**2. Edit button lifted into chrome footer.**

`CardChrome` extended:
- New `actions?: ReactNode` slot — rendered on the right of the chrome footer.
- New `hideHousekeeping?: boolean` — when true, suppresses Make-couple-only + Delete.

Footer becomes a single row with both housekeeping and the per-kind action:
```tsx
{canEdit && (!hideHousekeeping || actions) && (
  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border-soft">
    {!hideHousekeeping && isCouple && <Button>Make couple-only</Button>}
    {!hideHousekeeping && <Button>Delete</Button>}
    {actions}
  </div>
)}
```

`BookOutfitCard` drops its own inline Edit-row block (the `<div className="flex … mt-4 pt-3 border-t">` that wrapped Edit / Cancel + Save). The buttons move into the `<CardChrome actions={…}>` prop:
- View mode: `actions = <Button variant="primary">Edit</Button>`, `hideHousekeeping = false` → footer reads `[Make couple-only] [Delete] [Edit]`.
- Edit mode: `actions = <><Button ghost>Cancel</Button><Button primary>Save changes</Button></>`, `hideHousekeeping = true` → footer reads `[Cancel] [Save changes]`. Transient state stays visually focused on the pending change instead of competing with housekeeping.

**3. Stats tiles.**

Replaced the flat `text-[11px] text-ink-tertiary mb-4 flex` meta line with a 3-column tile grid. New `StatTile` helper:

```tsx
function StatTile({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="bg-canvas border border-border-soft rounded-md px-3 py-2" title={title}>
      <div className="text-[9px] uppercase tracking-wider text-ink-tertiary font-bold">{label}</div>
      <div className="text-sm font-semibold text-ink-primary tabular-nums">{value}</div>
    </div>
  );
}
```

Rendered as `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">` with three conditional tiles:
- **Sorted** — always rendered. Value: `"—"` when itemCount is 0, otherwise `"3 / 5"`.
- **Budget** — only when `showMoney && card.costPence != null`. Value: formatted GBP.
- **Items total** — only when `showMoney` AND at least one item has `costPence` set. Value: formatted GBP sum. `title` attr explains the relationship to the manual Budget tile.

**Threading.** `CardRouter.Sub` gains `photoSize: string`. The OUTFIT case narrows the string to the `"sm" | "md" | "lg"` union with a defensive `'md'` fallback. `/book/[slug]/page.tsx` `findUnique` already returns all scalars, so `sub.photoSize` flows through without a query change.

**Verification:**
- `npx prisma generate`, `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open Bryonys Outfit (no item costs, no card budget) → see one tile `Sorted 0/2`. Jamies Outfit (£159 in item costs) → two tiles `Sorted 0/2 | Items total £159`. Footer reads `Make couple-only · Delete · Edit` on one row. Click Edit → switches to `Cancel · Save changes`. Click an S/M/L pill above the photo grid → thumbs resize, reload — size persists.

**Out of scope:** Migrating the other 13 card editors (DRESS_CODE / FIELD / RECIPE / SETUP / STAY / BUILD / MENU / BAR / LEGAL / LODGING_GUIDE / SHOT_LIST / WEDDING_PARTY / TEXT-via-SubsectionEditor) to the `CardChrome.actions` slot. Pattern is established + tested on OUTFIT; mechanical migration of the rest is a follow-up. Photo-size toggle on the other cards that use ImageGallery (TEXT / DRESS_CODE / SETUP / BUILD / STAY / LODGING_GUIDE) — gallery accepts the prop, but until each editor threads `card.photoSize + onSizeChange`, their galleries stay at the default `"md"`. Follow-up.

### 2026-05-17 · v1.96.3 — Edit tasks from Book panels

User: "I want to be able to edit tasks from this screen too." Closes the deferred ask from v1.96.0's roadmap entry: per-row Edit affordance on the linked-tasks panels at `/book/[slug]` (section level + every card's `CardLinkedTasksPanel`).

**The gap.** Pre-fix the panels could create tasks (via the v1.96.0 "+ New" modal) and toggle their status (the row checkbox). Anything else — fix a typo in the title, add a second assignee, change the due date, reassign the topic — required navigating to `/tasks`, finding the row, and opening the drawer. Two-click drift away from where the user was actually working.

**Server action — `loadTaskForEdit(id)`** in `src/app/(app)/tasks/actions.ts`:
- Returns `TaskForEdit`: every scalar field plus the four m2m relations flattened to ID lists (`assigneeIds`, `bookSectionIds`, `bookSubsectionIds`, `navTagIds`, `guestGroupIds`).
- Permission gate dispatches by the task's own `type` — TASK → `requireEdit("tasks")`, QUESTION/DECISION → `requireEdit("questions")` — same per-type gating `setTaskStatus` already does for the polymorphic table.
- Lazy: not called until the user clicks Edit. The panel's page-level query stays minimal (only `id / title / type / status / priority / dueDate` per row), avoiding a heavy include for tasks the user never opens.

**`BookTopicsContext` extension** (`BookTopicsContext.tsx`):
- v1.95.1 carried `bookSections` + `bookSubsections` (autofill for inline create).
- v1.96.3 adds `users` / `suppliers` / `navTags` / `guestGroups` so the Edit modal's TaskForm renders every picker pre-populated without per-row queries.
- Defaults stay empty arrays so any consumer that mounts outside the provider (defensive) continues to typecheck.

**Page wiring** (`/book/[slug]/page.tsx`):
- Loads `taskSuppliers` / `taskNavTags` / `taskGuestGroupsRaw` alongside the existing `taskUsers` query — only when `editable` (no edit affordance otherwise, so no point in the fetch).
- Three cheap queries; same shapes the `/tasks` + `/questions` pages have been loading since v1.30.5.
- Threads everything through `BookTopicsProvider` so the entire subsection grid + section panel can read them.

**`EditTaskDialog` component** (new `src/app/(app)/book/[slug]/EditTaskDialog.tsx`):
- Tiny ghost-style "Edit" button → opens an `AddNewModal` → on open, calls `loadTaskForEdit` → renders `TaskForm` once the data arrives.
- `showType={true}` so couples can convert TASK ↔ QUESTION ↔ DECISION inline (same flexibility the v1.27.8 drawer added for `/tasks`).
- Initial values map straight from `TaskForEdit` to `TaskForm`'s `Initial` shape; dueDate gets `toISOString().slice(0, 10)` for the date input format.
- On submit: `await updateTask(taskId, fd)` → `notify("success")` → `router.refresh()` (v1.95.4 pattern, so the panel re-renders against saved state before the modal closes) → `setOpen(false)`.
- Error fallback: `loadError` state catches a missing row (`Task not found.`) or thrown permission errors.

**Row wiring:**
- `CardInlineTaskRow` (per-card panel) and `InlineTaskRow` (section panel) each add `{canEdit && <EditTaskDialog taskId={task.id} taskTitle={task.title} />}` at the end of the row.
- The button is the only interactive element gated by `canEdit` on this row — keeps the rest of the row a status indicator readable by non-editors.

**Verification:**
- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open `/book/clothing`, click Edit on any task row in any linked-tasks panel → modal loads with the full TaskForm pre-populated. Change the title → Save → row re-renders with the new title without a full navigation.

**Out of scope.** Inline edit (no modal — edit in place inside the row). The modal pattern matches `/questions`' inline edit + the existing `TaskDrawer` on `/tasks`; a third in-row pattern would fragment the UX.

### 2026-05-17 · v1.96.2 — Hotfix v1.96.0 migration orphans

Production deploy of v1.96.0 → v1.96.1 looped on `P3009` after the multi-assignee migration rolled back mid-transaction. Caddy returned 502s while the web container restarted every few seconds.

**Root cause.** The original `Task.assigneeId String?` column was declared without a corresponding Prisma relation field (`assignee User?`) — schema-only `String`, no DB-level foreign key. Historical rows with `assigneeId` pointing at a user that's since been deleted (e.g. an early test admin) were silently tolerated. The v1.96.0 backfill:

```sql
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL;
```

…hit the new junction's `_TaskAssignees_B_fkey` constraint on User, aborted, and rolled back the whole transaction including the `CREATE TABLE`. Subsequent deploy attempts saw a `_prisma_migrations` row with `finished_at = NULL` and refused to proceed — P3009.

**Fix.** In-place revision of the v1.96.0 migration SQL to be both idempotent (handles partial state from any failed attempt) and orphan-safe (filters the backfill):

```sql
DROP TABLE IF EXISTS "_TaskAssignees";

CREATE TABLE "_TaskAssignees" (
  "A" TEXT NOT NULL, "B" TEXT NOT NULL,
  CONSTRAINT "_TaskAssignees_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

INSERT INTO "_TaskAssignees" ("A", "B")
SELECT t."id", t."assigneeId"
FROM "Task" t
WHERE t."assigneeId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = t."assigneeId")
ON CONFLICT DO NOTHING;

ALTER TABLE "Task" DROP COLUMN IF EXISTS "assigneeId";
```

Editing a "released" migration is generally bad practice, but this one has never successfully applied in production — there's no historical state for the modification to drift from. The first deploy attempt got an empty (or partially-rolled-back) state, so the new SQL starts from the same scratch and completes.

**Operator recovery — one-time, on prod:**

```bash
# Run inside the db container while web is down (its restart loop
# blocks an exec shell). The db container stays up because its
# healthcheck still passes.
docker compose --env-file .env exec db psql \
  -U "$POSTGRES_USER" "$POSTGRES_DB" \
  -c "DELETE FROM \"_prisma_migrations\" \
      WHERE migration_name = '20260517200000_task_multi_assignee_drop_category';"
```

Removing the failed-attempt row makes Prisma treat the migration as never-attempted. Next `Pull & Up` runs the revised SQL on a clean slate — DROP IF EXISTS cleans up the `_TaskAssignees` table that may have survived the rolled-back transaction (Postgres rolls back DDL inside an explicit transaction, so the table probably *isn't* there — but the `IF EXISTS` keeps us safe either way).

**Orphan handling.** Tasks whose `assigneeId` pointed at a deleted user silently lose their stale assignment — `WHERE EXISTS` filters them out of the backfill. That's the correct semantic: a foreign key to a non-existent user was an invalid state to begin with, and the new multi-assignee model needs to enforce referential integrity.

**No new functionality.** This is a pure recovery release. 586 tests stay green. `npx tsc --noEmit`, `npm test`, `npm run build` all clean. Future migrations (e.g. v1.96.1's TEXT-card fileIds) re-queue normally once the failed row is cleared.

### 2026-05-17 · v1.96.1 — TEXT card photo gallery

User: "Allow photos on the 'text' panel."

OUTFIT (v1.35.0), DRESS_CODE (v1.91.0), BUILD, STAY, LODGING_GUIDE, SETUP cards have all shipped the shared `<ImageGallery>` component since v1.63.0. TEXT — the simplest + most flexible card kind, used as "notes & sizing", "supplier contact", "venue floorplan" — was photo-less. Couples could attach a fitting photo to the OUTFIT card but not to the freeform Rings notes card right beside it.

**Schema migration `20260517300000_book_text_file_ids`:**
```sql
ALTER TABLE "BookSubsection" ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
```

Lives directly on `BookSubsection` rather than spawning a new per-kind `BookTextCard` table. TEXT's content (body / bodyHtml) already sits on the row itself — adding a sibling fileIds column keeps the read path single-query, and the column simply sits unused for non-TEXT kinds (which keep their own per-kind fileIds on `BookOutfitCard`, `BookDressCodeCard`, etc.). The migration is additive with an empty-array default, so no backfill is needed.

**Server actions** (`src/app/(app)/book/actions.ts` — mirror the OUTFIT triple-action pattern):

- `attachFileToTextCard(subsectionId, fileId)` — append fileId, idempotent (already-attached returns `ok` without re-writing).
- `detachFileFromTextCard(subsectionId, fileId)` — filter out, idempotent.
- `uploadAndAttachTextFile(subsectionId, formData)` — reuses the existing `uploadFileForBookCard(user, formFile)` helper (validates MIME + writes bytes + creates the `File` row), then appends the new fileId.

All three gate on `requireEdit("book")` and emit `text-file-attach` / `-detach` / `-upload` audit rows with `cardTitle` + `fileName` metadata. `revalidateBookSubsection(subsectionId)` runs at the end of each so the client gets fresh data after the round-trip.

**`SubsectionEditor` UI:**

- New `fileIds?: string[]` on the `Sub` type + new `files?` prop for the picker's full-list dropdown.
- Three handlers — `attachFile` / `detachFile` / upload — each wrapped in `startTransition` + followed by `router.refresh()` (same v1.95.4 pattern that fixed the post-save render race).
- `<ImageGallery>` drops in just below the body's flex-1 wrapper. Renders when `canEdit || fileIds.length > 0` so empty cards in read-only mode stay tidy.
- Section header: `Photos (N)` matching the OUTFIT card convention.

**Threading** (`CardRouter` → `/book/[slug]/page.tsx`):

- `CardRouter.Sub` type gains `fileIds: string[]`.
- New top-level `files` prop on `CardRouter` — passed through to `renderCardBody` and on into `SubsectionEditor`. Other card kinds carry their files inside their per-kind sub data (`sub.outfitCard.files` etc.) and don't need this top-level list.
- `/book/[slug]/page.tsx` extends `needFiles` to include `hasText` so the bulk `db.file.findMany` runs for sections that include TEXT cards. Cost: one extra fetch per page that has TEXT cards but no LEGAL/OUTFIT (which were already triggering it).

**Read path.** The page's existing `findUnique({ where: { slug } })` with `include` on subsections loads all scalar fields by default, so `fileIds` flows through automatically. No query changes needed beyond the file-list fetch above.

**Verification:**

- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open any TEXT card → Edit → Photos block appears below the rich-text editor with "+ Upload photo" + "📎 Attach existing" controls. Upload an image → page reflects the new gallery thumbnail.

**Out of scope.** Surfacing `fileIds` on the read-only "On this page" anchor row (purely a label row, no thumbnail real estate). Drag-to-attach from the Files page (separate ergonomic concern — applies equally to OUTFIT / DRESS_CODE / etc.).

### 2026-05-17 · v1.96.0 — Multi-assignee + category removal + Q&D inline

User: "Allow tasks to be assigned to multiple people. Remove the category option in tasks. Edit tasks from their linked screen aswell as the tasks page. Allow Questions & Decisions to be made on the item screen too."

Three of the four asks ship in this release. Edit-from-linked-screen is queued for v1.96.1 — needs a focused design pass for the modal-vs-drawer pattern and the per-task data-load path, didn't want to half-bake it on top of an already-large schema migration.

**Schema migration `20260517200000_task_multi_assignee_drop_category`:**
```sql
CREATE TABLE "_TaskAssignees" (
  "A" TEXT NOT NULL, "B" TEXT NOT NULL,
  CONSTRAINT "_TaskAssignees_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;
ALTER TABLE "Task" DROP COLUMN "assigneeId";
```
Implicit-Prisma m2m naming (`_TaskAssignees("A","B")` with A=Task, B=User) so the schema reads `assignees User[] @relation("TaskAssignees")` / `assignedTasks Task[]` and Prisma manages inserts. Backfill is idempotent via `ON CONFLICT DO NOTHING`.

**Server actions** (`src/app/(app)/tasks/actions.ts`):
- `baseSchema` drops `assigneeId` + `category` zod fields.
- New `parseAssigneeIds(formData)` helper: reads repeated `formData.getAll("assigneeIds")` entries, skips the `__touched__` marker, dedupes.
- `createTask`: persists `assignees: { connect: assigneeIds.map(...) }`. No more `tags = [category]`.
- `updateTask`: gates the m2m write on `formData.has("assigneeIds")` (mirrors the topicKeys/hasTopicKeys pattern) so partial updates don't blank the assignee list. Audit `changedFields` updates to compare sorted ID arrays.
- Category persistence path removed everywhere; `Task.tags` column kept in the DB for now (no migration needed) since dropping it would require backfill of the field's only legitimate use case (which never materialised).

**TaskForm + TaskDrawer**:
- `TaskForm` single `<select name="assigneeId">` → new `AssigneePicker` chip toggle. One hidden `<input type="hidden" name="assigneeIds" value="__touched__">` always emits so the server can distinguish empty-list from field-not-posted. One additional hidden input per selected user-id.
- `TaskForm` drops the entire Category `<input>` + COMMON_CATEGORIES const + datalist.
- `TaskDrawer` same — chip-toggle multi-assignee inline-edit; Category section deleted; subtitle no longer renders `· {category}` suffix.
- `Initial` type: `assigneeId?: string | null` → `assigneeIds?: string[]`. `category?` field removed.

**Reader updates (13 files):**
- `/` page: include `assignees: { select: { id: true } }`. The "My next tasks" `mineDated` / `mineUndated` / `orphanDated` / `orphanUndated` filters switch from `t.assigneeId === userId` / `!t.assigneeId` to `t.assignees.some(a => a.id === userId)` / `t.assignees.length === 0`.
- `/glance`: `OR: [{ assigneeId: userId }, { assigneeId: null }]` → `OR: [{ assignees: { some: { id: userId } } }, { assignees: { none: {} } }]`.
- `/questions` + `QuestionsClient`: include `assignees`, flatten to `assigneeIds: string[]`. Display chip shows first assignee + `+N` suffix.
- `/tasks` + `TaskBoard` + `TaskList` + `TaskRow` + `TaskDrawer`: same shape change; group-by-assignee bucket includes the task under every assignee's section; sort-by-assignee uses the first assignee's name.
- `nudge-digest.ts` + `nudge-actions.ts`: `TaskRow.assigneeId: string | null` → `TaskRow.assignees: { id: string }[]`. Select shape updated.
- `seed.ts` + `actions.ts` quick-capture + `suppliers/actions.ts` follow-up + `tasks/import/actions.ts` CSV-import: every `db.task.create({ data: { assigneeId: x } })` switched to `assignees: x ? { connect: [{ id: x }] } : undefined`.

**Display convention.** For tasks with multiple assignees we render the first one as the primary chip and append `+N` for the rest — keeps the row dense and predictable. The drawer's full chip list shows everyone. Group-by-assignee in `/tasks` puts the task under every assignee's section (joint task = appears for both owners).

**Book panels — Q&D inline:**
- `LinkedTasksPanel` (section level) + `CardLinkedTasksPanel` (card level) both switch `showType={false}` → `showType={true}` on their `AddTaskToggle` invocation. Button label `"+ Task"` → `"+ New"` so it reads truthfully for all three types.
- The modal's existing `TaskForm` already renders Type / Priority / Status / Due in a grid when `showType=true`; couples can now pick Task / Question / Decision inline.
- The panel's linked-tasks query already selected `type` and the row-renderer already showed `Q` / `D` glyphs (v1.92.0), so created Q&D land in the same list with no extra wiring.
- Couples no longer have to bounce to `/questions` to capture "what flowers does Aimee want?" on the bridesmaid outfit card.

**Verification:**
- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open `/tasks`, click a task → drawer now shows chip-toggle Assignees; toggle two on; save; row shows "Jamie +1" in the assignee column. Switch group-by to Assignee — task appears under both Jamie's and Bryony's sections.
- Manual: `/book/clothing` → "+ New" on either the section panel or any card → modal shows Task / Question / Decision picker; create a Question; reload — Question appears in the same linked panel with a `Q` glyph.
- Manual: existing rows that had a single assignee pre-migration display correctly after the backfill.

**Deferred to v1.96.1:** Edit-from-linked-screen — add a per-row "Edit" affordance on `CardInlineTaskRow` / `InlineTaskRow` that opens a modal with the full TaskForm. Needs a `loadTaskForEdit(id)` server action + suppliers/users threaded through `BookTopicsContext`. Tractable but didn't want to ship half-baked.

**Out of scope:** Renaming the `Task.tags` column — kept as-is in case a future semantic-category feature wants to reuse it; the migration churn isn't worth it just to drop an unused column.

### 2026-05-17 · v1.95.4 — Fix TEXT-card body disappearing on save

User: "Block text is not displaying after being saved."

Screenshots showed a TEXT card ("Rings") with rich content typed in the editor (H2 headings + paragraphs + tel-link) reverting to the empty-body `—` placeholder after the user clicked **Save changes**. Same content was still visible when re-opening the editor — so the data wasn't being lost in the DB; the read-mode render was just picking up a stale prop.

**Root cause.** `SubsectionEditor.save()` flow:

```ts
startTransition(async () => {
  await updateBookSubsection(sub.id, fd); // server-side revalidatePath
  setEditing(false);                       // flips to read-mode render
});
```

`updateBookSubsection` calls `revalidatePath('/book/<slug>')` which invalidates the server cache. In Next 15 this *usually* triggers an automatic refresh of the calling client component's props — but when the action is awaited inside `startTransition` AND `setEditing(false)` fires immediately after, the read-mode flip can race ahead of the prop update. The `<RichTextRead html={initialHtml} />` then renders against the pre-save `sub.bodyHtml` (still null for a brand-new card) and falls through to the `—` placeholder.

**Fix.** Explicit `router.refresh()` after the await:

```ts
await updateBookSubsection(sub.id, fd);
router.refresh(); // force fresh server data before view-mode flip
setEditing(false);
```

This forces a synchronous re-fetch of the server's data so the new `sub.bodyHtml` is live before the render switches to view mode. Defensive — does nothing in the common case where revalidatePath alone would have sufficed; closes the race when it doesn't.

**Secondary fix — `CardChrome.saveTitle`.** Pre-fix every title rename on a non-TEXT card posted `fd.set("body", "")` alongside the new title. That empty string entered `updateBookSubsection`'s legacy-body branch:

```ts
} else if (rawBody !== null) {  // rawBody === "" passes this check
  const text = String(rawBody);
  data.body = text || null;             // null
  data.bodyHtml = text ? legacyBodyToHtml(text) : null;  // null
}
```

So every CardChrome title rename wrote `body: null, bodyHtml: null` to the row. Harmless today because no CardChrome-using card kind stores body text (FIELD / RECIPE / OUTFIT / etc. keep their content in per-kind tables, leaving body columns null anyway) — but a latent footgun the moment any new kind ever ends up dual-routing through CardChrome AND having body content. Dropping the `fd.set("body", "")` line makes title-only saves leave the body columns untouched.

**Verification.** Manual round-trip: open a TEXT card, click Edit, type H2/H3/paragraph/link content, click Save changes — content now renders in read mode immediately. `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.

No schema, no action signatures changed.

### 2026-05-17 · v1.95.3 — Ordered status on WEDDING_PARTY matrix

User: "Add orderd status to wedding party dropdown."

The matrix cells offered four states since v1.92.0: NEED (default / sparse) → HAVE → ALREADY_OWN → N_A. Missing the "we've placed the order but it isn't in our hands yet" beat — useful for bridesmaid / groomsman accessories that get ordered weeks in advance and arrive piecewise. Pre-fix the couple either left those cells on NEED (wrong: order's already happened) or jumped them to HAVE (wrong: not in hand yet).

**New `ORDERED` slot** inserted between `NEED` and `HAVE` in the lifecycle:

```
NEED  →  ORDERED  →  HAVE  /  ALREADY_OWN  /  N_A
```

- Tone: `bg-marigold-100/40 border-marigold-700/30 text-marigold-700` — matches the "in-progress" pill the tasks panel uses for OPEN. Visually distinct from HAVE's moss "done" tone so the matrix reads at a glance.
- Glyph: `→` (forward arrow — implies "in transit").
- Label: "Ordered".

**Rollup behaviour.** The v1.92.0 `sortedCount` filter (`HAVE / ALREADY_OWN / N_A`) **does not include `ORDERED`** — ordered cells stay counted as "in progress, not done yet". A matrix with everyone's dress ordered but none received still reads "0 of N sorted" — which matches the couple's mental model: we haven't actually solved any of those rows until the items show up.

**Storage.** `BookWeddingPartyCell.status` was always a free `String` column (not an enum), so no schema migration. The sparse-cell convention is unchanged: `NEED + no notes ⇒ delete the row`. `ORDERED` persists as an explicit cell row, same as any non-NEED status.

**Wiring touched:**
- `Status` type union — added `ORDERED`.
- `STATUS_META` — added `{ glyph: "→", label: "Ordered", tone: "..." }` entry.
- `STATUSES` array — UI + select option order rebuilt as `["NEED", "ORDERED", "HAVE", "ALREADY_OWN", "N_A"]`.
- Server action `VALID_CELL_STATUSES` zod allowlist — same five-tuple.

586 tests stay green; typecheck + build green.

### 2026-05-17 · v1.95.2 — Equal-height cards + wider grid

User: "Where pages differ in sizes make the white space match, header at the top, footer at the bottom content in the middle, also widen the whole thing."

v1.95.0 turned `/book/[slug]` into a 2-column grid, but CSS grid only auto-stretches the row's *height* — it doesn't reach into each card to redistribute internal whitespace. Result: side-by-side cards with different content lengths left the shorter card at its natural height with grid-row background showing below it. The footer (Edit / Delete buttons) sat directly under the content, not at the bottom of the card outline.

**Four coordinated layout changes:**

**1. Grid wrapper div — `flex flex-col gap-1 h-full`.** Pre-fix the wrapper used `space-y-1` (static block flow with vertical margin), which doesn't propagate the grid's stretched row height into its children. New `flex flex-col gap-1 h-full`: explicit flex column that fills the row's stretched height (`h-full` on a grid item picks up the auto-stretched row height) and uses flex `gap-1` instead of the deprecated-flavoured `space-y-1`. Children — the action row + the card article — now compose vertically, and one of them can `flex-1` to absorb extra space.

**2. `CardChrome` `<article>` — `flex flex-col flex-1`.** The article picks up `flex-1` from its parent flex column so it expands to fill the wrapper's available height (after the action row's natural height). Inside, the article itself becomes a flex column so its children — header, content, linked-tasks panel, footer — stack vertically with predictable spacing.

**3. Content `{children}` wrapped in `<div className="flex-1">`.** The body grows to absorb any extra row-stretch space. The per-kind editor's internal layout (whatever space-y / grid it uses) renders naturally at the top of this wrapper. Empty whitespace ends up between the natural end of the content and the linked-tasks panel — header at the top, footer at the bottom, content in the middle exactly as the user described.

**4. `SubsectionEditor` (TEXT cards) — same flex treatment.** TEXT cards take a different code path from `CardChrome` (older bespoke chrome with its own dirty-tracking). The same `flex flex-col flex-1` on the article + `flex-1` wrap around the body keeps the two paths visually consistent in the grid.

**Container widening.** `max-w-5xl` (1024 px) → `max-w-7xl` (1280 px). Two narrow cards side-by-side at 5xl gave each card about 480 px of usable width (after 16 px gap + 24 px padding), which was tight for OUTFIT items / MENU courses / matrix WEDDING_PARTY headers. At 7xl each card gets ~610 px — comfortable.

**Verification:**
- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: open `/book/clothing` with two cards of different heights side-by-side. Confirm both card outlines extend to the row's bottom; confirm Edit / Delete footer pinned to the bottom of each card; confirm whitespace appears between content and linked-tasks panel on the shorter card.

No schema, no actions changed.

### 2026-05-17 · v1.95.1 — Fix Topics autofill on inline task creation

User: "When creating a task inline with a page, or an item can we autofill the topic according to the location its being created from?"

The intent was already coded — both inline-task panels on `/book/[slug]` pass a `default*Ids` prop to `AddTaskToggle`:

```tsx
// LinkedTasksPanel (section level)
<AddTaskToggle defaultBookSectionIds={[sectionId]} ... />

// CardLinkedTasksPanel (card level)
<AddTaskToggle defaultBookSubsectionIds={[subsectionId]} ... />
```

But the autofill was **silently broken** because of a downstream rendering gate. `AddTaskToggle` forwards defaults to `TaskForm`'s `initial` prop; `TaskForm` renders the `TopicPicker` only when at least one option list is non-empty:

```tsx
// TaskForm.tsx:181
{(bookSections.length > 0 || bookSubsections.length > 0 || navTags.length > 0 || guestGroups.length > 0) && (
  <TopicPicker ... initialBookSubsectionIds={initial.bookSubsectionIds} />
)}
```

Both panels passed `default*Ids` **without the corresponding option lists**, so `bookSections.length === 0 && bookSubsections.length === 0` and the picker was hidden. Because the picker is what renders the hidden `<input name="topicKeys">` inputs that get persisted by `createTask` → `parseTopicKeys`, the IDs never made it into formData. Net effect: tasks created from book panels had no topic links.

**Fix without prop-drilling through 14 editors.** The card-level panel sits at the bottom of `CardChrome`, which is invoked by every per-kind editor (`BookOutfitCard`, `BookTextCard`, `BookWeddingPartyCard`, etc. — 14 of them). Threading two new props through each editor would touch a lot of files. Solution: **`BookTopicsContext`** — a thin client-side React context provider mounted once at the page level.

**New `src/app/(app)/book/[slug]/BookTopicsContext.tsx`:**
- `BookTopicsProvider({ bookSections, bookSubsections, children })` — wraps the subtree.
- `useBookTopics()` — returns the lists; defaults to empty arrays so consumers outside the provider don't crash.

**Server-side wiring (`page.tsx`):** the section page already loads `section` + `section.subsections`. Builds two option lists in scope:

```tsx
<BookTopicsProvider
  bookSections={[{ id: section.id, title: section.title, slug: section.slug }]}
  bookSubsections={section.subsections.map((s) => ({
    id: s.id,
    title: s.title,
    sectionTitle: section.title,
    slug: s.slug,
    sectionSlug: section.slug,
  }))}
>
  <LinkedTasksPanel ... />
  {/* grid of cards */}
</BookTopicsProvider>
```

The provider is a client component but receives server-serialised options as props — works fine across the boundary.

**Panel consumers:** each panel now extracts its `AddTaskToggle` invocation into a thin internal wrapper (`AddTaskToggleWithTopics` inside `LinkedTasksPanel`, `AddCardTaskToggle` inside `CardLinkedTasksPanel`) that reads `useBookTopics()` and forwards the lists. None of the 14 card editors, `CardChrome`, or `CardRouter` change — the prop drilling is replaced by context lookup at the leaf where it's needed.

**Effect.** Open `/book/clothing` → click "+ Task" on a card's Linked Tasks header → modal opens with the TopicPicker visible, the current card already pre-selected as a chip. Click "+ Task" on the section-level panel → modal opens with the section already pre-selected. Submit → task persists with the right topic links and shows up in the right panel on reload.

No schema migration, no action signatures changed. 586 tests stay green.

### 2026-05-17 · v1.95.0 — Two-column section grid

User: "In the book section, can we have a two columns, and the option for pages to either use 1 or both columns."

`/book/[slug]` stacked every card in a single column inside a `max-w-3xl` container. Fine for OUTFIT / TEXT / FIELD cards, but the v1.91.0 → v1.92.0 expansion brought in matrix WEDDING_PARTY, deep MENU / BAR cards, and BUILD's materials-plus-sessions tracker — none of which read well in a narrow column. Wide cards needed horizontal space; narrow cards wasted screen real estate sitting alone in a column they didn't fill.

**Schema migration `20260517100000_book_subsection_wide`:**
```sql
ALTER TABLE "BookSubsection" ADD COLUMN "wide" BOOLEAN NOT NULL DEFAULT false;
```
Default `false` so existing rows keep their narrow column on first render — no surprise layout shift.

**Server action `setBookSubsectionWide(id, wide)`** — gates on `requireEdit("book")` only. No couple-tier restriction because layout is cosmetic (mirrors the `reorderBookSubsection` access tier rather than the couple-only `setBookSubsectionVisibility`). Idempotent no-op when `before.wide === wide`. Audit log uses the v1.30.5 `changedFields` + before/after snapshot pattern.

**New `SubsectionWidthToggle` client component.** Single icon button — `⇆` to expand a narrow card to full width, `⇤⇥` to collapse it back. Aria-label reads "Make 'Bryony's Outfit' full width" / "Make … single column" so screen-readers can describe the action. Same disabled-during-transition treatment as the existing reorder buttons.

**`SubsectionReorderControls` refactor.** Pre-fix the reorder component rendered its own `<div className="flex items-center justify-end gap-0.5 -mb-2">` outer wrapper. With the new width toggle wanting to live in the same row, that ownership had to move to the caller — `SubsectionReorderControls` now returns a fragment with the two ▲/▼ buttons, and `/book/[slug]/page.tsx` owns the action-row layout. Single-consumer refactor, no API churn elsewhere.

**`/book/[slug]/page.tsx` layout changes:**
- Container widened from `max-w-3xl` (768 px) to `max-w-5xl` (1024 px). The back link / "On this page" pill row / section linked-tasks panel still read naturally at the wider width (left-aligned text).
- Subsection `.map()` wrapped in `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">`.
- Each subsection wrapper computes `sRaw.wide ? "md:col-span-2" : ""` so narrow cards take a single column and wide cards span both.
- Action-row above each card composes width toggle + reorder controls into one flex row, only rendered when editable.

**Breakpoint reasoning.** Single-column below the Tailwind `md` breakpoint (768 px) so phones get a stacking layout regardless of any card's `wide` flag — `md:col-span-2` only kicks in once the grid actually has two columns to span. Tablets + desktops get the full 2-column treatment.

**Verification:**
- `npx tsc --noEmit`, `npm test` (586 passing), `npm run build` — all green.
- Manual: flip a card's width toggle, watch it span both columns; flip again, watch it return to single. Confirm narrow cards sit side-by-side in the grid; confirm phones (or DevTools mobile viewport) stack everything single-column.

**Out of scope.** Per-card width defaults by kind (e.g. WEDDING_PARTY / MENU / BAR auto-defaulting to wide) — every existing card defaults to narrow so the migration is non-disruptive; couples can opt in card by card. If preference emerges that certain kinds always want wide, we can update those creation paths' default in a follow-up.

### 2026-05-17 · v1.94.2 — Auto-derive book slugs

User: "Can we also remove the forced slug, make the app auto generate the slug."

Both Wedding Book creation modals (`AddSectionToggle` on `/book`, `AddSubsectionToggle` on `/book/[slug]`) required the couple to author a URL-safe slug by hand alongside the title — pattern `^[a-z0-9-]+$` enforced client-side AND server-side via Zod. Two problems: (a) friction for non-technical users — slugs are technical, titles are content; (b) the slug isn't even visible after creation, so there's no signal of why it needed to exist as a separate input.

**Shared helper extraction.** Three existing settings actions (`src/app/(app)/settings/nav-tag-actions.ts`, `guest-group-actions.ts`, `permission-group-actions.ts`) each carried an inline `slugify`. New `src/lib/slugify.ts` lifts the helper to a shared lib with identical rules:

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
```

Plus a new `disambiguateSlug(base, isTaken)` companion that walks `base`, `base-2`, `base-3`, … against a caller-supplied existence-check. Falls back to a `Date.now()` suffix after 1000 collisions (pathological case).

**Server-action wiring** (`src/app/(app)/book/actions.ts`):

- Imports `slugify, disambiguateSlug` from `@/lib/slugify`.
- `sectionSchema` drops the `slug` field.
- `subsectionSchema` drops the `slug` field.
- `createBookSection`: derives `baseSlug = slugify(parsed.title) || "section"` (fallback for titles that slugify to empty — pure punctuation), then `disambiguateSlug` against `db.bookSection.findUnique({where: {slug: candidate}})` to honour the global `@unique` constraint.
- `createBookSubsection`: same pattern but disambiguates against `db.bookSubsection.findFirst({where: {sectionId, slug: candidate}})` so each section's slug-space is independent (matches the schema — `BookSubsection.slug` is per-section, not globally unique, and fuels the `#<slug>` anchor row).

**UI wiring** (`AddSectionToggle.tsx` + `AddSubsectionToggle.tsx`):

- Slug `<Input>` removed.
- Title field becomes controlled (`useState<string>("")`) so a live preview line can update as the couple types.
- Section modal shows `URL: /book/<slug>` (because section slugs are URL paths).
- Subsection modal shows `Anchor: #<slug>` (because subsection slugs fuel anchor jumps, not URL paths).
- Empty-title preview: section falls back to `"section"`, subsection to `"page"` (the same fallbacks the actions use server-side, so the preview matches reality).
- State resets to `""` on successful create.

**Why the actions handle uniqueness, not the UI.** A client-side check would race against concurrent creation. Keeping uniqueness server-side in the same transaction as the insert is the only correct point — and from the user's perspective the experience is identical to the manual-slug flow (no error toast, just a working URL).

**No schema migration.** Existing `slug @unique` on `BookSection` and the implicit per-section uniqueness contract on `BookSubsection` stay exactly as they were. Slug-uniqueness still enforced at the DB layer; the *origin* of the slug (typed by hand vs. derived from title) is what changed.

**Out of scope.** Collapsing the three settings `slugify` duplicates onto `@/lib/slugify` — tracked but not done here to keep this release additive. Section-slug rename on title update still preserved as a deliberate non-change (v1.94.0's `updateBookSection` keeps slug stable because URLs are public-shareable).

586 tests stay green.

### 2026-05-17 · v1.94.1 — `/book` overview card polish

User: "Can we also make these look nicer? maybe sort the colouring out when adding extra items."

Screenshot of `/book` showed only the 7 canonical prototype sections carrying meaningful accents + illustrations — every custom section the couple had authored (Clothing & Accesories, Wedding Party — People, Wedding Party — Day-of, Venue — Spaces, Venue — Décor, all three Legal — splits, Post-wedding) fell through to `DEFAULT_META`: flat `bg-canvas` white with a generic 📖 emoji and the placeholder "Reference notes" line. Visually the page split into "real cards" and "white placeholders".

**Four coordinated changes, all in `/book/page.tsx` and `Illustrations.tsx`:**

**1. Deterministic accent rotation.** New `fallbackAccentFor(slug)` helper hashes the slug into one of the three canonical accents (`bg-moss-100`, `bg-moss-50`, `bg-marigold-100`). Same slug always hashes to the same accent, so cards don't shift colour on reorder, rename of an adjacent section, or arbitrary re-render. The three-accent rotation matches the prototype palette — no new colours introduced, just spread across more cards.

```ts
const FALLBACK_ACCENTS = ["bg-moss-100", "bg-moss-50", "bg-marigold-100"] as const;
function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function fallbackAccentFor(slug: string) { return FALLBACK_ACCENTS[hashSlug(slug) % 3]!; }
```

**2. Keyword-inferred glyph.** New `fallbackGlyphFor(slug, title)` matches against a lowercased `${slug} ${title}` haystack and picks the most-specific emoji from a curated list — 🏛 for venue / ceremony / reception / space / decor, 👗 for clothing / outfit / dress / attire / accessor, 👰 for wedding-party / bridesmaid / groomsman, 📜 for legal / licen / notice / document, 🛏 for accommodation / lodging / suite / room, 📷 for photo / video, 🍽 for food / drink / menu / bar / cake / catering, 🎉 for guest / favour / entertainment, 🗓 for schedule / timeline / day-of, 🎵 for song / music / dj / band, 🚗 for transport / car / taxi, ✈ for honeymoon / flight, 🥂 for stag / hen, 📔 for post-wedding, 📖 as last-resort fallback. Order matters — longer / more distinctive matches first so "Wedding Party — Day of" picks 👰 (party root) rather than 🗓 (day-of).

**3. `bookSceneFor` keyword fallback.** Pre-fix `bookSceneFor("venue-spaces")` returned null because only the bare canonical slugs were switched on. Now any slug starting with `venue` (or containing `ceremony` / `reception` / `space` / `decor`) inherits `IllusVenue`; same family handling for the other six canonical roots. Result: the "Venue — Spaces" + "Venue — Décor" custom sections both get the venue illustration; "Wedding Party — People" + "Wedding Party — Day-of" both get the wedding-party illustration; "Legal — Before the day" + "Legal — On the day" + "Legal — After" all get the legal illustration.

**4. Accent-tab left border.** `border-l-4 border-l-moss-300` (`hover:border-l-moss-500`) on each card. Reads as a subtle bookmark / book-spine tab — gives the card a stronger visual anchor than the previous uniform soft-border, and the moss accent on hover signals interactivity more clearly than the existing `hover:shadow-md hover:-translate-y-0.5` alone.

**Render wiring** (`/book/page.tsx`):
```ts
const canonical = SECTION_META[s.slug];
const meta = canonical ?? {
  accent: fallbackAccentFor(s.slug),
  glyph: fallbackGlyphFor(s.slug, s.title),
  description: DEFAULT_META.description,
};
```

Canonical wins exact-match; custom synthesises a per-section meta from the helpers. Existing v1.94.0 `s.subtitle ?? meta.description` fallthrough preserved.

No schema, no actions, no data migration. 586 tests stay green.

### 2026-05-17 · v1.94.0 — Per-section subtitle + rename

User: "Can we add a subtitle to the pages." Screenshot showed `/book` with every section card carrying the same generic "Reference notes" line — only the 7 canonical prototype sections (and Photography's shot-list count) had meaningful copy underneath the title. The descriptive line came from a hard-coded `SECTION_META[slug].description` map keyed by slug, so couples couldn't edit it and any custom section they created fell through to "Reference notes".

**Schema migration `20260517000000_book_section_subtitle`:**
```sql
ALTER TABLE "BookSection" ADD COLUMN "subtitle" TEXT;
```
Nullable — existing rows survive with `null` and continue to render the hard-coded `SECTION_META` fallback.

**Server actions:**
- `sectionSchema` gains `subtitle: z.string().max(240).optional().nullable()`. `createBookSection` reads it from the form, trims-or-nulls, persists.
- New `updateBookSection(id, formData)` action — accepts title + subtitle. Returns the standard `BookActionResult` discriminated union. **Slug stays stable** because URLs are public-shareable and the couple's muscle-memory / bookmarks shouldn't break on a typo fix. Audit log uses the v1.30.5 `changedFields` + before/after snapshot convention so renames read cleanly in the activity feed ("renamed Clothing → Outfits" rather than "updated Clothing").

**UI:**
- `AddSectionToggle` modal gains a Subtitle row below the Title + Slug grid. Placeholder cribs from the existing prototype text: "e.g. Package, shot list, locations, day-of contact".
- **New `EditSectionToggle`** component — renders an "Edit details" ghost button in the `/book/[slug]` header next to "+ New card" (couple + edit-permitted only). Opens an `AddNewModal` with Title (required, max 120) + Subtitle (optional, max 240, with helper text explaining where it surfaces). Uses the new `updateBookSection` action; success toast + close on save; error message inline on validation failure.
- `/book` overview render: `s.subtitle ?? meta.description`. DB value wins; otherwise fall through to the prototype copy. The "X pages" count line below stays unchanged.
- `/book/[slug]` page-header subtitle: `"<subtitle> · 3 pages · couple-only"` when subtitle is set; otherwise the v1.93 `"Wedding Book · 3 pages"` is preserved. The couple-only suffix still renders independently of the subtitle override.

**Why surface rename here.** Until v1.94.0 the only way to fix a section title was to delete + re-create + reorder. With the new `updateBookSection` action already accepting title (for the audit-log forensics), exposing it in the same modal cost nothing and closes the rename gap.

**Verification:**
- New section creation: subtitle field accepts up to 240 chars, empty input nulls out.
- Edit existing section: title + subtitle round-trip; audit row shows changedFields + before/after.
- /book card: custom subtitle wins; SECTION_META fallback still works for legacy sections.
- /book/[slug] header: subtitle prepends the page-count line when set.

No test churn — additive UI + persistence with no helper logic to cover. 586 tests stay green.

### 2026-05-17 · v1.93.2 — Per-item notes + view-row restructure

User: "review the ux and look of the page Allow me to add notes to each 'outfit' item."

Screenshot showed `/book/clothing` → "Bryonys Outfit" card with two items rendering as one dense line each ("Dress · Unknown · Unknown") and no visible status pills. Three problems to address: (a) no UI surface for per-item notes despite `BookOutfit.notes` being in the schema since v1.35.0, (b) the single-row item layout wrapped awkwardly with longer descriptions, (c) items with null status rendered no pill at all, so the lifecycle indicator was invisible until the user explicitly picked a status.

**Per-item notes — surface what's already there.** `BookOutfit.notes` + `outfitItemPayloadSchema.notes` + `saveOutfitCard` persistence existed since v1.35.0; the UI just never read or wrote it. Edit row gains a Row 4 textarea (2 rows, resize-y, placeholder "e.g. waist taken in 1.5cm, due back 12 Sept"); view row renders the notes as an italic muted line under the structured fields when set. Card-level notes still cover whole-outfit observations (alteration appointments, supplier conversations); per-item notes cover item-specific reminders (this dress's measurements, that shoe's pickup date).

**View row restructure — 2-row layout.** Pre-fix the item li was a single `flex items-baseline flex-wrap` row holding label + description + supplier + website link + cost / paid / status pills on the right via `ml-auto`. Long descriptions pushed pills onto a second wrapped row that lost its right-alignment. Now:
- **Row 1:** label (left, font-medium, `flex-1 min-w-0` so it can grow + truncate) + status/cost/paid pills (right, `flex-shrink-0`).
- **Row 2:** description · supplier · website link — only renders when at least one is set so empty items collapse to a clean single line.
- **Row 3:** italic muted notes — only when set.

**Status pill always renders.** When `item.status` is null, falls back to "Planned" label + Planned tone (muted bg-canvas). Items always have a position in the lifecycle (Planned → Purchased → Received → Already own), so the pill should always communicate it. Encourages the user to update status as items progress; pre-fix, items with null status were indistinguishable from items that just weren't tagged yet.

**Edit row:** Row 4 is now Notes (textarea); Row 5 is the reorder/remove controls. ItemEditRow row count goes 5: Item + Status (Row 1), Description + Supplier (Row 2), Website + Cost (Row 3), Notes (Row 4), reorder/remove (Row 5).

Untitled items get a `<span className="italic text-ink-tertiary">Untitled item</span>` placeholder in the label slot so freshly-added items don't render as a confusing empty row.

No schema, no actions, no data migration. 586 tests stay green.

### 2026-05-17 · v1.93.1 — Per-item cost on OUTFIT

User: "Add cost to each item."

v1.93.0 dropped card-level paid + dates and centred OUTFIT on "what we need". Couple immediately wanted itemised spend — knowing the card-level cost is £400 doesn't say whether the dress is £300 + the shoes are £100, or some other split. Additive change so the existing BudgetLine sync stays unchanged.

**Schema migration `20260515300000_outfit_item_cost`:**
```sql
ALTER TABLE "BookOutfit" ADD COLUMN "costPence" INTEGER;
```
Nullable so existing rows survive with `null` (= "not itemised yet").

**Server action.** `outfitItemPayloadSchema` gains `costPence: z.number().int().min(0).nullable()`. `saveOutfitCard`'s `tx.bookOutfit.update` + `tx.bookOutfit.create` both persist the new field.

**Threading.** `CardRouter.tsx`'s outfit items type adds `costPence: number | null`; `page.tsx` maps `costPence: o.costPence` into the threaded shape; `BookOutfitCard.tsx`'s local `Item` type + save-payload + `addItem` default all extended.

**UI:**
- **View row:** small muted `£X.XX` chip renders next to the status pill when an item has a cost. Skipped when null (no zero-fill noise).
- **Edit row:** Row 3 (was Website full-width) becomes a 2-col grid (Website `col-span-8` / Cost `col-span-4`) when `showMoney` is true; otherwise Website stays full-width so couple-hidden views don't suddenly show money fields. Cost uses the existing `penceToPoundsString` / `poundsStringToPence` helpers + `£` prefix + `inputMode="decimal"` + `tabular-nums` matching the card-level Cost input.
- **Card meta line:** the v1.93.0 line `"3 of 5 sorted · £400 budget"` gains a third chip — `"items total: £375"` — when any item has a cost. Title-attr tooltip explains "Sum of per-item costs; card-level cost drives the linked BudgetLine."

**Finance integration unchanged.** Card-level `costPence` still drives `BudgetLine.estimated` via v1.78.0 `syncBudgetLine`. Per-item costs are display-only tracking — no rollup into BudgetLine in this release (deliberate: keeping the budget-link semantics stable while the couple decides how they want item-level money to flow into the budget).

586 tests stay green; no test changes needed (per-item cost is additive UI + persistence, no rollup helpers to update).

### 2026-05-14 · v1.93.0 — OUTFIT card simplification round 2

User: "Lets add planned as an uption, also on the outfit remove the paid. Lets simplify the outfit section, I want to be able to plan each item, mark if we have paid for it, or recieved it, description, supplier and web link, maybe pictures too, remove fitting alterations and pickup, anything with dates as these can be managed via tasks."

v1.92.0 already dropped trackingMode + per-item paidBy. This release goes further: the OUTFIT card becomes a "what we need" tracker, not a "when / who paid" tracker. Dates live as Tasks (which already thread back to the right Book card via the v1.51.0 Topics multi-select); money lives in the Payments stack (v1.75.0 `Payment.bookOutfitId` per-item link + v1.78.0 card → BudgetLine sync).

**Schema migration `20260515200000_outfit_card_simplification`:**
- Maps existing `BookOutfit.status` to the new lifecycle: `Designed → Planned`, `Ordered → Purchased`, `Fitted → Received`, `Collected → Received`, `alreadyOwned=true → Already own` (the "Already own" mapping wins when both the boolean + a different status are set, preserving the v1.92 marker's intent).
- Drops `BookOutfit.alreadyOwned` boolean (folded into status).
- Drops `BookOutfitCard.fittingDate / alterationsDueBy / pickupDate / paid / paidBy`.

**`outfitRollups` simplification.** Was `{ itemCount, collectedCount, percentCollected, nextMilestone, daysToNext }`. Now `{ itemCount, collectedCount, percentCollected }`. Done states (counted into collectedCount) are now `Received` + `Already own`. Old `OutfitMilestone` type + `OUTFIT_MS_PER_DAY` const deleted.

**Today page.** `nextOutfitMilestones` deleted from `src/lib/today-widgets.ts`. `OutfitMilestoneHit` + `OutfitMilestoneCard` types gone. The "Fittings & pickups" widget on `/today` retires; the `TodayCrossModuleStrip` `OutfitWidget` function + `outfitHits` prop deleted. Page-level `outfitCardRows` query + `outfitHits` derivation also removed.

**OUTFIT card UI (`BookOutfitCard.tsx`):**
- `STATUS_OPTIONS = ["Planned", "Purchased", "Received", "Already own"]`. Tones updated: Planned (muted), Purchased (info blue), Received (moss green = success), Already own (marigold = special).
- Stats strip (4-tile grid: Next milestone / Cost / Paid / Items) + fitting timeline chip row both deleted. Replaced with a single tiny meta line: `"3 of 5 sorted · £400 budget"`.
- Edit body: 3-date input row + Cost-row-with-PaidBy-and-Paid all gone. Cost stays on its own row (still drives BudgetLine sync). Per-item edit row's Already-own checkbox dropped — status enum covers it.
- Dead helpers deleted: `<Stat>`, `<TimelineStep>`, `isoDate()`, `shortDate()`, `PAID_BY_OPTIONS`.
- View mode's `✓ Already own` chip dropped (subsumed by status pill rendering "Already own" with the marigold tone).

**Server-action shape:** `outfitSavePayloadSchema` loses `fittingDate / alterationsDueBy / pickupDate / paid / paidBy`. `outfitItemPayloadSchema` loses `alreadyOwned`. `saveOutfitCard` drops the corresponding `parseISODate` calls + `paid` / `paidBy` persistence + the `headerChanged` snapshots.

**Tests:** `tests/unit/outfit-rollups.test.ts` rewritten for the simplified rollup (no milestone tests, status mapping). `tests/unit/today-widgets.test.ts`'s `nextOutfitMilestones` describe block deleted. 586 tests stay green (was 594).

**Finance integration intact.** `costPence` still feeds the linked `BudgetLine.estimated` via v1.78.0 `syncBudgetLine`; per-item Payments still link via `Payment.bookOutfitId` and surface the `📎 £X paid` reciprocal chip.

### 2026-05-14 · v1.92.2 — Drop redundant titles

User: "also seems to have multiple titles in a section" — screenshot of `/book/clothing` showed the same labels repeating three times: the section breadcrumb, the "On this page" pill row, each card's title, AND inside each OUTFIT card a standalone "Bryony · BRIDE" person header.

**Two fixes, both render-only:**

1. **OUTFIT internal person header.** Pre-fix the OUTFIT view always rendered `<personName · ROLE>` as a header below the card title. When the user named the card "Bryonys Outfit" the personName "Bryony" was redundant with the title. New heuristic: when `title.toLowerCase().includes(personName.toLowerCase())`, the personName line hides — only the role chip (BRIDE / GROOM / BEST MAN / etc.) renders on its own line so the tag info isn't lost. When no personName is set the chip + "No name set" italic still surface (no regression for empty cards). When personName is set AND distinct from title (e.g. "Jamie" inside a card titled "Tom's Suit"), both still render.

2. **"On this page" pill row.** Threshold bumped from `section.subsections.length > 1` to `> 4`. 2-4-card sections (the common case — the user's Clothing section has 3 cards) sit in the same scroll viewport anyway; the pills repeated titles without adding navigation value. Long sections (5+ cards) still get the row.

No schema, no actions, no data migration. 594/594 tests stay green.

### 2026-05-14 · v1.92.1 — Flip the WEDDING_PARTY matrix

User: "might be better to swap people & Items?" — looking at the just-shipped WEDDING_PARTY card with 4 bridesmaids (Aimee / Tansy / Tia / Kati) across the top + 3 items (Dress / Shoes / Accessories) down the left. The 4th name was cut off behind a horizontal scroll.

**Fix.** Flip the matrix: **people as rows, items as columns**. Typical wedding parties are 4-5 people × 3-4 items, so the people-as-rows orientation fits in the available width without scroll. The `ITEM` header column becomes `PERSON`; the 4 person columns become 3 item columns; the cells inside each row are now per-item statuses for that person.

**Render-only change.** Data model is unchanged — same `BookWeddingPartyCell.memberId + itemId + status` — and the cell save action still takes `(memberId, itemId)`. The cell lookup helper (`cellAt`) is symmetric.

**Reorder arrow glyphs flip too.** `MemberHeader` + `ItemHeader` each gain an `orientation` prop (`"row" | "column"`):
- Members are now rows → arrows read as `▲ / ▼` (Move up / Move down).
- Items are now columns → arrows read as `◀ / ▶` (Move left / Move right).

**Button labels swapped:** `+ Add person (column)` → `+ Add person (row)`, `+ Add item (row)` → `+ Add item (column)`. No schema, no migration, no test impact.

### 2026-05-14 · v1.92.0 — Course-correct v1.91.0

User feedback after v1.91.0 shipped:

> "This isn't really what I wanted, remove the subcategorisations, I want to track bridesmaids and groomsmen as a group, in a card where I can list out their names, list out the items they need, and if we have them or not. The outfit section as a whole isn't really working — several options are unnecessary. Status doesn't have a Purchased option, paidBy doesn't account for if we already own something and again doesn't link into the existing finance system. The tasks/questions/decisions section should be **inline within the card** and not look like it's been appended at the bottom."

**Five coordinated changes** in one release.

**1. Drop subsection categorisation (v1.91.0).** The wrong abstraction — what the user actually wanted was a group-level matrix card. Schema drops `BookSubsection.category` + the index. UI drops: `AddSubsectionToggle` category input, `CardChrome` inline category strip + `saveCategory` handler, `SubsectionEditor` inline category strip, `page.tsx` group-by-category render + existingCategories computation, `CardRouter`'s threading.

**2. Drop OUTFIT `trackingMode` (v1.91.0).** The FULL/LIGHT distinction stops being useful now that bridesmaid / groomsman tracking moves to the new matrix card. Schema drops `BookOutfitCard.trackingMode` + the `OutfitTrackingMode` enum. UI drops the toggle + all `isLight` branches in the editor.

**3. Drop OUTFIT per-item `paidBy` (v1.91.0).** Replaced by per-item **`alreadyOwned: Boolean @default(false)`**. The user noted some items they plan to wear are already in their possession (necklace with new chain, socks, underwear, etc.) — these don't need money tracking. Items they're buying continue to flow through the existing v1.78.0 BookOutfitCard → BudgetLine sync + v1.75.0 `Payment.bookOutfitId` per-item link (which surface the `📎 £X paid` chip on each row).

**OUTFIT improvements:**
- `Already own` checkbox in the edit row + `✓ Already own` chip in view mode.
- `Purchased` added to `STATUS_OPTIONS` (between Designed and Ordered) — the user noted not every item goes through an "Ordered" flow.

**4. New `WEDDING_PARTY` card kind.** Matrix tracker (items as rows, people as columns) for bridesmaid / groomsman / flower-girl readiness. Four new models:
- `BookWeddingPartyCard` — single per-subsection row, holds `groupLabel` + `notes`.
- `BookWeddingPartyMember` — one per person (name + optional role + order).
- `BookWeddingPartyItem` — one per item (label + notes + order).
- `BookWeddingPartyCell` — **sparse** cell storage. Only rows where status differs from the default `NEED` are persisted. Statuses: `NEED / HAVE / ALREADY_OWN / N_A`.

Editor renders as a `<table>` with members across the top + items down the left + a status dropdown in each cell. Cell-by-cell save via `setWeddingPartyCell` (no draft form). Members + items have inline rename / delete / reorder via hover-only action buttons. Card-level `groupLabel` + `notes` save on blur. ~10 new server actions for member / item / cell CRUD + reorder.

**5. Inline linked-tasks panel.** The v1.51.0 `CardLinkedTasksPanel` rendered as a sibling **below** each card's `<article>` (visually appended). User asked for it to read as part of the card.
- Lifted from `CardRouter.tsx` into its own `CardLinkedTasksPanel.tsx`.
- `CardChrome` now renders the panel **inside** the article element between the children and the action footer.
- `SubsectionEditor` (TEXT) renders the same inline.
- `BookDressCodeCard` renders the same inline.
- The four kinds the user is actively iterating on (`TEXT / OUTFIT / DRESS_CODE / WEDDING_PARTY`) + `FIELD / RECIPE` (props already threaded) render inline; the remaining 8 kinds keep the v1.51.0 sibling-render via a small `SiblingLinkedTasksPanel` wrapper in CardRouter until they're each migrated in a follow-up release.

**OUTFIT → Budget + Payments wiring unchanged.** Card-level `costPence` still drives the linked `BudgetLine.estimated` via `syncBudgetLine`; per-item Payments still link via `Payment.bookOutfitId` and surface the `📎 £X paid` reciprocal chip. `alreadyOwned` is **display-only** at the item level — no auto-skip on budget sync (the couple manually nets out owned items when setting the card-level cost).

Migration `20260515100000_wedding_party_card_outfit_cleanup_drop_categories`:
- DROP `BookSubsection.category` + index.
- DROP `BookOutfitCard.trackingMode` + `OutfitTrackingMode` enum.
- DROP `BookOutfit.paidBy`.
- ADD `BookOutfit.alreadyOwned` (BOOLEAN NOT NULL DEFAULT false).
- ADD `WEDDING_PARTY` to `BookSubsectionKind`.
- ADD 4 new tables + indexes.

594/594 tests still green.

### 2026-05-14 · v1.91.0 — Dress-code + outfit modes + card categories

User: *"We currently have clothing and accessories in detail for where we are making the purchases, but we don't have anything for tracking if bridesmaids, groomsmen have made their purchases etc — Also general clothing guidance for any guests asking. Could we plan out some new cards, maybe also start to categorise the cards, can we also identify how the detailed clothing view works with the current budgets and payments page."*

Three coordinated additions, picked via clarifying questions.

**1. OUTFIT card flexibility (no new card kind).** New `BookOutfitCard.trackingMode` (`FULL | LIGHT` enum, FULL default). FULL keeps the existing tracker for Bryony / Jamie. LIGHT collapses both view + edit to **items + status + per-item paidBy** only — fitting / alterations / pickup / card-level cost / photo gallery all hide. Data is preserved across mode flips so a card can drill back into FULL.

New `BookOutfit.paidBy` (free text, nullable) overrides the card-level `paidBy`. Lets a bridesmaid OUTFIT card carry mixed responsibility — "Dress: Aimee" while "Bouquet: Couple". View-mode chip falls back to the card-level value with an `(inh.)` italic suffix (matches the v1.86.0 fund-chip convention). Edit-mode uses a text input with a datalist of common values (Self / Couple / Parents / Other).

**2. New DRESS_CODE card kind.** `BookSubsectionKind.DRESS_CODE` + new `BookDressCodeCard` model (single-row, mirrors `BookSetupCard` shape). Fields:

- `dressCode` — primary label ("Smart casual" / "Black tie")
- `summary` — one-line headline
- `bodyHtml` — Tiptap-authored long-form guidance (sanitised on save)
- `colourGuidance` — "Please avoid white / ivory"
- `footwear` — "Comfortable shoes — ceremony on grass"
- `weather` — "Outdoor in September — bring layers"
- `accessories` — "Hats welcome / no fascinators"
- `fileIds` — mood-board images via the standard `<ImageGallery>` (v1.63.0)

Couple-internal reference. The couple uses it as a script for answering guest questions. No public surface yet (deferred). Four new server actions (`saveDressCodeCard`, `attachFileToDressCodeCard`, `detachFileFromDressCodeCard`, `uploadAndAttachDressCodeFile`) mirror the SETUP / STAY pattern. `createBookSubsection` seeds the per-kind row alongside.

**3. Subsection categorisation.** New `BookSubsection.category` (nullable text, indexed). Cards on `/book/[slug]` render under uppercase category headers (`BRIDE`, `BRIDESMAIDS`, `GROOMSMEN`, `Uncategorised`) — the page query orders by `(category, order, title)` so groups arrive pre-sorted. Header-on-change render avoids restructuring the existing per-card map (so v1.87.0 reorder still works).

`CardChrome` + `SubsectionEditor` both get inline category inputs (dashed-underline text input, datalist of existing categories on the section, onBlur save). `AddSubsectionToggle` gains a category field on create. `BookOutfitCard` threads the props through to `CardChrome` so OUTFIT cards have the same inline category UX. Other card editors will pick it up as a follow-up; the **server-side grouping + create-time UI already works for every card kind**.

**OUTFIT → Budget + Payments wiring (unchanged from v1.78.0):**
- `BookOutfitCard.budgetLineId` FK + `saveOutfitCard` calls `syncBudgetLine` on every save → linked `BudgetLine.estimated` mirrors `card.costPence`.
- `Payment.bookOutfitId` per-item link → "📎 £X paid" chip on each item row in the editor.
- Card-level `paid: boolean` is a separate manual flag — payments don't auto-tick it.
- v1.91 keeps this loop intact. Per-item `paidBy` is **display-only** (doesn't change which items contribute to the linked BudgetLine). A follow-up could add per-item `costPence` so the budget sync sums only `paidBy === "Couple"` items.

**Migration `20260515000000_dress_code_outfit_modes_categories`** — additive:
- New `DRESS_CODE` enum value on `BookSubsectionKind` + new `BookDressCodeCard` table.
- New `OutfitTrackingMode` enum + `BookOutfitCard.trackingMode` (default FULL).
- New `BookOutfit.paidBy` (nullable).
- New `BookSubsection.category` (nullable) + index.

No backfill needed; existing rows stay correct.

### 2026-05-14 · v1.90.1 — Questions edit form parity

User: "They don't have the same edit screen" — screenshot of `/questions` editing a question, showing Title · Type · Priority · Status · Due · Assignee · Category · Notes — but no Topics multi-select. The `+ New` form on the same page (via `AddTaskToggle`) has the Topics picker; the inline edit row didn't.

**Diagnosis.** `TaskForm` only renders its Topics block when at least one of `bookSections / bookSubsections / navTags / guestGroups` is non-empty (the guard hides an empty card on pages that don't load any). The Questions page already loaded all four lists for `AddTaskToggle` but never threaded them into `QuestionsClient` — and the task query never `include`d the m2m relations, so even if the picker rendered it would have nothing pre-selected.

**Two coordinated fixes:**

1. **`questions/page.tsx`** — `db.task.findMany` gains `include: { bookSections, bookSubsections, navTags, guestGroups }` (only `.id` selected; just need IDs for picker pre-selection). The page's `<QuestionsClient>` invocation now passes the four option lists + flattens each row's m2m arrays into `bookSectionIds / bookSubsectionIds / navTagIds / guestGroupIds` on the shaped `Q` object.

2. **`QuestionsClient.tsx`** — local `Q` type extended with the four ID arrays; the four option-list props added to `QuestionsClient → Section → Row`; `TaskForm` invocation in the editing branch forwards both the option lists and the existing IDs as `initial`.

**No server changes.** `updateTask` already reads topic IDs via `parseTopicKeys(formData)` (writing them was never broken — the form just never surfaced them to edit). `TopicPicker`'s `__touched__` sentinel (v1.61.1) handles the unchanged-relations preservation rule correctly.

**Verification.** Edit any open question on /questions — the form now has a Topics section under Notes with the four chip groups, pre-selected with the row's existing links. Toggle, save, reload — the relations persist and surface under `LinkedTasksPanel` / `CardLinkedTasksPanel` on the linked Wedding Book section/card. 594/594 tests stay green.

### 2026-05-14 · v1.90.0 — Today page polish

User: "Can we make this look better?" (with a screenshot of `/today` showing two issues — a lone "Open decisions" card sitting in a 3-column grid with two empty cells beside it, and a "Recent activity" feed that read as a wall of uniform-coloured plaintext rows).

**Two render fixes:**

1. **Cross-module strip — auto-fit grid.** `TodayCrossModuleStrip.tsx` was a static `grid sm:grid-cols-3` with three sibling `<section>` widgets. When a widget had no data it returned `null`, but the grid template still reserved the column space — leaving a wide blank gap beside the lone card. Switched to `style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}` and filter the widgets array before render. Now: one widget = one full-width card; two widgets = two-up; three widgets = three-up — and no empty cells in any case.

2. **Recent activity — colour-coded badges + initials chip.** `RecentActivityFeed.tsx` rewrote the row layout:
   - **Entity glyph badge** on the left of each row. Colour-coded by category — `£` (marigold) for Payment / Budget; `✓` (moss) for Task; `♥` (moss) for Guest / Household; `◆` (info) for Supplier; `❧` (moss) for Book; `♪` (info) for Songs; `📎` (muted) for File; `◷` (marigold) for Schedule; etc. New `ENTITY_BADGE` map covers 21 entity types with a neutral `·` fallback for any future addition.
   - **Right-justified mono `time-ago` column** with fixed 64px width — keeps the sentence start aligned across rows.
   - **Sentence in `text-ink-primary`** (stronger weight than the surrounding muted text) so it's the row's primary read.
   - **Trailing actor chip** — `initialsFor(name, email)` extracts "JS" from "Jamie Spencer", falls back to email-prefix or `◯`. Full name in the `title` attr. Replaces the inline ` · Jamie Spencer` suffix that ran into the sentence on every row.
   - `divide-y divide-border-soft/60` between rows + subtle `hover:bg-canvas/40` so consecutive entries don't blur together when there are 10 at once.

**No data layer changes.** Both fixes are render-only; the page query, audit-format helper, and time-ago helper are untouched.

### 2026-05-14 · v1.89.2 — Folder name on receipts

User: "Add the folder name to receipts". The receipts panel on /payments and the inline grid's `📎 Pick existing` popover both showed bare filenames, so a user with multiple files of the same name across different folders (e.g. an "invoice.pdf" in `Payment receipts` and another in `Catering`) couldn't tell them apart at a glance.

**Changes:**
- `db.file.findMany` on /payments now selects `folder` + orders by `folder asc, name asc` so groups arrive pre-sorted.
- `FileSummary` type (in `PaymentRow` + `InlinePaymentGrid`) gains `folder: string | null`.
- **PaymentRow's attached-receipt list:** each row renders the folder as a muted uppercase prefix chip (`PAYMENT RECEIPTS · invoice.pdf`). Hover title shows the full path.
- **PaymentRow's "Attach existing file" picker:** grouped under sticky folder headers so the dropdown is scannable when there are many files across many folders.
- **InlinePaymentGrid's receipt popover:** same grouping — folder header, then the files within.

No schema changes. `File.folder` already existed (uploads default to "Payment receipts" for receipts, "Wedding Book — outfits" for OUTFIT card photos, etc.); v1.89.2 just surfaces it where the user picks files.

### 2026-05-14 · v1.89.1 — MIME fallback (OneDrive)

User: tried to upload `Jamie Spencer Proposal_signed.pdf` (1 MB, valid `%PDF-1.3` magic bytes) — upload failed with "type not allowed" despite `application/pdf` being on the allowlist.

**Root cause.** OneDrive-synced files often lose their Content-Type metadata. When the user drags such a file through the browser's file picker, `file.type` comes through as an empty string, and `validateUpload` was substituting `application/octet-stream` and rejecting it.

**Fix in `src/lib/uploads.ts`:**
- New `inferMimeFromName(name)` helper builds a reverse-lookup of `MIME_EXTENSIONS` (plus `jpeg` → `image/jpeg` since both are common). Returns the inferred MIME or null if the extension isn't on the allowlist.
- `validateUpload` now prefers the browser-supplied `file.type`, but when it's empty OR `application/octet-stream` it falls back to the extension-based inference before giving up. This unbreaks PDF / image uploads from OneDrive, mail attachments, and other paths where the Content-Type didn't survive.
- Rejection message now includes the filename + the detected type so the user can spot a wrong-extension typo without diving into devtools.

Applies everywhere uploads land: payment receipts (`uploadAndAttachReceipt`), BUILD / SETUP / STAY image galleries, /files general upload. All paths route through `validateUpload`.

### 2026-05-14 · v1.89.0 — Inline receipt upload + multi-file

User: "File upload inline with receipts i.e. upload receipt & also allow multiple files to be uploaded". Two long-standing gaps in the v1.75.0 inline payment grid closed in one release.

**Problem 1 — inline upload was a stub.** The `📎 Receipt` popover let you pick one local file but the file was queued locally with no way to attach it to the new payment. `createPayment` was a `void`-returning form-action so the caller had no payment id to chain `uploadAndAttachReceipt` against. The user got a warn-toast telling them to re-upload via the row's edit menu — every payment with a receipt required two operations.

**Problem 2 — single-file picker.** Both the inline grid and PaymentRow's receipts panel used `<input type="file">` without `multiple`, forcing one upload per round-trip even when the user had 5 receipts from one shopping run.

**Fixes:**
- `createPayment` now returns `{ id: string }`. Backwards-compatible — `PaymentForm` callers ignore the return.
- `InlinePaymentGrid.commit()` now awaits the new id, then loops through the queued files and calls `uploadAndAttachReceipt` for each. Per-file failures surface as targeted error toasts; the success toast reports the receipt count (`Added "Florist" with 3 receipts`).
- Both file inputs (inline grid + PaymentRow's receipts panel) gain `multiple`. The handler iterates `Array.from(e.target.files ?? [])` and uploads sequentially so a 400 on file 3 doesn't block 4+5 and the error count stays precise.
- `PaymentRow`'s receipts panel gains an explicit `↑ Upload receipt — one or many` button. Pre-v1.89 the panel was attach-existing-only (with a code comment "deferred to a follow-up"); that comment is now retired.

**No schema changes.** The Files / Payment.fileIds shape from v1.75.0 was already correct — this release just wires the missing UI to the existing `uploadAndAttachReceipt` server action.

### 2026-05-14 · v1.88.0 — Fund chip moved to action column

User: "Can we move the Payment picker 'joint...' to the end of the row where there is more space, after the pricing etc". The v1.86.0 component sub-row tucked the fund chip inline next to the component label, which crowded the label against the breakdown chip (e.g. "Drinks Reception ▣ Joint" with the `£7.00 × 51 guests` line wrapping immediately under). Moving it makes both halves of the row legible.

**Change in `BudgetClient.tsx`:**
- Component sub-row's column 1 (label) drops the `FundChipPicker`. The label + breakdown chip now have the cell to themselves.
- Component sub-row's column 6 (previously empty, mirrors the parent line's action column) now renders the `FundChipPicker`, right-aligned, so the chip sits directly under the line's own fund chip.

Parent line rows already had the chip in the action column (next to Edit/×), so the visual column is consistent across the line + its components.

No schema, no compute changes — purely the chip's render position.

### 2026-05-13 · v1.87.0 — Reorder Book sections + pages

User: "Allow me to reorder items in the wedding book". Pre-v1.87 the book had a creation-order layout: sections appeared on /book in the order they were created, and pages (subsections) inside each section appeared in their creation order too. The schema had `order Int @default(0)` on both `BookSection` and `BookSubsection` from the start, but no UI surfaced reordering — items within cards (BUILD materials, OUTFIT items, MENU courses, BAR/SETUP items) already had `↑/↓` buttons via the existing draft-state edit forms, but sections + pages themselves didn't.

**Two new server actions** in `src/app/(app)/book/actions.ts`:

- `reorderBookSection(id, delta)` — finds the neighbour at `idx ± 1` (in `order asc, title asc` order, matching the /book page query), swaps the two rows' `order` columns in a single `$transaction`. Audit row `book-section-reorder` carries the moved title, the resolved delta, and the swapped-with neighbour's title.
- `reorderBookSubsection(id, delta)` — same shape but scopes the sibling lookup to `sectionId` so reorder is local to the current section. Revalidates both `/book` and `/book/<section.slug>`.

Both `requireEdit("book")`-gated; both audit-logged per the v1.30.5 enrichment rule.

**UI.** Two small client components:

- `SectionReorderControls` (`src/app/(app)/book/SectionReorderControls.tsx`) — absolutely-positioned `▲ / ▼` buttons that float over each section card's top-right on /book. The cards are `<Link>` elements and nesting interactive buttons inside `<Link>` is invalid HTML, so the wrapper uses `e.preventDefault() + e.stopPropagation()` to neutralise navigation when the user clicks a reorder button.
- `SubsectionReorderControls` (`src/app/(app)/book/[slug]/SubsectionReorderControls.tsx`) — thin `▲ / ▼` row that sits just above each `CardRouter` on a section page. Hidden when the section only has one card (nothing to reorder against).

Both gated on the existing `editable` (couple) check; both disable the appropriate button at the ends of the list.

**No schema, no migration.** The `order` columns already existed; the page queries already sort by `order asc`. Purely additive — server actions + UI on existing data.

### 2026-05-13 · v1.86.0 — Funding sources

User: *"Add a method for joint vs personal / other funded on the budget screen, find a way to calculate, joint budgets and personal budgets etc & roll that into what we currently have with the toggle between actual and planned outage vs what has been paid, work it into the whole finance system."*

Today's finance stack treats every line, component, and payment as one undifferentiated pool. v1.86 layers a **fund** dimension on top so the couple can answer: "How much are Bryony's parents covering?" "How much of the Joint pot have we used?" "Show me only Jamie's personal-account contributions."

**Schema.** Migration `20260514400000_funding_sources`:
- New `FundSource` enum: `JOINT | PERSONAL_BRIDE | PERSONAL_GROOM | OTHER`.
- Three models — `BudgetLine`, `BudgetLineComponent`, `Payment` — each gain `fundSource FundSource?` + `fundLabel String?`. All additive; existing rows stay null ("unassigned"). No backfill.
- Narrow B-tree index on `fundSource` per table for filter queries.

**Resolver — `src/lib/funds.ts` (new).** Single-purpose pure module:
- `FundKey = FundSource | "UNASSIGNED"` (synthetic key for null chains).
- `resolveFundLabels({ brideFirst, groomFirst })` returns the 5 chip labels, pulling bride/groom from `WeddingSettings` so renaming the couple cascades automatically.
- `effectiveFundForComponent(component, line)` — component override wins; falls back to line; else UNASSIGNED.
- `effectiveFundForPayment(payment, component, line)` — payment > component > line > UNASSIGNED.
- `groupTotalsByFund`, `rowMatchesFundFilter`, `formatFundChip` — reducers used by /budget and /glance.
- 18 unit tests in `tests/unit/funds.test.ts`.

**Compute helpers — `src/lib/budget.ts` extension.** The six existing helpers (`computeActual`, `computePaid`, `computeEstimated`, `computeComponentEstimated`, `computeCompositeActual`, `computeCompositePaid`) gain an **optional** `filter?: { fund: FundKey | "ALL" }` parameter. When omitted or set to "ALL" the helpers behave exactly as pre-v1.86 — all existing call sites are unchanged. When a fund is named, payment-sum helpers filter via `effectiveFundForPayment`, and estimate helpers return 0 when the row's own fund doesn't match. Manual `actual` / `paid` overrides count only when the line's own fund matches the filter. 12 new fund-filter cases extend `tests/unit/budget.test.ts`.

**Server actions.**
- `lineSchema` + `componentSchema` (budget) gain `fundSource` + `fundLabel`. `createLine` / `updateLine` / `createComponent` / `updateComponent` persist + audit. Update flows include the fund fields in `changedFields` per the v1.30.5 enrichment rule.
- New: `setLineFund(id, { fundSource, fundLabel })` + `setComponentFund(...)` — small dedicated quick-actions so the per-row chip can flip the fund in one round-trip without re-validating the whole line / component schema. Both audit-logged (`budget-line-fund-set` / `budget-component-fund-set`) with `priorFundSource` + `priorFundLabel` snapshots.
- `paymentSchema` (payments) gains `fundSource` + `fundLabel`. `createPayment` + `updatePayment` persist + revalidate `/budget` when a fund change is detected.

**UI — /budget.** Biggest change. `BudgetClient` now owns a `fundFilter: FundKey | "ALL"` state hydrated from `?fund=` URL param first, then localStorage `wh_budget_fund_filter`, then "ALL". Three new components in `BudgetClient.tsx`:
- `FundFilterChips` — chip-row above the SummaryBar. `[All funds] [Joint] [Bryony] [Jamie] [Other] [Unassigned]`. Active pill in marigold.
- `ByFundStrip` — below the SummaryBar (hidden when the filter is already narrowed). One mini-tile per fund showing Planned + Paid. Renders only funds with nonzero totals — a Joint-only wedding doesn't see empty Bryony/Jamie/Other stubs. Tiles are clickable: pick narrows the filter.
- `FundChipPicker` — popover for the per-line and per-component fund chip. Radio of four buckets + an OTHER text input. The line's chip uses `setLineFund`; component chips use `setComponentFund`. Component chips render `(inh.)` italic when the fund came from the parent line.

SummaryBar gets a small marigold "Filtered" banner when `fundFilter !== "ALL"` with a "Clear filter" link. The Outstanding toggle (v1.84) stays orthogonal — it just operates on the filtered totals.

**UI — /payments.**
- `InlinePaymentGrid` gets a `📁 Fund` select column (5 values: inherit / Joint / Bride / Groom / Other), plus an inline `fundLabel` text input that appears only when Other is picked.
- `PaymentForm` (edit mode) gets a matching `FundPicker` block under the Budget link picker.
- `PaymentRow` renders a fund chip (`▣ Joint` / `▣ Bryony's parents`) in the Linked / Receipts column. The chip walks the resolver chain (payment > component > line) and italicises "(inh.)" when the chip came from a parent.
- `/payments?fund=JOINT` URL filter composable with the existing `?supplier=` + `?category=`.

**UI — /glance.** Budget card grows a "Paid by fund" line under the existing Paid / Committed / Remaining row. Renders only funds with nonzero totals. Each label deep-links to `/budget?fund=<KEY>`.

**No regression risk.** Every existing call site passes no filter / no fund — totals, audit logs, and renders match pre-v1.86 behaviour for any database where the new columns stay null. Existing 564 tests green; +30 new.

### 2026-05-13 · v1.85.0 — Rename + reorder budget categories

User: "Allow me to rename budget Groups & reorder them". Pre-v1.85 the only way to "rename" a budget category was to delete + recreate (and the delete was blocked when the category had lines, so realistically you couldn't fix a typo at all). Reorder had no UI surface despite `BudgetCategory.order` existing in the schema since v0.1.0.

**Two new server actions** in `src/app/(app)/budget/actions.ts`:

- `renameCategory(id, name)` — single-field `BudgetCategory.update`. Same `categorySchema` Zod shape as `createCategory` so length + non-empty rules stay consistent. No-ops when the name is unchanged. Audit row carries `priorName` + new `name` + `changedFields: ["name"]` per the v1.30.5 enrichment standing rule.
- `reorderCategories(orderedIds[])` — transactional `order`-column rewrite. Mirrors `reorderComponents` from v1.80.0 (1-shot `$transaction(updates[])`). Audit metadata records `count` + the full `orderedIds`.

Both return the existing `DeleteResult` shape so the client can surface real error toasts.

**UI** on the `CategoryBlock` header:

- `✎` pencil button (between the action group and the title's `↗ Payments` link). Clicking swaps the title for an inline `<Input>` — Enter saves, Esc cancels, Save / Cancel buttons for mouse paths. Empty name guarded client-side. The collapsed `▸/▾` indicator stays visible during rename so the layout doesn't jump.
- `▲ / ▼` buttons that move the category one slot. Disabled at the ends of the list (`idx === 0` / `idx === categories.length - 1`). Parent `BudgetClient` owns the ordering: clicking computes the swapped id-array and dispatches a single `reorderCategories` call.

**No schema, no migration.** `BudgetCategory.order` already existed; the page query already sorts by it. Pure feature wiring on existing data.

### 2026-05-13 · v1.84.0 — Outstanding-mode toggle

User asked for "a toggle for planned vs paid & actual vs paid near the outstanding field on the budget screen". The Actual / Planned / Paid tiles each present a different lens on the same numbers; Outstanding was hard-coded to one of them. v1.84.0 makes Outstanding switchable.

**Two modes, side-by-side on the same tile:**

- **vs Actual** (default, pre-v1.84 behaviour) — `actual − paid`. *What's been committed but not yet settled* — money the couple has agreed to spend but the cash hasn't left the account yet. Useful when tracking commitments and reconciling vendor invoices.
- **vs Planned** — `planned − paid`. *How much more we need to find against the budget*. Useful when forecasting cashflow rather than tracking commitments.

**UI.** A two-pill segmented control sits inside the Outstanding tile's label row. The label updates to reflect the active mode ("Outstanding · vs Actual" / "Outstanding · vs Planned"). The Outstanding value re-renders accordingly; the marigold accent (when > 0) is preserved across modes. The three other tiles and the stacked progress bar are unchanged.

**Persistence.** Selection stored to `localStorage` under `wh_budget_outstanding_mode`. Hydrated via `useEffect` post-mount (avoids SSR mismatch). Try/catch around both read + write so the toggle still works in privacy modes / SSR.

**State lift.** `outstandingMode` lives on `BudgetClient` so `remaining` (the value passed into `<SummaryBar>`) can switch denominator. SummaryBar receives `outstandingMode` + `onOutstandingModeChange` as props; an `OutstandingTile` subcomponent renders the pill row + the value.

**No schema, no compute helpers, no migrations.** Pure render change against existing totals.

### 2026-05-13 · v1.83.0 — Composite-line columns

User-reported gap on `/budget` after v1.82.0 shipped: the Venue line's Planned cell read "—" even though its components summed to £5,667 (visible in the category header). The component sub-rows also had blank Actual + Paid cells.

Semantics confirmed with user: Planned = budgeted cost; Actual = final cost so far (sum of linked payments, paid + pending); Paid = settled portion (PAID-status sum). v1.82.0 already implements those compute-side — this release is purely the visual surfacing that v1.80.0 missed when adding the composite-line model.

**Three render-only changes in `BudgetClient.tsx`:**

1. **Parent line Planned cell.** When `line.components.length > 0`, the cell renders `£${effectiveEstimated}` with a Σ pill instead of "—". Existing `effectiveEstimated` helper already sums components; the cell just didn't read it out.

2. **Component sub-row Actual column.** Per-component sum of linked payment amounts (regardless of status). When > 0, renders `£X` with a Σ pill (mirrors the line-level treatment). "—" when zero.

3. **Component sub-row Paid column.** Per-component sum of payments where `status === "PAID"`, rendered in moss-green with a Σ pill (same colour as line-level Paid). "—" when zero. Inline `filter().reduce()` per the v1.82.0 inline-helper convention (avoids re-exporting `componentPaid` from `@/lib/budget` when only this file uses it).

**No schema, no compute, no migrations** — purely surfacing values that already existed.

### 2026-05-13 · v1.82.0 — Components grow up + Paid rollup fix

User reports + asks rolled into one release.

**Bug:** linking a PAID Payment to a BudgetLine showed it under Actual (£1,000) but the Paid column stayed at £0. Root cause: `BudgetLine.paid` was rendered verbatim from the manual column with no awareness of linked payment status — the B2 contract that auto-rolls payments into `actual` had no equivalent on `paid`. New `computePaid(line)` / `computeCompositePaid(line)` helpers in `src/lib/budget.ts` apply the same shape: manual override wins; otherwise sum of payments **filtered to `status === "PAID"`**. Payment query updated to include status. Budget page renders `linePaid()` instead of the raw column; subtotals + totals updated. Σ pill appears on the Paid column when it's a computed rollup (mirrors Actual's pre-existing pill).

**Component editing.** v1.80.0's ComponentsPanel was add-only; now each row has an Edit button. ComponentsPanel rewritten around a shared `ComponentForm` used by both create + edit paths. Edit-mode swaps the row inline; submit calls `updateComponent`. Cancel reverts.

**MANUAL + notes on components.** The form gains MANUAL in the Source dropdown (with a "Manual count" input that appears when picked), plus a Notes textarea spanning the row. Component rows in the list show a 📝 hint (with the notes as title attr) when notes are present.

**New headcount sources.** `PerHeadSource` enum gains `ADULTS_PENDING_OR_CONFIRMED` and `CHILDREN_PENDING_OR_CONFIRMED` — confirmed + pending split by age. Use case: venue prices £25/adult and £15/child against the realistic upper-bound RSVP cohort. `fetchAllHeadcounts()` runs two extra `count()` queries (still one batch). `perHeadSourceLabel` + `perHeadSourceNoun` updated for new variants. Dropdowns on the line edit form and ComponentsPanel form list them in the natural order (after CONFIRMED_PLUS_PENDING).

**Migration:** `20260514300000_per_head_source_pending_age_splits` runs two `ALTER TYPE … ADD VALUE` statements. Postgres 16 handles these transactionally.

### 2026-05-13 · v1.81.0 — Minimum-cover floor

User flagged: some venue items have a vendor minimum (e.g. "we charge for 80 covers regardless of RSVPs"). The per-head multiplier needs to honour this — `max(resolvedCount, minimum)`.

**Schema (`20260514200000_minimum_headcount`).** Adds `minimumHeadcount Int?` to BOTH `BudgetLine` (standalone per-head lines) and `BudgetLineComponent` (composite sub-rows). Additive — no backfill.

**Pure helpers** (`src/lib/budget.ts`):
- New `applyMinimum(resolved, minimum)` → `max(resolved, minimum ?? 0)`. Null minimum passes through.
- `computeEstimated` now takes optional `minimumHeadcount` on the line shape and applies the floor before multiplying.
- `computeComponentEstimated` same treatment for components.
- MANUAL source flows through the same path — a typed count is still floored by the vendor minimum (decision: same rule everywhere; if you've typed "4" but the floor is "6", you pay for 6).

**Server actions:** `createLine` / `updateLine` / `createComponent` / `updateComponent` all accept `minimumHeadcount`. Audit log captures changes.

**UI:**
- Line edit (`NewLineForm` variable-cost panel) gains a fourth field: `Min` (optional integer ≥ 0). Lives next to the count display.
- Component add-form (`ComponentsPanel`) shows `Min` next to `Source` when in per-head mode.
- Live preview on the line form annotates when the min kicks in ("£3,500 (80 min, actual 51 × £43.75)"), marigold-coloured active count.
- Read-mode breakdown chips — on the line itself and on indented component sub-rows — render the active multiplier in marigold + `(min, actual N)` whenever the floor is doing work. When the actual count is already ≥ minimum (or no minimum is set), display is unchanged.

**Behaviour summary:** breakdown chip on /budget reads `£25 × 80 (min, actual 51) = £2,000` when the minimum applies, `£25 × 51 confirmed + pending = £1,275` otherwise.

### 2026-05-13 · v1.80.0 — Composite budget lines

User raised the modelling gap: the venue invoice has multiple cost shapes (50 meals × £25, 50 toast drinks × £2.50, one £150 arch) that all roll up to one conceptual "Venue" line. Pre-fix, `BudgetLine` was one-shape-only (flat or single per-head rate). Three lines in a category got close but broke the lump-sum mental model.

**Schema (`20260514100000_budget_line_components`).** New `BudgetLineComponent` model:

```prisma
model BudgetLineComponent {
  id              String
  lineId          String       // → BudgetLine, cascade-delete
  label           String
  flatPence       Int?         // flat mode
  perHeadPence    Int?         // per-head mode
  headcountSource PerHeadSource?
  manualHeadcount Int?
  order           Int          @default(0)
  notes           String?
  payments        Payment[]    // back-relation
  // Card targets — v1.80.1 wires the UI; the FKs ship here.
  menuCards / barCards / outfitCards / stayCards / buildCards
}
```

Plus `Payment.budgetLineComponentId` (SetNull on delete) and `BookXCard.budgetLineComponentId` on each of the five cost-bearing card kinds (data layer ready; UI in v1.80.1).

**Pure helpers** (`src/lib/budget.ts`): `computeComponentEstimated`, `computeComponentActual`, `computeCompositeActual` (line actual = line payments + sum of component payments; B2 manual override still wins).

**Server actions** (`src/app/(app)/budget/actions.ts`): `createComponent` / `updateComponent` / `deleteComponent` / `reorderComponents`. Audit-logged with rich metadata. `paymentSchema` extended with `budgetLineComponentId`; `createPayment`/`updatePayment` resolve component → parent line so both FKs are populated consistently regardless of which the UI picks.

**UI: BudgetClient.**
- Composite line read mode: indented sub-rows beneath the line, each component showing its breakdown chip (`£25.00 × 50 confirmed + pending`) and its own actual rollup. Line aggregates as before.
- Edit mode: new `ComponentsPanel` inline below the standard line form. Add component (label + flat-vs-perHead + price + source), delete-with-confirm, ordered list.
- Line-level totals + over-budget chip now factor component-level payments (via `lineActual` helper that switches between `computeActual` and `computeCompositeActual` based on whether components exist).

**UI: PaymentForm + InlinePaymentGrid.** The budget link `<select>` becomes prefix-encoded (`line:<id>` / `comp:<id>`) so the same dropdown offers both line-level and component-level targets. Lines with components render as `Venue (whole line)` followed by indented `· Meals` / `· Toast drinks` / `· Wedding arch` siblings (optgroup nesting isn't a thing in the platform). Two hidden inputs (`budgetLineId` / `budgetLineComponentId`) track the parsed selection; submit goes through unchanged.

**UI: PaymentRow chip.** When a payment targets a component, the chip reads `📊 <line> · <component>` instead of just `📊 <category>`. Component link wins for chip specificity.

**Out of scope (v1.80.1 follow-up):** card-to-component picker UI in `BudgetLinkControl` + the save-action sync to route through `syncBudgetLineComponent` when set. The FKs are in the schema and unblock the UI work.

### 2026-05-13 · v1.79.0 — Payments → budget line picker

User-reported gap: `/payments` showed 9 paid entries totalling £3,957+ while `/budget` displayed £0 across every column. The `Payment.budgetLineId` FK column existed (since the original budget design) but no UI ever surfaced it — every payment created via v1.74.0+'s inline grid landed as a budget orphan.

**Server:** `paymentSchema` (Zod) gains `budgetLineId: z.string().optional().nullable()`. Both `createPayment` and `updatePayment` read it from FormData and pass it through to the DB. After insert/update, `revalidatePath("/budget")` fires so the B2-contract actual recomputes immediately.

**InlinePaymentGrid:** new `📊 Budget line` `<select>` between Supplier and the 🔗 Link button. Categories as `<optgroup>`, lines as `<option>` — the dropdown becomes useful as soon as `/budget` has a line in any category. Disabled with a helpful tooltip when there are no lines yet ("Add a budget category on /budget first"). Picker preserves the v1.75.1 single-row grid layout.

**PaymentForm:** gains a matching `Budget line` dropdown in the edit form, so PaymentRow edit mode can change the link. Defaults to whatever's currently on the payment.

**PaymentRow read mode:** the "Linked / Receipts" column now also surfaces a `📊 <category>` chip when linked, alongside the existing 🔨/👔 BUILD/outfit chips and 📎 receipt count. Deep-links to `/budget`.

**Page query (`/payments`):** `db.payment.findMany` includes `budgetLine: { category }` for the row chip. The existing `db.budgetCategory.findMany` (added in v1.77.0 for the category filter) extends its select to include `lines: { id, description }` so the same query feeds the picker without an extra round-trip.

**B2 contract** does the rest — once a payment is linked, its amount automatically rolls into the line's `actual` on `/budget` (manual override on the line still wins if explicitly set).

### 2026-05-07 · v1.78.0 — Close the financial loop

The audit's three remaining gaps after v1.77.0:

1. MENU/BAR/OUTFIT/STAY card costs didn't reach the budget — user had to double-enter a flat BudgetLine.
2. MENU and BAR each had bespoke per-head logic (`confirmedHeadcount` field, hardcoded `confirmedAdults` source) — pre-dated v1.77.0's `PerHeadSource` enum.
3. v1.75.0's Payment → BookBuildMaterial / BookOutfit link was one-way — payments knew, the cards didn't.

This release closes the data layer for all three. Visible features: paid-on-material chip on BUILD, paid-on-item chip on OUTFIT. Per-card "Link to budget" picker UIs ship in v1.78.1 polish — the auto-resync infrastructure is in this release so existing links keep working.

**Schema migration `20260514000000_card_budget_links_and_menubar_enum`:**

```sql
-- Per-card BudgetLine FK (mirrors v1.31.1 BookBuildCard.budgetLineId).
ALTER TABLE "BookMenuCard"   ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookBarCard"    ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookStayCard"   ADD COLUMN "budgetLineId" TEXT;
-- + four FK constraints (SetNull on delete) + four indexes.

-- MENU adopts PerHeadSource. confirmedHeadcount kept one release.
ALTER TABLE "BookMenuCard" ADD COLUMN "headcountSource" "PerHeadSource";
ALTER TABLE "BookMenuCard" ADD COLUMN "manualHeadcount" INTEGER;
-- Backfill: rows with confirmedHeadcount → MANUAL with that count;
-- null+priced rows → ALL_CONFIRMED.

-- BAR per-item adopts PerHeadSource.
ALTER TABLE "BookBarItem" ADD COLUMN "headcountSource" "PerHeadSource";
-- Backfill: per-head rows → ADULTS_CONFIRMED (existing hardcoded source).
```

**Server actions.** New shared helper `syncBudgetLine(budgetLineId, { description, flatEstimatedPounds, perHead })` updates a BudgetLine in-place from a card save — toggles between flat and per-head modes coherently. Eight new actions: `linkMenuCardToBudget` / `linkBarCardToBudget` / `linkOutfitCardToBudget` / `linkStayCardToBudget` (each takes `{ subsectionId, categoryId, description? }` and creates the line + sets the FK), and four matching `unlink<X>CardFromBudget` actions (sets FK to null; line survives).

`saveMenuCard`, `saveBarCard`, `saveOutfitCard`, `saveStayCard` all extended:
- MENU: schema accepts `headcountSource` + `manualHeadcount`. After save, if `budgetLineId` is set, calls `syncBudgetLine` with `perHead: { perHeadPence, headcountSource ?? "ALL_CONFIRMED", manualHeadcount }`.
- BAR: per-item schema accepts `headcountSource` (defaults to `ADULTS_CONFIRMED` for per-head items). After save, if linked, sums the rolled total (per-head items × `confirmedAdults` + flat items) and writes a flat `estimated`. BAR is multi-rate so the line carries no per-head config.
- OUTFIT/STAY: flat `costPence/100` → BudgetLine.estimated. No per-head.

All four card kinds have audit-logged actions (`menu-budget-link` / `outfit-budget-sync` / etc.) with rich metadata.

**Page query.** Loads `payments` per `BookBuildMaterial` and per `BookOutfit` (the per-item model), filtered to PAID status and summed in app code (`paidPence` per row). Also loads each card's `budgetLine: { id, description, category: { id, name } }` for the linked-budget chip (UI in v1.78.1) and `budgetCategories` for the picker.

**Visible UI: paid-on-card reciprocal chips.**
- BUILD card materials table (couple-only via `showMoney`): below the cost cell on each material row, when `paidPence > 0` shows `📎 £15.00 paid` (or `📎 £15.00 / £15.00 ✓` when paid >= cost).
- OUTFIT card items list: next to the status pill, same shape.

These close the v1.75.0 reciprocal gap — paying for a material on `/payments` now visibly updates the BUILD card.

**Reusable component:** new `BudgetLinkControl.tsx` — chip + popover for picking a category + creating the link. Plumbing for it ships now (props ready in `CardRouter`); each card's `Link to budget` button wiring is the v1.78.1 polish.

**Out of scope (v1.78.1):**
- Per-card "Link to budget" affordance UI on each of MENU/BAR/OUTFIT/STAY (data layer ready).
- MENU edit body: add headcount source dropdown (currently still uses confirmedHeadcount; saves both fields for compat).
- BAR per-item: add per-row headcount source picker.
- BUILD's "Copy to Budget" button retrofit to auto-sync (existing manual pattern intentionally preserved).

**Out of scope (later):**
- Drop `confirmedHeadcount` column (v1.79 — one release recovery buffer).
- New `PER_HEAD_ITEMS` Wedding Book card kind.

### 2026-05-07 · v1.77.0 — Variable budget rollups + warnings + spend pulse

The audit-driven workflow loop, scoped to the budget side. Closes four of the friction points the financial-stack audit surfaced.

**Variable / per-head budget lines.** Schema migration `20260513000000_per_head_budget_lines`:

```sql
CREATE TYPE "PerHeadSource" AS ENUM (
  'ALL_INVITED', 'CONFIRMED_PLUS_PENDING', 'ALL_CONFIRMED',
  'ADULTS_CONFIRMED', 'CHILDREN_CONFIRMED', 'MANUAL'
);
ALTER TABLE "BudgetLine"
  ADD COLUMN "perHeadPence" INTEGER,
  ADD COLUMN "headcountSource" "PerHeadSource",
  ADD COLUMN "manualHeadcount" INTEGER;
```

When `perHeadPence` and `headcountSource` are both set on a line, the effective estimated total derives from `perHeadPence × computeHeadcount(...)` recomputed live each render. RSVP changes propagate without anyone retyping. The flat `estimated` column is retained as a fallback for non-variable lines.

**`src/lib/headcount.ts`** (new) — single source of truth. Async `computeHeadcount(source, manualCount)` queries the Guest table per source. `fetchAllHeadcounts()` batches one COUNT per source so `/budget`'s render fires five queries instead of N (one per per-head line). Pure helpers `perHeadSourceLabel` / `perHeadSourceNoun` for the breakdown display. New pure helper `computeEstimated(line, headcount)` in `src/lib/budget.ts` returns the effective estimated as a number; `isOverBudget(line, headcount)` for the warning chips.

**`BudgetClient` — variable cost toggle.** `NewLineForm` (used for both create and edit) gains a "Variable cost (£ × headcount)" checkbox. When on:
- Hides the flat "Planned £" input, sends `estimated=""` so the server clears it.
- Shows three side-by-side fields: per-head price, headcount source dropdown (six options), and either a live count display (read-only, pre-fetched) or a manual count input (when source = MANUAL).
- Live preview: "= £3,000 (60 × £50.00)" updates as the user types.

When off: the existing flat-estimated input renders as before, and the per-head fields are passed as null hidden inputs so the server clears them.

**`BudgetClient` — view-mode breakdown + over-budget warnings.** Per-line:
- Breakdown chip below the description: "£50.00 × 60 guests (confirmed + pending) = £3,000.00"
- Planned column shows the derived total when per-head is set, otherwise the flat estimated value.
- ⚠ Over chip beside the description when computed actual > computed estimated.

Per-category header gets a `⚠ N over` rollup chip when any line in the category is over budget, plus a new `↗ Payments` deep-link to `/payments?category=<id>` so the couple can see the payments behind a category in one click.

**`/payments` — `?category=<id>` filter.** Composable with the existing `?supplier=` (Prisma `AND`-filter). Filter banner mirrors the supplier-filter pattern; the Clear link preserves the other filter if both are active.

**`/suppliers/[id]` — over-agreed warning.** When `totalCommitted` (paid + due) exceeds `Supplier.amountAgreed`, a danger-toned strip on the rollup section shows the gap: "⚠ Over agreed by £350 · committed £4,850 against £4,500." Couple-only via the existing money permission gate from v1.76.0 (the warning row only renders when `showMoney` is true).

**`/glance` — spend pulse.** Couple-only addition to the existing Budget card. Pulls the last 30 days of PAID payments (with their budget-line categories), reduces in app code into:
- "£X this week" + "£Y this month"
- Top 3 categories by amount in the period, each as a deep-link to `/payments?category=<id>`

Hidden entirely on a fresh DB (no spend in 30 days = no strip), so the card stays clean for early planning.

**Out of scope (v1.78.0):** MENU/BAR migration to the unified `PerHeadSource` enum; new `PER_HEAD_ITEMS` Wedding Book card kind for grouping per-head items inside the book; paid-on-BUILD reciprocal chip on materials.

### 2026-05-07 · v1.76.0 — `money` permission gate

User asked: "ensure that all financial components can be hidden from certain users under permissions". The pre-existing model had `/budget` and `/payments` couple-only via `COUPLE_ONLY_SECTIONS` (page-level `redirect`), but £ values bled through three other surfaces — BUILD/MENU/BAR/OUTFIT/STAY cards in the Wedding Book, the supplier detail page, and the /diy overview. A planner granted `book` view to help with logistics could still see every per-head price and material cost.

**New section: `"money"`.** Added to `SECTIONS` in `src/lib/permissions.ts`. Not in `COUPLE_ONLY_SECTIONS` — couple can grant the planner VIEW (or EDIT) via the existing per-user override matrix without unlocking the financial-first pages. Default for non-couple is NONE → £ values hidden. Couple short-circuits to EDIT via the existing `isCouple` bypass.

New helper `canViewMoney(user)` exported alongside `canView` / `canEdit` for terse call sites. Settings UI: `MemberOverridesBlock` and `PermissionGroupsBlock` both gain a "Money values" row.

**Surfaces gated.**

| File | What's hidden |
|---|---|
| `/diy/page.tsx` | "Materials spend" stat tile + the per-card `formatGBP(materialsTotalPence)` chip in the project list |
| `/suppliers/page.tsx` + `SupplierCard.tsx` + `SupplierForm.tsx` + `AddSupplierToggle.tsx` | "Agreed" line on each card; "Amount agreed (£)" input in edit + create forms |
| `/suppliers/[id]/page.tsx` | "Agreed / Paid to date / Outstanding" rollup section |
| `/suppliers/[id]/SupplierDetailClient.tsx` | Contracts panel hidden wholesale (it's purely financial) |
| `/book/[slug]` BUILD card | "Materials" total stat; per-material "Cost" column; edit-row "Total cost" input |
| `/book/[slug]` MENU card | "Per head" + "Total" stat tiles; "Price per head" edit input |
| `/book/[slug]` BAR card | "Tab / corkage" + "Total cost" stat tiles; per-category and per-timing total chips; per-item price/head display + line total; edit-row "Tab limit" / "Corkage" / per-item price inputs + Pricing toggle |
| `/book/[slug]` OUTFIT card | "Cost" stat tile; cost edit input |
| `/book/[slug]` STAY card | "Cost" stat tile; cost edit input |

**Edit-mode behaviour.** When `showMoney === false`, money inputs aren't rendered at all. Existing values are preserved via:
- Card editors: the draft state (a copy of the underlying `card.costPence` etc.) carries forward unchanged because the input that would mutate it never mounts.
- `SupplierForm`: explicit `<input type="hidden" name="amountAgreed" value={initial?.amountAgreed ?? ""} />` so the form-action sees the same value back.

Side effect: non-money editors can change non-money fields (mark a material as ordered / arrived, edit a supplier's name or notes) without touching the £ amounts.

**Threading.** `showMoney` flows through `book/[slug]/page.tsx` → `CardRouter` → each card. CardRouter's `Sub` type didn't need changes — `showMoney` is a separate prop, defaulted to `true` so any non-money-aware caller gets unchanged behaviour.

**Out of scope (v1.77.0):** the workflow loop the audit flagged — MENU/BAR per-head costs flowing into BudgetLine, payment-paid reciprocal chip on BUILD materials, "over budget" warnings, /payments category filter, spend pulse on /glance. Permissions land first so the audit's gaps can be closed without "now-it's-leaky-now-it's-not" interim states.

### 2026-05-07 · v1.75.1 — Single-row grid + supplier autofill

User feedback on v1.75.0 within hours of shipping:
- "Multiple lines, only really need one" — the 5-row grid felt cluttered for a flow that's almost always one-payment-at-a-time.
- "Can the dropdown be a field with suggested autofill?" — the supplier `<select>` was awkward; freer text + autofill matches the description input's pattern.

Two changes to `InlinePaymentGrid.tsx`:

**Single row.** All the per-row state (`description`, `amount`, `supplier`, `link`, `attachedFileIds`, `queuedFiles`) collapsed to top-level `useState` calls. After commit, fields reset and focus returns to description for fast back-to-back entry. No more `RowDraft[]` array, `INITIAL_ROW_COUNT`, or advance-focus-to-next-row plumbing — keeping it open for future re-introduction if bulk paste-in ever surfaces, but the state model is much simpler now.

**Supplier autofill input.** The `<select>` (with its bespoke `+ New supplier…` option opening a sub-form) is replaced by `<input type="text" list="payment-suppliers">` paired with a `<datalist>` of existing supplier names. On commit, typed text is matched case-insensitively against `suppliers[].name`:
1. Empty → no supplier link
2. Match → use that supplier's id
3. No match → auto-create via `createSupplierQuick({ name, category: "Other" })`, prepend to the local list, and use the new id

This replaces the v1.74.0/.75.0 inline sub-form pattern entirely — no more category prompt up-front; users can edit the category later on `/suppliers` if they care. Helper text below the row reminds: `Suppliers you type that don't already exist are auto-created.`

### 2026-05-07 · v1.75.0 — Excel payment grid + receipts + book linking

User feedback: bulk-entering payments (a stack of receipts from Hobbycraft / Amazon / Converse) was too slow with the v1.74.0 single-row inline add. Plus, micropurchases had nowhere to go in the data model — a £15 foam purchase couldn't claim the BUILD material it bought, and Converse shoes couldn't tie back to anyone's outfit. v1.75.0 closes both gaps.

**Schema migration `20260512000000_payment_receipts_and_book_links` (additive).** Three columns on `Payment`:

```sql
ALTER TABLE "Payment" ADD COLUMN "fileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Payment" ADD COLUMN "bookBuildMaterialId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bookOutfitId" TEXT;
```

Two FKs (both `ON DELETE SET NULL` — payment record survives if the linked book row is removed) plus indexes. `BookBuildMaterial` and `BookOutfit` (per-item) gain `payments Payment[]` back-relations.

**`InlinePaymentGrid.tsx` (new, replaces `InlineAddPaymentRow.tsx`).** Five visible blank rows in a panel above the payments table. Each row carries its own draft state (`description` / `amount` / `supplierId` / `link` / `attachedFileIds` / `queuedFiles`). **Enter** on description or amount commits that row → calls `createPayment`, blanks the row in-place, advances focus to the next empty row's description input. Description input is `<input list="payment-descriptions">` with a sibling `<datalist>` populated from `recentDescriptions: string[]` (deduped + alphabetised, top 50, derived from the existing payments query — no extra round-trip).

**Inline supplier create** preserved verbatim from v1.74.0 — `+ New supplier…` opens a sub-form taking name + category, calls `createSupplierQuick`, prepends the new supplier locally, auto-selects it for the row.

**🔗 Link picker.** New per-row button opens a popover with two tabs:
- **BUILD material** — cascading select: pick a `BookBuildCard` (by subsection title), then click a material from its list. Already-ordered materials show a `●` prefix; un-ordered show `○`.
- **Outfit item** — flat select of all `BookOutfit` items, labelled like `"Jamie Spencer (Groom) — Shoes"` (joined through to the parent `BookOutfitCard.personName` + `role`).

Selection is stored as `{ kind, id, label }` in row state. On Enter, `bookBuildMaterialId` or `bookOutfitId` gets sent in `FormData`.

**Side effect: `createPayment` auto-marks the linked BUILD material as ordered.** New helper `maybeMarkMaterialOrdered(user, materialId, paymentId)` is called after the payment insert. Skipped if the material is already ordered (so we don't lose pre-payment ordering history). Audit log captures `action: "build-material-ordered-by-payment"` with `paymentId` + `materialName` metadata. `revalidatePath("/book", "layout")` fires so the BUILD card UI refreshes. Detaching a link doesn't undo the `ordered` flag — the user may have actually ordered it; clearing silently would lose information.

**📎 Receipt picker.** New per-row button opens a popover with two paths:
- **Pick existing** — list of all `File` rows; click attaches its id to the row's `attachedFileIds` (sent as repeated `fileIds` entries on commit).
- **Upload from device** — file input queues a local `File` object. Receipt-on-create for queued uploads is **partial**: `createPayment` is a form-action returning `void`, so we can't resolve the new payment id back to attach the upload. v1.75.0 surfaces a `notify("warn", …)` if any queued files were lost; the user re-attaches via PaymentRow's edit-mode receipt panel. Promoting `createPayment` to return the id is a small follow-up.

**`PaymentRow` updates.**
- New "Linked / Receipts" column in read mode: shows a `🔨 <material name>` chip (deep-link to the BUILD card) or `👔 <person> — <item>` chip (deep-link to the outfit page) if linked, plus a `📎 N` chip if receipts are attached. Both wrap on small screens.
- Edit mode preserves link + receipts via hidden FormData passthrough on `PaymentForm` (so `updatePayment` doesn't clobber them when the user edits unrelated fields).
- Edit mode adds a receipts panel below the form with attach-existing-file and detach-with-confirm. Upload-from-edit deferred — receipts uploaded via `/files` first, then attached.

**Receipt server actions.** `uploadAndAttachReceipt(paymentId, FormData)` mirrors `uploadAndAttachBuildFile` from v1.63.0 — calls `validateUpload` + writes to `UPLOADS_DIR` + creates a `File` row (folder=`Payment receipts`, visibility=`COUPLE_ONLY` — money-sensitive). `attachReceiptToPayment(paymentId, fileId)` and `detachReceiptFromPayment(paymentId, fileId)` push/pop the `fileIds` array, deduped. All audit-logged with `payment-receipt-upload` / `-attach` / `-detach` actions and rich metadata (description, fileName, mimeType).

**Workflow answer (Hobbycraft / Converse / Amazon):** every retailer becomes a `Supplier` row — created once via `+ New supplier…` from the inline grid (name="Hobbycraft", category="Craft retailer" or default "Other"), then available in every future payment's dropdown. `Supplier.status` (SHORTLIST/QUOTED/BOOKED/PAID) doesn't apply to retail; harmless to leave at default. The new piece is the link chip — that's how a £15 Hobbycraft payment claims the centerpiece-foam material it actually paid for. Linked BUILD materials auto-tick `ordered`.

**Out of scope (separate plan if wanted later):** multi-target linking (one payment splits across multiple materials/outfits), `Supplier.amountAgreed` vs payment-actual reconciliation, BookOutfitItem-level granularity beyond what's already there, reverse-link UI on BUILD/outfit cards showing "paid £X of £Y estimated", queued upload flow at create-time (requires `createPayment` to return the id).

### 2026-05-07 · v1.74.0 — Inline payment add + inline supplier create

User feedback: opening a modal for every payment was too slow when entering a stack of receipts.

**Inline quick-add (`InlineAddPaymentRow.tsx`).** Three fields visible above the payments table at all times: description, amount, optional supplier. Pressing **Enter** in any of them submits — on success the inputs clear and focus returns to the description so the next payment can be typed immediately. Defaults: status=DUE, no due date, no method, no notes. Filling in those secondary fields happens via PaymentRow's existing edit mode.

**Inline supplier create.** The supplier `<select>` now ends with a `+ New supplier…` option. Choosing it expands a sub-form (name + category, category defaults to "Other"). Pressing Enter on either field calls a new `createSupplierQuick({ name, category })` server action that returns the created id; the dropdown gets the new supplier prepended locally so the user can finish the payment-add operation without waiting for revalidation. Auth + audit + Zod validation match the existing `createSupplier`. The existing `/suppliers` page-level modal is unaffected — it still uses `createSupplier` (form-action, returns void).

**Removed.** `AddPaymentToggle.tsx` deleted; `AddNewModal` no longer mounts on `/payments`.

### 2026-05-07 · v1.73.0 — Songs page redesign

User flagged that `/songs` didn't match the prototype design dock. Three additive changes bring it in line without rewriting the existing playlist-edit machinery (`PlaylistCard` keeps its full functionality — sync to Spotify, add/move/delete songs, block-list styling).

**Summary card grid (`SongsSummaryCards.tsx`).** Top of the page, one card per playlist showing name (uppercase, category-coloured) · song count (display font, big) · description. Cards are `<a href="#playlist-<id>">` so clicking smooth-scrolls to that playlist's section below. Category-to-accent map covers the seven seeded categories (BRIDAL_PREP / CEREMONY / DRINKS_RECEPTION / WEDDING_BREAKFAST / FIRST_DANCE / MUST_PLAY / DO_NOT_PLAY) and falls back to moss for any new category added later.

**Spotify connection banner (`SpotifyConnectionBanner.tsx`).** Green gradient strip below the cards. Visible only when `isSpotifyConfigured()` is true AND at least one playlist exists. Shows "Spotify connected · N playlists", a sync timestamp computed from the most recent `lastSyncedAt` across all playlists ("last synced 2m ago"), and a chip per playlist anchor-linking to it.

**Subtitle reformatted.** From `"X playlists · Y curated songs"` to the prototype's `"X on the playlist · Y blocked · ~Hh Mm runtime"`. Runtime estimate uses the prototype's 3.5 min/track heuristic. Block-list songs split out from "on the playlist" so the do-not-play count gets its own billing. Guest-request count stays as a tail bit when present.

**Edge-to-edge container.** Dropped `max-w-4xl` so the cards have room to breathe — matches `/tasks` and `/guests`.

**Anchor target on playlists.** `PlaylistCard` gains `id="playlist-<id>"` + `scroll-mt-4` so the summary cards / banner chips land with breathing room from the page top.

### 2026-05-02 · v1.72.3 — Drop /guests table border

Strip the `border border-border-soft rounded-sm bg-surface` wrapper from the table container so the rows sit directly on the page background — same treatment as `/tasks`. Row dividers + the muted household subheader bands carry the structure on their own.

### 2026-05-02 · v1.72.2 — Always show household subheader

User-reported visual ambiguity: solo-household guests (Barry Scott, Gianmarco Schiaffonati) looked like members of the previous household because v1.72.0 only rendered the muted "household name" row when `guests.length > 1`. Result: anyone solo blended into whichever household happened to render above them.

Fix: always render the subheader row, single-member households included. Solo rows still drop the `pl-7` indentation so they don't sit awkwardly nested under their own label.

### 2026-05-02 · v1.72.1 — Guests width + linked-tasks strip polish

Two visual fixes after v1.72.0 landed.

**Guests goes edge-to-edge.** v1.72.0 widened the container from `max-w-5xl` to `max-w-7xl` to give the new table room. On wide screens it still left a margin and looked narrower than `/tasks` — which uses no max-width at all. Dropped the constraint entirely; the inner div is now just `p-4 sm:p-6`. Matches the Tasks page exactly.

**Linked-tasks strip is now flush.** The old `mx-auto max-w-5xl rounded-md shadow-sm` styling rendered as a small floating card centered in the now-wider page area. Reshaped to a full-width horizontal banner (`bg-surface border-b border-border-soft px-4 sm:px-6`), borrowing the visual treatment from the supplier-filter banner on `/tasks`. Empty state ("No linked tasks yet.") collapses into the header row inline rather than a separate body paragraph; populated state renders the rows below with a thin top border. Row padding bumped to `px-4 sm:px-6` so list items align with the page's edge padding. Affects every consumer (/songs, /seating/ceremony, /guests).

### 2026-05-02 · v1.72.0 — Guests page redesign (flat table)

The `/guests` page rendered a stack of `HouseholdBlock` cards (v1.17.0 design) — heavy on functionality (inline edit / RSVP toggle / per-row group control / household drawers) but visually divergent from the `prototype/GuestsPage.jsx` design dock. The user flagged the gap; this release closes it.

**New layout.** `GuestList.tsx` body replaced wholesale. Tag-filter pills along the top (driven by `allGroups` — Immediate Family, Extended Family, Wedding party, Friend, Bryony's side, Jamie's side as currently seeded). Compact search input below. Then a single bordered `<table>` with columns `Name · Table · RSVP · Type · Tags · Dietary`. When a household has 2+ members, a muted-background row precedes the members showing the household name; child rows are indented `pl-7`. Plus-one rows (parentGuestId set) carry the marigold `+1` badge from the prototype. Each row is a `<Link href="/guests/[id]">` so the detail page (which already has full edit functionality) handles the drill-down — replaces the previous inline editing.

**Subtitle.** Page header now reads `"X confirmed · Y pending · Z total"` instead of the old four-bucket `"X invited · Y attending · Z pending · W declined"` — matches the prototype's information density.

**Container.** Widened from `max-w-5xl` to `max-w-7xl` to give the table room to breathe.

**Removed.** `HouseholdBlock.tsx` deleted — its only import site was the previous `GuestList`. The previous filter UI (Sort / RSVP / Side / Show selects + save-as-default) also dropped; tag pills + search cover the common case. If the heavier filter flow turns out to be missed, easy to add back as a popover.

### 2026-05-02 · v1.71.0 — Inline task add everywhere + website links on item cards

Two quality-of-life features shipped together.

**Task add + inline toggle (all locations)**

`LinkedTasksPanel` (section-level) and `CardLinkedTasksPanel` (per-card, inside `CardRouter`) both gain a `+ Task` button — `AddTaskToggle` with `defaultBookSectionIds` / `defaultBookSubsectionIds` pre-filled so new tasks are linked in one click. The three `PageLinkedTasksStrip` instances on /songs, /guests, and /seating/ceremony gain the same button via `defaultNavTagIds`. Panels that had no tasks are now shown anyway when `canEdit=true` so the button is always reachable for editors.

Task rows are now interactive: each row renders a checkbox button that optimistically toggles `status` OPEN↔DONE (`useState` + `useTransition` → `setTaskStatus`). `setTaskStatus` gains `revalidatePath("/book", "layout")`, `/guests`, `/songs`, and `/seating/ceremony` so the revalidation covers all surfaces.

`PageLinkedTasksStrip` was a server component — to avoid adding `"use client"` to it directly, the interactive rows were extracted into a new `PageLinkedTasksRows.tsx` client component; `AddTaskToggle` (already a client component) is imported directly.

`UserOpt` was imported-not-re-exported from `AddTaskToggle.tsx`; fixed with `export type { UserOpt }`. `CardRouter.tsx`'s `Sub` type updated to include `website: string | null` in all four item-array shapes.

**Website links on item cards**

New optional `website String?` column on four models: `BookOutfit`, `BookBuildMaterial`, `BookBarItem`, `BookSetupItem`. Migration `20260510000000_website_on_items` adds the column to all four tables (additive). Zod `saveOutfitCard` / `saveBuildCard` / `saveBarCard` / `saveSetupCard` schemas updated; server actions thread the value through to `upsert`.

Edit mode: each item edit row gains a `type="url"` input labelled "Website". View mode: a small "Link ↗" anchor (`target="_blank" rel="noopener noreferrer"`) appears next to the supplier/source text when `website` is non-null. `BookLodgingItem` already had `website` from v1.36.0.

### 2026-05-02 · v1.70.0 — Ceremony deduplication + household clustering + reception seat drag-swap

Three seating improvements requested in one pass.

**Ceremony allocator rewrite.** `src/lib/ceremony-allocate.ts` — `GroupLite.members` now accepts `GuestMember[]` (fields: `id, householdId, isChild`) replacing the old `memberCount: number`. `GroupAllocation` gains `uniqueCount` and `duplicateCount`; `AllocationResult` gains `duplicateGuests`.

- **Deduplication.** `seenGuestIds: Set<string>` accumulates across groups sorted by `order`. For each group, `uniqueMembers = members.filter(m => !seenGuestIds.has(m.id))`. A guest in two groups is allocated only to the lower-`order` group; the later group records `duplicateCount` but does not fill a seat for that guest.
- **Household clustering.** `clusterByHousehold()` groups members by `householdId` (preserving order of first appearance); singletons each get a unique key. Clusters are passed to `fillSingleSide()` for BRIDE/GROOM groups, or flattened in order for BOTH groups. Result: all members of the same household sit adjacently.
- **Row-no-split heuristic.** Inside `fillSingleSide()`: if a multi-member household cluster won't fit in the remaining seats of the current row but does fit in a full row (`size > remainingInRow && size <= seatsPerRow && posInRow > 0`), the cursor advances to the next row start. The skipped seats remain unfilled and contribute to `unfilledLeft/Right`. Does not apply to BOTH groups (they span sides).

`ceremony/page.tsx` query updated: `_count: { select: { members: true } }` → `members: { select: { id, householdId, isChild } }`.

`CeremonyClient.tsx` — duplicate-guest warning banner (orange, dismissible) appears when `result.duplicateGuests > 0`. Per-group allocation breakdown shows `(N↑)` chip for duplicates; `hasIssue` flag activates when `shortfall > 0 || dupes > 0`. Legend title area gains `<>` fragment wrapper.

**Reception drag-to-reorder seats.** `TableCard.tsx` — added `draggingSeatId` + `overSeatId` state. Each seat `<li>` handles `onDragEnter` / `onDragOver` / `onDrop`; drag handle `<span draggable>` uses ⣿ glyph with `cursor-grab`. Visual feedback: dragging seat fades (`opacity-40`), drop target gets `bg-moss-50 ring-1 ring-inset ring-moss-400`. `swapSeats(seatId1, seatId2)` server action in `actions.ts`: loads both seats, validates same table, then runs a `$transaction` that nulls both guests, then re-assigns swapped — the two-step pattern satisfies the unique constraint on `Guest.tableSeatId`. Audit log records table name, both seat indices, and both guest IDs.

Test coverage: `tests/unit/ceremony-allocate.test.ts` — 8 new test cases across two new suites ("deduplication" + "household clustering"). `makeGroup()` / `makeMembers()` helpers updated with an `idPrefix` parameter so members from different groups never share IDs (which would spuriously trigger deduplication). Total unit tests: 564.

### 2026-05-02 · v1.69.0 — DB-backed invite system + welcome sign-out + couple label fix

User request: "add an invite option to the page, move from env, to explicit invite and whitelist in admin settings, where I can also set perms at time of invite. Also fix the cosmetic issue thats a bug, she should show 'couple'". Context: Bryony had been added via `AUTH_ALLOWED_EMAILS` (two-line ENV bug was also fixed in this session) and the Members panel was showing "wedding party" for her because the label code read `u.role.replace("_"," ").toLowerCase()` without checking `isCouple` first.

**Invite system.** New `Invite` model in `prisma/schema.prisma` (`id, email, role, isCouple, status: PENDING|ACCEPTED|REVOKED, invitedById, acceptedAt, createdAt, updatedAt`). Migration at `prisma/migrations/20260509000000_add_invite_model/migration.sql` (hand-authored — `prisma migrate dev` is blocked in this repo). Prisma client regenerated (`npx prisma generate`).

`auth.ts` — `isAllowed()` promoted from sync ENV-scan to async DB check:
1. Returning user with `emailVerified` → allow (prevents locked-out re-auth).
2. PENDING invite for that email → allow.
3. ENV `AUTH_ALLOWED_EMAILS` CSV → bootstrap fallback (couples can still sign in even if they forget to create an invite for themselves).

`events.signIn` in `auth.ts` — after the User row is guaranteed to exist, applies any matching PENDING invite (`role`, `isCouple`) to the user record and marks the invite ACCEPTED. This is how invite-time role assignment reaches the DB without a separate admin step.

`src/app/(app)/settings/invite-actions.ts` — three new server actions, all `requireCouple()`-gated:
- `createInvite` — validates email + role + isCouple, rejects if user already has an account (they should be edited in the Members panel instead), upserts the invite (reopens a REVOKED invite if the email matches), sends invite email, audit logs.
- `revokeInvite` — marks PENDING → REVOKED.
- `resendInvite` — resends the invite email without touching the record.

`sendInviteEmail()` — private helper. Logs to console in dev (no `EMAIL_SERVER_HOST`). In production sends a styled HTML + plaintext invite email via Nodemailer, personalised with the inviter's first name and wedding date/couple names from `getWeddingSettings()`. Sign-in URL links to `/signin`.

`src/app/(app)/settings/InviteBlock.tsx` — new client component. Email input + role dropdown (Viewer / Wedding party / Planner / Couple). Selecting Couple forces `isCouple: true` and shows a warning ("Couple-tier gives full edit access to every section including budget and payments"). Pending invites list below with Resend and Revoke buttons. Fully `useTransition`-driven.

`src/app/(app)/settings/page.tsx` — fetches `db.invite.findMany(...)` in the existing parallel query block; replaces the old AUTH_ALLOWED_EMAILS info box with `<InviteBlock>`.

`src/lib/actions.ts` — added `requireCouple()` (returns SessionUser or throws "Forbidden").

**Welcome sign-out.** New users who have never set a `firstName`/`name` are redirected by `(app)/layout.tsx` to `/welcome` — a page outside the AppShell that had no sign-out affordance. If a user signs in but can't complete the welcome form (wrong account, etc.), they were trapped. Fixed by adding a `signOutAction` server action to `src/app/welcome/page.tsx` and a sibling `<form action={signOutAction}>` with a "Sign out" link in `WelcomeForm.tsx`. Outer container changed from `<form>` to `<div>` to avoid nested form HTML.

**Couple label fix.** `src/app/(app)/settings/MemberOverridesBlock.tsx` — two display sites were showing `u.role.replace("_", " ").toLowerCase()` without checking `isCouple`. Both now show `u.isCouple ? "couple" : u.role.replace("_", " ").toLowerCase()`. Same fix already present in `InviteBlock.tsx`'s pending invite list.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅.

---

### 2026-05-02 · v1.68.0 — design-pass brief

User: "promote then prep for claude design pass" → "I want whimsical forest" → "A base theme and a whimsical forest theme, both should have light and dark modes". Final piece of pre-2.0 prep work. Docs-only ship.

**The brief.** New `docs/DESIGN-PASS-BRIEF.md` is the entry point for whoever does the design pass (Claude, in this case, in a separate session). Captures:

- **Audience** — five admin users, admin-only standing rule, no public surfaces.
- **The two themes.** This is the central direction-setter — user has explicitly asked for **Base** (the current moss/marigold/canvas polished, editorial / restrained) and **Whimsical Forest** (deeper greens, mossy browns, soft golds, hand-drawn / woodcut illustration personality, fairy-tale not gothic). Each with light + dark modes = four combinations. Themes share component contracts (Button / Input / Modal / etc.); they reskin via tokens + illustration. A user toggling between them should feel like "walking from a study into a glade".
- **Theme architecture** — recommended `data-theme="base|forest"` attribute on `<html>` cascading CSS variables, paired with the existing `html.dark` mechanism. New `User.theme` enum column for persistence (the single schema change v2.0 is allowed). Theme picker in Settings next to the existing dark-mode toggle. Day-of-mode allowed as a one-page override (Forest even when user has Base selected — it's the "magical bit" surface).
- **Goals** — cohesive design language, mobile refinement, density review (Base stays dense for planning surfaces, Forest relaxes), dark-mode parity, print fidelity (print pins to clean black-on-white regardless of theme).
- **Non-goals** — no feature changes, no server-action changes, no third theme (resist scope creep), no public-facing surfaces.
- **Constraints** — WCAG AA contrast, focus rings everywhere, prefers-reduced-motion gate on animations, 40px minimum touch targets on destructive confirms, dark mode parity for every new token, print stylesheet still works.
- **Materials** — links to `COMPONENT-INVENTORY.md`, `FORM-PATTERNS.md`, `MOBILE.md`, `ROADMAP.md`, `CLAUDE.md`. The brief is the entry point; the others are reference.
- **Token reference** — current Base tokens listed in detail (palette, type, radius, shadow). Both themes share structural tokens (radius tiers, shadow tiers, font fallback chain); palette + type-scale tweaks differ.
- **Page list** — all 23 pages with one-line description + density rating, so the designer can plan coverage.
- **Pain points** — settings page density, visual-identity flatness (the central reason for the Forest theme), today-page snapshot strip, empty-state convention validation, illustration richness, day-of mode visual identity.
- **What "done" looks like** — green gate, both themes × both modes × all 23 pages × 320/768/1280 viewports = 276 visual states verified, all 11 reusable primitives touched, theme picker works, ROADMAP entry, no schema changes beyond `User.theme`.
- **Practical handoff** — running the dev server, the gate, branching, what the user expects to do.
- **Out of scope** for v2.0; revisit post-wedding (public RSVP form, guest portal, multi-tenant, i18n, native app, major architectural rewrites).
- **After the design pass** — Phase C continues (DR-2 backup drill, DR-3 day-of rehearsal, DR-4 print review, DR-5 offline mode, DR-6 wedding-day freeze, DR-7 DMARC).

The doc is ~280 lines; comprehensive enough to brief a fresh-context designer without further conversation, sparse enough not to over-prescribe.

**Next ship is v2.0.0** — the design pass itself. v1.68.0 is the last v1.x release. Future v1.6x patches are possible if the design pass takes multiple iterations or surfaces issues that need to land in the current Base before the Forest theme arrives, but the next major direction is the visual refresh.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅. (No code changes, but ran the gate as a hygiene check.)

Files: `docs/DESIGN-PASS-BRIEF.md` (new), `package.json` → `1.68.0`.

---

### 2026-05-02 · v1.67.0 — guest profile pictures

User: "Is it possible to link guests with facebook profile pictures?" → "Lets try it" (after the explanation of why Facebook auto-link doesn't work and manual upload is the better path).

**Why not Facebook.** Meta's Graph API locked down profile-picture access post-2018: requires OAuth from the guest themselves (we'd need each guest to "Continue with Facebook" — violates the admin-only standing rule), Meta app review for any read permission, GDPR friction for storing identifying photos pulled without consent, and Facebook profile-picture URLs aren't stable over time. The clean path is manual upload, curated by the couple.

**The feature.** Each guest can have one profile picture. Falls back to the existing initials-in-coloured-circle Avatar when not set. Photos appear on:

- **Guest list** — 32px avatar on each row in HouseholdBlock.
- **Guest detail page** — 96px avatar at the top, doubles as the upload trigger (tap-the-photo pattern, same as every social-network profile editor). Camera-icon overlay cues interactivity; always visible on touch, hover-only on desktop.
- **Seating side panel** — 40px avatar (was 32px initials) when the planner clicks a seat dot.

**Skipped surfaces** (with rationale):
- **Seating canvas seat dots** — at the canvas's typical zoom level dots are 8-16px tall; rendering thumbnails there is illegible noise. Better signal lives in colour-coded RSVP and group-tinted rows.
- **Catering brief print** — printed photos at small sizes don't help the venue coordinator more than names. Rejected on cost-benefit.
- **Day-of contacts** — those are *suppliers*, not guests. Different model.
- **Schedule attendees** — too dense; the avatars would crowd the timeline.

**Schema.**

```prisma
model Guest {
  …
  profilePictureFileId String?
  profilePicture       File?   @relation("GuestProfilePicture", fields: [profilePictureFileId], references: [id], onDelete: SetNull)

  @@index([profilePictureFileId])
}
model File {
  …
  guestProfileFor Guest[] @relation("GuestProfilePicture")
}
```

`SetNull` on file delete so a `/files` cleanup doesn't cascade-delete the guest; the guest just falls back to the initials placeholder. Named relation (`GuestProfilePicture`) leaves room for future File→Guest links (attached scans for ID verification, etc.) without ambiguity.

**Migration** `prisma/migrations/20260508000000_guest_profile_picture/migration.sql`. Single `ALTER TABLE ADD COLUMN` + FK + index. Purely additive.

**Server actions** in `src/app/(app)/guests/actions.ts`:

- `uploadGuestProfilePicture(guestId, formData)` — one-step camera-roll upload + link. Reuses the disk-write + DB-insert pattern from `/files/actions.ts` via a local helper. Roll-back on DB failure (unlinks the disk write). Validates that the MIME is `image/*` (in addition to the global allowlist).
- `setGuestProfilePicture(guestId, fileId)` — link a pre-uploaded File. Validates the file is image MIME. Idempotent (returns ok if already linked).
- `clearGuestProfilePicture(guestId)` — unlink. The File row stays on `/files`; only the FK is cleared. Idempotent.

All three: `requireEdit("guests")` gate, result-shape `{ ok, error }` returns, enriched audit metadata (`guestName`, `fileId`, `fileName`, `replacedFileId` when overwriting an existing photo).

**`<Avatar>` extension.** The component gains an optional `pictureFileId` prop. When set, renders `<img src="/api/files/<id>" loading="lazy" object-cover>` at the same size as the initials fallback. When null/undefined, renders the v1.0 initials-in-coloured-circle. No detection of failed loads — broken-image state is rare (SetNull cascade keeps it from happening at all in normal flow).

**Upload UI** (`src/app/(app)/guests/[id]/GuestPhotoUpload.tsx`):

- The avatar IS the primary upload trigger. Click / tap → hidden `<input type="file" accept="image/*">`. Camera-icon overlay (📷) cues interactivity at the bottom-right corner.
- Secondary text button "+ Upload photo" / "Change photo" for keyboard users + discoverability.
- "Remove photo" link clears with a ConfirmDialog (the file row stays on /files; the body of the confirm explains this).
- Read-only when `canEdit` is false — no upload affordance, just the avatar.

**Wiring details.**
- `/guests/[id]/page.tsx` — added `<GuestPhotoUpload>` next to the RSVP pill in the status row.
- `HouseholdBlock.tsx` — `Avatar` rendered on each guest row (skipped on +1 indented rows to avoid double-circle clutter). New `profilePictureFileId` field on the local `Guest` type.
- `GuestDetailPanel.tsx` (seating side panel) — bumped Avatar from 32 → 40px and added the picture prop.
- `seating/page.tsx` — added `profilePictureFileId: true` to the `db.guest.findMany` select; threaded through `allGuestsForClient`.
- `SeatingClient.tsx` — `AllGuest` type gains the optional field.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅. (Render-driven UI; no new tests. Real-conditions verification is the user uploading a guest's photo and confirming it appears across the three render sites.)

**Pre-2.0 plan progress post-v1.67.0:**
- Phase A complete.
- Phase C: ✅ DR-1 (v1.66.0); the profile-pictures feature is a Phase-C-adjacent quality-of-life win (not on the original DR list but contributes to day-of usability).

Files: `prisma/schema.prisma`, `prisma/migrations/20260508000000_guest_profile_picture/migration.sql` (new), `src/components/ui/Avatar.tsx` (extended), `src/app/(app)/guests/actions.ts` (3 new actions + helper), `src/app/(app)/guests/[id]/GuestPhotoUpload.tsx` (new), `src/app/(app)/guests/[id]/page.tsx` (wiring + sibling-guest select extension), `src/app/(app)/guests/HouseholdBlock.tsx` (Avatar render on rows), `src/app/(app)/seating/GuestDetailPanel.tsx` (avatar size + photo), `src/app/(app)/seating/page.tsx` (select extension), `src/app/(app)/seating/SeatingClient.tsx` (type extension), `package.json` → `1.67.0`.

---

### 2026-05-02 · v1.66.0 — mobile compatibility pass (DR-1)

User: "Lets do the mobile pass". First phase of Phase C (day-of readiness arc). Audit-driven sweep — without a real phone in hand, this is code review for known mobile-breakage patterns plus convention-codification for future work. Real-conditions testing (DR-3) is still TBD.

**The convention doc.** New `docs/MOBILE.md` codifies breakpoint (640px / Tailwind `sm:`), fixed-bottom-element rules (must clear the 56px tabbar), touch-target sizing, table conventions, drag-drop fallbacks, modal+drawer patterns, page-specific notes. Every fix shipped here pairs with a section in the doc so future maintainers see why and what.

**Five real bugs caught + fixed.**

1. **`<Toaster>` sat behind the MobileTabBar.** The toast wrapper was at `z-[100]` with `p-4` (16px from bottom). The tabbar is at `z-[200]` (higher) and 56px tall — toasts on mobile were visually hidden. Fixed: wrapper now `z-[250]` + `pb-20 sm:pb-4` so toasts clear the tabbar with breathing room.
2. **`<QuickCapture>` success toast same problem.** The "✓ Task added" pill at `bottom-6` (24px) was inside the tabbar zone. Bumped to `bottom-20 sm:bottom-6`.
3. **Three tables lacked `overflow-x-auto` wrappers.** `BookBuildCard` materials (7 cols), `guests/catering` per-table breakdown (6 cols), dietary + meal-choice tables (2 cols). On mobile these triggered horizontal page-scroll instead of table-only scroll. Wrapped each. The 7- and 6-col ones got `min-w-[560/640px]` so they stay readable instead of squashing.
4. **`<SeatingCanvas>` unusable on touch.** SVG drag-drop conflicts with page scroll, no pinch-zoom, dense layout doesn't fit a 360px viewport. Fix: `<SeatingClient>` defaults to **list view** on first visit when `window.innerWidth < 640`. User's saved-view preference still wins so they can opt back into canvas explicitly.
5. **Touch targets too small.** ConfirmDialog buttons were 28px (`text-xs py-1.5`) — destructive confirms shouldn't require precision aim. Bumped to 40px (`text-sm py-2.5 min-h-[40px]`). AddNewModal close × was ~16px — bumped to 36px (`w-9 h-9`). ImageGallery detach × was 24px hover-only — bumped to 32px and always-visible on touch (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`).

**Padding sweep.** 18 page-level `mx-auto p-6` wrappers converted to `mx-auto p-4 sm:p-6`. On a 320-414px phone, the 24px-each-side padding was wasting ~15% of horizontal space; reducing to 16px on mobile gives content more breathing room without affecting the desktop layout.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅. (No new tests — the changes are visual / responsive-class adjustments. Real-conditions testing is the right verification path; DR-3 will cover that.)

**Pre-2.0 plan progress post-v1.66.0:**
- Phase A complete (DP-1 through DP-7).
- Phase C kickoff: ✅ DR-1 (this ship).
- Open: DR-2 (backup + restore drill), DR-3 (day-of-mode rehearsal on real phone), DR-4 (print stylesheets review), DR-5 (offline mode), DR-6 (wedding-day freeze procedure), DR-7 (DMARC follow-ups).

DR-3 is the next high-value item — it's the user actually picking up their phone and walking through `/today/day-of` as if it's the morning of. That'll catch what an audit can't.

Files: `docs/MOBILE.md` (new), `src/components/ui/Toaster.tsx`, `src/components/shell/QuickCapture.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/AddNewModal.tsx`, `src/components/ui/ImageGallery.tsx`, `src/app/(app)/seating/SeatingClient.tsx`, `src/app/(app)/book/[slug]/BookBuildCard.tsx`, `src/app/(app)/guests/catering/page.tsx`, plus 18 page-level padding conversions across `src/app/(app)/{book,budget,diy,files,glance,guests,page,payments,questions,seating,settings,songs,suppliers,tasks}`. `package.json` → `1.66.0`.

---

### 2026-05-02 · v1.65.0 — DP-4 form patterns + DP-6 seed cleanup

User: "DP4" → "Wait should I defer dp4" → "Lets do dp6". Settled on DP-4-as-doc-only (no code migrations) + DP-6 (seed cleanup) batched as one ship.

**DP-4 — form-pattern audit.** New `docs/FORM-PATTERNS.md` codifies three legitimate form patterns + one deprecated hybrid:

- **Pattern A — uncontrolled + form action.** Simple forms (5-10 fields, no conditional UI). `defaultValue` everywhere, dirty-check via form-level `onChange={() => setDirty(true)}`. Used by SupplierForm, GuestForm, PaymentForm, WeddingSettingsPanel.
- **Pattern B — controlled per field.** Edit drawers / dense panels with conditional UI, live preview. One `useState` per field, dirty derived from comparing each state to original. Used by TaskDrawer, MyProfilePanel, AnswerForm.
- **Pattern D — single draft state.** Edit ↔ View card editors. One `useState` for the whole draft object; cancel restores via `buildDraft(card)`. Used by every Wedding Book card kind (BookBuildCard, BookSetupCard, BookOutfitCard, BookMenuCard, BookBarCard, BookLegalCard, BookStayCard, BookLodgingCard, BookFieldsCard, BookShotListCard, BookRecipeCard).
- **Pattern C — hybrid (DEPRECATED).** Some fields controlled, others uncontrolled, manual setDirty plumbing. The one current example is `EventForm.tsx` (allDay + attendeeRefs controlled, rest uncontrolled). Migration plan: convert to Pattern B when next touched for a feature; not as a standalone refactor.

The doc includes a decision tree, full example shapes, a list of anti-patterns, and the rationale for keeping three patterns instead of unifying. The design pass (Phase B) does NOT need to unify these — they serve different needs. The designer reskins the inputs / buttons / chrome inside whichever pattern is in use.

**No code changes** — DP-4 is doc-only this release. EventForm migration deferred to "next time it's touched". The original "defer DP-4" instinct was about the code work (designer informs the pick); the audit doc captures findings without committing to a refactor.

**DP-6 — seed cleanup.** `prisma/seed.ts` carried six legacy BookSection slugs from earlier splits:

- `wedding-party` (replaced by `wedding-party-people` + `wedding-party-dayof` in v1.35.0)
- `venue` (replaced by `venue-spaces` + `venue-decor` in v1.33.0)
- `legal-admin` (replaced by `legal-before` + `legal-day` + `legal-after` in v1.34.0)
- `ceremony` / `reception` / `logistics` (v1.4.0 legacy)

Each was preserved in the seed "in case the couple has user-added subsections under the legacy slug" — but on a fresh install there are no such subsections, so the seed was creating empty deprecated sections that cluttered every fresh DB. The `/book` index already hides empty legacy sections via the `LEGACY_SLUGS` filter (v1.38.5), so user-visible behaviour was unchanged; the seed just stops asserting them. Production DBs that already have the legacy rows keep them — the seed never deletes existing data.

**Other cleanups:**
- `seedWeddingPartySubsections()` function deleted (was already commented out from `main()` in v1.38.5; now the orphan body is gone too).
- `seedBuildCards()` legacy `venue` slug fallback dropped — `venue-decor` is the canonical target since v1.33.0 and is always seeded; the fallback was theoretical safety for a state combination that doesn't exist in practice.
- The 47-line comment block at the top of `seedBookSections()` condensed from history-archeology to the actually-canonical 12-section set.
- Order conflict fixed: both `post-wedding` and legacy `wedding-party` were at order 12; once `wedding-party` is removed, no conflict.

**Defensive code preserved:**
- `LEGACY_SLUGS` Set in `book/page.tsx` — still filters empty legacy sections from the hub for prod DBs that have them.
- `Illustrations.tsx` slug-keyed icon mapping — still maps legacy slugs to icons so prod data renders correctly.
- The `// v1.38.5: skip legacy seedWeddingPartySubsections — duplicates` comments in operator scripts — kept (they document why those scripts don't import the seeder, useful for future maintainers).

**Seed file shrinks 2718 → 2681 lines.** Modest but real.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅.

**Pre-2.0 plan progress post-v1.65.0:**
- ✅ DP-1 ConfirmDialog sweep (v1.62.0)
- ✅ DP-2 component inventory doc (v1.64.0)
- ✅ DP-3 empty-state convention (v1.64.0)
- ✅ DP-4 form-pattern audit (v1.65.0, doc-only)
- ✅ DP-5 audit-log final sweep (v1.64.0)
- ✅ DP-6 seed cleanup (v1.65.0)
- ✅ DP-7 production promotion — claude/main now at v1.63.0; v1.64.0 + v1.65.0 pending CI.

**Phase A (design-pass readiness) is complete.** Next up: DR-1 (mobile compatibility pass), targeted as v1.66.0 next session per user request.

Files: `docs/FORM-PATTERNS.md` (new), `prisma/seed.ts` (cleanup of `seedBookSections`, removal of `seedWeddingPartySubsections`, fallback removal in `seedBuildCards`, main() comment update), `package.json` → `1.65.0`.

---

### 2026-05-02 · v1.64.0 — design-pass prep batch

User: continuation of "lets do all of these" — ships DP-2, DP-3, DP-5 from the pre-2.0 plan as a single batch. DP-6 (seed cleanup) needs its own ship — `prisma/seed.ts` is 2700 lines and a meaningful sweep is its own substantial undertaking. Targeted as v1.65.0.

**DP-2 — component inventory.** New `docs/COMPONENT-INVENTORY.md` lists every reusable UI primitive in `src/components/ui/` and `src/components/shell/` — purpose, API surface, and where it's used. Six sections: layout/shell, forms/inputs, feedback/modals, navigation/page chrome, identity/decoration, domain components, plus a reverse index ("if I redesign Button, I touch X pages") and a "what the design pass should know" section covering tokens / typography / sizing / spacing / print / what-not-to-touch.

This is the design pass's required input. Without it the designer is guessing at scope; with it they reskin a small set of primitives and every page inherits.

**DP-3 — empty-state convention.** Codified in the header comment of `src/components/ui/Illustrations.tsx`. Two tiers:

- **Top-level page empties** → `<EmptyState illustration={Empty…} title=… body=… action=… />` (illustrated, encouraging). Sites: `/tasks`, `/guests`, `/schedule`, `/seating`, `/payments`.
- **Nested-section empties** → `<p className="text-xs text-ink-tertiary italic">No X yet.</p>` (terse, doesn't dominate).

The shared verb is "Add" (P1, v1.60.0). Direction word matches affordance position. The convention was already implicit; DP-3 just writes it down so future developers don't drift.

**DP-5 — audit-log final sweep.** Final pass through every `audit()` call looking for `metadata`-less ones. Found 9:

- `field-delete` (BookFieldDef removal) → `+ fieldId, fieldLabel, fieldType`
- `field-set` (BookSubsection field value) → `+ fieldId, fieldLabel, fieldType, cleared`
- `recipe-update` → `+ ingredientCount, stepCount, hasNotes`
- `shot-toggle` (capture/uncapture) → `+ shotId, shotTitle, captured`
- `shot-delete` → `+ shotId, shotTitle, captured`
- `outfit-add` → `+ personName, role, itemCount, supplier, status`
- `outfit-update` → `+ outfitId, personName, role, itemCount, supplier, status`
- `outfit-delete` → `+ outfitId, personName, role, itemCount`
- `update` on `WeddingSettings` → pre-read for `changedFields` diff + snapshot of `weddingDate` + `venue` so an audit reader sees "venue is now Alveston Manor" without re-reading the row.

The audit-log enrichment standing rule (v1.30.5) is now applied across the entire codebase. Future actions adding `audit()` calls should follow the established pattern. The audit-format unit tests (63 tests in `tests/unit/audit-format-enrichment.test.ts`) cover the rendering of these.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅.

**No schema changes.** Pure docs / convention / metadata work.

**DP plan progress post-v1.64.0:**
- ✅ DP-1 ConfirmDialog sweep (v1.62.0)
- ✅ DP-2 component inventory doc (v1.64.0)
- ✅ DP-3 empty-state convention (v1.64.0)
- open DP-4 form-pattern audit — defer until after design pass (designer informs the pick)
- ✅ DP-5 audit-log final sweep (v1.64.0)
- open DP-6 seed cleanup pass — target v1.65.0
- ✅ DP-7 production promotion — v1.61.1 + v1.62.0 promoted; v1.63.0 + v1.64.0 pending CI green

Files: `docs/COMPONENT-INVENTORY.md` (new), `src/components/ui/Illustrations.tsx` (header comment expansion), `src/app/(app)/book/actions.ts` (8 audit metadata enrichments), `src/app/(app)/settings/wedding-settings-actions.ts` (changedFields diff + snapshot), `package.json` → `1.64.0`.

---

### 2026-05-02 · v1.63.0 — image galleries on Book cards

User: "add the ability for me to be able to add and display images for certain things, the centerpieces and clothing would be a good start but consider where else images could benefit from user upload". The single biggest user-visible feature in the pre-2.0 arc.

**Why now.** OUTFIT cards have had `fileIds: String[]` since v1.35.0, but the rendering was chip-text only — `📎 dress-fitting.jpg` next to a download link, which loses the entire point of attaching a photo. v1.63.0 fixes that and extends the same pattern to BUILD (centerpieces, signage), SETUP (space layouts), and STAY (bridal suite, property shots).

**The component.** New `src/components/ui/ImageGallery.tsx` exports `<ImageGallery>` and a pure `isImageMime()` helper. Renders:

- **Image MIMEs** → square thumbnail in a 2 / 3 / 4-column grid (`<img loading="lazy">` for browser-native lazy loading + caching).
- **Non-image MIMEs** → a paperclip-glyph chip with the filename (PDFs, etc., still attach for completeness).
- **Click thumbnail** → fullscreen lightbox with the image at natural size (capped to viewport). Navigation: ← / → moves between attached images; Esc closes; backdrop click closes; the bottom caption shows "name · n of N · ← → to navigate".
- **Hover thumbnail** → × button appears in the top-right corner for detach (only when `canEdit`).

**Three add paths.** Per the user's "I just took a photo" use case:

1. **Direct upload** (file input wired to a hidden `<input accept="image/*">`). The button "+ Upload photo" triggers the file picker; on select, the parent's `onUpload` is called with the `File` — the parent's server action handles upload + attach + audit in one round-trip.
2. **Attach existing** (dropdown of `/files` rows that aren't already on this card, filtered to image MIMEs by default).
3. **Detach** (× per thumbnail).

**A11y / safety.** `role="dialog"` + `aria-modal` on the lightbox; aria-labels on every action button; cancel button focused on lightbox open; keyboard-only navigation works end-to-end.

**Schema additions.**

```prisma
model BookBuildCard {
  …
  fileIds                  String[]       @default([])
}
model BookSetupCard {
  …
  fileIds                  String[]       @default([])
}
model BookStayCard {
  …
  fileIds                  String[]       @default([])
}
```

Forward-only references (no FK array — same convention as `BookOutfitCard.fileIds` from v1.35.0). The rendering layer joins File rows at read time. File rows survive even when detached, so users can re-attach later from `/files`.

**Migration** `prisma/migrations/20260507000000_book_card_image_galleries/migration.sql`. Three additive `ALTER TABLE` statements adding `fileIds TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`. No data movement.

**Server actions.** Three new triplets per kind:
- `uploadAndAttach<Kind>File(subsectionId, formData)` — one-step upload + attach. Wraps the same disk-write + DB-insert logic from `/files/actions.ts` via a new internal helper `uploadFileForBookCard()`. Files default to `folder: "Book photos"`, `visibility: EVERYONE`. Roll-back on DB failure (unlinks the disk write).
- `attachFileTo<Kind>Card(subsectionId, fileId)` — attach a pre-uploaded File row. Idempotent.
- `detachFileFrom<Kind>Card(subsectionId, fileId)` — opposite. Idempotent.

`uploadAndAttachOutfitFile` added too — v1.35.0 had attach/detach but no upload-and-attach for OUTFIT, so the new gallery's direct-upload affordance now works there as well.

All actions: `requireEdit("book")` gate, result-shape `{ ok, error }` returns, enriched audit metadata per the v1.30.5 standing rule (`cardTitle`, `personName` / `space` / `propertyName`, `fileId`, `fileName`, `mimeType`).

**Card wiring.**
- **BUILD** — gallery renders below materials/sessions, before notes. Empty state copy: "No photos yet — upload some so everyone can see what these should look like."
- **OUTFIT** — replaces the v1.35.0 chip-only photo display entirely. The bespoke "+ Attach photo" + select dropdown collapsed into one `<ImageGallery>` call.
- **SETUP** — gallery renders below the items table, before notes.
- **STAY** — gallery renders after the linked-guests block, before notes.

**Page loader / CardRouter.** `[slug]/page.tsx` now threads `allFiles` through to `buildCard` / `setupCard` / `stayCard` (already did for `outfitCard` / `legalCard`). CardRouter's `Sub` type extended with `fileIds` + `files` on the three new card kinds. Defensive defaults updated for the legacy-row-without-card path.

**Tests.** New `tests/unit/image-gallery.test.ts` covers the pure `isImageMime` decision: common image MIMEs, non-images, prefix-matching for unknown image subtypes, case-sensitivity, empty / falsy edge cases. 5 new tests; total **557** (was 552, matches the v1.53.0 baseline before the ceremony-fill removal). Render-driven gallery behaviour would need a Playwright pass, deferred to post-design-pass.

**Verification.** typecheck ✅, lint ✅, 557 tests ✅, build ✅.

**Where else might benefit (deferred)**:
- **LODGING_GUIDE** items — hotel reference photos. Schema would need `fileIds` per item; deferred until requested.
- **Suppliers** — sample-work portfolio. Useful but adds visual weight to a list view; deferred.
- **MENU / RECIPE / BAR** — dish / cocktail / bar setup photos. Nice-to-have; deferred.
- **Tasks** — inspiration photos for "what should this look like". Could be valuable but the Wedding Book card surfaces are the primary intended visual surfaces.

Files: `src/components/ui/ImageGallery.tsx` (new), `prisma/schema.prisma` (3 fields added), `prisma/migrations/20260507000000_book_card_image_galleries/migration.sql` (new), `src/app/(app)/book/actions.ts` (10 new server actions + helper), `src/app/(app)/book/[slug]/BookBuildCard.tsx`, `src/app/(app)/book/[slug]/BookOutfitCard.tsx`, `src/app/(app)/book/[slug]/BookSetupCard.tsx`, `src/app/(app)/book/[slug]/BookStayCard.tsx`, `src/app/(app)/book/[slug]/CardRouter.tsx`, `src/app/(app)/book/[slug]/page.tsx`, `tests/unit/image-gallery.test.ts` (new), `package.json` → `1.63.0`.

---

### 2026-05-02 · v1.62.0 — confirm dialog sweep

User: "And do the confirm dialog sweeps". Replaces all 40 native `confirm()` calls across 29 files with a single shared in-app dialog. The single biggest pre-design-pass cleanup — designer now redesigns one dialog instead of 40 individual native ones. Originally tracked as P2 in the v1.52.1 review punch list (partially addressed in v1.60.0 for SupplierCard); now done properly across the codebase.

**The component.** New `src/components/ui/ConfirmDialog.tsx` exports a `<ConfirmProvider>` (mounted at AppShell level) and a `useConfirm()` hook. The hook returns a function with the shape `confirm(opts) => Promise<boolean>` — mirrors the native call shape so the sweep was mechanical:

```ts
// Old:
function onDelete() {
  if (!confirm(`Delete "${x}"?`)) return;
  startTransition(...);
}

// New:
const confirm = useConfirm();
async function onDelete() {
  if (!(await confirm({ title: `Delete "${x}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
  startTransition(...);
}
```

**Options.**
- `title` (required) — heading.
- `body` — optional `ReactNode`. Callers can render structured content (SupplierCard's snapshot fields now render as a `<dl>` definition list instead of `\n`-joined plaintext; the guest-import preview renders multi-paragraph context).
- `confirmLabel` / `cancelLabel` — defaults "Confirm" / "Cancel".
- `tone` — `"default"` (moss) or `"danger"` (red). Most deletes use `tone: "danger"`.

**A11y / safety details.**
- `role="alertdialog" aria-modal="true"` on the panel.
- Esc cancels (listener mounted only while dialog is open).
- Backdrop click cancels.
- Cancel button focused on open — safer default for destructive actions; a stray Enter shouldn't trigger Confirm.
- z-index 500 (above modal content at 400).

**Dialog state.** The provider holds an `opts | null` state; the pending resolver lives in a ref so it doesn't trigger re-renders. If a previous dialog is still open when a new `confirm()` call comes in (shouldn't happen in normal flow but defensive), the previous resolver gets called with `false` before the new dialog shows.

**The sweep — 40 calls across 29 files.** Every native `confirm()` converted to use the hook. Notable conversions:

- **SupplierCard** — v1.60.0's `lines.join("\n")` snapshot turned into a proper `<dl>` definition list rendered in the body.
- **HouseholdBlock** — two confirm paths (with/without guests) collapsed into a single confirm with conditional body.
- **MemberOverridesBlock** — three dialogs (clearAll / toggleCouple / remove) all converted; remove dialog with conditional last-couple consequence in the body.
- **PlaylistCard** — three dialogs (delete playlist, remove song, sync from Spotify) — sync dialog gets per-section body construction.
- **TaskImportClient / guests/import/ImportClient** — the multi-paragraph "what will happen" preview.
- **CourseEditCard** in BookMenuCard — was the only `if (confirm(...)) {...}` (positive form) — converted to `await` + then-branch.

All sites use `tone: "danger"` for destructive actions; non-destructive flows (sync, attach, detach, mark-couple-grant) use `tone: "default"`.

**Verification.** typecheck ✅, lint ✅, 552 tests ✅, build ✅.

**No new tests.** The hook + provider is exercised in real-world use across 40 sites; a unit test would mock the entire provider machinery without testing real behaviour. Worth a Playwright pass post-design-pass when the visual is finalised.

**Punch-list status post-v1.62.0:** unchanged — already 40/40 closed at v1.61.0. P2 (the punch-list item that flagged native confirm inconsistency) is now substantively retired by virtue of the entire pattern being replaced.

Files: `src/components/ui/ConfirmDialog.tsx` (new), `src/components/shell/AppShell.tsx` (mount provider), and conversions in 29 files: `src/app/(app)/files/FilesClient.tsx`, `src/app/(app)/budget/BudgetClient.tsx`, `src/app/(app)/questions/QuestionsClient.tsx`, `src/app/(app)/payments/PaymentRow.tsx`, `src/app/(app)/schedule/EventNode.tsx`, `src/app/(app)/schedule/ScheduleTable.tsx`, `src/app/(app)/book/[slug]/BookBuildCard.tsx`, `src/app/(app)/book/[slug]/BookMenuCard.tsx`, `src/app/(app)/book/[slug]/BookOutfitCard.tsx`, `src/app/(app)/book/[slug]/BookShotListCard.tsx`, `src/app/(app)/book/[slug]/BookFieldsCard.tsx`, `src/app/(app)/book/[slug]/BookLegalCard.tsx`, `src/app/(app)/book/[slug]/CardChrome.tsx`, `src/app/(app)/book/[slug]/SubsectionEditor.tsx`, `src/app/(app)/guests/HouseholdBlock.tsx`, `src/app/(app)/guests/[id]/GuestDetailClient.tsx`, `src/app/(app)/guests/import/ImportClient.tsx`, `src/app/(app)/songs/PlaylistCard.tsx`, `src/app/(app)/seating/SeatingCanvas.tsx`, `src/app/(app)/seating/TableCard.tsx`, `src/app/(app)/settings/CustomFieldsPanel.tsx`, `src/app/(app)/settings/GuestGroupsBlock.tsx`, `src/app/(app)/settings/MemberOverridesBlock.tsx`, `src/app/(app)/settings/NavTagsBlock.tsx`, `src/app/(app)/settings/PermissionGroupsBlock.tsx`, `src/app/(app)/suppliers/SupplierCard.tsx`, `src/app/(app)/suppliers/[id]/SupplierDetailClient.tsx`, `src/app/(app)/tasks/TaskDrawer.tsx`, `src/app/(app)/tasks/import/TaskImportClient.tsx`, `package.json` → `1.62.0`.

---

### 2026-05-02 · v1.61.1 — task-topics parser bug + coverage

User: "Lets fix all the bugs". This session's daily 09:17 bug-check fired and flagged two real issues from v1.61.0. Both shipped here as a 30-minute follow-up.

**Bug #1 — silent no-op when clearing all topic chips.** The drawer / form Topics picker emits one `<input name="topicKeys">` per selected chip. The server uses `formData.has("topicKeys")` as the "user touched topics at all" signal — true means apply the m2m `set:` ops, false means partial update, leave existing relations alone. Pre-fix, if the user opened a task with two book-section chips, removed both, and saved, **zero `topicKeys` entries got emitted** → `hasTopicKeys === false` on the server → the `set: []` operation that should have cleared the relation got skipped → the chips reappeared on next render. Same flaw existed for sections / subsections / nav-tags pre-v1.61.0, but in practice was masked because at least one of the four groups was usually non-empty. v1.61.0 (XL1) made the four-empty case more reachable by adding a fourth group, so the bug surfaced now.

**Fix.** A `__touched__` sentinel hidden input emitted by `TopicPicker` whenever it renders in editable mode, plus a matching manual `fd.append("topicKeys", "__touched__")` in `TaskDrawer.save()`. The sentinel doesn't match any of the four parser prefixes (`bookSection:` / `bookSubsection:` / `navTag:` / `guestGroup:`) so it's silently dropped — no array pollution. Documented in both files; constant exported from `@/lib/task-topics` as `TOPIC_TOUCHED_SENTINEL`.

**Bug #2 — missing test coverage on `parseTopicKeys`.** v1.61.0 added the `guestGroup:` parser branch with no test. Bug-check audit flagged this as a "tests grow with code" violation.

**Fix.** Extracted `parseTopicKeys` from `src/app/(app)/tasks/actions.ts` (which is `"use server"`, so non-action exports get rejected) to a new pure module `src/lib/task-topics.ts`. The action file imports the same function — no behaviour change at the call site. Added `tests/unit/task-topics.test.ts` covering:

- `hasTopicKeys=false` when no field present
- `hasTopicKeys=true` when only the sentinel is present (the v1.61.1 explicit-empty-clear path)
- Each of the four prefixes individually
- Mixed payload across all four
- Unknown / stray / empty values silently dropped (forward-compat)
- Duplicate IDs preserved (caller's job to dedupe; Prisma `set:` is idempotent)
- Colon-in-value handling (defensive — `slice(prefix.length)` keeps everything after the first separator)

10 new tests; total **552** (was 542).

**Verification.** typecheck ✅, lint ✅, 552 tests ✅, build ✅.

**No schema changes.** Pure client + server-action + extracted module.

Files: `src/lib/task-topics.ts` (new), `src/app/(app)/tasks/actions.ts` (replaced inline parser with import), `src/app/(app)/tasks/TopicPicker.tsx` (sentinel emit), `src/app/(app)/tasks/TaskDrawer.tsx` (sentinel append in save), `tests/unit/task-topics.test.ts` (new), `package.json` → `1.61.1`.

---

### 2026-05-02 · v1.61.0 — XL1: tasks-via-guest-groups

User: "XL1". Closes the last open item from the v1.52.1 review punch list. Originally deferred because the punch-list reading lagged the schema — the audit thought the join already existed; it didn't. Three design options were on the table:

- **(a)** `Task ↔ Guest` direct relation (single-guest assignment).
- **(b)** Surface tasks tagged with a built-in "Guests" nav tag (already on `/guests` page strip from v1.52.0; redundant on detail).
- **(c)** `Task ↔ GuestGroup` m2m (new) — the cleanest read of the punch-list phrasing ("tasks linked via the guest's **groups**").

Picked **(c)** — mirrors the existing pattern from v1.30.5 (Task ↔ BookSection + NavTag) and v1.51.0 (Task ↔ BookSubsection). Same shape, same payload, same picker.

**Use case.** "Phone the bride's parents about hen plans" → tag with the "Bride's parents" GuestGroup → surfaces on each parent's guest detail page automatically. Add a new member to the group → they see the task too. Mark the task DONE → it sinks to the bottom with a strikethrough on every member's page.

**Schema.** `prisma/schema.prisma` gains `Task.guestGroups GuestGroup[]` and the back-relation `GuestGroup.tasks Task[]`. Implicit Prisma m2m → Prisma manages `_GuestGroupToTask` (alphabetical naming, A = GuestGroup.id, B = Task.id, primary key on the pair, cascade on both sides).

**Migration** `prisma/migrations/20260506000000_task_guest_group_m2m/migration.sql`. Purely additive, identical shape to the v1.51.0 BookSubsection migration. Runs cleanly on production via `prisma migrate deploy` on container start.

**Server actions** (`src/app/(app)/tasks/actions.ts`). `parseTopicKeys` now extracts `guestGroup:<id>` keys alongside the existing three prefixes. `createTask` connects them; `updateTask` uses `set:` to replace the relation atomically. `changedFields` audit diff includes `guestGroups`. The audit-aware-feature-design standing rule applied throughout.

**TopicPicker** (`src/app/(app)/tasks/TopicPicker.tsx`). Fourth dropdown section "Guest groups" with each group's colour as a 12px swatch + member count chip. Selected guest-group chips render with a 8px swatch dot prefix (matches the seating canvas) and use a neutral `bg-canvas` border colour to distinguish them from the moss (book) and marigold (nav-tag) chip families. No `href` on the chip — there's no per-group page yet.

**TaskForm + TaskDrawer + AddTaskToggle.** All three thread `guestGroups` + `defaultGuestGroupIds` / `initialGuestGroupIds`. The drawer's dirty-check now includes guest-group selection.

**Page loaders** (`tasks/page.tsx`, `questions/page.tsx`). Both fetch GuestGroups with `_count.members` and flatten to `{ id, name, colour, memberCount }`. Threaded through to AddTaskToggle and TaskList.

**Guest detail page** (`/guests/[id]/page.tsx`) — the payoff. New "Tasks via groups" section appears when:
- The viewing user has `canView("tasks")` — gate re-checked at render time.
- The guest is in ≥1 group AND ≥1 group has linked tasks.

Renders open count above the list, "Manage →" deep-link to `/tasks`, then one row per task with `○`/`✓` glyph, title (line-through when DONE/ARCHIVED), one chip per linking group (with colour swatch), and due date when present and not done. Server-side ordering: status asc → priority desc → dueDate asc, so URGENT-and-overdue floats to top, DONE sinks to the bottom.

**Read-time query, no auto-sync.** Per the v1.30.5 cross-module-wiring rule. Adding a member to a group instantly lights up the task on their page on next load; no denormalised cache, no rebuild step.

**Verification.** typecheck ✅, lint ✅, 542 tests ✅, build ✅.

**Punch-list status post-v1.61.0:** all 6 🔴 cleared (v1.53.0); all 14 🟡 cleared (v1.54.0 + v1.59.0); **all 11 🟢 cleared** (v1.57.0 + v1.58.0 + v1.61.0); all 8 ✨ cleared (v1.53.0 + v1.60.0). **Three-agent review punch list now fully closed.**

Files: `prisma/schema.prisma`, `prisma/migrations/20260506000000_task_guest_group_m2m/migration.sql` (new), `src/app/(app)/tasks/actions.ts`, `src/app/(app)/tasks/TopicPicker.tsx`, `src/app/(app)/tasks/TaskForm.tsx`, `src/app/(app)/tasks/TaskDrawer.tsx`, `src/app/(app)/tasks/TaskList.tsx`, `src/app/(app)/tasks/AddTaskToggle.tsx`, `src/app/(app)/tasks/page.tsx`, `src/app/(app)/questions/page.tsx`, `src/app/(app)/guests/[id]/page.tsx`, `package.json` → `1.61.0`.

---

### 2026-05-01 · v1.60.0 — Polish sweep

User: "Next" (auto mode). Closes the 8 ✨ polish items from the v1.52.1 review punch list. Survey first found that **P6 (raw `alert()` in BudgetClient) was already cleared in v1.53.0** — the punch list reading lagged the code. Remaining 7 items shipped here as one batched cleanup.

**P1 — empty-state verb unified.** `book/page.tsx` said "**Create** one above" while every other empty state said "Add one (above|below)". Normalised to "Add". One-line change.

**P2 — supplier-delete confirm enriched.** `SupplierCard.tsx` `onDelete` now builds a multi-line confirm dialog with the snapshot fields already on the card: category, status, agreed amount, last contact (with channel + relative date). Plus a heads-up that "if this supplier has linked tasks / payments / contracts, the delete will fail and you'll be told what's blocking it" — frames the v1.53.0 (C1) FK-blocked-with-toast behaviour as a feature, not a surprise.

**P3 — dirty-check on `SupplierForm` / `GuestForm` / `EventForm`** (the meatiest item). Pre-fix you could mash Save → Save → Save and each click fired a server round-trip with the same body. Now the Save button disables when no edits are pending. Implementation pattern keeps the inputs uncontrolled (no `useState` explosion across ~20 fields each); a single form-level `onChange={() => setDirty(true)}` flips the flag the moment any input fires a change event. EventForm has two controlled fields (`allDay`, `attendeeRefs`) — their setters call `setDirty(true)` explicitly so the form-level handler doesn't have to know about them. Create path (no `initial`) starts dirty so the button is immediately useful for new rows. After a successful submit, `setDirty(false)` runs so a stray second click stays disabled.

**P4 — Today snapshot strip wrap fix.** Pre-fix the "Snapshot" label and the bits all sat in one `flex flex-wrap` row. At ~1280px the label could end up on its own line with one orphaned bit, then the rest wrap to row two — visually broken. Restructured to label-then-bits siblings: label is `flex-shrink-0`, bits get their own `flex-wrap` container with `min-w-0`. On `sm:` and up the two sit side-by-side; below `sm:` they stack cleanly.

**P5 — `:target` flash on book cards.** Pre-fix the v1.58.0 (XL7) chip deep-links and v1.57.0 (XL5) BUILD-card backlinks scrolled the user to the right card but nothing visibly changed — easy to miss the destination. New CSS keyframe `book-card-target-flash` plays once on `article[id]:target`, using `box-shadow` + `border-color` against `--color-marigold-100` / `--color-marigold-500` so it works in both themes. 1.6s ease-out, single iteration. Wrapped in `@media (prefers-reduced-motion: no-preference)` so the animation respects the OS-level a11y preference.

**P7 — Zod-validate `BookSubsectionKind`.** `book/actions.ts:91` was casting `formData.get("kind") as BookSubsectionKind | null` before passing to the schema. Not a runtime hole (Zod's `nativeEnum` caught bad values either way) but the cast was a TS lie. Replaced with `formData.get("kind") ?? undefined` and let the schema's `.default(BookSubsectionKind.TEXT)` do the work.

**P8 — stale `removeUser` cleanup comment.** Listed `Account` / `Session` / `AuditLog` cleanup but missed `_PermissionGroupMembers` (the implicit m2m table that landed in v1.40.0; cascades fine via Prisma). One-comment fix.

**Punch-list status post-v1.60.0:** all 6 🔴 cleared (v1.53.0); all 14 🟡 cleared (v1.54.0 + v1.59.0); 10/11 🟢 cleared (v1.57.0 + v1.58.0; XL1 deferred pending Task↔GuestGroup schema design); **all 8 ✨ cleared** (v1.53.0 + v1.60.0). Three-agent review punch list now fully closed except XL1.

**Verification.** typecheck ✅, lint ✅, 542 tests ✅, build ✅.

**No schema changes.** Pure UI/UX shipping.

---

### 2026-05-01 · v1.59.0 promotion — `claude/main` jumps 32 releases

User: "Promotion". Production lag had grown uncomfortable — `claude/main` was at **v1.27.2** (28 Apr 2026), `dev` at **v1.59.0** (1 May 2026). Three days of work, but 32 tagged releases including the entire Wedding Book expansion arc, the permissions-groups overhaul, ceremony seating auto-fill, numeric auth, the audit-log enrichment sweep, and two cross-link sweeps. Sat down to bridge the gap.

**Procedure (single ship).**

1. Verified GHA build green on dev tip `842fd03` via `curl https://api.github.com/repos/.../actions/runs?branch=dev`.
2. Audited the 22 schema migrations in the gap. 20 purely additive. The 2 non-additive (P5 OUTFIT rework `20260430070000`, P7a TEXT body→bodyHtml `20260430090000`) both gate on `IS NULL` of the new column — re-run safe. `CREATE EXTENSION IF NOT EXISTS pgcrypto` at the top of the OUTFIT migration is needed for `gen_random_bytes()`; runs cleanly on the self-hosted Postgres 16 in the production Docker compose.
3. `git checkout claude/main && git merge --ff-only dev` (64 commits fast-forwarded; no merge commits, clean history).
4. Annotated `v1.59.0` tag with the headline-feature summary and a CI-green-on-same-SHA confirmation. Pushed both branch and tag.
5. ROADMAP snapshot updated to reflect new prod state (was stuck at v1.15.0 in the doc — actually had been v1.27.2 in git, dual drift).

**Headline features production users now see:**
- Wedding Book expansion arc (P1–P8): BUILD / MENU / BAR / SETUP / LEGAL / OUTFIT-rework / STAY / LODGING_GUIDE cards + TEXT WYSIWYG via Tiptap.
- Permission groups + group-driven permissions (replaces per-user matrix as the primary surface).
- Auto-filled, group-coloured ceremony seating from ordered guest groups with side constraints.
- 6-digit OTP at sign-in alongside the magic link.
- Recent-activity feed on Today (couple-only).
- Tasks ↔ supplier / book section / book card linkage with deep-links across modules.
- Linked-tasks strips on /songs /seating/ceremony /guests.
- Cross-link sweeps round 1+2: household seating summaries, BUILD-card chips on /budget, supplier/guest deep-link filters, Today topic chips, /seating fragment routing, supplier-detail BUILD-card backlinks, TaskDrawer chip deep-links.
- Daily bug-check workflow.

**Three-agent review punch list status post-promotion:** all 6 🔴 cleared (v1.53.0); all 14 🟡 cleared (v1.54.0 + v1.59.0); 10/11 🟢 cleared (v1.57.0 + v1.58.0; XL1 deferred pending Task↔GuestGroup schema design); ~6 ✨ polish remain.

**Deploy command (Unraid box):** `docker compose pull && docker compose up -d` once the GHCR image build for `v1.59.0` finishes. The image build is a separate GHA job triggered by the tag push; it typically takes 8-10 min for this stack.

**Migrations apply on container start** via `prisma migrate deploy`. The 22 migrations run in timestamp order; the data-touching ones (P5 OUTFIT, P7a TEXT) are no-ops if production data hasn't accumulated affected rows yet, idempotent re-runs otherwise.

**Open the v1.30.5 standing rule about promotion** — "no calendar-based feature freeze; risk is managed by the rules above, not by stopping iteration" — held up here even with a 32-release gap. Every ship in the gap had passed typecheck / lint / tests / build green on the same SHA before tagging.

---

### 2026-05-01 · v1.59.0 — Inline "add to group" UX

User: "c2". Last open 🟡 item from the v1.52.1 review punch list — fixes the three-panel UX friction where adding a wedding-party member to a permission group required bouncing between MemberOverridesBlock and PermissionGroupsBlock to learn what the group grants.

**Symptom.** When the couple expands a member's card and ticks a custom group, they get no signal of what permissions they just granted. To find out, they had to scroll up to the Permission groups panel, hunt for the group, and click "Permissions" on it. Same friction for the read-only built-in chip row, which used to just print "Wedding party, Everyone" with no hint of what those memberships gave the user.

**Fix — `src/app/(app)/settings/MemberOverridesBlock.tsx`.** Each custom-group toggle now renders a one-line summary directly under the checkbox: "EDIT: tasks, songs · VIEW: schedule" using a new local `PermsLine` helper that mirrors the language of `PermissionsSummary` from PermissionGroupsBlock. When a group has zero permissions yet, the line says "no permissions granted" so the row never looks broken. Built-in chips moved from a comma-separated label list to a labelled vertical block — each built-in (Wedding party / Couple / etc.) gets its own row with the same `PermsLine` next to it.

**Data.** Replaced the v1.45.0 `builtinKeysByUser: Record<string, string[]>` prop (label-only) with a richer `builtinDetailsByUser: Record<string, { name; slug; permissions: PermRow[] }[]>`. Custom groups gain a `permissions: PermRow[]` field on `GroupRow`. Both threads source from a `permsByKey` Map bucketed by `groupKey` — same shape PermissionGroupsBlock builds for its own matrix, just lifted into the MemberOverridesBlock IIFE in `settings/page.tsx`.

**No schema work.** Read-only display change.

**Tests.** Existing 542 unit tests still pass. No new behaviour to test — this is a UI surfacing change, and the underlying perms come from the already-tested `permsByKey` bucket.

**Punch-list status post-v1.59.0:** all 🔴 cleared (v1.53.0); 14/14 🟡 cleared (v1.54.0 + v1.59.0); 10/11 🟢 cleared (XL1 still deferred pending design); ~6 ✨ polish remain.

---

### 2026-05-01 · v1.58.0 — Cross-link sweep round 2

User: "1.58". Closes the remaining 5 deferred 🟢 items from v1.57.0. Survey first surfaced that 3 of the 5 (XL2, XL6) were already shipped or substantially covered by earlier releases — only XL4 and XL7 needed real work. XL1 stays deferred pending a design call.

**XL4 — supplier detail surfaces BUILD-card backlinks** (`suppliers/[id]/page.tsx`). New "Linked from DIY" section appears below "Used in setup" when ≥1 BUILD card has a budget line whose `supplierId` matches this supplier. Each row deep-links to `/book/<sectionSlug>#<subsectionSlug>` and shows the card title, parent section, optional `status` + `quantityNeeded` chips, and the budget line estimate (also linked to `/budget`). Hidden when zero matches. Pure read-time query; no schema work.

**XL7 — TaskDrawer chip deep-links** (`TopicPicker.tsx` + page loaders). Chip *labels* in the task drawer's Topics multi-select are now `<a>` tags when the slug is known. Sections → `/book/<slug>`; subsections → `/book/<sectionSlug>#<slug>`; nav tags → `t.route` (already there). The × button stays as a separate sibling so removal still works inline. Schema additions to `BookSectionOpt` (`slug?`) and `BookSubsectionOpt` (`slug?` + `sectionSlug?`) — both optional so older callers still typecheck. Page loaders at `/tasks` and `/questions` extended to select + flatten the slugs.

**XL2 — guest detail file/budget-line/STAY linkbacks.** Audit confirmed STAY backlinks were already there from v1.37.5 (`/guests/[id]/page.tsx:139-176` — `findStaysForGuest` + the "Accommodation" section). Files have no Guest relation in the schema; budget lines have no Guest relation. Adding either would be a schema change in its own right; the existing surfaces are complete for the relations that exist. No code change in v1.58.0 — flagging as substantively done.

**XL6 — book card cross-links to suppliers / files / budget lines.** Audit confirmed each card kind already surfaces its own relevant linkbacks. BUILD cards display `budgetLine`. SETUP cards autocomplete from `supplierNames`. OUTFIT rows show `supplier` + `fileIds`. The audit's "generalise the inline panel below the card" reading would have meant a major refactor with diminishing returns, since each kind's display is already tuned. No code change in v1.58.0 — flagging as substantively done per-kind.

**XL1 — guest detail tasks-via-groups.** Stays deferred. There's no `Task ↔ GuestGroup` relation in the schema; tasks link to `BookSection` / `BookSubsection` / `NavTag`. The audit's question ("does it surface tasks linked via the guest's groups?") doesn't have a clean implementation in the current model. Two design options if revisited:
- (a) Add a `Task ↔ Guest` relation directly (single-guest task assignment).
- (b) Surface tasks tagged with the v1.30.5 Guests nav tag on the guest detail page (already shown on the `/guests` page strip from v1.52.0; redundant on detail).

Both are non-trivial design calls — file under "open question" in the deferred backlog.

**Verified.** typecheck clean · lint clean · 542 tests · production build clean.

Files: `src/app/(app)/suppliers/[id]/page.tsx` (XL4 query + render), `src/app/(app)/tasks/TopicPicker.tsx` (XL7 chip-as-link + slug fields on opts), `src/app/(app)/tasks/page.tsx` + `src/app/(app)/questions/page.tsx` (XL7 select + flatten slugs), `package.json` → `1.58.0`.

**Punch-list status post-v1.58.0:** all 🔴 cleared (v1.53.0); 13/14 🟡 cleared (v1.54.0; C2 still open); 10/11 🟢 cleared (v1.57.0 + v1.58.0; XL1 deferred pending design); ~6 ✨ polish remain.

### 2026-05-01 · v1.57.0 — Cross-link sweep

User: "cross link sweep". 6 of the 11 🟢 cross-link opportunities from the v1.52.1 review punch list, batched. The other 5 (XL1, XL2, XL4, XL6, XL7) deferred to v1.58.0 because they need either schema work or larger refactors.

**XL3 — household card table summary** (`HouseholdBlock.tsx`). The header line under each household name already shows attending/declined/pending counts; v1.57.0 appends "seated at N tables (Top, Family-3)" when ≥1 guest has a `tableSeat`. Up to 3 table names listed; otherwise the count alone. Data was already on the page query (`tableSeat.table.name`); just dedupe + render.

**XL5 — budget rows show source BUILD-card chip** (`budget/page.tsx` + `BudgetClient.tsx`). v1.31.0's "Copy materials to Budget" creates a `BookBuildCard.budgetLineId` link, but until now that relationship was only visible in the top-of-page "Linked from DIY" panel. Per-line rows showed nothing. Now each line with a back-link renders a small `↗ DIY · <Card title>` chip beside the description, deep-linking to `/book/<sectionSlug>#<subsectionSlug>`. Threaded as `Map<lineId, { sectionSlug, subsectionSlug, title }>` through `BudgetClient` → `CategoryBlock` → `LineRow`.

**XL8 — /payments accepts `?supplier=<id>`** (`payments/page.tsx` + `suppliers/[id]/page.tsx`). Mirrors the `/tasks?supplier=<id>` pattern from v1.30.0. Filter banner shows "Filtered by supplier: <name>" with a Clear × link. Supplier detail page's "Manage on Payments →" link now passes `?supplier=<id>` instead of landing at the unfiltered list.

**XL9 — /songs accepts `?guest=<id>`** (`songs/page.tsx` + `guests/[id]/page.tsx`). Filters the `GuestRequestsSection` to that guest's requests only. Note: the `Song` model has no FK to Guest (only `SongRequest.guestId` does), so playlists themselves keep showing the full curated list — only the requests panel narrows. Filter banner: "Showing requests by: <Name>" with a Clear × link. Guest detail's "Manage on Songs →" link now passes `?guest=<id>`.

**XL10 — Today list surfaces topic chips** (`page.tsx` + `TodayTaskList.tsx`). The "My next tasks" column on the Today page showed bare titles. Now each task surfaces up to 2 topic labels (subsections > sections > nav-tag `#name`s, in priority order; "+N" if more) in muted moss-700 between the title and due date. Page query extended with `bookSections` / `bookSubsections` / `navTags` includes; client component takes an optional `topics?: string[]`.

**XL11 — `/seating#table-<id>` fragment scroll** (`SeatingCanvas.tsx` + `HouseholdBlock.tsx` + `guests/[id]/page.tsx`). Pre-fix the `⊛ Top Table` chip on a guest list / detail page linked to `/seating` with no anchor — landing at the top of a 20-table layout. Now: chip URL is `/seating#table-<tableId>`; `SeatingCanvas` reads the fragment on mount and sets `focusedId` to the matching table, which triggers the existing focus chrome (highlight + sidebar panel). One-shot effect on first mount only.

**Deferred to v1.58.0** (need either schema work or substantial cross-reference logic):

- **XL1** — guest detail page surfacing tasks-via-groups. There's no `Task ↔ GuestGroup` relation; tasks link to BookSection / BookSubsection / NavTag. Surface needs an opinion on what "tasks for this guest's groups" means before code.
- **XL2** — guest detail page surfacing files / budget-lines / STAY-card linkbacks. Guest has no direct File relation; STAY backlinks are already partially there. Worth a sweep of its own.
- **XL4** — supplier detail page surfacing files + BUILD-card backlinks via `budgetLine.supplierId`. Cross-table join with no existing pattern; clean implementation.
- **XL6** — book card surfacing linked suppliers / files / budget lines. Suppliers via `setupItem.source` (string match), files via where-stored-on-card relations. Requires per-kind logic.
- **XL7** — TaskDrawer chip deep-links. Needs `slug` added to `BookSectionOpt` + `BookSubsectionOpt`, threaded from the task page loaders. Bounded but touches the picker shape and three pages.

**Verified.** typecheck clean · lint clean · 542 tests · production build clean.

Files: `src/app/(app)/guests/HouseholdBlock.tsx` (XL3 + XL11), `src/app/(app)/guests/[id]/page.tsx` (XL11 + songs/payments deep-links), `src/app/(app)/seating/SeatingCanvas.tsx` (XL11 fragment scroll), `src/app/(app)/payments/page.tsx` (XL8 supplier filter), `src/app/(app)/suppliers/[id]/page.tsx` (XL8 deep-link), `src/app/(app)/songs/page.tsx` (XL9 guest filter), `src/app/(app)/budget/page.tsx` (XL5 buildCardByLineId), `src/app/(app)/budget/BudgetClient.tsx` (XL5 LineRow chip), `src/app/(app)/page.tsx` (XL10 task topic include), `src/app/(app)/TodayTaskList.tsx` (XL10 topic chip render), `package.json` → `1.57.0`.

### 2026-05-01 · v1.56.0 — Add-New affordances popout modal

User: "I want the screens to popout". Reverses v1.55.0's direction — instead of normalising every Add affordance to inline-expand, they all become popout modals. The original v1.55.0 audit reading was wrong: the user's feedback "instead of popping out in the middle of the page like add new tasks they open in the task bar" meant *they want them to popout like tasks does*, not *they should stop popping out*. v1.56.0 takes the literal reading.

**New shared component** `src/components/ui/AddNewModal.tsx`. Centred card with backdrop, Esc + backdrop-click + × dismissal, three width presets (`sm` 480px, `md` 560px, `lg` 680px). Same shape every page; one place to evolve the pattern.

```tsx
<AddNewModal open={open} onClose={() => setOpen(false)} title="New X" width="md">
  <SomeForm onSubmit={...} onCancel={() => setOpen(false)} />
</AddNewModal>
```

**Nine toggles converted:**

| Toggle | Page | Width |
|---|---|---|
| `AddTaskToggle` | `/tasks` | `lg` |
| `AddEventToggle` | `/schedule` | `md` |
| `AddHouseholdToggle` | `/guests` | `sm` |
| `AddSupplierToggle` | `/suppliers` | `md` |
| `AddPlaylistToggle` | `/songs` | `md` |
| `AddTableToggle` | `/seating` | `sm` |
| `AddPaymentToggle` | `/payments` | `md` |
| `AddSectionToggle` | `/book` | `md` |
| `AddSubsectionToggle` | `/book/[slug]` | `md` |

Each rewrite drops the inline-expand pattern (`if (!open) return button; else return form-card`) in favour of always rendering the button + the modal-as-portal. The button stays in `PageHeader.actions` (or wherever it was); clicking it sets `open=true`; the modal materialises over the page; submit / cancel set `open=false` and the modal vanishes. No layout shift on the underlying page.

**Out of scope.** Settings sub-pickers (CustomFieldsPanel, NavTagsBlock, PermissionGroupsBlock, GuestGroupsBlock) and BudgetClient's category/line forms still use inline-expand for now. Their scope is per-section management *within* a settings panel — popping out of context made less sense in early review. If the user wants them converted too, easy follow-up: same AddNewModal wrapper, same shape.

**Verified.** typecheck clean · lint clean · 542 tests · production build clean. Structural change only — form contracts unchanged, no test impact.

Files: `src/components/ui/AddNewModal.tsx` (new), 9 toggle files rewritten, `package.json` → `1.56.0`.

### 2026-05-01 · v1.55.0 — Add-New affordances normalised

User: "check the 'Add new' buttons on each page, instead of popping out in the middle of the page like add new tasks they open in the task bar instead". Audit found two pages were the outliers — every other "+ New X" affordance already used inline-expansion.

**The split.** A code review across `src/app/(app)/` found two patterns competing:

- **Modal popover** (v1.27.0 origin) — fixed-position card with backdrop, click-outside / Esc to dismiss. Used on `/tasks` (`AddTaskToggle`) and `/schedule` (`AddEventToggle`). Originally introduced to "keep the page header uncrowded" when the form was tall.
- **Inline expand** (v1.0.x origin) — button toggles to a form-card in place; same flex slot. Used on every other Add affordance: `AddHouseholdToggle` (guests), `AddSupplierToggle` (suppliers), `AddPlaylistToggle` (songs), `AddTableToggle` (seating), `AddPaymentToggle` (payments), `AddSectionToggle` + `AddSubsectionToggle` (book), `BudgetClient`'s category/line adds, plus all four Settings sub-pickers (custom fields, nav tags, permission groups, guest groups).

13 inline-expand vs. 2 modal-popover. The user's complaint is the inconsistency — adding a task feels jarring vs. adding a guest, even though both are everyday actions.

**The fix.** `AddTaskToggle` and `AddEventToggle` rewritten to inline-expand. Each:

- Renders a `+ New X` button when `open === false`.
- Replaces the button with a form-card when `open === true` — `bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm w-full sm:w-[680px]` (or 640px for events). The card lives in the same `PageHeader.actions` flex slot as the button; it wraps to its own line on the flex-wrap row when wider than the title side leaves room.
- No backdrop, no `position: fixed`, no Escape handler. The Cancel + × buttons in the form chrome do the dismissal.
- All the existing form props (TaskForm / EventForm) flow through unchanged — only the wrapper changed.

The 680px width on TaskForm matches the previous modal's `max-w-[680px]`; same content density, just unmoored from the centred fixed-position layout. On mobile both go full width.

**Why this is fine even though TaskForm is tall.** The original v1.27.0 rationale ("keep the header uncrowded") assumed the form would render *inside* the page header itself. With the flex-wrap layout, the expanded card wraps onto its own line *below* the title row but still inside the PageHeader's surface — it's part of the toolbar, just bigger when needed. Adjacent pages with fewer fields keep their compact form-cards; tasks and events take more vertical space when active, then collapse back when done. Same behaviour as opening any inspector panel.

**Verified.** typecheck clean · lint clean · 542 tests pass · production build clean. No new tests — the change is structural / styling only and the form contracts are unchanged.

Files: `src/app/(app)/tasks/AddTaskToggle.tsx` (rewrite), `src/app/(app)/schedule/AddEventToggle.tsx` (rewrite), `package.json` → `1.55.0`.

### 2026-05-01 · v1.54.1 — Daily bug-check schedule

User: "Schedule a daily run for an in depth bug check and document it". Two complementary mechanisms — durable GitHub Actions workflow for the things a CI runner can check on a clock, plus a session-lifetime Claude cron for the things a code-review agent can.

**Durable: GitHub Actions workflow.** New `.github/workflows/daily-bug-check.yml`. Runs at `23 8 * * *` (08:23 UTC daily, ≈09:23 BST in summer / 08:23 GMT in winter). Off-the-hour minute by convention so the scheduler doesn't pile onto GitHub's :00-tick fleet. Steps:

1. **`npm audit --audit-level=high`** — fails the workflow on any high or critical advisory; the repo gets a red ❌ until upgraded. Lower-severity findings logged for context but don't fail.
2. **`npm outdated`** — informational. Lists packages with newer versions available; doesn't fail.
3. **TODO/FIXME/XXX accumulator** — pattern scan over `src/` + `tests/`. Reports the count and surfaces the first 50 markers. Comment debt growth is a smell worth looking at occasionally.
4. **Migration drift check** — lists the latest migrations dir entries. Real schema-vs-DB drift detection is a deploy-time check (`prisma migrate status`); this is the comment-only check.
5. **`prisma format --check`** — fails if `schema.prisma` isn't canonically formatted (catches the case where someone hand-edits and forgets to run `prisma format`).

What this **doesn't** cover (deliberately): typecheck/lint/tests/build — those are in `build.yml` on every push, where the gate matters most. Daily re-runs of the same gates against an unchanged codebase aren't useful; the value is in the dependency-rot dimension.

Findings appear in the workflow run output. GitHub surfaces a red ❌ on the repo if any step fails. No email notifications wired — the goal is "I'll see this during my morning routine" on the GitHub homepage, not "page me at 3am".

**Session-only: Claude review cron.** Companion `CronCreate` job fires at 09:17 local daily for the lifetime of the dev Claude shell. Prompts a focused review session that does what a CI runner can't:

- Reads the latest 3 commits and checks for obvious gotchas / missed cross-links the v1.52.1-style review agents would flag.
- Re-runs typecheck + lint + tests + build locally and reports diffs from the known-green test count (542 baseline post-v1.54.0).
- Surveys the ROADMAP backlog and proposes one item to land next, with rationale.
- Skips if the user is mid-task.

7-day auto-expiry per CronCreate semantics. Re-issue via `/loop` or another CronCreate when needed. The GitHub Action is the durable layer; this Claude cron is the in-session companion.

**Operator notes.** To trigger the workflow manually: GitHub → Actions → "Daily bug check" → "Run workflow". To list active session crons: ask Claude `CronList`. To delete: `CronDelete <jobId>`.

Files: `.github/workflows/daily-bug-check.yml` (new), `package.json` → `1.54.1`, ROADMAP changelog entry.

### 2026-05-01 · v1.54.0 — Notable review fixes

User: "Push next one after". Bundles all 14 🟡 Notable items from the v1.52.1 review punch list (skipping C2 — the inline add-to-group on user cards is a substantial UX refactor and ships separately as v1.55.x).

- **A6** — Bootstrap-as-couple race tightened with conditional `updateMany({ where: { id, isCouple: false } })`. Pre-fix two simultaneous first-sign-ins could both promote themselves; now only the first matches the predicate. Re-fetch after to authoritatively reflect the stored state.
- **A7** — `setPermSchema` and `clearPermSchema` validate `section` against `z.enum(SECTIONS)` instead of `z.string().min(1)`. Pre-fix a couple-tier user could write `Permission(userId, "made-up-section", EDIT)` rows that polluted the table without ever resolving. `setGroupPermission` already did this; consistency restored.
- **A8** — `clearAllUserOverrides` wraps find-then-deleteMany in `db.$transaction` so a concurrent `setPermission` between the read and the delete can't make the audit row under-report.
- **A9** — `setBookSubsectionVisibility` and `setBookSectionVisibility` use `requireEdit("book")` before the `isCouple` check. Pre-fix a couple-tier user with `book` set to NONE could still flip visibility — couple-tier shouldn't bypass per-section gates.
- **A10** — `setCeremonyRowGroup` export removed. The action wrote to the v1.48.0-deprecated `CeremonyRow` table; unreferenced from any UI but a stale tab could have triggered it. Schema model preserved as the documented buffer; export gone.
- **B2** — Every guest-group write (`createGuestGroup`, `updateGuestGroup`, `deleteGuestGroup`, `toggleGuestGroupMember`, `reorderGuestGroup`) now also `revalidatePath('/seating/ceremony')`. App Router segment scoping means revalidating `/seating` doesn't reach the ceremony child route — re-orders, side flips, and member toggles were looking unapplied until hard reload.
- **B3** — Audit-log enrichment sweep on Book CRUD + permission writes per the v1.30.5 standing rule. `deleteBookSection` now snapshots `slug` + `title` + `subsectionCount` before deletion; `updateBookSubsection` adds `changedFields` covering title + bodyHtml + body diffs; `deleteBookSubsection` snapshots title + kind + sectionSlug. `setPermission` and `setGroupPermission` capture `priorLevel` so the audit log diff reads "Set per-user override on tasks → EDIT (was VIEW)". `audit-format.ts` updated for the priorLevel surface; existing test extended with one new case (no breakage on the no-prior path).
- **B4** — `seedCeremonyRowAssignments` deleted from `prisma/seed.ts`. The function was removed from `main()` in v1.48.0 but the body still referenced `db.ceremonyRow`; an operator script importing it would have silently re-populated the deprecated table.
- **B5** — `src/lib/ceremony-fill.ts` and `tests/unit/ceremony-fill.test.ts` deleted. v1.48.0's `ceremony-allocate.ts` replaced the per-row fill model; nothing imported the orphan.
- **C3** — Reorder buttons (▲▼) on permission groups and nav tags. New `reorderPermissionGroup` and `reorderNavTag` server actions mirroring `reorderGuestGroup`. Audit-format patterns added: `Moved permission group "After-party" up (swapped with "Bryony's family")`. UI: ▲▼ on the left of each row, disabled at edges.
- **C4** — `PageLinkedTasksStrip` header bumped from metadata-pill styling (`text-[10px] uppercase tracking-wider font-bold text-ink-tertiary`) to a real section heading (`text-xs font-semibold text-ink-primary`) with a left rule (`border-l-2 border-l-moss-300`) and a 📋 glyph. Reads as a real surface now, not as a column-label rule above the data.
- **C5** — `+ Add group` chip on guests with no memberships re-styled. When `memberGroups.length === 0`, the affordance renders as ghost moss-700 text (`+ group` with hover underline) instead of a dashed-border chip in the meta-pill row. Easier to spot among +1 / child / table / song-count pills.
- **C6** — Verified Spotify deep-link anchor. `/songs` page links to `/settings#spotify-integration`; the SpotifySettingsPanel root has matched `id="spotify-integration"`. False alarm in the audit; no fix needed.

**Verified.** typecheck clean · lint clean · 542 tests pass (was 555; -16 from deleted ceremony-fill.test.ts; +3 from new override + audit cases) · production build clean.

Files: `src/auth.ts` (A6), `src/app/(app)/settings/actions.ts` (A7 + A8 + B3), `src/app/(app)/settings/permission-group-actions.ts` (B3 + C3), `src/app/(app)/settings/nav-tag-actions.ts` (C3 reorderNavTag), `src/app/(app)/settings/guest-group-actions.ts` (B2), `src/app/(app)/book/actions.ts` (A9 + B3), `src/app/(app)/seating/actions.ts` (A10), `src/app/(app)/settings/PermissionGroupsBlock.tsx` (C3 ▲▼), `src/app/(app)/settings/NavTagsBlock.tsx` (C3 ▲▼), `src/components/ui/PageLinkedTasksStrip.tsx` (C4), `src/components/ui/GuestGroupsControl.tsx` (C5), `src/lib/audit-format.ts` (B3 + C3 patterns), `src/lib/ceremony-fill.ts` deleted, `tests/unit/ceremony-fill.test.ts` deleted, `tests/unit/audit-format-enrichment.test.ts` (priorLevel test), `prisma/seed.ts` (B4), `package.json` → `1.54.0`.

**Punch-list status post-v1.54.0:** all 🔴 cleared (v1.53.0). Of the 14 🟡, 13 cleared here; **C2 (inline add-to-group on user cards)** deferred to v1.55.x — substantial UX refactor in its own right. Plus 11 🟢 cross-link opportunities remain (target v1.55.0 sweep) and ~7 ✨ polish items.

### 2026-05-01 · v1.53.0 — Critical review fixes

User: "Lets go fix the critical". Lands all six 🔴 ship-blockers from the v1.52.1 review punch list. Each item below is referenced by its punch-list ID for traceability.

**A1 — verify-code rate limiter no longer double-counts.** `src/lib/rate-limit.ts`. Pre-fix the `bucket: "guess"` flow wrote a row on the *pre-check* (when `decision.ok`) AND the verify page wrote on failure → effective budget was 2–3 wrong guesses, not 5. Split into `checkGuessLimit()` (read-only) and `recordFailedGuess()` (write-on-fail). Send bucket unchanged (still records on every successful pre-check). Verify page now uses the read-only check.

**A2 — verify page reads email from httpOnly cookie, not form.** `src/app/signin/verify/page.tsx`. Pre-fix the form submitted email + code; an attacker could rotate across the ~5 known allowlisted emails to get 25 guesses/15min on a 1M-space code. Post-fix the email comes from the `signin-email` cookie set by `/signin`'s server action. Cookie missing → friendlier "Session expired" page redirecting to `/signin?error=expired`. Form has no email field; the cookie is the source of truth.

**A3 — pending VerificationToken siblings invalidated on send.** `src/auth.ts`. Auth.js's PrismaAdapter only deletes the matched token on successful sign-in; two consecutive sends within the 15-min TTL would leave two valid 6-digit codes. Now `sendVerificationRequest` runs `db.verificationToken.deleteMany({ where: { identifier } })` *before* the adapter writes the new row. Exactly one pending code per email at any time.

**A4 — `/api/auth/callback/nodemailer` is rate-limited.** `src/app/api/auth/[...nextauth]/route.ts`. Pre-fix the verify-page bucket only protected the form; an attacker could brute-force the 6-digit code by hammering the callback URL directly. Post-fix the route handler wraps `handlers.GET`: pre-checks `checkGuessLimit(email)` when `?token` + `?email` are present (read-only); on Auth.js redirect-to-error, records a failed guess. Successful sign-ins consume nothing — same semantics as the verify page (failures count, successes don't). Rate-limited callback hits redirect to `/signin/verify?error=rate_limited&retry=...` with an audit row tagged `via: "callback"`.

**A5 — per-user permission overrides win unconditionally.** `src/lib/permissions.ts`. Pre-fix `mergeOverrides` was `max(group, override)` — a per-user `NONE` override silently became a no-op against a stronger inherited level. The Settings UI offered NONE but it never lowered access — both a UI lie and removed the only way to express "exclude this user from a section their group can otherwise see". Post-fix: if a per-user row exists, it's authoritative for that section. Setting NONE *does* deny; setting EDIT *does* grant. Couple-only sections (budget / payments) still deny non-couple regardless via the wrapper short-circuit. 22 unit tests in `effective-permissions.test.ts` rewritten to assert the new semantics; 2 cases in `permissions.test.ts` updated likewise.

**B1 — PermissionGroup slug rename/delete cascades to GroupPermission rows.** `src/app/(app)/settings/permission-group-actions.ts`. `GroupPermission.groupKey` stores `group:<slug>` as a free string with no FK (built-ins share the column with no row). Pre-fix renaming a group's slug orphaned every row keyed on the old slug; the resolver silently treated the group as having no permissions. Post-fix `updatePermissionGroup` runs an `updateMany` rewrite of every row in a transaction with the parent update; `deletePermissionGroup` runs a `deleteMany` for the slug in a transaction with the parent delete. No more zombie rows.

**C1 — destructive deletes return result-shape, callers show real toasts.** Five action files: `suppliers/actions.ts` (`deleteSupplier`), `guests/actions.ts` (`deleteHousehold`, `deleteGuest`), `budget/actions.ts` (`deleteCategory`, `deleteLine`). Pre-fix Prisma throws bubbled into Next prod redaction → silent failure with no UX feedback. Post-fix each action wraps in try/catch + returns `{ ok: true } | { ok: false; error: string }`. Callers (`SupplierCard`, `HouseholdBlock` × 2, `BudgetClient` × 2) updated to render `notify("error", res.error)` on failure and `notify("success", ...)` on success. Bonus polish: `BudgetClient.tsx` no longer uses raw `alert()` for the empty-category check — friendlier `notify` with the line count surfaced (P6 from the polish list, free with the C1 sweep).

**Verified.** typecheck clean · lint clean · 557 tests pass (555 → 557; new override-semantics cases added) · production build clean.

Files: `src/auth.ts` (A3), `src/lib/rate-limit.ts` (A1 split), `src/lib/permissions.ts` (A5), `src/app/signin/page.tsx` (A2 + expired-error copy), `src/app/signin/verify/page.tsx` (A2 cookie-only flow + A1 read-only check), `src/app/api/auth/[...nextauth]/route.ts` (A4 wrapper), `src/app/(app)/settings/permission-group-actions.ts` (B1), `src/app/(app)/suppliers/actions.ts` + `SupplierCard.tsx` (C1), `src/app/(app)/guests/actions.ts` + `HouseholdBlock.tsx` (C1), `src/app/(app)/budget/actions.ts` + `BudgetClient.tsx` (C1 + P6), `tests/unit/permissions.test.ts` + `tests/unit/effective-permissions.test.ts` (A5 semantics rewrite), `package.json` → `1.53.0`.

**Punch-list status post-v1.53.0:** all 🔴 cleared. Remaining items: 14 🟡 Notable (target v1.54.0), 11 🟢 Cross-link (target v1.55.0), 8 ✨ Polish (one already cleared as a freebie above).

### 2026-05-01 · v1.52.1 — Review punch list captured

User: "Do a full review, looking for bugs, gotchas and any features that could be linked but are not, the site needs to be graceful, intuitive and well managed. Come back with a report" → followed by "Lets document all these to fix and polish".

After the original backlog (#1–#8) cleared, three parallel review agents covered different slices: security/auth correctness, server-side data integrity, UX/IA + cross-link opportunities. Synthesized into a single ranked punch list, captured in [Deferred / Backlog → Review punch list — captured 1 May 2026](#review-punch-list--captured-1-may-2026).

**Headline counts:**

- **6 🔴 Critical ship-blockers** — verify-code rate limiter double-counts (effective budget is 2–3 not 5), form-supplied email trust on the verify page (bypassable per-email rotation), pending-token siblings staying valid for 15 min, no rate limit on `/api/auth/callback/nodemailer`, per-user NONE overrides silently no-op, slug-rename orphans `GroupPermission` rows, raw-throw destructive actions across 7 action files (silent failure in production).
- **14 🟡 Notable** — bootstrap-as-couple race, unvalidated `section` strings on per-user perms, non-transactional `clearAllUserOverrides`, missing `requireEdit("book")` on visibility flips, deprecated `setCeremonyRowGroup` still exported, missing `revalidatePath('/seating/ceremony')`, audit-log gaps on Book CRUD + permission writes, dead seed code, orphaned `ceremony-fill.ts` module, three-panel UX for adding wedding-party members to groups, missing reorder buttons on permission/nav groups, v1.52.0 strip styled as metadata, `+ Add group` chip lost in pill rows, broken Spotify deep-link anchor.
- **11 🟢 Cross-link opportunities** — guest detail misses tasks-via-groups + files + budget-lines, household card misses table summary, supplier detail misses files + BUILD-card backlinks, budget rows miss source-card chip, BookSubsection cards miss supplier/file/budget-line links, TaskDrawer chips not deep-linked, `/payments` + `/songs` lack supplier/guest filters, Today page tasks miss topic chips, `/seating` deep-links too coarse.
- **8 ✨ Polish** — empty-state copy inconsistency, confirm-dialog richness inconsistency, dirty-check pattern drift, Today snapshot wrapping at 1280px, no anchor-target highlight, raw `alert()` in Budget, type coercion on `BookSubsectionKind`, stale comment on `removeUser` cleanup.

**Suggested cadence.**

- **v1.53.0** — land all 🔴 (most are sub-30-line diffs; A4 callback rate-limit is the largest at ~30 lines).
- **v1.54.0** — sweep 🟡 items, ordered by daily-use impact (C2 unified add-to-group UX first; B-series follows).
- **v1.55.0** — cross-module-wiring sweep covering all 🟢 items (one Promise + one render line per page; the v1.30.5 read-time-query rule means no schema work).
- **Polish items trickle** alongside whatever feature work is open — no dedicated ship.

Each item carries an ID (`A1`, `B3`, `C5`, `XL7`, `P2`) for easy referencing in commits. File paths + line numbers + suggested fix all captured in the table.

Files: `ROADMAP.md` only. `package.json` → `1.52.1`.

### 2026-05-01 · v1.52.0 — Linked-tasks strips on pages

User: "7". Backlog #7 — surface tasks linked to /songs, /seating/ceremony, /guests at the top of each page so the couple sees what's outstanding for that area without bouncing to /tasks.

The infrastructure was already in place — the v1.30.5 NavTag model has a `route` field, four nav tags are seeded (Music → /songs, Ceremony → /seating/ceremony, Reception → null, Guests → /guests), and tasks are taggable via the existing TopicPicker. v1.52.0 just consumes that data.

**Component** `src/components/ui/PageLinkedTasksStrip.tsx`. Server-friendly presentational; pages do the DB read inline and pass rows in. Header line: `Linked tasks · <NavTag.name>` + `N open · M done` count + `Manage →` link to /tasks. Body: open tasks first, done tasks bucket to the bottom with a strikethrough so a long list of completed work doesn't crowd the active items. Each row: 1-char type badge (Q / D / · for question / decision / task) + title + status pill + due date. Hidden entirely when zero matches — pages where the couple hasn't linked anything yet stay clean.

**Wiring.** Each of the three pages adds one `db.navTag.findFirst({ where: { route: <pathname> } })` to its existing `Promise.all`, then a follow-up `db.task.findMany({ where: { navTags: { some: { id: navTagForPage.id } } } })` only when a tag is found (defensive — couple could have deleted the seeded tag from Settings → Nav tags). Strip renders just below `PageHeader` (and below `SeatingTabs` on the ceremony page).

Pages touched:

- `src/app/(app)/songs/page.tsx` — Music nav tag → `/songs`
- `src/app/(app)/seating/ceremony/page.tsx` — Ceremony nav tag → `/seating/ceremony`
- `src/app/(app)/guests/page.tsx` — Guests nav tag → `/guests` (active view only; archived view stays clean)

**No schema changes, no migration, no new server actions.** Pure read-side wiring on top of the v1.30.5 NavTag/Task m2m. The `PageLinkedTasksStrip` component is generic enough that future pages (Suppliers, Budget, etc.) can adopt the strip with one Promise + one render line if a corresponding nav tag exists.

**Verified.** typecheck clean · lint clean · 555 tests · production build clean.

Files: `src/components/ui/PageLinkedTasksStrip.tsx` (new), `src/app/(app)/songs/page.tsx` (load + render), `src/app/(app)/seating/ceremony/page.tsx` (load + render), `src/app/(app)/guests/page.tsx` (load + render), `package.json` → `1.52.0`.

### 2026-05-01 · v1.51.0 — Inline task linking on cards

User: "8". Backlog #8 — tasks linkable to individual cards (subsections), inline below each card. Three implementation candidates were enumerated in the older backlog: (1) parallel m2m alongside section link, (2) replace section link with subsection link + roll up, (3) bucket via metadata. Recommendation was option 1. Shipping (1).

**Schema** (`prisma/schema.prisma`).

`Task.bookSubsections: BookSubsection[]` — implicit Prisma m2m, lives alongside the existing `Task.bookSections: BookSection[]`. Section-level link is the broader "this task touches Food & Drink" grouping; subsection-level is the precise "this task is about the Wedding-breakfast MENU card". They coexist; a task can link to either, both, or neither.

Back-relation `BookSubsection.tasks: Task[]` for the read side.

Migration `20260505000000_task_book_subsection_m2m/migration.sql` is purely additive: one `CREATE TABLE _BookSubsectionToTask` + index on `B` + two `ON DELETE CASCADE` FKs. Standard Prisma implicit-m2m shape.

**Form** (`TopicPicker.tsx`).

The combined Topics multi-select gains a third group: **"Wedding Book — cards"**. Each option label reads `<Card title>` with the parent section title in muted type on the right (e.g., `Wedding breakfast` · `Food & Drink`) so two cards with the same name on different pages stay unambiguous. Hidden inputs emit `bookSubsection:<id>` keys alongside the existing `bookSection:<id>` and `navTag:<id>` keys.

Selected card chips render in a slightly lighter moss tint than section chips so the relationship is visually distinct in the chip strip.

**Server actions** (`tasks/actions.ts`).

`parseTopicKeys` now also extracts `bookSubsectionIds`. `createTask` connects them; `updateTask` does the same `set:` replacement pattern as `bookSections`. Audit metadata gains `bookSubsectionIds`. The `changedFields` diff on update includes `bookSubsections` when the set changes. Both create + update revalidate `/book` so the inline panel re-renders.

**Read side** (`book/[slug]/page.tsx` + `CardRouter.tsx`).

Page loads tasks linked to any subsection on the page in one query (`bookSubsections: { some: { id: { in: subsectionIds } } }`), buckets them client-side by `subsectionId` into a `Map<string, LinkedTaskRow[]>`, then passes each card's slice to `CardRouter` via a new `linkedTasks` prop.

`CardRouter` was a giant `switch` with one body per kind. Refactored to compute the body via a `renderCardBody` helper, then wrap once with `<>{body}{linkedTasks.length > 0 && <CardLinkedTasksPanel />}</>` — every kind gets the panel below for free, no per-branch wrapping.

The new `CardLinkedTasksPanel` is a compact section that visually hugs the card it sits below — `mt-2 -mx-px border-x border-b border-border-soft bg-canvas/40 rounded-b-md` so it reads as part of the same surface. One row per task with a 1-char type badge (Q / D / · for questions / decisions / tasks), title, status pill, and due date. "Manage →" link to `/tasks` for editing. Hidden entirely when no tasks are linked (empty cards stay clean).

**Threading.** `bookSubsections` flows from page loaders → `AddTaskToggle` / `TaskList` → `TaskForm` / `TaskDrawer` → `TopicPicker`. The Task row shape on `TaskList` and `TaskDrawer` gains an optional `bookSubsections?: Array<{ id, title, sectionTitle }>` so older callers that don't load it still typecheck. Both `/tasks` and `/questions` page loaders fetch the flattened subsection list (`{ id, title, sectionTitle }`).

**No tests added.** This is data plumbing on top of existing patterns — the audit-format pretty-printer doesn't change (the existing `update`/`create` patterns surface the relation IDs unchanged), and the new TopicPicker option group is parallel to existing groups already covered by manual review during development. The shape changes are all caught by typecheck.

**Verified.** typecheck clean · lint clean · 555 tests · production build clean.

Files: `prisma/schema.prisma` (Task.bookSubsections + back-relation), `prisma/migrations/20260505000000_task_book_subsection_m2m/migration.sql`, `src/app/(app)/tasks/TopicPicker.tsx` (third group + chip styling), `src/app/(app)/tasks/TaskForm.tsx` (BookSubsectionOpt re-export + threading), `src/app/(app)/tasks/TaskDrawer.tsx` (Task shape + state + topicKeys emit), `src/app/(app)/tasks/AddTaskToggle.tsx` (prop + default), `src/app/(app)/tasks/TaskList.tsx` (prop pass-through), `src/app/(app)/tasks/actions.ts` (parseTopicKeys + create/update + revalidate /book), `src/app/(app)/tasks/page.tsx` + `src/app/(app)/questions/page.tsx` (load subsections), `src/app/(app)/book/[slug]/page.tsx` (load + bucket subsection tasks), `src/app/(app)/book/[slug]/CardRouter.tsx` (renderCardBody refactor + CardLinkedTasksPanel), `package.json` → `1.51.0`.

### 2026-05-01 · v1.50.0 — Numeric sign-in code

User: "6". Backlog #6 — numeric auth code at sign-in. Three design alternatives were enumerated in the older backlog: (a) Email OTP, (b) TOTP authenticator-app MFA, (c) SMS code. Recommendation in the doc was (a). Shipping (a) — but **alongside** the magic link, not replacing it. Both paths use the same token, both sign you in.

**The same token does double duty.** Auth.js's `EmailProvider.generateVerificationToken` callback now returns a 6-digit numeric code instead of a UUID. The token is written to the `VerificationToken` table (managed by `PrismaAdapter`) keyed by `(identifier, token)`. The magic-link URL embeds the same token in its query string. So:

- **Click the magic-link button** → Auth.js's `/api/auth/callback/nodemailer` validates the token + signs you in. Same flow as before.
- **Type the code on `/signin/verify`** → server action validates against `db.verificationToken.findUnique({ where: { identifier_token } })`, then redirects to the *exact same* callback URL with the code as the token. Auth.js then validates again, deletes the token, and signs the user in. Identical post-validation path — bootstrap-as-couple, audit-row, session cookie, redirect — all unchanged.

**TTL tightened.** Default token lifetime was 24h. A 6-digit code has only 1M possible values, so a long window is a brute-force vulnerability. `EmailProvider.maxAge` is now `15 * 60` seconds. The magic link inherits this same TTL — clicking a 4-hour-old link now fails too. That's an acceptable trade — wedding admin sign-ins happen interactively, not over days.

**Rate limit on guesses.** New `bucket: "guess"` parameter on `checkAndRecordAttempt`. Reuses the existing `MagicLinkAttempt` table by prefixing the identifier with `verify:` so guess counts don't bleed into send counts. Limits: 5 wrong guesses per 15 minutes per email; 6th guess is blocked with a `retryAfterSec` value calculated from when the oldest in-window guess rolls out. Failed guesses *do* count against the quota (unlike send attempts where only successful sends are recorded).

**Email template.** Surfaces the 6-digit code in a large monospace block above the magic-link button:

```
SIGN-IN CODE
 1 2 3 4 5 6

…or tap the button to sign in directly:
[ Sign in to Wedding Hub → ]
```

Subject line includes the code (`Your Wedding Hub sign-in code: 123456`) so it's visible in notification toasts on locked phones — no need to open the email if you're typing the code on the same device.

**Verify page.** Rewritten from a static "check your inbox" placeholder to a code-entry form with a 6-digit input pattern (`inputMode="numeric"`, `autoComplete="one-time-code"` so iOS surfaces the code from the SMS-strength heuristic on its keyboard). Email field pre-fills from a short-lived `signin-email` cookie set by the signin page. Error states cover bad code, invalid format, expired, and rate-limit-exceeded with a human "try again in N minutes" message.

**Audit. **New `VerificationToken`-entity patterns: `signin_code_succeeded`, `signin_code_failed` (with `reason: "no_match" | "expired"`), `signin_code_rate_limited` (with `retryAfterSec`). The audit-format pretty-prints these as `Sign-in code accepted for foo@example.com` etc. so a security review reads naturally. 4 new tests cover the patterns; 3 new tests cover the verify-bucket rate-limit math.

**No schema migration.** `VerificationToken` already exists (managed by `PrismaAdapter`). `MagicLinkAttempt` already exists (added with the original rate-limit). The bucket distinction lives in the prefix, not in a new column.

**Verified.** typecheck clean · lint clean · 555 tests (548 → 555; +3 rate-limit + 4 audit-format) · production build clean.

Files: `src/auth.ts` (new `generateOtpToken`, `generateVerificationToken` callback, `maxAge: 15*60`, email template surfaces code, subject includes code), `src/lib/rate-limit.ts` (`bucket` param + `recordFailedGuess` + `VERIFY_LIMIT_*` constants), `src/app/signin/page.tsx` (sets `signin-email` cookie + button copy), `src/app/signin/verify/page.tsx` (rewrite — code-entry form + server action), `src/lib/audit-format.ts` (`VerificationToken` patterns + entity label), `tests/unit/rate-limit.test.ts` (3 new), `tests/unit/audit-format-enrichment.test.ts` (4 new), `package.json` → `1.50.0`.

### 2026-05-01 · v1.49.0 — Per-guest group affordances

User: "Let me add a group to a guest, let me add it in any and all relevant places that depend on groups". Until v1.49.0, group memberships could only be edited from one place — Settings → Guest groups → click a group → tick guests in a checkbox grid. That's "per-group" management; "per-guest" management was missing entirely.

**New reusable component** `src/components/ui/GuestGroupsControl.tsx`. Renders the guest's current group memberships as colour-tinted chips and (in edit mode) exposes a popover picker with a checkbox row per available group. Closes on click-outside via a `pointerdown` listener (matches native menu behaviour). Two sizes: `sm` (default — pill-strip rows) and `md` (detail-page sections).

The component reuses the existing `toggleGuestGroupMember` server action — no new endpoint, no new audit code path. The popover talks to the same couple-only gate (`requireCoupleEditor`); non-couple readers see chips but no edit affordance.

**Three wiring points:**

1. **Guests list** (`HouseholdBlock.tsx`) — inserted into each guest row's pill strip after the song-request count. Hidden entirely when no guest groups are defined AND the guest isn't in any (so the strip stays clean for early-stage planners). Page query extends `guests.include` with `groups: { select: { id: true } }` and adds a top-level `db.guestGroup.findMany` for the picker options. Both reads sit alongside the existing household fetch in the same `Promise.all`.

2. **Guest detail page** (`/guests/[id]/page.tsx`) — added as a row in the existing read-only Details `<dl>`. Uses size `md` for the bigger chip rendering. Editable when `editable === true` (matches the rest of the page).

3. **Seating canvas detail panel** (`GuestDetailPanel.tsx`) — read-only chip strip in the existing dietary/notes section. The panel is intentionally read-only (existing v1.27.7 design — editing is on `/guests/[id]`); chips display memberships at a glance during seating planning. The "Open record →" link still covers the full edit path.

**Data threading.** `AllGuest` type gains `groupIds?: string[]` (optional so existing callers in `AllGuestsPanel` keep working). `SeatingClient` + `SeatingCanvas` thread an `allGuestGroups` prop through to `GuestDetailPanel`. The seating page's `Promise.all` query loads `groups: { select: { id: true } }` per guest plus a separate `db.guestGroup.findMany` for the picker options.

**Read-only-mode guard.** `GuestGroupsControl` checks `canEdit` before rendering the picker affordance. With `canEdit={false}` and zero memberships, it renders nothing. The seating detail panel takes advantage of this: the chip strip is wrapped in `{guest.groupIds && guest.groupIds.length > 0 && (...)}` so non-grouped guests don't get an empty "Groups" header.

**No schema changes, no migration, no new server action.** v1.49.0 is purely UI threading on top of the v1.42.0 + v1.48.0 group model. The same data the Settings checkbox grid mutates is now visible and editable from three other surfaces.

**Verified.** typecheck clean · lint clean · 548 tests · production build clean.

Files: `src/components/ui/GuestGroupsControl.tsx` (new), `src/app/(app)/guests/page.tsx` (load groups + threads through), `src/app/(app)/guests/GuestList.tsx` (prop pass-through), `src/app/(app)/guests/HouseholdBlock.tsx` (chip strip in row + Guest type + GuestRow signature), `src/app/(app)/guests/[id]/page.tsx` (Details row + load groups), `src/app/(app)/seating/page.tsx` (load groups + groupIds per guest), `src/app/(app)/seating/SeatingClient.tsx` (`allGuestGroups` prop + AllGuest.groupIds), `src/app/(app)/seating/SeatingCanvas.tsx` (prop pass-through), `src/app/(app)/seating/GuestDetailPanel.tsx` (read-only chip strip), `package.json` → `1.49.0`.

### 2026-05-01 · v1.48.0 — Auto-fill from ordered groups

User: "Can we order groups, so I assign a group to seats, it fills then assigns the next group, options should also accommodate bride, groom and both side constraints".

Replaces v1.46.0's per-row manual assignment model with a single ordered-list mental model: define groups with side constraints, order them by priority, the allocator does the rest.

**Schema** (`prisma/schema.prisma`).

`GuestGroup.side: Side @default(BOTH)` — reuses the existing `Side` enum (`BRIDE | GROOM | BOTH`) used for `Guest.side`. Migration `20260504000000_guest_group_side` is a single `ALTER TABLE ADD COLUMN` with default `'BOTH'` so existing rows retain their behaviour without a backfill.

`CeremonyRow` model is marked deprecated in the schema commentary but **preserved one release** as a recoverability buffer (per the v1.30.5 standing pattern). The seating canvas no longer reads from it; the allocator drives everything from `GuestGroup.order` + `side` + `_count.members`.

**Pure allocator** `src/lib/ceremony-allocate.ts`.

`allocateCeremony(groups, layout)` returns a `Map<SeatKey, SeatFill>` plus per-group totals (filled count, shortfall) and unfilled-side counts. Algorithm:

1. Sort groups by `order` ascending (ID tie-break for determinism).
2. For each group, walk its eligible side(s):
   - **BRIDE** → LEFT only, packed front-to-back, aisle-outward (rightmost seat backward).
   - **GROOM** → RIGHT only, packed front-to-back, aisle-outward (seatIndex 0 forward).
   - **BOTH** → fill whichever side has more remaining capacity at each step. Tie goes to LEFT (matches "front-and-aisle first" preference).
3. Take `min(remaining, capacity)` consecutive seats. Anything left over is the group's shortfall.

14 unit tests cover BRIDE-LEFT-only, GROOM-RIGHT-only, BOTH balancing, ordering (input order doesn't matter, only `order` field), front-row aisle-outward direction, multi-row overflow, shortfall when capacity exhausted, zero-member edge case.

**Server actions** (`src/app/(app)/settings/guest-group-actions.ts`).

`createGuestGroup` + `updateGuestGroup` now accept a `side` field (defaults to `BOTH`). `updateGuestGroup` includes `side` in the `changedFields` audit metadata.

New `reorderGuestGroup({ id, direction: "up" | "down" })` — swaps the group's `order` value with the adjacent group on the chosen direction. No-op at the edges. Couple-only, audited with `{ name, direction, neighbourName }` so the audit log reads `Moved guest group "Spencer extended family" up (swapped with "Olwyn-Davis extended family")`.

**Settings UI** (`GuestGroupsBlock.tsx`).

Each custom group row gains:
- ▲ / ▼ reorder buttons on the left (disabled at the edges)
- Side chip (uppercase "Bride" / "Groom" / "Both") tinted rose / moss / neutral

The edit form gains a Side dropdown above the colour picker.

**Ceremony page** (`CeremonyClient.tsx`).

Replaces the v1.46.0 Row Assignments panel with a **Group Order** panel — couple-only, lists groups in `order` ascending with reorder buttons, side chip, and a `seated/memberCount` chip per group (tinted marigold when shortfall > 0). The legend below the SVG also shows the side chip + seating progress.

Canvas drops the spare-seat rendering from v1.47.0 — every seat is either filled (group colour + glyph) or neutral (moss palette). Spare seats no longer make sense in the auto-fill model; the allocator just stops when groups run out of members, leaving the rest neutral.

**Seed.** Olwyn-Davis extended family seeded with `side: BRIDE`; Spencer extended family with `side: GROOM`. The ceremony canvas immediately shows the bride's family on the left, the groom's on the right, with the front rows tinted by colour. `seedCeremonyRowAssignments` is no longer called from `main()` (kept as a function for one release).

**Audit format.** New pattern for `reorder` action under `GuestGroup` entity. 2 new tests.

**Verified.** typecheck clean · lint clean · 548 tests (532 → 548; +14 ceremony-allocate, +2 audit-format) · production build clean.

Files: `prisma/schema.prisma` (Side on GuestGroup), `prisma/migrations/20260504000000_guest_group_side/migration.sql`, `src/lib/ceremony-allocate.ts` (new), `tests/unit/ceremony-allocate.test.ts` (new, 14 cases), `src/app/(app)/settings/guest-group-actions.ts` (side + reorder), `src/app/(app)/settings/GuestGroupsBlock.tsx` (side picker + reorder buttons + side chip), `src/app/(app)/settings/page.tsx` (thread side through), `src/app/(app)/seating/ceremony/page.tsx` (load groups instead of rows), `src/app/(app)/seating/ceremony/CeremonyClient.tsx` (rewrite using auto-fill + GroupOrderPanel), `src/lib/audit-format.ts` (reorder pattern), `prisma/seed.ts` (set side on seeded groups; drop CeremonyRow seed call), `package.json` → `1.48.0`.

### 2026-05-01 · v1.47.0 — Seat allocation from member count

User: "On the ceremony seating, I want it to calculate the number of guests in the group and fill up the seats based on that".

v1.46.0 tinted whole rows with the assigned group's colour regardless of how many members the group actually had — an 8-seat row looked the same whether the group had 5 members or 25. v1.47.0 packs each group's members across its assigned rows aisle-outward so the canvas shows actual fill, with three seat states:

- **Filled** — full group colour + white-on-tint glyph (a real member sits here)
- **Spare** — group colour at 30% opacity with a dashed outline, no glyph (assigned but the group ran out of members)
- **Neutral** — moss palette (unassigned row)

**Algorithm.** For each group: walk its row assignments front-to-back (LEFT before RIGHT within the same row), pack each row aisle-outward, fill `min(remaining, capacity)`. Remaining members past the last assigned row become a **shortfall** (legend flags it marigold: "N won't fit — assign more rows"). Spare seats accumulate a **surplus** count (legend reads "N spare").

**Aisle convention.** LEFT side: aisle is at the right edge — pack from the rightmost seat backward. RIGHT side: aisle at the left edge — pack from seatIndex 0 forward. So an 8-seat LEFT row with 5 members fills seats 3–7; the same row on the RIGHT fills 0–4.

**New pure module** `src/lib/ceremony-fill.ts`. Exports `allocateGroup` (per-group), `allocateAll` (map keyed by group id), and `resolveSeat` (single-seat fill resolution). All inputs are plain shapes (no Prisma) so unit tests don't need a fixture DB. 16 new tests covering: exact / under / over fills, multi-row overflow, LEFT-before-RIGHT ordering within a row, ignoring other groups, zero-assignments, zero-members, mixed left+right capacities, aisle-outward packing on each side, neutral / filled / spare colour-glyph payloads.

**Canvas changes** (`CeremonyClient.tsx`). `SeatDot` now takes a `SeatFill` discriminated union and renders three visual states. Spare seats use `fillOpacity={0.3}` + dashed stroke so they look "reserved but empty" without competing visually with filled seats. Tooltip on each circle reads the group name (and "(reserved, no member)" for spare).

**Legend** (below the SVG) is now a vertical list, one row per group, with: swatch · name · "X of Y guests seated · Z seats reserved · K spare" (or "K won't fit — assign more rows" in marigold when shortfall > 0). Lets the couple see at a glance whether the allocation balances.

**Row Assignments panel** gains a `filled/capacity` chip per assigned row (e.g., `8/8`, `4/8`) so they can pace overflow as they assign rows ("front row is full, second row is half-full — that's right for 12 guests").

**Schema.** Unchanged — allocations are computed at render time from the existing `CeremonyRow` rows + `GuestGroup._count.members`.

**Verified.** typecheck clean · lint clean · 532 tests (516 → 532; +16 ceremony-fill) · production build clean.

Files: `src/lib/ceremony-fill.ts` (new), `tests/unit/ceremony-fill.test.ts` (new, 16 cases), `src/app/(app)/seating/ceremony/CeremonyClient.tsx` (SeatDot three-state rendering, Legend with allocation totals, RowList with per-row fill chip), `package.json` → `1.47.0`.

### 2026-05-01 · v1.46.0 — Group-coloured ceremony seating

User: "Lets go number 5". Backlog item #5 — group-coloured ceremony seating, foundation laid in v1.42.0 (`GuestGroup.colour` field + custom guest groups seeded with hex colours).

The right shape for this is **row-level assignment**, not per-seat. Ceremony seating is allocated by row in real life — "front row left = immediate family, second row left = aunts & uncles, etc.". Per-seat granularity would require building reception-style drag-and-drop seating from scratch; per-row maps cleanly onto the existing layout config without that lift.

**Schema** (`prisma/schema.prisma`).

New `CeremonyRow` model: `(side, rowIndex, guestGroupId?, notes?)`. `(side, rowIndex)` is unique — one assignment per row. `side` stored as String (`"LEFT" | "RIGHT"`) not enum to keep labelling configurable in future without a migration. `guestGroupId` is an optional FK to `GuestGroup` with `ON DELETE SET NULL` — deleting a group clears the row assignment but never deletes the row record itself; the canvas falls back to the neutral fill. Index on `guestGroupId` for the legend's "rows used" lookup.

`GuestGroup` gains a `ceremonyRows: CeremonyRow[]` back-relation so the legend can count rows per group without a second query.

Migration `20260503000000_ceremony_row_groups/migration.sql` is purely additive: one `CREATE TABLE` + unique index + lookup index + FK constraint.

**Server action** (`src/app/(app)/seating/actions.ts`).

New `setCeremonyRowGroup({ side, rowIndex, guestGroupId, notes? })`. Behaviour:

- Bounds check against `CeremonySeating.leftRows` / `rightRows` — out-of-range row indices reject with a clear error (defensive belt-and-braces; UI doesn't render those rows but a forged client could try).
- Resolves the group's display name + colour for the audit row before writing, and rejects if the FK target doesn't exist.
- When `guestGroupId === null` and no notes — deletes the row entirely (no row = no colour tint).
- Otherwise upserts against the `(side, rowIndex)` unique constraint.
- Audit metadata: `{ side, rowIndex, guestGroupId, groupName, groupColour, notes }` with action `"ceremony-row-assign"` or `"ceremony-row-clear"`.

Couple-edit gated via the existing `requireEdit("seating")`.

**Canvas** (`src/app/(app)/seating/ceremony/CeremonyClient.tsx`).

The SVG was just a grid of generic moss-green dots before. Now each row resolves through a `rowFill(side, rowIndex)` helper that returns the assigned group's colour + a single-character glyph (first letter of the group name, uppercased, in white on the dot). Falls back to the neutral moss palette when the row is unassigned. Seat radius bumped from 14 to 18 so the glyph is legible at typical zoom levels. Each dot's `<title>` carries the full group name for SVG hover tooltips.

The new **Legend** below the canvas lists every group used in row assignments with its colour swatch, name, "N rows", and member count from the GuestGroup. Hidden when no rows are assigned (replaced by an inline hint pointing at the Row Assignments panel below).

The new **Row Assignments panel** is the editor — couple-only. Two columns (Left side / Right side), each row 0..N-1 listed with a swatch + dropdown to assign or clear. Row 0 is labelled `Row 1 (front)` so the human numbering matches what the couple says aloud. Empty state: "No guest groups exist yet — add one in Settings to start colour-coding rows" with a deep link to Settings.

**Seed** (`prisma/seed.ts`).

New `seedCeremonyRowAssignments()` — idempotent. Pre-seeds two example rows on a fresh DB so the canvas immediately shows the colour-coded shape:

- Left side, row 0 → Olwyn-Davis extended family (#c79a91, bride's side rose)
- Right side, row 0 → Spencer extended family (#7c9c8f, groom's side sage)

Skips writing if the (side, rowIndex) row already exists, so manual edits via the Settings UI survive a `db:seed` rerun.

**Audit format** (`src/lib/audit-format.ts`).

New `CeremonyRow`-entity patterns: `Assigned left row 1 to "Olwyn-Davis extended family"` and `Cleared right row 5`. Critically the row index is **1-based** in the audit log — the schema is 0-indexed but the human-facing audit row should match what the couple sees in the UI ("Row 1 (front)").

Entity label map gains `CeremonyRow: "ceremony row"` for the entity column.

**Tests.** `tests/unit/audit-format-enrichment.test.ts` gains 3 cases for the new patterns: assign with side + row + group; clear with side + row; 0→1 indexing edge case (rowIndex 7 displays as row 8). 516 tests pass (513 → 516).

**Open design questions from the v1.42.0 ROADMAP entry, addressed here:**

- *Q9 default group palette + custom colours.* GuestGroup.colour is a free hex picker (v1.42.0); default seeded values (#c79a91 / #7c9c8f) demonstrate.
- *Q10 colour-blind accessibility — small text or icon hint per seat.* Glyph (first letter of group name) overlays each tinted seat in white. Same pattern as the reception canvas's RSVP-status glyphs.
- *Q3 auto-pack vs manual overrides.* Skipped — neither auto-packing nor per-seat overrides shipped. Per-row assignments are the granularity for now; per-seat can layer on later if needed.
- *Q1 m2o vs m2m.* The v1.42.0 schema went m2m for `Guest.groups`, but `CeremonyRow.guestGroup` is m2o (one group per row). That matches the row-level allocation semantics.

**Verified.** typecheck clean · lint clean · 516 tests · production build clean.

Files: `prisma/schema.prisma` (new `CeremonyRow` model + `GuestGroup.ceremonyRows` back-relation), `prisma/migrations/20260503000000_ceremony_row_groups/migration.sql`, `src/app/(app)/seating/actions.ts` (new `setCeremonyRowGroup`), `src/app/(app)/seating/ceremony/page.tsx` (load rows + groups in parallel), `src/app/(app)/seating/ceremony/CeremonyClient.tsx` (canvas tint + glyph + legend + Row Assignments panel), `src/lib/audit-format.ts` (entity label + new patterns), `prisma/seed.ts` (`seedCeremonyRowAssignments`), tests, `package.json` → `1.46.0`.

### 2026-05-01 · v1.45.2 — Role select + directive copy

User: "Why can't I edit members here?" — pointed at the Couple built-in group's member list which read "computed from each user's role; not editable here". The opaque message left a dead end: the user could see the membership but couldn't tell where to change it. Two fixes.

**Role select in the per-user editor.** `MemberOverridesBlock` cards gain a Role dropdown alongside the couple checkbox: Wedding party / Planner / Viewer. Changing it calls a new `setUserRole(userId, role)` server action which flips `User.role` and re-resolves built-in group membership on next render. The dropdown is disabled when the user has couple-tier (their role is implicitly COUPLE; revoke couple-tier first to edit role). Excludes COUPLE from the option list — that's managed via the dedicated checkbox so the two fields can't get out of sync.

`setUserRole` carries the same last-couple lock as `setUserCouple` and `removeUser`: if the target is currently couple-tier and they're the only remaining one, the action throws with a `last_couple_locked` audit row. Couple-only via `requireCoupleEditor`.

**Directive copy on built-in member lists.** Each of the four built-ins gets its own per-slug guidance line under the member list:

- *Everyone:* "Everyone with an account is automatically here. Use the Members & per-user overrides panel below to remove a user entirely."
- *Couple:* "Members are users with couple-tier access. Toggle the Couple-tier checkbox on a user's card in the Members & per-user overrides panel below."
- *Wedding party (by role):* "Members have role = Wedding party. Change a user's role in the Members & per-user overrides panel below."
- *Planners (by role):* "Members have role = Planner. Change a user's role in the Members & per-user overrides panel below."

Replaces the previous one-liner that just said "not editable here" — now every built-in points at the right control.

**Audit format.** New `User`-entity pattern for `set-role` action: `Set role to PLANNER (was WEDDING_PARTY) for Aimee Hollingsworth`. Falls back to email when name is missing.

**Tests.** `tests/unit/audit-format-enrichment.test.ts` gains 2 cases for `set-role` (with prior role + user identity + fallback). 513 tests pass (511 → 513).

**Verified.** typecheck clean · lint clean · 513 tests · production build clean.

Files: `src/app/(app)/settings/actions.ts` (new `setUserRole`), `src/app/(app)/settings/MemberOverridesBlock.tsx` (Role select + handler), `src/app/(app)/settings/PermissionGroupsBlock.tsx` (per-slug directive copy), `src/lib/audit-format.ts` (new pattern), tests, `package.json` → `1.45.2`.

### 2026-05-01 · v1.45.1 — Last-admin lock + name disambiguator

User: "How do I add and remove users from groups? Admin should stay locked as admin". Plus a screenshot showing two "Jamie Spencer" rows in the Everyone built-in member list — same display name, two different User accounts.

Two safety + clarity fixes.

**Last-admin lock.** Before: `setUserCouple(targetId, false)` had a self-protection guard ("you can't change your own couple flag") but nothing stopped one couple member from revoking another's flag. If two couple admins were the only admins, they could revoke each other in quick succession and leave the running session with zero admins until next sign-in (where the bootstrap auto-promote at `src/auth.ts:91` kicks back in — but that doesn't help anyone already signed in).

After: both `setUserCouple` (when revoking) and `removeUser` (when target is couple-tier) check the total couple count. If `<=1`, the action throws with a clear message and writes a `settings_denied` audit row with `reason: "last_couple_locked"`. Server-side enforcement so a forged client request still fails. UI in `MemberOverridesBlock` shows a 🔒 chip next to the "Couple" badge and disables both the couple checkbox and the remove × button when the user is the last couple. Tooltip: *"Locked — last couple-tier admin. Promote another user first."*

**Duplicate-name disambiguator.** Member lists were rendering only `displayName(user)`, so two accounts named "Jamie Spencer" looked identical. Now `email` is surfaced next to the name in muted type — both in the built-in member list (couple-only read-only view) and the per-group member-toggle list. Email is unique per `User` row so the couple can identify which is which and decide which to keep.

Files: `src/app/(app)/settings/actions.ts` (server guards in `setUserCouple` + `removeUser`), `src/app/(app)/settings/MemberOverridesBlock.tsx` (lock UI on last couple), `src/app/(app)/settings/PermissionGroupsBlock.tsx` (email surfaced in member lists), `src/app/(app)/settings/page.tsx` (thread email through). No schema, no tests touched. typecheck + lint + 511 tests + build all green.

### 2026-05-01 · v1.45.0 — Per-user editor

User: "Refactor per user overirces, so theres space like on the group policies, also default overrides should be off, I also need to be able to assign members to permissions groups and remove them".

The dense PermissionMatrix table from v1.44.0 was the right model (checkbox-driven, max(group, override) resolver) but the wrong shape — a 6-row × 13-column table with tiny cells didn't match the airy spacing of `PermissionGroupsBlock`. Replaced with one expandable card per user, matching the visual rhythm of the rest of the page.

**New surface — `MemberOverridesBlock.tsx`.** One card per app user. Header line shows avatar + name + role + email + Couple chip + group count + override count + remove (×). Click to expand:

1. **Couple-tier toggle** — same gates as before (couple-only, can't toggle yourself).
2. **Group memberships** — read-only chip list of built-in groups the user qualifies for ("Couple", "Everyone", "Wedding party (by role)" — computed from `User.role` / `isCouple`), then a toggle list of every custom `PermissionGroup` with the user's current membership state. Ticking calls `togglePermissionGroupMember` (the same action the per-group view uses), so both views are consistent.
3. **Per-section overrides** — 12 sections in a 3-column grid, each row = section name + checkbox + (when ticked) VIEW/EDIT select / (when unticked) inherited level in muted type. Defaults are **off** — no `Permission` row exists on a fresh DB; the user inherits everything from their groups. Ticking writes the row; unticking deletes it via `clearPermission`.
4. **"Clear all overrides" button** — appears when the user has any override rows. Bulk-deletes everything via the new `clearAllUserOverrides` action. Useful migration path for users carrying legacy per-user rows from before v1.43.0 — one click drops them all so the user resolves to pure group inheritance.

The override count chip in the header is colour-tinted marigold when non-zero, with a tooltip "usually you want pure group inheritance" — gentle nudge that overrides are an exception, not a default.

**Server actions.**

- New `clearAllUserOverrides(userId)` — couple-only, audited with `{ cleared, sections }` (the prior level for every section that had a row, comma-joined for forensic recoverability). Idempotent: returns `{ ok: true, cleared: 0 }` for users with no rows.
- Existing `setPermission`, `clearPermission`, `togglePermissionGroupMember`, `setUserCouple`, `removeUser` all reused unchanged. The new block is the same wiring with a different layout.

**Audit format.** New `User` patterns for `permission-clear-all` action — surfaces `Cleared all per-user overrides (5 sections) — user inherits from groups now`, with proper singular/plural for one-section cases.

**Files removed.** `PermissionMatrix.tsx` deleted — fully replaced by `MemberOverridesBlock.tsx`. The two `PermissionMatrix` references that remained were comments referring to the old component, now updated to reference the v1.45.0 replacement.

**Tests.** `tests/unit/audit-format-enrichment.test.ts` gains 2 cases for `permission-clear-all` (5-section + 1-section pluralisation). 511 tests pass (509 → 511).

**Verified.** typecheck clean · lint clean · 511 tests · production build clean.

Files: `src/app/(app)/settings/MemberOverridesBlock.tsx` (new), `src/app/(app)/settings/PermissionMatrix.tsx` (deleted), `src/app/(app)/settings/actions.ts` (new `clearAllUserOverrides`), `src/app/(app)/settings/page.tsx` (compute `customGroupMembershipByUser` + `builtinKeysByUser`, pass to new block), `src/lib/audit-format.ts` (new pattern), tests, `package.json` → `1.45.0`.

### 2026-05-01 · v1.44.0 — Settings UX overhaul

User: "Indiviudal member permission override should be a checkbox, permissions should default to group unless check box is ticked. Also the settings page is getting busy, is there anything we can do to group and section certain settings".

Two related changes; one ship.

**Override matrix is now checkbox-driven.** Before: every cell was a NONE / VIEW / EDIT dropdown that was *always* an override, even when set to NONE (which the v1.43.0 resolver max-merges into a no-op anyway). After: each cell shows the user's group-inherited level by default — "View" or "Edit" or "—" in muted type. A checkbox sits next to it. Untick = inherits from groups (no `Permission` row exists). Tick = override active, with a VIEW / EDIT select beside it. NONE is dropped from the dropdown because it never affects the resolver outcome — `max(group, NONE) = group`.

Behind the scenes:

- New `clearPermission(userId, section)` server action — couple-only, audited. Deletes the per-user `Permission` row, idempotent on missing row. The resolver then reads no override and serves the group-inherited level.
- `setPermission` unchanged but the matrix only ever calls it with VIEW or EDIT.
- The page pre-computes `groupInherited[userId][section]` for every user × section using the same pure helpers (`groupKeysForUser` + `reduceGroupPermissions`) the runtime gates use, so the displayed "inherits" value is exactly what `canView` / `canEdit` will grant.
- Sensible default level when ticking: VIEW if the user inherited NONE, EDIT if they already inherit VIEW (the meaningful "boost above group" case). Couple-only sections render disabled with `—`. Couple-tier users render disabled with `Edit`.

**Settings page grouped under sections.** Was: 9 panels rendered in a stream with `space-y-4`. Now: panels grouped under five small uppercase section headings — *Your account · Wedding details · Customisation · Access & members · Notifications & log*. Each section uses a `SettingsSection` wrapper (small title + optional subtitle + body); the existing panel cards stay as-is so nothing about each panel changes.

The "Access & members" section is hidden entirely for non-couple viewers (the panels inside were already couple-gated; wrapping them in the section + hiding the heading too keeps the page cleaner for non-couple admins).

**Audit format.** New patterns for `User` entity: `Set per-user override on tasks → EDIT` and `Cleared per-user override on songs (was VIEW) — inherits from group`. Surfaces what was demoted and what level it had previously.

**Tests.** `tests/unit/audit-format-enrichment.test.ts` gains 3 cases for the new User patterns. Pure-decision resolver tests from v1.43.0 unchanged — the override semantics didn't move (deletion = absence of row = inherit from group, exactly what `mergeOverrides` already handles).

**Verified.** typecheck clean · lint clean · 509 tests pass (506 → 509) · production build clean.

Files: `src/app/(app)/settings/PermissionMatrix.tsx` (rewrote cell rendering as checkbox + inherited-level display), `src/app/(app)/settings/actions.ts` (new `clearPermission`), `src/app/(app)/settings/page.tsx` (compute `groupInherited`, group panels under `SettingsSection` headings), `src/lib/audit-format.ts` (User entity patterns), tests, `package.json` → `1.44.0`.

### 2026-05-01 · v1.43.1 — Settings UX patch

User report after v1.43.0 landed: "How do I add members to the groups, also settings page seems to have an infinite scroll".

Two fixes, one ship:

**Members button.** v1.40.0 hid the member-toggle UI behind clicking the group title (the small `▸` chevron). Discovery problem — nobody guesses that. Now every group row (built-in + custom) has an explicit `Members` button alongside the existing `Permissions` button, and built-in groups gain a read-only member list view (because the resolution rules are computed from `User.role`, but the user should still be able to see who's in each).

**Runaway-scroll feel on the override matrix.** The PermissionMatrix had a `<thead className="sticky top-0 z-20">` carried over from when it was the primary surface. v1.43.0 demoted it inside a parent card that already controls vertical layout. Two interactions made the page feel like it scrolled forever:

1. The inner `<div className="overflow-x-auto bg-surface border ... rounded-md shadow-sm">` was still applying card styling — visible double-border with the parent card.
2. `position: sticky` on the thead inside the parent's open/close transition was racing with layout calculations.

Dropped both: the inner `<div>` keeps `overflow-x-auto` only, and `<thead>` is no longer sticky. The matrix isn't the primary surface anymore (group permissions are), so a non-sticky header is fine.

Also trimmed the wall-of-text panel description from 4 sentences to 2.

Files: `src/app/(app)/settings/PermissionGroupsBlock.tsx`, `src/app/(app)/settings/PermissionMatrix.tsx`. No schema, no tests touched. typecheck + lint + 506 tests + build all green.

### 2026-05-01 · v1.43.0 — Group-driven permissions

User: "Can we work on permissions groups next, move away from single assigning perms per user, to permissions groups". Permissions are now a property of the **group**, not the user — members inherit. Per-user assignment becomes an override layer for one-off exceptions, kept for recoverability + flexibility but demoted to an "advanced" collapsed panel.

**Why.** With v1.42.0, `PermissionGroup` was just a bundle of users with no semantic weight beyond "pick these for the schedule attendee list". The right shape — and the way every IAM model works — is to attach permissions to the group, not the user. Adding a new wedding-party member used to mean opening 10 dropdowns; it now means ticking one checkbox.

**Schema** (`prisma/schema.prisma`).

- New `GroupPermission` table: `(groupKey, section, level)` with `@@unique([groupKey, section])`.
- `groupKey` is polymorphic — `"builtin:<slug>"` for the four virtual groups (everyone / couple / wedding-party-role / planners-role) or `"group:<slug>"` for a DB-backed `PermissionGroup`. Same reference format used by Schedule attendees + group-membership helpers, so the abstraction is consistent across the app.
- No FK to `PermissionGroup` because built-ins aren't stored as rows. Built-in slugs validated against `BUILTIN_GROUP_SLUGS`; custom slugs validated by lookup. Typos return `{ ok: false, error: ... }` rather than silently going nowhere.
- Existing per-user `Permission` table left intact as the **override layer** — no data migration, no risk of stripped access.

Migration `20260502000000_group_permissions/migration.sql` is purely additive: one `CREATE TABLE` + `(groupKey, section)` unique index + `groupKey` lookup index.

**Resolver** (`src/lib/permissions.ts`).

Effective level for a (user, section) pair, in increasing authority:

1. **Group permissions** — for every `groupKey` the user matches (`groupKeysForUser` returns built-in + custom matches), pull the rows and reduce by `maxLevel(...)`.
2. **Per-user overrides** — merge in `db.permission.findMany({ userId })` rows, taking `max(group, override)` per section. Override of NONE *never* lowers an inherited level — that's a critical correctness invariant; tested.
3. **Couple bypass** — `user.isCouple === true` short-circuits to `EDIT` before either lookup. Couple-only sections (budget / payments) still deny non-couple users regardless of group level.

The new pure helpers (`maxLevel`, `groupKeysForUser`, `reduceGroupPermissions`, `mergeOverrides`) all sit alongside the existing `canView` / `canEdit` so unit tests don't need a Prisma fixture.

**Settings UI** (`PermissionGroupsBlock.tsx` + `page.tsx`).

- Each group row (built-in + custom) gets a one-line **permission summary** ("EDIT: book, schedule · VIEW: songs · ..."), and a **"Permissions" toggle** revealing a 12-section grid of `NONE / VIEW / EDIT` segmented controls. Couple-only sections render disabled.
- Built-in groups are now editable for **permissions** even though their **membership** is still computed from `User.role` — same split as v1.42.0's guest groups (built-in members come from `Guest.side`, but custom colours are couple-set).
- Per-user `PermissionMatrix` collapsed inside `<details>` labelled "Per-user overrides (advanced) — set a level stronger than the user's groups give them". The framing copy in the section above explains overrides only stack on top of group inheritance; they can never strip access.

**Seed defaults** (`prisma/seed.ts` → new `seedGroupPermissions`).

- Couple → EDIT on all 12 sections (belt-and-braces; bypass already wins).
- Wedding-party-role → VIEW on tasks / schedule / songs / files / book.
- Planners-role → EDIT on every non-couple-only section.
- Everyone → no defaults (intentionally empty — permissions only flow from named groups).
- Idempotent — skips writing if a `(groupKey, section)` row already exists, so manual edits via Settings survive a `db:seed` rerun.

**Action + audit** (`permission-group-actions.ts`).

New `setGroupPermission({ groupKey, section, level })`, couple-only via `requireCoupleEditor()`. Validates the slug exists (built-in or DB-backed) before upserting. Audit metadata: `{ groupKey, groupName, section, level }` with action `"group-permission"`. New `audit-format.ts` pattern surfaces these as `Set permission group "wedding-party-role" → VIEW on schedule`.

**Tests.**

- `tests/unit/effective-permissions.test.ts` (new, 24 tests) — exhaustive on `maxLevel`, `groupKeysForUser` (built-ins + custom matches + declaration order), `reduceGroupPermissions` (max across multiple groups, NONE-as-literal), `mergeOverrides` (both-stronger-wins paths, override-never-lowers).
- `tests/unit/permissions.test.ts` — extended Prisma mock to cover `db.user.findUnique` + `db.permissionGroup.findMany` + `db.groupPermission.findMany`. New "v1.43.0 — group-driven inheritance" describe with 7 cases: built-in inheritance, custom-group inheritance, no-leak from groups the user isn't in, override stronger wins, NONE-override doesn't strip, couple-only deny stays, max-across-multiple-groups.
- `tests/unit/audit-format-enrichment.test.ts` — 2 new cases for the `group-permission` pattern.

**Verified.** typecheck clean · lint clean · 506 tests pass (476 → 506; +30 new) · production build clean.

**Foundation laid.** The next time someone asks "give the planners read-access to suppliers", it's one toggle on `builtin:planners-role` instead of N per-user rows. New users joining a group automatically inherit. The override layer stays for the inevitable "but Aimee specifically should also have…" cases.

Files:

- `prisma/schema.prisma` — new `GroupPermission` model, doc comment on the existing `Permission` table marking it as the override layer.
- `prisma/migrations/20260502000000_group_permissions/migration.sql` — additive.
- `src/lib/permissions.ts` — pure helpers + new `loadEffectivePermissions` resolver.
- `src/app/(app)/settings/permission-group-actions.ts` — new `setGroupPermission`.
- `src/app/(app)/settings/PermissionGroupsBlock.tsx` — permission summary + on-demand matrix.
- `src/app/(app)/settings/page.tsx` — load `GroupPermission` rows, bucket by `groupKey`, demote `PermissionMatrix` to collapsed details.
- `src/lib/audit-format.ts` — new `group-permission` pattern.
- `prisma/seed.ts` — `seedGroupPermissions` with sensible defaults on the four built-ins.
- Tests: `tests/unit/effective-permissions.test.ts` (new), updated `tests/unit/permissions.test.ts` + `tests/unit/audit-format-enrichment.test.ts`.
- `package.json` → `1.43.0`.

### 2026-05-01 · v1.42.0 — Permission groups + Guest groups split

User-flagged after v1.41.0 review: "there should be one group for permissions, this will be a permissions group used to set permissions that users will inherit. There will then be guest groups which are purely organisation related, for the ceremony seating plan, and other info needed across the website".

The v1.40.0 single `UserGroup` model conflated two genuinely different concepts. App users (5–6 admin accounts) need permission inheritance + scheduling. Wedding guests (~80 people in the `Guest` table) need organisational bundling for the seating plan, RSVP cohorts, after-party invites etc. Same word, very different cohorts.

**Two-model split:**

- `UserGroup` → `PermissionGroup`. Schema rename (table + indexes + relation + implicit m2m) preserves all data — the seeded "After-party" group survives intact. UI relabel "User groups" → "Permission groups".
- New `GuestGroup` model: `id`, `slug`, `name`, `description`, `colour`, `order`, m2m to `Guest`. Distinct from `Guest.tags` (flat ad-hoc hashtags) and `Guest.side` (BRIDE/GROOM/BOTH enum) — `GuestGroup` is structured, named, and optionally colour-coded.

**Migration `20260501000000_permission_groups_and_guest_groups`:** rename + new table + new implicit m2m. Structural-only — no data lost. `RENAME` is preferable here to a drop+recreate since the v1.40.0 ship landed real data on prod.

**Built-in virtual guest groups** computed from `Guest.side` at render time, not stored:
- `builtin:bride-side`
- `builtin:groom-side`
- `builtin:both-sides`

**Pure helpers** in [`src/lib/guest-group-members.ts`](src/lib/guest-group-members.ts) mirror the PermissionGroup pattern: `resolveBuiltinGuestGroup`, `resolveGuestGroupMembers`, `resolveGuestGroupMembersUnion`, `guestGroupsForGuest`, `guestDisplayName`. Reference format mirrors PermissionGroup: `builtin:<slug>` / `group:<slug>` / `guest:<id>`. Plus `normaliseHexColour` — accepts 3- or 6-digit hex with/without leading `#`, expands `#abc` → `#aabbcc`, returns `null` on invalid input. **24 unit tests** covering each helper.

**Server actions** — `permission-group-actions.ts` (renamed from `group-actions.ts`) and new `guest-group-actions.ts`. Same single-bulk-save pattern, both audit-enriched. P2002 surfaced as `"already exists"` for slug collisions.

**Settings UI** — couple-only, two stacked panels:

1. **Permission groups** — admin app users. Header copy explicit: "Bundle **app users** (the people who log in) together for picking schedule attendees, sending reminders, and (in future) per-section permission inheritance. For organising **wedding guests**, see the next panel."
2. **Guest groups** — wedding guests. Custom groups expand to a checkbox grid of all non-archived guests; each card has a colour swatch (`<input type="color">`) + hex input + Clear button. The colour swatch appears next to the group name in the list view so the couple can see at a glance which group has which colour.

**Seed** — example guest groups: "Spencer extended family" (sage `#7c9c8f`, all `side=GROOM` guests) and "Olwyn-Davis extended family" (rose `#c79a91`, all `side=BRIDE` guests). Idempotent per-slug skip.

**Audit format** — patterns rename `UserGroup → PermissionGroup` (sentences read "Added permission group …"). New `GuestGroup` patterns surface the colour on create + treat member-add/remove as guest-rather-than-user wording. **11 new audit-format tests**.

**Schedule + Today** — automatically pick up the rename via `db.permissionGroup` Prisma client — no behavioural change. The PermissionGroup-driven attendee picker on the schedule editor stays exactly as v1.41.0 left it.

**Foundation for backlog #5** (group-coloured ceremony seating): the colour now exists on each `GuestGroup`. The ceremony seating canvas can read each guest's group memberships and colour-code rows accordingly. Wiring lands in a follow-up ship when we tackle #5.

**Verification gate:** typecheck + lint + 476 unit tests + production build all green.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260501000000_permission_groups_and_guest_groups/migration.sql](prisma/migrations/20260501000000_permission_groups_and_guest_groups/migration.sql) · [src/lib/guest-group-members.ts](src/lib/guest-group-members.ts) · [tests/unit/guest-group-members.test.ts](tests/unit/guest-group-members.test.ts) · [src/app/(app)/settings/permission-group-actions.ts](src/app/(app)/settings/permission-group-actions.ts) · [src/app/(app)/settings/guest-group-actions.ts](src/app/(app)/settings/guest-group-actions.ts) · [src/app/(app)/settings/PermissionGroupsBlock.tsx](src/app/(app)/settings/PermissionGroupsBlock.tsx) · [src/app/(app)/settings/GuestGroupsBlock.tsx](src/app/(app)/settings/GuestGroupsBlock.tsx) · [src/app/(app)/settings/page.tsx](src/app/(app)/settings/page.tsx) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [tests/unit/audit-format-enrichment.test.ts](tests/unit/audit-format-enrichment.test.ts) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.41.0 — Schedule attendees rework (backlog #4)

Backlog item #4 — Schedule events stop tracking attendees as raw `User.id` arrays and switch to the polymorphic `attendeeRefs: String[]` pattern v1.40.0 introduced. An attendee ref is now one of:

- `user:<id>` — individual user
- `builtin:<slug>` — virtual group computed from `User.role` / `User.isCouple` (everyone / couple / wedding-party-role / planners-role)
- `group:<slug>` — DB-backed `UserGroup` row

This means the schedule editor picks at the right level of abstraction: "everyone" or "the wedding party" rather than re-enumerating individuals every time. When membership changes (a new wedding-party member joins), every event referencing `builtin:wedding-party-role` automatically picks them up — no editing required.

**Schema:** additive migration `20260430120000_schedule_attendee_refs`. `ScheduleEvent.attendeeRefs: String[]` added; backfilled by SQL from existing `attendeeIds` rows (`user:<id>` per id). The legacy `attendeeIds` column stays one release as a recoverability buffer per the v1.30.5 standing pattern; new writes go to `attendeeRefs`, and the existing `attendeeIds` is cleared on every update so the two don't drift.

**Pure helpers** added to `src/lib/group-members.ts`:

- `resolveGroupMembers` extended to handle `user:<id>` refs (in addition to v1.40.0's `builtin:` and `group:`).
- `resolveAttendeeRefs(event, users, customGroups)` — legacy-aware: prefers `attendeeRefs`, falls back to expanding `attendeeIds` as `user:<id>` for events that haven't been re-saved since the migration.
- `isAttendee(event, userId, users, customGroups)` — quick membership check used by the Today page's "Mine" filter to decide whether the current user counts as an attendee through any direct or indirect ref.

**13 new unit tests** covering the new ref kind, mixed-ref unions, attendeeRefs-vs-attendeeIds preference, indirect membership through built-ins / custom groups, and missing-ref tolerance.

**Server actions** — `createScheduleEvent` / `updateScheduleEvent` accept either `attendeeRefs[]` (new) or `attendeeIds[]` (legacy) on the form. New input is normalised to refs; new writes target `attendeeRefs` only. Update audit metadata gains an `attendeeKinds: { user, builtin, group }` breakdown so the audit log reads as `Added schedule event "Ceremony" — 1 group, 2 individuals` rather than just an opaque count.

**UI** — `EventForm` rewritten with two stacked picker rows: "Groups" (marigold chips) above "Individuals" (moss chips). Selected items have stronger fill so it's obvious whether a person was picked individually or via a group. Read views in `EventNode` + `ScheduleTable` render group refs as marigold chips with `👥` prefix to distinguish them from per-user chips at a glance.

**Today page "Mine" filter** — was a client-side `attendeeIds.includes(userId)` check; now precomputed server-side via `isAttendee()`. The card receives `isMine: boolean` per event and just filters. Empty refs continue to mean "everyone" (so unfiltered events show in everyone's "Mine" view).

**Seed updated** — schedule events switched from `coupleIds + partyIds + everyone` array building to declarative `attendeeRefs: ["builtin:everyone"]` etc. Cleaner; no User-id resolution needed at seed time.

**Verification gate:** typecheck + lint + 446 unit tests + production build all green.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430120000_schedule_attendee_refs/migration.sql](prisma/migrations/20260430120000_schedule_attendee_refs/migration.sql) · [src/lib/group-members.ts](src/lib/group-members.ts) · [tests/unit/group-members.test.ts](tests/unit/group-members.test.ts) · [src/app/(app)/schedule/actions.ts](src/app/(app)/schedule/actions.ts) · [src/app/(app)/schedule/EventForm.tsx](src/app/(app)/schedule/EventForm.tsx) · [src/app/(app)/schedule/EventNode.tsx](src/app/(app)/schedule/EventNode.tsx) · [src/app/(app)/schedule/ScheduleTable.tsx](src/app/(app)/schedule/ScheduleTable.tsx) · [src/app/(app)/schedule/ScheduleTimeline.tsx](src/app/(app)/schedule/ScheduleTimeline.tsx) · [src/app/(app)/schedule/ScheduleClient.tsx](src/app/(app)/schedule/ScheduleClient.tsx) · [src/app/(app)/schedule/AddEventToggle.tsx](src/app/(app)/schedule/AddEventToggle.tsx) · [src/app/(app)/schedule/page.tsx](src/app/(app)/schedule/page.tsx) · [src/app/(app)/page.tsx](src/app/(app)/page.tsx) · [src/app/(app)/TodayEventsCard.tsx](src/app/(app)/TodayEventsCard.tsx) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [tests/unit/audit-format-enrichment.test.ts](tests/unit/audit-format-enrichment.test.ts) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.40.0 — User-group model (backlog #3)

Backlog item #3 — the foundation for #4 (Schedule attendees rework). Adds a way to bundle users together for picking attendees, sending reminders, and (eventually) attaching permission overrides as a unit. Hence the original "permission-group" framing in the deferred backlog; the user-facing label is "User groups" because nothing in this ship hangs permissions off them yet.

**Schema** (additive only, no data migration):

```prisma
model UserGroup {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?  @db.Text
  order       Int      @default(0)
  members     User[]   @relation("UserGroupMembers")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Plus the back-relation on `User.groups`. Migration `20260430110000_user_groups`.

**Built-in virtual groups** — always exist, computed from `User.role` / `User.isCouple` rather than stored:

- `builtin:everyone` — all non-archived users
- `builtin:couple` — `User.isCouple === true`
- `builtin:wedding-party-role` — `User.role === "WEDDING_PARTY"`
- `builtin:planners-role` — `User.role === "PLANNER"`

These get surfaced in pickers alongside DB-backed custom groups. The reference format is intentionally typed: `builtin:<slug>` vs. `group:<slug>` so callers can never confuse a virtual group's name with a custom one even if a couple gives a custom group the same slug.

**Pure helpers** in [`src/lib/group-members.ts`](src/lib/group-members.ts):

- `resolveBuiltinGroup(slug, users)` → User subset for a built-in.
- `resolveGroupMembers(ref, users, customGroups)` → resolves either kind to a User[]. Unknown refs return `[]` (no throw — keeps callers tolerant of stale references).
- `resolveGroupMembersUnion(refs, users, customGroups)` → deduplicated union across many group refs, preserving first-seen order.
- `groupsForUser(userId, users, customGroups)` → list every group ref the user belongs to (built-ins + custom). Useful for "show this user's groups" UIs.
- `displayName(user)` → `firstName lastName` → `name` → `email` fallback chain so picker labels never come up empty.

**24 unit tests** cover each helper and edge case (missing user, malformed ref, dedupe order, role boundaries).

**Server actions** in `src/app/(app)/settings/group-actions.ts` — couple-only gated. `createUserGroup` / `updateUserGroup` / `deleteUserGroup` / `toggleUserGroupMember`. Slug auto-derives from name when blank, refuses any reserved built-in slug, P2002 surfaced as a clean "already exists" error. All audit-enriched per the v1.30.5 standing rule.

**Settings UI** — new `UserGroupsBlock` panel below the existing NavTagsBlock. Couple-only. Built-ins listed read-only with their member count. Custom groups expand to a checkbox grid of all users for quick toggle-on / toggle-off.

**Audit format** — five new patterns (`UserGroup` create / update / delete / member-add / member-remove). Sentences read as "Added 'Aimee Hollingsworth' to user group 'After-party'" or "Deleted user group 'After-party' (4 members unlinked)".

**Seed** — one example group ("After-party", slug `after-party`) connecting the COUPLE + WEDDING_PARTY users so a fresh DB shows what a custom group looks like in the UI without manual setup.

**Verification gate:** typecheck + lint + 430 unit tests + production build all green.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430110000_user_groups/migration.sql](prisma/migrations/20260430110000_user_groups/migration.sql) · [src/lib/group-members.ts](src/lib/group-members.ts) · [tests/unit/group-members.test.ts](tests/unit/group-members.test.ts) · [src/app/(app)/settings/group-actions.ts](src/app/(app)/settings/group-actions.ts) · [src/app/(app)/settings/UserGroupsBlock.tsx](src/app/(app)/settings/UserGroupsBlock.tsx) · [src/app/(app)/settings/page.tsx](src/app/(app)/settings/page.tsx) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.39.1 — Recent-activity feed

Backlog item #2 from the v1.39.0 deferred list. The audit-log enrichment that v1.39.0 just shipped makes every row read as a human sentence — that's the precondition that makes a real-time activity feed worth surfacing. Pre-v1.39.0 the rows were terse (`update Guest`); a feed of those would've been noise. Now `Set RSVP for "Aimee Hollingsworth" to attending` and `Updated payment "Venue balance" — amount, status` are scannable at a glance.

Lives on the Today page just below the cross-module strip. **Couple-only** — non-couple users see nothing rendered, and the database isn't even queried for them. Reads the most-recent 10 `AuditLog` rows, joins user name, renders each as `<timeAgo> <human-summary> · <user>`. Auto-hides on a freshly-seeded prod with empty audit log.

Two new pieces:

- **`src/lib/time-ago.ts`** — pure helper for relative-time strings (`just now` / `5 min ago` / `8 hr ago` / `yesterday` / `3 days ago` / `2 weeks ago` → falls through to a `dd Mon` short date past 6 weeks). Dependency-free; no `Intl.RelativeTimeFormat` / no `date-fns`. Clamps future timestamps (clock skew) to "just now". 9 unit tests covering every breakpoint.
- **`src/app/(app)/RecentActivityFeed.tsx`** — server component. Takes already-shaped rows + `isCouple` + optional `totalCount`. Renders `formatAuditAction(row)` (the v1.39.0 sentence) prefixed by `timeAgo(createdAt)` and suffixed by the user's name. Title attribute on each row carries the full `toLocaleString` timestamp for hover precision. Footer link routes to `/settings` for the full searchable log.

**Verification gate:** typecheck + lint + 401 unit tests + production build all green.

Files: [src/lib/time-ago.ts](src/lib/time-ago.ts) · [tests/unit/time-ago.test.ts](tests/unit/time-ago.test.ts) · [src/app/(app)/RecentActivityFeed.tsx](src/app/(app)/RecentActivityFeed.tsx) · [src/app/(app)/page.tsx](src/app/(app)/page.tsx).

### 2026-04-30 · v1.39.0 — Audit-log enrichment sweep

First post-arc backlog item shipped — the audit-log enrichment sweep across modules the Book Expansion arc didn't touch. Per the v1.30.5 standing rule "every audit row should carry snapshot fields + a `changedFields` diff on updates"; before this ship, 34 of the ~70 audit calls outside the Book module were still bare `{ entity, entityId }` only.

**Heatmap before / after:**

| Module | Total audits | Was enriched | Now enriched |
|---|---|---|---|
| budget | 5 | 0 | 5 |
| seating | 10 | 3 | 10 |
| songs | 9 | 3 | 9 |
| guests | 12 | 6 | 12 |
| suppliers | 12 | 6 | 12 |
| payments | 4 | 1 | 4 |
| files | 4 | 3 | 4 |
| tasks | 6 | 5 | 6 |
| schedule | 3 | 3 | 3 |
| **total** | **65** | **30** | **65** |

**Per-module changes:**

- **Budget** — money-sensitive. Every action now logs description + amount + category. Updates carry a `changedFields` diff (description / categoryId / estimated / actual / paid / supplierId / notes). Deletes snapshot the line/category before the row goes.
- **Seating** — Table create/delete logs name + capacity + occupied count. Position / capacity / notes / checklist updates carry table name + done-count / item-count where relevant. Seat assign/unassign logs `guestName` + `tableName` + `seatIndex` (so the audit reads "Seated Bryony at Top table seat 3"). CeremonySeating update gets totalSeats + changedFields. WeddingSettings seating-checklist / seating-notes log itemCount / doneCount / cleared.
- **Songs** — Playlist create/delete logs name + songCount + category. Song create/delete logs title + playlistName + artist. Song reorder logs delta + new order.
- **Guests** — Household create/update/delete logs name + side + guestCount. Guest create logs full identity snapshot. Guest update reuses the existing `changed` field-diff (which `lastEditedFields` already tracked) and includes it in the audit. Guest rsvp + restore now carry firstName + lastName.
- **Suppliers** — Supplier create logs name + category + status. Update has `changedFields` diff. Status change logs `previousStatus` so the audit shows "BOOKED (was QUOTED)". Delete snapshots cascade counts (contacts / contracts / payments). SupplierContact / SupplierContract / SupplierCommunication delete actions snapshot supplier name + relevant fields before the row goes.
- **Payments** — Money-sensitive surface. Create/update/delete logs description + amount + supplierName. Update has `changedFields`. Status change logs previous + new status alongside description + amount.
- **Files** — Delete now snapshots name / sizeBytes / folder / visibility (upload was already enriched).
- **Tasks** — answer action now snapshots question title + type + `hadPreviousAnswer` flag + `cleared` (so re-opening a question by clearing the answer shows distinctly from answering it).

**audit-format.ts** gains 14 new entity-specific patterns covering BudgetLine / BudgetCategory / Payment / Table / Seat / CeremonySeating / WeddingSettings / Playlist / Song / Household / Guest / Supplier / SupplierContact / SupplierContract / SupplierCommunication / File. Money values format with `Intl` (`£5,000`); `changedFields` diffs render inline (`— description, amount`); cascade counts surface in the deletes (`(3 lines cascade-deleted)`).

**29 new unit tests** covering each new pattern + at least one delete case + one changedFields case per entity. Total test count 363 → 392.

**Verification gate:** typecheck + lint + 392 unit tests + production build all green.

Files: [src/app/(app)/budget/actions.ts](src/app/(app)/budget/actions.ts) · [src/app/(app)/seating/actions.ts](src/app/(app)/seating/actions.ts) · [src/app/(app)/songs/actions.ts](src/app/(app)/songs/actions.ts) · [src/app/(app)/guests/actions.ts](src/app/(app)/guests/actions.ts) · [src/app/(app)/suppliers/actions.ts](src/app/(app)/suppliers/actions.ts) · [src/app/(app)/payments/actions.ts](src/app/(app)/payments/actions.ts) · [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) · [src/app/(app)/tasks/actions.ts](src/app/(app)/tasks/actions.ts) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [tests/unit/audit-format-enrichment.test.ts](tests/unit/audit-format-enrichment.test.ts).

### 2026-04-30 · v1.38.6 — seed.ts double-run fix

User-flagged on the v1.38.5 production reset run: `reset-book.js` errored with `Unique constraint failed on the fields: (sectionId, slug)` mid-way through `seedFoodDrinkCards`. Symptom in the log: section-creation messages from reset-book interleaved with `user bryony@example.com`, `wedding settings`, `8 schedule events`, `4 sample tasks` — output reset-book itself never produces.

Root cause: `prisma/seed.ts` had an unconditional `main()` call at the bottom of the file:

```ts
main().catch(...).finally(() => db.$disconnect());
```

Whenever a file imports anything from `../prisma/seed` — which both `scripts/reset-book.ts` and `scripts/seed-samples-only.ts` do — the import triggers seed.ts to load, which fires that bottom `main()`. The full seed (users / settings / schedule / tasks / households / sections / nav tags / etc.) starts running in parallel with the operator script's own `main()`. Two `Promise` chains, same `PrismaClient`, both calling `bookSubsection.create` for the same `(sectionId, slug)` → P2002.

Fix: guard the call with the standard CommonJS `require.main === module` check so `main()` only fires when seed.js is invoked as the entry point (`node prisma/seed.js` or `tsx prisma/seed.ts`), not when imported by another module.

```ts
if (require.main === module) {
  main().catch(...).finally(() => db.$disconnect());
}
```

After this fix, `reset-book.js` and `seed-samples-only.js` only run their own `main()`. No parallel full-seed. No P2002.

The two earlier reset attempts that errored mid-way leave the production DB in a partial state — re-run reset-book once after pulling the new image and it'll recover cleanly.

Files: [prisma/seed.ts](prisma/seed.ts) (one-line guard at the bottom).

### 2026-04-30 · v1.38.5 — Book index + seed de-duplication

User-flagged after v1.38.4: "Wedding party is duplicated?" — and the screenshot showed the `/book` index displaying both the new `wedding-party-people` / `-dayof` sections AND the legacy `wedding-party` section with five seeded subpages, plus four other empty legacy sections (Legal & Admin, Ceremony, Reception, Logistics) cluttering the bottom row.

Three fixes:

1. **`/book` index hides empty legacy sections.** A `LEGACY_SLUGS` set covers the six deprecated slugs (`wedding-party`, `venue`, `legal-admin`, `ceremony`, `reception`, `logistics`); any with `_count.subsections === 0` falls out of the index render. If the couple has authored content under a legacy slug, it still renders so the content remains discoverable.
2. **Stop seeding the legacy `wedding-party` section.** `seedWeddingPartySubsections` is removed from `main()` and from both operator scripts. The BookSection row stays in `seedBookSections` (back-compat with prod databases that may have couple-authored content under it), but no fresh content gets written. The v1.35.0 split moved everything into `wedding-party-people` + `-dayof`.
3. **BUILD seeder targets `venue-decor`.** The original P1 (v1.31.0) seeder predated the v1.33.0 venue split and never got migrated; it was still pointing at legacy `venue`. Fix: target `venue-decor` first, fall back to `venue` only for installs that still have it. Also reordered `main()` so `seedVenueSpacesAndDecor` runs before `seedBuildCards` — otherwise BUILD would populate venue-decor first and the decor seeder's skip-if-content-exists guard would skip its non-BUILD subpages (Printed signage, Florist brief, Photo booth, Décor inspiration).

Net effect on a fresh seed (or `reset-book.js` run): legacy `wedding-party`, `venue`, `legal-admin`, `ceremony`, `reception`, `logistics` all stay empty and disappear from the index. The new sections are the only ones visible. BUILD cards land under `venue-decor` alongside the printed-signage / florist / photo-booth / décor-inspiration subpages.

Files: [src/app/(app)/book/page.tsx](src/app/(app)/book/page.tsx) · [prisma/seed.ts](prisma/seed.ts) · [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.4 — Wedding Book seed overhaul

User-flagged after v1.38.3: "Some sections seem like they haven't been reviewed in a while, I want to update the defaults to be a robust example".

The Book seeders had been added phase-by-phase across the v1.31 → v1.38 arc and never revisited. Many sections shipped as **shells** — empty FIELD cards (no defs), empty SETUP cards (no items), empty LEGAL cards (no items), short pre-WYSIWYG TEXT bodies. Two whole sections (Photography & Videography, Guest Experience) had no seeder at all.

Goal: every one of the 12 card kinds (TEXT, FIELD, RECIPE, SHOT_LIST, OUTFIT, BUILD, MENU, BAR, SETUP, LEGAL, STAY, LODGING_GUIDE) shows up as a fully-populated example out of the box. New users opening `/book/<section>` see what each card kind can carry — not blank placeholders.

**Per-section changes:**

- **Wedding Party — People**: 6 OUTFIT cards previously seeded with only `personName` + `role` now ship with realistic fitting / alterations / pickup dates around 26 Sep 2026, item composition rows (dress + shoes + jewellery + bouquet for Bryony; suit + shirt + tie + cufflinks + buttonhole for Jamie; etc.), per-card costs in pence, paid status, supplier names matching existing Suppliers (Slaters, Paintbox Blooms, Mirror Mirror Bridal). 6 cards × ~4-6 items = ~24 items total.
- **Wedding Party — Day-of**: TEXT bodies converted to HTML with `<h2>`, `<ul>`, `<strong>`, `<blockquote>`. "Stag & Hen recap" got a real template instead of `…`. "Wedding-day cars" FIELD card gained 6 field defs (vehicle, driver, phone, pickup time, etc.) grouped under Vehicles / Schedule / Contingency.
- **Venue — Spaces**: 5 SETUP cards previously empty now ship with **30 setup items** total (Ceremony room: 6 items including aisle runner, arch, posies, registrar's pen; Reception room: 7 items including centerpieces, place cards, table numbers; etc.). Source field matches existing supplier names so the `/suppliers/[id]` "Used in setup" cross-module surface lights up immediately.
- **Venue — Décor**: 2 FIELD cards (Printed signage, Photo booth) gained ~10 field defs each grouped by Order / Design / Day-of / Status. TEXT cards (Florist brief, Décor inspiration) now use HTML headings + bullet lists.
- **Food & Drink**: existing Wedding breakfast MENU + Drinks/bar BAR retained. **New seeders** for Kids menu (1 course × 2 options, isKidsMeal=true), Evening buffet (1 course × 3 options), Late-night snack (1 course × 2 options), Cake (FIELD card with 10 fields covering vendor / design / order / day-of / status), and a **Signature cocktail RECIPE** (Bryony & Jamie's Spritz with structured BookRecipeStep rows, servingsBase=8, day-before pre-batch step). RECIPE was the last card kind without an example seeded — now covered.
- **Photography & Videography** *(new seeder)*: 5 subsections — Photographer brief (FIELD with 12 fields), Engagement shoot (FIELD), Shot list (SHOT_LIST with **24 shots** grouped by Pre-ceremony / Ceremony / Couple portraits / Family formals / Reception, each with estimatedMinutes + linked withWhom names), Album spec (FIELD), Gallery delivery (FIELD).
- **Guest Experience** *(new seeder)*: 5 subsections — Welcome bags (BUILD with 5 materials), Favours (BUILD with 3 materials), Order of service (FIELD with 8 fields), Welcome drinks reception (TEXT WYSIWYG), Thank-you cards plan (TEXT WYSIWYG).
- **Legal — Before**: Notice of Marriage card now has 4 LEGAL items (give-notice for each party + book + pay), Required documents has 6 items (passport + address + decree absolute per person), Witnesses FIELD has 7 fields, Insurance FIELD has 8 fields. Legal due-by-date set to 28 Aug 2026 (≥ 29 days before the wedding).
- **Legal — Day**: Pre-ceremony interview FIELD has 7 fields. Vows reference + Registration steps converted to HTML with the actual legal vows, numbered procedure list, blockquote tips.
- **Legal — After**: Marriage cert pickup has 4 items, **Name change checklist has 12 items** (passport, DVLA, HMRC, banks, pension, employer, GP/dentist, insurance, will, credit-reference agencies, loyalty cards, social media — in priority order), Certified copies tracker has 5 items.
- **Accommodation**: 4 STAY cards now ship with check-in (25 Sep 15:00) / check-out (27 Sep 11:00) dates, costs in pence, booking-reference placeholders, occupant lists. LODGING_GUIDE retained with its 3 Stratford hotels.
- **Post-wedding**: Thank-you tracking FIELD has 10 fields covering design / progress / status. Photo / video delivery FIELD has 12 fields including backup-downloaded toggle. Vendor reviews + Marriage cert filing converted to TEXT WYSIWYG with bulleted vendor lists + downstream filing checklist.

**Cleanup**: legacy `wedding-party` seeder kept (it pre-dates the v1.35.0 split and matches the existing legacy-section policy), but the new sections lead the order. Operator scripts (`seed-samples-only.ts`, `reset-book.ts`) updated to call the two new seeders. `Prisma` namespace added to seed.ts imports for the RECIPE `InputJsonValue` cast.

**Numbers:**
- ~12 sections, ~50 subsections seeded by default (was ~32)
- 30 SETUP items (was 0)
- 26 LEGAL items (was 0)
- 24 SHOT_LIST shots (was 0)
- 8 BUILD material lists with 30+ materials total (was 3 with 3 materials)
- Every FIELD card has defs (was 0 of 6)
- 1 RECIPE example (was 0)

**Verification gate:** typecheck + lint + 363 unit tests + production build all green.

Files: [prisma/seed.ts](prisma/seed.ts) · [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.3 — Operator scripts in the production image

User-flagged after v1.38.2 promotion: `docker exec wedding-hub-web-1 npx tsx scripts/reset-book.ts` failed with `ENOENT: no such file or directory, mkdir '/home/node/.npm'` — the production image runs as the `node` user (no write access to `/home/node/.npm`), `tsx` is a devDependency that's pruned in the runtime image, and the `scripts/` directory was never bundled into the image anyway.

Two fixes:

1. **Scripts use a local `PrismaClient`** instead of importing `db` from `src/lib/db`. The runtime image holds a Next standalone bundle, not the raw `src/` tree, so the `../src/lib/db` import wouldn't resolve at runtime. Mirroring `prisma/seed.ts`'s shape (which already constructs its own client) keeps both scripts self-contained.

2. **Dockerfile transpiles + bundles the operator scripts.** The existing `npx tsc prisma/seed.ts` pattern is extended to a second `tsc` invocation that takes `prisma/seed.ts scripts/seed-samples-only.ts scripts/reset-book.ts` together, with `--rootDir .` so the relative tree is preserved. Output lands in `/app/scripts-build/`. The runner stage `COPY`s `scripts-build/` wholesale so the `require("../prisma/seed")` inside the operator scripts resolves to the co-located `scripts-build/prisma/seed.js`.

After this image rebuilds, the production invocation becomes:

```bash
# Non-destructive:
docker exec wedding-hub-web-1 \
  node scripts-build/scripts/seed-samples-only.js

# Destructive (env flag mandatory):
docker exec -e CONFIRM_RESET_BOOK=yes wedding-hub-web-1 \
  node scripts-build/scripts/reset-book.js
```

No more npm registry calls at runtime, no `tsx` requirement, no `/home/node/.npm` permission issues.

Files: [Dockerfile](Dockerfile) · [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.2 — Book module reset script

User request after the v1.38.1 ship: a script that **resets the Book section** end-to-end. Use case: the v1.38.0 promotion brought twelve sections of new structure, and the couple may want to throw out whatever's currently there and start from a clean seed-default state rather than fix it in place.

`scripts/reset-book.ts` — gated on `CONFIRM_RESET_BOOK=yes` env var (no `--yes` flag, no interactive prompt — explicit env required so accidental shell-history re-runs don't fire it). Prints a count summary of what's about to be deleted, then runs `db.bookSection.deleteMany({})` (cascades pull every Book row down with it), recreates the 12 BookSection rows at correct order, and re-runs the eight section-level seeders that v1.38.1 exported.

What it deletes: every Book row — sections, subsections, every per-kind card (FIELD / RECIPE / SHOT_LIST / OUTFIT / BUILD / MENU / BAR / SETUP / LEGAL / STAY / LODGING_GUIDE) and their child rows.

What it leaves alone: **users, permissions, sessions, tasks, guests, households, seating, song requests, schedule events, suppliers, contracts, payments, budget categories, budget lines, files, audit logs.** The Task ↔ BookSection m2m link rows go away (re-link via the Tasks page after); BudgetLine.buildCards back-references go to zero until new BUILD cards re-link via "Copy materials total to Budget".

Always preceded by a backup recommendation in the script's preamble:

```bash
docker compose exec db pg_dump -U postgres wedding_hub \
  > wedding-hub-pre-book-reset.sql
```

Then to actually run:

```bash
docker compose exec -e CONFIRM_RESET_BOOK=yes web \
  npx tsx scripts/reset-book.ts
```

Files: [scripts/reset-book.ts](scripts/reset-book.ts).

### 2026-04-30 · v1.38.1 — Samples-only prod backfill script

User-flagged after the v1.38.0 promotion: "I want the samples but don't want to change any other db data such as seating allocations, tasks, guests".

The full `npm run db:seed` is intentionally aggressive — it runs `seedSampleTasks` (4 placeholder tasks), `seedScheduleEvents` (8 day-of placeholders), and `seedUsersAndPermissions` (refreshes user metadata from env). On a populated production those would add noise / churn user records. The Book section seeders are already idempotent (per-section skip-if-content-exists), but they were buried inside `seed.ts`'s `main()` — couldn't be invoked piecemeal.

Fix: refactor `prisma/seed.ts` to **export** the eight section-level seeders (`seedWeddingPartySubsections`, `seedBuildCards`, `seedFoodDrinkCards`, `seedVenueSpacesAndDecor`, `seedLegalSections`, `seedWeddingPartyPeopleAndDayof`, `seedAccommodationCards`, `seedPostWeddingSection`). New script `scripts/seed-samples-only.ts` imports them and runs all eight in sequence + ensures the 12 BookSection rows exist with correct ordering.

Each seeder remains per-section skip-if-content-exists, so populated sections (anything the couple has authored) are no-ops. Empty sections receive their sample subpages (e.g. Post-wedding gets its four placeholders, Wedding Party — People gets six OUTFIT cards for the known wedding-party members).

What the script **does NOT touch**: users, tasks, schedule events, guests, households, seating, songs, payments, suppliers, files. Only Book sections and their child subsection rows.

Run on production after `docker compose pull && up -d`:

```bash
docker compose exec web npx tsx scripts/seed-samples-only.ts
```

Idempotent — safe to re-run.

Files: [scripts/seed-samples-only.ts](scripts/seed-samples-only.ts) · [prisma/seed.ts](prisma/seed.ts) (eight `async function` → `export async function`).

### 2026-04-30 · v1.38.0 — Wedding Book arc closes (P7b/B + P8)

**Final phase of the [Book Expansion arc](BOOK-EXPANSION-PLAN.md).** Combines P7b/Part B (FIELD / RECIPE / SHOT_LIST upgrades) with P8 (Post-wedding section seed + production backfill script). The Book is now feature-complete against the original plan: 12 sections (8 active + 4 deprecated), 12 card kinds (TEXT, FIELD, RECIPE, SHOT_LIST, OUTFIT, BUILD, MENU, BAR, SETUP, LEGAL, STAY, LODGING_GUIDE), TEXT cards with WYSIWYG (v1.37.0–v1.37.2), and read-time cross-module wiring on every page that asks for the data (v1.37.5).

**SHOT_LIST upgrades** — biggest user-facing addition. New `category` and `estimatedMinutes` columns on `BookShot`. Editor now offers a category text input + minutes input alongside the existing fields, and the rendered card groups shots by category with a per-group capture counter and time-budget rollup. Card header shows total estimated minutes when at least one shot has an estimate. **Plus the user's specific ask**: shots gain a `guestIds: String[]` forward link to `Guest.id`, with a multi-select picker in the form. The legacy free-text `withWhom` field stays for non-guest names (vendors, partner-of-cousin). Forward-only relation per the v1.30.5 cross-module-reference rule — reverse query lives at render time on the Guest detail panel.

**Guest detail "Photos to capture"** — new section on `/guests/[id]` listing every shot whose `guestIds` includes this guest. Captured shots show with strike-through; remaining count surfaces in the section header. Each row deep-links to the parent SHOT_LIST card.

**FIELD upgrades** — `BookFieldDef` gains `group`, `helpText`, `required`, `min`, `max`, `dateMin`, `dateMax`. The editor renders fields grouped by `group` (collapsible-style sections); helpText shows on hover via the `ⓘ` icon; required fields show a red asterisk; the "Add field" form has a "More options" toggle exposing the new metadata. Validation enforced server-side in `parseBookFieldValue`: required values throw on empty input, numeric ranges enforce min/max, date ranges enforce dateMin/dateMax in `yyyy-mm-dd`.

**RECIPE upgrades** — `BookRecipe` gains `servingsBase` and a new structured `BookRecipeStep` table (id, instruction, durationMinutes, dayBefore, order). Migration backfills existing `steps` Json arrays into the new table via a SQL `DO` block (idempotent — skips recipes that already have BookRecipeStep rows). Legacy `steps` Json column kept one release as a recoverability buffer. Editor rewritten with View / Edit toggle: header shows servings + active-time + day-before time as stat tiles; view-mode adds a `×1 / ×2 / ×3` scaling toggle; structured edit rows let the couple set per-step duration + tag prep that should happen the day before. Day-before steps render with a marigold pill in view mode.

**Post-wedding section** — new `post-wedding` BookSection seeded at order 12. Four subsections per [§8.12](BOOK-EXPANSION-PLAN.md): Thank-you tracking (FIELD), Vendor reviews to write (TEXT), Photo / video delivery (FIELD), Marriage cert filing (TEXT pointer to legal-after).

**Production backfill** — `scripts/backfill-v1.38.ts` ensures the new sections exist on production with the right ordering. Idempotent: re-runs are no-ops on already-migrated DBs. Doesn't touch couple-edited content. Run once after `prisma migrate deploy` finishes. The seeders in `prisma/seed.ts` are also idempotent — running the seed on a populated prod skips every section that already has subsections.

**Schema migration `20260430100000_book_p7b_part_b_card_upgrades`:**
- FIELD: 7 new nullable / defaulted columns
- SHOT_LIST: 3 new columns (category, estimatedMinutes, guestIds)
- RECIPE: 1 new column (servingsBase) + new BookRecipeStep table + idempotent SQL backfill
- Post-wedding BookSection insert with `ON CONFLICT DO NOTHING`

**21 new unit tests** covering shotListRollups, recipeRollups, findShotsForGuest, and the FIELD validator's required / min / max / dateMin / dateMax enforcement.

**Verification gate:** typecheck + lint + 363 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430100000_book_p7b_part_b_card_upgrades/migration.sql](prisma/migrations/20260430100000_book_p7b_part_b_card_upgrades/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [src/lib/guest-cross-refs.ts](src/lib/guest-cross-refs.ts) · [tests/unit/v1.38-helpers.test.ts](tests/unit/v1.38-helpers.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/app/(app)/book/[slug]/BookFieldsCard.tsx](src/app/(app)/book/[slug]/BookFieldsCard.tsx) · [src/app/(app)/book/[slug]/BookRecipeCard.tsx](src/app/(app)/book/[slug]/BookRecipeCard.tsx) · [src/app/(app)/book/[slug]/BookShotListCard.tsx](src/app/(app)/book/[slug]/BookShotListCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [src/app/(app)/guests/[id]/page.tsx](src/app/(app)/guests/[id]/page.tsx) · [prisma/seed.ts](prisma/seed.ts) · [scripts/backfill-v1.38.ts](scripts/backfill-v1.38.ts).

### 2026-04-30 · v1.37.5 — Cross-module wiring (P7b / Part C)

Second half of [P7](BOOK-EXPANSION-PLAN.md). The Wedding Book stops being a silo: every Book card kind that holds a date / cost / supplier / guest now has a read-time projection on the **page that asks for it**. No new schema; everything is read-time queries against the data already produced by P1–P6. Part B (FIELD / RECIPE / SHOT_LIST card upgrades — including the RECIPE Json→rows migration) splits out to v1.37.6 so this ship stays focused on wiring.

**Two pure-decision modules** with full unit-test coverage:

- [`src/lib/today-widgets.ts`](src/lib/today-widgets.ts) — `nextLegalDeadlines(cards, now, daysAhead)` (folds card `dueByDate` + per-item `expiresAt`, includes overdue items, skips fully-obtained cards), `nextOutfitMilestones(cards, now, daysAhead)` (one row per (card, milestone) within the future window), `oldestOpenDecisions(tasks, limit)` (filter `type=DECISION` + non-closed status, sort dated-soonest-then-oldest-created).
- [`src/lib/guest-cross-refs.ts`](src/lib/guest-cross-refs.ts) — `findStaysForGuest(guestId, stays)` (reverse query for STAY cards listing this guest), `findMealChoiceLinks(guest, options)` (case-insensitive label match, prefers same-course when ambiguous, returns `null` when no match so panel still shows free-text choice).

**26 new unit tests** covering window inclusion / exclusion, sort stability, case + whitespace normalisation, ambiguous-course resolution, and empty-input edge cases.

**Today page** ([src/app/(app)/page.tsx](src/app/(app)/page.tsx) + new [TodayCrossModuleStrip.tsx](src/app/(app)/TodayCrossModuleStrip.tsx)): three new widgets in a 3-column grid below the existing tasks/events row. Auto-hides when all three are empty (quiet day = no blank row). Each row deep-links to the underlying Book card via `/book/<section>#<subsection>` anchors. Day pills colour-code days-remaining: red for overdue, marigold for today / ≤7 days, muted for further out.

**Guest detail page** ([src/app/(app)/guests/[id]/page.tsx](src/app/(app)/guests/[id]/page.tsx)): "Meal choices" rows now render an `on menu →` link beside each guest's free-text choice when it matches a current `BookMenuOption`. New "Accommodation" section appears when one or more STAY cards list the guest in `guestIds` — shows property name + check-in→out date range, links back to the Book.

**Budget page** ([src/app/(app)/budget/BudgetDiyLinks.tsx](src/app/(app)/budget/BudgetDiyLinks.tsx)): "Linked from DIY" panel above the categories shows every BUILD card that has a `budgetLineId` (set by P1's "Copy materials total to Budget" action). Per-row deep-link back to the source DIY card; total at the top so the couple can see the rolled-up DIY spend at a glance. Hidden when no links exist.

**Supplier detail page** ([src/app/(app)/suppliers/[id]/page.tsx](src/app/(app)/suppliers/[id]/page.tsx)): "Used in setup" section appears when any `BookSetupItem.source` matches the supplier's name (case-insensitive). Shows item + space + quantity + packed/placed pills. Hidden when none match. String match (no FK), matching the v1.30.5 cross-module-reference rule.

**Verification gate:** typecheck + lint + 342 unit tests + production build all green on the same SHA.

### 2026-04-30 · v1.37.2 — TEXT card list / blockquote rendering fix

User-flagged on v1.37.1 review: "Some items are not working as expected like bullet points". Root cause: this project's Tailwind v4 setup doesn't include `@tailwindcss/typography`, so the `prose prose-sm` classes I'd added to the editor and `RichTextRead` were no-ops — and Tailwind Preflight resets `<ul>`, `<ol>` to `list-style: none` with zero indent, so bullet markers and numbers disappeared. Same for `<blockquote>`'s left border and `<h2>`/`<h3>` spacing.

Fix: drop the `prose` classes and pin every needed style with explicit Tailwind utility selectors (`[&_ul]:list-disc`, `[&_ol]:list-decimal`, `[&_blockquote]:border-l-2`, etc.). Build one `RICH_TEXT_PROSE_CLASS` constant; share it between the live editor and `RichTextRead` so what-you-see-is-what-you-get across the View / Edit toggle. Covers every tag the sanitiser allow-list permits: paragraph spacing, H2 / H3, bulleted + numbered lists with nested-list margin handling, blockquote, strong / em / u, anchors.

Files: [src/components/ui/RichTextEditor.tsx](src/components/ui/RichTextEditor.tsx).

### 2026-04-30 · v1.37.1 — TEXT card View / Edit toggle

User-flagged on v1.37.0 review: "the save function doesnt hide the editor, you can still edit and update the text". The Tiptap editor was rendered whenever `canEdit` was true — same shape as the pre-v1.37.0 textarea — so the toolbar stayed visible after save. Other v1.31+ card kinds (BUILD / OUTFIT / BAR / MENU / SETUP / LEGAL / STAY / LODGING_GUIDE) all use an explicit View / Edit toggle from v1.31.1 onwards; TEXT was the last hold-out because the textarea didn't visibly mind being always-editable. The richer toolbar makes the inconsistency obvious.

Fix: retrofit the View / Edit toggle onto SubsectionEditor. Default state is read-only — title is `<h3>`, body is `<RichTextRead>`. Clicking **Edit** swaps in `<Input>` + `<RichTextEditor>`. **Cancel** reverts the draft. **Save changes** commits and exits edit mode. Visibility / Delete buttons hide while editing so the action bar stays uncluttered.

`Save changes` is now disabled (rather than hidden) when there are no pending edits — matches the other card editors so the button position doesn't jump.

Files: [src/app/(app)/book/[slug]/SubsectionEditor.tsx](src/app/(app)/book/[slug]/SubsectionEditor.tsx).

### 2026-04-30 · v1.37.0 — Wedding Book TEXT WYSIWYG (P7a)

First half of [P7](BOOK-EXPANSION-PLAN.md). The TEXT card's plain `<textarea>` is replaced with a real WYSIWYG editor authored via Tiptap, with a deliberately small 10-mark toolbar. P7's Parts B (FIELD/RECIPE/SHOT_LIST upgrades) and C (cross-module wiring) are split out to a follow-up ship (v1.37.5) so this release stays focused on the riskiest piece: the migration from plain text to sanitised HTML.

**Toolbar (compile-time constant — cannot be expanded by users):** Bold · Italic · Underline · H2 · H3 · Bullet list · Numbered list · Blockquote · Link · Undo · Redo. Mobile (< 640px) collapses to Bold / Italic / Bullet / Link / "more" sheet revealing the rest. The toolbar set is the schema — there is no path from here to slash menus or block embeds.

**Sanitiser (`src/lib/sanitize-book-html.ts`):** allow-list of the 12 tags above plus `<a>` (with `href`, `rel`, `target`) and `<br>`. Anchors are **always** rewritten to `rel="noopener noreferrer" target="_blank"` regardless of what the author types — no path for a hand-edited link to open in-tab. `class`, `id`, `style`, inline event handlers, `javascript:` and `data:` schemes all stripped. Run on **write** (server-action `updateBookSubsection` enforces) AND on **read** (`RichTextRead` re-sanitises before `dangerouslySetInnerHTML`) as belt-and-braces — defends against any row that slipped through historic versions or a direct DB edit.

**Schema:** `BookSubsection.bodyHtml String?` added (nullable). Legacy `body` column kept one release as a recoverability buffer per the v1.30.5 standing pattern. The TEXT editor stops writing to `body` from this release on; reads prefer `bodyHtml` and fall back to `legacyBodyToHtml(body)` when bodyHtml is null.

**Migration `20260430090000_book_text_html`:** adds the column + idempotent SQL backfill. For every TEXT subsection with non-null body and null bodyHtml, escapes `&`, `<`, `>`, replaces `\n\n` with `</p><p>`, remaining `\n` with `<br>`, and wraps in `<p>…</p>`. Re-runs on rows that already have bodyHtml are a no-op. The same transform lives in TS as `legacyBodyToHtml()` so read-time fallback renders identically.

**Editor (`src/components/ui/RichTextEditor.tsx`):** Tiptap-react + StarterKit + Underline + Link extensions. Heading restricted to H2/H3, `codeBlock`/`code`/`horizontalRule` disabled. Output is HTML; the `onChange` callback gets the editor's `getHTML()` on every keystroke. Read-mode `RichTextRead` component for non-editing contexts. Native `prompt()` for the link-URL dialog — keeps the editor footprint tight and consistent with every other picker on the app.

**Tests (19 new):** `tests/unit/sanitize-book-html.test.ts` covers every allowed/disallowed tag, attribute strip (class/id/style/event handlers), scheme strip (javascript:/data:), forced rel+target overriding author values, empty-href anchor demotion, paragraph + line-break preservation, and the legacy backfill round-trip.

**Bundle impact:** `/book/[slug]` First Load went from 135 kB → 356 kB. Tiptap's prose-mirror dep tree is the bulk of the increase. Acceptable on a private, admin-only tool; flagged as a follow-up if the editor ever shows up on a more public surface.

**Verification gate:** typecheck + lint + 316 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430090000_book_text_html/migration.sql](prisma/migrations/20260430090000_book_text_html/migration.sql) · [src/lib/sanitize-book-html.ts](src/lib/sanitize-book-html.ts) · [tests/unit/sanitize-book-html.test.ts](tests/unit/sanitize-book-html.test.ts) · [src/components/ui/RichTextEditor.tsx](src/components/ui/RichTextEditor.tsx) · [src/app/(app)/book/[slug]/SubsectionEditor.tsx](src/app/(app)/book/[slug]/SubsectionEditor.tsx) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [package.json](package.json) (+ Tiptap pins).

### 2026-04-30 · v1.36.0 — Wedding Book STAY + LODGING_GUIDE cards (P6)

Sixth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two new card kinds rebuild the Accommodation section: **STAY** for bookings the couple makes and pays for (one card per booking), and **LODGING_GUIDE** for the recommended-hotels reference card guests can be pointed at.

**STAY card** — one card per booking. Header strip shows the property + a phase pill (upcoming / current / past), plus a stats grid for check-in date with days-remaining, check-out date, cost, and paid status. Booking ref + nights count surface in a one-line strip below. Body has property contact, free-text occupants list (chips), an inline picker for **linked guests** that ties this booking to existing `Guest.id`s, and notes. The `guestIds` array is a forward link only — no relation defined on the schema, matching the v1.30.5 cross-module-reference convention. The reverse query ("which stay is this guest at?") lights up in P7's guest detail panel.

**LODGING_GUIDE card** — single card with rows for recommended hotels around the venue. Each row carries name + distance + price band (`£` / `££` / `£££`) + phone + website + group-rate code + notes. Built read-mostly — no `obtained` / `paid` flags. Header summarises N hotels with a per-price-band breakdown (`3 × £, 4 × ££, 1 × £££`) so the at-a-glance read works without scrolling.

**Schema:** `STAY` and `LODGING_GUIDE` added to `BookSubsectionKind`. Three new tables — `BookStayCard` (1:1 with subsection, `guestIds: String[]`, `occupants: String[]`), `BookLodgingCard` (1:1) + `BookLodgingItem` (rows). Migration `20260430080000_book_stay_lodging_cards`, additive only — no data migration needed because Accommodation didn't have any structured cards yet.

**Pure helpers:** `stayRollups({ checkInDate, checkOutDate, costPence, paid }, now)` → `{ nights, daysToCheckIn, phase }`. `lodgingRollups({ items })` → `{ itemCount, perPriceBand }`. 11 unit tests covering boundaries (same-day = 0 nights, current/upcoming/past phase pivots on now vs check-in/out, null/empty price labels bucket together).

**Server actions:** `saveStayCard` (single bulk save — one row, no item reconcile) + `saveLodgingCard` (single bulk save with item reconcile). Both audit-enriched per the v1.30.5 standing rule with `changedFields` diff for STAY's nine card-level fields and `itemsAdded` / `Updated` / `Removed` counts for LODGING. New `stay-save` + `lodging-save` patterns in [audit-format.ts](src/lib/audit-format.ts).

**Editors** built against §10a's edit-row layout rule from day one — two-row grids for STAY's header (Property+BookingRef; CheckIn+CheckOut; Cost+PaidBy+Paid), and three-row grids per hotel for LODGING_GUIDE (Name+PriceBand; Distance+Phone; Website+GroupRate). View modes mirror edit. STAY's linked-guest picker reuses the toggle-chip pattern from the seating canvas — clicking adds/removes by `Guest.id`.

**Seed:** Accommodation seeded per [BOOK-EXPANSION-PLAN.md §8.11](BOOK-EXPANSION-PLAN.md) with four STAY cards (Bridal Suite, Bryony night-before, bridesmaids night-before, groomsmen night-before) and one LODGING_GUIDE with three placeholder hotels around Stratford-upon-Avon (Crowne Plaza, Mercure Shakespeare, Premier Inn Central). Idempotent — skipped when the section already has subsections.

**Verification gate:** typecheck + lint + 297 unit tests + production build all green on the same SHA.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430080000_book_stay_lodging_cards/migration.sql](prisma/migrations/20260430080000_book_stay_lodging_cards/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [tests/unit/stay-lodging-rollups.test.ts](tests/unit/stay-lodging-rollups.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [src/app/(app)/book/[slug]/BookStayCard.tsx](src/app/(app)/book/[slug]/BookStayCard.tsx) · [src/app/(app)/book/[slug]/BookLodgingCard.tsx](src/app/(app)/book/[slug]/BookLodgingCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.35.1 — Migration fix (pgcrypto)

CI flagged v1.35.0's data migration as failing on the integration-test Postgres image: `function gen_random_bytes(integer) does not exist`. Stock Postgres 16 ships pgcrypto but does **not** pre-load it — the CI test image is bare. Production never ran the broken migration (it died at the migrate-deploy step before reaching anything destructive), so this is a cleanup ship.

Fix: prepend `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to migration `20260430070000_book_outfit_rework`. Idempotent — `IF NOT EXISTS` is a no-op on environments that already have the extension. Re-running the failed CI job picks up the patched migration and replays cleanly.

Files: [prisma/migrations/20260430070000_book_outfit_rework/migration.sql](prisma/migrations/20260430070000_book_outfit_rework/migration.sql).

### 2026-04-30 · v1.35.0 — Wedding Book OUTFIT rework (P5) + Wedding Party split

Fifth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). The OUTFIT card moves from a single card-per-section listing N people, to **one card per person** with their own fitting timeline, cost, paid status, items list, and photos. The Wedding Party section splits into two: `wedding-party-people` (the OUTFIT cards) and `wedding-party-dayof` (timeline / ring keepers / day-of TEXT + FIELD subsections).

**OUTFIT card** — header is the person's name + role chip. Stats strip shows the next milestone with days-remaining (fitting → alterations → pickup), cost, paid-by + paid status, and items collected/total. Fitting-timeline strip highlights whichever step is next. Items list breaks the outfit into pieces (dress / shoes / tie etc.) with their own status pill (`Designed` / `Ordered` / `Fitted` / `Collected`). Photos via `fileIds[]` with attach/detach picker reusing the existing `File` model.

**Schema:** card-level fields move **onto** `BookOutfitCard` — `personName`, `role`, `fittingDate`, `alterationsDueBy`, `pickupDate`, `costPence`, `paidBy`, `paid`, `fileIds`, `notes`. The legacy `BookOutfit` row table is **repurposed** into per-item composition for that one person — gains `itemLabel`, `description`; the legacy `personName` / `role` columns are now nullable and stay populated for one release as a recoverability buffer (matches the v1.30.5 `body` / `bodyHtml` pattern). Migration `20260430070000_book_outfit_rework` includes a data-migration `DO` block that walks every existing card: 0 children skipped, 1 child copies onto parent in place, 2+ children split out into per-person cards under a freshly-inserted `wedding-party-people` section. Idempotent on re-run.

**Pure helper:** `outfitRollups({ fittingDate, alterationsDueBy, pickupDate, items }, now)` → `{ itemCount, collectedCount, percentCollected, nextMilestone, daysToNext }`. Picks the soonest-future milestone, falls back to the most-recent past one when all three are behind, treats today as future (>= now). 8 unit tests covering each branch.

**Server actions:** `saveOutfitCard` (single bulk save with full reconcile — payload covers card-level fields + items list, transactional) + `attachFileToOutfitCard` / `detachFileFromOutfitCard` (per-card photo ops). All audit-enriched per the v1.30.5 standing rule. New `outfit-save`, `outfit-file-attach`, `outfit-file-detach` patterns in [audit-format.ts](src/lib/audit-format.ts) so the audit log reads in human sentences.

**Editor** built against §10a's edit-row layout rule from day one — two-row grids for header (Name+Role; Fitting+Alterations+Pickup; Cost+PaidBy+Paid), and per-item rows (Item+Status; Description+Supplier; reorder/remove). View mirrors edit. Photos picker lives on view mode so a single attach doesn't re-save the whole card.

**Section split (additive):** two new BookSection rows — `wedding-party-people` at order 1, `wedding-party-dayof` at order 2. Legacy `wedding-party` slug stays at the bottom of the order with any couple-edited subsections still intact (the /book index hides empty legacy sections). Seed wires `wedding-party-people` with one OUTFIT card per known wedding-party member (Bryony, Jamie, Aimee, Joshua, Clara, Torin) and `wedding-party-dayof` with the §8.2 layouts (Morning prep timeline · Ring keepers · Pre-ceremony hand-offs · Wedding-day cars · Stag & Hen recap).

**Verification gate:** typecheck + lint + 286 unit tests + production build all green on the same SHA. The data migration sits behind an idempotent gate, so production prod-promote is a fast-forward + Prisma migrate + image rebuild — the migration runs cleanly even if existing prod cards already match the new shape.

Files: [prisma/schema.prisma](prisma/schema.prisma) · [prisma/migrations/20260430070000_book_outfit_rework/migration.sql](prisma/migrations/20260430070000_book_outfit_rework/migration.sql) · [src/lib/book-cards.ts](src/lib/book-cards.ts) · [tests/unit/outfit-rollups.test.ts](tests/unit/outfit-rollups.test.ts) · [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) · [src/lib/audit-format.ts](src/lib/audit-format.ts) · [src/app/(app)/book/[slug]/BookOutfitCard.tsx](src/app/(app)/book/[slug]/BookOutfitCard.tsx) · [src/app/(app)/book/[slug]/CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) · [src/app/(app)/book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx) · [prisma/seed.ts](prisma/seed.ts).

### 2026-04-30 · v1.34.0 — Wedding Book LEGAL card (P4) + Legal split

Fourth phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). New `LEGAL` card kind for document checklists with deadlines + optional file attachments, and the `legal-admin` section splits into three timeline-aligned new sections (additive — legacy stays).

**LEGAL card** — one card per coherent deadline group (Notice of Marriage, Required documents, Marriage certificate pickup, Name change checklist, etc.). Header has regulator + contact + due date with days-remaining countdown. Items table has obtained checkbox + obtainedAt date + expiresAt date + optional file picker (reuses the existing `File` model — same 25 MB cap + signed-download flow as suppliers / contracts get for free).

**Two banners** when state warrants them:

- **⚠ Card deadline passed** — when `dueByDate` is in the past AND not every item is obtained.
- **⚠ N items expire before the wedding** — when any item's `expiresAt` is before the wedding date (catches lapsing passports, expiring Notices of Marriage, etc.).

**Schema:** `LEGAL` added to `BookSubsectionKind`. Two new tables — `BookLegalCard` (1:1 with subsection) + `BookLegalItem` (line items, with optional `fileId` FK to `File` with `onDelete: SetNull`). `File.bookLegalItems` back-relation. Migration `20260430060000_book_legal_card`, additive only.

**Pure helper:** `legalRollups({ dueByDate, items }, weddingDate, now)` → `{ itemCount, obtainedCount, percentObtained, daysToDue, isOverdue, expiringBeforeWedding }`. 7 unit tests including overdue + expiry boundaries.

**Server actions:** `saveLegalCard` (single bulk save) + `attachFileToLegalItem` / `detachFileFromLegalItem` (per-row file ops, kept separate so a single PDF attach doesn't re-save the whole card). All audit-enriched per the v1.30.5 standing rule. New `legal-save`, `legal-file-attach`, `legal-file-detach` patterns in [audit-format.ts](src/lib/audit-format.ts).

**Editor** built against §10a's edit-row layout rule from day one — two-row grids for header + per-item, per-cell labels above every input, file picker on a third compact slot, obtained checkbox + reorder/remove on the bottom row.

**Section split — additive.** Three new BookSection rows seeded:

- `legal-before` (order 9) — Notice of Marriage (LEGAL), Required documents (LEGAL), Witnesses (FIELD), Insurance (FIELD).
- `legal-day` (order 10) — Pre-ceremony interview (FIELD), Vows reference (TEXT), Registration steps (TEXT).
- `legal-after` (order 11) — Marriage certificate pickup (LEGAL), Name change checklist (LEGAL), Certified copies (LEGAL).

Legacy `legal-admin` stays at order 8 with whatever subsections live under it. The `/book` index hides empty legacy sections, so once the couple finishes moving content across `legal-admin` quietly drops off the hub. Existing sections (Accommodation, ceremony / reception / logistics legacy) shift down three slots; the seed's upsert with `update: { order }` re-numbers them on re-run.

**Shared helpers (per §10a).** `FieldLabel` + `Label` primitives lifted from BUILD/BAR/SETUP into `src/app/(app)/book/[slug]/bookCardUi.tsx` (renamed from `.ts` since it now exports JSX). BUILD / BAR / SETUP refactored to import from there; LEGAL imports from there too on first build.

**Files:**
- `prisma/schema.prisma` — `LEGAL` enum value, two new tables, `BookSubsection.legalCard` + `File.bookLegalItems` back-relation.
- New: `prisma/migrations/20260430060000_book_legal_card/migration.sql`.
- `prisma/seed.ts` — three new BookSection rows + `seedLegalSections()` (idempotent, per-section gates).
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; `legalRollups()` helper.
- `src/lib/audit-format.ts` — three new patterns.
- `src/app/(app)/book/actions.ts` — `saveLegalCard` + `attachFileToLegalItem` + `detachFileFromLegalItem` + `createBookSubsection` LEGAL branch.
- New: `src/app/(app)/book/[slug]/BookLegalCard.tsx`.
- Renamed: `src/app/(app)/book/[slug]/bookCardUi.ts` → `bookCardUi.tsx` (gained `FieldLabel` + `Label`).
- `BookBuildCard.tsx`, `BookBarCard.tsx`, `BookSetupCard.tsx` — import the shared primitives, drop local copies.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — LEGAL case + extended `Sub` type.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `legalCard.items.file`, fetch wedding date + Files when any LEGAL card present.
- New: `tests/unit/legal-rollups.test.ts` — 7 cases.

Plus a separate **roadmap addition** (per user, while reviewing v1.33.x): "Tasks linkable to individual cards (inline)" added to the `New asks captured 30 Apr 2026` block. Three implementation candidates listed; lean is m2m `Task ↔ BookSubsection` alongside the existing m2m `Task ↔ BookSection`. ~3 hrs once decided.

**Verification:** typecheck + lint clean, 278 unit tests pass (+7 LEGAL rollups), clean `.next` build green.

**Future-card idea logged**: "Dance card" — pairs of dance moments with participants + optional Song FK. Captured in [BOOK-EXPANSION-PLAN.md §13](BOOK-EXPANSION-PLAN.md) (Future card ideas) for post-v1.38.0 consideration.

**Next:** v1.35.0 P5 — OUTFIT rework (one card per person) + Wedding Party split. The largest phase in the arc; data migration on the existing OUTFIT cards.

### 2026-04-30 · v1.33.2 — Edit-row layout rule pinned into the card-creation plan

Docs-only follow-up to v1.33.1. The lessons from cramming six fields into a 12-column row (BAR card, v1.32.2) and the two-row redesign that fixed it (v1.33.1) get pinned into [BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md) as a **temporary standing constraint (§10a)** so P4 (LEGAL), P5 (OUTFIT rework), P6 (STAY + LODGING_GUIDE) ship with proper widths from day one rather than needing UX patches afterwards.

The rule covers six bullets:

1. Two-row grid maximum per editable line.
2. Per-cell labels above every input — `FieldLabel` + `Label` primitives in the per-card files, lifted to a shared module when P4 needs them.
3. Minimum column widths by field type (Name ≥4, £ ≥3, Qty ≥2, etc.).
4. Toggles / flag checkboxes / reorder + remove on a third compact row.
5. View mode mirrors the edit-mode proportions.
6. Helper hints stay on top-of-card fields, not per-line inputs.

Marked **temporary** — re-evaluate after v1.38.0 (last phase of the Book expansion arc): promote to permanent if it's still serving the codebase, or relax if it gets in the way of a card kind we haven't anticipated.

**Files:** `BOOK-EXPANSION-PLAN.md` (new §10a), `package.json` bump, this changelog entry.

**Verification:** typecheck + lint + 271 tests + clean `.next` build all green. No code changed.

**Next:** v1.34.0 P4 — LEGAL card + Legal split, ships against §10a from the start.

### 2026-04-30 · v1.33.1 — Edit-row layout pass

User-reported while reviewing v1.32.2: drinks fields squashed in the BAR card edit row. Six fields packed into a single 12-column grid (category 3, name 3, timing 2, qty 1, unit 1, £ 2) was uncomfortably tight on the ~660 px card width.

**Fix applied to all three multi-field card editors:**

- **BAR ItemEditRow** — 6-field row split into **two grids of 3+4 fields each**. Row 1: Name (6/12) · Category (3/12) · When (3/12). Row 2: Drinks/head or Qty (2/12) · Unit (2/12) · Supplier (4/12) · £ Total or £/head (4/12). Supplier comes back into the main grid (was tucked next to the pricing toggle in v1.32.2). Pricing toggle + reorder/remove stay on the third compact row.

- **SETUP ItemEditRow** — split into two rows. Row 1: Item (6/12) · Qty (2/12) · Location (4/12). Row 2: Source/supplier (6/12) · Pack-down plan (6/12). Packed/placed flags + reorder/remove on the third row.

- **BUILD MaterialEditRow** — split into two rows. Row 1: Material (8/12) · Qty (2/12) · Unit (2/12). Row 2: Supplier (8/12) · £ Total cost (4/12). Ordered/arrived flags + reorder/remove on the third row.

- **MENU OptionEditRow** unchanged — already used a 2-col `label / dietary` grid plus a full-width description row, with comfortable widths.

**Per-cell labels.** Each field now has a small uppercase label above it (`Name`, `Category`, `When`, etc.). Even at narrow widths the row is recognisable at a glance — matches the v1.31.1 BUILD-header pattern with helper hints.

**Common helpers.** Added `FieldLabel` (grid-cell wrapper) + `Label` (label text) primitives in each of the three card files. They're tiny — a copy in each file is fine; promoting to a shared component is overkill until a fourth card needs the same shape (P4 LEGAL likely will, then we'll move them).

**Files:** `BookBarCard.tsx`, `BookSetupCard.tsx`, `BookBuildCard.tsx` — only the edit-row sections. View-mode display + server actions + audit metadata all unchanged.

**Verification:** typecheck + lint clean, 271 unit tests pass, clean `.next` build green. No schema or migration changes — pure client-side layout.

**Next:** v1.34.0 P4 — LEGAL card + Legal section split (the LEGAL card editor will use the same FieldLabel/Label shape from day one, and we'll lift the helpers out into a shared file then).

### 2026-04-30 · v1.33.0 — Wedding Book SETUP card (P3) + Venue split

Third phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two changes that fit naturally together: a new `SETUP` card kind for per-space spatial walkthroughs, and a section split that gives `SETUP` cards (and the v1.31.0 `BUILD` cards) cleaner homes.

**SETUP card** — one card per physical space (Ceremony room / Drinks reception / Reception room / Evening setup / Pack-down). Header has space, setup-start time, owner. Items table with name + quantity + location ("Top of aisle", "Round-table centre"…) + source (autocompletes from Supplier names — read-time string match, no FK) + packed/placed checkbox columns + pack-down plan column. Header progress stat shows `% packed · % placed`.

**Schema:** `SETUP` added to `BookSubsectionKind`. Two new tables — `BookSetupCard` (1:1 with subsection) + `BookSetupItem` (line items). Migration `20260430050000_book_setup_card`, additive only.

**Pure helper:** `setupRollups({ items })` in [src/lib/book-cards.ts](src/lib/book-cards.ts) returns `{ itemCount, packedCount, placedCount, percentPacked, percentPlaced }`. Integer-rounded percentages, 0% on empty cards (no NaN). 5 unit tests cover boundary + empty + 100% cases.

**Server action:** `saveSetupCard(subsectionId, payload)` — the same single-bulk-save pattern as BUILD / MENU / BAR. Audit-enriched per the v1.30.5 standing rule with `{ space, itemsAdded, itemsUpdated, itemsRemoved, headerChanged }`. New `setup-save` pattern in [src/lib/audit-format.ts](src/lib/audit-format.ts) so the audit log reads as "Saved setup card 'Ceremony room' — added 4 items".

**Editor** — `BookSetupCard.tsx`. Same View / Edit toggle as BUILD / MENU / BAR. Per-item row has packed + placed checkboxes (always on the secondary line so the primary grid stays clean). `source` field has a `<datalist>` populated from existing Supplier names. View mode renders an items table with ●/○ for the two flags.

**Section split — additive.** Two new BookSection rows seeded:

- `venue-spaces` (order 3) — five SETUP cards: Ceremony room, Drinks reception, Reception room, Evening setup, Pack-down (all with sample owner + setup time, empty items list).
- `venue-decor` (order 4) — non-BUILD seed: Printed signage (FIELD), Florist brief (TEXT), Photo booth (FIELD), Décor inspiration (TEXT). The v1.31.0 BUILD cards (Centerpieces / Handmade signage / Place cards) **stay where the v1.31.0 seeder put them** under the legacy `venue` section — moving them automatically risks overwriting user edits, so we leave them. Couples can move them via the UI when convenient.

The legacy `venue` section stays at order 2 with whatever subsections live under it. The `/book` index already filters out empty legacy sections, so once a couple finishes moving cards across, `venue` quietly drops off the hub. Existing sections shift down two slots; the seed's upsert with `update: { order }` re-numbers them on re-run.

**Files:**
- `prisma/schema.prisma` — `SETUP` enum value, two new tables, `BookSubsection.setupCard` back-relation.
- New: `prisma/migrations/20260430050000_book_setup_card/migration.sql`.
- `prisma/seed.ts` — `venue-spaces` + `venue-decor` BookSection rows + `seedVenueSpacesAndDecor()` function (idempotent — skip when subsections > 0).
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; `setupRollups()` helper.
- `src/lib/audit-format.ts` — `setup-save` pattern.
- `src/app/(app)/book/actions.ts` — `saveSetupCard` + new `createBookSubsection` SETUP branch.
- New: `src/app/(app)/book/[slug]/BookSetupCard.tsx`.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — SETUP case + extended `Sub` type with `setupCard` shape (incl. `supplierNames` autocomplete list).
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `setupCard.items`, fetch supplier names when any SETUP card present.
- New: `tests/unit/setup-rollups.test.ts` — 5 cases.

**Verification:** typecheck + lint clean, 271 unit tests pass (+5 SETUP rollups), clean `.next` build green.

**Next:** v1.34.0 P4 — LEGAL card + Legal section split (before / day / after).

### 2026-04-30 · v1.32.2 — BAR per-head pricing + timing

User-asked while reviewing v1.32.0/.1 in the wild: drinks have a per-head amount that varies by time of day — e.g. £2.50/head for the toast drink, separate from bottle-priced lines for dinner wine.

Two additions to `BookBarItem`, both nullable / additive:

- **`pricePerHeadPence`** — when set, the line is costed per cover; `quantityPlanned` becomes "drinks per head"; line total = `pricePerHeadPence × confirmedAdults × (quantityPlanned ?? 1)`. `costPence` is ignored in this mode (the editor nulls it out when toggling to per-head).
- **`timing`** — free-text serving moment (Reception / Toast / Dinner / Evening / Late night by default, datalist-style). Used to group items in the view when any are set.

**Editor:**
- New "Pricing" toggle on each item row: **Total** / **Per head**. Toggling switches the £ input between fixed-cost and per-head input. Suffix `/hd` appears on the per-head input. Quantity column relabels to "drinks/head" when per-head is active.
- New `When` column on each row with a datalist of preset timings.
- Supplier moves to the row's secondary line (next to the pricing toggle) to keep the primary 12-column grid clean.

**View mode:**
- If any item has a timing label, items group **by timing** (Reception → Toast → Dinner → Evening → Late night → other), with a per-group cost subtotal.
- If no timings are set, falls back to the v1.32.0 category grouping.
- Per-head items render as `Toast drink · £2.50/head × 1 drinks · £250.00 (line)` with a `need RSVP count` hint when `confirmedAdults` is null.

**Pure helpers + tests:**
- New `barItemTotalPence(item, confirmedAdults)` exported from [src/lib/book-cards.ts](src/lib/book-cards.ts) — single source of truth for line totals (per-head vs fixed). Reused by both the BAR editor view and `barRollups`.
- Per-head items are explicitly excluded from the bottles-per-adult sanity check (still bottles-only).
- 7 new test cases covering per-head computations: drinks-per-head defaulting, costPence ignored when per-head set, mixed bottles + per-head totals, sanity check stability.

**Schema migration:** `prisma/migrations/20260430040000_book_bar_item_per_head/migration.sql` — adds two nullable columns. Existing items render unchanged.

**Seed update:** the sample BAR card now includes a sixth item — "Toast — Prosecco" at £2.50/head, timing "Toast" — so a fresh seed demonstrates both pricing modes side by side. Existing items gain timing labels (Reception / Dinner / Evening) so the timing-grouped view exercises immediately.

**Files:**
- `prisma/schema.prisma` — `BookBarItem.pricePerHeadPence` + `timing`.
- New: `prisma/migrations/20260430040000_book_bar_item_per_head/migration.sql`.
- `prisma/seed.ts` — per-head toast item + timing labels.
- `src/lib/book-cards.ts` — `barItemTotalPence()` helper, `barRollups` updated to use it.
- `src/app/(app)/book/[slug]/BookBarCard.tsx` — `Item` shape extended; `ViewBody` timing-grouped branch; `ItemEditRow` pricing toggle + per-head £ input + timing field + datalist.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — `BookBarCard.items[]` shape extended.
- `src/app/(app)/book/actions.ts` — `barItemPayloadSchema` extended; `saveBarCard` writes the new fields.
- `tests/unit/menu-bar-rollups.test.ts` — 7 new per-head cases.

**Verification:** typecheck + lint clean, 266 unit tests pass (+7 for per-head), clean `.next` build green.

### 2026-04-30 · v1.32.1 — Audit log retention + search

User-asked while reviewing v1.32.0 in the wild. Two operational
quality-of-life additions to the audit log:

**30-day retention.** Audit rows older than 30 days are pruned by a
lazy sweep inside `logAudit()` ([src/lib/audit.ts](src/lib/audit.ts)).
Runs at most once per hour per process — process-local timestamp
gate (`SWEEP_COOLDOWN_MS`). Fire-and-forget after each successful
audit write; errors are logged but never propagate. No new cron
infra required, which suits the admin-only / low-volume profile of
this app. Multi-instance deploys each track their own cooldown,
which is fine — the DELETE is idempotent and indexed.

New `@@index([createdAt])` on `AuditLog` to make the range-DELETE
cheap. The pre-existing `(userId, createdAt)` composite index isn't
useful for a plain "createdAt < cutoff" query without a userId
predicate. Migration `20260430030000_audit_log_createdat_index`,
additive only.

**Search box on `/settings` audit viewer.** New `audit_q` search
param. When set:

- Database filter: case-insensitive substring match against
  `action`, `entity`, and `user.{name,email}`.
- Post-filter in JS: also matches against the `formatAuditAction`
  output (the human "what" sentence) so a search for a card title
  embedded in metadata (like "Centerpieces") finds the row even
  though `cardTitle` lives in the JSON metadata bag.
- Fetch limit raised to 200 candidates while searching; `Older →`
  cursor pagination is hidden when a search is active. A footer
  hint appears at the cap suggesting the user refine the term.
- Plain GET form — no client JS — so the browser's normal
  form-submission flow handles the navigation. "Clear" link exits
  search mode by stripping the `audit_q` param.

**Files:**
- `prisma/schema.prisma` — `@@index([createdAt])` on AuditLog.
- New: `prisma/migrations/20260430030000_audit_log_createdat_index/migration.sql`.
- `src/lib/audit.ts` — retention sweep + cooldown.
- `src/app/(app)/settings/AuditLogPanel.tsx` — search input + filter logic + result-count copy + capped-result hint.
- `src/app/(app)/settings/page.tsx` — `audit_q` searchParam threaded through.

**Verification:** typecheck + lint clean, 259 unit tests pass, clean `.next` build green.

**Next:** v1.33.0 P3 — SETUP card + Venue → Spaces / Décor split.

### 2026-04-30 · v1.32.0 — Wedding Book MENU + BAR cards (P2)

Second phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md). Two new card kinds, plus three out-of-band corrections that landed alongside.

**MENU card** — food service composition. One card per service (wedding breakfast / kids / evening / late-night). Per-course list of options with allergen tags + vegetarian-main / kids-meal flags. Live counts of guest selections per option, computed server-side at render time by case-insensitive label matching against `Guest.mealStarter / mealMain / mealDessert` (no FK to legacy `MealOption` — that table was unwired, free-text from CSV import is the honest source). Allergen aggregation surfaces dietary tags only against guests who matched ≥1 option. Header shows service type, confirmed headcount, per-head price, total cost.

**BAR card** — drinks plan. One card with items grouped by free-text `category` (Reception drink / Wine / Beer / Soft / Spirits…). Per-head sanity check: flags **low** (< 0.5 bottles/adult), **high** (> 1.5), **ok** (in range), **unknown** (no bottle items or no confirmed adult count) — matched on unit `bottle/bottles/btl`. Header shows bar type, tab limit / corkage, total cost, bottles-per-adult.

**Schema:** `MENU` and `BAR` added to `BookSubsectionKind`. Five new tables — `BookMenuCard` + `BookMenuCourse` + `BookMenuOption`, `BookBarCard` + `BookBarItem`. Migration `20260430020000_book_menu_bar_cards`, additive only.

**Pure helpers** in [src/lib/book-cards.ts](src/lib/book-cards.ts):
- `menuRollups(card, guests)` → `{ totalConfirmed, pricePence, perCourseCounts, allergenAggregate }`. 8 unit tests covering label-match + dietary-aggregation + course/field skipping.
- `barRollups(card, confirmedAdults)` → `{ totalCostPence, perCategory, perHeadFlag, bottlesPerAdult }`. 8 unit tests covering boundary at 0.5 / 1.5, unknown branches, multi-category totals.

**Server actions** — `saveMenuCard` + `saveBarCard`. Both follow the v1.31.1 single-bulk-save pattern: payload of full card state; transactional reconcile (rows with `id` starting `new-` create; existing update; missing delete; positions become `order`). All audit-enriched.

**Editors** — `BookMenuCard.tsx` + `BookBarCard.tsx`. Both follow the v1.31.1 View / Edit toggle: pretty read-only display + single Edit / Save / Cancel flow. £ pounds-and-pence inputs (shared via [bookCardUi.ts](src/app/(app)/book/[slug]/bookCardUi.ts)). Helper hints under every header field.

**Seed:** `seedFoodDrinkCards()` adds two cards under `food-drink`:
- "Wedding breakfast" — MENU, 3 courses × 2 options (with realistic dietary tags), £85/head, plated.
- "Drinks & bar" — BAR, 5 sample items across Reception drink / Wine / Beer / Soft, £2,000 tab limit, Prosecco toast.

Both idempotent — re-seed never overwrites real cards.

**Out-of-band corrections shipped this release:**

1. **BUILD card label renamed "Build" → "DIY"** in user-facing strings (kindBadge on the card and the picker label in `BOOK_CARD_KIND_META`). Schema names (`BookSubsectionKind.BUILD`, `BookBuildCard`) unchanged — internal naming.

2. **Audit log viewer now renders human sentences.** New helper [src/lib/audit-format.ts](src/lib/audit-format.ts) `formatAuditAction({ action, entity, metadata })` turns terse codes into readable phrases:
   - "Saved DIY card 'Centerpieces' — added 2 materials, marked prototype done"
   - "Saved menu 'Wedding breakfast' — added 1 option"
   - "Created task 'Confirm final guest count'"
   - "Updated nav tag 'Music'"
   - 30+ pattern matches across BUILD / MENU / BAR / Task / ScheduleEvent / NavTag / BookSubsection / BookSection plus generic CRUD verbs. `metadata.summary` if explicitly supplied takes precedence. `AuditLogPanel` updated to call the helper.

3. **Standing rule refined.** ROADMAP "Audit-aware feature design" now requires the "what" to be human-readable — either pattern-match a new action code in the formatter or supply `metadata.summary` directly. User memory note updated accordingly.

**Files:**
- `prisma/schema.prisma` — MENU + BAR enum values, 5 new tables, BookSubsection back-relations.
- `prisma/seed.ts` — `seedFoodDrinkCards()` + main() call.
- New: `prisma/migrations/20260430020000_book_menu_bar_cards/migration.sql`.
- New: `src/app/(app)/book/[slug]/BookMenuCard.tsx`, `BookBarCard.tsx`.
- New: `src/app/(app)/book/[slug]/bookCardUi.ts` — shared £-input + new-row-id helpers.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — MENU + BAR cases.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load menuCard + barCard, server-side rollups, guest meal fetch.
- `src/app/(app)/book/actions.ts` — `saveMenuCard` + `saveBarCard` + new createBookSubsection branches.
- `src/lib/book-cards.ts` — `BOOK_CARD_KINDS` + `BOOK_CARD_KIND_META` extended; rollup helpers.
- New: `src/lib/audit-format.ts`.
- `src/app/(app)/settings/AuditLogPanel.tsx` — uses `formatAuditAction`.
- New: `tests/unit/menu-bar-rollups.test.ts` — 16 cases.
- ROADMAP standing rules block.

**Verification:** typecheck + lint clean, 259 unit tests pass (16 new for MENU/BAR), clean `.next` build green.

**Open question handled inline:** §12 cake — RECIPE vs FIELD. Defaulted as RECIPE in seed if confirmed DIY; couple can toggle the seed kind via UI when they decide on a baker. No migration needed for that swap.

**Next:** v1.33.0 P3 — SETUP card + Venue → Spaces / Décor split.

### 2026-04-30 · v1.31.1 — BUILD card UX pass

User feedback round on v1.31.0. Six items, all addressed:

1. **Confusing Qty / Unit labels** — clearer copy. "Qty" is now the row count (small numeric input); "Unit" has a "ea, m, stems" placeholder. Helper hint under each header field explains what it's for ("How many you're making in total" etc.).
2. **Pounds-and-pence cost input** — replaced the raw pence number input with a £ symbol + decimal text input. Stored as integer pence under the hood; display + entry both in £x.xx.
3. **Live link to Budget line** — new `BookBuildCard.budgetLineId` FK to `BudgetLine` (additive migration, `onDelete: SetNull`). The "Copy materials total to Budget" action now stores the FK on the card and on subsequent clicks **updates the existing line in place** instead of creating a duplicate. View mode shows a moss-green pill: "Linked to Budget · £X.XX [view →] [×]". The × unlinks the card from the line (line stays on `/budget`; couple can delete it there if they want).
4. **Status disappearing on save bug** — root cause was the v1.31.0 header form using `<form action>` with `defaultValue` on the `<select>`, which doesn't update after re-render of an uncontrolled input. Refactored the entire BUILD card to controlled React state with a single Edit / Save / Cancel flow.
5. **Single Edit / Save / Cancel flow** — the user feedback on UX. Card now has two distinct modes:
   - **View mode** — pretty read-only display. Stat strip + status pill + budget pill + materials table (read-only) + notes. Single "Edit" button bottom-right plus "Copy total to Budget" / "Update Budget line" left side.
   - **Edit mode** — every header field becomes editable, materials gain inline edit + reorder + delete + add-row affordances, all field hints visible. Single "Save changes" + "Cancel" buttons bottom-right.
   - Sessions sit *outside* the edit toggle — they're append-only quick log actions. "+ Log session" + per-row trash icon are always available when the user can edit.
6. **`/diy` overview page** — new top-level page (added to nav under People group) listing every BUILD card across the Wedding Book. Each row shows status pill + section + target date + units done/needed + hours + materials total + ordered/arrived percentages. Done cards go to the bottom; everything else sorts by target date (sooner first). Top-line totals strip: project count, units done, hours logged, total materials spend. Click any row to deep-link into the source section anchored at that card.

**Schema:** `BookBuildCard.budgetLineId String?` (nullable FK to `BudgetLine`, `onDelete: SetNull`, indexed). `BudgetLine.buildCards` back-relation. Migration `20260430010000_book_build_budget_link`, additive only.

**Server actions:**
- `copyBuildMaterialsToBudget` rewritten — first call creates the line and stores its FK; later calls update in place.
- New `unlinkBuildBudgetLine` — clears the FK, leaves the line.
- New `saveBuildCard(subsectionId, payload)` — single bulk save replacing the per-row create/update/delete actions for everything except sessions. Server reconciles materials in a transaction: rows with `id` starting `new-` → create; existing ids → update; existing ids missing from payload → delete; positions in the array become the `order` field. Audit logs a single update with `{ headerChanged, materialsAdded, materialsRemoved, materialsUpdated }`.
- Per-row material actions kept as exports for any future inline-edit surface; not used by the editor any more.

**Visual polish:**
- Status options rendered as coloured tone pills: Designing (neutral), Prototyping (blue), Producing (marigold), Done (moss).
- Stat strip cards use bigger fonts, more breathing room, distinct background.
- Materials table read-mode shows ●/○ for ordered/arrived flags instead of checkbox stubs.
- Edit-mode material rows have a single grid layout (12-column) with checkboxes on a separate sub-row.
- Budget pill has a green tone matching the ordering/arrived ●.

**Files:**
- `prisma/schema.prisma` — `BookBuildCard.budgetLineId` + relation + index, `BudgetLine.buildCards` back-relation.
- New: `prisma/migrations/20260430010000_book_build_budget_link/migration.sql`.
- `src/app/(app)/book/actions.ts` — rewrote `copyBuildMaterialsToBudget`, added `unlinkBuildBudgetLine` + `saveBuildCard`.
- `src/app/(app)/book/[slug]/BookBuildCard.tsx` — full rewrite with View/Edit modes, controlled state, £-input, helper hints, budget pill.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — extended `Sub.buildCard` shape with `budgetLineId` + `budgetLine` snapshot.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `buildCard.budgetLine`; coerce Decimal `estimated` to plain number before crossing the client boundary.
- New: `src/app/(app)/diy/page.tsx` — overview page.
- `src/components/shell/nav-config.ts` — `/diy` entry under the People group.

**Verification:** typecheck + lint + 243 unit tests + clean `.next` build green; new `/diy` route built (109 kB shared + 181 B page).

**Next:** v1.32.0 P2 — MENU + BAR cards.

### 2026-04-30 · v1.31.0 — Wedding Book BUILD card (P1)

First phase of the [Book expansion arc](BOOK-EXPANSION-PLAN.md) — a new `BUILD` card kind that tracks DIY production projects (centerpieces, place cards, handmade signage, favours, programs) end-to-end inside a single Wedding Book card. **One card per project.**

**Schema:** `BUILD` added to `BookSubsectionKind`. Three new tables — `BookBuildCard` (1:1 with `BookSubsection`), `BookBuildMaterial` (line items per card), `BookBuildSession` (production sessions logged per card). Migration `20260430000000_book_build_card`, additive only.

**Card features:**

- **Header strip** — units done / quantity, hours logged / estimated, status pill, target date with days-remaining countdown.
- **Status options:** Designing → Prototyping → Producing → Done.
- **Materials table** with `ordered` + `arrived` checkbox columns, in-place edit/reorder/remove, supplier + cost.
- **Sessions log** — date, minutes, units completed, optional notes; "+ Log session" prefills today.
- **Prototype-blocker banner** — fires when target is within 30 days and prototype not yet ticked.
- **One-click "Copy materials total to Budget"** — creates a draft `BudgetLine` in a "DIY production" category (find-or-create) with the rolled-up cost. Manual review on `/budget`. No auto-sync per the v1.30.5 cross-module-wiring rule.

**Pure helper.** `buildRollups()` in [src/lib/book-cards.ts](src/lib/book-cards.ts) computes everything the header strip + the prototype-blocker need. Unit-tested with 11 cases including the 30-day boundary, null inputs, and past target dates.

**Audit enrichment** per the v1.30.5 standing rule — every BUILD action logs snapshot fields:
- `build-update` → `{ title, status, quantityNeeded, targetDate, changedFields }`.
- `build-material-{create,update,delete,flag,reorder}` → `{ cardTitle, materialName, … }`.
- `build-session-{create,update,delete}` → `{ cardTitle, minutes, unitsCompleted, sessionDate }`.
- `build-copy-to-budget` → `{ cardTitle, materialCount, totalPence, budgetLineId }`.

**Files:**
- New: `prisma/migrations/20260430000000_book_build_card/migration.sql`.
- `prisma/schema.prisma` — `BUILD` enum value, three new tables, `BookSubsection.buildCard`.
- `prisma/seed.ts` — `seedBuildCards()` adds three sample BUILD cards under `venue` (Centerpieces with 3 materials, Handmade signage, Place cards). Idempotent.
- `src/lib/book-cards.ts` — `buildRollups()` + types + meta entry.
- `src/app/(app)/book/actions.ts` — 11 new BUILD server actions, all gated + audited + result-shape.
- New: `src/app/(app)/book/[slug]/BookBuildCard.tsx` — editor with header form, Materials, Sessions, Copy-to-Budget.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — `case "BUILD"` branch + extended `Sub` type.
- `src/app/(app)/book/[slug]/page.tsx` — eager-load `buildCard` with `materials` + `sessions`.
- New: `tests/unit/build-rollups.test.ts` — 11 test cases.

**Verification:** typecheck + lint + 243 unit tests pass (up from 232 with 11 new BUILD-rollup tests), clean `.next` build green.

**Open questions before P1 ships** (from the planning pass): welcome bags / favours / programs DIY status was undecided so they're deferred from the seed. They can be added later via the UI with no schema change.

**Next:** v1.32.0 P2 — MENU + BAR cards.

### 2026-04-30 · v1.30.6 — Track Book expansion plan in the repo

Docs-only release. Adds [BOOK-EXPANSION-PLAN.md](BOOK-EXPANSION-PLAN.md) to the repo so future Claude sessions see it on `git status` rather than relying on a working-tree-only file.

The doc defines an eight-phase rebuild of the Wedding Book module: **12 sections (9 active + 3 legacy) and 12 card kinds (5 existing + 7 new), plus a Tiptap WYSIWYG editor for TEXT cards** with a deliberately small mark set. Each phase ships as one tagged release v1.31.0 → v1.38.0:

| Phase | Version | Headline |
|---|---|---|
| P1 | v1.31.0 | BUILD card (DIY production tracker) |
| P2 | v1.32.0 | MENU + BAR cards (Food & Drink rebuild) |
| P3 | v1.33.0 | SETUP card + Venue → Spaces / Décor split |
| P4 | v1.34.0 | LEGAL card + Legal → Before / Day / After split |
| P5 | v1.35.0 | OUTFIT rework (one-card-per-person) + Wedding Party split |
| P6 | v1.36.0 | STAY + LODGING_GUIDE cards (Accommodation rebuild) |
| P7 | v1.37.0 | TEXT WYSIWYG + FIELD/RECIPE/SHOT_LIST upgrades + cross-module wiring |
| P8 | v1.38.0 | Seed refresh + Post-wedding section + production backfill |

Two reconciliations against current state, captured in the planning notes:

- **Task ↔ Book linking is now m2m at BookSection level (v1.30.5)**, not single-FK at BookSubsection level (v1.30.0). Every reference to `Task.bookSubsectionId` in the Book plan reads as "the existing Topics multi-select wires up automatically when new sections are added".
- **Audit-aware feature design is a standing rule** (v1.30.5). Every server action in P1–P8 emits enriched audit metadata (snapshot fields + `changedFields` diff on updates), not just `{ entity, entityId }`.

Sequencing decision: Book plan first, existing backlog (audit log enrichment sweep, permission-group model, ceremony group colours, numeric auth, production-promotion lag) all defer to v1.39.0+.

**Files:** `BOOK-EXPANSION-PLAN.md` (new, ~1300 lines), `ROADMAP.md` (this entry), `package.json` (bump).

**Verification:** typecheck + lint + 232 unit tests + clean `.next` build all green. No code changed.

### 2026-04-29 · v1.30.5 — Schema cleanup · Topics multi-select · audit rule

Three landings in one tagged release.

**1. Schema cleanup.** Two legacy bits dropped after their one-release recoverability buffer elapsed:

- `PhotographyShot` table — data migrated to `BookShot` rows in v1.27.6. New migration: `prisma/migrations/20260429090000_drop_photography_shot/migration.sql`.
- `ScheduleEvent.audience` String[] column — replaced by `attendeeIds` in v1.27.1. Five files touched to remove read fallbacks (`schedule/page.tsx`, `ScheduleClient.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `EventNode.tsx`); `seedScheduleEvents()` rewritten to use real user IDs. New migration: `prisma/migrations/20260429100000_drop_schedule_audience/migration.sql`.
- `TodayEventsCard` and the day-of timeline both lost their persona-based audience filtering and switched to `attendeeIds.includes(currentUserId)` for the "Mine" persona — semantically tighter (matches actual attendees, not role heuristics).

**2. Topics multi-select.** Replaces v1.30.0's single-select Wedding Book subsection link with a unified multi-select that combines BookSections **and** a new user-configurable NavTag list.

- New `NavTag` model + four seeded defaults (Music · Ceremony · Reception · Guests, with optional `route` deep-links to the matching app routes).
- v1.30.0's `Task.bookSubsectionId` rolled up to `Task.bookSections` m2m at the section level (coarser scope per user feedback). v1.30.0 data backfilled to the parent section in the migration.
- New `TopicPicker` component renders a chip row + grouped checkbox dropdown (Wedding Book + Nav tags). Read-only mode renders the chip row without the trigger.
- `TaskForm`, `TaskDrawer`, `AddTaskToggle`, `TaskList` all switched from the v1.30.0 single-select to the new multi-select. `TaskList` group-by gains a "Topic" option that buckets by the union of book sections + nav tags (a task in two topics appears in both).
- `LinkedTasksPanel` extracted from `CardRouter` to its own file and relocated to render once per page (above the cards) on `/book/[slug]`, sourced from the section-level m2m.
- New `Settings → Navigation tags` couple-only block for CRUD on the NavTag list. `nav-tag-actions.ts` server actions follow the result-shape pattern with full audit metadata (`name`, `slug`, `route`, `linkedTaskCount` on delete).

New migration `prisma/migrations/20260429110000_task_topics_links/migration.sql` does it all in one block: NavTag table, both implicit-m2m junction tables (`_BookSectionToTask` + `_NavTagToTask`), backfill from v1.30.0, then drop the v1.30.0 column / FK / index.

**3. New standing rule + first-pass audit enrichment.** User added the rule this turn:

> Audit-aware feature design — after each feature request, scan for audit/activity-list opportunities. When adding an audit row, enrich its metadata with relevant snapshot fields. Logging only `{ entity, entityId }` is the minimum, not the target.

Persisted into the project's Conventions block (so any future plan that ignores it gets caught at review time). Applied to every audit touch-point this release opened:

- `createScheduleEvent` → metadata `{ title, startTime, allDay, attendeeCount }`.
- `updateScheduleEvent` → same snapshot **plus** `{ changedFields }` diff against the pre-update row.
- `deleteScheduleEvent` → `{ title, startTime }` snapshot read pre-delete.
- `createTask` → `{ title, type, supplierId, bookSectionIds, navTagIds }`.
- `updateTask` → `{ title, type, changedFields }` with diff covering 9 task fields including the m2m relations.
- `deleteTask` → `{ title, type }` snapshot pre-delete.
- All NavTag CRUD actions → `{ name, slug, route }` snapshots.

Broader audit sweep (guests, suppliers, payments, files, seating, book cards, plus the recent-activity feed surface) remains the v1.31.0 design item.

**Files modified:**
- `prisma/schema.prisma` — drop PhotographyShot model + ScheduleEvent.audience; drop v1.30.0 Task.bookSubsectionId/relation/index; add NavTag + Task.bookSections + Task.navTags m2m + BookSection.tasks back-relation; remove BookSubsection.tasks.
- `prisma/seed.ts` — drop seedPhotographyShots, rewrite seedScheduleEvents to attendeeIds, add seedNavTags.
- 3 new migrations.
- `src/app/(app)/schedule/actions.ts` — drop audience; enrich audits.
- `src/app/(app)/schedule/page.tsx`, `ScheduleClient.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `EventNode.tsx` — remove audience.
- `src/app/(app)/TodayEventsCard.tsx` — switch from role-based to attendeeIds-based "Mine" filter.
- `src/app/(app)/page.tsx` — pass currentUserId.
- `src/app/(app)/today/day-of/page.tsx` — drop audience read.
- New: `src/app/(app)/tasks/TopicPicker.tsx`.
- `src/app/(app)/tasks/TaskForm.tsx`, `TaskDrawer.tsx`, `AddTaskToggle.tsx`, `TaskList.tsx` — Topics multi-select wiring + group-by topic.
- `src/app/(app)/tasks/actions.ts` — parseTopicKeys + m2m connect/set + enriched audits.
- `src/app/(app)/tasks/page.tsx`, `questions/page.tsx` — fetch BookSections + NavTags.
- `src/app/(app)/book/[slug]/page.tsx` — section-level linked-tasks fetch + render.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — strip per-card panel.
- New: `src/app/(app)/book/[slug]/LinkedTasksPanel.tsx`.
- New: `src/app/(app)/settings/NavTagsBlock.tsx` + `nav-tag-actions.ts`.
- `src/app/(app)/settings/page.tsx` — mount NavTagsBlock.
- `ROADMAP.md` — Conventions block gains the audit rule.

**Verification:** typecheck + lint clean, all 232 unit tests pass, clean `.next` build green. Manual paths exercised in the verification block of the original plan.

### 2026-04-29 · v1.30.0 — Tasks ↔ Wedding Book subsection link

User-asked (29 Apr 2026, the bulk-asks list): "I want to be able to assign task, decisions and questions to the wedding book sections, the tasks will then also display filtered but searchable under each section". Mirrors the v1.28.0 supplier-link shape, scoped to `BookSubsection` instead of `Supplier` — so a task can attach to a specific *card* on a Wedding Book page, not just the page-level section. (Tighter granularity reads better: "what time do we need the catering recipe?" sits next to the recipe card, not floating on the section.)

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)):

```prisma
model Task {
  …
  bookSubsectionId String?
  bookSubsection   BookSubsection? @relation(fields: [bookSubsectionId], references: [id], onDelete: SetNull)
  @@index([bookSubsectionId])
}

model BookSubsection {
  …
  tasks Task[]
}
```

`onDelete: SetNull` — deleting a card doesn't cascade-delete linked tasks (matches v1.28.0 supplier link reasoning).

**Migration:** `prisma/migrations/20260429080000_task_book_subsection_link/migration.sql` — additive: column + FK + index.

**Picker:** new `BookSubsectionOpt` shape exported from `TaskForm` (`{ id, title, sectionTitle }`). The picker option label is `${sectionTitle} · ${title}` so two cards with the same name on different pages stay unambiguous. Threaded through `AddTaskToggle` (create form) and `TaskDrawer` (edit) — both pages (`/tasks` + `/questions`) fetch the flattened list and pass it down. Picker hidden when there are no subsections (fresh installs stay tidy).

**Read side — Linked tasks panel.** `/book/[slug]/page.tsx` fetches all tasks where `bookSubsectionId IN (subsection ids)` and groups them by subsection. Each group is passed to the matching `<CardRouter>` and rendered below its card via a new `LinkedTasksPanel` component — uppercase header strip with title + filtered/total count + a small client-side search input (scoped to the card's tasks) + a "Manage →" link to `/tasks`. Cards with no linked tasks render the panel as null so empty cards stay clean.

**Files:**
- `prisma/schema.prisma` — Task.bookSubsectionId/relation/index, BookSubsection.tasks back-relation.
- `prisma/migrations/20260429080000_task_book_subsection_link/migration.sql` — new.
- `src/app/(app)/tasks/actions.ts` — `bookSubsectionId` in baseSchema + create/update.
- `src/app/(app)/tasks/TaskForm.tsx` — `BookSubsectionOpt` export + side-by-side picker layout (Supplier + Wedding Book card).
- `src/app/(app)/tasks/TaskDrawer.tsx` — bookSubsectionId state + dirty + picker UI.
- `src/app/(app)/tasks/AddTaskToggle.tsx` — `bookSubsections` prop + `defaultBookSubsectionId`.
- `src/app/(app)/tasks/TaskList.tsx` — pass-through to TaskDrawer.
- `src/app/(app)/tasks/page.tsx` + `src/app/(app)/questions/page.tsx` — fetch sections + flattened subsection list, pass down.
- `src/app/(app)/book/[slug]/page.tsx` — fetch linked tasks for visible subsections, group by subsection.
- `src/app/(app)/book/[slug]/CardRouter.tsx` — new `LinkedTasksPanel` component, every kind branch wrapped to render the panel below the card.

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green.

**Out of scope for this release** (intentionally — keeps the slice shippable):
- *Adding "+ New task" affordance directly on each card.* Today the user creates tasks from `/tasks` and links them via the picker. A per-card "+" button is a follow-up — the data path is in place.
- *Section-level (vs subsection-level) link.* The schema is currently subsection-scoped; aggregating to section is a read-side change if needed.
- *Navigational subsections (music / reception / ceremony / guests).* Quick seed-only follow-up — defer until the user asks for the specific seed payload.

### 2026-04-29 · v1.29.0 — Task grouping

User-asked (29 Apr 2026, the bulk-asks list): "Allow task grouping, by assignee, category, supplier, priority, status".

**UI:** new `Group` dropdown on the Tasks page, sitting next to the existing `Sort` dropdown. Six options: **None / Assignee / Category / Supplier / Priority / Status**. Defaults to None (renders the v1.28.x flat list unchanged), persists per-browser via `localStorage[wh_tasks_group]`.

**Render:** when grouping is active, rows split into ordered sections — each with a small uppercase header strip showing the bucket label + a count of rows in that bucket. The list/board toggle is unaffected (Board view always shows status columns; Group only restructures the List view).

**Bucket order**:
- *Assignee* — populated buckets first (alphabetical), Unassigned last.
- *Category* — populated buckets first (alphabetical), Uncategorised last.
- *Supplier* — populated buckets first (alphabetical), No supplier last. Bucket label is `name · category` (matches the picker option label).
- *Priority* — fixed Urgent → High → Medium → Low.
- *Status* — fixed OPEN → IN_PROGRESS → WAITING → DONE → ARCHIVED. Header labels match the existing pill copy (TODO / DOING / WAITING / DONE / ARCHIVED).

**Sort + group are orthogonal.** Within each group section the rows preserve the active Sort key's order — so "Group by Category, Sort by Due date" gives sections per category with each section's rows sorted soonest-first. The same applies for "Smart" (the default sort), which collapses DONE rows to the bottom *within* each group.

**Files:** all changes in `src/app/(app)/tasks/TaskList.tsx`. Added the `GroupKey` type, `GROUP_LABELS` map, `PRIORITY_ORDER` / `STATUS_ORDER` arrays, `suppliersById` lookup, the `groups` `useMemo` that produces ordered `{ key, label, tasks }` sections, the dropdown beside Sort, and the new sectioned render. Original flat-list path is preserved as the `groupKey === "none"` path through the same renderer (single synthetic section with empty label).

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green. Manual: open `/tasks`, set Group → Category, sections appear in alphabetical order with task counts; Group → Supplier, ditto; Group → None, sections collapse back to flat. Refresh — selection persists.

### 2026-04-29 · v1.28.0 — Task ↔ Supplier link

User-asked (29 Apr 2026, the bulk-asks list): "Linked Supplier to a Task / decision or question". Tasks (and questions and decisions, which share the same `Task` row under the hood) can now optionally point at a `Supplier`. The link surfaces in three places:

1. **Supplier picker on the task forms** — both the create form (`AddTaskToggle` → `TaskForm`) and the edit drawer (`TaskDrawer`) gained an optional Supplier dropdown. Hidden when the workspace has no suppliers yet, so fresh installs stay uncluttered. Reusable `SupplierOpt` shape exported from `TaskForm` mirrors the existing `UserOpt`.
2. **Linked tasks section on the supplier detail page** — read-only list under CustomFields and above Payments. Shows TYPE label, title (line-through when DONE), status pill, due-date column. Empty state nudges the user toward the Tasks page. Header link "See all on Tasks →" deep-links into `/tasks?supplier=<id>`.
3. **Server-side filter on `/tasks?supplier=<id>`** — the Tasks page reads the `supplier` searchParam, narrows the prisma query to that supplier, and renders an info banner ("Filtered by supplier: …  · Clear ×") above the FilterTabs. The rest of the search/filter UI stays interactive so the user can pivot from there.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)):

```prisma
model Task {
  …
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  @@index([supplierId])
}

model Supplier {
  …
  tasks Task[]
}
```

`onDelete: SetNull` so deleting a supplier doesn't cascade-delete the tasks/questions/decisions linked to them — the discussion thread about "what should we ask the photographer?" outlives the booking decision.

**Migration:** `prisma/migrations/20260429070000_task_supplier_link/migration.sql` — additive only: nullable column, FK with SET NULL, index for the supplier-detail query.

**Files modified:**
- `prisma/schema.prisma` — Task.supplierId/supplier relation + index, Supplier.tasks back-relation.
- `prisma/migrations/20260429070000_task_supplier_link/migration.sql` — new.
- `src/app/(app)/tasks/actions.ts` — supplierId in baseSchema + create/update.
- `src/app/(app)/tasks/TaskForm.tsx` — SupplierOpt type + supplier picker UI.
- `src/app/(app)/tasks/AddTaskToggle.tsx` — suppliers prop + defaultSupplierId pass-through.
- `src/app/(app)/tasks/TaskDrawer.tsx` — supplierId state + dirty check + picker UI.
- `src/app/(app)/tasks/TaskList.tsx` — suppliers prop pass-through to TaskDrawer.
- `src/app/(app)/tasks/page.tsx` — supplier query, searchParams supplier filter, banner.
- `src/app/(app)/questions/page.tsx` — suppliers prop on AddTaskToggle.
- `src/app/(app)/suppliers/[id]/page.tsx` — fetch tasks include + Linked tasks section.

**Verification:** typecheck + lint clean, 232 unit tests pass, clean `.next` build green.

### 2026-04-29 · v1.27.9 — Tasks polish round 3 + all-day display fix

User-reported (29 Apr 2026): four small but visible Tasks/Today asks bundled together. Versioned together (skipping v1.27.8) because the type-system changes to `EventLite` would have failed typecheck if shipped half-done.

**Tasks polish:**

1. **Drop the bordered container around the task list.** The mockup renders rows directly on the page background; the v1.27.3-vintage `bg-surface border rounded shadow` wrapper made the list look like a card-within-a-card. Replaced by a bare `<>` fragment so the header strip + rows now sit flat on the canvas, separated only by the existing per-row `border-b border-border-soft`.
2. **Wider rightmost columns.** `gap-3` → `gap-5` on both the header strip and `TaskRow`. Priority cell `w-14` → `w-16`; Status / Due / Category cells `w-20` → `w-24`. The MED/HIGH/LOW pills + status badges + dates + category chips now have a comfortable amount of breathing room and no longer feel squished.
3. **Type changer in the drawer.** `TaskDrawer` was hard-coding `task.type` on save, so a row created as `TASK` could never be converted to `QUESTION` / `DECISION` (or vice versa) without going through the admin-only `updateTask` path. Added a `TYPE_OPTIONS` pill row at the top of the drawer form that mirrors the existing Status / Priority pill styling. The model has always been polymorphic — this just exposes the toggle.

**All-day display fix:**

4. **Upcoming events: render "All day" instead of "01:00" for all-day events.** Pre-fix the Today page's `TodayEventsCard` and the `/today/day-of` timeline both ran `toLocaleTimeString` on the stored `startTime`, which is midnight-UTC for all-day events — that renders as `01:00` in BST and similar offset in other locales. v1.27.1 added `ScheduleEvent.allDay` (and the editor toggle) but never threaded it through to the read-side. Fixed by:
   - Adding `allDay: boolean` to the `EventLite` shape in `TodayEventsCard` and reading it on the time render.
   - Passing `e.allDay` through in `(app)/page.tsx`'s `events.map(...)`.
   - Adding the same conditional on the day-of timeline (`(app)/today/day-of/page.tsx`) where the event row's left-side time block now reads "All day" instead of `00:00`.

**Files:**
- Modified: `src/app/(app)/tasks/TaskList.tsx`, `src/app/(app)/tasks/TaskRow.tsx`, `src/app/(app)/tasks/TaskDrawer.tsx`.
- Modified: `src/app/(app)/TodayEventsCard.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/today/day-of/page.tsx`.

**Verification:** typecheck + lint + 232 unit tests + clean `.next` build all green.

### 2026-04-29 · v1.27.7 — Guest detail side panel on seating canvas

User-asked (29 Apr 2026). Click (no drag) a seated guest dot on the seating canvas → a `GuestDetailPanel` opens in the canvas sidebar with the guest's record. Mirrors the v1.22.x click-vs-drag distinction the existing seat-drag-source uses (4px pointer-move threshold from v1.22.9 — anything under that is treated as a click).

**Wiring:**

- The seating page (`page.tsx`) already fetches every non-archived guest for the AllGuestsPanel. v1.27.7 extends the `select` to include `email · isChild · dietary · plusOneAllowed · plusOneName · notes · household.name` so the detail panel has everything it needs without a separate round-trip on click.
- `SeatingCanvas` gains a `focusedGuestId` state alongside the existing `focusedId` (table). The two are mutually exclusive — clicking a guest closes any focused table, and vice versa. Sidebar selection always shows one entity.
- The seat-source `<circle>`'s `onPointerUp` already had a "plain click — ignore" branch when `!ds.moved`. v1.27.7 swaps that early-return for `setFocusedGuestId(ds.guestId)` so the click opens the panel.

**Panel contents** (read-only summary): full name + RSVP pill + child badge + current table; household name; email; plus-one status (with name if set); dietary chips; notes. An empty-state line ("No extra details on file…") shows when the guest has nothing populated. An **"Open record →"** link sends the planner to `/guests/[id]` for the full editable form — keeping the panel read-only avoids maintaining a second copy of the guest-edit form.

Sidebar mount: same `CollapsiblePanel` shape as the table FocusPanel — title shows "Guest: {firstName}", × button closes, persists open/closed via `wh_seating_panel_guest_focus`.

**Files:**
- New: `src/app/(app)/seating/GuestDetailPanel.tsx`.
- Modified: `src/app/(app)/seating/page.tsx` (fetch the extra fields).
- Modified: `src/app/(app)/seating/SeatingClient.tsx` (extended `AllGuest` type).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` (focusedGuestId state, click handler, sidebar mount).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/seating`, click a seated guest dot → drawer opens with their record. Click another seated guest → swaps to the new one. Click a table → guest panel closes, table FocusPanel opens.

### 2026-04-29 · v1.27.6 — Photography migration

The v1.26.0 modular-cards release deferred the photography migration as a separate step (per the original plan, to keep the v1.26.0 commit focused). This release lands it.

**Migration `20260429060000_photography_to_book_shotlist`** (idempotent — bails if the Photography section already has a SHOT_LIST subsection, or there are no PhotographyShot rows to move):

1. Look up the Photography section by `slug = 'photography'`.
2. Insert one `BookSubsection` with `kind = SHOT_LIST` (slug `shot-list`, title "Shot list") into it, ordered after any existing TEXT subsections.
3. Insert one `BookShotList` linking that subsection.
4. Copy every `PhotographyShot` row → `BookShot`, preserving `title / withWhom / location / notes / captured / capturedAt / order`. New cuid-style IDs prefixed `mig_` so they're recognisable as migration-origin without colliding with anything users add later.

The bespoke route at `src/app/(app)/book/photography/` is **deleted** (`page.tsx`, `ShotsClient.tsx`, `actions.ts`, `PrintShotsButton.tsx`). `/book/photography` continues to work — Next.js routes through the dynamic `/book/[slug]` page now, which renders the migrated SHOT_LIST card via the v1.26.0 `CardRouter`.

`db.photographyShot.findMany` reference in `/book/page.tsx`'s shot-count surface swapped to `db.bookShot.findMany` — same shape, same shot-count UX.

**Legacy retention.** The `PhotographyShot` table is **retained** for one release as a recoverability buffer. v1.28.0's schema-cleanup release drops it (along with `ScheduleEvent.audience` from v1.27.1).

**Files:**
- New: `prisma/migrations/20260429060000_photography_to_book_shotlist/migration.sql`.
- Deleted: `src/app/(app)/book/photography/page.tsx`, `ShotsClient.tsx`, `actions.ts`, `PrintShotsButton.tsx`.
- Modified: `src/app/(app)/book/page.tsx` (PhotographyShot → BookShot count source).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual (post-deploy): open `/book/photography` → renders the migrated shot-list card with all original shots, captured states preserved.

### 2026-04-29 · v1.27.5 — Mobile nav full `<Link>` revert

v1.25.2 probed the mobile-nav `<Link>` revert with the Today tab only — Tasks / Guests / More-sheet items stayed as plain `<a href>` from v1.25.0 as a fallback. The `ServiceWorkerCleanup` mounted at root in v1.25.2 unregisters any inherited stale SW on first paint, so the original cache trap that broke `<Link>` navigation can't re-occur. With v1.25.2 + v1.25.3 + v1.26.0 + v1.27.0–v1.27.4 all having shipped without regression, it's safe to graduate the rest of the tabs back to client-side navigation.

Result: faster perceptual nav (no full page reload), `<Link>` prefetch on hover, and the per-tab branching from v1.25.2 collapses back into one happy path. ([MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx))

### 2026-04-29 · v1.27.4 — Tasks visual style match: text tabs · dynamic category pills

User shared a side-by-side screenshot comparison — the v1.27.3 layout still didn't match the target mockup. User clarified: *"Anything added can stay, I just want the same style."* So this release keeps every feature from v1.27.0–v1.27.3 (search input, sort dropdown, done-circle, category column) and adjusts only the *visual* style:

**1. List/Board → text-underline tabs.** Pre-fix the toggle was a pill pair on the right of the FilterTabs row. Now it sits at the top of the page just below the title, two text labels with active-tab bottom-border accent — matches the mockup exactly. Sits in its own bg-surface band above the search/filter band.

**2. Filter pills become dynamic.** Pre-fix only four hardcoded pills (All / Mine / Open / Done). Now: predefined four (All / Mine / Questions / Done) plus one pill per distinct category tag computed from the current task set's `tags[0]` (alphabetical order, stable across renders), plus a "+ View" placeholder pill for the saved-views feature on the wider backlog. Filters that target a category use a `cat:<name>` value internally so the predefined and category strings can't collide.

**3. New Questions filter.** Replaces "Open" — toggles to QUESTION + DECISION rows so the planner can chase open answers from the Tasks page (the existing Questions page surfaces them too, but having the filter inline is convenient when you're already filtering by category).

**4. "+ View" stub.** Saved-views are a future feature (open-question on whether they should be per-user or shared). The pill is a no-op visual stub so the layout matches the mockup.

**Files:** `src/app/(app)/tasks/FilterTabs.tsx` (dynamic pills + View stub + dropped List/Board pill toggle), `TaskList.tsx` (text List/Board tabs at top, dynamic-category state, `cat:` filter handling), `TaskRow.tsx` (added explicit Category cell to align with the kept column header).

**Verification:** typecheck/lint clean, all 232 unit tests pass, build green. Manual: open `/tasks` → List/Board are now text tabs at the top. Filter row shows dynamic categories ("Budget", "Groom Prep", etc) computed from your real task tags. Click a category pill → list filters. Click "Questions" → switches to questions/decisions.

**Roadmap cleanup landed in this release:** marked Modular page cards (v1.26.0), Schedule polish (v1.27.1), Mobile navbar redirect-to-Today (v1.25.2 SW cleanup) as shipped/resolved in their backlog entries; added a "Shovel-ready next" section listing v1.25.4, v1.26.5, Guest detail seating panel, View-as preview, v1.28.0 schema cleanup with rough sizings.

### 2026-04-29 · v1.27.3 — Tasks polish round 2: full-width table · centred popout · unified styling

Four follow-ups from same-day v1.27.0 dogfood:

**1. Full-width table with column headers.** Pre-fix the list lived inside a `max-w-4xl` column with no header row — so the per-row data (assignee / priority / status / due / category) felt floating. Now the list spans the full page width and gains a hidden-on-mobile header strip with column labels (`Title · Assignee · Priority · Status · Due · Category`) at the top. Column widths align with `TaskRow`'s existing data cells so the row is genuinely table-like.

**2. Centred new-task popout.** v1.27.0's popout was pinned to `right-4 top-16` — fine but felt like an alert dropdown. New layout: full-screen flex centre with backdrop, max-width 680px, dialog content with click-stopPropagation so backdrop click outside dismisses but click inside doesn't. The TaskForm's existing `Type / Priority / Status / Due` row is now visually obvious — addresses the user's "I still want to be able to set between task, decision and question" complaint (the type picker was always there but the right-pinned popout buried it).

**3. Unified search + filter band.** Pre-fix the search input lived on the page background while `FilterTabs` was on `bg-surface` with its own border — two-tone strip the user disliked. Now both share one `bg-surface` parent with a single `border-b` at the bottom; the search input itself sits on `bg-canvas` for input-affordance contrast. The whole band reads as one block.

**4. Unchanged: type picker visibility.** TaskForm's Type select always rendered behind `showType={true}` (default). The user's "I still want to be able to set between task, decision and question" was a visibility complaint — fixed by item #2 (centred popout reveals the form's full layout).

**Files:** `src/app/(app)/tasks/TaskList.tsx` (full-width + header row + unified band), `AddTaskToggle.tsx` (centred popout), `FilterTabs.tsx` (drop the redundant background + border, share parent's).

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/tasks` → list now spans page width with column headers. Click "+ New task" → centred popover with all form fields visible including Type. Search + filter pills share the same off-white band.

### 2026-04-29 · v1.27.2 — Today page: working checkbox · broader task list

User feedback (29 Apr 2026): "Today page doesn't have my next upcoming tasks on it and the boxes can't be checked from the today page."

**1. Working checkbox.** Pre-fix the Today page's "My open tasks" card rendered `<input type="checkbox" disabled>` with the aria hint *"open Tasks page to toggle"* — needless friction. New `TodayTaskList` client island (`src/app/(app)/TodayTaskList.tsx`) renders the same list but with a working checkbox. Click → optimistic hide + `setTaskStatus(id, "DONE")` server action + success/error toast. Revert on failure.

**2. Broader "My next tasks" selection.** Pre-fix the server query was narrow (`{ assigneeId: userId } OR { assigneeId: null }`) AND `take: 5` AND ordered by `dueDate asc` (Postgres puts nulls *last* in ascending). For a user with no assigned tasks but lots of dated tasks for others, the section was empty. Now we fetch all open `TASK` rows server-side and pick the user's slice client-side via this priority order:

1. Mine + dated (soonest first).
2. Mine + undated.
3. Unassigned + dated.
4. Unassigned + undated.

If those four buckets are empty, fall through to the next 5 dated tasks of *anyone's* — the section still adds value as a calendar preview rather than going blank. Title relabelled "My next tasks" + count chip now shows `5 of 47` so the user knows the section is a slice.

**Files:**
- New: `src/app/(app)/TodayTaskList.tsx`.
- Modified: `src/app/(app)/page.tsx` (wider fetch, client-side filter, mount the island).

**Verification:** typecheck/lint clean, all 232 unit tests pass, build green. Manual: open `/`, tick a task → row disappears, success toast. Reload → server confirms it's done. Open `/tasks` → same task in DONE filter.

### 2026-04-29 · v1.27.1 — Schedule polish · seat-drag transform · mobile version · ROUND-only baseline

Four user-asked tweaks, bundled because each is small.

**1. Schedule polish.** User feedback (29 Apr 2026): time picker awkward, no all-day option, "Audience" doesn't fit.

- **Split date + time inputs.** Pre-fix events used a single `<input type="datetime-local">` per side, which on desktop forced a clunky combined picker. Now date + time are separate (`<input type="date">` + `<input type="time">`) — both natively typeable on desktop, both render OS-native pickers on mobile.
- **All-day toggle.** New `allDay Boolean` column on `ScheduleEvent`. When checked, the time inputs hide and renderers display "All day" instead of a time range. Stored as midnight-local on `startTime` with `endTime` empty by convention.
- **Attendees replace Audience.** New `attendeeIds String[]` column on `ScheduleEvent`. Pre-fix the persona-based audience pills (couple / party / guests / suppliers) didn't map to anything — neither permissions nor real assignment. New picker reads from the actual User table (couple + planners + wedding party). Renderers fall back to the legacy persona audience for old rows that pre-date the migration. Legacy `audience` column kept on the schema for back-compat read; a future cleanup will drop it.

Migration `20260429050000_schedule_attendees_allday` is additive only. Files touched: `EventForm.tsx`, `EventNode.tsx`, `ScheduleTable.tsx`, `ScheduleTimeline.tsx`, `ScheduleClient.tsx`, `AddEventToggle.tsx` (popover pattern same as v1.27.0's AddTaskToggle), `actions.ts`, `page.tsx` (now fetches users), `prisma/schema.prisma`.

New helper `splitDateTime(d)` in `lib/format.ts` returns `{ date: "YYYY-MM-DD", time: "HH:MM" }` for the new form.

**2. Seat-drag ghost: single transform write per move.** v1.25.1 wrote 5 separate SVG attributes per pointermove (circle.cx/cy + glyph.x/y + label.x/y), each invalidating SVG layout. Even at 60 Hz the cumulative cost showed up as drag lag on dense canvases. Fix: wrap the ghost in a single `<g>` with children at (0, 0); per-move work is now one `transform="translate(x y)"` write. Combined with `style="will-change: transform"` the browser composites the translation cheaply, often GPU-accelerated. Ghost now tracks the cursor 1:1 even on layouts with many tables.

**3. Mobile version footer.** Pre-fix the version chip (`v1.27.1`) lived only in the desktop sidebar — mobile users had no way to read it when reporting bugs. Now also renders in the More-sheet footer below the Sign out button. Same `APP_VERSION` constant; just no longer hidden by `display: none` on mobile.

**4. Table-size baseline ROUND-only.** v1.25.3 introduced a 10-seat baseline so capacity tweaks didn't reflow tables, but the user pointed out (29 Apr 2026) that HEAD and RECTANGLE shouldn't have it — their seats sit along edges, where unused capacity creates obvious empty stretches that look odd on a fixed-size table. Fix: scope the baseline to ROUND only; HEAD + RECTANGLE go back to capacity-driven sizing.

**Files:** `src/lib/format.ts`, all `src/app/(app)/schedule/**`, `src/components/shell/MobileTabBar.tsx`, `src/app/(app)/seating/SeatingCanvas.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260429050000_schedule_attendees_allday/`.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green.

### 2026-04-29 · v1.27.0 — Tasks polish: drawer · popout · sort · search

User shared four mockup screenshots (29 Apr 2026) showing the desired Tasks UX. This release brings the page in line with that:

**1. Click-to-open right-side drawer.** Pre-fix clicking a task either did nothing or expanded the row inline (Edit button). Now clicking anywhere on a row opens a 420px right-side drawer with the full task detail + edit form. Status / priority / assignee / due date / category / notes — all editable inline, with `Save changes` / `Cancel` actions and a `Delete` button at the bottom-left. Backdrop click + ESC + × button all dismiss. The list stays visible behind so the user can pivot quickly between tasks. ([TaskDrawer.tsx](src/app/(app)/tasks/TaskDrawer.tsx) — new.)

The done-circle on each row stays a separate click target — it still cycles status without opening the drawer. Avatar + priority chip + status pill + due date + category render inline on desktop (≥sm); the drawer is the only way to edit on touch.

**2. "+ New task" popout instead of inline-expanded form.** Pre-fix the AddTaskToggle rendered the whole new-task form inline in the page-header `actions` slot, which made the header visibly crowded. Now the button stays compact, click → fixed-position popover at top-right (max 640px wide, dimmed backdrop). Same TaskForm inside; backdrop / × / ESC / Cancel all dismiss. ([AddTaskToggle.tsx](src/app/(app)/tasks/AddTaskToggle.tsx))

**3. Sort options.** Pre-fix the page sorted by `status → priority → dueDate` fixed in the server query, with no UI affordance to change. New `Sort` dropdown in the control row offers six choices:

- **Smart** (default — done last, then priority, then due ascending; matches the previous server sort).
- **Due date** — soonest first; null due dates last.
- **Priority** — URGENT → HIGH → MEDIUM → LOW.
- **Title** — alphabetical.
- **Assignee** — by user name (unassigned last).
- **Newest** — by creation order, descending.

Persisted via `wh_tasks_sort` localStorage so the planner's pick survives navigation.

**4. Cleaner search bar.** Pre-fix the search bar lived in its own sticky band above the FilterTabs row, taking 50+ vertical pixels and feeling disconnected. Now it's the leading element of a single control row alongside the sort dropdown — bordered input with `⌕` icon prefix and an inline `×` clear button when populated, max 384px wide so it doesn't dominate. The match-count chip (`12/47`) only shows when the user is actively filtering. List view + Board view toggles stay in their FilterTabs row below. ([TaskList.tsx](src/app/(app)/tasks/TaskList.tsx))

**5. TaskRow restructure.** Removed the inline-expand-edit behaviour (drawer now owns editing). Added per-row status pill (`TODO` / `DOING` / `WAITING` / `DONE`) and category chip on the right edge — matching the column layout from the user's mockup. The Edit/Delete hover affordances are gone — both live in the drawer now.

**Files:**

- New: `src/app/(app)/tasks/TaskDrawer.tsx`.
- Modified: `src/app/(app)/tasks/TaskList.tsx` — sort state, drawer state, control-row layout.
- Modified: `src/app/(app)/tasks/TaskRow.tsx` — click → drawer, dropped inline-edit, added status pill column.
- Modified: `src/app/(app)/tasks/AddTaskToggle.tsx` — popover instead of inline form.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green. Manual: open `/tasks` → click any task → drawer opens with details. Click "+ New task" → popover at top-right; Cancel → dismisses. Change sort to "Due date" → list reorders; reload → sort persists. Type in search → list filters with match-count chip.

**Roadmap addition:** Schedule page polish (time-entry / all-day toggle / Audience rethink). Logged for v1.27.1.

### 2026-04-29 · v1.26.0 — Modular Wedding Book cards

The largest single feature shipped since the post-audit programme. Wedding Book section pages can now be composed from a library of **typed cards** instead of the pre-v1.26.0 one-shape-fits-all `BookSubsection` (title + freeform body + a vestigial `fields` Json column nothing rendered).

**Five card kinds:**

| Kind | Use case | Storage |
|---|---|---|
| **Text** | Free-form notes, the legacy behaviour | `BookSubsection.body` (existing) |
| **Field** | List of typed fields (text / number / date / select) | `BookFieldDef[]` + `BookSubsection.fields` Json bag |
| **Recipe** | Ingredients + steps + notes (cocktails, centrepieces, bouquets) | `BookRecipe` (1:1) |
| **Shot list** | Photo capture list with checkboxes | `BookShotList` + `BookShot[]` |
| **Outfit** | Per-person outfit rows (items, supplier, status) | `BookOutfitCard` + `BookOutfit[]` |

**Approach: extend not replace.** `BookSubsection` gains a `kind BookSubsectionKind` discriminator (defaults to TEXT). Existing rows behave identically post-migration — no data move needed. Per-kind structured data hangs off new tables via 1:1 / 1:m relations cascaded on subsection delete. The vestigial `fields` Json column is repurposed as the FIELD card's value bag, keyed by `BookFieldDef.id` (mirrors v1.15.0's `Guest.customFieldValues` pattern). No throwaway columns.

**Schema (additive migration `20260429040000_modular_book_cards`):** `BookSubsectionKind` enum, `BookSubsection.kind` column, plus 6 new tables (`BookFieldDef`, `BookRecipe`, `BookShotList`, `BookShot`, `BookOutfitCard`, `BookOutfit`). All standard FK + cascade.

**Pure helpers + tests** at [src/lib/book-cards.ts](src/lib/book-cards.ts):

- `parseBookFieldValue(def, raw)` / `formatBookFieldValue(def, value)` — type-aware parse + display, mirroring v1.15.0's custom-field helpers.
- `validateRecipe`, `validateShot`, `validateOutfit` — canonical-shape normalisers with hard caps to keep Json columns tidy.
- `parseWithWhom`, `parseOutfitItems` — comma-separated free-text → trimmed string array.
- `BOOK_CARD_KIND_META` — display labels + descriptions, single source of truth for the picker UI.

**25 new unit tests** at [tests/unit/book-cards.test.ts](tests/unit/book-cards.test.ts) — every helper + every kind's validator. **Total tests: 207 → 232.**

**Server actions** at [src/app/(app)/book/actions.ts](src/app/(app)/book/actions.ts) — 12 new action exports, all returning a typed `BookActionResult` (`{ ok: true } | { ok: false; error: string }`) so production-redacted throws don't masquerade as silent failures (v1.22.9 / v1.23.2 pattern). `createBookSubsection` now seeds the matching per-kind row at creation time so renderers never see a missing relation.

**UI components:**

- [CardRouter.tsx](src/app/(app)/book/[slug]/CardRouter.tsx) — switches on `subsection.kind` and renders the matching editor. TS exhaustiveness guard so a future schema enum addition fails the build.
- [CardChrome.tsx](src/app/(app)/book/[slug]/CardChrome.tsx) — shared title-input + visibility-badge + delete row. Used by the four new editors so they don't duplicate the chrome.
- [BookFieldsCard.tsx](src/app/(app)/book/[slug]/BookFieldsCard.tsx) — type-aware row inputs (text / number / date / select), inline add-field form.
- [BookRecipeCard.tsx](src/app/(app)/book/[slug]/BookRecipeCard.tsx) — two-column ingredients + steps lists with reorder ↑/↓ + delete, plus notes textarea.
- [BookShotListCard.tsx](src/app/(app)/book/[slug]/BookShotListCard.tsx) — checkboxes + inline add/edit forms; same UX shape as the bespoke `/book/photography` ShotsClient that's still live.
- [BookOutfitCard.tsx](src/app/(app)/book/[slug]/BookOutfitCard.tsx) — per-person rows with name + role + items + supplier + status + notes.
- [AddSubsectionToggle.tsx](src/app/(app)/book/[slug]/AddSubsectionToggle.tsx) — pill-row kind picker. Each pill shows the kind's description on hover; only TEXT exposes a body textarea inline (other kinds start empty and grow via their dedicated editor).
- TEXT cards keep the existing `SubsectionEditor` unchanged — zero behaviour change for the legacy use.

**Deferred to v1.26.5:** photography route migration. `/book/photography` continues to render via its bespoke `ShotsClient` for now — generic SHOT_LIST cards exist for *other* sections. v1.26.5 will migrate `PhotographyShot` rows → `BookShot` rows under a single shot-list card on the Photography section, then delete the bespoke route. The legacy `PhotographyShot` table stays in place for one extra release as a recoverability buffer.

**Files:**

- New: `prisma/migrations/20260429040000_modular_book_cards/migration.sql`.
- New: `src/lib/book-cards.ts`, `tests/unit/book-cards.test.ts`.
- New: 5 card editor components + `CardRouter.tsx` + `CardChrome.tsx` under `src/app/(app)/book/[slug]/`.
- Modified: `prisma/schema.prisma` (kind enum + 6 tables + 4 relations).
- Modified: `src/app/(app)/book/actions.ts` (12 new actions, `createBookSubsection` seeds per-kind data).
- Modified: `src/app/(app)/book/[slug]/page.tsx` (eager-loads per-kind nested data, dispatches to CardRouter).
- Modified: `src/app/(app)/book/[slug]/AddSubsectionToggle.tsx` (kind picker).

**Reused patterns:**

- C1/v1.14.0 `BookSubsectionVisibility` — every card inherits the existing couple-only gating.
- C10/v1.15.0 `Guest.customFieldValues` Json bag — same shape for FIELD card values.
- v0.13.0 `PhotographyShot` UX — ported to SHOT_LIST card editor.
- v1.22.9 / v1.23.2 result-shape returns — every new action.
- `Task.type` enum (TASK / QUESTION / DECISION) — kind-discriminator pattern blueprint.

**Verification:** typecheck/lint clean, all 232 unit tests pass, clean `.next` build green.

**Manual smoke (post-deploy):**

- Open `/book/[any-section]` → click "+ New card" → pick "Recipe" → enter title + slug → Create. Recipe card appears with empty ingredients/steps. Add 5 ingredients, 4 steps, save → reload → state persists.
- Add a Field card → add 3 field defs (text, date, select) → fill values → reload → values persist.
- Add a Shot list card → add 3 shots → tick the middle one → reload → captured state persists.
- Add an Outfit card → add Bryony / Jamie / Best man → reload → all three render with their items.
- Toggle a card to couple-only → non-couple sees no card.
- Open `/book/photography` → still works as before (bespoke route, legacy data) — pending v1.26.5 migration.

### 2026-04-29 · v1.25.3 — Seating: table size baseline at 10 seats

User feedback (29 Apr 2026): "When resizing the seat numbers, table size should remain the same, size the tables to fit 10 seats but allow for more."

Pre-fix the `tableSize` helper scaled tables linearly with capacity for all sizes, so a tweak from 8 → 10 seats grew the table noticeably and reflowed the surrounding canvas. Annoying when the planner is just adjusting head-counts mid-planning.

Fix: introduce `SIZE_BASELINE_CAP = 10` and clamp the sizing input to `Math.max(capacity, 10)`. Tables with ≤10 seats render at the same size; tables with >10 seats grow linearly so dots don't overlap. ROUND, HEAD, RECTANGLE all share the baseline.

Net effect on real layouts: typical wedding tables (6 / 8 / 10) all render at the same size — the 10-seat size — and changing capacity within that range only repositions the dots around the now-fixed perimeter. A 12-seat table is bigger than a 10-seat one, but the bigger-than-baseline jump only happens once you cross 10.

**Files:** [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — `tableSize()` helper.

**Verification:** typecheck/lint clean, 207 unit tests pass, build green. Manual: open `/seating`, change a table's capacity 8 → 9 → 10 → 11 → 12 → the table stays the same size at 8/9/10, then grows at 11+.

### 2026-04-29 · v1.25.2 — Mobile nav: SW cleanup + Today Link probe

User confirmed (29 Apr 2026) that v1.25.0's plain `<a href>` navbar **works in incognito mode** but stays broken in normal browsing. Classic stale-service-worker fingerprint — incognito starts with a clean SW slate. The app has never registered a service worker, so any active one on the user's domain came from a previous deployment of *something* (the prototype maybe) and was happily intercepting fetches with stale chunks.

**1. Service-worker cleanup.** New `<ServiceWorkerCleanup />` client component mounted in the root layout. On first paint it calls `navigator.serviceWorker.getRegistrations()` and unregisters every entry, then drops every Cache Storage entry. Idempotent — once cleared, subsequent loads find nothing. Safe to leave in place permanently as defensive infrastructure.

**2. Today tab probe-revert to `<Link>`.** Now that the SW cause is being cleared, start graduating back to client-side navigation. The Today tab is the lowest-blast-radius candidate because it's where users land anyway — even if the revert breaks something users won't be stranded somewhere unfamiliar. Per the plan: revert one tab at a time, deploy, verify on a real (non-incognito) device. If Today nav works, the next commit reverts the rest.

The remaining tabs (Tasks, Guests) and More-sheet items stay as plain `<a href>` for now. The MobileTabBar code branches on `tab.href === "/"` to pick `<Link>` for Today and `<a>` for the rest.

**3. Roadmap addition: "View as another role" preview.** User-asked (29 Apr 2026). Admin impersonation, read-only — lets the couple or planner preview the app as if they were another user, to verify per-section visibility + role gates without signing out. Logged in the backlog with a sketched implementation: header dropdown sets a non-persistent cookie, server components read the override before applying gates, every flip audit-logged.

**Files:**
- New: `src/components/shell/ServiceWorkerCleanup.tsx`.
- Modified: `src/app/layout.tsx` — mount the cleanup.
- Modified: `src/components/shell/MobileTabBar.tsx` — Today branches to `<Link>`.
- Modified: `ROADMAP.md` — "View as" backlog entry.

**Verification:** typecheck/lint clean, all 207 unit tests pass, build green. Manual (post-deploy): hard-reload prod on a real (non-incognito) device → DevTools Application → Service Workers tab → none registered. Tap Today tab from another page → navigates client-side (no flash of white). If green, ship v1.25.3 reverting Tasks + Guests + sheet items.

### 2026-04-29 · v1.25.1 — Seating: ghost-drag perf · mobile size · desktop-only hint

Three same-day follow-ups from v1.25.0 dogfood.

**1. Ghost-drag tracks the cursor at native rate.** v1.25.0's grab-offset preservation made an existing perf bug obvious: the ghost dot during a seat drag lagged behind the cursor on canvases with multiple tables. Root cause: `setSeatDrag({ ...seatDrag, cursorX, cursorY })` on every pointermove triggered a full re-render of `SeatingCanvas` (every table, every seat dot, every drop-zone, every alignment guide). On a 10×8 layout that's ~80 reconciliation cycles per move; at 120 Hz pointer rate, React couldn't keep up.

Fix: render the ghost via **imperative DOM updates against refs** instead of state-driven re-renders. The ghost is purely visual — its position can be updated by setting SVG attributes directly. Three new refs (`ghostCircleRef`, `ghostGlyphRef`, `ghostLabelRef`) are written to in `onPointerMove`. State only updates for the one-shot `moved` transition (when drag exceeds the 4px threshold) and for `dragOverSeatId` (which highlights the destination seat) — that's also throttled to once-per-RAF so `findSeatAt`'s O(n*m) walk doesn't dominate either. A `cursorPosRef` holds the latest cursor in SVG userspace; a small `useLayoutEffect` runs on the `moved` transition to seed the ghost's first paint at the live cursor (no flash of (0,0) before the next pointermove writes refs). Ghost now tracks the cursor 1:1.

**2. Mobile canvas size boost.** Pre-fix `min-h-[400px]` left the canvas tiny on tall phones with lots of empty viewport below. Bumped to `min-h-[60vh] lg:min-h-[400px]` — on mobile the canvas takes 60% of the viewport, on lg+ it stays at 400px since the flex-row layout means width is the constraint. Also wrapped the canvas + new banner in a `flex-col` parent so they share the area cleanly.

**3. Mobile-only "drag is desktop-only" hint.** v1.23.2 disabled table drag on coarse-pointer devices but the explanation was buried inside the canvas-settings panel (collapsed by default). Now a small marigold-tinted banner sits above the canvas on mobile (`lg:hidden` + `isCoarsePointer` gate) saying *"Tap a table to focus. Drag-to-reposition is desktop-only."* The canvas-settings panel's body text also branches on `isCoarsePointer` so a user opening it gets the same instruction in long-form.

**Files:** [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — refs + useLayoutEffect for ghost, RAF throttle for findSeatAt, canvas wrapper restructure, banner.

**Verification:** typecheck/lint clean, all 207 unit tests pass, build green. Manual: open `/seating` with 5+ tables, grab a seat dot, move the cursor in fast circles → ghost tracks 1:1. Drop on another seat → assignment fires. Resize browser to phone width → banner appears, canvas takes ~60% of viewport.

### 2026-04-29 · v1.25.0 — Email nudge digests · seat-drag offset · mobile anchor

Three things, with the first being the v1.25.0 main feature.

**1. Email nudge digests.** Manually-triggered "RSVPs to chase" + "Overdue tasks" digest emails sent to the couple + planners. Pure decision module + per-row 7-day cooldown, mirrors the v1.11.0 csv-merge pattern (decisions and tests live independently of the action layer):

- New `src/lib/nudge-digest.ts` — pure functions: `decideUnconfirmedRsvpDigest(guests, now)`, `decideOverdueTaskDigest(tasks, now)`, `sortOverdueTasksForEmail`, plus the 7-day `nudgeEligible` predicate. Filters out plus-ones (the host carries the nudge), archived guests, DONE/ARCHIVED tasks, future-dated tasks, and anything nudged within the cooldown window.
- New `src/app/(app)/settings/nudge-actions.ts` — `getDigestPreview()` + `sendDigestEmail(kind)`. Returns a typed `SendResult` object instead of throwing (production-redaction pattern). Uses the same Nodemailer transport as `auth.ts`'s magic-link sender. Stamps `lastNudgedAt` on every included row in the same transaction so they don't reappear in the next 7 days. Audit-logged. Couple-only.
- New `src/app/(app)/settings/NudgesPanel.tsx` — couple-only Settings panel. Two cards (RSVPs / Tasks) with eligibility count, the first 5 names/titles, and a "Send digest" button. Uses `getDigestPreview` to keep the count fresh on mount.
- New schema column: `Task.lastNudgedAt DateTime?` (mirrors the existing `Guest.lastNudgedAt`). Migration `20260429030000_task_last_nudged_at` is additive.
- 19 new unit tests in `tests/unit/nudge-digest.test.ts` covering: eligibility-window math, RSVP filter (PENDING + MAYBE included, ATTENDING/DECLINED excluded, archived excluded, plus-ones excluded), overdue-task filter (only TASK type, only past-due, only OPEN/IN_PROGRESS/BLOCKED), priority-then-due-date sort. **Total test count: 188 → 207.**

Cron-triggered nudges deferred per the original plan; manual-trigger is honest about who's chasing what.

**2. Seat-drag grab-offset preserved.** v1.22.10 ghost dot rendered at the raw cursor position regardless of where the user actually clicked the seat. If they grabbed the dot off-centre, the ghost "jumped" to cursor-centre on first move. Fix: at pointerdown, compute the cursor's offset from the seat's world-space centre (applying the table's rotation), store on `seatDrag`, and render the ghost at `cursor − offset`. Same primitive the table-drag has used since the start — the ghost stays exactly where the user grabbed it.

**3. Mobile navbar — plain `<a href>` anchors.** v1.24.0 tried `router.push` to bypass whatever was eating the `<Link>` clicks; user reports it still didn't navigate. Going to the most defensive possible primitive: native browser anchors with no client-side routing involvement. Triggers a full page reload (slower than client routing — fine on mobile where transitions are perceptible anyway). If even this fails, the issue is below the app layer (CDN cache / service worker / device-specific) and the next investigation step shifts off-code. ([MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx))

**Files:**

- New: `src/lib/nudge-digest.ts`, `tests/unit/nudge-digest.test.ts`.
- New: `src/app/(app)/settings/nudge-actions.ts`, `src/app/(app)/settings/NudgesPanel.tsx`.
- New: `prisma/migrations/20260429030000_task_last_nudged_at/migration.sql`.
- Modified: `prisma/schema.prisma` — `Task.lastNudgedAt`.
- Modified: `src/app/(app)/settings/page.tsx` — mount `NudgesPanel` couple-only.
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` — `seatDrag` carries `offsetX/offsetY`; ghost render uses `cursor − offset`.
- Modified: `src/components/shell/MobileTabBar.tsx` — plain anchors throughout.

**Roadmap additions:** numeric auth code at sign-in (OTP / TOTP / SMS) — design pass needed first, three plausible interpretations enumerated.

**Verification:** typecheck/lint clean, all 207 unit tests pass, clean `.next` build green. Manual: open `/settings` as couple → "Nudges" panel shows N eligible RSVPs / tasks → click Send → toast confirms send + recipient count → reload → counts decrease (those rows now have `lastNudgedAt` stamped). Drag a seat off-centre on the canvas → ghost stays anchored to the grab point. Tap a tab on mobile → navigates (full page reload).

### 2026-04-29 · v1.24.0 — Print stylesheets · BookSection visibility · mobile navbar fix

Three planner-only-shortlist items, bundled. Two are small additive features; one is a defensive fix for a recurring user-reported bug.

**1. Print stylesheets for `/budget` + `/payments`.** Both pages get the same treatment as `/schedule` and `/guests/catering`:

- A new `<PrintButton />` shared client component (hoisted from the per-page duplicate that was on `/schedule`) goes in the page-header actions on `/budget` + `/payments`.
- A `print-only-block` letterhead at the top of each page — couple label + date + venue, hidden on screen, visible on print.
- New `.budget-page` and `.payments-page` blocks in `globals.css`'s `@media print` section (mirroring `.schedule-page` + `.catering-page`): full-width, black ink, lighter table borders, `f0f0f0` table headers.

Both pages are couple-only at the route level (the existing `redirect("/")` for non-couple), so the print path inherits that gate — no extra permission check needed in the stylesheet.

**2. `BookSection.visibility` couple-only override.** Mirrors the C1/v1.14.0 BookSubsection visibility — a couple can now hide a whole section (not just individual pages within it). Migration `20260429020000_book_section_visibility` is additive: `BookSection.visibility BookSubsectionVisibility @default(EVERYONE)`. Reuses the existing `BookSubsectionVisibility` enum to avoid duplication.

Read-side filters added at:
- `/book` hub: `findMany({ where: user.isCouple ? undefined : { visibility: "EVERYONE" } })` collapses non-couple results to public-only sections.
- `/book/[slug]` detail: `notFound()` if the section is `COUPLE_ONLY` and the visitor isn't couple — keeps the section's existence invisible (better than redirecting to `/book` which would reveal it ever existed).

Write-side: new `setBookSectionVisibility(id, visibility)` action mirrors `setBookSubsectionVisibility` (couple-only gate, audit log, revalidate). New `<SectionVisibilityToggle>` component renders next to the section header — a single button that toggles `🔒 Couple-only` ↔ `👥 Public` and shows the current state on its label. Couple-only at every layer.

**3. Mobile navbar imperative-routing fix.** User reported (twice) that clicking any item in the mobile tab bar on prod takes them to `/`. Inspected `MobileTabBar.tsx`, `nav-config.ts`, middleware, layout overlays — couldn't reproduce in source: hrefs are correct, no obvious overlay sitting at the tab-bar's z-index, no service worker. Possible culprits: prefetched stale routes, a click intercept somewhere I can't see, or environment-specific oddness.

Defence-in-depth fix: bypass `<Link>`'s default click handling. Each tab + sheet item now has an explicit `onClick={(e) => { e.preventDefault(); router.push(tab.href); }}`. `useRouter()` from `next/navigation` is the same primitive Link uses internally — the difference is that the `onClick` runs *before* Link's own click logic, and `e.preventDefault()` stops Link from then re-navigating. Whatever was eating the Link click is bypassed; navigation goes through `router.push` directly.

Includes a non-production `console.log("[MobileTabBar] tab click → ", href)` so if it's still broken in prod we can see exactly what fires from devtools mobile mode. The diagnostic is `process.env.NODE_ENV !== "production"` gated so it's stripped from the prod bundle.

**Files:**

- New: `src/components/ui/PrintButton.tsx` — shared.
- New: `prisma/migrations/20260429020000_book_section_visibility/migration.sql`.
- New: `src/app/(app)/book/[slug]/SectionVisibilityToggle.tsx`.
- Modified: `src/app/(app)/budget/page.tsx`, `src/app/(app)/payments/page.tsx` — print button + letterhead + class.
- Modified: `src/app/globals.css` — two new `@media print` blocks.
- Modified: `prisma/schema.prisma` — `BookSection.visibility` column.
- Modified: `src/app/(app)/book/page.tsx`, `src/app/(app)/book/[slug]/page.tsx` — read filters.
- Modified: `src/app/(app)/book/actions.ts` — `setBookSectionVisibility` action.
- Modified: `src/components/shell/MobileTabBar.tsx` — imperative router.push on every tab + sheet item.

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/budget` → header shows Print button → click → browser print dialog opens with full-width black-on-white layout. Open `/book` as couple → toggle a section to couple-only → sign in as non-couple → section is gone from the hub and `/book/[slug]` 404s.

### 2026-04-29 · v1.23.3 — Seating: freeze viewBox during drag

Tiny bugfix to v1.23.2's auto-crop. Pre-fix the cropped viewBox was a `useMemo` that depended on `positions`, which updates on every pointermove during a drag. Two consequences:

1. **Visual jitter** — the canvas zoomed/shifted on every cursor tick.
2. **Drift** — `clientToSvg` reads the live viewBox to map screen coords to SVG userspace; when the viewBox grew because the dragged table approached an edge, the mapping shifted and the table accelerated away from the cursor (positive feedback loop: bigger viewBox → bigger SVG-coord delta per cursor pixel → table moves further → viewBox grows again).

Fix: compute the bounds via `useMemo` as before (`computedViewBox`), but mirror them into a `stableViewBox` state that only updates when **no drag is active**. Effect runs whenever `computedViewBox` or `drag`/`seatDrag` change — the drag-end transition fires the update so the post-drop layout settles into a freshly cropped viewBox without an extra render. Adding/deleting tables and revalidations from the server still update the viewBox immediately because they happen outside any drag.

Net effect: the user's stated intent ("canvas resizes when more tables are added or moved") is preserved — the resize just defers to drag-release.

**Verification:** typecheck/lint clean, 188 tests pass, build green. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

### 2026-04-29 · v1.23.2 — Seating: collapsible sidebar · canvas auto-crop · mobile drag disable · ceremony save result

Four follow-ups from same-day v1.23.1 dogfood.

**1. Notes + checklist moved into the canvas right-hand sidebar; every sidebar section is now collapsible with persisted state.** The user wanted the day-of checklist + notes alongside the Selected-table / Guests / Settings panels rather than at the top of the page. New `CollapsiblePanel` component wraps each section with a clickable header, ▾/▸ arrow, and per-key localStorage persistence (race-safe `loaded` gate, same pattern as the dot/label scale toggles). Five panels in the sidebar: **Selected table** (only when one's focused) · **Notes** · **Day-of checklist** (with done/total badge in the header right-slot) · **Guests** · **Canvas settings** (collapsed by default — most users don't tweak snap/scale/grid often).

`FocusPanel` and `AllGuestsPanel` were renamed to `*Body` variants that emit only their inner content; the outer card chrome is now the CollapsiblePanel's responsibility, so we don't double up borders.

**2. List view also gets the panels, at the top.** Same content cards (Notes + Day-of checklist) render as a two-column collapsible strip above the list, since list view doesn't have a sidebar. Persistence keys are shared with the canvas-side render so a planner's open/closed picks carry across views.

**3. Auto-crop the canvas to the actual tables.** Pre-fix the SVG always rendered 1400×900 even when only the top-left corner was occupied — tables were tiny on tablets and phones. Now compute a bounding box around all tables (including their seat dots' radial extent for ROUND, edge-attached extent for HEAD/RECTANGLE) plus a `CROP_PADDING` of 80px, and use that as the SVG's `viewBox`. Empty canvas falls back to the full 1400×900. `clientToSvg` updated to honour the cropped viewBox so drag math doesn't drift.

**4. Disable table drag on coarse-pointer (touch) devices.** Pre-fix mobile users would accidentally drag tables when trying to scroll or tap. Now `window.matchMedia("(pointer: coarse)").matches` gates `dragEnabled`; touch devices get tap-to-focus only. Cursor style follows. Seat-to-seat drag inside a table is unchanged (still works on touch via the v1.22.9 pointer-event handler) — that's the assignment workflow, which is genuinely useful on mobile.

**5. Ceremony save action returns a result instead of throwing.** User reported "Seating settings didn't persist for ceremony" after v1.23.0/1. Same root cause as v1.22.9's capacity bug: in production Next.js redacts thrown server-action errors and surfaces them as the generic "Server Components render" overlay rather than reaching the client's `try/catch`. Refactored `updateCeremonySeating` to return `{ ok: true } | { ok: false; error: string }`; client checks `res.ok` and shows the real error toast. Also added a server-side `console.error` so the underlying Prisma message lands in container logs (most likely culprit if persistence still fails: the v1.23.0 migration hasn't applied to that environment yet).

**Files:**

- New: `src/app/(app)/seating/CollapsiblePanel.tsx`.
- Modified: `src/app/(app)/seating/SeatingPlanPanel.tsx` — exports `NotesContent`, `ChecklistContent`, `checklistRightSlot` instead of the v1.23.1 wrapper component.
- Modified: `src/app/(app)/seating/SeatingClient.tsx` — accepts `seatingNotes` + `seatingChecklist` props, renders panels in list view, passes through to canvas.
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx` — new sidebar layout (5 collapsibles), coarse-pointer detection, viewBox auto-crop, `clientToSvg` fix, renamed `FocusPanel`/`AllGuestsPanel` → `*Body`.
- Modified: `src/app/(app)/seating/page.tsx` — drops the top-of-page `SeatingPlanPanel` mount, threads notes/checklist data through `SeatingClient`.
- Modified: `src/app/(app)/seating/actions.ts` — `updateCeremonySeating` now returns `SaveResult`; result-shape exported as `SaveResult`.
- Modified: `src/app/(app)/seating/ceremony/CeremonyClient.tsx` — handles the new result shape.

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating` → sidebar shows 4–5 collapsible panels → click a header → state persists across reload. Open with 2 tables in the top-left → canvas auto-crops to fit them. Open on a phone → cursor stays as pointer, dragging a table doesn't move it.

### 2026-04-29 · v1.23.1 — Seating: globalise notes + checklist · obvious tabs

Two follow-ups from v1.23.0 same-day dogfood. Both UX corrections — the v1.23.0 design got the data model right but the placement wrong.

**1. Notes + checklist are now global to the seating plan, always visible.** Pre-fix v1.23.0 attached notes + checklist to each individual Table row (per-table) AND made the plan-level notes-only panel collapsible. User feedback: one shared list for the whole plan, on screen at all times, not per table.

Changes:

- New `WeddingSettings.seatingChecklist Json?` (additive migration `20260429010000_seating_checklist_global`). Pairs with the existing `seatingNotes` from v1.23.0.
- New `updateSeatingChecklist` server action (mirrors `updateSeatingNotes`).
- New `SeatingPlanPanel` component renders both notes and checklist side-by-side at the top of `/seating`, always visible. Two-column on lg+ screens, stacked on mobile. Notes save explicitly via Save button; checklist toggles save optimistically with rollback on failure (same pattern v1.23.0 used).
- Removed `PlanNotesPanel` (the old collapsible notes-only) and `TableNotesAndChecklist` (the per-table mount). Both files deleted; corresponding mount points in `SeatingCanvas.FocusPanel` and `TableCard` removed.
- `Table.notes` + `Table.checklist` schema columns kept (no data drop); the v1.23.0 server actions `updateTableNotes` / `updateTableChecklist` are now dormant — no UI calls them but they're harmless if called.

**2. Reception ↔ Ceremony tabs.** Pre-fix the only path between `/seating` (reception canvas) and `/seating/ceremony` was a small "Ceremony →" text link tucked in the header actions. Easy to miss. New `SeatingTabs` component renders a clear two-pill tab bar below the page header on both pages — moss-active style same as the Mine/Everyone toggle on `TodayEventsCard`. Tab respects current pathname so the right pill highlights without prop drilling.

**Files:**

- New: `src/app/(app)/seating/SeatingPlanPanel.tsx` (~180 LOC).
- New: `src/app/(app)/seating/SeatingTabs.tsx`.
- Removed: `src/app/(app)/seating/PlanNotesPanel.tsx`.
- Removed: `src/app/(app)/seating/TableNotesAndChecklist.tsx`.
- Modified: `src/app/(app)/seating/page.tsx` (mount new panel + tabs, drop old link).
- Modified: `src/app/(app)/seating/ceremony/page.tsx` (mount tabs, drop old link).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx`, `TableCard.tsx` (drop dead per-table mount).
- Modified: `src/app/(app)/seating/actions.ts` (+ `updateSeatingChecklist`).
- Modified: `src/lib/wedding-settings.ts` (+ `seatingChecklist` to type/loader).
- Modified: `prisma/schema.prisma` + new migration `20260429010000_seating_checklist_global`.

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating` → notes + checklist visible at top without clicking anything → toggle a checklist item → reload → state persists. Click Ceremony tab → navigates → tab pill swaps. Click Reception tab → back.

### 2026-04-29 · v1.23.0 — Seating notes + day-of checklists + ceremony placeholder

Two new seating features asked for during the v1.22.x dogfood. First substantial seating release that isn't a bugfix or polish since v1.22.6.

**Per-table notes + day-of checklist.** Each Table row now carries a `notes` text column and a `checklist Json?` column. Notes are free-form (table-size constraints, board-game pairing, dietary clusters, position cues — "this table near the dance floor"). Checklist is an array of `{ id, label, done }` items so the planner can tick off "place cards / menu cards / table number stand / centrepiece / Polaroid camera / board game" on the day. Same UI shape in both the canvas FocusPanel and the list-view TableCard via a shared `TableNotesAndChecklist` component (~200 LOC). Notes save explicitly via a Save button; checklist toggles are optimistic with rollback on action failure.

**Plan-level seating notes.** The user wanted a place for room-wide policy ("min 6 / max 10 per table", board-game allocation across all tables, day-of staffing reminders) that doesn't belong to one specific table. Stored on `WeddingSettings.seatingNotes` (extended the existing singleton — no new model). Renders at the top of `/seating` as a collapsible "Plan notes" disclosure; first line shows in the collapsed state so it's scannable. Empty + read-only viewers see no panel at all.

**Ceremony seating placeholder.** New page at `/seating/ceremony`. Singleton `CeremonySeating` model: `leftRows`, `leftSeatsRow`, `rightRows`, `rightSeatsRow`, `notes`. Form lets the planner configure the dimensions; SVG renders the resulting layout — altar at the top, dashed aisle line down the middle, two grids of moss-green dots either side. Per-seat guest assignments deliberately deferred (the user said "doesn't have to be drag and drop"). Cross-link from the main `/seating` page header. Permission-gated identically to reception seating.

**Bigger top table.** Same release because it shipped alongside the rest. HEAD shape's per-seat width bumped 18→30 + base 80→110, height 70→80. Pre-fix labels on a 2-seat HEAD had only ~58px each; now ~80px/seat — full first names on most weddings without aggressive truncation.

**Schema changes (additive migration `20260429000000_seating_notes_ceremony`):**

```prisma
model Table {
  // ...existing
  notes     String?
  checklist Json?
}
model WeddingSettings {
  // ...existing
  seatingNotes String?
}
model CeremonySeating {
  id            Int @id @default(1)
  leftRows      Int @default(8)
  leftSeatsRow  Int @default(8)
  rightRows     Int @default(8)
  rightSeatsRow Int @default(8)
  notes         String?
  updatedAt     DateTime @updatedAt
}
```

**Files:**

- New: `src/app/(app)/seating/PlanNotesPanel.tsx` (collapsible plan notes).
- New: `src/app/(app)/seating/TableNotesAndChecklist.tsx` (shared notes + checklist component).
- New: `src/app/(app)/seating/ceremony/page.tsx` + `CeremonyClient.tsx`.
- Modified: `src/app/(app)/seating/actions.ts` (4 new server actions).
- Modified: `src/app/(app)/seating/page.tsx` (fetch settings, mount PlanNotesPanel, link to ceremony).
- Modified: `src/app/(app)/seating/SeatingCanvas.tsx`, `SeatingClient.tsx`, `TableCard.tsx` (thread notes/checklist + mount the shared component, plus the bigger HEAD sizing).
- Modified: `src/lib/wedding-settings.ts` (add `seatingNotes` to type + loader).

**Verification:** typecheck/lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open a table → fill in a note + add a checklist item → toggle done → reload → both persist. Open `/seating/ceremony` → adjust rows → save → SVG redraws.

### 2026-04-29 · v1.22.10 — Seating polish: repack, glyph center, label space, ghost dot, alignment guides

Five seating-canvas fixes from the v1.22.9 dogfood:

**1. Repack-on-shrink.** Pre-fix the action complained "seats above #N still assigned" if the trailing indices happened to be occupied — even when the table had plenty of leading empties. The user's mental model is *total* occupancy ("4 guests + 8 seats → I should be able to shrink to 4"). Fix: action now repacks. If `occupiedCount <= target`, move every guest currently at a trailing seat into a leading empty slot, then delete trailing seats. Atomic via `db.$transaction`. Only errors when `occupiedCount > target`. ([actions.ts](src/app/(app)/seating/actions.ts))

**2. RSVP glyph centering.** Pre-fix glyphs (✓ ? ~ ✗) were positioned via a fudge offset (`y = cy + 1.4 * dotScale`) that drifted off-center across S/M/L/XL font sizes. Fix: use `dominantBaseline="central"` so the glyph centers vertically regardless of fontSize. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**3. HEAD/RECTANGLE label spacing.** Pre-fix HEAD labels sat too close to the dots (4-5px between dot edge and label baseline at default M scale). Now uses an explicit dot-edge + GAP + font-baseline-correction formula — labels above use `cy - dotR - 4 - 0.2*fontSize`, labels below use `cy + dotR + 4 + 0.8*fontSize`. The 0.2/0.8 factors account for SVG text baseline (visible glyphs extend ~0.8 above and ~0.2 below the baseline). 4px constant pad gives consistent breathing room across scales.

**4. Ghost dot during canvas seat-drag.** Pre-fix the v1.22.9 pointer-event seat-drag had no visual feedback — only the destination seat highlighted; the source seat stayed put. The user couldn't tell if they were actually dragging. Fix: track cursor position in `seatDrag` state, render a ghost `<circle>` at the cursor with the source's RSVP color/glyph + first-name label, opacity 0.7 so it reads as "in flight". Same visual primitive the table-drag has via the `isDragging` check.

**5. Alignment guides during table-drag.** New ask. When the dragged table's centre lines up with another table's centre on either axis (within 4px tolerance), draws a faint dashed marigold line all the way across the canvas. Helps the planner snap rows/columns of tables into formation. Only the matching neighbours render guides — keeps the canvas uncluttered when many tables are in play.

**Verification:** typecheck/lint clean, 188 unit tests pass, build green. Manual: 4-of-8 round table → click - → table shrinks to 4, all guests still seated. Drag a guest → ghost dot follows cursor. Drag a table over an aligned neighbour → dashed line appears.

### 2026-04-29 · v1.22.9 — Seating bugfix: capacity error, HEAD orientation, name overlap, canvas drag

Four fixes from v1.22.7/8 dogfood:

**1. Server-error overlay when shrinking a table.** Pre-fix `updateTableCapacity` threw an `Error` when the user tried to shrink a table with occupied trailing seats. In Next.js production mode, thrown server-action errors are *redacted* and surface as the generic "An error occurred in the Server Components render" overlay rather than reaching the client's `try/catch` for the intended `notify("error", ...)` toast. Fix: action now returns a typed `{ ok: true } | { ok: false; error: string }` result. The client checks `res.ok` and shows the friendly notify-error toast as designed. Both the canvas FocusPanel and the list-view TableCard updated to use the new shape. ([actions.ts](src/app/(app)/seating/actions.ts), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx), [TableCard.tsx](src/app/(app)/seating/TableCard.tsx))

**2. HEAD top-table dots flipped to top edge.** Pre-fix the v1.22.7 HEAD layout placed seats along the bottom edge of the rectangle. By convention the head table sits at the head of the room with guests *facing* the room — so seats render more naturally on the back side (top edge). Adjusted the layout helper accordingly. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx) — `computeSeatLayouts`)

Per-table orientation toggle (so HEAD can flip back to bottom-edge for unusual layouts) deferred — the user mentioned it as a "should be able to" follow-up.

**3. Dynamic name truncation.** Pre-fix names were truncated at a fixed 10-char cap, which left "Jamie" and "Bryony-Ol…" overlapping when seated next to each other on a 2-seat HEAD table (per-seat horizontal budget was ~58px but each label rendered ~80px wide). Fix: truncation now reads per-seat horizontal budget per shape:

- ROUND keeps the 14-char cap (radial labels have generous space).
- HEAD: `floor(width / capacity / glyphWidth)`.
- RECTANGLE: same but split top/bottom so `perSide = ceil(capacity/2)`.

Floor is 4 chars + ellipsis so labels stay distinguishable. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**4. Canvas seat-to-seat drag now works.** Pre-fix v1.22.7 added an HTML5 `draggable={true}` source on each occupied seat's overlay `<circle>`. SVG element draggability is unreliable across browsers — Chrome/Firefox/Safari each handle it differently and several users couldn't drag a seat at all. Replaced with pointer-event-based drag (same primitive the table-drag already uses). Implementation:

- `onPointerDown` on the seat overlay captures the pointer + records start position. `e.stopPropagation()` so the table-drag handler never fires.
- `onPointerMove` tracks distance; once it exceeds 4px the drag is "official" and `draggingGuestId` flips on (unlocks the existing visual drag-over highlights on other seats).
- `onPointerUp` hit-tests against all seat positions in SVG userspace via a new `findSeatAt(x, y)` helper that also accounts for table rotation. Drop on another seat → `assignGuestToSeat`. Drop outside any seat → unseat (same as dropping on the panel).

The HTML5 drag still works for `AllGuestsPanel → seat` because the source there is a regular HTML `<li>`, which has rock-solid `draggable` support. Only the SVG-source case switched to pointer events. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck/lint clean, 188 unit tests pass, build green. Manual: shrink an occupied table → friendly toast (no overlay). Top-table dots are above the rectangle. Names on a 2-seat HEAD don't overlap. Drag a guest from one canvas seat to another → reseats live.

### 2026-04-29 · v1.22.8 — Seating: RSVP glyphs inside seat dots

Tiny accessibility-and-clarity follow-up to v1.22.7's coloured-dots ask. Hue alone gets ambiguous at small dot sizes and is unreadable for colour-blind users. Each occupied seat dot now carries a white glyph centred inside it:

- ✓ Attending (moss)
- ? Pending (marigold)
- ~ Maybe (info-blue)
- ✗ Declined (muted — rare since declined guests usually don't have a seat)

Glyphs match the AllGuestsPanel tag chars exactly so the visual language is consistent across surfaces. Hidden when `dotScale < 1.4` (S size — the dot is only ~3.5px wide and the glyph would be unreadable; colour alone carries the meaning at S). At M/L/XL the glyph reads cleanly. `pointerEvents="none"` so it doesn't intercept drags. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck + lint clean, 188 tests pass, build green.

### 2026-04-29 · v1.22.7 — Seating: RSVP dots, all-shape seats, canvas drag, resizable grid, uniform toggles

Big seating-canvas pass — eight follow-up asks from v1.22.6 dogfood, all UI-only (no schema). Each is small individually; bundled because they touch the same file.

**1. RSVP-colored seat dots ("attendance markers").** Pre-fix all occupied seats were moss green regardless of whether the guest had confirmed. Now colored by `Guest.rsvp`: moss=ATTENDING, marigold=PENDING, info-blue=MAYBE, muted=DECLINED. Mirrors the AllGuestsPanel tag palette so the visual language is consistent. Seat fetch in `page.tsx` extended to include `rsvp`.

**2. Seat dots on HEAD + RECTANGLE tables.** Pre-fix only round tables rendered per-seat dots — head tables and rectangles showed only the table outline + name + count, so the user couldn't see who sat where. New `computeSeatLayouts(shape, capacity, size, dotScale, labelScale)` helper handles all three shapes:
- ROUND — radial around perimeter (existing layout, refactored).
- HEAD — single row along the front (bottom) edge — guests face the room.
- RECTANGLE — split between top/bottom edges, top gets the extra seat when capacity is odd.

Labels position appropriately for each shape (radial outward for round, below dots for head/rectangle-bottom, above dots for rectangle-top).

**3. Drag between seats on canvas.** Pre-fix only the AllGuestsPanel-row → seat drag worked. Now each occupied seat carries an HTML5 drag-source layer (`draggable`) so the planner can drag a guest from one seat to another (or back to the panel for unseating). The table-drag's `onPointerDown` checks for a `draggable` target and bails so the seat-drag never accidentally starts a table-drag. Existing `assignGuestToSeat` action (B12 transaction from v1.12.0) handles the reseat atomically.

**4. Resizable grid (S/M/L/XL).** Pre-fix the canvas grid was a fixed 20px. New `Grid size` toggle in the side panel — S=10/M=20/L=30/XL=40. Both the visible `<pattern>` and the snap-on-drop math read this value at render time. Persisted via `wh_seating_grid_size`. Keyboard nudge step also follows the new grid size.

**5. Uniform S/M/L/XL with bumped label-M.** Pre-fix the label scale toggle was S/M/L (no XL) and `M=1.4` was "too cramped" per user feedback. All three sizing toggles (dot, label, grid) now share the S/M/L/XL shape. Scale values bumped: S=1.0, M=1.6, L=2.0, XL=2.5 — the new M sits between the old M (1.4) and L (1.8). Old saved values (1.4, 1.8, 2.4) silently fall back to default M=1.6 since they're no longer in the validation set; tradeoff vs. a migration path.

**6. Visible capacity +/- buttons.** Pre-fix the v1.22.6 +/- buttons were 16px inline glyphs that were almost invisible (the user couldn't find them). Replaced with a labelled "Seats" row in the FocusPanel + TableCard headers — 28px buttons with proper hit targets, `bg-canvas/60` row container, and the current capacity number tabular-numbered between them. Both views (canvas FocusPanel + list-view TableCard) get the same row.

**7. Click-once focus.** Pre-fix clicking a table sometimes required two clicks before the FocusPanel appeared. Race condition: the `<g>` is `tabIndex=0` so it gains browser focus on `mousedown` (firing `onFocus` → `setFocusedId(id)`); then the pointerup-toggle would *un*set it on the same click (`cur === id ? null : id`). Removed the toggle: clicks always set; deselection happens via the × button. Also: clicking a seat's drag-source still focuses the table even though the table-drag bails.

**8. (incidental) Component refactor.** Three-up scale toggles (dot/label/grid) now share a `<ScaleToggle>` component instead of three near-identical inline blocks; cuts ~50 lines.

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: click a HEAD table → dots visible along bottom edge. Open a round table, click +/- → capacity changes. Drag a guest from one seat to another → reseats. Try Grid=XL → grid widens, snap snaps to 40px.

### 2026-04-29 · v1.22.6 — Seating: snap-to-grid toggle + modify capacity + pending in picker

Three small seating-canvas asks from the v1.22.0 dogfood. All UI/UX continuations of v1.20.5 / v1.20.6 — no schema changes.

**1. Snap-to-grid toggle.** Pre-fix the canvas had a "soft snap" that only fired when the drop landed within ±10px of a grid point — almost never in practice. Replaced with an explicit `Snap to grid on drop` checkbox in the canvas side panel, persisted to localStorage (`wh_seating_snap_to_grid`), default on. When on, every drop snaps to the nearest 20px grid intersection — easy alignment of multiple tables. When off, drops land wherever the cursor was. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**2. Modify table capacity on existing tables.** Pre-fix the only way to change capacity was to delete and recreate the table (losing assignments). New `updateTableCapacity(tableId, newCapacity)` server action ([actions.ts](src/app/(app)/seating/actions.ts)) handles both directions:
- **Grow:** appends new Seat rows for the missing indices. Round-table layout reflows because seat angles depend on capacity — that's expected.
- **Shrink:** only allowed if all trailing seats (index ≥ newCapacity) are empty. If any are still assigned, the action throws with `"Can't shrink to N: M seats above #N are still assigned. Unseat first."` so the planner knows to unseat before shrinking. Never destructive of assignments.

UI: small +/- buttons next to the seated/capacity count in both the canvas FocusPanel and the list-view TableCard header. Bounds at 1..40 (matches the existing `createTable` schema).

**3. Pending guests in the seat-picker dropdown.** Pre-fix the FocusPanel + TableCard dropdowns only listed `ATTENDING` guests (the AllGuestsPanel from v1.20.6 included pending, but only via drag — most users picked through the dropdown). Filter relaxed to `rsvp !== "DECLINED"`, so PENDING and MAYBE now appear. Options are prefixed with `?` (pending) or `~` (maybe) to distinguish from confirmed picks. Attending stays unprefixed (the common case). ([SeatingClient.tsx](src/app/(app)/seating/SeatingClient.tsx), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx), [TableCard.tsx](src/app/(app)/seating/TableCard.tsx))

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/seating`, click a table, hit `+` — new seat appears immediately. Hit `−` on an occupied trailing seat — error toast. Toggle snap off, drop a table mid-grid — stays put. Dropdown lists PENDING entries with `?` prefix.

### 2026-04-29 · v1.22.5 — Bugfix: hydration / persistence race / decoupled seating scales

Three small fixes in one release. All client-state issues, no schema or migrations. User-reported during the v1.22.0 dogfood.

**1. React #418 / #482 on Today page.** `CountdownCard` is a client component that called `new Date()` at render time and passed it to `buildBreakdown(unit, now, target)`. Server-render and first client-paint produced different millisecond values, so React's hydration check threw #418 (text mismatch) followed by #482 (server render error during recovery). The crash was visible whenever the user navigated back to `/` from another page.

Fix: defer `now` to a `useState<Date | null>(null)` populated inside `useEffect` on mount. Render a muted "—" placeholder before `now` lands, so SSR markup matches the first client paint exactly. The 60-second tick interval continues to work as before. ([CountdownCard.tsx](src/app/(app)/CountdownCard.tsx))

**2. "Doesn't save my seat label size settings."** Same race in two places — `CountdownCard.unit` and `SeatingCanvas.labelScale`. On mount, the load `useEffect` and the save `useEffect` both fired in the same paint cycle. The save fired first with the default state value, overwriting whatever the user had previously saved, before the load could read and `setState` the saved value.

Fix: introduce a `loaded` boolean flag. The load effect sets `loaded = true` after reading. The save effect early-returns `if (!loaded)`. Net effect: the first save only happens after the user has actually changed the value, never on mount. Applied to both files. ([CountdownCard.tsx](src/app/(app)/CountdownCard.tsx), [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**3. "Bigger seats but not bigger labels."** v1.20.5's S/M/L scale toggle on the seating canvas controlled dot radius, dot offset, label offset, and font size all together. The user wanted to scale the seat dots up (so occupied/empty status reads from across the room) without making the names so big they crash into adjacent seats.

Fix: split into two independent toggles persisted under separate localStorage keys (`wh_seating_dot_scale` + `wh_seating_label_scale`). Dot scale gains an XL=2.4 step for chunky dots; label scale stays at S/M/L. The label offset formula now adds dot-scaled clearance + label-scaled breathing room (`labelOffset = dotOffset + 3.5*dotScale + 8*labelScale`), so picking L dots + S labels keeps the names tucked tight against the dots. ([SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx))

**Verification:** typecheck + lint clean, all 188 unit tests pass, clean `.next` build green. Manual: open `/`, navigate to `/tasks`, navigate back — no hydration error in the console. Open `/seating`, set dot=L + label=S, reload — both selections persist.

### 2026-04-28 · v1.22.0 — Custom fields for Supplier + Task

C10/v1.15.0 introduced custom-fields infrastructure but only wired it for Guest. This release extends to Supplier and Task. The infra was built generically; the work was unlocking the entity dropdown + plumbing two more rendering surfaces + two more write actions.

**Schema:** additive Prisma migration adds `customFieldValues Json?` to Supplier and Task — same shape as Guest got in v1.15.0. Existing rows aren't touched (column nullable).

**Settings panel** ([CustomFieldsPanel.tsx](src/app/(app)/settings/CustomFieldsPanel.tsx)): entity dropdown unlocked from `Guest` only to `{Guest, Supplier, Task}`. Action schema (`custom-fields-actions.ts`) now accepts the new entities. `revalidateForEntity` helper fans out `/guests` / `/suppliers` / `/tasks` + `/questions` paths after a definition changes.

**Shared block:** the C10 Guest-coupled `CustomFieldsBlock` was refactored into [src/components/ui/CustomFieldsBlock.tsx](src/components/ui/CustomFieldsBlock.tsx) — takes an `onSave(fieldId, rawValue)` callback so the parent decides which server action to call. Guest variant became a thin wrapper that pre-binds `setGuestCustomField`. Same shape for Supplier (new wrapper at `suppliers/[id]/CustomFieldsBlock.tsx` pre-binds `setSupplierCustomField`).

**Supplier wiring:** `/suppliers/[id]` page fetches `CustomField` defs scoped to `entity: "supplier"` and renders the block below the existing detail sections. Server action `setSupplierCustomField` ([suppliers/actions.ts](src/app/(app)/suppliers/actions.ts)) gates on `requireEdit("suppliers")`, validates via the existing `parseCustomFieldValue` (4 types: text/number/date/select), rejects mismatched `field.entity` so a Guest field can't accidentally land on a Supplier row.

**Task wiring:** Tasks have no detail page (edit happens inline in the list or in the QuestionsClient row), so the custom-fields block renders inside `TaskForm` as a section below the main form. Only shown when editing an existing task (a `taskId` is in scope) and at least one task-scoped def exists. New `setTaskCustomField` action ([tasks/actions.ts](src/app/(app)/tasks/actions.ts)) uses the same polymorphic permission gate as `setTaskStatus` / `deleteTask` — dispatches to either `requireEdit("tasks")` (for TASK rows) or `requireEdit("questions")` (for QUESTION/DECISION rows). Task defs are loaded at the page level (tasks/page.tsx + questions/page.tsx) and threaded down through TaskList → TaskRow → TaskForm + QuestionsClient → Section → Row → TaskForm.

**Files changed:** 9 modified, 2 new (shared CustomFieldsBlock + suppliers wrapper). 1 additive Prisma migration. Existing 18 unit tests on the parser still cover the type matrix; no new tests needed for the entity-routing layer (gates run server-side and existing permissions integration test catches dispatch bugs).

### 2026-04-28 · v1.21.0 — Audit log viewer + sticky search on /suppliers + /tasks

Three surface-only additions bundled because they all extend existing patterns. No schema, no new server actions, no new tests — purely UI-side reads.

**Audit log viewer in Settings.** Couple-only — non-couple users see the section header so they know it exists, but no rows. Server component fetches the most-recent 50 `AuditLog` rows (or 50 before a cursor passed via `?audit_before=…`); each row shows timestamp + who (user name, falls back to email, or "system") + what (e.g. "create supplier", "update guest"), plus a one-line summary of the metadata Json (truncated). Pagination is cursor-based via "Older →" link — simpler than infinite scroll for a settings panel that's collapsed by default in usage. Reuses the v1.21.0+ surface-only constraints — no new audit data, no filters in v1, just surfacing what every server action already writes via `audit()`.

**Suppliers sticky search** at [SuppliersClient.tsx](src/app/(app)/suppliers/SuppliersClient.tsx). New thin client wrapper mirrors the v1.12.0 `GuestList` pattern: sticky `top-0` search input above the existing categorised card grid. Filters by name + category + status + notes (case-insensitive substring). Counter shows `N/M` while filtering; "×" clears. The page becomes a server data-fetcher that hands suppliers + edit gate to the client.

**Tasks sticky search** added to [TaskList.tsx](src/app/(app)/tasks/TaskList.tsx). New search input above the existing FilterTabs row, transient (not persisted to localStorage — search queries are usually ad-hoc and a stale query on next visit would surprise). Filters by title + tags + notes. Plays nicely with the existing filter (mine/open/done) and view (list/board) toggles.

**Files changed:** 4 modified (settings/page.tsx, suppliers/page.tsx, tasks/TaskList.tsx, ROADMAP), 2 new (AuditLogPanel.tsx, SuppliersClient.tsx). 188 unit tests + 5 e2e + build all green.

### 2026-04-28 · v1.20.6 — Seating: drag-all-guests + RSVP tag in panel

v0.6.0 shipped click-to-assign drag from the unseated panel onto a seat. Pre-v1.20.6 the side panel only showed *attending unseated* guests, and there was no way to drag a seated guest to a different seat (you had to click the seat → "unassign" → click another seat → assign). This release extends drag in both directions and surfaces RSVP state at a glance.

**All-guests panel.** Replaces the legacy `UnseatedPanel` (~25 lines) with a richer `AllGuestsPanel`. Now shows every non-archived guest, ordered by usefulness for seating: attending-unseated first (most actionable), then attending-seated, then pending, then maybe, then declined. Each row carries an RSVP tag (`✓` moss for ATTENDING, `?` marigold for PENDING, `~` info for MAYBE, `✗` muted for DECLINED) and a small "currently at X" subscript when the guest is seated.

**Show declined toggle.** Declined guests hidden by default since they don't get seats; the count is shown next to the header with a "show / hide" link if the user wants to scan the full list. "Show all N" link expands the list past the first 18 visible rows so a 50-guest wedding doesn't crowd the side rail.

**Drag wiring.** HTML5 drag-and-drop, since SVG `<g>` and `<circle>` elements both fire `onDragStart` / `onDragOver` / `onDrop` in modern browsers. Pattern:
- **Panel rows** are `draggable={canEdit}`. `onDragStart` writes the guest id into `dataTransfer` and pushes it to component state for visual feedback (the dragged row goes 40% opacity).
- **Seat dots** stay visual-only (`pointerEvents="none"`) so the table-drag pointer events still work. While a guest is being dragged, the canvas renders a wider transparent drop-zone circle behind each seat (radius `Math.max(14, 8*labelScale)` — forgiving target). The drop zone has `onDragOver` (preventDefault, required for `onDrop` to fire), `onDragEnter`/`onDragLeave` (track which seat the user is hovering — the dot turns marigold when valid drop), and `onDrop` (calls `assignGuestToSeat(seatId, guestId)`).
- **Panel itself** is also a drop target. Dropping a guest there calls `assignGuestToSeat(currentSeatId, null)` — unseat. No-op if the guest wasn't seated.

**Action reuse.** The action's transaction (B12, v1.12.0) already handles the "two simultaneous drops on the same seat" case atomically via the `Guest.tableSeatId @unique` constraint. No action change needed; just new UI hooked up to the same entry point. Errors surface via the v1.12.0 toast bus instead of crashing.

**HEAD-shaped tables** unchanged — no radial seat layout; legacy `<select>` dropdown in the FocusPanel still handles those.

**Files changed:** 3 (page.tsx query, SeatingClient.tsx props, SeatingCanvas.tsx panel + drop wiring). No schema; no new tests (UI-only behaviour layered on the existing B12 transaction integration test).

### 2026-04-28 · v1.20.5 — Seating canvas: bigger labels + S/M/L size selector

v1.16.0 added first-name labels next to occupied seat dots on round tables. Defaults were conservative — `dotR=3.5`, `fontSize=9`, label radius `+18` — readable at 100% zoom on a desktop monitor but cramped on phones, smaller monitors, or when the user zooms out the canvas. User asked for both larger defaults and a size selector.

**Implementation.** Single `labelScale` state in [SeatingCanvas.tsx](src/app/(app)/seating/SeatingCanvas.tsx). Three sizes: S = 1.0 (pre-v1.20.5 default — kept as a small option for power users), M = 1.4 (new default), L = 1.8 (chunky). Dot radius, font size, and the radial label offset all scale together so the size step feels cohesive — pre-v1.20.5 only fontSize would have scaled, leaving label and dot fighting for the same pixel.

**Persistence.** localStorage `wh_seating_label_scale`. SSR renders M (default 1.4); a `useEffect` on mount restores the saved value. Mirrors the dark-mode + tasks-view-toggle patterns elsewhere.

**Selector UI.** S/M/L pill toggle in the canvas's right-hand side panel (the empty-state slot when no table is focused). Same visual language as the CountdownCard's M/W/D toggle and TodayEventsCard's Mine/Everyone toggle so the toggle vocabulary stays consistent across the app.

**HEAD-shaped tables** unchanged — they don't have the radial seat layout, so the labels don't apply. The table-name label inside the rectangle is enough.

**Files changed:** 1 (SeatingCanvas.tsx). No schema, no new tests (pure visual + state).

### 2026-04-28 · v1.20.0 — Wedding details DB-backed

Pre-v1.20.0, every reference to the wedding date / venue / couple names read straight from `WEDDING_DATE` / `WEDDING_VENUE` / `WEDDING_COUPLE` env vars at module scope. Editing meant a redeploy. This release centralises the read into a DB-backed singleton with a Settings UI; the user can now edit any of the eight fields without touching the server.

**Schema:** new `WeddingSettings` model — singleton enforced via `id Int @id @default(1)`. Eight fields: `weddingDate`, `ceremonyTime`, `venue`, `venueAddress`, `coupleLabel` (long form, used on schedule letterhead + sign-in email), `coupleShort` (possessive form, used inside the Today countdown card), `brideFirst`, `groomFirst`. Additive Prisma migration; seed inserts the bootstrap row from env-var defaults so an empty DB still boots reasonably.

**Loader at [src/lib/wedding-settings.ts](src/lib/wedding-settings.ts).** `getWeddingSettings()` is React.cache-wrapped — pages on the same render share one DB hit. Falls through to env-var defaults if the row is missing or the DB is unreachable, so a hiccup mid-render shows generic content rather than crashing the page. Exports `formatWeddingDate` and `formatWeddingDateShort` helpers so a single change rolls everywhere.

**Settings panel at [WeddingSettingsPanel.tsx](src/app/(app)/settings/WeddingSettingsPanel.tsx).** Couple-only — server action gates on `user.isCouple === true` (mirrors A2's settings lockdown from v1.2.0). Non-couple users see read-only values. Edit toggles inline form with all eight fields; save calls `updateWeddingSettings` which upserts the row + audit-logs + revalidates every page that reads settings (`/`, `/glance`, `/schedule`, `/today/day-of`, `/guests/catering`, `/settings`).

**Replaced 10 references** that previously read env vars or hardcoded "Jamie & Bryony" strings:
- [src/app/(app)/page.tsx](src/app/(app)/page.tsx) — Today countdown reads `wedding.weddingDate`, `wedding.venue`, `wedding.coupleShort`.
- [src/app/(app)/glance/page.tsx](src/app/(app)/glance/page.tsx) — `daysUntil` now takes a Date from settings.
- [src/app/(app)/schedule/page.tsx](src/app/(app)/schedule/page.tsx) — print letterhead uses `wedding.coupleLabel` + `wedding.venue`.
- [src/app/(app)/today/day-of/page.tsx](src/app/(app)/today/day-of/page.tsx) — hero band reads from settings.
- [src/app/(app)/guests/catering/page.tsx](src/app/(app)/guests/catering/page.tsx) — letterhead uses `wedding.coupleLabel` + `wedding.venueAddress ?? wedding.venue`.
- [src/components/shell/Sidebar.tsx](src/components/shell/Sidebar.tsx) — header reads `${brideFirst} & ${groomFirst} · ${formatWeddingDateShort}`. Made the Sidebar an async server component to support the await.
- [src/app/layout.tsx](src/app/layout.tsx) — switched from static `metadata` to async `generateMetadata` so the document description picks up edits.
- [src/app/signin/page.tsx](src/app/signin/page.tsx) — heading + "contact X or Y" copy.
- [src/app/signin/error/page.tsx](src/app/signin/error/page.tsx) — error messages substitute couple names dynamically.
- [src/auth.ts](src/auth.ts) — magic-link email subject + body (text + HTML) interpolate bride/groom names + formatted wedding date.

Env vars stay as the seed source so an empty DB still boots — they're now bootstrap-only; live config lives in Settings. The README's "Email deliverability" section already documented the relevant subset; no doc change needed for env vars.

**Files changed:** 12 modified, 4 new (`wedding-settings.ts`, `wedding-settings-actions.ts`, `WeddingSettingsPanel.tsx`, `wedding-settings.test.ts`). 1 additive migration. 2 new unit tests (188 total). e2e + build green.

### 2026-04-28 · v1.19.6 — README rewrite

Doc-only release. The README had drifted significantly from the actual state of the codebase; the user requested a full review. Findings (12+) were addressed in a single rewrite pass.

**Major drift fixed:**
- Stale "Phase A" / "Phase B" / "Phase C" status section claimed Phase C was current — actually shipped before v1.0.0. Replaced with a brief "Status" section pointing at ROADMAP.md (the living changelog) and REMEDIATION-PLAN.md (post-audit programme).
- "Deferred for future work" listed 8 items every single one of which had shipped (file uploads → D1, seating canvas → D2, CSV import → E, shot list → F2, Spotify → G1, catering export → F1, day-of → G2, quick-capture → G2). Section deleted.
- Components / lib file inventory was missing ~15 files added since Phase A (Toaster, Illustrations, EventMotifIcon, csv-merge, budget, custom-fields, dark-mode, last-edited-fields, notify, plus-one, rate-limit, spotify, supplier-follow-up, …). Rewritten from scratch.
- "Allow-list of 5" hardcoded number replaced with "env-list".
- Workflow trigger said `main`/`dev`; actually `claude/main`/`dev`.

**Sections added:**
- **Standing rules** at the top: admin-only, never tag broken builds, ROADMAP-update-before-done, fast-forward promote.
- **Test pyramid** in the Status section (190 unit + 1 integration + 5 e2e) and useful-scripts table.
- **Permission model** rewritten to cover the bootstrap-admin flow (first sign-in → couple), couple-gated writes (A2/A6 lockdowns), audit logging.
- **Image rollback** examples now show `:vX.Y.Z` and `:sha-<short>` tag patterns; one-off migration / Studio commands simplified to `npx prisma`.

No code, no tests, no schema changes — pure documentation pass.

### 2026-04-28 · v1.19.5 — Email deliverability: Reply-To + List-Unsubscribe + DNS docs

User reported magic-link emails landing in spam. Code-side fix is small (the body was already clean — inline CSS, text alternative, no spam-trigger words); the real lever is DNS auth on the sending domain. Two-pronged release:

**Code:** [src/auth.ts](src/auth.ts) `transport.sendMail` call gains a `replyTo` (defaults to `EMAIL_REPLY_TO` env var or falls through to `EMAIL_FROM`) and a `List-Unsubscribe` header (RFC 2369, mailto: form). Both reduce Gmail's spam-classifier weight on transactional auth mail. New `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header pairs with it for one-click handling per RFC 8058.

**Docs:** new "Email deliverability" section in [README.md](README.md) with the Resend domain-verification flow (SPF + DKIM TXT records on `spencer-net.com`), DMARC observe-mode TXT, and a verification checklist (`Authentication-Results: dkim=pass spf=pass dmarc=pass` in raw headers).

The DNS records themselves are user-side ops work — Resend's dashboard generates the per-account values. After the records propagate, mail sent from `Jamie & Bryony <hello@spencer-net.com>` will be SPF/DKIM-authenticated and stop landing in spam. Code change is the smaller half (~10% impact); DNS is the bigger half (~80%).

No schema changes; no new tests (purely config + headers).

### 2026-04-28 · v1.19.0 — Today page redesign + mobile nav fix + IllusCountdown port

The user sent a mockup for the homepage and pointed out mobile nav was broken after v1.17.0's responsive pass. This release rebuilds the Today page to match the mockup, unifies the mobile breakpoint, and ports the IllusCountdown SVG that v1.15.0's C6 had skipped.

**Today page — three-column equal grid.** The pre-v1.19.0 layout had a full-width countdown band at top with a 2/3 + 1/3 grid below (My tasks + RSVPs/Upcoming). Replaced with a single 3-column row at `lg:` breakpoint where each card has `h-full` so they line up to the tallest. Cards stack on mobile.

- **Column 1 — CountdownCard:** Marigold-tinted (`bg-marigold-100/60`) card with the new `IllusCountdown` watermark top-right at 18% opacity. Inside: "UNTIL THE WEDDING" caps label + M/W/D unit toggle on one row; giant primary number + unit label below; secondary breakdown segments (when unit=W or M) at smaller text underneath; couple label + `${date} · ${venue}` muted line at the bottom. The `ceremonyLabel` prop is gone — the schedule covers ceremony time, the countdown card is now about the date itself.
- **Column 2 — My open tasks:** Header with `{N} open` count chip; list of 5 tasks with priority dot column (1×7 colored bar), disabled checkbox (so the visual matches the mockup; live toggling stays on `/tasks`), title, due date (overdue dates in red). Footer link "See all {totalTaskCount} tasks →" — the total is a fresh DB count.
- **Column 3 — Upcoming events:** [TodayEventsCard](src/app/(app)/TodayEventsCard.tsx) restyled to match the column. Header reads "Upcoming events" (was "Upcoming"); Mine/Everyone toggle styled as a pill group matching the countdown card's M/W/D toggle; default persona flipped to **Mine** (better default for wedding-party users; couple flips to Everyone in one click). Audience tags rendered below each event title. Footer link "Full schedule →".

The pre-v1.19.0 standalone "RSVPs · {N} pending" card is gone — the snapshot strip below the grid already shows the breakdown.

**Mobile nav fix.** v1.17.0's mobile pass used Tailwind `sm:` (640px) for new responsive rules but `globals.css` swapped sidebar/tabbar at 720px. The 640–720px band saw both nav modes plus desktop-styled hover-fades. Unified `globals.css` at 640px. Plus: `MobileTabBar.tsx` active-state now treats `/today/*` as part of the Today tab's scope, so `/today/day-of` highlights the Today tab on mobile (it showed nothing before).

**Files changed:** 5 modified (page, CountdownCard, TodayEventsCard, globals.css, MobileTabBar) + 1 new SVG (IllusCountdown in [Illustrations.tsx](src/components/ui/Illustrations.tsx)). No schema changes; no new tests (visual + state).

### 2026-04-28 · v1.18.5 — Bugfix: edit questions and decisions

v1.18.0 surfaced decisions in the nav, which made an existing bug visible: questions and decisions could be created (via the `+ New` toggle) and resolved (via `AnswerForm`), but never edited. The shared Task model already had `updateTask` and `deleteTask` actions; the gap was purely that `QuestionsClient.tsx` rendered no Edit/Delete buttons on each row — only the AnswerForm.

Refactored each list row into a stateful `Row` component (mirrors `TaskRow.tsx`) with Edit + Delete buttons that render full-opacity on touch and hover-fade on desktop (the v1.17.0 mobile-pass pattern). Edit toggles the row into an inline `TaskForm` re-using the same form the `+ New` toggle uses for creation. Delete confirms then calls `deleteTask`, which is already polymorphic per A5 (v1.2.0) — the gate auto-dispatches to `requireEdit("questions")` for QUESTION/DECISION rows.

Page query extended to pass `notes` and `tags` to the client so the edit form can populate them. No schema changes; no new server actions.

### 2026-04-28 · v1.18.0 — Decisions surfaced in nav + planner-only backlog catalogued

Two small things that fix a discoverability gap and pin the next chunk of work in the ROADMAP.

**Decisions are now visible.** The Task model has supported a `DECISION` type since the beginning — with its own icon (△), its own filter chip on the /questions page, even its own metadata field (`decisionAnswer`). But the sidebar nav said "Questions", the count badge only counted `QUESTION`-typed tasks, and the page title said "Questions" — so users (correctly) believed decisions had nowhere to live. Three small changes:
- [nav-config.ts](src/components/shell/nav-config.ts) renames the entry to "Questions & Decisions".
- [AppShell.tsx](src/components/shell/AppShell.tsx) `getCounts` now counts `type IN (QUESTION, DECISION) AND status != DONE` for the badge.
- [questions/page.tsx](src/app/(app)/questions/page.tsx) header reads "Questions & Decisions" and the subtitle splits the count into questions vs decisions. The "+ New question" button became "+ New" with the type-picker visible (`showType={true}`) so creating a Decision from this page is one click.

No data migration — the rows have always been there, they're just discoverable now.

**Planner-only backlog catalogued.** ROADMAP's *Deferred / Backlog* section gained a "Planner-only feature shortlist (post-v1.17.0)" subsection with six items the user picked from a wider menu: audit log viewer in Settings, search beyond /guests, custom fields for Supplier + Task, print stylesheet for /budget + /payments, email reminders / nudges (planner-facing only), BookSection audience overrides. Two items from the original menu (public RSVP form, guest portal) were explicitly dropped under a new standing rule:

> **Wedding Hub is admin-only — planners + couple + wedding party. Guest data is managed via Say I Do, not in-app.**

Recorded as a top-of-section note so future feature drafts default to "planner-facing" rather than "guest-facing".

**Files changed:** 3 modified, 0 new. No schema changes. Tests untouched (existing tests still pass — this is purely surface).

### 2026-04-28 · v1.17.0 — Countdown breakdown · mobile pass · guest list filter/sort

Three user-asked items bundled.

**Countdown card breakdown redesign.** Pre-v1.17.0, the countdown showed a giant primary number (e.g. "4") + small "+ 2 weeks 3 days" leftover line — visually inconsistent: the "4" dominated and the "1 day" got buried at text-xs. Now renders as inline equally-prominent segments — `4 months · 2 weeks · 3 days` with each number at the same large font and a muted dot separator. Single-unit cases (just days) collapse to one segment naturally. Same toggle (M / W / D) controls the most-prominent unit; finer-grained leftovers always render at the same prominence. The toggle buttons themselves got bigger tap targets on mobile (text-xs px-3 py-1) while keeping the compact desktop look (sm:text-[10px] sm:px-2 sm:py-0.5).

**Mobile usability pass.** A focused audit of the codebase found 20 issues across three tiers; this release picks the highest-leverage Tier 1 + Tier 2 fixes:
- [CountdownCard](src/app/(app)/CountdownCard.tsx) min-width unblocks shrink to <320px (was `min-w-[200px]`, now `min-w-0 sm:min-w-[200px]`).
- [ScheduleTable](src/app/(app)/schedule/ScheduleTable.tsx) hides the Where + Audience columns at `<md` and echoes location into the Event cell with a 📍 prefix, so mobile users still see the venue without a horizontal-scroll dance.
- [TaskRow](src/app/(app)/tasks/TaskRow.tsx) and ScheduleTable's edit/delete actions used `opacity-0 group-hover:opacity-100` — invisible on touch. Now visible by default, hover-fade reserved for desktop (`sm:opacity-0 sm:group-hover:opacity-100`).
- [QuickCapture](src/components/shell/QuickCapture.tsx) modal pulled in to `pt-6` on mobile (was `pt-20` everywhere — pushed input below iPhone SE viewport).
- [TaskList](src/app/(app)/tasks/TaskList.tsx) auto-switches to list view on first load when window width <640px. The kanban board can't be used on touch (no drag), and columns crush at narrow widths.
- [today/day-of](src/app/(app)/today/day-of/page.tsx) hero band is `sticky top-0` on mobile so the venue + date stay visible while scrolling. Desktop keeps the static layout (plenty of room).

The remaining audit findings (PermissionMatrix mobile rework, generic Button size bumps, TaskBoard column headers) are tracked but not blocking — the surfaces above cover the day-of mobile use case (wedding-party members on-site).

**Guest list filtering, sorting, default preference.** [GuestList](src/app/(app)/guests/GuestList.tsx) gains four dropdowns under the search bar: Sort (5 options — household name asc/desc, side, size desc/asc), RSVP filter (5 — all + 4 statuses), Side filter (4), Show filter (3 — all / has-children / has-dietary). All filter logic runs client-side against the SSR payload, so changes are instant. Two localStorage slots: `wh_guests_view_current` (last-used, restored every visit) and `wh_guests_view_default` (explicit user-pinned default). UI exposes "Save as default" when the current state diverges from the saved default, "✓ default" when they match, and a "Reset to default" / "Reset" link when the current state isn't empty. The household-passes-filter rule is "any guest matches" — hiding a household because half its members declined would lose the host.

**Files changed:** 7 modified, 0 new. No schema changes. 186 unit tests still passing; e2e green; build clean.

### 2026-04-28 · v1.16.0 — Task CSV importer + guest names on the seating canvas

First post-audit feature release. Two user-requested pieces of polish on top of v1.15.0.

**Task CSV importer.** New `/tasks/import` route ([page.tsx](src/app/(app)/tasks/import/page.tsx) + [TaskImportClient.tsx](src/app/(app)/tasks/import/TaskImportClient.tsx)) mirrors the v0.8.0 guest importer pattern: paste CSV/TSV, columns auto-mapped (heuristic in [csv.ts](src/lib/csv.ts) recognises Title / Type / Priority / Status / Due / Assignee / Tags / Notes plus common synonyms — Description, Kind, Urgency, State, Deadline, Owner, Labels, Comments), preview with row-by-row validation, commit creates Task / Question / Decision rows. Coercion helpers handle UK-style `DD/MM/YYYY` dates as well as ISO; assignee emails resolve against the User table at preview time so the user sees "matched" vs "no user with this email — importing unassigned" before clicking Import. 19 new unit tests cover the coercion + heuristic matrix.

The `/tasks` page header gets an "Import CSV" link next to the existing "+ Add task" toggle — gated on `canEdit("tasks")` like the rest of the write surface.

**Guest names on the seating canvas.** Builds on v1.14.0's C7 per-seat dots: each occupied seat now renders the guest's first name as a small text label just outside the dot, anchored away from the table centre so the text reads outward. Names truncate to 10 chars (catches "Christopher" → "Christoph…"). Empty seats stay as just the dot. HEAD-shaped tables unchanged (they don't have the radial seat layout the labels assume).

**Files changed:** 4 modified, 3 new. 19 new unit tests (186 total). Build, lint, typecheck, e2e all green. No schema changes.

### 2026-04-28 · v1.15.0 — Phase R5b: illustrations ported + Custom Fields UI (C6 + C10)

The two larger-surface items from the user's Bucket C build list. Both shipped together because they're orthogonal — illustrations touch presentation, custom fields touch data — and bundling kept the deploy cycle short.

**C6 — Illustration set with light/dark variants per scene.** The prototype (`prototype/illustrations.jsx`) had 19 SVG components using CSS-variable theming, none of which had ever made it into production — empty states shipped as plain `<p>No items yet.</p>` text. This release ports 14 of them into [src/components/ui/Illustrations.tsx](src/components/ui/Illustrations.tsx) (the 6 motif icons in v1.14.0's `EventMotifIcon` already covered the 16px set). Variable substitution: prototype's `var(--moss-500)` → production's `var(--color-moss-500)`; same for marigold, surface, etc. Theming carries through to dark mode automatically.

Wired into:
- **Wedding Book hub** — `bookSceneFor(slug)` resolves a 44px scene illustration per known section slug (wedding-party, venue, food-drink, photography, guest-experience, legal-admin, accommodation). Falls through to the existing emoji glyph for legacy/user-created sections.
- **Empty states** — new shared `<EmptyState illustration={…} title body action />` component renders the SVG + a friendlier title/body. Used at `/schedule` (no events), `/seating` (no tables), `/payments` (no payments), `/tasks` (no tasks match filter), `/guests` search-with-no-results.

**C10 — Custom Fields UI.** The `CustomField` registry table existed in the schema with zero references in code. This release wires it end-to-end for **Guest** (other entities can be added later by extending the entity dropdown).

- **Schema:** additive Prisma migration adds `Guest.customFieldValues Json?` for the per-guest value bag. Keyed by `CustomField.id`.
- **Pure helpers** at [src/lib/custom-fields.ts](src/lib/custom-fields.ts) — `parseCustomFieldValue` validates against the field's type (`text` / `number` / `date` / `select`), throws structured errors that the toast UX surfaces. `formatCustomFieldValue` for display ("—" for null, en-GB locale for numbers, "1 Sep 2026" for dates). `mergeCustomFieldValue` merges into the existing JSON without mutation; `null` value drops the key entirely. 18 unit tests.
- **Settings panel** at [CustomFieldsPanel.tsx](src/app/(app)/settings/CustomFieldsPanel.tsx) — couple-only CRUD for definitions. Add field with name + type + (for `select`) comma-separated options. Non-couple users see a read-only list so they understand what's available.
- **Guest detail block** at [guests/[id]/CustomFieldsBlock.tsx](src/app/(app)/guests/[id]/CustomFieldsBlock.tsx) — renders one row per definition with click-to-edit inline forms. Type-correct inputs (`<input type="number">`, `<input type="date">`, `<select>` with options). Errors surface as toasts via the v1.12.0 `notify` bus.
- **Server action** at [guests/actions.ts](src/app/(app)/guests/actions.ts) — `setGuestCustomField(guestId, fieldId, rawValue)` re-validates server-side (never trust the client), writes the typed value into the JSON column, audits the change.

**Files changed:** 11 modified, 5 new, 1 migration. 18 new unit tests (167 total). Build, lint, typecheck, e2e all green.

**Bucket C final tally — 8/12 shipped:** C1, C4, C6, C7, C8, C9, C10, C11. Accepted as drift / deferred: C2, C3, C5, C12. Every item from REMEDIATION-PLAN's Bucket C now has a closed status. Only **R6** (backup hardening + restore drill) remains in the post-audit programme.

### 2026-04-28 · v1.14.0 — Phase R5a: Bucket C drift decisions (C1 + C4 + C7 + C11)

The user walked through the 12 Bucket C drift items and assigned a decision per row. C8 and C9 marked resolved (already shipped earlier — v1.9.0 expanded the Wedding Book hub to 7+3 cards; v1.3.0's A3 implementation includes opportunistic prune so a separate cron isn't needed at our scale). C2, C3, C12 deferred. C5 accepted as drift (covered by R6's restore-drill plan). C6 + C10 deferred to R5b — both have unexpectedly clean footholds (prototype already has 19 illustration components ready to port; schema already has a `CustomField` registry table) but each touches a meaningful chunk of UI and benefits from a focused session.

**C1 — Wedding Book per-page audience overrides.** Adds `BookSubsection.visibility EVERYONE|COUPLE_ONLY` (additive Prisma migration, mirrors `FileVisibility`). Read path: non-couple users get filtered to `EVERYONE` rows on `/book/[slug]` so the couple can stash Hen Do plans without Josh seeing them. Write path: a new `setBookSubsectionVisibility` action gates on `user.isCouple === true` (same pattern as the v1.2.0 A6 file-visibility lockdown — non-couple editors can edit content, but only the couple decides what's couple-only). UI: the [SubsectionEditor](src/app/(app)/book/[slug]/SubsectionEditor.tsx) shows a 🔒 "Couple only" pill in the header for any couple-only page, plus a "Make couple-only" / "Make public" button for the couple. Errors roll back via the toast bus.

**C4 — Per-field manual-edit tracking.** Adds `Guest.lastEditedFields Json?` (in the same migration as C1 to save a round-trip) — shape is `{ "fieldName": "<ISO timestamp>" }`. Pure helpers at [src/lib/last-edited-fields.ts](src/lib/last-edited-fields.ts) (`diffEditedFields`, `mergeEditedFields`, `daysSinceEdited`); the [updateGuest](src/app/(app)/guests/actions.ts) action now diffs the next payload against the existing row and stamps only fields that actually changed (arrays compared order-insensitively, null/undefined/empty-string treated equivalent so spurious form re-saves don't pollute the map). The B1 import preview reads the map and appends a warning per row when a diff would overwrite a field manually edited in the last 14 days — surfaces inline via the existing warnings render path with a "you edited dietary 3 days ago — re-importing will overwrite (untick to keep)" message that points at the per-field opt-out. 17 new unit tests cover the diff/merge/days-since matrix.

**C7 — Round-table per-seat position dots.** [SeatingCanvas](src/app/(app)/seating/SeatingCanvas.tsx) now renders one small dot per seat just outside each round table's circumference, evenly spaced (with seat 0 at "twelve o'clock" matching how a host reads round tables). Filled (moss) = occupied, outlined (canvas) = empty. Lets the eye scan the canvas for free seats without focusing each table. Pure SVG, theme-aware via existing CSS variables. No-op for HEAD-shaped tables.

**C11 — Schedule event motif icons.** Six 16px SVG icons ported from [prototype/illustrations.jsx](prototype/illustrations.jsx) into [EventMotifIcon.tsx](src/components/ui/EventMotifIcon.tsx) (ring / candle / plate / camera / bouquet / suitcase). The pure `classifyEventMotif(title)` heuristic does word-boundary regex matching — case-insensitive, falls through to `null` (no icon) for unrecognised titles rather than guessing. Plurals handled (`portraits` → camera, `photos` → camera). "Wedding Breakfast" intentionally classifies as plate, not ring (ring is reserved for the explicit ceremony/vow keywords). Wired into [EventNode](src/app/(app)/schedule/EventNode.tsx) (timeline view) and [ScheduleTable](src/app/(app)/schedule/ScheduleTable.tsx) (table view); the existing prototype's CSS-variable theming carries through to dark mode automatically. 8 new unit tests lock the title-to-motif contract.

**Files changed:** 9 modified, 3 new, 1 migration. 25 new unit tests (149 total). e2e + build green.

**Bucket C status after v1.14.0:**
- ✅ Resolved: C8 (v1.9.0), C9 (v1.3.0), C1, C4, C7, C11 (v1.14.0)
- 🟡 R5b deferred: C6 (illustrations), C10 (custom fields UI)
- 🟠 Deferred / accepted drift: C2, C3, C5, C12
- 6/12 shipped; 2 in queue; 4 acknowledged drift.

### 2026-04-28 · v1.13.0 — Phase R4c: polish MINORs (B6 + B7 + B9) — Bucket B complete

The last three Bucket B items from REMEDIATION-PLAN. Three small surface improvements that close out R4 and the post-audit programme to one less than zero unresolved findings (v1 audit's 9 MAJORs and ~10 MINORs all triaged: most shipped, the rest accepted as drift in Bucket C).

**B6 — Quick-capture event time picker.** The `C` modal used to silently drop captured Events at "now + 1 hour, rounded to top of hour" with no way to edit before submit — Jamie surfaced this with the "I just typed it and it disappeared into next month somewhere" friction. The modal now shows a `<input type="datetime-local">` when the type tab is "Event", defaulting to next round hour but visible and editable. A "↺" reset button puts it back if the user changes their mind. The action's schema gained an optional `startTime` string; the action parses it as local time and falls through to the old "next round hour" default if absent or unparseable, so existing call sites keep working.

**B7 — Mobile day-of scroll-to-NOW.** On a phone, opening `/today/day-of` mid-ceremony used to land the user at the start of the day — they had to scroll past ten past-events to find what was actually happening. New tiny client component [ScrollToCurrent.tsx](src/app/(app)/today/day-of/ScrollToCurrent.tsx) takes a target id and `scrollIntoView({ behavior: "smooth", block: "center" })`s on mount. The page picks the most-relevant target — `now` if present, else `next` — and threads the id through. Smooth scroll is intentional (the visible motion tells the user "we adjusted the scroll for you" rather than just appearing to load slowly).

**B9 — Inline song-request add on guest detail.** The guest detail's Songs section was read-only with a "Manage on Songs →" deep-link — fine for batch entry, friction for the "while I'm looking at Aunt Margaret's row, just type her request" flow Aimee surfaced. New [AddSongRequestInline.tsx](src/app/(app)/guests/[id]/AddSongRequestInline.tsx) renders a tiny inline form in the section header (title + optional artist + Add + ×). On submit, fires the new `addSongRequestForGuest` server action ([guests/actions.ts](src/app/(app)/guests/actions.ts)) which is gated on `requireEdit("guests")` and writes via `db.songRequest.create` with an audit row. Errors toast via the B5 notify bus rather than throwing. The page revalidates so the new entry appears in the list above without a manual reload.

**Files changed:** 5 modified, 2 new. No schema changes. Build, lint, typecheck, all 126 unit tests, 5 e2e specs all green.

**Bucket B final tally:** 11/13 shipped (B1 + B2 + B3 + B4 in v1.11.0; B5 + B8 + B11 + B12 in v1.12.0; B6 + B7 + B9 in v1.13.0). B10 + B13 were already done before R4 started. Every item from REMEDIATION-PLAN's Bucket B is now closed.

**Next phases (REMEDIATION-PLAN sequencing):** R5 (Bucket C drift decisions — C1 audience overrides, C7 round-table seat dots, C9 magic-link prune cron, others deferred or accepted) and R6 (backup hardening + restore drill). The post-audit work that started with v1.2.0 is approaching its planned end.

### 2026-04-28 · v1.12.0 — Phase R4b: data + UX MINORs (B5 + B8 + B11 + B12)

The second batch of REMEDIATION-PLAN Bucket B. v1.11.0 was the three MAJORs; v1.12.0 is the four MINORs that, together, lift daily-use friction and close the last data-integrity gap surfaced by the audit.

**B12 — `assignGuestToSeat` race-condition window.** The action used to do `updateMany` (clear other guests off the seat) followed by `update` (assign the new guest) as two separate Prisma calls. With two simultaneous drags onto the same seat, both could clear and both could try to assign — leaving the DB in a half-applied state until the unique constraint on `Guest.tableSeatId` fired. Now wrapped in `db.$transaction([…])` so either both updates land or the unique constraint rejects the second offender atomically. New integration test at [tests/integration/seating.test.ts](tests/integration/seating.test.ts) fires two parallel `assignGuestToSeat` calls and asserts exactly one guest ends up at the target seat. (Postgres serialisation may also cleanly serialise the two transactions — both outcomes are acceptable; the test asserts the *invariant*, not a specific timing.)

**B8 — Sticky search on `/guests`.** Aimee surfaced this — the guest list scrolled forever once we hit ~50 households. New thin client wrapper [GuestList.tsx](src/app/(app)/guests/GuestList.tsx) wraps the list with a sticky search input above the household blocks. Filters case-insensitively against household name and each guest's first/last/full name. Client-side because the full guest list is already in the SSR payload — no need for a round-trip per keystroke. Counter shows `N/M` matching while a query is active; "×" button clears.

**B11 — Dark mode persistence per-account.** Pre-B11 the toggle wrote to localStorage only — sign in on a new device and you're back to light. Additive Prisma migration adds `User.darkMode Boolean?` (nullable so existing rows aren't forced to commit). New server action `setDarkModePreference` in [(app)/actions.ts](src/app/(app)/actions.ts); pure decision helper [src/lib/dark-mode.ts](src/lib/dark-mode.ts) (`resolveDarkMode`) covers the precedence rule (DB > localStorage > light). [AvatarMenu](src/components/shell/AvatarMenu.tsx) gets the user's `darkMode` prop, syncs DB → localStorage on mount (so the next page-load's pre-hydration script paints right), and fires the action on toggle. 7 new unit tests on the precedence matrix.

**B5 — Global server-action error UX.** The audit's last MINOR — raw `throw new Error("Forbidden: …")` from `requireEdit` was surfacing as Next's red error overlay in dev and a generic error page in prod. Two-layer fix: (1) [(app)/error.tsx](src/app/(app)/error.tsx) catches anything thrown from the (app) tree and renders a friendly card — detects "Forbidden:" prefix and shows a 🔒 + the bare message, otherwise generic "Something went wrong" with the raw message in dev only and a "Try again" button. (2) Lightweight toast bus at [src/lib/notify.ts](src/lib/notify.ts) (window-event based — no Provider plumbing) + [Toaster](src/components/ui/Toaster.tsx) component mounted in AppShell. The seating drag handlers ([TableCard](src/app/(app)/seating/TableCard.tsx), [SeatingCanvas](src/app/(app)/seating/SeatingCanvas.tsx)) now toast on errors instead of swallowing them silently — the most obvious B12 race window users would actually feel.

**Files changed:** 13 modified, 7 new, 1 migration. 7 new unit tests + 2 new integration tests (seating race + cascade). Build size +0.3 KB shared (Toaster component). e2e specs untouched (no new auth-redirect surfaces).

**Bucket B status after v1.12.0:** B1, B2, B3, B4, B5, B8, B11, B12 shipped (8/13). B10 + B13 already done before R4 started (2/13). Remaining for R4c: B6 (quick-capture event time picker), B7 (mobile schedule scroll-to-NOW), B9 (inline song-request on guest detail) — 3 polish MINORs, ~2.5 hrs.

### 2026-04-28 · v1.11.0 — Phase R4a: workflow polish (B1 + B2 + B3 + B4)

Closes the first batch of Bucket B from REMEDIATION-PLAN — the three MAJORs plus one ergonomic dependency. Each ships with a regression test per the standing rule.

**B1 — CSV import per-field diff.** Re-importing a CSV that matches an existing guest used to be all-or-nothing: the preview said "merge" and you took it on faith. The new flow extracts a pure decision module ([src/lib/csv-merge.ts](src/lib/csv-merge.ts) — `decideGuestMerge`) that both `previewImport` and `commitImport` consume; preview rows now carry `fieldDiffs` showing every "old → new" pair the merge would apply, and the UI in [ImportClient.tsx](src/app/(app)/guests/import/ImportClient.tsx) renders an expandable disclosure beneath each merge row with a checkbox per field. Un-tick a field and that overwrite is skipped on commit — surfaced as `optOut: { rowIndex: ["dietary"] }` plumbed through the action. The post-import success card reports how many fields were preserved by opt-outs. The audit metadata records the count too, so a future operator can grep for "user un-ticked dietary on 3 merge rows in the Apr 28 import". Closes the "anxiety on re-import" friction Bryony surfaced. Backed by 21 new unit tests covering the diff/opt-out matrix.

**B2 — `BudgetLine.actual` recomputes from `Payment` rows.** The budget page used to show a stored `actual` that drifted from the `Payment` records linked via FK — log a £500 payment and the line still said £450 because nobody updated `actual`. New rule: `actual` is a manual override. When non-null, it wins; when null, the page sums `Payment.amount` for that line. Pure decision logic in [src/lib/budget.ts](src/lib/budget.ts) (`computeActual`, `isManualOverride`, `sumOfPayments`); both [BudgetClient.tsx](src/app/(app)/budget/BudgetClient.tsx) and [glance/page.tsx](src/app/(app)/glance/page.tsx) now use it. The line edit form labels the state ("Manual override active. Clear 'Actual' to recompute from payments…" vs "Actual is computed from N payments. Set a value to pin a manual override."), and computed totals get a subtle "Σ" badge in the table so the user can tell at a glance which lines are pinned vs derived. One additive Prisma migration adds `@@index([budgetLineId])` to `Payment` so the per-line aggregate doesn't sequential-scan on every render. 11 new unit tests on the computeActual matrix.

**B3 — Supplier follow-up auto-creates a Task.** Logging a supplier comm with a `followUpAt` date used to silently store the date and nothing else — Jamie had to remember to manually create a Task or the follow-up vanished. Now the comm + auto-task land in a single `db.$transaction`: pure decision in [src/lib/supplier-follow-up.ts](src/lib/supplier-follow-up.ts) (`decideFollowUpTask`) returns the Task payload (title `Follow up: <supplier>`, due = `followUpAt`, assignee = comm creator, tags `["supplier-follow-up", "supplier:<id>", "comm:<id>"]`), the action in [suppliers/actions.ts](src/app/(app)/suppliers/actions.ts) creates both atomically. Tag-based linkage avoids a schema change for now; if the soft FK proves clunky we can promote to `Task.sourceCommId` in R5. The comm log entry in [SupplierDetailClient.tsx](src/app/(app)/suppliers/[id]/SupplierDetailClient.tsx) gets a "Task ↗" pill linking to `/tasks` next to the existing "Follow-up <date>" pill. Audit log records both the comm-create and the task-create with cross-references in metadata. 4 new unit tests for the decision contract.

**B4 — Supplier card last-message summary.** Suppliers list now shows a muted "Last (channel, relative date): <summary truncated to 80 chars>" line on each card, so you can scan the list and see who you last spoke to without clicking in. [suppliers/page.tsx](src/app/(app)/suppliers/page.tsx) extends the query with `include: { communications: { take: 1, orderBy: { createdAt: "desc" } } }`; [SupplierCard.tsx](src/app/(app)/suppliers/SupplierCard.tsx) renders. No render at all when the supplier has no comms — negative-space cruft would just clutter the cards.

**Files changed:** 12 modified, 4 new, 1 migration. 36 new unit tests (119 total). Build size unchanged.

**Out of scope, deferred to R4b/R4c:** B5 global error UX, B6 quick-capture event time picker, B7 mobile schedule scroll-to-NOW, B8 guest search, B9 inline song-request on guest detail, B11 dark-mode persistence, B12 seating race-condition transaction. B10 + B13 already done in prior releases.

### 2026-04-28 · v1.10.0 — Phase R3 follow-on: Postgres integration job + Playwright e2e in CI

Closes the two open items from the original R3 scope (`T2` integration tests against a real DB and `T3` Playwright e2e). v1.4.0 wired Vitest + a TESTING.md plan; v1.10.0 actually runs both new tiers on every PR.

**`integration` job** — a new GHA job in [.github/workflows/build.yml](.github/workflows/build.yml) that boots `postgres:16-alpine` as a service container, runs `prisma migrate deploy`, and executes `npm run test:integration` against a real database. Catches regressions that unit tests with mocked `loadPermissions` can't see — e.g. cascade behaviour on the `Guest.parentGuestId` self-relation, or a Prisma schema field that compiles fine but doesn't actually exist after migrate. Postgres health-check ensures the container is ready before tests run; runs in parallel with `verify` (typecheck + lint + unit) so total CI wall-clock doesn't grow much.

**`e2e` job** — a Playwright job needing both `verify` and `integration` (no point in running browsers if static checks failed). Caches `~/.cache/ms-playwright` keyed on the `@playwright/test` version, so subsequent runs reuse the Chromium binary instead of re-downloading ~150 MB. The `webServer` block in [playwright.config.ts](playwright.config.ts) auto-starts `npm run dev` (or `start` in CI) and waits for `/api/health` before tests fire. On failure the HTML report is uploaded as an artifact (retention 7 days) so a failed PR check links straight to the trace viewer.

**First specs in [e2e/auth-redirect.spec.ts](e2e/auth-redirect.spec.ts)** — five anonymous-flow tests covering the audit's permissions matrix at the routing layer. `/` bounces to `/signin`; `/guests` bounces to `/signin?callbackUrl=...` with the original target preserved; `/budget` bounces to `/signin` (auth gate fires before the couple-only gate); `/api/health` is publicly reachable; `/signin` renders without authentication. These are the regression net for `src/middleware.ts` — couple-only redirects from `/budget` and per-section `canView` gates remain at the unit + integration tier, where they're cheaper to assert.

**`build` job depends on `[verify, integration, e2e]`** — Docker images are not built (and definitely not tagged) unless every test tier is green. Combined with the standing rule from v1.2.x ("never tag a build until GHA goes green on the same SHA"), this means a release tag is now a hard guarantee that unit + integration + e2e all passed against the SHA that produced the image.

**Files:**
- New: [.github/workflows/build.yml](.github/workflows/build.yml) (`integration` + `e2e` jobs added; `build` rewired)
- New: [playwright.config.ts](playwright.config.ts), [e2e/auth-redirect.spec.ts](e2e/auth-redirect.spec.ts)
- Modified: [package.json](package.json) (`@playwright/test` devDep, `test:e2e` + `test:e2e:ui` scripts, version bump)
- Modified: [.gitignore](.gitignore) (`/playwright-report`, `/test-results`, `/playwright/.cache`)

**Out of scope, deferred to a later phase:** Playwright specs covering authenticated flows (would require seeding a session in CI — adds friction; punted until R4 or later when a richer fixture story is needed). Per-row visibility integration tests (B-tier polish; not blocked by R3).

### 2026-04-28 · v1.9.0 — Book sections aligned with prototype + Spotify env-var compose fix

Two unrelated changes bundled because both shipped on `dev` before the v1.9.0 tag was cut.

**Bug fix: `docker-compose.yml` didn't forward `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` to the web container.** Latent since v0.14.0 (when Spotify launched). `next dev` on the dev box reads `.env` directly, so local builds always saw the keys — but production only forwards env vars that are explicitly listed in the `web` service's `environment:` block. The Spotify keys were never on that list, so the production container ran with `SPOTIFY_CLIENT_ID=undefined` no matter what was in `.env`. Surfaced when the user added the keys, restarted the stack, and `docker exec wedding-hub-web-1 printenv | grep SPOTIFY` came back empty.

Fix in [docker-compose.yml](docker-compose.yml) — two new lines on the `web` service:

```yaml
SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID:-}
SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET:-}
```

**Production deploy needs a manual compose-file edit** (Compose Manager Plus on Unraid keeps its own copy; the repo's compose file isn't auto-pulled). In CMP → Edit Stack → YAML tab, add the two lines to the `web` service's `environment:` block. Save → Up. After that the `printenv` check will show the values and the Settings → Spotify integration chip will flip to ✓ Configured.

**Book sections aligned with prototype.** The v1.4.0 seed shipped 5 Wedding Book sections (Ceremony, Reception, Logistics, Photography, Wedding party) but the design brief in `prototype/WeddingBookPage.jsx` defines 7 canonical sections (Wedding Party, Venue, Food & Drink, Photography, Guest Experience, Legal & Admin, Accommodation). The v1.0.0 audit flagged the gap as a **MINOR** under design fidelity (`Wedding Book hub has 5 not 7 cards`). v1.9.0 closes it.

**Seed change** ([prisma/seed.ts](prisma/seed.ts) `seedBookSections`):

- Adds 5 new sections matching the prototype: `venue`, `food-drink`, `guest-experience`, `legal-admin`, `accommodation`. Orders 2, 3, 5, 6, 7 respectively.
- Renames `photography` from "Photography & Shot list" → "Photography & Videography" (slug stays the same, so the `/book/photography` custom route still resolves to the shot-list checklist).
- Renames `wedding-party` from "Wedding party" → "Wedding Party" (capitalisation only).
- Sets the prototype set to orders 1–7.
- Keeps the 3 v1.4.0 legacy sections (Ceremony, Reception, Logistics) but pushes their orders to 8–10 so they sort to the bottom of the hub. They aren't deleted — any subsection content the user added survives, and the user can delete them via the UI later if they want a clean 7-card hub.

Re-running the seed (`docker compose exec web node prisma/seed.js`) is idempotent: existing rows have title + order refreshed, new rows are added, no subsection content is touched. Production picks the changes up after the next deploy + seed run.

**[SECTION_META](src/app/(app)/book/page.tsx)** updated with accent / glyph / description for all 10 slugs (5 new + 5 existing). Accent palette and descriptions ported directly from `prototype/WeddingBookPage.jsx` BOOK_SECTIONS:

| Slug | Accent | Glyph | Description |
|---|---|---|---|
| wedding-party | moss-100 | 👰 | Outfits, roles, stag & hen, ring keepers |
| venue | moss-50 | 🏛 | Ceremony, reception, signage, centrepieces |
| food-drink | marigold-100 | 🍽 | Breakfast, evening food, cake, drinks |
| photography | moss-100 | 📷 | Package, shot list, locations, day-of contact |
| guest-experience | marigold-100 | 🎉 | Pixel Party, table games, photo booth, favours |
| legal-admin | moss-50 | 📜 | Notice of marriage, documents, witnesses |
| accommodation | marigold-100 | 🛏 | Bridal suite, bridesmaids, groomsmen |

**Production deploy:** code-only release plus a one-time seed re-run. After `docker compose pull && up -d`:

```bash
docker compose exec web node prisma/seed.js
```

Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.9.0 SHA.

### 2026-04-28 · v1.8.0 — Spotify integration setup guide + status chip

The Spotify config is env-var-driven (we explicitly scrapped storing it in the DB in v1.7.0 / item I). v1.8.0 closes the discoverability gap that surfaced when the user couldn't tell whether their newly-added env vars were live: a status chip on the Songs page header, a full setup-guide panel in Settings.

**[SpotifySettingsPanel.tsx](src/app/(app)/settings/SpotifySettingsPanel.tsx)** — server component on Settings between MyProfilePanel and the permission matrix. Two states:

- **Configured** (`isSpotifyConfigured()` returns true): green `✓ Configured` chip, brief explainer, and a **collapsed** setup-steps `<details>` for reference.
- **Not configured**: amber `⚠ Not configured` chip, and the setup steps **expanded by default** so the path-to-fix is in the user's face.

Setup-guide depth differs by tier:
- **Couple-tier:** full step-by-step — Spotify Developer dashboard → create app → copy ID/secret → Compose Manager Plus → .ENV tab → Save → Up (with the explicit caveat that **Save alone doesn't recreate the container** and `docker compose up -d` is what picks up new env vars). Fifth step: verify with `docker compose exec web printenv | grep SPOTIFY`. Final step: link a playlist URL on /songs.
- **Non-couple:** "🔒 Setup requires server-level env-var access. Ask Jamie or Bryony to flip it on." — gives them context without exposing infra detail.

The panel includes the Client-Credentials-public-playlist caveat ("during each sync the playlist must be public on Spotify") so this isn't a debugging surprise later.

**Status chip on /songs** ([page.tsx](src/app/(app)/songs/page.tsx)) — `🎵 Spotify ✓` (moss) or `🎵 Spotify off` (marigold) in the header `actions` slot, deep-linking to `/settings#spotify-integration`. The panel has `id="spotify-integration"` + `scroll-mt-24` so the anchor lands cleanly below the page header.

No schema, no env, no code-path changes — purely additive UI. Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.8.0 SHA.

### 2026-04-28 · v1.7.0 — Tier 3 / A: +1s as own Guest rows

The biggest of the user-feedback items: a +1 used to be a string field on the host (`Guest.plusOneName`) that didn't show up in any totals. From v1.7.0 a +1 is materialised as a real `Guest` row linked to the host via a new self-relation, and shows up everywhere a real guest does — Today, Glance, catering brief, seating canvas. Schema is additive; no env changes.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma) + [migration](prisma/migrations/20260428200000_add_guest_parent_for_plus_one/migration.sql)):

```
parentGuestId   String?
parentGuest     Guest?         @relation("PlusOneOf", fields: [parentGuestId], references: [id], onDelete: Cascade)
plusOnes        Guest[]        @relation("PlusOneOf")
@@index([parentGuestId])
```

`ON DELETE CASCADE` so a hard-delete of the host (couple-only path) takes the +1 with it. The soft-archive path is handled in `actions.ts` so the +1 inherits archived state explicitly via a `$transaction`.

**Materialisation logic** ([src/lib/plus-one.ts](src/lib/plus-one.ts) — pure function, 14 unit tests at [tests/unit/plus-one.test.ts](tests/unit/plus-one.test.ts)):

- Pure `decidePlusOneAction(host, child)` returns one of `noop` / `create` / `update` / `archive`.
- Decision rules:
  - `host.plusOneAllowed=true` AND `host.plusOneName.trim() !== ""` → child should exist
  - First materialisation → `create` with `splitFullName(plusOneName)` for first/last, inherit host's householdId / side / rsvp
  - Existing child + sync → `update` (also re-derives first/last from the host's plusOneName, so the host's field stays the source of truth for the +1's display name)
  - `plusOneAllowed` flips to `false` OR name cleared → `archive` the +1 (don't hard-delete; preserves dietary / meal / song-request data if the user later flips it back on)
  - Host is itself a +1 (`parentGuestId` set) → `noop` with `host_is_plus_one` reason
- DB-aware `syncPlusOne` wrapper in [actions.ts](src/app/(app)/guests/actions.ts) does the I/O.

**Lifecycle cascade** (also in actions.ts):

- `createGuest` → `syncPlusOne(created.id)` after the create. Materialises the +1 immediately if conditions are met.
- `updateGuest` → forces `plusOneAllowed=false / plusOneName=null` if the row being edited is itself a +1, then `syncPlusOne`.
- `setGuestRsvp` → `syncPlusOne(id)` so host RSVP changes cascade to the +1.
- `deleteGuest` (soft archive) → `$transaction` that archives both the host and any +1 rows in one go, freeing both seats.
- `restoreGuest` → symmetric `$transaction` to bring the +1 back alongside the host.
- `hardDeleteGuest` → no change (FK cascade handles the +1).

**UI** ([HouseholdBlock.tsx](src/app/(app)/guests/HouseholdBlock.tsx) + [GuestForm.tsx](src/app/(app)/guests/GuestForm.tsx)):

- New `reorderHostsAndPlusOnes` helper groups +1 rows immediately after their host in the household block (orphan +1s go to the bottom).
- +1 rows render with a `+1 of {host.firstName}` info chip (info colour, hover tooltip explaining the cascade behaviour) and visual indent (`pl-10 bg-canvas/40`).
- `GuestForm` takes a new `isPlusOne` prop. When true: first-name, last-name, plus-one-allowed checkbox, plus-one-name input are all `disabled`, with an explanatory banner at the top of the form ("First/last name come from the host's Plus-one name field — edit it there to rename"). Other fields (RSVP, dietary, meal, notes) stay editable so the +1 can have its own preferences.
- Delete confirm copy adapted: archiving a +1 directly suggests toggling the host's plusOneAllowed instead.

**Totals — no special-casing needed.** Today / Glance / Catering brief / Seating canvas all query `Guest` rows directly — the +1 row is a real row, so it shows up in every count without a code change. RSVP donut, "X attending of Y invited", dietary aggregates, per-table seating: all just work.

**Tests** (`npm test` now reports 83 passing across 6 files):

- 14 new cases in `tests/unit/plus-one.test.ts` cover create / update / archive / no-op paths plus the recursion guard.

Verified: typecheck, lint, build, 83/83 tests, clean `npm ci`. Holding promote until GHA confirms green at the v1.7.0 SHA.

### 2026-04-28 · v1.6.0 — Tier 2 user-feedback polish

Two visual / structural upgrades from the user-feedback list. No schema, env, or test changes.

**D — Schedule Table | Timeline toggle.** [`/schedule`](src/app/(app)/schedule/page.tsx) now offers two views, persisted per-device via `localStorage` (`wh_schedule_view`):

- **Timeline** (default, unchanged) — vertical timeline with sticky day headers and node markers. Print-friendly.
- **Table** — flat sortable table with When / Event / Where / Audience / actions columns. Useful when there are 20+ events and the timeline becomes long to scroll. Inline edit reuses `EventForm` so the data model stays single.

Wired through a new client component [`ScheduleClient.tsx`](src/app/(app)/schedule/ScheduleClient.tsx) that holds the view state; the server `page.tsx` query is unchanged. Print stylesheet keeps the timeline behaviour regardless of selected view (the toggle lives under `no-print`).

**E — Wedding Book hub card redesign** ([`/book`](src/app/(app)/book/page.tsx)). Match the prototype's BookCard treatment:

- **Accent backgrounds** per section (moss-50 / moss-100 / marigold-100) — looked up by slug from a code-side `SECTION_META` map. User-created sections fall back to a neutral default. No schema migration.
- **Glyph spot** in the top-left corner (💍 ceremony, 🥂 reception, 🗓 logistics, 📷 photography, 👰 wedding-party). Top-right keeps the `→` indicator the prototype uses.
- **Descriptions** under the section title (e.g. *"Order of service, vows, readings, music"*) — also from `SECTION_META`.
- **Hover lift** — `hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`. Matches the prototype's effect.
- **Display font** for the title, semi-bold; subtitle in `text-ink-secondary`; meta count in `text-ink-tertiary`.
- **Wider container** (`max-w-[960px]`) and **auto-fill grid** (`minmax(260px, 1fr)`) to mirror the prototype's 2/3-column layout depending on viewport.

The Photography card still surfaces the shot-list progress (`X of Y captured`) instead of subsection count — that's the special-case logic from v0.13.0 (Phase F2), preserved.

What's still off-spec vs the prototype: real SVG illustrations, full audience picker on subsections, 7-card hub (we have 5). All deferred per the audit report's design-fidelity findings.

Verified: typecheck, lint, build, 69/69 tests, clean `npm ci`. Holding promote until GHA confirms green.

### 2026-04-28 · v1.5.0 — Tier 1 user-feedback polish

Six small fixes from the live-use review (Tier 1 of the issues raised after R3). No schema or env changes.

**Mobile sign-out (G).** The `Sidebar` (which contains `AvatarMenu` → Sign out) has `display: none` at ≤720px viewport — so mobile users had **no path to sign out**. [MobileTabBar.tsx](src/components/shell/MobileTabBar.tsx) now takes a `signOutAction` prop and renders Sign out as the last item in the More sheet, separated by a divider. AppShell threads the existing `signOutAction` server action through.

**Settings UI defence-in-depth for permission elevation (F).** The audit's A2 (settings self-elevation BLOCKER) was fixed server-side in v1.2.0 — `setPermission`, `setUserCouple`, and `removeUser` all throw `Forbidden` for non-couple callers. But the UI still showed clickable Couple checkboxes and permission selects to non-couple users with `EDIT(settings)`, who would only see the error at submit time. Now [PermissionMatrix.tsx](src/app/(app)/settings/PermissionMatrix.tsx) takes `currentUserIsCouple` and disables the controls accordingly:
- Read-only banner explains why for non-couple viewers
- Couple checkbox + section selects gain `disabled` + tooltip when current user isn't couple
- Member × button only renders for couple-tier callers
- Server gates from v1.2.0 still hold — this is purely UI honesty

**Settings page scroll feel (H).** Three issues addressed:
- Page wrapper changed from `overflow-auto` (both axes) to `overflow-y-auto overflow-x-hidden`. Stops the trackpad-wobble when two scroll axes fight.
- The permission matrix's `<thead>` is now `sticky top-0 z-20`, so column labels stay anchored while scrolling vertically through a long member list. Background colour explicit per cell so the sticky header is opaque.
- Member column already had `sticky left-0` — z-index bumped to 30 so it sits above the now-sticky thead at the corner.

**Glance dashboard, 4 long columns (B).** [glance/page.tsx](src/app/(app)/glance/page.tsx) grid switched from `repeat(auto-fit, minmax(280px, 1fr))` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Each card is taller and narrower at desktop width; stacks on phone, pairs on tablet.

**Countdown card multi-unit breakdown (C).** [CountdownCard.tsx](src/app/(app)/CountdownCard.tsx) now shows full precision regardless of the toggle:
- `days` — single unit (e.g. `120 days`)
- `weeks` — primary + remainder (e.g. `17 weeks` with `+ 1 day` underneath)
- `months` — primary + multi-remainder (e.g. `4 months` with `+ 2 weeks 3 days` underneath)

The big-number aesthetic stays; precision is in a small subtitle line. Helper functions (`addMonths`, `ceilDays`, `buildBreakdown`) are inline; could be lifted to `src/lib/format.ts` if reused elsewhere.

**Repo hygiene.** Deleted [src/app/(app)/schedule/EventRow.tsx](src/app/(app)/schedule/EventRow.tsx) — orphan since the v1.0.0 schedule timeline rewrite (replaced by `EventNode.tsx` + `ScheduleTimeline.tsx`, no remaining imports). Consolidated `AUDIT-BRIEF.md` + `AUDIT-PLAN.md` + `AUDIT-REPORT.md` into a single [AUDIT.md](AUDIT.md) — same content, three sections, easier to find. References in REMEDIATION-PLAN, ROADMAP, and TESTING all updated.

Verified: typecheck, lint, build, 69/69 tests, clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at this SHA.

### 2026-04-28 · v1.4.0 — Phase R3 (partial): tests in CI + TESTING.md + integration scaffold

Test-depth phase from the [post-audit plan](REMEDIATION-PLAN.md). No user-visible features; locks in the test substrate so future fixes can't regress quietly.

**T5 — CI gates the image build on tests passing** ([.github/workflows/build.yml](.github/workflows/build.yml)). Renamed workflow to `Test, build, and publish image`. Split into two jobs:

- `verify` — installs deps with the same flags as the Dockerfile (so we exercise the same install path, including the `.npmrc legacy-peer-deps=true` from the v1.2.x cascade), generates the Prisma client, runs typecheck → lint → unit tests in order.
- `build` — only runs `needs: verify`. Same docker-build steps as before.

A green Docker image of broken-code typecheck/lint/test will no longer ship to GHCR. Branch trigger updated to `claude/main` (was `main` — the legacy default-branch reference that meant `claude/main` pushes weren't actually triggering a build for the entire session).

**T4 — [TESTING.md](TESTING.md)** codifies the test strategy and the pre-promote smoke checklist. Persona walkthroughs (Bryony / Jamie / Josh / Aimee) for the full pre-wedding rehearsal. The "automated gates must pass + GHA green on same SHA" rule is now written down and references CLAUDE.md.

**T2 — integration-test scaffold** ([vitest.config.integration.ts](vitest.config.integration.ts) + [tests/integration/permissions.test.ts](tests/integration/permissions.test.ts)). Separate Vitest config so unit tests stay fast (`npm test` in <1s); integration tests run via `npm run test:integration` against a real Postgres set via `DATABASE_URL`. Tests self-skip when the env var isn't set (or doesn't look "test"-y), so the scaffold is safe on a dev machine without Docker. Five permission-resolver scenarios covered: EDIT user, NONE user, no Permission row, couple-only-section denial, couple-tier passes everywhere. CI wiring for the integration job is **not** in this release — that's a follow-on with the Playwright phase. Local-run instructions documented in TESTING.md.

**T3 — Playwright e2e deferred.** Scaffolding Playwright that's reliable on Windows AND in GHA is a session-of-its-own. Tracked in [REMEDIATION-PLAN.md](REMEDIATION-PLAM.md) §3-T3.

**Verified:** typecheck, lint, build, 69/69 unit tests pass, integration runner skips cleanly without `DATABASE_URL`, full clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at this SHA — first release where the green-CI-first rule was set up *before* the new test gates landed, so this is also the test of whether the new GHA pipeline itself works.

### 2026-04-28 · v1.3.0 — Phase R2: magic-link rate limit + archived-guest restore

Second remediation phase from the [post-audit plan](REMEDIATION-PLAN.md). Closes the two MAJOR audit findings deferred from R1 because they needed schema or UI work.

**A3 — magic-link rate limit.** New `MagicLinkAttempt` table tracks send attempts; up to 5 per hour per email. Checked in [src/auth.ts](src/auth.ts) `sendVerificationRequest` *before* the SMTP send and *before* the allowlist check (so timing doesn't leak which addresses are on the allowlist). Rejected attempts log a `magic_link_rate_limited` audit entry with the `retryAfterSec` value; the user sees a "Too many sign-in attempts — try again in N seconds" error. Per-IP limiting is documented in the brief but skipped — the auth callback doesn't ergonomically expose the request IP, and the AUTH_ALLOWED_EMAILS allowlist already caps the realistic attack surface to ~5 addresses. Can be added later at the middleware layer if real abuse appears.

Decision logic split into a pure function ([src/lib/rate-limit.ts](src/lib/rate-limit.ts) `decideRateLimit`) and a thin DB-aware wrapper (`checkAndRecordAttempt`). The pure function gets 9 unit tests; the wrapper is integration territory. Pruning of expired rows happens opportunistically inside the same `Promise.all` as the count + oldest-attempt query, so the table stays tiny without a separate cron.

**A4 — archived-guest restore.** [`deleteGuest`](src/app/(app)/guests/actions.ts) was a hard delete; the audit's persona walkthrough flagged the lack of undo as a real risk on the wedding day. Now soft-deletes (set `archived = true`, free the seat). Two new actions:

- `restoreGuest(id)` — flip `archived` back to `false`. Their seat does NOT auto-reassign; they come back unseated and the user reseats them.
- `hardDeleteGuest(id)` — actual `db.guest.delete`. Couple-only (gated explicitly on `user.isCouple`, audit-logged as `guests_denied` if a non-couple user tries). Requires the row to already be `archived = true` — you can't skip the soft-delete step.

UI: `/guests?archived=1` switches to a flat list of archived guests with Restore and (couple-only) Delete-forever buttons. Active view gets an "Archived (N)" link in the header that only shows when `N > 0`. Implemented as a server-component branch in [page.tsx](src/app/(app)/guests/page.tsx) with a small client component [ArchivedGuestList.tsx](src/app/(app)/guests/ArchivedGuestList.tsx) handling the actions.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds the `MagicLinkAttempt` model. Two indexes — `(identifier, createdAt)` for the rate-limit check, and `(createdAt)` for the prune. Migration [20260428100000_add_magic_link_attempt](prisma/migrations/20260428100000_add_magic_link_attempt/migration.sql) is purely additive — runs on `prisma migrate deploy` at next prod boot.

**Tests** ([tests/unit/rate-limit.test.ts](tests/unit/rate-limit.test.ts)) — 9 new cases for `decideRateLimit`: zero attempts, below threshold, at-max-1, at-threshold, above threshold, retry-after computation against window start, full-window fallback when oldest is missing, custom max + window overrides. 69 unit tests total now (60 → 69).

Verified: typecheck + lint + build + 69/69 tests + clean `npm ci` from wiped `node_modules`. Holding promote until GHA confirms green at the v1.3.0 SHA.

### 2026-04-28 · v1.2.4 — Dockerfile copies .npmrc (so the legacy-peer-deps actually applies in CI)

v1.2.3's `.npmrc` was at the project root and worked locally — but the GHA build still failed with a different error:

```
npm error code EUSAGE
npm error Missing: nodemailer@7.0.13 from lock file
```

Cause: the Dockerfile `deps` stage copies `package.json package-lock.json* ./` into the image, but **not `.npmrc`**. So `npm ci` inside the alpine image runs without `legacy-peer-deps=true`, sees the unresolvable optional-peer conflict, decides nodemailer@7.0.13 *must* exist, looks for it in the lockfile, doesn't find it, fails EUSAGE.

The local `npm ci` worked because the project-root `.npmrc` was visible. The Docker `npm ci` didn't have the file in scope.

**Fix:** [Dockerfile](Dockerfile) line 7 now copies `.npmrc*` alongside `package.json` and `package-lock.json*`. The `*` glob makes it tolerant of the file being absent on future restructures. Commented inline so the next reader knows why.

This is the genuinely-final fix for the four-version cascade. Building locally with `docker build --target deps` would have caught this immediately — the new standing rule in [CLAUDE.md](CLAUDE.md) is to run that step before promoting any release that touches deps.

Verified: typecheck, lint, build, 60/60 tests, `npm ci` clean from a wiped `node_modules`. Holding promote until GHA on `dev` confirms green.

### 2026-04-28 · v1.2.3 — .npmrc legacy-peer-deps + revert nodemailer to v6

Honest entry: v1.2.2's nodemailer-7 bump didn't fix CI either — it just swapped which peer-dep was unhappy. The third CI log gave us the full picture:

```
While resolving: next-auth@5.0.0-beta.25
  peerOptional nodemailer@"^6.6.5" from next-auth@5.0.0-beta.25  ← wants v6
Found: nodemailer@7.0.13
  peerOptional nodemailer@"^7.0.7" from @auth/core@0.41.2        ← wants v7
Conflicting peer dependency: nodemailer@6.10.1 / 7.0.13
```

**The fundamental problem:** `next-auth@5.0.0-beta.25` and `@auth/core@0.41.2` (cascaded via `@auth/prisma-adapter@2.11.2`) declare **mutually-incompatible** nodemailer peer ranges. There is **no** nodemailer version that satisfies both. v1.2.1 had `^6.x` (broke @auth/core); v1.2.2 had `^7.x` (broke next-auth).

But: **both ranges are `peerOptional`.** Neither package eagerly requires nodemailer at runtime — the declaration is purely advisory. npm 10's strict mode rejects the conflict anyway during `npm ci`; npm 10 on Windows happens to be lax about it; npm 10.8.2 on `node:20-alpine` enforces it. That asymmetry is the entire reason CI failed while local builds passed three times running.

**Fix (v1.2.3):**

1. **New [`.npmrc`](.npmrc) at the repo root** with `legacy-peer-deps=true`. This tells npm to skip the optional-peer conflict check, matching the Windows resolver behaviour. Documented in the file with the full rationale so future Claude doesn't delete it.
2. **Revert `nodemailer` to `^6.9.16`** (which `npm install` resolved to `^6.10.1`). next-auth is what actually `require`s nodemailer at runtime, via `next-auth/providers/nodemailer`. Sticking with the version next-auth tested against is safer than v7.
3. **Keep the JWT augmentation fix from v1.2.2** ([src/auth.config.ts](src/auth.config.ts) — `next-auth/jwt` path with side-effect import). That was the right structural fix regardless of the nodemailer version.
4. **Keep the vitest 2.x pin from v1.2.1.** Independent precaution, no harm in keeping it.

**Standing rule reinforced in [CLAUDE.md](CLAUDE.md):** before tagging a release with dep changes, watch GHA go green on the same SHA before fast-forwarding `claude/main`. The Windows-vs-Alpine npm asymmetry has burned us three times now.

Verified on a fully wiped `node_modules` from `npm ci`: typecheck clean, lint clean, 60/60 tests, build clean. Holding promotion until GHA confirms green.

### 2026-04-28 · v1.2.2 — Bump nodemailer to v7 + fix JWT augmentation (real CI fix)

Honest entry: v1.2.1's vitest pin didn't fix CI. The actual cause was hidden one layer deeper.

The full v1.2.1 GHCR build log surfaced the real error:

```
npm error code EUSAGE
npm error Missing: nodemailer@7.0.13 from lock file
```

Root cause: `@auth/prisma-adapter@2.11.2` cascaded `@auth/core@0.41.2`, which requires `nodemailer ^7.0.7` as an optional peer. Our `package.json` pinned `nodemailer ^6.9.16`. Local `npm ci` on Windows (npm 10.x) silently tolerated the conflict; CI `npm ci` on `node:20-alpine` (npm 10.8.2) strictly rejected it.

**Three coordinated changes:**

1. **Bump `nodemailer` to `^7.0.13`** ([package.json](package.json)). Our usage (`nodemailer.createTransport(...)` + `transport.sendMail(...)`) is API-stable across v6 → v7; no runtime code change needed.
2. **Move JWT type augmentation from `@auth/core/jwt` to `next-auth/jwt`** ([src/auth.config.ts](src/auth.config.ts)). With `@auth/core@0.41+` nested inside `next-auth/node_modules/`, the old `@auth/core/jwt` path no longer resolves at the project root. Added a side-effect `import "next-auth/jwt"` so TypeScript's module-resolution sees the module before the `declare module` augmentation pass.
3. **Standing rule in [CLAUDE.md](CLAUDE.md)** — before tagging a release that changes deps, run `npm ci` against a fresh `node_modules` AND prefer `docker build --target deps` against linux/amd64. The Windows `npm install` resolver is more permissive than `node:20-alpine`'s.

Verified clean from a wiped `node_modules`:
- `npm ci --no-audit --no-fund` succeeds (~37s)
- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` 60/60 passing
- `npm run build` clean Next bundle

The vitest 2.x pin from v1.2.1 stays — it's still the right call (vitest 4.x is too new for routine CI use, and 2.x is widely battle-tested), but it wasn't the cause of the failure.

### 2026-04-28 · v1.2.1 — Pin Vitest to v2.x to fix Docker build

v1.2.0's `npm ci --no-audit --no-fund` failed inside the Docker `deps` stage on `node:20-alpine`:

```
ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci --no-audit --no-fund"
       did not complete successfully: exit code: 1
```

Vitest 4.x (released Oct 2025) installed cleanly on the Windows dev box but a transitive dep failed quietly under Alpine's musl libc. Local builds were green; the GHCR image build was broken.

**Fix:** downgrade `vitest` and `@vitest/ui` to `^2.1.9` and regenerate `package-lock.json` against the v2 dep tree. Vitest 2.x is widely battle-tested on Alpine and used by countless CI pipelines on `node:20-alpine`. Our test files use only stable APIs (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`) that are identical across v2 → v4, so no test code changed. Verified `npm ci` from a clean `node_modules` tree succeeds locally; verified `npm test` (60/60), `npm run typecheck`, `npm run lint`, `npm run build` all clean.

**Standing rule added to [CLAUDE.md](CLAUDE.md):** don't upgrade Vitest casually. Test `docker build --target deps` on linux/amd64 before merging any future major bump. Same caution for `tinypool`, `@vitest/snapshot`, and the Vite version that rides along.

Patch bump only — no functional change to the running app, only to the build tooling. The R1 fixes from v1.2.0 carry through unchanged.

### 2026-04-28 · v1.2.0 — Phase R1: trust restoration (audit fixes + Vitest)

First remediation phase from the [post-audit plan](REMEDIATION-PLAN.md). Six fixes that close every audit-flagged permission/data-leak class, plus the project's first automated test suite. No schema changes; no env changes.

**Two BLOCKER-class privilege escalations closed** (escalated from MAJOR after static verification revealed worse-than-audit-described behaviour):

- **A2 — settings self-elevation.** `setPermission`, `setUserCouple`, and `removeUser` in [src/app/(app)/settings/actions.ts](src/app/(app)/settings/actions.ts) were gated only by `requireEdit("settings")`. A non-couple user with `EDIT(settings)` could call `setUserCouple(myOwnId, true)` and self-promote to couple-tier. All three now require `user.isCouple === true` explicitly. Denied attempts log a `settings_denied` audit entry with the target action and reason.
- **A6 — file visibility leak.** `updateFile` in [src/app/(app)/files/actions.ts](src/app/(app)/files/actions.ts) had no `isCouple` check on visibility transitions at all. A non-couple user with `EDIT(files)` could flip a `COUPLE_ONLY` file to `EVERYONE` and read couple-only documents. Now any visibility transition touching `COUPLE_ONLY` (in either direction) requires couple-tier, with denied attempts logged as `files_denied`.

**Four smaller audit findings closed:**

- **A1 — list-page `canView` gates.** [src/app/(app)/tasks/page.tsx](src/app/(app)/tasks/page.tsx), [questions/page.tsx](src/app/(app)/questions/page.tsx), [book/page.tsx](src/app/(app)/book/page.tsx), and [guests/page.tsx](src/app/(app)/guests/page.tsx) now redirect to `/` when the caller lacks `canView` for the section. Sidebar nav already hid these for blocked users; the routes themselves were reachable by URL. Mirrors the pattern already in use at `/guests/[id]` and `/guests/catering`.
- **A5 — polymorphic Task gate.** `setTaskStatus` and `deleteTask` in [src/app/(app)/tasks/actions.ts](src/app/(app)/tasks/actions.ts) operate on the `Task` model that stores TASK / QUESTION / DECISION rows. They now read the row's `type` first and dispatch to `requireEdit("tasks")` or `requireEdit("questions")` accordingly. Closes the cross-section gate gap a user with `EDIT(tasks)` + `NONE(questions)` could exploit via crafted requests.

**Test infrastructure (T1) shipped:**

- [vitest.config.ts](vitest.config.ts) with the `@/*` path alias matching tsconfig.
- `npm test` and `npm run test:watch` scripts.
- 60 unit tests across four files:
  - [tests/unit/permissions.test.ts](tests/unit/permissions.test.ts) — 17 tests covering `canView` / `canEdit` for every (section, level, isCouple) combination, including F1 escalation reproductions for tasks/questions/book/guests.
  - [tests/unit/csv-merge.test.ts](tests/unit/csv-merge.test.ts) — 33 tests for the import coercers and helpers (`coerceBool`, `coerceRsvp`, `coerceSide`, `coerceChild`, `coerceDietary`, `coerceTags`, `splitFullName`, `inferField`, `dedupeKey`, `isEmptyValue`, `nonEmptyOrNull`, `detectSeparator`).
  - [tests/unit/spotify.test.ts](tests/unit/spotify.test.ts) — 8 tests for `parsePlaylistId` (URL-with-?si=, bare URL, `spotify:` URI, bare ID, whitespace, junk inputs) and `isSpotifyConfigured`.
  - [tests/unit/smoke.test.ts](tests/unit/smoke.test.ts) — runner-wired-up sanity check.

Tests run in <1s after the first cold start. Future audit findings should land alongside a regression test that would have caught them.

**Out of scope for R1** (deferred to R2/R3 per the [remediation plan](REMEDIATION-PLAN.md) §4): magic-link rate limit (A3), archived-guest restore UI (A4), permission integration test against a real DB (T2), Playwright e2e (T3), TESTING.md (T4), backup verification cron (T5), all Bucket B and C items.

Verified: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` all clean.

### 2026-04-27 · v1.1.0 — At a Glance dashboard

The `/glance` route was a "Coming soon" stub from Phase A onwards. v1.1.0 turns it into a real big-picture dashboard built entirely from live Prisma queries — no client-side mocks, no data duplication, no new schema.

**Five cards, role-aware** ([glance/page.tsx](src/app/(app)/glance/page.tsx)):

1. **RSVPs** — SVG donut showing confirmed / pending / declined as three-arc segments with rounded line caps and tokenised CSS-variable strokes (so dark mode picks up the right palette automatically). Centre shows attending count + "of N total". A list of the four most recently updated guests with confirmed/declined status pills sits below.
2. **Budget** (couple-only) — `Decimal` aggregates from `BudgetLine._sum` for planned/actual/paid. Stacked progress bar (paid moss + committed marigold) plus three small stats. Non-couple users see a Wedding-day countdown card with a "🔒 Budget is restricted to Jamie & Bryony" footer instead, so the page stays balanced for everyone.
3. **Payments due** (couple-only) — next 30 days, sorted by `dueDate`, joined with `Supplier.name`. Non-couple users see "My open tasks" instead.
4. **Recent activity** — last 8 audit-log entries joined with the originating user. Action codes are mapped to human-readable phrases (`rsvp` → "set an RSVP to attending", `quickcapture` → "quick-captured a task", `spotify_sync` → "synced 47 tracks from Spotify"). Couple-only entities (`Payment` / `BudgetLine` / `BudgetCategory`) are redacted to "updated a private page" with reduced opacity for non-couple viewers.

**Implementation notes:**

- Six parallel queries via `Promise.all` (groupBy on Guest.rsvp, recent guests, payments, budget aggregate, my tasks, audit log). The non-couple branch resolves to `[]` / `null` for the couple-only queries to keep the parallel shape uniform.
- The `describeActivity` helper is intentionally dumb: any unknown action falls through to `${action} a ${entity}` rather than exposing raw codes. Future actions don't break the page.
- `RsvpDonut` calculates arc lengths from `total` directly so it stays accurate as RSVPs land. Three-arc stroke offsets stack end-to-end starting from 12 o'clock.
- `View all →` links route to the underlying domain page so the dashboard is a launchpad, not a dead end.

No schema changes; no env-var changes. typecheck + lint + build all clean.

### 2026-04-27 · v1.0.0 — Release-1 design polish across all pages

A focused pass through every domain page to close the gap between the prototype and the live app. After this release, the design audit produces "no significant gaps" — pages have moved from functional to polished.

**Today** ([page.tsx](src/app/(app)/page.tsx) + [CountdownCard.tsx](src/app/(app)/CountdownCard.tsx) + [TodayEventsCard.tsx](src/app/(app)/TodayEventsCard.tsx))
- Countdown card has a months/weeks/days segmented toggle, persisted to `localStorage` (`wh_countdown_unit`).
- "Mine" / "Everyone" persona filter on the upcoming-events card; "Mine" matches `ScheduleEvent.audience` against the session-user role with sensible aliases (couple ↔ bride/groom, wedding_party ↔ party, planner ↔ suppliers).
- New RSVP / catering snapshot strip beneath the columns: invited / attending / pending / declined / dietary / children + highchairs — picked up via a `groupBy` on `Guest.rsvp` and a single dietary flatten.

**Tasks** ([TaskBoard.tsx](src/app/(app)/tasks/TaskBoard.tsx))
- New `Board` view alongside `List`. Three columns (To do / Doing / Done) with subtle accent left-borders. `WAITING` shows in Doing; `ARCHIVED` is hidden.
- Each card: priority dot, title, due-date (with overdue red), tag chips (max 2), assignee avatar, and three move buttons that change status with one click. No drag-drop in v1.0 — the click-to-move buttons are accessible and keyboard-friendly, which beats half-broken DnD.
- View choice persists to `localStorage` (`wh_tasks_view`).

**Schedule** ([ScheduleTimeline.tsx](src/app/(app)/schedule/ScheduleTimeline.tsx) + [EventNode.tsx](src/app/(app)/schedule/EventNode.tsx))
- Vertical timeline with a left-aligned hairline rule and round node markers on each event. Events grouped by calendar day with a sticky date header.
- Print button on the page header — reuses the existing `@media print` plumbing via a new `.schedule-page` print scope and a print-only letterhead. Schedule prints clean on A4 with day headers preserved and edit affordances hidden.

**Suppliers detail** ([suppliers/[id]/page.tsx](src/app/(app)/suppliers/[id]/page.tsx) + [SupplierDetailClient.tsx](src/app/(app)/suppliers/[id]/SupplierDetailClient.tsx))
- Click any supplier name → full detail page with status, agreed/paid/outstanding tiles, **contacts** (with mailto + tel links + primary toggle that auto-unmarks others), **contracts** (signed-or-pending pill, amount, signed-on date, notes), **communications log** (channel icon, summary, follow-up date, relative time), and a read-only payment list linked to `/payments`.
- Five new server actions (`createSupplierContact`, `createSupplierContract`, `createSupplierCommunication`, plus `delete*` siblings), all gated by `requireEdit("suppliers")` and audited.
- Setting a contact as Primary auto-clears any other primary on that supplier — used by the day-of-mode contacts panel which picks the primary contact.

**Questions** ([QuestionsClient.tsx](src/app/(app)/questions/QuestionsClient.tsx))
- Search box + Type filter pills (All / Questions / Decisions) + Priority filter pills (All / High / Med / Low). Filters compose; empty result state is preserved per filter set.
- Section headers (Open / Answered) only render when their bucket has items after filtering, so the page never has lonely "Open" headings.

**Budget** ([BudgetClient.tsx](src/app/(app)/budget/BudgetClient.tsx))
- Categories are collapsible — header shows line count + per-category Planned/Paid subtotals on wide viewports.
- Summary bar gains a stacked progress bar: paid (moss) layered over committed/actual (marigold), with percentage labels and an "⚠ Actual exceeds planned by £X" callout when applicable.

**Files** ([FilesClient.tsx](src/app/(app)/files/FilesClient.tsx))
- Type filter pills (All / Images / PDFs / Documents / Other) with live counts.
- Image files render inline thumbnails (via `/api/files/[id]`) replacing the 🖼 icon — couple can scan a folder of photos visually rather than by filename.

**Songs** ([PlaylistCard.tsx](src/app/(app)/songs/PlaylistCard.tsx) + new `moveSong` action)
- Each song shows its position number and reveals up/down arrow buttons on hover — matches the photography shot list reorder pattern.
- Spotify-synced rows are still safe to reorder; a re-sync wholesale-replaces synced rows so the order resets to Spotify's, which is intentional and documented.

**Wedding party section** ([prisma/seed.ts](prisma/seed.ts))
- New `wedding-party` BookSection with five seeded subsections (Roles / Outfits / Ring keepers / Stag & Hen / Day-of logistics). Idempotent: only seeds when the section is empty, so re-running `db:seed` never overwrites real notes.
- Renders through the existing `/book/[slug]` editor — no special-case route needed, in contrast to `/book/photography` which has a custom checklist UI.

**Book on-page anchors** ([book/[slug]/page.tsx](src/app/(app)/book/[slug]/page.tsx))
- Sticky "On this page" pill row at the top of every section with subsection links. Each `SubsectionEditor` renders an `id={sub.slug}` and `scroll-mt-24` so anchor navigation lands cleanly below the page header.

**Why 1.0.0** — the original criterion was "good for the wedding day itself, after the rehearsal data is real." The data is real (CSV imports landed), the day-of view is wired, every page in the prototype has a faithful counterpart, and the polish gap from the design audit has been closed. There's still a deferred backlog (audit log viewer, custom-fields UI, seating constraints, glance dashboard) but none of it is load-bearing for the wedding. Pre-1.0 caveat in the versioning section is satisfied. We're calling 1.0.0 from here.

No schema changes; no env-var changes. typecheck + lint + build all clean.

### 2026-04-27 · v0.15.0 — Phase G2: day-of mode + quick-capture

Two of the prototype's signature features finally shipped: a day-of dashboard for the wedding day itself, and a global keyboard shortcut for fast capture from anywhere in the app.

**Day-of mode** lives at [`/today/day-of`](src/app/(app)/today/day-of/page.tsx), reachable from a "◉ Day-of mode" button on the Today header. The page shows:

- **Hero band** with the wedding date, venue, and viewer name. On the wedding day itself the strapline reads *"Today is the day"* — outside the day a yellow "Preview mode" banner makes it explicit you're looking ahead, and the timeline still works because the now/next/past classification runs against the current clock.
- **Live timeline** of every `ScheduleEvent` between 00:00 and 23:59 of the wedding date. Each event is classified `past` / `now` / `next` / `upcoming` from current time vs `startTime` + `endTime` (or +30 min for events without an end). The single `next` is computed in a second pass — the first upcoming after the last `past`/`now`. Past events are struck through and dimmed; the now event gets a marigold band + `NOW` chip; the next event gets a moss band + `NEXT` chip.
- **Day-of contacts** pulled from `Supplier`s with status `BOOKED` or `PAID`, joining their primary contact (or first contact) where a phone number exists. Each row is a `<a href="tel:…">` so on a phone the contact can be one-tapped — that's the whole point on the day.
- **Catering today** — totals, adults / children / kids' meals / highchairs / dietary requirements. Reuses the same query shape as the catering brief, just inline. Links out to `/guests/catering` for the full printable.
- **Open quickly** — direct links to Shot list, Seating chart, Schedule, Guests, Songs.

**Quick-capture** is the global `C` shortcut promised since Phase A. Implementation:

- [QuickCapture.tsx](src/components/shell/QuickCapture.tsx) — client component mounted once in [AppShell](src/components/shell/AppShell.tsx). Listens to `keydown` on `window` and opens when `C` (no modifiers) fires outside an input / textarea / select / contenteditable — so typing "C" into a real form field never pops the modal.
- Three target types: `Task`, `Question`, `Event`. Single text input, Enter to submit, Esc to dismiss. Click outside the modal also dismisses (when not pending). Auto-focus the input on open.
- Captured rows route to the right table via [src/app/(app)/actions.ts](src/app/(app)/actions.ts):
  - `Task` → `db.task.create({ type: TASK, status: OPEN, priority: MEDIUM, assigneeId: <self> })` + revalidate `/tasks` and `/`.
  - `Question` → same, but `type: QUESTION`, revalidates `/questions`.
  - `Event` → `db.scheduleEvent.create` with `startTime` defaulted to the next round hour, revalidates `/schedule`. The user picks a real time on the destination page if they want.
- Each capture is gated by `requireEdit("tasks" | "questions" | "schedule")` so the permission matrix still applies — viewers see the modal but get a permission error on submit.
- Audited as `quickcapture` with `{ source: "quickcapture" }` metadata so we can grep the audit log later.
- Success surfaces a 1.4s green toast at the bottom of the screen — `✓ Task added: <title>`.
- Payments are deliberately NOT a capture type: they need a supplier + amount that don't fit one text field. Capture as a Task with "pay X" instead.

No schema changes; no env-var changes. Verified with typecheck + lint + build.

### 2026-04-27 · v0.14.0 — Phase G1: Spotify playlist sync

The Spotify field on `Playlist` had been in the schema since Phase B but un-wired. v0.14.0 connects it: paste a Spotify playlist URL on any local Playlist, click **Sync**, and Wedding Hub mirrors the tracks as `Song` rows with `spotifyUri` set. Click a song title to open it in Spotify. The `Songs` page becomes a shareable read-only mirror — the couple keeps curating in Spotify (where the editing UX is good), the planner / DJ / wedding party get a stable URL.

**Auth model: Client Credentials.** App-to-app auth, no per-user OAuth dance. The trade-off is that Spotify's Client Credentials token can ONLY read public playlists — so the couple must flip the playlist to public during a sync (they can flip it back to private after; we cache the tracks locally). Documented in the env-example. Future iteration could add user-OAuth (`playlist-read-private`) if anyone hits this friction.

**Implementation** ([src/lib/spotify.ts](src/lib/spotify.ts)):
- Token cache with 30s expiry buffer to dodge race conditions during a sync.
- Pagination with `?limit=100`; hard cap of 10 pages (≤1000 tracks) as a runaway guard.
- `parsePlaylistId()` accepts the full URL (with `?si=` tracking param), the `spotify:playlist:` URI, or a bare base62 ID.
- Strips local files and non-track items (podcasts, episodes) — they'd have no `spotifyUri` the DJ could play anyway.
- Surfaces 404 with a "make sure the playlist is public" message rather than a generic "not found".
- Surfaces 429 with the `Retry-After` so the user knows when to retry.

**Sync semantics** ([actions.ts](src/app/(app)/songs/actions.ts) `syncPlaylistFromSpotify`):
- **Wholesale replace** of synced songs (rows where `spotifyUri IS NOT NULL`). Spotify is the source of truth — re-running sync mirrors the current state, including removed songs.
- **Manually-added songs preserved** (no `spotifyUri`). Guest requests / planner additions still show up alongside the synced list.
- New songs are appended after any manually-added ones (max-order + 1 onwards) so manual entries keep their slot order.
- Each sync stamps `Playlist.lastSyncedAt`, `lastSyncError`, `lastSyncedSongs`. Failed syncs persist the error message so the user sees it on reload.
- Audit-logged with `spotify_sync` (success) / `spotify_sync_fail` (error) actions and `tracks` / `error` metadata.

**UI** ([PlaylistCard.tsx](src/app/(app)/songs/PlaylistCard.tsx)):
- New panel under the playlist header — visible only when Spotify is configured OR the playlist already has a Spotify ID. Hidden on do-not-play / block lists (Spotify mirroring would defeat the purpose).
- States: not configured (with env-var hint), no URL linked (Link button), linked and never synced (Sync now button), linked and synced ("Synced 3m ago" + Re-sync button), error (red ⚠ banner with Spotify's message).
- Each synced song renders the title as a hyperlink that opens the track in Spotify, plus a tiny 🎵 marker.
- Confirm dialog before sync mentions how many synced songs will be replaced and how many manually-added ones will survive.

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds three nullable columns to `Playlist`: `lastSyncedAt`, `lastSyncError`, `lastSyncedSongs`. Migration `20260427200000_add_playlist_sync_metadata` is purely additive.

**Env** ([.env.example](.env.example)) introduces optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`. Both blank → entire sync UI is hidden, so existing deployments without these vars look exactly the same as before.

Verified: typecheck + lint + build all clean.

### 2026-04-27 · v0.13.0 — Phase F2: photography shot list

A printable, tickable shot list for the photographer, sitting under the Wedding Book.

**New page** at [`/book/photography`](src/app/(app)/book/photography/page.tsx) — opens from the new **Photography & Shot list** card on `/book`. Each shot has:
- Title (e.g. *Couple portraits*)
- "With whom" — comma-separated names rendered as moss chips
- Location — short label (Garden / Library / Front lawn)
- Notes — free-text
- A captured/planned checkbox the photographer ticks on the day

The header shows live progress (`3 of 6 captured · 3 planned`), and the same count surfaces on the Photography card on the Book hub so the couple can see at a glance how the day went.

**Reorder** with up/down arrow buttons per row (visible on hover, accessible via focus). Implemented as an order-field swap with the neighbour, not a full renumber, so reorder is one transaction regardless of list length.

**Print mode** (`Print` button → `window.print()`) reuses the global `@media print` stylesheet established by the catering brief. The print stylesheet:
- Hides the Wedding Book back-link, action buttons, and reorder/edit/delete affordances (`.no-print`)
- Renders the print-only letterhead (*Shot list — Jamie & Bryony*)
- Forces a square hollow-checkbox so the photographer can tick rows with a pen on paper
- Avoids page-breaking inside the shot list block (`.print-break-avoid`)

**Schema** ([prisma/schema.prisma](prisma/schema.prisma)) adds a standalone `PhotographyShot` table — title, `withWhom: String[]`, location, notes, captured boolean, capturedAt timestamp, order int. No FK to Guest deliberately: shot lists describe people by display name, and we don't want a deleted Guest to silently remove a planned shot. Migration `20260427190000_add_photography_shot` is purely additive — `migrate deploy` creates the table on next prod boot.

**Permissions:** lives under the existing `book` permission section. No new section key needed; couple + party + planner all get edit access via the standard `Permission` row matrix.

**Seed** ([prisma/seed.ts](prisma/seed.ts)) idempotently inserts the six prototype shots if and only if the `PhotographyShot` table is empty — a re-seed never overwrites real data added through the UI. The `BookSection` row with slug `photography` is upserted alongside the other sections so the card appears on the hub.

Verified: typecheck + lint + build all clean. No env-var changes.

### 2026-04-27 · v0.12.0 — Import merge + guest detail page + catering letterhead

Three pieces of feedback in one minor bump:

**1. Import duplicates were not merging.** The user re-imported their Say I Do CSV after RSVPs came in and got a household with four guests where there should have been two — two complete rows plus two stub rows showing only the new RSVP chip. The previous importer always called `db.guest.create`, so any row whose name+household matched an existing guest produced a second row instead of merging into the first.

Fix: at preview and commit time, the importer now builds a dedupe key of `householdName|firstName|lastName` (case-insensitive) and uses it to detect existing guests in target households. The preview shows a `merge` chip on rows that will land on an existing guest, and the summary distinguishes new vs merging counts (`23 new · 4 merging into existing`).

The merge-update has well-defined field semantics:
- **Strings** (email, phone, role, plus-one name, meal courses, RSVP link): overwrite only when the new value is non-empty — never blank existing data with a partial second import.
- **Booleans** (isChild, needsHighchair, childrenMeal, plusOneAllowed): OR semantics — never downgrade `true → false`.
- **Side**: overwrite only when the new value differs from the default `BOTH`.
- **RSVP**: overwrite only when the new value isn't `PENDING` — confirmed RSVPs are never reset to pending on re-import.
- **Arrays** (dietary, tags): case-insensitive union; existing order preserved.
- **Notes**: append rather than overwrite, deduped on substring match.
- **Seat**: only assign if the existing row is unseated.
- **Song requests**: skip titles already on this guest (case-insensitive title match).

If the same import contains multiple rows with the same name+household (rare but possible), later rows merge into the first one created in this run instead of creating yet another duplicate. The success page now shows separate "Created N · Merged into M" counts.

**2. New guest detail page.** Click any guest name on `/guests` and a new `/guests/[id]` page opens with their full details — RSVP, side, role, adult/child + highchair + kids-meal flags, plus-one, dietary, tags, table assignment, RSVP link, three-course meal choices, free-text notes, song requests, and other guests in the same household. The page has an "Edit" button that surfaces the existing GuestForm inline for full editing, an inline RSVP dropdown (same as the list view), and a delete button that returns to `/guests` after confirmation. Guards: `canView("guests")` to load, `canEdit("guests")` to mutate. Read-only mode hides the action buttons and shows a "you don't have edit access" notice.

**3. Catering brief letterhead redesign.** The previous header (`Catering brief` h1 + `Jamie & Bryony · {date}` subtitle) didn't match the design brief from the prototype. Restyled to use the prototype's letterhead pattern: couple name as the primary heading (`Spencer · Olwyn-Davis Wedding`), a row underneath with date + venue on the left and "Generated 27 April 2026" on the right, and a heavier 2px ink-primary rule beneath. Couple name and venue are read from `WEDDING_COUPLE` and `WEDDING_VENUE` env vars (with sensible defaults baked in for the current build) so the same brief works for any couple without code changes.

No schema changes; additive refactor only. Verified with typecheck + lint + build.

### 2026-04-27 · v0.11.1 — Import: stop warning on "-" boolean placeholders

User pasted their real Say I Do CSV into Preview and every single row had two warnings:
- `couldn't parse "highchair" value "-", treating as no`
- `couldn't parse "children's meal" value "-", treating as no`

**Cause:** Say I Do uses `-` as the "not applicable" placeholder in the Q7 (highchair) and Q8 (children's-meal) columns when the question doesn't apply (i.e., for adults). My `coerceBool` had `"-"` in neither the truthy nor falsy set, so it returned `null` and the import action emitted a per-row warning. Result: 22 rows × 2 warnings = visual noise that drowned out real issues.

**Fix:** extend `FALSY` to include the standard empty-placeholder set (`-`, `—`, `n/a`, `n.a.`, `na`, `none`). The semantic intent on those rows is "no, not applicable" — boolean coercion now succeeds with `false`, no warning.

`coerceChild` already handled `-` correctly via its own `CHILD_MAP` since v0.9.0; this fix just brings `coerceBool` into the same convention so highchair, children's meal, and plus-one columns all behave the same way.

Patch bump only — no schema change, no API change. The same CSV in v0.11.1 will preview clean (only real warnings will surface).

### 2026-04-27 · v0.11.0 — Phase F1: catering brief (printable summary)

Opens Phase F. Single new page at [`/guests/catering`](src/app/(app)/guests/catering/page.tsx) — a venue-ready summary that uses the data the Phase E import landed in the DB.

**Page sections:**
1. **Action bar** (hidden in print) — back-to-Guests link + "Print / save as PDF" button that calls `window.print()`.
2. **Headline tiles** — Attending, Adults, Children, Children's meals, Highchairs.
3. **Three-course breakdowns** — separate tables for Starters, Mains, Desserts. Each lists every distinct meal choice with its count, plus a "(no choice recorded)" row at the bottom for any guests who haven't filled in that course yet. Counts sum to the attending total so the venue can sanity-check the numbers.
4. **Dietary requirements** — flattened across all guests' `dietary[]` arrays, with a count per requirement. Sorted descending.
5. **Per-table breakdown** — every Table (sorted by name with natural ordering, so "Table 10" comes after "Table 2"), each rendered as its own card with seat number, guest name, three-course choices, and a notes column combining dietary tags + child / kids-meal / highchair flags. "Unassigned" guests appear at the end as a final block.

**Print stylesheet** ([src/app/globals.css](src/app/globals.css)):
- `.no-print`, `.desktop-sidebar`, `.mobile-tabbar` hidden in `@media print`.
- `.print-only-block` only visible in print (used for the "Generated DD MMM YYYY" footer line).
- `.print-break-before` / `.print-break-after` / `.print-break-avoid` helpers for explicit page-break control.
- `@page` directive sets A4 portrait with 16mm × 14mm margins.
- Body forced to black-on-white; tables get a flat grey header so they print fairly on a B/W laser.

**Linking**: new "Catering brief" button in the Guests page header — visible to anyone with view permission on `guests`, not just edit-tier users.

**Aggregation logic**: meal-choice counts use exact-string equality (Say I Do exports are byte-identical across rows, so this is fine in practice). Dietary requirements and meals are tallied with sort-by-count-descending so the most common items surface at the top. Guests without a table assignment go into an "Unassigned" group at the end, sorted alphabetically.

Photography shot list (Phase F2) deferred to its own iteration — needs a new Prisma model and probably its own UI under the Wedding Book section.

### 2026-04-27 · v0.10.0 — Children's-meal + RSVP link import, cross-page surfaces, Windows guide

**Schema** ([20260427180000_guest_kids_meal_and_relax_link](prisma/migrations/20260427180000_guest_kids_meal_and_relax_link/migration.sql)):
- New `Guest.childrenMeal Boolean @default(false)` for the Q8 question — couples can now see at-a-glance which child guests need the children's-meal option for the venue's catering count.
- Drops the `Guest_rsvpUniqueLink_key` unique index. Say I Do issues per-PARTY RSVP URLs (Tia and Torin share a link), which would have failed `@unique`. The column itself stays — just the constraint is relaxed.

**Importer** ([src/lib/csv.ts](src/lib/csv.ts), [src/app/(app)/guests/import/actions.ts](src/app/(app)/guests/import/actions.ts)):
- New `childrenMeal` field type, heuristics: `/^q\d+.*(children|kids?).*meal/i`, `/^children('?s)?\s*meal$/i`, `/^kids?\s*meal$/i`. Boolean coercion via existing `coerceBool`.
- New `rsvpLink` field type, heuristics: `/^(unique|rsvp|sayido|say\s*i\s*do)\s*(link|url)$/i`. Stored as `Guest.rsvpUniqueLink`.
- Both pre-selected by default for the user's actual Say I Do CSV columns.

**Cross-page surfaces** — answers "do imports interact with the Songs/Seating pages?":
- **Songs**: new "Guest requests" section above the curated playlists ([src/app/(app)/songs/GuestRequestsSection.tsx](src/app/(app)/songs/GuestRequestsSection.tsx)) listing all `SongRequest` rows where `playlistId IS NULL` (the imported ones). Grouped by guest; same person with three Q3/Q5/Q9 requests shows as one block with three lines. Page subtitle counts them.
- **Guests page**: per-guest row now shows a **table chip** (linking to `/seating`) when the guest has a `tableSeatId`, a **songs count chip** (linking to `/songs`) when they've made requests, a **kids-meal badge** alongside Child / Highchair, and an **RSVP-link icon** opening the Say I Do URL externally.
- Required including `tableSeat.table` and `_count: { songRequests }` in the household query — small data-volume bump for a big UX win.

**UI**:
- Import preview row now shows the **Kids meal** badge alongside Child / Highchair when applicable.
- New collapsible "How do I get the CSV out of a downloaded file? (Windows guide)" `<details>` block on the import page — step-by-step instructions for the right-click → Notepad → Ctrl+A → copy → paste flow, plus an Excel/Sheets alternative.

**Tested against the user's actual Say I Do CSV**: all 21 columns now have a sensible mapping (some auto-detected, some default to *Ignore* with the user choosing whether to override). After import, Q8-flagged child guests show the kids-meal badge; the per-party Unique link from Say I Do appears as a clickable RSVP icon on each guest row in their household; Q3/Q5/Q9 song requests appear in the new Songs page section; auto-created tables show inline as chips on guest rows.

### 2026-04-27 · v0.9.1 — Import copy: clarify Guest vs User email scope

User caught that a v0.9.0 chat message implied the duplicate-email check spanned both Guest and User accounts. The code itself only ever queried `db.guest` (User accounts and Guest rows are separate tables, no FK linking them) — but the warning copy and confirm dialog were ambiguous about which table the check covered. This iteration tightens that copy in three places:

- The preview row-warning now reads "another Guest row already has this email — importing will create a second guest row" (was "email already exists in DB").
- The confirm dialog explicitly notes "User sign-in accounts are stored separately and aren't checked here."
- The info banner at the top of the import page calls out the separation up-front, so the question doesn't even come up while staring at a preview.

No code-behaviour change; just docs / UI copy. Patch bump only.

### 2026-04-27 · v0.9.0 — Phase E feature-complete: real Say I Do CSV ingest

User loaded their actual Say I Do export and it didn't work end-to-end with the v0.8.0 importer. This iteration upgrades the importer to handle the messy, real-world shape of that file.

**Schema:** additive migration `20260427170000_add_guest_meal_fields` adds `mealStarter`, `mealMain`, `mealDessert` (all nullable text) to `Guest`. The existing `mealCourse` FK relation stays for now — never wired to UI, free-text is a more honest match for Say I Do's long meal descriptions.

**Parser ([src/lib/csv.ts](src/lib/csv.ts))** — new field types and heuristics:
- `fullName` — single "Guest Name" column, split on first whitespace at commit time. Hyphenated firsts ("Bryony-Olwyn Davis") survive.
- `tableName` — table assignments. Recognises "Table", "Seat Table", etc.
- `mealStarter` / `mealMain` / `mealDessert` — match `Q\d+: starter / main meal / desert` (typo and all) plus straight `Starter` / `Main` / `Dessert`.
- `needsHighchair` — `Q\d+: highchair`.
- `songRequest` — `Q\d+: song`. Multi-column allowed: Q3, Q5, Q9 all map to song requests; each non-empty value becomes its own `SongRequest` row.
- `tags` — pipe-delimited "Groups" column (Immediate Family|Bryony's side|Wedding party). Stored on `Guest.tags`.
- `notes` — multi-column allowed; concatenated with their header labels when more than one column maps here.
- New `coerceChild` — recognises "Adult"/"Child"/"Kid"/"Minor" alongside the generic boolean strings.
- `coerceDietary` now strips "None"/"N.a."/"Non"/"-" placeholders so they don't end up as actual dietary requirements.
- `inferSideFromTags` — when there's no explicit side column but the Groups column has tags like "Bryony's side" or "Jamie's side", infer the guest's side from there.

**Commit action ([src/app/(app)/guests/import/actions.ts](src/app/(app)/guests/import/actions.ts))**:
- Uses `splitFullName` to derive first/last when only `fullName` is mapped.
- Resolves `tableName` by find-or-create. New tables get capacity = max(targetCount, 8); names containing "head" get `TableShape.HEAD`; everything else `ROUND`. Seats are created up to capacity. Each guest gets the next free seat in their table — bookkeeping happens locally to avoid clashes within one import batch.
- Multi-column song requests → `db.songRequest.createMany` linked to the new guest.
- Multi-column notes → concatenated with header labels.
- Pre-flight existence checks now cover households, tables, AND emails — duplicate emails surface as preview warnings (still imported, but flagged so the user knows).

**Preview UI ([src/app/(app)/guests/import/ImportClient.tsx](src/app/(app)/guests/import/ImportClient.tsx))**:
- New columns: Table (with new/seat chip), Meals · Songs (compact `S/M/D` and `♪ N` indicators with full-text tooltips on hover).
- Confirm dialog summarises new tables + duplicate-email count, not just households.
- Success page shows tables-auto-seated count and song-requests count alongside guests.

**Display:** [src/app/(app)/guests/HouseholdBlock.tsx](src/app/(app)/guests/HouseholdBlock.tsx) — guest rows now show meal trio (🍲 starter · 🍽 main · 🍰 dessert) inline below the contact line, truncated to 3 words with full-text tooltip on hover.

**Verified against real data:** the Say I Do export the user shared (22 attending guests, 6 unique tables, 35+ song requests across Q3/Q5/Q9, 3-course meal choices, mixed Adult/Child rows) maps cleanly with all heuristics auto-detecting correctly.

### 2026-04-27 · v0.8.0 — Phase E: CSV / TSV guest import

The Guests page now has an **Import CSV** button in its header (couple-tier and anyone with `guests:edit`). Lands on `/guests/import` — a paste-and-preview flow that handles:

- **CSV or TSV** — auto-detected from the header line. Quoted fields, escaped quotes (`""` → `"`), and embedded commas are all handled. (Multi-line cells inside quotes also work, though Say I Do exports rarely use them.)
- **Column auto-inference** — header heuristics map "First Name", "Email Address", "+1", "Dietary Requirements", etc. to known fields. The user can override any guess via per-column dropdowns. Required: First name, Last name. Everything else is optional.
- **Live dry-run preview** — for every parsed row, shows the coerced values + per-row errors (missing required fields, oversize names) and warnings (malformed email, unparseable boolean). The preview shows the first 12 rows by default with a "Show all" toggle for bigger imports.
- **Household resolution** — rows sharing a household name go to the same household. Existing households (matched by exact name) get merged into; new households are created. Newly-created households inherit the dominant `side` value from their members. Rows without a household name get a per-guest household named `"FirstName LastName"` so they don't get dumped into one giant pile.
- **Commit in a single server action** — wraps household creation + guest insertion in a transaction-friendly pattern. Skips rows with errors (the preview already showed them); creates everything else. Audited as `import` on the Guest entity with a metadata blob containing counts and new-household names.

New module [src/lib/csv.ts](src/lib/csv.ts) holds the parser, column-inference heuristics, and value coercion (boolean, side, RSVP, dietary). Shared client + server so the page's live preview parses the same way the commit action does.

Subsumes the "Say I Do sync" backlog item — Say I Do exports CSV, paste it here.

### 2026-04-27 · v0.7.1 — Bugfix: seating table positions survive navigation

User report: tables didn't always hold their dragged position when switching from canvas to list view, or navigating to other pages and back.

**Cause:** `updateTablePosition` deliberately skipped `revalidatePath('/seating')` to avoid a perceived drag-flicker concern. Result: the page's server-side `tables` data stayed at its original snapshot. When `SeatingCanvas` unmounted (Canvas → List toggle, or navigation away) its local position state was destroyed; on remount it re-seeded from the stale prop and tables snapped back to their pre-drag positions.

**Fix:** added `revalidatePath('/seating')` at the end of the action. The flicker concern was overblown — the canvas's local-position-priority `useEffect` already preserves the latest local state when the prop refreshes (see `prev[t.id] ?? { x: t.posX, y: t.posY }`), so revalidation is invisible during a session and *correct* after navigation.

### 2026-04-27 · v0.7.0 — First / last name fields + welcome prompt + Settings profile panel

The User model now has dedicated `firstName` and `lastName` columns alongside the legacy `name` (which is auto-synced as `${firstName} ${lastName}` whenever the named-fields are set, so existing display sites — sidebar, members matrix, avatar initials — keep working without touching their queries).

**First-time prompt.** Signing in for the first time used to leave you with a `name=null` row that displayed as your bare email. Now the `(app)` layout server-component runs a fresh DB lookup on every render and redirects to `/welcome` if neither `firstName` nor `name` is set. `/welcome` lives outside the `(app)` group, so the redirect doesn't loop. The form prefills from the legacy `name` field when present (split on first space) so seed-bootstrapped users don't have to retype.

**Settings → Your profile.** A new panel above the permission matrix lets the signed-in user rename themselves any time. Same `setMyName` action backs both the welcome flow and the inline edit — single source of truth for validation (1–80 chars, both required) and audit logging.

**Seed update.** `prisma/seed.ts` now sets `firstName` + `lastName` on the placeholder rows alongside the auto-derived `name`. Existing production rows get the new columns as NULL via the additive migration; their `name` field stays populated (so they still display correctly until they next sign in and hit the welcome flow).

**Migration:** `20260427160000_add_user_name_fields` adds the two NULLable columns. No data backfill needed — the legacy `name` column remains the canonical display source until firstName lands.

### 2026-04-27 · v0.6.0 — Phase D2: drag-and-drop seating canvas

The Seating page now has a real canvas. Tables render as SVG shapes (circle for round, rounded rectangle for rectangle/head) at their `posX`/`posY` coordinates, sized by capacity. Drag with mouse or touch — Pointer Events with `setPointerCapture` so a fast flick doesn't lose the grab. On drop, positions snap to a 20-unit grid (only if within 10 px tolerance, so deliberate off-grid placements survive). Position changes commit via a new `updateTablePosition` server action that's audited but doesn't `revalidatePath` (would interrupt the drag flow); the page revalidates on assign / create / delete as before.

Click-without-drag focuses a table → side panel slides in with the seat-assignment dropdowns (same UX as the existing list view, just relocated). Keyboard nudging on the focused table: arrow keys = 20 units, ⇧+arrow = 80. Tables are tabbable with aria-labels reading "Table X, N of M seated".

View toggle (Canvas | List) lives at the top right of the Seating page; the choice persists to `localStorage` so reloads keep your preference. The list view (existing `TableCard` grid) is unchanged and remains the better mobile / accessibility option.

`createTable` now positions new tables in a 3-column / 280×240 grid based on existing count, so they no longer stack at (0,0). Existing tables in production keep their stored positions.

Seating constraint rules (must-sit-together / must-not / prefer-group) are deferred to a future iteration — captured in the backlog.

### 2026-04-27 · v0.5.0 — Per-file visibility + file management UX

**New `FileVisibility` enum and `File.visibility` column** (additive migration `20260427150000_add_file_visibility`, default `EVERYONE`). Couple-only files are filtered out of the list query for non-couple users and rejected with a 404 by the download route — non-couple users can't even probe whether a private file exists. The page subtitle shows non-couple users a *"N hidden (couple-only)"* hint so they know files exist but they're not allowed to see them.

**Files page rebuilt** with proper management affordances:
- **Grouped by folder** — named folders sort alpha, "Unfiled" appears at the bottom
- **Hover-revealed actions per row** — toggle visibility (🔒/🔓), Edit (rename + move folder + visibility), Delete (×)
- **Inline edit form** — name, folder (datalist autocompleting against existing folders), visibility radio buttons (couple-only is gated to actual couple-tier users)
- **Multi-file upload** — drop or click to upload several at once; each goes through the same validate → write → DB-insert path with per-file error handling
- **Visibility selector on the upload zone** (couple-tier users only) so private docs land private from the start
- **Couple-only chip** — `🔒 Couple` badge on rows so it's obvious at a glance which files are private

Server actions consolidated: `uploadFile` (now multi), `updateFile(id, patch)` covering rename / move / visibility / any combination, `deleteFile`. All gated by `requireEdit("files")` and audited.

### 2026-04-27 · v0.4.1 — Remove-from-members in Settings

Small follow-up to v0.4.0. The Settings → permission matrix now has a hover-revealed `×` button on every row (except your own). Clicking it confirms, then atomically deletes the user's `Permission` rows + `User` row inside a transaction. `Account` and `Session` rows cascade automatically via the FKs in [schema.prisma](prisma/schema.prisma); `AuditLog` rows keep their history with `userId` set to NULL because the relation is optional. Self-removal is refused server-side as a defence-in-depth check on top of the UI's hidden button.

Replaces the `psql DELETE FROM "User"` workaround for cleaning up the placeholder seed users — admins can now do it from the UI.

### 2026-04-27 · v0.4.0 — Phase D1 file uploads + bootstrap admin + pretty magic-link email

**Three things in one bump.** First production minor since going live this morning.

**Phase D1 — file uploads.** The Files page now actually accepts files instead of letting users register references to files-elsewhere. Drag-and-drop or click-to-upload, 25 MB cap, MIME allowlist (PDF / common images / Office docs / txt+csv / zip), content-addressable storage on the existing `uploads:` named volume. Downloads stream through `/api/files/[id]` with a session + `canView("files")` gate; safe types (PDFs, images, text) render inline, others force `attachment`. Body-size budget raised at all three layers — Caddy, Next, app — to 26 MB. The Dockerfile now pre-creates `/app/uploads` with `node:node` ownership so the volume initialises writable for UID 1000.

**Bootstrap admin.** The first user to actually authenticate gets promoted to couple-tier automatically (predicate: `count(User where isCouple=true AND emailVerified IS NOT NULL) === 0`). After that, new sign-ins join as VIEWER and the existing admin promotes them via the Settings matrix. No env var, no SQL surgery. Replaces an earlier (rejected) `COUPLE_EMAILS` design — see the feedback memory if you're tempted to introduce another env-var enumeration of users.

**Pretty magic-link email.** Replaced the one-paragraph placeholder with a proper inline-CSS HTML email — wedding-themed (moss-green CTA, Fraunces-fallback serif heading, soft canvas background), 600 px table layout that stacks on mobile, plain-text fallback for clients that strip HTML. Subject unchanged.

Phase D split: D1 (uploads) ✅ shipped here, D2 (drag-drop seating canvas) is the next chunk.

### 2026-04-27 · v0.3.2 — 🚀 Live on Unraid + post-deploy back-ports

The app is **live in production at https://wedding.spencer-net.com**. Jamie signed in via Resend-delivered magic link; full 4-service stack stable on the Unraid box behind a Cloudflare Tunnel.

Issues caught during the live deploy that have now been back-ported to the repo:

- **`db` service: removed `user: "999:999"`.** `postgres:16-alpine`'s built-in `postgres` user is UID 70. Forcing 999 made `initdb` fail with "Operation not permitted" on the data dir.
- **`db` healthcheck: `start_period: 10s` → `60s`, `retries: 5` → `10`.** `initdb`'s shutdown checkpoint takes ~22s on a slow Unraid array (sync=21s observed). The old timing made the orchestrator give up before postgres was actually ready.
- **`public/.gitkeep` committed** so the Dockerfile `COPY /app/public ./public` succeeds even though the project has no static assets yet.
- **`Dockerfile`: `--chown=nextjs:nodejs` → `--chown=node:node`** to match the `USER node` directive (the `nextjs` user was removed when we adopted alpine's prebuilt `node` user but the chown args were left dangling).
- **`CLAUDE.md` added at repo root** — context file for future Claude Code sessions, covering the Unraid topology, do-not-do list, branching, and where-to-look-when-things-break table. Generated from the deploy-session debrief.

Live deploy decisions (no repo change required, captured here for the record):

- **Cloudflare Tunnel** + Resend for SMTP (apex sender, DKIM via Cloudflare integration)
- **GHCR private package**, Unraid host logged in with classic PAT (`read:packages`)
- **Compose Manager Plus** stack at `/boot/config/plugins/compose.manager/projects/wedding-hub/`
- **Caddy static IP `192.168.50.25` on `br0`**, tunnel routes `wedding.spencer-net.com` → that IP:80
- **Allowed users:** just Jamie for now; rest added when their addresses are confirmed

### 2026-04-27 · Deploy-config rewired for Cloudflare Tunnel + GHCR
On `dev`, no version bump (deployment-environment changes only — app code unchanged from v0.3.1).
- Caddy now runs in Tunnel mode: `auto_https off`, listens on `:80` only, joins `br0` macvlan with static IP `192.168.50.25`. Real client IP read from `CF-Connecting-IP`. `caddy/Caddyfile` rewritten; the prior auto-TLS variant is recoverable from git history.
- `web` service pulls `ghcr.io/spacetoast1738/wedding-hub:dev` with `pull_policy: always` instead of building locally on Unraid. CI workflow at [.github/workflows/build.yml](.github/workflows/build.yml) builds and pushes on every push to `main`/`dev`, tagging by branch + short SHA + `:latest` (default branch only).
- All bind-mount paths absolute under `/mnt/user/appdata/wedding-hub/` so Compose Manager Plus (which stores stack YAML on `/boot` USB) doesn't try to resolve relative `./` against the USB.
- `TLS_EMAIL` removed from `.env.production.example` (no Let's Encrypt). `EMAIL_FROM` default → `noreply@spencer-net.com`.
- README deploy section rewritten for the Tunnel + GHCR flow: `docker compose pull` instead of `--build`, prerequisite checklist (cloudflared stack, br0, free LAN IP, SMTP), updated routine ops including image-rollback recipe.
- Risks list updated: dropped DNS+port-forward concern, added cloudflared-stack-must-exist and macvlan-IP-collision concerns.

### 2026-04-27 · Repo published to GitHub
Not a code release — organisational milestone. No version bump.
- The session's work was reconstructed into four phase-aligned commits and pushed to [SpaceToast1738/wedding-hub](https://github.com/SpaceToast1738/wedding-hub):
  - `4fdc332` `feat: Phase A — bootable shell` (tag **v0.1.0**)
  - `0fe9c4f` `feat: Phase B — domain pages` (tag **v0.2.0**)
  - `c275223` `feat: Phase C — production deploy stack` (tag **v0.3.0**)
  - `6c2999d` `feat: v0.3.1 — deploy-readiness fixes` (tag **v0.3.1**)
- `claude/main` holds the four tagged releases. New `dev` branch tracks work in progress; one chore commit on it (`e7c4f03`) tracks `package-lock.json` and adds `.claude/` to `.gitignore`.
- Working tree is now at `C:\Users\Admin\Code\wedding-hub` under git. The old TOWER mirror at `\\TOWER\Jamie Spencer\Claude\wedding-hub` is no longer used — flagged for manual removal (this Claude session's harness was holding it open and the safety rail blocked the recursive delete).
- Memory updated: `ROADMAP.md` is the canonical living plan; the standing rule to update it every iteration carries forward.

### 2026-04-27 · v0.3.1 — Deploy-readiness fixes
- **Initial Prisma migration committed** at `prisma/migrations/20260427120000_init/` so first-boot `migrate deploy` actually creates the schema (the prior state would have left a fresh DB empty)
- **Log rotation** — `x-logging` anchor referenced by all 4 compose services: `json-file` driver, `max-size: 10m`, `max-file: 3`. 30 MB ceiling per service.
- **Version pill in the sidebar** — `v0.3.1` shown below the avatar menu, sourced from `package.json` via `src/lib/version.ts` (build-time inline, no runtime FS read)
- **Health endpoint** now returns `{ ok, version, db }` so `curl /api/health` confirms what's deployed
- ROADMAP risks updated: DNS / Cloudflare Tunnel and bind-mount perms are now called out as pre-deploy gates
- Verified: `docker compose config` ✓, migration SQL validates clean

### 2026-04-27 · v0.3.0 — Phase C — Production deploy
- Multi-stage Dockerfile: deps → builder (next build + prisma generate + seed transpile) → runner (alpine + tini + non-root + healthcheck)
- entrypoint.sh runs `prisma migrate deploy` before booting the app
- docker-compose.yml with `caddy`, `web`, `db`, `backup` on `edge` + `internal` networks; no host ports for db/web; read-only FS, cap_drop ALL, no-new-privileges
- Caddyfile with auto-TLS, HSTS / CSP / X-Frame-Options / Permissions-Policy / COOP / CORP, dotfile + scan probe blocks, 4 MB body cap, commented rate-limit stub
- `/robots.txt` route + middleware whitelist
- Backup service: pg_dump daily, 7d / 4w / 12m retention to host bind-mount
- `.env.production.example`, `.dockerignore` tightened
- README has deploy walkthrough, ops commands, hardening notes, Cloudflare Tunnel alt
- ROADMAP.md created (this document)
- Verified: `docker compose config` ✓, `tsc --noEmit` ✓, `next lint` ✓ (no warnings), `next build` ✓ (21 routes, +`/robots.txt`)
- **Not yet verified:** end-to-end `docker build` (Docker Desktop daemon was off — first build on the Unraid host is the real smoke test)

### 2026-04-27 · v0.2.0 — Phase B — Domain pages
- 12 sections fully ported with server actions, Zod validation, `requireEdit`, `audit()`, `revalidatePath`
- Shared helpers in `src/lib/actions.ts` and `src/lib/format.ts`
- Patterns: inline-edit rows with hover-revealed Edit/Delete, `<form action={serverAction}>` + `useTransition` client wrappers
- Deferred: file upload backend, seating canvas, CSV import, photography shot list, day-of mode, quick-capture, Spotify
- Verified: `tsc --noEmit` ✓, `next lint` ✓, `next build` ✓ (20 routes; settings is the heaviest at 19 kB / 119 kB first-load)

### 2026-04-27 · v0.1.0 — Phase A — Bootable shell
- App Router scaffolding, Tailwind v4 with tokens from `prototype/tokens.css`, dark mode with FOUC script
- Auth.js v5 magic-link with email allow-list, JWT session, custom sign-in / verify / error pages
- Middleware redirects unauthenticated users + gates couple-only routes
- AppShell (RSC) + Sidebar + MobileTabBar + AvatarMenu, with permission-filtered nav
- 7 UI primitives + ComingSoon stub component
- Today page wired to real Prisma queries
- 12 stub pages so all sidebar links work
- `/api/health` endpoint, README quickstart, `db:reset` script
- Seed script: 5 named users, permissions, sample tasks/events/household/book sections
- Verified: `npm install` (361 packages) ✓, `tsc --noEmit` ✓, `next lint` ✓, `next build` ✓ (20 routes, middleware 82.9 kB)
