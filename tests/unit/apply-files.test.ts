// v2.9.0: apply handler for the file.upload proposal kind
// (src/lib/ai/apply/files.ts). Focus: the section gate, the tamper
// fences (staged-name pattern, MIME allowlist, size cap), the
// finalise-BEFORE-insert ordering, and the rename-back rollback when
// the File insert fails (so the rolled-back PENDING proposal still
// points at a live stage).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";

let callOrder: string[] = [];
let canEditResult = true;
let fileCreateFails = false;

const fileCreate = vi.fn(async (args: { data: Record<string, unknown> }) => {
  callOrder.push("create");
  if (fileCreateFails) throw new Error("insert failed");
  return { id: "file_1", ...args.data };
});
const auditCreate = vi.fn(async (_args: unknown) => ({}));
const finaliseStage = vi.fn(async (stagedName: string) => {
  callOrder.push("finalise");
  return { storedName: stagedName.slice("pending-".length) };
});
const unfinaliseStage = vi.fn(async () => {
  callOrder.push("unfinalise");
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    file: { create: fileCreate },
    auditLog: { create: auditCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
vi.mock("@/lib/permissions", () => ({
  canEdit: vi.fn(async () => canEditResult),
}));
vi.mock("@/lib/ai/uploads-staging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/uploads-staging")>();
  return { ...actual, finaliseStage, unfinaliseStage };
});

const { applyFileUpload } = await import("@/lib/ai/apply/files");

const user: SessionUser = {
  id: "u_1",
  email: "u@example.com",
  name: null,
  isCouple: true,
  role: "COUPLE",
};

const stagedName = `pending-${"a".repeat(32)}.pdf`;
const payload = {
  stagedName,
  filename: "florist-quote.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1234,
  folder: "quotes",
  visibility: "COUPLE_ONLY",
};

beforeEach(() => {
  callOrder = [];
  canEditResult = true;
  fileCreateFails = false;
  vi.clearAllMocks();
});

describe("applyFileUpload", () => {
  it("promotes the stage then creates the File row — in that order", async () => {
    const result = await applyFileUpload(user, payload, "prop_1");
    expect(result).toEqual({ id: "file_1" });
    expect(callOrder).toEqual(["finalise", "create"]);
    const created = fileCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(created.data).toMatchObject({
      name: "florist-quote.pdf",
      storedPath: stagedName.slice("pending-".length),
      folder: "quotes",
      visibility: "COUPLE_ONLY",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      uploadedById: "u_1",
    });
    // Audit mirrors the human uploadFile action, plus the proposal id.
    const audit = auditCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ action: "upload", entity: "File", entityId: "file_1" });
    expect(audit.data.metadata).toMatchObject({ proposalId: "prop_1" });
  });

  it("refuses without EDIT(files) — before touching the stage", async () => {
    canEditResult = false;
    await expect(applyFileUpload(user, payload, "prop_1")).rejects.toThrow(
      "Forbidden: no edit access to files",
    );
    expect(finaliseStage).not.toHaveBeenCalled();
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it("rejects a tampered stagedName at the schema fence", async () => {
    await expect(
      applyFileUpload(user, { ...payload, stagedName: "pending-../../etc/passwd" }, "prop_1"),
    ).rejects.toThrow();
    expect(finaliseStage).not.toHaveBeenCalled();
  });

  it("rejects an off-allowlist MIME even if the row was hand-edited", async () => {
    await expect(
      applyFileUpload(user, { ...payload, mimeType: "application/x-msdownload" }, "prop_1"),
    ).rejects.toThrow('isn\'t on the upload allowlist');
    expect(finaliseStage).not.toHaveBeenCalled();
  });

  it("renames the stage back when the File insert fails", async () => {
    fileCreateFails = true;
    await expect(applyFileUpload(user, payload, "prop_1")).rejects.toThrow("insert failed");
    expect(callOrder).toEqual(["finalise", "create", "unfinalise"]);
    expect(unfinaliseStage).toHaveBeenCalledWith(stagedName);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
