-- v1.48.0: GuestGroup.side — per-group side constraint for the
-- ceremony seating auto-fill allocator. BRIDE / GROOM / BOTH.
-- Default BOTH so existing rows keep their behaviour (members
-- fill either side based on remaining capacity).

ALTER TABLE "GuestGroup"
    ADD COLUMN "side" "Side" NOT NULL DEFAULT 'BOTH';
