// One-click reset (Part VII demo controls; Part VIII Phase 1 gate: reset is reproducible).

import { hashValue } from "@/domain/hash";
import type { DataStore, Dataset } from "./ports";

/** Wipe the store and load the canonical seed. The only path that removes append-only records. */
export async function resetToSeed(store: DataStore, seed: Dataset): Promise<void> {
  await store.clearAll();
  await store.load(seed);
}

/** Load the seed only if the store is empty (first visit in this browser). Returns true if seeded. */
export async function ensureSeeded(store: DataStore, seed: Dataset): Promise<boolean> {
  const session = await store.repos.session.get("session");
  if (session) return false;
  await resetToSeed(store, seed);
  return true;
}

/** Hash of the entire store, every collection sorted by id. Equal hashes mean equal data. */
export async function storeHash(store: DataStore): Promise<string> {
  return hashValue(await store.dump());
}

export function datasetHash(dataset: Dataset): string {
  const sorted: Record<string, unknown> = {};
  for (const [name, records] of Object.entries(dataset)) {
    sorted[name] = [...(records as { id: string }[])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return hashValue(sorted);
}
