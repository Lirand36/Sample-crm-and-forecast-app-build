"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadForecast } from "@/application/forecast";
import { formatDisplayDate } from "@/domain/dates";
import type { Group } from "@/domain/entities";
import type { ForecastLine } from "@/domain/forecast";
import { formatMillions, type Cents } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";
import { COMMITMENT_LABEL, GROUP_LABEL, READINESS_LABEL } from "@/features/shell/labels";

const GROUP_ORDER: Group[] = ["signed", "firm", "core", "stretch", "late", "timing_unknown", "uncommitted", "excluded"];

export default function ForecastHome() {
  const data = useStoreQuery(async (s) => {
    const [forecast, users, runs] = await Promise.all([loadForecast(s), s.repos.users.list(), s.repos.forecastRuns.list()]);
    return { forecast, users, runs: runs.sort((a, b) => b.seq - a.seq) };
  });
  const [group, setGroup] = useState<Group | "">("");
  const lines = useMemo(() => {
    if (!data) return [];
    return data.forecast.lines
      .filter((l) => !group || l.group === group)
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || (b.tcv ?? 0) - (a.tcv ?? 0));
  }, [data, group]);

  if (!data) return <p>Loading…</p>;
  const { forecast: f, users } = data;
  const c = f.company;
  const gap = c.target === null ? null : ((c.core - c.target) as Cents);
  const name = (id: string | null) => (id === null ? "Company" : (users.find((u) => u.id === id)?.name ?? id));
  const scale = Math.max(...f.managers.flatMap((m) => [m.stretch, m.managerCommitment, m.target ?? 0]), 1);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Forecast</h1>
          <p className="muted subtitle">
            {f.quarter.label} · as of {formatDisplayDate(f.asOf)} · quarter ends {formatDisplayDate(f.quarter.end)}
          </p>
        </div>
      </div>

      <div className="number-row">
        <div className="number-main">
          <div className="number-label">System forecast</div>
          <div className="number-big" data-testid="core">{formatMillions(c.core)}</div>
          <div className="number-side">
            <span>Conservative <strong data-testid="conservative">{formatMillions(c.conservative)}</strong></span>
            <span>Stretch <strong data-testid="stretch">{formatMillions(c.stretch)}</strong></span>
          </div>
          {c.target !== null ? (
            <div className="number-target">
              Target {formatMillions(c.target)} · {gap! >= 0 ? "above by " : "short by "}
              <strong className={gap! >= 0 ? "ok" : "short"}>{formatMillions(Math.abs(gap!) as Cents)}</strong>
            </div>
          ) : null}
        </div>
        <div className="number-manager">
          <div className="number-label manager">Manager commitment</div>
          <div className="number-mid manager" data-testid="manager-commitment">{formatMillions(c.managerCommitment)}</div>
          <div className="muted small">
            System forecast adjusted by {c.liveDisputes} Dispute{c.liveDisputes === 1 ? "" : "s"} from the Sales Managers. Never mixed into the
            system number.
          </div>
        </div>
      </div>

      <div className="stake">
        <StakeList
          title="Downside exposure"
          hint="Counted in the system forecast but not Firm."
          lines={f.downside}
          detail={(l) => l.reasons[0] ?? ""}
        />
        <StakeList
          title="Ready, not committed"
          hint="Fits the quarter on timing, but the customer has not committed. Shown, never counted."
          lines={f.readyNotCommitted}
          detail={(l) => l.reasons[0] ?? ""}
        />
      </div>

      <h2>By manager</h2>
      <table className="table compact">
        <thead>
          <tr>
            <th>Manager</th>
            <th className="num">Conservative</th>
            <th className="num">System forecast</th>
            <th className="num">Stretch</th>
            <th className="num">Target</th>
            <th className="num manager">Manager commitment</th>
            <th style={{ width: "30%" }}></th>
          </tr>
        </thead>
        <tbody>
          {f.managers.map((m) => (
            <tr key={m.managerId}>
              <td>{name(m.managerId)}</td>
              <td className="num">{formatMillions(m.conservative)}</td>
              <td className="num"><strong>{formatMillions(m.core)}</strong></td>
              <td className="num">{formatMillions(m.stretch)}</td>
              <td className="num">{m.target === null ? "—" : formatMillions(m.target)}</td>
              <td className="num manager">{formatMillions(m.managerCommitment)}</td>
              <td>
                <div className="bar" aria-hidden>
                  <span className="bar-stretch" style={{ width: `${(m.stretch / scale) * 100}%` }} />
                  <span className="bar-core" style={{ width: `${(m.core / scale) * 100}%` }} />
                  <span className="bar-cons" style={{ width: `${(m.conservative / scale) * 100}%` }} />
                  {m.target !== null ? <span className="bar-target" style={{ left: `${(m.target / scale) * 100}%` }} /> : null}
                  <span className="bar-manager" style={{ left: `${(m.managerCommitment / scale) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-head">
        <h2>Deals</h2>
        <select value={group} onChange={(e) => setGroup(e.target.value as Group | "")} aria-label="Group">
          <option value="">All groups</option>
          {GROUP_ORDER.map((g) => (
            <option key={g} value={g}>{GROUP_LABEL[g]}</option>
          ))}
        </select>
      </div>
      <table className="table compact">
        <thead>
          <tr>
            <th>Deal</th>
            <th>Group</th>
            <th>Commitment</th>
            <th>Timing</th>
            <th>Planned signature</th>
            <th className="num">TCV</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const o = l.view.opportunity;
            const esd = l.view.timing.esd;
            const evaluated = l.eligibility.kind === "evaluated";
            return (
              <tr key={o.id} className={l.group === "excluded" ? "archived" : undefined}>
                <td>
                  <Link href={`/crm/opportunities/${o.id}`}>{l.view.account?.name ?? o.name}</Link>
                  <div className="muted small">{name(o.managerId)}</div>
                </td>
                <td><span className={`group-pill g-${l.group}`}>{GROUP_LABEL[l.group]}</span></td>
                <td>{l.commitment ? COMMITMENT_LABEL[l.commitment.level] : "—"}</td>
                <td className="small">{evaluated ? READINESS_LABEL[l.view.timing.readiness] : "—"}</td>
                <td className="small nowrap">
                  {evaluated ? (
                    <>
                      {esd.standard ? formatDisplayDate(esd.standard) : "no estimate"}
                      <div className="muted">
                        {esd.fast ? formatDisplayDate(esd.fast) : "—"} to {esd.slow ? formatDisplayDate(esd.slow) : "—"}
                      </div>
                    </>
                  ) : o.signedDate ? (
                    `Signed ${formatDisplayDate(o.signedDate)}`
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">{l.tcv === null ? "—" : formatMillions(l.tcv)}</td>
                <td className="small">{l.reasons.join("; ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Stored runs</h2>
      <table className="table compact">
        <thead>
          <tr>
            <th>As of</th>
            <th>Trigger</th>
            <th className="num">Conservative</th>
            <th className="num">System forecast</th>
            <th className="num">Stretch</th>
            <th className="num manager">Manager commitment</th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((r) => (
            <tr key={r.id}>
              <td>{formatDisplayDate(r.asOfDate)}</td>
              <td>{r.trigger === "submission" ? "Submission" : "Weekly run"}</td>
              <td className="num">{formatMillions(r.totals.conservative)}</td>
              <td className="num">{formatMillions(r.totals.core)}</td>
              <td className="num">{formatMillions(r.totals.stretch)}</td>
              <td className="num manager">{formatMillions(r.totals.managerCommitment)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StakeList({ title, hint, lines, detail }: { title: string; hint: string; lines: ForecastLine[]; detail: (l: ForecastLine) => string }) {
  const total = lines.reduce((a, l) => a + (l.tcv ?? 0), 0) as Cents;
  return (
    <div className="stake-box">
      <div className="stake-head">
        <strong>{title}</strong> <span className="stake-total">{formatMillions(total)}</span>
      </div>
      <div className="muted small">{hint}</div>
      {lines.length === 0 ? (
        <p className="muted small">None.</p>
      ) : (
        <ul>
          {lines.slice(0, 3).map((l) => (
            <li key={l.view.opportunity.id}>
              <Link href={`/crm/opportunities/${l.view.opportunity.id}`}>{l.view.account?.name}</Link>{" "}
              <span className="nowrap">{formatMillions(l.tcv ?? (0 as Cents))}</span>
              <div className="muted small">{detail(l)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
