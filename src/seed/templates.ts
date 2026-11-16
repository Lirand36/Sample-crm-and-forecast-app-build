// Condition templates v1 (PRD §3 graph; DR-07 variants).

import type { ConditionTemplate, TemplateCondition, TemplateLink } from "@/domain/entities";

const SEVEN: TemplateCondition[] = [
  { type: "executive_sponsor", kind: "commercial", defaultOwner: "Account executive" },
  { type: "budget", kind: "commercial", defaultOwner: "Customer sponsor" },
  { type: "pilot", kind: "commercial", defaultOwner: "Deployment lead" },
  { type: "vendor_selection", kind: "commercial", defaultOwner: "Customer sponsor" },
  { type: "technical_validation", kind: "process", defaultOwner: "Solutions engineer" },
  { type: "security", kind: "process", defaultOwner: "Customer security office" },
  { type: "procurement_legal", kind: "process", defaultOwner: "Customer procurement" },
];

const SEVEN_LINKS: TemplateLink[] = [
  { from: "executive_sponsor", to: "budget", strength: "hard" },
  { from: "executive_sponsor", to: "vendor_selection", strength: "hard" },
  { from: "pilot", to: "vendor_selection", strength: "hard" },
  { from: "technical_validation", to: "security", strength: "hard" },
  { from: "budget", to: "procurement_legal", strength: "hard" },
  { from: "vendor_selection", to: "procurement_legal", strength: "soft" },
  { from: "security", to: "procurement_legal", strength: "soft" },
];

export const CONDITION_TEMPLATES: ConditionTemplate[] = [
  { id: "major_accounts@v1", variant: "major_accounts", version: 1, conditions: SEVEN, links: SEVEN_LINKS },
  { id: "land@v1", variant: "land", version: 1, conditions: SEVEN, links: SEVEN_LINKS },
  {
    // Expand: no pilot; Condition 4 waits for Condition 1 (hard) only (DR-07).
    id: "expand@v1",
    variant: "expand",
    version: 1,
    conditions: SEVEN.filter((c) => c.type !== "pilot"),
    links: SEVEN_LINKS.filter((l) => l.from !== "pilot" && l.to !== "pilot"),
  },
];
