-- B2 (v1.11.0): Budget reads sum Payment.amount per BudgetLine when
-- BudgetLine.actual is null (manual override semantics). This index
-- avoids a sequential scan of Payment on every budget page render.
CREATE INDEX "Payment_budgetLineId_idx" ON "Payment"("budgetLineId");
