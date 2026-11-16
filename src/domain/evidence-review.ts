// Who may approve, confirm or reject Evidence (DR-04, G-1). Pure.

import type { EvidenceStatus } from "./condition-state";
import { CONDITION_NUMBER, REVERSING_CLAIMS, type Evidence, type Opportunity, type User } from "./entities";

export type ReviewAction = "approve" | "confirm" | "reject";

/** Conditions 2, 3 and 4 (budget, pilot, vendor selection) are reserved to RevOps (DR-04). */
const revopsOnly = (e: Evidence) => [2, 3, 4].includes(CONDITION_NUMBER[e.conditionType]);
const isDealManager = (u: User, o: Opportunity) => u.role === "sales_manager" && u.id === o.managerId;

export function allowedActions(actor: User, opp: Opportunity, evidence: Evidence, status: EvidenceStatus): ReviewAction[] {
  const revops = actor.role === "revops";
  const mgr = isDealManager(actor, opp);
  const reversing = REVERSING_CLAIMS.includes(evidence.claim);
  if (status === "waiting" && !reversing) {
    const can = revops || (mgr && !revopsOnly(evidence));
    return can ? ["approve", "reject"] : [];
  }
  if (status === "provisional" && reversing) {
    const out: ReviewAction[] = [];
    if (revops || mgr) out.push("confirm");
    if (revops || (mgr && !revopsOnly(evidence))) out.push("reject");
    return out;
  }
  // G-1: only the VP Sales may overturn Evidence that is already approved or confirmed.
  if ((status === "approved" || status === "confirmed") && actor.role === "vp_sales") return ["reject"];
  return [];
}

export function refusalReason(actor: User, opp: Opportunity, evidence: Evidence, status: EvidenceStatus): string {
  if (status === "approved" || status === "confirmed") return "Only the VP Sales can overturn Evidence that has already been reviewed.";
  if (revopsOnly(evidence)) return "Budget, pilot and vendor selection claims are reviewed by RevOps.";
  if (actor.role === "sales_manager" && actor.id !== opp.managerId) return "Only this deal's Sales Manager or RevOps can review it.";
  return "Only the deal's Sales Manager or RevOps can review it.";
}
