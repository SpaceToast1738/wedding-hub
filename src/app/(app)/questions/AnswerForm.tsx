"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { answerQuestion } from "@/app/(app)/tasks/actions";

export function AnswerForm({
  taskId,
  initialAnswer,
}: {
  taskId: string;
  initialAnswer: string;
}) {
  const [value, setValue] = useState(initialAnswer);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initialAnswer;

  function save() {
    startTransition(async () => {
      await answerQuestion(taskId, value);
    });
  }

  return (
    <div className="mt-2 pl-6 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Add the answer here…"
        className="w-full text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
      />
      {dirty && (
        <div className="flex gap-1.5 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setValue(initialAnswer)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save answer"}
          </Button>
        </div>
      )}
    </div>
  );
}
