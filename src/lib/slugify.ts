// v1.94.2: shared slug helper. Pre-fix three different settings
// actions (nav-tag-actions, guest-group-actions, permission-group-
// actions) each carried an inline `slugify`. Now that Wedding Book
// section + subsection creation also wants auto-slugging, lift the
// helper to a shared lib so all five+ call-sites resolve through the
// same normalisation rules.
//
// Behaviour: lowercase → replace runs of non-alphanumeric with `-` →
// strip leading / trailing `-` → cap at 60 chars. Same rules the
// existing settings helpers used so call-sites can swap in one-for-
// one. Returns "" when nothing alphanumeric survives (caller decides
// the fallback — for the book actions that's "section" / "page" +
// the uniqueness suffix).
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Given a desired base slug + a checker that knows whether a slug is
// already taken, returns the original base when free, otherwise
// `${base}-2`, `${base}-3`, … until a free slug is found. Used by the
// book actions to disambiguate auto-derived slugs (e.g. two cards
// both titled "Notes" → "notes" + "notes-2").
export async function disambiguateSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // 1000 collisions on a single slug stem is pathological — fall
  // back to a timestamp suffix rather than loop forever.
  return `${base}-${Date.now()}`;
}
