"use client";

export function Tag({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer",
        active
          ? "bg-moss-500 text-white border-moss-500 font-semibold"
          : "bg-muted text-ink-secondary border-border-soft hover:bg-canvas",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
