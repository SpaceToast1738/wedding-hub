// v2.14.0: one Wedding Book card → a small neutral document, then that
// document → WhatsApp text / plain text / (in DocView) print HTML.
//
// Why an intermediate `Doc` rather than three per-kind serialisers: the
// Book has 13 card kinds. Writing "card → WhatsApp" and "card → print"
// separately for each would be 26 renderers that drift. Instead every
// kind builds ONE Doc (title + blocks: headings, paragraphs, lists,
// label/value rows, tables) and the formats are three tiny renderers
// over that. Adding a kind is one builder; adding a format is one
// renderer.
//
// Enhancement cmsz2h17: "Share/export a single Book card" — the real
// case was a ceremony brief that had to be hand-retyped into WhatsApp
// asterisks for the best man + maid of honour, and then drifted from
// the card. Money never appears here (parity with read_book_card).
//
// Everything in this module is pure. The DB shapes come from
// src/lib/core/book-export.ts (loadCardExport), which mirrors the
// selects read_book_card uses.

import { decodeHtmlEntities } from "@/lib/html-text";

// ─── Document model ─────────────────────────────────────────────────────

export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Absolute URL; rendered as "text (url)" in text formats. */
  href?: string;
};

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "quote"; spans: Span[] }
  | { kind: "list"; ordered: boolean; items: Span[][] }
  /** Label → value rows ("Property: The Cedar Room"). */
  | { kind: "kv"; rows: Array<{ label: string; value: string }> }
  | { kind: "table"; headers: string[]; rows: string[][] };

export type Doc = {
  title: string;
  /** e.g. the section name, or a one-line descriptor. */
  subtitle?: string;
  blocks: Block[];
};

// ─── Card DTOs (what loadCardExport returns) ────────────────────────────

type Base = {
  id: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  sectionSlug: string;
  sectionTitle: string;
};

export type CardExport = Base &
  (
    | { kind: "TEXT"; bodyHtml: string | null; body: string | null }
    | {
        kind: "FIELD";
        fieldDefs: Array<{ id: string; label: string; type: string; group: string | null }>;
        values: Record<string, unknown>;
      }
    | {
        kind: "RECIPE";
        ingredients: string[];
        steps: Array<{ instruction: string; durationMinutes: number | null; dayBefore: boolean }>;
        notes: string | null;
        servingsBase: number | null;
      }
    | {
        kind: "SHOT_LIST";
        shots: Array<{
          title: string;
          category: string | null;
          estimatedMinutes: number | null;
          withWhom: string | null;
          location: string | null;
          notes: string | null;
          captured: boolean;
        }>;
      }
    | {
        kind: "OUTFIT";
        personName: string | null;
        role: string | null;
        notes: string | null;
        items: Array<{
          itemLabel: string;
          description: string | null;
          supplier: string | null;
          website: string | null;
          status: string | null;
          notes: string | null;
        }>;
      }
    | {
        kind: "BUILD";
        quantityNeeded: number | null;
        targetDate: string | null;
        status: string | null;
        prototypeDone: boolean;
        prototypeNotes: string | null;
        estimatedMinutesPerUnit: number | null;
        notes: string | null;
        materials: Array<{
          name: string;
          quantity: number | null;
          unit: string | null;
          supplier: string | null;
          website: string | null;
          ordered: boolean;
          arrived: boolean;
          notes: string | null;
        }>;
      }
    | {
        kind: "MENU";
        serviceType: string | null;
        serviceTime: string | null;
        notes: string | null;
        courses: Array<{
          courseLabel: string;
          options: Array<{
            label: string;
            description: string | null;
            dietary: string[];
            isVegetarianMain: boolean;
            isKidsMeal: boolean;
          }>;
        }>;
      }
    | {
        kind: "BAR";
        barType: string | null;
        toastDrink: string | null;
        notes: string | null;
        items: Array<{
          category: string | null;
          name: string;
          quantityPlanned: number | null;
          unit: string | null;
          supplier: string | null;
          website: string | null;
          timing: string | null;
          notes: string | null;
        }>;
      }
    | {
        kind: "SETUP";
        space: string | null;
        setupStartsAt: string | null;
        setupOwner: string | null;
        notes: string | null;
        items: Array<{
          name: string;
          quantity: number | null;
          location: string | null;
          source: string | null;
          website: string | null;
          packed: boolean;
          placed: boolean;
          packDownPlan: string | null;
          notes: string | null;
        }>;
      }
    | {
        kind: "RUNSHEET";
        notes: string | null;
        rows: Array<{
          time: string | null;
          event: string;
          owner: string | null;
          notes: string | null;
          done: boolean;
        }>;
      }
    | {
        kind: "STAY";
        propertyName: string | null;
        propertyContact: string | null;
        bookingReference: string | null;
        checkInDate: string | null;
        checkOutDate: string | null;
        occupants: string[];
        notes: string | null;
      }
    | {
        kind: "LODGING_GUIDE";
        notes: string | null;
        items: Array<{
          name: string;
          distanceFromVenue: string | null;
          priceRangeLabel: string | null;
          phone: string | null;
          website: string | null;
          groupRateCode: string | null;
          notes: string | null;
        }>;
      }
    | {
        kind: "DRESS_CODE";
        dressCode: string | null;
        summary: string | null;
        bodyHtml: string | null;
        colourGuidance: string | null;
        footwear: string | null;
        weather: string | null;
        accessories: string | null;
      }
    | {
        kind: "WEDDING_PARTY";
        groupLabel: string | null;
        notes: string | null;
        members: Array<{ id: string; name: string; role: string | null }>;
        items: Array<{ id: string; label: string; notes: string | null }>;
        cells: Array<{ memberId: string; itemId: string; status: string; notes: string | null }>;
      }
  );

// ─── HTML (allow-listed book HTML) → blocks ─────────────────────────────

const INLINE_TOKEN = /<(\/?)(strong|b|em|i|u|a)\b([^>]*)>|<br\s*\/?>|([^<]+)|<[^>]+>/gi;

function collapseWs(s: string): string {
  return s.replace(/[ \t\r\n]+/g, " ");
}

/** Inline HTML (the inside of a <p>, <li>, <h3>…) → spans. Tolerates
 *  unknown tags by dropping them; nested marks stack. */
export function inlineHtmlToSpans(html: string): Span[] {
  const spans: Span[] = [];
  let bold = 0;
  let italic = 0;
  const hrefs: string[] = [];
  const push = (text: string) => {
    if (!text) return;
    const span: Span = { text };
    if (bold > 0) span.bold = true;
    if (italic > 0) span.italic = true;
    const href = hrefs[hrefs.length - 1];
    if (href) span.href = href;
    spans.push(span);
  };
  for (const m of html.matchAll(INLINE_TOKEN)) {
    const [whole, close, tag, attrs, text] = m;
    if (text !== undefined) {
      push(decodeHtmlEntities(collapseWs(text)));
      continue;
    }
    if (/^<br/i.test(whole)) {
      push("\n");
      continue;
    }
    if (!tag) continue; // unknown tag — dropped
    const t = tag.toLowerCase();
    const opening = close !== "/";
    if (t === "strong" || t === "b") bold += opening ? 1 : -1;
    else if (t === "em" || t === "i") italic += opening ? 1 : -1;
    else if (t === "a") {
      if (opening) {
        const href = /href\s*=\s*"([^"]*)"/i.exec(attrs ?? "")?.[1] ?? "";
        hrefs.push(decodeHtmlEntities(href));
      } else hrefs.pop();
    }
    // <u> is dropped as a mark: WhatsApp has no underline and print
    // underline reads as a link. The text stays.
    if (bold < 0) bold = 0;
    if (italic < 0) italic = 0;
  }
  // Trim leading/trailing whitespace of the whole run without eating
  // the spaces between spans.
  if (spans.length) {
    spans[0]!.text = spans[0]!.text.replace(/^\s+/, "");
    const last = spans[spans.length - 1]!;
    last.text = last.text.replace(/\s+$/, "");
  }
  return spans.filter((s) => s.text.length > 0);
}

const BLOCK_RE = /<(h2|h3|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const LI_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

function spansText(spans: Span[]): string {
  return spans.map((s) => s.text).join("");
}

/** Allow-listed book HTML (bodyHtml) → blocks. A string with no block
 *  tags at all (a legacy plain `body`) becomes paragraphs split on
 *  blank lines. */
export function htmlToBlocks(html: string | null | undefined): Block[] {
  if (!html || !html.trim()) return [];
  const blocks: Block[] = [];
  let sawBlock = false;
  for (const m of html.matchAll(BLOCK_RE)) {
    sawBlock = true;
    const tag = m[1]!.toLowerCase();
    const inner = m[2]!;
    if (tag === "h2" || tag === "h3") {
      const text = spansText(inlineHtmlToSpans(inner)).trim();
      if (text) blocks.push({ kind: "heading", text });
    } else if (tag === "ul" || tag === "ol") {
      const items: Span[][] = [];
      for (const li of inner.matchAll(LI_RE)) {
        const spans = inlineHtmlToSpans(li[1]!);
        if (spans.length) items.push(spans);
      }
      if (items.length) blocks.push({ kind: "list", ordered: tag === "ol", items });
    } else if (tag === "blockquote") {
      // Inner is usually <p>…</p>; flatten to one quote.
      const innerBlocks = htmlToBlocks(inner);
      const spans = innerBlocks.flatMap((b, i) =>
        b.kind === "paragraph" || b.kind === "quote"
          ? i > 0
            ? [{ text: "\n" }, ...b.spans]
            : b.spans
          : b.kind === "heading"
            ? [{ text: b.text, bold: true }]
            : [],
      );
      if (spans.length) blocks.push({ kind: "quote", spans });
    } else {
      const spans = inlineHtmlToSpans(inner);
      if (spans.length) blocks.push({ kind: "paragraph", spans });
    }
  }
  if (!sawBlock) {
    for (const para of html.split(/\n{2,}/)) {
      const spans = inlineHtmlToSpans(para.replace(/\n/g, "<br>"));
      if (spans.length) blocks.push({ kind: "paragraph", spans });
    }
  }
  return blocks;
}

// ─── Card → Doc ─────────────────────────────────────────────────────────

const plain = (text: string): Span[] => [{ text }];

function para(text: string | null | undefined): Block[] {
  const t = text?.trim();
  return t ? [{ kind: "paragraph", spans: plain(t) }] : [];
}

function notesBlocks(notes: string | null | undefined): Block[] {
  const t = notes?.trim();
  if (!t) return [];
  return [{ kind: "heading", text: "Notes" }, ...htmlToBlocks(t.includes("<") ? t : t.replace(/</g, "&lt;"))];
}

function kv(rows: Array<[string, string | number | null | undefined]>): Block[] {
  const kept = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([label, v]) => ({ label, value: String(v).trim() }));
  return kept.length ? [{ kind: "kv", rows: kept }] : [];
}

function joinBits(bits: Array<string | null | undefined | false>, sep = " · "): string {
  return bits.filter((b): b is string => !!b && b.trim() !== "").join(sep);
}

function listOf(items: Span[][], ordered = false): Block[] {
  return items.length ? [{ kind: "list", ordered, items }] : [];
}

function fmtFieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function itemLine(main: string, detail: string, tail?: string): Span[] {
  const spans: Span[] = [{ text: main, bold: true }];
  if (detail) spans.push({ text: ` — ${detail}` });
  if (tail) spans.push({ text: ` ${tail}` });
  return spans;
}

export function cardToDoc(card: CardExport): Doc {
  const subtitle = card.sectionTitle;
  const blocks: Block[] = [];

  switch (card.kind) {
    case "TEXT": {
      blocks.push(...htmlToBlocks(card.bodyHtml ?? card.body));
      break;
    }
    case "FIELD": {
      const groups = new Map<string, Array<[string, string]>>();
      for (const d of card.fieldDefs) {
        const value = fmtFieldValue(card.values[d.id]);
        if (!value) continue;
        const g = d.group ?? "";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push([d.label, value]);
      }
      for (const [g, rows] of groups) {
        if (g) blocks.push({ kind: "heading", text: g });
        blocks.push(...kv(rows));
      }
      break;
    }
    case "RECIPE": {
      blocks.push(...kv([["Serves", card.servingsBase]]));
      if (card.ingredients.length) {
        blocks.push({ kind: "heading", text: "Ingredients" });
        blocks.push(...listOf(card.ingredients.map((i) => plain(i))));
      }
      if (card.steps.length) {
        blocks.push({ kind: "heading", text: "Method" });
        blocks.push(
          ...listOf(
            card.steps.map((s) => {
              const tail = joinBits([
                s.durationMinutes != null ? `${s.durationMinutes} min` : null,
                s.dayBefore ? "day before" : null,
              ]);
              return tail ? [{ text: s.instruction }, { text: ` (${tail})`, italic: true }] : plain(s.instruction);
            }),
            true,
          ),
        );
      }
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "SHOT_LIST": {
      blocks.push(
        ...listOf(
          card.shots.map((s) => {
            const detail = joinBits([
              s.category,
              s.withWhom ? `with ${s.withWhom}` : null,
              s.location,
              s.estimatedMinutes != null ? `${s.estimatedMinutes} min` : null,
              s.notes,
            ]);
            return itemLine(`${s.captured ? "☑" : "☐"} ${s.title}`, detail);
          }),
        ),
      );
      break;
    }
    case "OUTFIT": {
      blocks.push(...kv([["Who", joinBits([card.personName, card.role], " — ")]]));
      blocks.push(
        ...listOf(
          card.items.map((i) =>
            itemLine(
              i.itemLabel,
              joinBits([i.description, i.supplier, i.website, i.notes]),
              i.status ? `(${i.status})` : undefined,
            ),
          ),
        ),
      );
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "BUILD": {
      blocks.push(
        ...kv([
          ["Quantity needed", card.quantityNeeded],
          ["Target date", card.targetDate],
          ["Status", card.status],
          ["Prototype", card.prototypeDone ? "done" : null],
          ["Time per unit", card.estimatedMinutesPerUnit != null ? `${card.estimatedMinutesPerUnit} min` : null],
        ]),
      );
      blocks.push(...para(card.prototypeNotes));
      if (card.materials.length) {
        blocks.push({ kind: "heading", text: "Materials" });
        blocks.push(
          ...listOf(
            card.materials.map((m) =>
              itemLine(
                joinBits([m.name, m.quantity != null ? `×${m.quantity}${m.unit ? ` ${m.unit}` : ""}` : null], " "),
                joinBits([m.supplier, m.website, m.notes]),
                m.arrived ? "(arrived)" : m.ordered ? "(ordered)" : undefined,
              ),
            ),
          ),
        );
      }
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "MENU": {
      blocks.push(...kv([["Service", joinBits([card.serviceType, card.serviceTime])]]));
      for (const c of card.courses) {
        blocks.push({ kind: "heading", text: c.courseLabel });
        blocks.push(
          ...listOf(
            c.options.map((o) => {
              const flags = joinBits([
                o.dietary.length ? o.dietary.join(", ") : null,
                o.isVegetarianMain ? "vegetarian main" : null,
                o.isKidsMeal ? "kids" : null,
              ]);
              return itemLine(o.label, o.description ?? "", flags ? `(${flags})` : undefined);
            }),
          ),
        );
      }
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "BAR": {
      blocks.push(...kv([["Bar", card.barType], ["Toast", card.toastDrink]]));
      const byCat = new Map<string, typeof card.items>();
      for (const i of card.items) {
        const c = i.category ?? "Drinks";
        if (!byCat.has(c)) byCat.set(c, []);
        byCat.get(c)!.push(i);
      }
      for (const [c, items] of byCat) {
        blocks.push({ kind: "heading", text: c });
        blocks.push(
          ...listOf(
            items.map((i) =>
              itemLine(
                joinBits([i.name, i.quantityPlanned != null ? `×${i.quantityPlanned}${i.unit ? ` ${i.unit}` : ""}` : null], " "),
                joinBits([i.supplier, i.timing, i.website, i.notes]),
              ),
            ),
          ),
        );
      }
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "SETUP": {
      blocks.push(...kv([["Space", card.space], ["Set-up starts", card.setupStartsAt], ["Owner", card.setupOwner]]));
      blocks.push(
        ...listOf(
          card.items.map((i) =>
            itemLine(
              joinBits([i.name, i.quantity != null ? `×${i.quantity}` : null], " "),
              joinBits([i.location, i.source, i.website, i.packDownPlan ? `pack-down: ${i.packDownPlan}` : null, i.notes]),
              i.placed ? "(placed)" : i.packed ? "(packed)" : undefined,
            ),
          ),
        ),
      );
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "RUNSHEET": {
      // Intro notes come first — they're the "read this before the
      // schedule" text. Rows: bold time, event, owner in brackets,
      // notes after a dot; a done row keeps its tick so a forwarded
      // copy mid-day shows progress.
      blocks.push(...para(card.notes));
      blocks.push(
        ...listOf(
          card.rows.map((r) => {
            const spans: Span[] = [];
            if (r.done) spans.push({ text: "☑ " });
            if (r.time) spans.push({ text: r.time, bold: true }, { text: " — " });
            spans.push({ text: r.event });
            if (r.owner) spans.push({ text: ` (${r.owner})` });
            if (r.notes) spans.push({ text: ` · ${r.notes}` });
            return spans;
          }),
        ),
      );
      break;
    }
    case "STAY": {
      blocks.push(
        ...kv([
          ["Property", card.propertyName],
          ["Contact", card.propertyContact],
          ["Booking ref", card.bookingReference],
          ["Check-in", card.checkInDate],
          ["Check-out", card.checkOutDate],
          ["Staying", card.occupants.length ? card.occupants.join(", ") : null],
        ]),
      );
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "LODGING_GUIDE": {
      blocks.push(
        ...listOf(
          card.items.map((i) =>
            itemLine(
              i.name,
              joinBits([
                i.distanceFromVenue,
                i.priceRangeLabel,
                i.phone,
                i.website,
                i.groupRateCode ? `group rate: ${i.groupRateCode}` : null,
                i.notes,
              ]),
            ),
          ),
        ),
      );
      blocks.push(...notesBlocks(card.notes));
      break;
    }
    case "DRESS_CODE": {
      blocks.push(
        ...kv([
          ["Dress code", card.dressCode],
          ["Colours", card.colourGuidance],
          ["Footwear", card.footwear],
          ["Weather", card.weather],
          ["Accessories", card.accessories],
        ]),
      );
      blocks.push(...para(card.summary));
      blocks.push(...htmlToBlocks(card.bodyHtml));
      break;
    }
    case "WEDDING_PARTY": {
      const itemLabel = new Map(card.items.map((i) => [i.id, i.label]));
      const cellsByMember = new Map<string, typeof card.cells>();
      for (const c of card.cells) {
        if (!cellsByMember.has(c.memberId)) cellsByMember.set(c.memberId, []);
        cellsByMember.get(c.memberId)!.push(c);
      }
      if (card.groupLabel) blocks.push(...kv([["Group", card.groupLabel]]));
      if (card.members.length && card.items.length) {
        blocks.push({
          kind: "table",
          headers: ["", ...card.items.map((i) => i.label)],
          rows: card.members.map((m) => [
            joinBits([m.name, m.role ? `(${m.role})` : null], " "),
            ...card.items.map((i) => {
              const cell = cellsByMember.get(m.id)?.find((c) => c.itemId === i.id);
              return cell ? joinBits([cell.status, cell.notes]) : "need";
            }),
          ]),
        });
      } else if (card.members.length) {
        blocks.push(...listOf(card.members.map((m) => plain(joinBits([m.name, m.role], " — ")))));
      }
      for (const i of card.items) {
        if (i.notes) blocks.push(...kv([[itemLabel.get(i.id) ?? i.label, i.notes]]));
      }
      blocks.push(...notesBlocks(card.notes));
      break;
    }
  }

  return { title: card.title, subtitle, blocks };
}

// ─── Renderers ──────────────────────────────────────────────────────────

function spansToWhatsApp(spans: Span[]): string {
  return spans
    .map((s) => {
      let t = s.text;
      if (t === "\n") return "\n";
      if (s.href) t = `${t} (${s.href})`;
      const trimmed = t.trim();
      if (!trimmed) return t;
      // WhatsApp marks must hug the text: "*bold*", not "* bold *".
      const lead = t.slice(0, t.length - t.trimStart().length);
      const trail = t.slice(t.trimEnd().length);
      let core = trimmed;
      if (s.italic) core = `_${core}_`;
      if (s.bold) core = `*${core}*`;
      return `${lead}${core}${trail}`;
    })
    .join("");
}

function spansToPlain(spans: Span[]): string {
  return spans.map((s) => (s.href ? `${s.text} (${s.href})` : s.text)).join("");
}

/** WhatsApp-formatted text: *bold* headings, • bullets, 1. numbered,
 *  blank line between blocks. Pastes as real formatting in WhatsApp. */
export function docToWhatsApp(doc: Doc): string {
  const out: string[] = [`*${doc.title.trim()}*`];
  if (doc.subtitle) out.push(`_${doc.subtitle.trim()}_`);
  for (const b of doc.blocks) {
    switch (b.kind) {
      case "heading":
        out.push(`*${b.text.trim()}*`);
        break;
      case "paragraph":
        out.push(spansToWhatsApp(b.spans));
        break;
      case "quote":
        out.push(
          spansToWhatsApp(b.spans)
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n"),
        );
        break;
      case "list":
        out.push(
          b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : "•"} ${spansToWhatsApp(item)}`).join("\n"),
        );
        break;
      case "kv":
        out.push(b.rows.map((r) => `*${r.label}:* ${r.value}`).join("\n"));
        break;
      case "table":
        out.push(
          b.rows
            .map((row) => {
              const [first, ...rest] = row;
              const cells = rest.map((c, i) => `${b.headers[i + 1] ?? ""}: ${c}`).join(" · ");
              return `*${first}* — ${cells}`;
            })
            .join("\n"),
        );
        break;
    }
  }
  return out.join("\n\n").trim();
}

/** Plain text — no markup at all. Headings are set off by a trailing
 *  colon-free line of their own; lists use "- " and "1. ". */
export function docToPlainText(doc: Doc): string {
  const out: string[] = [doc.title.trim()];
  if (doc.subtitle) out.push(doc.subtitle.trim());
  for (const b of doc.blocks) {
    switch (b.kind) {
      case "heading":
        out.push(b.text.trim().toUpperCase());
        break;
      case "paragraph":
        out.push(spansToPlain(b.spans));
        break;
      case "quote":
        out.push(
          spansToPlain(b.spans)
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n"),
        );
        break;
      case "list":
        out.push(b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : "-"} ${spansToPlain(item)}`).join("\n"));
        break;
      case "kv":
        out.push(b.rows.map((r) => `${r.label}: ${r.value}`).join("\n"));
        break;
      case "table":
        out.push(
          b.rows
            .map((row) => {
              const [first, ...rest] = row;
              return `${first} — ${rest.map((c, i) => `${b.headers[i + 1] ?? ""}: ${c}`).join(" · ")}`;
            })
            .join("\n"),
        );
        break;
    }
  }
  return out.join("\n\n").trim();
}
