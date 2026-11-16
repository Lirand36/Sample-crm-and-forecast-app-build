import "fake-indexeddb/auto";
import type { DataStore } from "@/application/ports";
import { openIndexedDbStore } from "@/infrastructure/storage/indexeddb";
import { MemoryDataStore } from "@/infrastructure/storage/memory";

let dbCounter = 0;

/** Both DataStore implementations, so one contract suite covers them. */
export const STORE_FACTORIES: Array<[string, () => Promise<DataStore>]> = [
  ["in-memory", async () => new MemoryDataStore()],
  ["IndexedDB", async () => openIndexedDbStore(`test-db-${++dbCounter}`)],
];
