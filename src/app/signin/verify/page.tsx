import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7 text-center">
        <div className="text-4xl mb-3">📬</div>
        <h1 className="font-display text-2xl font-semibold text-moss-700 mb-2">
          Check your inbox
        </h1>
        <p className="text-sm text-ink-secondary mb-5">
          We&apos;ve sent a sign-in link to your email. The link will expire in
          24 hours.
        </p>
        <p className="text-xs text-ink-tertiary">
          Didn&apos;t receive anything?{" "}
          <Link href="/signin" className="text-moss-500 underline">
            Try again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
