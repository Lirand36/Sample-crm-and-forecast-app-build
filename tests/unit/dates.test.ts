import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { addDays, daysBetween, formatDisplayDate, fromDayNumber, isIsoDate, isoDate, toDayNumber } from "@/domain/dates";

describe("date-only utilities", () => {
  it("adds calendar days across month and year ends", () => {
    expect(addDays(isoDate("2027-03-01"), 30)).toBe("2027-03-31");
    expect(addDays(isoDate("2027-03-31"), 1)).toBe("2027-04-01");
    expect(addDays(isoDate("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(isoDate("2028-02-28"), 1)).toBe("2028-02-29");
  });

  it("counts days between dates (PRD seed: Feb 4 to Feb 24 is 20 days)", () => {
    expect(daysBetween(isoDate("2027-02-04"), isoDate("2027-02-24"))).toBe(20);
    expect(daysBetween(isoDate("2027-03-31"), isoDate("2027-03-01"))).toBe(-30);
  });

  it("rejects invalid dates", () => {
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2027-13-01")).toBe(false);
    expect(isIsoDate("27-01-01")).toBe(false);
    expect(() => isoDate("2027-02-30")).toThrow();
    expect(() => addDays(isoDate("2027-01-01"), 1.5)).toThrow();
  });

  it("round-trips day numbers (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000, max: 100_000 }), (n) => {
        const date = fromDayNumber(n);
        expect(isIsoDate(date)).toBe(true);
        expect(toDayNumber(date)).toBe(n);
      }),
    );
  });

  it("addDays and daysBetween are inverse (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50_000 }), fc.integer({ min: -2000, max: 2000 }), (start, delta) => {
        const a = fromDayNumber(start);
        expect(daysBetween(a, addDays(a, delta))).toBe(delta);
      }),
    );
  });

  it("formats for display", () => {
    expect(formatDisplayDate(isoDate("2027-03-16"))).toBe("Mar 16, 2027");
  });
});
