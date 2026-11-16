"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { archiveAccount, changeLogFor, updateAccount } from "@/application/crm";
import { DEAL_TYPE_LABEL } from "@/domain/crm-rules";
import { formatDisplayDate } from "@/domain/dates";
import { formatMillions } from "@/domain/money";
import { AccountForm } from "@/features/crm/AccountForm";
import { ChangeHistory, FormError, useStoreQuery } from "@/features/crm/ui";
import { CONTACT_ROLE_LABEL } from "@/features/shell/labels";
import { useStore } from "@/features/shell/StoreProvider";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { store, actingUser, refresh } = useStore();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveError, setArchiveError] = useState<string | undefined>();

  const data = useStoreQuery(
    async (s) => {
      const account = await s.repos.accounts.get(id);
      if (!account) return { account: undefined } as const;
      const [opportunities, contacts, users, history] = await Promise.all([
        s.repos.opportunities.list(),
        s.repos.contacts.list(),
        s.repos.users.list(),
        changeLogFor(s, id),
      ]);
      return {
        account,
        users,
        history,
        opportunities: opportunities.filter((o) => o.accountId === id).sort((a, b) => a.name.localeCompare(b.name)),
        contacts: contacts.filter((c) => c.accountId === id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
      };
    },
    [id],
  );

  if (!data) return <p>Loading…</p>;
  if (!data.account) {
    return (
      <section>
        <h1>Account not found</h1>
        <p>
          <Link href="/crm/accounts">Back to accounts</Link>
        </p>
      </section>
    );
  }
  const a = data.account;
  const canArchive = actingUser.role === "revops";

  async function submitArchive(e: FormEvent) {
    e.preventDefault();
    const result = await archiveAccount(store, a.id, archiveReason);
    if (result.ok) {
      setArchiving(false);
      setArchiveError(undefined);
      await refresh();
    } else setArchiveError(Object.values(result.errors)[0]);
  }

  return (
    <section>
      <p className="crumbs">
        <Link href="/crm/accounts">Accounts</Link> /
      </p>
      <div className="page-head">
        <div>
          <h1>
            {a.name} {a.archivedAt ? <span className="badge">Archived {formatDisplayDate(a.archivedAt)}</span> : null}
          </h1>
          <p className="muted subtitle">
            {a.segment} · {a.market}
          </p>
        </div>
        {!a.archivedAt && !editing ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <AccountForm
          account={a}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const result = await updateAccount(store, a.id, input);
            if (result.ok) {
              setEditing(false);
              await refresh();
            }
            return result;
          }}
        />
      ) : (
        <dl className="details">
          <div><dt>Segment</dt><dd>{a.segment}</dd></div>
          <div><dt>Market</dt><dd>{a.market}</dd></div>
          <div><dt>Owner</dt><dd>{a.ownerName}</dd></div>
          <div><dt>Email domains</dt><dd>{a.emailDomains.join(", ") || "—"}</dd></div>
        </dl>
      )}

      <div className="section-head">
        <h2>Opportunities ({data.opportunities.length})</h2>
      </div>
      {data.opportunities.length === 0 ? (
        <p className="muted">No opportunities on this account.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Deal type</th>
              <th>Manager</th>
              <th className="num">TCV</th>
              <th>Stage</th>
              <th>Close date</th>
            </tr>
          </thead>
          <tbody>
            {data.opportunities.map((o) => (
              <tr key={o.id} className={o.archivedAt ? "archived" : undefined}>
                <td>
                  <Link href={`/crm/opportunities/${o.id}`}>{o.name}</Link>
                  {o.archivedAt ? <span className="badge">Archived</span> : null}
                </td>
                <td>{DEAL_TYPE_LABEL[o.dealType]}</td>
                <td>{data.users.find((u) => u.id === o.managerId)?.name}</td>
                <td className="num">{o.tcv === null ? "—" : formatMillions(o.tcv)}</td>
                <td>{o.stage}</td>
                <td>{o.signedDate ? formatDisplayDate(o.signedDate) : o.closeDate ? formatDisplayDate(o.closeDate) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-head">
        <h2>Contacts ({data.contacts.length})</h2>
        {!a.archivedAt ? (
          <Link className="btn" href={`/crm/contacts/new?account=${a.id}`}>
            Add contact
          </Link>
        ) : null}
      </div>
      {data.contacts.length === 0 ? (
        <p className="muted">No contacts on this account.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Role on the deal</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {data.contacts.map((c) => (
              <tr key={c.id} className={c.active ? undefined : "archived"}>
                <td>
                  <Link href={`/crm/contacts/${c.id}`}>{c.name}</Link>
                  {c.active ? null : <span className="badge">Left the company</span>}
                </td>
                <td>{c.title}</td>
                <td>{CONTACT_ROLE_LABEL[c.role]}</td>
                <td className="small">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Change history</h2>
      <ChangeHistory entries={data.history} users={data.users} />

      {!a.archivedAt ? (
        <div className="more-actions">
          {archiving ? (
            <form className="form" onSubmit={submitArchive}>
              <p>Archive an account that is no longer a prospect or customer. It disappears from pick lists; its history is kept.</p>
              <FormError message={archiveError} />
              <label className="field">
                <span className="field-label">Reason</span>
                <input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} autoFocus />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn-danger">Archive account</button>
                <button type="button" className="btn" onClick={() => setArchiving(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="link-button"
              onClick={() => setArchiving(true)}
              disabled={!canArchive}
              title={canArchive ? undefined : "Only RevOps can archive an account."}
            >
              Archive this account…
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
