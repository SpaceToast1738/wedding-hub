// Minimal Spotify Web API client for read-only public-playlist sync.
//
// Auth model: Client Credentials. The app authenticates as itself, not as a
// user, which means it can ONLY read public playlists. The couple sets a
// playlist to "public" during sync, presses Sync in the UI, then can flip
// it back to private if they want.
//
// Why not user-OAuth (Authorization Code)? It's a bigger lift (refresh-token
// dance, per-user storage) for a feature where we just need a read-only
// mirror. Public-during-sync is an acceptable workflow for a private
// wedding app — friction is on the couple, not the recipients.
//
// Network shape: token endpoint is form-urlencoded, JSON for everything
// else. Pagination via `offset`/`limit` (max 100). Rate limits surface as
// 429 with a Retry-After header.

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

type AccessToken = {
  token: string;
  // Absolute ms since epoch. We refresh ~30s before expiry to avoid races.
  expiresAt: number;
};

let cachedToken: AccessToken | null = null;

export class SpotifyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SpotifyError";
    this.status = status;
  }
}

export function isSpotifyConfigured(): boolean {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
}

async function getAccessToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new SpotifyError(
      "Spotify isn't configured — set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the environment.",
    );
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
    // Don't let Next cache token responses across builds.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new SpotifyError(
      `Spotify token request failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

// Accepts any of:
//   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc
//   spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
//   37i9dQZF1DXcBWIGoYBM5M
// Returns null when nothing playlist-shaped is found.
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // URI form
  const uriMatch = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];
  // URL form (with or without query)
  const urlMatch = trimmed.match(/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  // Bare ID — Spotify base62 IDs are 22 chars but accept anything sensible
  if (/^[A-Za-z0-9]{16,40}$/.test(trimmed)) return trimmed;
  return null;
}

export type SpotifyTrack = {
  uri: string;          // "spotify:track:..."
  title: string;
  artists: string[];    // primary first
};

type RawTrackItem = {
  track: {
    uri?: string;
    name?: string;
    artists?: { name?: string }[];
    type?: string;
    is_local?: boolean;
  } | null;
};

type RawPagedResponse = {
  items: RawTrackItem[];
  next: string | null;
};

type RawPlaylistResponse = {
  name?: string;
  external_urls?: { spotify?: string };
};

export type SpotifyPlaylistMeta = {
  name: string;
  url: string;
};

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    // Rate limited — caller is responsible for surfacing this.
    const retryAfter = res.headers.get("Retry-After") ?? "?";
    throw new SpotifyError(
      `Spotify rate limit hit; retry after ${retryAfter}s`,
      429,
    );
  }
  if (res.status === 404) {
    throw new SpotifyError(
      "Playlist not found. Make sure the playlist is public — Spotify's API can't read private playlists with this kind of token.",
      404,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new SpotifyError(
      `Spotify request failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export async function getPlaylistMeta(playlistId: string): Promise<SpotifyPlaylistMeta> {
  const data = await spotifyGet<RawPlaylistResponse>(
    `/playlists/${encodeURIComponent(playlistId)}?fields=name,external_urls`,
  );
  return {
    name: data.name ?? "Untitled playlist",
    url: data.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`,
  };
}

// Fetches every track on the playlist (handles pagination). Drops local
// files and non-track items (podcasts, episodes) since they don't have URIs
// the DJ can actually use. Maximum playlist size is theoretically 10,000.
// Hard cap at 1000 here to protect against a runaway loop or an accident.
export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const out: SpotifyTrack[] = [];
  let path: string | null =
    `/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(uri,name,artists(name),type,is_local)),next&limit=100`;
  let pages = 0;
  while (path && pages < 10) {
    const page: RawPagedResponse = await spotifyGet<RawPagedResponse>(path);
    for (const item of page.items) {
      const t = item.track;
      if (!t || t.is_local || (t.type && t.type !== "track")) continue;
      if (!t.uri || !t.name) continue;
      const artists = (t.artists ?? [])
        .map((a) => a.name?.trim())
        .filter((a): a is string => !!a);
      out.push({ uri: t.uri, title: t.name, artists });
    }
    if (!page.next) break;
    // Spotify gives us absolute URLs in `next`; we want the path-only form
    // for our spotifyGet helper, so strip the API_BASE prefix.
    path = page.next.startsWith(API_BASE) ? page.next.slice(API_BASE.length) : null;
    pages++;
  }
  return out;
}
