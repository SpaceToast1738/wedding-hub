// v2.1.0 phase 1: ChatPanelHost — mounted once at the app-shell
// layout. Server component so the auth + permission checks happen
// server-side; forwards allowed=true|false into the client panel,
// which decides whether to render the floating button + slide-out.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import { AI_ENABLED } from "@/lib/ai/config";
import { ChatPanel } from "./ChatPanel";

export async function ChatPanelHost() {
  if (!AI_ENABLED) return null;

  const session = await auth();
  if (!session?.user?.id) return null;

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isCouple: true, role: true, email: true, name: true, firstName: true },
  });
  if (!dbUser) return null;

  const allowed = await canView(
    { id: dbUser.id, isCouple: dbUser.isCouple },
    "ai_chat",
  );
  if (!allowed) return null;

  return (
    <ChatPanel
      user={{
        id: dbUser.id,
        firstName: dbUser.firstName ?? dbUser.name ?? "there",
      }}
    />
  );
}
