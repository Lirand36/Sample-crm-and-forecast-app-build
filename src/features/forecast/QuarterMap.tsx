"use client";

// When each deal signs: every evaluated deal as a range from fast to slow pace, a mark at standard pace, against
// the quarter end. The forecast's timing logic, visible at a glance: a deal counts only if its range fits.

import Link from "next/link";
import {
  addDays,
  compareDates,
  daysBetween,
  formatDisplayDate,
  maxDate,
  minDate,
  type IsoDate,
} from "@/domain/dates";
import type { ForecastLine } from "@/domain/forecast";
import { formatAmount } from "@/domain/money";
import { GROUP_LABEL } from "@/features/shell/labels";

const short = (x: IsoDate) => formatDisplayDate(x).replace(/, \d{4}$/, "");

export function QuarterMap({
  lines,
  asOf,
  quarterEnd: qe,
}: {
  lines: readonly ForecastLine[];
  asOf: IsoDate;
  quarterEnd: IsoDate;
}) {
  const rows = lines
    .filter((l) => l.eligibility.kind === "evaluated" && l.group !== "excluded")
    .map((l) => ({ l, esd: l.view.timing.esd }))
    .sort((a, b) => {
      const x = a.esd.standard ?? a.esd.slow;
      const y = b.esd.standard ?? b.esd.slow;
      return x && y
        ? compareDates(x, y)
        : x
          ? -1
          : y
            ? 1
            : (b.l.tcv ?? 0) - (a.l.tcv ?? 0);
    });
  if (rows.length === 0) return null;

  // The window: today to a few weeks past the quarter, or the latest standard date if sooner than 10 weeks out.
  let end = addDays(qe, 21);
  for (const { esd } of rows)
    if (esd.standard)
      end = maxDate(end, minDate(esd.standard, addDays(qe, 70)));
  const span = daysBetween(asOf, end);
  const x = (d: IsoDate) =>
    Math.max(0, Math.min(100, (daysBetween(asOf, d) / span) * 100));
  const qeX = x(qe);
  const max = Math.max(...rows.map((r) => r.l.tcv ?? 0), 1);

  // Month ticks
  const ticks: { at: number; label: string }[] = [];
  const [y0, m0] = asOf.split("-").map(Number) as [number, number];
  for (let i = 1; i < 8; i++) {
    const m = ((m0 - 1 + i) % 12) + 1;
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const d = `${y}-${String(m).padStart(2, "0")}-01` as IsoDate;
    if (compareDates(d, end) > 0) break;
    ticks.push({ at: x(d), label: short(d).replace(/ 1$/, "") });
  }

  return (
    <div className="qmap card" data-testid="quarter-map">
      <div className="qmap-head">
        <div>
          <h2>When each deal signs</h2>
          <p className="muted small">
            Each bar runs from fast to slow pace and the mark is standard pace.
            A committed deal counts when its mark is inside the quarter. If only
            the fast end gets in, it is stretch.
          </p>
        </div>
        <div className="qmap-key small">
          <span>
            <i className="kc counted" />
            Counted
          </span>
          <span>
            <i className="kc stretch" />
            Stretch
          </span>
          <span>
            <i className="kc out" />
            Not counted
          </span>
        </div>
      </div>
      <div className="qmap-grid">
        <div className="qmap-axis">
          <span className="qmap-tick today" style={{ left: "0%" }}>
            Today
          </span>
          {ticks.map((t) => (
            <span
              key={t.label}
              className="qmap-tick"
              style={{ left: `${t.at}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        {rows.map(({ l, esd }) => {
          const o = l.view.opportunity;
          const kind = ["signed", "firm", "core"].includes(l.group)
            ? "counted"
            : l.group === "stretch"
              ? "stretch"
              : "out";
          const from = esd.fast ?? esd.standard;
          const to = esd.slow;
          const beyond = to === null || compareDates(to, end) > 0;
          return (
            <Link
              key={o.id}
              href={`/forecast/deals/${o.id}`}
              className={`qmap-row ${kind}`}
            >
              <span className="qmap-name">
                <strong>{l.view.account?.name ?? o.name}</strong>
                <span className="muted small">
                  {l.tcv === null ? "—" : formatAmount(l.tcv)} ·{" "}
                  {GROUP_LABEL[l.group]}
                </span>
              </span>
              <span className="qmap-lane">
                <span className="qmap-after" style={{ left: `${qeX}%` }} />
                <span className="qmap-qe" style={{ left: `${qeX}%` }} />
                {from ? (
                  <span
                    className={`qmap-bar${beyond ? " open" : ""}`}
                    style={{
                      left: `${x(from)}%`,
                      width: `${Math.max((to ? x(to) : 100) - x(from), 0.8)}%`,
                      height: `${8 + ((l.tcv ?? 0) / max) * 10}px`,
                    }}
                  />
                ) : null}
                {esd.standard ? (
                  <span
                    className="qmap-mark"
                    style={{ left: `${x(esd.standard)}%` }}
                    title={`Standard pace ${formatDisplayDate(esd.standard)}`}
                  />
                ) : (
                  <span className="qmap-none small">
                    {l.view.timing.missingFast
                      ? "No date: a step has no estimate"
                      : "No estimate"}
                  </span>
                )}
              </span>
              <span className="qmap-date small">
                {esd.standard ? short(esd.standard) : "—"}
              </span>
            </Link>
          );
        })}
        <div className="qmap-foot small muted">
          <span style={{ left: `${qeX}%` }}>Quarter end {short(qe)}</span>
        </div>
      </div>
    </div>
  );
}
