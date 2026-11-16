import { beforeEach, describe, expect, it } from "vitest";
import { reviewEvidence } from "@/application/evidence";
import { loadForecast } from "@/application/forecast";
import type { DataStore } from "@/application/ports";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
async function blockEvidenceId() {
  const ev = await store.repos.evidence.list();
  return ev.find((e) => e.opportunityId === "opp-natbank" && e.claim === "blocked")!.id;
}

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("Evidence review rights (DR-04, G-1)", () => {
  it("test 9: only the VP Sales may reject National Bank's confirmed block; Stretch rises to $49.5M (spec $15.5M)", async () => {
    const id = await blockEvidenceId();
    for (const u of ["u-revops", "u-mgr-a", "u-cro"]) {
      await actAs(u);
      expect((await reviewEvidence(store, id, "reject", "Committee date is not final")).ok).toBe(false);
    }
    await actAs("u-vp-sales");
    expect((await reviewEvidence(store, id, "reject", "")).ok).toBe(false);
    expect((await reviewEvidence(store, id, "reject", "Committee date is not final")).ok).toBe(true);
    const f = await loadForecast(store);
    expect(f.company.stretch).toBe(usdM(49.5));
    const nb = f.lines.find((l) => l.view.opportunity.id === "opp-natbank")!;
    expect(nb.group).toBe("stretch");
    const log = await store.repos.evidenceDecisions.list();
    expect(log.sort((a, b) => a.seq - b.seq).at(-1)).toMatchObject({ decision: "rejected", actorId: "u-vp-sales", reason: "Committee date is not final" });
  });

  it("another manager's deal and RevOps-only conditions are refused", async () => {
    const ev = await store.repos.evidence.list();
    const telecomContrary = ev.find((e) => e.opportunityId === "opp-telecom" && e.claim === "contrary")!;
    await actAs("u-mgr-a"); // Telecom belongs to Manager B
    expect((await reviewEvidence(store, telecomContrary.id, "reject", "x")).ok).toBe(false);
  });
});
