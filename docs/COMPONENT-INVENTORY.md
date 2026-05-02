# Component inventory

**Status:** v1.64.0 (DP-2). Last updated 2 May 2026.

This document is the design pass's primary input. Every reusable UI primitive in the codebase is listed here with a one-line purpose, its API surface, and where it's used. The pre-2.0 design pass (Phase B in the ROADMAP) reskins the components listed below; pages inherit the new look automatically because they all consume these primitives.

The naming convention: app-specific components live in `src/components/ui/` and `src/components/shell/`. Page-local components (e.g. `TaskList`, `BookBuildCard`) live next to their pages and are NOT in this list — they're consumers, not primitives.

---

## Layout / shell

| Component | File | Purpose |
|---|---|---|
| `<AppShell>` | `src/components/shell/AppShell.tsx` | Server-component shell. Wraps every authenticated page. Mounts the Sidebar, MobileTabBar, QuickCapture, Toaster, ConfirmProvider. |
| `<Sidebar>` | `src/components/shell/Sidebar.tsx` | Desktop nav. Logo + section list + avatar menu. Counts (open tasks, pending RSVPs, due payments) inline. |
| `<MobileTabBar>` | `src/components/shell/MobileTabBar.tsx` | < 640px nav. 5 fixed bottom tabs + a "More" sheet. |
| `<SidebarItem>` | `src/components/shell/SidebarItem.tsx` | One row in the sidebar. Active-state background + count chip. |
| `<AvatarMenu>` | `src/components/shell/AvatarMenu.tsx` | User avatar dropdown — name, profile link, dark-mode toggle, sign out. |
| `<QuickCapture>` | `src/components/shell/QuickCapture.tsx` | `C`-keyboard-shortcut quick-capture modal. Type-to-create a task / event / question. v1.27.x. |
| `<DarkModeScript>` | `src/components/shell/DarkModeScript.tsx` | Inline script in `<head>` to apply dark-mode class before paint (avoids flash). |
| `<ServiceWorkerCleanup>` | `src/components/shell/ServiceWorkerCleanup.tsx` | One-shot client effect to unregister stale service workers. Defensive — no SW currently shipped. |

## Forms / inputs

| Component | File | API | Used by |
|---|---|---|---|
| `<Button>` | `src/components/ui/Button.tsx` | `variant: 'primary' \| 'ghost' \| 'danger'` × `size: 'sm' \| 'md'`. | Everywhere. |
| `<Input>` | `src/components/ui/Input.tsx` | Standard HTML `<input>` with our text/border/focus styling. | Everywhere. |
| `<Tag>` | `src/components/ui/Tag.tsx` | Inline pill — non-interactive label. | Tasks, suppliers, guests. |
| `<StatusPill>` | `src/components/ui/StatusPill.tsx` | Coloured pill keyed on a status enum: `'YES' \| 'NO' \| 'PENDING' \| 'OVERDUE' \| 'PAID' \| 'BOOKED' \| 'LEAD' \| 'DECLINED' \| 'SCHEDULED'`. | Suppliers, payments, guests. |

## Feedback / modals

| Component | File | API | Used by |
|---|---|---|---|
| `<AddNewModal>` | `src/components/ui/AddNewModal.tsx` | `open`, `onClose`, `title`, `width: 'sm' \| 'md' \| 'lg'`. Centred backdrop modal. | All `+ New X` toggles (v1.56.0). |
| `<ConfirmDialog>` / `useConfirm()` | `src/components/ui/ConfirmDialog.tsx` | Hook: `confirm(opts) => Promise<boolean>`. `<ConfirmProvider>` mounts at AppShell level. Body accepts `ReactNode`. Tones: `'default' \| 'danger'`. (v1.62.0 sweep replaced 40 native `confirm()` calls.) | Every destructive action across 29 files. |
| `<Toaster>` / `notify()` | `src/components/ui/Toaster.tsx` + `src/lib/notify.ts` | `notify(level, message)`. Levels: `'success' \| 'info' \| 'error'`. Dismisses on click + after timeout. | Server-action result-shape error reporting everywhere. |
| `<Toast>` | `src/components/ui/Toast.tsx` | Single toast row rendered by Toaster. Not called directly. | Toaster only. |
| `<ImageGallery>` | `src/components/ui/ImageGallery.tsx` | `fileIds`, `files`, `canEdit`, `onUpload?`, `onAttach`, `onDetach`. Thumbnails + click-to-zoom lightbox + 3 add paths (upload / attach existing / detach). (v1.63.0.) | BUILD, OUTFIT, SETUP, STAY cards in the Wedding Book. |

## Navigation / page chrome

| Component | File | API | Used by |
|---|---|---|---|
| `<PageHeader>` | `src/components/ui/PageHeader.tsx` | `title`, `subtitle`, `actions`. Top of every page. | All 12 pages. |
| `<PageLinkedTasksStrip>` | `src/components/ui/PageLinkedTasksStrip.tsx` | Shows tasks tagged with the page's nav-tag below the header. (v1.52.0.) | /songs, /seating/ceremony, /guests. |
| `<PrintButton>` | `src/components/ui/PrintButton.tsx` | Calls `window.print()`. | /budget, /payments, /guests/catering, BookMenuCard, BookBarCard, BookSetupCard, BookLodgingCard. |
| `<ComingSoon>` | `src/components/ui/ComingSoon.tsx` | Placeholder for unbuilt pages. | None currently — kept for future use. |

## Identity / decoration

| Component | File | API | Used by |
|---|---|---|---|
| `<Avatar>` | `src/components/ui/Avatar.tsx` | `name`, `size`. Initials in a coloured circle. | Sidebar, members list, task assignee. |
| `<EventMotifIcon>` | `src/components/ui/EventMotifIcon.tsx` | `motif: 'ring' \| 'candle' \| ...`. Heuristic classifier `classifyEventMotif(title)`. | Schedule events. |
| `IllusCountdown` etc. | `src/components/ui/Illustrations.tsx` | SVGs at fixed sizes. | Hub cards, empty states. |
| `<EmptyState>` | `src/components/ui/Illustrations.tsx` | `illustration`, `title`, `body?`, `action?`. Top-level page empty. (See empty-state convention in that file's header comment.) | /tasks, /guests, /schedule, /seating, /payments. |

## Domain components (couple-only / cross-page)

| Component | File | Purpose |
|---|---|---|
| `<CustomFieldsBlock>` | `src/components/ui/CustomFieldsBlock.tsx` | Renders the user-defined custom-field editor for any entity (guest / supplier / task). Reads `CustomFieldDef[]` + values. |
| `<GuestGroupsControl>` | `src/components/ui/GuestGroupsControl.tsx` | Reusable chips + popover for guest-group memberships. (v1.49.0.) |
| `<RichTextEditor>` / `<RichTextRead>` | `src/components/ui/RichTextEditor.tsx` | Tiptap-based 10-mark WYSIWYG. Sanitises on read AND write. (v1.37.0.) |
| `<TopicPicker>` | `src/app/(app)/tasks/TopicPicker.tsx` | Multi-select for topics: book sections + book subsections (cards) + nav tags + guest groups. Page-local but used across `/tasks`, `/questions`, drawer. |

## Utilities (not components)

| Module | File | Purpose |
|---|---|---|
| `notify(level, msg)` | `src/lib/notify.ts` | Toast emit. Wired to `<Toaster>`. |
| `formatMoneyDecimal`, `formatDate`, `isoForInput`, `splitDateTime`, `formatRelativeDue` | `src/lib/format.ts` | Display helpers. |
| `sanitizeBookHtml` | `src/lib/sanitize-book-html.ts` | Tiptap output → safe HTML allowlist. |
| `validateUpload`, `generateStoredName` | `src/lib/uploads.ts` | File-upload helpers (MIME allowlist, 25 MB cap, stored-name generator). |

## What the design pass should know

1. **Token system.** Every visual decision threads through `--color-*` CSS variables in `src/app/globals.css`. Light + dark mode are token-swapped at the same CSS variables. Tailwind v4 reads them as `bg-canvas`, `text-ink-primary`, `border-border-soft`, etc. The full token set is defined at the top of `globals.css` (lines 1-78).
2. **Typography.** Two families: `--font-ui` (Inter, default) and `--font-display` (Fraunces, used on page headings + empty-state titles + a few accents).
3. **Sizing scale.** Mostly Tailwind defaults. We deviate downward for chips and metadata: `text-[10px]` for uppercase tracking-wider section labels, `text-[11px]` for chip-row metadata, `text-xs` for body-on-cards.
4. **Spacing.** Page max-widths cluster around 800-1100px. Cards use `p-4` or `p-5`. Section headers are `px-4 py-3 border-b`.
5. **Print stylesheets.** A handful of pages (/budget, /payments, /guests/catering, BookMenuCard print variant) have `@media print` rules in `globals.css`. Worth a pass during the design refresh.
6. **What the design pass should NOT touch.** The schema; the server-action API contracts; the `audit()` metadata shape; the permission gate logic. Everything visual is fair game.

## Pages by primitive use

A reverse-index for the design pass — "if I redesign Button, I touch X pages":

- **Button** — every page.
- **Input** — every page with a form.
- **AddNewModal** — `/tasks`, `/schedule`, `/guests`, `/suppliers`, `/songs`, `/seating`, `/payments`, `/book` (sections + subsections).
- **ConfirmDialog** — every destructive action (29 files).
- **Toaster** — every server-action site (40+ usages).
- **PageHeader** — 12 pages.
- **EmptyState** — 5 pages.
- **ImageGallery** — 4 Wedding Book card kinds.
- **StatusPill** — `/suppliers`, `/payments`, `/guests`, `/today`.

---

End of inventory.
