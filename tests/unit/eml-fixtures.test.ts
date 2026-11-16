import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEml } from "@/infrastructure/adapters/eml";
import { buildCanonicalSeed } from "@/seed/canonical";
import { EML_FIXTURES } from "@/seed/extraction-fixtures";

const dir = join(process.cwd(), "src/seed/eml");
const seed = buildCanonicalSeed();
const required = [
  "energy-budget-reapproval", "retail-competitor-evaluation", "airline-shortlist", "airline-selection",
  "savings-security-approval", "retail-status", "insurance-second-progress", "natbank-postponed-no-date",
  "natbank-committee-apr14", "airline-budget-for-ai",
];

describe(".eml fixtures with stored extraction (handoff Part VII)", () => {
  it("includes every fixture Part VII lists", () => {
    const files = readdirSync(dir);
    for (const name of required) expect(files).toContain(`${name}.eml`);
    expect(new Set(EML_FIXTURES.map((f) => f.file))).toEqual(new Set(files));
  });

  it.each(EML_FIXTURES.map((f) => [f.file, f] as const))("%s parses and matches its stored extraction", (_file, fixture) => {
    const parsed = parseEml(readFileSync(join(dir, fixture.file), "utf8"));
    expect(parsed.messageId).toBe(fixture.messageId);
    expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.from).toBeTruthy();
    const account = seed.accounts.find((a) => a.name === fixture.account)!;
    expect(account).toBeDefined();
    const insideDomain = account.emailDomains.some((d) => parsed.from!.endsWith(`@${d}`));
    if (fixture.file === "retail-board-approved-outside.eml") expect(insideDomain).toBe(false);
    else expect(insideDomain).toBe(true);
    for (const claim of fixture.claims) {
      if (fixture.file === "unverifiable-quote.eml") expect(parsed.body).not.toContain(claim.quote);
      else expect(parsed.body).toContain(claim.quote);
    }
  });

  it("re-logged Feb 24 email has the same sender and body as the seeded one (test 27)", () => {
    const relog = parseEml(readFileSync(join(dir, "natbank-feb24-relogged.eml"), "utf8"));
    const original = seed.events.find((e) => e.opportunityId === "opp-natbank" && e.occurredAt === "2027-02-24")!;
    expect([relog.from, relog.body]).toEqual([original.sender, original.text]);
  });
});
