import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, isAllowed } from "@/auth";
import { getWeddingSettings, formatWeddingDateShort } from "@/lib/wedding-settings";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "./SubmitButton";

async function startSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    redirect("/signin?error=invalid");
  }
  if (!(await isAllowed(email))) {
    redirect("/signin/error?error=AccessDenied");
  }
  // v1.50.0: stash the email in a short-lived cookie so the
  // verify page can pre-fill the email field. Cookie scoped to
  // /signin so it doesn't leak elsewhere; httpOnly so client JS
  // can't read it. Lifetime matches the verification-token TTL
  // (15 min). Auth.js redirects to pages.verifyRequest after
  // sending — that's `/signin/verify`.
  const cookieStore = await cookies();
  cookieStore.set("signin-email", email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/signin",
  });
  await signIn("nodemailer", { email, redirectTo: "/" });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error } = await searchParams;
  const wedding = await getWeddingSettings();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7">
        <h1 className="font-display text-3xl font-semibold text-moss-700 mb-1">
          Wedding Hub
        </h1>
        <p className="text-xs text-ink-tertiary mb-6">
          {wedding.brideFirst} &amp; {wedding.groomFirst} · {formatWeddingDateShort(wedding)}
        </p>
        <form action={startSignIn} className="flex flex-col gap-3">
          {/* v2.5.0: Input's `label` prop wires htmlFor/id — the
              previous sibling <label> had no association, so screen
              readers announced the field as unlabeled. */}
          <Input
            label="Email"
            type="email"
            name="email"
            required
            autoFocus
            placeholder="you@example.com"
          />
          {/* v2.5.0 (design pass #5): pending state so a slow email
              send can't be double-clicked into sending twice. */}
          <SubmitButton pendingLabel="Sending…" className="mt-2">
            Email me a sign-in code
          </SubmitButton>
        </form>
        {error === "invalid" && (
          <p className="text-xs text-danger mt-4">
            Please enter a valid email address.
          </p>
        )}
        {error === "expired" && (
          <p className="text-xs text-marigold-700 mt-4">
            Your sign-in session timed out. Enter your email to get a new code.
          </p>
        )}
        <p className="text-xs text-ink-tertiary mt-6">
          Sign-in is restricted to the wedding party. If you weren&apos;t given
          access, contact {wedding.brideFirst} or {wedding.groomFirst}.
        </p>
      </div>
    </div>
  );
}
