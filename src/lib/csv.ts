// Tiny CSV / TSV parser. RFC 4180-ish — handles quoted fields with embedded
// separators and escaped double-quotes ("" → "). Multiline cells (newlines
// inside quotes) supported. Auto-detects comma vs tab based on the header line.
//
// Sufficient for Say I Do exports, Google Sheets paste, and Excel CSV exports.

export type ParsedRow = string[];

export function detectSeparator(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
}

export function parseCsv(text: string, sep?: "," | "\t"): ParsedRow[] {
  const separator = sep ?? detectSeparator(text);
  const rows: ParsedRow[] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === "") {
        inQuotes = true;
      } else if (ch === separator) {
        current.push(cell);
        cell = "";
      } else if (ch === "\r") {
        // ignore — \n handles line break
      } else if (ch === "\n") {
        current.push(cell);
        cell = "";
        if (current.some((c) => c.length > 0)) rows.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    if (current.some((c) => c.length > 0)) rows.push(current);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

// ─── Column inference for the guest-import flow ────────────────────────────

export type GuestField =
  | "firstName"
  | "lastName"
  | "fullName"        // single "Jamie Spencer"-style column → split on commit
  | "email"
  | "phone"
  | "household"
  | "side"
  | "rsvp"
  | "isChild"
  | "needsHighchair"
  | "childrenMeal"    // boolean — does a child guest need the children's-meal option
  | "plusOneAllowed"
  | "plusOneName"
  | "role"
  | "dietary"
  | "tags"            // pipe / comma / semicolon delimited
  | "mealStarter"
  | "mealMain"
  | "mealDessert"
  | "songRequest"     // multi-column allowed; each yields one SongRequest row
  | "tableName"       // table name → resolve to Table+Seat at commit
  | "rsvpLink"        // per-party Say I Do RSVP URL (shared within a household)
  | "notes"           // multi-column allowed; concatenated with header labels
  | "ignore";

export const GUEST_FIELD_LABELS: Record<GuestField, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name (split on first space)",
  email: "Email",
  phone: "Phone",
  household: "Household / party name",
  tableName: "Table assignment",
  side: "Side (bride / groom / both)",
  rsvp: "RSVP status",
  isChild: "Adult / child",
  needsHighchair: "Needs highchair",
  childrenMeal: "Children's meal needed",
  plusOneAllowed: "Plus-one allowed",
  plusOneName: "Plus-one name",
  role: "Role (best man, MoH, …)",
  dietary: "Dietary",
  tags: "Tags / groups (pipe-delimited)",
  mealStarter: "Meal — starter",
  mealMain: "Meal — main",
  mealDessert: "Meal — dessert",
  songRequest: "Song request (can repeat)",
  rsvpLink: "RSVP link (Say I Do unique URL)",
  notes: "Notes (can repeat)",
  ignore: "— Ignore —",
};

// Fields that allow more than one column to map to them. Multi-song-request
// becomes multiple SongRequest rows; multi-notes get concatenated with their
// header labels at commit time.
export const MULTI_VALUE_FIELDS: ReadonlySet<GuestField> = new Set([
  "songRequest",
  "notes",
]);

// Order matters: more specific patterns first. The first matching heuristic
// wins, so e.g. "Q2 main meal" should hit `mealMain` before any general
// "main" pattern.
const HEURISTICS: Array<{ field: GuestField; tests: RegExp[] }> = [
  { field: "fullName", tests: [/^(guest\s*)?(full\s*)?name$/i] },
  { field: "firstName", tests: [/^first\s*name$/i, /^fname$/i, /^given(\s*name)?$/i, /^forename$/i] },
  { field: "lastName", tests: [/^last\s*name$/i, /^lname$/i, /^surname$/i, /^family\s*name$/i] },
  { field: "email", tests: [/^e[\s-]?mail/i] },
  { field: "phone", tests: [/^phone/i, /^mobile/i, /^cell/i, /^tel/i] },
  { field: "household", tests: [/^household/i, /^family/i, /^group$/i, /^party(\s*name)?$/i] },
  { field: "tableName", tests: [/^table(\s*(name|number|#))?$/i] },
  { field: "side", tests: [/^side$/i, /^bride.*groom/i, /^groom.*bride/i] },
  { field: "rsvp", tests: [/^rsvp/i, /^attending/i, /^status/i, /^response/i] },
  // Question-numbered columns (Q2:, Q4:, etc.) — must come before generic patterns
  { field: "mealStarter", tests: [/^q\d+.*(starter|first\s*course|appetiser|appetizer)/i, /^starter$/i, /^appetiser$/i] },
  { field: "mealMain", tests: [/^q\d+.*main\s*meal/i, /^main(\s*course|\s*meal)?$/i, /^entr(e|é)e/i] },
  { field: "mealDessert", tests: [/^q\d+.*(des(s)?ert|pudding|sweet)/i, /^des(s)?ert$/i, /^pudding$/i] },
  { field: "needsHighchair", tests: [/^q\d+.*highchair/i, /^highchair$/i] },
  { field: "childrenMeal", tests: [/^q\d+.*(children|kids?).*meal/i, /^children('?s)?\s*meal$/i, /^kids?\s*meal$/i] },
  { field: "songRequest", tests: [/^q\d+.*song/i, /^song(\s*request|s)?$/i] },
  { field: "rsvpLink", tests: [/^(unique|rsvp|sayido|say\s*i\s*do)\s*(link|url)$/i, /^unique\s*link$/i] },
  { field: "isChild", tests: [/^adult\s*\/?\s*child$/i, /^child\s*\/?\s*adult$/i, /^child$/i, /^is\s*child$/i, /^kid$/i, /^age\s*group$/i] },
  { field: "plusOneAllowed", tests: [/^plus[\s-]?one(\s*allowed)?$/i, /^\+1$/i, /^guest\s*allowed/i] },
  { field: "plusOneName", tests: [/^plus[\s-]?one\s*name/i, /^\+1\s*name/i, /^guest\s*name/i] },
  { field: "role", tests: [/^role/i, /^wedding\s*role/i, /^position/i] },
  { field: "dietary", tests: [/^dietary/i, /^diet/i, /^allergies/i, /^food\s*requirements?/i] },
  { field: "tags", tests: [/^groups?$/i, /^tags?$/i, /^categor(y|ies)$/i, /^labels?$/i] },
  { field: "notes", tests: [/^notes?$/i, /^comments?$/i, /^remarks/i] },
];

export function inferField(header: string): GuestField {
  const trimmed = header.trim();
  for (const { field, tests } of HEURISTICS) {
    if (tests.some((re) => re.test(trimmed))) return field;
  }
  return "ignore";
}

export function inferMapping(headers: string[]): GuestField[] {
  const used = new Set<GuestField>();
  return headers.map((h) => {
    const guess = inferField(h);
    if (guess === "ignore") return "ignore";
    if (used.has(guess) && !MULTI_VALUE_FIELDS.has(guess)) return "ignore";
    used.add(guess);
    return guess;
  });
}

// ─── Coercion helpers used by the import action ────────────────────────────

const TRUTHY = new Set(["y", "yes", "true", "t", "1", "x", "✓"]);
// Includes the standard empty-placeholder set ("-", "n/a", etc.) so a CSV
// like Say I Do's — where Q7 highchair and Q8 children's-meal columns are
// filled with "-" on every adult row — doesn't generate a warning per row.
// The semantic intent there IS "no, not applicable".
const FALSY = new Set([
  "n", "no", "false", "f", "0",
  "", "-", "—", "n/a", "n.a.", "na", "none",
]);

export function coerceBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (TRUTHY.has(s)) return true;
  if (FALSY.has(s)) return false;
  return null;
}

// Adult / Child has its own coercer because "Adult" and "Child" don't fit the
// generic boolean truthy/falsy convention.
const CHILD_MAP: Record<string, boolean | null> = {
  child: true,
  kid: true,
  minor: true,
  infant: true,
  baby: true,
  yes: true,
  y: true,
  true: true,
  "1": true,
  adult: false,
  grown: false,
  no: false,
  n: false,
  false: false,
  "0": false,
  "": false,
  "-": false,
};

export function coerceChild(raw: string): boolean | null {
  return CHILD_MAP[raw.trim().toLowerCase()] ?? null;
}

const SIDE_MAP: Record<string, "BRIDE" | "GROOM" | "BOTH"> = {
  bride: "BRIDE",
  brides: "BRIDE",
  "bride's": "BRIDE",
  "bride's side": "BRIDE",
  groom: "GROOM",
  grooms: "GROOM",
  "groom's": "GROOM",
  "groom's side": "GROOM",
  both: "BOTH",
  shared: "BOTH",
  joint: "BOTH",
  "": "BOTH",
};

export function coerceSide(raw: string): "BRIDE" | "GROOM" | "BOTH" {
  return SIDE_MAP[raw.trim().toLowerCase()] ?? "BOTH";
}

const RSVP_MAP: Record<string, "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE"> = {
  yes: "ATTENDING",
  attending: "ATTENDING",
  accepted: "ATTENDING",
  going: "ATTENDING",
  no: "DECLINED",
  declined: "DECLINED",
  "not going": "DECLINED",
  cant: "DECLINED",
  "can't": "DECLINED",
  maybe: "MAYBE",
  pending: "PENDING",
  awaiting: "PENDING",
  "no response": "PENDING",
  "": "PENDING",
};

export function coerceRsvp(raw: string): "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE" {
  return RSVP_MAP[raw.trim().toLowerCase()] ?? "PENDING";
}

// Strip non-dietary placeholders. "None" / "N.a." / "Non" / "-" all mean
// "no requirements" — they shouldn't end up as actual dietary tags.
const NEGATIVE_DIETARY = /^(none|nope|no|n\.?a\.?|n\/a|nil|nothing|—|-)$/i;

export function coerceDietary(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s && !NEGATIVE_DIETARY.test(s));
}

export function coerceTags(raw: string): string[] {
  return raw
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMPTY_VALUES = new Set(["", "-", "—", "n/a", "n.a.", "na", "none"]);

export function isEmptyValue(raw: string): boolean {
  return EMPTY_VALUES.has(raw.trim().toLowerCase());
}

export function nonEmptyOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return isEmptyValue(raw) ? null : raw.trim();
}

// Split a "Tyler Spencer" or "Bryony-Olwyn Davis" name on the first whitespace.
// "Bryony Olwyn-Davis" → ("Bryony", "Olwyn-Davis"). Edge cases like single-word
// names ("Cher") yield (name, "").
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
}

// "Bryony's side", "Jamie's side" → BRIDE / GROOM. Used to extract `side` from
// the multi-tag "Groups" column when no explicit side column is present.
export function inferSideFromTags(
  tags: string[],
  brideName?: string,
  groomName?: string,
): "BRIDE" | "GROOM" | "BOTH" | null {
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t.includes("bride")) return "BRIDE";
    if (t.includes("groom")) return "GROOM";
    if (brideName && t.includes(brideName.toLowerCase())) return "BRIDE";
    if (groomName && t.includes(groomName.toLowerCase())) return "GROOM";
  }
  return null;
}

// ─── Column inference for the task-import flow (v1.16.0) ───────────────────

export type TaskField =
  | "title"
  | "type"           // task / question / decision
  | "priority"       // LOW / MEDIUM / HIGH / URGENT
  | "status"         // OPEN / IN_PROGRESS / WAITING / DONE / ARCHIVED
  | "dueDate"        // YYYY-MM-DD or DD/MM/YYYY or ISO timestamp
  | "assigneeEmail"  // resolved to assigneeId at commit time; null if unmatched
  | "tags"           // pipe / comma / semicolon delimited
  | "notes"
  | "ignore";

export const TASK_FIELD_LABELS: Record<TaskField, string> = {
  title: "Title",
  type: "Type (task / question / decision)",
  priority: "Priority (low / medium / high / urgent)",
  status: "Status (open / in progress / waiting / done)",
  dueDate: "Due date",
  assigneeEmail: "Assignee email",
  tags: "Tags (pipe-delimited)",
  notes: "Notes",
  ignore: "— Ignore —",
};

const TASK_HEURISTICS: Array<{ field: TaskField; tests: RegExp[] }> = [
  { field: "title",         tests: [/^(task\s*)?title$/i, /^name$/i, /^description$/i, /^summary$/i, /^todo$/i] },
  { field: "type",          tests: [/^type$/i, /^kind$/i, /^category$/i] },
  { field: "priority",      tests: [/^priority$/i, /^pri$/i, /^urgency$/i] },
  { field: "status",        tests: [/^status$/i, /^state$/i, /^progress$/i] },
  { field: "dueDate",       tests: [/^due/i, /^deadline$/i, /^when$/i, /\bdate\b/i] },
  { field: "assigneeEmail", tests: [/^assignee$/i, /^assigned/i, /^owner$/i, /^who$/i, /^email$/i] },
  { field: "tags",          tests: [/^tags?$/i, /^labels?$/i, /^groups?$/i] },
  { field: "notes",         tests: [/^notes?$/i, /^comments?$/i, /^details?$/i, /^description$/i] },
];

export function inferTaskMapping(headers: string[]): TaskField[] {
  const used = new Set<TaskField>();
  return headers.map((h) => {
    const cleaned = h.trim();
    if (!cleaned) return "ignore";
    for (const { field, tests } of TASK_HEURISTICS) {
      if (used.has(field)) continue;
      if (tests.some((re) => re.test(cleaned))) {
        used.add(field);
        return field;
      }
    }
    return "ignore";
  });
}

const TASK_TYPE_MAP: Record<string, "TASK" | "QUESTION" | "DECISION"> = {
  task: "TASK",
  todo: "TASK",
  action: "TASK",
  question: "QUESTION",
  q: "QUESTION",
  decision: "DECISION",
  decide: "DECISION",
  choice: "DECISION",
  "": "TASK",
};

export function coerceTaskType(raw: string): "TASK" | "QUESTION" | "DECISION" {
  return TASK_TYPE_MAP[raw.trim().toLowerCase()] ?? "TASK";
}

const TASK_PRIORITY_MAP: Record<string, "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
  low: "LOW",
  l: "LOW",
  medium: "MEDIUM",
  med: "MEDIUM",
  m: "MEDIUM",
  normal: "MEDIUM",
  high: "HIGH",
  h: "HIGH",
  urgent: "URGENT",
  u: "URGENT",
  critical: "URGENT",
  "": "MEDIUM",
};

export function coerceTaskPriority(raw: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  return TASK_PRIORITY_MAP[raw.trim().toLowerCase()] ?? "MEDIUM";
}

const TASK_STATUS_MAP: Record<string, "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "ARCHIVED"> = {
  open: "OPEN",
  todo: "OPEN",
  new: "OPEN",
  pending: "OPEN",
  "in progress": "IN_PROGRESS",
  "in_progress": "IN_PROGRESS",
  doing: "IN_PROGRESS",
  active: "IN_PROGRESS",
  wip: "IN_PROGRESS",
  waiting: "WAITING",
  blocked: "WAITING",
  "on hold": "WAITING",
  done: "DONE",
  complete: "DONE",
  completed: "DONE",
  closed: "DONE",
  archived: "ARCHIVED",
  cancelled: "ARCHIVED",
  canceled: "ARCHIVED",
  "": "OPEN",
};

export function coerceTaskStatus(raw: string): "OPEN" | "IN_PROGRESS" | "WAITING" | "DONE" | "ARCHIVED" {
  return TASK_STATUS_MAP[raw.trim().toLowerCase()] ?? "OPEN";
}

// Accepts:
//   - YYYY-MM-DD              → 2026-09-26
//   - YYYY-MM-DDTHH:mm:ss…    → ISO timestamp (any timezone marker)
//   - DD/MM/YYYY              → UK-style; we ASSUME UK because the user is UK-based
//   - DD-MM-YYYY              → same as above
// Returns a Date or null. Tomorrow / next-week NL parsing is intentionally
// out of scope — too easy to misread.
export function coerceTaskDueDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // ISO-ish: YYYY-MM-DD or YYYY-MM-DDT…
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // UK-style: DD/MM/YYYY or DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
