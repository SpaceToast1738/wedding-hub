import { AlertTriangle, Lock } from "lucide-react";

// Server component: reads `configured` from props (the page does the
// `isSpotifyConfigured()` check at request time so we don't bother with
// a client/server split here).
//
// Two states:
//   - configured = true  → green status chip; setup guide hidden by default
//                          (collapsible <details>) for reference
//   - configured = false → amber status chip; setup guide expanded by
//                          default so the path-to-fix is in the user's face
//
// Setup-guide depth differs by tier:
//   - couple → full step-by-step (Spotify Developer account, Unraid
//              Compose Manager Plus, env-var rename caveats, etc.)
//   - non-couple → "ask one of the couple to flip this on" placeholder

const DEV_DASHBOARD = "https://developer.spotify.com/dashboard";

export function SpotifySettingsPanel({
  configured,
  isCouple,
}: {
  configured: boolean;
  isCouple: boolean;
}) {
  return (
    <section
      id="spotify-integration"
      className="bg-surface border border-border-soft rounded-md shadow-sm scroll-mt-24"
    >
      <header className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-ink-primary">
            Spotify integration
          </h2>
          {configured ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-moss-700 bg-moss-50 border border-moss-100 px-2 py-0.5 rounded">
              ✓ Configured
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-marigold-700 bg-marigold-100 border border-marigold-700/30 px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle aria-hidden className="w-3 h-3" /> Not configured
            </span>
          )}
        </div>
        <span className="text-[11px] text-ink-tertiary">
          Read-only mirror of the running container&apos;s env vars
        </span>
      </header>

      <div className="px-4 py-3 text-sm text-ink-secondary leading-relaxed space-y-2">
        <p>
          When configured, each playlist on the <a href="/songs" className="text-info hover:underline">Songs page</a>
          {" "}gets a Sync panel — paste a Spotify playlist URL, click Sync, and the
          tracks land as local <code className="text-[12px] bg-canvas border border-border-soft px-1 rounded">Song</code> rows
          with clickable links back to Spotify. The local copy is what the planner / DJ see; the
          curated playlist stays in Spotify where the editing UX is good.
        </p>
        {!configured && (
          <p className="text-marigold-700">
            <strong>Currently disabled.</strong> The Sync panel is hidden on the Songs page
            until {isCouple ? "you set the env vars below" : "one of the couple sets it up"}.
          </p>
        )}
      </div>

      {!isCouple ? (
        <div className="px-4 py-3 border-t border-border-soft text-xs text-ink-tertiary italic flex items-start gap-1">
          <Lock aria-hidden className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Setup requires server-level env-var access. Ask Jamie or Bryony to flip it on.</span>
        </div>
      ) : (
        <details className="border-t border-border-soft" open={!configured}>
          <summary className="px-4 py-3 cursor-pointer text-sm text-ink-primary hover:bg-canvas/50 list-none flex items-center gap-2">
            <span className="text-ink-tertiary text-xs">▸</span>
            <span className="font-medium">Setup steps {configured ? "(reference)" : ""}</span>
          </summary>
          <ol className="px-4 pb-4 pt-1 text-sm text-ink-secondary leading-relaxed space-y-3 list-decimal list-inside">
            <li>
              <strong>Create a Spotify app.</strong>{" "}
              <a
                href={DEV_DASHBOARD}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Spotify Developer Dashboard
              </a>{" "}
              → <em>Create app</em>. Pick any name (e.g. &ldquo;Wedding Hub&rdquo;) and any
              description. Redirect URI: leave empty — we use the
              {" "}
              <a
                href="https://developer.spotify.com/documentation/web-api/concepts/authorization#client-credentials-flow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Client Credentials flow
              </a>
              , no callback needed. Save.
            </li>
            <li>
              <strong>Copy the credentials.</strong> On the app&apos;s page click <em>Settings</em>.
              Note the <strong>Client ID</strong> and click <em>View client secret</em> for the
              <strong> Client Secret</strong>. Keep this tab open or paste both into 1Password —
              the secret is shown once.
            </li>
            <li>
              <strong>Add them to the running container.</strong> On Unraid:
              <ul className="list-disc list-inside mt-1.5 ml-4 text-[13px] space-y-1">
                <li>Open <strong>Compose Manager Plus</strong> → click the wedding-hub stack.</li>
                <li>Click <strong>Edit Stack</strong> → <strong>.ENV</strong> tab.</li>
                <li>Append (no quotes, no trailing spaces):
                  <pre className="text-[11px] bg-canvas border border-border-soft rounded-sm px-2 py-1.5 mt-1 overflow-x-auto">
{`SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_CLIENT_SECRET=<your client secret>`}
                  </pre>
                </li>
                <li>Click <strong>Save</strong>, then <strong>Up</strong>. <strong>Up</strong> recreates the <code className="text-[12px] bg-canvas border border-border-soft px-1 rounded">web</code> container with the new env. Saving alone is not enough — Docker reads env at container creation, not on file save.</li>
              </ul>
            </li>
            <li>
              <strong>Verify.</strong> SSH into the host and run:
              <pre className="text-[11px] bg-canvas border border-border-soft rounded-sm px-2 py-1.5 mt-1 overflow-x-auto">
{`docker compose exec web printenv | grep SPOTIFY`}
              </pre>
              Both <code className="text-[12px] bg-canvas border border-border-soft px-1 rounded">SPOTIFY_CLIENT_ID</code> and <code className="text-[12px] bg-canvas border border-border-soft px-1 rounded">SPOTIFY_CLIENT_SECRET</code> should print. The chip on this card will flip to <span className="text-moss-700 font-semibold">✓ Configured</span> after a refresh.
            </li>
            <li>
              <strong>Link your first playlist.</strong> On <a href="/songs" className="text-info hover:underline">Songs</a>, click <strong>Link Spotify URL</strong> on a playlist card and paste the playlist URL (e.g.
              {" "}<code className="text-[11px] bg-canvas border border-border-soft px-1 rounded break-all">https://open.spotify.com/playlist/...</code>).
              Click <strong>Sync now</strong>.
            </li>
          </ol>
          <div className="px-4 pb-4 -mt-1 text-xs text-ink-tertiary italic leading-relaxed">
            Heads-up: Spotify&apos;s Client Credentials flow can only read <strong>public</strong> playlists.
            During each sync the playlist must be public on Spotify. After syncing, you can flip
            it back to private — Wedding Hub keeps a local copy of the tracks.
          </div>
        </details>
      )}
    </section>
  );
}
