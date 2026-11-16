"use client";

import { useState, type FormEvent } from "react";
import type { AccountInput, CrmResult } from "@/application/crm";
import type { FieldErrors } from "@/domain/crm-rules";
import type { Account } from "@/domain/entities";
import { Field, FormError } from "./ui";

export function AccountForm({
  account,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  account?: Account;
  submitLabel: string;
  onSubmit: (input: AccountInput) => Promise<CrmResult<Account>>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [segment, setSegment] = useState(account?.segment ?? "");
  const [market, setMarket] = useState(account?.market ?? "");
  const [ownerName, setOwnerName] = useState(account?.ownerName ?? "");
  const [domains, setDomains] = useState(account?.emailDomains.join(", ") ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await onSubmit({
        name,
        segment,
        market,
        ownerName,
        emailDomains: domains.split(/[,\s]+/).filter(Boolean),
      });
      setErrors(result.ok ? {} : result.errors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormError message={errors.form} />
      <div className="form-grid">
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Segment" error={errors.segment} hint="Industry, e.g. Banks, Telecom.">
          <input value={segment} onChange={(e) => setSegment(e.target.value)} required />
        </Field>
        <Field label="Market" error={errors.market} hint="Country.">
          <input value={market} onChange={(e) => setMarket(e.target.value)} required />
        </Field>
        <Field label="Owner (account executive)" error={errors.ownerName}>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        </Field>
        <Field
          label="Email domains"
          error={errors.emailDomains}
          hint="Comma-separated, e.g. nationalbank.example. Emails from these domains count as the customer speaking."
        >
          <input value={domains} onChange={(e) => setDomains(e.target.value)} />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
