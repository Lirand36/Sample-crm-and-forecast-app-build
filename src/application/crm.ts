// CRM application services (handoff Part IV, DR-04, DR-07, DR-13).
// Every create, edit and archive is validated, rights-checked and written to the ChangeLog
// with author and (simulated) time. Nothing is ever deleted.

import type { IsoDate } from "@/domain/dates";
import {
  canEditRestrictedFields,
  computeTcv,
  deriveTemplateVariant,
  normaliseDomain,
  OPPORTUNITY_LOG_FIELD,
  restrictedFieldsChanged,
  validateAccount,
  validateContact,
  validateOpportunity,
  type FieldErrors,
} from "@/domain/crm-rules";
import type {
  Account,
  ChangeLogEntry,
  Contact,
  ContactRole,
  DealType,
  Opportunity,
  Stage,
  User,
} from "@/domain/entities";
import { statusForStage } from "@/domain/entities";
import type { Cents } from "@/domain/money";
import { readSession, reserveSeq } from "./clock";
import type { DataStore } from "./ports";

export type CrmResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const fail = <T>(errors: FieldErrors): CrmResult<T> => ({ ok: false, errors });
const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;

async function actingUser(store: DataStore): Promise<User> {
  const session = await readSession(store);
  const user = await store.repos.users.get(session.actingUserId);
  if (!user) throw new Error("Acting user not found");
  return user;
}

function toLogValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

async function writeChanges(
  store: DataStore,
  entity: ChangeLogEntry["entity"],
  entityId: string,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
  actorId: string,
  reason: string | null,
): Promise<void> {
  if (changes.length === 0) return;
  const { seq, at } = await reserveSeq(store, changes.length);
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i]!;
    await store.repos.changeLog.append({
      id: `chg-${seq + i}`,
      entity,
      entityId,
      field: c.field,
      oldValue: toLogValue(c.oldValue),
      newValue: toLogValue(c.newValue),
      actorId,
      at,
      seq: seq + i,
      reason,
    });
  }
}

function diff<T extends object>(before: T, after: T, fieldNames: Partial<Record<keyof T, string>>) {
  const out: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  for (const key of Object.keys(fieldNames) as Array<keyof T>) {
    const a = before[key];
    const b = after[key];
    const same = Array.isArray(a) && Array.isArray(b) ? a.join("\u0000") === b.join("\u0000") : a === b;
    if (!same) out.push({ field: fieldNames[key]!, oldValue: a, newValue: b });
  }
  return out;
}

async function nextId(store: DataStore, prefix: string, exists: (id: string) => Promise<unknown>): Promise<string> {
  const { seq } = await reserveSeq(store);
  let id = `${prefix}-${seq}`;
  let n = 1;
  while (await exists(id)) id = `${prefix}-${seq}-${n++}`;
  return id;
}

// ---------- Accounts ----------

export interface AccountInput {
  name: string;
  emailDomains: string[];
  segment: string;
  market: string;
  ownerName: string;
}

const ACCOUNT_FIELDS: Partial<Record<keyof Account, string>> = {
  name: "name",
  emailDomains: "email_domains",
  segment: "segment",
  market: "market",
  ownerName: "owner",
  archivedAt: "archived_at",
};

function cleanAccountInput(input: AccountInput): AccountInput {
  return {
    name: input.name.trim(),
    emailDomains: input.emailDomains.map(normaliseDomain).filter(Boolean),
    segment: input.segment.trim(),
    market: input.market.trim(),
    ownerName: input.ownerName.trim(),
  };
}

export async function createAccount(store: DataStore, input: AccountInput): Promise<CrmResult<Account>> {
  const actor = await actingUser(store);
  const draft: Account = { id: "new", ...cleanAccountInput(input), archivedAt: null };
  const errors = validateAccount(draft, await store.repos.accounts.list());
  if (hasErrors(errors)) return fail(errors);
  const account = { ...draft, id: await nextId(store, "acc", (id) => store.repos.accounts.get(id)) };
  await store.repos.accounts.put(account);
  await writeChanges(store, "account", account.id, [{ field: "created", oldValue: null, newValue: account.name }], actor.id, null);
  return { ok: true, value: account };
}

export async function updateAccount(store: DataStore, id: string, input: AccountInput): Promise<CrmResult<Account>> {
  const actor = await actingUser(store);
  const before = await store.repos.accounts.get(id);
  if (!before) return fail({ form: "Account not found." });
  if (before.archivedAt) return fail({ form: "This Account is archived and cannot be edited." });
  const after: Account = { ...before, ...cleanAccountInput(input) };
  const errors = validateAccount(after, await store.repos.accounts.list());
  if (hasErrors(errors)) return fail(errors);
  await store.repos.accounts.put(after);
  await writeChanges(store, "account", id, diff(before, after, ACCOUNT_FIELDS), actor.id, null);
  return { ok: true, value: after };
}

export async function archiveAccount(store: DataStore, id: string, reason: string): Promise<CrmResult<Account>> {
  const actor = await actingUser(store);
  const before = await store.repos.accounts.get(id);
  if (!before) return fail({ form: "Account not found." });
  if (before.archivedAt) return fail({ form: "Already archived." });
  if (!reason.trim()) return fail({ reason: "A reason is required to archive." });
  if (actor.role !== "revops") return fail({ form: "Only RevOps can archive an Account." });
  const live = (await store.repos.opportunities.list()).filter((o) => o.accountId === id && !o.archivedAt && o.status === "open");
  if (live.length) return fail({ form: `Archive or close its ${live.length} open opportunit${live.length === 1 ? "y" : "ies"} first.` });
  const { at } = await readSession(store).then((s) => ({ at: s.asOfDate }));
  const after = { ...before, archivedAt: at };
  await store.repos.accounts.put(after);
  await writeChanges(store, "account", id, [{ field: "archived_at", oldValue: null, newValue: at }], actor.id, reason.trim());
  return { ok: true, value: after };
}

// ---------- Contacts ----------

export interface ContactInput {
  accountId: string;
  name: string;
  title: string;
  email: string;
  role: ContactRole;
  active: boolean;
}

const CONTACT_FIELDS: Partial<Record<keyof Contact, string>> = {
  accountId: "account",
  name: "name",
  title: "title",
  email: "email",
  role: "role",
  active: "active",
};

function cleanContactInput(input: ContactInput): ContactInput {
  return { ...input, name: input.name.trim(), title: input.title.trim(), email: input.email.trim().toLowerCase() };
}

export async function createContact(store: DataStore, input: ContactInput): Promise<CrmResult<Contact>> {
  const actor = await actingUser(store);
  const accounts = await store.repos.accounts.list();
  const draft: Contact = { id: "new", ...cleanContactInput(input) };
  const errors = validateContact(draft, accounts);
  if (accounts.find((a) => a.id === draft.accountId)?.archivedAt) errors.accountId = "This Account is archived.";
  if (hasErrors(errors)) return fail(errors);
  const contact = { ...draft, id: await nextId(store, "con", (id) => store.repos.contacts.get(id)) };
  await store.repos.contacts.put(contact);
  await writeChanges(store, "contact", contact.id, [{ field: "created", oldValue: null, newValue: contact.name }], actor.id, null);
  return { ok: true, value: contact };
}

export async function updateContact(store: DataStore, id: string, input: ContactInput): Promise<CrmResult<Contact>> {
  const actor = await actingUser(store);
  const before = await store.repos.contacts.get(id);
  if (!before) return fail({ form: "Contact not found." });
  const after: Contact = { ...before, ...cleanContactInput(input) };
  const errors = validateContact(after, await store.repos.accounts.list());
  if (hasErrors(errors)) return fail(errors);
  await store.repos.contacts.put(after);
  await writeChanges(store, "contact", id, diff(before, after, CONTACT_FIELDS), actor.id, null);
  return { ok: true, value: after };
}

// ---------- Opportunities ----------

export interface RevenueInput {
  arr: Cents | null;
  termMonths: number | null;
  nonRecurring: Cents | null;
}

export interface OpportunityCreateInput extends RevenueInput {
  accountId: string;
  name: string;
  ownerName: string;
  managerId: string;
  dealType: DealType;
  closeDate: IsoDate | null;
  stage: Stage;
}

export interface OpportunityEditInput extends RevenueInput {
  name: string;
  ownerName: string;
  managerId: string;
  /** The status follows from the stage. */
  stage: Stage;
  statusReason: string | null;
  signedDate: IsoDate | null;
  closeDate: IsoDate | null;
}

export async function createOpportunity(store: DataStore, input: OpportunityCreateInput): Promise<CrmResult<Opportunity>> {
  const actor = await actingUser(store);
  const session = await readSession(store);
  const [accounts, users, existing, templates] = await Promise.all([
    store.repos.accounts.list(),
    store.repos.users.list(),
    store.repos.opportunities.list(),
    store.repos.conditionTemplates.list(),
  ]);
  const createdAt = session.asOfDate;
  // DR-07: variant and template version are derived once, here, and never change.
  const templateVariant = deriveTemplateVariant(input.dealType, input.accountId, createdAt, existing);
  const template =
    templateVariant === "none"
      ? undefined
      : templates.filter((t) => t.variant === templateVariant).sort((a, b) => b.version - a.version)[0];
  if (templateVariant !== "none" && !template) return fail({ dealType: "No Condition template exists for this deal type." });

  const draft: Opportunity = {
    id: "new",
    accountId: input.accountId,
    name: input.name.trim(),
    ownerName: input.ownerName.trim(),
    managerId: input.managerId,
    dealType: input.dealType,
    templateVariant,
    templateVersion: template?.version ?? null,
    arr: input.arr,
    termMonths: input.termMonths,
    nonRecurring: input.nonRecurring,
    tcv: computeTcv(input.arr, input.termMonths, input.nonRecurring),
    currency: "USD",
    status: statusForStage(input.stage),
    statusReason: null,
    signedDate: null,
    closeDate: input.closeDate,
    stage: input.stage,
    createdAt,
    archivedAt: null,
  };
  const errors = validateOpportunity(draft, { accounts, users });
  if (draft.status !== "open") errors.stage = "A new deal starts in an open stage.";
  if (accounts.find((a) => a.id === draft.accountId)?.archivedAt) errors.accountId = "This Account is archived.";
  if (hasErrors(errors)) return fail(errors);

  const opp = { ...draft, id: await nextId(store, "opp", (id) => store.repos.opportunities.get(id)) };
  await store.repos.opportunities.put(opp);
  for (const c of template?.conditions ?? []) {
    await store.repos.dealConditions.put({ id: `${opp.id}:${c.type}`, opportunityId: opp.id, type: c.type, owner: c.defaultOwner });
  }
  await writeChanges(
    store,
    "opportunity",
    opp.id,
    [
      { field: "created", oldValue: null, newValue: `${opp.name} (${templateVariant}${template ? ` v${template.version}` : ""})` },
      { field: "arr", oldValue: null, newValue: opp.arr },
      { field: "term_months", oldValue: null, newValue: opp.termMonths },
      { field: "non_recurring", oldValue: null, newValue: opp.nonRecurring },
      { field: "tcv", oldValue: null, newValue: opp.tcv },
      { field: "stage", oldValue: null, newValue: opp.stage },
      { field: "status", oldValue: null, newValue: opp.status },
      { field: "manager", oldValue: null, newValue: opp.managerId },
    ],
    actor.id,
    null,
  );
  return { ok: true, value: opp };
}

export async function updateOpportunity(
  store: DataStore,
  id: string,
  input: OpportunityEditInput,
  reason: string | null = null,
): Promise<CrmResult<Opportunity>> {
  const actor = await actingUser(store);
  const before = await store.repos.opportunities.get(id);
  if (!before) return fail({ form: "Opportunity not found." });
  if (before.archivedAt) return fail({ form: "This opportunity is archived and cannot be edited." });
  const status = statusForStage(input.stage);
  const after: Opportunity = {
    ...before,
    name: input.name.trim(),
    ownerName: input.ownerName.trim(),
    managerId: input.managerId,
    arr: input.arr,
    termMonths: input.termMonths,
    nonRecurring: input.nonRecurring,
    tcv: computeTcv(input.arr, input.termMonths, input.nonRecurring),
    stage: input.stage,
    status,
    statusReason: status === "lost" || status === "disqualified" ? input.statusReason?.trim() || null : null,
    signedDate: status === "won" ? input.signedDate : null,
    closeDate: input.closeDate,
  };
  if (restrictedFieldsChanged(before, after) && !canEditRestrictedFields(actor, before)) {
    return fail({ form: "Only the deal's Sales Manager or RevOps may change revenue, close the deal, or change its signed date or manager (DR-04)." });
  }
  const [accounts, users] = await Promise.all([store.repos.accounts.list(), store.repos.users.list()]);
  const errors = validateOpportunity(after, { accounts, users });
  if (hasErrors(errors)) return fail(errors);
  await store.repos.opportunities.put(after);
  await writeChanges(store, "opportunity", id, diff(before, after, OPPORTUNITY_LOG_FIELD), actor.id, reason?.trim() || null);
  return { ok: true, value: after };
}

export async function archiveOpportunity(store: DataStore, id: string, reason: string): Promise<CrmResult<Opportunity>> {
  const actor = await actingUser(store);
  const before = await store.repos.opportunities.get(id);
  if (!before) return fail({ form: "Opportunity not found." });
  if (before.archivedAt) return fail({ form: "Already archived." });
  if (!reason.trim()) return fail({ reason: "A reason is required to archive." });
  if (!canEditRestrictedFields(actor, before)) {
    return fail({ form: "Only the deal's Sales Manager or RevOps may archive it, because archiving removes it from the forecast." });
  }
  const at = (await readSession(store)).asOfDate;
  const after = { ...before, archivedAt: at };
  await store.repos.opportunities.put(after);
  await writeChanges(store, "opportunity", id, [{ field: "archived_at", oldValue: null, newValue: at }], actor.id, reason.trim());
  return { ok: true, value: after };
}

// ---------- Queries ----------

export async function changeLogFor(store: DataStore, entityId: string): Promise<ChangeLogEntry[]> {
  return (await store.repos.changeLog.list()).filter((c) => c.entityId === entityId).sort((a, b) => b.seq - a.seq);
}
