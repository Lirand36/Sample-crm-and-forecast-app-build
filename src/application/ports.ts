// Repository ports (handoff Part VIII: UI → application → domain → repository ports).
// Two kinds of collection: mutable records and append-only records. Append-only collections
// have no update or delete path at the type level, and implementations refuse to overwrite (DR-16).

import type {
  Account,
  ChangeLogEntry,
  ConditionTemplate,
  ConditionWaiver,
  Contact,
  DealCondition,
  DealEvent,
  DealLinkOverride,
  Dispute,
  Evidence,
  EvidenceDecision,
  ForecastRun,
  Opportunity,
  PilotPlan,
  PilotReading,
  PlanningStandard,
  Quarter,
  QuarterTarget,
  RunLine,
  SessionState,
  Submission,
  User,
} from "@/domain/entities";

export interface Identified {
  id: string;
}

export interface ReadCollection<T extends Identified> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
}

export interface MutableCollection<T extends Identified> extends ReadCollection<T> {
  /** Insert or replace. */
  put(record: T): Promise<void>;
}

export interface AppendOnlyCollection<T extends Identified> extends ReadCollection<T> {
  /** Insert a new record. Rejects with AppendOnlyViolation if the id already exists. */
  append(record: T): Promise<void>;
}

export class AppendOnlyViolation extends Error {
  constructor(collection: string, id: string) {
    super(`${collection} is append-only: record ${id} already exists`);
    this.name = "AppendOnlyViolation";
  }
}

/** Every collection the app stores, with its mutability. */
export interface CollectionTypes {
  mutable: {
    users: User;
    accounts: Account;
    contacts: Contact;
    opportunities: Opportunity;
    quarters: Quarter;
    quarterTargets: QuarterTarget;
    dealConditions: DealCondition;
    pilotPlans: PilotPlan;
    disputes: Dispute;
    session: SessionState;
  };
  appendOnly: {
    conditionTemplates: ConditionTemplate;
    planningStandards: PlanningStandard;
    events: DealEvent;
    evidence: Evidence;
    evidenceDecisions: EvidenceDecision;
    pilotReadings: PilotReading;
    conditionWaivers: ConditionWaiver;
    dealLinkOverrides: DealLinkOverride;
    forecastRuns: ForecastRun;
    runLines: RunLine;
    submissions: Submission;
    changeLog: ChangeLogEntry;
  };
}

export type MutableName = keyof CollectionTypes["mutable"];
export type AppendOnlyName = keyof CollectionTypes["appendOnly"];
export type CollectionName = MutableName | AppendOnlyName;

export const MUTABLE_COLLECTIONS = [
  "users",
  "accounts",
  "contacts",
  "opportunities",
  "quarters",
  "quarterTargets",
  "dealConditions",
  "pilotPlans",
  "disputes",
  "session",
] as const satisfies readonly MutableName[];

export const APPEND_ONLY_COLLECTIONS = [
  "conditionTemplates",
  "planningStandards",
  "events",
  "evidence",
  "evidenceDecisions",
  "pilotReadings",
  "conditionWaivers",
  "dealLinkOverrides",
  "forecastRuns",
  "runLines",
  "submissions",
  "changeLog",
] as const satisfies readonly AppendOnlyName[];

export const ALL_COLLECTIONS: readonly CollectionName[] = [...MUTABLE_COLLECTIONS, ...APPEND_ONLY_COLLECTIONS];

export type Repositories = {
  [K in MutableName]: MutableCollection<CollectionTypes["mutable"][K]>;
} & {
  [K in AppendOnlyName]: AppendOnlyCollection<CollectionTypes["appendOnly"][K]>;
};

/** A full dataset, used for seeding and for snapshot hashing. */
export type Dataset = {
  [K in MutableName]: CollectionTypes["mutable"][K][];
} & {
  [K in AppendOnlyName]: CollectionTypes["appendOnly"][K][];
};

export interface DataStore {
  readonly repos: Repositories;
  /** Remove every record from every collection. Used only by reset. */
  clearAll(): Promise<void>;
  /** Load a dataset into an empty store. */
  load(dataset: Dataset): Promise<void>;
  /** Read every collection, each sorted by id. */
  dump(): Promise<Dataset>;
}
