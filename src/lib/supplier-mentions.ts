"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/actions";
import { canView } from "@/lib/permissions";

// v1.98.0: lookup endpoint for the @-mention picker in
// <MentionableTextarea>. Lazy-fetched the first time a user types
// `@` in a note field so plain textareas don't pay the loading cost
// up-front. Cached per-mount on the client so re-typing `@` doesn't
// re-fetch.
//
// Gate: any user with VIEW on suppliers can mention them. Mentioning
// is read-only — the user is just embedding a name in their own
// notes; the supplier row itself isn't touched.

export type SupplierMention = {
  id: string;
  name: string;
  category: string;
};

export async function loadSuppliersForMention(): Promise<SupplierMention[]> {
  const user = await requireUser();
  if (!(await canView(user, "suppliers"))) return [];
  return db.supplier.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, category: true },
  });
}
