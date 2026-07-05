import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  canEdit,
  groupKeysForUser,
  reduceGroupPermissions,
  SECTIONS,
} from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { isSpotifyConfigured } from "@/lib/spotify";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { MemberOverridesBlock } from "./MemberOverridesBlock";
import { InviteBlock } from "./InviteBlock";
import { MyProfilePanel } from "./MyProfilePanel";
import { SpotifySettingsPanel } from "./SpotifySettingsPanel";
import { CustomFieldsPanel } from "./CustomFieldsPanel";
import { WeddingSettingsPanel } from "./WeddingSettingsPanel";
import { AiBudgetPanel } from "./AiBudgetPanel";
import { AiApiKeyPanel } from "./AiApiKeyPanel";
import { readAnthropicApiKeyState } from "./wedding-settings-actions";
import { DEFAULT_MONTHLY_CAP_PENCE } from "@/lib/ai/config";
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
import type { PermissionLevel } from "@prisma/client";

// v2.5.0 (design pass #2): shared chip class for the sticky section
// nav — plain anchors (not the Tag component, which is a button-only
// primitive) so the browser's native "jump to #id" behaviour works
// with no client JS. scroll-mt is set on the target sections, not
// here, since that's what actually needs to account for the nav's
// own height.
const SETTINGS_NAV_CHIP =
  "flex-shrink-0 text-xs px-2.5 py-2 sm:py-1 rounded-full border border-border-soft bg-muted text-ink-secondary hover:bg-canvas hover:text-ink-primary whitespace-nowrap transition-colors";

// v1.44.0: lightweight section wrapper for the settings page. Just
// a heading + optional subtitle + body. Helps the page read like a
// document with named sections instead of one long stream of cards.
// v2.5.0: optional `id` + scroll-mt-* so the sticky chip-nav's anchor
// links land below the nav bar instead of tucking the heading under it.
function SettingsSection({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 last:mb-0 scroll-mt-16">
      <header className="mb-3 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-ink-tertiary mt-0.5">{subtitle}</p>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

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
    invites,
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
    user.isCouple
      ? db.invite.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, isCouple: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // v2.1.0 phase 4: AI monthly cap. Separate query because
  // getWeddingSettings() strips the field to keep the shared read
  // small — this column is only consulted on /settings and inside
  // the AI budget guard.
  const aiCapRow = user.isCouple
    ? await db.weddingSettings.findUnique({
        where: { id: 1 },
        select: { aiMonthlyCapPence: true },
      })
    : null;

  // v2.1.0 phase 6.1: mask + source of the current Anthropic key.
  // Couple-only; the action returns { source: "none" } for others so
  // the panel just shows "not configured" without leaking presence.
  const apiKeyState = user.isCouple
    ? await readAnthropicApiKeyState()
    : null;

  // Format the date for the datetime-local input + read view.
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = wedding.weddingDate;
  const dateForInput = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const spotifyConfigured = isSpotifyConfigured();

  // v1.44.0: pre-compute the group-inherited level for every (user,
  // section) pair so the override matrix can render the "inherits
  // from group" baseline next to the override checkbox without
  // re-running the resolver per cell. Uses the same pure helpers
  // the runtime canView/canEdit path uses, so the displayed
  // "inherits" matches what the gates will actually grant.
  const customGroupsForResolver = permissionGroupsRaw.map((g) => ({
    slug: g.slug,
    members: g.members.map((m) => ({ id: m.id })),
  }));
  const groupInherited: Record<string, Record<string, PermissionLevel>> = {};
  for (const u of users) {
    const keys = groupKeysForUser(
      {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        name: u.name,
        role: u.role,
        isCouple: u.isCouple,
      },
      customGroupsForResolver,
    );
    const map = reduceGroupPermissions(keys, groupPermissionsRaw);
    const perSection: Record<string, PermissionLevel> = {};
    for (const s of SECTIONS) {
      perSection[s] = map.get(s) ?? ("NONE" as PermissionLevel);
    }
    groupInherited[u.id] = perSection;
  }

  // v2.5.0 (design pass #4): per-role permission summary for the
  // invite picker. Only the Couple option carried any warning about
  // its consequences before — Viewer/Wedding party/Planner gave no
  // indication of what a new invite would actually be able to see or
  // edit, which is the single highest-stakes moment on the page.
  // Computed the same way the real resolver would for a freshly-
  // invited user with that role (no couple flag, no custom-group
  // membership yet — those don't exist until the invite is accepted
  // and the couple deliberately adds them).
  const ROLE_PREVIEWS = ["VIEWER", "WEDDING_PARTY", "PLANNER"] as const;
  const rolePermissions: Record<(typeof ROLE_PREVIEWS)[number], { section: string; level: "NONE" | "VIEW" | "EDIT" }[]> = {
    VIEWER: [],
    WEDDING_PARTY: [],
    PLANNER: [],
  };
  for (const role of ROLE_PREVIEWS) {
    const keys = groupKeysForUser(
      { id: "__invite_preview__", email: "", role, isCouple: false },
      [],
    );
    const map = reduceGroupPermissions(keys, groupPermissionsRaw);
    rolePermissions[role] = SECTIONS.map((s) => ({
      section: s,
      level: (map.get(s) ?? "NONE") as "NONE" | "VIEW" | "EDIT",
    })).filter((p) => p.level !== "NONE");
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, members, and per-section permissions" />
      {/* v2.5.0 (design pass #2): sticky chip-nav under the header.
          Settings had grown to ~10 visually-identical panels with no
          in-page navigation, so less-visited ones (AI planner,
          Access & members) required scroll-scanning to find. Anchors
          match the `id`s on each SettingsSection below; couple-only
          sections are skipped entirely for non-couple viewers rather
          than linking to a section they'll never see rendered. */}
      <nav
        aria-label="Settings sections"
        className="sticky top-0 z-10 flex items-center gap-1.5 overflow-x-auto border-b border-border-soft bg-canvas/95 backdrop-blur-sm px-4 sm:px-6 py-2 flex-shrink-0"
      >
        <a href="#section-account" className={SETTINGS_NAV_CHIP}>Account</a>
        <a href="#section-wedding" className={SETTINGS_NAV_CHIP}>Wedding</a>
        {user.isCouple && <a href="#section-ai" className={SETTINGS_NAV_CHIP}>AI</a>}
        <a href="#section-customisation" className={SETTINGS_NAV_CHIP}>Customisation</a>
        {user.isCouple && <a href="#section-members" className={SETTINGS_NAV_CHIP}>Members</a>}
        <a href="#section-log" className={SETTINGS_NAV_CHIP}>Log</a>
      </nav>
      {/* Vertical-only on the page; horizontal scrolling lives inside the
          permission matrix's own container so the page itself doesn't
          scroll sideways. Stops the trackpad-wobble where two scroll
          axes fight each other. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* v1.44.0: panels grouped under named sections so the page
              reads like a document with chapters instead of one long
              stream of cards. Section headings are small uppercase
              labels — they don't compete with each panel's own h2. */}

          <SettingsSection id="section-account" title="Your account">
            <MyProfilePanel
              email={me?.email ?? user.email}
              initialFirstName={me?.firstName ?? ""}
              initialLastName={me?.lastName ?? ""}
            />
          </SettingsSection>

          <SettingsSection id="section-wedding" title="Wedding details">
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
          </SettingsSection>

          {user.isCouple && (
            <SettingsSection
              id="section-ai"
              title="AI planner"
              subtitle="Anthropic API key + monthly spend cap. Applies across all AI features."
            >
              {apiKeyState && <AiApiKeyPanel initialState={apiKeyState} />}
              <AiBudgetPanel
                currentPence={aiCapRow?.aiMonthlyCapPence ?? null}
                fallbackPence={DEFAULT_MONTHLY_CAP_PENCE}
              />
            </SettingsSection>
          )}

          <SettingsSection
            id="section-customisation"
            title="Customisation"
            subtitle="Tags and custom fields that surface across the app."
          >
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

            {/* v2.5.0 (design pass #3): GuestGroupsBlock moved here
                from "Access & members" — it manages wedding-guest
                seating/colour categorisation, not app-user access
                permissions, and living next to PermissionGroupsBlock
                (identical visual chrome, completely different
                purpose) made the two easy to confuse. Renamed to
                "Guest seating groups" in GuestGroupsBlock itself so
                the distinction is unambiguous at a glance. */}
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
                side: g.side as "BRIDE" | "GROOM" | "BOTH",
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
          </SettingsSection>

          {/* Access & members section — couple-only. Permission
              groups (the primary surface) and the per-user override
              matrix (rare exceptions). Hidden entirely for non-couple
              members since they can't change anything here.
              v2.5.0 (design pass #3): GuestGroupsBlock moved out to
              Customisation — see the comment there. */}
          {user.isCouple && (
            <SettingsSection
              id="section-members"
              title="Access & members"
              subtitle="Permission groups and per-user overrides. Couple-only."
            >
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
              email: u.email,
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
                email: u.email,
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
                .map((u) => ({ id: u.id, name: displayName(u), email: u.email })),
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

          <InviteBlock
            invites={invites.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
              isCouple: i.isCouple,
              status: i.status,
              createdAt: i.createdAt,
            }))}
            rolePermissions={rolePermissions}
          />

          {/* v1.45.0: per-user editor — replaces the dense
              PermissionMatrix table. Each user is its own
              expandable card showing group memberships +
              per-section overrides + couple toggle + remove.
              Click a user to expand.
              v1.59.0 (C2): each group toggle now also shows the
              perms it grants inline ("EDIT: tasks · VIEW: schedule")
              so the couple doesn't have to bounce up to the
              Permission groups panel to learn what ticking a box
              will give the user. We share the same `permsByKey`
              bucketing as the PermissionGroupsBlock above. */}
          {(() => {
            const allUsersShape = users.map((u) => ({
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              name: u.name,
              role: u.role,
              isCouple: u.isCouple,
            }));
            // Bucket GroupPermission rows by groupKey, same shape as
            // the PermissionGroupsBlock's permsByKey above. Cheap;
            // O(rows). Done locally here rather than lifted up so
            // both IIFEs stay self-contained.
            const permsByKey = new Map<string, { section: string; level: PermissionLevel }[]>();
            for (const p of groupPermissionsRaw) {
              const arr = permsByKey.get(p.groupKey) ?? [];
              arr.push({ section: p.section, level: p.level });
              permsByKey.set(p.groupKey, arr);
            }
            // Per-user list of built-ins they qualify for + the
            // perms each built-in grants. Two-axis lookup the
            // member card uses to render the read-only summary
            // line per built-in chip.
            const builtinDetailsByUser: Record<string, { name: string; slug: string; permissions: { section: string; level: "NONE" | "VIEW" | "EDIT" }[] }[]> = {};
            for (const u of allUsersShape) {
              builtinDetailsByUser[u.id] = BUILTIN_GROUPS.filter(
                (g) => resolveBuiltinGroup(g.slug, [u]).length > 0,
              ).map((g) => ({
                name: g.name,
                slug: g.slug,
                permissions: permsByKey.get(`builtin:${g.slug}`) ?? [],
              }));
            }
            // Per-user set of custom group ids they're a member of —
            // used to render the toggleable checkboxes.
            const customGroupMembershipByUser: Record<string, Set<string>> = {};
            for (const u of allUsersShape) {
              customGroupMembershipByUser[u.id] = new Set();
            }
            for (const g of permissionGroupsRaw) {
              for (const m of g.members) {
                const set = customGroupMembershipByUser[m.id];
                if (set) set.add(g.id);
              }
            }
            const customGroupRows = permissionGroupsRaw.map((g) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              permissions: permsByKey.get(`group:${g.slug}`) ?? [],
            }));
            return (
              <MemberOverridesBlock
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
                groupInherited={groupInherited as Record<string, Record<string, "NONE" | "VIEW" | "EDIT">>}
                builtinDetailsByUser={builtinDetailsByUser}
                customGroups={customGroupRows}
                customGroupMembershipByUser={customGroupMembershipByUser}
                currentUserId={user.id}
                currentUserIsCouple={user.isCouple}
                canEdit={editable}
              />
            );
          })()}
            </SettingsSection>
          )}

          <SettingsSection id="section-log" title="Notifications & log">
            {/* v1.25.0: nudges digest, couple-only. The panel
                self-renders an empty placeholder for non-couple
                viewers, so we always render it inside the section. */}
            {user.isCouple && <NudgesPanel />}
            <AuditLogPanel
              isCouple={user.isCouple}
              before={audit_before}
              query={audit_q}
            />
          </SettingsSection>
        </div>
      </div>
    </>
  );
}
