import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { isoForInput } from "@/lib/format";
import { EmptySchedule, EmptyState } from "@/components/ui/Illustrations";
import { ScheduleClient } from "./ScheduleClient";
import { AddEventToggle } from "./AddEventToggle";
import { PrintScheduleButton } from "./PrintScheduleButton";
import {
  BUILTIN_GROUPS,
  resolveBuiltinGroup,
  displayName,
} from "@/lib/group-members";

export default async function SchedulePage() {
  const user = await requireUser();
  const editable = await canEdit(user, "schedule");
  const wedding = await getWeddingSettings();

  // v1.41.0 (backlog #4): pull users + custom groups so the form can
  // render the polymorphic attendee picker. Built-in groups are
  // computed (not stored), but their member counts depend on User
  // rows, so we evaluate them here once and pass to the client.
  const [events, users, customGroups] = await Promise.all([
    db.scheduleEvent.findMany({
      orderBy: [{ startTime: "asc" }, { order: "asc" }],
    }),
    db.user.findMany({
      orderBy: [{ isCouple: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true,
        firstName: true, lastName: true, role: true, isCouple: true,
      },
    }),
    db.permissionGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { members: { select: { id: true } } },
    }),
  ]);
  // Group options for the picker — built-ins first, then custom.
  // Empty groups (zero members) are still selectable; the editor
  // shows the count so the couple knows what they're picking.
  const groupOpts = [
    ...BUILTIN_GROUPS.map((g) => ({
      ref: `builtin:${g.slug}`,
      name: g.name,
      memberCount: resolveBuiltinGroup(g.slug, users).length,
    })),
    ...customGroups.map((g) => ({
      ref: `group:${g.slug}`,
      name: g.name,
      memberCount: g.members.length,
    })),
  ];
  const userOpts = users.map((u) => ({
    id: u.id,
    name: displayName(u) || u.name,
    email: u.email,
  }));

  // v2.5.0 (design pass #7): nearly every schedule entry lands on the
  // wedding day itself — prefill the new-event form's Date field
  // rather than making the couple pick it every time.
  const defaultStartDate = isoForInput(wedding.weddingDate);

  return (
    <>
      {/* v2.5.0 (design pass #11): grounded date + venue, replacing the
          abstract "8 events, 8 upcoming" count — matches the
          prototype's subtitle and the convention already used on
          /budget and /payments' print letterheads. */}
      <PageHeader
        title="Schedule"
        subtitle={`${formatWeddingDate(wedding)} · ${wedding.venue}`}
        actions={
          <>
            <PrintScheduleButton />
            {editable && (
              <AddEventToggle users={userOpts} groups={groupOpts} defaultStartDate={defaultStartDate} />
            )}
          </>
        }
      />
      <div className="flex-1 overflow-auto schedule-page">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Print-only letterhead */}
          <div className="print-only-block border-b-2 border-ink-primary pb-3 mb-6">
            <h1 className="font-display text-2xl text-ink-primary">{wedding.coupleLabel}</h1>
            <div className="text-xs text-ink-tertiary mt-1">
              Running schedule · {wedding.venue}
            </div>
          </div>

          {events.length === 0 ? (
            <EmptyState
              illustration={EmptySchedule}
              title="No events yet"
              body={editable ? "Add the first one above to start your day-of timeline." : "The couple hasn't scheduled anything yet."}
            />
          ) : (
            <ScheduleClient
              events={events.map((e) => ({
                id: e.id,
                title: e.title,
                startTime: e.startTime,
                endTime: e.endTime,
                location: e.location,
                // v1.41.0: attendeeRefs is the new shape; legacy
                // attendeeIds passed alongside for one-release back-
                // compat (reader expands missing refs from ids).
                attendeeRefs: e.attendeeRefs,
                attendeeIds: e.attendeeIds,
                allDay: e.allDay,
                notes: e.notes,
              }))}
              users={userOpts}
              groups={groupOpts}
              canEdit={editable}
              currentUserId={user.id}
            />
          )}
        </div>
      </div>
    </>
  );
}
