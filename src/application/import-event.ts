// Add an email to a deal: manual .eml import (D-09) with origin and grade derived (DR-05), duplicates
// by content hash or Message-ID (DR-06), Evidence from the stored fixture extraction (no model, no
// network), and the verbatim-quote check (PRD §4B.3).

import { eventContentHash } from "@/domain/hash";
import { isIsoDate, type IsoDate } from "@/domain/dates";
import type { DealEvent, Evidence, EvidenceDecision } from "@/domain/entities";
import { parseEml } from "@/infrastructure/adapters/eml";
import { EML_FIXTURES } from "@/seed/extraction-fixtures";
import { EXTRACTION_VERSION } from "@/seed/canonical";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import type { DataStore } from "./ports";

export interface ImportResult {
  event: DealEvent;
  evidence: Evidence[];
  duplicate: boolean;
  unverifiable: number;
  /** True when no stored extraction exists for this email: the event is kept, nothing is read from it. */
  unread: boolean;
}

export async function importEmail(store: DataStore, opportunityId: string, raw: string): Promise<CrmResult<ImportResult>> {
  const session = await readSession(store);
  const opp = await store.repos.opportunities.get(opportunityId);
  if (!opp) return { ok: false, errors: { form: "Deal not found." } };
  const account = await store.repos.accounts.get(opp.accountId);
  const mail = parseEml(raw);
  if (!mail.body.trim()) return { ok: false, errors: { form: "That file has no readable text." } };
  const date = mail.date && isIsoDate(mail.date) ? (mail.date as IsoDate) : session.asOfDate;
  const sender = mail.from;
  const domain = sender?.split("@")[1] ?? "";
  const origin: DealEvent["origin"] = account?.emailDomains.includes(domain) ? "customer" : "internal";

  const events = await store.repos.events.list();
  const contentHash = eventContentHash(sender, mail.body);
  const earlier = events.find((e) => e.contentHash === contentHash || (mail.messageId !== null && e.sourceRecordId === mail.messageId));

  const { seq } = await reserveSeq(store, 1);
  const event: DealEvent = {
    id: `ev-import-${seq}`,
    opportunityId,
    occurredAt: date,
    sourceType: "email",
    origin,
    sender,
    channel: "email",
    subject: mail.subject,
    text: mail.body,
    sourceLabel: "manual",
    sourceRecordId: mail.messageId,
    contentHash,
    seq,
    loggedAt: session.asOfDate,
  };
  await store.repos.events.append(event);

  const fixture = EML_FIXTURES.find((f) => f.messageId === mail.messageId);
  const evidence: Evidence[] = [];
  let unverifiable = 0;
  for (const [i, c] of (fixture?.claims ?? []).entries()) {
    const e: Evidence = {
      id: `evd-import-${seq}-${i + 1}`,
      eventId: event.id,
      opportunityId,
      conditionType: c.condition,
      claim: c.claim,
      summary: c.summary,
      quote: c.quote,
      blockStart: c.blockStart && isIsoDate(c.blockStart) ? c.blockStart : null,
      blockEnd: c.blockEnd && isIsoDate(c.blockEnd) ? c.blockEnd : null,
      contraryKind: c.contraryKind,
      extractionVersion: EXTRACTION_VERSION,
      confidence: null,
    };
    await store.repos.evidence.append(e);
    evidence.push(e);
    const systemDecision = earlier ? "duplicate" : !mail.body.includes(c.quote) ? "unverifiable" : null;
    if (systemDecision) {
      if (systemDecision === "unverifiable") unverifiable++;
      const { seq: dseq, at } = await reserveSeq(store);
      const decision: EvidenceDecision = {
        id: `dec-${dseq}`,
        evidenceId: e.id,
        decision: systemDecision,
        actorId: null,
        at,
        seq: dseq,
        reason: systemDecision === "duplicate" ? "Same email already received" : "Quote not found word for word in the email",
        duplicateOf: earlier?.id ?? null,
      };
      await store.repos.evidenceDecisions.append(decision);
    }
  }
  return { ok: true, value: { event, evidence, duplicate: !!earlier, unverifiable, unread: !fixture } };
}
