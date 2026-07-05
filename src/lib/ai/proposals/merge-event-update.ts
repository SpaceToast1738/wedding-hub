// v2.4.0: pure merge logic for event.update attendee deltas.
//
// The trap this module defuses: updateScheduleEvent (src/app/(app)/
// schedule/actions.ts) REPLACES the attendeeRefs array wholesale on
// every save AND unconditionally zeroes the legacy attendeeIds
// column. Two consequences for an apply bridge:
//
//   1. A pre-v1.41 row may still carry its attendees ONLY in the
//      legacy attendeeIds column (attendeeRefs empty). Merging
//      against attendeeRefs alone would post an empty-ish set and the
//      update would wipe those attendees permanently — the action
//      clears attendeeIds and writes only what was posted. So the
//      legacy expansion below is MANDATORY, mirroring the action's
//      own diff logic: attendeeRefs when non-empty, else each
//      attendeeIds entry promoted to "user:<id>".
//
//   2. "group:<slug>" refs are human-picker territory (the propose
//      tool rejects them in addAttendeeRefs), but they MUST survive
//      the merge untouched unless explicitly removed — the exact
//      analogue of merge-task-update's bookSubsectionIds passthrough.
//
// So: proposals carry add/remove DELTAS; at apply time the bridge
// loads the live row, merges here, and posts the full merged list.
// Pure function — unit-tested in tests/unit/merge-event-update.test.ts.

/** Apply attendee deltas to the event's live refs. Order is stable:
 *  surviving existing refs first (original order), then adds appended
 *  in delta order. Adds dedupe against existing refs; removing a ref
 *  that isn't present is a no-op; remove wins when the same ref is
 *  both added and removed. */
export function mergeAttendeeRefs(
  before: { attendeeRefs: string[]; attendeeIds: string[] },
  add: string[] | undefined,
  remove: string[] | undefined,
): string[] {
  const current = before.attendeeRefs.length
    ? before.attendeeRefs
    : before.attendeeIds.map((id) => `user:${id}`);

  const removeSet = new Set(remove ?? []);
  const out = current.filter((ref) => !removeSet.has(ref));
  const seen = new Set(out);
  for (const ref of add ?? []) {
    if (seen.has(ref) || removeSet.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}
