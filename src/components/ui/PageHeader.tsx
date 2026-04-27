import * as React from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-soft bg-surface flex-shrink-0">
      <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary leading-tight">
            {title}
          </h1>
          {subtitle && (
            <div className="text-xs text-ink-tertiary mt-0.5">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex gap-2 items-center flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
