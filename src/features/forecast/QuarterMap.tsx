"use client";

// Does each deal sign this quarter? Three answers, each with its total and a one-line reason per deal.

import Link from "next/link";
import { formatDisplayDate, type IsoDate } from "@/domain/dates";
import type { ForecastLine } from "@/domain/forecast";
import { formatAmount, sumCents, type Cents } from "@/domain/money";
import { GROUP_LABEL } from "@/features/shell/labels";

const short = (x: IsoDate) => formatDisplayDate(x).replace(/, \d{4}$/, "");
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

type Column = "yes" | "maybe" | "no";

const COLUMNS: { key: Column; title: string; sub: string }[] = [
  { key: "yes", title: "Signs this quarter", sub: "Counted in the forecast" },
  { key: "maybe", title: "Could sign this quarter", sub: "Upside, not counted" },
  { key: "no", title: "Not this quarter", sub: "Not counted" },
];

function columnOf(l: ForecastLine): Column | null {
  if (l.group === "excluded") return null;
  if (l.group === "signed" || l.group === "firm" || l.group === "core") return "yes";
  return l.group === "stretch" ? "maybe" : "no";
}

function why(l: ForecastLine): string {
  const o = l.view.opportunity;
  if (l.group === "signed") return o.signedDate ? `Signed ${short(o.signedDate)}` : "Signed";
  const esd = l.view.timing.esd.standard;
  if (l.group === "firm") return `Expected ${esd ? short(esd) : "—"}, with room even if slow`;
  if (l.group === "core") return `Expected ${esd ? short(esd) : "—"}, if it keeps a normal pace`;
  if (l.group === "late") return `Expected ${esd ? short(esd) : "—"}, after the quarter`;
  return l.reasons[0] ? cap(l.reasons[0]) : GROUP_LABEL[l.group];
}

export function QuarterMap({ lines, quarterEnd }: { lines: readonly ForecastLine[]; quarterEnd: IsoDate }) {
  const by: Record<Column, ForecastLine[]> = { yes: [], maybe: [], no: [] };
  for (const l of lines) {
    const c = columnOf(l);
    if (c) by[c].push(l);
  }
  for (const k of Object.keys(by) as Column[]) by[k].sort((a, b) => (b.tcv ?? 0) - (a.tcv ?? 0));
  const total = (ls: ForecastLine[]) => sumCents(ls.map((l) => (l.tcv ?? 0) as Cents));
  const sure = total(by.yes.filter((l) => l.group === "signed" || l.group === "firm"));

  return (
    <section className="qboard" data-testid="quarter-map" aria-label={`Which deals sign by ${formatDisplayDate(quarterEnd)}`}>
      {COLUMNS.map((c) => (
        <div key={c.key} className={`qcol q-${c.key}`}>
          <div className="qcol-head">
            <div>
              <h2>{c.title}</h2>
              <span className="muted small">{c.sub}</span>
            </div>
            <strong className="qcol-total">{formatAmount(total(by[c.key]))}</strong>
          </div>
          {by[c.key].length === 0 ? <p className="muted small">None.</p> : null}
          <ul>
            {by[c.key].map((l) => (
              <li key={l.view.opportunity.id}>
                <Link href={`/forecast/deals/${l.view.opportunity.id}`} className="qdeal">
                  <span className="qdeal-name">{l.view.account?.name ?? l.view.opportunity.name}</span>
                  <span className="qdeal-amount">{l.tcv === null ? "—" : formatAmount(l.tcv)}</span>
                  <span className="qdeal-why">{why(l)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {c.key === "yes" && sure > 0 ? (
            <p className="qcol-note small muted">
              Signed or Firm: {formatAmount(sure)}. That is the low end of the range.
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
