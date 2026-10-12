// v2.17.0: the one entry point hosts call. Couple-only: callers gate.

import { APP_VERSION } from "@/lib/version";
import { assembleMemoryBook } from "./assemble";
import { loadMemorySources } from "./load";
import type { MemoryBookData } from "./types";

export async function buildMemoryBook(): Promise<MemoryBookData> {
  const src = await loadMemorySources();
  return assembleMemoryBook(src, { appVersion: APP_VERSION, generatedAt: new Date().toISOString() });
}
