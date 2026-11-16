// RevOps changes to one deal (DR-07): waive a step, change a Link. Both are append-only records and
// both are written to the change log so they appear in the RevOps log.

import { checkLinkChange, checkWaiver } from "@/domain/config-rules";
import { linksFor } from "@/domain/deal-view";
import type { ConditionType, ConditionWaiver, DealLinkOverride, LinkStrength } from "@/domain/entities";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import { loadForecastWithData } from "./forecast";
import type { DataStore } from "./ports";

async function log(store: DataStore, opportunityId: string, field: string, oldValue: string | null, newValue: string, actorId: string, reason: string) {
  const { seq, at } = await reserveSeq(store);
  await store.repos.changeLog.append({ id: `chg-${seq}`, entity: "opportunity", entityId: opportunityId, field, oldValue, newValue, actorId, at, seq, reason });
}

export async function waiveCondition(store: DataStore, opportunityId: string, conditionType: ConditionType, reason: string): Promise<CrmResult<ConditionWaiver>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  const { forecast } = await loadForecastWithData(store);
  const line = forecast.lines.find((l) => l.view.opportunity.id === opportunityId);
  if (!actor || !line) return { ok: false, errors: { form: "Deal not found." } };
  const state = line.view.states.find((s) => s.type === conditionType);
  const check = checkWaiver(actor.role, conditionType, state, reason);
  if (!check.ok) return { ok: false, errors: { form: check.message } };
  const { seq, at } = await reserveSeq(store);
  const waiver: ConditionWaiver = { id: `wvr-${seq}`, opportunityId, conditionType, reason: reason.trim(), actorId: actor.id, at, seq };
  await store.repos.conditionWaivers.append(waiver);
  await log(store, opportunityId, `waiver:${conditionType}`, state?.state ?? null, "waived", actor.id, waiver.reason);
  return { ok: true, value: waiver };
}

export async function changeLink(
  store: DataStore,
  opportunityId: string,
  from: ConditionType,
  to: ConditionType,
  strength: LinkStrength | "removed",
  reason: string,
): Promise<CrmResult<DealLinkOverride>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  const { data } = await loadForecastWithData(store);
  const opp = data.opportunities.find((o) => o.id === opportunityId);
  if (!actor || !opp) return { ok: false, errors: { form: "Deal not found." } };
  const current = linksFor(data, opp);
  const steps = data.dealConditions.filter((c) => c.opportunityId === opportunityId).map((c) => c.type);
  const check = checkLinkChange(actor.role, current, steps, from, to, strength, reason);
  if (!check.ok) return { ok: false, errors: { form: check.message } };
  const { seq, at } = await reserveSeq(store);
  const o: DealLinkOverride = { id: `lnk-${seq}`, opportunityId, from, to, strength, reason: reason.trim(), actorId: actor.id, at, seq };
  await store.repos.dealLinkOverrides.append(o);
  const old = current.find((l) => l.from === from && l.to === to)?.strength ?? "none";
  await log(store, opportunityId, `link:${from}>${to}`, old, strength, actor.id, o.reason);
  return { ok: true, value: o };
}
