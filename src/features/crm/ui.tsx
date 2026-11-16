"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { DataStore } from "@/application/ports";
import { formatDisplayDate, isIsoDate, type IsoDate } from "@/domain/dates";
import type { ChangeLogEntry, User } from "@/domain/entities";
import { cents, formatUsd, type Cents } from "@/domain/money";
import { useStore } from "@/features/shell/StoreProvider";

/** Load data from the store and reload after every write. */
export function useStoreQuery<T>(load: (store: DataStore) => Promise<T>, deps: readonly unknown[] = []): T | null {
  const { store, revision } = useStore();
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    load(store).then((value) => {
      if (!cancelled) setData(value);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, revision, ...deps]);
  return data;
}

const CRM_TABS = [{ href: "/crm/opportunities", label: "Opportunities" }];

export function CrmTabs() {
  const pathname = usePathname();
  return (
    <nav className="subnav" aria-label="CRM">
      {CRM_TABS.map((t) => (
        <Link key={t.href} href={t.href} className={pathname?.startsWith(t.href) ? "subnav-link active" : "subnav-link"}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={error ? "field field-error" : "field"}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-msg" role="alert">{error}</span> : null}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

/** Whole US dollars typed by the user, to integer cents. Empty → null. */
export function parseDollars(value: string): Cents | null | "invalid" {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "invalid";
  return cents(Math.round(Number(cleaned) * 100));
}

export function centsToDollarInput(value: Cents | null): string {
  if (value === null) return "";
  return value % 100 === 0 ? String(value / 100) : (value / 100).toFixed(2);
}

export function parseDateInput(value: string): IsoDate | null | "invalid" {
  if (!value) return null;
  return isIsoDate(value) ? value : "invalid";
}

export function ChangeHistory({ entries, users }: { entries: ChangeLogEntry[]; users: User[] }) {
  if (entries.length === 0) return <p className="muted">No changes recorded in the app yet.</p>;
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  return (
    <table className="table compact">
      <thead>
        <tr>
          <th>Date</th>
          <th>Field</th>
          <th>From</th>
          <th>To</th>
          <th>By</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((c) => (
          <tr key={c.id}>
            <td>{formatDisplayDate(c.at)}</td>
            <td>{c.field.replace(/_/g, " ")}</td>
            <td>{displayLogValue(c.field, c.oldValue, users)}</td>
            <td>{displayLogValue(c.field, c.newValue, users)}</td>
            <td>{name(c.actorId)}</td>
            <td>{c.reason ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function displayLogValue(field: string, value: string | null, users: User[]): string {
  if (value === null) return "—";
  if (field === "tcv") return formatUsd(cents(Number(value)));
  if (field === "manager") return users.find((u) => u.id === value)?.name ?? value;
  if (/date|_at$/.test(field) && isIsoDate(value)) return formatDisplayDate(value);
  return value;
}
