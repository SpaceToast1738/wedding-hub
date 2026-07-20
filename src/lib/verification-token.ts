import { createHash } from "node:crypto";

// v2.8.3: mirror how @auth/core stores email verification tokens.
//
// The 6-digit sign-in code the user sees is the PLAINTEXT token. But
// since @auth/core >=0.41 (the version this repo runs — see the
// nodemailer peer-dep note in CLAUDE.md), the adapter stores a HASH of
// it, not the plaintext: send-token.js does
//   token: await createHash(`${token}${secret}`)
// and the callback re-hashes the incoming token the same way before the
// DB lookup. `createHash` there is a WebCrypto SHA-256 → lowercase hex,
// byte-for-byte identical to node:crypto sha256 hex over the UTF-8
// string.
//
// The custom code-entry flow on /signin/verify does its OWN lookup
// against the VerificationToken table, so it MUST hash the entered code
// identically or every entry is a no-match (the plaintext 6 digits
// never equal the stored 64-hex hash). `secret` is
// `provider.secret ?? options.secret`; the Nodemailer provider sets no
// per-provider secret, so it is AUTH_SECRET. Verified against a live
// stored row: sha256(code + AUTH_SECRET) reproduces the stored hash.
export function hashVerificationToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}
