export function formatDate(d: Date | null | undefined, fmt: "short" | "long" | "time" = "short"): string {
  if (!d) return "—";
  if (fmt === "long") return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (fmt === "time") return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelativeDue(due: Date | null | undefined): string {
  if (!due) return "—";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return `Overdue · ${formatDate(due)}`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return formatDate(due);
}

export function formatMoney(amount: number | null | undefined, currency = "GBP"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatMoneyDecimal(amount: { toString: () => string } | null | undefined, currency = "GBP"): string {
  if (amount == null) return "—";
  const n = Number(amount.toString());
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function isoForInput(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function isoDateTimeForInput(d: Date | null | undefined): string {
  if (!d) return "";
  // YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
