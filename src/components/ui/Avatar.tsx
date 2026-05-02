// v1.67.0: Avatar gains an optional `pictureFileId` prop. When set
// it renders the file as an `<img>` (served from /api/files/<id>);
// when null/undefined it falls back to the v1.0 initials-in-coloured-
// circle treatment. Used for guest profile pictures (the new path)
// and for app-user avatars (which stick to initials — we don't
// upload faces for the planner / wedding party).
//
// The decision rule. If a `pictureFileId` is passed we always render
// the image, even on broken-load (browser shows the alt-text or a
// broken-image icon). The initials fallback only fires when no
// fileId is set at all. We don't try to detect failed loads — adds
// complexity, and the broken-image state is rare (a deleted File
// would have already SetNull'd the FK).

const AVATAR_INITIALS: Record<string, string> = {
  "Jamie Spencer": "JS",
  "Bryony Olwyn-Davis": "BO",
  "Joshua Dickson": "JD",
  "Aimee Hollingsworth": "AH",
};

const AVATAR_COLORS = [
  "var(--color-moss-500)",
  "var(--color-marigold-500)",
  "var(--color-info)",
  "#8A6A9A",
];

function colorFor(name: string): string {
  const idx =
    [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx]!;
}

function initialsFor(name: string): string {
  if (AVATAR_INITIALS[name]) return AVATAR_INITIALS[name]!;
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name = "",
  size = 28,
  pictureFileId,
}: {
  name?: string;
  size?: number;
  /** v1.67.0: when set, renders `<img src="/api/files/<id>">`
   *  instead of the initials fallback. Image is `object-cover` so
   *  the avatar stays circular regardless of the source aspect
   *  ratio. */
  pictureFileId?: string | null;
}) {
  if (pictureFileId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/${pictureFileId}`}
        alt={name || "Avatar"}
        loading="lazy"
        className="rounded-full object-cover flex-shrink-0 bg-canvas"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center text-white font-semibold rounded-full select-none flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: colorFor(name),
        fontSize: size * 0.35,
      }}
    >
      {initialsFor(name)}
    </span>
  );
}
