"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/actions";

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
});

export type NameFormResult =
  | { ok: true }
  | { ok: false; error: string };

// Server action that EITHER redirects on success (welcome flow) or returns
// a result for inline-edit forms (Settings). Decides based on `redirectTo`.
export async function setMyName(formData: FormData, redirectTo?: string): Promise<NameFormResult | void> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const { firstName, lastName } = parsed.data;
  const name = `${firstName} ${lastName}`;

  await db.user.update({
    where: { id: user.id },
    data: { firstName, lastName, name },
  });
  await logAudit({
    userId: user.id,
    action: "set-name",
    entity: "User",
    entityId: user.id,
    metadata: { firstName, lastName },
  });

  revalidatePath("/settings");
  revalidatePath("/");

  if (redirectTo) {
    redirect(redirectTo);
  }
  return { ok: true };
}
