"use server";

// v2.14.0: share/export one Book card as text. Kept out of the 3,000-
// line book/actions.ts on purpose — this is a READ action with a
// different gate (book VIEW, not EDIT): anyone who can see the card may
// copy it out, because the people who forward a brief are usually
// view-only. The COUPLE_ONLY wall still applies to non-couple users.

import { requireUser } from "@/lib/actions";
import { canView } from "@/lib/permissions";
import { loadCardExport } from "@/lib/core/book-export";
import { cardToDoc, docToPlainText, docToWhatsApp } from "@/lib/book-card-doc";

export async function exportBookCard(
  subsectionId: string,
  format: "whatsapp" | "text",
): Promise<string> {
  const user = await requireUser();
  if (!(await canView(user, "book"))) {
    throw new Error("The Wedding Book isn't visible to this user.");
  }
  if (typeof subsectionId !== "string" || !subsectionId || subsectionId.length > 100) {
    throw new Error("Invalid card id.");
  }
  const card = await loadCardExport(subsectionId);
  if (!card) throw new Error("Card not found.");
  if (card.visibility === "COUPLE_ONLY" && !user.isCouple) {
    throw new Error("This card is couple-only.");
  }
  const doc = cardToDoc(card);
  return format === "whatsapp" ? docToWhatsApp(doc) : docToPlainText(doc);
}
