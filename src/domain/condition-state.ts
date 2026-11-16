// Condition state replay (PRD §4C, Integrity Review §6 items 3 to 5, DR-02, DR-05, G-1).
// State is never stored: it is replayed from accepted Direct and Stated Evidence as of a date.

import { compareDates, type IsoDate } from "./dates";
import {
  ADVANCING_CLAIMS,
  REVERSING_CLAIMS,
  type ConditionType,
  type ConditionWaiver,
  type DealEvent,
  type Evidence,
  type EvidenceDecision,
  type PilotPlan,
  type PilotReading,
  type SourceType,
} from "./entities";

export type Grade = "direct" | "stated" | "asserted";

const DIRECT_SOURCES: readonly SourceType[] = [
  "signed_document",
  "approval_record",
  "purchase_order",
  "award_letter",
  "letter_of_intent",
  "term_sheet",
  "acceptance_certificate",
  "pilot_reading",
];

/** DR-05: grade follows from origin and source type, never typed. */
export function gradeOf(event: Pick<DealEvent, "origin" | "sourceType">): Grade {
  if (event.origin === "internal") return "asserted";
  return DIRECT_SOURCES.includes(event.sourceType) ? "direct" : "stated";
}

export type EvidenceStatus = "waiting" | "provisional" | "approved" | "confirmed" | "rejected" | "duplicate" | "unverifiable";

/** The latest decision sets the status (DR-18). Without one: advancing waits, reversing is provisional. */
export function evidenceStatus(evidence: Evidence, decisions: readonly EvidenceDecision[]): EvidenceStatus {
  let latest: EvidenceDecision | undefined;
  for (const d of decisions) if (d.evidenceId === evidence.id && (!latest || d.seq > latest.seq)) latest = d;
  if (latest) return latest.decision;
  return REVERSING_CLAIMS.includes(evidence.claim) ? "provisional" : "waiting";
}

/** Unreviewed good news never counts; unreviewed bad news always does (PRD §4B.3). */
export function isAccepted(evidence: Evidence, status: EvidenceStatus): boolean {
  if (REVERSING_CLAIMS.includes(evidence.claim)) return status === "provisional" || status === "confirmed";
  return status === "approved";
}

export type ConditionStateKind = "not_started" | "in_progress" | "blocked" | "done" | "waived";

export interface BlockedInterval {
  start: IsoDate;
  end: IsoDate | null; // null: no stated end
}

export interface ConditionState {
  type: ConditionType;
  state: ConditionStateKind;
  /** Done date (Event date of the closing Evidence, or the qualifying reading's week). */
  doneOn: IsoDate | null;
  doneGrade: Grade | null;
  /** Merged, half-open [start, end). */
  blocked: BlockedInterval[];
  /** The interval containing the as-of date, if any. */
  blockedNow: BlockedInterval | null;
  waiverReason: string | null;
  /** First applied Evidence date of the current span (a reopen starts a new span). */
  spanStart: IsoDate | null;
  /** Latest applied started or progress Evidence date in the current span. */
  latestProgress: IsoDate | null;
  /** Evidence ids applied to state, in replay order. */
  applied: string[];
  /** DR-02 automatic pilot: the first reading on or after the evaluation date missed a target. */
  pilotFailed?: boolean;
}

export interface ConditionStateInput {
  type: ConditionType;
  evidence: readonly Evidence[];
  decisions: readonly EvidenceDecision[];
  events: ReadonlyMap<string, DealEvent>;
  waivers: readonly ConditionWaiver[];
  pilotPlan?: PilotPlan | null;
  pilotReadings?: readonly PilotReading[];
}

function mergeIntervals(intervals: BlockedInterval[]): BlockedInterval[] {
  const sorted = [...intervals].sort((a, b) => compareDates(a.start, b.start));
  const out: BlockedInterval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && (last.end === null || compareDates(iv.start, last.end) <= 0)) {
      if (last.end !== null && (iv.end === null || compareDates(iv.end, last.end) > 0)) last.end = iv.end;
    } else out.push({ ...iv });
  }
  return out;
}

function inside(asOf: IsoDate, iv: BlockedInterval): boolean {
  return compareDates(asOf, iv.start) >= 0 && (iv.end === null || compareDates(asOf, iv.end) < 0);
}

function meetsPilotTargets(plan: PilotPlan, r: PilotReading): boolean {
  return r.resolutionRate >= plan.resolutionTarget && r.sentiment >= plan.sentimentFloor && r.volume >= plan.weeklyVolumeFloor;
}

export function conditionState(input: ConditionStateInput, asOf: IsoDate): ConditionState {
  const base: ConditionState = {
    type: input.type,
    state: "not_started",
    doneOn: null,
    doneGrade: null,
    blocked: [],
    blockedNow: null,
    waiverReason: null,
    spanStart: null,
    latestProgress: null,
    applied: [],
  };

  const waiver = input.waivers
    .filter((w) => w.conditionType === input.type && compareDates(w.at, asOf) <= 0)
    .sort((a, b) => b.seq - a.seq)[0];
  if (waiver) return { ...base, state: "waived", waiverReason: waiver.reason };

  // Accepted Direct and Stated Evidence on this Condition, dated on or before the as-of date.
  const effective = input.evidence
    .filter((e) => e.conditionType === input.type)
    .map((e) => ({ e, ev: input.events.get(e.eventId) }))
    .filter((x): x is { e: Evidence; ev: DealEvent } => !!x.ev && compareDates(x.ev.occurredAt, asOf) <= 0)
    .filter(({ ev }) => gradeOf(ev) !== "asserted")
    .filter(({ e }) => isAccepted(e, evidenceStatus(e, input.decisions)))
    // Event-date order; on the same date reversing claims replay last, so they win (PRD §4C.3).
    .sort(
      (a, b) =>
        compareDates(a.ev.occurredAt, b.ev.occurredAt) ||
        Number(REVERSING_CLAIMS.includes(a.e.claim)) - Number(REVERSING_CLAIMS.includes(b.e.claim)) ||
        a.ev.seq - b.ev.seq,
    );

  let state: ConditionStateKind = "not_started";
  let doneOn: IsoDate | null = null;
  let doneGrade: Grade | null = null;
  const intervals: BlockedInterval[] = [];
  const applied: string[] = [];
  let spanStart: IsoDate | null = null;
  let latestProgress: IsoDate | null = null;

  for (const { e, ev } of effective) {
    if (e.claim !== "reopened" && e.claim !== "contrary" && e.claim !== "status" && e.claim !== "intent" && spanStart === null) {
      spanStart = ev.occurredAt;
    }
    if (e.claim === "started" || e.claim === "progress") latestProgress = ev.occurredAt;
    if (ADVANCING_CLAIMS.includes(e.claim)) {
      if (e.claim === "done" || (e.claim === "selected" && input.type === "vendor_selection")) {
        state = "done";
        doneOn = ev.occurredAt;
        doneGrade = gradeOf(ev);
      } else if (state !== "done") state = "in_progress";
      applied.push(e.id);
    } else if (e.claim === "blocked") {
      // A block keeps the progress credited so far (PRD §4E: "as In progress, counted from the end of
      // the blocked interval"), and a block reported after Done reopens the step to In progress.
      intervals.push({ start: e.blockStart ?? ev.occurredAt, end: e.blockEnd });
      if (state === "done") {
        state = "in_progress";
        doneOn = null;
        doneGrade = null;
      }
      applied.push(e.id);
    } else if (e.claim === "reopened") {
      state = "not_started";
      doneOn = null;
      doneGrade = null;
      spanStart = null;
      latestProgress = null;
      applied.push(e.id);
    }
    // contrary opens a deal-level signal; status and intent change no state.
  }

  let pilotFailed = false;
  // DR-02 automatic acceptance: first reading on or after the evaluation date that meets all targets.
  const plan = input.type === "pilot" ? (input.pilotPlan ?? null) : null;
  if (plan && plan.acceptanceMode === "automatic" && state !== "done") {
    const first = (input.pilotReadings ?? [])
      .filter((r) => compareDates(r.weekEnding, plan.evaluationDate) >= 0 && compareDates(r.weekEnding, asOf) <= 0)
      .sort((a, b) => compareDates(a.weekEnding, b.weekEnding))[0];
    if (first && meetsPilotTargets(plan, first)) {
      state = "done";
      doneOn = first.weekEnding;
      doneGrade = "direct";
    } else if (first) pilotFailed = true;
  }

  // A pilot with a plan and readings is running. This is display state only: DR-02 times the pilot by its
  // evaluation date, and readings before that date change nothing.
  if (plan && state === "not_started" && (input.pilotReadings ?? []).some((r) => compareDates(r.weekEnding, asOf) <= 0)) {
    state = "in_progress";
  }

  const blocked = mergeIntervals(intervals);
  const blockedNow = blocked.find((iv) => inside(asOf, iv)) ?? null;
  if (state !== "done" && blockedNow) state = "blocked";

  return { ...base, state, doneOn, doneGrade, blocked, blockedNow, spanStart, latestProgress, applied, ...(pilotFailed ? { pilotFailed } : {}) };
}
