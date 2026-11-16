"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { loadForecastWithData } from "@/application/forecast";
import { evidenceStatus, gradeOf, type ConditionState, type EvidenceStatus } from "@/domain/condition-state";
import { compareDates, daysBetween, formatDisplayDate, maxDate, type IsoDate } from "@/domain/dates";
import { CONDITION_LABEL, type ConditionType } from "@/domain/entities";
import { formatMillions, formatUsd } from "@/domain/money";
import type { StepTiming } from "@/domain/timing";
import { useStoreQuery } from "@/features/crm/ui";
import { COMMITMENT_LABEL, GROUP_LABEL, READINESS_LABEL } from "@/features/shell/labels";

const COMMERCIAL: ConditionType[] = ["executive_sponsor", "budget", "vendor_selection"];
const STATE_LABEL: Record<ConditionState["state"], string> = {
  done: "Done",
  waived: "Waived",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};
const GRADE_LABEL = { direct: "Direct", stated: "Stated", asserted: "Claimed by us" } as const;
const STATUS_LABEL: Record<EvidenceStatus, string> = {
  waiting: "waiting for approval",
  provisional: "applied, awaiting confirmation",
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
  const result = useStoreQuery(async (s) => {
    const [{ forecast, data, preview }, users] = await Promise.all([
      loadForecastWithData(s, previewing ? { opportunityId: id, condition: previewing } : undefined),
      s.repos.users.list(),
    ]);
    return { forecast, data, users, preview };
  }, [id, previewing]);
  if (!result) return <p>Loading…</p>;
  const { forecast: f, data, users, preview } = result;
  const line = f.lines.find((l) => l.view.opportunity.id === id);
  if (!line) return <p>Deal not found. <Link href="/forecast">Back to Forecast</Link></p>;

  const { view } = line;
  const o = view.opportunity;
  const qe = f.quarter.end;
  const evaluated = line.eligibility.kind === "evaluated";
  const owners = new Map(data.dealConditions.filter((c) => c.opportunityId === id).map((c) => [c.type, c.owner]));
  const events = new Map(data.events.map((e) => [e.id, e]));
  const evidenceFor = (t: ConditionType) =>
    data.evidence
      .filter((e) => e.opportunityId === id && e.conditionType === t && e.claim !== "status")
      .map((e) => ({ e, ev: events.get(e.eventId)!, status: evidenceStatus(e, data.evidenceDecisions) }))
      .filter((x) => x.ev && compareDates(x.ev.occurredAt, f.asOf) <= 0)
      .sort((a, b) => compareDates(a.ev.occurredAt, b.ev.occurredAt));
  const stateOf = (t: ConditionType) => view.states.find((s) => s.type === t)!;
  const stepOf = (t: ConditionType) => view.timing.steps.find((s) => s.type === t)!;

  return (
    <section>
      <p className="crumbs">
        <Link href="/forecast">Forecast</Link> /
      </p>
      <div className="page-head">
        <div>
          <h1>{view.account?.name ?? o.name}</h1>
          <p className="muted subtitle">
            {o.name} · {users.find((u) => u.id === o.managerId)?.name} · <Link href={`/crm/opportunities/${o.id}`}>Open in CRM</Link>
          </p>
        </div>
      </div>

      <div className="verdict">
        <div><span className="number-label">TCV</span><strong>{o.tcv === null ? "—" : formatMillions(o.tcv)}</strong></div>
        <div><span className="number-label">Group</span><span className={`group-pill g-${line.group}`}>{GROUP_LABEL[line.group]}</span></div>
        <div><span className="number-label">Commitment</span><strong>{line.commitment ? COMMITMENT_LABEL[line.commitment.level] : "—"}</strong></div>
        <div><span className="number-label">Timing</span><strong>{evaluated ? READINESS_LABEL[view.timing.readiness] : "—"}</strong></div>
        <div>
          <span className="number-label">Planned signature</span>
          <strong>{evaluated ? d(view.timing.esd.standard) : o.signedDate ? `Signed ${d(o.signedDate)}` : "—"}</strong>
          {evaluated ? <span className="muted small">CRM close date {d(o.closeDate)}</span> : null}
        </div>
      </div>
      <p className="verdict-reason">
        {line.reasons.length ? <>Held back by: {line.reasons.join("; ")}.</> : line.group === "firm" ? "Counted: committed, in writing, and fits even at slow pace." : null}
      </p>

      {!evaluated ? null : (
        <>
          <h2>Commitment</h2>
          <p className="muted section-intro">
            Has the customer decided? Sponsor, budget and vendor selection must be done, the pilot accepted or on track, and the customer
            heard from in the last 30 days.
            {line.commitment?.latestEngagement ? ` Last heard from the customer ${d(line.commitment.latestEngagement)}.` : " No recent customer engagement."}
          </p>
          <table className="table compact">
            <tbody>
              {COMMERCIAL.filter((t) => view.states.some((s) => s.type === t)).map((t) => {
                const s = stateOf(t);
                return (
                  <tr key={t}>
                    <td>{CONDITION_LABEL[t]}</td>
                    <td>{STATE_LABEL[s.state]}{s.doneOn ? ` ${d(s.doneOn)}` : ""}</td>
                    <td>{s.doneGrade ? GRADE_LABEL[s.doneGrade] : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {line.commitment?.openContrary.length ? (
            <p className="short">Open contrary signal on {line.commitment.openContrary.map((t) => CONDITION_LABEL[t].toLowerCase()).join(", ")}.</p>
          ) : null}

          <h2>Timing</h2>
          <div className="esd-row">
            {(["fast", "standard", "slow"] as const).map((c) => {
              const v = view.timing.esd[c];
              const fits = v !== null && compareDates(v, qe) <= 0;
              return (
                <div key={c} className={fits ? "esd fits" : "esd misses"}>
                  <span className="number-label">{c === "standard" ? "Standard pace" : c === "fast" ? "Fast pace" : "Slow pace"}</span>
                  <strong>{v ? d(v) : "No estimate"}</strong>
                  <span className="small">{fits ? "inside the quarter" : "after quarter end"}</span>
                </div>
              );
            })}
          </div>
          <PathCalendar steps={view.timing.steps.filter((s) => !["done", "waived"].includes(stateOf(s.type).state))} asOf={f.asOf} qe={qe} links={view.links} />
        </>
      )}

      {evaluated && !["signed", "firm", "core"].includes(line.group) ? (
        <>
          <h2>Forecast Interventions</h2>
          {line.interventions.length === 0 ? (
            <p className="muted section-intro">
              {line.commitment?.level !== "committed"
                ? `No intervention: this deal's problem is commitment (${line.commitment?.missing.join("; ") || "not committed"}), not timing.`
                : `No step can be started in parallel to bring this deal into the quarter. Planned signature at standard pace: ${d(view.timing.esd.standard)}.`}
            </p>
          ) : (
            line.interventions.map((i) => {
              const owner = owners.get(i.condition);
              const p = previewing === i.condition && preview ? preview : null;
              return (
                <div key={i.condition} className="intervention">
                  <div>
                    <strong>Start {CONDITION_LABEL[i.condition].toLowerCase()} now</strong>, in parallel with{" "}
                    {i.lifted.map((t) => CONDITION_LABEL[t].toLowerCase()).join(" and ")}. Ask {owner ? owner.toLowerCase() : "the customer"} to begin by{" "}
                    <strong>{d(i.startBy)}</strong>.
                  </div>
                  <div className="muted small">
                    Result: {GROUP_LABEL[i.result.group]}, planned signature {d(i.timing.esd.fast)} / {d(i.timing.esd.standard)} / {d(i.timing.esd.slow)}.
                  </div>
                  <div className="review-actions">
                    {previewing === i.condition ? (
                      <button type="button" className="btn" onClick={() => setPreviewing(null)}>Close preview</button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => setPreviewing(i.condition)}>Preview</button>
                    )}
                  </div>
                  {p ? (
                    <div className="preview-box" data-testid="preview">
                      Preview, nothing saved. System forecast {formatMillions(f.company.core)} → <strong>{formatMillions(p.company.core)}</strong> (Conservative{" "}
                      {formatMillions(p.company.conservative)}, Stretch {formatMillions(p.company.stretch)}), target {f.company.target === null ? "—" : formatMillions(f.company.target)}.
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </>
      ) : null}

      <h2>Steps and evidence</h2>
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
            const std = data.planningStandards.find((p) => p.id === step.standardId);
            return (
              <tr key={s.type}>
                <td>
                  <strong>{CONDITION_LABEL[s.type]}</strong>
                  <div className="muted small">{owners.get(s.type)}</div>
                </td>
                <td className="small">
                  {STATE_LABEL[s.state]}
                  {s.doneOn ? ` ${d(s.doneOn)}` : ""}
                  {s.blockedNow ? <div className="short">until {d(s.blockedNow.end)}</div> : null}
                  {s.waiverReason ? <div className="muted">{s.waiverReason}</div> : null}
                </td>
                <td className="small">
                  {evidenceFor(s.type).map(({ e, ev, status }) => (
                    <div key={e.id} className={status === "rejected" || status === "duplicate" || status === "unverifiable" ? "ev struck" : "ev"}>
                      {d(ev.occurredAt)} · {GRADE_LABEL[gradeOf(ev)]} · {STATUS_LABEL[status]}
                      <div className="quote">&ldquo;{e.quote}&rdquo;</div>
                    </div>
                  ))}
                  {evidenceFor(s.type).length === 0 ? <span className="muted">None</span> : null}
                </td>
                <td className="small nowrap">
                  {["done", "waived"].includes(s.state) ? (
                    "—"
                  ) : (
                    <>
                      {(["fast", "standard", "slow"] as const)
                        .map((c) => (step.finish[c] ? d(step.finish[c]) : NO_ESTIMATE[step.remaining[c] as string] ?? "—"))
                        .join(" / ")}
                      {std ? (
                        <div className="muted">
                          Standard {std.fastDays} / {std.standardDays} / {std.slowDays} days{std.segment ? `, ${std.segment}` : ""}
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
      {o.tcv !== null ? <p className="muted small">TCV {formatUsd(o.tcv)}.</p> : null}
    </section>
  );
}

function PathCalendar({ steps, asOf, qe, links }: { steps: StepTiming[]; asOf: IsoDate; qe: IsoDate; links: { from: ConditionType; to: ConditionType; strength: string }[] }) {
  if (steps.length === 0) return <p className="muted">Every step is done.</p>;
  let end = qe;
  for (const s of steps) for (const c of ["fast", "standard", "slow"] as const) if (s.finish[c]) end = maxDate(end, s.finish[c]!);
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
        const waits = links.filter((l) => l.to === s.type && steps.some((x) => x.type === l.from));
        return (
          <div key={s.type} className="cal-row">
            <div className="cal-label">
              {CONDITION_LABEL[s.type]}
              {waits.length ? (
                <div className="muted small">
                  after {waits.map((l) => `${CONDITION_LABEL[l.from].toLowerCase()}${l.strength === "soft" ? " (can overlap)" : ""}`).join(", ")}
                </div>
              ) : null}
            </div>
            <div className="cal-track">
              {start && slow ? <span className="cal-slow" style={{ left: pct(start), width: `calc(${pct(slow)} - ${pct(start)})` }} /> : null}
              {start && std ? <span className="cal-std" style={{ left: pct(start), width: `calc(${pct(std)} - ${pct(start)})` }} /> : null}
              {!std ? <span className="cal-none">no estimate</span> : null}
              <span className="cal-qe" style={{ left: pct(qe) }} title="Quarter end" />
            </div>
          </div>
        );
      })}
      <div className="cal-legend muted small">
        Dark: standard pace. Light: extends to slow pace. Vertical line: quarter end ({formatDisplayDate(qe)}).
      </div>
    </div>
  );
}
