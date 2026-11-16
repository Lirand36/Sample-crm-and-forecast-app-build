// "What that did": the panel's numbers come from the engine before and after a real action.

import { beforeEach, describe, expect, it } from "vitest";
import { raiseDispute } from "@/application/disputes";
import { loadForecast } from "@/application/forecast";
import { advanceOneWeek } from "@/application/runs";
import type { DataStore } from "@/application/ports";
import { isoDate } from "@/domain/dates";
import { impactOf, isEmptyImpact } from "@/domain/impact";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}

describe("impact of one action", () => {
  it("nothing changed: empty", async () => {
    const f = await loadForecast(store);
    expect(isEmptyImpact(impactOf(f, f))).toBe(true);
  });

  it("a manager moves Airline Group into Commit: Managers' Commit +$2,500,000, system forecast unchanged, Airline Best Case → Commit", async () => {
    const before = await loadForecast(store);
    await actAs("u-mgr-a");
    const r = await raiseDispute(store, {
      opportunityId: "opp-airline", direction: "in", reason: "Pilot is going well",
      bets: [{ conditionType: "pilot", by: isoDate("2027-03-07") }, { conditionType: "vendor_selection", by: isoDate("2027-03-15") }], outCondition: null,
    });
    expect(r.ok).toBe(true);
    const i = impactOf(before, await loadForecast(store));
    const t = (k: string) => i.totals.find((x) => x.key === k)!;
    expect(t("managerCommitment").after - t("managerCommitment").before).toBe(usdM(2.5));
    expect(t("core").after).toBe(t("core").before);
    const airline = i.deals.find((d) => d.opportunityId === "opp-airline")!;
    expect(airline.category).toEqual({ before: "Best Case", after: "Commit" });
    expect(airline.dispute).toMatchObject({ before: false, after: true });
  });

  it("next week: today moves, and Global Telecom's missed Bet shows as a move that no longer counts", async () => {
    const before = await loadForecast(store);
    await advanceOneWeek(store);
    const i = impactOf(before, await loadForecast(store));
    expect(i.asOf).toEqual({ before: "2027-03-01", after: "2027-03-08" });
    const telecom = i.deals.find((d) => d.opportunityId === "opp-telecom")!;
    expect(telecom.dispute).toMatchObject({ before: true, after: false, reason: "Bet missed" });
  });
});
