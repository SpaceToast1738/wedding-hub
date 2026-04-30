// v1.32.0: human-readable formatter for audit log rows. Replaces the
// terse "verb-noun" display in the AuditLogPanel with sentences like
// "Saved DIY card 'Centerpieces' — added 2 materials" instead of
// "build-save book subsection".
//
// Order of precedence:
//   1. metadata.summary — explicit human string written by the action.
//      Always wins. Use this when the auto-formatter can't capture the
//      nuance (e.g. multi-step actions, custom phrasing).
//   2. Pattern-matched format from {action, entity, metadata} for
//      known action codes — covers every audit() call shipped to date.
//   3. Generic fallback: "{verb} {noun}" plus title-ish metadata if
//      present. Better than the v1.21.0 raw verb-noun.
//
// Adding new audit calls? Either provide `metadata.summary` directly
// or extend the switch below for a stable action-code → phrase map.

type AuditMetadata = Record<string, unknown> | null | undefined;

type AuditRow = {
  action: string;
  entity: string;
  metadata?: AuditMetadata;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickTitle(meta: Record<string, unknown>): string | null {
  return (
    asString(meta.cardTitle) ||
    asString(meta.title) ||
    asString(meta.name) ||
    asString(meta.label) ||
    asString(meta.materialName) ||
    null
  );
}

function quoted(s: string | null | undefined): string {
  return s ? `"${s}"` : "(untitled)";
}

function pluralise(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function entityLabel(entity: string): string {
  // Map Prisma model names to human nouns. Falls back to a kebabed
  // form when no mapping exists.
  const map: Record<string, string> = {
    Task: "task",
    Guest: "guest",
    Household: "household",
    BookSection: "Wedding Book section",
    BookSubsection: "Wedding Book card",
    Supplier: "supplier",
    BudgetLine: "budget line",
    BudgetCategory: "budget category",
    Payment: "payment",
    File: "file",
    ScheduleEvent: "schedule event",
    Table: "seating table",
    Seat: "seat",
    User: "user",
    Permission: "permission",
    SongRequest: "song request",
    Playlist: "playlist",
    NavTag: "nav tag",
    AuditLog: "audit row",
    CustomField: "custom field",
    WeddingSettings: "wedding settings",
    CeremonySeating: "ceremony layout",
  };
  return map[entity] ?? entity.replace(/([A-Z])/g, " $1").trim().toLowerCase();
}

export function formatAuditAction(row: AuditRow): string {
  const meta: Record<string, unknown> =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};

  // 1. Explicit summary wins.
  const explicit = asString(meta.summary);
  if (explicit) return explicit;

  const a = row.action;
  const title = pickTitle(meta);

  // 2. Pattern matches per action prefix.

  // BUILD card (v1.31.0+)
  if (a === "build-save") {
    const parts: string[] = [];
    const ma = asNumber(meta.materialsAdded) ?? 0;
    const mr = asNumber(meta.materialsRemoved) ?? 0;
    const mu = asNumber(meta.materialsUpdated) ?? 0;
    if (ma > 0) parts.push(`added ${pluralise(ma, "material", "materials")}`);
    if (mr > 0) parts.push(`removed ${pluralise(mr, "material", "materials")}`);
    if (mu > 0 && ma === 0 && mr === 0) parts.push(`edited ${pluralise(mu, "material", "materials")}`);
    const headerChanged = Array.isArray(meta.headerChanged) ? (meta.headerChanged as unknown[]).length : 0;
    if (headerChanged > 0 && parts.length === 0) parts.push("updated header");
    return `Saved DIY card ${quoted(title)}${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  }
  if (a === "build-material-create")
    return `Added material ${quoted(asString(meta.materialName))} to DIY card ${quoted(title)}`;
  if (a === "build-material-update")
    return `Edited material ${quoted(asString(meta.materialName))} in DIY card ${quoted(title)}`;
  if (a === "build-material-delete")
    return `Removed material ${quoted(asString(meta.materialName))} from DIY card ${quoted(title)}`;
  if (a === "build-material-flag") {
    const flag = asString(meta.flag);
    const value = meta.value === true ? "ticked" : "unticked";
    return `${value === "ticked" ? "Ticked" : "Unticked"} ${flag ?? "flag"} on material ${quoted(asString(meta.materialName))} (${title ?? "DIY card"})`;
  }
  if (a === "build-material-reorder")
    return `Reordered material ${quoted(asString(meta.materialName))} in DIY card ${quoted(title)}`;
  if (a === "build-session-create") {
    const mins = asNumber(meta.minutes);
    const units = asNumber(meta.unitsCompleted);
    return `Logged ${mins != null ? `${mins} min` : "a session"}${units != null ? ` (${units} units)` : ""} on DIY card ${quoted(title)}`;
  }
  if (a === "build-session-update")
    return `Edited a session on DIY card ${quoted(title)}`;
  if (a === "build-session-delete")
    return `Deleted a session from DIY card ${quoted(title)}`;
  if (a === "build-copy-to-budget")
    return `Copied DIY card ${quoted(title)} materials total to a new budget line`;
  if (a === "build-update-budget-line")
    return `Updated linked budget line for DIY card ${quoted(title)}`;
  if (a === "build-unlink-budget")
    return `Unlinked budget line from DIY card ${quoted(title)}`;
  if (a === "build-update")
    return `Updated DIY card header ${quoted(title)}`;

  // MENU card (v1.32.0+)
  if (a === "menu-save") {
    const parts: string[] = [];
    const ca = asNumber(meta.coursesAdded) ?? 0;
    const cr = asNumber(meta.coursesRemoved) ?? 0;
    const oa = asNumber(meta.optionsAdded) ?? 0;
    const or = asNumber(meta.optionsRemoved) ?? 0;
    const ou = asNumber(meta.optionsUpdated) ?? 0;
    if (ca > 0) parts.push(`added ${pluralise(ca, "course", "courses")}`);
    if (cr > 0) parts.push(`removed ${pluralise(cr, "course", "courses")}`);
    if (oa > 0) parts.push(`added ${pluralise(oa, "option", "options")}`);
    if (or > 0) parts.push(`removed ${pluralise(or, "option", "options")}`);
    if (ou > 0 && oa === 0 && or === 0) parts.push(`edited ${pluralise(ou, "option", "options")}`);
    return `Saved menu ${quoted(title)}${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  }

  // SETUP card (v1.33.0+)
  if (a === "setup-save") {
    const ia = asNumber(meta.itemsAdded) ?? 0;
    const ir = asNumber(meta.itemsRemoved) ?? 0;
    const iu = asNumber(meta.itemsUpdated) ?? 0;
    const parts: string[] = [];
    if (ia > 0) parts.push(`added ${pluralise(ia, "item", "items")}`);
    if (ir > 0) parts.push(`removed ${pluralise(ir, "item", "items")}`);
    if (iu > 0 && ia === 0 && ir === 0) parts.push(`edited ${pluralise(iu, "item", "items")}`);
    return `Saved setup card ${quoted(title)}${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  }

  // BAR card (v1.32.0+)
  if (a === "bar-save") {
    const ia = asNumber(meta.itemsAdded) ?? 0;
    const ir = asNumber(meta.itemsRemoved) ?? 0;
    const iu = asNumber(meta.itemsUpdated) ?? 0;
    const parts: string[] = [];
    if (ia > 0) parts.push(`added ${pluralise(ia, "item", "items")}`);
    if (ir > 0) parts.push(`removed ${pluralise(ir, "item", "items")}`);
    if (iu > 0 && ia === 0 && ir === 0) parts.push(`edited ${pluralise(iu, "item", "items")}`);
    return `Saved bar plan ${quoted(title)}${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  }

  // Tasks (v1.30.5)
  if (row.entity === "Task") {
    const taskTitle = asString(meta.title);
    const taskType = asString(meta.type);
    const noun = taskType
      ? taskType === "TASK"
        ? "task"
        : taskType.toLowerCase()
      : "task";
    if (a === "create") return `Created ${noun} ${quoted(taskTitle)}`;
    if (a === "update") {
      const changedFields = Array.isArray(meta.changedFields)
        ? (meta.changedFields as unknown[]).filter((f) => typeof f === "string").length
        : 0;
      return `Updated ${noun} ${quoted(taskTitle)}${changedFields > 0 ? ` — ${pluralise(changedFields, "field", "fields")} changed` : ""}`;
    }
    if (a === "delete") return `Deleted ${noun} ${quoted(taskTitle)}`;
    if (a === "status") {
      const status = asString(meta.status);
      return `Set ${noun} ${quoted(taskTitle)} status to ${status ?? "?"}`;
    }
    if (a === "answer") return `Answered question ${quoted(taskTitle)}`;
  }

  // ScheduleEvent (v1.30.5)
  if (row.entity === "ScheduleEvent") {
    const t = asString(meta.title);
    if (a === "create") return `Added schedule event ${quoted(t)}`;
    if (a === "update") {
      const changed = Array.isArray(meta.changedFields)
        ? (meta.changedFields as unknown[]).filter((f) => typeof f === "string")
        : [];
      return `Updated schedule event ${quoted(t)}${changed.length > 0 ? ` — ${changed.join(", ")}` : ""}`;
    }
    if (a === "delete") return `Deleted schedule event ${quoted(t)}`;
  }

  // NavTag (v1.30.5)
  if (row.entity === "NavTag") {
    const n = asString(meta.name);
    if (a === "create") return `Added nav tag ${quoted(n)}`;
    if (a === "update") return `Updated nav tag ${quoted(n)}`;
    if (a === "delete") {
      const linked = asNumber(meta.linkedTaskCount) ?? 0;
      return `Deleted nav tag ${quoted(n)}${linked > 0 ? ` (${pluralise(linked, "task", "tasks")} unlinked)` : ""}`;
    }
  }

  // BookSubsection (v1.26.0+)
  if (row.entity === "BookSubsection") {
    if (a === "create") {
      const kind = asString(meta.kind);
      return `Added Wedding Book card${kind ? ` (${kind.toLowerCase()})` : ""}`;
    }
    if (a === "update") return `Edited Wedding Book card`;
    if (a === "delete") return `Deleted Wedding Book card`;
    if (a === "visibility") {
      const v = asString(meta.visibility);
      return `Set Wedding Book card visibility to ${v ?? "?"}`;
    }
    // Recipe / Shot / Outfit / Field sub-actions on BookSubsection
    if (a === "recipe-update") return `Updated recipe on Wedding Book card`;
    if (a === "shot-create") return `Added a shot to Wedding Book shot list`;
    if (a === "shot-update") return `Updated a shot on Wedding Book shot list`;
    if (a === "shot-delete") return `Removed a shot from Wedding Book shot list`;
    if (a === "shot-toggle-captured") return `Toggled "captured" on a shot`;
    if (a === "outfit-create") return `Added an outfit to Wedding Book outfit card`;
    if (a === "outfit-update") return `Updated an outfit on Wedding Book outfit card`;
    if (a === "outfit-delete") return `Removed an outfit from Wedding Book outfit card`;
    if (a === "field-create") return `Added a field to Wedding Book field card`;
    if (a === "field-update") return `Updated a field on Wedding Book field card`;
    if (a === "field-delete") return `Removed a field from Wedding Book field card`;
    if (a === "field-value") return `Set a field value on Wedding Book field card`;
  }

  if (row.entity === "BookSection") {
    const t = asString(meta.title);
    if (a === "create") return `Added Wedding Book section ${quoted(t)}`;
    if (a === "update") return `Updated Wedding Book section ${quoted(t)}`;
    if (a === "delete") return `Deleted Wedding Book section ${quoted(t)}`;
    if (a === "visibility") {
      const v = asString(meta.visibility);
      return `Set Wedding Book section visibility to ${v ?? "?"}`;
    }
  }

  // Generic CRUD verbs against any entity.
  const nounLabel = entityLabel(row.entity);
  const VERBS: Record<string, string> = {
    create: "Added",
    update: "Updated",
    delete: "Deleted",
    archive: "Archived",
    restore: "Restored",
    assign: "Assigned",
    unassign: "Unassigned",
    sign: "Signed",
    pay: "Paid",
    schedule: "Scheduled",
  };
  const verb = VERBS[a];
  if (verb) {
    return `${verb} ${nounLabel}${title ? ` ${quoted(title)}` : ""}`;
  }

  // 3. Generic fallback — at least give it a sentence shape.
  const friendlyAction = a.replace(/[-_]/g, " ");
  return `${friendlyAction} on ${nounLabel}${title ? ` ${quoted(title)}` : ""}`;
}
