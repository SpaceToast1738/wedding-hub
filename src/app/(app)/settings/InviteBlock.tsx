"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import { createInvite, revokeInvite, resendInvite } from "./invite-actions";
import type { Section } from "@/lib/permissions";

type Invite = {
  id: string;
  email: string;
  role: string;
  isCouple: boolean;
  status: string;
  createdAt: Date;
};

type PreviewRole = "VIEWER" | "WEDDING_PARTY" | "PLANNER";
type PermRow = { section: string; level: "NONE" | "VIEW" | "EDIT" };

// Mirrors the SECTION_LABELS map duplicated in PermissionGroupsBlock
// and MemberOverridesBlock — same per-file convention, not lifted to
// a shared module.
const SECTION_LABELS: Record<Section, string> = {
  tasks: "Tasks",
  questions: "Questions",
  schedule: "Schedule",
  suppliers: "Suppliers",
  guests: "Guests",
  seating: "Seating",
  songs: "Songs",
  files: "Files",
  book: "Wedding Book",
  budget: "Budget",
  payments: "Payments",
  money: "Money values",
  settings: "Settings",
  ai_chat: "AI chat",
  ai_write: "AI proposals",
};

// v2.5.0 (design pass #4): what a role actually grants, rendered
// live under the role select. Previously only Couple carried any
// warning about consequences — Viewer/Wedding party/Planner gave no
// indication at all, so granting access required the couple to
// remember from memory what each role unlocks at the single
// highest-stakes moment on the page. Mirrors the PermissionsSummary
// pattern already used in PermissionGroupsBlock/MemberOverridesBlock.
function RolePermissionsSummary({ perms }: { perms: PermRow[] }) {
  const editLabels: string[] = [];
  const viewLabels: string[] = [];
  for (const p of perms) {
    const label = SECTION_LABELS[p.section as Section] ?? p.section;
    if (p.level === "EDIT") editLabels.push(label);
    else if (p.level === "VIEW") viewLabels.push(label);
  }
  if (editLabels.length === 0 && viewLabels.length === 0) {
    return (
      <p className="text-xs text-ink-tertiary italic">
        This role has no access granted yet — set it up in the Permission groups panel.
      </p>
    );
  }
  return (
    <p className="text-xs text-ink-secondary">
      <span className="text-ink-tertiary">This role will be able to:</span>{" "}
      {editLabels.length > 0 && (
        <>
          <span className="font-semibold text-moss-700">Edit:</span> {editLabels.join(", ")}
        </>
      )}
      {editLabels.length > 0 && viewLabels.length > 0 && (
        <span className="mx-1.5 text-ink-tertiary">·</span>
      )}
      {viewLabels.length > 0 && (
        <>
          <span className="font-semibold">View:</span> {viewLabels.join(", ")}
        </>
      )}
    </p>
  );
}

export function InviteBlock({
  invites,
  rolePermissions,
}: {
  invites: Invite[];
  /** v2.5.0 (design pass #4): per-role permission summary, computed
   *  server-side the same way the real resolver would for a freshly-
   *  invited user with that role. */
  rolePermissions: Record<PreviewRole, PermRow[]>;
}) {
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
          <Input
            label="Email"
            wrapperClassName="flex-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            required
            disabled={pending}
          />
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
        {/* v2.5.0 (design pass #4): live permission consequence of the
            current role selection — updates as the select changes. */}
        {isCouple ? (
          <p className="text-xs text-marigold-700 flex items-start gap-1">
            <AlertTriangle aria-hidden className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Couple-tier gives full edit access to every section including budget and payments.</span>
          </p>
        ) : (
          <RolePermissionsSummary perms={rolePermissions[role as PreviewRole] ?? []} />
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
                    {/* v2.5.0 (design pass #4): relative time, matching
                        the app's other relative-date conventions
                        (timeAgo is already used on the activity feed
                        etc.) instead of an absolute "2 Jan". */}
                    {" · "}invited {timeAgo(new Date(inv.createdAt))}
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
