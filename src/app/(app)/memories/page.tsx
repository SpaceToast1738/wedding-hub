// v2.17.0: the Memory Book. Couple-only (middleware redirects too).
// Everything the couple planned, assembled into one long three-part
// read: before, the day, after. See src/lib/memories for the model.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions";
import { buildMemoryBook } from "@/lib/memories/build";
import { APP_VERSION } from "@/lib/version";
import { MemoriesClient } from "./MemoriesClient";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");
  const data = await buildMemoryBook();
  return (
    <div className="flex-1 overflow-auto">
      <link rel="stylesheet" href={`/memories.css?v=${APP_VERSION}`} />
      <MemoriesClient data={data} />
    </div>
  );
}
