// v2.8.1 (Tier 2, Slice B): the attendeeRef pool. Surfaces the app
// USERS (the ~5 people who log in — couple / wedding party / planner),
// the four built-in virtual groups, and any custom PermissionGroups,
// each with the exact ref string the schedule-event attendee picker
// uses: "user:<id>", "builtin:<slug>", "group:<slug>". The model needs
// these refs to reason about who a schedule event is for.
//
// NB these are app USERS, not wedding GUESTS — and custom groups here
// are PermissionGroup (bundles of users), NOT GuestGroup (bundles of
// wedding guests). Email addresses are omitted; only display names.
//
// Gate: canView(schedule) — same section the attendee picker lives in.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import {
  BUILTIN_GROUPS,
  displayName,
  resolveBuiltinGroup,
  type UserShape,
} from "@/lib/group-members";
import type { AiTool } from "./types";

const inputSchema = z.object({});

export const readMembers: AiTool<typeof inputSchema> = {
  name: "read_members",
  description:
    "Read the app members & groups that can be attendees of a schedule event: users (each with a 'user:<id>' ref, display name, role, couple flag), the four built-in virtual groups ('builtin:everyone' / 'couple' / 'wedding-party-role' / 'planners-role', with member counts), and any custom permission groups ('group:<slug>'). These are the people who LOG IN (not wedding guests), and the refs are what event.* attendee fields use. Emails are not included.",
  inputSchema,
  progressLabel: "Reading members & groups…",
  definition: {
    name: "read_members",
    description:
      "Read app members & groups for schedule-event attendees: users (user:<id> refs), built-in virtual groups (builtin:<slug>, with counts), and custom permission groups (group:<slug>). App users, not wedding guests. No emails.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    if (!(await canView(ctx.user, "schedule"))) {
      return { ok: false, error: "Members aren't visible to this user." };
    }

    const [users, customGroups] = await Promise.all([
      db.user.findMany({
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          role: true,
          isCouple: true,
        },
      }),
      db.permissionGroup.findMany({
        orderBy: { order: "asc" },
        select: { slug: true, name: true, _count: { select: { members: true } } },
      }),
    ]);

    // UserShape carries email (used only for the displayName fallback +
    // the built-in resolver) — it never leaves this handler.
    const userShapes: UserShape[] = users;

    return {
      ok: true,
      data: {
        users: users.map((u) => ({
          ref: `user:${u.id}`,
          id: u.id,
          name: displayName(u),
          role: u.role,
          isCouple: u.isCouple,
        })),
        builtinGroups: BUILTIN_GROUPS.map((g) => ({
          ref: `builtin:${g.slug}`,
          slug: g.slug,
          name: g.name,
          memberCount: resolveBuiltinGroup(g.slug, userShapes).length,
        })),
        customGroups: customGroups.map((g) => ({
          ref: `group:${g.slug}`,
          slug: g.slug,
          name: g.name,
          memberCount: g._count.members,
        })),
      },
    };
  },
};
