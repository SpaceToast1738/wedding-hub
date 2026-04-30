-- v1.32.1: index AuditLog.createdAt to make the 30-day retention
-- sweep cheap. The pre-existing (userId, createdAt) composite
-- doesn't help a "WHERE createdAt < cutoff" range query without a
-- userId predicate. Additive only.

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
