import { beforeEach, describe, expect, it } from "vitest";
import { changeLink, waiveCondition } from "@/application/deal-config";
import { loadForecast } from "@/application/forecast";
import type { DataStore } from "@/application/ports";
import { hasCycle } from "@/domain/config-rules";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
const line = async (key: string) => (await loadForecast(store)).lines.find((l) => l.view.opportunity.id === `opp-${key}`)!;

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("RevOps waivers (DR-07, test 53)", () => {
  it("(a) a Sales Manager cannot waive any step", async () => {
    await actAs("u-mgr-a");
    const r = await waiveCondition(store, "opp-retail", "procurement_legal", "Standard paper");
    expect(r.ok ? "" : r.errors.form).toContain("Only RevOps");
  });

  it("(b) RevOps cannot waive Budget or Vendor selection", async () => {
    await actAs("u-revops");
    for (const t of ["budget", "vendor_selection"] as const) {
      const r = await waiveCondition(store, "opp-telecom", t, "x");
      expect(r.ok ? "" : r.errors.form).toContain("can never be waived");
    }
  });

  it("(c) RevOps waives an open step on a Firm deal: accepted with reason, the deal drops to Core with 'waiver in place'", async () => {
    expect((await line("retail")).group).toBe("firm");
    await actAs("u-revops");
    expect((await waiveCondition(store, "opp-retail", "procurement_legal", "")).ok).toBe(false);
    const r = await waiveCondition(store, "opp-retail", "procurement_legal", "Signed on the customer's standard paper");
    expect(r.ok).toBe(true);
    const l = await line("retail");
    expect(l.view.states.find((s) => s.type === "procurement_legal")?.state).toBe("waived");
    expect(l.group).toBe("core");
    expect(l.reasons).toContain("waiver in place");
    const log = (await store.repos.changeLog.list()).filter((c) => c.field === "waiver:procurement_legal");
    expect(log).toHaveLength(1);
    expect(log[0]?.reason).toBe("Signed on the customer's standard paper");
    expect((await waiveCondition(store, "opp-retail", "procurement_legal", "again")).ok).toBe(false);
  });
});

describe("RevOps Link changes (DR-07)", () => {
  it("refuses a link that makes a cycle", async () => {
    await actAs("u-revops");
    const r = await changeLink(store, "opp-savings", "procurement_legal", "executive_sponsor", "hard", "Try it");
    expect(r.ok ? "" : r.errors.form).toContain("wait on itself");
  });

  it("only RevOps; a reason is required; the change applies to that deal only and is logged", async () => {
    await actAs("u-mgr-a");
    expect((await changeLink(store, "opp-savings", "security", "procurement_legal", "removed", "x")).ok).toBe(false);
    await actAs("u-revops");
    expect((await changeLink(store, "opp-savings", "security", "procurement_legal", "removed", " ")).ok).toBe(false);
    const r = await changeLink(store, "opp-savings", "security", "procurement_legal", "removed", "Legal runs in parallel here");
    expect(r.ok).toBe(true);
    expect((await line("savings")).view.links.some((l) => l.from === "security" && l.to === "procurement_legal")).toBe(false);
    expect((await line("airline")).view.links.some((l) => l.from === "security" && l.to === "procurement_legal")).toBe(true);
    expect((await store.repos.changeLog.list()).some((c) => c.field === "link:security>procurement_legal" && c.newValue === "removed")).toBe(true);
  });

  it("hasCycle finds a loop and passes a chain", () => {
    expect(hasCycle([{ from: "budget", to: "security", strength: "hard" }, { from: "security", to: "budget", strength: "soft" }])).toBe(true);
    expect(hasCycle([{ from: "budget", to: "security", strength: "hard" }, { from: "security", to: "procurement_legal", strength: "soft" }])).toBe(false);
  });
});
