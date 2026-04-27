// Tiny CSV / TSV parser. RFC 4180-ish — handles quoted fields with embedded
// separators and escaped double-quotes ("" → "). Multiline cells (newlines
// inside quotes) supported. Auto-detects comma vs tab based on the header line.
//
// Sufficient for Say I Do exports, Google Sheets paste, and Excel CSV exports.
// Not sufficient for: extreme edge cases like mixed quoting styles inside a
// single field. Good enough for a 5-user app importing < 200 guests.

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

  // Flush trailing cell / row
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
  | "email"
  | "phone"
  | "household"
  | "side"
  | "rsvp"
  | "isChild"
  | "plusOneAllowed"
  | "plusOneName"
  | "role"
  | "dietary"
  | "notes"
  | "ignore";

export const GUEST_FIELD_LABELS: Record<GuestField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  household: "Household name",
  side: "Side (bride / groom / both)",
  rsvp: "RSVP status",
  isChild: "Is child",
  plusOneAllowed: "Plus-one allowed",
  plusOneName: "Plus-one name",
  role: "Role (best man, MoH, …)",
  dietary: "Dietary",
  notes: "Notes",
  ignore: "— Ignore —",
};

const HEURISTICS: Array<{ field: GuestField; tests: RegExp[] }> = [
  { field: "firstName", tests: [/^first\s*name$/i, /^fname$/i, /^given(\s*name)?$/i, /^forename$/i] },
  { field: "lastName", tests: [/^last\s*name$/i, /^lname$/i, /^surname$/i, /^family\s*name$/i] },
  { field: "email", tests: [/^e[\s-]?mail/i] },
  { field: "phone", tests: [/^phone/i, /^mobile/i, /^cell/i, /^tel/i] },
  { field: "household", tests: [/^household/i, /^family/i, /^group/i, /^party/i] },
  { field: "side", tests: [/^side$/i, /^bride.*groom/i, /^groom.*bride/i] },
  { field: "rsvp", tests: [/^rsvp/i, /^attending/i, /^status/i, /^response/i] },
  { field: "isChild", tests: [/^child/i, /^is\s*child/i, /^kid/i] },
  { field: "plusOneAllowed", tests: [/^plus[\s-]?one(\s*allowed)?$/i, /^\+1$/i, /^guest\s*allowed/i] },
  { field: "plusOneName", tests: [/^plus[\s-]?one\s*name/i, /^\+1\s*name/i, /^guest\s*name/i] },
  { field: "role", tests: [/^role/i, /^wedding\s*role/i, /^position/i] },
  { field: "dietary", tests: [/^dietary/i, /^diet/i, /^allergies/i, /^food\s*requirements?/i] },
  { field: "notes", tests: [/^notes?/i, /^comments?/i, /^remarks/i] },
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
    // Don't double-map a field — second occurrence falls back to ignore.
    if (guess !== "ignore" && used.has(guess)) return "ignore";
    if (guess !== "ignore") used.add(guess);
    return guess;
  });
}

// ─── Coercion helpers used by the import action ────────────────────────────

const TRUTHY = new Set(["y", "yes", "true", "t", "1", "x", "✓"]);
const FALSY = new Set(["n", "no", "false", "f", "0", ""]);

export function coerceBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (TRUTHY.has(s)) return true;
  if (FALSY.has(s)) return false;
  return null;
}

const SIDE_MAP: Record<string, "BRIDE" | "GROOM" | "BOTH"> = {
  bride: "BRIDE",
  brides: "BRIDE",
  "bride's": "BRIDE",
  groom: "GROOM",
  grooms: "GROOM",
  "groom's": "GROOM",
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

export function coerceDietary(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
