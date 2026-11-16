import { describe, expect, it } from "vitest";
import { cents, formatAmount, formatUsd, sumCents, usdM } from "@/domain/money";

describe("money in integer cents", () => {
  it("converts millions exactly", () => {
    expect(usdM(2.5)).toBe(250_000_000);
    expect(usdM(17.3)).toBe(1_730_000_000);
    expect(sumCents([usdM(0.1), usdM(0.2)])).toBe(usdM(0.3));
  });
  it("refuses fractional cents", () => {
    expect(() => cents(1.5)).toThrow();
  });
  it("formats", () => {
    expect(formatAmount(usdM(8))).toBe("$8,000,000");
    expect(formatAmount(usdM(-0.5))).toBe("−$500,000");
    expect(formatUsd(cents(123456789))).toBe("$1,234,567.89");
  });
});
