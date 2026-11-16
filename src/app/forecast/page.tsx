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
import { formatAmount, type Cents } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";
import { GROUP_LABEL } from "@/features/shell/labels";
import { DEAL_TYPE_LABEL } from "@/domain/crm-rules";
import { forecastCategory } from "@/domain/forecast";

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
  const [manager, setManager] = useState("");
  const lines = useMemo(() => {
    if (!data) return [];
    return data.forecast.lines
      .filter((l) => !group || l.group === group)
      .filter((l) => !industry || l.view.account?.segment === industry)
      .filter((l) => !dealType || l.view.opportunity.dealType === dealType)
      .filter((l) => !manager || l.managerId === manager)
      .sort(
        (a, b) =>
          GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
          (b.tcv ?? 0) - (a.tcv ?? 0),
      );
  }, [data, group, industry, dealType, manager]);

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
        core={c.core}
        conservative={c.conservative}
        stretch={c.stretch}
        target={c.target}
      />

      <ManagersCommit
        core={c.core}
        target={c.target}
        total={c.managerCommitment}
        moves={f.lines
          .filter((l) => l.dispute?.status.live)
          .map((l) => ({
            id: l.view.opportunity.id,
            name: l.view.account?.name ?? "",
            manager: name(l.dispute!.dispute.managerId),
            reason: l.dispute!.dispute.reason,
            amount: ((l.dispute!.dispute.direction === "in" ? 1 : -1) *
              (l.tcv ?? 0)) as Cents,
          }))
          .sort((x, y) => y.amount - x.amount)}
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
              {formatAmount(
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
            {formatAmount(data.bridge.before)} to{" "}
            {formatAmount(data.bridge.after)}.
          </p>
          <div className="moves">
            {data.bridge.lines.map((l) => (
              <div key={l.kind} data-testid={`bridge-${l.kind}`}>
                {l.moves.slice(0, TOP).map((m) => {
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
                        {formatAmount(m.amount)}
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
                {l.moves.length > TOP ? (
                  <div className="move-more muted small">
                    And {l.moves.length - TOP} more. See Deals below.
                  </div>
                ) : null}
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
          {f.recoverable.slice(0, TOP).map((l) => {
            const i = l.interventions[0]!;
            return (
              <li key={`r-${l.view.opportunity.id}`}>
                <span className="todo-tag tag-pull">Pull in</span>
                <span>
                  <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                    {l.view.account?.name}
                  </Link>{" "}
                  {formatAmount(l.tcv ?? (0 as Cents))}: start{" "}
                  {CONDITION_LABEL[i.condition].toLowerCase()} by{" "}
                  {formatDisplayDate(i.startBy)} and it lands this quarter.
                </span>
              </li>
            );
          })}
          <More n={f.recoverable.length} what="to pull in" />
          {f.readyNotCommitted.slice(0, TOP).map((l) => (
            <li key={`c-${l.view.opportunity.id}`}>
              <span className="todo-tag tag-chase">Chase</span>
              <span>
                <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                  {l.view.account?.name}
                </Link>{" "}
                {formatAmount(l.tcv ?? (0 as Cents))}: timing fits, but{" "}
                {l.reasons[0] ?? "the customer has not committed"}.
              </span>
            </li>
          ))}
          <More n={f.readyNotCommitted.length} what="to chase" />
          {f.downside.slice(0, TOP).map((l) => (
            <li key={`w-${l.view.opportunity.id}`}>
              <span className="todo-tag tag-watch">Watch</span>
              <span>
                <Link href={`/forecast/deals/${l.view.opportunity.id}`}>
                  {l.view.account?.name}
                </Link>{" "}
                {formatAmount(l.tcv ?? (0 as Cents))} is counted, but{" "}
                {l.reasons[0] ?? "it is not Firm"}.
              </span>
            </li>
          ))}
          <More n={f.downside.length} what="to watch" />
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
          <span className="card-title">
            Deals: value, group and what holds each back
          </span>
          <span className="card-figure">{f.lines.length}</span>
        </summary>
        <div className="card-tools">
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            aria-label="Manager"
          >
            <option value="">All managers</option>
            {f.managers.map((m) => (
              <option key={m.managerId} value={m.managerId ?? ""}>
                {name(m.managerId)}
              </option>
            ))}
          </select>
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
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            aria-label="Industry"
          >
            <option value="">All industries</option>
            {[...new Set(f.lines.map((l) => l.view.account?.segment ?? ""))]
              .filter(Boolean)
              .sort()
              .map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
          </select>
          <select
            value={dealType}
            onChange={(e) => setDealType(e.target.value)}
            aria-label="Deal type"
          >
            <option value="">All deal types</option>
            {Object.entries(DEAL_TYPE_LABEL).map(([v, lbl]) => (
              <option key={v} value={v}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
        {manager
          ? (() => {
              const m = f.managers.find((x) => x.managerId === manager);
              return m ? (
                <p className="small" data-testid="manager-summary">
                  {name(manager)}: system forecast{" "}
                  <strong>{formatAmount(m.core)}</strong>
                  {m.target === null ? "" : ` of ${formatAmount(m.target)} target`}
                  , range {formatAmount(m.conservative)} to{" "}
                  {formatAmount(m.stretch)}. Managers&apos; Commit{" "}
                  <strong className="manager">
                    {formatAmount(m.managerCommitment)}
                  </strong>
                  .
                </p>
              ) : null;
            })()
          : null}
        <table className="table compact">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Industry</th>
              <th>Deal type</th>
              <th>System</th>
              <th>Manager</th>
              <th>Expected signature</th>
              <th className="num">Min Commit</th>
              <th className="num">Platform fee</th>
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
                  <td
                    className={
                      l.dispute?.status.live ? "small manager strong" : "small"
                    }
                    title={
                      l.dispute?.status.live
                        ? "The manager's category differs from the system's"
                        : undefined
                    }
                  >
                    {forecastCategory(l)}
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
                  <td className="num">
                    {o.arr === null ? "—" : formatAmount(o.arr)}
                  </td>
                  <td className="num">
                    {o.nonRecurring === null
                      ? "—"
                      : formatAmount(o.nonRecurring)}
                  </td>
                  <td className="num">
                    <strong>
                      {l.tcv === null ? "—" : formatAmount(l.tcv)}
                    </strong>
                  </td>
                  <td className="small">{l.reasons.join("; ")}</td>
                </tr>
              );
            })}
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
              <th className="num manager">Managers&apos; Commit</th>
            </tr>
          </thead>
          <tbody>
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td>{formatDisplayDate(r.asOfDate)}</td>
                <td>
                  {r.trigger === "submission" ? "Submission" : "Weekly run"}
                </td>
                <td className="num">{formatAmount(r.totals.core)}</td>
                <td className="num muted">
                  {formatAmount(r.totals.conservative)} to{" "}
                  {formatAmount(r.totals.stretch)}
                </td>
                <td className="num manager">
                  {formatAmount(r.totals.managerCommitment)}
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
}: {
  core: Cents;
  conservative: Cents;
  stretch: Cents;
  target: Cents | null;
}) {
  const scale = Math.max(target ?? 0, stretch, core, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const gap = target === null ? null : core - target;
  return (
    <div className="headline">
      <div className="headline-figure">
        <span data-testid="core">{formatAmount(core)}</span>
        {target !== null ? (
          <span className="headline-of">
            {" "}
            of {formatAmount(target)} target
          </span>
        ) : null}
      </div>
      {gap !== null ? (
        <p className="runway-caption">
          {gap >= 0 ? (
            <strong className="ok">
              {formatAmount(gap as Cents)} above target
            </strong>
          ) : (
            <strong className="short">
              {formatAmount(Math.abs(gap) as Cents)} short
            </strong>
          )}
        </p>
      ) : null}
      <div
        className="progress"
        role="img"
        aria-label={`${formatAmount(core)} of ${target === null ? "no target" : formatAmount(target)}`}
      >
        <span className="progress-fill" style={{ width: pct(core) }} />
        {target !== null ? (
          <span className="progress-target" style={{ left: pct(target) }} />
        ) : null}
      </div>
      <p className="headline-note">
        Could land between{" "}
        <span data-testid="conservative">{formatAmount(conservative)}</span>{" "}
        and <span data-testid="stretch">{formatAmount(stretch)}</span>.
      </p>
    </div>
  );
}

/** PRD test 14: every list on Home shows at most three rows; the rest are one line away, in Deals. */
const TOP = 3;

function More({ n, what }: { n: number; what: string }) {
  if (n <= TOP) return null;
  return (
    <li className="todo-more muted small">
      And {n - TOP} more {what}. See Deals below.
    </li>
  );
}

/**
 * Managers' Commit as a waterfall: the system forecast, then each deal a Sales Manager moved into (+) or out of
 * (−) Commit, with the manager and the reason, landing on Managers' Commit.
 */
function ManagersCommit({
  core,
  target,
  total,
  moves,
}: {
  core: Cents;
  target: Cents | null;
  total: Cents;
  moves: { id: string; name: string; manager: string; reason: string; amount: Cents }[];
}) {
  let run = core as number;
  const steps = moves.map((m) => {
    const from = run;
    run += m.amount;
    return { ...m, from, to: run };
  });
  const scale = Math.max(core, total, target ?? 0, ...steps.map((x) => Math.max(x.from, x.to)), 1);
  const pct = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;
  const bar = (from: number, to: number, cls: string) => (
    <span
      className={`wf-bar ${cls}`}
      style={{ left: pct(Math.min(from, to)), width: pct(Math.abs(to - from)) }}
    />
  );
  const targetLine =
    target !== null ? <span className="wf-target" style={{ left: pct(target) }} /> : null;
  const diff = (total - core) as Cents;
  return (
    <section className="wf" aria-label="Managers' Commit">
      <div className="wf-head">
        <div>
          <div className="wf-title">Managers&apos; Commit</div>
          <div className="muted small">
            {moves.length
              ? "The system forecast, plus each deal a Sales Manager moved into or out of Commit."
              : "Every Sales Manager agrees with the system."}
          </div>
        </div>
        <div className="wf-total">
          <span className="manager" data-testid="manager-commitment">
            {formatAmount(total)}
          </span>
          {diff !== 0 ? (
            <span className="muted small">
              {diff > 0 ? "+" : ""}
              {formatAmount(diff)} vs the system
            </span>
          ) : null}
        </div>
      </div>
      <div className="wf-rows">
        <div className="wf-row">
          <div className="wf-label">
            <strong>System forecast</strong>
          </div>
          <div className="wf-track">
            {targetLine}
            {bar(0, core, "wf-system")}
          </div>
          <div className="wf-amount">{formatAmount(core)}</div>
        </div>
        {steps.map((x) => (
          <div className="wf-row" key={x.id}>
            <div className="wf-label">
              <Link href={`/forecast/deals/${x.id}`}>{x.name}</Link>
              <span className="muted small">
                {x.manager}, {x.amount > 0 ? "moved into Commit" : "moved out of Commit"}
              </span>
            </div>
            <div className="wf-track">
              {targetLine}
              {bar(x.from, x.to, x.amount > 0 ? "wf-up" : "wf-down")}
            </div>
            <div className={`wf-amount ${x.amount > 0 ? "up" : "down"}`}>
              {x.amount > 0 ? "+" : ""}
              {formatAmount(x.amount)}
            </div>
            <q className="wf-reason">{x.reason}</q>
          </div>
        ))}
        {moves.length ? (
          <div className="wf-row wf-final">
            <div className="wf-label">
              <strong className="manager">Managers&apos; Commit</strong>
            </div>
            <div className="wf-track">
              {targetLine}
              {bar(0, total, "wf-manager")}
            </div>
            <div className="wf-amount manager">
              <strong>{formatAmount(total)}</strong>
            </div>
          </div>
        ) : null}
      </div>
      <p className="muted small wf-foot">
        {target !== null ? <>Dashed line: the {formatAmount(target)} target. </> : null}A Sales Manager
        moves a deal on its page and gives a reason; the system re-checks every move each day.
      </p>
    </section>
  );
}
