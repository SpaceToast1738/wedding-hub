import { z } from "zod";
import { db } from "@/lib/db";
import { guestCreateSchema, SIDES } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// New guest. No resolveRefs — the household is matched by NAME
// (householdName), not id: the guest.create apply path finds an
// existing household with that name or creates one, so the AI never
// needs a real householdId. RSVP is out of scope (new guests start
// PENDING; use propose_guest_set_rsvp afterwards if needed) and no
// meal fields are here (meals arrive via CSV import / propose_guest_update).
const inputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  householdName: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .describe(
      "The name of the household this guest belongs to. If a household with this name already exists the guest joins it; otherwise a new household is created. Defaults to '<lastName> household' when omitted.",
    ),
  side: z.enum(SIDES).optional(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  isChild: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneName: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .describe(
      "If set (and plusOneAllowed is true), a materialised +1 guest is created for this person.",
    ),
  dietary: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .describe("Comma-separated dietary requirements, e.g. 'vegetarian, nut allergy'."),
  role: z
    .string()
    .max(80)
    .optional()
    .nullable()
    .describe("e.g. 'Best Man', 'Maid of Honour'."),
  notes: z.string().max(2000).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this guest belongs on the list. Shown to the couple in the review UI.",
    ),
});

export const proposeGuestCreate: AiTool<typeof inputSchema> = {
  name: "propose_guest_create",
  description:
    "Propose adding a new guest for the couple to review. **This does NOT create the guest** — it writes a proposal the couple will Apply, Edit, or Dismiss. Call read_guests first to make sure this person isn't already on the list. The household is matched by name (householdName) — a matching household is reused, otherwise a new one is created. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing guest…",
  definition: {
    name: "propose_guest_create",
    description:
      "Propose a new guest. Writes a proposal — does not create the row directly. The household is matched by name (householdName). Check read_guests first to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        householdName: {
          type: ["string", "null"],
          description:
            "Household name — reused if it exists, otherwise created. Defaults to '<lastName> household'.",
        },
        side: { type: "string", enum: [...SIDES], description: "BOTH by default." },
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        isChild: { type: "boolean" },
        plusOneAllowed: { type: "boolean" },
        plusOneName: {
          type: ["string", "null"],
          description: "Materialises a +1 guest when set and plusOneAllowed is true.",
        },
        dietary: {
          type: ["string", "null"],
          description: "Comma-separated dietary requirements.",
        },
        role: { type: ["string", "null"], description: "e.g. 'Best Man', 'Maid of Honour'." },
        notes: { type: ["string", "null"] },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this guest belongs on the list.",
        },
      },
      required: ["firstName", "lastName", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const payloadResult = guestCreateSchema.safeParse({
      firstName: input.firstName,
      lastName: input.lastName,
      householdName: input.householdName ?? null,
      side: input.side ?? "BOTH",
      email: input.email ?? null,
      phone: input.phone ?? null,
      isChild: input.isChild ?? false,
      plusOneAllowed: input.plusOneAllowed ?? false,
      plusOneName: input.plusOneName ?? null,
      dietary: input.dietary ?? null,
      role: input.role ?? null,
      notes: input.notes ?? null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "guest.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const name = `${input.firstName} ${input.lastName}`.trim();
    const detailBits: string[] = [payloadResult.data.side];
    if (input.householdName) detailBits.push(`household "${input.householdName}"`);
    if (input.plusOneAllowed && input.plusOneName) detailBits.push(`+1 ${input.plusOneName}`);

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.create",
        title: name,
        detail: detailBits.join(" · "),
        message: "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
