// Loads everything the engine needs and computes the live forecast as of the session date.

import { computeForecast, type Forecast, type ForecastInput, type InterventionPreview } from "@/domain/forecast";
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
