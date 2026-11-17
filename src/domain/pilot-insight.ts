// What the pilot readings say, for display. The DR-02 rule decides the pilot (first reading on or after the
// evaluation date must meet every target); the trend here only explains where the readings are heading.

import { compareDates, daysBetween, type IsoDate } from "./dates";
import type { PilotPlan, PilotReading } from "./entities";

export interface ReadingCheck {
  reading: PilotReading;
  resolutionOk: boolean;
  sentimentOk: boolean;
  volumeOk: boolean;
  /** The reading DR-02 judges the pilot by. */
  decisive: boolean;
}

export interface PilotInsight {
  checks: ReadingCheck[];
  /** Least-squares resolution rate projected to the evaluation date; null with fewer than two readings. */
  projectedAtEvaluation: number | null;
  /** Percentage points per week. */
  weeklySlope: number | null;
  verdict: "passed" | "failed" | "on_track" | "at_risk" | "no_readings";
  /** Automatic: the deciding reading decides. Customer sign-off: the customer decides; readings are what they judge. */
  mode: PilotPlan["acceptanceMode"];
}

export function pilotInsight(plan: PilotPlan, readings: readonly PilotReading[], asOf: IsoDate): PilotInsight {
  const seen = readings
    .filter((r) => r.opportunityId === plan.opportunityId && compareDates(r.weekEnding, asOf) <= 0)
    .sort((a, b) => compareDates(a.weekEnding, b.weekEnding));
  const decisive = seen.find((r) => compareDates(r.weekEnding, plan.evaluationDate) >= 0) ?? null;
  const checks = seen.map((r) => ({
    reading: r,
    resolutionOk: r.resolutionRate >= plan.resolutionTarget,
    sentimentOk: r.sentiment >= plan.sentimentFloor,
    volumeOk: r.volume >= plan.weeklyVolumeFloor,
    decisive: r === decisive,
  }));

  const before = seen.filter((r) => compareDates(r.weekEnding, plan.evaluationDate) < 0);
  let projectedAtEvaluation: number | null = null;
  let weeklySlope: number | null = null;
  if (before.length >= 2) {
    const xs = before.map((r) => daysBetween(plan.evaluationDate, r.weekEnding));
    const ys = before.map((r) => r.resolutionRate);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = sxx === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / sxx;
    projectedAtEvaluation = Math.round((my - slope * mx) * 10) / 10;
    weeklySlope = Math.round(slope * 7 * 10) / 10;
  }

  const decisiveCheck = checks.find((c) => c.decisive);
  const verdict: PilotInsight["verdict"] = decisiveCheck
    ? decisiveCheck.resolutionOk && decisiveCheck.sentimentOk && decisiveCheck.volumeOk
      ? "passed"
      : "failed"
    : seen.length === 0
      ? "no_readings"
      : projectedAtEvaluation !== null && projectedAtEvaluation >= plan.resolutionTarget
        ? "on_track"
        : "at_risk";
  return { checks, projectedAtEvaluation, weeklySlope, verdict, mode: plan.acceptanceMode };
}
