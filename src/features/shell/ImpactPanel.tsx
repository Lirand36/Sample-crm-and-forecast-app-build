"use client";

// "What that did": after every write, the forecast before and after, and each deal that moved and why.
// Real numbers from the engine, recomputed on the spot; nothing here is scripted.

import Link from "next/link";
import { formatDisplayDate } from "@/domain/dates";
import type { DealChange, TotalChange } from "@/domain/impact";
import { formatAmount, type Cents } from "@/domain/money";
import { GROUP_LABEL } from "./labels";
import { useStore } from "./StoreProvider";

const TOTAL_LABEL: Record<TotalChange["key"], string> = {
  core: "System forecast",
  managerCommitment: "Managers' Commit",
  conservative: "Low end",
  stretch: "High end",
};

export function ImpactPanel() {
  const { impact, dismissImpact } = useStore();
  if (!impact) return null;
  const { label, impact: i, seq } = impact;
  const moved = i.totals.filter((t) => t.before !== t.after);
  const still = i.totals.filter((t) => t.before === t.after && (t.key === "core" || t.key === "managerCommitment"));
  return (
    <aside className="impact" key={seq} role="status" aria-live="polite" data-testid="impact">
      <div className="impact-head">
        <span className="impact-kicker">What that did</span>
        <button type="button" className="impact-close" onClick={dismissImpact} aria-label="Close">
          ×
        </button>
      </div>
      <div className="impact-title">{label}</div>
      {i.asOf ? (
        <div className="impact-asof">
          Today moved from {formatDisplayDate(i.asOf.before)} to {formatDisplayDate(i.asOf.after)}. Every deal was re-timed and every
          manager&apos;s bet re-checked.
        </div>
      ) : null}
      <div className="impact-totals">
        {moved.map((t) => (
          <Total key={t.key} t={t} />
        ))}
        {moved.length === 0 ? <div className="impact-none">No forecast number changed.</div> : null}
        {moved.length > 0
          ? still.map((t) => (
              <div key={t.key} className="impact-row muted">
                <span>{TOTAL_LABEL[t.key]}</span>
                <span>unchanged at {formatAmount(t.after)}</span>
              </div>
            ))
          : null}
      </div>
      {i.deals.length ? (
        <ul className="impact-deals">
          {i.deals.slice(0, 4).map((d) => (
            <Deal key={d.opportunityId} d={d} />
          ))}
          {i.deals.length > 4 ? <li className="muted small">And {i.deals.length - 4} more deals.</li> : null}
        </ul>
      ) : null}
    </aside>
  );
}

function Total({ t }: { t: TotalChange }) {
  const delta = (t.after - t.before) as Cents;
  return (
    <div className={`impact-row ${t.key === "managerCommitment" ? "manager" : ""}`}>
      <span>{TOTAL_LABEL[t.key]}</span>
      <span className="impact-move">
        <span className="impact-before">{formatAmount(t.before)}</span>
        <span aria-hidden>→</span>
        <strong>{formatAmount(t.after)}</strong>
        <span className={delta < 0 ? "impact-delta down" : "impact-delta up"}>
          {delta < 0 ? "" : "+"}
          {formatAmount(delta)}
        </span>
      </span>
    </div>
  );
}

function Deal({ d }: { d: DealChange }) {
  const parts: string[] = [];
  if (d.category) parts.push(`manager: ${d.category.before} → ${d.category.after}`);
  if (d.group) parts.push(`system: ${GROUP_LABEL[d.group.before]} → ${GROUP_LABEL[d.group.after]}`);
  if (d.esd) parts.push(`expected signature ${d.esd.before ? formatDisplayDate(d.esd.before) : "none"} → ${d.esd.after ? formatDisplayDate(d.esd.after) : "none"}`);
  if (d.dispute && d.dispute.before && !d.dispute.after) parts.push(`manager's move no longer counts${d.dispute.reason ? `: ${d.dispute.reason}` : ""}`);
  if (d.dispute && !d.dispute.before && d.dispute.after) parts.push("manager's move now counts");
  return (
    <li>
      <Link href={`/forecast/deals/${d.opportunityId}`}>
        <strong>{d.name}</strong>
      </Link>
      {d.tcv !== null ? <span className="muted"> {formatAmount(d.tcv)}</span> : null}
      <div className="small">{parts.join(" · ") || "value changed"}</div>
      {d.reasons.length && (d.group || d.category) ? <div className="muted small">Held back by {d.reasons.join("; ")}.</div> : null}
    </li>
  );
}
