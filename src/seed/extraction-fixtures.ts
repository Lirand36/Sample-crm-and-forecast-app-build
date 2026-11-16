// Stored extraction output for each .eml fixture (handoff Part VII), keyed by Message-ID.
// Deterministic (D-09): no model and no network. The EvidenceExtractionProvider reads this table.

import type { ClaimKind, ConditionType, ContraryKind } from "@/domain/entities";

export interface ExtractionClaim {
  condition: ConditionType;
  claim: ClaimKind;
  summary: string;
  quote: string;
  blockStart: string | null;
  blockEnd: string | null;
  contraryKind: ContraryKind | null;
}

export interface EmlFixture {
  file: string;
  messageId: string;
  account: string;
  tests: string;
  claims: ExtractionClaim[];
}

export const EML_FIXTURES: EmlFixture[] = [
  {
    "file": "energy-budget-reapproval.eml",
    "messageId": "<energy-budget-reapproval@fixtures.signature-path.example>",
    "account": "Energy Group",
    "tests": "Tests 6, 33, 42",
    "claims": [
      {
        "condition": "budget",
        "claim": "reopened",
        "summary": "Budget reopened: CFO re-approval required",
        "quote": "all commitments above €1M need CFO re-approval",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "retail-competitor-evaluation.eml",
    "messageId": "<retail-competitor-evaluation@fixtures.signature-path.example>",
    "account": "Retail Enterprise",
    "tests": "Test 16",
    "claims": [
      {
        "condition": "vendor_selection",
        "claim": "contrary",
        "contraryKind": "competitor_evaluation",
        "summary": "Contrary signal: competitor under evaluation",
        "quote": "the board has asked us to evaluate one more vendor",
        "blockStart": null,
        "blockEnd": null
      }
    ]
  },
  {
    "file": "airline-shortlist.eml",
    "messageId": "<airline-shortlist@fixtures.signature-path.example>",
    "account": "Airline Group",
    "tests": "Test 31",
    "claims": [
      {
        "condition": "vendor_selection",
        "claim": "status",
        "summary": "Shortlisted (does not close Vendor selection)",
        "quote": "You are on our shortlist of two",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "airline-selection.eml",
    "messageId": "<airline-selection@fixtures.signature-path.example>",
    "account": "Airline Group",
    "tests": "Test 31",
    "claims": [
      {
        "condition": "vendor_selection",
        "claim": "selected",
        "summary": "Customer has chosen Wonderful and asks for the contract",
        "quote": "We have decided to go with Wonderful; please send the contract.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "savings-security-approval.eml",
    "messageId": "<savings-security-approval@fixtures.signature-path.example>",
    "account": "Savings Bank",
    "tests": "Test 32",
    "claims": [
      {
        "condition": "security",
        "claim": "done",
        "summary": "Customer security office states approval",
        "quote": "The security review is approved.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "retail-status.eml",
    "messageId": "<retail-status@fixtures.signature-path.example>",
    "account": "Retail Enterprise",
    "tests": "Test 37",
    "claims": [
      {
        "condition": "procurement_legal",
        "claim": "status",
        "summary": "Status: no change",
        "quote": "No update yet, still with our legal team.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "insurance-second-progress.eml",
    "messageId": "<insurance-second-progress@fixtures.signature-path.example>",
    "account": "Insurance Group",
    "tests": "Test 52",
    "claims": [
      {
        "condition": "procurement_legal",
        "claim": "progress",
        "summary": "Second mark-up sent",
        "quote": "Our counsel has sent the second mark-up of the master agreement.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "natbank-postponed-no-date.eml",
    "messageId": "<natbank-postponed-no-date@fixtures.signature-path.example>",
    "account": "National Bank",
    "tests": "Test 55",
    "claims": [
      {
        "condition": "security",
        "claim": "blocked",
        "blockStart": "2027-03-01",
        "blockEnd": null,
        "summary": "Blocked with no end: risk committee postponed",
        "quote": "The risk committee has been postponed; no new date yet.",
        "contraryKind": null
      }
    ]
  },
  {
    "file": "natbank-committee-apr14.eml",
    "messageId": "<natbank-committee-apr14@fixtures.signature-path.example>",
    "account": "National Bank",
    "tests": "Test 56",
    "claims": [
      {
        "condition": "security",
        "claim": "blocked",
        "blockStart": "2027-03-12",
        "blockEnd": "2027-04-14",
        "summary": "Blocked until Apr 14: risk committee moved",
        "quote": "The risk committee sitting has been moved to April 14.",
        "contraryKind": null
      }
    ]
  },
  {
    "file": "airline-budget-for-ai.eml",
    "messageId": "<airline-budget-for-ai@fixtures.signature-path.example>",
    "account": "Airline Group",
    "tests": "Test 49",
    "claims": [
      {
        "condition": "budget",
        "claim": "status",
        "summary": "General AI budget (does not qualify for Budget approved)",
        "quote": "We have budget for AI initiatives this year.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "telecom-sponsor-confirmed.eml",
    "messageId": "<telecom-sponsor-confirmed@fixtures.signature-path.example>",
    "account": "Global Telecom",
    "tests": "Test 36",
    "claims": [
      {
        "condition": "executive_sponsor",
        "claim": "done",
        "summary": "New CIO confirms sponsorship",
        "quote": "I confirm I am the executive sponsor for the Wonderful programme.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "retail-board-approved-outside.eml",
    "messageId": "<retail-board-approved-outside@fixtures.signature-path.example>",
    "account": "Retail Enterprise",
    "tests": "Test 51a (sender outside the Account's domains)",
    "claims": [
      {
        "condition": "budget",
        "claim": "done",
        "summary": "Claim that the board approved",
        "quote": "the board approved the Wonderful contract",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "unverifiable-quote.eml",
    "messageId": "<unverifiable-quote@fixtures.signature-path.example>",
    "account": "Savings Bank",
    "tests": "Test 26 (stored extraction quotes text that is not in the email)",
    "claims": [
      {
        "condition": "security",
        "claim": "done",
        "summary": "Security approved (fabricated quote)",
        "quote": "The security review is approved.",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      }
    ]
  },
  {
    "file": "natbank-feb24-relogged.eml",
    "messageId": "<natbank-feb24-relogged@fixtures.signature-path.example>",
    "account": "National Bank",
    "tests": "Test 27 (same content as the seeded Feb 24 email)",
    "claims": [
      {
        "condition": "security",
        "claim": "progress",
        "summary": "Questionnaire responses accepted",
        "quote": "Your questionnaire responses are accepted",
        "blockStart": null,
        "blockEnd": null,
        "contraryKind": null
      },
      {
        "condition": "security",
        "claim": "blocked",
        "blockStart": "2027-02-24",
        "blockEnd": "2027-03-16",
        "summary": "Blocked until Mar 16: risk committee moved",
        "quote": "the risk committee sitting has moved to March 16",
        "contraryKind": null
      }
    ]
  }
];
