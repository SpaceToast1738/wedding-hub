import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { FilesClient } from "./FilesClient";

export default async function FilesPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "files");
  const files = await db.file.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader
        title="Files"
        subtitle={`${files.length} file${files.length === 1 ? "" : "s"}`}
      />
      <FilesClient files={files} canEdit={editable} />
    </>
  );
}
