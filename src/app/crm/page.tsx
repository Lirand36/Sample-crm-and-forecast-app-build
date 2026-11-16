"use client";

import { useEffect, useState } from "react";
import type { Account, Opportunity, User } from "@/domain/entities";
import { formatDisplayDate } from "@/domain/dates";
import { formatMillions } from "@/domain/money";
import { useStore } from "@/features/shell/StoreProvider";

const DEAL_TYPE_LABEL: Record<Opportunity["dealType"], string> = {
  major_accounts: "Major Accounts",
  land_and_expand: "Land and Expand",
  payg: "PAYG",
};

const STATUS_LABEL: Record<Opportunity["status"], string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  disqualified: "Disqualified",
};

export default function CrmPage() {
  const { store, revision } = useStore();
  const [data, setData] = useState<{ opportunities: Opportunity[]; accounts: Map<string, Account>; users: Map<string, User> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [opportunities, accounts, users] = await Promise.all([
        store.repos.opportunities.list(),
        store.repos.accounts.list(),
        store.repos.users.list(),
      ]);
      if (!cancelled)
        setData({
          opportunities,
          accounts: new Map(accounts.map((a) => [a.id, a])),
          users: new Map(users.map((u) => [u.id, u])),
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [store, revision]);

  if (!data) return <p>Loading…</p>;

  return (
    <section>
      <h1>CRM — Opportunities</h1>
      <p className="muted">Read-only in Phase 1. Create, edit and archive arrive in Phase 2.</p>
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
          {data.opportunities.map((o) => {
            const account = data.accounts.get(o.accountId);
            return (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>
                  {account?.name}
                  <span className="muted small"> · {account?.segment}, {account?.market}</span>
                </td>
                <td>
                  {DEAL_TYPE_LABEL[o.dealType]}
                  {o.dealType === "land_and_expand" ? <span className="muted small"> ({o.templateVariant})</span> : null}
                </td>
                <td>{data.users.get(o.managerId)?.name}</td>
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
        </tbody>
      </table>
    </section>
  );
}
