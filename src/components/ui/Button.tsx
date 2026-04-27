import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-moss-500 text-white hover:bg-moss-700 border border-transparent",
  secondary: "bg-muted text-ink-primary border border-border-soft hover:bg-canvas",
  ghost: "bg-transparent text-ink-secondary border border-transparent hover:bg-muted",
  destructive: "bg-danger text-white hover:opacity-90 border border-transparent",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1",
  md: "text-sm px-3.5 py-1.5",
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
        "inline-flex items-center gap-1.5 font-medium rounded-sm whitespace-nowrap transition-colors",
        "disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
    />
  );
}
