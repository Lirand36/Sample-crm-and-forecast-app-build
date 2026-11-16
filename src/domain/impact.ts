// What one action did to the forecast: the totals before and after, and each deal whose standing changed.
// Shown right after every write, so a manager's move, an email or an approval visibly moves the numbers. Pure.

import type { IsoDate } from "./dates";
import type { Group } from "./entities";
import { forecastCategory, type Forecast, type ForecastCategory, type ForecastLine } from "./forecast";
import type { Cents } from "./money";

export interface TotalChange {
  key: "core" | "managerCommitment" | "conservative" | "stretch";
  before: Cents;
  after: Cents;
}

export interface DealChange {
  opportunityId: string;
  name: string;
  tcv: Cents | null;
  group: { before: Group; after: Group } | null;
  category: { before: ForecastCategory; after: ForecastCategory } | null;
  esd: { before: IsoDate | null; after: IsoDate | null } | null;
  /** A manager's move that started or stopped counting, with the reason it stopped. */
  dispute: { before: boolean; after: boolean; reason: string | null } | null;
  /** What now holds the deal back, when anything does. */
  reasons: string[];
}

export interface Impact {
  totals: TotalChange[];
  deals: DealChange[];
  asOf: { before: IsoDate; after: IsoDate } | null;
}

const KEYS: TotalChange["key"][] = ["core", "managerCommitment", "conservative", "stretch"];

export function impactOf(before: Forecast, after: Forecast): Impact {
  const totals = KEYS.map((key) => ({ key, before: before.company[key], after: after.company[key] }));
  const prev = new Map(before.lines.map((l) => [l.view.opportunity.id, l]));
  const deals: DealChange[] = [];
  for (const n of after.lines) {
    const id = n.view.opportunity.id;
    const b = prev.get(id);
    const live = (l: ForecastLine | undefined) => !!l?.dispute?.status.live;
    const change: DealChange = {
      opportunityId: id,
      name: n.view.account?.name ?? n.view.opportunity.name,
      tcv: n.tcv,
      group: !b || b.group !== n.group ? { before: b?.group ?? "excluded", after: n.group } : null,
      category: !b || forecastCategory(b) !== forecastCategory(n) ? { before: b ? forecastCategory(b) : "Omitted", after: forecastCategory(n) } : null,
      esd: b && n.eligibility.kind === "evaluated" && b.eligibility.kind === "evaluated" && b.view.timing.esd.standard !== n.view.timing.esd.standard ? { before: b.view.timing.esd.standard, after: n.view.timing.esd.standard } : null,
      dispute:
        live(b) !== live(n) || (!!n.dispute) !== (!!b?.dispute)
          ? { before: live(b), after: live(n), reason: n.dispute && !n.dispute.status.live ? n.dispute.status.reason : null }
          : null,
      reasons: n.reasons,
    };
    if (change.group || change.category || change.esd || change.dispute || (b && b.tcv !== n.tcv)) deals.push(change);
  }
  const weight = (d: DealChange) => (d.group || d.category || d.dispute ? 0 : 1);
  deals.sort((a, b) => weight(a) - weight(b) || (b.tcv ?? 0) - (a.tcv ?? 0));
  return { totals, deals, asOf: before.asOf !== after.asOf ? { before: before.asOf, after: after.asOf } : null };
}

export function isEmptyImpact(i: Impact): boolean {
  return i.deals.length === 0 && i.totals.every((t) => t.before === t.after) && i.asOf === null;
}
