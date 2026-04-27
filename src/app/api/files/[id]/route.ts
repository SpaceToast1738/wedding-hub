import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import { resolveStoredPath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_MIME_PREFIXES = ["image/", "application/pdf", "text/plain"];

function disposition(name: string, mime: string): string {
  const inline = INLINE_MIME_PREFIXES.some((p) => mime.startsWith(p));
  // RFC 5987 — UTF-8 filenames survive Word, weird quotes, etc.
  const safe = name.replace(/"/g, "");
  const encoded = encodeURIComponent(name);
  return `${inline ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!(await canView(session.user, "files"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const file = await db.file.findUnique({ where: { id } });
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Per-file visibility check on top of the section-level permission gate.
  // 404 (rather than 403) so a non-couple user can't probe for the
  // existence of couple-only files.
  if (file.visibility === "COUPLE_ONLY" && !session.user.isCouple) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(resolveStoredPath(file.storedPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("File missing on disk", { status: 410 });
    }
    throw err;
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": disposition(file.name, file.mimeType),
      // Belt-and-braces — Caddy already sets these globally, but it doesn't
      // hurt to repeat here in case someone deploys without Caddy.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
