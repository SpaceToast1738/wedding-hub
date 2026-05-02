import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/actions";
import { canView } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { PrintButton } from "./PrintButton";

type GuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  isChild: boolean;
  needsHighchair: boolean;
  childrenMeal: boolean;
  dietary: string[];
  notes: string | null;
  mealStarter: string | null;
  mealMain: string | null;
  mealDessert: string | null;
  household: { name: string };
  tableSeat: {
    index: number;
    table: { id: string; name: string };
  } | null;
};

// Group guests by table; "Unassigned" bucket goes last.
function groupByTable(guests: GuestRow[]): Array<{
  tableId: string | null;
  tableName: string;
  guests: GuestRow[];
}> {
  const byTable = new Map<string, { tableName: string; guests: GuestRow[] }>();
  const unseated: GuestRow[] = [];
  for (const g of guests) {
    if (g.tableSeat) {
      const id = g.tableSeat.table.id;
      if (!byTable.has(id)) byTable.set(id, { tableName: g.tableSeat.table.name, guests: [] });
      byTable.get(id)!.guests.push(g);
    } else {
      unseated.push(g);
    }
  }
  const tables: Array<{ tableId: string | null; tableName: string; guests: GuestRow[] }> = Array.from(byTable.entries())
    .map(([id, v]) => ({ tableId: id as string | null, tableName: v.tableName, guests: v.guests }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));

  // Within each table, sort by seat index then by name
  for (const t of tables) {
    t.guests.sort((a, b) => {
      const ai = a.tableSeat?.index ?? Number.MAX_SAFE_INTEGER;
      const bi = b.tableSeat?.index ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.firstName.localeCompare(b.firstName);
    });
  }

  if (unseated.length > 0) {
    tables.push({ tableId: null, tableName: "Unassigned", guests: unseated });
  }
  return tables;
}

// Group by exact-string for now. Different guests typing slightly different
// strings won't dedupe — Say I Do exports are byte-identical across rows so
// this is fine in practice. Empty / null values aren't counted.
function tally(values: Array<string | null | undefined>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const key = v.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function flattenDietary(guests: GuestRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of guests) {
    for (const d of g.dietary) {
      const key = d.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

export default async function CateringBriefPage() {
  const user = await requireUser();
  if (!(await canView(user, "guests"))) redirect("/");

  const attending = (await db.guest.findMany({
    where: { rsvp: "ATTENDING", archived: false },
    include: {
      household: { select: { name: true } },
      tableSeat: {
        include: { table: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ firstName: "asc" }],
  })) as GuestRow[];

  const totalAttending = attending.length;
  const adults = attending.filter((g) => !g.isChild).length;
  const children = attending.filter((g) => g.isChild).length;
  const childrenMeals = attending.filter((g) => g.childrenMeal).length;
  const highchairs = attending.filter((g) => g.needsHighchair).length;
  const starterCounts = tally(attending.map((g) => g.mealStarter));
  const mainCounts = tally(attending.map((g) => g.mealMain));
  const dessertCounts = tally(attending.map((g) => g.mealDessert));
  const dietaryCounts = flattenDietary(attending);

  const groups = groupByTable(attending);

  const wedding = await getWeddingSettings();
  const weddingDateLabel = wedding.weddingDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="catering-page max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Action bar — hidden in print */}
        <div className="no-print flex items-center justify-between gap-2 mb-2">
          <Link
            href="/guests"
            className="text-xs text-ink-tertiary hover:text-moss-700 hover:underline"
          >
            ← Back to Guests
          </Link>
          <PrintButton />
        </div>

        {/* Letterhead — couple + date/venue + generated date, with a heavier
            ink-primary rule beneath. Mirrors the prototype's VenueCateringExport. */}
        <header className="border-b-2 border-ink-primary pb-4">
          <h1 className="font-display text-3xl sm:text-[26px] font-semibold text-ink-primary leading-tight">
            {wedding.coupleLabel}
          </h1>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-ink-secondary">
            <span>{weddingDateLabel} · {wedding.venueAddress ?? wedding.venue}</span>
            <span className="text-ink-tertiary">Generated {generatedAt}</span>
          </div>
          <p className="text-xs text-ink-tertiary mt-2 italic">
            Catering brief — final numbers, course breakdown, dietary requirements, per-table seating.
          </p>
        </header>

        {/* ── Headline numbers ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-ink-primary mb-3">Totals</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Tile label="Attending" value={totalAttending} highlight />
            <Tile label="Adults" value={adults} />
            <Tile label="Children" value={children} />
            <Tile label="Children's meals" value={childrenMeals} />
            <Tile label="Highchairs" value={highchairs} />
          </div>
        </section>

        {/* ── Course breakdowns ────────────────────────────────────────── */}
        <CourseSection title="Starters" counts={starterCounts} totalAttending={totalAttending} />
        <CourseSection title="Mains" counts={mainCounts} totalAttending={totalAttending} />
        <CourseSection title="Desserts" counts={dessertCounts} totalAttending={totalAttending} />

        {/* ── Dietary requirements ─────────────────────────────────────── */}
        <section className="print-break-avoid">
          <h2 className="text-sm font-semibold text-ink-primary mb-2">Dietary requirements</h2>
          {dietaryCounts.size === 0 ? (
            <p className="text-sm text-ink-tertiary italic">None recorded.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border-soft">
              <thead>
                <tr className="bg-canvas border-b border-border-soft text-[11px] font-bold text-ink-tertiary uppercase tracking-wider text-left">
                  <th className="px-3 py-1.5">Requirement</th>
                  <th className="px-3 py-1.5 text-right w-24">Count</th>
                </tr>
              </thead>
              <tbody>
                {[...dietaryCounts.entries()].map(([k, v]) => (
                  <tr key={k} className="border-b border-border-soft last:border-b-0">
                    <td className="px-3 py-1.5 text-ink-primary">{k}</td>
                    <td className="px-3 py-1.5 text-right text-ink-secondary tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>

        {/* ── Per-table breakdown ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-ink-primary mb-3 print-break-before">
            Per-table breakdown
          </h2>
          <div className="space-y-5">
            {groups.length === 0 ? (
              <p className="text-sm text-ink-tertiary italic">No tables yet.</p>
            ) : (
              groups.map((g) => (
                <TableBlock key={g.tableId ?? "unassigned"} group={g} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={[
        "border rounded-md px-3 py-2",
        highlight ? "border-moss-100 bg-moss-50/40" : "border-border-soft bg-surface",
      ].join(" ")}
    >
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
        {label}
      </div>
      <div
        className={[
          "font-display font-semibold mt-0.5",
          highlight ? "text-3xl text-moss-700" : "text-2xl text-ink-primary",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function CourseSection({
  title,
  counts,
  totalAttending,
}: {
  title: string;
  counts: Map<string, number>;
  totalAttending: number;
}) {
  if (counts.size === 0) {
    return (
      <section className="print-break-avoid">
        <h2 className="text-sm font-semibold text-ink-primary mb-2">{title}</h2>
        <p className="text-sm text-ink-tertiary italic">
          No {title.toLowerCase()} recorded yet.
        </p>
      </section>
    );
  }
  const totalChosen = [...counts.values()].reduce((a, b) => a + b, 0);
  const noChoice = totalAttending - totalChosen;
  return (
    <section className="print-break-avoid">
      <h2 className="text-sm font-semibold text-ink-primary mb-2">{title}</h2>
      <div className="overflow-x-auto">
      <table className="w-full text-sm border border-border-soft">
        <thead>
          <tr className="bg-canvas border-b border-border-soft text-[11px] font-bold text-ink-tertiary uppercase tracking-wider text-left">
            <th className="px-3 py-1.5">Choice</th>
            <th className="px-3 py-1.5 text-right w-24">Count</th>
          </tr>
        </thead>
        <tbody>
          {[...counts.entries()].map(([k, v]) => (
            <tr key={k} className="border-b border-border-soft last:border-b-0">
              <td className="px-3 py-1.5 text-ink-primary">{k}</td>
              <td className="px-3 py-1.5 text-right text-ink-secondary tabular-nums">{v}</td>
            </tr>
          ))}
          {noChoice > 0 && (
            <tr className="border-b border-border-soft last:border-b-0">
              <td className="px-3 py-1.5 text-ink-tertiary italic">
                (no choice recorded)
              </td>
              <td className="px-3 py-1.5 text-right text-ink-tertiary tabular-nums">{noChoice}</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function TableBlock({
  group,
}: {
  group: { tableId: string | null; tableName: string; guests: GuestRow[] };
}) {
  const adults = group.guests.filter((g) => !g.isChild).length;
  const children = group.guests.filter((g) => g.isChild).length;
  const headerBits = [`${group.guests.length} seated`];
  if (children > 0) headerBits.push(`${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"}`);
  return (
    <div className="border border-border-soft rounded-md print-break-avoid">
      <header className="bg-canvas px-3 py-2 border-b border-border-soft">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-ink-primary">{group.tableName}</h3>
          <span className="text-[11px] text-ink-tertiary">{headerBits.join(" · ")}</span>
        </div>
      </header>
      {/* v1.66.0 (DR-1): table is 6-column wide and won't fit a phone
          viewport without horizontal scroll. The wrapper handles
          that without breaking the print layout (print stylesheet
          ignores overflow). */}
      <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="bg-canvas border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider text-left">
            <th className="px-3 py-1">Seat</th>
            <th className="px-3 py-1">Guest</th>
            <th className="px-3 py-1">Starter</th>
            <th className="px-3 py-1">Main</th>
            <th className="px-3 py-1">Dessert</th>
            <th className="px-3 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {group.guests.map((g) => {
            const flags: string[] = [];
            if (g.isChild) flags.push("child");
            if (g.childrenMeal) flags.push("kids meal");
            if (g.needsHighchair) flags.push("highchair");
            const dietary = g.dietary.length > 0 ? g.dietary.join(", ") : null;
            const noteParts = [...(dietary ? [dietary] : []), ...flags];
            return (
              <tr key={g.id} className="border-b border-border-soft last:border-b-0 align-top">
                <td className="px-3 py-1 text-ink-tertiary tabular-nums">
                  {g.tableSeat ? `#${g.tableSeat.index + 1}` : "—"}
                </td>
                <td className="px-3 py-1 text-ink-primary">
                  {g.firstName} {g.lastName}
                </td>
                <td className="px-3 py-1 text-ink-secondary">
                  {g.mealStarter ?? <span className="text-ink-tertiary italic">—</span>}
                </td>
                <td className="px-3 py-1 text-ink-secondary">
                  {g.mealMain ?? <span className="text-ink-tertiary italic">—</span>}
                </td>
                <td className="px-3 py-1 text-ink-secondary">
                  {g.mealDessert ?? <span className="text-ink-tertiary italic">—</span>}
                </td>
                <td className="px-3 py-1 text-marigold-700">
                  {noteParts.length > 0 ? noteParts.join(" · ") : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
