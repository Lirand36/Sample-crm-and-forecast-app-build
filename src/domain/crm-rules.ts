// CRM foundation rules (handoff Part IV, DR-04, DR-07, DR-13). Pure functions.

import type { IsoDate } from "./dates";
import { isIsoDate } from "./dates";
import type { Account, Contact, DealType, Opportunity, TemplateVariant, User } from "./entities";
import { STAGES, statusForStage } from "./entities";
import { cents, type Cents } from "./money";

/** TCV = ARR × term / 12 + non-recurring, in integer cents (PRD §3 TCV definition). */
export function computeTcv(arr: Cents | null, termMonths: number | null, nonRecurring: Cents | null): Cents | null {
  if (arr === null && termMonths === null && nonRecurring === null) return null;
  return cents(Math.round(((arr ?? 0) * (termMonths ?? 0)) / 12) + (nonRecurring ?? 0));
}

export type FieldErrors = Record<string, string>;

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function validateAccount(account: Account, others: readonly Account[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!account.name.trim()) errors.name = "Name is required.";
  if (!account.segment.trim()) errors.segment = "Segment is required; it selects planning standards.";
  if (!account.market.trim()) errors.market = "Market (country) is required.";
  if (!account.ownerName.trim()) errors.ownerName = "Owner is required.";
  if (account.emailDomains.length === 0) {
    errors.emailDomains = "At least one email domain is required; it decides whether an email is from the customer.";
  } else {
    const bad = account.emailDomains.filter((d) => !DOMAIN_RE.test(d));
    if (bad.length) errors.emailDomains = `Not a valid domain: ${bad.join(", ")}`;
    else if (new Set(account.emailDomains).size !== account.emailDomains.length) errors.emailDomains = "A domain is listed twice.";
    else {
      const clash = others.find((o) => o.id !== account.id && o.emailDomains.some((d) => account.emailDomains.includes(d)));
      if (clash) errors.emailDomains = `A domain is already used by ${clash.name}; each domain must point to one Account.`;
    }
  }
  return errors;
}

export function validateContact(contact: Contact, accounts: readonly Account[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!accounts.some((a) => a.id === contact.accountId)) errors.accountId = "Choose an Account.";
  if (!contact.name.trim()) errors.name = "Name is required.";
  if (!contact.title.trim()) errors.title = "Title is required.";
  if (!EMAIL_RE.test(contact.email)) errors.email = "A valid email address is required.";
  return errors;
}

/** Part IV required fields and stage rules. */
export function validateOpportunity(opp: Opportunity, ctx: { accounts: readonly Account[]; users: readonly User[] }): FieldErrors {
  const errors: FieldErrors = {};
  if (!opp.name.trim()) errors.name = "Name is required.";
  if (!ctx.accounts.some((a) => a.id === opp.accountId)) errors.accountId = "Choose an Account.";
  if (!opp.ownerName.trim()) errors.ownerName = "Owner is required.";
  const manager = ctx.users.find((u) => u.id === opp.managerId);
  if (!manager || manager.role !== "sales_manager") errors.managerId = "Choose a Sales Manager.";
  if (!(STAGES as readonly string[]).includes(opp.stage)) errors.stage = "Choose a stage.";
  else if (opp.status !== statusForStage(opp.stage)) errors.stage = "Stage and status disagree.";
  const isPayg = opp.dealType === "payg";
  if (opp.arr !== null && (!Number.isSafeInteger(opp.arr) || opp.arr < 0)) errors.arr = "ARR must be a positive amount.";
  if (opp.nonRecurring !== null && (!Number.isSafeInteger(opp.nonRecurring) || opp.nonRecurring < 0)) errors.nonRecurring = "Non-recurring revenue cannot be negative.";
  if (opp.termMonths !== null && (!Number.isInteger(opp.termMonths) || opp.termMonths < 1 || opp.termMonths > 120)) errors.termMonths = "Term is 1 to 120 whole months.";
  if (!isPayg) {
    if (opp.arr === null || opp.arr <= 0) errors.arr = errors.arr ?? "ARR is required.";
    if (opp.termMonths === null) errors.termMonths = errors.termMonths ?? "Term is required.";
  }
  if (opp.tcv !== computeTcv(opp.arr, opp.termMonths, opp.nonRecurring)) errors.tcv = "TCV must equal ARR × term + non-recurring.";
  if (!isPayg && opp.status === "open" && (opp.tcv === null || opp.tcv <= 0)) {
    errors.arr = errors.arr ?? "An open deal needs a TCV above zero (PAYG excepted).";
  }
  if (opp.status === "won") {
    if (!opp.signedDate) errors.signedDate = "Closed won requires a signed date.";
    else if (!isIsoDate(opp.signedDate)) errors.signedDate = "Signed date is not a valid date.";
  } else if (opp.signedDate) {
    errors.signedDate = "Only a Closed won deal has a signed date.";
  }
  if ((opp.status === "lost" || opp.status === "disqualified") && !opp.statusReason?.trim()) {
    errors.statusReason = "Closed lost and Disqualified need a reason.";
  }
  if (opp.closeDate && !isIsoDate(opp.closeDate)) errors.closeDate = "Close date is not a valid date.";
  return errors;
}

/**
 * DR-07: the template variant is fixed at creation. Land and Expand is "expand" when the Account
 * already has a Won opportunity signed before this one's creation date; otherwise "land".
 */
export function deriveTemplateVariant(
  dealType: DealType,
  accountId: string,
  createdAt: IsoDate,
  existing: readonly Opportunity[],
): TemplateVariant {
  if (dealType === "payg") return "none";
  if (dealType === "major_accounts") return "major_accounts";
  const priorWin = existing.some(
    (o) => o.accountId === accountId && o.status === "won" && o.signedDate !== null && o.signedDate < createdAt,
  );
  return priorWin ? "expand" : "land";
}

/** Fields whose edits DR-04 restricts and DR-13 lists as bridge causes. ARR, term and non-recurring make up TCV. */
export const RESTRICTED_OPPORTUNITY_FIELDS = ["tcv", "arr", "termMonths", "nonRecurring", "status", "signedDate", "managerId"] as const;

/**
 * DR-04: TCV, status, signed date or manager may be edited by the deal's Sales Manager or RevOps.
 * Archiving an Opportunity removes it from the forecast (C-3), so it carries the same right (implementation decision P2-1).
 */
export function canEditRestrictedFields(actor: User, opp: Pick<Opportunity, "managerId">): boolean {
  return actor.role === "revops" || (actor.role === "sales_manager" && actor.id === opp.managerId);
}

export function restrictedFieldsChanged(before: Opportunity, after: Opportunity): boolean {
  return RESTRICTED_OPPORTUNITY_FIELDS.some((f) => before[f] !== after[f]);
}

/** Display names (Liran, 16 Nov): "Big Deal" for major_accounts. */
export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  major_accounts: "Big Deal",
  land_and_expand: "Land and Expand",
  payg: "PAYG",
};

/** Field name in the ChangeLog (snake_case, as in the PRD data model). */
export const OPPORTUNITY_LOG_FIELD: Partial<Record<keyof Opportunity, string>> = {
  name: "name",
  ownerName: "owner",
  managerId: "manager",
  arr: "arr",
  termMonths: "term_months",
  nonRecurring: "non_recurring",
  tcv: "tcv",
  status: "status",
  statusReason: "status_reason",
  signedDate: "signed_date",
  closeDate: "close_date",
  stage: "stage",
  archivedAt: "archived_at",
};
