import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, DEMO_AS_OF } from "@/seed/canonical";
import { conditionState, type ConditionStateKind } from "@/domain/condition-state";
import { isoDate } from "@/domain/dates";
import type { ConditionType } from "@/domain/entities";

const seed = buildCanonicalSeed();
const events = new Map(seed.events.map((e) => [e.id, e]));

function statesFor(key: string, asOf = DEMO_AS_OF) {
  const oppId = `opp-${key}`;
  const out: Partial<Record<ConditionType, ReturnType<typeof conditionState>>> = {};
  for (const c of seed.dealConditions.filter((d) => d.opportunityId === oppId)) {
    out[c.type] = conditionState(
      {
        type: c.type,
        evidence: seed.evidence.filter((e) => e.opportunityId === oppId),
        decisions: seed.evidenceDecisions,
        events,
        waivers: seed.conditionWaivers.filter((w) => w.opportunityId === oppId),
        pilotPlan: seed.pilotPlans.find((p) => p.opportunityId === oppId) ?? null,
        pilotReadings: seed.pilotReadings.filter((r) => r.opportunityId === oppId),
      },
      asOf,
    );
  }
  return out;
}

// PRD §8 deals table: "All Conditions not listed are Done."
const OPEN: Record<string, Partial<Record<ConditionType, ConditionStateKind>>> = {
  retail: { procurement_legal: "in_progress" },
  insurance: { procurement_legal: "in_progress" },
  energy: { procurement_legal: "blocked" },
  airline: { pilot: "in_progress", vendor_selection: "not_started", procurement_legal: "in_progress" },
  savings: { security: "in_progress", procurement_legal: "not_started" },
  telecom: { executive_sponsor: "not_started", procurement_legal: "not_started" },
  natbank: { security: "blocked", procurement_legal: "not_started" },
};

describe("Condition state replay on the seed, as of March 1 (PRD §4C, §8)", () => {
  for (const [key, open] of Object.entries(OPEN)) {
    it(`${key} matches the deals table`, () => {
      const states = statesFor(key);
      expect(Object.keys(states).length).toBeGreaterThan(0);
      for (const [type, s] of Object.entries(states)) {
        expect([type, s!.state]).toEqual([type, open[type as ConditionType] ?? "done"]);
      }
    });
  }

  it("National Bank security is blocked until March 16, half-open", () => {
    expect(statesFor("natbank").security!.blockedNow).toEqual({ start: "2027-02-24", end: "2027-03-16" });
    expect(statesFor("natbank", isoDate("2027-03-16")).security!.state).not.toBe("blocked");
  });

  it("Energy is no longer blocked on March 8 (test 7)", () => {
    expect(statesFor("energy", isoDate("2027-03-08")).procurement_legal!.state).toBe("in_progress");
  });

  it("Evidence dated after the as-of date is ignored", () => {
    expect(Object.values(statesFor("retail", isoDate("2026-01-01"))).every((s) => s!.state === "not_started")).toBe(true);
  });
});
