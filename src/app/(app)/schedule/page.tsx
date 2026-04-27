import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { EventRow } from "./EventRow";
import { AddEventToggle } from "./AddEventToggle";

export default async function SchedulePage() {
  const user = await requireUser();
  const editable = await canEdit(user, "schedule");

  const events = await db.scheduleEvent.findMany({
    orderBy: [{ startTime: "asc" }, { order: "asc" }],
  });

  const total = events.length;
  const upcoming = events.filter((e) => e.startTime >= new Date()).length;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`${total} events · ${upcoming} upcoming`}
        actions={editable ? <AddEventToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {events.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No events yet. {editable && "Add the first one above."}
            </p>
          ) : (
            <ol className="bg-surface border border-border-soft rounded-md shadow-sm divide-y divide-border-soft px-3">
              {events.map((e) => (
                <EventRow key={e.id} event={e} canEditSection={editable} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
