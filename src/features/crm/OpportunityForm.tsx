"use client";

import { useState, type FormEvent } from "react";
import type { CrmResult, OpportunityCreateInput, OpportunityEditInput } from "@/application/crm";
import { canEditRestrictedFields, DEAL_TYPE_LABEL, STATUS_LABEL, type FieldErrors } from "@/domain/crm-rules";
import type { Account, DealType, Opportunity, OpportunityStatus, User } from "@/domain/entities";
import { centsToDollarInput, Field, FormError, parseDateInput, parseDollars } from "./ui";

interface Common {
  accounts: Account[];
  users: User[];
  actor: User;
  onCancel: () => void;
  submitLabel: string;
}

type Props =
  | (Common & { mode: "create"; onSubmit: (input: OpportunityCreateInput) => Promise<CrmResult<Opportunity>> })
  | (Common & { mode: "edit"; opportunity: Opportunity; onSubmit: (input: OpportunityEditInput, reason: string | null) => Promise<CrmResult<Opportunity>> });

export function OpportunityForm(props: Props) {
  const existing = props.mode === "edit" ? props.opportunity : null;
  const [accountId, setAccountId] = useState(existing?.accountId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [ownerName, setOwnerName] = useState(existing?.ownerName ?? "");
  const [managerId, setManagerId] = useState(existing?.managerId ?? (props.actor.role === "sales_manager" ? props.actor.id : ""));
  const [dealType, setDealType] = useState<DealType>(existing?.dealType ?? "major_accounts");
  const [tcv, setTcv] = useState(centsToDollarInput(existing?.tcv ?? null));
  const [status, setStatus] = useState<OpportunityStatus>(existing?.status ?? "open");
  const [statusReason, setStatusReason] = useState(existing?.statusReason ?? "");
  const [signedDate, setSignedDate] = useState(existing?.signedDate ?? "");
  const [closeDate, setCloseDate] = useState(existing?.closeDate ?? "");
  const [stage, setStage] = useState(existing?.stage ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const managers = props.users.filter((u) => u.role === "sales_manager");
  const restrictedAllowed = existing ? canEditRestrictedFields(props.actor, existing) : true;
  const restrictedTitle = restrictedAllowed ? undefined : "Only the deal's Sales Manager or RevOps can change this (DR-04).";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: FieldErrors = {};
    const parsedTcv = parseDollars(tcv);
    if (parsedTcv === "invalid") local.tcv = "Enter a whole dollar amount, e.g. 2500000.";
    const parsedClose = parseDateInput(closeDate);
    if (parsedClose === "invalid") local.closeDate = "Not a valid date.";
    const parsedSigned = parseDateInput(signedDate);
    if (parsedSigned === "invalid") local.signedDate = "Not a valid date.";
    if (Object.keys(local).length) return setErrors(local);
    setSaving(true);
    try {
      const result =
        props.mode === "create"
          ? await props.onSubmit({
              accountId,
              name,
              ownerName,
              managerId,
              dealType,
              tcv: parsedTcv as OpportunityCreateInput["tcv"],
              closeDate: parsedClose as OpportunityCreateInput["closeDate"],
              stage: stage || null,
            })
          : await props.onSubmit(
              {
                name,
                ownerName,
                managerId,
                tcv: parsedTcv as OpportunityEditInput["tcv"],
                status,
                statusReason: statusReason || null,
                signedDate: parsedSigned as OpportunityEditInput["signedDate"],
                closeDate: parsedClose as OpportunityEditInput["closeDate"],
                stage: stage || null,
              },
              reason || null,
            );
      setErrors(result.ok ? {} : result.errors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormError message={errors.form} />
      <div className="form-grid">
        {props.mode === "create" ? (
          <Field label="Account" error={errors.accountId}>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="">Choose an Account</option>
              {props.accounts
                .filter((a) => !a.archivedAt)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
          </Field>
        ) : null}
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Owner (account executive)" error={errors.ownerName}>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        </Field>
        <Field label="Sales Manager" error={errors.managerId}>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} disabled={!restrictedAllowed} title={restrictedTitle}>
            <option value="">Choose a manager</option>
            {managers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}{u.team ? ` (${u.team})` : ""}</option>
            ))}
          </select>
        </Field>
        {props.mode === "create" ? (
          <Field
            label="Deal type"
            error={errors.dealType}
            hint={
              dealType === "payg"
                ? "PAYG is kept in the CRM and never forecast. TCV is optional."
                : dealType === "land_and_expand"
                  ? "Land or expand is set now from the Account's history and never changes."
                  : undefined
            }
          >
            <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType)}>
              {Object.entries(DEAL_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="TCV (USD)" error={errors.tcv} hint="Committed contract value over the initial term, in whole dollars.">
          <input inputMode="decimal" value={tcv} onChange={(e) => setTcv(e.target.value)} disabled={!restrictedAllowed} title={restrictedTitle} placeholder={dealType === "payg" ? "Optional for PAYG" : "e.g. 2500000"} />
        </Field>
        {props.mode === "edit" ? (
          <>
            <Field label="Status" error={errors.status}>
              <select value={status} onChange={(e) => setStatus(e.target.value as OpportunityStatus)} disabled={!restrictedAllowed} title={restrictedTitle}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            {status === "won" ? (
              <Field label="Signed date" error={errors.signedDate}>
                <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} disabled={!restrictedAllowed} />
              </Field>
            ) : null}
            {status === "lost" || status === "disqualified" ? (
              <Field label="Reason" error={errors.statusReason}>
                <input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} disabled={!restrictedAllowed} />
              </Field>
            ) : null}
          </>
        ) : null}
        <Field label="CRM close date" error={errors.closeDate} hint="Shown for reference; the forecast never uses it.">
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </Field>
        <Field label="CRM stage" error={errors.stage} hint="Shown for reference; the forecast never uses it.">
          <input value={stage} onChange={(e) => setStage(e.target.value)} />
        </Field>
        {props.mode === "edit" ? (
          <Field label="Note for the change log (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        ) : null}
      </div>
      {!restrictedAllowed ? <p className="muted small">{restrictedTitle} Other fields can still be edited.</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : props.submitLabel}
        </button>
        <button type="button" className="btn" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
