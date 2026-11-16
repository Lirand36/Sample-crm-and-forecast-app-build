import { beforeEach, describe, expect, it } from "vitest";
import { loadBridge, loadForecast } from "@/application/forecast";
import type { DataStore } from "@/application/ports";
import { advanceOneWeek, ensureDailyRun, submitForecast } from "@/application/runs";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("stored runs, Submission and Next week (PRD §4K, DR-16, Part VII)", () => {
  it("stores one automatic run per as-of date, with copies of what it used", async () => {
    const a = await ensureDailyRun(store);
    const b = await ensureDailyRun(store);
    expect(b.id).toBe(a.id);
    expect(a.totals).toMatchObject({ core: usdM(26.0), managerCommitment: usdM(51.0) });
    const lines = (await store.repos.runLines.list()).filter((l) => l.runId === a.id);
    const nb = lines.find((l) => l.opportunityId === "opp-natbank")!;
    expect(nb).toMatchObject({ group: "late", esdStandard: "2027-04-16" });
    expect(JSON.stringify(nb.detail)).toContain("the risk committee sitting has moved to March 16");
    expect(a.configSnapshot.planningStandards).toBeDefined();
  });

  it("only a Sales Manager submits; the Submission points to its own run", async () => {
    expect((await submitForecast(store)).ok).toBe(false); // signed in as the CRO
    await actAs("u-mgr-a");
    const r = await submitForecast(store);
    expect(r.ok).toBe(true);
    const run = await store.repos.forecastRuns.get(r.ok ? r.value.runId : "");
    expect(run?.trigger).toBe("submission");
  });

  it("test 7: Next week moves to Mar 8, loads the fifth reading, keeps $13.5M / $26.0M / $29.5M; Manager commitment $36.0M", async () => {
    await advanceOneWeek(store);
    expect((await store.repos.session.get("session"))!.asOfDate).toBe("2027-03-08");
    expect((await store.repos.pilotReadings.list()).some((r) => r.weekEnding === "2027-03-07")).toBe(true);
    const f = await loadForecast(store);
    expect([f.company.conservative, f.company.core, f.company.stretch, f.company.managerCommitment]).toEqual([
      usdM(13.5), usdM(26.0), usdM(29.5), usdM(36.0),
    ]);
    const bridge = await loadBridge(store, f);
    expect(bridge?.baseline.asOfDate).toBe("2027-03-01"); // last week's run is now the default baseline
    expect(bridge?.lines).toEqual([]);
  });
});
