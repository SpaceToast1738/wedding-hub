// v1.61.1: pure-decision module — extracted from
// src/app/(app)/tasks/actions.ts so the parser can be unit-tested
// without a server-action context. The action file re-exports the
// same function so existing imports keep working.
//
// Background. Tasks (and questions / decisions) link to four kinds of
// "topics" — Wedding Book sections, Wedding Book subsections (cards),
// nav tags, and guest groups. The picker emits one `topicKeys` entry
// per selected ID, prefixed by source so the parser can split:
//   bookSection:<id>      v1.30.5
//   bookSubsection:<id>   v1.51.0
//   navTag:<id>           v1.30.5
//   guestGroup:<id>       v1.61.0 (XL1)
//
// The `__touched__` sentinel (v1.61.1) is emitted by both the
// TopicPicker (form-submit path) and TaskDrawer.save() (manual
// FormData) so `formData.has("topicKeys")` returns true even when
// the user has cleared every chip. Pre-fix, an empty selection
// looked identical to a partial update that didn't touch topics —
// so removing the last chip was a silent no-op.
//
// The sentinel is dropped here (no prefix matches) so it doesn't
// pollute any of the four ID arrays.

export const TOPIC_TOUCHED_SENTINEL = "__touched__";

export type ParsedTopicKeys = {
  bookSectionIds: string[];
  bookSubsectionIds: string[];
  navTagIds: string[];
  guestGroupIds: string[];
  /** True when the FormData included any `topicKeys` field — the
   *  signal that the form actually intended to set topics (vs. a
   *  partial update that didn't include the picker). */
  hasTopicKeys: boolean;
};

export function parseTopicKeys(formData: FormData): ParsedTopicKeys {
  const hasTopicKeys = formData.has("topicKeys");
  const keys = formData.getAll("topicKeys").map(String);
  const bookSectionIds: string[] = [];
  const bookSubsectionIds: string[] = [];
  const navTagIds: string[] = [];
  const guestGroupIds: string[] = [];
  for (const k of keys) {
    if (k.startsWith("bookSection:")) bookSectionIds.push(k.slice("bookSection:".length));
    else if (k.startsWith("bookSubsection:")) bookSubsectionIds.push(k.slice("bookSubsection:".length));
    else if (k.startsWith("navTag:")) navTagIds.push(k.slice("navTag:".length));
    else if (k.startsWith("guestGroup:")) guestGroupIds.push(k.slice("guestGroup:".length));
    // Anything else (incl. the touched sentinel and stray noise) is
    // silently dropped — keeps the parser forward-compatible if a
    // future picker source uses an unknown prefix.
  }
  return { bookSectionIds, bookSubsectionIds, navTagIds, guestGroupIds, hasTopicKeys };
}
