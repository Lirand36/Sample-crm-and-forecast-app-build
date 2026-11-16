"use client";

import { useEffect, useState } from "react";
import type { ForecastRun, Quarter } from "@/domain/entities";
import { formatDisplayDate } from "@/domain/dates";
import { formatMillions } from "@/domain/money";
import { useStore } from "@/features/shell/StoreProvider";

interface ForecastSummary {
  quarter: Quarter | undefined;
  runs: ForecastRun[];
  openDeals: number;
  events: number;
  evidence: number;
}

export default function ForecastPage() {
  const { store, revision } = useStore();
  const [summary, setSummary] = useState<ForecastSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [quarters, runs, opportunities, events, evidence] = await Promise.all([
        store.repos.quarters.list(),
        store.repos.forecastRuns.list(),
        store.repos.opportunities.list(),
        store.repos.events.list(),
        store.repos.evidence.list(),
      ]);
      if (!cancelled)
        setSummary({
          quarter: quarters[0],
          runs: runs.sort((a, b) => b.seq - a.seq),
          openDeals: opportunities.filter((o) => o.status === "open" && !o.archivedAt).length,
          events: events.length,
          evidence: evidence.length,
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [store, revision]);

  if (!summary) return <p>Loading…</p>;

  return (
    <section>
      <h1>Forecast</h1>
      <p className="muted">
        {summary.quarter ? `${summary.quarter.label}, ending ${formatDisplayDate(summary.quarter.end)}.` : "No quarter configured."}{" "}
        The forecast engine arrives in Phase 4; this page shows the stored data it will read.
      </p>
      <dl className="facts">
        <div>
          <dt>Open opportunities</dt>
          <dd>{summary.openDeals}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{summary.events}</dd>
        </div>
        <div>
          <dt>Evidence records</dt>
          <dd>{summary.evidence}</dd>
        </div>
      </dl>
      <h2>Stored Forecast runs</h2>
      <table className="table">
        <thead>
          <tr>
            <th>As of</th>
            <th>Trigger</th>
            <th className="num">Conservative</th>
            <th className="num">Core (system forecast)</th>
            <th className="num">Stretch</th>
            <th className="num">Manager commitment</th>
          </tr>
        </thead>
        <tbody>
          {summary.runs.map((r) => (
            <tr key={r.id}>
              <td>{formatDisplayDate(r.asOfDate)}</td>
              <td>{r.isFixture ? "Seeded demo run" : r.trigger}</td>
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
