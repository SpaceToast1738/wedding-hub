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

export function Avatar({ name = "", size = 28 }: { name?: string; size?: number }) {
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
