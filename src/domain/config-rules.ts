// RevOps configuration on one deal (DR-07): waive a Condition, change a Link. Pure checks.

import type { ConditionState } from "./condition-state";
import { CONDITION_LABEL, type ConditionType, type LinkStrength, type TemplateLink, type UserRole } from "./entities";

export type ConfigCheck = { ok: true } | { ok: false; message: string };

/** Budget (2) and Vendor selection (4) can never be waived. */
export const NEVER_WAIVED: readonly ConditionType[] = ["budget", "vendor_selection"];

export function checkWaiver(role: UserRole, type: ConditionType, state: ConditionState | undefined, reason: string): ConfigCheck {
  if (role !== "revops") return { ok: false, message: "Only RevOps can waive a step." };
  if (NEVER_WAIVED.includes(type)) return { ok: false, message: `${CONDITION_LABEL[type]} can never be waived.` };
  if (!state) return { ok: false, message: "This deal has no such step." };
  if (state.state === "waived") return { ok: false, message: "This step is already waived." };
  if (state.state === "done") return { ok: false, message: "This step is already done." };
  if (!reason.trim()) return { ok: false, message: "A reason is required." };
  return { ok: true };
}

/** True when the links contain a cycle (a step that would wait, through other steps, on itself). */
export function hasCycle(links: readonly TemplateLink[]): boolean {
  const next = new Map<ConditionType, ConditionType[]>();
  for (const l of links) next.set(l.from, [...(next.get(l.from) ?? []), l.to]);
  const done = new Set<ConditionType>();
  const onPath = new Set<ConditionType>();
  const visit = (n: ConditionType): boolean => {
    if (onPath.has(n)) return true;
    if (done.has(n)) return false;
    onPath.add(n);
    const found = (next.get(n) ?? []).some(visit);
    onPath.delete(n);
    done.add(n);
    return found;
  };
  return [...next.keys()].some(visit);
}

export function checkLinkChange(
  role: UserRole,
  current: readonly TemplateLink[],
  stepsOnDeal: readonly ConditionType[],
  from: ConditionType,
  to: ConditionType,
  strength: LinkStrength | "removed",
  reason: string,
): ConfigCheck {
  if (role !== "revops") return { ok: false, message: "Only RevOps can change a link." };
  if (from === to) return { ok: false, message: "A step cannot wait on itself." };
  if (!stepsOnDeal.includes(from) || !stepsOnDeal.includes(to)) return { ok: false, message: "Both steps must be on this deal." };
  const existing = current.find((l) => l.from === from && l.to === to);
  if (strength === "removed" && !existing) return { ok: false, message: "There is no such link to remove." };
  if (existing && existing.strength === strength) return { ok: false, message: "The link is already like that." };
  if (!reason.trim()) return { ok: false, message: "A reason is required." };
  if (strength !== "removed") {
    const after = [...current.filter((l) => !(l.from === from && l.to === to)), { from, to, strength }];
    if (hasCycle(after)) return { ok: false, message: `That link would make ${CONDITION_LABEL[from]} wait on itself through other steps.` };
  }
  return { ok: true };
}
