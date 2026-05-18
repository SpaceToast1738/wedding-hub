"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import {
  loadSuppliersForMention,
  type SupplierMention,
} from "@/lib/supplier-mentions";

// v1.98.0: drop-in <textarea> replacement that pops a supplier picker
// when the user types `@`. Selecting a supplier inserts
// "@SupplierName " into the textarea at the cursor.
//
// Lazy loading: the supplier list fetches on the first `@` keystroke
// per mount (rather than at mount time) so notes-y textareas that
// never see an `@` don't pay the data-load cost. Once loaded the list
// is cached for the component's lifetime — re-opening the picker
// reuses it.
//
// Insertion shape: plain text "@SupplierName" with a trailing space.
// No structured DB-side link (yet). This keeps storage compatible
// with every existing textarea path that just persists the string —
// no migrations, no parsers to bolt on, no rename-propagation
// problem to solve in v1.98.0. The trailing space is part of how
// chat-style mention pickers feel — keystroke ends and the next
// thing the user types is normal text, not still inside the
// mention.
//
// Scope: replaces plain `<textarea>` only. Tiptap-based rich text
// editors (the TEXT card body) get the same feature via a Tiptap
// mention extension in a follow-up release.

const TRIGGER = "@";
const MAX_RESULTS = 8;

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const MentionableTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function MentionableTextarea({ onChange, onKeyDown, value, ...rest }, ref) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

    const [suppliers, setSuppliers] = useState<SupplierMention[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    // The character offset of the `@` that opened the picker. We
    // re-derive the filter query from textarea.value.slice(triggerAt+1,
    // cursor) on every keystroke so the picker tracks edits within the
    // mention naturally.
    const [triggerAt, setTriggerAt] = useState<number | null>(null);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    // Fetch lazily — first @ keystroke triggers the load. Cached on
    // the local state so subsequent opens reuse the list.
    const ensureLoaded = useCallback(async () => {
      if (suppliers != null || loading) return;
      setLoading(true);
      try {
        const list = await loadSuppliersForMention();
        setSuppliers(list);
      } catch {
        // Silent fail — picker just stays empty, user types plain
        // text. No need to notify; this is an enhancement.
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    }, [suppliers, loading]);

    const filtered = useMemo(() => {
      if (!suppliers) return [];
      const q = query.toLowerCase().trim();
      if (!q) return suppliers.slice(0, MAX_RESULTS);
      return suppliers
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q),
        )
        .slice(0, MAX_RESULTS);
    }, [suppliers, query]);

    function closePicker() {
      setOpen(false);
      setTriggerAt(null);
      setQuery("");
      setActiveIndex(0);
    }

    function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
      onChange?.(e);
      if (!open || triggerAt == null) return;
      const cursor = e.target.selectionStart ?? 0;
      // If the cursor wandered before the trigger, close.
      if (cursor <= triggerAt) {
        closePicker();
        return;
      }
      const slice = e.target.value.slice(triggerAt + 1, cursor);
      // Whitespace in the query closes the picker — Slack / GitHub
      // do the same. Mention is whatever's right after the @ until
      // the user hits space or moves the cursor away.
      if (/\s/.test(slice)) {
        closePicker();
        return;
      }
      setQuery(slice);
      setActiveIndex(0);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      // Picker navigation takes precedence over normal textarea
      // behaviour while open. Defer to parent's onKeyDown for any
      // key we don't claim.
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closePicker();
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          if (filtered.length > 0) {
            e.preventDefault();
            const supplier = filtered[activeIndex] ?? filtered[0]!;
            insertMention(supplier);
            return;
          }
          // No matches — fall through to default textarea behaviour
          // (Enter inserts a newline, Tab focuses next field).
        }
      }

      // Detect the `@` trigger. The check is "did the user just type
      // `@` at a position where a mention can start?" — i.e. start of
      // input, or preceded by whitespace. Mid-word `@` (e.g. an
      // email address) doesn't open the picker.
      if (e.key === TRIGGER) {
        const el = localRef.current;
        if (!el) {
          onKeyDown?.(e);
          return;
        }
        const cursor = el.selectionStart ?? 0;
        const prev = cursor > 0 ? el.value[cursor - 1] : "";
        const atWordStart = cursor === 0 || /\s/.test(prev ?? "");
        if (atWordStart) {
          // Cursor is currently *before* the @ — after the keystroke
          // resolves the @ will sit at position `cursor`. Track that.
          setTriggerAt(cursor);
          setOpen(true);
          setQuery("");
          setActiveIndex(0);
          // Kick the fetch but don't block — user can keep typing.
          void ensureLoaded();
        }
      }

      onKeyDown?.(e);
    }

    function insertMention(supplier: SupplierMention) {
      const el = localRef.current;
      if (!el || triggerAt == null) {
        closePicker();
        return;
      }
      const cursor = el.selectionStart ?? 0;
      const before = el.value.slice(0, triggerAt);
      const after = el.value.slice(cursor);
      // "@Name " — trailing space so the user keeps typing after.
      const insertion = `@${supplier.name} `;
      const next = before + insertion + after;
      // Build a synthetic change so the parent's onChange (which
      // probably owns the value via React state) updates.
      const fakeEvent = {
        target: { ...el, value: next, selectionStart: before.length + insertion.length, selectionEnd: before.length + insertion.length },
        currentTarget: el,
      } as unknown as ChangeEvent<HTMLTextAreaElement>;
      // Update the DOM directly so the cursor lands correctly
      // before React's re-render (controlled inputs sometimes reset
      // selectionStart to value-length).
      el.value = next;
      el.setSelectionRange(
        before.length + insertion.length,
        before.length + insertion.length,
      );
      onChange?.(fakeEvent);
      closePicker();
      // Restore focus — the dropdown click stole it momentarily.
      el.focus();
    }

    // Click-outside to close. Mousedown rather than click so the
    // picker doesn't briefly flash before disappearing.
    useEffect(() => {
      if (!open) return;
      function onMouseDown(e: MouseEvent) {
        const el = localRef.current;
        const dropdown = dropdownRef.current;
        const target = e.target as Node;
        if (
          el && !el.contains(target) &&
          dropdown && !dropdown.contains(target)
        ) {
          closePicker();
        }
      }
      window.addEventListener("mousedown", onMouseDown);
      return () => window.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    const dropdownRef = useRef<HTMLDivElement | null>(null);

    return (
      <div className="relative">
        <textarea
          {...rest}
          ref={localRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Suppliers"
            className="absolute z-50 mt-1 max-h-64 w-full max-w-xs overflow-auto rounded-md border border-border-soft bg-surface shadow-lg"
            style={{ top: "100%" }}
          >
            {loading && (suppliers == null) ? (
              <div className="px-3 py-2 text-xs text-ink-tertiary italic">
                Loading suppliers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-ink-tertiary italic">
                {suppliers && suppliers.length === 0
                  ? "No suppliers yet — add one on /suppliers"
                  : `No suppliers match "${query}"`}
              </div>
            ) : (
              <ul>
                {filtered.map((s, i) => {
                  const active = i === activeIndex;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          // Prevent the textarea from losing focus
                          // before insertMention runs.
                          e.preventDefault();
                        }}
                        onClick={() => insertMention(s)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={[
                          "w-full text-left px-3 py-1.5 text-sm flex items-baseline justify-between gap-2",
                          active
                            ? "bg-moss-50 text-ink-primary"
                            : "bg-surface text-ink-secondary hover:bg-canvas",
                        ].join(" ")}
                        aria-selected={active}
                        role="option"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                          {s.category}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  },
);
