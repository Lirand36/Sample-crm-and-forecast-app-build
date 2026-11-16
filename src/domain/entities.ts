// Stored entities: PRD v5 §7 as amended by DR-18 and handoff Part IV.
// Condition state, grade and Evidence status are NOT stored: they are derived (PRD §7, DR-05, G-1 note).

import type { IsoDate } from "./dates";
import type { Cents } from "./money";

export type Id = string;

// ---------- Roles and users ----------

/**
 * Part IV user roles, plus the VP Sales (Liran, 16 Nov): a separate person from the CRO who
 * holds the G-1 right to reject Evidence that is already confirmed or approved.
 */
export type UserRole = "sales_manager" | "revops" | "vp_sales" | "cro";

export interface User {
  id: Id;
  name: string;
  role: UserRole;
  /** Team label shown in scope pickers (e.g. "Southern Europe"). */
  team: string | null;
  /** The user this one reports to. */
  managerId: Id | null;
}

// ---------- CRM foundation (Part IV, DR-17) ----------

export interface Account {
  id: Id;
  name: string;
  emailDomains: string[];
  segment: string;
  market: string; // country
  ownerName: string;
  archivedAt: IsoDate | null;
}

export type ContactRole = "sponsor" | "budget_holder" | "technical" | "security" | "legal" | "procurement" | "other";

export interface Contact {
  id: Id;
  accountId: Id;
  name: string;
  title: string;
  email: string;
  role: ContactRole;
  active: boolean;
}

export type DealType = "major_accounts" | "land_and_expand" | "payg";
export type TemplateVariant = "major_accounts" | "land" | "expand" | "none";
export type OpportunityStatus = "open" | "won" | "lost" | "disqualified";

export const OPEN_STAGES = [
  "S0 - Meeting",
  "S1 - Prospecting",
  "S2 - Validation",
  "S3 - Evaluation",
  "S4 - Pricing",
  "S5 - Contracting",
  "S6 - Review",
] as const;
export const CLOSED_STAGES = ["S7 - Closed Won", "S9 - Closed Lost", "S9 - Rejected"] as const;
export const STAGES = [...OPEN_STAGES, ...CLOSED_STAGES] as const;
export type Stage = (typeof STAGES)[number];

export function statusForStage(stage: Stage): OpportunityStatus {
  if (stage === "S7 - Closed Won") return "won";
  if (stage === "S9 - Closed Lost") return "lost";
  if (stage === "S9 - Rejected") return "disqualified";
  return "open";
}

export interface Opportunity {
  id: Id;
  accountId: Id;
  name: string;
  ownerName: string;
  managerId: Id;
  dealType: DealType;
  /** Fixed at creation (DR-07). "none" for PAYG, which has no Conditions. */
  templateVariant: TemplateVariant;
  templateVersion: number | null;
  /** Annual recurring revenue, integer cents. Null only for PAYG. */
  arr: Cents | null;
  /** Initial contract term in whole months. Null only for PAYG. */
  termMonths: number | null;
  /** One-off fees (implementation, setup), integer cents. Null only for PAYG. */
  nonRecurring: Cents | null;
  /**
   * TCV = ARR × term / 12 + non-recurring (PRD §3: committed value over the initial term).
   * Always derived from the three fields above by the CRM service; stored because the engine reads it.
   */
  tcv: Cents | null;
  currency: "USD";
  /** Derived from the stage (Liran, 16 Nov): closed stages set Won, Lost or Disqualified. */
  status: OpportunityStatus;
  statusReason: string | null;
  signedDate: IsoDate | null;
  closeDate: IsoDate | null; // display only
  /** The single pipeline field users edit. Open stages are display only; the engine reads only the status they imply. */
  stage: Stage;
  /** G-3: technical field needed to fix the land/expand variant at creation. */
  createdAt: IsoDate;
  archivedAt: IsoDate | null;
}

// ---------- Quarter (DR-12) ----------

export interface Quarter {
  id: Id; // e.g. "2027-Q1"
  label: string;
  start: IsoDate;
  end: IsoDate;
  timeZone: string; // reporting time zone, default "UTC"
}

export interface QuarterTarget {
  id: Id;
  quarterId: Id;
  /** null = company target. */
  managerId: Id | null;
  target: Cents;
}

// ---------- Conditions, templates and links ----------

export type ConditionType =
  | "executive_sponsor"
  | "budget"
  | "pilot"
  | "vendor_selection"
  | "technical_validation"
  | "security"
  | "procurement_legal";

export const CONDITION_NUMBER: Record<ConditionType, number> = {
  executive_sponsor: 1,
  budget: 2,
  pilot: 3,
  vendor_selection: 4,
  technical_validation: 5,
  security: 6,
  procurement_legal: 7,
};

export const CONDITION_LABEL: Record<ConditionType, string> = {
  executive_sponsor: "Executive sponsor confirmed",
  budget: "Budget approved",
  pilot: "Pilot targets met",
  vendor_selection: "Vendor selection",
  technical_validation: "Technical validation",
  security: "Security and compliance approval",
  procurement_legal: "Procurement and legal",
};

export type ConditionKind = "commercial" | "process";
export type LinkStrength = "hard" | "soft";

export interface TemplateCondition {
  type: ConditionType;
  kind: ConditionKind;
  defaultOwner: string;
}

export interface TemplateLink {
  from: ConditionType; // the earlier Condition
  to: ConditionType; // the Condition that waits
  strength: LinkStrength;
}

/** Versioned Condition template, keyed by variant (DR-07). Append-only. */
export interface ConditionTemplate {
  id: Id; // `${variant}@v${version}`
  variant: Exclude<TemplateVariant, "none">;
  version: number;
  conditions: TemplateCondition[];
  links: TemplateLink[];
}

/** Per-deal owner assignment (PRD §7 DealCondition, minus waiver which is now append-only). */
export interface DealCondition {
  id: Id; // `${opportunityId}:${type}`
  opportunityId: Id;
  type: ConditionType;
  owner: string;
}

/** DR-07: RevOps only, never Conditions 2 or 4, reason required, append-only. */
export interface ConditionWaiver {
  id: Id;
  opportunityId: Id;
  conditionType: ConditionType;
  reason: string;
  actorId: Id;
  at: IsoDate;
  seq: number;
}

/** DR-07: per-deal Link change, RevOps only, logged, acyclic. Append-only; latest per link wins. */
export interface DealLinkOverride {
  id: Id;
  opportunityId: Id;
  from: ConditionType;
  to: ConditionType;
  /** "removed" deletes the template link for this deal. */
  strength: LinkStrength | "removed";
  reason: string;
  actorId: Id;
  at: IsoDate;
  seq: number;
}

// ---------- Planning standards (DR-01) ----------

export type PlanningConditionType = Exclude<ConditionType, "pilot"> | "pilot" | "pilot_acceptance";

export interface PlanningStandard {
  id: Id;
  conditionType: PlanningConditionType;
  /** "all" applies to every deal type (Part VII); lookup order per G-2. */
  dealType: DealType | "all";
  segment: string | null;
  fastDays: number;
  standardDays: number;
  slowDays: number;
  rationale: string;
  approvedBy: Id;
  effectiveFrom: IsoDate;
  version: number;
}

// ---------- Events and Evidence (PRD §4B, DR-03, DR-05, DR-06) ----------

export type EventOrigin = "customer" | "internal" | "external";
export type SourceLabel = "seeded" | "manual" | "live";
export type SourceType =
  | "signed_document"
  | "approval_record"
  | "purchase_order"
  | "award_letter"
  | "letter_of_intent"
  | "term_sheet"
  | "acceptance_certificate"
  | "pilot_reading"
  | "email"
  | "meeting_transcript"
  | "customer_letter"
  | "news"
  | "press_release"
  | "internal_note"
  | "pasted_text"
  | "crm_field_change";

export type EventChannel = "email" | "document" | "meeting" | "news" | "note" | "paste" | "crm";

/** Immutable record of something that happened on a deal. Never edited or deleted. */
export interface DealEvent {
  id: Id;
  opportunityId: Id;
  occurredAt: IsoDate;
  sourceType: SourceType;
  /** Derived at intake (DR-05) and frozen with the Event. */
  origin: EventOrigin;
  sender: string | null;
  channel: EventChannel;
  subject: string | null;
  text: string;
  sourceLabel: SourceLabel;
  sourceRecordId: string | null;
  contentHash: string;
  /** Monotonic intake order within the app. */
  seq: number;
  /** Date the Event entered the app (simulated clock). */
  loggedAt: IsoDate;
}

export type AdvancingClaim = "started" | "progress" | "done" | "selected";
export type ReversingClaim = "blocked" | "reopened" | "contrary";
export type NeutralClaim = "status" | "intent";
export type ClaimKind = AdvancingClaim | ReversingClaim | NeutralClaim;

export const ADVANCING_CLAIMS: readonly ClaimKind[] = ["started", "progress", "done", "selected"];
export const REVERSING_CLAIMS: readonly ClaimKind[] = ["blocked", "reopened", "contrary"];

export type ContraryKind =
  | "competitor_evaluation"
  | "budget_freeze"
  | "changed_priority"
  | "sponsor_left"
  | "postponed_decision";

/** One claim extracted from one Event. Append-only; its status is replayed from EvidenceDecisions. */
export interface Evidence {
  id: Id;
  eventId: Id;
  opportunityId: Id;
  conditionType: ConditionType;
  claim: ClaimKind;
  /** Human-readable claim, e.g. "Procurement progress: second-round redlines returned". */
  summary: string;
  quote: string;
  blockStart: IsoDate | null;
  blockEnd: IsoDate | null;
  contraryKind: ContraryKind | null;
  extractionVersion: string;
  /** Stored but never read by any rule (DR-18). */
  confidence: number | null;
}

export type EvidenceDecisionKind = "approved" | "confirmed" | "rejected" | "duplicate" | "unverifiable";

/** Append-only (DR-18). The latest decision for an Evidence record sets its status. */
export interface EvidenceDecision {
  id: Id;
  evidenceId: Id;
  decision: EvidenceDecisionKind;
  actorId: Id | null; // null for system decisions (duplicate, unverifiable)
  at: IsoDate;
  seq: number;
  reason: string | null;
  duplicateOf: Id | null;
}

// ---------- Pilot (DR-02) ----------

export interface PilotPlan {
  id: Id;
  opportunityId: Id;
  evaluationDate: IsoDate;
  acceptanceMode: "customer_signoff" | "automatic";
  /** Percent, e.g. 70 for 70%. */
  resolutionTarget: number;
  /** Percent. */
  sentimentFloor: number;
  /** Conversations per week. */
  weeklyVolumeFloor: number;
}

export interface PilotReading {
  id: Id;
  opportunityId: Id;
  weekEnding: IsoDate;
  resolutionRate: number;
  sentiment: number;
  volume: number;
  sourceLabel: SourceLabel;
}

// ---------- Disputes (PRD §4I, DR-10, DR-11) ----------

export interface DisputeBet {
  conditionType: ConditionType;
  by: IsoDate;
}

export interface Dispute {
  id: Id;
  opportunityId: Id;
  quarterId: Id;
  managerId: Id;
  direction: "in" | "out";
  reason: string;
  /** In: one or more. Out: empty. */
  bets: DisputeBet[];
  /** Out: the open Condition the manager expects not to be Done by QE (DR-11). */
  outCondition: ConditionType | null;
  createdAt: IsoDate;
  withdrawnAt: IsoDate | null;
}

// ---------- Forecast runs (PRD §4K, DR-16) ----------

export type Group = "signed" | "firm" | "core" | "stretch" | "uncommitted" | "late" | "timing_unknown" | "excluded";
export type Commitment = "committed" | "engaged" | "unproven" | "at_risk";

export interface RunTotals {
  conservative: Cents;
  core: Cents;
  stretch: Cents;
  managerCommitment: Cents;
}

/** Immutable. Holds copies of everything it used (config_snapshot, DR-18). */
export interface ForecastRun {
  id: Id;
  asOfDate: IsoDate;
  quarterId: Id;
  quarterEnd: IsoDate;
  trigger: "automatic" | "submission" | "cutoff" | "fixture";
  seq: number;
  engineVersion: string;
  templateVersions: string[];
  extractionVersion: string;
  /** Planning-standard ids, versions and values used (DR-01). */
  configSnapshot: Record<string, unknown>;
  totals: RunTotals;
  /** Per-manager totals, keyed by manager id. */
  managerTotals: Record<Id, RunTotals>;
  /** True for seeded fixtures (e.g. the Feb 22 run). */
  isFixture: boolean;
}

export interface RunLine {
  id: Id;
  runId: Id;
  opportunityId: Id;
  managerId: Id;
  eligibility: "signed" | "excluded" | "evaluated";
  exclusionReason: string | null;
  tcv: Cents | null;
  currency: "USD";
  commitment: Commitment | null;
  commitmentRule: string | null;
  esdFast: IsoDate | null;
  esdStandard: IsoDate | null;
  esdSlow: IsoDate | null;
  group: Group;
  reason: string | null;
  ruleIds: string[];
  /** Copied values the engine used (PRD §4K.2). Shape is fixed by the engine version. */
  detail: Record<string, unknown>;
}

export interface Submission {
  id: Id;
  runId: Id;
  managerId: Id;
  submittedAt: IsoDate;
  seq: number;
}

// ---------- ChangeLog (DR-13) ----------

export interface ChangeLogEntry {
  id: Id;
  entity: "opportunity" | "account" | "contact" | "planning_standard" | "dispute" | "pilot_plan";
  entityId: Id;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actorId: Id;
  at: IsoDate;
  seq: number;
  reason: string | null;
}

// ---------- App session (simulated clock and role) ----------

export interface SessionState {
  id: "session";
  /** The engine's as-of date; also the app's simulated "today" for logging (G-11). */
  asOfDate: IsoDate;
  actingUserId: Id;
  /** Next sequence number for append-only records. */
  nextSeq: number;
  seedVersion: string;
}
