import { describe, expect, it } from "vitest";
import { pilotInsight } from "@/domain/pilot-insight";
import { isoDate } from "@/domain/dates";
import { NEXT_WEEK_READING, PILOT_PLANS, PILOT_READINGS } from "@/seed/canonical";

const plan = PILOT_PLANS[0]!;

describe("pilot insight (display only; DR-02 decides)", () => {
  it("projects the seeded airline readings to just above the 70% target before evaluation", () => {
    const i = pilotInsight(plan, PILOT_READINGS, isoDate("2027-03-01"));
    expect(i.checks).toHaveLength(4);
    expect(i.checks.some((c) => c.decisive)).toBe(false);
    expect(i.weeklySlope).toBe(2.6);
    expect(i.projectedAtEvaluation).toBe(70.5);
    expect(i.verdict).toBe("on_track");
    expect(i.mode).toBe("customer_signoff");
  });

  it("judges by the first reading on or after the evaluation date", () => {
    const i = pilotInsight(plan, [...PILOT_READINGS, NEXT_WEEK_READING], isoDate("2027-03-08"));
    const decisive = i.checks.filter((c) => c.decisive);
    expect(decisive).toHaveLength(1);
    expect(decisive[0]!.reading.resolutionRate).toBe(66);
    expect(decisive[0]!.resolutionOk).toBe(false);
    expect(i.verdict).toBe("failed");
  });

  it("ignores readings after the as-of date and other deals' readings", () => {
    const other = { ...PILOT_READINGS[0]!, id: "x", opportunityId: "opp-other" };
    const i = pilotInsight(plan, [...PILOT_READINGS, NEXT_WEEK_READING, other], isoDate("2027-02-14"));
    expect(i.checks.map((c) => c.reading.weekEnding)).toEqual(["2027-02-07", "2027-02-14"]);
  });

  it("is at risk when the trend falls short, and has no trend from one reading", () => {
    const flat = PILOT_READINGS.map((r) => ({ ...r, resolutionRate: 60 }));
    expect(pilotInsight(plan, flat, isoDate("2027-03-01")).verdict).toBe("at_risk");
    const one = pilotInsight(plan, PILOT_READINGS.slice(0, 1), isoDate("2027-03-01"));
    expect(one.projectedAtEvaluation).toBeNull();
    expect(pilotInsight(plan, [], isoDate("2027-03-01")).verdict).toBe("no_readings");
  });
});
