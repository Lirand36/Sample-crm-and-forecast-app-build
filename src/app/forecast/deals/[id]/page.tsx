"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { changeLink, waiveCondition } from "@/application/deal-config";
import { raiseDispute, withdrawDispute } from "@/application/disputes";
import { loadForecastWithData } from "@/application/forecast";
import { useStore } from "@/features/shell/StoreProvider";
import { forecastCategory, type ForecastLine } from "@/domain/forecast";
import type { DealEvent, Evidence, Opportunity, User } from "@/domain/entities";
import { reviewEvidence } from "@/application/evidence";
import {
  allowedActions,
  isReviewOverdue,
  refusalReason,
  type ReviewAction,
} from "@/domain/evidence-review";
import {
  evidenceStatus,
  gradeOf,
  type ConditionState,
  type EvidenceStatus,
} from "@/domain/condition-state";
import {
  compareDates,
  daysBetween,
  formatDisplayDate,
  maxDate,
  type IsoDate,
} from "@/domain/dates";
import { NEVER_WAIVED } from "@/domain/config-rules";
import {
  CONDITION_LABEL,
  type ConditionType,
  type LinkStrength,
} from "@/domain/entities";
import { formatAmount } from "@/domain/money";
import type { StepTiming } from "@/domain/timing";
import { useStoreQuery } from "@/features/crm/ui";
import {
  COMMITMENT_LABEL,
  GROUP_LABEL,
  READINESS_LABEL,
} from "@/features/shell/labels";
import { SignaturePath } from "@/features/forecast/SignaturePath";
import { DecisionTrail } from "@/features/forecast/DecisionTrail";
import { PilotChart, pilotVerdictLabel } from "@/features/forecast/PilotChart";
import { pilotInsight } from "@/domain/pilot-insight";

const COMMERCIAL: ConditionType[] = [
  "executive_sponsor",
  "budget",
  "vendor_selection",
];
const STATE_LABEL: Record<ConditionState["state"], string> = {
  done: "Done",
  waived: "Waived",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};
const GRADE_LABEL = {
  direct: "Direct",
  stated: "Stated",
  asserted: "Claimed by us",
} as const;
const STATUS_LABEL: Record<EvidenceStatus, string> = {
  waiting: "awaiting review",
  provisional: "applied, to confirm",
  approved: "approved",
  confirmed: "confirmed",
  rejected: "rejected",
  duplicate: "duplicate",
  unverifiable: "unverifiable",
};
const NO_ESTIMATE: Record<string, string> = {
  overdue: "overdue",
  blocked_no_end: "blocked, no end date",
  no_planning_standard: "no planning standard",
  pilot_overdue: "pilot not accepted",
  pilot_failed: "pilot missed targets",
};

const d = (x: IsoDate | null) => (x ? formatDisplayDate(x) : "—");

export default function ForecastDealPage() {
  const { id } = useParams<{ id: string }>();
  const [previewing, setPreviewing] = useState<ConditionType | null>(null);
  const result = useStoreQuery(
    async (s) => {
      const [{ forecast, data, preview }, users] = await Promise.all([
        loadForecastWithData(
          s,
          previewing ? { opportunityId: id, condition: previewing } : undefined,
        ),
        s.repos.users.list(),
      ]);
      return { forecast, data, users, preview };
    },
    [id, previewing],
  );
  if (!result) return <p>Loading…</p>;
  const { forecast: f, data, users, preview } = result;
  const line = f.lines.find((l) => l.view.opportunity.id === id);
  if (!line)
    return (
      <p>
        Deal not found. <Link href="/forecast">Back to Forecast</Link>
      </p>
    );

  const { view } = line;
  const o = view.opportunity;
  const qe = f.quarter.end;
  const evaluated = line.eligibility.kind === "evaluated";
  const owners = new Map(
    data.dealConditions
      .filter((c) => c.opportunityId === id)
      .map((c) => [c.type, c.owner]),
  );
  const events = new Map(data.events.map((e) => [e.id, e]));
  const evidenceFor = (t: ConditionType) =>
    data.evidence
      .filter(
        (e) =>
          e.opportunityId === id &&
          e.conditionType === t &&
          e.claim !== "status",
      )
      .map((e) => ({
        e,
        ev: events.get(e.eventId)!,
        status: evidenceStatus(e, data.evidenceDecisions),
      }))
      .filter((x) => x.ev && compareDates(x.ev.occurredAt, f.asOf) <= 0)
      .sort((a, b) => compareDates(a.ev.occurredAt, b.ev.occurredAt));
  const stateOf = (t: ConditionType) => view.states.find((s) => s.type === t)!;
  const stepOf = (t: ConditionType) =>
    view.timing.steps.find((s) => s.type === t)!;
  const plan = data.pilotPlans.find((p) => p.opportunityId === id) ?? null;
  const pilot = plan
    ? { plan, insight: pilotInsight(plan, data.pilotReadings, f.asOf) }
    : null;

  return (
    <section>
      <p className="crumbs">
        <Link href="/forecast">Forecast</Link> /
      </p>
      <div className="page-head">
        <div>
          <h1>{view.account?.name ?? o.name}</h1>
          <p className="muted subtitle">
            {o.name}, managed by {users.find((u) => u.id === o.managerId)?.name}
            . <Link href={`/crm/opportunities/${o.id}`}>Open in CRM</Link>
          </p>
        </div>
      </div>

      <div className="verdict">
        <div>
          <span className="number-label">TCV</span>
          <strong>{o.tcv === null ? "—" : formatAmount(o.tcv)}</strong>
        </div>
        <div>
          <span className="number-label">Group</span>
          <span className={`group-pill g-${line.group}`}>
            {GROUP_LABEL[line.group]}
          </span>
        </div>
        <div>
          <span className="number-label">Commitment</span>
          <strong>
            {line.commitment ? COMMITMENT_LABEL[line.commitment.level] : "—"}
          </strong>
        </div>
        <div>
          <span className="number-label">Timing</span>
          <strong>
            {evaluated ? READINESS_LABEL[view.timing.readiness] : "—"}
          </strong>
        </div>
        <div>
          <span className="number-label">Planned signature</span>
          <strong>
            {evaluated
              ? d(view.timing.esd.standard)
              : o.signedDate
                ? `Signed ${d(o.signedDate)}`
                : "—"}
          </strong>
          {evaluated ? (
            <span className="muted small">CRM says {d(o.closeDate)}</span>
          ) : null}
        </div>
      </div>
      <p className="verdict-reason">
        {line.reasons.length ? (
          <>Held back by {line.reasons.join("; ")}.</>
        ) : line.group === "firm" ? (
          "Counted. Committed in writing, and fits even if slow."
        ) : null}
      </p>

      <DecisionTrail line={line} />

      {evaluated ? (
        <>
          <h2>Signature Path</h2>
          <SignaturePath
            states={view.states}
            steps={view.timing.steps}
            asOf={f.asOf}
            quarterEnd={qe}
            signature={view.timing.esd.standard}
            flags={
              pilot && stateOf("pilot").state !== "done"
                ? {
                    pilot: {
                      text: pilotVerdictLabel(pilot.insight),
                      warn: ["failed", "at_risk"].includes(
                        pilot.insight.verdict,
                      ),
                    },
                  }
                : {}
            }
            detail={(t) => {
              const s = stateOf(t);
              const step = stepOf(t);
              const ev = evidenceFor(t);
              return (
                <>
                  <div className="sp-detail-head">
                    <strong>{CONDITION_LABEL[t]}</strong>
                    <span className="muted small">
                      {STATE_LABEL[s.state]}
                      {s.doneOn ? ` ${d(s.doneOn)}` : ""}
                      {owners.get(t) ? `. Owner: ${owners.get(t)}` : ""}
                      {["done", "waived"].includes(s.state)
                        ? ""
                        : `. Finishes ${(["fast", "standard", "slow"] as const)
                            .map((c) =>
                              step.finish[c]
                                ? d(step.finish[c])
                                : (NO_ESTIMATE[step.remaining[c] as string] ??
                                  "no estimate"),
                            )
                            .join(" / ")} (fast / standard / slow)`}
                    </span>
                  </div>
                  {t === "pilot" && pilot ? (
                    <PilotChart
                      plan={pilot.plan}
                      insight={pilot.insight}
                      signoffBy={stepOf("pilot").finish.slow}
                    />
                  ) : null}
                  {ev.length === 0 ? (
                    <p className="muted small">No evidence yet.</p>
                  ) : (
                    ev.map(({ e, ev: event, status }) => (
                      <div
                        key={e.id}
                        className={
                          status === "rejected" ||
                          status === "duplicate" ||
                          status === "unverifiable"
                            ? "ev struck"
                            : "ev"
                        }
                      >
                        <span className="small muted">
                          {d(event.occurredAt)},{" "}
                          {GRADE_LABEL[gradeOf(event)].toLowerCase()},{" "}
                          {STATUS_LABEL[status]}
                        </span>
                        <div className="quote">&ldquo;{e.quote}&rdquo;</div>
                      </div>
                    ))
                  )}
                </>
              );
            }}
          />
        </>
      ) : null}

      <PendingReview
        opp={o}
        asOf={f.asOf}
        items={data.evidence
          .filter((e) => e.opportunityId === id)
          .map((e) => ({
            e,
            ev: events.get(e.eventId)!,
            status: evidenceStatus(e, data.evidenceDecisions),
          }))
          .filter(
            (x) =>
              x.ev &&
              compareDates(x.ev.occurredAt, f.asOf) <= 0 &&
              (x.status === "waiting" || x.status === "provisional"),
          )}
      />

      {!evaluated ? null : (
        <>
          <h2>Commitment</h2>
          <p className="muted section-intro">
            Committed means sponsor, budget and vendor selection are done, the
            pilot is accepted or on track, and the customer replied in the last
            30 days.
            {line.commitment?.latestEngagement
              ? ` Last reply: ${d(line.commitment.latestEngagement)}.`
              : " No reply in 30 days."}
          </p>
          <table className="table compact">
            <tbody>
              {COMMERCIAL.filter((t) =>
                view.states.some((s) => s.type === t),
              ).map((t) => {
                const s = stateOf(t);
                return (
                  <tr key={t}>
                    <td>{CONDITION_LABEL[t]}</td>
                    <td>
                      {STATE_LABEL[s.state]}
                      {s.doneOn ? ` ${d(s.doneOn)}` : ""}
                    </td>
                    <td>{s.doneGrade ? GRADE_LABEL[s.doneGrade] : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {line.commitment?.openContrary.length ? (
            <p className="short">
              The customer contradicted:{" "}
              {line.commitment.openContrary
                .map((t) => CONDITION_LABEL[t].toLowerCase())
                .join(", ")}
              .
            </p>
          ) : null}

          <h2>Timing</h2>
          <div className="esd-row">
            {(["fast", "standard", "slow"] as const).map((c) => {
              const v = view.timing.esd[c];
              const fits = v !== null && compareDates(v, qe) <= 0;
              return (
                <div key={c} className={fits ? "esd fits" : "esd misses"}>
                  <span className="number-label">
                    {c === "standard"
                      ? "Standard pace"
                      : c === "fast"
                        ? "Fast pace"
                        : "Slow pace"}
                  </span>
                  <strong>{v ? d(v) : "No estimate"}</strong>
                  <span className="small">
                    {fits ? "in the quarter" : "after the quarter"}
                  </span>
                </div>
              );
            })}
          </div>
          <PathCalendar
            steps={view.timing.steps.filter(
              (s) => !["done", "waived"].includes(stateOf(s.type).state),
            )}
            asOf={f.asOf}
            qe={qe}
            links={view.links}
          />
        </>
      )}

      {evaluated && !["signed", "firm", "core"].includes(line.group) ? (
        <>
          <h2>Ways to pull it in</h2>
          {line.interventions.length === 0 ? (
            <p className="muted section-intro">
              {line.commitment?.level !== "committed"
                ? `None. The problem is commitment, not timing: ${line.commitment?.missing.join("; ") || "not committed"}.`
                : `None. No step can start early enough. Expected signature: ${d(view.timing.esd.standard)}.`}
            </p>
          ) : (
            line.interventions.map((i) => {
              const owner = owners.get(i.condition);
              const p = previewing === i.condition && preview ? preview : null;
              return (
                <div key={i.condition} className="intervention">
                  <div>
                    <strong>
                      Start {CONDITION_LABEL[i.condition].toLowerCase()} now
                    </strong>
                    , alongside{" "}
                    {i.lifted
                      .map((t) => CONDITION_LABEL[t].toLowerCase())
                      .join(" and ")}
                    . Ask {owner ? owner.toLowerCase() : "the customer"} to
                    begin by <strong>{d(i.startBy)}</strong>.
                  </div>
                  <div className="muted small">
                    Then: {GROUP_LABEL[i.result.group]}, signing{" "}
                    {d(i.timing.esd.standard)} ({d(i.timing.esd.fast)} to{" "}
                    {d(i.timing.esd.slow)}).
                  </div>
                  <div className="review-actions">
                    {previewing === i.condition ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setPreviewing(null)}
                      >
                        Close preview
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setPreviewing(i.condition)}
                      >
                        Preview
                      </button>
                    )}
                  </div>
                  {p ? (
                    <div className="preview-box" data-testid="preview">
                      Preview only, nothing saved. System forecast{" "}
                      {formatAmount(f.company.core)} →{" "}
                      <strong>{formatAmount(p.company.core)}</strong>
                      {f.company.target === null
                        ? ""
                        : ` against the ${formatAmount(f.company.target)} target`}
                      .
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </>
      ) : null}

      {evaluated ? <ManagerPosition line={line} qe={qe} users={users} /> : null}

      {evaluated ? <RevOpsChanges line={line} /> : null}

      <details className="steps-table">
        <summary>
          <h2>All steps and evidence, as a table</h2>
        </summary>
        <table className="table compact">
          <thead>
            <tr>
              <th>Step</th>
              <th>State</th>
              <th>Evidence</th>
              <th>Finish (fast / standard / slow)</th>
            </tr>
          </thead>
          <tbody>
            {view.states.map((s) => {
              const step = stepOf(s.type);
              const std = data.planningStandards.find(
                (p) => p.id === step.standardId,
              );
              return (
                <tr key={s.type}>
                  <td>
                    <strong>{CONDITION_LABEL[s.type]}</strong>
                    <div className="muted small">{owners.get(s.type)}</div>
                  </td>
                  <td className="small">
                    {STATE_LABEL[s.state]}
                    {s.doneOn ? ` ${d(s.doneOn)}` : ""}
                    {s.blockedNow ? (
                      <div className="short">until {d(s.blockedNow.end)}</div>
                    ) : null}
                    {s.waiverReason ? (
                      <div className="muted">{s.waiverReason}</div>
                    ) : null}
                  </td>
                  <td className="small">
                    {evidenceFor(s.type).map(({ e, ev, status }) => (
                      <div
                        key={e.id}
                        className={
                          status === "rejected" ||
                          status === "duplicate" ||
                          status === "unverifiable"
                            ? "ev struck"
                            : "ev"
                        }
                      >
                        {d(ev.occurredAt)} · {GRADE_LABEL[gradeOf(ev)]} ·{" "}
                        {STATUS_LABEL[status]}
                        <div className="quote">&ldquo;{e.quote}&rdquo;</div>
                      </div>
                    ))}
                    {evidenceFor(s.type).length === 0 ? (
                      <span className="muted">None</span>
                    ) : null}
                  </td>
                  <td className="small nowrap">
                    {["done", "waived"].includes(s.state) ? (
                      "—"
                    ) : (
                      <>
                        {(["fast", "standard", "slow"] as const)
                          .map((c) =>
                            step.finish[c]
                              ? d(step.finish[c])
                              : (NO_ESTIMATE[step.remaining[c] as string] ??
                                "—"),
                          )
                          .join(" / ")}
                        {std ? (
                          <div className="muted">
                            Standard {std.fastDays} / {std.standardDays} /{" "}
                            {std.slowDays} days
                            {std.segment ? `, ${std.segment}` : ""}
                          </div>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function PathCalendar({
  steps,
  asOf,
  qe,
  links,
}: {
  steps: StepTiming[];
  asOf: IsoDate;
  qe: IsoDate;
  links: { from: ConditionType; to: ConditionType; strength: string }[];
}) {
  if (steps.length === 0) return <p className="muted">Every step is done.</p>;
  let end = qe;
  for (const s of steps)
    for (const c of ["fast", "standard", "slow"] as const)
      if (s.finish[c]) end = maxDate(end, s.finish[c]!);
  const span = Math.max(daysBetween(asOf, end) + 3, 1);
  const pct = (x: IsoDate) => `${(daysBetween(asOf, x) / span) * 100}%`;
  return (
    <div className="calendar">
      <div className="cal-head">
        <span>{formatDisplayDate(asOf)}</span>
        <span>{formatDisplayDate(end)}</span>
      </div>
      {steps.map((s) => {
        const start = s.start.standard;
        const std = s.finish.standard;
        const slow = s.finish.slow;
        const waits = links.filter(
          (l) => l.to === s.type && steps.some((x) => x.type === l.from),
        );
        return (
          <div key={s.type} className="cal-row">
            <div className="cal-label">
              {CONDITION_LABEL[s.type]}
              {waits.length ? (
                <div className="muted small">
                  after{" "}
                  {waits
                    .map(
                      (l) =>
                        `${CONDITION_LABEL[l.from].toLowerCase()}${l.strength === "soft" ? " (can overlap)" : ""}`,
                    )
                    .join(", ")}
                </div>
              ) : null}
            </div>
            <div className="cal-track">
              {start && slow ? (
                <span
                  className="cal-slow"
                  style={{
                    left: pct(start),
                    width: `calc(${pct(slow)} - ${pct(start)})`,
                  }}
                />
              ) : null}
              {start && std ? (
                <span
                  className="cal-std"
                  style={{
                    left: pct(start),
                    width: `calc(${pct(std)} - ${pct(start)})`,
                  }}
                />
              ) : null}
              {!std ? <span className="cal-none">no estimate</span> : null}
              <span
                className="cal-qe"
                style={{ left: pct(qe) }}
                title="Quarter end"
              />
            </div>
          </div>
        );
      })}
      <div className="cal-legend muted small">
        Dark: standard pace. Light: extends to slow pace. Vertical line: quarter
        end ({formatDisplayDate(qe)}).
      </div>
    </div>
  );
}

function ManagerPosition({
  line,
  qe,
  users,
}: {
  line: ForecastLine;
  qe: IsoDate;
  users: readonly User[];
}) {
  const { store, actingUser, refresh } = useStore();
  const o = line.view.opportunity;
  const isManager =
    actingUser.role === "sales_manager" && actingUser.id === o.managerId;
  const counted = ["firm", "core"].includes(line.group);
  const open = line.view.states.filter(
    (s) => s.state !== "done" && s.state !== "waived",
  );
  const [reason, setReason] = useState("");
  const [cond, setCond] = useState<ConditionType | "">(open[0]?.type ?? "");
  const [by, setBy] = useState<string>(qe);
  const [error, setError] = useState<string | null>(null);
  const d0 = line.dispute;
  const managerName =
    users.find((u) => u.id === (d0?.dispute.managerId ?? o.managerId))?.name ??
    "The manager";

  return (
    <>
      <h2>Forecast category</h2>
      <p className="category-line" data-testid="category">
        Manager: <strong className="manager">{forecastCategory(line)}</strong>
        <span className="muted"> · </span>System:{" "}
        <strong>{GROUP_LABEL[line.group]}</strong>
      </p>
      {d0 ? (
        <div
          className={`dispute ${d0.status.live ? "" : "stale"}`}
          data-testid="dispute"
        >
          <strong>
            {managerName} moved it{" "}
            {d0.dispute.direction === "in" ? "into" : "out of"} Commit
          </strong>
          {d0.status.live
            ? ". Counted in Managers' Commit."
            : `. No longer counted: ${d0.status.reason}.`}
          <div>&ldquo;{d0.dispute.reason}&rdquo;</div>
          {d0.dispute.bets.length ? (
            <div className="muted small">
              Bet:{" "}
              {d0.dispute.bets
                .map(
                  (b) =>
                    `${CONDITION_LABEL[b.conditionType].toLowerCase()} done by ${formatDisplayDate(b.by)}`,
                )
                .join("; ")}
            </div>
          ) : null}
          {isManager ? (
            <button
              type="button"
              className="link-button"
              onClick={async () => {
                const r = await withdrawDispute(store, d0.dispute.id);
                if (r.ok)
                  await refresh(
                    `${managerName} undid the move on ${o.name.split(" — ")[0]}`,
                  );
                else setError(Object.values(r.errors)[0] ?? "Refused.");
              }}
            >
              Undo this move
            </button>
          ) : null}
        </div>
      ) : isManager ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await raiseDispute(store, {
              opportunityId: o.id,
              direction: counted ? "out" : "in",
              reason,
              bets:
                !counted && cond
                  ? [{ conditionType: cond, by: by as IsoDate }]
                  : [],
              outCondition: counted && cond ? cond : null,
            });
            if (r.ok) {
              setError(null);
              await refresh(
                `${managerName} moved ${o.name.split(" — ")[0]} ${counted ? "out of" : "into"} Commit`,
              );
            } else setError(Object.values(r.errors)[0] ?? "Refused.");
          }}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            {counted
              ? "Think it won't sign this quarter? Moving it out of Commit lowers Managers' Commit. The system forecast doesn't change."
              : "Think it will sign this quarter? Name the step you'll get done and by when. It's accepted only if that makes the deal count, then checked against what happens."}
          </p>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">
                {counted ? "Step you expect to miss" : "Step you bet on"}
              </span>
              <select
                value={cond}
                onChange={(e) => setCond(e.target.value as ConditionType | "")}
              >
                {open.map((s) => (
                  <option key={s.type} value={s.type}>
                    {CONDITION_LABEL[s.type]}
                  </option>
                ))}
              </select>
            </label>
            {!counted ? (
              <label className="field">
                <span className="field-label">Done by</span>
                <input
                  type="date"
                  value={by}
                  max={qe}
                  onChange={(e) => setBy(e.target.value)}
                />
              </label>
            ) : null}
            <label className="field">
              <span className="field-label">Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {counted ? "Move out of Commit" : "Move to Commit"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">
          The manager follows the system here. Only the deal&apos;s Sales
          Manager can change it.
        </p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

function RevOpsChanges({ line }: { line: ForecastLine }) {
  const { store, actingUser, refresh } = useStore();
  const o = line.view.opportunity;
  const isRevOps = actingUser.role === "revops";
  const waivable = line.view.states.filter(
    (s) =>
      s.state !== "done" &&
      s.state !== "waived" &&
      !NEVER_WAIVED.includes(s.type),
  );
  const types = line.view.states.map((s) => s.type);
  const [mode, setMode] = useState<"waive" | "link">("waive");
  const [cond, setCond] = useState<ConditionType | "">(waivable[0]?.type ?? "");
  const [from, setFrom] = useState<ConditionType>(
    types[0] ?? "executive_sponsor",
  );
  const [to, setTo] = useState<ConditionType>(
    types[types.length - 1] ?? "procurement_legal",
  );
  const [strength, setStrength] = useState<LinkStrength | "removed">("soft");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const waived = line.view.states.filter((s) => s.state === "waived");
  const current = line.view.links.find((l) => l.from === from && l.to === to);

  if (!isRevOps && !waived.length) return null;
  return (
    <>
      <h2>Waivers and links</h2>
      {waived.length ? (
        <ul className="small">
          {waived.map((s) => (
            <li key={s.type}>
              <strong>{CONDITION_LABEL[s.type]}</strong> waived: &ldquo;
              {s.waiverReason}&rdquo;. A waived deal is never Firm.
            </li>
          ))}
        </ul>
      ) : null}
      {isRevOps ? (
        <form
          className="form"
          data-testid="revops-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const r =
              mode === "waive"
                ? cond
                  ? await waiveCondition(store, o.id, cond, reason)
                  : {
                      ok: false as const,
                      errors: { form: "No step can be waived on this deal." },
                    }
                : await changeLink(store, o.id, from, to, strength, reason);
            if (!r.ok)
              return setMessage(Object.values(r.errors)[0] ?? "Refused.");
            setMessage(
              mode === "waive"
                ? "Step waived and logged."
                : "Link changed and logged.",
            );
            setReason("");
            await refresh(
              mode === "waive"
                ? "RevOps waived a step"
                : "RevOps changed a link",
            );
          }}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            RevOps only. Budget and vendor selection can&apos;t be waived. Link
            changes apply to this deal only.
          </p>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Change</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "waive" | "link")}
                aria-label="Change"
              >
                <option value="waive">Waive a step</option>
                <option value="link">Change a link</option>
              </select>
            </label>
            {mode === "waive" ? (
              <label className="field">
                <span className="field-label">Step</span>
                <select
                  value={cond}
                  onChange={(e) => setCond(e.target.value as ConditionType)}
                  aria-label="Step to waive"
                >
                  {waivable.map((s) => (
                    <option key={s.type} value={s.type}>
                      {CONDITION_LABEL[s.type]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="field">
                  <span className="field-label">Earlier step</span>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value as ConditionType)}
                    aria-label="Earlier step"
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {CONDITION_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Step that waits</span>
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value as ConditionType)}
                    aria-label="Step that waits"
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {CONDITION_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">
                    Link (now: {current ? current.strength : "none"})
                  </span>
                  <select
                    value={strength}
                    onChange={(e) =>
                      setStrength(e.target.value as LinkStrength | "removed")
                    }
                    aria-label="Link"
                  >
                    <option value="hard">Hard: must finish first</option>
                    <option value="soft">Soft: can overlap</option>
                    <option value="removed">Remove</option>
                  </select>
                </label>
              </>
            )}
            <label className="field">
              <span className="field-label">Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Change reason"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {mode === "waive" ? "Waive step" : "Change link"}
            </button>
          </div>
          {message ? (
            <p className="small" data-testid="revops-result">
              {message}
            </p>
          ) : null}
        </form>
      ) : null}
    </>
  );
}

/**
 * New claims on this deal that wait for a person, with Approve and Discard in place (as in WCP). Good news counts
 * only once approved; bad news already counts and is confirmed or discarded. Same rights as Evidence review (DR-04).
 */
function PendingReview({
  opp,
  asOf,
  items,
}: {
  opp: Opportunity;
  asOf: IsoDate;
  items: { e: Evidence; ev: DealEvent; status: EvidenceStatus }[];
}) {
  const { store, actingUser, refresh } = useStore();
  if (items.length === 0) return null;
  return (
    <div className="pending" data-testid="pending-review">
      <h2>Waiting for review</h2>
      {items.map((x) => (
        <PendingItem
          key={x.e.id}
          {...x}
          overdue={isReviewOverdue(x.status, x.ev, asOf)}
          actions={allowedActions(actingUser, opp, x.e, x.status)}
          refusal={refusalReason(actingUser, opp, x.e, x.status)}
          onAct={async (a, reason) => {
            const r = await reviewEvidence(store, x.e.id, a, reason);
            if (r.ok)
              await refresh(
                `${a === "reject" ? "Discarded" : a === "approve" ? "Approved" : "Confirmed"}: ${x.e.summary}`,
              );
            return r.ok ? null : (Object.values(r.errors)[0] ?? "Refused.");
          }}
        />
      ))}
    </div>
  );
}

function PendingItem(props: {
  e: Evidence;
  ev: DealEvent;
  status: EvidenceStatus;
  overdue: boolean;
  actions: ReviewAction[];
  refusal: string;
  onAct: (a: ReviewAction, reason: string) => Promise<string | null>;
}) {
  const { e, ev, status } = props;
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keep = props.actions.find((a) => a !== "reject");
  return (
    <div className="pending-item">
      <div>
        <strong>{e.summary}</strong>
        <span className="muted small">
          {" "}
          · {CONDITION_LABEL[e.conditionType]} ·{" "}
          {formatDisplayDate(ev.occurredAt)}, {ev.sender ?? "unknown sender"}
        </span>
        {props.overdue ? <span className="badge overdue">Overdue</span> : null}
      </div>
      <div className="quote">&ldquo;{e.quote}&rdquo;</div>
      <div className="muted small">
        {status === "waiting"
          ? "Good news: counts once approved."
          : "Bad news: already counts. Confirm it, or discard it with a reason."}
      </div>
      {props.actions.length ? (
        <div className="review-actions">
          {keep ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => setError(await props.onAct(keep, ""))}
            >
              {keep === "approve" ? "Approve" : "Confirm"}
            </button>
          ) : null}
          {props.actions.includes("reject") ? (
            discarding ? (
              <>
                <input
                  placeholder="Why discard?"
                  value={reason}
                  onChange={(x) => setReason(x.target.value)}
                  aria-label="Reason to discard"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={async () =>
                    setError(await props.onAct("reject", reason))
                  }
                >
                  Discard
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => setDiscarding(true)}
              >
                Discard
              </button>
            )
          ) : null}
        </div>
      ) : (
        <div className="muted small">{props.refusal}</div>
      )}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
