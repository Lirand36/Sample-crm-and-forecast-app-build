import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, DEMO_AS_OF, QUARTERS } from "@/seed/canonical";
import { computeForecast } from "@/domain/forecast";
import { isoDate } from "@/domain/dates";
import { usdM } from "@/domain/money";

const seed = buildCanonicalSeed();
const Q = QUARTERS[0]!;

describe("live forecast (test 1 and test 7, converted per R-9)", () => {
  const f = computeForecast(seed, DEMO_AS_OF, Q);

  it("company: $13.5M / $26.0M / $29.5M against $46.0M; Manager commitment $51.0M with 3 Disputes", () => {
    expect(f.company).toMatchObject({
      conservative: usdM(13.5), core: usdM(26.0), stretch: usdM(29.5), target: usdM(46), managerCommitment: usdM(51.0), liveDisputes: 3,
    });
  });

  it("Downside exposure $12.5M (Energy Group); Ready, not committed $15.0M (Global Telecom)", () => {
    expect(f.downside.map((l) => [l.view.opportunity.id, l.tcv])).toEqual([["opp-energy", usdM(12.5)]]);
    expect(f.readyNotCommitted.map((l) => [l.view.opportunity.id, l.tcv])).toEqual([["opp-telecom", usdM(15.0)]]);
  });

  it("manager rows add up to the company", () => {
    const sum = f.managers.reduce((a, m) => a + m.core, 0);
    expect(sum).toBe(f.company.core);
    expect(f.managers.map((m) => m.target)).toEqual([usdM(23), usdM(23)]);
  });

  it("March 8: Telecom's Bet is missed, Manager commitment $36.0M (test 7: $10.0M)", () => {
    const m8 = computeForecast(seed, isoDate("2027-03-08"), Q);
    expect(m8.company.managerCommitment).toBe(usdM(36.0));
    const telecom = m8.lines.find((l) => l.view.opportunity.id === "opp-telecom")!;
    expect(telecom.dispute?.status).toEqual({ live: false, reason: "Bet missed" });
  });
});

describe("Interventions (PRD §4G.6, §8; DR-09; tests 3, 4, 15)", () => {
  const f = computeForecast(seed, DEMO_AS_OF, Q);
  const line = (k: string) => f.lines.find((l) => l.view.opportunity.id === `opp-${k}`)!;

  it("National Bank: start Procurement and legal by Mar 10; Core with ESD Mar 20 / Mar 26 / Apr 10", () => {
    const [i, ...rest] = line("natbank").interventions;
    expect(rest).toHaveLength(0);
    expect(i).toMatchObject({ condition: "procurement_legal", startBy: "2027-03-10" });
    expect([i!.timing.esd.fast, i!.timing.esd.standard, i!.timing.esd.slow]).toEqual(["2027-03-20", "2027-03-26", "2027-04-10"]);
    expect(i!.result.group).toBe("core");
  });

  it("Savings Bank: Core with ESD Mar 13 / Mar 22 / Apr 1, start by Mar 10", () => {
    const i = line("savings").interventions[0]!;
    expect(i.startBy).toBe("2027-03-10");
    expect([i.timing.esd.fast, i.timing.esd.standard, i.timing.esd.slow]).toEqual(["2027-03-13", "2027-03-22", "2027-04-01"]);
  });

  it("Global Telecom and Airline Group get none (commitment, DR-09); Recoverable is $21.0M (spec $5.0M)", () => {
    expect(line("telecom").interventions).toHaveLength(0);
    expect(line("airline").interventions).toHaveLength(0);
    expect(f.recoverable.reduce((a, l) => a + (l.tcv ?? 0), 0)).toBe(usdM(21.0));
  });

  it("test 4: previewing National Bank's Intervention gives $13.5M / $46.0M / $49.5M; the live numbers are unchanged", () => {
    const p = computeForecast(seed, DEMO_AS_OF, Q, { opportunityId: "opp-natbank", condition: "procurement_legal" });
    expect([p.company.conservative, p.company.core, p.company.stretch]).toEqual([usdM(13.5), usdM(46.0), usdM(49.5)]);
    expect(computeForecast(seed, DEMO_AS_OF, Q).company.core).toBe(usdM(26.0));
  });

  it("National Bank Security's latest viable date is Mar 10 (test 3)", async () => {
    const { latestViableDates } = await import("@/domain/timing");
    const v = line("natbank").view;
    expect(latestViableDates(v.timing, v.links, Q.end).get("security")).toBe("2027-03-10");
  });
});
