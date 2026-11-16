import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, DEMO_AS_OF, QUARTERS } from "@/seed/canonical";
import { computeBridge } from "@/domain/bridge";
import { computeForecast } from "@/domain/forecast";
import { usdM } from "@/domain/money";

const seed = buildCanonicalSeed();
const Q = QUARTERS[0]!;
const run = seed.forecastRuns[0]!;

describe("movement bridge from the Feb 22 run (PRD §4J, test 1 converted per R-9)", () => {
  const f = computeForecast(seed, DEMO_AS_OF, Q);
  const b = computeBridge(run, seed.runLines, f.lines, DEMO_AS_OF, seed);
  const line = (k: string) => b.lines.find((l) => l.kind === k);

  it("from $65.3M to $26.0M: Slipped −$20.0M, Commitment lost −$15.0M, Lost −$1.8M, TCV change −$2.5M", () => {
    expect([b.before, b.after]).toEqual([usdM(65.3), usdM(26.0)]);
    expect(b.lines.map((l) => [l.kind, l.amount])).toEqual([
      ["lost", -usdM(1.8)],
      ["commitment_lost", -usdM(15.0)],
      ["slipped", -usdM(20.0)],
      ["tcv_change", -usdM(2.5)],
    ]);
    expect(b.lines.reduce((a, l) => a + l.amount, 0)).toBe(b.after - b.before);
  });

  it("each move names its causes", () => {
    expect(line("slipped")!.moves[0]).toMatchObject({ opportunityId: "opp-natbank", causes: ["new evidence"] });
    expect(line("lost")!.moves[0]!.causes).toContain("CRM edit");
    expect(line("tcv_change")!.moves[0]!.causes).toContain("CRM edit");
  });

  it("writes one sentence from the lines", () => {
    expect(b.sentence).toBe("Down $39,300,000: one lost, one lost commitment, one slipped and one changed value.");
  });

  it("team scope sums to that manager's change", () => {
    const a = computeBridge(run, seed.runLines, f.lines, DEMO_AS_OF, seed, "u-mgr-a");
    expect(a.lines.reduce((x, l) => x + l.amount, 0)).toBe(a.after - a.before);
  });
});
