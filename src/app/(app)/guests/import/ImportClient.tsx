"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GUEST_FIELD_LABELS, MULTI_VALUE_FIELDS, type GuestField, inferMapping, parseCsv } from "@/lib/csv";
import type { MergeableField } from "@/lib/csv-merge";
import { commitImport, previewImport, type ImportPreview } from "./actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const SAMPLE = `First Name,Last Name,Email,Household,Side,RSVP,Plus One Allowed,Dietary
Robert,Spencer,robert@example.com,The Spencer Family,Groom,Yes,No,
Margaret,Spencer,,The Spencer Family,Groom,Yes,No,Vegetarian
Sophie,Olwyn-Davis,sophie@example.com,The Olwyn-Davis Family,Bride,Pending,No,GF`;

const ALL_FIELDS: GuestField[] = [
  "firstName", "lastName", "fullName", "email", "phone",
  "household", "tableName", "rsvpLink", "side", "rsvp",
  "isChild", "needsHighchair", "childrenMeal", "plusOneAllowed", "plusOneName", "role",
  "dietary", "tags",
  "mealStarter", "mealMain", "mealDessert", "songRequest",
  "notes", "ignore",
];

export function ImportClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  // v2.5.1 (finding #7): paste-only import with a Notepad-specific
  // guide, no native file picker anywhere. fileInputRef backs a
  // hidden <input type=file>; handleFiles reads the chosen/dropped
  // file's text straight into the same `text` state the paste path
  // already drives — the mapping/preview pipeline below is unchanged.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setText(reader.result);
    };
    reader.onerror = () => setFileError("Couldn't read that file — try pasting instead.");
    reader.readAsText(file);
  }
  const [mapping, setMapping] = useState<GuestField[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, startCommit] = useTransition();
  const [previewing, startPreview] = useTransition();
  const confirm = useConfirm();
  const [committed, setCommitted] = useState<{ created: number; updated: number; skipped: number; songs: number; tables: number; optOuts: number } | null>(null);
  // B1: per-row, per-field opt-out from the merge UI. Keyed on
  // ImportRowPreview.rowIndex (1-based). Empty set = apply all diffs;
  // entries with field names = skip those overwrites for that row.
  const [optOut, setOptOut] = useState<Record<number, Set<MergeableField>>>({});

  // Re-parse headers + suggest mapping whenever the user edits the textarea.
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
    // Only re-infer if the header count changed; preserves user overrides.
    setMapping((prev) => (prev.length === newHeaders.length ? prev : inferMapping(newHeaders)));
  }, [text]);

  function loadPreview() {
    if (!text.trim() || mapping.length === 0) return;
    setPreviewError(null);
    startPreview(async () => {
      try {
        const result = await previewImport({ text, mapping });
        setPreview(result);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
        setPreview(null);
      }
    });
  }

  async function commit() {
    if (!preview || preview.validGuests === 0) return;
    const parts: string[] = [];
    if (preview.newGuests > 0) {
      parts.push(`Create ${preview.newGuests} new guest${preview.newGuests === 1 ? "" : "s"}`);
    }
    if (preview.updatedGuests > 0) {
      parts.push(`Merge into ${preview.updatedGuests} existing guest${preview.updatedGuests === 1 ? "" : "s"}`);
    }
    if (preview.newHouseholds.length > 0) {
      parts.push(`+ ${preview.newHouseholds.length} new household${preview.newHouseholds.length === 1 ? "" : "s"}`);
    }
    if (preview.newTables.length > 0) {
      parts.push(`+ ${preview.newTables.length} new table${preview.newTables.length === 1 ? "" : "s"}`);
    }
    const bodyParts: string[] = [parts.join("\n")];
    if (preview.updatedGuests > 0) {
      bodyParts.push(`Merge means: existing rows are updated in place. Empty fields get filled from the import; non-empty fields are preserved. Confirmed RSVPs are never reset to pending. Songs and dietary requirements are unioned (no duplicates).`);
    }
    if (preview.rowErrors > 0) {
      bodyParts.push(`${preview.rowErrors} row${preview.rowErrors === 1 ? "" : "s"} with errors will be skipped.`);
    }
    if (preview.duplicateEmails > 0) {
      bodyParts.push(`${preview.duplicateEmails} row${preview.duplicateEmails === 1 ? "" : "s"} share an email with another Guest row but don't match by name — those will create a second guest row. (User sign-in accounts are stored separately and aren't checked here.)`);
    }
    if (!(await confirm({
      title: "Run guest import?",
      body: bodyParts.join("\n\n"),
      confirmLabel: "Import",
    }))) return;
    // Serialise opt-out: only include rows that have at least one
    // un-ticked field.
    const optOutPayload: Record<string, string[]> = {};
    for (const [rowIndex, fields] of Object.entries(optOut)) {
      if (fields.size === 0) continue;
      optOutPayload[rowIndex] = [...fields];
    }
    startCommit(async () => {
      try {
        const result = await commitImport({ text, mapping, optOut: optOutPayload });
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
    if (committed.created > 0) lines.push(`Created ${committed.created} new guest${committed.created === 1 ? "" : "s"}`);
    if (committed.updated > 0) lines.push(`Merged into ${committed.updated} existing guest${committed.updated === 1 ? "" : "s"}`);
    if (committed.tables > 0) lines.push(`${committed.tables} new table${committed.tables === 1 ? "" : "s"} (auto-seated)`);
    if (committed.songs > 0) lines.push(`${committed.songs} song request${committed.songs === 1 ? "" : "s"}`);
    if (committed.optOuts > 0) lines.push(`${committed.optOuts} field${committed.optOuts === 1 ? "" : "s"} preserved (you opted out)`);
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <div className="bg-moss-50 border border-moss-100 rounded-md p-6 text-center shadow-sm">
            <div className="text-3xl mb-2">✓</div>
            <h2 className="font-display text-2xl text-moss-700 mb-2">Imported</h2>
            {lines.length > 0 ? (
              <ul className="text-sm text-ink-secondary mb-1 space-y-0.5">
                {lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-secondary mb-1">No changes.</p>
            )}
            {committed.skipped > 0 && (
              <p className="text-xs text-ink-tertiary mb-4">
                {committed.skipped} row{committed.skipped === 1 ? "" : "s"} skipped (had row errors).
              </p>
            )}
            <div className="flex gap-2 justify-center mt-3">
              <Button variant="primary" size="sm" onClick={() => router.push("/guests")}>
                Back to Guests
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
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs space-y-1">
          <div>
            Paste a CSV from <strong>Say I Do</strong>, Google Sheets, Excel, or any wedding-platform export. Tab-separated paste from a spreadsheet also works. The first row is treated as headers; column types are auto-inferred — adjust them below if any are wrong.
          </div>
          <div className="text-[11px] opacity-80">
            <strong>Note:</strong> guest emails and user sign-in accounts are stored in separate tables. Importing a guest with the same email as your sign-in account does <em>not</em> touch your account — they&apos;re independent records.
          </div>
        </div>

        {/* v2.5.1 (finding #7): file picker + drop zone — the primary
            path now. Reads straight into the same `text` state the
            paste path below drives; zero server-side changes needed,
            the existing mapping/preview pipeline is reused as-is. */}
        <section
          className={[
            "border-2 border-dashed rounded-md p-5 text-center transition-colors",
            dragOver ? "border-moss-500 bg-moss-50/40" : "border-border-soft bg-canvas",
          ].join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-ink-secondary mb-2">
            Drop a <code className="text-[11px] bg-surface border border-border-soft px-1 rounded">.csv</code> or <code className="text-[11px] bg-surface border border-border-soft px-1 rounded">.tsv</code> file here, or
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            Choose file
          </Button>
          {fileError && <p className="text-xs text-danger mt-2">{fileError}</p>}
        </section>

        <details className="bg-surface border border-border-soft rounded-md text-xs">
          <summary className="px-4 py-2.5 cursor-pointer text-ink-secondary hover:text-ink-primary list-none flex items-center gap-1.5">
            <span className="text-ink-tertiary">▸</span>
            Prefer to paste instead? <span className="text-ink-tertiary font-normal">(Windows Notepad guide)</span>
          </summary>
          <div className="px-4 pb-3 pt-1 border-t border-border-soft text-ink-secondary">
            <p className="text-[12px] leading-relaxed">
              Right-click the downloaded <code className="text-[11px] bg-canvas border border-border-soft px-1 rounded">.csv</code> → <strong>Open with</strong> → <strong>Notepad</strong>, select all (<kbd className="text-[10px] bg-canvas border border-border-soft px-1 rounded">Ctrl</kbd>+<kbd className="text-[10px] bg-canvas border border-border-soft px-1 rounded">A</kbd>), copy (<kbd className="text-[10px] bg-canvas border border-border-soft px-1 rounded">Ctrl</kbd>+<kbd className="text-[10px] bg-canvas border border-border-soft px-1 rounded">C</kbd>), then paste into the box below. Excel/Google Sheets works the same way — select all, copy, paste; tab-separated paste is auto-detected.
            </p>
          </div>
        </details>

        <section className="bg-surface border border-border-soft rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">
              Or paste CSV / TSV
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
          <MappingTable
            headers={headers}
            mapping={mapping}
            onChange={setMapping}
            disabled={previewing || committing}
          />
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

        {preview && (
          <PreviewPanel
            preview={preview}
            onCommit={commit}
            committing={committing}
            optOut={optOut}
            onToggleOptOut={(rowIndex, field) => {
              setOptOut((prev) => {
                const next = { ...prev };
                const current = next[rowIndex] ?? new Set<MergeableField>();
                const updated = new Set(current);
                if (updated.has(field)) updated.delete(field);
                else updated.add(field);
                if (updated.size === 0) delete next[rowIndex];
                else next[rowIndex] = updated;
                return next;
              });
            }}
          />
        )}
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
  mapping: GuestField[];
  onChange: (m: GuestField[]) => void;
  disabled: boolean;
}) {
  const usedNonIgnore = useMemo(() => {
    const counts = new Map<GuestField, number>();
    for (const f of mapping) {
      if (f === "ignore") continue;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    return counts;
  }, [mapping]);

  // First/Last OR a single Full name column satisfies the "have a name" rule.
  const hasName = usedNonIgnore.has("fullName") || (usedNonIgnore.has("firstName") && usedNonIgnore.has("lastName"));
  const requiredMissing: string[] = hasName ? [] : ["First name + Last name (or Full name)"];
  // Only flag as a problem if the field doesn't allow multi-value mapping.
  const duplicates = Array.from(usedNonIgnore.entries()).filter(
    ([f, c]) => c > 1 && !MULTI_VALUE_FIELDS.has(f),
  );

  function setOne(idx: number, field: GuestField) {
    const next = [...mapping];
    next[idx] = field;
    onChange(next);
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Column mapping</h2>
        <p className="text-[11px] text-ink-tertiary">
          Tell the importer what each column means. Required: First name, Last name.
        </p>
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
                    onChange={(e) => setOne(i, e.target.value as GuestField)}
                    disabled={disabled}
                    className="text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none"
                  >
                    {ALL_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {GUEST_FIELD_LABELS[f]}
                      </option>
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
            <div>Duplicate mapping: <strong>{duplicates.map(([f]) => GUEST_FIELD_LABELS[f]).join(", ")}</strong> — only the first column will be used. (Song request and Notes are allowed to repeat.)</div>
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
  optOut,
  onToggleOptOut,
}: {
  preview: ImportPreview;
  onCommit: () => void;
  committing: boolean;
  optOut: Record<number, Set<MergeableField>>;
  onToggleOptOut: (rowIndex: number, field: MergeableField) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // Per-row "show changes" disclosure state. Persists across re-renders;
  // collapsed by default to keep the table dense.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const visibleRows = showAll ? preview.rows : preview.rows.slice(0, 12);

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-ink-primary">Preview</h2>
        <div className="text-[11px] text-ink-tertiary flex gap-3 flex-wrap">
          <span>{preview.totalGuests} rows</span>
          {preview.newGuests > 0 && <span className="text-moss-700">{preview.newGuests} new</span>}
          {preview.updatedGuests > 0 && <span className="text-info">{preview.updatedGuests} merging into existing</span>}
          {preview.rowErrors > 0 && <span className="text-danger">{preview.rowErrors} with errors</span>}
          {preview.duplicateEmails > 0 && <span className="text-marigold-700">{preview.duplicateEmails} duplicate email{preview.duplicateEmails === 1 ? "" : "s"}</span>}
          {preview.newHouseholds.length > 0 && <span>{preview.newHouseholds.length} new household{preview.newHouseholds.length === 1 ? "" : "s"}</span>}
          {preview.newTables.length > 0 && <span>{preview.newTables.length} new table{preview.newTables.length === 1 ? "" : "s"}</span>}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Household</th>
              <th className="px-3 py-2 text-left">Table</th>
              <th className="px-3 py-2 text-left">Side</th>
              <th className="px-3 py-2 text-left">RSVP</th>
              <th className="px-3 py-2 text-left">Meals · songs</th>
              <th className="px-3 py-2 text-left">Notes / issues</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.flatMap((r) => {
              const hasError = r.errors.length > 0;
              const mealBits = [r.mealStarter && "S", r.mealMain && "M", r.mealDessert && "D"].filter(Boolean);
              const isExpanded = expanded.has(r.rowIndex);
              const hasDiffs = r.guestAction === "update" && r.fieldDiffs.length > 0;
              const optOutForRow = optOut[r.rowIndex] ?? new Set<MergeableField>();
              const rows: ReactNode[] = [];
              rows.push(
                <tr
                  key={r.rowIndex}
                  className={["border-b border-border-soft", hasError ? "bg-danger-bg/40" : "", isExpanded ? "" : "last:border-b-0"].join(" ")}
                >
                  <td className="px-3 py-1.5 text-ink-tertiary tabular-nums align-top">{r.rowIndex}</td>
                  <td className="px-3 py-1.5 text-ink-primary align-top">
                    <div>
                      {r.firstName || <em className="text-danger">(missing)</em>}{" "}
                      {r.lastName || <em className="text-danger">(missing)</em>}
                      {r.guestAction === "update" && !hasDiffs && (
                        <span
                          className="ml-1.5 text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1 rounded"
                          title="A guest with this name already exists — but every field already matches. No-op merge."
                        >
                          merge · no changes
                        </span>
                      )}
                      {hasDiffs && (
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.rowIndex)) next.delete(r.rowIndex);
                            else next.add(r.rowIndex);
                            return next;
                          })}
                          className="ml-1.5 text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded hover:bg-[color:#e0eef0] cursor-pointer"
                          title={isExpanded ? "Hide field-level changes" : "Show what would be overwritten"}
                        >
                          merge · {isExpanded ? "▾" : "▸"} {r.fieldDiffs.length} change{r.fieldDiffs.length === 1 ? "" : "s"}
                          {optOutForRow.size > 0 && (
                            <span className="ml-1 text-marigold-700">
                              ({optOutForRow.size} opted out)
                            </span>
                          )}
                        </button>
                      )}
                      {r.isChild && <span className="ml-1.5 text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Child</span>}
                      {r.needsHighchair && <span className="ml-1 text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Highchair</span>}
                      {r.childrenMeal && <span className="ml-1 text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Kids meal</span>}
                    </div>
                    {r.email && <div className="text-[10px] text-ink-tertiary truncate max-w-[200px]">{r.email}</div>}
                    {r.tags.length > 0 && (
                      <div className="text-[10px] text-ink-tertiary mt-0.5">{r.tags.slice(0, 3).join(" · ")}{r.tags.length > 3 ? " …" : ""}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary align-top">
                    {r.householdName ? (
                      <>
                        <div>{r.householdName}</div>
                        <span
                          className={[
                            "text-[10px] px-1 rounded",
                            r.householdAction === "merge"
                              ? "text-info bg-[color:#eef4f5] dark:bg-muted"
                              : "text-moss-700 bg-moss-50 border border-moss-100",
                          ].join(" ")}
                        >
                          {r.householdAction === "merge" ? "merge" : "new"}
                        </span>
                      </>
                    ) : (
                      <em className="text-ink-tertiary">solo</em>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary align-top">
                    {r.tableName ? (
                      <>
                        <div>{r.tableName}</div>
                        <span
                          className={[
                            "text-[10px] px-1 rounded",
                            r.tableAction === "merge"
                              ? "text-info bg-[color:#eef4f5] dark:bg-muted"
                              : "text-moss-700 bg-moss-50 border border-moss-100",
                          ].join(" ")}
                        >
                          {r.tableAction === "merge" ? "seat" : "new"}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize align-top">{r.side.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize align-top">{r.rsvp.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary align-top">
                    <div className="flex gap-1.5 items-center text-[10px]">
                      {mealBits.length > 0 && (
                        <span title={[r.mealStarter && `Starter: ${r.mealStarter}`, r.mealMain && `Main: ${r.mealMain}`, r.mealDessert && `Dessert: ${r.mealDessert}`].filter(Boolean).join("\n")} className="text-moss-700 bg-moss-50 border border-moss-100 px-1 rounded font-mono">
                          {mealBits.join("/")}
                        </span>
                      )}
                      {r.songs.length > 0 && (
                        <span title={r.songs.join("\n")} className="text-info bg-[color:#eef4f5] dark:bg-muted px-1 rounded">
                          ♪ {r.songs.length}
                        </span>
                      )}
                      {r.dietary.length > 0 && (
                        <span title={r.dietary.join(", ")} className="text-marigold-700 bg-marigold-100 px-1 rounded">
                          🥗 {r.dietary.length}
                        </span>
                      )}
                      {mealBits.length === 0 && r.songs.length === 0 && r.dietary.length === 0 && (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-[11px] space-y-0.5 align-top">
                    {r.errors.map((e, i) => (
                      <div key={`e${i}`} className="text-danger flex items-start gap-1">
                        <AlertTriangle aria-hidden className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{e}</span>
                      </div>
                    ))}
                    {r.warnings.map((w, i) => (
                      <div key={`w${i}`} className="text-marigold-700">! {w}</div>
                    ))}
                    {r.errors.length === 0 && r.warnings.length === 0 && (
                      <span className="text-ink-tertiary">ok</span>
                    )}
                  </td>
                </tr>
              );
              if (hasDiffs && isExpanded) {
                rows.push(
                  <tr key={`${r.rowIndex}-diff`} className="border-b border-border-soft last:border-b-0 bg-canvas/60">
                    <td colSpan={8} className="px-3 py-2.5">
                      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1.5">
                        Field-level changes — untick to skip an overwrite
                      </div>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-[10px] text-ink-tertiary">
                            <th className="text-left pb-1 w-6"></th>
                            <th className="text-left pb-1 w-32">Field</th>
                            <th className="text-left pb-1">Existing</th>
                            <th className="text-left pb-1">After import</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.fieldDiffs.map((d) => {
                            const isOptedOut = optOutForRow.has(d.field);
                            return (
                              <tr key={d.field} className={isOptedOut ? "opacity-50" : ""}>
                                <td className="py-0.5 pr-1.5 align-top">
                                  <input
                                    type="checkbox"
                                    checked={!isOptedOut}
                                    onChange={() => onToggleOptOut(r.rowIndex, d.field)}
                                    title={isOptedOut ? "Apply this overwrite" : "Skip this overwrite (keep the existing value)"}
                                    className="cursor-pointer"
                                  />
                                </td>
                                <td className="py-0.5 pr-2 text-ink-secondary align-top whitespace-nowrap">{d.label}</td>
                                <td className="py-0.5 pr-2 text-ink-tertiary align-top whitespace-pre-wrap break-words">{d.oldValue}</td>
                                <td className={["py-0.5 align-top whitespace-pre-wrap break-words", isOptedOut ? "text-ink-tertiary line-through" : "text-info"].join(" ")}>{d.newValue}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
      {preview.rows.length > 12 && (
        <div className="border-t border-border-soft px-4 py-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${preview.rows.length}`}
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-soft">
        <Link href="/guests" className="text-xs text-ink-tertiary hover:text-ink-primary self-center">
          Cancel
        </Link>
        <Button
          variant="primary"
          size="sm"
          onClick={onCommit}
          disabled={committing || preview.validGuests === 0}
        >
          {committing
            ? "Importing…"
            : preview.updatedGuests > 0 && preview.newGuests > 0
              ? `Import ${preview.newGuests} + merge ${preview.updatedGuests}`
              : preview.updatedGuests > 0
                ? `Merge ${preview.updatedGuests} guest${preview.updatedGuests === 1 ? "" : "s"}`
                : `Import ${preview.newGuests} guest${preview.newGuests === 1 ? "" : "s"}`}
        </Button>
      </div>
    </section>
  );
}
