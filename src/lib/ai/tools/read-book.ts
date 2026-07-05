import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({
  sectionSlug: z.string().optional(),
  includeBody: z.boolean().optional(),
});

/** Strip HTML tags for the AI — we ship the plain text so the model
 *  reasons about the *content* rather than the markup. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const readBook: AiTool<typeof inputSchema> = {
  name: "read_book",
  description:
    "Read the Wedding Book. Without `sectionSlug`, returns the list of all sections with their card counts. With `sectionSlug`, returns that section and every card inside it (id + title + kind + visibility). Set `includeBody: true` on a section fetch to also pull TEXT card contents (up to 500 chars per card). Filters COUPLE_ONLY items based on caller's permissions — but if the caller is the couple, they see everything. Use read_book_card with a card id for full content + child-row ids before proposing any book update.",
  inputSchema,
  progressLabel: "Reading the wedding book…",
  definition: {
    name: "read_book",
    description:
      "Read the Wedding Book. Without `sectionSlug`, returns the list of all sections. With `sectionSlug`, returns that section and every card inside it (id + title + kind + visibility). Set `includeBody: true` to also pull TEXT card contents. Use read_book_card with a card id for full content + child-row ids before proposing any book update.",
    input_schema: {
      type: "object",
      properties: {
        sectionSlug: { type: "string", description: "Section slug e.g. 'food-drink'." },
        includeBody: { type: "boolean", description: "Include TEXT card body text (trimmed)." },
      },
    },
  },
  async handler(input, ctx) {
    // v2.4.0 review fix: the section gate — ai_chat access alone must
    // not bypass a NONE permission on the underlying section.
    if (!(await canView(ctx.user, "book"))) {
      return { ok: false, error: "The Wedding Book isn't visible to this user." };
    }
    const visibilityFilter = ctx.user.isCouple
      ? undefined
      : { visibility: "EVERYONE" as const };

    if (!input.sectionSlug) {
      const sections = await db.bookSection.findMany({
        where: visibilityFilter,
        orderBy: { order: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          _count: { select: { subsections: true } },
        },
      });
      return {
        ok: true,
        data: {
          sections: sections.map((s) => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            subtitle: s.subtitle,
            cardCount: s._count.subsections,
          })),
        },
      };
    }

    const section = await db.bookSection.findUnique({
      where: { slug: input.sectionSlug },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        visibility: true,
        subsections: {
          where: ctx.user.isCouple ? undefined : { visibility: "EVERYONE" },
          orderBy: { order: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            kind: true,
            visibility: true,
            bodyHtml: true,
            body: true,
          },
        },
      },
    });

    if (!section) return { ok: false, error: `No section with slug '${input.sectionSlug}'.` };
    if (!ctx.user.isCouple && section.visibility === "COUPLE_ONLY") {
      return { ok: false, error: "This section is couple-only." };
    }

    return {
      ok: true,
      data: {
        section: {
          id: section.id,
          slug: section.slug,
          title: section.title,
          subtitle: section.subtitle,
        },
        cards: section.subsections.map((c) => {
          const body =
            input.includeBody && c.kind === "TEXT"
              ? stripHtml(c.bodyHtml ?? c.body).slice(0, 500)
              : null;
          return {
            id: c.id,
            slug: c.slug,
            title: c.title,
            kind: c.kind,
            visibility: c.visibility,
            body: body || undefined,
          };
        }),
      },
    };
  },
};
