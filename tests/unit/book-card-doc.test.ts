// v2.14.0: share/export a Book card. The contract: every card kind
// builds one Doc; WhatsApp / plain renderers are tiny and lossless over
// it; allow-listed book HTML round-trips into blocks with real
// formatting (no literal tags, no entities).

import { describe, expect, it } from "vitest";
import {
  cardToDoc,
  docToPlainText,
  docToWhatsApp,
  htmlToBlocks,
  inlineHtmlToSpans,
  type CardExport,
} from "@/lib/book-card-doc";

const BASE = {
  id: "card_1",
  slug: "ceremony-brief",
  title: "Josh & Aimee — your ceremony brief",
  visibility: "EVERYONE" as const,
  sectionSlug: "ceremony-music",
  sectionTitle: "Ceremony & Music",
};

describe("inlineHtmlToSpans", () => {
  it("maps strong/em/a to marks and decodes entities", () => {
    const spans = inlineHtmlToSpans(
      'Meet at <strong>1:35pm</strong> &amp; wait for <em>the signal</em> — <a href="https://maps.example/x">map</a>',
    );
    expect(spans).toEqual([
      { text: "Meet at " },
      { text: "1:35pm", bold: true },
      { text: " & wait for " },
      { text: "the signal", italic: true },
      { text: " — " },
      { text: "map", href: "https://maps.example/x" },
    ]);
  });

  it("drops <u> as a mark but keeps its text, and turns <br> into a newline", () => {
    expect(inlineHtmlToSpans("a<u>b</u>c<br>d")).toEqual([
      { text: "a" },
      { text: "b" },
      { text: "c" },
      { text: "\n" },
      { text: "d" },
    ]);
  });
});

describe("htmlToBlocks", () => {
  it("parses the allow-listed block tags into headings, paragraphs and lists", () => {
    const blocks = htmlToBlocks(
      "<h3>Entrance (~2:00)</h3><p>Groomsmen <strong>chair sweep</strong> at 12:45.</p><ul><li>clue one</li><li>clue two</li></ul><ol><li>first</li></ol><blockquote><p>Keep it calm.</p></blockquote>",
    );
    expect(blocks).toEqual([
      { kind: "heading", text: "Entrance (~2:00)" },
      { kind: "paragraph", spans: [{ text: "Groomsmen " }, { text: "chair sweep", bold: true }, { text: " at 12:45." }] },
      { kind: "list", ordered: false, items: [[{ text: "clue one" }], [{ text: "clue two" }]] },
      { kind: "list", ordered: true, items: [[{ text: "first" }]] },
      { kind: "quote", spans: [{ text: "Keep it calm." }] },
    ]);
  });

  it("treats a legacy plain body (no block tags) as blank-line-separated paragraphs", () => {
    const blocks = htmlToBlocks("12:45 chair sweep\n\n1:15 music");
    expect(blocks).toEqual([
      { kind: "paragraph", spans: [{ text: "12:45 chair sweep" }] },
      { kind: "paragraph", spans: [{ text: "1:15 music" }] },
    ]);
  });

  it("returns nothing for empty / null", () => {
    expect(htmlToBlocks(null)).toEqual([]);
    expect(htmlToBlocks("   ")).toEqual([]);
  });
});

describe("cardToDoc + docToWhatsApp — TEXT card (the real case)", () => {
  const card: CardExport = {
    ...BASE,
    kind: "TEXT",
    body: null,
    bodyHtml:
      "<h3>Before the ceremony</h3><p>Josh: <strong>12:45</strong> groomsmen chair sweep.</p><ul><li>Aimee holds the rings</li><li>Josh gives the <em>coast-clear</em> signal</li></ul>",
  };

  it("renders WhatsApp formatting the way WhatsApp parses it", () => {
    const wa = docToWhatsApp(cardToDoc(card));
    expect(wa).toBe(
      [
        "*Josh & Aimee — your ceremony brief*",
        "_Ceremony & Music_",
        "*Before the ceremony*",
        "Josh: *12:45* groomsmen chair sweep.",
        "• Aimee holds the rings\n• Josh gives the _coast-clear_ signal",
      ].join("\n\n"),
    );
    expect(wa).not.toMatch(/<[a-z]/);
    expect(wa).not.toContain("&amp;");
  });

  it("renders plain text with no markup", () => {
    const plain = docToPlainText(cardToDoc(card));
    expect(plain).toContain("BEFORE THE CEREMONY");
    expect(plain).toContain("- Aimee holds the rings");
    expect(plain).not.toContain("*");
    expect(plain).not.toContain("_coast");
  });

  it("marks hug the text (no '* bold *') even when the source span had padding", () => {
    const wa = docToWhatsApp({
      title: "T",
      blocks: [{ kind: "paragraph", spans: [{ text: "a " }, { text: " b ", bold: true }, { text: "c" }] }],
    });
    expect(wa).toContain("a  *b* c");
  });
});

describe("cardToDoc — structured kinds", () => {
  it("MENU: one heading per course, options as bullets with flags, no money", () => {
    const doc = cardToDoc({
      ...BASE,
      kind: "MENU",
      serviceType: "Plated",
      serviceTime: "5:30pm",
      notes: null,
      courses: [
        {
          courseLabel: "Starter",
          options: [
            { label: "Tian of melon", description: "with mint", dietary: ["vegan"], isVegetarianMain: false, isKidsMeal: false },
            { label: "Soup", description: null, dietary: [], isVegetarianMain: false, isKidsMeal: true },
          ],
        },
      ],
    });
    expect(doc.blocks[0]).toEqual({ kind: "kv", rows: [{ label: "Service", value: "Plated · 5:30pm" }] });
    expect(doc.blocks[1]).toEqual({ kind: "heading", text: "Starter" });
    const wa = docToWhatsApp(doc);
    expect(wa).toContain("• *Tian of melon* — with mint (vegan)");
    expect(wa).toContain("• *Soup* (kids)");
    expect(wa).not.toMatch(/£/);
  });

  it("SETUP: header facts as label/value rows, items with location + state", () => {
    const wa = docToWhatsApp(
      cardToDoc({
        ...BASE,
        kind: "SETUP",
        space: "Cedar Room",
        setupStartsAt: "10:00am",
        setupOwner: "Bridesmaids",
        notes: null,
        items: [
          {
            name: "Table numbers",
            quantity: 8,
            location: "Round-table centre",
            source: null,
            website: null,
            packed: true,
            placed: false,
            packDownPlan: null,
            notes: null,
          },
        ],
      }),
    );
    expect(wa).toContain("*Space:* Cedar Room\n*Set-up starts:* 10:00am\n*Owner:* Bridesmaids");
    expect(wa).toContain("• *Table numbers ×8* — Round-table centre (packed)");
  });

  it("WEDDING_PARTY: members × items become a per-member line", () => {
    const wa = docToWhatsApp(
      cardToDoc({
        ...BASE,
        kind: "WEDDING_PARTY",
        groupLabel: "Groomsmen",
        notes: null,
        members: [{ id: "m1", name: "Josh", role: "Best man" }],
        items: [
          { id: "i1", label: "Suit", notes: null },
          { id: "i2", label: "Shoes", notes: null },
        ],
        cells: [{ memberId: "m1", itemId: "i1", status: "HAVE", notes: null }],
      }),
    );
    expect(wa).toContain("*Josh (Best man)* — Suit: HAVE · Shoes: need");
  });

  it("FIELD: only filled values, grouped, formatted", () => {
    const doc = cardToDoc({
      ...BASE,
      kind: "FIELD",
      fieldDefs: [
        { id: "f1", label: "Capacity", type: "number", group: "Room" },
        { id: "f2", label: "Has PA", type: "boolean", group: "Room" },
        { id: "f3", label: "Unused", type: "text", group: null },
      ],
      values: { f1: 120, f2: true, f3: "" },
    });
    expect(doc.blocks).toEqual([
      { kind: "heading", text: "Room" },
      { kind: "kv", rows: [{ label: "Capacity", value: "120" }, { label: "Has PA", value: "Yes" }] },
    ]);
  });

  it("STAY: dates and occupants; empty fields are omitted", () => {
    const plain = docToPlainText(
      cardToDoc({
        ...BASE,
        kind: "STAY",
        propertyName: "The Lodge",
        propertyContact: null,
        bookingReference: "ABC123",
        checkInDate: "2026-09-23",
        checkOutDate: "2026-09-25",
        occupants: ["Jamie", "Bryony"],
        notes: "Key safe by the door.",
      }),
    );
    expect(plain).toContain("Property: The Lodge");
    expect(plain).not.toContain("Contact:");
    expect(plain).toContain("Staying: Jamie, Bryony");
    expect(plain).toContain("NOTES\n\nKey safe by the door.");
  });
});
