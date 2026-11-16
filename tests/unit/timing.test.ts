import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, DEMO_AS_OF } from "@/seed/canonical";
import { dealView } from "@/domain/deal-view";
import { isoDate, type IsoDate } from "@/domain/dates";

const seed = buildCanonicalSeed();
const QE = isoDate("2027-03-31");
const view = (key: string, asOf: IsoDate = DEMO_AS_OF) => dealView(seed, `opp-${key}`, asOf, QE)!;
const esd = (key: string, asOf?: IsoDate) => {
  const e = view(key, asOf).timing.esd;
  return [e.fast, e.standard, e.slow];
};

// PRD §8 deals table, with Airline Group from handoff test 5 (DR-02 supersedes the pilot projection).
const EXPECTED: Record<string, [string, string, string, string]> = {
  retail: ["2027-03-03", "2027-03-11", "2027-03-20", "slow"],
  insurance: ["2027-03-04", "2027-03-13", "2027-03-22", "slow"],
  energy: ["2027-03-14", "2027-03-23", "2027-04-01", "standard"],
  airline: ["2027-03-13", "2027-03-22", "2027-04-04", "standard"],
  savings: ["2027-03-23", "2027-04-07", "2027-05-01", "fast"],
  telecom: ["2027-03-13", "2027-03-22", "2027-03-31", "slow"],
  natbank: ["2027-04-01", "2027-04-16", "2027-05-10", "not_ready"],
};

describe("planned signature dates as of March 1 (PRD §4E, §4G, §8; DR-02)", () => {
  for (const [key, [f, s, sl, readiness]] of Object.entries(EXPECTED)) {
    it(`${key}: ${f} / ${s} / ${sl}, ${readiness}`, () => {
      expect(esd(key)).toEqual([f, s, sl]);
      expect(view(key).timing.readiness).toBe(readiness);
    });
  }

  it("Airline Group pilot finishes Mar 8 / Mar 10 / Mar 14 (test 5)", () => {
    const pilot = view("airline").timing.steps.find((s) => s.type === "pilot")!;
    expect([pilot.finish.fast, pilot.finish.standard, pilot.finish.slow]).toEqual(["2027-03-08", "2027-03-10", "2027-03-14"]);
  });

  it("test 7, as of March 8: Energy unblocked Mar 17 / Mar 26 / Apr 4; Retail standard Mar 18; Airline unchanged", () => {
    const mar8 = isoDate("2027-03-08");
    expect(esd("energy", mar8)).toEqual(["2027-03-17", "2027-03-26", "2027-04-04"]);
    expect(view("retail", mar8).timing.esd.standard).toBe("2027-03-18");
    expect(esd("airline", mar8)).toEqual(["2027-03-13", "2027-03-22", "2027-04-04"]);
  });

  it("a deal with no new progress slips one day every day (test 29 shape)", () => {
    const a = view("retail", isoDate("2027-03-10")).timing.esd.standard!;
    const b = view("retail", isoDate("2027-03-11")).timing.esd.standard!;
    expect(b > a).toBe(true);
  });

  it("closed deals: every step done gives ESD = as-of", () => {
    expect(esd("citytransit")).toEqual([DEMO_AS_OF, DEMO_AS_OF, DEMO_AS_OF]);
  });
});
