import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { ImportClient } from "./ImportClient";

export default async function GuestImportPage() {
  const user = await requireUser();
  if (!(await canEdit(user, "guests"))) redirect("/guests");

  return (
    <>
      <PageHeader
        title="Import guests"
        subtitle="Paste a CSV / TSV from Say I Do, a spreadsheet, or any other export"
      />
      <ImportClient />
    </>
  );
}
