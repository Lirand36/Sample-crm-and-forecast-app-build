"use client";

import {
  addDays,
  compareDates,
  daysBetween,
  formatDisplayDate,
  maxDate,
  type IsoDate,
} from "@/domain/dates";
import type { PilotPlan } from "@/domain/entities";
import type { PilotInsight } from "@/domain/pilot-insight";

const W = 640;
const H = 220;
const PAD = { l: 44, r: 92, t: 18, b: 30 };
const short = (x: IsoDate) => formatDisplayDate(x).replace(/, \d{4}$/, "");

export function pilotVerdictLabel(
  i: Pick<PilotInsight, "verdict" | "mode">,
): string {
  const signoff = i.mode === "customer_signoff";
  switch (i.verdict) {
    case "passed":
      return signoff ? "Met targets, awaiting sign-off" : "Passed";
    case "failed":
      return signoff ? "Below target, sign-off at risk" : "Missed targets";
    case "on_track":
      return "On track";
    case "at_risk":
      return "At risk";
    default:
      return "No readings yet";
  }
}

export function PilotChart({
  plan,
  insight,
  signoffBy,
}: {
  plan: PilotPlan;
  insight: PilotInsight;
  signoffBy: IsoDate | null;
}) {
  const signoff = plan.acceptanceMode === "customer_signoff";
  const { checks, projectedAtEvaluation: proj } = insight;
  if (checks.length === 0) {
    return (
      <p className="muted">
        No pilot readings yet. Evaluation on{" "}
        {formatDisplayDate(plan.evaluationDate)}.
      </p>
    );
  }
  const first = checks[0]!.reading.weekEnding;
  const last = checks[checks.length - 1]!.reading.weekEnding;
  const x0 = addDays(first, -3);
  const x1 = addDays(maxDate(plan.evaluationDate, last), 4);
  const values = [
    ...checks.map((c) => c.reading.resolutionRate),
    plan.resolutionTarget,
    ...(proj === null ? [] : [proj]),
  ];
  const y0 = Math.floor((Math.min(...values) - 4) / 5) * 5;
  const y1 = Math.ceil((Math.max(...values) + 3) / 5) * 5;
  const sx = (d: IsoDate) =>
    PAD.l + (daysBetween(x0, d) / daysBetween(x0, x1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) =>
    PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const pts = checks
    .map((c) => `${sx(c.reading.weekEnding)},${sy(c.reading.resolutionRate)}`)
    .join(" ");
  const decided = checks.some((c) => c.decisive);
  const lastBefore = [...checks]
    .reverse()
    .find((c) => compareDates(c.reading.weekEnding, plan.evaluationDate) < 0);
  const ticks: number[] = [];
  for (let v = y0; v <= y1; v += 5) ticks.push(v);
  const margin =
    proj === null ? null : Math.round((proj - plan.resolutionTarget) * 10) / 10;

  return (
    <div className="pilot" data-testid="pilot-chart">
      <div className="pilot-head">
        <div>
          <strong>Resolution rate, week by week</strong>
          <div className="muted small">
            Target {plan.resolutionTarget}% at the first reading on or after{" "}
            {formatDisplayDate(plan.evaluationDate)}.{" "}
            {signoff
              ? `The customer accepts the pilot by sign-off${signoffBy ? `, due by ${formatDisplayDate(signoffBy)}` : ""}; the readings are what they judge it on.`
              : "That one reading decides the pilot."}
          </div>
        </div>
        <span className={`pilot-verdict v-${insight.verdict}`}>
          {pilotVerdictLabel(insight)}
        </span>
      </div>
      <div className="pilot-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="pilot-svg"
          role="img"
          aria-label={`Pilot resolution rate against the ${plan.resolutionTarget}% target`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={sy(v)}
                y2={sy(v)}
                className="grid"
              />
              <text
                x={PAD.l - 8}
                y={sy(v) + 4}
                className="axis"
                textAnchor="end"
              >
                {v}%
              </text>
            </g>
          ))}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={sy(plan.resolutionTarget)}
            y2={sy(plan.resolutionTarget)}
            className="target"
          />
          <text
            x={W - PAD.r + 6}
            y={sy(plan.resolutionTarget) + 4}
            className="target-label"
          >
            Target {plan.resolutionTarget}%
          </text>
          <line
            x1={sx(plan.evaluationDate)}
            x2={sx(plan.evaluationDate)}
            y1={PAD.t - 6}
            y2={H - PAD.b}
            className="eval"
          />
          <text
            x={sx(plan.evaluationDate)}
            y={H - 10}
            className="axis strong"
            textAnchor="middle"
          >
            Evaluation {short(plan.evaluationDate)}
          </text>
          {!decided && proj !== null && lastBefore ? (
            <>
              <line
                x1={sx(lastBefore.reading.weekEnding)}
                y1={sy(lastBefore.reading.resolutionRate)}
                x2={sx(plan.evaluationDate)}
                y2={sy(proj)}
                className="trend"
              />
              <circle
                cx={sx(plan.evaluationDate)}
                cy={sy(proj)}
                r={4}
                className="trend-dot"
              />
              <text
                x={W - PAD.r + 6}
                y={sy(proj) + (proj >= plan.resolutionTarget ? -6 : 14)}
                className="trend-label"
              >
                Trend {proj}%
              </text>
            </>
          ) : null}
          <polyline points={pts} className="reading-line" />
          {checks.map((c) => (
            <g key={c.reading.id}>
              <circle
                cx={sx(c.reading.weekEnding)}
                cy={sy(c.reading.resolutionRate)}
                r={c.decisive ? 7 : 4.5}
                className={
                  c.decisive
                    ? c.resolutionOk && c.sentimentOk && c.volumeOk
                      ? "pt pass"
                      : "pt fail"
                    : "pt"
                }
              />
              <text
                x={sx(c.reading.weekEnding)}
                y={sy(c.reading.resolutionRate) - 11}
                className="pt-label"
                textAnchor="middle"
              >
                {c.reading.resolutionRate}%
              </text>
              {c.decisive ? null : (
                <text
                  x={sx(c.reading.weekEnding)}
                  y={H - 10}
                  className="axis"
                  textAnchor="middle"
                >
                  {short(c.reading.weekEnding)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="pilot-read small">
        {decided
          ? (() => {
              const c = checks.find((x) => x.decisive)!;
              const misses = [
                c.resolutionOk
                  ? null
                  : `resolution ${c.reading.resolutionRate}% against ${plan.resolutionTarget}%`,
                c.sentimentOk
                  ? null
                  : `sentiment ${c.reading.sentiment}% against ${plan.sentimentFloor}%`,
                c.volumeOk
                  ? null
                  : `volume ${c.reading.volume} against ${plan.weeklyVolumeFloor} a week`,
              ].filter(Boolean);
              if (signoff) {
                return misses.length
                  ? `The evaluation reading missed: ${misses.join(", ")}. The customer is unlikely to sign off on that.${
                      signoffBy
                        ? ` If no sign-off arrives by ${formatDisplayDate(signoffBy)}, the pilot counts as not accepted and the deal loses its signature date.`
                        : ""
                    }`
                  : "The evaluation reading met every target. The pilot is done once the customer signs off.";
              }
              return misses.length
                ? `The deciding reading missed: ${misses.join(", ")}. The pilot failed, so the deal has no signature date and drops out of Commit.`
                : "The deciding reading met every target. The pilot counts as done.";
            })()
          : proj !== null
            ? `Up ${insight.weeklySlope} points a week. On this trend the evaluation reading lands at ${proj}%, ${
                margin! >= 0
                  ? `${margin} points above`
                  : `${-margin!} points below`
              } the target. ${
                checks.every((c) => c.sentimentOk && c.volumeOk)
                  ? `Sentiment and volume clear their floors (${plan.sentimentFloor}%, ${plan.weeklyVolumeFloor} a week) every week.`
                  : `Sentiment or volume fell below its floor (${plan.sentimentFloor}%, ${plan.weeklyVolumeFloor} a week) at least once.`
              } The trend explains; only the evaluation reading decides.`
            : "One reading so far, too few for a trend."}
      </p>
    </div>
  );
}
