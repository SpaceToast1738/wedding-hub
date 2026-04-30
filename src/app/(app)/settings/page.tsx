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
import { UserGroupsBlock } from "./UserGroupsBlock";
import {
  BUILTIN_GROUPS,
  displayName,
  resolveBuiltinGroup,
} from "@/lib/group-members";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ audit_before?: string; audit_q?: string }>;
}) {
  const user = await requireUser();
  const editable = await canEdit(user, "settings");
  const { audit_before, audit_q } = await searchParams;

  const [users, permissions, me, customFields, wedding, navTagsRaw, userGroupsRaw] = await Promise.all([
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
    // v1.40.0 (backlog #3): UserGroup rows for the couple-only
    // UserGroupsBlock. Eager-load member ids so the toggle UI
    // renders without a second round-trip.
    user.isCouple
      ? db.userGroup.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
          include: { members: { select: { id: true } } },
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

          {/* v1.40.0 (backlog #3): user-groups admin block. Couple-
              only management of custom groups; built-ins shown
              read-only with their computed member count. */}
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
            const builtins = BUILTIN_GROUPS.map((g) => ({
              slug: g.slug,
              name: g.name,
              members: resolveBuiltinGroup(g.slug, allUsersShape).map((u) => ({
                id: u.id,
                name: displayName(u),
              })),
            }));
            const groupRows = userGroupsRaw.map((g) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              description: g.description,
              order: g.order,
              members: g.members
                .map((m) => allUsersShape.find((u) => u.id === m.id))
                .filter((u): u is (typeof allUsersShape)[number] => Boolean(u))
                .map((u) => ({ id: u.id, name: displayName(u) })),
            }));
            return (
              <UserGroupsBlock
                groups={groupRows}
                builtins={builtins}
                allUsers={allUsersForBlock}
              />
            );
          })()}

          {editable && (
            <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs">
              ⓘ Sign-in is gated by the <code>AUTH_ALLOWED_EMAILS</code> env var. To add a new member, add their email there and have them sign in once — the row will appear here, then you can grant them per-section access.
            </div>
          )}

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
