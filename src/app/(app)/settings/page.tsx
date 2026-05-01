import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { isSpotifyConfigured } from "@/lib/spotify";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { PermissionMatrix } from "./PermissionMatrix";
import { MyProfilePanel } from "./MyProfilePanel";
import { SpotifySettingsPanel } from "./SpotifySettingsPanel";
import { CustomFieldsPanel } from "./CustomFieldsPanel";
import { WeddingSettingsPanel } from "./WeddingSettingsPanel";
import { AuditLogPanel } from "./AuditLogPanel";
import { NudgesPanel } from "./NudgesPanel";
import { NavTagsBlock } from "./NavTagsBlock";
import { PermissionGroupsBlock } from "./PermissionGroupsBlock";
import { GuestGroupsBlock } from "./GuestGroupsBlock";
import {
  BUILTIN_GROUPS,
  displayName,
  resolveBuiltinGroup,
} from "@/lib/group-members";
import {
  BUILTIN_GUEST_GROUPS,
  guestDisplayName,
  resolveBuiltinGuestGroup,
} from "@/lib/guest-group-members";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ audit_before?: string; audit_q?: string }>;
}) {
  const user = await requireUser();
  const editable = await canEdit(user, "settings");
  const { audit_before, audit_q } = await searchParams;

  const [
    users,
    permissions,
    me,
    customFields,
    wedding,
    navTagsRaw,
    permissionGroupsRaw,
    groupPermissionsRaw,
    guestGroupsRaw,
    allGuests,
  ] = await Promise.all([
    db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }] }),
    db.permission.findMany(),
    db.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true, email: true },
    }),
    db.customField.findMany({ orderBy: [{ entity: "asc" }, { order: "asc" }] }),
    getWeddingSettings(),
    // v1.30.5: nav tags + linked-task counts for the couple-only
    // NavTagsBlock. Only the couple needs to see the management
    // surface, but the underlying read is cheap so we always run it
    // and gate at the render site.
    user.isCouple
      ? db.navTag.findMany({
          orderBy: { order: "asc" },
          include: { _count: { select: { tasks: true } } },
        })
      : Promise.resolve([]),
    // v1.40.0 (backlog #3): PermissionGroup rows for the couple-only
    // PermissionGroupsBlock. Eager-load member ids so the toggle UI
    // renders without a second round-trip. v1.42.0: renamed from
    // UserGroup.
    user.isCouple
      ? db.permissionGroup.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
          include: { members: { select: { id: true } } },
        })
      : Promise.resolve([]),
    // v1.43.0: GroupPermission rows for the per-group matrix in the
    // PermissionGroupsBlock. Cheap read — at most 12 sections × N
    // groups (built-in + custom). No filter; we group client-side
    // by groupKey.
    user.isCouple
      ? db.groupPermission.findMany({
          select: { groupKey: true, section: true, level: true },
        })
      : Promise.resolve([]),
    // v1.42.0: GuestGroup rows + member ids for the couple-only
    // GuestGroupsBlock. Same pattern.
    user.isCouple
      ? db.guestGroup.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
          include: { members: { select: { id: true } } },
        })
      : Promise.resolve([]),
    // All non-archived guests for the GuestGroup membership picker.
    // Cheap read; the picker shows checkboxes per guest.
    user.isCouple
      ? db.guest.findMany({
          where: { archived: false },
          orderBy: [{ side: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            side: true,
            archived: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // Format the date for the datetime-local input + read view.
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = wedding.weddingDate;
  const dateForInput = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const spotifyConfigured = isSpotifyConfigured();

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, members, and per-section permissions" />
      {/* Vertical-only on the page; horizontal scrolling lives inside the
          permission matrix's own container so the page itself doesn't
          scroll sideways. Stops the trackpad-wobble where two scroll
          axes fight each other. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <MyProfilePanel
            email={me?.email ?? user.email}
            initialFirstName={me?.firstName ?? ""}
            initialLastName={me?.lastName ?? ""}
          />

          <WeddingSettingsPanel
            initial={{
              weddingDate: dateForInput,
              ceremonyTime: wedding.ceremonyTime,
              venue: wedding.venue,
              venueAddress: wedding.venueAddress ?? "",
              coupleLabel: wedding.coupleLabel,
              coupleShort: wedding.coupleShort,
              brideFirst: wedding.brideFirst,
              groomFirst: wedding.groomFirst,
            }}
            isCouple={user.isCouple}
          />

          <SpotifySettingsPanel configured={spotifyConfigured} isCouple={user.isCouple} />

          <CustomFieldsPanel
            fields={customFields.map((f) => ({
              id: f.id,
              entity: f.entity,
              name: f.name,
              type: f.type as "text" | "number" | "date" | "select",
              options: f.options,
            }))}
            isCouple={user.isCouple}
          />

          {/* v1.30.5: nav tags admin block, couple-only. Tags surface
              on tasks/questions/decisions via the Topics multi-select. */}
          {user.isCouple && (
            <NavTagsBlock
              tags={navTagsRaw.map((t) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                route: t.route,
                order: t.order,
                linkedTaskCount: t._count.tasks,
              }))}
            />
          )}

          {/* v1.40.0 (backlog #3): permission-groups admin block.
              Couple-only management of custom groups; built-ins
              shown with computed member counts. v1.43.0: each group
              now carries its own permission set; built-ins are
              editable for permissions even though their membership
              is computed. */}
          {user.isCouple && (() => {
            const allUsersShape = users.map((u) => ({
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              name: u.name,
              role: u.role,
              isCouple: u.isCouple,
            }));
            const allUsersForBlock = allUsersShape.map((u) => ({
              id: u.id,
              name: displayName(u),
            }));
            // Bucket GroupPermission rows by groupKey so each group
            // gets its own slice without N round-trips.
            const permsByKey = new Map<string, { section: string; level: typeof groupPermissionsRaw[number]["level"] }[]>();
            for (const p of groupPermissionsRaw) {
              const arr = permsByKey.get(p.groupKey) ?? [];
              arr.push({ section: p.section, level: p.level });
              permsByKey.set(p.groupKey, arr);
            }
            const builtins = BUILTIN_GROUPS.map((g) => ({
              slug: g.slug,
              name: g.name,
              members: resolveBuiltinGroup(g.slug, allUsersShape).map((u) => ({
                id: u.id,
                name: displayName(u),
              })),
              permissions: permsByKey.get(`builtin:${g.slug}`) ?? [],
            }));
            const groupRows = permissionGroupsRaw.map((g) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              description: g.description,
              order: g.order,
              members: g.members
                .map((m) => allUsersShape.find((u) => u.id === m.id))
                .filter((u): u is (typeof allUsersShape)[number] => Boolean(u))
                .map((u) => ({ id: u.id, name: displayName(u) })),
              permissions: permsByKey.get(`group:${g.slug}`) ?? [],
            }));
            return (
              <PermissionGroupsBlock
                groups={groupRows}
                builtins={builtins}
                allUsers={allUsersForBlock}
              />
            );
          })()}

          {/* v1.42.0: GuestGroups admin block — couple-only.
              Bundles wedding guests for ceremony seating colour-
              coding etc. Distinct from PermissionGroups above. */}
          {user.isCouple && (() => {
            const allGuestsForBlock = allGuests.map((g) => ({
              id: g.id,
              name: guestDisplayName(g),
            }));
            const guestBuiltins = BUILTIN_GUEST_GROUPS.map((bg) => ({
              slug: bg.slug,
              name: bg.name,
              members: resolveBuiltinGuestGroup(bg.slug, allGuests).map((g) => ({
                id: g.id,
                name: guestDisplayName(g),
              })),
            }));
            const guestGroupRows = guestGroupsRaw.map((g) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              description: g.description,
              colour: g.colour,
              order: g.order,
              members: g.members
                .map((m) => allGuests.find((x) => x.id === m.id))
                .filter((x): x is (typeof allGuests)[number] => Boolean(x))
                .map((x) => ({ id: x.id, name: guestDisplayName(x) })),
            }));
            return (
              <GuestGroupsBlock
                groups={guestGroupRows}
                builtins={guestBuiltins}
                allGuests={allGuestsForBlock}
              />
            );
          })()}

          {editable && (
            <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs">
              ⓘ Sign-in is gated by the <code>AUTH_ALLOWED_EMAILS</code> env var. To add a new member, add their email there and have them sign in once — the row will appear here. <strong>Permissions normally inherit from the groups above</strong> — use the override matrix below only for one-off exceptions.
            </div>
          )}

          {/* v1.43.0: per-user matrix demoted to "overrides
              (advanced)". Group permissions are the primary surface
              now; this panel exists to grant a single user a level
              stronger than any of their groups (rare). The resolver
              takes max(group, override) so demoting can never strip
              access — it only adds. */}
          <details className="bg-surface border border-border-soft rounded-md shadow-sm">
            <summary className="px-4 py-2.5 text-sm font-semibold text-ink-primary cursor-pointer select-none">
              Per-user overrides (advanced)
              <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                — set a level stronger than the user&apos;s groups give them
              </span>
            </summary>
            <PermissionMatrix
              users={users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                isCouple: u.isCouple,
              }))}
              permissions={permissions.map((p) => ({
                userId: p.userId,
                section: p.section,
                level: p.level,
              }))}
              currentUserId={user.id}
              currentUserIsCouple={user.isCouple}
              canEdit={editable}
            />
          </details>

          {/* v1.25.0: nudges digest, couple-only. */}
          {user.isCouple && <NudgesPanel />}

          <AuditLogPanel
            isCouple={user.isCouple}
            before={audit_before}
            query={audit_q}
          />
        </div>
      </div>
    </>
  );
}
