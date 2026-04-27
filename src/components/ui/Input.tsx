import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={[
        "text-sm bg-surface text-ink-primary border border-border-soft rounded-sm",
        "px-2.5 py-1.5 outline-none w-full focus:border-moss-500 transition-colors",
        className,
      ].join(" ")}
    />
  );
}
