import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

// v2.5.0: primary/destructive use the on-moss/on-danger text tokens
// instead of hardcoded text-white — dark mode flips moss/danger to
// lighter fills, and white-on-light-fill was failing AA (as low as
// 1.65:1). See globals.css's on-moss/on-danger token comments.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-moss-500 text-on-moss hover:bg-moss-700 border border-transparent",
  secondary: "bg-muted text-ink-primary border border-border-soft hover:bg-canvas",
  ghost: "bg-transparent text-ink-secondary border border-transparent hover:bg-muted",
  destructive: "bg-danger text-on-danger hover:opacity-90 border border-transparent",
};

// v2.5.0: min-h-[40px] sm:min-h-0 bakes the 40px touch floor into the
// primitive (mobile) while keeping desktop density (sm:min-h-0 lifts
// the constraint at 640px+) — was previously patched per-call-site.
const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1 min-h-[40px] sm:min-h-0",
  md: "text-sm px-3.5 py-1.5 min-h-[40px] sm:min-h-0",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-sm whitespace-nowrap transition-colors",
        "disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
    />
  );
}
