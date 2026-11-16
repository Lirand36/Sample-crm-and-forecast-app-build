import type { Identified } from "@/application/ports";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function byId(a: Identified, b: Identified): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
