import { describe, expect, it } from "vitest";
import { datasetHash, ensureSeeded, resetToSeed, storeHash } from "@/application/reset";
import { isoDate } from "@/domain/dates";
import { usdM } from "@/domain/money";
import { buildCanonicalSeed } from "@/seed/canonical";
import { STORE_FACTORIES } from "./stores";

describe("canonical seed is deterministic", () => {
  it("builds the same dataset every time", () => {
    expect(datasetHash(buildCanonicalSeed())).toBe(datasetHash(buildCanonicalSeed()));
  });
});

describe.each(STORE_FACTORIES)("one-click reset is reproducible: %s", (_name, make) => {
  it("seeds an empty store once, then leaves it alone", async () => {
    const store = await make();
    expect(await ensureSeeded(store, buildCanonicalSeed())).toBe(true);
    expect(await ensureSeeded(store, buildCanonicalSeed())).toBe(false);
    expect(await storeHash(store)).toBe(datasetHash(buildCanonicalSeed()));
  });

  it("reloads the baseline when the browser holds an older seed version", async () => {
    const store = await make();
    await ensureSeeded(store, buildCanonicalSeed());
    const session = (await store.repos.session.get("session"))!;
    await store.repos.session.put({ ...session, seedVersion: "seed-old" });
    expect(await ensureSeeded(store, buildCanonicalSeed())).toBe(true);
    expect(await storeHash(store)).toBe(datasetHash(buildCanonicalSeed()));
  });

  it("restores the exact seed after edits, appends and role changes", async () => {
    const store = await make();
    await resetToSeed(store, buildCanonicalSeed());
    const seeded = await storeHash(store);

    const retail = (await store.repos.opportunities.get("opp-retail"))!;
    await store.repos.opportunities.put({ ...retail, tcv: usdM(2.0) });
    await store.repos.changeLog.append({
      id: "chg-test", entity: "opportunity", entityId: "opp-retail", field: "tcv",
      oldValue: String(usdM(1.5)), newValue: String(usdM(2.0)), actorId: "u-mgr-a",
      at: isoDate("2027-03-01"), seq: 999, reason: null,
    });
    const session = (await store.repos.session.get("session"))!;
    await store.repos.session.put({ ...session, actingUserId: "u-revops", asOfDate: isoDate("2027-03-08") });
    expect(await storeHash(store)).not.toBe(seeded);

    await resetToSeed(store, buildCanonicalSeed());
    expect(await storeHash(store)).toBe(seeded);
  });
});
