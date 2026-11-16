// Spec tests that need a synthetic deal (PRD §9 and Handoff Part VI). Each builds one extra deal on top of
// the seed, as the spec describes it, and reads the engine's answer for that deal only.

import { describe, expect, it } from "vitest";
import { signedAsOfCutoff } from "@/domain/backtest";
import { computeBridge } from "@/domain/bridge";
import { snapshotRun } from "@/domain/run-snapshot";
import { computeForecast, type ForecastInput } from "@/domain/forecast";
import { isoDate } from "@/domain/dates";
import type {
  ChangeLogEntry,
  ClaimKind,
  ConditionType,
  ContraryKind,
  DealEvent,
  DealLinkOverride,
  Evidence,
  EvidenceDecision,
  Opportunity,
  PilotPlan,
  PilotReading,
  PlanningStandard,
  SourceType,
} from "@/domain/entities";
import { usdM } from "@/domain/money";
import { buildCanonicalSeed, QUARTERS } from "@/seed/canonical";

const Q = QUARTERS[0]!;
const ALL: ConditionType[] = [
  "executive_sponsor",
  "budget",
  "pilot",
  "vendor_selection",
  "technical_validation",
  "security",
  "procurement_legal",
];

interface Claim {
  c: ConditionType;
  claim: ClaimKind;
  on: string;
  /** Documents are Direct; customer email is Stated. */
  source?: SourceType;
  blockStart?: string;
  blockEnd?: string | null;
  contrary?: ContraryKind;
  /** Default: approved (advancing) or confirmed (reversing). */
  decision?: "none";
}

interface Synth {
  claims: Claim[];
  status?: Opportunity["status"];
  signedDate?: string | null;
  pilot?: Partial<PilotPlan>;
  readings?: Array<
    Pick<PilotReading, "weekEnding" | "resolutionRate" | "sentiment" | "volume">
  >;
  standards?: (s: PlanningStandard[]) => PlanningStandard[];
  links?: Array<Pick<DealLinkOverride, "from" | "to" | "strength">>;
}

/** Every Condition Done by Direct Evidence in January, except the ones listed. */
const doneExcept = (...open: ConditionType[]): Claim[] =>
  ALL.filter((c) => !open.includes(c)).map((c, i) => ({
    c,
    claim: c === "vendor_selection" ? "selected" : "done",
    on: `2027-01-${String(10 + i).padStart(2, "0")}`,
    source: "approval_record",
  }));
/** A customer email stating intent: engagement on that date. */
const engagedOn = (on: string): Claim => ({
  c: "executive_sponsor",
  claim: "intent",
  on,
  source: "email",
});

function build(s: Synth): ForecastInput {
  const seed = buildCanonicalSeed();
  const id = "opp-syn";
  const opp: Opportunity = {
    ...seed.opportunities.find((o) => o.id === "opp-insurance")!,
    id,
    accountId: "acc-syn",
    name: "Synthetic Co — Wonderful platform",
    tcv: usdM(1.0),
    arr: usdM(0.3),
    termMonths: 36,
    nonRecurring: usdM(0.1),
    status: s.status ?? "open",
    signedDate: s.signedDate ? isoDate(s.signedDate) : null,
    stage: s.status === "won" ? "Closed won" : "Contract",
  };
  const events: DealEvent[] = [];
  const evidence: Evidence[] = [];
  const decisions: EvidenceDecision[] = [];
  s.claims.forEach((c, i) => {
    const source = c.source ?? "email";
    events.push({
      id: `ev-syn-${i}`,
      opportunityId: id,
      occurredAt: isoDate(c.on),
      sourceType: source,
      origin: "customer",
      sender: "someone@synthetic.example",
      channel: source === "email" ? "email" : "document",
      subject: null,
      text: `Synthetic ${c.c} ${c.claim}`,
      sourceLabel: "seeded",
      sourceRecordId: null,
      contentHash: `syn-${i}`,
      seq: 90000 + i * 2,
      loggedAt: isoDate(c.on),
    });
    evidence.push({
      id: `evd-syn-${i}`,
      eventId: `ev-syn-${i}`,
      opportunityId: id,
      conditionType: c.c,
      claim: c.claim,
      summary: `${c.c} ${c.claim}`,
      quote: `Synthetic ${c.c} ${c.claim}`,
      blockStart: c.blockStart ? isoDate(c.blockStart) : null,
      blockEnd: c.blockEnd ? isoDate(c.blockEnd) : null,
      contraryKind: c.contrary ?? null,
      extractionVersion: "fixture-v1",
      confidence: null,
    });
    if (c.decision !== "none" && c.claim !== "status") {
      const reversing = ["blocked", "reopened", "contrary"].includes(c.claim);
      decisions.push({
        id: `dec-syn-${i}`,
        evidenceId: `evd-syn-${i}`,
        decision: reversing ? "confirmed" : "approved",
        actorId: "u-revops",
        at: isoDate(c.on),
        seq: 90001 + i * 2,
        reason: null,
        duplicateOf: null,
      });
    }
  });
  const pilotPlans = s.pilot
    ? [
        ...seed.pilotPlans,
        {
          id: "pp-syn",
          opportunityId: id,
          evaluationDate: isoDate("2027-03-20"),
          acceptanceMode: "customer_signoff" as const,
          resolutionTarget: 70,
          sentimentFloor: 90,
          weeklyVolumeFloor: 500,
          ...s.pilot,
        },
      ]
    : seed.pilotPlans;
  const pilotReadings = [
    ...seed.pilotReadings,
    ...(s.readings ?? []).map((r, i) => ({
      id: `pr-syn-${i}`,
      opportunityId: id,
      sourceLabel: "seeded" as const,
      ...r,
    })),
  ];
  return {
    ...seed,
    opportunities: [...seed.opportunities, opp],
    accounts: [
      ...seed.accounts,
      {
        id: "acc-syn",
        name: "Synthetic Co",
        emailDomains: ["synthetic.example"],
        segment: "Retail",
        market: "Spain",
        ownerName: "Rep",
        archivedAt: null,
      },
    ],
    dealConditions: [
      ...seed.dealConditions,
      ...ALL.map((t) => ({
        id: `${id}:${t}`,
        opportunityId: id,
        type: t,
        owner: "Owner",
      })),
    ],
    events: [...seed.events, ...events],
    evidence: [...seed.evidence, ...evidence],
    evidenceDecisions: [...seed.evidenceDecisions, ...decisions],
    pilotPlans,
    pilotReadings,
    planningStandards: s.standards
      ? s.standards([...seed.planningStandards])
      : seed.planningStandards,
    dealLinkOverrides: [
      ...seed.dealLinkOverrides,
      ...(s.links ?? []).map((l, i) => ({
        id: `dlo-syn-${i}`,
        opportunityId: id,
        reason: "test",
        actorId: "u-revops",
        at: isoDate("2027-01-02"),
        seq: 80000 + i,
        ...l,
      })),
    ],
  };
}

const run = (data: ForecastInput, asOf: string) =>
  computeForecast(data, isoDate(asOf), Q);
const syn = (data: ForecastInput, asOf: string) =>
  run(data, asOf).lines.find((l) => l.view.opportunity.id === "opp-syn")!;
const esd = (l: ReturnType<typeof syn>) => [
  l.view.timing.esd.fast,
  l.view.timing.esd.standard,
  l.view.timing.esd.slow,
];
const step = (l: ReturnType<typeof syn>, t: ConditionType) =>
  l.view.timing.steps.find((s) => s.type === t)!;

describe("Spec tests on synthetic deals", () => {
  it("test 18: Won signed Dec 20 is Excluded 'signed in another quarter'; Won with no signed date is Excluded 'data error'", () => {
    const a = syn(
      build({ claims: doneExcept(), status: "won", signedDate: "2026-12-20" }),
      "2027-03-01",
    );
    expect([a.group, a.reasons.join()]).toEqual([
      "excluded",
      expect.stringContaining("signed in another quarter"),
    ]);
    const b = syn(
      build({ claims: doneExcept(), status: "won", signedDate: null }),
      "2027-03-01",
    );
    expect([b.group, b.reasons.join()]).toEqual([
      "excluded",
      expect.stringContaining("data error"),
    ]);
  });

  it("test 19: all Conditions Done, last engagement 31 days ago: Unproven, Uncommitted", () => {
    const l = syn(
      build({ claims: [...doneExcept(), engagedOn("2027-01-29")] }),
      "2027-03-01",
    );
    expect([l.commitment?.level, l.group]).toEqual(["unproven", "uncommitted"]);
  });

  it("test 20 (DR-08): Committed, Procurement in progress 40 days between first and latest Evidence: no estimate, Overdue; Timing unknown naming Procurement and legal", () => {
    const l = syn(
      build({
        claims: [
          ...doneExcept("procurement_legal"),
          engagedOn("2027-02-25"),
          { c: "procurement_legal", claim: "started", on: "2027-01-15" },
          { c: "procurement_legal", claim: "progress", on: "2027-02-24" },
        ],
      }),
      "2027-03-01",
    );
    expect(step(l, "procurement_legal").remaining).toEqual({
      fast: "overdue",
      standard: "overdue",
      slow: "overdue",
    });
    expect(l.view.timing.readiness).toBe("not_ready");
    expect([l.commitment?.level, l.group]).toEqual([
      "committed",
      "timing_unknown",
    ]);
    expect(l.reasons.join()).toMatch(/procurement and legal/i);
  });

  it("test 21: Committed, late only because Technical validation is open and Security waits on it by a hard Link: no Intervention", () => {
    const l = syn(
      build({
        claims: [
          ...doneExcept(
            "technical_validation",
            "security",
            "procurement_legal",
          ),
          engagedOn("2027-02-25"),
        ],
      }),
      "2027-03-01",
    );
    expect([l.commitment?.level, l.group]).toEqual(["committed", "late"]);
    expect(l.interventions).toEqual([]);
    expect(l.view.timing.esd.standard).not.toBeNull();
  });

  it("test 22 (DR-09): Engaged, Vendor selection and Security open, Procurement not started: no Intervention, not Recoverable, reason names Vendor selection", () => {
    const data = build({
      claims: [
        ...doneExcept("vendor_selection", "security", "procurement_legal"),
        engagedOn("2027-02-25"),
        { c: "security", claim: "started", on: "2027-02-20" },
      ],
    });
    const f = run(data, "2027-03-01");
    const l = f.lines.find((x) => x.view.opportunity.id === "opp-syn")!;
    expect(l.commitment?.level).toBe("engaged");
    expect(l.interventions).toEqual([]);
    expect(f.recoverable.map((x) => x.view.opportunity.id)).not.toContain(
      "opp-syn",
    );
    expect(l.reasons.join()).toMatch(/vendor selection/i);
  });

  it("test 24: Committed, ready on slow timing, Vendor selection closed by Stated Evidence only: Core, reason 'no written award'", () => {
    const l = syn(
      build({
        claims: [
          ...doneExcept("vendor_selection", "procurement_legal"),
          engagedOn("2027-02-25"),
          {
            c: "vendor_selection",
            claim: "selected",
            on: "2027-02-10",
            source: "email",
          },
          { c: "procurement_legal", claim: "started", on: "2027-02-01" },
          { c: "procurement_legal", claim: "progress", on: "2027-02-25" },
        ],
      }),
      "2027-03-01",
    );
    expect(l.view.timing.readiness).toBe("slow");
    expect(l.group).toBe("core");
    expect(l.reasons.join()).toContain("no written award");
  });

  it("test 25: At risk and not ready is Uncommitted with both reasons; still Uncommitted once ready", () => {
    const contrary: Claim = {
      c: "vendor_selection",
      claim: "contrary",
      on: "2027-02-27",
      contrary: "competitor_evaluation",
    };
    const notReady = syn(
      build({
        claims: [
          ...doneExcept("security", "procurement_legal"),
          engagedOn("2027-02-25"),
          contrary,
        ],
      }),
      "2027-03-01",
    );
    expect([notReady.commitment?.level, notReady.group]).toEqual([
      "at_risk",
      "uncommitted",
    ]);
    expect(notReady.view.timing.readiness).toBe("not_ready");
    expect(notReady.reasons.length).toBeGreaterThanOrEqual(2);
    const ready = syn(
      build({
        claims: [
          ...doneExcept("procurement_legal"),
          engagedOn("2027-02-25"),
          contrary,
        ],
      }),
      "2027-03-01",
    );
    expect(ready.view.timing.readiness).not.toBe("not_ready");
    expect(ready.group).toBe("uncommitted");
  });

  it("test 29: Committed, only Procurement open and not started: Mar 10 ESD Mar 22 / Mar 31 / Apr 9 Core; Mar 11 ESD Mar 23 / Apr 1 / Apr 10 Stretch", () => {
    const data = build({
      claims: [...doneExcept("procurement_legal"), engagedOn("2027-03-01")],
    });
    const a = syn(data, "2027-03-10");
    expect(esd(a)).toEqual(["2027-03-22", "2027-03-31", "2027-04-09"]);
    expect(a.group).toBe("core");
    const b = syn(data, "2027-03-11");
    expect(esd(b)).toEqual(["2027-03-23", "2027-04-01", "2027-04-10"]);
    expect(b.group).toBe("stretch");
    // Bridge from the Mar 10 run: Slipped, cause time passing with no new progress Evidence ("no progress").
    const snap = snapshotRun(run(data, "2027-03-10"), data, {
      id: "r10",
      trigger: "automatic",
      seq: 1,
      templateVersions: [],
      extractionVersion: "x",
    });
    const bridge = computeBridge(
      snap.run,
      snap.lines,
      run(data, "2027-03-11").lines,
      isoDate("2027-03-11"),
      { ...data, changeLog: [] },
    );
    const slipped = bridge.lines
      .find((l) => l.kind === "slipped")!
      .moves.find((m) => m.opportunityId === "opp-syn")!;
    expect([slipped.amount, slipped.causes]).toEqual([
      usdM(-1.0),
      ["no progress"],
    ]);
  });

  it("test 38: Committed deal whose last engagement is 31 days ago, with Security progress yesterday: Unproven, Uncommitted", () => {
    const l = syn(
      build({
        claims: [
          ...doneExcept("security"),
          engagedOn("2027-01-29"),
          { c: "security", claim: "started", on: "2027-02-10" },
          { c: "security", claim: "progress", on: "2027-02-28" },
        ],
      }),
      "2027-03-01",
    );
    expect([l.commitment?.level, l.group]).toEqual(["unproven", "uncommitted"]);
  });

  it("test 39: start-by counts what follows: X 21 days, then Y 10 days, quarter end Mar 31: start-by Feb 28; offered Feb 27, not Mar 1", () => {
    // X = Security, held by a soft Link from Technical validation; Y = Procurement and legal, after Security.
    const data = build({
      claims: [
        ...doneExcept("technical_validation", "security", "procurement_legal"),
        engagedOn("2027-02-25"),
        { c: "technical_validation", claim: "started", on: "2027-02-20" },
        { c: "technical_validation", claim: "progress", on: "2027-02-26" },
      ],
      links: [
        { from: "technical_validation", to: "security", strength: "soft" },
      ],
      standards: (all) =>
        all.map((s) =>
          s.conditionType === "security"
            ? { ...s, fastDays: 14, standardDays: 21, slowDays: 30 }
            : s.conditionType === "procurement_legal"
              ? { ...s, fastDays: 7, standardDays: 10, slowDays: 14 }
              : s,
        ),
    });
    const feb27 = syn(data, "2027-02-27");
    const x = feb27.interventions.find((i) => i.condition === "security");
    expect(x?.startBy).toBe("2027-02-28");
    expect(
      syn(data, "2027-03-01").interventions.find(
        (i) => i.condition === "security",
      ),
    ).toBeUndefined();
  });

  it("test 40 (DR-02 rewrite): volume below floor, evaluation Mar 20: pilot finish Mar 21 / Mar 23 / Mar 27, Commitment unaffected; Mar 28 with no acceptance: At risk 'pilot not accepted'", () => {
    const readings = [300, 320, 350, 400].map((volume, i) => ({
      weekEnding: isoDate(`2027-02-${String(7 + i * 7).padStart(2, "0")}`),
      resolutionRate: 75,
      sentiment: 92,
      volume,
    }));
    const data = build({
      claims: [
        ...doneExcept("pilot", "vendor_selection", "procurement_legal"),
        engagedOn("2027-02-25"),
      ],
      pilot: {},
      readings,
    });
    const mar1 = syn(data, "2027-03-01");
    const p = step(mar1, "pilot");
    expect([p.finish.fast, p.finish.standard, p.finish.slow]).toEqual([
      "2027-03-21",
      "2027-03-23",
      "2027-03-27",
    ]);
    expect(mar1.commitment?.level).not.toBe("at_risk");
    const mar28 = syn(
      {
        ...data,
        events: data.events.map((e) =>
          e.opportunityId === "opp-syn" && e.sourceType === "email"
            ? { ...e, occurredAt: isoDate("2027-03-20") }
            : e,
        ),
      },
      "2027-03-28",
    );
    expect(step(mar28, "pilot").remaining.standard).toBe("pilot_overdue");
    expect(mar28.commitment?.level).toBe("at_risk");
    expect(mar28.commitment?.missing).toContain("pilot not accepted");
  });

  it("test 41: blocked Feb 10–14 and Feb 12–18 merge to Feb 10–18; 12 days credited, 9 standard days remain", () => {
    const l = syn(
      build({
        claims: [
          ...doneExcept("procurement_legal"),
          engagedOn("2027-02-25"),
          { c: "procurement_legal", claim: "started", on: "2027-02-01" },
          {
            c: "procurement_legal",
            claim: "blocked",
            on: "2027-02-10",
            blockStart: "2027-02-10",
            blockEnd: "2027-02-14",
          },
          {
            c: "procurement_legal",
            claim: "blocked",
            on: "2027-02-12",
            blockStart: "2027-02-12",
            blockEnd: "2027-02-18",
          },
          { c: "procurement_legal", claim: "progress", on: "2027-02-21" },
        ],
      }),
      "2027-03-01",
    );
    const s = l.view.states.find((x) => x.type === "procurement_legal")!;
    expect(s.blocked).toEqual([{ start: "2027-02-10", end: "2027-02-18" }]);
    expect(step(l, "procurement_legal").remaining.standard).toBe(9);
  });

  it("test 46: an open Condition with no planning standard: no estimate, Timing unknown, reason 'no planning standard'", () => {
    const l = syn(
      build({
        claims: [...doneExcept("procurement_legal"), engagedOn("2027-02-25")],
        standards: (all) =>
          all.filter((s) => s.conditionType !== "procurement_legal"),
      }),
      "2027-03-01",
    );
    expect(step(l, "procurement_legal").remaining.standard).toBe(
      "no_planning_standard",
    );
    expect(l.group).toBe("timing_unknown");
    expect(l.reasons.join()).toContain("no planning standard");
  });

  it("test 48: automatic pilot, evaluation Mar 20: (a) a passing reading closes it Mar 20, Direct; (b) volume 480 against 500: At risk 'pilot missed targets at evaluation'", () => {
    const base = {
      claims: [...doneExcept("pilot"), engagedOn("2027-03-15")],
      pilot: { acceptanceMode: "automatic" as const },
    };
    const a = syn(
      build({
        ...base,
        readings: [
          {
            weekEnding: isoDate("2027-03-20"),
            resolutionRate: 75,
            sentiment: 92,
            volume: 600,
          },
        ],
      }),
      "2027-03-21",
    );
    const s = a.view.states.find((x) => x.type === "pilot")!;
    expect([s.state, s.doneOn, s.doneGrade]).toEqual([
      "done",
      "2027-03-20",
      "direct",
    ]);
    const b = syn(
      build({
        ...base,
        readings: [
          {
            weekEnding: isoDate("2027-03-20"),
            resolutionRate: 75,
            sentiment: 92,
            volume: 480,
          },
        ],
      }),
      "2027-03-21",
    );
    expect(step(b, "pilot").remaining.standard).toBe("pilot_failed");
    expect(b.commitment?.level).toBe("at_risk");
    expect(b.commitment?.missing).toContain(
      "pilot missed targets at evaluation",
    );
  });

  it("test 58 (DR-12): signed Mar 31, Won recorded Apr 5 counts in Q1 Actual; recorded Apr 9 does not", () => {
    const o = {
      ...buildCanonicalSeed().opportunities.find(
        (x) => x.id === "opp-insurance",
      )!,
      status: "won" as const,
      signedDate: isoDate("2027-03-31"),
    };
    const log = (at: string): ChangeLogEntry[] => [
      {
        id: "c1",
        entity: "opportunity",
        entityId: o.id,
        field: "status",
        oldValue: "open",
        newValue: "won",
        actorId: "u-mgr-b",
        at: isoDate(at),
        seq: 1,
        reason: null,
      },
      {
        id: "c2",
        entity: "opportunity",
        entityId: o.id,
        field: "signed_date",
        oldValue: null,
        newValue: "2027-03-31",
        actorId: "u-mgr-b",
        at: isoDate(at),
        seq: 2,
        reason: null,
      },
    ];
    expect(signedAsOfCutoff(o, log("2027-04-05"), Q.end)).toBe("2027-03-31");
    expect(signedAsOfCutoff(o, log("2027-04-09"), Q.end)).toBeNull();
  });
});
