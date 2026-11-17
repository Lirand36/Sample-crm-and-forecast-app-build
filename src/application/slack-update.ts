// A Sales Manager logs, from Slack, what a customer said on a call. It becomes an Event and one Evidence
// record, read by the same rules as any synced email: good news waits for review, bad news applies at once.
// Our own words never move a step (PRD §4B: asserted Evidence is not read), so the update names the customer
// contact who said it.

import { compareDates, isIsoDate, type IsoDate } from "@/domain/dates";
import { CONDITION_LABEL, type ConditionType, type DealEvent, type Evidence } from "@/domain/entities";
import { eventContentHash } from "@/domain/hash";
import { EXTRACTION_VERSION } from "@/seed/canonical";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import type { DataStore } from "./ports";

export type CustomerUpdateKind = "started" | "progress" | "done" | "blocked";

export interface CustomerUpdateInput {
  opportunityId: string;
  conditionType: ConditionType;
  kind: CustomerUpdateKind;
  contactId: string;
  /** The customer's words, as close to verbatim as the manager can give them. */
  quote: string;
  /** Blocked only: the date the customer gave for the end of the hold; null when they gave none. */
  until: IsoDate | null;
}

const SUMMARY: Record<CustomerUpdateKind, string> = {
  started: "started",
  progress: "progress",
  done: "done",
  blocked: "on hold",
};

export async function logCustomerUpdate(
  store: DataStore,
  input: CustomerUpdateInput,
): Promise<CrmResult<{ event: DealEvent; evidence: Evidence }>> {
  const session = await readSession(store);
  const [actor, opp, contact] = await Promise.all([
    store.repos.users.get(session.actingUserId),
    store.repos.opportunities.get(input.opportunityId),
    store.repos.contacts.get(input.contactId),
  ]);
  if (!opp) return { ok: false, errors: { form: "Deal not found." } };
  if (!actor || (actor.role === "sales_manager" ? actor.id !== opp.managerId : !["vp_sales", "revops"].includes(actor.role))) {
    return { ok: false, errors: { form: "Only the deal's Sales Manager, the VP Sales or RevOps can log a customer update." } };
  }
  if (!contact || contact.accountId !== opp.accountId) return { ok: false, errors: { contactId: "Pick who at the customer said it." } };
  const quote = input.quote.trim();
  if (quote.length < 8) return { ok: false, errors: { quote: "Write what the customer said." } };
  if (input.kind === "blocked" && input.until !== null) {
    if (!isIsoDate(input.until) || compareDates(input.until, session.asOfDate) <= 0) {
      return { ok: false, errors: { until: "The end of the hold must be after today." } };
    }
  }
  const conditions = (await store.repos.dealConditions.list()).filter((c) => c.opportunityId === opp.id);
  if (!conditions.some((c) => c.type === input.conditionType)) {
    return { ok: false, errors: { conditionType: `${CONDITION_LABEL[input.conditionType]} is not a step on this deal.` } };
  }

  const { seq } = await reserveSeq(store, 1);
  const text = `Call notes logged from Slack by ${actor.name}. ${contact.name} (${contact.title}) said: "${quote}"`;
  const event: DealEvent = {
    id: `ev-slack-${seq}`,
    opportunityId: opp.id,
    occurredAt: session.asOfDate,
    sourceType: "meeting_transcript",
    origin: "customer",
    sender: contact.email,
    channel: "meeting",
    subject: `Call with ${contact.name}`,
    text,
    sourceLabel: "manual",
    sourceRecordId: null,
    contentHash: eventContentHash(contact.email, `${seq}\n${text}`),
    seq,
    loggedAt: session.asOfDate,
  };
  const evidence: Evidence = {
    id: `evd-slack-${seq}`,
    eventId: event.id,
    opportunityId: opp.id,
    conditionType: input.conditionType,
    claim: input.kind,
    summary: `${CONDITION_LABEL[input.conditionType]}: ${SUMMARY[input.kind]}`,
    quote,
    blockStart: input.kind === "blocked" ? session.asOfDate : null,
    blockEnd: input.kind === "blocked" ? input.until : null,
    contraryKind: null,
    extractionVersion: EXTRACTION_VERSION,
    confidence: null,
  };
  await store.repos.events.append(event);
  await store.repos.evidence.append(evidence);
  return { ok: true, value: { event, evidence } };
}
