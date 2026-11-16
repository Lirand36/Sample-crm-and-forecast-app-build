"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContactRole } from "@/domain/entities";
import { useStoreQuery } from "@/features/crm/ui";
import { CONTACT_ROLE_LABEL } from "@/features/shell/labels";

export default function ContactsPage() {
  const data = useStoreQuery(async (store) => {
    const [contacts, accounts] = await Promise.all([store.repos.contacts.list(), store.repos.accounts.list()]);
    return { contacts, accounts: new Map(accounts.map((a) => [a.id, a])) };
  });
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("");
  const [role, setRole] = useState<ContactRole | "">("");
  const [showInactive, setShowInactive] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.contacts
      .filter((c) => showInactive || c.active)
      .filter((c) => !account || c.accountId === account)
      .filter((c) => !role || c.role === role)
      .filter((c) => !q || `${c.name} ${c.title} ${c.email} ${data.accounts.get(c.accountId)?.name ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query, account, role, showInactive]);

  if (!data) return <p>Loading…</p>;
  const accounts = [...data.accounts.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section>
      <div className="page-head">
        <h1>Contacts</h1>
        <Link className="btn btn-primary" href="/crm/contacts/new">
          New contact
        </Link>
      </div>
      <div className="filters" role="search">
        <input type="search" placeholder="Search name, title or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search contacts" />
        <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account">
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as ContactRole | "")} aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(CONTACT_ROLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show people who left
        </label>
        <span className="muted small">{rows.length} shown</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Account</th>
            <th>Role on the deal</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const a = data.accounts.get(c.accountId);
            return (
              <tr key={c.id} className={c.active ? undefined : "archived"}>
                <td>
                  <Link href={`/crm/contacts/${c.id}`}>{c.name}</Link>
                  {c.active ? null : <span className="badge">Left the company</span>}
                </td>
                <td>{c.title}</td>
                <td>{a ? <Link href={`/crm/accounts/${a.id}`}>{a.name}</Link> : "—"}</td>
                <td>{CONTACT_ROLE_LABEL[c.role]}</td>
                <td className="small">{c.email}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">No contacts match these filters.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
