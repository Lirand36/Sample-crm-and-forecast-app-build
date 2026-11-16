// Real backtests (DR-15): one result per stored run of each closed quarter (as-of past the cutoff,
// QE + 7 days, DR-12). Deals are the run's lines; the outcome is the signed date in the CRM now.

import { computeBacktest, type BacktestDeal, type BacktestResult } from "@/domain/backtest";
import { addDays, compareDates } from "@/domain/dates";
import type { ForecastRun, Quarter } from "@/domain/entities";
import { readSession } from "./clock";
import type { DataStore } from "./ports";

export interface QuarterBacktest {
  quarter: Quarter;
  runs: { run: ForecastRun; result: BacktestResult; deals: BacktestDeal[] }[];
}

export async function loadBacktests(store: DataStore): Promise<QuarterBacktest[]> {
  const session = await readSession(store);
  const [quarters, runs, lines, opps] = await Promise.all([
    store.repos.quarters.list(), store.repos.forecastRuns.list(), store.repos.runLines.list(), store.repos.opportunities.list(),
  ]);
  const closed = quarters.filter((q) => compareDates(addDays(q.end, 7), session.asOfDate) <= 0);
  return closed
    .map((q) => ({
      quarter: q,
      runs: runs
        .filter((r) => r.quarterId === q.id)
        .sort((a, b) => a.seq - b.seq)
        .map((run) => {
          const deals: BacktestDeal[] = lines
            .filter((l) => l.runId === run.id && l.group !== "excluded" && l.tcv !== null)
            .map((l) => {
              const o = opps.find((x) => x.id === l.opportunityId);
              return {
                name: o?.name ?? l.opportunityId,
                tcv: l.tcv!,
                group: l.group,
                planned: l.esdStandard,
                signedOn: o?.status === "won" && o.dealType !== "payg" ? o.signedDate : null,
              };
            });
          return { run, deals, result: computeBacktest(deals, q, run.totals.managerCommitment) };
        }),
    }))
    .filter((q) => q.runs.length > 0);
}
