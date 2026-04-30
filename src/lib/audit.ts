import { db } from "@/lib/db";

export type AuditEntry = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

// v1.32.1: 30-day retention. Audit rows older than this get pruned
// by `maybeRunRetentionSweep()` below — runs lazily inside
// logAudit() rather than via a separate cron because Wedding Hub
// has no cron infra and the audit volume is low (admin-only app).
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Process-local memory of when we last ran the sweep. Multi-instance
// deployments would each track their own cadence, which is fine —
// extra sweep calls are idempotent and the index makes them cheap.
// On instance restart this resets to 0, so the first audit call after
// boot triggers a sweep — also fine, that's actually desirable.
let lastSweepAt = 0;
const SWEEP_COOLDOWN_MS = 60 * 60 * 1000; // at most once per hour

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata as object | undefined) ?? undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
  // Fire-and-forget retention sweep. Errors swallowed (logged in the
  // helper) so a stale index or transient DB hiccup never breaks an
  // audit write.
  void maybeRunRetentionSweep();
}

async function maybeRunRetentionSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_COOLDOWN_MS) return;
  lastSweepAt = now;
  try {
    const cutoff = new Date(now - RETENTION_MS);
    const result = await db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`audit retention: pruned ${result.count} row(s) older than ${RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error("audit retention sweep failed", err);
  }
}
