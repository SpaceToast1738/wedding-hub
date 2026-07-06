import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getWeddingSettings } from "@/lib/wedding-settings";

function buildMessages(brideFirst: string, groomFirst: string): Record<string, { title: string; body: string }> {
  return {
    AccessDenied: {
      title: "Not on the guest list",
      body: `That email isn't on the Wedding Hub allow-list. If you should have access, ask ${brideFirst} or ${groomFirst} to add you.`,
    },
    Verification: {
      title: "Link expired",
      body: "That sign-in link has already been used or has expired. Request a new one.",
    },
    Configuration: {
      title: "Server problem",
      body: `Sign-in is misconfigured on the server. Tell ${groomFirst}.`,
    },
    Default: {
      title: "Something went wrong",
      body: `We couldn't sign you in. Try again, or tell ${groomFirst} if it keeps happening.`,
    },
  };
}

export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error = "Default" } = await searchParams;
  const wedding = await getWeddingSettings();
  const messages = buildMessages(wedding.brideFirst, wedding.groomFirst);
  const m = messages[error] ?? messages.Default!;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7 text-center">
        <div className="flex justify-center mb-3 text-marigold-700">
          <AlertTriangle aria-hidden className="w-10 h-10" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-danger mb-2">
          {m.title}
        </h1>
        <p className="text-sm text-ink-secondary mb-5">{m.body}</p>
        <Link
          href="/signin"
          className="inline-block text-sm font-medium bg-moss-500 text-on-moss rounded-sm px-3 py-2"
        >
          Back to sign-in
        </Link>
      </div>
    </div>
  );
}
