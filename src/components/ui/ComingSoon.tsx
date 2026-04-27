import { PageHeader } from "@/components/ui/PageHeader";

export function ComingSoon({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3 opacity-60">✿</div>
          <h2 className="font-display text-2xl text-ink-primary mb-2">Coming soon</h2>
          <p className="text-sm text-ink-tertiary">
            This page will be ported from the prototype in Phase B.
          </p>
        </div>
      </div>
    </>
  );
}
