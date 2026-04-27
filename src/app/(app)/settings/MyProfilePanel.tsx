"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { setMyName } from "@/app/welcome/actions";

export function MyProfilePanel({
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
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = firstName !== initialFirstName || lastName !== initialLastName;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("firstName", firstName);
      fd.set("lastName", lastName);
      const result = await setMyName(fd);
      if (result?.ok === false) setError(result.error);
      else setSavedAt(Date.now());
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-4">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Your profile</h2>
        <p className="text-xs text-ink-tertiary">
          Signed in as <span className="text-ink-secondary">{email}</span>. Your name appears
          on the sidebar, in the members list, and as the assignee on tasks you take.
        </p>
      </header>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              First name
            </label>
            <Input
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setSavedAt(null);
              }}
              required
              disabled={pending}
              placeholder="Jamie"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Last name
            </label>
            <Input
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setSavedAt(null);
              }}
              required
              disabled={pending}
              placeholder="Spencer"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {error && <span className="text-xs text-danger flex-1">{error}</span>}
          {savedAt && !dirty && !error && (
            <span className="text-xs text-moss-700 flex-1">Saved.</span>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending || !dirty || !firstName.trim() || !lastName.trim()}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
