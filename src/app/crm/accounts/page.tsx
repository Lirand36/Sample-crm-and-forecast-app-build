"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cents, formatAmount } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";

export default function AccountsPage() {
  const data = useStoreQuery(async (store) => {
    const [accounts, opportunities, contacts] = await Promise.all([
      store.repos.accounts.list(),
      store.repos.opportunities.list(),
      store.repos.contacts.list(),
    ]);
    return { accounts, opportunities, contacts };
  });
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [market, setMarket] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.accounts
      .filter((a) => showArchived || !a.archivedAt)
      .filter((a) => !segment || a.segment === segment)
      .filter((a) => !market || a.market === market)
      .filter((a) => !q || `${a.name} ${a.emailDomains.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => {
        const open = data.opportunities.filter((o) => o.accountId === a.id && o.status === "open" && !o.archivedAt);
        return {
          account: a,
          openCount: open.length,
          openTcv: open.reduce((sum, o) => sum + (o.tcv ?? 0), 0),
          contacts: data.contacts.filter((c) => c.accountId === a.id && c.active).length,
        };
      });
  }, [data, query, segment, market, showArchived]);

  if (!data) return <p>Loading…</p>;
  const segments = [...new Set(data.accounts.map((a) => a.segment))].sort();
  const markets = [...new Set(data.accounts.map((a) => a.market))].sort();

  return (
    <section>
      <div className="page-head">
        <h1>Accounts</h1>
        <Link className="btn btn-primary" href="/crm/accounts/new">
          New account
        </Link>
      </div>
      <div className="filters" role="search">
        <input type="search" placeholder="Search name or domain" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search accounts" />
        <select value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segment">
          <option value="">All segments</option>
          {segments.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Market">
          <option value="">All markets</option>
          {markets.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <span className="muted small">{rows.length} shown</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Segment</th>
            <th>Market</th>
            <th>Owner</th>
            <th>Email domains</th>
            <th className="num">Contacts</th>
            <th className="num">Open deals</th>
            <th className="num">Open TCV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ account: a, openCount, openTcv, contacts }) => (
            <tr key={a.id} className={a.archivedAt ? "archived" : undefined}>
              <td>
                <Link href={`/crm/accounts/${a.id}`}>{a.name}</Link>
                {a.archivedAt ? <span className="badge">Archived</span> : null}
              </td>
              <td>{a.segment}</td>
              <td>{a.market}</td>
              <td>{a.ownerName}</td>
              <td className="small">{a.emailDomains.join(", ") || "—"}</td>
              <td className="num">{contacts}</td>
              <td className="num">{openCount}</td>
              <td className="num">{openCount ? formatAmount(cents(openTcv)) : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">No accounts match these filters.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
