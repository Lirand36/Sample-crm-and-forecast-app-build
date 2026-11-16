import type { User, UserRole } from "@/domain/entities";

/** The CRO role is the VP Sales (Liran's G-1 decision). */
export const ROLE_LABEL: Record<UserRole, string> = {
  cro: "CRO / VP Sales",
  revops: "RevOps",
  sales_manager: "Sales Manager",
};

export function userLabel(user: User): string {
  return user.team ? `${user.name} — ${ROLE_LABEL[user.role]}, ${user.team}` : `${user.name} — ${ROLE_LABEL[user.role]}`;
}
