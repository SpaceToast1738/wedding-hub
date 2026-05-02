"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { createInvite, revokeInvite, resendInvite } from "./invite-actions";

type Invite = {
  id: string;
  email: string;
  role: string;
  isCouple: boolean;
  status: string;
  createdAt: Date;
};

export function InviteBlock({ invites }: { invites: Invite[] }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [isCouple, setIsCouple] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingInvites = invites.filter((i) => i.status === "PENDING");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("role", isCouple ? "VIEWER" : role);
    fd.set("isCouple", String(isCouple));
    startTransition(async () => {
      const res = await createInvite(fd);
      if (res.ok) {
        notify("success", `Invite sent to ${email}`);
        setEmail("");
        setRole("VIEWER");
        setIsCouple(false);
      } else {
        setError(res.error);
      }
    });
  }

  function revoke(id: string, inviteEmail: string) {
    startTransition(async () => {
      const res = await revokeInvite(id);
      if (res.ok) notify("success", `Invite for ${inviteEmail} revoked`);
      else notify("error", res.error);
    });
  }

  function resend(id: string, inviteEmail: string) {
    startTransition(async () => {
      const res = await resendInvite(id);
      if (res.ok) notify("success", `Invite resent to ${inviteEmail}`);
      else notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Invite someone</h2>
        <p className="text-xs text-ink-tertiary mt-0.5">
          Send an invite to add a new member. Their role and permissions are set here; they sign in with their email as usual.
        </p>
      </header>

      <form onSubmit={submit} className="px-4 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              required
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={isCouple ? "COUPLE" : role}
              disabled={pending || isCouple}
              onChange={(e) => {
                if (e.target.value === "COUPLE") {
                  setIsCouple(true);
                } else {
                  setIsCouple(false);
                  setRole(e.target.value);
                }
              }}
              className="text-sm bg-canvas border border-border-soft rounded-sm px-2 py-[7px] text-ink-primary outline-none disabled:opacity-50 h-[38px]"
            >
              <option value="VIEWER">Viewer</option>
              <option value="WEDDING_PARTY">Wedding party</option>
              <option value="PLANNER">Planner</option>
              <option value="COUPLE">Couple</option>
            </select>
          </div>
        </div>
        {isCouple && (
          <p className="text-xs text-marigold-700">
            ⚠ Couple-tier gives full edit access to every section including budget and payments.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={pending || !email}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </form>

      {pendingInvites.length > 0 && (
        <div className="border-t border-border-soft">
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">
            Pending invites
          </p>
          <ul className="divide-y divide-border-soft">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-ink-primary truncate block">{inv.email}</span>
                  <span className="text-[11px] text-ink-tertiary">
                    {inv.isCouple ? "couple" : inv.role.replace("_", " ").toLowerCase()}
                    {" · "}invited {new Date(inv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => resend(inv.id, inv.email)}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => revoke(inv.id, inv.email)}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
