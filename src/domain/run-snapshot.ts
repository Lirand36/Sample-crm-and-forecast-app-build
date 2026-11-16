// A stored Forecast run is an unchangeable copy of the engine's output (PRD §4K). Each RunLine copies the
// values it was computed from, so the run renders the same after any later change. Pure.

import { evidenceStatus, gradeOf } from "./condition-state";
import type { ForecastInput, Forecast } from "./forecast";
import type { ForecastRun, RunLine, RunTotals } from "./entities";

export const ENGINE_VERSION = "engine-1.0";

export function snapshotRun(
  forecast: Forecast,
  data: ForecastInput,
  meta: { id: string; trigger: ForecastRun["trigger"]; seq: number; templateVersions: string[]; extractionVersion: string },
): { run: ForecastRun; lines: RunLine[] } {
  const totals = (m: Forecast["company"]): RunTotals => ({
    conservative: m.conservative,
    core: m.core,
    stretch: m.stretch,
    managerCommitment: m.managerCommitment,
  });
  const events = new Map(data.events.map((e) => [e.id, e]));
  const usedStandards = new Set<string>();

  const lines: RunLine[] = forecast.lines.map((l) => {
    const o = l.view.opportunity;
    for (const s of l.view.timing.steps) if (s.standardId) usedStandards.add(s.standardId);
    const evidence = data.evidence
      .filter((e) => e.opportunityId === o.id)
      .map((e) => {
        const ev = events.get(e.eventId);
        const decisions = data.evidenceDecisions.filter((d) => d.evidenceId === e.id).sort((a, b) => b.seq - a.seq);
        return {
          id: e.id,
          condition: e.conditionType,
          claim: e.claim,
          quote: e.quote,
          status: evidenceStatus(e, data.evidenceDecisions),
          reviewer: decisions[0]?.actorId ?? null,
          grade: ev ? gradeOf(ev) : null,
          eventDate: ev?.occurredAt ?? null,
          origin: ev?.origin ?? null,
          source: ev?.sourceLabel ?? null,
        };
      })
      .filter((e) => e.eventDate !== null && e.eventDate <= forecast.asOf);
    return {
      id: `${meta.id}:${o.id}`,
      runId: meta.id,
      opportunityId: o.id,
      managerId: o.managerId,
      eligibility: l.eligibility.kind,
      exclusionReason: l.eligibility.kind === "excluded" ? l.eligibility.reason : null,
      tcv: o.tcv,
      currency: "USD",
      commitment: l.commitment?.level ?? null,
      commitmentRule: l.commitment ? (l.commitment.missing.join("; ") || "all commitment rules met") : null,
      esdFast: l.view.timing.esd.fast,
      esdStandard: l.view.timing.esd.standard,
      esdSlow: l.view.timing.esd.slow,
      group: l.group,
      reason: l.reasons.join("; ") || null,
      ruleIds: [],
      detail: {
        status: o.status,
        states: l.view.states.map((s) => ({
          type: s.type,
          state: s.state,
          doneOn: s.doneOn,
          doneGrade: s.doneGrade,
          blocked: s.blocked,
          waiverReason: s.waiverReason,
        })),
        steps: l.view.timing.steps.map((s) => ({ type: s.type, finish: s.finish, remaining: s.remaining, standardId: s.standardId })),
        evidence,
        pilotReadings: data.pilotReadings.filter((r) => r.opportunityId === o.id && r.weekEnding <= forecast.asOf),
        dispute: l.dispute ? { ...l.dispute.dispute, status: l.dispute.status } : null,
        interventions: l.interventions.map((i) => ({ condition: i.condition, startBy: i.startBy, group: i.result.group })),
      },
    };
  });

  const run: ForecastRun = {
    id: meta.id,
    asOfDate: forecast.asOf,
    quarterId: forecast.quarter.id,
    quarterEnd: forecast.quarter.end,
    trigger: meta.trigger,
    seq: meta.seq,
    engineVersion: ENGINE_VERSION,
    templateVersions: meta.templateVersions,
    extractionVersion: meta.extractionVersion,
    configSnapshot: {
      planningStandards: data.planningStandards
        .filter((p) => usedStandards.has(p.id))
        .map((p) => ({ id: p.id, version: p.version, fast: p.fastDays, standard: p.standardDays, slow: p.slowDays, segment: p.segment })),
    },
    totals: totals(forecast.company),
    managerTotals: Object.fromEntries(forecast.managers.map((m) => [m.managerId!, totals(m)])),
    isFixture: false,
  };
  return { run, lines };
}
