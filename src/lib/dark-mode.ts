// Pure decision module for B11 dark-mode persistence.
//
// Two sources of truth exist:
// - The user's `User.darkMode` column (DB) — authoritative across devices
// - localStorage `wh-theme` ("dark" | "light") — first-paint hint that
//   avoids a flash before React hydrates and learns the DB value
//
// `resolveDarkMode` implements the precedence rule the AvatarMenu and
// the inline DarkModeScript both follow:
//   1. If the DB has an explicit boolean, that wins.
//   2. Otherwise, fall back to the localStorage hint.
//   3. If neither is set, default to light (matches the existing
//      pre-B11 behaviour so we don't surprise existing users).

export type ThemeChoice = "dark" | "light";

export function resolveDarkMode(
  serverPref: boolean | null | undefined,
  localPref: string | null | undefined,
): ThemeChoice {
  if (typeof serverPref === "boolean") {
    return serverPref ? "dark" : "light";
  }
  if (localPref === "dark") return "dark";
  if (localPref === "light") return "light";
  return "light";
}
