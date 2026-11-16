// Movement bridge between a stored run and the live forecast (PRD §4J, DR-14). Every deal lands in at
// most one line and the lines sum to the change in Core. Pure.

import { compareDates, type IsoDate } from "./dates";
import type { ChangeLogEntry, DealEvent, EvidenceDecision, ForecastRun, Group, PilotReading, PlanningStandard, RunLine } from "./entities";
import type { ForecastLine } from "./forecast";
import { formatAmount, type Cents } from "./money";

export type BridgeLineKind =
  | "new"
  | "won_outside"
  | "lost"
  | "other_exclusion"
  | "removed"
  | "commitment_lost"
  | "slipped"
  | "upgraded"
  | "tcv_change"
  | "transferred_in"
  | "transferred_out";

export const BRIDGE_ORDER: BridgeLineKind[] = [
  "new",
  "won_outside",
  "lost",
  "other_exclusion",
  "removed",
  "commitment_lost",
  "slipped",
  "upgraded",
  "tcv_change",
  "transferred_in",
  "transferred_out",
];

export const BRIDGE_LABEL: Record<BridgeLineKind, string> = {
  new: "New",
  won_outside: "Won outside the forecast",
  lost: "Lost",
  other_exclusion: "Other exclusion",
  removed: "Removed",
  commitment_lost: "Commitment lost",
  slipped: "Slipped",
  upgraded: "Upgraded",
  tcv_change: "TCV change",
  transferred_in: "Transferred in",
  transferred_out: "Transferred out",
};

export interface BridgeMove {
  opportunityId: string;
  amount: Cents;
  from: Group | null;
  to: Group;
  causes: string[];
}

export interface BridgeLine {
  kind: BridgeLineKind;
  amount: Cents;
  moves: BridgeMove[];
}

export interface Bridge {
  baseline: ForecastRun;
  before: Cents;
  after: Cents;
  lines: BridgeLine[];
  sentence: string;
}

export interface CauseData {
  changeLog: readonly ChangeLogEntry[];
  events: readonly DealEvent[];
  evidenceDecisions: readonly EvidenceDecision[];
  evidence: readonly { id: string; opportunityId: string; eventId: string }[];
  pilotReadings: readonly PilotReading[];
  planningStandards: readonly PlanningStandard[];
}

const IN_CORE: Group[] = ["signed", "firm", "core"];
const CRM_FIELDS = ["tcv", "arr", "term_months", "non_recurring", "status", "stage", "signed_date", "manager", "archived_at"];

const inWindow = (d: IsoDate, from: IsoDate, to: IsoDate) => compareDates(d, from) > 0 && compareDates(d, to) <= 0;

/** Every cause since the earlier run, in PRD §4J order; "time passing" when there is none. */
/**
 * True when the deal is now timed by a planning standard the baseline run did not use, where the baseline
 * used another version of the same standard, or the standard took effect after the baseline (DR-01).
 */
export function standardChangedFor(line: ForecastLine | undefined, baseline: ForecastRun, standards: readonly PlanningStandard[]): boolean {
  if (!line) return false;
  const snap = (baseline.configSnapshot as { planningStandards?: { id: string }[] }).planningStandards;
  const usedBefore = new Set((snap ?? []).map((x) => x.id));
  const key = (p: PlanningStandard) => `${p.conditionType}|${p.dealType}|${p.segment ?? ""}`;
  const keysBefore = new Set(standards.filter((p) => usedBefore.has(p.id)).map(key));
  return line.view.timing.steps.some((st) => {
    const p = st.standardId ? standards.find((x) => x.id === st.standardId) : undefined;
    if (!p) return false;
    if (compareDates(p.effectiveFrom, baseline.asOfDate) > 0) return true;
    return snap !== undefined && !usedBefore.has(p.id) && keysBefore.has(key(p));
  });
}

export function causesFor(oppId: string, from: IsoDate, to: IsoDate, engineChanged: boolean, data: CauseData, standardChanged = false): string[] {
  const out: string[] = [];
  if (data.changeLog.some((c) => c.entityId === oppId && CRM_FIELDS.includes(c.field) && inWindow(c.at, from, to))) out.push("CRM edit");
  const dealEvidence = data.evidence.filter((e) => e.opportunityId === oppId);
  const evIds = new Set(dealEvidence.map((e) => e.id));
  const eventIds = new Set(dealEvidence.map((e) => e.eventId));
  const newEvidence = data.events.some((e) => eventIds.has(e.id) && inWindow(e.occurredAt, from, to));
  const decided = data.evidenceDecisions.some((d) => evIds.has(d.evidenceId) && inWindow(d.at, from, to));
  if (newEvidence || decided) out.push("new evidence");
  if (data.pilotReadings.some((r) => r.opportunityId === oppId && inWindow(r.weekEnding, from, to))) out.push("new pilot reading");
  if (standardChanged) out.push("planning standard changed");
  if (engineChanged) out.push("engine changed");
  return out.length ? out : ["no progress"];
}

export function computeBridge(
  baseline: ForecastRun,
  earlier: readonly RunLine[],
  current: readonly ForecastLine[],
  asOf: IsoDate,
  causeData: CauseData,
  scopeManagerId: string | null = null,
  engineChanged = false,
): Bridge {
  const before = new Map(earlier.filter((l) => l.runId === baseline.id).map((l) => [l.opportunityId, l]));
  const now = new Map(current.map((l) => [l.view.opportunity.id, l]));
  const ids = new Set([...before.keys(), ...now.keys()]);
  const lines = new Map<BridgeLineKind, BridgeMove[]>();
  const add = (kind: BridgeLineKind, m: BridgeMove) => lines.set(kind, [...(lines.get(kind) ?? []), m]);
  const inScope = (mgr: string | undefined) => scopeManagerId === null || mgr === scopeManagerId;
  let beforeTotal = 0;
  let afterTotal = 0;

  for (const id of ids) {
    const b = before.get(id);
    const n = now.get(id);
    const bIn = !!b && inScope(b.managerId) && IN_CORE.includes(b.group);
    const nIn = !!n && inScope(n.managerId) && IN_CORE.includes(n.group);
    if (bIn) beforeTotal += b!.tcv ?? 0;
    if (nIn) afterTotal += n!.tcv ?? 0;
    if (!bIn && !nIn) continue;
    const move = (amount: number): BridgeMove => ({
      opportunityId: id,
      amount: amount as Cents,
      from: b?.group ?? null,
      to: n?.group ?? "excluded",
      causes: causesFor(id, baseline.asOfDate, asOf, engineChanged, causeData, standardChangedFor(n, baseline, causeData.planningStandards)),
    });

    // Team scope: a change of manager is a transfer, whatever else happened (DR-14).
    if (scopeManagerId !== null && b && n && b.managerId !== n.managerId) {
      if (bIn && !inScope(n.managerId)) add("transferred_out", move(-(b.tcv ?? 0)));
      else if (nIn && !inScope(b.managerId)) add("transferred_in", move(n.tcv ?? 0));
      continue;
    }
    if (!b && nIn) add("new", move(n!.tcv ?? 0));
    else if (!bIn && nIn) add(n!.group === "signed" ? "won_outside" : "upgraded", move(n!.tcv ?? 0));
    else if (bIn && !nIn) {
      const loss = -(b!.tcv ?? 0);
      const reason = n?.eligibility.kind === "excluded" ? n.eligibility.reason : null;
      if (!n || reason === "archived") add("removed", move(loss));
      else if (reason === "lost") add("lost", move(loss));
      else if (reason !== null) add("other_exclusion", move(loss));
      else if (n.commitment?.level !== "committed") add("commitment_lost", move(loss));
      else add("slipped", move(loss));
    } else {
      const diff = (n!.tcv ?? 0) - (b!.tcv ?? 0);
      if (diff !== 0) add("tcv_change", move(diff));
    }
  }

  const out: BridgeLine[] = BRIDGE_ORDER.filter((k) => lines.has(k)).map((k) => {
    const moves = lines.get(k)!;
    return { kind: k, moves, amount: moves.reduce((a, m) => a + m.amount, 0) as Cents };
  });
  return {
    baseline,
    before: beforeTotal as Cents,
    after: afterTotal as Cents,
    lines: out,
    sentence: sentence(beforeTotal, afterTotal, out),
  };
}

const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const count = (k: number) => COUNT[k] ?? String(k);
const PHRASE: Record<BridgeLineKind, (k: number) => string> = {
  new: (k) => `${count(k)} new`,
  won_outside: (k) => `${count(k)} signed from outside the forecast`,
  lost: (k) => `${count(k)} lost`,
  other_exclusion: (k) => `${count(k)} excluded`,
  removed: (k) => `${count(k)} removed`,
  commitment_lost: (k) => `${count(k)} lost commitment`,
  slipped: (k) => `${count(k)} slipped`,
  upgraded: (k) => `${count(k)} moved in`,
  tcv_change: (k) => `${count(k)} changed value`,
  transferred_in: (k) => `${count(k)} transferred in`,
  transferred_out: (k) => `${count(k)} transferred out`,
};

function money(c: number): string {
  return formatAmount(Math.abs(c) as Cents);
}

function sentence(before: number, after: number, lines: BridgeLine[]): string {
  const delta = after - before;
  const head = delta === 0 ? "No change" : `${delta < 0 ? "Down" : "Up"} ${money(delta)}`;
  if (!lines.length) return `${head}.`;
  const parts = lines.map((l) => PHRASE[l.kind](l.moves.length));
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${head}: ${list}.`;
}
