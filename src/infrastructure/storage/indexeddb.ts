// IndexedDB DataStore (DR-16): each browser holds its own copy of the data.
// One object store per collection, keyed by id. Append-only stores use `add`, which
// fails if the key exists, so no stored run, decision, waiver or log entry can be overwritten.

import { openDB, type IDBPDatabase } from "idb";
import {
  ALL_COLLECTIONS,
  APPEND_ONLY_COLLECTIONS,
  AppendOnlyViolation,
  MUTABLE_COLLECTIONS,
  type CollectionName,
  type DataStore,
  type Dataset,
  type Identified,
  type Repositories,
} from "@/application/ports";
import { byId } from "./shared";

export const DB_NAME = "signature-path-forecasting";
/** Bump when the object-store layout changes. */
export const DB_SCHEMA_VERSION = 1;

export async function openIndexedDbStore(name: string = DB_NAME): Promise<IndexedDbDataStore> {
  const db = await openDB(name, DB_SCHEMA_VERSION, {
    upgrade(database) {
      for (const collection of ALL_COLLECTIONS) {
        if (!database.objectStoreNames.contains(collection)) {
          database.createObjectStore(collection, { keyPath: "id" });
        }
      }
    },
  });
  return new IndexedDbDataStore(db);
}

function isConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "ConstraintError";
}

export class IndexedDbDataStore implements DataStore {
  readonly repos: Repositories;

  constructor(private readonly db: IDBPDatabase) {
    const repos: Record<string, unknown> = {};
    for (const name of MUTABLE_COLLECTIONS) {
      repos[name] = {
        get: (id: string) => this.get(name, id),
        list: () => this.list(name),
        put: async (record: Identified) => {
          await this.db.put(name, record);
        },
      };
    }
    for (const name of APPEND_ONLY_COLLECTIONS) {
      repos[name] = {
        get: (id: string) => this.get(name, id),
        list: () => this.list(name),
        append: async (record: Identified) => {
          try {
            await this.db.add(name, record);
          } catch (error) {
            if (isConstraintError(error)) throw new AppendOnlyViolation(name, record.id);
            throw error;
          }
        },
      };
    }
    this.repos = repos as unknown as Repositories;
  }

  private async get(name: CollectionName, id: string): Promise<Identified | undefined> {
    return (await this.db.get(name, id)) as Identified | undefined;
  }

  private async list(name: CollectionName): Promise<Identified[]> {
    return ((await this.db.getAll(name)) as Identified[]).sort(byId);
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction([...ALL_COLLECTIONS], "readwrite");
    await Promise.all([...ALL_COLLECTIONS.map((name) => tx.objectStore(name).clear()), tx.done]);
  }

  async load(dataset: Dataset): Promise<void> {
    const tx = this.db.transaction([...ALL_COLLECTIONS], "readwrite");
    const writes: Promise<unknown>[] = [];
    for (const name of ALL_COLLECTIONS) {
      const store = tx.objectStore(name);
      for (const record of dataset[name] as Identified[]) writes.push(store.add(record));
    }
    await Promise.all([...writes, tx.done]);
  }

  async dump(): Promise<Dataset> {
    const out: Record<string, Identified[]> = {};
    for (const name of ALL_COLLECTIONS) out[name] = await this.list(name);
    return out as unknown as Dataset;
  }

  close(): void {
    this.db.close();
  }
}
