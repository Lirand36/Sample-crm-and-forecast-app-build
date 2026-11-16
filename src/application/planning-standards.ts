// Approve a new planning-standard version (DR-01): RevOps only, never retroactive, logged. The old
// version stays; the engine uses the highest version in force on the as-of date.

import { compareDates, isIsoDate, type IsoDate } from "@/domain/dates";
import type { DealType, PlanningConditionType, PlanningStandard } from "@/domain/entities";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import type { DataStore } from "./ports";

export interface StandardInput {
  conditionType: PlanningConditionType;
  dealType: DealType | "all";
  segment: string | null;
  fastDays: number;
  standardDays: number;
  slowDays: number;
  rationale: string;
  effectiveFrom: string;
}

export async function approvePlanningStandard(store: DataStore, input: StandardInput): Promise<CrmResult<PlanningStandard>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  if (!actor || actor.role !== "revops") return { ok: false, errors: { form: "Only RevOps can approve a planning standard." } };
  const errors: Record<string, string> = {};
  const days = [input.fastDays, input.standardDays, input.slowDays];
  if (!days.every((n) => Number.isInteger(n) && n > 0)) errors.days = "Days must be whole numbers above zero.";
  else if (!(input.fastDays <= input.standardDays && input.standardDays <= input.slowDays)) errors.days = "Fast must not exceed standard, and standard must not exceed slow.";
  if (!input.rationale.trim()) errors.rationale = "A rationale is required.";
  if (!isIsoDate(input.effectiveFrom)) errors.effectiveFrom = "Pick a date.";
  else if (compareDates(input.effectiveFrom as IsoDate, session.asOfDate) < 0) errors.effectiveFrom = "A standard cannot take effect in the past.";
  if (Object.keys(errors).length) return { ok: false, errors };

  const all = await store.repos.planningStandards.list();
  const same = all.filter((p) => p.conditionType === input.conditionType && p.dealType === input.dealType && p.segment === input.segment);
  const version = Math.max(0, ...same.map((p) => p.version)) + 1;
  const previous = same.find((p) => p.version === version - 1) ?? null;
  const segmentKey = input.segment ? input.segment.toLowerCase().replace(/\s+/g, "_") : "all";
  const row: PlanningStandard = {
    id: `ps-${input.conditionType}-${input.dealType === "all" ? "" : `${input.dealType}-`}${segmentKey}-v${version}`,
    conditionType: input.conditionType,
    dealType: input.dealType,
    segment: input.segment,
    fastDays: input.fastDays,
    standardDays: input.standardDays,
    slowDays: input.slowDays,
    rationale: input.rationale.trim(),
    approvedBy: actor.id,
    effectiveFrom: input.effectiveFrom as IsoDate,
    version,
  };
  await store.repos.planningStandards.append(row);
  const { seq, at } = await reserveSeq(store);
  const fmt = (p: PlanningStandard) => `v${p.version} ${p.fastDays} / ${p.standardDays} / ${p.slowDays}`;
  await store.repos.changeLog.append({
    id: `chg-${seq}`, entity: "planning_standard", entityId: row.id, field: "approved",
    oldValue: previous ? fmt(previous) : null, newValue: fmt(row), actorId: actor.id, at, seq, reason: row.rationale,
  });
  return { ok: true, value: row };
}
