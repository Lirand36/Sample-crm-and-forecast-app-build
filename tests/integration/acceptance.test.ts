// Handoff Part VI acceptance tests that run on the seed, one `it` per spec test number.
// Dollar values are the spec's, converted per R-9 (Big Deals ×5); the spec value is in each title.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveOpportunity,
  updateOpportunity,
  type OpportunityEditInput,
} from "@/application/crm";
import { raiseDispute, withdrawDispute } from "@/application/disputes";
import { reviewEvidence } from "@/application/evidence";
import { loadBridge, loadForecast } from "@/application/forecast";
import { importEmail } from "@/application/import-event";
import type { DataStore } from "@/application/ports";
import {
  advanceOneWeek,
  ensureDailyRun,
  submitForecast,
} from "@/application/runs";
import { evidenceStatus, gradeOf } from "@/domain/condition-state";
import { addDays, isoDate } from "@/domain/dates";
import { isReviewOverdue } from "@/domain/evidence-review";
import type { Opportunity } from "@/domain/entities";
import type { Forecast } from "@/domain/forecast";
import { usdM, type Cents } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;
const eml = (name: string) =>
  readFileSync(join(process.cwd(), "src/seed/eml", `${name}.eml`), "utf8");
async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}
async function setAsOf(d: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, asOfDate: isoDate(d) });
}
const totals = (f: Forecast) => [
  f.company.conservative,
  f.company.core,
  f.company.stretch,
];
const M = (...xs: number[]) => xs.map(usdM);
const line = (f: Forecast, key: string) =>
  f.lines.find((l) => l.view.opportunity.id === `opp-${key}`)!;
const esd = (f: Forecast, key: string) => {
  const e = line(f, key).view.timing.esd;
  return [e.fast, e.standard, e.slow];
};
function editOf(
  o: Opportunity,
  patch: Partial<OpportunityEditInput> = {},
): OpportunityEditInput {
  return {
    name: o.name,
    ownerName: o.ownerName,
    managerId: o.managerId,
    arr: o.arr,
    termMonths: o.termMonths,
    nonRecurring: o.nonRecurring,
    stage: o.stage,
    statusReason: o.statusReason,
    signedDate: o.signedDate,
    closeDate: o.closeDate,
    ...patch,
  };
}
/** Set TCV with the seed's split: 10% non-recurring, the rest as ARR over 36 months. */
async function setTcv(key: string, tcv: Cents) {
  const o = (await store.repos.opportunities.get(`opp-${key}`))!;
  const nonRecurring = (tcv / 10) as Cents;
  return updateOpportunity(
    store,
    o.id,
    editOf(o, {
      nonRecurring,
      arr: ((tcv - nonRecurring) / 3) as Cents,
      termMonths: 36,
    }),
  );
}
async function importAndList(key: string, file: string) {
  const r = await importEmail(store, `opp-${key}`, eml(file));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}
async function approveAll(ids: string[], as: string) {
  await actAs(as);
  return Promise.all(ids.map((id) => reviewEvidence(store, id, "approve", "")));
}

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("Part VI acceptance tests on the seed", () => {
  it("test 2: Manager A $3.5M / $3.5M / $7.0M, commitment $23.5M; B $10.0M / $22.5M / $22.5M, commitment $27.5M (spec A 3.5/3.5/7.0, 7.5; B 2.0/4.5/4.5, 5.5)", async () => {
    const f = await loadForecast(store);
    const a = f.managers.find((m) => m.managerId === "u-mgr-a")!;
    const b = f.managers.find((m) => m.managerId === "u-mgr-b")!;
    expect([a.conservative, a.core, a.stretch, a.managerCommitment]).toEqual(
      M(3.5, 3.5, 7.0, 23.5),
    );
    expect([b.conservative, b.core, b.stretch, b.managerCommitment]).toEqual(
      M(10.0, 22.5, 22.5, 27.5),
    );
  });

  it("test 3: National Bank Committed, Late; Security 24/30/45 Banks v1; ESD Apr 1 / Apr 16 / May 10; Feb 24 quote Stated", async () => {
    const f = await loadForecast(store);
    const nb = line(f, "natbank");
    expect(nb.commitment?.level).toBe("committed");
    expect(nb.group).toBe("late");
    expect(esd(f, "natbank")).toEqual([
      "2027-04-01",
      "2027-04-16",
      "2027-05-10",
    ]);
    const sec = nb.view.timing.steps.find((s) => s.type === "security")!;
    expect([sec.finish.fast, sec.finish.standard, sec.finish.slow]).toEqual([
      "2027-03-20",
      "2027-03-26",
      "2027-04-10",
    ]);
    expect(sec.standardId).toBe("ps-security-banks-v1");
  });

  it("test 6: the Energy Group budget email applies at once: Unproven, Uncommitted, ESD Mar 20 / Apr 9 / May 2; $13.5M / $13.5M / $17.0M (spec 5.5/5.5/9.0); Disputes unchanged", async () => {
    const before = (await loadForecast(store)).company.liveDisputes;
    const v = await importAndList("energy", "energy-budget-reapproval");
    const decisions = await store.repos.evidenceDecisions.list();
    expect(
      v.evidence.some((e) => evidenceStatus(e, decisions) === "provisional"),
    ).toBe(true);
    const f = await loadForecast(store);
    expect(line(f, "energy").commitment?.level).toBe("unproven");
    expect(line(f, "energy").group).toBe("uncommitted");
    expect(esd(f, "energy")).toEqual([
      "2027-03-20",
      "2027-04-09",
      "2027-05-02",
    ]);
    expect(totals(f)).toEqual(M(13.5, 13.5, 17.0));
    expect(f.company.liveDisputes).toBe(before);
  });

  it("test 8: approving the waiting Insurance Group Evidence (the deal's Sales Manager, Condition 7): ESD Mar 10 / Mar 10 / Mar 19, still Firm, logged with the approver", async () => {
    const decisions = await store.repos.evidenceDecisions.list();
    const waiting = (await store.repos.evidence.list()).filter(
      (e) =>
        e.opportunityId === "opp-insurance" &&
        evidenceStatus(e, decisions) === "waiting",
    );
    expect(waiting.length).toBeGreaterThan(0);
    expect(esd(await loadForecast(store), "insurance")).toEqual([
      "2027-03-04",
      "2027-03-13",
      "2027-03-22",
    ]);
    const r = await approveAll(
      waiting.map((e) => e.id),
      "u-mgr-b",
    );
    expect(r.every((x) => x.ok)).toBe(true);
    const f = await loadForecast(store);
    expect(esd(f, "insurance")).toEqual([
      "2027-03-10",
      "2027-03-10",
      "2027-03-19",
    ]);
    expect(line(f, "insurance").group).toBe("firm");
    const log = (await store.repos.evidenceDecisions.list()).filter((d) =>
      waiting.some((e) => e.id === d.evidenceId),
    );
    expect(log.every((d) => d.actorId === "u-mgr-b")).toBe(true);
  });

  it("test 10: withdrawing Manager B's Insurance Group Dispute: Manager commitment $61.0M, B's $37.5M (spec 15.0, 7.5)", async () => {
    await actAs("u-mgr-b");
    expect((await withdrawDispute(store, "dsp-insurance-out")).ok).toBe(true);
    const f = await loadForecast(store);
    expect(f.company.managerCommitment).toBe(usdM(61.0));
    expect(
      f.managers.find((m) => m.managerId === "u-mgr-b")!.managerCommitment,
    ).toBe(usdM(37.5));
  });

  it("tests 11 and 43: a submitted run keeps its totals, groups, dates, standards used and versions after later changes", async () => {
    await actAs("u-mgr-a");
    const s = await submitForecast(store);
    expect(s.ok).toBe(true);
    const run = (await store.repos.forecastRuns.get(
      s.ok ? s.value.runId : "",
    ))!;
    const lines = (await store.repos.runLines.list()).filter(
      (l) => l.runId === run.id,
    );
    const snapshot = JSON.stringify({ run, lines });
    await actAs("u-revops");
    await setTcv("retail", usdM(2.0));
    await importAndList("energy", "energy-budget-reapproval");
    const after = (await store.repos.forecastRuns.get(run.id))!;
    const afterLines = (await store.repos.runLines.list()).filter(
      (l) => l.runId === run.id,
    );
    expect(JSON.stringify({ run: after, lines: afterLines })).toBe(snapshot);
    const used = (
      run.configSnapshot as {
        planningStandards: { id: string; version: number }[];
      }
    ).planningStandards;
    expect(used.find((p) => p.id === "ps-security-banks-v1")?.version).toBe(1);
    expect(
      run.engineVersion && run.extractionVersion && run.templateVersions.length,
    ).toBeTruthy();
  });

  it("test 12: Retail Enterprise TCV to $2.0M: $14.0M / $26.5M / $30.0M, Manager commitment $51.5M; the TCV line lists Energy −$2.5M and Retail +$0.5M (spec 6.0/8.5/12.0, 13.5)", async () => {
    await actAs("u-mgr-a");
    expect((await setTcv("retail", usdM(2.0))).ok).toBe(true);
    const f = await loadForecast(store);
    expect(totals(f)).toEqual(M(14.0, 26.5, 30.0));
    expect(f.company.managerCommitment).toBe(usdM(51.5));
    const b = (await loadBridge(store, f))!;
    const tcv = b.lines.find((l) => l.kind === "tcv_change")!;
    expect(tcv.moves.map((m) => [m.opportunityId, m.amount])).toEqual(
      expect.arrayContaining([
        ["opp-energy", usdM(-2.5)],
        ["opp-retail", usdM(0.5)],
      ]),
    );
    expect(
      tcv.moves.find((m) => m.opportunityId === "opp-retail")!.causes,
    ).toContain("CRM edit");
  });

  it("test 13: the engine on the same inputs twice gives identical lines", async () => {
    const a = await loadForecast(store);
    const b = await loadForecast(store);
    expect(JSON.stringify(b.lines)).toBe(JSON.stringify(a.lines));
  });

  it("test 15: Global Telecom ESD Mar 13 / Mar 22 / Mar 31, fits even if slow, yet At risk and Uncommitted; no Intervention", async () => {
    const f = await loadForecast(store);
    const t = line(f, "telecom");
    expect(esd(f, "telecom")).toEqual([
      "2027-03-13",
      "2027-03-22",
      "2027-03-31",
    ]);
    expect(t.view.timing.readiness).toBe("slow");
    expect([t.commitment?.level, t.group]).toEqual(["at_risk", "uncommitted"]);
    expect(t.interventions).toHaveLength(0);
  });

  it("test 16: the Retail Enterprise competitor email opens a contrary signal: At risk, Uncommitted, ESD unchanged; $12.0M / $24.5M / $28.0M; Commitment lost gains −$1.5M (spec 4.0/6.5/10.0)", async () => {
    const before = esd(await loadForecast(store), "retail");
    await importAndList("retail", "retail-competitor-evaluation");
    const f = await loadForecast(store);
    expect([
      line(f, "retail").commitment?.level,
      line(f, "retail").group,
    ]).toEqual(["at_risk", "uncommitted"]);
    expect(esd(f, "retail")).toEqual(before);
    expect(totals(f)).toEqual(M(12.0, 24.5, 28.0));
    const b = (await loadBridge(store, f))!;
    expect(
      b.lines
        .find((l) => l.kind === "commitment_lost")!
        .moves.find((m) => m.opportunityId === "opp-retail")?.amount,
    ).toBe(usdM(-1.5));
  });

  it("test 28: a Dispute In without a Bet is refused with a clear message", async () => {
    await actAs("u-mgr-a");
    const r = await raiseDispute(store, {
      opportunityId: "opp-airline",
      direction: "in",
      reason: "They will pick us",
      bets: [],
      outCondition: null,
    });
    expect(r.ok ? "" : r.errors.form).toContain("Name at least one open step");
  });

  it("test 50: a provisional reversing claim unreviewed for 4 days is overdue in the review queue; at 3 days it is not", async () => {
    const v = await importAndList("retail", "retail-competitor-evaluation");
    const e = v.evidence.find((x) => x.claim === "contrary")!;
    const status = evidenceStatus(
      e,
      await store.repos.evidenceDecisions.list(),
    );
    expect(status).toBe("provisional");
    expect(isReviewOverdue(status, v.event, addDays(v.event.loggedAt, 3))).toBe(
      false,
    );
    expect(isReviewOverdue(status, v.event, addDays(v.event.loggedAt, 4))).toBe(
      true,
    );
  });

  it("test 17: Insurance Group set to Lost: Excluded; $3.5M / $16.0M / $19.5M; its Dispute stale; Manager commitment $51.0M (spec 3.5/6.0/9.5, 13.0)", async () => {
    await actAs("u-mgr-b");
    const o = (await store.repos.opportunities.get("opp-insurance"))!;
    expect(
      (
        await updateOpportunity(
          store,
          o.id,
          editOf(o, {
            stage: "S9 - Closed Lost",
            statusReason: "Chose a competitor",
          }),
        )
      ).ok,
    ).toBe(true);
    const f = await loadForecast(store);
    expect(line(f, "insurance").group).toBe("excluded");
    expect(totals(f)).toEqual(M(3.5, 16.0, 19.5));
    expect(line(f, "insurance").dispute?.status.live ?? false).toBe(false);
    expect(f.company.managerCommitment).toBe(usdM(51.0));
  });

  it("test 23: the seeded internal note and an internal note on Savings Bank are Asserted; nothing changes", async () => {
    const before = await loadForecast(store);
    const events = await store.repos.events.list();
    const seededInternal = events.filter(
      (e) => e.origin === "internal" && e.opportunityId === "opp-energy",
    );
    expect(seededInternal.length).toBeGreaterThan(0);
    for (const e of seededInternal) expect(gradeOf(e)).toBe("asserted");
    // Our own rep forwards the Savings Bank approval: same words, internal sender.
    const note = eml("savings-security-approval").replace(
      "From: security@savingsbank.example",
      "From: felix.braun@wonderful.example",
    );
    const r = await importEmail(store, "opp-savings", note);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.value.event.origin).toBe("internal");
    expect(gradeOf(r.value.event)).toBe("asserted");
    const f = await loadForecast(store);
    expect(totals(f)).toEqual(totals(before));
    expect(line(f, "savings").group).toBe(line(before, "savings").group);
    expect(line(f, "savings").view.states).toEqual(
      line(before, "savings").view.states,
    );
  });

  it("test 30: Airline Group Won, signed Mar 1: Signed; $16.0M / $28.5M / $29.5M; bridge gains Won outside +$2.5M, cause CRM edit (spec 8.0/10.5/11.5)", async () => {
    await actAs("u-mgr-a");
    const o = (await store.repos.opportunities.get("opp-airline"))!;
    expect(
      (
        await updateOpportunity(
          store,
          o.id,
          editOf(o, { stage: "S7 - Closed Won", signedDate: isoDate("2027-03-01") }),
        )
      ).ok,
    ).toBe(true);
    const f = await loadForecast(store);
    expect(line(f, "airline").group).toBe("signed");
    expect(totals(f)).toEqual(M(16.0, 28.5, 29.5));
    const b = (await loadBridge(store, f))!;
    const won = b.lines.find((l) => l.kind === "won_outside")!;
    expect(won.amount).toBe(usdM(2.5));
    expect(won.moves[0]!.causes).toContain("CRM edit");
  });

  it("test 31: shortlist email leaves Vendor selection open; selection email approved by RevOps (a Sales Manager is refused): Committed, ESD Mar 8 / Mar 15 / Mar 24, Core, 'no written award'; $13.5M / $28.5M / $29.5M (spec 5.5/10.5/11.5)", async () => {
    await importAndList("airline", "airline-shortlist");
    let f = await loadForecast(store);
    expect(
      line(f, "airline").view.states.find((s) => s.type === "vendor_selection")!
        .state,
    ).not.toBe("done");
    expect(line(f, "airline").commitment?.level).toBe("engaged");
    const v = await importAndList("airline", "airline-selection");
    await actAs("u-mgr-a");
    expect(
      (await reviewEvidence(store, v.evidence[0]!.id, "approve", "")).ok,
    ).toBe(false);
    expect(
      (
        await approveAll(
          v.evidence.map((e) => e.id),
          "u-revops",
        )
      ).every((x) => x.ok),
    ).toBe(true);
    f = await loadForecast(store);
    const a = line(f, "airline");
    expect(
      a.view.states.find((s) => s.type === "vendor_selection"),
    ).toMatchObject({ state: "done", doneGrade: "stated" });
    expect(a.commitment?.level).toBe("committed");
    expect(esd(f, "airline")).toEqual([
      "2027-03-08",
      "2027-03-15",
      "2027-03-24",
    ]);
    expect(a.group).toBe("core");
    expect(a.reasons).toContain("no written award");
    expect(totals(f)).toEqual(M(13.5, 28.5, 29.5));
  });

  it("test 32: the Savings Bank security email waits; approved by the deal's Sales Manager: Security Done, ESD Mar 13 / Mar 22 / Mar 31, Core; $13.5M / $27.0M / $29.5M (spec 5.5/9.0/11.5)", async () => {
    const v = await importAndList("savings", "savings-security-approval");
    expect(totals(await loadForecast(store))).toEqual(M(13.5, 26.0, 29.5));
    expect(
      (
        await approveAll(
          v.evidence.map((e) => e.id),
          "u-mgr-a",
        )
      ).every((x) => x.ok),
    ).toBe(true);
    const f = await loadForecast(store);
    expect(
      line(f, "savings").view.states.find((s) => s.type === "security")!.state,
    ).toBe("done");
    expect(esd(f, "savings")).toEqual([
      "2027-03-13",
      "2027-03-22",
      "2027-03-31",
    ]);
    expect(line(f, "savings").group).toBe("core");
    expect(totals(f)).toEqual(M(13.5, 27.0, 29.5));
  });

  it("test 33: after test 6, RevOps rejects the Energy Group Evidence (a Sales Manager is refused): back to $13.5M / $26.0M / $29.5M, logged with reason (spec 5.5/8.0/11.5)", async () => {
    const v = await importAndList("energy", "energy-budget-reapproval");
    const id = v.evidence[0]!.id;
    await actAs("u-mgr-b");
    expect(
      (await reviewEvidence(store, id, "reject", "Re-approval is routine")).ok,
    ).toBe(false);
    await actAs("u-revops");
    expect(
      (await reviewEvidence(store, id, "reject", "Re-approval is routine")).ok,
    ).toBe(true);
    const f = await loadForecast(store);
    expect(totals(f)).toEqual(M(13.5, 26.0, 29.5));
    const d = (await store.repos.evidenceDecisions.list()).find(
      (x) => x.evidenceId === id && x.decision === "rejected",
    )!;
    expect([d.actorId, d.reason]).toEqual([
      "u-revops",
      "Re-approval is routine",
    ]);
  });

  it("test 34: a Dispute In on Airline Group with Bet 'pilot by Mar 7' is refused naming vendor selection; with vendor selection by Mar 15 too it is accepted: Manager commitment $53.5M (spec 15.5)", async () => {
    await actAs("u-mgr-a");
    const one = await raiseDispute(store, {
      opportunityId: "opp-airline",
      direction: "in",
      reason: "Pilot lands",
      bets: [{ conditionType: "pilot", by: isoDate("2027-03-07") }],
      outCondition: null,
    });
    expect(one.ok ? "" : one.errors.form).toContain("vendor selection");
    const two = await raiseDispute(store, {
      opportunityId: "opp-airline",
      direction: "in",
      reason: "Pilot lands and they pick us",
      bets: [
        { conditionType: "pilot", by: isoDate("2027-03-07") },
        { conditionType: "vendor_selection", by: isoDate("2027-03-15") },
      ],
      outCondition: null,
    });
    expect(two.ok).toBe(true);
    expect((await loadForecast(store)).company.managerCommitment).toBe(
      usdM(53.5),
    );
  });

  it("test 35: a second Dispute on National Bank is refused", async () => {
    await actAs("u-mgr-a");
    const r = await raiseDispute(store, {
      opportunityId: "opp-natbank",
      direction: "in",
      reason: "x",
      bets: [{ conditionType: "procurement_legal", by: isoDate("2027-03-31") }],
      outCondition: null,
    });
    expect(r.ok ? "" : r.errors.form).toContain("already has a Dispute");
  });

  it("test 36: after test 7, Global Telecom's sponsor confirmed Mar 7 and approved by its Sales Manager: Core, ESD Mar 20 / Mar 29 / Apr 7; Bet still missed; $13.5M / $41.0M / $44.5M; Manager commitment $51.0M (spec 5.5/11.0/14.5, 13.0)", async () => {
    await advanceOneWeek(store);
    const v = await importAndList("telecom", "telecom-sponsor-confirmed");
    expect(
      (
        await approveAll(
          v.evidence.map((e) => e.id),
          "u-mgr-b",
        )
      ).every((x) => x.ok),
    ).toBe(true);
    const f = await loadForecast(store);
    expect(line(f, "telecom").group).toBe("core");
    expect(esd(f, "telecom")).toEqual([
      "2027-03-20",
      "2027-03-29",
      "2027-04-07",
    ]);
    expect(line(f, "telecom").dispute?.status.live).toBe(false);
    expect(totals(f)).toEqual(M(13.5, 41.0, 44.5));
    expect(f.company.managerCommitment).toBe(usdM(51.0));
  });

  it("test 37: 'no update yet' on Retail Enterprise is status: ESD stays Mar 3 / Mar 11 / Mar 20; latest engagement stays Feb 19", async () => {
    await importAndList("retail", "retail-status");
    const f = await loadForecast(store);
    expect(esd(f, "retail")).toEqual([
      "2027-03-03",
      "2027-03-11",
      "2027-03-20",
    ]);
    expect(line(f, "retail").commitment?.latestEngagement).toBe("2027-02-19");
  });

  it("test 42: Energy Group TCV to $10.0M, then its email: Commitment lost −$15.0M (its Feb 22 TCV) with causes CRM edit and new evidence; lines sum from $65.3M to $13.5M (spec −3.0, 17.3 → 5.5)", async () => {
    await actAs("u-mgr-b");
    const r = await setTcv("energy", usdM(10.0));
    expect(r.ok ? "" : JSON.stringify(r.errors)).toBe("");
    await importAndList("energy", "energy-budget-reapproval");
    const f = await loadForecast(store);
    const b = (await loadBridge(store, f))!;
    const m = b.lines
      .find((l) => l.kind === "commitment_lost")!
      .moves.find((x) => x.opportunityId === "opp-energy")!;
    expect(m.amount).toBe(usdM(-15.0));
    expect(m.causes).toEqual(
      expect.arrayContaining(["CRM edit", "new evidence"]),
    );
    expect([b.before, b.after]).toEqual(M(65.3, 13.5));
    expect(b.lines.reduce((a, l) => a + l.amount, 0)).toBe(b.after - b.before);
  });

  it("test 44: three edits on one as-of date store exactly one automatic run; the next date stores the next", async () => {
    await actAs("u-mgr-a");
    for (const t of [1.6, 1.7, 1.8]) {
      await setTcv("retail", usdM(t));
      await ensureDailyRun(store);
    }
    const auto = (await store.repos.forecastRuns.list()).filter(
      (r) => r.trigger === "automatic",
    );
    expect(auto.filter((r) => r.asOfDate === "2027-03-01")).toHaveLength(1);
    await advanceOneWeek(store);
    await ensureDailyRun(store);
    expect(
      (await store.repos.forecastRuns.list()).filter(
        (r) => r.trigger === "automatic" && r.asOfDate === "2027-03-08",
      ),
    ).toHaveLength(1);
  });

  it("test 49: 'budget for AI initiatives' on Airline Group is a status claim; Budget unchanged", async () => {
    const before = line(await loadForecast(store), "airline").view.states.find(
      (s) => s.type === "budget",
    );
    const v = await importAndList("airline", "airline-budget-for-ai");
    expect(v.evidence.every((e) => e.claim === "status")).toBe(true);
    expect(
      line(await loadForecast(store), "airline").view.states.find(
        (s) => s.type === "budget",
      ),
    ).toEqual(before);
  });

  it("test 51: an email to Retail Enterprise from outside the Account's domains saying the board approved is internal, Asserted; nothing changes", async () => {
    const before = await loadForecast(store);
    const v = await importAndList("retail", "retail-board-approved-outside");
    expect([v.event.origin, gradeOf(v.event)]).toEqual([
      "internal",
      "asserted",
    ]);
    const f = await loadForecast(store);
    expect(totals(f)).toEqual(totals(before));
    expect(line(f, "retail").view.states).toEqual(
      line(before, "retail").view.states,
    );
  });

  it("test 56: as-of Mar 12, the committee moved to Apr 14 makes National Bank's Dispute stale ('Bet no longer sufficient'); Manager commitment exactly $20.0M lower (spec $4.0M)", async () => {
    await setAsOf("2027-03-12");
    const before = (await loadForecast(store)).company.managerCommitment;
    await importAndList("natbank", "natbank-committee-apr14");
    const f = await loadForecast(store);
    expect(line(f, "natbank").dispute?.status).toMatchObject({
      live: false,
      reason: "Bet no longer sufficient",
    });
    expect(before - f.company.managerCommitment).toBe(usdM(20.0));
  });

  it("test 57: a Dispute Out on Retail Enterprise with no step, or naming a Done step, is refused with the rule", async () => {
    await actAs("u-mgr-a");
    const none = await raiseDispute(store, {
      opportunityId: "opp-retail",
      direction: "out",
      reason: "Slow",
      bets: [],
      outCondition: null,
    });
    expect(none.ok).toBe(false);
    const done = await raiseDispute(store, {
      opportunityId: "opp-retail",
      direction: "out",
      reason: "Slow",
      bets: [],
      outCondition: "budget",
    });
    expect(done.ok ? "" : done.errors.form).toContain("not an open step");
  });

  // DR-14 sets the Removed amount to minus the earlier (Feb 22) TCV: $15.0M here, $3.0M in spec units, as test 42
  // also uses. The spec's −$2.5M for test 59 is the current TCV and conflicts with DR-14; Part II wins (R-16).
  it("test 59: archiving Energy Group adds Removed −$15.0M, its Feb 22 TCV per DR-14; lines still sum to the change (spec −2.5)", async () => {
    await actAs("u-revops");
    expect(
      (await archiveOpportunity(store, "opp-energy", "Duplicate record")).ok,
    ).toBe(true);
    const f = await loadForecast(store);
    const b = (await loadBridge(store, f))!;
    expect(b.lines.find((l) => l.kind === "removed")?.amount).toBe(usdM(-15.0));
    expect(b.lines.reduce((a, l) => a + l.amount, 0)).toBe(b.after - b.before);
  });

  it("test 61: Travel Marketplace (PAYG) is Excluded and in no Scenario, open or Won", async () => {
    let f = await loadForecast(store);
    expect(line(f, "travel").group).toBe("excluded");
    expect(line(f, "travel").reasons.join()).toContain("PAYG — not forecast");
    const base = totals(f);
    await actAs("u-revops");
    const o = (await store.repos.opportunities.get("opp-travel"))!;
    expect(
      (
        await updateOpportunity(
          store,
          o.id,
          editOf(o, { stage: "S7 - Closed Won", signedDate: isoDate("2027-03-10") }),
        )
      ).ok,
    ).toBe(true);
    f = await loadForecast(store);
    expect(line(f, "travel").group).toBe("excluded");
    expect(totals(f)).toEqual(base);
  });
});
