"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEAL_TYPE_LABEL, STATUS_LABEL } from "@/domain/crm-rules";
import { formatDisplayDate } from "@/domain/dates";
import type { DealType, OpportunityStatus } from "@/domain/entities";
import { formatMillions } from "@/domain/money";
import { CrmTabs, useStoreQuery } from "@/features/crm/ui";

export default function OpportunitiesPage() {
  const data = useStoreQuery(async (store) => {
    const [opportunities, accounts, users] = await Promise.all([
      store.repos.opportunities.list(),
      store.repos.accounts.list(),
      store.repos.users.list(),
    ]);
    return { opportunities, accounts: new Map(accounts.map((a) => [a.id, a])), users };
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OpportunityStatus | "">("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [manager, setManager] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.opportunities
      .filter((o) => showArchived || !o.archivedAt)
      .filter((o) => !status || o.status === status)
      .filter((o) => !dealType || o.dealType === dealType)
      .filter((o) => !manager || o.managerId === manager)
      .filter((o) => !q || `${o.name} ${data.accounts.get(o.accountId)?.name ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query, status, dealType, manager, showArchived]);

  if (!data) return <p>Loading…</p>;
  const managers = data.users.filter((u) => u.role === "sales_manager");

  return (
    <section>
      <CrmTabs />
      <div className="page-head">
        <h1>Opportunities</h1>
        <Link className="btn btn-primary" href="/crm/opportunities/new">
          New opportunity
        </Link>
      </div>
      <div className="filters" role="search">
        <input type="search" placeholder="Search name or account" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search opportunities" />
        <select value={status} onChange={(e) => setStatus(e.target.value as OpportunityStatus | "")} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType | "")} aria-label="Deal type">
          <option value="">All deal types</option>
          {Object.entries(DEAL_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Manager">
          <option value="">All managers</option>
          {managers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
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
            <th>Opportunity</th>
            <th>Account</th>
            <th>Deal type</th>
            <th>Manager</th>
            <th className="num">TCV</th>
            <th>Status</th>
            <th>CRM close date</th>
            <th>CRM stage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const account = data.accounts.get(o.accountId);
            return (
              <tr key={o.id} className={o.archivedAt ? "archived" : undefined}>
                <td>
                  <Link href={`/crm/opportunities/${o.id}`}>{o.name}</Link>
                  {o.archivedAt ? <span className="badge">Archived</span> : null}
                </td>
                <td>
                  {account?.name}
                  <span className="muted small"> · {account?.segment}, {account?.market}</span>
                </td>
                <td>
                  {DEAL_TYPE_LABEL[o.dealType]}
                  {o.dealType === "land_and_expand" ? <span className="muted small"> ({o.templateVariant})</span> : null}
                </td>
                <td>{data.users.find((u) => u.id === o.managerId)?.name}</td>
                <td className="num">{o.tcv === null ? "—" : formatMillions(o.tcv)}</td>
                <td>
                  {STATUS_LABEL[o.status]}
                  {o.signedDate ? <span className="muted small"> · signed {formatDisplayDate(o.signedDate)}</span> : null}
                </td>
                <td>{o.closeDate ? formatDisplayDate(o.closeDate) : "—"}</td>
                <td>{o.stage ?? "—"}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">No opportunities match these filters.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
