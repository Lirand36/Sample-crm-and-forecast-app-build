// Path to signature for one deal: its Conditions in template order, each with the state replayed
// from accepted Evidence as of the session date (PRD §4C). Nothing here is stored.

import { conditionState, type ConditionState } from "@/domain/condition-state";
import type { IsoDate } from "@/domain/dates";
import { CONDITION_NUMBER, type ConditionType, type Evidence } from "@/domain/entities";
import type { DataStore } from "./ports";
import { readSession } from "./clock";

export interface PathStep {
  type: ConditionType;
  owner: string;
  state: ConditionState;
  /** The Evidence that last moved this step, for the one-line explanation. */
  latest: { evidence: Evidence; occurredAt: IsoDate } | null;
}

export async function signaturePathFor(store: DataStore, opportunityId: string): Promise<PathStep[]> {
  const [session, conditions, evidence, decisions, events, waivers, plans, readings] = await Promise.all([
    readSession(store),
    store.repos.dealConditions.list(),
    store.repos.evidence.list(),
    store.repos.evidenceDecisions.list(),
    store.repos.events.list(),
    store.repos.conditionWaivers.list(),
    store.repos.pilotPlans.list(),
    store.repos.pilotReadings.list(),
  ]);
  const dealEvidence = evidence.filter((e) => e.opportunityId === opportunityId);
  const eventById = new Map(events.filter((e) => e.opportunityId === opportunityId).map((e) => [e.id, e]));
  const evidenceById = new Map(dealEvidence.map((e) => [e.id, e]));
  return conditions
    .filter((c) => c.opportunityId === opportunityId)
    .sort((a, b) => CONDITION_NUMBER[a.type] - CONDITION_NUMBER[b.type])
    .map((c) => {
      const state = conditionState(
        {
          type: c.type,
          evidence: dealEvidence,
          decisions,
          events: eventById,
          waivers: waivers.filter((w) => w.opportunityId === opportunityId),
          pilotPlan: plans.find((p) => p.opportunityId === opportunityId) ?? null,
          pilotReadings: readings.filter((r) => r.opportunityId === opportunityId),
        },
        session.asOfDate,
      );
      const lastId = state.applied[state.applied.length - 1];
      const last = lastId ? evidenceById.get(lastId) : undefined;
      const ev = last ? eventById.get(last.eventId) : undefined;
      return { type: c.type, owner: c.owner, state, latest: last && ev ? { evidence: last, occurredAt: ev.occurredAt } : null };
    });
}
