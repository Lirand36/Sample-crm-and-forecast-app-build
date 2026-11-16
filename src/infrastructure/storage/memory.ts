// In-memory DataStore, used by tests (DR-16). Same semantics as the IndexedDB store.

import {
  ALL_COLLECTIONS,
  APPEND_ONLY_COLLECTIONS,
  AppendOnlyViolation,
  MUTABLE_COLLECTIONS,
  type AppendOnlyCollection,
  type CollectionName,
  type DataStore,
  type Dataset,
  type Identified,
  type MutableCollection,
  type Repositories,
} from "@/application/ports";
import { byId, clone } from "./shared";

class MemoryCollection<T extends Identified> implements MutableCollection<T>, AppendOnlyCollection<T> {
  readonly records = new Map<string, T>();
  constructor(private readonly name: string) {}

  async get(id: string): Promise<T | undefined> {
    const found = this.records.get(id);
    return found === undefined ? undefined : clone(found);
  }
  async list(): Promise<T[]> {
    return [...this.records.values()].map(clone).sort(byId);
  }
  async put(record: T): Promise<void> {
    this.records.set(record.id, clone(record));
  }
  async append(record: T): Promise<void> {
    if (this.records.has(record.id)) throw new AppendOnlyViolation(this.name, record.id);
    this.records.set(record.id, clone(record));
  }
}

export class MemoryDataStore implements DataStore {
  private readonly collections = new Map<CollectionName, MemoryCollection<Identified>>();
  readonly repos: Repositories;

  constructor() {
    const repos: Record<string, unknown> = {};
    for (const name of MUTABLE_COLLECTIONS) {
      const c = new MemoryCollection<Identified>(name);
      this.collections.set(name, c);
      repos[name] = { get: c.get.bind(c), list: c.list.bind(c), put: c.put.bind(c) };
    }
    for (const name of APPEND_ONLY_COLLECTIONS) {
      const c = new MemoryCollection<Identified>(name);
      this.collections.set(name, c);
      // Append-only collections expose no put, update or delete.
      repos[name] = { get: c.get.bind(c), list: c.list.bind(c), append: c.append.bind(c) };
    }
    this.repos = repos as unknown as Repositories;
  }

  async clearAll(): Promise<void> {
    for (const c of this.collections.values()) c.records.clear();
  }

  async load(dataset: Dataset): Promise<void> {
    for (const name of ALL_COLLECTIONS) {
      const c = this.collections.get(name)!;
      for (const record of dataset[name] as Identified[]) {
        if (c.records.has(record.id)) throw new Error(`Duplicate id ${record.id} in ${name}`);
        c.records.set(record.id, clone(record));
      }
    }
  }

  async dump(): Promise<Dataset> {
    const out: Record<string, Identified[]> = {};
    for (const name of ALL_COLLECTIONS) out[name] = await this.collections.get(name)!.list();
    return out as unknown as Dataset;
  }
}
