"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const audienceSchema = z.array(z.string()).default([]);

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.string().min(1),
  endTime: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  audience: audienceSchema,
  notes: z.string().max(2000).optional().nullable(),
});

function readAudience(formData: FormData): string[] {
  return formData.getAll("audience").map(String).filter(Boolean);
}

export async function createScheduleEvent(formData: FormData) {
  const user = await requireEdit("schedule");
  const parsed = eventSchema.parse({
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || null,
    location: formData.get("location") || null,
    audience: readAudience(formData),
    notes: formData.get("notes") || null,
  });
  const created = await db.scheduleEvent.create({
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      audience: parsed.audience,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "create", entity: "ScheduleEvent", entityId: created.id });
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function updateScheduleEvent(id: string, formData: FormData) {
  const user = await requireEdit("schedule");
  const parsed = eventSchema.parse({
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || null,
    location: formData.get("location") || null,
    audience: readAudience(formData),
    notes: formData.get("notes") || null,
  });
  await db.scheduleEvent.update({
    where: { id },
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      audience: parsed.audience,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "update", entity: "ScheduleEvent", entityId: id });
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function deleteScheduleEvent(id: string) {
  const user = await requireEdit("schedule");
  await db.scheduleEvent.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "ScheduleEvent", entityId: id });
  revalidatePath("/schedule");
  revalidatePath("/");
}
