"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { archiveOpportunity, changeLogFor, updateOpportunity } from "@/application/crm";
import { signaturePathFor, type PathStep } from "@/application/signature-path";
import { canEditRestrictedFields, DEAL_TYPE_LABEL } from "@/domain/crm-rules";
import { formatDisplayDate } from "@/domain/dates";
import { CONDITION_LABEL, type DealEvent } from "@/domain/entities";
import { formatUsd } from "@/domain/money";
import { ChangeHistory, FormError, useStoreQuery } from "@/features/crm/ui";
import { OpportunityForm } from "@/features/crm/OpportunityForm";
import { SOURCE_LABEL } from "@/features/shell/labels";
import { useStore } from "@/features/shell/StoreProvider";

const EVENT_KIND: Record<DealEvent["channel"], string> = {
  email: "Email",
  document: "Document",
  meeting: "Meeting",
  news: "Announcement",
  note: "Internal note",
  paste: "Note",
  crm: "Record change",
};

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { store, actingUser, refresh } = useStore();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveError, setArchiveError] = useState<string | undefined>();

  const data = useStoreQuery(
    async (s) => {
      const opportunity = await s.repos.opportunities.get(id);
      if (!opportunity) return { opportunity: undefined } as const;
      const [account, accounts, users, events, path, history] = await Promise.all([
        s.repos.accounts.get(opportunity.accountId),
        s.repos.accounts.list(),
        s.repos.users.list(),
        s.repos.events.list(),
        signaturePathFor(s, id),
        changeLogFor(s, id),
      ]);
      return {
        opportunity,
        account,
        accounts,
        users,
        history,
        events: events
          .filter((e) => e.opportunityId === id)
          .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : b.seq - a.seq)),
        path,
      };
    },
    [id],
  );

  if (!data) return <p>Loading…</p>;
  if (!data.opportunity) {
    return (
      <section>
        <h1>Opportunity not found</h1>
        <p>
          <Link href="/crm/opportunities">Back to opportunities</Link>
        </p>
      </section>
    );
  }
  const o = data.opportunity;
  const manager = data.users.find((u) => u.id === o.managerId);
  const canArchive = canEditRestrictedFields(actingUser, o);

  async function submitArchive(e: FormEvent) {
    e.preventDefault();
    const result = await archiveOpportunity(store, o.id, archiveReason);
    if (result.ok) {
      setArchiving(false);
      setArchiveError(undefined);
      await refresh(`Archived ${o.name}`);
    } else setArchiveError(Object.values(result.errors)[0]);
  }

  return (
    <section>
      <p className="crumbs">
        <Link href="/crm/opportunities">Opportunities</Link> /
      </p>
      <div className="page-head">
        <div>
          <h1>
            {o.name} {o.archivedAt ? <span className="badge">Archived {formatDisplayDate(o.archivedAt)}</span> : null}
          </h1>
          <p className="muted subtitle">
            {data.account?.name} · {DEAL_TYPE_LABEL[o.dealType]} · <strong>{o.stage}</strong>
          </p>
        </div>
        {!o.archivedAt && !editing ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <OpportunityForm
          mode="edit"
          opportunity={o}
          accounts={data.accounts}
          users={data.users}
          actor={actingUser}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (input, reason) => {
            const result = await updateOpportunity(store, o.id, input, reason);
            if (result.ok) {
              setEditing(false);
              await refresh(`CRM edit: ${o.name}`);
            }
            return result;
          }}
        />
      ) : (
        <div className="two-col">
          <dl className="details">
            <div><dt>Account</dt><dd>{data.account ? <Link href={`/crm/accounts/${data.account.id}`}>{data.account.name}</Link> : "—"} <span className="muted small">· {data.account?.segment}, {data.account?.market}</span></dd></div>
            <div><dt>Deal type</dt><dd>{DEAL_TYPE_LABEL[o.dealType]}{o.templateVariant === "expand" ? <span className="muted small"> · expansion of an existing customer</span> : null}</dd></div>
            <div><dt>Stage</dt><dd>{o.stage}{o.statusReason ? <span className="muted small"> · {o.statusReason}</span> : null}</dd></div>
            <div><dt>{o.signedDate ? "Signed" : "Close date"}</dt><dd>{o.signedDate ? formatDisplayDate(o.signedDate) : o.closeDate ? formatDisplayDate(o.closeDate) : "—"}</dd></div>
            <div><dt>Sales Manager</dt><dd>{manager?.name}{manager?.team ? ` (${manager.team})` : ""}</dd></div>
            <div><dt>Owner</dt><dd>{o.ownerName}</dd></div>
            <div><dt>Created</dt><dd>{formatDisplayDate(o.createdAt)}</dd></div>
          </dl>
          <dl className="details revenue">
            <div><dt>Min Commit (ACV)</dt><dd>{o.arr === null ? "—" : formatUsd(o.arr)}</dd></div>
            <div><dt>Contract duration</dt><dd>{o.termMonths === null ? "—" : `${o.termMonths} months`}</dd></div>
            <div><dt>Platform fee</dt><dd>{o.nonRecurring === null ? "—" : formatUsd(o.nonRecurring)}</dd></div>
            <div className="tcv"><dt>TCV</dt><dd>{o.tcv === null ? "—" : formatUsd(o.tcv)}</dd></div>
          </dl>
        </div>
      )}

      <h2>
        Path to signature
        {data.path.length ? (
          <span className="muted small"> · {data.path.filter((p) => p.state.state === "done" || p.state.state === "waived").length} of {data.path.length} done</span>
        ) : null}
      </h2>
      {data.path.length ? (
        <>
          <p className="muted section-intro">
            The steps the customer has to complete before this contract can be signed. A step is ticked when the customer&apos;s
            own emails or documents show it is complete and a manager has approved that reading in the Forecast app. Nobody
            ticks a step by hand, and our own notes never tick one.
          </p>
          <ul className="checklist">
            {data.path.map((p) => (
              <PathRow key={p.type} step={p} />
            ))}
          </ul>
        </>
      ) : (
        <p className="muted section-intro">Pay-as-you-go deals commit no fixed value, so they have no signature path and are not forecast.</p>
      )}

      <h2>Activity ({data.events.length})</h2>
      <p className="muted section-intro">
        Emails, documents and announcements sync here from the mail integration. The Forecast app reads each new item on its own and
        turns what the customer says into evidence for the steps above.
      </p>
      {data.events.length === 0 ? (
        <p className="muted">No activity on this deal yet.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>From</th>
              <th>Content</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{formatDisplayDate(e.occurredAt)}</td>
                <td>
                  {EVENT_KIND[e.channel]}
                  <div className="muted small">{SOURCE_LABEL[e.sourceLabel]}</div>
                </td>
                <td className="small">{e.sender ?? "—"}{e.origin === "internal" ? <div className="muted">our team</div> : null}</td>
                <td>
                  {e.subject ? <strong>{e.subject}: </strong> : null}
                  {e.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Change history</h2>
      <ChangeHistory entries={data.history} users={data.users} />

      {!o.archivedAt ? (
        <div className="more-actions">
          {archiving ? (
            <form className="form" onSubmit={submitArchive}>
              <p>
                Archive this opportunity if it should not be in the pipeline at all, for example a duplicate or a record
                created by mistake. It leaves the forecast; the record and its history are kept. To record a loss, set the
                stage to Closed lost instead.
              </p>
              <FormError message={archiveError} />
              <label className="field">
                <span className="field-label">Reason</span>
                <input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} autoFocus />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn-danger">Archive opportunity</button>
                <button type="button" className="btn" onClick={() => setArchiving(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="link-button"
              onClick={() => setArchiving(true)}
              disabled={!canArchive}
              title={canArchive ? undefined : "Only the deal's Sales Manager or RevOps can archive it."}
            >
              Archive this opportunity…
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

const GRADE_TEXT = { direct: "in a signed or official document", stated: "as stated by the customer", asserted: "claimed by us" } as const;

function stepStatus(p: PathStep): { label: string; tone: string } {
  const s = p.state;
  switch (s.state) {
    case "done":
      return { label: `Done ${s.doneOn ? formatDisplayDate(s.doneOn) : ""}${s.doneGrade ? `, ${GRADE_TEXT[s.doneGrade]}` : ""}`, tone: "done" };
    case "waived":
      return { label: `Not required: ${s.waiverReason ?? ""}`, tone: "done" };
    case "blocked":
      return {
        label: s.blockedNow?.end ? `Blocked until ${formatDisplayDate(s.blockedNow.end)}` : "Blocked, no date given for when it resumes",
        tone: "blocked",
      };
    case "in_progress":
      return { label: p.latest ? `In progress, last update ${formatDisplayDate(p.latest.occurredAt)}` : "In progress", tone: "progress" };
    default:
      return { label: "Not started", tone: "todo" };
  }
}

function PathRow({ step }: { step: PathStep }) {
  const status = stepStatus(step);
  const ticked = step.state.state === "done" || step.state.state === "waived";
  return (
    <li className={`check-row ${status.tone}`}>
      <span className={ticked ? "tick ticked" : "tick"} role="checkbox" aria-checked={ticked} aria-readonly="true" aria-label={CONDITION_LABEL[step.type]}>
        {ticked ? "✓" : ""}
      </span>
      <div>
        <div className="check-title">{CONDITION_LABEL[step.type]}</div>
        <div className="check-status">{status.label}</div>
        {step.latest ? <div className="muted small">{step.latest.evidence.summary}</div> : null}
      </div>
    </li>
  );
}
