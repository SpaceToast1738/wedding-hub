import { describe, expect, it } from "vitest";
import { isSpotifyConfigured, parsePlaylistId } from "@/lib/spotify";

describe("parsePlaylistId", () => {
  it("accepts the open.spotify.com URL with ?si= tracking param", () => {
    expect(
      parsePlaylistId(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123",
      ),
    ).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("accepts the bare URL without query string", () => {
    expect(
      parsePlaylistId("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"),
    ).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("accepts the spotify: URI form", () => {
    expect(parsePlaylistId("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "37i9dQZF1DXcBWIGoYBM5M",
    );
  });

  it("accepts a bare base62 ID", () => {
    expect(parsePlaylistId("37i9dQZF1DXcBWIGoYBM5M")).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("trims whitespace", () => {
    expect(parsePlaylistId("  spotify:playlist:37i9dQZF1DXcBWIGoYBM5M  ")).toBe(
      "37i9dQZF1DXcBWIGoYBM5M",
    );
  });

  it("returns null for unrecognised input", () => {
    expect(parsePlaylistId("")).toBeNull();
    expect(parsePlaylistId("https://example.com/")).toBeNull();
    expect(parsePlaylistId("not a playlist")).toBeNull();
    expect(parsePlaylistId("https://open.spotify.com/track/abc123")).toBeNull();
  });
});

describe("isSpotifyConfigured", () => {
  it("returns false when env vars are unset", () => {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    try {
      expect(isSpotifyConfigured()).toBe(false);
    } finally {
      if (id !== undefined) process.env.SPOTIFY_CLIENT_ID = id;
      if (secret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = secret;
    }
  });

  it("returns true only when both env vars are set", () => {
    const origId = process.env.SPOTIFY_CLIENT_ID;
    const origSecret = process.env.SPOTIFY_CLIENT_SECRET;
    process.env.SPOTIFY_CLIENT_ID = "test_id";
    process.env.SPOTIFY_CLIENT_SECRET = "test_secret";
    try {
      expect(isSpotifyConfigured()).toBe(true);
    } finally {
      if (origId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
      else process.env.SPOTIFY_CLIENT_ID = origId;
      if (origSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
      else process.env.SPOTIFY_CLIENT_SECRET = origSecret;
    }
  });
});
