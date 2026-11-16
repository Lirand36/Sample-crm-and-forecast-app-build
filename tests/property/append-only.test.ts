import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { hashValue } from "@/domain/hash";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

describe("property: append-only records never change once stored (DR-16)", () => {
  it("a stored run's serialisation hash survives any later sequence of writes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({ kind: fc.constant("tcv" as const), cents: fc.integer({ min: 1, max: 1e9 }) }),
            fc.record({ kind: fc.constant("overwrite" as const) }),
            fc.record({ kind: fc.constant("log" as const), n: fc.integer({ min: 1, max: 1e6 }) }),
          ),
          { maxLength: 20 },
        ),
        async (ops) => {
          const store = new MemoryDataStore();
          await store.load(buildCanonicalSeed());
          const runs = await store.repos.forecastRuns.list();
          const lines = await store.repos.runLines.list();
          const before = hashValue({ runs, lines });
          let i = 0;
          for (const op of ops) {
            i++;
            if (op.kind === "tcv") {
              const o = (await store.repos.opportunities.get("opp-energy"))!;
              await store.repos.opportunities.put({ ...o, tcv: op.cents as never });
            } else if (op.kind === "overwrite") {
              await store.repos.forecastRuns.append({ ...runs[0]!, totals: { ...runs[0]!.totals, core: 0 as never } }).catch(() => undefined);
            } else {
              await store.repos.changeLog
                .append({ id: `chg-p-${i}-${op.n}`, entity: "opportunity", entityId: "opp-energy", field: "tcv", oldValue: null, newValue: String(op.n), actorId: "u-revops", at: "2027-03-01" as never, seq: 10_000 + i, reason: null })
                .catch(() => undefined);
            }
          }
          const after = hashValue({ runs: await store.repos.forecastRuns.list(), lines: await store.repos.runLines.list() });
          expect(after).toBe(before);
        },
      ),
      { numRuns: 50 },
    );
  });
});
