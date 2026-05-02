"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  TASK_FIELD_LABELS,
  type TaskField,
  inferTaskMapping,
  parseCsv,
} from "@/lib/csv";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  commitTaskImport,
  previewTaskImport,
  type TaskImportPreview,
} from "./actions";

const SAMPLE = `Title,Type,Priority,Status,Due,Assignee,Tags,Notes
Confirm final guest count,task,high,open,2026-09-19,jamie@example.com,wedding,Email Alveston with the headcount
Decide on first dance song,decision,medium,open,2026-08-01,bryony@example.com,music,Shortlist of 3 in Spotify
Order favours,task,medium,open,2026-08-15,jamie@example.com,decor,Talk to Etsy seller`;

const ALL_FIELDS: TaskField[] = [
  "title", "type", "priority", "status", "dueDate",
  "assigneeEmail", "tags", "notes", "ignore",
];

export function TaskImportClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<TaskField[]>([]);
  const [preview, setPreview] = useState<TaskImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, startCommit] = useTransition();
  const [previewing, startPreview] = useTransition();
  const confirm = useConfirm();
  const [committed, setCommitted] = useState<{ created: number; skipped: number; byType: { task: number; question: number; decision: number } } | null>(null);

  useEffect(() => {
    if (!text.trim()) {
      setHeaders([]);
      setMapping([]);
      setPreview(null);
      return;
    }
    const rows = parseCsv(text);
    const newHeaders = rows[0];
    if (!newHeaders) {
      setHeaders([]);
      setMapping([]);
      return;
    }
    setHeaders(newHeaders);
    setMapping((prev) => (prev.length === newHeaders.length ? prev : inferTaskMapping(newHeaders)));
  }, [text]);

  function loadPreview() {
    if (!text.trim() || mapping.length === 0) return;
    setPreviewError(null);
    startPreview(async () => {
      try {
        const result = await previewTaskImport({ text, mapping });
        setPreview(result);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
        setPreview(null);
      }
    });
  }

  async function commit() {
    if (!preview || preview.validRows === 0) return;
    const parts: string[] = [];
    if (preview.byType.task > 0) parts.push(`${preview.byType.task} task${preview.byType.task === 1 ? "" : "s"}`);
    if (preview.byType.question > 0) parts.push(`${preview.byType.question} question${preview.byType.question === 1 ? "" : "s"}`);
    if (preview.byType.decision > 0) parts.push(`${preview.byType.decision} decision${preview.byType.decision === 1 ? "" : "s"}`);
    const bodyParts: string[] = [`Will create ${parts.join(" + ")}.`];
    if (preview.rowErrors > 0) {
      bodyParts.push(`${preview.rowErrors} row${preview.rowErrors === 1 ? "" : "s"} with errors will be skipped.`);
    }
    if (!(await confirm({
      title: "Run task import?",
      body: bodyParts.join("\n\n"),
      confirmLabel: "Import",
    }))) return;
    startCommit(async () => {
      try {
        const result = await commitTaskImport({ text, mapping });
        setCommitted(result);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  function reset() {
    setText("");
    setHeaders([]);
    setMapping([]);
    setPreview(null);
    setPreviewError(null);
    setCommitted(null);
  }

  if (committed) {
    const lines: string[] = [];
    if (committed.byType.task > 0) lines.push(`${committed.byType.task} task${committed.byType.task === 1 ? "" : "s"}`);
    if (committed.byType.question > 0) lines.push(`${committed.byType.question} question${committed.byType.question === 1 ? "" : "s"}`);
    if (committed.byType.decision > 0) lines.push(`${committed.byType.decision} decision${committed.byType.decision === 1 ? "" : "s"}`);
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-moss-50 border border-moss-100 rounded-md p-6 text-center shadow-sm">
            <div className="text-3xl mb-2">✓</div>
            <h2 className="font-display text-2xl text-moss-700 mb-2">Imported</h2>
            <p className="text-sm text-ink-secondary mb-1">Created {lines.join(" + ") || "0 items"}.</p>
            {committed.skipped > 0 && (
              <p className="text-xs text-ink-tertiary mb-4">
                {committed.skipped} row{committed.skipped === 1 ? "" : "s"} skipped (had row errors).
              </p>
            )}
            <div className="flex gap-2 justify-center mt-3">
              <Button variant="primary" size="sm" onClick={() => router.push("/tasks")}>
                Back to Tasks
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Import another batch
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs">
          Paste a CSV / TSV. Each row becomes a Task, Question, or Decision. Rows with no <strong>Title</strong> are skipped. Assignee emails that don&apos;t match a sign-in account import as unassigned (with a warning).
        </div>

        <section className="bg-surface border border-border-soft rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">
              CSV / TSV
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setText(SAMPLE)}
              disabled={!!text}
              title="Loads a 3-row example so you can see the flow"
            >
              Load example
            </Button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(14, Math.max(6, text.split("\n").length))}
            spellCheck={false}
            placeholder={SAMPLE}
            className="w-full text-xs bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-2 outline-none focus:border-moss-500 font-mono"
          />
          {headers.length > 0 && (
            <div className="text-[11px] text-ink-tertiary mt-1.5">
              Detected {headers.length} column{headers.length === 1 ? "" : "s"} ·{" "}
              {parseCsv(text).length - 1} data row{parseCsv(text).length - 1 === 1 ? "" : "s"}
            </div>
          )}
        </section>

        {headers.length > 0 && (
          <MappingTable headers={headers} mapping={mapping} onChange={setMapping} disabled={previewing || committing} />
        )}

        {headers.length > 0 && (
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={reset} disabled={previewing || committing}>
              Clear
            </Button>
            <Button variant="secondary" size="sm" onClick={loadPreview} disabled={previewing || committing || !text.trim()}>
              {previewing ? "Previewing…" : preview ? "Refresh preview" : "Preview"}
            </Button>
          </div>
        )}

        {previewError && (
          <div className="bg-danger-bg border border-danger-border text-danger rounded-md px-4 py-2.5 text-xs">
            {previewError}
          </div>
        )}

        {preview && <PreviewPanel preview={preview} onCommit={commit} committing={committing} />}

        <div className="text-[11px] text-ink-tertiary text-center">
          <Link href="/tasks" className="hover:text-moss-700 hover:underline">← Back to Tasks</Link>
        </div>
      </div>
    </div>
  );
}

function MappingTable({
  headers,
  mapping,
  onChange,
  disabled,
}: {
  headers: string[];
  mapping: TaskField[];
  onChange: (m: TaskField[]) => void;
  disabled: boolean;
}) {
  const used = useMemo(() => {
    const counts = new Map<TaskField, number>();
    for (const f of mapping) {
      if (f === "ignore") continue;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    return counts;
  }, [mapping]);

  const hasTitle = used.has("title");
  const requiredMissing: string[] = hasTitle ? [] : ["Title"];
  const duplicates = Array.from(used.entries()).filter(([, c]) => c > 1);

  function setOne(idx: number, field: TaskField) {
    const next = [...mapping];
    next[idx] = field;
    onChange(next);
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Column mapping</h2>
        <p className="text-[11px] text-ink-tertiary">Required: Title.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-4 py-2 text-left">Header in your CSV</th>
              <th className="px-4 py-2 text-left">Maps to</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => (
              <tr key={i} className="border-b border-border-soft last:border-b-0">
                <td className="px-4 py-2 text-sm text-ink-secondary">{h || <em className="text-ink-tertiary">(empty)</em>}</td>
                <td className="px-4 py-2">
                  <select
                    value={mapping[i] ?? "ignore"}
                    onChange={(e) => setOne(i, e.target.value as TaskField)}
                    disabled={disabled}
                    className="text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none"
                  >
                    {ALL_FIELDS.map((f) => (
                      <option key={f} value={f}>{TASK_FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(requiredMissing.length > 0 || duplicates.length > 0) && (
        <div className="px-4 py-2.5 border-t border-border-soft bg-marigold-100/30 text-marigold-700 text-xs space-y-1">
          {requiredMissing.length > 0 && (
            <div>Required mapping missing: <strong>{requiredMissing.join(", ")}</strong></div>
          )}
          {duplicates.length > 0 && (
            <div>Duplicate mapping: <strong>{duplicates.map(([f]) => TASK_FIELD_LABELS[f]).join(", ")}</strong> — only the first column will be used.</div>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewPanel({
  preview,
  onCommit,
  committing,
}: {
  preview: TaskImportPreview;
  onCommit: () => void;
  committing: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? preview.rows : preview.rows.slice(0, 12);

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-ink-primary">Preview</h2>
        <div className="text-[11px] text-ink-tertiary flex gap-3 flex-wrap">
          <span>{preview.totalRows} rows</span>
          {preview.byType.task > 0 && <span className="text-moss-700">{preview.byType.task} task{preview.byType.task === 1 ? "" : "s"}</span>}
          {preview.byType.question > 0 && <span className="text-info">{preview.byType.question} question{preview.byType.question === 1 ? "" : "s"}</span>}
          {preview.byType.decision > 0 && <span className="text-marigold-700">{preview.byType.decision} decision{preview.byType.decision === 1 ? "" : "s"}</span>}
          {preview.rowErrors > 0 && <span className="text-danger">{preview.rowErrors} with errors</span>}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Assignee</th>
              <th className="px-3 py-2 text-left">Notes / issues</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const hasError = r.errors.length > 0;
              return (
                <tr key={r.rowIndex} className={["border-b border-border-soft last:border-b-0", hasError ? "bg-danger-bg/40" : ""].join(" ")}>
                  <td className="px-3 py-1.5 text-ink-tertiary tabular-nums align-top">{r.rowIndex}</td>
                  <td className="px-3 py-1.5 text-ink-primary align-top">{r.title || <em className="text-danger">(missing)</em>}</td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize align-top">{r.type.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize align-top">{r.priority.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize align-top">{r.status.replace("_", " ").toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary tabular-nums align-top">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : <span className="text-ink-tertiary">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary align-top">
                    {r.assigneeStatus === "found" && <span className="text-moss-700">{r.assigneeName}</span>}
                    {r.assigneeStatus === "missing" && <span className="text-marigold-700">{r.assigneeEmail} ⚠</span>}
                    {r.assigneeStatus === "none" && <span className="text-ink-tertiary">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] space-y-0.5 align-top">
                    {r.errors.map((e, i) => <div key={`e${i}`} className="text-danger">⚠ {e}</div>)}
                    {r.warnings.map((w, i) => <div key={`w${i}`} className="text-marigold-700">! {w}</div>)}
                    {r.errors.length === 0 && r.warnings.length === 0 && <span className="text-ink-tertiary">ok</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview.rows.length > 12 && (
        <div className="border-t border-border-soft px-4 py-2 text-center">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-info hover:underline">
            {showAll ? "Show first 12" : `Show all ${preview.rows.length}`}
          </button>
        </div>
      )}

      <div className="border-t border-border-soft px-4 py-3 flex justify-end">
        <Button variant="primary" size="sm" onClick={onCommit} disabled={committing || preview.validRows === 0}>
          {committing ? "Importing…" : `Import ${preview.validRows} row${preview.validRows === 1 ? "" : "s"}`}
        </Button>
      </div>
    </section>
  );
}
