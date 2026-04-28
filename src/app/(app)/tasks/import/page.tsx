import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { TaskImportClient } from "./TaskImportClient";

export default async function TaskImportPage() {
  const user = await requireUser();
  if (!(await canEdit(user, "tasks"))) redirect("/");
  return (
    <>
      <PageHeader
        title="Import tasks"
        subtitle="Paste a CSV / TSV — one row per task, question, or decision."
      />
      <TaskImportClient />
    </>
  );
}
