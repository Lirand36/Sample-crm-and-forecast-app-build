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
