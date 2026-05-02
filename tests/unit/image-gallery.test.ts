// v1.63.0: unit tests for the ImageGallery's pure decision logic.
// The component itself is render-driven and would need a Playwright
// test to exercise; the only pure decision worth testing is the
// MIME-type check that drives "render as <img> thumbnail" vs.
// "render as chip with paperclip glyph".

import { describe, expect, it } from "vitest";
import { isImageMime } from "@/components/ui/ImageGallery";

describe("isImageMime", () => {
  it("returns true for common image MIMEs", () => {
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("image/heic")).toBe(true);
    expect(isImageMime("image/gif")).toBe(true);
    expect(isImageMime("image/svg+xml")).toBe(true);
  });

  it("returns false for non-image MIMEs", () => {
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
    expect(isImageMime("video/mp4")).toBe(false);
    expect(isImageMime("application/json")).toBe(false);
  });

  it("is prefix-based, so unknown image subtypes still pass", () => {
    // The browser will render whatever image/* it knows; for unknown
    // types it still triggers the thumbnail path (which falls back to
    // a broken-image icon, but at least the layout reflects intent).
    expect(isImageMime("image/x-future-format")).toBe(true);
    expect(isImageMime("image/")).toBe(true);
  });

  it("is case-sensitive (matches the canonical MIME registry)", () => {
    // We deliberately don't lowercase here — the `File` API and the
    // Prisma `mimeType` column normalise via `validateUpload` upstream,
    // so anything reaching the gallery is already lowercased.
    expect(isImageMime("IMAGE/PNG")).toBe(false);
    expect(isImageMime("Image/Jpeg")).toBe(false);
  });

  it("rejects empty string and falsy-shaped values", () => {
    expect(isImageMime("")).toBe(false);
    expect(isImageMime("   ")).toBe(false);
    expect(isImageMime("not-a-mime")).toBe(false);
  });
});
