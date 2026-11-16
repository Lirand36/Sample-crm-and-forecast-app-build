import { describe, expect, it } from "vitest";
import { buildCanonicalSeed, NEXT_WEEK_READING } from "@/seed/canonical";
import { BT1, SYNTHETIC_LABEL } from "@/seed/bt1";
import { isIsoDate } from "@/domain/dates";
import { usdM } from "@/domain/money";

const seed = buildCanonicalSeed();
const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((r) => r.id));

describe("canonical seed (PRD §8 as changed by handoff Part VII)", () => {
  it("has the ten opportunities with the Part VII deal types", () => {
    const byId = new Map(seed.opportunities.map((o) => [o.id, o]));
    expect(seed.opportunities).toHaveLength(10);
    for (const k of ["natbank", "telecom", "energy", "insurance"]) expect(byId.get(`opp-${k}`)?.dealType).toBe("major_accounts");
    for (const k of ["iberia", "citytransit", "retail", "airline", "savings"]) {
      expect(byId.get(`opp-${k}`)?.dealType).toBe("land_and_expand");
      expect(byId.get(`opp-${k}`)?.templateVariant).toBe("land");
    }
    const travel = byId.get("opp-travel")!;
    expect(travel).toMatchObject({ dealType: "payg", status: "open", tcv: null, templateVariant: "none", managerId: "u-mgr-a" });
  });

  it("matches the PRD §8 TCVs, statuses and managers", () => {
    const expected: Record<string, [number, string, string]> = {
      iberia: [2.0, "won", "u-mgr-a"], citytransit: [1.8, "lost", "u-mgr-b"], retail: [1.5, "open", "u-mgr-a"],
      insurance: [2.0, "open", "u-mgr-b"], energy: [2.5, "open", "u-mgr-b"], airline: [2.5, "open", "u-mgr-a"],
      savings: [1.0, "open", "u-mgr-a"], telecom: [3.0, "open", "u-mgr-b"], natbank: [4.0, "open", "u-mgr-a"],
    };
    for (const [k, [tcv, status, mgr]] of Object.entries(expected)) {
      const o = seed.opportunities.find((x) => x.id === `opp-${k}`)!;
      expect([o.tcv, o.status, o.managerId]).toEqual([usdM(tcv), status, mgr]);
    }
    expect(seed.opportunities.find((o) => o.id === "opp-iberia")?.signedDate).toBe("2027-02-12");
  });

  it("has the CRO and the VP Sales as two different people; managers report to the VP Sales", () => {
    const cro = seed.users.find((u) => u.role === "cro")!;
    const vp = seed.users.find((u) => u.role === "vp_sales")!;
    expect(cro.id).not.toBe(vp.id);
    expect(vp.managerId).toBe(cro.id);
    for (const m of seed.users.filter((u) => u.role === "sales_manager")) expect(m.managerId).toBe(vp.id);
  });

  it("has revenue that adds up and a stage that matches the status", async () => {
    const { computeTcv } = await import("@/domain/crm-rules");
    const { statusForStage } = await import("@/domain/entities");
    for (const o of seed.opportunities) {
      expect(computeTcv(o.arr, o.termMonths, o.nonRecurring)).toBe(o.tcv);
      expect(statusForStage(o.stage)).toBe(o.status);
    }
  });

  it("satisfies Part IV CRM validations", () => {
    for (const o of seed.opportunities) {
      if (o.status === "open" && o.dealType !== "payg") expect(o.tcv).toBeGreaterThan(0);
      if (o.status === "won") expect(o.signedDate).not.toBeNull();
      if (o.status === "lost" || o.status === "disqualified") expect(o.statusReason).toBeTruthy();
    }
  });

  it("gives every Account .example domains, a sponsor and legal or procurement; banks also security", () => {
    for (const a of seed.accounts) {
      expect(a.emailDomains.every((d) => d.endsWith(".example"))).toBe(true);
      const roles = seed.contacts.filter((c) => c.accountId === a.id).map((c) => c.role);
      expect(roles).toContain("sponsor");
      expect(roles.some((r) => r === "legal" || r === "procurement")).toBe(true);
      if (a.segment === "Banks") expect(roles).toContain("security");
    }
  });

  it("has referential integrity across collections", () => {
    const opp = ids(seed.opportunities);
    const users = ids(seed.users);
    const events = ids(seed.events);
    const evidence = ids(seed.evidence);
    for (const c of seed.contacts) expect(ids(seed.accounts).has(c.accountId)).toBe(true);
    for (const o of seed.opportunities) {
      expect(ids(seed.accounts).has(o.accountId)).toBe(true);
      expect(users.has(o.managerId)).toBe(true);
    }
    for (const e of seed.events) expect(opp.has(e.opportunityId)).toBe(true);
    for (const e of seed.evidence) {
      expect(events.has(e.eventId)).toBe(true);
      expect(seed.events.find((x) => x.id === e.eventId)?.opportunityId).toBe(e.opportunityId);
    }
    for (const dec of seed.evidenceDecisions) {
      expect(evidence.has(dec.evidenceId)).toBe(true);
      if (dec.actorId) expect(users.has(dec.actorId)).toBe(true);
    }
    for (const d of seed.disputes) expect(opp.has(d.opportunityId)).toBe(true);
    for (const l of seed.runLines) expect(ids(seed.forecastRuns).has(l.runId)).toBe(true);
  });

  it("uses unique, monotonic sequence numbers", () => {
    const seqs = [...seed.events.map((e) => e.seq), ...seed.evidenceDecisions.map((d) => d.seq), ...seed.changeLog.map((c) => c.seq), ...seed.forecastRuns.map((r) => r.seq)];
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seed.session[0]!.nextSeq).toBeGreaterThan(Math.max(...seqs));
  });

  it("has every Evidence quote verbatim in its Event (PRD §4B.3)", () => {
    for (const e of seed.evidence) {
      const event = seed.events.find((x) => x.id === e.eventId)!;
      expect(event.text).toContain(e.quote);
    }
  });

  it("sends every customer email from one of the Account's contacts (Part VII)", () => {
    for (const e of seed.events.filter((x) => x.origin === "customer")) {
      const o = seed.opportunities.find((x) => x.id === e.opportunityId)!;
      const emails = seed.contacts.filter((c) => c.accountId === o.accountId).map((c) => c.email);
      expect(emails).toContain(e.sender);
    }
  });

  it("stores only valid date-only values", () => {
    for (const e of seed.events) expect(isIsoDate(e.occurredAt)).toBe(true);
    for (const e of seed.evidence) {
      if (e.blockStart) expect(isIsoDate(e.blockStart)).toBe(true);
      if (e.blockEnd) expect(isIsoDate(e.blockEnd)).toBe(true);
    }
  });

  it("has the PRD §8 seeded Evidence facts", () => {
    const natbankBlock = seed.evidence.find((e) => e.opportunityId === "opp-natbank" && e.claim === "blocked")!;
    expect([natbankBlock.blockStart, natbankBlock.blockEnd]).toEqual(["2027-02-24", "2027-03-16"]);
    const energyBlock = seed.evidence.find((e) => e.opportunityId === "opp-energy" && e.claim === "blocked")!;
    expect([energyBlock.blockStart, energyBlock.blockEnd]).toEqual(["2027-02-26", "2027-03-05"]);
    const press = seed.events.find((e) => e.opportunityId === "opp-telecom" && e.sourceType === "press_release")!;
    expect([press.origin, press.occurredAt]).toEqual(["external", "2027-02-26"]);
    const insuranceWaiting = seed.evidence.find((e) => e.eventId.startsWith("ev-insurance-2027-02-27"))!;
    expect(seed.evidenceDecisions.some((d) => d.evidenceId === insuranceWaiting.id)).toBe(false);
    const repNote = seed.events.find((e) => e.opportunityId === "opp-energy" && e.occurredAt === "2027-02-28")!;
    expect(repNote.origin).toBe("internal");
    const telecomBudget = seed.events.find((e) => e.opportunityId === "opp-telecom" && e.occurredAt === "2027-02-20")!;
    expect(telecomBudget.origin).toBe("customer");
  });

  it("has planning standards v1 exactly as Part VII", () => {
    const rows = seed.planningStandards.map((p) => [p.conditionType, p.segment, p.fastDays, p.standardDays, p.slowDays, p.version]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ["executive_sponsor", null, 7, 14, 21, 1],
        ["budget", null, 10, 21, 35, 1],
        ["pilot", null, 18, 30, 45, 1],
        ["pilot_acceptance", null, 1, 3, 7, 1],
        ["vendor_selection", null, 5, 12, 21, 1],
        ["technical_validation", null, 10, 21, 32, 1],
        ["security", "Banks", 24, 30, 45, 1],
        ["security", null, 24, 30, 45, 1],
        ["procurement_legal", null, 12, 21, 30, 1],
      ]),
    );
    expect(seed.planningStandards).toHaveLength(9);
  });

  it("has the Airline PilotPlan and readings (DR-02, Part VII)", () => {
    expect(seed.pilotPlans).toEqual([
      expect.objectContaining({ opportunityId: "opp-airline", evaluationDate: "2027-03-07", acceptanceMode: "customer_signoff", resolutionTarget: 70, sentimentFloor: 90, weeklyVolumeFloor: 500 }),
    ]);
    expect(seed.pilotReadings.map((r) => [r.weekEnding, r.resolutionRate, r.sentiment, r.volume])).toEqual([
      ["2027-02-07", 60, 94, 610], ["2027-02-14", 63, 95, 620], ["2027-02-21", 65, 95, 650], ["2027-02-28", 68, 95, 640],
    ]);
    expect([NEXT_WEEK_READING.weekEnding, NEXT_WEEK_READING.resolutionRate]).toEqual(["2027-03-07", 66]);
  });

  it("has the three Disputes, with Insurance Group's Out naming Condition 7 (DR-11)", () => {
    expect(seed.disputes.map((d) => [d.opportunityId, d.direction, d.managerId])).toEqual(
      expect.arrayContaining([["opp-natbank", "in", "u-mgr-a"], ["opp-telecom", "in", "u-mgr-b"], ["opp-insurance", "out", "u-mgr-b"]]),
    );
    expect(seed.disputes.find((d) => d.direction === "out")?.outCondition).toBe("procurement_legal");
  });

  it("stores the Feb 22 run with Core $17.3M (PRD §8)", () => {
    const run = seed.forecastRuns.find((r) => r.asOfDate === "2027-02-22")!;
    expect(run.totals.core).toBe(usdM(17.3));
    expect(run.isFixture).toBe(true);
    expect(seed.runLines.some((l) => l.opportunityId === "opp-savings")).toBe(false);
  });

  it("logs the CRM changes the Feb 22 bridge needs (G-5)", () => {
    expect(seed.changeLog.map((c) => [c.entityId, c.field, c.at])).toEqual(
      expect.arrayContaining([["opp-energy", "tcv", "2027-02-23"], ["opp-citytransit", "status", "2027-02-25"]]),
    );
  });

  it("starts on the demo date as the CRO", () => {
    expect(seed.session[0]).toMatchObject({ asOfDate: "2027-03-01", actingUserId: "u-cro" });
  });
});

describe("BT-1 synthetic backtest fixture (Part VII)", () => {
  it("is labelled synthetic and kept out of the store", () => {
    expect(BT1.label).toBe(SYNTHETIC_LABEL);
    expect(seed.forecastRuns.some((r) => r.quarterId === BT1.quarter.id)).toBe(false);
    expect(BT1.deals).toHaveLength(5);
  });
});
