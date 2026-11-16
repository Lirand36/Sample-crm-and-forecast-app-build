// Assembles one deal's replayed states and timing from plain records. Pure; used by the app service and tests.

import { conditionState, type ConditionState } from "./condition-state";
import type { IsoDate } from "./dates";
import type {
  Account,
  ConditionTemplate,
  ConditionWaiver,
  DealCondition,
  DealEvent,
  DealLinkOverride,
  Evidence,
  EvidenceDecision,
  Opportunity,
  PilotPlan,
  PilotReading,
  PlanningStandard,
  TemplateLink,
} from "./entities";
import { CONDITION_NUMBER } from "./entities";
import { dealTiming, type DealTiming } from "./timing";

export interface ForecastData {
  opportunities: readonly Opportunity[];
  accounts: readonly Account[];
  dealConditions: readonly DealCondition[];
  conditionTemplates: readonly ConditionTemplate[];
  dealLinkOverrides: readonly DealLinkOverride[];
  events: readonly DealEvent[];
  evidence: readonly Evidence[];
  evidenceDecisions: readonly EvidenceDecision[];
  conditionWaivers: readonly ConditionWaiver[];
  pilotPlans: readonly PilotPlan[];
  pilotReadings: readonly PilotReading[];
  planningStandards: readonly PlanningStandard[];
}

export interface DealView {
  opportunity: Opportunity;
  account: Account | undefined;
  states: ConditionState[];
  links: TemplateLink[];
  timing: DealTiming;
}

/** Template links with this deal's overrides applied (DR-07; latest override per link wins). */
export function linksFor(data: ForecastData, opp: Opportunity): TemplateLink[] {
  const template = data.conditionTemplates.find((t) => t.variant === opp.templateVariant && t.version === opp.templateVersion);
  const links = new Map((template?.links ?? []).map((l) => [`${l.from}>${l.to}`, l]));
  const overrides = data.dealLinkOverrides.filter((o) => o.opportunityId === opp.id).sort((a, b) => a.seq - b.seq);
  for (const o of overrides) {
    const key = `${o.from}>${o.to}`;
    if (o.strength === "removed") links.delete(key);
    else links.set(key, { from: o.from, to: o.to, strength: o.strength });
  }
  return [...links.values()];
}

export function dealView(data: ForecastData, opportunityId: string, asOf: IsoDate, quarterEnd: IsoDate): DealView | null {
  const opportunity = data.opportunities.find((o) => o.id === opportunityId);
  if (!opportunity) return null;
  const account = data.accounts.find((a) => a.id === opportunity.accountId);
  const evidence = data.evidence.filter((e) => e.opportunityId === opportunityId);
  const events = new Map(data.events.filter((e) => e.opportunityId === opportunityId).map((e) => [e.id, e]));
  const waivers = data.conditionWaivers.filter((w) => w.opportunityId === opportunityId);
  const pilotPlan = data.pilotPlans.find((p) => p.opportunityId === opportunityId) ?? null;
  const pilotReadings = data.pilotReadings.filter((r) => r.opportunityId === opportunityId);
  const states = data.dealConditions
    .filter((c) => c.opportunityId === opportunityId)
    .sort((a, b) => CONDITION_NUMBER[a.type] - CONDITION_NUMBER[b.type])
    .map((c) =>
      conditionState(
        { type: c.type, evidence, decisions: data.evidenceDecisions, events, waivers, pilotPlan, pilotReadings },
        asOf,
      ),
    );
  const links = linksFor(data, opportunity);
  const timing = dealTiming({
    dealType: opportunity.dealType,
    segment: account?.segment ?? "",
    states,
    links,
    standards: data.planningStandards,
    pilotPlan,
    asOf,
    quarterEnd,
  });
  return { opportunity, account, states, links, timing };
}
