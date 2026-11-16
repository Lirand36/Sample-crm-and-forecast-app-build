"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { archiveOpportunity, changeLogFor, updateOpportunity } from "@/application/crm";
import { canEditRestrictedFields, DEAL_TYPE_LABEL, STATUS_LABEL } from "@/domain/crm-rules";
import { formatDisplayDate } from "@/domain/dates";
import { CONDITION_LABEL, CONDITION_NUMBER } from "@/domain/entities";
import { formatUsd } from "@/domain/money";
import { ChangeHistory, CrmTabs, FormError, useStoreQuery } from "@/features/crm/ui";
import { OpportunityForm } from "@/features/crm/OpportunityForm";
import { useStore } from "@/features/shell/StoreProvider";

const SOURCE_LABEL = { seeded: "Seeded demo", manual: "Manual import", live: "Live" } as const;
const ORIGIN_LABEL = { customer: "Customer", external: "External", internal: "Internal (claimed by us)" } as const;

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
      const [account, accounts, users, events, conditions, history] = await Promise.all([
        s.repos.accounts.get(opportunity.accountId),
        s.repos.accounts.list(),
        s.repos.users.list(),
        s.repos.events.list(),
        s.repos.dealConditions.list(),
        changeLogFor(s, id),
      ]);
      return {
        opportunity,
        account,
        accounts,
        users,
        history,
        events: events.filter((e) => e.opportunityId === id).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : b.seq - a.seq)),
        conditions: conditions.filter((c) => c.opportunityId === id).sort((a, b) => CONDITION_NUMBER[a.type] - CONDITION_NUMBER[b.type]),
      };
    },
    [id],
  );

  if (!data) return <p>Loading…</p>;
  if (!data.opportunity) {
    return (
      <section>
        <CrmTabs />
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
      await refresh();
    } else setArchiveError(Object.values(result.errors)[0]);
  }

  return (
    <section>
      <CrmTabs />
      <p className="crumbs">
        <Link href="/crm/opportunities">Opportunities</Link> /
      </p>
      <div className="page-head">
        <h1>
          {o.name} {o.archivedAt ? <span className="badge">Archived {formatDisplayDate(o.archivedAt)}</span> : null}
        </h1>
        {!o.archivedAt && !editing ? (
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setArchiving(true)}
              disabled={!canArchive}
              title={canArchive ? undefined : "Only the deal's Sales Manager or RevOps can archive it."}
            >
              Archive
            </button>
          </div>
        ) : null}
      </div>

      {archiving ? (
        <form className="form inline-form" onSubmit={submitArchive}>
          <p>
            Archiving removes this deal from the forecast. Nothing is deleted: the record, its Events and its history stay
            visible here.
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
      ) : null}

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
              await refresh();
            }
            return result;
          }}
        />
      ) : (
        <dl className="details">
          <div><dt>Account</dt><dd>{data.account?.name} <span className="muted small">· {data.account?.segment}, {data.account?.market}</span></dd></div>
          <div><dt>Deal type</dt><dd>{DEAL_TYPE_LABEL[o.dealType]}{o.dealType === "land_and_expand" ? ` (${o.templateVariant} variant)` : ""}</dd></div>
          <div><dt>Template</dt><dd>{o.templateVariant === "none" ? "None (PAYG is not forecast)" : `${o.templateVariant} v${o.templateVersion}`}</dd></div>
          <div><dt>TCV</dt><dd>{o.tcv === null ? "—" : formatUsd(o.tcv)}</dd></div>
          <div><dt>Status</dt><dd>{STATUS_LABEL[o.status]}{o.signedDate ? `, signed ${formatDisplayDate(o.signedDate)}` : ""}{o.statusReason ? ` — ${o.statusReason}` : ""}</dd></div>
          <div><dt>Sales Manager</dt><dd>{manager?.name}{manager?.team ? ` (${manager.team})` : ""}</dd></div>
          <div><dt>Owner</dt><dd>{o.ownerName}</dd></div>
          <div><dt>CRM close date</dt><dd>{o.closeDate ? formatDisplayDate(o.closeDate) : "—"}</dd></div>
          <div><dt>CRM stage</dt><dd>{o.stage ?? "—"}</dd></div>
          <div><dt>Created</dt><dd>{formatDisplayDate(o.createdAt)}</dd></div>
        </dl>
      )}

      <p className="muted small">The forecast Deal screen for this opportunity arrives in Phase 8.</p>

      {data.conditions.length ? (
        <>
          <h2>Conditions before signature</h2>
          <p className="muted small">Their state comes from Evidence and is shown on the forecast Deal screen; the CRM only holds the template and owners.</p>
          <ol className="conditions">
            {data.conditions.map((c) => (
              <li key={c.id} value={CONDITION_NUMBER[c.type]}>
                {CONDITION_LABEL[c.type]} <span className="muted small">· owner: {c.owner}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <h2>Events ({data.events.length})</h2>
      <p className="muted small">Read-only. Events arrive through seeded data or manual import and are never typed into the CRM.</p>
      {data.events.length === 0 ? (
        <p className="muted">No Events on this opportunity.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Origin</th>
              <th>From</th>
              <th>Text</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td>{formatDisplayDate(e.occurredAt)}</td>
                <td>
                  <span className="badge">{SOURCE_LABEL[e.sourceLabel]}</span>
                  <div className="muted small">{e.sourceType.replace(/_/g, " ")}</div>
                </td>
                <td>{ORIGIN_LABEL[e.origin]}</td>
                <td className="small">{e.sender ?? "—"}</td>
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
    </section>
  );
}
