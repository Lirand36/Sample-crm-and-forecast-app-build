"use client";

import { useState, type FormEvent } from "react";
import type { CrmResult, OpportunityCreateInput, OpportunityEditInput } from "@/application/crm";
import { canEditRestrictedFields, computeTcv, DEAL_TYPE_LABEL, type FieldErrors } from "@/domain/crm-rules";
import { OPEN_STAGES, STAGES, statusForStage, type Account, type DealType, type Opportunity, type Stage, type User } from "@/domain/entities";
import { formatUsd, type Cents } from "@/domain/money";
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

function parseTerm(value: string): number | null | "invalid" {
  if (!value.trim()) return null;
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : "invalid";
}

export function OpportunityForm(props: Props) {
  const existing = props.mode === "edit" ? props.opportunity : null;
  const [accountId, setAccountId] = useState(existing?.accountId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [ownerName, setOwnerName] = useState(existing?.ownerName ?? "");
  const [managerId, setManagerId] = useState(existing?.managerId ?? (props.actor.role === "sales_manager" ? props.actor.id : ""));
  const [dealType, setDealType] = useState<DealType>(existing?.dealType ?? "major_accounts");
  const [arr, setArr] = useState(centsToDollarInput(existing?.arr ?? null));
  const [term, setTerm] = useState(existing?.termMonths === null || existing?.termMonths === undefined ? (existing ? "" : "36") : String(existing.termMonths));
  const [nonRecurring, setNonRecurring] = useState(centsToDollarInput(existing?.nonRecurring ?? null));
  const [stage, setStage] = useState<Stage>(existing?.stage ?? "S0 - Meeting");
  const [statusReason, setStatusReason] = useState(existing?.statusReason ?? "");
  const [signedDate, setSignedDate] = useState(existing?.signedDate ?? "");
  const [closeDate, setCloseDate] = useState(existing?.closeDate ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const managers = props.users.filter((u) => u.role === "sales_manager");
  const restrictedAllowed = existing ? canEditRestrictedFields(props.actor, existing) : true;
  const lockTitle = restrictedAllowed ? undefined : "Only the deal's Sales Manager or RevOps can change this.";
  const status = statusForStage(stage);
  // A user without rights may still move between open stages, but not close the deal.
  const stageOptions = restrictedAllowed ? (props.mode === "create" ? OPEN_STAGES : STAGES) : existing?.status === "open" ? OPEN_STAGES : [existing!.stage];

  const parsedArr = parseDollars(arr);
  const parsedTerm = parseTerm(term);
  const parsedNrr = parseDollars(nonRecurring);
  const tcvPreview =
    parsedArr !== "invalid" && parsedTerm !== "invalid" && parsedNrr !== "invalid" ? computeTcv(parsedArr, parsedTerm, parsedNrr) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: FieldErrors = {};
    if (parsedArr === "invalid") local.arr = "Enter a dollar amount, e.g. 1200000.";
    if (parsedTerm === "invalid") local.termMonths = "Enter whole months, e.g. 36.";
    if (parsedNrr === "invalid") local.nonRecurring = "Enter a dollar amount, e.g. 400000.";
    const parsedClose = parseDateInput(closeDate);
    if (parsedClose === "invalid") local.closeDate = "Not a valid date.";
    const parsedSigned = parseDateInput(signedDate);
    if (parsedSigned === "invalid") local.signedDate = "Not a valid date.";
    if (Object.keys(local).length) return setErrors(local);
    const revenue = {
      arr: parsedArr as Cents | null,
      termMonths: parsedTerm as number | null,
      nonRecurring: parsedNrr as Cents | null,
    };
    setSaving(true);
    try {
      const result =
        props.mode === "create"
          ? await props.onSubmit({ accountId, name, ownerName, managerId, dealType, stage, closeDate: parsedClose as OpportunityCreateInput["closeDate"], ...revenue })
          : await props.onSubmit(
              {
                name,
                ownerName,
                managerId,
                stage,
                statusReason: statusReason || null,
                signedDate: parsedSigned as OpportunityEditInput["signedDate"],
                closeDate: parsedClose as OpportunityEditInput["closeDate"],
                ...revenue,
              },
              reason || null,
            );
      setErrors(result.ok ? {} : result.errors);
    } finally {
      setSaving(false);
    }
  }

  const isPayg = (existing?.dealType ?? dealType) === "payg";

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
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} disabled={!restrictedAllowed} title={lockTitle}>
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
            hint={dealType === "payg" ? "Pay-as-you-go has no committed value, so revenue fields are optional and it is not forecast." : undefined}
          >
            <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType)}>
              {Object.entries(DEAL_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Stage" error={errors.stage}>
          <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} title={lockTitle}>
            {stageOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
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
        <Field label="Close date" error={errors.closeDate}>
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </Field>
      </div>

      <h3 className="form-section">Revenue (USD)</h3>
      <div className="form-grid">
        <Field label="Min Commit (ACV)" error={errors.arr} hint="Committed spend per year.">
          <input inputMode="decimal" value={arr} onChange={(e) => setArr(e.target.value)} disabled={!restrictedAllowed} title={lockTitle} placeholder={isPayg ? "Optional" : "e.g. 1200000"} />
        </Field>
        <Field label="Contract duration (months)" error={errors.termMonths}>
          <input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} disabled={!restrictedAllowed} title={lockTitle} placeholder={isPayg ? "Optional" : "e.g. 36"} />
        </Field>
        <Field label="Platform fee" error={errors.nonRecurring} hint="One-off fee on top of the commitment.">
          <input inputMode="decimal" value={nonRecurring} onChange={(e) => setNonRecurring(e.target.value)} disabled={!restrictedAllowed} title={lockTitle} placeholder={isPayg ? "Optional" : "e.g. 400000"} />
        </Field>
        <div className="field">
          <span className="field-label">TCV</span>
          <span className="computed" data-testid="tcv-preview">{tcvPreview === null ? "—" : formatUsd(tcvPreview)}</span>
          <span className="field-hint">Min Commit × duration + platform fee.</span>
          {errors.tcv ? <span className="field-msg">{errors.tcv}</span> : null}
        </div>
      </div>

      {props.mode === "edit" ? (
        <div className="form-grid">
          <Field label="Note for the change history (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      ) : null}
      {!restrictedAllowed ? <p className="muted small">{lockTitle} You can still edit the name, owner, close date and open stage.</p> : null}
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
