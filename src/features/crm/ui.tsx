"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DataStore } from "@/application/ports";
import { formatDisplayDate, isIsoDate, type IsoDate } from "@/domain/dates";
import { CONDITION_LABEL, type ChangeLogEntry, type ConditionType, type User } from "@/domain/entities";
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
            <td>{fieldLabel(c.field)}</td>
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

function fieldLabel(field: string): string {
  const step = (t: string) => CONDITION_LABEL[t as ConditionType] ?? t.replace(/_/g, " ");
  if (field.startsWith("waiver:")) return `waiver: ${step(field.slice(7))}`;
  if (field.startsWith("link:")) {
    const [from = "", to = ""] = field.slice(5).split(">");
    return `link: ${step(from)} → ${step(to)}`;
  }
  return FIELD_NAMES[field] ?? field.replace(/_/g, " ");
}

/** WCP's names for the revenue fields. */
const FIELD_NAMES: Record<string, string> = { arr: "Min Commit (ACV)", non_recurring: "platform fee", term_months: "contract duration" };

function displayLogValue(field: string, value: string | null, users: User[]): string {
  if (value === null) return "—";
  if (field === "tcv" || field === "arr" || field === "non_recurring") return formatUsd(cents(Number(value)));
  if (field === "manager") return users.find((u) => u.id === value)?.name ?? value;
  if (/date|_at$/.test(field) && isIsoDate(value)) return formatDisplayDate(value);
  return value;
}
