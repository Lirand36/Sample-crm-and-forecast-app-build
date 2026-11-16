"use client";

// Planning standards (DR-01): the versions in force, calibration beside each (shown only, never applied),
// and RevOps approval of a new version.

import { useState } from "react";
import { loadForecast } from "@/application/forecast";
import { approvePlanningStandard } from "@/application/planning-standards";
import { compareDates, daysBetween, formatDisplayDate } from "@/domain/dates";
import { CONDITION_LABEL, type ConditionType, type PlanningConditionType, type PlanningStandard } from "@/domain/entities";
import { useStoreQuery } from "@/features/crm/ui";
import { useStore } from "@/features/shell/StoreProvider";

const TYPES: PlanningConditionType[] = [
  "executive_sponsor", "budget", "pilot", "pilot_acceptance", "vendor_selection", "technical_validation", "security", "procurement_legal",
];
const label = (t: PlanningConditionType) => (t === "pilot_acceptance" ? "Pilot acceptance" : CONDITION_LABEL[t as ConditionType]);
const keyOf = (p: PlanningStandard) => `${p.conditionType}|${p.dealType}|${p.segment ?? ""}`;

export function PlanningStandards() {
  const { store, session, actingUser, users, refresh } = useStore();
  const data = useStoreQuery(async (s) => {
    const [standards, forecast] = await Promise.all([s.repos.planningStandards.list(), loadForecast(s)]);
    // Calibration: observed spans of completed steps across all deals, by step type.
    const spans = new Map<string, number[]>();
    for (const l of forecast.lines)
      for (const st of l.view.states)
        if (st.state === "done" && st.spanStart && st.doneOn) spans.set(st.type, [...(spans.get(st.type) ?? []), daysBetween(st.spanStart, st.doneOn)]);
    return { standards, spans };
  });
  const [form, setForm] = useState({ conditionType: "procurement_legal" as PlanningConditionType, segment: "", fast: "", standard: "", slow: "", rationale: "", effectiveFrom: session.asOfDate as string });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  if (!data) return null;

  const asOf = session.asOfDate;
  const byKey = new Map<string, PlanningStandard[]>();
  for (const p of data.standards) byKey.set(keyOf(p), [...(byKey.get(keyOf(p)) ?? []), p]);
  const rows = [...byKey.values()]
    .map((versions) => {
      const sorted = versions.sort((a, b) => b.version - a.version);
      const inForce = sorted.find((p) => compareDates(p.effectiveFrom, asOf) <= 0) ?? null;
      const scheduled = sorted.find((p) => compareDates(p.effectiveFrom, asOf) > 0) ?? null;
      return { head: inForce ?? sorted[0]!, inForce, scheduled, count: versions.length };
    })
    .sort((a, b) => TYPES.indexOf(a.head.conditionType) - TYPES.indexOf(b.head.conditionType) || (a.head.segment ?? "").localeCompare(b.head.segment ?? ""));
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const isRevOps = actingUser.role === "revops";
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="panel">
      <h2>Planning standards</h2>
      <p className="muted small">
        Each open step is timed by the approved standard in force today: fast, standard and slow days. Observed spans from completed steps
        are shown for calibration only. They never change a standard or a date.
      </p>
      <table className="table compact" data-testid="standards">
        <thead>
          <tr>
            <th>Step</th>
            <th>Segment</th>
            <th>Version</th>
            <th>Fast / standard / slow</th>
            <th>In force from</th>
            <th>Approved by</th>
            <th>Observed spans</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ head, scheduled }) => {
            const obs = data.spans.get(head.conditionType) ?? [];
            const sorted = [...obs].sort((a, b) => a - b);
            return (
              <tr key={keyOf(head)}>
                <td>{label(head.conditionType)}</td>
                <td>{head.segment ?? "All"}</td>
                <td>
                  v{head.version}
                  {scheduled ? <div className="muted small">v{scheduled.version} from {formatDisplayDate(scheduled.effectiveFrom)}</div> : null}
                </td>
                <td>{head.fastDays} / {head.standardDays} / {head.slowDays} days</td>
                <td>{formatDisplayDate(head.effectiveFrom)}</td>
                <td title={head.rationale}>{name(head.approvedBy)}</td>
                <td className="small">{head.segment ? "—" : obs.length ? `${obs.length} completed, median ${sorted[Math.floor((sorted.length - 1) / 2)]} days` : "none yet"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isRevOps ? (
        <form
          className="form"
          data-testid="standard-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await approvePlanningStandard(store, {
              conditionType: form.conditionType,
              dealType: "all",
              segment: form.segment.trim() || null,
              fastDays: Number(form.fast),
              standardDays: Number(form.standard),
              slowDays: Number(form.slow),
              rationale: form.rationale,
              effectiveFrom: form.effectiveFrom,
            });
            if (!r.ok) return setErrors(r.errors);
            setErrors({});
            setDone(`Approved ${label(r.value.conditionType)} v${r.value.version}: ${r.value.fastDays} / ${r.value.standardDays} / ${r.value.slowDays} days from ${formatDisplayDate(r.value.effectiveFrom)}.`);
            await refresh();
          }}
        >
          <h3>Approve a new version</h3>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Step</span>
              <select value={form.conditionType} onChange={set("conditionType")} aria-label="Standard step">
                {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Segment (blank for all)</span>
              <input value={form.segment} onChange={set("segment")} aria-label="Segment" />
            </label>
            <label className="field">
              <span className="field-label">Fast days</span>
              <input inputMode="numeric" value={form.fast} onChange={set("fast")} aria-label="Fast days" />
            </label>
            <label className="field">
              <span className="field-label">Standard days</span>
              <input inputMode="numeric" value={form.standard} onChange={set("standard")} aria-label="Standard days" />
            </label>
            <label className="field">
              <span className="field-label">Slow days</span>
              <input inputMode="numeric" value={form.slow} onChange={set("slow")} aria-label="Slow days" />
            </label>
            <label className="field">
              <span className="field-label">In force from</span>
              <input type="date" min={asOf} value={form.effectiveFrom} onChange={set("effectiveFrom")} aria-label="In force from" />
            </label>
            <label className="field">
              <span className="field-label">Rationale</span>
              <input value={form.rationale} onChange={set("rationale")} aria-label="Rationale" />
            </label>
          </div>
          {Object.values(errors).length ? <p className="form-error">{Object.values(errors).join(" ")}</p> : null}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Approve version</button>
          </div>
          {done ? <p className="small" data-testid="standard-result">{done}</p> : null}
        </form>
      ) : (
        <p className="muted small">Only RevOps can approve a new version.</p>
      )}
    </div>
  );
}
