import { db } from "@/lib/db";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { signOut } from "@/auth";
import type { Counts } from "@/components/shell/nav-config";

type SessionUser = {
  id: string;
  name?: string | null;
  email: string;
  isCouple: boolean;
  role: string;
};

async function getCounts(user: SessionUser): Promise<Counts> {
  const [tasks, questions, guests, payments] = await Promise.all([
    db.task.count({ where: { status: { not: "DONE" }, type: "TASK" } }),
    db.task.count({ where: { status: "OPEN", type: "QUESTION" } }),
    db.guest.count({ where: { rsvp: "PENDING", archived: false } }),
    user.isCouple
      ? db.payment.count({ where: { status: { in: ["DUE", "SCHEDULED", "OVERDUE"] } } })
      : Promise.resolve(0),
  ]);
  return { tasks, questions, guests, payments };
}

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

export async function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const counts = await getCounts(user);

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar user={user} counts={counts} signOutAction={signOutAction} />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
      <MobileTabBar isCouple={user.isCouple} />
    </div>
  );
}
