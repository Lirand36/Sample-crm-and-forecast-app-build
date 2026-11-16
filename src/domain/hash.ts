// Deterministic serialisation and hashing. Used for Event content hashes (DR-06)
// and for proving stored runs never change (DR-16 property test).

/** JSON with object keys sorted, so equal values always serialise identically. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** cyrb53 run twice with different seeds: a 106-bit non-cryptographic hash as hex. */
export function hashString(input: string): string {
  const run = (seed: number): string => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  };
  return run(0) + run(0x9e3779b9);
}

export function hashValue(value: unknown): string {
  return hashString(stableStringify(value));
}

/** DR-06 / G-11: an Event's content hash covers sender and normalised body, not its date. */
export function eventContentHash(sender: string | null, text: string): string {
  const normalised = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return hashString(`${(sender ?? "").trim().toLowerCase()}\n${normalised}`);
}
