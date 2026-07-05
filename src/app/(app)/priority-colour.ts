// Design-pass fix (v2.5.x): TodayTaskList and glance/page.tsx each had
// their own priority→colour mapping and the two disagreed with each
// other (and with the prototype, which always uses danger for
// URGENT/HIGH). Single shared helper so future priority-styled UI
// can't drift out of sync again — swap the Tailwind class here and
// every caller follows.
export function priorityBarColour(priority: string): string {
  if (priority === "URGENT" || priority === "HIGH") return "bg-danger";
  if (priority === "MEDIUM") return "bg-marigold-500";
  return "bg-border-strong";
}
