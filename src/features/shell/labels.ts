import type { User, UserRole } from "@/domain/entities";

export const PRODUCT_NAME = "Demo Wonderful CRM";

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
