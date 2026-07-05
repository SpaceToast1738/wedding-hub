import { db } from "@/lib/db";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { QuickCapture } from "@/components/shell/QuickCapture";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ChatPanelHost } from "@/components/ai/ChatPanelHost";
import { signOut } from "@/auth";
import { canView } from "@/lib/permissions";
import { AI_ENABLED } from "@/lib/ai/config";
import type { Counts } from "@/components/shell/nav-config";

type SessionUser = {
  id: string;
  name?: string | null;
  email: string;
  isCouple: boolean;
  role: string;
  darkMode: boolean | null;
};

async function getCounts(user: SessionUser): Promise<Counts> {
  // v2.5.0: mirrors listPendingProposals' own visibility rule (see
  // ai/actions.ts) — non-couple users only see proposals they
  // created themselves, the couple sees everyone's. Gated behind the
  // same AI_ENABLED + ai_chat checks the chat panel itself uses so the
  // nav badge never counts proposals a user couldn't otherwise reach.
  const aiVisible = AI_ENABLED && (await canView(user, "ai_chat"));
  const [tasks, questions, guests, payments, aiProposals] = await Promise.all([
    db.task.count({ where: { status: { not: "DONE" }, type: "TASK" } }),
    // v1.18.0: count both QUESTIONs and DECISIONs — they share the
    // /questions surface and the nav label says "Questions & Decisions".
    // Decisions in DONE status are excluded the same way questions are.
    db.task.count({ where: { status: { not: "DONE" }, type: { in: ["QUESTION", "DECISION"] } } }),
    db.guest.count({ where: { rsvp: "PENDING", archived: false } }),
    user.isCouple
      ? db.payment.count({ where: { status: { in: ["DUE", "SCHEDULED", "OVERDUE"] } } })
      : Promise.resolve(0),
    aiVisible
      ? db.aiProposal.count({
          where: {
            status: "PENDING",
            ...(user.isCouple ? {} : { createdById: user.id }),
          },
        })
      : Promise.resolve(0),
  ]);
  return { tasks, questions, guests, payments, aiProposals };
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
    // v1.62.0: ConfirmProvider wraps the whole shell so any descendant
    // can call useConfirm() without per-page wiring. The provider
    // mounts a single shared dialog at z-[500] that's reused across
    // every confirm call. Replaces the ~40 native confirm() calls.
    <ConfirmProvider>
      <div className="flex h-screen bg-canvas overflow-hidden">
        <Sidebar user={user} counts={counts} signOutAction={signOutAction} />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </main>
        <MobileTabBar isCouple={user.isCouple} signOutAction={signOutAction} />
        <QuickCapture />
        <Toaster />
        {/* v2.1.0: AI planner side panel + floating trigger. Renders
            null when the user lacks ai_chat access or AI_ENABLED=false. */}
        <ChatPanelHost />
      </div>
    </ConfirmProvider>
  );
}
