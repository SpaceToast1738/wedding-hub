// v2.4.0: file-metadata read (read-only forever — uploads need real
// bytes, deletes destroy disk data). Never returns storedPath or any
// disk path; downloads stay behind the session-gated API route.
// Non-couple callers only see EVERYONE-visibility rows, mirroring
// read_book's filter, so COUPLE_ONLY file names can't leak.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({
  folder: z.string().max(100).optional(),
});

export const readFiles: AiTool<typeof inputSchema> = {
  name: "read_files",
  description:
    "Read uploaded-file metadata — counts per folder plus the 50 most recent files (name, folder, MIME type, size, visibility, upload date). Optionally filter to one folder. Also cross-references supplier contracts (supplier name, signed status, whether a contract file is attached) so you can spot unsigned or missing contracts. Never returns file contents or download paths.",
  inputSchema,
  progressLabel: "Reading files…",
  definition: {
    name: "read_files",
    description:
      "Read file metadata: counts by folder + recent files (name, folder, MIME, size, visibility, date), plus supplier-contract signed/attached status. No contents or paths.",
    input_schema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Only list files in this folder." },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "files"))) {
      return { ok: false, error: "Files aren't visible to this user." };
    }

    const visibilityFilter = ctx.user.isCouple
      ? {}
      : { visibility: "EVERYONE" as const };

    const [folderCounts, files, contracts] = await Promise.all([
      db.file.groupBy({
        by: ["folder"],
        where: visibilityFilter,
        _count: { _all: true },
      }),
      db.file.findMany({
        where: { ...visibilityFilter, ...(input.folder ? { folder: input.folder } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          folder: true,
          mimeType: true,
          sizeBytes: true,
          visibility: true,
          createdAt: true,
        },
      }),
      // Contract status is supplier data, not file data — only include
      // it when the caller can see /suppliers. Signed/attached flags
      // only; SupplierContract.amount (money) is never selected.
      (await canView(ctx.user, "suppliers"))
        ? db.supplierContract.findMany({
            take: 50,
            select: {
              signed: true,
              signedAt: true,
              fileId: true,
              supplier: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      ok: true,
      data: {
        countsByFolder: folderCounts.map((c) => ({
          folder: c.folder ?? "(no folder)",
          files: c._count._all,
        })),
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          folder: f.folder,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          visibility: f.visibility,
          createdAt: f.createdAt.toISOString().slice(0, 10),
        })),
        ...(contracts
          ? {
              supplierContracts: contracts.map((c) => ({
                supplierName: c.supplier.name,
                signed: c.signed,
                signedAt: c.signedAt?.toISOString().slice(0, 10) ?? null,
                hasFile: c.fileId !== null,
              })),
            }
          : {}),
      },
    };
  },
};
