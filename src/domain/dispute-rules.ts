// Raising a Dispute (PRD §4I, DR-10, DR-11). A Dispute In needs a Bet that the engine accepts: with the
// named Conditions treated as Done on their Bet dates and nothing else changed, the deal would be Firm or
// Core. Pure.

import { classify } from "./classification";
import type { ConditionState } from "./condition-state";
import { compareDates, type IsoDate } from "./dates";
import type { DealView, ForecastData } from "./deal-view";
import { CONDITION_LABEL, type ConditionType, type DisputeBet, type Group, type Quarter } from "./entities";
import { dealTiming } from "./timing";

export type DisputeCheck = { ok: true } | { ok: false; message: string };

const COUNTED: Group[] = ["firm", "core"];

export function checkDisputeIn(view: DealView, group: Group, bets: readonly DisputeBet[], data: ForecastData, asOf: IsoDate, quarter: Quarter): DisputeCheck {
  if (group === "excluded" || group === "signed") return { ok: false, message: "This deal is not open in the forecast." };
  if (["firm", "core"].includes(group)) return { ok: false, message: "This deal is already counted. Raise a Dispute Out instead." };
  if (bets.length === 0) return { ok: false, message: "Name at least one open step and the date you expect it done." };
  for (const b of bets) {
    const s = view.states.find((x) => x.type === b.conditionType);
    if (!s || s.state === "done" || s.state === "waived") return { ok: false, message: `${CONDITION_LABEL[b.conditionType]} is not an open step.` };
    if (compareDates(b.by, quarter.end) > 0) return { ok: false, message: "Every Bet date must be on or before quarter end." };
    if (compareDates(b.by, asOf) < 0) return { ok: false, message: "A Bet date cannot be in the past." };
  }
  const result = groupWithBets(view, bets, data, asOf, quarter);
  if (COUNTED.includes(result.group)) return { ok: true };
  return { ok: false, message: `Even with that Bet the deal would not count: ${result.reasons.join("; ") || "it stays outside Core"}.` };
}

/** The deal's Group with each still-open Bet Condition treated as Done on its Bet date, nothing else changed. */
export function groupWithBets(view: DealView, bets: readonly DisputeBet[], data: ForecastData, asOf: IsoDate, quarter: Quarter) {
  const states: ConditionState[] = view.states.map((s) => {
    const bet = bets.find((b) => b.conditionType === s.type);
    return bet && s.state !== "done" && s.state !== "waived" ? { ...s, state: "done", doneOn: bet.by, doneGrade: "stated", blockedNow: null } : s;
  });
  const timing = dealTiming({ ...view.timingInput, states });
  return classify({ ...view, states, timing }, data, asOf, quarter);
}

/** DR-10: a live Dispute In is re-checked on every recompute with the same test as at creation. */
export function betStillSufficient(view: DealView, bets: readonly DisputeBet[], data: ForecastData, asOf: IsoDate, quarter: Quarter): boolean {
  return COUNTED.includes(groupWithBets(view, bets, data, asOf, quarter).group);
}

export function checkDisputeOut(view: DealView, group: Group, outCondition: ConditionType | null, reason: string): DisputeCheck {
  if (!COUNTED.includes(group)) return { ok: false, message: "A Dispute Out is raised on a Firm or Core deal." };
  if (!reason.trim()) return { ok: false, message: "A reason is required." };
  if (!outCondition) return { ok: false, message: "Name the open step you expect not to be done by quarter end." };
  const s = view.states.find((x) => x.type === outCondition);
  if (!s || s.state === "done" || s.state === "waived") return { ok: false, message: `${CONDITION_LABEL[outCondition]} is not an open step.` };
  return { ok: true };
}
