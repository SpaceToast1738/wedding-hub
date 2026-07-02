// v2.2.0: group pending proposals by batchId for the /ai dashboard.
// Null batchId = singleton group. Groups keep the first-seen order of
// the input rows (which arrive createdAt-desc), so a fresh batch
// stays at the top as one unit. Pure — unit-tested.

export type ProposalGroup<T extends { id: string; batchId: string | null }> = {
  /** Stable render key: the batchId, or `single:<id>` for singletons. */
  key: string;
  batchId: string | null;
  items: T[];
};

export function groupByBatch<T extends { id: string; batchId: string | null }>(
  rows: T[],
): ProposalGroup<T>[] {
  const groups: ProposalGroup<T>[] = [];
  const byBatch = new Map<string, ProposalGroup<T>>();

  for (const row of rows) {
    if (!row.batchId) {
      groups.push({ key: `single:${row.id}`, batchId: null, items: [row] });
      continue;
    }
    const existing = byBatch.get(row.batchId);
    if (existing) {
      existing.items.push(row);
    } else {
      const group: ProposalGroup<T> = {
        key: row.batchId,
        batchId: row.batchId,
        items: [row],
      };
      byBatch.set(row.batchId, group);
      groups.push(group);
    }
  }

  return groups;
}
