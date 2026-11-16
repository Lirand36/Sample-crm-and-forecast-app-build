// Loads everything the engine needs and computes the live forecast as of the session date.

import { computeForecast, type Forecast, type ForecastInput, type InterventionPreview } from "@/domain/forecast";
import { computeBridge, type Bridge } from "@/domain/bridge";
import { daysBetween, type IsoDate } from "@/domain/dates";
import { readSession } from "./clock";
import type { DataStore } from "./ports";

export async function loadForecast(store: DataStore): Promise<Forecast> {
  return (await loadForecastWithData(store)).forecast;
}

export async function loadForecastWithData(
  store: DataStore,
  preview?: InterventionPreview,
): Promise<{ forecast: Forecast; data: ForecastInput; preview: Forecast | null }> {
  const r = store.repos;
  const [session, quarters, opportunities, accounts, dealConditions, conditionTemplates, dealLinkOverrides, events, evidence,
    evidenceDecisions, conditionWaivers, pilotPlans, pilotReadings, planningStandards, disputes, quarterTargets] = await Promise.all([
    readSession(store), r.quarters.list(), r.opportunities.list(), r.accounts.list(), r.dealConditions.list(),
    r.conditionTemplates.list(), r.dealLinkOverrides.list(), r.events.list(), r.evidence.list(), r.evidenceDecisions.list(),
    r.conditionWaivers.list(), r.pilotPlans.list(), r.pilotReadings.list(), r.planningStandards.list(), r.disputes.list(),
    r.quarterTargets.list(),
  ]);
  const quarter = quarters.find((q) => q.start <= session.asOfDate && session.asOfDate <= q.end) ?? quarters[0];
  if (!quarter) throw new Error("No quarter configured");
  const data: ForecastInput = { opportunities, accounts, dealConditions, conditionTemplates, dealLinkOverrides, events, evidence,
    evidenceDecisions, conditionWaivers, pilotPlans, pilotReadings, planningStandards, disputes, quarterTargets };
  return {
    forecast: computeForecast(data, session.asOfDate, quarter),
    data,
    preview: preview ? computeForecast(data, session.asOfDate, quarter, preview) : null,
  };
}

/** C-2: the default baseline is last week's run (the latest stored at least 7 days before the as-of date). */
export function defaultBaseline<T extends { id: string; asOfDate: IsoDate; seq: number }>(runs: T[], asOf: IsoDate): T | undefined {
  const sorted = [...runs].sort((a, b) => b.seq - a.seq);
  return sorted.find((r) => daysBetween(r.asOfDate, asOf) >= 7) ?? sorted[0];
}

export async function loadBridge(store: DataStore, forecast: Forecast, baselineId?: string): Promise<Bridge | null> {
  const [runs, runLines, changeLog, events, evidenceDecisions, evidence, pilotReadings, planningStandards] = await Promise.all([
    store.repos.forecastRuns.list(), store.repos.runLines.list(), store.repos.changeLog.list(), store.repos.events.list(),
    store.repos.evidenceDecisions.list(), store.repos.evidence.list(), store.repos.pilotReadings.list(), store.repos.planningStandards.list(),
  ]);
  const quarterRuns = runs.filter((r) => r.quarterId === forecast.quarter.id && r.asOfDate <= forecast.asOf);
  const baseline = quarterRuns.find((r) => r.id === baselineId) ?? defaultBaseline(quarterRuns, forecast.asOf);
  if (!baseline) return null;
  return computeBridge(baseline, runLines, forecast.lines, forecast.asOf, {
    changeLog, events, evidenceDecisions, evidence, pilotReadings, planningStandards,
  });
}
