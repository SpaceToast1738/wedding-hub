import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { FilesClient } from "./FilesClient";

export default async function FilesPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "files");

  // Non-couple users see only EVERYONE files. Couple sees both.
  const files = await db.file.findMany({
    where: user.isCouple ? {} : { visibility: "EVERYONE" },
    orderBy: [{ folder: "asc" }, { createdAt: "desc" }],
  });

  const coupleOnlyHidden =
    !user.isCouple && (await db.file.count({ where: { visibility: "COUPLE_ONLY" } }));

  const subtitleParts = [`${files.length} file${files.length === 1 ? "" : "s"}`];
  if (coupleOnlyHidden) subtitleParts.push(`${coupleOnlyHidden} hidden (couple-only)`);

  return (
    <>
      <PageHeader title="Files" subtitle={subtitleParts.join(" · ")} />
      <FilesClient files={files} canEdit={editable} isCouple={user.isCouple} />
    </>
  );
}
