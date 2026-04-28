"use server";

// C10 (v1.15.0): server actions for managing CustomField definitions.
//
// Definition CRUD lives in Settings (couple-only — same gate as the
// other Settings actions, since defining custom fields shapes the data
// model the whole couple uses). Per-entity value writes live with the
// entity's existing actions (e.g. setGuestCustomField below).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";

// v1.22.0: extended from guest-only (v1.15.0) to also accept
// supplier + task. Each entity has its own write action wired in
// the action files for that section.
const fieldDefSchema = z.object({
  entity: z.enum(["guest", "supplier", "task"]),
  name: z.string().min(1).max(80),
  type: z.enum(["text", "number", "date", "select"]),
  options: z.array(z.string().min(1).max(80)).max(20).default([]),
});

function requireCouple(action: string) {
  return requireUser().then((user) => {
    if (!user.isCouple) {
      throw new Error(`Forbidden: only the couple can ${action}`);
    }
    return user;
  });
}

export async function createCustomField(formData: FormData) {
  const user = await requireCouple("define custom fields");
  const optionsRaw = String(formData.get("options") ?? "");
  // Comma-separated input from the Settings form. Empty entries dropped.
  const options = optionsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const parsed = fieldDefSchema.parse({
    entity: formData.get("entity") || "guest",
    name: formData.get("name"),
    type: formData.get("type"),
    options,
  });
  if (parsed.type === "select" && parsed.options.length === 0) {
    throw new Error("Select fields need at least one option");
  }
  const last = await db.customField.findFirst({
    where: { entity: parsed.entity },
    orderBy: { order: "desc" },
  });
  const created = await db.customField.create({
    data: {
      entity: parsed.entity,
      name: parsed.name,
      type: parsed.type,
      options: parsed.options,
      order: (last?.order ?? -1) + 1,
    },
  });
  await audit(user, {
    action: "create",
    entity: "CustomField",
    entityId: created.id,
    metadata: { entity: parsed.entity, name: parsed.name, type: parsed.type },
  });
  revalidatePath("/settings");
  revalidateForEntity(parsed.entity);
}

export async function deleteCustomField(id: string) {
  const user = await requireCouple("delete custom fields");
  const def = await db.customField.findUnique({ where: { id } });
  if (!def) throw new Error("Custom field not found");
  await db.customField.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "CustomField",
    entityId: id,
    metadata: { entity: def.entity, name: def.name },
  });
  // Note: existing values on entity rows aren't migrated. They become
  // orphan keys in `customFieldValues` JSON — invisible because no
  // definition matches. Re-creating a field with the same name gives
  // it a new ID, so old values stay orphaned. This is intentional:
  // we don't want a delete to silently destroy data.
  revalidatePath("/settings");
  revalidateForEntity(def.entity);
}

function revalidateForEntity(entity: string) {
  // The entity surface that needs to know a new field exists.
  if (entity === "guest") revalidatePath("/guests");
  else if (entity === "supplier") revalidatePath("/suppliers");
  else if (entity === "task") {
    revalidatePath("/tasks");
    revalidatePath("/questions");
  }
}
