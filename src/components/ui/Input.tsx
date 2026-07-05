import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** v2.5.0: optional label — when passed, the input renders wrapped
   *  in a properly-associated <label htmlFor>/<input id> pair (via
   *  useId when the caller doesn't supply its own id). Fixes the
   *  app-wide pattern of sibling <label> blocks with no htmlFor/id
   *  pairing, which screen readers announce as unlabeled ("edit
   *  text, blank") and which don't focus the field on tap. Omit
   *  `label` to keep the old bare-input behaviour. */
  label?: string;
  wrapperClassName?: string;
};

export function Input({
  className = "",
  label,
  id,
  wrapperClassName = "",
  ...rest
}: InputProps) {
  const autoId = React.useId();
  const inputId = id ?? (label ? autoId : undefined);
  const input = (
    <input
      id={inputId}
      {...rest}
      className={[
        "text-sm bg-surface text-ink-primary border border-border-soft rounded-sm",
        "px-2.5 py-1.5 outline-none w-full focus:border-moss-500 transition-colors",
        className,
      ].join(" ")}
    />
  );
  if (!label) return input;
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={inputId}
        className="block text-[11px] font-bold text-ink-secondary uppercase tracking-wider mb-1"
      >
        {label}
      </label>
      {input}
    </div>
  );
}
