import type { ContactRole, User, UserRole } from "@/domain/entities";

export const PRODUCT_NAME = "Wonderful CRM";

export const ROLE_LABEL: Record<UserRole, string> = {
  cro: "CRO",
  vp_sales: "VP Sales",
  revops: "RevOps",
  sales_manager: "Sales Manager",
};

export function userLabel(user: User): string {
  return user.team && user.role === "sales_manager"
    ? `${user.name} — ${ROLE_LABEL[user.role]}, ${user.team}`
    : `${user.name} — ${ROLE_LABEL[user.role]}`;
}

/** How an Event entered the system (D-09). Never "live": no live integration exists. */
export const SOURCE_LABEL = { seeded: "Imported", manual: "Manual import", live: "Live" } as const;

export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  sponsor: "Executive sponsor",
  budget_holder: "Budget holder",
  technical: "Technical lead",
  security: "Security",
  legal: "Legal",
  procurement: "Procurement",
  other: "Other",
};

export const GROUP_LABEL: Record<import("@/domain/entities").Group, string> = {
  signed: "Signed",
  firm: "Firm",
  core: "Core",
  stretch: "Stretch",
  uncommitted: "Uncommitted",
  late: "Late",
  timing_unknown: "Timing unknown",
  excluded: "Excluded",
};

export const COMMITMENT_LABEL = { committed: "Committed", engaged: "Engaged", unproven: "Unproven", at_risk: "At risk" } as const;

export const READINESS_LABEL = {
  slow: "Fits even if slow",
  standard: "Fits at standard pace",
  fast: "Fits only if fast",
  not_ready: "Misses the quarter",
} as const;
