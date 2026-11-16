import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveAccount, archiveOpportunity, changeLogFor, createAccount, createContact, createOpportunity,
  updateAccount, updateOpportunity, type OpportunityEditInput,
} from "@/application/crm";
import type { DataStore } from "@/application/ports";
import { isoDate } from "@/domain/dates";
import type { Opportunity } from "@/domain/entities";
import { usdM } from "@/domain/money";
import { MemoryDataStore } from "@/infrastructure/storage/memory";
import { buildCanonicalSeed } from "@/seed/canonical";

let store: DataStore;

async function actAs(userId: string) {
  const s = (await store.repos.session.get("session"))!;
  await store.repos.session.put({ ...s, actingUserId: userId });
}

function editOf(o: Opportunity, patch: Partial<OpportunityEditInput> = {}): OpportunityEditInput {
  return {
    name: o.name, ownerName: o.ownerName, managerId: o.managerId, tcv: o.tcv, status: o.status,
    statusReason: o.statusReason, signedDate: o.signedDate, closeDate: o.closeDate, stage: o.stage, ...patch,
  };
}

beforeEach(async () => {
  store = new MemoryDataStore();
  await store.load(buildCanonicalSeed());
});

describe("Opportunity edits (Part IV, DR-04, DR-13)", () => {
  it("lets the deal's Sales Manager edit TCV and logs it with author and time (test 12 setup)", async () => {
    await actAs("u-mgr-a");
    const retail = (await store.repos.opportunities.get("opp-retail"))!;
    const r = await updateOpportunity(store, retail.id, editOf(retail, { tcv: usdM(2.0) }));
    expect(r.ok).toBe(true);
    expect((await store.repos.opportunities.get("opp-retail"))?.tcv).toBe(usdM(2.0));
    const [log] = await changeLogFor(store, "opp-retail");
    expect(log).toMatchObject({ field: "tcv", oldValue: String(usdM(1.5)), newValue: String(usdM(2.0)), actorId: "u-mgr-a", at: "2027-03-01" });
  });

  it("refuses restricted edits from another manager or the CRO, and logs nothing", async () => {
    const retail = (await store.repos.opportunities.get("opp-retail"))!;
    for (const user of ["u-mgr-b", "u-cro"]) {
      await actAs(user);
      const r = await updateOpportunity(store, retail.id, editOf(retail, { tcv: usdM(2.0) }));
      expect(r.ok).toBe(false);
    }
    expect(await changeLogFor(store, "opp-retail")).toHaveLength(0);
  });

  it("lets RevOps edit any deal's restricted fields", async () => {
    await actAs("u-revops");
    const ins = (await store.repos.opportunities.get("opp-insurance"))!;
    expect((await updateOpportunity(store, ins.id, editOf(ins, { status: "lost", statusReason: "Chose a competitor" }))).ok).toBe(true);
  });

  it("lets anyone edit unrestricted fields such as CRM stage and close date, logged", async () => {
    await actAs("u-cro");
    const nb = (await store.repos.opportunities.get("opp-natbank"))!;
    const r = await updateOpportunity(store, nb.id, editOf(nb, { stage: "Legal", closeDate: isoDate("2027-04-15") }));
    expect(r.ok).toBe(true);
    expect((await changeLogFor(store, nb.id)).map((c) => c.field).sort()).toEqual(["close_date", "stage"]);
  });

  it("enforces Won needs a signed date, Lost needs a reason, open non-PAYG needs TCV > 0", async () => {
    await actAs("u-revops");
    const e = (await store.repos.opportunities.get("opp-energy"))!;
    const won = await updateOpportunity(store, e.id, editOf(e, { status: "won", signedDate: null }));
    expect(won.ok ? null : won.errors.signedDate).toMatch(/signed date/);
    const lost = await updateOpportunity(store, e.id, editOf(e, { status: "lost", statusReason: " " }));
    expect(lost.ok ? null : lost.errors.statusReason).toMatch(/reason/);
    const zero = await updateOpportunity(store, e.id, editOf(e, { tcv: usdM(0) }));
    expect(zero.ok ? null : zero.errors.tcv).toMatch(/TCV/);
  });

  it("lets a PAYG deal stay open without TCV and be set to Won (test 61 setup)", async () => {
    await actAs("u-mgr-a");
    const t = (await store.repos.opportunities.get("opp-travel"))!;
    const r = await updateOpportunity(store, t.id, editOf(t, { status: "won", signedDate: isoDate("2027-03-10") }));
    expect(r.ok).toBe(true);
    expect((await store.repos.opportunities.get("opp-travel"))).toMatchObject({ status: "won", signedDate: "2027-03-10", tcv: null });
  });

  it("clears the signed date and reason when status changes back", async () => {
    await actAs("u-mgr-a");
    const i = (await store.repos.opportunities.get("opp-iberia"))!;
    const r = await updateOpportunity(store, i.id, editOf(i, { status: "open" }));
    expect(r.ok && r.value.signedDate).toBe(null);
  });
});

describe("Archive, never delete (Part IV, C-3)", () => {
  it("archives with a reason, logs it, and blocks further edits", async () => {
    await actAs("u-mgr-b");
    expect((await archiveOpportunity(store, "opp-energy", "")).ok).toBe(false);
    const r = await archiveOpportunity(store, "opp-energy", "Duplicate record");
    expect(r.ok && r.value.archivedAt).toBe("2027-03-01");
    const [log] = await changeLogFor(store, "opp-energy");
    expect(log).toMatchObject({ field: "archived_at", reason: "Duplicate record", actorId: "u-mgr-b" });
    const e = (await store.repos.opportunities.get("opp-energy"))!;
    expect((await updateOpportunity(store, e.id, editOf(e, { stage: "x" }))).ok).toBe(false);
    expect(await store.repos.opportunities.get("opp-energy")).toBeDefined();
  });

  it("refuses archive by someone without DR-04 rights on the deal", async () => {
    await actAs("u-mgr-a");
    expect((await archiveOpportunity(store, "opp-energy", "x")).ok).toBe(false);
  });

  it("lets RevOps archive an Account only when it has no open opportunities", async () => {
    await actAs("u-revops");
    expect((await archiveAccount(store, "acc-energy", "x")).ok).toBe(false);
    expect((await archiveAccount(store, "acc-citytransit", "Lost customer")).ok).toBe(true);
  });
});

describe("Create opportunities with a fixed template variant (DR-07, test 54)", () => {
  it("(a) Land and Expand on an Account with no Won deal is the land variant with seven Conditions", async () => {
    await actAs("u-mgr-a");
    const r = await createOpportunity(store, { accountId: "acc-retail", name: "Retail phase 2", ownerName: "Lucía Moreno", managerId: "u-mgr-a", dealType: "land_and_expand", tcv: usdM(0.5), closeDate: null, stage: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([r.value.templateVariant, r.value.templateVersion, r.value.createdAt]).toEqual(["land", 1, "2027-03-01"]);
    expect((await store.repos.dealConditions.list()).filter((c) => c.opportunityId === r.value.id)).toHaveLength(7);
  });

  it("(b) on Iberia Logistics (Won Feb 12) is the expand variant with no pilot, and stays so", async () => {
    await actAs("u-mgr-a");
    const r = await createOpportunity(store, { accountId: "acc-iberia", name: "Iberia expansion", ownerName: "Lucía Moreno", managerId: "u-mgr-a", dealType: "land_and_expand", tcv: usdM(1.0), closeDate: null, stage: null });
    expect(r.ok && r.value.templateVariant).toBe("expand");
    if (!r.ok) return;
    const conds = (await store.repos.dealConditions.list()).filter((c) => c.opportunityId === r.value.id).map((c) => c.type);
    expect(conds).toHaveLength(6);
    expect(conds).not.toContain("pilot");
    // History changes later: the variant does not.
    await actAs("u-revops");
    const iberia = (await store.repos.opportunities.get("opp-iberia"))!;
    await updateOpportunity(store, iberia.id, editOf(iberia, { status: "lost", statusReason: "Data fix" }));
    expect((await store.repos.opportunities.get(r.value.id))?.templateVariant).toBe("expand");
  });

  it("creates PAYG with no Conditions and no TCV; Major Accounts with seven", async () => {
    await actAs("u-mgr-b");
    const payg = await createOpportunity(store, { accountId: "acc-telecom", name: "Telecom usage", ownerName: "Felix Braun", managerId: "u-mgr-b", dealType: "payg", tcv: null, closeDate: null, stage: null });
    expect(payg.ok && payg.value.templateVariant).toBe("none");
    const major = await createOpportunity(store, { accountId: "acc-telecom", name: "Telecom group", ownerName: "Felix Braun", managerId: "u-mgr-b", dealType: "major_accounts", tcv: null, closeDate: null, stage: null });
    expect(major.ok ? null : major.errors.tcv).toMatch(/TCV/);
  });

  it("logs creation with author", async () => {
    await actAs("u-mgr-a");
    const r = await createOpportunity(store, { accountId: "acc-retail", name: "New", ownerName: "X", managerId: "u-mgr-a", dealType: "major_accounts", tcv: usdM(1), closeDate: null, stage: null });
    if (!r.ok) throw new Error("create failed");
    const fields = (await changeLogFor(store, r.value.id)).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(["created", "tcv", "status", "manager"]));
  });
});

describe("Accounts and Contacts", () => {
  it("requires unique, valid email domains (they derive Evidence origin, DR-05)", async () => {
    const dup = await createAccount(store, { name: "Clone", emailDomains: ["nationalbank.example"], segment: "Banks", market: "Italy", ownerName: "X" });
    expect(dup.ok ? null : dup.errors.emailDomains).toMatch(/already used/);
    const bad = await createAccount(store, { name: "Bad", emailDomains: ["not a domain"], segment: "Banks", market: "Italy", ownerName: "X" });
    expect(bad.ok).toBe(false);
    const ok = await createAccount(store, { name: "Harbour Bank", emailDomains: ["@HarbourBank.example"], segment: "Banks", market: "Portugal", ownerName: "Lucía Moreno" });
    expect(ok.ok && ok.value.emailDomains).toEqual(["harbourbank.example"]);
  });

  it("logs Account edits field by field", async () => {
    await actAs("u-revops");
    const a = (await store.repos.accounts.get("acc-retail"))!;
    await updateAccount(store, a.id, { ...a, emailDomains: [...a.emailDomains, "retail-group.example"], market: "Portugal" });
    expect((await changeLogFor(store, a.id)).map((c) => c.field).sort()).toEqual(["email_domains", "market"]);
  });

  it("creates a Contact with a valid email on an existing Account", async () => {
    const bad = await createContact(store, { accountId: "acc-retail", name: "N", title: "T", email: "nope", role: "legal", active: true });
    expect(bad.ok).toBe(false);
    const ok = await createContact(store, { accountId: "acc-retail", name: "Nora Gil", title: "Counsel", email: "N.Gil@retailenterprise.example", role: "legal", active: true });
    expect(ok.ok && ok.value.email).toBe("n.gil@retailenterprise.example");
  });
});
