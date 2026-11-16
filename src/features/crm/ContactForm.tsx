"use client";

import { useState, type FormEvent } from "react";
import type { ContactInput, CrmResult } from "@/application/crm";
import type { FieldErrors } from "@/domain/crm-rules";
import type { Account, Contact, ContactRole } from "@/domain/entities";
import { CONTACT_ROLE_LABEL } from "@/features/shell/labels";
import { Field, FormError } from "./ui";

export function ContactForm({
  contact,
  accounts,
  defaultAccountId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  contact?: Contact;
  accounts: Account[];
  defaultAccountId?: string;
  submitLabel: string;
  onSubmit: (input: ContactInput) => Promise<CrmResult<Contact>>;
  onCancel: () => void;
}) {
  const [accountId, setAccountId] = useState(contact?.accountId ?? defaultAccountId ?? "");
  const [name, setName] = useState(contact?.name ?? "");
  const [title, setTitle] = useState(contact?.title ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [role, setRole] = useState<ContactRole>(contact?.role ?? "other");
  const [active, setActive] = useState(contact?.active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await onSubmit({ accountId, name, title, email, role, active });
      setErrors(result.ok ? {} : result.errors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormError message={errors.form} />
      <div className="form-grid">
        <Field label="Account" error={errors.accountId}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Choose an Account</option>
            {accounts
              .filter((a) => !a.archivedAt || a.id === accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
          </select>
        </Field>
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Title" error={errors.title}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role on the deal" error={errors.role} hint="Shown next to every claim this person makes, so reviewers know who said it.">
          <select value={role} onChange={(e) => setRole(e.target.value as ContactRole)}>
            {Object.entries(CONTACT_ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <label className="check" style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Still at the company
        </label>
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
