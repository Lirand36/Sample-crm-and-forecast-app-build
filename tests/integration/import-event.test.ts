import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { reviewEvidence } from "@/application/evidence";
import { loadForecast } from "@/application/forecast";
import { importEmail } from "@/application/import-event";
import type { DataStore } from "@/application/ports";
import { evidenceStatus } from "@/domain/condition-state";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
const eml = (name: string) => readFileSync(join(process.cwd(), "src/seed/eml", `${name}.eml`), "utf8");
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
const line = async (key: string) => (await loadForecast(store)).lines.find((l) => l.view.opportunity.id === `opp-${key}`)!;

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("adding an email to a deal (D-09, DR-05, DR-06, PRD §4B)", () => {
  it("test 55: National Bank postponed with no date: Timing unknown, no Intervention, Recoverable $1.0M (Savings only)", async () => {
    const r = await importEmail(store, "opp-natbank", eml("natbank-postponed-no-date"));
    expect(r.ok && r.value.event.origin).toBe("customer");
    const f = await loadForecast(store);
    const nb = f.lines.find((l) => l.view.opportunity.id === "opp-natbank")!;
    expect(nb.group).toBe("timing_unknown");
    expect(nb.interventions).toHaveLength(0);
    expect([f.company.conservative, f.company.core, f.company.stretch]).toEqual([usdM(13.5), usdM(26.0), usdM(29.5)]);
    expect(f.recoverable.reduce((a, l) => a + (l.tcv ?? 0), 0)).toBe(usdM(1.0));
  });

  it("test 27: the same Feb 24 email again is a duplicate and changes nothing", async () => {
    const before = await line("natbank");
    const r = await importEmail(store, "opp-natbank", eml("natbank-feb24-relogged"));
    expect(r.ok && r.value.duplicate).toBe(true);
    const decisions = await store.repos.evidenceDecisions.list();
    for (const e of r.ok ? r.value.evidence : []) expect(evidenceStatus(e, decisions)).toBe("duplicate");
    expect((await line("natbank")).view.timing.esd).toEqual(before.view.timing.esd);
  });

  it("test 26: a quote that is not in the email makes the Evidence unverifiable", async () => {
    const r = await importEmail(store, "opp-retail", eml("unverifiable-quote"));
    expect(r.ok && r.value.unverifiable).toBeGreaterThan(0);
  });

  it("test 52: a second Insurance Group progress email, approved: credited 13 days, ESD Mar 9 / Mar 9 / Mar 18, still Firm", async () => {
    const r = await importEmail(store, "opp-insurance", eml("insurance-second-progress"));
    expect(r.ok).toBe(true);
    await actAs("u-mgr-b");
    for (const e of r.ok ? r.value.evidence : []) expect((await reviewEvidence(store, e.id, "approve", "")).ok).toBe(true);
    const ins = await line("insurance");
    const esd = ins.view.timing.esd;
    expect([esd.fast, esd.standard, esd.slow]).toEqual(["2027-03-09", "2027-03-09", "2027-03-18"]);
    expect(ins.group).toBe("firm");
  });
});
