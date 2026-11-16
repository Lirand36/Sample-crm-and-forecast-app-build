// The live forecast: every deal evaluated as of a date, Scenario totals, Manager commitment and the
// "at stake" lists (PRD §4I, §5 Home). Pure.

import { classify, scenarioTotals, type Classification, type ScenarioTotals } from "./classification";
import type { IsoDate } from "./dates";
import { dealView, type DealView, type ForecastData } from "./deal-view";
import { betStillSufficient } from "./dispute-rules";
import { disputeStatus, managerCommitment, type DisputeStatus } from "./disputes";
import type { Dispute, Quarter, QuarterTarget } from "./entities";
import type { Cents } from "./money";
import { interventionsFor, type Intervention } from "./interventions";
import type { ConditionType } from "./entities";

export interface ForecastLine extends Classification {
  view: DealView;
  tcv: Cents | null;
  managerId: string;
  dispute: { dispute: Dispute; status: DisputeStatus } | null;
  interventions: Intervention[];
  /** Set when this line shows an Intervention preview instead of the live result. */
  previewing: ConditionType | null;
}

export interface ManagerRow extends ScenarioTotals {
  managerId: string | null; // null = company
  target: Cents | null;
  managerCommitment: Cents;
  liveDisputes: number;
}

export interface Forecast {
  asOf: IsoDate;
  quarter: Quarter;
  lines: ForecastLine[];
  company: ManagerRow;
  managers: ManagerRow[];
  downside: ForecastLine[];
  readyNotCommitted: ForecastLine[];
  /** Deals outside Core that an Intervention moves into Firm or Core. Shown, never counted. */
  recoverable: ForecastLine[];
}

/** Preview one Intervention: nothing is stored (PRD §5 Deal block 5). */
export interface InterventionPreview {
  opportunityId: string;
  condition: ConditionType;
}

export interface ForecastInput extends ForecastData {
  disputes: readonly Dispute[];
  quarterTargets: readonly QuarterTarget[];
}

function rollup(lines: ForecastLine[], managerId: string | null, targets: readonly QuarterTarget[], quarterId: string): ManagerRow {
  const totals = scenarioTotals(lines);
  const disputes = lines.filter((l) => l.dispute).map((l) => ({ ...l.dispute!, tcv: l.tcv }));
  return {
    managerId,
    ...totals,
    target: targets.find((t) => t.quarterId === quarterId && t.managerId === managerId)?.target ?? null,
    managerCommitment: managerCommitment(totals.core, disputes),
    liveDisputes: disputes.filter((d) => d.status.live).length,
  };
}

export function computeForecast(data: ForecastInput, asOf: IsoDate, quarter: Quarter, preview?: InterventionPreview): Forecast {
  const lines: ForecastLine[] = data.opportunities.map((o) => {
    const live = dealView(data, o.id, asOf, quarter.end)!;
    const liveClass = classify(live, data, asOf, quarter);
    const interventions = interventionsFor(live, liveClass, data, asOf, quarter);
    const chosen = preview?.opportunityId === o.id ? interventions.find((i) => i.condition === preview.condition) : undefined;
    const view = chosen ? { ...live, timing: chosen.timing } : live;
    const c = chosen ? chosen.result : liveClass;
    const recheck = (st: DisputeStatus): DisputeStatus =>
      st.live && d!.direction === "in" && !betStillSufficient(live, d!.bets, data, asOf, quarter) ? { live: false, reason: "Bet no longer sufficient" } : st;
    const d = data.disputes.find((x) => x.opportunityId === o.id && x.quarterId === quarter.id && !(x.withdrawnAt && x.withdrawnAt <= asOf));
    return {
      ...c,
      view,
      tcv: o.tcv,
      managerId: o.managerId,
      dispute: d ? { dispute: d, status: recheck(disputeStatus(d, c.group, view.states, asOf)) } : null,
      interventions,
      previewing: chosen ? chosen.condition : null,
    };
  });
  const managerIds = [...new Set(lines.map((l) => l.managerId))].sort();
  const byTcv = (a: ForecastLine, b: ForecastLine) => (b.tcv ?? 0) - (a.tcv ?? 0);
  return {
    asOf,
    quarter,
    lines,
    company: rollup(lines, null, data.quarterTargets, quarter.id),
    managers: managerIds.map((m) => rollup(lines.filter((l) => l.managerId === m), m, data.quarterTargets, quarter.id)),
    downside: lines.filter((l) => l.group === "core").sort(byTcv),
    readyNotCommitted: lines
      .filter((l) => l.group === "uncommitted" && (l.view.timing.readiness === "slow" || l.view.timing.readiness === "standard"))
      .sort(byTcv),
    recoverable: lines.filter((l) => l.interventions.length > 0 && !["signed", "firm", "core"].includes(l.group)).sort(byTcv),
  };
}
