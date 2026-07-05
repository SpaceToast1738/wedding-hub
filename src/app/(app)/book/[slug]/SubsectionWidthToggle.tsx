// v1.95.0: per-card width toggle on the section page. Sits in the
// same action row as SubsectionReorderControls, flips the card
// between single-column (default) and 2-column span on the /book/[slug]
// grid. Couple-permitted edit gate — layout is cosmetic so any
// book-editor can adjust.
//
// Design-pass fix: this bare-glyph ⇆ button (a ~20px hit area,
// explained only by a hover tooltip) sat next to SubsectionReorder
// Controls' own bare-glyph ▲/▼ pair — three cryptic icon-only
// controls in one row. The width toggle folded into that component's
// new consolidated "Layout" menu (SubsectionCardMenu) so there's one
// clearly-labeled, properly-sized trigger instead of three. Re-
// exported here under the old name so nothing else importing this
// file needs to change.
export { SubsectionCardMenu as SubsectionWidthToggle } from "./SubsectionReorderControls";
