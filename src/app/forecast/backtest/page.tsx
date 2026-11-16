"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { loadBacktests } from "@/application/backtest";
import { computeBacktest, type BacktestDeal, type BacktestResult } from "@/domain/backtest";
import { formatDisplayDate } from "@/domain/dates";
import { formatAmount, type Cents } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";
import { GROUP_LABEL } from "@/features/shell/labels";
import { BT1, BT1_DEALS } from "@/seed/bt1";

const pct = (x: number | null) => (x === null ? "—" : `${(Math.round(x * 1000) / 10).toFixed(1)}%`);
const signed = (c: Cents) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${formatAmount(Math.abs(c) as Cents)}`;
const days = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x)} days`);

export default function BacktestPage() {
  const real = useStoreQuery(loadBacktests);
  const [synthetic, setSynthetic] = useState(false);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Previous quarters</h1>
          <p className="muted subtitle">Past forecasts against what actually signed.</p>
        </div>
        <div className="actions">
          <Link href="/forecast" className="btn">Forecast</Link>
        </div>
      </div>

      {real === null ? null : real.length === 0 ? (
        <div className="panel" data-testid="not-backtested">
          <h2>Not yet backtested</h2>
          <p className="muted">
            Each quarter appears here 7 days after it ends.
          </p>
          {!synthetic ? (
            <button type="button" className="btn" onClick={() => setSynthetic(true)} data-testid="show-synthetic">
              Show an example quarter
            </button>
          ) : null}
        </div>
      ) : (
        real.map((q) => (
          <div key={q.quarter.id} className="panel">
            <h2>{q.quarter.label}</h2>
            {q.runs.map(({ run, result, deals }) => (
              <BacktestView key={run.id} title={`Run of ${formatDisplayDate(run.asOfDate)}`} result={result} deals={deals} />
            ))}
          </div>
        ))
      )}

      {synthetic ? (
        <div className="panel" data-testid="synthetic">
          <BacktestView
            title={`${BT1.quarter.id.replace("2026-", "")} 2026 · run of ${formatDisplayDate(BT1.runAsOf)}`}
            result={computeBacktest(BT1_DEALS, BT1.quarter)}
            deals={BT1_DEALS}
          />
          <button type="button" className="link-button" onClick={() => setSynthetic(false)}>Hide the example</button>
        </div>
      ) : null}
    </section>
  );
}

function BacktestView({ title, result: r, deals, label }: { title: string; result: BacktestResult; deals: BacktestDeal[]; label?: string }) {
  const tag = label ? <span className="synthetic-tag" title={label}>Synthetic</span> : null;
  return (
    <>
      <h3>{title} {tag}</h3>
      <div className="backtest-grid" data-testid="backtest-metrics">
        <Metric name="Actual signed" value={formatAmount(r.actual)} tag={tag} />
        <Metric name="Conservative / Core / Stretch then" value={`${formatAmount(r.conservative)} / ${formatAmount(r.core)} / ${formatAmount(r.stretch)}`} tag={tag} />
        <Metric name="Landed between Conservative and Stretch" value={r.bracketed ? "Yes" : "No"} tag={tag} />
        <Metric name="Core precision" hint="Share of Core that signed" value={pct(r.corePrecision)} tag={tag} />
        <Metric name="Core capture" hint="Share of what signed that was in Core" value={pct(r.coreCapture)} tag={tag} />
        <Metric name="Forecast error" hint="Core − Actual · Managers' Commit − Actual" value={`${signed(r.coreError)} · ${signed(r.managerError)}`} tag={tag} />
        <Metric name="Timing bias" hint="Signed minus expected date, signed deals" value={days(r.timingBiasDays)} tag={tag} />
      </div>
      <h3>Signed, by group {tag}</h3>
      <table className="table compact" data-testid="signing-rate">
        <thead>
          <tr><th>Group then</th><th>TCV</th><th>Signed</th><th>Rate</th></tr>
        </thead>
        <tbody>
          {r.signingRate.map((s) => (
            <tr key={s.group}>
              <td>{GROUP_LABEL[s.group]}</td>
              <td>{formatAmount(s.tcv)}</td>
              <td>{formatAmount(s.signed)}</td>
              <td>{pct(s.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Deals {tag}</h3>
      <table className="table compact">
        <thead>
          <tr><th>Deal</th><th>TCV</th><th>Group then</th><th>Expected</th><th>Signed</th></tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td>{formatAmount(d.tcv)}</td>
              <td>{GROUP_LABEL[d.group]}</td>
              <td>{d.planned ? formatDisplayDate(d.planned) : "—"}</td>
              <td>{d.signedOn ? formatDisplayDate(d.signedOn) : "Not signed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Metric({ name, value, hint, tag }: { name: string; value: string; hint?: string; tag: ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-name">{name} {tag}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="muted small">{hint}</div> : null}
    </div>
  );
}
