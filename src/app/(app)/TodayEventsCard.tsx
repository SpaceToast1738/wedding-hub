"use client";

import { useState } from "react";
import Link from "next/link";

type EventLite = {
  id: string;
  title: string;
  startTime: Date;
  location: string | null;
  // v1.30.5: replaces v1.27.x's persona-based `audience` (column dropped
  // this release). User IDs of who's expected at the event. Empty array
  // = everyone.
  attendeeIds: string[];
  // v1.27.9: when true, render "All day" instead of the time. Pre-fix
  // all-day events showed as 01:00 / midnight depending on browser
  // locale because we just toLocaleTimeString'd whatever was stored
  // (midnight UTC, which renders as 01:00 in BST).
  allDay: boolean;
};

type Persona = "mine" | "everyone";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TodayEventsCard({
  events,
  currentUserId,
}: {
  events: EventLite[];
  // v1.30.5: replaces currentUserRole. The "Mine" persona now matches
  // attendeeIds against this user's id. Empty attendeeIds = everyone
  // (so they always show in "Mine").
  currentUserId: string;
}) {
  // v1.19.0: default to "mine" — most useful default for wedding-party
  // users (Aimee/Josh) who care about the events that involve them.
  // The couple can flip to Everyone in one click.
  const [persona, setPersona] = useState<Persona>("mine");

  const filtered =
    persona === "everyone"
      ? events
      : events.filter((e) => e.attendeeIds.length === 0 || e.attendeeIds.includes(currentUserId));

  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Upcoming events</h2>
        <div className="flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
          {(["mine", "everyone"] as Persona[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPersona(p)}
              className={[
                "text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-colors",
                persona === p
                  ? "bg-moss-700 text-white"
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
        <p className="text-xs text-ink-tertiary py-2 flex-1">
          {persona === "mine" ? "No events for you." : "No events scheduled."}
        </p>
      ) : (
        <ul className="space-y-3 flex-1">
          {filtered.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span className="text-xs font-medium text-moss-700 w-14 flex-shrink-0 pt-0.5">
                {e.allDay ? "All day" : formatTime(new Date(e.startTime))}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-primary font-medium truncate">{e.title}</div>
                {e.attendeeIds.length > 0 && (
                  <div className="text-[11px] text-ink-tertiary">
                    {e.attendeeIds.length} attending
                  </div>
                )}
              </div>
              <span className="text-[11px] text-ink-tertiary flex-shrink-0 pt-0.5">
                {formatDate(new Date(e.startTime))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/schedule"
        className="block mt-4 pt-3 border-t border-border-soft text-xs text-moss-500 hover:text-moss-700 hover:underline"
      >
        Full schedule →
      </Link>
    </section>
  );
}
