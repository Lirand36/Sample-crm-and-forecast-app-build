import { beforeEach, describe, expect, it } from "vitest";
import { loadBridge, loadForecast } from "@/application/forecast";
import { approvePlanningStandard, type StandardInput } from "@/application/planning-standards";
import type { DataStore } from "@/application/ports";
import { ensureDailyRun, submitForecast } from "@/application/runs";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
const V2: StandardInput = {
  conditionType: "procurement_legal", dealType: "all", segment: null,
  fastDays: 12, standardDays: 30, slowDays: 40, rationale: "Legal teams are slower this year", effectiveFrom: "2027-03-01",
};
const esd = (l: { view: { timing: { esd: { fast: string | null; standard: string | null; slow: string | null } } } }) =>
  [l.view.timing.esd.fast, l.view.timing.esd.standard, l.view.timing.esd.slow];

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("Planning-standard approval (DR-01, test 45)", () => {
  it("only RevOps approves; days must be ordered; never retroactive", async () => {
    await actAs("u-mgr-a");
    expect((await approvePlanningStandard(store, V2)).ok).toBe(false);
    await actAs("u-revops");
    expect((await approvePlanningStandard(store, { ...V2, fastDays: 31 })).ok).toBe(false);
    expect((await approvePlanningStandard(store, { ...V2, effectiveFrom: "2027-02-28" })).ok).toBe(false);
    expect((await approvePlanningStandard(store, { ...V2, rationale: "" })).ok).toBe(false);
  });

  it("test 45: Procurement and legal v2 = 12 / 30 / 40 from Mar 1", async () => {
    const mar1 = await ensureDailyRun(store);
    await actAs("u-revops");
    const r = await approvePlanningStandard(store, V2);
    expect(r.ok && r.value.version).toBe(2);

    const f = await loadForecast(store);
    const line = (k: string) => f.lines.find((l) => l.view.opportunity.id === `opp-${k}`)!;
    expect(esd(line("retail"))).toEqual(["2027-03-03", "2027-03-20", "2027-03-30"]);
    expect(line("retail").group).toBe("firm");
    expect(esd(line("insurance"))).toEqual(["2027-03-04", "2027-03-22", "2027-04-01"]);
    expect(line("insurance").group).toBe("core");
    expect(esd(line("energy"))).toEqual(["2027-03-14", "2027-04-01", "2027-04-11"]);
    expect(line("energy").group).toBe("stretch");
    // Spec $3.5M / $5.5M / $11.5M and $10.5M, converted (R-9).
    expect([f.company.conservative, f.company.core, f.company.stretch]).toEqual([usdM(3.5), usdM(13.5), usdM(29.5)]);
    expect(f.company.managerCommitment).toBe(usdM(38.5));

    const b = (await loadBridge(store, f, mar1.id))!;
    expect(b.lines.map((l) => [l.kind, l.amount])).toEqual([["slipped", usdM(-12.5)]]);
    expect(b.lines[0]?.moves[0]?.causes).toEqual(["planning standard changed"]);

    await actAs("u-mgr-a");
    expect((await submitForecast(store)).ok).toBe(true);
    const runs = await store.repos.forecastRuns.list();
    const latest = runs.sort((a, b) => b.seq - a.seq)[0]!;
    const used = (latest.configSnapshot as { planningStandards: { id: string; version: number; fast: number; standard: number; slow: number }[] }).planningStandards;
    expect(used.find((p) => p.id === (r.ok ? r.value.id : ""))).toMatchObject({ version: 2, fast: 12, standard: 30, slow: 40 });
  });
});
