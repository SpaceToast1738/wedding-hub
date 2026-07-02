import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const SUPPLIER_STATUS = [
  "SHORTLIST",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "PAID",
  "REJECTED",
] as const;

const inputSchema = z.object({
  status: z.enum(SUPPLIER_STATUS).optional(),
  category: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

export const readSuppliers: AiTool<typeof inputSchema> = {
  name: "read_suppliers",
  description:
    "Read the couple's suppliers/vendors — name, category, booking status, primary contact, and the latest logged communication with any follow-up date. Use the returned supplier ids to link proposed tasks to a vendor (propose_task's supplierId). Filter by status (e.g. SHORTLIST = still deciding, BOOKED = confirmed) or category (venue, photographer, florist…).",
  inputSchema,
  progressLabel: "Reading suppliers…",
  definition: {
    name: "read_suppliers",
    description:
      "Read suppliers/vendors: name, category, status, primary contact, latest communication + follow-up date. Returns supplier ids usable in propose_task.supplierId.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...SUPPLIER_STATUS],
          description: "Filter by booking status.",
        },
        category: {
          type: "string",
          description: "Filter by category substring, e.g. 'photo'.",
        },
        limit: { type: "integer", minimum: 1, maximum: 30, description: "Default 30." },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "suppliers"))) {
      return { ok: false, error: "Suppliers aren't visible to this user." };
    }

    const where: Record<string, unknown> = {};
    if (input.status) where.status = input.status;
    if (input.category) {
      where.category = { contains: input.category, mode: "insensitive" };
    }

    const suppliers = await db.supplier.findMany({
      where,
      take: input.limit ?? 30,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        website: true,
        contacts: {
          where: { primary: true },
          take: 1,
          select: { name: true, email: true, phone: true },
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { channel: true, summary: true, followUpAt: true, createdAt: true },
        },
      },
    });

    return {
      ok: true,
      data: {
        count: suppliers.length,
        suppliers: suppliers.map((s) => {
          const contact = s.contacts[0] ?? null;
          const lastComm = s.communications[0] ?? null;
          return {
            id: s.id,
            name: s.name,
            category: s.category,
            status: s.status,
            website: s.website,
            primaryContact: contact
              ? { name: contact.name, email: contact.email, phone: contact.phone }
              : null,
            lastCommunication: lastComm
              ? {
                  channel: lastComm.channel,
                  summary: lastComm.summary.slice(0, 200),
                  at: lastComm.createdAt.toISOString().slice(0, 10),
                  followUpAt: lastComm.followUpAt?.toISOString().slice(0, 10) ?? null,
                }
              : null,
          };
        }),
      },
    };
  },
};
