"use client";

import { useState } from "react";
import Link from "next/link";

type EventLite = {
  id: string;
  title: string;
  startTime: Date;
  location: string | null;
  audience: string[];
};

type Persona = "mine" | "everyone";

// Map a session-user role to the audience tag we filter on. The current
// audience strings on ScheduleEvent are free-form ("couple", "party",
// "guests", "suppliers", "everyone") so we match by lowercase substring.
function audienceMatchesRole(audience: string[], role: string): boolean {
  if (audience.length === 0) return true; // unspecified = everyone
  const lower = audience.map((a) => a.toLowerCase());
  if (lower.includes("everyone")) return true;
  const r = role.toLowerCase();
  if (r === "couple" && (lower.includes("couple") || lower.includes("bride") || lower.includes("groom"))) return true;
  if (r === "wedding_party" && (lower.includes("party") || lower.includes("wedding party"))) return true;
  if (r === "planner" && (lower.includes("planner") || lower.includes("suppliers"))) return true;
  return false;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TodayEventsCard({
  events,
  currentUserRole,
}: {
  events: EventLite[];
  currentUserRole: string;
}) {
  const [persona, setPersona] = useState<Persona>("everyone");

  const filtered =
    persona === "everyone"
      ? events
      : events.filter((e) => audienceMatchesRole(e.audience, currentUserRole));

  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-ink-primary">Upcoming</h2>
        <div className="flex gap-px">
          {(["mine", "everyone"] as Persona[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPersona(p)}
              className={[
                "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                persona === p
                  ? "bg-moss-500 text-white"
                  : "text-ink-tertiary hover:text-ink-primary",
              ].join(" ")}
              aria-pressed={persona === p}
            >
              {p === "mine" ? "Mine" : "Everyone"}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-ink-tertiary py-2">
          {persona === "mine" ? "No events for your role." : "No events scheduled."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-moss-700 w-16 flex-shrink-0">
                {formatTime(new Date(e.startTime))}
              </span>
              <span className="text-xs text-ink-secondary flex-1 truncate">{e.title}</span>
              <span className="text-[10px] text-ink-tertiary flex-shrink-0">
                {formatDate(new Date(e.startTime))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/schedule"
        className="block mt-3 text-xs text-moss-500 hover:text-moss-700 hover:underline"
      >
        Full schedule →
      </Link>
    </section>
  );
}
