// Disputes and Manager commitment (PRD §4I, DR-10, DR-11). Pure.

import { compareDates, type IsoDate } from "./dates";
import type { ConditionState } from "./condition-state";
import type { Dispute, Group } from "./entities";
import type { Cents } from "./money";

export type DisputeStatus = { live: true } | { live: false; reason: string };

const COUNTED: Group[] = ["signed", "firm", "core"];

/** A Bet is missed as soon as one Bet date passes with its Condition not Done by then. */
export function betMissed(d: Dispute, states: readonly ConditionState[], asOf: IsoDate): boolean {
  return d.bets.some((b) => {
    if (compareDates(asOf, b.by) <= 0) return false;
    const s = states.find((x) => x.type === b.conditionType);
    if (!s) return false;
    if (s.state === "waived") return false;
    return !(s.state === "done" && s.doneOn !== null && compareDates(s.doneOn, b.by) <= 0);
  });
}

export function disputeStatus(d: Dispute, group: Group, states: readonly ConditionState[], asOf: IsoDate): DisputeStatus {
  if (d.withdrawnAt && compareDates(d.withdrawnAt, asOf) <= 0) return { live: false, reason: "withdrawn" };
  if (compareDates(d.createdAt, asOf) > 0) return { live: false, reason: "not raised yet" };
  if (group === "excluded") return { live: false, reason: "deal excluded" };
  if (d.direction === "in" && COUNTED.includes(group)) return { live: false, reason: "deal already counted" };
  if (d.direction === "out" && !COUNTED.includes(group)) return { live: false, reason: "deal already not counted" };
  if (d.direction === "in" && betMissed(d, states, asOf)) return { live: false, reason: "Bet missed" };
  return { live: true };
}

export function managerCommitment(core: Cents, disputes: readonly { dispute: Dispute; status: DisputeStatus; tcv: Cents | null }[]): Cents {
  let total = core as number;
  for (const x of disputes) {
    if (!x.status.live || !x.tcv) continue;
    total += x.dispute.direction === "in" ? x.tcv : -x.tcv;
  }
  return total as Cents;
}
