// v2.12.0: the shared character-paging convention for unbounded text
// fields, extracted from read_file_content (v2.11.0) when read_task
// needed the same thing for @db.Text notes.
//
// Why this exists at all: the registry hard-caps a SERIALIZED tool
// result at 24,000 chars and chops blind when it overflows. Any tool
// returning an unbounded column therefore has to cap itself first — and
// a cap without a continuation is how the tail of a document becomes
// unreachable rather than merely un-fetched. Both known incidents (the
// Alveston Manor contract's clause 8+, and task notes flagged
// `notesTruncated` with nowhere to go) were that same shape.
//
// The contract, mirroring read_tasks' offset/nextOffset paging:
//   - `offset` is a CHARACTER position into already-extracted text, so
//     it means the same thing for a PDF, a .txt and a notes column.
//   - `truncated` means "there is more after this slice" — unchanged
//     from the pre-paging semantics, so callers that ignore paging
//     behave exactly as they did before.
//   - `sliceChars` counts real characters, EXCLUDING the marker, so
//     `content.slice(0, sliceChars)` concatenated across calls
//     reassembles the source byte-exact.
//   - The marker names the next call. The original wording ("open the
//     full file on /files") read as a dead end and is very likely why
//     the cap was experienced as data loss rather than as paging.

/** Default page size. Sits below the registry's 24,000-char cap on the
 *  serialized result so the friendly marker — not a blind mid-JSON chop
 *  — is what the model sees once the text is JSON-escaped and wrapped. */
export const DEFAULT_SLICE_CHARS = 16_000;

export type TextSlice = {
  /** The slice, plus a continuation marker when more remains. */
  content: string;
  /** True when there is more text after this slice. */
  truncated: boolean;
  /** Offset for the next call, or null at the end of the text. */
  nextOffset: number | null;
  /** Real characters in this slice, excluding the marker. */
  sliceChars: number;
};

export function sliceText(
  text: string,
  offset: number,
  opts: { toolName: string; argName?: string; max?: number },
): TextSlice {
  const max = opts.max ?? DEFAULT_SLICE_CHARS;
  const argName = opts.argName ?? "offset";
  const start = Math.min(Math.max(offset, 0), text.length);
  const end = Math.min(start + max, text.length);
  const slice = text.slice(start, end);
  const more = end < text.length;
  return {
    content: more
      ? slice +
        `\n…[truncated at ${max} chars — ${text.length - end} to go; call ${opts.toolName} again with ${argName}=${end}]`
      : slice,
    truncated: more,
    nextOffset: more ? end : null,
    sliceChars: slice.length,
  };
}

/** The `page` object returned alongside a slice. Same field names
 *  wherever paging appears, so one convention has to be learned once. */
export function slicePage(
  offset: number,
  slice: TextSlice,
  totalChars: number,
): { offset: number; returnedChars: number; totalChars: number; nextOffset: number | null } {
  return {
    offset,
    returnedChars: slice.sliceChars,
    totalChars,
    nextOffset: slice.nextOffset,
  };
}

/** Shared "you aimed past the end" error. Returning this rather than an
 *  empty string tells a caller the real length so it can re-aim, instead
 *  of concluding the text ended early. A caller following `nextOffset`
 *  never reaches it — that chain terminates at null. */
export function pastEndError(
  label: string,
  offset: number,
  totalChars: number,
  argName = "offset",
): string {
  return `${argName} ${offset} is past the end of ${label} (${totalChars} chars). Start at 0 and follow page.nextOffset.`;
}
