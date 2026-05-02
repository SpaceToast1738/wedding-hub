import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { WelcomeForm } from "./WelcomeForm";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) redirect("/signin");

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, name: true, email: true },
  });

  // Already named — kick them to the app. The (app) layout's gate uses
  // the same condition, so a user who lands here on purpose post-setup
  // doesn't get a stale prompt.
  if (dbUser?.firstName) redirect("/");

  // Best-effort prefill: if the legacy `name` field is set (e.g., via the
  // seed) but firstName/lastName aren't, split it on the first space.
  let initialFirstName = "";
  let initialLastName = "";
  if (dbUser?.name) {
    const parts = dbUser.name.trim().split(/\s+/);
    initialFirstName = parts[0] ?? "";
    initialLastName = parts.slice(1).join(" ");
  }

  return (
    <WelcomeForm
      email={dbUser?.email ?? session.user.email}
      initialFirstName={initialFirstName}
      initialLastName={initialLastName}
      signOutAction={signOutAction}
    />
  );
}
