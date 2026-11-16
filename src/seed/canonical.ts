// Canonical seed: PRD v5 §8 as changed by handoff Part VII. Fictional, deterministic, resettable.
// Authored as typed TypeScript (bundled into the app) so the compiler checks every record.
// As-of demo date: March 1, 2027. Quarter Q1 2027 ends March 31.

import type { Dataset } from "@/application/ports";
import { isoDate, type IsoDate } from "@/domain/dates";
import type {
  Account,
  ChangeLogEntry,
  ClaimKind,
  ConditionType,
  Contact,
  ContraryKind,
  DealCondition,
  DealEvent,
  Dispute,
  Evidence,
  EvidenceDecision,
  EvidenceDecisionKind,
  EventChannel,
  EventOrigin,
  ForecastRun,
  Opportunity,
  PilotPlan,
  PilotReading,
  PlanningStandard,
  Quarter,
  QuarterTarget,
  RunLine,
  RunTotals,
  SourceType,
  User,
} from "@/domain/entities";
import { eventContentHash } from "@/domain/hash";
import { usdM, type Cents } from "@/domain/money";
import { CONDITION_TEMPLATES } from "./templates";

export const SEED_VERSION = "seed-2027Q1-v2";
export const DEMO_AS_OF = isoDate("2027-03-01");
export const QUARTER_ID = "2027-Q1";
export const EXTRACTION_VERSION = "fixture-extraction-v1";

const d = (s: string): IsoDate => isoDate(s);

// ---------- Users ----------

export const USERS: User[] = [
  { id: "u-cro", name: "Morgan Reyes", role: "cro", team: null, managerId: null },
  { id: "u-vp-sales", name: "Daniel Avraham", role: "vp_sales", team: "Europe", managerId: "u-cro" },
  { id: "u-revops", name: "Sam Ortiz", role: "revops", team: null, managerId: "u-cro" },
  { id: "u-mgr-a", name: "Elena Ruiz", role: "sales_manager", team: "Southern Europe", managerId: "u-vp-sales" },
  { id: "u-mgr-b", name: "Jonas Weber", role: "sales_manager", team: "DACH", managerId: "u-vp-sales" },
];

const REVOPS = "u-revops";
const MGR_A = "u-mgr-a";
const MGR_B = "u-mgr-b";

// ---------- Accounts and contacts ----------

interface AccountSeed {
  key: string;
  name: string;
  domain: string;
  segment: string;
  market: string;
  owner: string;
  contacts: Array<Omit<Contact, "id" | "accountId" | "email" | "active"> & { local: string; active?: boolean }>;
}

const ACCOUNT_SEEDS: AccountSeed[] = [
  {
    key: "iberia", name: "Iberia Logistics", domain: "iberialogistics.example", segment: "Logistics", market: "Spain", owner: "Lucía Moreno",
    contacts: [
      { local: "c.navarro", name: "Carmen Navarro", title: "COO", role: "sponsor" },
      { local: "p.gil", name: "Pablo Gil", title: "Finance Director", role: "budget_holder" },
      { local: "legal", name: "Marta Soler", title: "Head of Legal", role: "legal" },
      { local: "it", name: "Rubén Cano", title: "IT Architect", role: "technical" },
    ],
  },
  {
    key: "citytransit", name: "City Transit", domain: "citytransit.example", segment: "Logistics", market: "Germany", owner: "Felix Braun",
    contacts: [
      { local: "k.hoffmann", name: "Katrin Hoffmann", title: "CEO", role: "sponsor" },
      { local: "procurement", name: "Uwe Krause", title: "Procurement Lead", role: "procurement" },
    ],
  },
  {
    key: "retail", name: "Retail Enterprise", domain: "retailenterprise.example", segment: "Retail", market: "Spain", owner: "Lucía Moreno",
    contacts: [
      { local: "a.vidal", name: "Ana Vidal", title: "Chief Customer Officer", role: "sponsor" },
      { local: "j.ortega", name: "Javier Ortega", title: "CFO", role: "budget_holder" },
      { local: "procurement", name: "Irene Castro", title: "Procurement Manager", role: "procurement" },
      { local: "it", name: "Diego Prieto", title: "IT Architect", role: "technical" },
    ],
  },
  {
    key: "insurance", name: "Insurance Group", domain: "insurancegroup.example", segment: "Insurance", market: "Germany", owner: "Felix Braun",
    contacts: [
      { local: "s.lang", name: "Sabine Lang", title: "Chief Operating Officer", role: "sponsor" },
      { local: "m.koch", name: "Markus Koch", title: "CFO", role: "budget_holder" },
      { local: "legal", name: "Petra Schulz", title: "General Counsel", role: "legal" },
      { local: "it", name: "Tobias Wolf", title: "Head of Platforms", role: "technical" },
    ],
  },
  {
    key: "energy", name: "Energy Group", domain: "energygroup.example", segment: "Energy", market: "Germany", owner: "Felix Braun",
    contacts: [
      { local: "h.richter", name: "Hannah Richter", title: "Chief Digital Officer", role: "sponsor" },
      { local: "cfo", name: "Stefan Neumann", title: "CFO", role: "budget_holder" },
      { local: "legal", name: "Lena Fischer", title: "Senior Counsel", role: "legal" },
      { local: "it", name: "Jan Becker", title: "Enterprise Architect", role: "technical" },
    ],
  },
  {
    key: "airline", name: "Airline Group", domain: "airlinegroup.example", segment: "Airlines", market: "Spain", owner: "Lucía Moreno",
    contacts: [
      { local: "r.serrano", name: "Raúl Serrano", title: "VP Customer Experience", role: "sponsor" },
      { local: "finance", name: "Nuria Blanco", title: "Finance Director", role: "budget_holder" },
      { local: "procurement", name: "Sergio Ramos", title: "Procurement Lead", role: "procurement" },
      { local: "it", name: "Clara Molina", title: "Integration Lead", role: "technical" },
    ],
  },
  {
    key: "savings", name: "Savings Bank", domain: "savingsbank.example", segment: "Banks", market: "Spain", owner: "Lucía Moreno",
    contacts: [
      { local: "m.iglesias", name: "Mónica Iglesias", title: "Chief Operating Officer", role: "sponsor" },
      { local: "finance", name: "Óscar Delgado", title: "CFO", role: "budget_holder" },
      { local: "security", name: "Teresa Ramírez", title: "CISO", role: "security" },
      { local: "legal", name: "Alberto Cruz", title: "Head of Legal", role: "legal" },
    ],
  },
  {
    key: "telecom", name: "Global Telecom", domain: "globaltelecom.example", segment: "Telecom", market: "Germany", owner: "Felix Braun",
    contacts: [
      { local: "t.meyer", name: "Thomas Meyer", title: "CIO (departed)", role: "sponsor", active: false },
      { local: "c.vogel", name: "Claudia Vogel", title: "CIO", role: "sponsor" },
      { local: "budget", name: "Andreas Keller", title: "Head of IT Finance", role: "budget_holder" },
      { local: "procurement", name: "Birgit Haas", title: "Procurement Director", role: "procurement" },
    ],
  },
  {
    key: "natbank", name: "National Bank", domain: "nationalbank.example", segment: "Banks", market: "Italy", owner: "Lucía Moreno",
    contacts: [
      { local: "g.romano", name: "Giulia Romano", title: "Chief Operating Officer", role: "sponsor" },
      { local: "cfo", name: "Marco Ricci", title: "CFO", role: "budget_holder" },
      { local: "ciso.office", name: "Luca Bianchi", title: "CISO", role: "security" },
      { local: "legal", name: "Francesca Greco", title: "Head of Legal", role: "legal" },
    ],
  },
  {
    key: "travel", name: "Travel Marketplace", domain: "travelmarketplace.example", segment: "Retail", market: "Spain", owner: "Lucía Moreno",
    contacts: [
      { local: "p.herrera", name: "Paula Herrera", title: "Head of Customer Care", role: "sponsor" },
      { local: "procurement", name: "Iván Ruiz", title: "Procurement Manager", role: "procurement" },
    ],
  },
];

export const ACCOUNTS: Account[] = ACCOUNT_SEEDS.map((a) => ({
  id: `acc-${a.key}`,
  name: a.name,
  emailDomains: [a.domain],
  segment: a.segment,
  market: a.market,
  ownerName: a.owner,
  archivedAt: null,
}));

export const CONTACTS: Contact[] = ACCOUNT_SEEDS.flatMap((a) =>
  a.contacts.map((c) => ({
    id: `con-${a.key}-${c.local.replace(/\./g, "-")}`,
    accountId: `acc-${a.key}`,
    name: c.name,
    title: c.title,
    email: `${c.local}@${a.domain}`,
    role: c.role,
    active: c.active ?? true,
  })),
);

/** Email address of a seeded contact, e.g. mail("natbank", "ciso.office"). */
export function mail(accountKey: string, local: string): string {
  const account = ACCOUNT_SEEDS.find((a) => a.key === accountKey);
  if (!account) throw new Error(`Unknown account ${accountKey}`);
  if (!account.contacts.some((c) => c.local === local)) throw new Error(`Unknown contact ${local}@${accountKey}`);
  return `${local}@${account.domain}`;
}

// ---------- Opportunities (Part VII) ----------

/**
 * Revenue for each seeded deal: ARR × 36 months + non-recurring = the PRD §8 TCV exactly.
 * Non-recurring (implementation and setup) is a tenth of TCV; ARR is the rest over three years.
 */
function revenue(tcvM: number | null) {
  if (tcvM === null) return { arr: null, termMonths: null, nonRecurring: null };
  const tcv = usdM(tcvM);
  const nonRecurring = (tcv / 10) as Cents;
  return { arr: (((tcv - nonRecurring) / 3) as Cents), termMonths: 36, nonRecurring };
}

function opp(
  key: string,
  o: Pick<Opportunity, "dealType" | "templateVariant" | "status" | "managerId" | "stage"> &
    Partial<Omit<Opportunity, "createdAt" | "tcv">> & { tcvM: number | null; createdAt: string },
): Opportunity {
  const account = ACCOUNT_SEEDS.find((a) => a.key === key)!;
  return {
    id: `opp-${key}`,
    accountId: `acc-${key}`,
    name: `${account.name} — Wonderful platform`,
    ownerName: account.owner,
    managerId: o.managerId,
    dealType: o.dealType,
    templateVariant: o.templateVariant,
    templateVersion: o.templateVariant === "none" ? null : 1,
    ...revenue(o.tcvM),
    tcv: o.tcvM === null ? null : usdM(o.tcvM),
    currency: "USD",
    status: o.status,
    statusReason: o.statusReason ?? null,
    signedDate: o.signedDate ?? null,
    closeDate: o.closeDate ?? null,
    stage: o.stage,
    createdAt: d(o.createdAt),
    archivedAt: null,
  };
}

export const OPPORTUNITIES: Opportunity[] = [
  opp("iberia", { dealType: "land_and_expand", templateVariant: "land", status: "won", managerId: MGR_A, tcvM: 2.0, createdAt: "2026-11-02", signedDate: d("2027-02-12"), closeDate: d("2027-02-12"), stage: "Closed won" }),
  opp("citytransit", { dealType: "land_and_expand", templateVariant: "land", status: "lost", managerId: MGR_B, tcvM: 1.8, createdAt: "2026-11-09", statusReason: "Customer chose a competitor at signature", closeDate: d("2027-03-15"), stage: "Closed lost" }),
  opp("retail", { dealType: "land_and_expand", templateVariant: "land", status: "open", managerId: MGR_A, tcvM: 1.5, createdAt: "2026-12-01", closeDate: d("2027-03-20"), stage: "Contract" }),
  opp("insurance", { dealType: "major_accounts", templateVariant: "major_accounts", status: "open", managerId: MGR_B, tcvM: 10.0, createdAt: "2026-11-25", closeDate: d("2027-03-25"), stage: "Contract" }),
  opp("energy", { dealType: "major_accounts", templateVariant: "major_accounts", status: "open", managerId: MGR_B, tcvM: 12.5, createdAt: "2026-12-03", closeDate: d("2027-03-15"), stage: "Contract" }),
  opp("airline", { dealType: "land_and_expand", templateVariant: "land", status: "open", managerId: MGR_A, tcvM: 2.5, createdAt: "2026-12-10", closeDate: d("2027-03-28"), stage: "Pilot" }),
  opp("savings", { dealType: "land_and_expand", templateVariant: "land", status: "open", managerId: MGR_A, tcvM: 1.0, createdAt: "2027-02-23", closeDate: d("2027-03-31"), stage: "Security review" }),
  opp("telecom", { dealType: "major_accounts", templateVariant: "major_accounts", status: "open", managerId: MGR_B, tcvM: 15.0, createdAt: "2026-11-30", closeDate: d("2027-03-31"), stage: "Contract" }),
  opp("natbank", { dealType: "major_accounts", templateVariant: "major_accounts", status: "open", managerId: MGR_A, tcvM: 20.0, createdAt: "2026-11-20", closeDate: d("2027-03-31"), stage: "Security review" }),
  opp("travel", { dealType: "payg", templateVariant: "none", status: "open", managerId: MGR_A, tcvM: null, createdAt: "2027-02-01", closeDate: d("2027-03-31"), stage: "Contract" }),
];

export const DEAL_CONDITIONS: DealCondition[] = OPPORTUNITIES.filter((o) => o.templateVariant !== "none").flatMap((o) => {
  const template = CONDITION_TEMPLATES.find((t) => t.variant === o.templateVariant && t.version === o.templateVersion)!;
  return template.conditions.map((c) => ({
    id: `${o.id}:${c.type}`,
    opportunityId: o.id,
    type: c.type,
    owner: c.defaultOwner,
  }));
});

// ---------- Quarter and targets ----------

export const QUARTERS: Quarter[] = [
  { id: QUARTER_ID, label: "Q1 2027", start: d("2027-01-01"), end: d("2027-03-31"), timeZone: "UTC" },
];

export const QUARTER_TARGETS: QuarterTarget[] = [
  { id: "tgt-2027-Q1-company", quarterId: QUARTER_ID, managerId: null, target: usdM(46.0) },
  { id: "tgt-2027-Q1-mgr-a", quarterId: QUARTER_ID, managerId: MGR_A, target: usdM(23.0) },
  { id: "tgt-2027-Q1-mgr-b", quarterId: QUARTER_ID, managerId: MGR_B, target: usdM(23.0) },
];

// ---------- Planning standards v1 (Part VII) ----------

const PS_RATIONALE = "Initial assumption, pending Wonderful data";
const PS_EFFECTIVE = d("2026-10-01");

function ps(
  id: string,
  conditionType: PlanningStandard["conditionType"],
  segment: string | null,
  fast: number,
  standard: number,
  slow: number,
): PlanningStandard {
  return {
    id,
    conditionType,
    dealType: "all",
    segment,
    fastDays: fast,
    standardDays: standard,
    slowDays: slow,
    rationale: PS_RATIONALE,
    approvedBy: REVOPS,
    effectiveFrom: PS_EFFECTIVE,
    version: 1,
  };
}

export const PLANNING_STANDARDS: PlanningStandard[] = [
  ps("ps-executive_sponsor-all-v1", "executive_sponsor", null, 7, 14, 21),
  ps("ps-budget-all-v1", "budget", null, 10, 21, 35),
  ps("ps-pilot-all-v1", "pilot", null, 18, 30, 45),
  ps("ps-pilot_acceptance-all-v1", "pilot_acceptance", null, 1, 3, 7),
  ps("ps-vendor_selection-all-v1", "vendor_selection", null, 5, 12, 21),
  ps("ps-technical_validation-all-v1", "technical_validation", null, 10, 21, 32),
  ps("ps-security-banks-v1", "security", "Banks", 24, 30, 45),
  ps("ps-security-all-v1", "security", null, 24, 30, 45),
  ps("ps-procurement_legal-all-v1", "procurement_legal", null, 12, 21, 30),
];

// ---------- Events, Evidence and decisions ----------

interface ClaimSeed {
  condition: ConditionType;
  claim: ClaimKind;
  summary: string;
  quote: string;
  blockStart?: string;
  blockEnd?: string | null;
  contrary?: ContraryKind;
  /** Decision recorded in the seed. Omit for "waiting" (advancing) or "provisional" (reversing). */
  decision?: { kind: EvidenceDecisionKind; by: string; at?: string };
}

interface EventSeed {
  deal: string;
  date: string;
  sourceType: SourceType;
  origin: EventOrigin;
  sender: string | null;
  channel: EventChannel;
  subject: string;
  text: string;
  claims: ClaimSeed[];
}

const approvedBy = (by: string) => ({ kind: "approved" as const, by });
const confirmedBy = (by: string) => ({ kind: "confirmed" as const, by });

/** Shorthand for an email from a seeded customer contact. */
function email(deal: string, local: string, date: string, subject: string, text: string, claims: ClaimSeed[]): EventSeed {
  return { deal, date, sourceType: "email", origin: "customer", sender: mail(deal, local), channel: "email", subject, text, claims };
}

/** Shorthand for a customer document (approval record, award letter, certificate…). */
function doc(deal: string, local: string, date: string, sourceType: SourceType, subject: string, text: string, claims: ClaimSeed[]): EventSeed {
  return { deal, date, sourceType, origin: "customer", sender: mail(deal, local), channel: "document", subject, text, claims };
}

/** Shared pre-signature history for a deal whose standard Conditions closed in order. */
function done(condition: ConditionType, summary: string, quote: string, by: string): ClaimSeed {
  return { condition, claim: condition === "vendor_selection" ? "selected" : "done", summary, quote, decision: approvedBy(by) };
}

const EVENT_SEEDS: EventSeed[] = [
  // ----- Iberia Logistics (Won, signed Feb 12) -----
  email("iberia", "c.navarro", "2026-12-02", "Sponsorship", "I am the executive sponsor for the Wonderful programme and will chair the steering group.", [
    done("executive_sponsor", "Sponsor confirmed in writing", "I am the executive sponsor for the Wonderful programme", MGR_A),
  ]),
  email("iberia", "p.gil", "2026-12-09", "Budget", "Funds are approved for the Wonderful purchase this period.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for the Wonderful purchase this period.", REVOPS),
  ]),
  doc("iberia", "it", "2026-12-15", "approval_record", "Integration sign-off", "Integration test record: all integrations passed. Signed off by the IT Architect.", [
    done("technical_validation", "Integration test record signed off", "all integrations passed", MGR_A),
  ]),
  doc("iberia", "c.navarro", "2026-12-20", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance certificate: the pilot met its agreed targets and is accepted.", [
    done("pilot", "Signed pilot acceptance", "the pilot met its agreed targets and is accepted", REVOPS),
  ]),
  doc("iberia", "legal", "2027-01-05", "approval_record", "Security approval", "Risk assessment approved by the security office.", [
    done("security", "Approved risk assessment", "Risk assessment approved by the security office.", MGR_A),
  ]),
  email("iberia", "c.navarro", "2027-01-10", "Decision", "We have chosen Wonderful. Please send the contract to sign.", [
    done("vendor_selection", "Customer has chosen Wonderful", "We have chosen Wonderful.", REVOPS),
  ]),
  email("iberia", "legal", "2027-01-20", "Contract review", "Our legal team has started the contract review and returned first redlines.", [
    { condition: "procurement_legal", claim: "progress", summary: "First redlines returned", quote: "returned first redlines", decision: approvedBy(MGR_A) },
  ]),
  email("iberia", "legal", "2027-02-10", "Contract approved", "The contract version 4 is approved for signature.", [
    done("procurement_legal", "Contract approved for signature", "The contract version 4 is approved for signature.", MGR_A),
  ]),

  // ----- City Transit (Lost Feb 25; all Conditions were Done) -----
  email("citytransit", "k.hoffmann", "2026-12-01", "Sponsorship", "I confirm I sponsor the Wonderful project.", [
    done("executive_sponsor", "Sponsor confirmed", "I confirm I sponsor the Wonderful project.", MGR_B),
  ]),
  email("citytransit", "k.hoffmann", "2026-12-12", "Budget", "The budget for this purchase is approved for this period.", [
    done("budget", "Budget approved (stated)", "The budget for this purchase is approved for this period.", REVOPS),
  ]),
  doc("citytransit", "k.hoffmann", "2026-12-22", "acceptance_certificate", "Pilot accepted", "Pilot acceptance: targets met, accepted.", [
    done("pilot", "Pilot accepted", "targets met, accepted", REVOPS),
  ]),
  doc("citytransit", "procurement", "2027-01-08", "approval_record", "Technical sign-off", "Technical validation signed off by the customer.", [
    done("technical_validation", "Technical sign-off", "Technical validation signed off by the customer.", MGR_B),
  ]),
  email("citytransit", "k.hoffmann", "2027-01-14", "Decision", "We have decided to go with Wonderful.", [
    done("vendor_selection", "Selection stated", "We have decided to go with Wonderful.", REVOPS),
  ]),
  doc("citytransit", "procurement", "2027-01-26", "approval_record", "Security approval", "Security approval record issued.", [
    done("security", "Security approval record", "Security approval record issued.", MGR_B),
  ]),
  email("citytransit", "procurement", "2027-02-18", "Contract", "The contract is agreed and ready to sign.", [
    done("procurement_legal", "Contract agreed and ready to sign", "The contract is agreed and ready to sign.", MGR_B),
  ]),

  // ----- Retail Enterprise (Firm: Budget and Vendor selection closed by Direct Evidence) -----
  email("retail", "a.vidal", "2027-01-12", "Sponsorship", "I will sponsor this programme personally and have informed the executive committee.", [
    done("executive_sponsor", "Sponsor confirmed in writing", "I will sponsor this programme personally", MGR_A),
  ]),
  doc("retail", "j.ortega", "2027-01-20", "approval_record", "Budget approval", "Budget line RE-2027-114 is approved for the Wonderful contract.", [
    done("budget", "Budget approval record", "Budget line RE-2027-114 is approved for the Wonderful contract.", REVOPS),
  ]),
  doc("retail", "a.vidal", "2027-01-22", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance certificate: all agreed targets were met.", [
    done("pilot", "Signed pilot acceptance", "all agreed targets were met", REVOPS),
  ]),
  doc("retail", "it", "2027-01-25", "approval_record", "Technical sign-off", "Integration test record completed and signed off.", [
    done("technical_validation", "Integration test record", "Integration test record completed and signed off.", MGR_A),
  ]),
  doc("retail", "it", "2027-01-28", "approval_record", "Security approval", "Security risk assessment approved.", [
    done("security", "Approved risk assessment", "Security risk assessment approved.", MGR_A),
  ]),
  doc("retail", "a.vidal", "2027-02-02", "award_letter", "Award letter", "Award letter: Retail Enterprise awards the customer service AI contract to Wonderful.", [
    done("vendor_selection", "Award letter", "awards the customer service AI contract to Wonderful", REVOPS),
  ]),
  email("retail", "procurement", "2027-02-08", "Contract review", "We have started the contract review and returned the first redlines.", [
    { condition: "procurement_legal", claim: "progress", summary: "First redlines returned", quote: "returned the first redlines", decision: approvedBy(MGR_A) },
  ]),
  email("retail", "procurement", "2027-02-19", "Contract review", "Second-round redlines are attached.", [
    { condition: "procurement_legal", claim: "progress", summary: "Second-round redlines returned", quote: "Second-round redlines are attached.", decision: approvedBy(MGR_A) },
  ]),

  // ----- Insurance Group (Firm: Direct budget and selection) -----
  email("insurance", "s.lang", "2027-01-10", "Sponsorship", "I confirm my sponsorship of the Wonderful programme.", [
    done("executive_sponsor", "Sponsor confirmed", "I confirm my sponsorship of the Wonderful programme.", MGR_B),
  ]),
  doc("insurance", "m.koch", "2027-01-18", "approval_record", "Budget approval", "Purchase requisition PR-5531 for Wonderful is approved.", [
    done("budget", "Approved purchase requisition", "Purchase requisition PR-5531 for Wonderful is approved.", REVOPS),
  ]),
  doc("insurance", "s.lang", "2027-01-24", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance certificate signed: targets met.", [
    done("pilot", "Signed pilot acceptance", "Pilot acceptance certificate signed: targets met.", REVOPS),
  ]),
  doc("insurance", "it", "2027-01-26", "approval_record", "Technical sign-off", "Technical validation completed and signed off.", [
    done("technical_validation", "Technical sign-off", "Technical validation completed and signed off.", MGR_B),
  ]),
  doc("insurance", "it", "2027-02-03", "approval_record", "Security approval", "Information security approval granted.", [
    done("security", "Security approval record", "Information security approval granted.", MGR_B),
  ]),
  doc("insurance", "s.lang", "2027-02-09", "letter_of_intent", "Letter of intent", "Letter of intent: Insurance Group intends to contract with Wonderful.", [
    done("vendor_selection", "Letter of intent", "Insurance Group intends to contract with Wonderful", REVOPS),
  ]),
  email("insurance", "legal", "2027-02-15", "Contract review", "Our legal team has started the review and sent the first comments.", [
    { condition: "procurement_legal", claim: "progress", summary: "First contract comments sent", quote: "sent the first comments", decision: approvedBy(MGR_B) },
  ]),
  email("insurance", "legal", "2027-02-24", "Contract review", "We have returned our redlines on the master agreement.", [
    { condition: "procurement_legal", claim: "progress", summary: "Redlines returned", quote: "We have returned our redlines on the master agreement.", decision: approvedBy(MGR_B) },
  ]),
  // PRD §8: Stated, waiting for approval (test 8).
  email("insurance", "legal", "2027-02-27", "Contract review", "Our counsel has finished the first read; comments attached.", [
    { condition: "procurement_legal", claim: "progress", summary: "Counsel finished first read; comments returned", quote: "Our counsel has finished the first read; comments attached." },
  ]),

  // ----- Energy Group (Core: blocked until Mar 5) -----
  email("energy", "h.richter", "2027-01-14", "Sponsorship", "I am sponsoring this programme for the group.", [
    done("executive_sponsor", "Sponsor confirmed", "I am sponsoring this programme for the group.", MGR_B),
  ]),
  email("energy", "cfo", "2027-01-21", "Budget", "Funds are approved for this purchase this quarter.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for this purchase this quarter.", REVOPS),
  ]),
  doc("energy", "h.richter", "2027-01-27", "acceptance_certificate", "Pilot acceptance", "Pilot accepted: all targets met.", [
    done("pilot", "Pilot accepted", "Pilot accepted: all targets met.", REVOPS),
  ]),
  doc("energy", "it", "2027-02-02", "approval_record", "Technical sign-off", "Integration validation signed off.", [
    done("technical_validation", "Integration validation signed off", "Integration validation signed off.", MGR_B),
  ]),
  doc("energy", "it", "2027-02-09", "approval_record", "Security approval", "Security review approved.", [
    done("security", "Security approval", "Security review approved.", MGR_B),
  ]),
  email("energy", "h.richter", "2027-02-16", "Decision", "We have chosen Wonderful as our vendor.", [
    done("vendor_selection", "Selection stated", "We have chosen Wonderful as our vendor.", REVOPS),
  ]),
  email("energy", "legal", "2027-02-23", "Contract", "Our legal team has started on the contract and sent initial questions.", [
    { condition: "procurement_legal", claim: "progress", summary: "Contract work started; initial questions sent", quote: "started on the contract and sent initial questions", decision: approvedBy(MGR_B) },
  ]),
  email("energy", "legal", "2027-02-26", "Redlines", "First redlines attached; our general counsel is away until March 5.", [
    { condition: "procurement_legal", claim: "progress", summary: "First redlines returned", quote: "First redlines attached", decision: approvedBy(MGR_B) },
    { condition: "procurement_legal", claim: "blocked", summary: "Blocked until Mar 5: general counsel away", quote: "our general counsel is away until March 5", blockStart: "2027-02-26", blockEnd: "2027-03-05", decision: confirmedBy(MGR_B) },
  ]),
  // Internal note: Asserted, stored and shown, changes nothing (test 23).
  { deal: "energy", date: "2027-02-28", sourceType: "internal_note", origin: "internal", sender: "felix.braun@wonderful.example", channel: "note", subject: "Rep note", text: "The CFO told me the contract is as good as signed.", claims: [
    { condition: "procurement_legal", claim: "done", summary: "Rep says the contract is as good as signed", quote: "the contract is as good as signed" },
  ] },

  // ----- Airline Group (Engaged: pilot under plan, Vendor selection not started) -----
  email("airline", "r.serrano", "2027-01-08", "Sponsorship", "I confirm I am the executive sponsor of the Wonderful evaluation.", [
    done("executive_sponsor", "Sponsor confirmed", "I confirm I am the executive sponsor of the Wonderful evaluation.", MGR_A),
  ]),
  email("airline", "finance", "2027-01-15", "Budget", "Funds are approved for this purchase in this period.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for this purchase in this period.", REVOPS),
  ]),
  doc("airline", "it", "2027-01-30", "approval_record", "Technical sign-off", "Integration test record completed: all systems connected.", [
    done("technical_validation", "Integration test record", "Integration test record completed", MGR_A),
  ]),
  doc("airline", "it", "2027-02-06", "approval_record", "Security approval", "Security assessment approved.", [
    done("security", "Security approval", "Security assessment approved.", MGR_A),
  ]),
  email("airline", "procurement", "2027-02-20", "Contract", "Our procurement team has sent the first contract comments.", [
    { condition: "procurement_legal", claim: "progress", summary: "First contract comments sent", quote: "sent the first contract comments", decision: approvedBy(MGR_A) },
  ]),
  email("airline", "procurement", "2027-02-27", "Contract", "The second set of contract comments is attached.", [
    { condition: "procurement_legal", claim: "progress", summary: "Second set of contract comments", quote: "The second set of contract comments is attached.", decision: approvedBy(MGR_A) },
  ]),

  // ----- Savings Bank (Committed, ready on fast timing only) -----
  email("savings", "m.iglesias", "2027-01-19", "Sponsorship", "I am the executive sponsor for this project.", [
    done("executive_sponsor", "Sponsor confirmed", "I am the executive sponsor for this project.", MGR_A),
  ]),
  email("savings", "finance", "2027-01-26", "Budget", "Funds are approved for this purchase this period.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for this purchase this period.", REVOPS),
  ]),
  doc("savings", "m.iglesias", "2027-01-29", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance signed: targets achieved.", [
    done("pilot", "Signed pilot acceptance", "Pilot acceptance signed: targets achieved.", REVOPS),
  ]),
  doc("savings", "security", "2027-02-04", "approval_record", "Technical sign-off", "Technical integration validated and signed off.", [
    done("technical_validation", "Technical sign-off", "Technical integration validated and signed off.", MGR_A),
  ]),
  email("savings", "m.iglesias", "2027-02-10", "Decision", "We have decided to go with Wonderful.", [
    done("vendor_selection", "Selection stated", "We have decided to go with Wonderful.", REVOPS),
  ]),
  email("savings", "security", "2027-02-12", "Security review", "Our security office has started the review of your documentation.", [
    { condition: "security", claim: "started", summary: "Security review started", quote: "Our security office has started the review", decision: approvedBy(MGR_A) },
  ]),
  email("savings", "security", "2027-02-26", "Security review", "The first part of the security review is complete.", [
    { condition: "security", claim: "progress", summary: "First part of security review complete", quote: "The first part of the security review is complete.", decision: approvedBy(MGR_A) },
  ]),

  // ----- Global Telecom (At risk: sponsor left) -----
  email("telecom", "t.meyer", "2027-01-06", "Sponsorship", "As CIO I am sponsoring the Wonderful programme.", [
    done("executive_sponsor", "Sponsor confirmed", "As CIO I am sponsoring the Wonderful programme.", MGR_B),
  ]),
  email("telecom", "budget", "2027-01-13", "Budget", "Funds are approved for this purchase this period.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for this purchase this period.", REVOPS),
  ]),
  doc("telecom", "t.meyer", "2027-01-20", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance: targets met and accepted.", [
    done("pilot", "Pilot accepted", "Pilot acceptance: targets met and accepted.", REVOPS),
  ]),
  doc("telecom", "procurement", "2027-01-27", "approval_record", "Technical sign-off", "Technical validation signed off.", [
    done("technical_validation", "Technical sign-off", "Technical validation signed off.", MGR_B),
  ]),
  doc("telecom", "procurement", "2027-02-03", "approval_record", "Security approval", "Security approval granted.", [
    done("security", "Security approval", "Security approval granted.", MGR_B),
  ]),
  email("telecom", "t.meyer", "2027-02-11", "Decision", "We have chosen Wonderful.", [
    done("vendor_selection", "Selection stated", "We have chosen Wonderful.", REVOPS),
  ]),
  // Part VII: engagement record that the seeded Bet relies on.
  email("telecom", "budget", "2027-02-20", "Budget", "I confirm the budget for the Wonderful contract remains approved.", [
    done("budget", "Budget holder confirms budget remains approved", "the budget for the Wonderful contract remains approved", REVOPS),
  ]),
  // Press release: external, grade Stated (Part VII).
  { deal: "telecom", date: "2027-02-26", sourceType: "press_release", origin: "external", sender: "newsroom@globaltelecom.example", channel: "news", subject: "Leadership change", text: "Global Telecom announces that its CIO has left the company. A successor, Claudia Vogel, has been named.", claims: [
    { condition: "executive_sponsor", claim: "reopened", summary: "Sponsor left: Condition reopened", quote: "its CIO has left the company", decision: confirmedBy(REVOPS) },
    { condition: "executive_sponsor", claim: "contrary", summary: "Contrary signal: sponsor left", quote: "its CIO has left the company", contrary: "sponsor_left", decision: confirmedBy(REVOPS) },
  ] },

  // ----- National Bank (Committed, Late: blocked until Mar 16) -----
  email("natbank", "g.romano", "2027-01-05", "Sponsorship", "I confirm that I sponsor the Wonderful programme.", [
    done("executive_sponsor", "Sponsor confirmed", "I confirm that I sponsor the Wonderful programme.", MGR_A),
  ]),
  email("natbank", "cfo", "2027-01-12", "Budget", "Funds are approved for this purchase this period.", [
    done("budget", "Budget holder states funds are approved", "Funds are approved for this purchase this period.", REVOPS),
  ]),
  doc("natbank", "g.romano", "2027-01-19", "acceptance_certificate", "Pilot acceptance", "Pilot acceptance certificate: targets met.", [
    done("pilot", "Signed pilot acceptance", "Pilot acceptance certificate: targets met.", REVOPS),
  ]),
  doc("natbank", "ciso.office", "2027-01-28", "approval_record", "Technical sign-off", "Technical validation signed off by the bank.", [
    done("technical_validation", "Technical sign-off", "Technical validation signed off by the bank.", MGR_A),
  ]),
  email("natbank", "ciso.office", "2027-02-04", "Security review", "Our CISO office has begun the security review and sent you the questionnaire.", [
    { condition: "security", claim: "started", summary: "Security review started", quote: "Our CISO office has begun the security review", decision: approvedBy(MGR_A) },
  ]),
  email("natbank", "g.romano", "2027-02-10", "Decision", "We have decided to go with Wonderful.", [
    done("vendor_selection", "Selection stated", "We have decided to go with Wonderful.", REVOPS),
  ]),
  email("natbank", "g.romano", "2027-02-17", "Timing", "We intend to sign this quarter.", [
    { condition: "executive_sponsor", claim: "intent", summary: "Sponsor restates intent to sign this quarter", quote: "We intend to sign this quarter.", decision: approvedBy(MGR_A) },
  ]),
  email("natbank", "ciso.office", "2027-02-24", "Security review", "Your questionnaire responses are accepted; the risk committee sitting has moved to March 16.", [
    { condition: "security", claim: "progress", summary: "Questionnaire responses accepted", quote: "Your questionnaire responses are accepted", decision: approvedBy(MGR_A) },
    { condition: "security", claim: "blocked", summary: "Blocked until Mar 16: risk committee moved", quote: "the risk committee sitting has moved to March 16", blockStart: "2027-02-24", blockEnd: "2027-03-16", decision: confirmedBy(MGR_A) },
  ]),
];

interface BuiltEvents {
  events: DealEvent[];
  evidence: Evidence[];
  decisions: EvidenceDecision[];
  nextSeq: number;
}

function buildEvents(seeds: EventSeed[], startSeq: number): BuiltEvents {
  const events: DealEvent[] = [];
  const evidence: Evidence[] = [];
  const decisions: EvidenceDecision[] = [];
  let seq = startSeq;
  const counters = new Map<string, number>();
  const ordered = [...seeds].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const s of ordered) {
    const base = `${s.deal}-${s.date}`;
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    const eventId = `ev-${base}-${n}`;
    const event: DealEvent = {
      id: eventId,
      opportunityId: `opp-${s.deal}`,
      occurredAt: d(s.date),
      sourceType: s.sourceType,
      origin: s.origin,
      sender: s.sender,
      channel: s.channel,
      subject: s.subject,
      text: s.text,
      sourceLabel: "seeded",
      sourceRecordId: `seed:${eventId}`,
      contentHash: eventContentHash(s.sender, s.text),
      seq: seq++,
      loggedAt: d(s.date),
    };
    events.push(event);
    s.claims.forEach((c, i) => {
      if (!s.text.includes(c.quote)) throw new Error(`Seed quote not verbatim in ${eventId}: "${c.quote}"`);
      const evidenceId = `evd-${base}-${n}-${i + 1}`;
      evidence.push({
        id: evidenceId,
        eventId,
        opportunityId: event.opportunityId,
        conditionType: c.condition,
        claim: c.claim,
        summary: c.summary,
        quote: c.quote,
        blockStart: c.blockStart ? d(c.blockStart) : null,
        blockEnd: c.blockEnd ? d(c.blockEnd) : null,
        contraryKind: c.contrary ?? null,
        extractionVersion: EXTRACTION_VERSION,
        confidence: null,
      });
      if (c.decision) {
        decisions.push({
          id: `dec-${evidenceId}`,
          evidenceId,
          decision: c.decision.kind,
          actorId: c.decision.by,
          at: d(c.decision.at ?? s.date),
          seq: seq++,
          reason: null,
          duplicateOf: null,
        });
      }
    });
  }
  return { events, evidence, decisions, nextSeq: seq };
}

// ---------- Pilot (DR-02, Part VII) ----------

export const PILOT_PLANS: PilotPlan[] = [
  {
    id: "pilot-airline",
    opportunityId: "opp-airline",
    evaluationDate: d("2027-03-07"),
    acceptanceMode: "customer_signoff",
    resolutionTarget: 70,
    sentimentFloor: 90,
    weeklyVolumeFloor: 500,
  },
];

const reading = (week: string, resolution: number, sentiment: number, volume: number): PilotReading => ({
  id: `pr-airline-${week}`,
  opportunityId: "opp-airline",
  weekEnding: d(week),
  resolutionRate: resolution,
  sentiment,
  volume,
  sourceLabel: "seeded",
});

export const PILOT_READINGS: PilotReading[] = [
  reading("2027-02-07", 60, 94, 610),
  reading("2027-02-14", 63, 95, 620),
  reading("2027-02-21", 65, 95, 650),
  reading("2027-02-28", 68, 95, 640),
];

/** Loaded by the "Next week" demo control (Part VII), not part of the initial store. */
export const NEXT_WEEK_READING: PilotReading = reading("2027-03-07", 66, 95, 630);

// ---------- Disputes (PRD §8, Part VII) ----------

export const DISPUTES: Dispute[] = [
  {
    id: "dsp-natbank-in",
    opportunityId: "opp-natbank",
    quarterId: QUARTER_ID,
    managerId: MGR_A,
    direction: "in",
    reason: "The bank will run legal in parallel; the sponsor has said they sign this quarter.",
    bets: [{ conditionType: "procurement_legal", by: d("2027-03-31") }],
    outCondition: null,
    createdAt: d("2027-02-25"),
    withdrawnAt: null,
  },
  {
    id: "dsp-telecom-in",
    opportunityId: "opp-telecom",
    quarterId: QUARTER_ID,
    managerId: MGR_B,
    direction: "in",
    reason: "The new CIO will confirm sponsorship within a week.",
    bets: [{ conditionType: "executive_sponsor", by: d("2027-03-05") }],
    outCondition: null,
    createdAt: d("2027-02-27"),
    withdrawnAt: null,
  },
  {
    id: "dsp-insurance-out",
    opportunityId: "opp-insurance",
    quarterId: QUARTER_ID,
    managerId: MGR_B,
    direction: "out",
    reason: "Their legal team is always late.",
    bets: [],
    outCondition: "procurement_legal",
    createdAt: d("2027-02-18"),
    withdrawnAt: null,
  },
];

// ---------- ChangeLog (G-5) ----------

function change(
  id: string,
  entityId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  actorId: string,
  at: string,
  seq: number,
): ChangeLogEntry {
  return { id, entity: "opportunity", entityId, field, oldValue, newValue, actorId, at: d(at), seq, reason: null };
}

// ---------- Previous Forecast run, Feb 22 (stored fixture, PRD §8) ----------

const FEB22 = d("2027-02-22");
const FEB22_RUN_ID = "run-2027-02-22-fixture";

interface FixtureLine {
  deal: string;
  managerId: string;
  tcvM: number | null;
  group: RunLine["group"];
  eligibility: RunLine["eligibility"];
  exclusionReason?: string;
}

const FEB22_LINES: FixtureLine[] = [
  { deal: "iberia", managerId: MGR_A, tcvM: 2.0, group: "signed", eligibility: "signed" },
  { deal: "retail", managerId: MGR_A, tcvM: 1.5, group: "firm", eligibility: "evaluated" },
  { deal: "insurance", managerId: MGR_B, tcvM: 10.0, group: "core", eligibility: "evaluated" },
  { deal: "energy", managerId: MGR_B, tcvM: 15.0, group: "core", eligibility: "evaluated" },
  { deal: "telecom", managerId: MGR_B, tcvM: 15.0, group: "core", eligibility: "evaluated" },
  { deal: "natbank", managerId: MGR_A, tcvM: 20.0, group: "core", eligibility: "evaluated" },
  { deal: "citytransit", managerId: MGR_B, tcvM: 1.8, group: "core", eligibility: "evaluated" },
  { deal: "airline", managerId: MGR_A, tcvM: 2.5, group: "stretch", eligibility: "evaluated" },
  { deal: "travel", managerId: MGR_A, tcvM: null, group: "excluded", eligibility: "excluded", exclusionReason: "PAYG — not forecast" },
];

function totalsFor(lines: FixtureLine[], disputeOut: number): RunTotals {
  const sum = (groups: RunLine["group"][]): Cents =>
    usdM(lines.filter((l) => groups.includes(l.group)).reduce((acc, l) => acc + (l.tcvM ?? 0), 0));
  const conservative = sum(["signed", "firm"]);
  const core = sum(["signed", "firm", "core"]);
  const stretch = sum(["signed", "firm", "core", "stretch"]);
  return { conservative, core, stretch, managerCommitment: (core - usdM(disputeOut)) as Cents };
}

function buildFeb22Run(seq: number): { run: ForecastRun; lines: RunLine[] } {
  // On Feb 22 only the Insurance Group Dispute Out (raised Feb 18) was live.
  const run: ForecastRun = {
    id: FEB22_RUN_ID,
    asOfDate: FEB22,
    quarterId: QUARTER_ID,
    quarterEnd: d("2027-03-31"),
    trigger: "fixture",
    seq,
    engineVersion: "fixture",
    templateVersions: CONDITION_TEMPLATES.map((t) => t.id),
    extractionVersion: EXTRACTION_VERSION,
    configSnapshot: {
      planningStandards: PLANNING_STANDARDS.map((p) => ({
        id: p.id, version: p.version, fast: p.fastDays, standard: p.standardDays, slow: p.slowDays,
      })),
      note: "Seeded stored run (PRD §8). Values are given, not recomputed.",
    },
    totals: totalsFor(FEB22_LINES, 10.0),
    managerTotals: {
      [MGR_A]: totalsFor(FEB22_LINES.filter((l) => l.managerId === MGR_A), 0),
      [MGR_B]: totalsFor(FEB22_LINES.filter((l) => l.managerId === MGR_B), 10.0),
    },
    isFixture: true,
  };
  const lines: RunLine[] = FEB22_LINES.map((l) => ({
    id: `${FEB22_RUN_ID}:opp-${l.deal}`,
    runId: FEB22_RUN_ID,
    opportunityId: `opp-${l.deal}`,
    managerId: l.managerId,
    eligibility: l.eligibility,
    exclusionReason: l.exclusionReason ?? null,
    tcv: l.tcvM === null ? null : usdM(l.tcvM),
    currency: "USD",
    commitment: l.group === "core" || l.group === "firm" ? "committed" : l.group === "stretch" ? "engaged" : null,
    commitmentRule: null,
    esdFast: null,
    esdStandard: null,
    esdSlow: null,
    group: l.group,
    reason: null,
    ruleIds: [],
    detail: { fixture: true },
  }));
  return { run, lines };
}

// ---------- Assemble ----------

export function buildCanonicalSeed(): Dataset {
  let seq = 1;
  const built = buildEvents(EVENT_SEEDS, seq);
  seq = built.nextSeq;

  const changeLog: ChangeLogEntry[] = [
    change("chg-iberia-stage", "opp-iberia", "stage", "Contract", "Closed won", MGR_A, "2027-02-12", seq++),
    change("chg-iberia-status", "opp-iberia", "status", "open", "won", MGR_A, "2027-02-12", seq++),
    change("chg-iberia-signed", "opp-iberia", "signed_date", null, "2027-02-12", MGR_A, "2027-02-12", seq++),
    change("chg-energy-arr", "opp-energy", "arr", String(revenue(15.0).arr), String(revenue(12.5).arr), MGR_B, "2027-02-23", seq++),
    change("chg-energy-nrr", "opp-energy", "non_recurring", String(revenue(15.0).nonRecurring), String(revenue(12.5).nonRecurring), MGR_B, "2027-02-23", seq++),
    change("chg-energy-tcv", "opp-energy", "tcv", String(usdM(15.0)), String(usdM(12.5)), MGR_B, "2027-02-23", seq++),
    change("chg-citytransit-stage", "opp-citytransit", "stage", "Contract", "Closed lost", MGR_B, "2027-02-25", seq++),
    change("chg-citytransit-status", "opp-citytransit", "status", "open", "lost", MGR_B, "2027-02-25", seq++),
  ];

  const feb22 = buildFeb22Run(seq++);

  return {
    users: USERS,
    accounts: ACCOUNTS,
    contacts: CONTACTS,
    opportunities: OPPORTUNITIES,
    quarters: QUARTERS,
    quarterTargets: QUARTER_TARGETS,
    dealConditions: DEAL_CONDITIONS,
    pilotPlans: PILOT_PLANS,
    disputes: DISPUTES,
    session: [{ id: "session", asOfDate: DEMO_AS_OF, actingUserId: "u-cro", nextSeq: seq, seedVersion: SEED_VERSION }],
    conditionTemplates: CONDITION_TEMPLATES,
    planningStandards: PLANNING_STANDARDS,
    events: built.events,
    evidence: built.evidence,
    evidenceDecisions: built.decisions,
    pilotReadings: PILOT_READINGS,
    conditionWaivers: [],
    dealLinkOverrides: [],
    forecastRuns: [feb22.run],
    runLines: feb22.lines,
    submissions: [],
    changeLog,
  };
}
