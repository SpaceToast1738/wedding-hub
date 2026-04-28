import { redirect } from "next/navigation";
import { signIn, isAllowed } from "@/auth";
import { getWeddingSettings, formatWeddingDateShort } from "@/lib/wedding-settings";

async function startSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    redirect("/signin?error=invalid");
  }
  if (!isAllowed(email)) {
    redirect("/signin/error?error=AccessDenied");
  }
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
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-2 outline-none focus:border-moss-500"
          />
          <button
            type="submit"
            className="text-sm font-medium bg-moss-500 text-white rounded-sm px-3 py-2 mt-2 hover:bg-moss-700 transition-colors"
          >
            Send magic link
          </button>
        </form>
        {error === "invalid" && (
          <p className="text-xs text-danger mt-4">
            Please enter a valid email address.
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
