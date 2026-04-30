// v1.39.1: pure helper — relative-time string for the recent-activity
// feed. Kept dependency-free (no Intl.RelativeTimeFormat / no
// date-fns) so the bundle stays tight and the contract is unit-
// testable without any setup.
//
// Resolution scales with how recent the timestamp is — "just now"
// for sub-minute, "5 min ago" / "3 hr ago" / "yesterday" / "2 days
// ago" / "3 weeks ago" / specific date for older. Capped at "X
// weeks ago" then falls through to a `dd Mon` short date so the
// feed doesn't say "47 weeks ago".

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function timeAgo(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();

  // Future timestamps — clamp to "just now" so a slightly-skewed
  // server clock doesn't render a confusing "in 3 sec" sentence.
  if (diff < 0) return "just now";

  if (diff < 30 * SECOND) return "just now";
  if (diff < MINUTE) return `${Math.floor(diff / SECOND)} sec ago`;
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hr ago`;
  }
  // 1–2 days renders "yesterday" because that reads more naturally
  // than "1 day ago".
  if (diff < 2 * DAY) return "yesterday";
  if (diff < WEEK) {
    const d = Math.floor(diff / DAY);
    return `${d} days ago`;
  }
  if (diff < 6 * WEEK) {
    const w = Math.floor(diff / WEEK);
    return `${w} ${w === 1 ? "week" : "weeks"} ago`;
  }
  // Past ~6 weeks, fall through to a short date so the feed stays
  // readable without growing to "47 weeks ago".
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
