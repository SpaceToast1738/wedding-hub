# MCP server — LAN-only client access to the AI tools

**Status:** v2.7.0. Last updated 19 July 2026.

Wedding Hub exposes its AI tool registry (the same `read_*` / `propose_*`
tools the in-app planner chat uses) to MCP clients — Claude Code, Claude
Desktop, MCP Inspector — over the **LAN only**. The endpoint is:

```
http://192.168.50.25:8090/api/mcp
```

Caddy's `:8090` site block proxies it to the app; the public `:80` block
(the Cloudflare Tunnel path) returns 403 for `/api/mcp*`, so the endpoint
is never internet-reachable.

**The safety model is the same as the in-app AI planner:** read tools
return live wedding data; propose tools **never write directly** — they
create proposals that a human reviews and applies (or dismisses) on the
app's `/ai` page. An MCP client can suggest fifty tasks; nothing lands in
real data until someone approves them in the app.

---

## Getting a token

Auth is per-user bearer tokens, managed in **Settings → MCP tokens**
(couple-only panel — same tier as invites and permissions):

1. Sign in as a couple-tier user → Settings → MCP tokens.
2. **Generate token** — pick the user the token acts as, give it a label
   ("Jamie's desktop").
3. Copy the token from the one-time panel. It starts with `whmcp_` and is
   **shown exactly once** — only a SHA-256 hash is stored, so it can never
   be retrieved again. Lose it → revoke it and generate a new one.
4. **Revoke** from the same panel at any time; revocation is immediate
   (every request re-verifies the token against the DB).

The token acts *as the user it was issued for*: proposals it creates are
attributed to that user, and that user's permissions apply.

## Permissions

Tokens authenticate; permissions authorize. Couple-tier users pass every
gate. For anyone else:

| Wants to | Needs (granted in Settings → permissions matrix) |
|---|---|
| Connect / handshake (`initialize`, `ping`) | any valid token |
| Anything beyond the handshake (`tools/list`, `tools/call`) | **ai_chat** at VIEW |
| Call `propose_*` tools | **ai_write** at EDIT |

Without `ai_write`, `tools/list` simply omits the propose tools — the
client only sees what it can call.

---

## Client setup

### Claude Code (native — recommended)

```bash
claude mcp add --transport http wedding-hub http://192.168.50.25:8090/api/mcp --header "Authorization: Bearer whmcp_YOUR_TOKEN_HERE"
```

That's it — Claude Code speaks streamable HTTP with a static header
natively. Verify with `/mcp` inside a session.

### Claude Desktop (via the `mcp-remote` stdio bridge)

Claude Desktop **cannot connect directly**: its custom connectors are
OAuth-only (no static-header field) and require HTTPS. Use the
`mcp-remote` bridge as a stdio server in `claude_desktop_config.json`
(Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "wedding-hub": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://192.168.50.25:8090/api/mcp",
        "--allow-http",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer whmcp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Two non-obvious bits, both mandatory:

- **`--allow-http`** — `mcp-remote` refuses plain-HTTP URLs that aren't
  localhost without it. Our endpoint is plain HTTP on the LAN (see
  Security notes), so the flag is required.
- **The header value goes through the `env` block** (`Authorization:` with
  no space, value via `${AUTH_HEADER}`) — spaces in `args` entries get
  mangled by the shell on some platforms, and `Bearer whmcp_…` contains
  one. The env-var indirection sidesteps it.

Restart Claude Desktop after editing the config.

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

In the UI: transport **Streamable HTTP**, URL
`http://192.168.50.25:8090/api/mcp`, and add a custom header
`Authorization: Bearer whmcp_YOUR_TOKEN_HERE`. Connect → the handshake and
tool list should populate.

---

## Remote access (Tailscale)

v2.7.1: the endpoint is also reachable over the tailnet — install Tailscale
on the remote device, sign in to the same tailnet as Tower, and use

```
http://100.79.99.19:8090/api/mcp
```

as the server URL in any of the client configs above (same bearer token).
Tailscale encrypts the hop end-to-end (WireGuard), so plain HTTP is fine
here. How it works: a tiny `mcp-proxy` compose service (`alpine/socat`,
bridge-network-only) publishes `:8090` on Tower's own IPs and relays to
caddy's listener — necessary because macvlan isolation stops the Unraid
host (and traffic routed through it) from reaching `192.168.50.25`
directly, and Docker skips `ports:` publishing entirely for containers
whose primary network is macvlan — and the app's `MCP_LAN_HOST` allowlist
includes the Tailscale address. Nothing here is internet-exposed: the
Cloudflare Tunnel still only routes `:80`, which 403s `/api/mcp`.

On the home LAN, `http://192.168.50.110:8090/api/mcp` (Tower's own IP)
works too, alongside the original `192.168.50.25:8090` listener.

---

## Security notes

**LAN-only enforcement is layered** — no single config drift exposes the
endpoint:

1. Caddy's public `:80` block 403s `/api/mcp*`, so the Cloudflare Tunnel
   can never reach it.
2. The `:8090` LAN listener only exists on Caddy's br0 address
   (`192.168.50.25`) — the tunnel doesn't route it.
3. The route itself rejects any request whose `Host` isn't `MCP_LAN_HOST`
   (default `192.168.50.25:8090`) or localhost — public-hostname requests
   die at the app layer even if the Caddyfile sync never landed. Requests
   bearing an `Origin` header are also rejected (DNS-rebinding defence;
   real MCP clients aren't browsers).
4. Per-user bearer tokens, stored hashed (SHA-256) in the DB.

**Plain HTTP on the LAN.** Traffic to `:8090` is unencrypted — the token
is visible on the wire *locally*. Accepted trade-off for this deployment:
a private home LAN, five users, endpoint unreachable from the internet.
Don't port-forward `:8090` or add it to the tunnel.

**Brute force:** 10 failed token validations per 5 minutes per client IP
locks that IP out (HTTP 429) until the window rolls. Failed attempts are
audit-logged (`mcp_auth_failed`, visible in Settings → audit log).

**Kill-switch:** set `MCP_ENABLED=false` in the host `.env` and recreate
`web` — the endpoint returns 503 regardless of token validity. Individual
tokens are revoked from Settings without any restart.

---

## Behaviour notes

- **Proposals from separate calls are singletons unless you group them.**
  Each MCP `tools/call` is its own HTTP request, so by default every call
  mints a fresh `batchId` and its proposals appear individually on `/ai`.
  A single call that creates several proposals — e.g.
  `propose_task_breakdown` — still shows up as one batch. To group
  proposals *across* several calls into one reviewable `/ai` batch
  (v2.8.1+), pass the same **`batchKey`** string in the `arguments` of
  each `propose_*` call: the server derives a shared, per-user batchId
  (`mcp:<userId>:<batchKey>`) from it. Omit `batchKey` for the old
  one-proposal-per-call behaviour. The key is namespaced by the token's
  user, so two members can reuse the same string without colliding.
- **Tool results are capped at 24,000 characters** with an explicit
  truncation marker (same cap as planner chat). If a client hits it,
  narrow the query (most read tools take filters).
- **No API cost.** MCP tool calls run entirely against the local DB — the
  Anthropic API is never involved, so the AI budget/usage dashboards don't
  move. The *client* (Claude Code etc.) pays its own model costs.

## Deliberate protocol deviations

The server implements a small, stateless subset of MCP streamable HTTP.
Three deviations from the letter of the spec, all safe with mainstream
clients:

- **`MCP-Protocol-Version` request header is ignored.** The server
  behaves identically across every revision it supports (2025-06-18,
  2025-03-26, 2024-11-05), so there's nothing to vary on. Newer client
  revisions get counter-offered 2025-06-18 and accept it.
- **JSON-RPC batch arrays are rejected** with -32600. Batching was
  removed from the spec in 2025-06-18; no mainstream client sends them.
- **No GET/SSE channel.** `GET /api/mcp` returns 405 — the server is
  stateless (no sessions, no server-initiated messages), and every POST
  gets a plain `application/json` response.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 403 before any JSON-RPC | Wrong Host (hit it via the LAN IP, not a hostname) or an Origin header (don't call from a browser) |
| 401 | Missing/invalid/revoked token — check the `Authorization: Bearer whmcp_…` header made it through |
| 429 | Auth-failure lockout — wait 5 minutes, fix the token |
| 503 | `MCP_ENABLED=false` on the host |
| "MCP access requires the AI chat permission" | Token's user lacks `ai_chat` VIEW — grant it in Settings |
| Propose tools missing from `tools/list` | Token's user lacks `ai_write` EDIT |
| Claude Desktop shows the server as failed | Check `--allow-http` is present and the header is wired via the `env` block as above |
