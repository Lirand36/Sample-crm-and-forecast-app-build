import { describe, expect, it } from "vitest";
import { computeBacktest } from "@/domain/backtest";
import { usdM } from "@/domain/money";
import { BT1, BT1_DEALS } from "@/seed/bt1";

describe("Backtest (DR-15)", () => {
  it("test 60: BT-1 metrics", () => {
    const r = computeBacktest(BT1_DEALS, BT1.quarter);
    expect([r.conservative, r.core, r.stretch, r.actual]).toEqual([usdM(1.0), usdM(3.0), usdM(4.0), usdM(2.0)]);
    expect(r.corePrecision).toBeCloseTo(1 / 3);
    expect(r.coreCapture).toBe(0.5);
    expect(Object.fromEntries(r.signingRate.map((s) => [s.group, s.rate]))).toEqual({ firm: 1, core: 0, stretch: 1, uncommitted: 0, late: 0 });
    expect(r.bracketed).toBe(true);
    expect(r.coreError).toBe(usdM(1.0));
    expect(r.managerError).toBe(usdM(1.0));
    expect(r.timingBiasDays).toBe(-2.5);
  });
});
