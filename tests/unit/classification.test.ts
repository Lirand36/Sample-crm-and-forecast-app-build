import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, DEMO_AS_OF, QUARTERS } from "@/seed/canonical";
import { dealView } from "@/domain/deal-view";
import { classify, scenarioTotals } from "@/domain/classification";
import { isoDate, type IsoDate } from "@/domain/dates";
import { usdM } from "@/domain/money";

const seed = buildCanonicalSeed();
const Q = QUARTERS[0]!;
const run = (asOf: IsoDate = DEMO_AS_OF) =>
  seed.opportunities.map((o) => {
    const v = dealView(seed, o.id, asOf, Q.end)!;
    return { key: o.id.replace("opp-", ""), tcv: o.tcv, ...classify(v, seed, asOf, Q) };
  });

describe("Commitment and Group as of March 1 (PRD §4H, §4I, §8; DR-02, DR-08)", () => {
  const lines = run();
  const by = (k: string) => lines.find((l) => l.key === k)!;

  it.each([
    ["iberia", "signed", null],
    ["citytransit", "excluded", null],
    ["travel", "excluded", null],
    ["retail", "firm", "committed"],
    ["insurance", "firm", "committed"],
    ["energy", "core", "committed"],
    ["airline", "stretch", "engaged"],
    ["savings", "stretch", "committed"],
    ["telecom", "uncommitted", "at_risk"],
    ["natbank", "late", "committed"],
  ])("%s is %s (%s)", (key, group, level) => {
    expect(by(key).group).toBe(group);
    expect(by(key).commitment?.level ?? null).toBe(level);
  });

  it("Scenario totals are $13.5M / $26.0M / $29.5M (test 1, converted per R-9)", () => {
    expect(scenarioTotals(lines)).toEqual({ conservative: usdM(13.5), core: usdM(26.0), stretch: usdM(29.5) });
  });

  it("Airline Group is held back by vendor selection; Telecom by its contrary signal", () => {
    expect(by("airline").reasons.join("; ")).toContain("vendor selection not done");
    expect(by("telecom").reasons.join("; ")).toContain("contrary signal");
  });

  it("test 7, as of March 8: same totals", () => {
    expect(scenarioTotals(run(isoDate("2027-03-08")))).toEqual({ conservative: usdM(13.5), core: usdM(26.0), stretch: usdM(29.5) });
  });
});
