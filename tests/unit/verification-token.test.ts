import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { hashVerificationToken } from "@/lib/verification-token";

// Locks the exact scheme @auth/core (>=0.41) uses to store email
// verification tokens: sha256(`${token}${secret}`) → lowercase hex.
// If a dependency bump changes this again, this test fails instead of
// code sign-in silently breaking in production.
describe("hashVerificationToken", () => {
  it("is sha256 hex of token concatenated with secret (in that order)", () => {
    const code = "123456";
    const secret = "test-secret";
    const expected = createHash("sha256").update(`${code}${secret}`).digest("hex");
    expect(hashVerificationToken(code, secret)).toBe(expected);
  });

  it("returns a 64-char lowercase hex digest", () => {
    const h = hashVerificationToken("000000", "s");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("order matters — token+secret is not secret+token", () => {
    expect(hashVerificationToken("123456", "abc")).not.toBe(
      hashVerificationToken("abc", "123456"),
    );
  });

  it("different codes hash differently under the same secret", () => {
    const s = "wedding-secret";
    expect(hashVerificationToken("111111", s)).not.toBe(hashVerificationToken("222222", s));
  });
});
