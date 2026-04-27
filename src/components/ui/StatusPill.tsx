type Status =
  | "YES" | "NO" | "PENDING" | "BOOKED" | "PAID" | "LEAD" | "DECLINED"
  | "TODO" | "DOING" | "DONE" | "SCHEDULED" | "OVERDUE"
  | "HIGH" | "MED" | "LOW" | "ADULT" | "CHILD";

const STATUS_CLASSES: Record<Status, string> = {
  YES:       "bg-moss-50 text-moss-700 border-moss-100",
  NO:        "bg-danger-bg text-danger border-danger-border",
  PENDING:   "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
  BOOKED:    "bg-moss-50 text-moss-700 border-moss-100",
  PAID:      "bg-[color:#eef4f5] text-info border-[color:#d0e4e8] dark:bg-muted dark:border-border-soft",
  LEAD:      "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
  DECLINED:  "bg-danger-bg text-danger border-danger-border",
  TODO:      "bg-muted text-ink-secondary border-border-soft",
  DOING:     "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
  DONE:      "bg-moss-50 text-moss-700 border-moss-100",
  SCHEDULED: "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
  OVERDUE:   "bg-danger-bg text-danger border-danger-border",
  HIGH:      "bg-danger-bg text-danger border-danger-border",
  MED:       "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
  LOW:       "bg-moss-50 text-moss-700 border-moss-100",
  ADULT:     "bg-muted text-ink-secondary border-border-soft",
  CHILD:     "bg-marigold-100 text-marigold-700 border-[color:#f0d9a8] dark:border-marigold-700",
};

export function StatusPill({
  status,
  label,
  size = "sm",
}: {
  status: Status | string;
  label?: string;
  size?: "sm" | "md";
}) {
  const cls = STATUS_CLASSES[status as Status] ?? STATUS_CLASSES.TODO;
  return (
    <span
      className={[
        "inline-flex items-center font-medium rounded-sm border tracking-tight",
        size === "sm" ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5",
        cls,
      ].join(" ")}
    >
      {label ?? status}
    </span>
  );
}
