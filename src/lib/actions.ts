import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit, type Section } from "@/lib/permissions";
import { logAudit, type AuditEntry } from "@/lib/audit";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  isCouple: boolean;
  role: string;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isCouple: session.user.isCouple,
    role: session.user.role,
  };
}

export async function requireEdit(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
  return user;
}

export async function audit(
  user: SessionUser,
  entry: Omit<AuditEntry, "userId">,
): Promise<void> {
  await logAudit({ ...entry, userId: user.id });
}
