// Why a deal moved since the baseline run, in the user's terms: the email quote or CRM edit behind it.

import type { Bridge } from "@/domain/bridge";
import { evidenceStatus } from "@/domain/condition-state";
import { compareDates, type IsoDate } from "@/domain/dates";
import { REVERSING_CLAIMS } from "@/domain/entities";
import { formatMillions, type Cents } from "@/domain/money";
import type { DataStore } from "./ports";

export interface MoveReason {
  date: IsoDate;
  /** "email" shows a quote; "crm" shows the edit. */
  kind: "email" | "crm";
  who: string;
  text: string;
  quote: string | null;
}

const after = (d: IsoDate, from: IsoDate, to: IsoDate) => compareDates(d, from) > 0 && compareDates(d, to) <= 0;
const FIELD: Record<string, string> = { status: "Status", tcv: "Value", stage: "Stage", signed_date: "Signed date", manager: "Manager" };

export async function loadMoveReasons(store: DataStore, bridge: Bridge, asOf: IsoDate): Promise<Map<string, MoveReason[]>> {
  const [events, evidence, decisions, changeLog, users, contacts] = await Promise.all([
    store.repos.events.list(), store.repos.evidence.list(), store.repos.evidenceDecisions.list(),
    store.repos.changeLog.list(), store.repos.users.list(), store.repos.contacts.list(),
  ]);
  const from = bridge.baseline.asOfDate;
  const out = new Map<string, MoveReason[]>();
  const person = (email: string | null) => {
    if (!email) return "unknown sender";
    const c = contacts.find((x) => x.email === email);
    return c ? `${c.name}, ${c.title}` : (users.find((u) => u.id === email)?.name ?? email);
  };
  for (const line of bridge.lines)
    for (const m of line.moves) {
      const reasons: MoveReason[] = [];
      for (const c of changeLog.filter((x) => x.entityId === m.opportunityId && FIELD[x.field] && after(x.at, from, asOf))) {
        const v = (x: string | null) => (x === null ? "—" : c.field === "tcv" ? formatMillions(Number(x) as Cents) : x);
        reasons.push({
          date: c.at,
          kind: "crm",
          who: users.find((u) => u.id === c.actorId)?.name ?? c.actorId,
          text: `${FIELD[c.field]} changed from ${v(c.oldValue)} to ${v(c.newValue)} in the CRM`,
          quote: null,
        });
      }
      // The email that moved it: newest applied claim in the window, reversing claims first.
      const applied = evidence
        .filter((e) => e.opportunityId === m.opportunityId && e.claim !== "status")
        .map((e) => ({ e, ev: events.find((x) => x.id === e.eventId), st: evidenceStatus(e, decisions) }))
        .filter((x) => x.ev && after(x.ev.occurredAt, from, asOf) && !["rejected", "duplicate", "unverifiable", "waiting"].includes(x.st))
        .sort((a, b) => Number(REVERSING_CLAIMS.includes(b.e.claim)) - Number(REVERSING_CLAIMS.includes(a.e.claim)) || compareDates(b.ev!.occurredAt, a.ev!.occurredAt));
      const top = applied[0];
      if (top) reasons.push({ date: top.ev!.occurredAt, kind: "email", who: person(top.ev!.sender), text: top.e.summary, quote: top.e.quote });
      out.set(m.opportunityId, reasons);
    }
  return out;
}
