/**
 * v2.13.5 — re-render TEXT cards whose body was stored as escaped
 * markdown, so "### Entrance" and "- clue one" stop printing literally.
 *
 *     docker compose --env-file .env exec web node scripts-build/scripts/repair-legacy-text-cards.js           # dry run
 *     docker compose --env-file .env exec web node scripts-build/scripts/repair-legacy-text-cards.js --apply   # write
 *
 * Why: until v2.13.2, an applied `book.card.create` posted the proposed
 * body to the legacy plain `body` column. That column is rendered via
 * legacyBodyToHtml — HTML-escaped and <p>-wrapped VERBATIM — so any
 * markdown the model wrote ("### Entrance (~2:00)", "- chair sweep")
 * printed as literal symbols on the site (enhancement cmszrjor). The
 * write tools were never wrong about what they support; the create path
 * just never ran the markdown renderer. v2.13.2 fixed the path for new
 * cards; this repairs the cards created before it.
 *
 * What it does: for every TEXT card with a `body`, re-render `body`
 * through markdownToBookHtml (the same renderer book.card.replace_text
 * uses) into `bodyHtml`.
 *
 * Safety:
 *   - A card is touched ONLY when bodyHtml is NULL or its TEXT CONTENT
 *     (tags stripped, entities decoded, whitespace collapsed) still
 *     equals `body` — i.e. nobody has edited it in Tiptap since it was
 *     created. A hand-edited card has different text and is skipped,
 *     listed as such. (v2.13.6: compared on text rather than on
 *     legacyBodyToHtml() output — that helper needs sanitize-html, which
 *     Next bundles into the server chunk and never ships as a package
 *     in the runtime image, so the script couldn't load it.)
 *   - `body` is left in place for provenance.
 *   - Idempotent: after a run, bodyHtml no longer equals the legacy form,
 *     so a second run skips everything.
 *   - Every change writes an audit row (entity BookSubsection, action
 *     update, changedFields ["bodyHtml"]).
 *   - DRY RUN by default — prints before/after heads and a summary; pass
 *     --apply to write.
 *
 * Runs inside the production image: local PrismaClient (mirrors
 * prisma/seed.ts) and relative imports of the two pure renderers, which
 * the Dockerfile transpiles alongside this file (see the tsc step).
 */

import { BookSubsectionKind, PrismaClient } from "@prisma/client";
import { markdownToBookHtml } from "../src/lib/ai/apply/markdown-to-book-html";
import { stripHtml } from "../src/lib/html-text";

/** Plain-text form of a body for the untouched-since-creation check. */
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function head(s: string | null | undefined, n = 96): string {
  if (!s) return "(null)";
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

async function main(): Promise<void> {
  const cards = await db.bookSubsection.findMany({
    where: { kind: BookSubsectionKind.TEXT, body: { not: null } },
    select: {
      id: true,
      title: true,
      body: true,
      bodyHtml: true,
      section: { select: { slug: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  let changed = 0;
  let skipped = 0;

  for (const c of cards) {
    const body = c.body ?? "";
    const untouchedSinceCreate = c.bodyHtml == null || stripHtml(c.bodyHtml) === collapse(body);
    if (!untouchedSinceCreate) {
      skipped++;
      console.log(`skip   ${c.id}  [${c.section.slug}] ${c.title} — bodyHtml hand-edited since creation`);
      continue;
    }
    // markdownToBookHtml escapes its input and emits only allow-listed
    // tags — the same output updateBookSubsectionCore would sanitise to.
    const next = markdownToBookHtml(body);
    if (next === c.bodyHtml) {
      skipped++;
      console.log(`same   ${c.id}  [${c.section.slug}] ${c.title} — already rendered`);
      continue;
    }

    changed++;
    console.log(`${APPLY ? "fixed " : "would "} ${c.id}  [${c.section.slug}] ${c.title}`);
    console.log(`         before: ${head(c.bodyHtml)}`);
    console.log(`         after : ${head(next)}`);

    if (APPLY) {
      await db.bookSubsection.update({ where: { id: c.id }, data: { bodyHtml: next } });
      await db.auditLog.create({
        data: {
          action: "update",
          entity: "BookSubsection",
          entityId: c.id,
          metadata: {
            title: c.title,
            changedFields: ["bodyHtml"],
            repair: "legacy-markdown-body (v2.13.5)",
          },
        },
      });
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry run"}: ${changed} card(s) ${APPLY ? "re-rendered" : "would be re-rendered"}, ${skipped} skipped, ${cards.length} inspected.`,
  );
  if (!APPLY && changed > 0) console.log("Re-run with --apply to write.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
