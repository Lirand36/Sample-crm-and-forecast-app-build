import { beforeEach, describe, expect, it } from "vitest";
import { logCustomerUpdate } from "@/application/slack-update";
import { reviewEvidence } from "@/application/evidence";
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
const group = async (id: string) => (await loadForecast(store)).lines.find((l) => l.view.opportunity.id === id)!.group;

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("customer updates logged from Slack", () => {
  it("good news waits for review, then moves the deal into the forecast", async () => {
    await actAs("u-mgr-a");
    const before = (await loadForecast(store)).company.core;
    const r = await logCustomerUpdate(store, {
      opportunityId: "opp-airline", conditionType: "vendor_selection", kind: "done", contactId: "con-airline-procurement",
      quote: "We have selected Wonderful as our vendor.", until: null,
    });
    expect(r.ok).toBe(true);
    expect(await group("opp-airline")).toBe("stretch");
    expect((await loadForecast(store)).company.core).toBe(before);
    // Vendor selection is reviewed by RevOps (DR-04)
    expect((await reviewEvidence(store, r.ok ? r.value.evidence.id : "", "approve", "")).ok).toBe(false);
    await actAs("u-revops");
    expect((await reviewEvidence(store, r.ok ? r.value.evidence.id : "", "approve", "")).ok).toBe(true);
    expect(await group("opp-airline")).toBe("core");
    expect((await loadForecast(store)).company.core).toBe(before + usdM(2.5));
  });

  it("bad news applies at once", async () => {
    await actAs("u-mgr-b");
    const before = (await loadForecast(store)).company.core;
    const r = await logCustomerUpdate(store, {
      opportunityId: "opp-energy", conditionType: "procurement_legal", kind: "blocked", contactId: "con-energy-legal",
      quote: "Legal review is on hold until April 10.", until: isoDate("2027-04-10"),
    });
    expect(r.ok).toBe(true);
    expect(await group("opp-energy")).toBe("late");
    expect((await loadForecast(store)).company.core).toBe(before - usdM(12.5));
  });

  it("only the deal's manager, the VP Sales or RevOps; the contact must be at the customer", async () => {
    await actAs("u-mgr-b");
    const input = { opportunityId: "opp-airline", conditionType: "vendor_selection" as const, kind: "done" as const, contactId: "con-airline-procurement", quote: "We have selected Wonderful.", until: null };
    expect((await logCustomerUpdate(store, input)).ok).toBe(false);
    await actAs("u-mgr-a");
    expect((await logCustomerUpdate(store, { ...input, contactId: "con-energy-legal" })).ok).toBe(false);
    expect((await logCustomerUpdate(store, { ...input, quote: "" })).ok).toBe(false);
  });
});
