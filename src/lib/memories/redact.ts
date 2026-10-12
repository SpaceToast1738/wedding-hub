// v2.17.0: strip every money-flagged piece of the book.
//
// The book is built once WITH money (it's couple-only data anyway) and
// redacted per host: the screen shows it only behind the "show what it
// cost" switch, and the print/export never carries it unless asked.
// Pure, non-mutating.

import type { MemoryBlock, MemoryBookData, MemoryChapter } from "./types";

function redactBlock(b: MemoryBlock): MemoryBlock | null {
  if ("money" in b && b.money) return null;
  switch (b.kind) {
    case "stats": {
      const items = b.items.filter((i) => !i.money);
      return items.length ? { ...b, items } : null;
    }
    case "cards": {
      const items = b.items.filter((i) => !i.money);
      return items.length ? { ...b, items } : null;
    }
    case "timeline":
      return {
        ...b,
        months: b.months.map((m) => ({
          ...m,
          highlights: m.highlights.filter((h) => !h.money),
        })),
      };
    default:
      return b;
  }
}

export function redactChapter(c: MemoryChapter): MemoryChapter | null {
  if (c.money) return null;
  const blocks = c.blocks.map(redactBlock).filter((b): b is MemoryBlock => b !== null);
  return { ...c, blocks };
}

export function redactMoney(data: MemoryBookData): MemoryBookData {
  if (!data.moneyIncluded) return data;
  const chapters = data.chapters
    .map(redactChapter)
    .filter((c): c is MemoryChapter => c !== null);
  return { ...data, chapters, moneyIncluded: false };
}
