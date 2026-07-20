// v2.9.0: staged-upload lifecycle (src/lib/ai/uploads-staging.ts).
//
// Real filesystem in a temp dir — UPLOADS_DIR is computed from
// process.env at module load, so the env var is set BEFORE the dynamic
// import (vi.resetModules keeps each suite honest). The contract under
// test: stage names are strictly patterned (no traversal), the TTL
// sweep removes only old stages (never fresh stages, never real
// uploads), finalise renames stage → stored, and discard/unfinalise
// are best-effort.

import { mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
let staging: typeof import("@/lib/ai/uploads-staging");

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "wh-staging-"));
  process.env.UPLOADS_DIR = dir;
  vi.resetModules();
  staging = await import("@/lib/ai/uploads-staging");
});

afterAll(async () => {
  delete process.env.UPLOADS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("decodeBase64Content", () => {
  it("decodes valid base64 (including line-wrapped)", () => {
    const buf = staging.decodeBase64Content("aGVs\nbG8=");
    expect(buf?.toString("utf8")).toBe("hello");
  });

  it("rejects invalid charsets and truncated padding", () => {
    expect(staging.decodeBase64Content("not!!base64")).toBeNull();
    expect(staging.decodeBase64Content("aGVsbG8")).toBeNull(); // bad length
    expect(staging.decodeBase64Content("")).toBeNull();
  });
});

describe("staged names", () => {
  it("accepts only the minted pattern — traversal shapes are rejected", () => {
    expect(staging.isStagedName(`pending-${"a".repeat(32)}.pdf`)).toBe(true);
    expect(staging.isStagedName("pending-../../etc/passwd")).toBe(false);
    expect(staging.isStagedName("pending-zzz.pdf")).toBe(false);
    expect(staging.isStagedName(`${"a".repeat(32)}.pdf`)).toBe(false);
    expect(staging.isStagedName("")).toBe(false);
  });

  it("stagedNameFromPayload validates before returning", () => {
    const good = `pending-${"b".repeat(32)}.png`;
    expect(staging.stagedNameFromPayload({ stagedName: good })).toBe(good);
    expect(staging.stagedNameFromPayload({ stagedName: "pending-../x.png" })).toBeNull();
    expect(staging.stagedNameFromPayload({})).toBeNull();
    expect(staging.stagedNameFromPayload(null)).toBeNull();
  });
});

describe("stage → finalise / discard lifecycle", () => {
  it("stageUpload writes a patterned file with the MIME's extension", async () => {
    const { stagedName } = await staging.stageUpload(
      Buffer.from("pdf bytes"),
      "application/pdf",
      "quote.pdf",
    );
    expect(staging.isStagedName(stagedName)).toBe(true);
    expect(stagedName.endsWith(".pdf")).toBe(true);
    const s = await stat(path.join(dir, stagedName));
    expect(s.size).toBe(9);
  });

  it("finaliseStage renames stage → stored (prefix stripped)", async () => {
    const { stagedName } = await staging.stageUpload(
      Buffer.from("img"),
      "image/png",
      "pic.png",
    );
    const { storedName } = await staging.finaliseStage(stagedName);
    expect(storedName).toBe(stagedName.slice("pending-".length));
    await expect(stat(path.join(dir, storedName))).resolves.toBeTruthy();
    await expect(stat(path.join(dir, stagedName))).rejects.toThrow();
    // unfinalise puts it back (apply-failure rollback).
    await staging.unfinaliseStage(stagedName);
    await expect(stat(path.join(dir, stagedName))).resolves.toBeTruthy();
  });

  it("finaliseStage on a missing/expired stage throws the reviewer-readable error", async () => {
    await expect(
      staging.finaliseStage(`pending-${"c".repeat(32)}.pdf`),
    ).rejects.toThrow(/cleaned up.*Re-propose/s);
  });

  it("finaliseStage refuses non-patterned names outright", async () => {
    await expect(staging.finaliseStage("pending-../x.pdf")).rejects.toThrow(
      "Invalid staged file reference.",
    );
  });

  it("discardStage unlinks, and is a no-op on missing or invalid names", async () => {
    const { stagedName } = await staging.stageUpload(
      Buffer.from("bye"),
      "text/plain",
      "note.txt",
    );
    await staging.discardStage(stagedName);
    await expect(stat(path.join(dir, stagedName))).rejects.toThrow();
    await expect(staging.discardStage(stagedName)).resolves.toBeUndefined();
    await expect(staging.discardStage("pending-../evil")).resolves.toBeUndefined();
  });
});

describe("sweepStaleStages", () => {
  it("removes only stages older than the TTL — fresh stages and real uploads survive", async () => {
    const old = `pending-${"d".repeat(32)}.pdf`;
    const fresh = `pending-${"e".repeat(32)}.pdf`;
    const real = `${"f".repeat(32)}.pdf`; // finalised upload — must never be swept
    for (const name of [old, fresh, real]) {
      await writeFile(path.join(dir, name), "x");
    }
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await utimes(path.join(dir, old), eightDaysAgo, eightDaysAgo);
    // Age the real upload too — being old must not make it sweepable.
    await utimes(path.join(dir, real), eightDaysAgo, eightDaysAgo);

    const removed = await staging.sweepStaleStages();
    expect(removed).toBe(1);
    const remaining = await readdir(dir);
    expect(remaining).not.toContain(old);
    expect(remaining).toContain(fresh);
    expect(remaining).toContain(real);
  });
});
