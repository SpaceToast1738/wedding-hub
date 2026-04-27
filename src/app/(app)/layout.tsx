import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) redirect("/signin");

  // Fresh-from-DB user so the AppShell never shows a stale name (the JWT is
  // cached and only refreshes on sign-in). Also gates the welcome flow:
  // if neither firstName nor the legacy name is set, send the user there.
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      isCouple: true,
    },
  });
  if (!dbUser) redirect("/signin");
  if (!dbUser.firstName && !dbUser.name) redirect("/welcome");

  return (
    <AppShell
      user={{
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        isCouple: dbUser.isCouple,
        role: dbUser.role,
      }}
    >
      {children}
    </AppShell>
  );
}
