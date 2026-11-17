"use client";

import Link from "next/link";
import { EventText } from "@/features/crm/EventText";
import { useParams } from "next/navigation";
import { useState } from "react";
import { changeLogFor, updateContact } from "@/application/crm";
import { formatDisplayDate } from "@/domain/dates";
import { ContactForm } from "@/features/crm/ContactForm";
import { ChangeHistory, useStoreQuery } from "@/features/crm/ui";
import { CONTACT_ROLE_LABEL } from "@/features/shell/labels";
import { useStore } from "@/features/shell/StoreProvider";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { store, refresh } = useStore();
  const [editing, setEditing] = useState(false);

  const data = useStoreQuery(
    async (s) => {
      const contact = await s.repos.contacts.get(id);
      if (!contact) return { contact: undefined } as const;
      const [accounts, opportunities, users, events, history] = await Promise.all([
        s.repos.accounts.list(),
        s.repos.opportunities.list(),
        s.repos.users.list(),
        s.repos.events.list(),
        changeLogFor(s, id),
      ]);
      return {
        contact,
        accounts,
        dealName: new Map(opportunities.map((o) => [o.id, o.name])),
        users,
        history,
        // Emails this person sent, matched by address.
        sent: events
          .filter((e) => e.sender?.toLowerCase() === contact.email)
          .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : b.seq - a.seq)),
      };
    },
    [id],
  );

  if (!data) return <p>Loading…</p>;
  if (!data.contact) {
    return (
      <section>
        <h1>Contact not found</h1>
        <p>
          <Link href="/crm/contacts">Back to contacts</Link>
        </p>
      </section>
    );
  }
  const c = data.contact;
  const account = data.accounts.find((a) => a.id === c.accountId);

  return (
    <section>
      <p className="crumbs">
        <Link href="/crm/contacts">Contacts</Link> /
      </p>
      <div className="page-head">
        <div>
          <h1>
            {c.name} {c.active ? null : <span className="badge">Left the company</span>}
          </h1>
          <p className="muted subtitle">
            {c.title} · {account ? <Link href={`/crm/accounts/${account.id}`}>{account.name}</Link> : "—"}
          </p>
        </div>
        {!editing ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <ContactForm
          contact={c}
          accounts={data.accounts}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const result = await updateContact(store, c.id, input);
            if (result.ok) {
              setEditing(false);
              await refresh();
            }
            return result;
          }}
        />
      ) : (
        <dl className="details">
          <div><dt>Account</dt><dd>{account?.name ?? "—"}</dd></div>
          <div><dt>Title</dt><dd>{c.title}</dd></div>
          <div><dt>Role on the deal</dt><dd>{CONTACT_ROLE_LABEL[c.role]}</dd></div>
          <div><dt>Email</dt><dd>{c.email}</dd></div>
        </dl>
      )}

      <h2>Emails and documents from this person ({data.sent.length})</h2>
      {data.sent.length === 0 ? (
        <p className="muted">No messages from this person yet.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Deal</th>
              <th>Content</th>
            </tr>
          </thead>
          <tbody>
            {data.sent.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{formatDisplayDate(e.occurredAt)}</td>
                <td>
                  <Link href={`/crm/opportunities/${e.opportunityId}`}>{data.dealName.get(e.opportunityId) ?? "Deal"}</Link>
                </td>
                <td>
                  {e.subject ? <strong>{e.subject}: </strong> : null}
                  <EventText e={e} />
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
