"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadBridge, loadForecast } from "@/application/forecast";
import { loadMoveReasons } from "@/application/move-reasons";
import { evidenceStatus } from "@/domain/condition-state";
import { submitForecast } from "@/application/runs";
import { useStore } from "@/features/shell/StoreProvider";
import type { BridgeLineKind } from "@/domain/bridge";
import { daysBetween, formatDisplayDate } from "@/domain/dates";
import { CONDITION_LABEL, type Group } from "@/domain/entities";
import { formatMillions, type Cents } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";
import { GROUP_LABEL } from "@/features/shell/labels";
import { DEAL_TYPE_LABEL } from "@/domain/crm-rules";

const MOVE_LABEL: Record<BridgeLineKind, string> = {
  new: "new deal",
  won_outside: "signed from outside the forecast",
  lost: "lost",
  other_exclusion: "excluded",
  removed: "removed",
  commitment_lost: "customer no longer committed",
  slipped: "slipped",
  upgraded: "moved in",
  tcv_change: "value changed",
  transferred_in: "transferred in",
  transferred_out: "transferred out",
};

const GROUP_ORDER: Group[] = [
  "signed",
  "firm",
  "core",
  "stretch",
  "late",
  "timing_unknown",
  "uncommitted",
  "excluded",
];

export default function ForecastHome() {
  const { store, actingUser, refresh } = useStore();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [baselineId, setBaselineId] = useState<string>("");
  const data = useStoreQuery(
    async (s) => {
      const [forecast, users, runs] = await Promise.all([
        loadForecast(s),
        s.repos.users.list(),
        s.repos.forecastRuns.list(),
      ]);
      const bridge = await loadBridge(s, forecast, baselineId || undefined);
      const reasons = bridge
        ? await loadMoveReasons(s, bridge, forecast.asOf)
        : null;
      const [evidence, decisions] = await Promise.all([
        s.repos.evidence.list(),
        s.repos.evidenceDecisions.list(),
      ]);
      const waiting = evidence.filter(
        (e) => evidenceStatus(e, decisions) === "waiting",
      ).length;
      return {
        forecast,
        users,
        bridge,
        reasons,
        waiting,
        runs: runs.sort((a, b) => b.seq - a.seq),
      };
    },
    [baselineId],
  );
  const [group, setGroup] = useState<Group | "">("");
  const [industry, setIndustry] = useState("");
  const [dealType, setDealType] = useState("");
  const lines = useMemo(() => {
    if (!data) return [];
    return data.forecast.lines
      .filter((l) => !group || l.group === group)
      .filter((l) => !industry || l.view.account?.segment === industry)
      .filter((l) => !dealType || l.view.opportunity.dealType === dealType)
      .sort(
        (a, b) =>
          GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
          (b.tcv ?? 0) - (a.tcv ?? 0),
      );
  }, [data, group, industry, dealType]);

  if (!data) return <p>Loading…</p>;
  const { forecast: f, users } = data;
  const c = f.company;
  const name = (id: string | null) =>
    id === null ? "Company" : (users.find((u) => u.id === id)?.name ?? id);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Forecast</h1>
          <p className="muted subtitle">
            {f.quarter.label} ends {formatDisplayDate(f.quarter.end)}, in{" "}
            {daysBetween(f.asOf, f.quarter.end)} days.
          </p>
        </div>
        <div className="actions">
          {actingUser.role === "sales_manager" && submitted ? (
            <span className="muted small">{submitted}</span>
          ) : null}
          {actingUser.role === "sales_manager" ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="submit"
              onClick={async () => {
                const r = await submitForecast(store);
                setSubmitted(
                  r.ok
                    ? `Submitted ${formatDisplayDate(r.value.submittedAt)}. The run is frozen below.`
                    : (Object.values(r.errors)[0] ?? "Refused."),
                );
                await refresh();
              }}
            >
              Submit my forecast
            </button>
          ) : null}
        </div>
      </div>

      <Headline
        disputes={f.lines
          .filter((l) => l.dispute?.status.live)
          .map((l) => ({
            id: l.view.opportunity.id,
            name: l.view.account?.name ?? "",
            manager: name(l.dispute!.dispute.managerId),
            reason: l.dispute!.dispute.reason,
            amount: ((l.dispute!.dispute.direction === "in" ? 1 : -1) * (l.tcv ?? 0)) as Cents,
          }))}
        core={c.core}
        conservative={c.conservative}
        stretch={c.stretch}
        target={c.target}
        managerCommitment={c.managerCommitment}
      />

      {data.bridge ? (
        <details className="card" open>
          <summary>
            <span className="card-title">
              What changed since{" "}
              {formatDisplayDate(data.bridge.baseline.asOfDate)}
            </span>
            <span
              className={
                data.bridge.after < data.bridge.before
                  ? "card-figure short"
                  : "card-figure ok"
              }
            >
              {data.bridge.after < data.bridge.before ? "−" : "+"}
              {formatMillions(
                Math.abs(data.bridge.after - data.bridge.before) as Cents,
              )}
            </span>
          </summary>
          <div className="card-tools">
            <label className="check small">
              Compare with
              <select
                value={data.bridge.baseline.id}
                onChange={(e) => setBaselineId(e.target.value)}
                aria-label="Compare with"
              >
                {data.runs
                  .filter((r) => r.asOfDate <= f.asOf)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDisplayDate(r.asOfDate)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p data-testid="bridge-sentence">
            {data.bridge.sentence.replace(/\.$/, "")}, from{" "}
            {formatMillions(data.bridge.before)} to{" "}
            {formatMillions(data.bridge.after)}.
          </p>
          <div className="moves">
            {data.bridge.lines.map((l) => (
              <div key={l.kind} data-testid={`bridge-${l.kind}`}>
                {l.moves.map((m) => {
                  const line = f.lines.find(
                    (x) => x.view.opportunity.id === m.opportunityId,
                  );
                  const reasons = data.reasons?.get(m.opportunityId) ?? [];
                  return (
                    <div key={m.opportunityId} className="move">
                      <div
                        className={
                          m.amount < 0 ? "move-amount short" : "move-amount ok"
                        }
                      >
                        {formatMillions(m.amount)}
                      </div>
                      <div>
                        <div>
                          <Link href={`/forecast/deals/${m.opportunityId}`}>
                            <strong>
                              {line?.view.account?.name ?? m.opportunityId}
                            </strong>
                          </Link>{" "}
                          <span className="muted">
                            {MOVE_LABEL[l.kind]}
                            {line &&
                            l.kind === "slipped" &&
                            line.view.timing.esd.standard
                              ? `, now expected ${formatDisplayDate(line.view.timing.esd.standard)}`
                              : ""}
                          </span>
                        </div>
                        {reasons.length ? (
                          reasons.map((r, i) => (
                            <div key={i} className="move-reason">
                              <span className="muted">
                                {formatDisplayDate(r.date)},{" "}
                                {r.kind === "email"
                                  ? `email from ${r.who}`
                                  : r.who}
                                :
                              </span>{" "}
                              {r.quote ? <q>{r.quote}</q> : r.text}
                            </div>
                          ))
                        ) : (
                          <div className="move-reason muted">
                            {m.causes.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <details className="card" open>
        <summary>
          <span className="card-title">What to do</span>
          <span className="card-figure">
            {f.recoverable.length +
              f.readyNotCommitted.length +
              f.downside.length +
              (data.waiting > 0 ? 1 : 0)}
          </span>
        </summary>
        <ul className="todo">
          {f.recoverable.map((l) => {
            const i = l.interventions[0]!;
            return (
              <li key={`r-${l.view.opportunity.id}`}>
                <span className="todo-tag tag-pull">Pull in</span>
                <span>
                  <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                    {l.view.account?.name}
                  </Link>{" "}
                  {formatMillions(l.tcv ?? (0 as Cents))}: start{" "}
                  {CONDITION_LABEL[i.condition].toLowerCase()} by{" "}
                  {formatDisplayDate(i.startBy)} and it lands this quarter.
                </span>
              </li>
            );
          })}
          {f.readyNotCommitted.map((l) => (
            <li key={`c-${l.view.opportunity.id}`}>
              <span className="todo-tag tag-chase">Chase</span>
              <span>
                <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                  {l.view.account?.name}
                </Link>{" "}
                {formatMillions(l.tcv ?? (0 as Cents))}: timing fits, but{" "}
                {l.reasons[0] ?? "the customer has not committed"}.
              </span>
            </li>
          ))}
          {f.downside.map((l) => (
            <li key={`w-${l.view.opportunity.id}`}>
              <span className="todo-tag tag-watch">Watch</span>
              <span>
                <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                  {l.view.account?.name}
                </Link>{" "}
                {formatMillions(l.tcv ?? (0 as Cents))} is counted, but{" "}
                {l.reasons[0] ?? "it is not Firm"}.
              </span>
            </li>
          ))}
          {data.waiting > 0 ? (
            <li>
              <span className="todo-tag tag-review">Review</span>
              <span>
                <Link href="/evidence">
                  {data.waiting} claim{data.waiting === 1 ? "" : "s"} from
                  customer emails
                </Link>{" "}
                wait for approval before they count.
              </span>
            </li>
          ) : null}
        </ul>
      </details>

      <details className="card">
        <summary>
          <span className="card-title">Deals: value, group and what holds each back</span>
          <span className="card-figure">{f.lines.length}</span>
        </summary>
        <div className="card-tools">
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as Group | "")}
            aria-label="Group"
          >
            <option value="">All groups</option>
            {GROUP_ORDER.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </select>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry">
            <option value="">All industries</option>
            {[...new Set(f.lines.map((l) => l.view.account?.segment ?? ""))].filter(Boolean).sort().map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <select value={dealType} onChange={(e) => setDealType(e.target.value)} aria-label="Deal type">
            <option value="">All deal types</option>
            {Object.entries(DEAL_TYPE_LABEL).map(([v, lbl]) => (
              <option key={v} value={v}>{lbl}</option>
            ))}
          </select>
        </div>
        <table className="table compact">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Industry</th>
              <th>Deal type</th>
              <th>Group</th>
              <th>Expected signature</th>
              <th className="num">ARR</th>
              <th className="num">Non-recurring</th>
              <th className="num">TCV</th>
              <th>Held back by</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const o = l.view.opportunity;
              const evaluated = l.eligibility.kind === "evaluated";
              return (
                <tr
                  key={o.id}
                  className={l.group === "excluded" ? "archived" : undefined}
                >
                  <td>
                    <Link href={`/forecast/deals/${o.id}`}>
                      {l.view.account?.name ?? o.name}
                    </Link>
                    <div className="muted small">{name(o.managerId)}</div>
                  </td>
                  <td className="small">{l.view.account?.segment ?? "—"}</td>
                  <td className="small">{DEAL_TYPE_LABEL[o.dealType]}</td>
                  <td>
                    <span className={`group-pill g-${l.group}`}>
                      {GROUP_LABEL[l.group]}
                    </span>
                  </td>
                  <td className="small nowrap">
                    {evaluated
                      ? l.view.timing.esd.standard
                        ? formatDisplayDate(l.view.timing.esd.standard)
                        : "No estimate"
                      : o.signedDate
                        ? `Signed ${formatDisplayDate(o.signedDate)}`
                        : "—"}
                  </td>
                  <td className="num">{o.arr === null ? "—" : formatMillions(o.arr)}</td>
                  <td className="num">{o.nonRecurring === null ? "—" : formatMillions(o.nonRecurring)}</td>
                  <td className="num">
                    <strong>{l.tcv === null ? "—" : formatMillions(l.tcv)}</strong>
                  </td>
                  <td className="small">{l.reasons.join("; ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <details className="card">
        <summary>
          <span className="card-title">By manager</span>
        </summary>
        <table className="table compact">
          <thead>
            <tr>
              <th>Manager</th>
              <th className="num">System forecast</th>
              <th className="num">Target</th>
              <th className="num">Range</th>
              <th className="num manager">Managers&apos; forecast</th>
            </tr>
          </thead>
          <tbody>
            {f.managers.map((m) => (
              <tr key={m.managerId}>
                <td>{name(m.managerId)}</td>
                <td className="num">
                  <strong>{formatMillions(m.core)}</strong>
                </td>
                <td className="num">
                  {m.target === null ? "—" : formatMillions(m.target)}
                </td>
                <td className="num muted">
                  {formatMillions(m.conservative)} to{" "}
                  {formatMillions(m.stretch)}
                </td>
                <td className="num manager">
                  {formatMillions(m.managerCommitment)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="card more">
        <summary>
          <span className="card-title">Past runs</span>
          <span className="card-figure">{data.runs.length}</span>
        </summary>
        <table className="table compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className="num">System forecast</th>
              <th className="num">Range</th>
              <th className="num manager">Managers&apos; forecast</th>
            </tr>
          </thead>
          <tbody>
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td>{formatDisplayDate(r.asOfDate)}</td>
                <td>
                  {r.trigger === "submission" ? "Submission" : "Weekly run"}
                </td>
                <td className="num">{formatMillions(r.totals.core)}</td>
                <td className="num muted">
                  {formatMillions(r.totals.conservative)} to{" "}
                  {formatMillions(r.totals.stretch)}
                </td>
                <td className="num manager">
                  {formatMillions(r.totals.managerCommitment)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Headline({
  core,
  conservative,
  stretch,
  target,
  managerCommitment,
  disputes,
}: {
  disputes: { id: string; name: string; manager: string; reason: string; amount: Cents }[];
  core: Cents;
  conservative: Cents;
  stretch: Cents;
  target: Cents | null;
  managerCommitment: Cents;
}) {
  const scale = Math.max(target ?? 0, stretch, core, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const gap = target === null ? null : core - target;
  return (
    <div className="headline">
      <div className="headline-figure">
        <span data-testid="core">{formatMillions(core)}</span>
        {target !== null ? (
          <span className="headline-of">
            {" "}
            of {formatMillions(target)} target
          </span>
        ) : null}
      </div>
      {gap !== null ? (
        <p className="runway-caption">
          {gap >= 0 ? (
            <strong className="ok">
              {formatMillions(gap as Cents)} above target
            </strong>
          ) : (
            <strong className="short">
              {formatMillions(Math.abs(gap) as Cents)} short
            </strong>
          )}
        </p>
      ) : null}
      <div
        className="progress"
        role="img"
        aria-label={`${formatMillions(core)} of ${target === null ? "no target" : formatMillions(target)}`}
      >
        <span className="progress-fill" style={{ width: pct(core) }} />
        {target !== null ? (
          <span className="progress-target" style={{ left: pct(target) }} />
        ) : null}
      </div>
      <p className="headline-note">
        Could land between{" "}
        <span data-testid="conservative">{formatMillions(conservative)}</span>{" "}
        and <span data-testid="stretch">{formatMillions(stretch)}</span>.
      </p>
      <p className="headline-note">
        Sales managers&apos; forecast:{" "}
        <span className="manager" data-testid="manager-commitment">
          {formatMillions(managerCommitment)}
        </span>
        {disputes.length ? (
          <>
            {" "}= {formatMillions(core)} system forecast
            {disputes.map((d) => (
              <span key={d.name} className="dispute-term">
                {d.amount < 0 ? " − " : " + "}
                {d.name} {formatMillions(Math.abs(d.amount) as Cents)}
              </span>
            ))}
            , where a manager disagrees with the system.
          </>
        ) : (
          ". No manager disagrees with the system."
        )}
      </p>
      {disputes.length ? (
        <ul className="dispute-list">
          {disputes.map((d) => (
            <li key={d.id}>
              <Link href={`/forecast/deals/${d.id}`}>{d.name}</Link>{" "}
              <span className="manager">{d.amount < 0 ? "−" : "+"}{formatMillions(Math.abs(d.amount) as Cents)}</span>
              <span className="muted">, {d.manager}:</span> <q>{d.reason}</q>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
