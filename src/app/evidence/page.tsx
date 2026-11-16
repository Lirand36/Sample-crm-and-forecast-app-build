"use client";

import Link from "next/link";
import { useState } from "react";
import { reviewEvidence } from "@/application/evidence";
import { evidenceStatus, gradeOf, type EvidenceStatus } from "@/domain/condition-state";
import { formatDisplayDate } from "@/domain/dates";
import { CONDITION_LABEL, type DealEvent, type Evidence } from "@/domain/entities";
import { allowedActions, isReviewOverdue, refusalReason, type ReviewAction } from "@/domain/evidence-review";
import { useStoreQuery } from "@/features/crm/ui";
import { CONTACT_ROLE_LABEL } from "@/features/shell/labels";
import { useStore } from "@/features/shell/StoreProvider";

const GRADE_LABEL = { direct: "Direct", stated: "Stated", asserted: "Claimed by us" } as const;
const STATUS_LABEL: Record<EvidenceStatus, string> = {
  waiting: "Waiting: no effect until approved",
  provisional: "Applied now, awaiting confirmation",
  approved: "Approved",
  confirmed: "Confirmed",
  rejected: "Rejected",
  duplicate: "Duplicate",
  unverifiable: "Unverifiable",
};
const ACTION_LABEL: Record<ReviewAction, string> = { approve: "Approve", confirm: "Confirm", reject: "Reject" };

export default function EvidenceReviewPage() {
  const { store, actingUser, refresh, session } = useStore();
  const data = useStoreQuery(async (s) => {
    const [evidence, decisions, events, opportunities, accounts, contacts, users] = await Promise.all([
      s.repos.evidence.list(),
      s.repos.evidenceDecisions.list(),
      s.repos.events.list(),
      s.repos.opportunities.list(),
      s.repos.accounts.list(),
      s.repos.contacts.list(),
      s.repos.users.list(),
    ]);
    return { evidence, decisions, events: new Map(events.map((e) => [e.id, e])), opportunities, accounts, contacts, users };
  });
  if (!data) return <p>Loading…</p>;

  const asOf = session.asOfDate;
  const rows = data.evidence
    .map((e) => ({ e, ev: data.events.get(e.eventId)!, status: evidenceStatus(e, data.decisions), opp: data.opportunities.find((o) => o.id === e.opportunityId)! }))
    .filter((r) => r.ev && r.opp && r.ev.occurredAt <= asOf && r.e.claim !== "status" && !r.opp.archivedAt);
  const queue = rows
    .filter((r) => r.status === "waiting" || r.status === "provisional")
    .sort((a, b) => (a.ev.occurredAt < b.ev.occurredAt ? -1 : 1));
  const reviewed = data.decisions
    .filter((d) => d.actorId !== null)
    .sort((a, b) => b.seq - a.seq)
    .slice(0, 25)
    .map((d) => ({ d, row: rows.find((r) => r.e.id === d.evidenceId) }))
    .filter((x) => x.row);

  const accountName = (accountId: string) => data.accounts.find((a) => a.id === accountId)?.name ?? "";
  const userName = (id: string | null) => data.users.find((u) => u.id === id)?.name ?? "System";

  return (
    <section>
      <p className="crumbs">
        <Link href="/forecast">Forecast</Link> /
      </p>
      <h1>Evidence review</h1>
      <p className="muted section-intro">
        What the system read from customer emails and documents. Good news changes nothing until someone approves it. Bad news applies at
        once and stays applied until someone confirms or rejects it with a reason. Every decision is logged with the person&apos;s name.
      </p>

      <h2>Waiting for review ({queue.length})</h2>
      {queue.length === 0 ? <p className="muted">Nothing waiting.</p> : null}
      <div className="review-list">
        {queue.map((r) => (
          <ReviewCard
            key={r.e.id}
            e={r.e}
            ev={r.ev}
            status={r.status}
            deal={accountName(r.opp.accountId)}
            dealId={r.opp.id}
            contactRole={roleOf(r.ev, data.contacts)}
            overdue={isReviewOverdue(r.status, r.ev, asOf)}
            actions={allowedActions(actingUser, r.opp, r.e, r.status)}
            refusal={refusalReason(actingUser, r.opp, r.e, r.status)}
            onAct={async (action, reason) => {
              const res = await reviewEvidence(store, r.e.id, action, reason);
              if (res.ok) await refresh(`${action === "reject" ? "Rejected" : action === "approve" ? "Approved" : "Confirmed"}: ${r.e.summary}`);
              return res.ok ? null : Object.values(res.errors)[0] ?? "Refused.";
            }}
          />
        ))}
      </div>

      <h2>Review log</h2>
      <table className="table compact">
        <thead>
          <tr>
            <th>Date</th>
            <th>Deal</th>
            <th>Claim</th>
            <th>Decision</th>
            <th>By</th>
            <th>Reason</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reviewed.map(({ d, row }) => {
            const r = row!;
            const canOverturn = r.status === d.decision && allowedActions(actingUser, r.opp, r.e, r.status).includes("reject");
            return (
              <tr key={d.id}>
                <td className="nowrap">{formatDisplayDate(d.at)}</td>
                <td><Link href={`/forecast/deals/${r.opp.id}`}>{accountName(r.opp.accountId)}</Link></td>
                <td className="small">{r.e.summary}</td>
                <td>{STATUS_LABEL[d.decision as EvidenceStatus] ?? d.decision}</td>
                <td>{userName(d.actorId)}</td>
                <td className="small">{d.reason ?? "—"}</td>
                <td>{canOverturn ? <OverturnButton onAct={async (reason) => { const res = await reviewEvidence(store, r.e.id, "reject", reason); if (res.ok) await refresh(); return res.ok ? null : Object.values(res.errors)[0] ?? "Refused."; }} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function roleOf(ev: DealEvent, contacts: { email: string; role: keyof typeof CONTACT_ROLE_LABEL; title: string }[]) {
  const c = contacts.find((x) => x.email === ev.sender?.toLowerCase());
  return c ? `${c.title} · ${CONTACT_ROLE_LABEL[c.role]}` : null;
}

function ReviewCard(props: {
  e: Evidence;
  ev: DealEvent;
  status: EvidenceStatus;
  deal: string;
  dealId: string;
  contactRole: string | null;
  overdue: boolean;
  actions: ReviewAction[];
  refusal: string;
  onAct: (a: ReviewAction, reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { e, ev } = props;
  return (
    <div className={`review-card ${props.status}`}>
      <div className="review-head">
        <Link href={`/forecast/deals/${props.dealId}`}><strong>{props.deal}</strong></Link>
        <span className="muted small"> · {CONDITION_LABEL[e.conditionType]} · {formatDisplayDate(ev.occurredAt)}</span>
        {props.overdue ? <span className="badge overdue">Overdue</span> : null}
      </div>
      <div className="review-claim">{e.summary}</div>
      <div className="quote">&ldquo;{e.quote}&rdquo;</div>
      <div className="muted small">
        From {ev.sender ?? "unknown"}{props.contactRole ? ` (${props.contactRole})` : ""} · {GRADE_LABEL[gradeOf(ev)]} · {STATUS_LABEL[props.status]}
      </div>
      {props.actions.length ? (
        <div className="review-actions">
          {props.actions.filter((a) => a !== "reject").map((a) => (
            <button key={a} type="button" className="btn btn-primary" onClick={async () => setError(await props.onAct(a, ""))}>
              {ACTION_LABEL[a]}
            </button>
          ))}
          {props.actions.includes("reject") ? (
            <>
              <input placeholder="Reason to reject" value={reason} onChange={(x) => setReason(x.target.value)} aria-label="Reason to reject" />
              <button type="button" className="btn" onClick={async () => setError(await props.onAct("reject", reason))}>Reject</button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="muted small">{props.refusal}</div>
      )}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}

function OverturnButton({ onAct }: { onAct: (reason: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button type="button" className="link-button" onClick={() => setOpen(true)}>Overturn…</button>;
  return (
    <div className="review-actions">
      <input placeholder="Reason" value={reason} onChange={(x) => setReason(x.target.value)} aria-label="Reason to overturn" />
      <button type="button" className="btn btn-danger" onClick={async () => setError(await onAct(reason))}>Reject</button>
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
