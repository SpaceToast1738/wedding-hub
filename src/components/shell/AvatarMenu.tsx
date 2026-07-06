"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { setDarkModePreference } from "@/app/(app)/actions";

type Props = {
  user: { id: string; name?: string | null; email: string; isCouple: boolean; role: string; darkMode: boolean | null };
  signOutAction: () => Promise<void>;
};

const ROLE_LABELS: Record<string, string> = {
  COUPLE: "Couple",
  WEDDING_PARTY: "Wedding party",
  PLANNER: "Planner",
  VIEWER: "Viewer",
};

export function AvatarMenu({ user, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // B11: reconcile DB pref → localStorage on mount. The pre-hydration
  // DarkModeScript can only see localStorage; the DB value lands here
  // (server-rendered into props) and we sync it forward so the next
  // page load on this device paints correctly without a flash.
  useEffect(() => {
    if (typeof user.darkMode === "boolean") {
      setDark(user.darkMode);
      const cls = document.documentElement.classList;
      if (user.darkMode) cls.add("dark"); else cls.remove("dark");
      try {
        localStorage.setItem("wh-theme", user.darkMode ? "dark" : "light");
      } catch {}
      return;
    }
    // No DB pref — fall back to whatever the inline script applied.
    setDark(document.documentElement.classList.contains("dark"));
  }, [user.darkMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      try { localStorage.setItem("wh-theme", "dark"); } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try { localStorage.setItem("wh-theme", "light"); } catch {}
    }
    // Fire-and-forget DB sync so the choice rides along to other devices.
    // If the action fails, the UI doesn't roll back — localStorage is
    // already authoritative on this device for this session.
    void setDarkModePreference(next).catch(() => {});
  }

  const displayName = user.name ?? user.email;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full p-1.5 rounded-sm hover:bg-surface text-left cursor-pointer"
      >
        <Avatar name={displayName} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-ink-primary truncate">{displayName}</div>
          <div className="text-[10px] text-ink-tertiary">{roleLabel}</div>
        </div>
        <span className="text-[10px] text-ink-tertiary">▾</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border-soft rounded-md shadow-lg z-50 py-1.5 max-h-[480px] overflow-auto"
        >
          <div className="px-3.5 pt-1 pb-2 text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
            Signed in
          </div>
          <div className="px-3.5 pb-2 text-xs text-ink-secondary truncate">{user.email}</div>
          <div className="border-t border-border-soft my-1" />
          <button
            onClick={toggleDark}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-ink-secondary hover:bg-muted text-left cursor-pointer"
          >
            <span className="w-4 text-center">{dark ? "☀" : "☾"}</span>
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-ink-secondary hover:bg-muted"
          >
            <span className="w-4 text-center">⚙</span>
            Settings
          </Link>
          <div className="border-t border-border-soft my-1" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-ink-secondary hover:bg-muted text-left cursor-pointer"
            >
              <span className="w-4 flex items-center justify-center">
                <LogOut aria-hidden className="w-3.5 h-3.5" />
              </span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
