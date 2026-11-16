import { beforeEach, describe, expect, it } from "vitest";
import { raiseDispute, withdrawDispute } from "@/application/disputes";
import { loadForecast } from "@/application/forecast";
import type { DataStore } from "@/application/ports";
import { isoDate } from "@/domain/dates";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
const MAR31 = isoDate("2027-03-31");

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("Disputes (PRD §4I, DR-04, DR-10)", () => {
  it("only the deal's Sales Manager raises or withdraws", async () => {
    await actAs("u-mgr-b");
    expect((await withdrawDispute(store, "dsp-natbank-in")).ok).toBe(false);
    const r = await raiseDispute(store, { opportunityId: "opp-savings", direction: "in", reason: "x", bets: [{ conditionType: "procurement_legal", by: MAR31 }], outCondition: null });
    expect(r.ok).toBe(false);
  });

  it("one live Dispute per deal; withdraw then raise again; Manager commitment follows", async () => {
    await actAs("u-mgr-a");
    const bet = [{ conditionType: "procurement_legal" as const, by: MAR31 }];
    expect((await raiseDispute(store, { opportunityId: "opp-natbank", direction: "in", reason: "Legal in parallel", bets: bet, outCondition: null })).ok).toBe(false);
    expect((await withdrawDispute(store, "dsp-natbank-in")).ok).toBe(true);
    expect((await loadForecast(store)).company.managerCommitment).toBe(usdM(31.0));
    expect((await raiseDispute(store, { opportunityId: "opp-natbank", direction: "in", reason: "Legal in parallel", bets: bet, outCondition: null })).ok).toBe(true);
    expect((await loadForecast(store)).company.managerCommitment).toBe(usdM(51.0));
  });

  it("refuses a Bet that would not make the deal count, and names what else holds it back", async () => {
    await actAs("u-mgr-a");
    const r = await raiseDispute(store, { opportunityId: "opp-airline", direction: "in", reason: "They will pick us", bets: [{ conditionType: "procurement_legal", by: MAR31 }], outCondition: null });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.errors.form).toContain("vendor selection");
  });

  it("a Dispute Out needs a counted deal and a reason", async () => {
    await actAs("u-mgr-a");
    expect((await raiseDispute(store, { opportunityId: "opp-retail", direction: "out", reason: "", bets: [], outCondition: "procurement_legal" })).ok).toBe(false);
    expect((await raiseDispute(store, { opportunityId: "opp-retail", direction: "out", reason: "Legal is slow", bets: [], outCondition: "procurement_legal" })).ok).toBe(true);
    expect((await loadForecast(store)).company.managerCommitment).toBe(usdM(49.5));
  });
});
