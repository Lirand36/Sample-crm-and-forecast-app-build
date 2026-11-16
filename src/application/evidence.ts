// Evidence review: append a decision (append-only, DR-18), with rights checked (DR-04, G-1).

import { evidenceStatus } from "@/domain/condition-state";
import { allowedActions, refusalReason, type ReviewAction } from "@/domain/evidence-review";
import type { EvidenceDecision } from "@/domain/entities";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import type { DataStore } from "./ports";

const DECISION: Record<ReviewAction, EvidenceDecision["decision"]> = { approve: "approved", confirm: "confirmed", reject: "rejected" };

export async function reviewEvidence(store: DataStore, evidenceId: string, action: ReviewAction, reason: string): Promise<CrmResult<EvidenceDecision>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  const evidence = await store.repos.evidence.get(evidenceId);
  if (!actor || !evidence) return { ok: false, errors: { form: "Evidence not found." } };
  const opp = await store.repos.opportunities.get(evidence.opportunityId);
  if (!opp) return { ok: false, errors: { form: "Deal not found." } };
  const status = evidenceStatus(evidence, await store.repos.evidenceDecisions.list());
  if (!allowedActions(actor, opp, evidence, status).includes(action)) return { ok: false, errors: { form: refusalReason(actor, opp, evidence, status) } };
  if (action === "reject" && !reason.trim()) return { ok: false, errors: { reason: "A reason is required to reject." } };
  const { seq, at } = await reserveSeq(store);
  const decision: EvidenceDecision = {
    id: `dec-${seq}`,
    evidenceId,
    decision: DECISION[action],
    actorId: actor.id,
    at,
    seq,
    reason: reason.trim() || null,
    duplicateOf: null,
  };
  await store.repos.evidenceDecisions.append(decision);
  return { ok: true, value: decision };
}
