"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GUEST_FIELD_LABELS, type GuestField, inferMapping, parseCsv } from "@/lib/csv";
import { commitImport, previewImport, type ImportPreview } from "./actions";

const SAMPLE = `First Name,Last Name,Email,Household,Side,RSVP,Plus One Allowed,Dietary
Robert,Spencer,robert@example.com,The Spencer Family,Groom,Yes,No,
Margaret,Spencer,,The Spencer Family,Groom,Yes,No,Vegetarian
Sophie,Olwyn-Davis,sophie@example.com,The Olwyn-Davis Family,Bride,Pending,No,GF`;

const ALL_FIELDS: GuestField[] = [
  "firstName", "lastName", "email", "phone", "household", "side", "rsvp",
  "isChild", "plusOneAllowed", "plusOneName", "role", "dietary", "notes", "ignore",
];

export function ImportClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<GuestField[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, startCommit] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [committed, setCommitted] = useState<{ created: number; skipped: number } | null>(null);

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

  function commit() {
    if (!preview || preview.validGuests === 0) return;
    if (
      !confirm(
        `Create ${preview.validGuests} guest${preview.validGuests === 1 ? "" : "s"}` +
          (preview.newHouseholds.length > 0
            ? ` and ${preview.newHouseholds.length} new household${preview.newHouseholds.length === 1 ? "" : "s"}`
            : "") +
          `? ${preview.rowErrors} row${preview.rowErrors === 1 ? "" : "s"} with errors will be skipped.`,
      )
    ) {
      return;
    }
    startCommit(async () => {
      try {
        const result = await commitImport({ text, mapping });
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
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-moss-50 border border-moss-100 rounded-md p-6 text-center shadow-sm">
            <div className="text-3xl mb-2">✓</div>
            <h2 className="font-display text-2xl text-moss-700 mb-2">Imported</h2>
            <p className="text-sm text-ink-secondary mb-4">
              Created {committed.created} guest{committed.created === 1 ? "" : "s"}
              {committed.skipped > 0 && ` · ${committed.skipped} skipped (had row errors)`}.
            </p>
            <div className="flex gap-2 justify-center">
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
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs">
          Paste a CSV from <strong>Say I Do</strong>, Google Sheets, Excel, or any wedding-platform export. Tab-separated paste from a spreadsheet also works. The first row is treated as headers; column types are auto-inferred — adjust them below if any are wrong.
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
          <PreviewPanel preview={preview} onCommit={commit} committing={committing} />
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

  const requiredMissing = (["firstName", "lastName"] as GuestField[]).filter(
    (f) => !usedNonIgnore.has(f),
  );
  const duplicates = Array.from(usedNonIgnore.entries()).filter(([, c]) => c > 1);

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
            <div>Required mapping missing: <strong>{requiredMissing.map((f) => GUEST_FIELD_LABELS[f]).join(", ")}</strong></div>
          )}
          {duplicates.length > 0 && (
            <div>Duplicate mapping: <strong>{duplicates.map(([f]) => GUEST_FIELD_LABELS[f]).join(", ")}</strong> — only the first column will be used.</div>
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
  preview: ImportPreview;
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
          <span>{preview.totalGuests} rows</span>
          <span className="text-moss-700">{preview.validGuests} valid</span>
          {preview.rowErrors > 0 && <span className="text-danger">{preview.rowErrors} with errors</span>}
          {preview.newHouseholds.length > 0 && <span>{preview.newHouseholds.length} new household{preview.newHouseholds.length === 1 ? "" : "s"}</span>}
          {preview.existingHouseholds.length > 0 && <span>{preview.existingHouseholds.length} merging into existing</span>}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Household</th>
              <th className="px-3 py-2 text-left">Side</th>
              <th className="px-3 py-2 text-left">RSVP</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Notes / issues</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const hasError = r.errors.length > 0;
              return (
                <tr
                  key={r.rowIndex}
                  className={["border-b border-border-soft last:border-b-0", hasError ? "bg-danger-bg/40" : ""].join(" ")}
                >
                  <td className="px-3 py-1.5 text-ink-tertiary tabular-nums">{r.rowIndex}</td>
                  <td className="px-3 py-1.5 text-ink-primary">
                    {r.firstName || <em className="text-danger">(missing)</em>}{" "}
                    {r.lastName || <em className="text-danger">(missing)</em>}
                    {r.isChild && <span className="ml-1.5 text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Child</span>}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary">
                    {r.householdName ? (
                      <>
                        {r.householdName}
                        <span
                          className={[
                            "ml-1.5 text-[10px] px-1 rounded",
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
                  <td className="px-3 py-1.5 text-ink-secondary capitalize">{r.side.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary capitalize">{r.rsvp.toLowerCase()}</td>
                  <td className="px-3 py-1.5 text-ink-secondary truncate max-w-[200px]">{r.email ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[11px] space-y-0.5">
                    {r.errors.map((e, i) => (
                      <div key={`e${i}`} className="text-danger">⚠ {e}</div>
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
            : `Import ${preview.validGuests} guest${preview.validGuests === 1 ? "" : "s"}`}
        </Button>
      </div>
    </section>
  );
}
