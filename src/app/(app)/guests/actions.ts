"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpStatus, Side } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const householdSchema = z.object({
  name: z.string().min(1).max(200),
  side: z.nativeEnum(Side).default(Side.BOTH),
  notes: z.string().max(2000).optional().nullable(),
});

const guestSchema = z.object({
  householdId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  rsvp: z.nativeEnum(RsvpStatus).default(RsvpStatus.PENDING),
  side: z.nativeEnum(Side).default(Side.BOTH),
  isChild: z.boolean().optional(),
  needsHighchair: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneName: z.string().max(200).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  dietary: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function readDietary(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export async function createHousehold(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  const created = await db.household.create({
    data: { name: parsed.name, side: parsed.side, notes: parsed.notes ?? null },
  });
  await audit(user, { action: "create", entity: "Household", entityId: created.id });
  revalidatePath("/guests");
}

export async function updateHousehold(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  await db.household.update({
    where: { id },
    data: { name: parsed.name, side: parsed.side, notes: parsed.notes ?? null },
  });
  await audit(user, { action: "update", entity: "Household", entityId: id });
  revalidatePath("/guests");
}

export async function deleteHousehold(id: string) {
  const user = await requireEdit("guests");
  await db.household.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Household", entityId: id });
  revalidatePath("/guests");
}

export async function createGuest(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });
  const created = await db.guest.create({
    data: {
      householdId: parsed.householdId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone ?? null,
      rsvp: parsed.rsvp,
      side: parsed.side,
      isChild: !!parsed.isChild,
      needsHighchair: !!parsed.needsHighchair,
      plusOneAllowed: !!parsed.plusOneAllowed,
      plusOneName: parsed.plusOneName ?? null,
      role: parsed.role ?? null,
      dietary: readDietary(parsed.dietary ?? null),
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "create", entity: "Guest", entityId: created.id });
  revalidatePath("/guests");
  revalidatePath("/");
}

export async function updateGuest(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });
  await db.guest.update({
    where: { id },
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone ?? null,
      rsvp: parsed.rsvp,
      side: parsed.side,
      isChild: !!parsed.isChild,
      needsHighchair: !!parsed.needsHighchair,
      plusOneAllowed: !!parsed.plusOneAllowed,
      plusOneName: parsed.plusOneName ?? null,
      role: parsed.role ?? null,
      dietary: readDietary(parsed.dietary ?? null),
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "update", entity: "Guest", entityId: id });
  revalidatePath("/guests");
  revalidatePath("/");
}

export async function setGuestRsvp(id: string, rsvp: RsvpStatus) {
  const user = await requireEdit("guests");
  await db.guest.update({
    where: { id },
    data: {
      rsvp,
      attending: rsvp === RsvpStatus.ATTENDING ? true : rsvp === RsvpStatus.DECLINED ? false : null,
    },
  });
  await audit(user, { action: "rsvp", entity: "Guest", entityId: id, metadata: { rsvp } });
  revalidatePath("/guests");
  revalidatePath("/");
}

export async function deleteGuest(id: string) {
  const user = await requireEdit("guests");
  await db.guest.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Guest", entityId: id });
  revalidatePath("/guests");
  revalidatePath("/");
}
