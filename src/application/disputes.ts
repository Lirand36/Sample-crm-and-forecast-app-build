// Raise and withdraw Disputes: the deal's Sales Manager only (DR-04), one live Dispute per deal per quarter.

import { checkDisputeIn, checkDisputeOut } from "@/domain/dispute-rules";
import type { ConditionType, Dispute, DisputeBet } from "@/domain/entities";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import { loadForecastWithData } from "./forecast";
import type { DataStore } from "./ports";

export interface DisputeInput {
  opportunityId: string;
  direction: "in" | "out";
  reason: string;
  bets: DisputeBet[];
  outCondition: ConditionType | null;
}

async function logDispute(store: DataStore, d: Dispute, field: string, value: string, actorId: string, reason: string | null) {
  const { seq, at } = await reserveSeq(store);
  await store.repos.changeLog.append({ id: `chg-${seq}`, entity: "dispute", entityId: d.id, field, oldValue: null, newValue: value, actorId, at, seq, reason });
}

export async function raiseDispute(store: DataStore, input: DisputeInput): Promise<CrmResult<Dispute>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  const { forecast, data } = await loadForecastWithData(store);
  const line = forecast.lines.find((l) => l.view.opportunity.id === input.opportunityId);
  if (!actor || !line) return { ok: false, errors: { form: "Deal not found." } };
  if (actor.role !== "sales_manager" || actor.id !== line.view.opportunity.managerId) {
    return { ok: false, errors: { form: "Only the deal's Sales Manager can raise a Dispute." } };
  }
  const live = data.disputes.find((d) => d.opportunityId === input.opportunityId && d.quarterId === forecast.quarter.id && !d.withdrawnAt);
  if (live) return { ok: false, errors: { form: "This deal already has a Dispute this quarter. Withdraw it first." } };
  if (!input.reason.trim()) return { ok: false, errors: { reason: "A reason is required." } };
  const check =
    input.direction === "in"
      ? checkDisputeIn(line.view, line.group, input.bets, data, forecast.asOf, forecast.quarter)
      : checkDisputeOut(line.view, line.group, input.outCondition, input.reason);
  if (!check.ok) return { ok: false, errors: { form: check.message } };
  const { seq } = await reserveSeq(store);
  const dispute: Dispute = {
    id: `dsp-${seq}`,
    opportunityId: input.opportunityId,
    quarterId: forecast.quarter.id,
    managerId: actor.id,
    direction: input.direction,
    reason: input.reason.trim(),
    bets: input.direction === "in" ? input.bets : [],
    outCondition: input.direction === "out" ? input.outCondition : null,
    createdAt: forecast.asOf,
    withdrawnAt: null,
  };
  await store.repos.disputes.put(dispute);
  await logDispute(store, dispute, "raised", input.direction, actor.id, dispute.reason);
  return { ok: true, value: dispute };
}

export async function withdrawDispute(store: DataStore, disputeId: string): Promise<CrmResult<Dispute>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  const d = await store.repos.disputes.get(disputeId);
  if (!actor || !d) return { ok: false, errors: { form: "Dispute not found." } };
  const opp = await store.repos.opportunities.get(d.opportunityId);
  if (actor.role !== "sales_manager" || actor.id !== opp?.managerId) return { ok: false, errors: { form: "Only the deal's Sales Manager can withdraw it." } };
  if (d.withdrawnAt) return { ok: false, errors: { form: "Already withdrawn." } };
  const after = { ...d, withdrawnAt: session.asOfDate };
  await store.repos.disputes.put(after);
  await logDispute(store, after, "withdrawn", session.asOfDate, actor.id, null);
  return { ok: true, value: after };
}
