// Forecast Interventions (PRD §4G.6 as amended by DR-09): "start X now" by lifting X's soft Links.
// Offered only on Committed deals outside Core that the change moves into Firm or Core. Pure.

import { classify, type Classification } from "./classification";
import { addDays, compareDates, type IsoDate } from "./dates";
import type { DealView, ForecastData } from "./deal-view";
import type { ConditionType, Quarter } from "./entities";
import { dealTiming, latestViableDates, type DealTiming } from "./timing";

export interface Intervention {
  condition: ConditionType;
  /** The steps it stops waiting for. */
  lifted: ConditionType[];
  startBy: IsoDate;
  timing: DealTiming;
  result: Classification;
}

const COUNTED = ["firm", "core"];

export function interventionsFor(
  view: DealView,
  current: Classification,
  data: ForecastData,
  asOf: IsoDate,
  quarter: Quarter,
): Intervention[] {
  if (current.commitment?.level !== "committed") return [];
  if (["signed", "firm", "core", "excluded"].includes(current.group)) return [];
  const isDone = (t: ConditionType) => ["done", "waived"].includes(view.states.find((s) => s.type === t)?.state ?? "done");
  const lvd = latestViableDates(view.timing, view.links, quarter.end);
  const out: Intervention[] = [];
  for (const s of view.states) {
    if (s.state !== "not_started") continue;
    const into = view.links.filter((l) => l.to === s.type);
    if (into.some((l) => l.strength === "hard" && !isDone(l.from))) continue;
    const softOpen = into.filter((l) => l.strength === "soft" && !isDone(l.from)).map((l) => l.from);
    if (softOpen.length === 0) continue;

    const timing = dealTiming({ ...view.timingInput, liftSoftLinksInto: s.type });
    const result = classify({ ...view, timing }, data, asOf, quarter);
    if (!COUNTED.includes(result.group)) continue;
    const own = timing.steps.find((x) => x.type === s.type)!.remaining.standard;
    const latest = lvd.get(s.type);
    if (typeof own !== "number" || !latest) continue;
    const startBy = addDays(latest, -own);
    if (compareDates(startBy, asOf) < 0) continue;
    out.push({ condition: s.type, lifted: softOpen, startBy, timing, result });
  }
  return out;
}
