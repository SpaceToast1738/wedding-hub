import { describe, expect, it } from "vitest";
import { formatAuditAction } from "@/lib/audit-format";

// v1.39.0: pattern coverage for the enriched audit metadata across
// budget / payments / seating / songs / households / guests /
// suppliers / files. Each test mirrors a real action's metadata
// shape so the production audit log reads as human sentences.

describe("formatAuditAction — v1.39.0 enrichment", () => {
  describe("BudgetLine", () => {
    it("create with category", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "BudgetLine",
          metadata: { description: "Venue balance", categoryName: "Venue" },
        }),
      ).toBe(`Added budget line "Venue balance" (Venue)`);
    });

    it("update with changedFields", () => {
      expect(
        formatAuditAction({
          action: "update",
          entity: "BudgetLine",
          metadata: { description: "Venue balance", changedFields: ["actual", "paid"] },
        }),
      ).toBe(`Updated budget line "Venue balance" — actual, paid`);
    });

    it("delete with category", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "BudgetLine",
          metadata: { description: "Venue balance", categoryName: "Venue" },
        }),
      ).toBe(`Deleted budget line "Venue balance" from Venue`);
    });
  });

  describe("BudgetCategory", () => {
    it("create", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "BudgetCategory",
          metadata: { name: "Flowers" },
        }),
      ).toBe(`Added budget category "Flowers"`);
    });

    it("delete with line cascade", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "BudgetCategory",
          metadata: { name: "Flowers", lineCount: 3 },
        }),
      ).toBe(`Deleted budget category "Flowers" (3 lines cascade-deleted)`);
    });
  });

  describe("Payment", () => {
    it("create with amount + supplier", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "Payment",
          metadata: { description: "Venue balance", amount: 5000, supplierName: "Alveston Manor" },
        }),
      ).toBe(`Added payment "Venue balance" (£5,000) to Alveston Manor`);
    });

    it("status change with previous status", () => {
      expect(
        formatAuditAction({
          action: "status",
          entity: "Payment",
          metadata: { description: "Venue balance", status: "PAID", previousStatus: "DUE" },
        }),
      ).toBe(`Set payment "Venue balance" to PAID (was DUE)`);
    });

    it("delete with amount", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "Payment",
          metadata: { description: "Venue balance", amount: 5000, supplierName: "Alveston Manor" },
        }),
      ).toBe(`Deleted payment "Venue balance" (£5,000) (Alveston Manor)`);
    });
  });

  describe("Seating Table", () => {
    it("create with capacity", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "Table",
          metadata: { name: "Top table", capacity: 8 },
        }),
      ).toBe(`Added seating table "Top table" (8 seats)`);
    });

    it("delete with occupied count", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "Table",
          metadata: { name: "Top table", occupiedCount: 6 },
        }),
      ).toBe(`Deleted seating table "Top table" (6 guests unseated)`);
    });

    it("capacity change", () => {
      expect(
        formatAuditAction({
          action: "capacity",
          entity: "Table",
          metadata: { from: 8, to: 10 },
        }),
      ).toBe(`Resized seating table (untitled) 8 → 10`);
    });
  });

  describe("Seat", () => {
    it("assign — guest at table", () => {
      expect(
        formatAuditAction({
          action: "assign",
          entity: "Seat",
          metadata: { guestName: "Bryony", tableName: "Top table", seatIndex: 2 },
        }),
      ).toBe(`Seated "Bryony" at Top table seat 3`);
    });

    it("unassign — empty seat", () => {
      expect(
        formatAuditAction({
          action: "unassign",
          entity: "Seat",
          metadata: { tableName: "Top table", seatIndex: 2 },
        }),
      ).toBe(`Cleared Top table seat 3`);
    });
  });

  describe("Playlist + Song", () => {
    it("playlist delete with cascade count", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "Playlist",
          metadata: { name: "First dance", songCount: 5 },
        }),
      ).toBe(`Deleted playlist "First dance" (5 songs)`);
    });

    it("song create routes to playlist", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "Song",
          metadata: { title: "First Day of My Life", playlistName: "First dance" },
        }),
      ).toBe(`Added song "First Day of My Life" to First dance`);
    });

    it("song reorder up", () => {
      expect(
        formatAuditAction({
          action: "reorder",
          entity: "Song",
          metadata: { title: "Hold On", playlistName: "Reception", delta: -1 },
        }),
      ).toBe(`Reordered song "Hold On" in Reception (up)`);
    });
  });

  describe("Household + Guest", () => {
    it("household delete with guest cascade", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "Household",
          metadata: { name: "The Spencer Family", guestCount: 4 },
        }),
      ).toBe(`Deleted household "The Spencer Family" (4 guests cascade-deleted)`);
    });

    it("guest update with changedFields", () => {
      expect(
        formatAuditAction({
          action: "update",
          entity: "Guest",
          metadata: { firstName: "Bryony", lastName: "Olwyn-Davis", changedFields: ["dietary", "notes"] },
        }),
      ).toBe(`Updated guest "Bryony Olwyn-Davis" — dietary, notes`);
    });

    it("guest rsvp", () => {
      expect(
        formatAuditAction({
          action: "rsvp",
          entity: "Guest",
          metadata: { firstName: "Aimee", lastName: "Hollingsworth", rsvp: "ATTENDING" },
        }),
      ).toBe(`Set RSVP for "Aimee Hollingsworth" to attending`);
    });
  });

  describe("Supplier", () => {
    it("create with category", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "Supplier",
          metadata: { name: "Paintbox Blooms", category: "Florist" },
        }),
      ).toBe(`Added supplier "Paintbox Blooms" (Florist)`);
    });

    it("status with previous status", () => {
      expect(
        formatAuditAction({
          action: "status",
          entity: "Supplier",
          metadata: { name: "CG Media", status: "BOOKED", previousStatus: "QUOTED" },
        }),
      ).toBe(`Set supplier "CG Media" status to booked (was quoted)`);
    });

    it("update with changedFields", () => {
      expect(
        formatAuditAction({
          action: "update",
          entity: "Supplier",
          metadata: { name: "Slaters", changedFields: ["amountAgreed", "notes"] },
        }),
      ).toBe(`Updated supplier "Slaters" — amountAgreed, notes`);
    });
  });

  describe("Supplier sub-resources", () => {
    it("contract create with amount", () => {
      expect(
        formatAuditAction({
          action: "create",
          entity: "SupplierContract",
          metadata: { supplierName: "Alveston Manor", signed: true, amount: 12000 },
        }),
      ).toBe(`Added signed contract for Alveston Manor (£12,000)`);
    });

    it("contact delete with names", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "SupplierContact",
          metadata: { contactName: "Louis", supplierName: "CG Media" },
        }),
      ).toBe(`Removed contact "Louis" from CG Media`);
    });

    it("communication delete with channel", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "SupplierCommunication",
          metadata: { supplierName: "Paintbox Blooms", channel: "email" },
        }),
      ).toBe(`Removed email log for Paintbox Blooms`);
    });
  });

  describe("File", () => {
    it("delete with name", () => {
      expect(
        formatAuditAction({
          action: "delete",
          entity: "File",
          metadata: { name: "venue-contract.pdf" },
        }),
      ).toBe(`Deleted file "venue-contract.pdf"`);
    });
  });

  describe("CeremonySeating + WeddingSettings (seating-globals)", () => {
    it("ceremony layout update with totalSeats + changedFields", () => {
      expect(
        formatAuditAction({
          action: "update",
          entity: "CeremonySeating",
          metadata: { totalSeats: 80, changedFields: ["leftRows", "rightRows"] },
        }),
      ).toBe(`Updated ceremony layout (80 seats) — leftRows, rightRows`);
    });

    it("seating notes cleared", () => {
      expect(
        formatAuditAction({
          action: "seating-notes",
          entity: "WeddingSettings",
          metadata: { cleared: true, notesLength: 0 },
        }),
      ).toBe(`Cleared seating notes`);
    });

    it("seating checklist with done count", () => {
      expect(
        formatAuditAction({
          action: "seating-checklist",
          entity: "WeddingSettings",
          metadata: { itemCount: 12, doneCount: 5, cleared: false },
        }),
      ).toBe(`Updated seating checklist — 5/12 done`);
    });
  });
});
