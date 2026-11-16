// Backtest metrics (DR-15) for one stored run of a closed quarter. Pure. "In Core" means Signed, Firm
// or Core. Actual is the TCV signed inside the quarter (DR-12).

import { addDays, compareDates, daysBetween, isoDate, type IsoDate } from "./dates";
import type { ChangeLogEntry, Group, Opportunity } from "./entities";
import type { Cents } from "./money";

export interface BacktestDeal {
  name: string;
  tcv: Cents;
  group: Group;
  /** Standard-pace planned signature date at the run. */
  planned: IsoDate | null;
  signedOn: IsoDate | null;
}

/**
 * DR-12: the signed date that counts for Actual is the CRM as recorded at the cutoff (quarter end + 7 days).
 * Undo every later change to status and signed date; PAYG never counts.
 */
export function signedAsOfCutoff(o: Opportunity, changeLog: readonly ChangeLogEntry[], quarterEnd: IsoDate): IsoDate | null {
  if (o.dealType === "payg") return null;
  const cutoff = addDays(quarterEnd, 7);
  let status: string | null = o.status;
  let signed: string | null = o.signedDate;
  const later = changeLog
    .filter((c) => c.entity === "opportunity" && c.entityId === o.id && compareDates(c.at, cutoff) > 0)
    .sort((a, b) => b.seq - a.seq);
  for (const c of later) {
    if (c.field === "status") status = c.oldValue;
    if (c.field === "signed_date") signed = c.oldValue;
  }
  return status === "won" && signed ? isoDate(signed) : null;
}

export interface BacktestResult {
  conservative: Cents;
  core: Cents;
  stretch: Cents;
  managerCommitment: Cents;
  actual: Cents;
  corePrecision: number | null;
  coreCapture: number | null;
  signingRate: { group: Group; tcv: Cents; signed: Cents; rate: number | null }[];
  bracketed: boolean;
  coreError: Cents;
  managerError: Cents;
  timingBiasDays: number | null;
}

const IN_CORE: Group[] = ["signed", "firm", "core"];
export const BACKTEST_GROUPS: Group[] = ["firm", "core", "stretch", "uncommitted", "late"];

export function computeBacktest(deals: readonly BacktestDeal[], quarter: { start: IsoDate; end: IsoDate }, managerCommitment?: Cents): BacktestResult {
  const sum = (xs: readonly BacktestDeal[]) => xs.reduce((a, d) => a + d.tcv, 0) as Cents;
  const signedInQ = (d: BacktestDeal) => d.signedOn !== null && compareDates(d.signedOn, quarter.start) >= 0 && compareDates(d.signedOn, quarter.end) <= 0;
  const inGroups = (gs: Group[]) => deals.filter((d) => gs.includes(d.group));
  const core = sum(inGroups(IN_CORE));
  const conservative = sum(inGroups(["signed", "firm"]));
  const stretch = sum(inGroups([...IN_CORE, "stretch"]));
  const actual = sum(deals.filter(signedInQ));
  const coreSigned = sum(inGroups(IN_CORE).filter(signedInQ));
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
  const mc = managerCommitment ?? core;
  const timed = deals.filter((d) => signedInQ(d) && d.planned !== null);
  return {
    conservative,
    core,
    stretch,
    managerCommitment: mc,
    actual,
    corePrecision: ratio(coreSigned, core),
    coreCapture: ratio(coreSigned, actual),
    signingRate: BACKTEST_GROUPS.map((g) => {
      const xs = inGroups([g]);
      const tcv = sum(xs);
      const signed = sum(xs.filter(signedInQ));
      return { group: g, tcv, signed, rate: ratio(signed, tcv) };
    }),
    bracketed: conservative <= actual && actual <= stretch,
    coreError: (core - actual) as Cents,
    managerError: (mc - actual) as Cents,
    timingBiasDays: timed.length ? timed.reduce((a, d) => a + daysBetween(d.planned!, d.signedOn!), 0) / timed.length : null,
  };
}
