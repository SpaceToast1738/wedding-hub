"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// v1.78.0: shared link-to-budget control used on MENU / BAR / OUTFIT /
// STAY cards. Chip + Unlink button when already linked; "Link to
// budget" button + popover (category select + description) when not.
//
// Couple-only via the `canEdit` + `showMoney` props (cards already
// gate via the v1.76.0 money permission). Server actions are passed
// in as props so the same component can drive any of the four card
// kinds without importing them all here.

export type BudgetCategoryOpt = { id: string; name: string };

export type BudgetLineSummary = {
  id: string;
  description: string;
  category: { id: string; name: string };
};

export function BudgetLinkControl({
  cardTitle,
  budgetLine,
  categories,
  canEdit,
  showMoney,
  onLink,
  onUnlink,
}: {
  cardTitle: string;
  budgetLine: BudgetLineSummary | null;
  categories: BudgetCategoryOpt[];
  canEdit: boolean;
  showMoney: boolean;
  onLink: (args: { categoryId: string; description: string }) => Promise<{ ok: boolean; error?: string }>;
  onUnlink: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  if (!showMoney) return null;

  function submitLink(categoryId: string, description: string) {
    if (!categoryId) {
      notify("error", "Pick a category");
      return;
    }
    startTransition(async () => {
      const res = await onLink({ categoryId, description: description.trim() || cardTitle });
      if (res.ok) {
        notify("success", "Linked to budget");
        setPickerOpen(false);
      } else {
        notify("error", res.error ?? "Couldn't link");
      }
    });
  }

  async function handleUnlink() {
    if (!(await confirm({
      title: `Unlink "${cardTitle}" from budget?`,
      body: "The budget line stays — only the auto-sync stops.",
      confirmLabel: "Unlink",
      tone: "default",
    }))) return;
    startTransition(async () => {
      const res = await onUnlink();
      if (res.ok) notify("success", "Unlinked");
      else notify("error", res.error ?? "Couldn't unlink");
    });
  }

  if (budgetLine) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Link
          href="/budget"
          className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-sm border bg-moss-50 border-moss-300 text-moss-700 hover:border-moss-500"
          title={`Linked to: ${budgetLine.category.name} → ${budgetLine.description}`}
        >
          ↗ Linked to budget · {budgetLine.category.name}
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={handleUnlink}
            disabled={pending}
            className="text-[11px] text-ink-tertiary hover:text-danger px-1"
            title="Unlink from budget"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (!canEdit) return null;

  if (pickerOpen) {
    return (
      <LinkPicker
        cardTitle={cardTitle}
        categories={categories}
        pending={pending}
        onSubmit={submitLink}
        onCancel={() => setPickerOpen(false)}
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setPickerOpen(true)}
      disabled={pending || categories.length === 0}
      title={
        categories.length === 0
          ? "Create a budget category first on /budget"
          : "Sync this card's totals into a budget line"
      }
    >
      ↗ Link to budget
    </Button>
  );
}

function LinkPicker({
  cardTitle,
  categories,
  pending,
  onSubmit,
  onCancel,
}: {
  cardTitle: string;
  categories: BudgetCategoryOpt[];
  pending: boolean;
  onSubmit: (categoryId: string, description: string) => void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState(cardTitle);
  return (
    <div className="inline-flex flex-wrap items-end gap-2 p-2 border border-moss-300 bg-moss-50/40 rounded-sm">
      <label className="flex flex-col text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
        Category
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={pending}
          className="mt-0.5 text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-[10px] font-bold text-ink-tertiary uppercase tracking-wider flex-1 min-w-[180px]">
        Line description
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          className="mt-0.5 text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary"
        />
      </label>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => onSubmit(categoryId, description)}
        disabled={pending}
      >
        {pending ? "Linking…" : "Link"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
