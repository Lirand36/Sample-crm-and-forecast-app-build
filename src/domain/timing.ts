// Timing: planning standards (DR-01, G-2), remaining days (PRD §4E), the pilot (DR-02) and the path to a
// planned signature date per Timing case (PRD §4G). Pure; the as-of date is always a parameter.

import type { ConditionState } from "./condition-state";
import { addDays, compareDates, daysBetween, maxDate, type IsoDate } from "./dates";
import type { ConditionType, DealType, PilotPlan, PlanningConditionType, PlanningStandard, TemplateLink } from "./entities";

export const CASES = ["fast", "standard", "slow"] as const;
export type TimingCase = (typeof CASES)[number];
export type PerCase<T> = Record<TimingCase, T>;

const perCase = <T>(f: (c: TimingCase) => T): PerCase<T> => ({ fast: f("fast"), standard: f("standard"), slow: f("slow") });

/** G-2 lookup: (deal_type, segment) → (all, segment) → (deal_type, null) → (all, null); latest version in force. */
export function findStandard(
  standards: readonly PlanningStandard[],
  conditionType: PlanningConditionType,
  dealType: DealType,
  segment: string,
  asOf: IsoDate,
): PlanningStandard | null {
  const inForce = standards.filter((s) => s.conditionType === conditionType && compareDates(s.effectiveFrom, asOf) <= 0);
  for (const [dt, seg] of [
    [dealType, segment],
    ["all", segment],
    [dealType, null],
    ["all", null],
  ] as const) {
    const rows = inForce.filter((s) => s.dealType === dt && s.segment === seg).sort((a, b) => b.version - a.version);
    if (rows[0]) return rows[0];
  }
  return null;
}

export function standardDays(s: PlanningStandard): PerCase<number> {
  return { fast: s.fastDays, standard: s.standardDays, slow: s.slowDays };
}

/** Days in [from, to) that fall inside any of the (merged, half-open) intervals. */
function blockedDaysWithin(from: IsoDate, to: IsoDate, intervals: ConditionState["blocked"]): number {
  let total = 0;
  for (const iv of intervals) {
    const start = maxDate(from, iv.start);
    const end = iv.end === null ? to : compareDates(iv.end, to) < 0 ? iv.end : to;
    if (compareDates(start, end) < 0) total += daysBetween(start, end);
  }
  return total;
}

/** Days of progress credited: first Evidence to latest progress Evidence, less blocked days (PRD §4E). */
export function creditedDays(state: ConditionState): number {
  if (!state.spanStart || !state.latestProgress || compareDates(state.latestProgress, state.spanStart) <= 0) return 0;
  return daysBetween(state.spanStart, state.latestProgress) - blockedDaysWithin(state.spanStart, state.latestProgress, state.blocked);
}

export type NoEstimateReason = "overdue" | "blocked_no_end" | "no_planning_standard" | "pilot_overdue" | "pilot_failed";

/** Remaining days per case, or a reason there is none (PRD §4E table). */
export function remainingDays(
  state: ConditionState,
  durations: PerCase<number> | null,
): PerCase<number | NoEstimateReason> {
  if (state.state === "done" || state.state === "waived") return perCase(() => 0);
  if (!durations) return perCase(() => "no_planning_standard" as const);
  if (state.state === "blocked" && state.blockedNow?.end === null) return perCase(() => "blocked_no_end" as const);
  if (state.state === "not_started") return perCase((c) => durations[c]);
  const credited = creditedDays(state);
  const raw = perCase((c) => durations[c] - credited);
  // Zero or less: the case is exhausted, use the next slower case's result; slow exhausted means Overdue.
  const resolve = (i: number): number | NoEstimateReason => {
    const c = CASES[i];
    if (!c) return "overdue";
    const r = raw[c];
    if (r <= 0) return resolve(i + 1);
    return r <= 2 ? 2 : r;
  };
  return { fast: resolve(0), standard: resolve(1), slow: resolve(2) };
}

export interface StepTiming {
  type: ConditionType;
  start: PerCase<IsoDate | null>;
  finish: PerCase<IsoDate | null>;
  remaining: PerCase<number | NoEstimateReason>;
  standardId: string | null;
}

export interface DealTimingInput {
  dealType: DealType;
  segment: string;
  states: readonly ConditionState[];
  links: readonly TemplateLink[];
  standards: readonly PlanningStandard[];
  pilotPlan: PilotPlan | null;
  asOf: IsoDate;
  quarterEnd: IsoDate;
  /** Intervention preview: lift every soft Link into this Condition (PRD §4G.6). Hard Links are never lifted. */
  liftSoftLinksInto?: ConditionType;
}

export type Readiness = TimingCase | "not_ready";

export interface DealTiming {
  steps: StepTiming[];
  /** Planned signature date per case; null where any step has no estimate. */
  esd: PerCase<IsoDate | null>;
  /** Slowest case whose date falls on or before quarter end. */
  readiness: Readiness;
  /** First step with no estimate in the fast case, for the reason text. */
  missingFast: { type: ConditionType; reason: NoEstimateReason } | null;
}

/** DR-02: a pilot with a plan is timed by its evaluation date plus the pilot_acceptance standard. */
function pilotTiming(
  state: ConditionState,
  plan: PilotPlan,
  acceptance: PlanningStandard | null,
  asOf: IsoDate,
): { finish: PerCase<IsoDate | null>; remaining: PerCase<number | NoEstimateReason> } {
  if (state.state === "done" || state.state === "waived") {
    const on = state.doneOn ?? asOf;
    return { finish: perCase(() => on), remaining: perCase(() => 0) };
  }
  if (!acceptance) return { finish: perCase(() => null), remaining: perCase(() => "no_planning_standard" as const) };
  const days = standardDays(acceptance);
  if (compareDates(asOf, addDays(plan.evaluationDate, days.slow)) > 0) {
    return { finish: perCase(() => null), remaining: perCase(() => "pilot_overdue" as const) };
  }
  const finish = perCase((c) => maxDate(asOf, addDays(plan.evaluationDate, days[c])));
  return { finish, remaining: perCase((c) => daysBetween(asOf, finish[c])) };
}

export function dealTiming(input: DealTimingInput): DealTiming {
  const byType = new Map(input.states.map((s) => [s.type, s]));
  const steps = new Map<ConditionType, StepTiming>();

  const visit = (type: ConditionType, stack: Set<ConditionType>): StepTiming => {
    const done = steps.get(type);
    if (done) return done;
    if (stack.has(type)) throw new Error(`Link cycle at ${type}`);
    stack.add(type);
    const state = byType.get(type)!;

    if (type === "pilot" && input.pilotPlan) {
      const acceptance = findStandard(input.standards, "pilot_acceptance", input.dealType, input.segment, input.asOf);
      const t = pilotTiming(state, input.pilotPlan, acceptance, input.asOf);
      const step: StepTiming = { type, start: perCase(() => input.asOf), ...t, standardId: acceptance?.id ?? null };
      steps.set(type, step);
      return step;
    }

    const standard = findStandard(input.standards, type, input.dealType, input.segment, input.asOf);
    const remaining = remainingDays(state, standard ? standardDays(standard) : null);
    const isClosed = state.state === "done" || state.state === "waived";
    const hasStarted = state.spanStart !== null;
    const preds = input.links
      .filter((l) => l.to === type && byType.has(l.from))
      .filter((l) => l.strength === "hard" || (!hasStarted && input.liftSoftLinksInto !== type))
      .map((l) => visit(l.from, stack));

    const start = perCase((c): IsoDate | null => {
      if (isClosed) return state.doneOn ?? input.asOf;
      let s: IsoDate = input.asOf;
      for (const p of preds) {
        const f = p.finish[c];
        if (f === null) return null;
        s = maxDate(s, f);
      }
      if (state.blockedNow?.end) s = maxDate(s, state.blockedNow.end);
      return s;
    });
    const finish = perCase((c): IsoDate | null => {
      if (isClosed) return state.doneOn ?? input.asOf;
      const r = remaining[c];
      const s = start[c];
      return typeof r === "number" && s !== null ? addDays(s, r) : null;
    });
    const step: StepTiming = { type, start, finish, remaining, standardId: standard?.id ?? null };
    stack.delete(type);
    steps.set(type, step);
    return step;
  };

  for (const s of input.states) visit(s.type, new Set());
  const ordered = input.states.map((s) => steps.get(s.type)!);

  const esd = perCase((c): IsoDate | null => {
    let latest: IsoDate = input.asOf;
    for (const st of ordered) {
      const f = st.finish[c];
      if (f === null) return null;
      latest = maxDate(latest, f);
    }
    return latest;
  });
  const fits = (c: TimingCase) => esd[c] !== null && compareDates(esd[c]!, input.quarterEnd) <= 0;
  const readiness: Readiness = fits("slow") ? "slow" : fits("standard") ? "standard" : fits("fast") ? "fast" : "not_ready";

  let missingFast: DealTiming["missingFast"] = null;
  for (const st of ordered) {
    const r = st.remaining.fast;
    if (typeof r === "string") {
      missingFast = { type: st.type, reason: r };
      break;
    }
  }
  if (!missingFast && esd.fast === null) {
    const blocked = ordered.find((st) => st.finish.fast === null);
    if (blocked) missingFast = { type: blocked.type, reason: "overdue" };
  }
  return { steps: ordered, esd, readiness, missingFast };
}

/**
 * Latest viable date of each open Condition: quarter end minus the largest sum of standard remaining days
 * along any chain of Conditions that must follow it (PRD §4G.5). Done steps contribute nothing.
 */
export function latestViableDates(
  timing: DealTiming,
  links: readonly TemplateLink[],
  quarterEnd: IsoDate,
): Map<ConditionType, IsoDate | null> {
  const remaining = new Map(timing.steps.map((s) => [s.type, s.remaining.standard]));
  const memo = new Map<ConditionType, number | null>();
  // Longest standard-pace chain strictly after `type`; null if any step on it has no estimate.
  const after = (type: ConditionType): number | null => {
    if (memo.has(type)) return memo.get(type)!;
    let best = 0;
    for (const l of links.filter((x) => x.from === type && remaining.has(x.to))) {
      const r = remaining.get(l.to)!;
      const rest = after(l.to);
      if (typeof r !== "number" || rest === null) {
        memo.set(type, null);
        return null;
      }
      best = Math.max(best, r + rest);
    }
    memo.set(type, best);
    return best;
  };
  const out = new Map<ConditionType, IsoDate | null>();
  for (const s of timing.steps) {
    const tail = after(s.type);
    out.set(s.type, tail === null ? null : addDays(quarterEnd, -tail));
  }
  return out;
}
