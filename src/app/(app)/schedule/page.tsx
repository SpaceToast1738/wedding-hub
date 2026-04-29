import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { EmptySchedule, EmptyState } from "@/components/ui/Illustrations";
import { ScheduleClient } from "./ScheduleClient";
import { AddEventToggle } from "./AddEventToggle";
import { PrintScheduleButton } from "./PrintScheduleButton";

export default async function SchedulePage() {
  const user = await requireUser();
  const editable = await canEdit(user, "schedule");
  const wedding = await getWeddingSettings();

  const [events, users] = await Promise.all([
    db.scheduleEvent.findMany({
      orderBy: [{ startTime: "asc" }, { order: "asc" }],
    }),
    // v1.27.1: attendee picker reads from the User table (admin
    // accounts only — guests are managed via Say I Do, not here).
    db.user.findMany({
      orderBy: [{ isCouple: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const total = events.length;
  const upcoming = events.filter((e) => e.startTime >= new Date()).length;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`${total} events · ${upcoming} upcoming`}
        actions={
          <>
            <PrintScheduleButton />
            {editable && <AddEventToggle users={users} />}
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
                attendeeIds: e.attendeeIds,
                allDay: e.allDay,
                notes: e.notes,
              }))}
              users={users}
              canEdit={editable}
            />
          )}
        </div>
      </div>
    </>
  );
}
