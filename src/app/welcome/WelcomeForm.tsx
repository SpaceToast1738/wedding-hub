"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { setMyName } from "./actions";

export function WelcomeForm({
  email,
  initialFirstName,
  initialLastName,
}: {
  email: string;
  initialFirstName: string;
  initialLastName: string;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("firstName", firstName);
      fd.set("lastName", lastName);
      // Pass redirectTo so the action throws NEXT_REDIRECT on success and we
      // never have to reason about a returned ok:true here.
      const result = await setMyName(fd, "/");
      // Only reached on validation failure (server returns instead of redirecting).
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-surface border border-border-soft rounded-lg shadow-md p-7"
      >
        <h1 className="font-display text-3xl font-semibold text-moss-700 mb-1">
          Welcome to Wedding Hub
        </h1>
        <p className="text-xs text-ink-tertiary mb-6">
          Signed in as <span className="text-ink-secondary">{email}</span>
        </p>
        <p className="text-sm text-ink-secondary mb-5">
          Tell us your name so the rest of the wedding party knows who they&apos;re working with. You can change this any time from Settings.
        </p>
        <div className="space-y-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              First name
            </label>
            <Input
              name="firstName"
              required
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jamie"
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Last name
            </label>
            <Input
              name="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Spencer"
              disabled={pending}
            />
          </div>
        </div>
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={pending || !firstName.trim() || !lastName.trim()}
          className="w-full justify-center mt-2"
        >
          {pending ? "Saving…" : "Continue →"}
        </Button>
      </form>
    </div>
  );
}
