// Eligibility (PRD §4A, C-3), Commitment (PRD §4H as changed by DR-02 and DR-07), Group (PRD §4I, DR-08)
// and Scenario totals. Pure; reads the deal view and the as-of date only.

import { evidenceStatus, gradeOf, isAccepted } from "./condition-state";
import { addDays, compareDates, type IsoDate } from "./dates";
import type { DealView, ForecastData } from "./deal-view";
import type { ConditionType, Group, Quarter } from "./entities";
import { CONDITION_LABEL } from "./entities";
import { sumCents, type Cents } from "./money";

export type Eligibility =
  | { kind: "signed" }
  | { kind: "excluded"; reason: string }
  | { kind: "evaluated" };

export function eligibility(view: DealView, quarter: Quarter): Eligibility {
  const o = view.opportunity;
  if (o.archivedAt) return { kind: "excluded", reason: "archived" };
  if (o.status === "won") {
    if (!o.signedDate) return { kind: "excluded", reason: "data error: won with no signed date" };
    const inQuarter = compareDates(o.signedDate, quarter.start) >= 0 && compareDates(o.signedDate, quarter.end) <= 0;
    return inQuarter ? { kind: "signed" } : { kind: "excluded", reason: "signed in another quarter" };
  }
  if (o.status === "lost") return { kind: "excluded", reason: "lost" };
  if (o.status === "disqualified") return { kind: "excluded", reason: o.statusReason ? `disqualified: ${o.statusReason}` : "disqualified" };
  if (o.dealType === "payg") return { kind: "excluded", reason: "pay-as-you-go, not forecast" };
  if (!o.tcv) return { kind: "excluded", reason: "no TCV" };
  return { kind: "evaluated" };
}

export type CommitmentLevel = "committed" | "engaged" | "unproven" | "at_risk";

export interface Commitment {
  level: CommitmentLevel;
  /** Why the level is not higher, as short phrases. */
  missing: string[];
  latestEngagement: IsoDate | null;
  openContrary: ConditionType[];
}

const COMMERCIAL: ConditionType[] = ["executive_sponsor", "budget", "vendor_selection"];
const RECENT_DAYS = 30;

/** Open Contrary signals: accepted, and not followed by Direct or Stated Evidence marking the Condition Done. */
function openContrary(view: DealView, data: ForecastData, asOf: IsoDate): ConditionType[] {
  const events = new Map(data.events.map((e) => [e.id, e]));
  const out: ConditionType[] = [];
  for (const e of data.evidence) {
    if (e.opportunityId !== view.opportunity.id || e.claim !== "contrary") continue;
    const ev = events.get(e.eventId);
    if (!ev || compareDates(ev.occurredAt, asOf) > 0 || gradeOf(ev) === "asserted") continue;
    if (!isAccepted(e, evidenceStatus(e, data.evidenceDecisions))) continue;
    const state = view.states.find((s) => s.type === e.conditionType);
    const closedLater = state?.state === "done" && state.doneOn !== null && compareDates(state.doneOn, ev.occurredAt) > 0;
    if (!closedLater && !out.includes(e.conditionType)) out.push(e.conditionType);
  }
  return out;
}

/** Latest engagement Evidence: customer, accepted, Direct or Stated, on a commercial Condition, intent, or procurement progress. */
function latestEngagement(view: DealView, data: ForecastData, asOf: IsoDate): IsoDate | null {
  const events = new Map(data.events.map((e) => [e.id, e]));
  let latest: IsoDate | null = null;
  for (const e of data.evidence) {
    if (e.opportunityId !== view.opportunity.id) continue;
    const ev = events.get(e.eventId);
    if (!ev || ev.origin !== "customer" || gradeOf(ev) === "asserted" || compareDates(ev.occurredAt, asOf) > 0) continue;
    if (e.claim === "contrary" || e.claim === "status") continue;
    const counts =
      COMMERCIAL.includes(e.conditionType) ||
      e.claim === "intent" ||
      (e.conditionType === "procurement_legal" && (e.claim === "progress" || e.claim === "started" || e.claim === "done"));
    if (!counts) continue;
    const status = evidenceStatus(e, data.evidenceDecisions);
    const accepted = e.claim === "intent" ? status === "approved" || status === "confirmed" : isAccepted(e, status);
    if (!accepted) continue;
    if (latest === null || compareDates(ev.occurredAt, latest) > 0) latest = ev.occurredAt;
  }
  return latest;
}

export function commitment(view: DealView, data: ForecastData, asOf: IsoDate): Commitment {
  const contrary = openContrary(view, data, asOf);
  const engagement = latestEngagement(view, data, asOf);
  const isDone = (t: ConditionType) => {
    const s = view.states.find((x) => x.type === t);
    return !s || s.state === "done" || s.state === "waived";
  };
  const pilot = view.timing.steps.find((s) => s.type === "pilot");
  const pilotFailing = pilot ? pilot.remaining.slow === "pilot_overdue" || pilot.remaining.slow === "pilot_failed" : false;
  // DR-02: "Done or has a standard-pace finish date". No pilot step (expand variant): treated as met.
  const pilotOk = !pilot || isDone("pilot") || pilot.finish.standard !== null;
  const recent = engagement !== null && compareDates(engagement, addDays(asOf, -RECENT_DAYS)) >= 0;

  const missing: string[] = [];
  if (contrary.length) missing.push(...contrary.map((t) => `contrary signal on ${CONDITION_LABEL[t].toLowerCase()}`));
  if (pilotFailing) missing.push(pilot!.remaining.slow === "pilot_failed" ? "pilot missed targets at evaluation" : "pilot not accepted");
  if (contrary.length || pilotFailing) return { level: "at_risk", missing, latestEngagement: engagement, openContrary: contrary };

  for (const t of COMMERCIAL) if (!isDone(t)) missing.push(`${CONDITION_LABEL[t].toLowerCase()} not done`);
  if (!pilotOk) missing.push("pilot has no standard-pace date");
  if (!recent) missing.push("no customer engagement in the last 30 days");

  const base = isDone("executive_sponsor") && isDone("budget") && pilotOk && recent;
  const level: CommitmentLevel = base && isDone("vendor_selection") ? "committed" : base ? "engaged" : "unproven";
  return { level, missing, latestEngagement: engagement, openContrary: contrary };
}

export type { Group };

export interface Classification {
  eligibility: Eligibility;
  commitment: Commitment | null;
  group: Group;
  /** One line naming what held the deal back; empty for Signed and Firm. */
  reasons: string[];
}

export function classify(view: DealView, data: ForecastData, asOf: IsoDate, quarter: Quarter): Classification {
  const elig = eligibility(view, quarter);
  if (elig.kind === "signed") return { eligibility: elig, commitment: null, group: "signed", reasons: [] };
  if (elig.kind === "excluded") return { eligibility: elig, commitment: null, group: "excluded", reasons: [elig.reason] };

  const c = commitment(view, data, asOf);
  const r = view.timing.readiness;
  const reasons = [...c.missing];

  if (c.level === "committed") {
    if (view.timing.esd.fast === null) {
      const m = view.timing.missingFast;
      reasons.push(m ? `${CONDITION_LABEL[m.type].toLowerCase()} has no estimate (${m.reason.replace(/_/g, " ")})` : "timing unknown");
      return { eligibility: elig, commitment: c, group: "timing_unknown", reasons };
    }
    if (r === "slow") {
      const direct = (t: ConditionType) => view.states.find((s) => s.type === t)?.doneGrade === "direct";
      const waived = view.states.some((s) => s.state === "waived");
      if (direct("budget") && direct("vendor_selection") && !waived) return { eligibility: elig, commitment: c, group: "firm", reasons: [] };
      if (!direct("budget")) reasons.push("budget not confirmed in writing");
      if (!direct("vendor_selection")) reasons.push("no written award");
      if (waived) reasons.push("waiver in place");
      return { eligibility: elig, commitment: c, group: "core", reasons };
    }
    if (r === "standard") return { eligibility: elig, commitment: c, group: "core", reasons: [...reasons, "signs this quarter only at standard pace"] };
    if (r === "fast") return { eligibility: elig, commitment: c, group: "stretch", reasons: [...reasons, "signs this quarter only at fast pace"] };
    return { eligibility: elig, commitment: c, group: "late", reasons: [...reasons, "planned signature date is after quarter end"] };
  }
  if (c.level === "engaged" && (r === "slow" || r === "standard")) return { eligibility: elig, commitment: c, group: "stretch", reasons };
  if (c.level === "engaged") reasons.push(r === "fast" ? "signs this quarter only at fast pace" : "planned signature date is after quarter end");
  return { eligibility: elig, commitment: c, group: "uncommitted", reasons };
}

export interface ScenarioTotals {
  conservative: Cents;
  core: Cents;
  stretch: Cents;
}

export function scenarioTotals(lines: readonly { group: Group; tcv: Cents | null }[]): ScenarioTotals {
  const sum = (groups: Group[]) => sumCents(lines.filter((l) => groups.includes(l.group)).map((l) => l.tcv ?? (0 as Cents)));
  return {
    conservative: sum(["signed", "firm"]),
    core: sum(["signed", "firm", "core"]),
    stretch: sum(["signed", "firm", "core", "stretch"]),
  };
}
