// BT-1 synthetic backtest fixture (handoff Part VII, test 60).
// Never loaded into the store and never mixed with real data (DR-15).
// Every element that shows it must carry SYNTHETIC_LABEL.

import { isoDate, type IsoDate } from "@/domain/dates";
import type { Group } from "@/domain/entities";
import { usdM, type Cents } from "@/domain/money";
import type { BacktestDeal } from "@/domain/backtest";

export const SYNTHETIC_LABEL = "Synthetic example — demonstrates the calculation, not accuracy";

export interface Bt1Deal {
  deal: string;
  tcv: Cents;
  groupAtRun: Group;
  standardPlannedDate: IsoDate | null;
  signedDate: IsoDate | null;
}

export const BT1 = {
  label: SYNTHETIC_LABEL,
  quarter: { id: "2026-Q4", start: isoDate("2026-10-01"), end: isoDate("2026-12-31"), cutoff: isoDate("2027-01-07") },
  runAsOf: isoDate("2026-11-01"),
  disputes: [] as const,
  deals: [
    { deal: "A", tcv: usdM(1.0), groupAtRun: "firm", standardPlannedDate: isoDate("2026-11-20"), signedDate: isoDate("2026-11-25") },
    { deal: "B", tcv: usdM(2.0), groupAtRun: "core", standardPlannedDate: isoDate("2026-12-15"), signedDate: null },
    { deal: "C", tcv: usdM(1.0), groupAtRun: "stretch", standardPlannedDate: isoDate("2026-12-30"), signedDate: isoDate("2026-12-20") },
    { deal: "D", tcv: usdM(1.0), groupAtRun: "uncommitted", standardPlannedDate: null, signedDate: null },
    { deal: "E", tcv: usdM(1.0), groupAtRun: "late", standardPlannedDate: isoDate("2027-01-15"), signedDate: isoDate("2027-01-10") },
  ] satisfies Bt1Deal[],
} as const;

/** BT-1 deals in the shape the backtest calculation reads. */
export const BT1_DEALS: BacktestDeal[] = BT1.deals.map((d) => ({
  name: `Deal ${d.deal}`,
  tcv: d.tcv,
  group: d.groupAtRun,
  planned: d.standardPlannedDate,
  signedOn: d.signedDate,
}));
