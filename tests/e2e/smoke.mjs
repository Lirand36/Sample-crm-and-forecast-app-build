// Browser smoke test for the Phase 1 gate: the app boots, seeds IndexedDB, persists, and resets.
// Usage: BASE_URL=http://localhost:3000 node tests/e2e/smoke.mjs
// Uses the Playwright library (no test runner) so it works with a preinstalled Chromium.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${base}/`);
await page.waitForURL(/\/crm\/opportunities$/);
await page.getByRole("heading", { level: 1, name: /Opportunities/ }).waitFor();
check("root opens the CRM's Opportunities", page.url().endsWith("/crm/opportunities"));
check("product name in the top bar", (await page.locator(".brand").innerText()) === "Wonderful CRM");
check("today's date is Mar 1, 2027", (await page.locator(".today").innerText()).includes("Mar 1, 2027"));
const bodyText = await page.locator("body").innerText();
check("no demo, seed or phase wording on screen", !/demo data|seed|sample data|Phase \d|single-presenter/i.test(bodyText));
check("Big Deal naming, no Major Accounts", bodyText.includes("Big Deal") && !bodyText.includes("Major Accounts"));

await page.getByRole("link", { name: "Forecast", exact: true }).click();
await page.getByRole("heading", { name: "Forecast", exact: true }).waitFor();
await page.getByTestId("core").waitFor();
check("Forecast home: system forecast $26.0M", (await page.getByTestId("core").innerText()) === "$26.0M");
check("Conservative $13.5M, Stretch $29.5M", (await page.getByTestId("conservative").innerText()) === "$13.5M" && (await page.getByTestId("stretch").innerText()) === "$29.5M");
check("Manager commitment $51.0M in its own box", (await page.getByTestId("manager-commitment").innerText()) === "$51.0M");
check("bridge: Feb 22 run to now, Slipped −$20.0M", (await page.getByTestId("bridge-slipped").innerText()).includes("−$20.0M"));
check("bridge sentence", (await page.getByTestId("bridge-sentence").innerText()).startsWith("The system forecast is down $39.3M"));
check("target gap shown", (await page.locator(".runway-caption").innerText()).includes("$20.0M short of the $46.0M target"));
await page.locator(".stake-box a", { hasText: "Energy Group" }).click();
await page.locator(".verdict").waitFor();
const verdict = await page.locator(".verdict").innerText();
check("Forecast deal screen: Energy Group is Core, planned Mar 23", verdict.includes("Core") && verdict.includes("Mar 23, 2027"), verdict.replace(/\s+/g, " "));
check("path calendar shows the open step", (await page.locator(".cal-row").count()) === 1);
await page.getByRole("link", { name: "Forecast", exact: true }).first().click();
check("Recoverable lists $21.0M", (await page.locator(".stake-box", { hasText: "Recoverable" }).innerText()).includes("$21.0M"));
await page.locator(".stake-box", { hasText: "Recoverable" }).getByRole("link", { name: "National Bank" }).click();
await page.locator(".intervention").waitFor();
check("National Bank Intervention: start procurement and legal by Mar 10", (await page.locator(".intervention").innerText()).includes("by Mar 10, 2027"));
await page.getByRole("button", { name: "Preview" }).click();
await page.getByTestId("preview").waitFor();
check("test 4: preview shows the system forecast at $46.0M", (await page.getByTestId("preview").innerText()).includes("$46.0M"));
await page.getByRole("button", { name: "Close preview" }).click();
check("closing the preview stores nothing", (await page.getByTestId("preview").count()) === 0);
await page.getByLabel("Sample email").selectOption("natbank-postponed-no-date.eml");
await page.getByTestId("add-sample").click();
await page.getByTestId("import-result").waitFor();
await page.locator(".verdict", { hasText: "Timing unknown" }).waitFor();
check("test 55: adding the postponement email makes National Bank Timing unknown", (await page.locator(".verdict").innerText()).includes("Timing unknown"));
await page.getByRole("link", { name: "Administration" }).click();
await page.getByTestId("reset-start").click();
await page.getByTestId("reset").click();
await page.getByText("Baseline restored.").waitFor();
await page.getByRole("link", { name: "Forecast", exact: true }).first().click();
await page.getByTestId("core").waitFor();
const runRow = page.locator("table").last().locator("tbody tr").first();
check("Feb 22 stored run shows Core $65.3M", (await runRow.innerText()).includes("$65.3M"), await runRow.innerText());

await page.getByRole("link", { name: "Opportunities", exact: true }).click();
await page.getByRole("heading", { level: 1, name: /Opportunities/ }).waitFor();
check("CRM lists ten opportunities", (await page.locator("tbody tr").count()) === 10);
check("PAYG deal shown without TCV", (await page.locator("tbody tr", { hasText: "Travel Marketplace" }).innerText()).includes("PAYG"));

const role = page.getByLabel("Signed in as");
await role.selectOption("u-revops");
await page.reload();
await page.getByRole("heading", { level: 1, name: /Opportunities/ }).waitFor();
check("role choice persists in IndexedDB across reload", (await role.inputValue()) === "u-revops");

// ----- Phase 2 slice 1: Opportunity edit, rights, create, archive -----
await role.selectOption("u-mgr-b");
await page.getByRole("link", { name: "Retail Enterprise — Wonderful platform" }).click();
await page.getByRole("heading", { level: 1, name: /Retail Enterprise/ }).waitFor();
check("Opportunity detail lists its activity", (await page.locator("h2", { hasText: "Activity" }).innerText()).includes("(8)"));
check("Path to signature explained", (await page.locator(".checklist li").count()) === 7);
await page.getByRole("button", { name: "Edit" }).click();
check("another manager cannot edit revenue (DR-04)", await page.getByLabel("ARR").isDisabled());
await page.getByRole("button", { name: "Cancel" }).click();

await role.selectOption("u-mgr-a");
await page.getByRole("button", { name: "Edit" }).click();
await page.getByLabel("ARR").fill("600000");
await page.getByLabel("Non-recurring").fill("200000");
check("TCV preview recomputes to $2,000,000", (await page.getByTestId("tcv-preview").innerText()) === "$2,000,000");
await page.getByRole("button", { name: "Save changes" }).click();
await page.locator(".details.revenue", { hasText: "$2,000,000" }).waitFor({ timeout: 5000 }).catch(() => {});
check("deal's manager edits revenue; TCV shows $2,000,000", (await page.locator(".details.revenue").innerText()).includes("$2,000,000"));
const history = await page.locator("h2:has-text('Change history') + table tbody").innerText();
check("change history logs field, old and new value, author", /tcv\s+\$1,500,000\s+\$2,000,000\s+Elena Ruiz/.test(history), history.replace(/\s+/g, " ").slice(0, 160));

await page.getByRole("link", { name: "Opportunities", exact: true }).first().click();
await page.getByRole("link", { name: "New opportunity" }).click();
await page.getByRole("combobox", { name: /^Account/ }).selectOption({ label: "Iberia Logistics" });
await page.getByLabel("Name", { exact: true }).fill("Iberia expansion");
await page.getByLabel("Owner (account executive)").fill("Lucía Moreno");
await page.getByRole("combobox", { name: /^Deal type/ }).selectOption("land_and_expand");
await page.getByLabel("ARR").fill("300000");
await page.getByLabel("Non-recurring").fill("100000");
await page.getByRole("button", { name: "Create opportunity" }).click();
await page.getByRole("heading", { level: 1, name: /Iberia expansion/ }).waitFor();
const det = await page.locator(".details").first().innerText();
check("Land and Expand on an Account with a prior win is an expansion (DR-07)", det.includes("expansion of an existing customer"), det.replace(/\s+/g, " "));
check("expansion has six steps, no pilot", (await page.locator(".checklist li").count()) === 6);

await page.getByRole("button", { name: "Archive this opportunity…" }).click();
await page.getByRole("button", { name: "Archive opportunity" }).click();
check("archive requires a reason", (await page.locator(".form-error").innerText()).includes("reason"));
await page.getByLabel("Reason").fill("Created by mistake");
await page.getByRole("button", { name: "Archive opportunity" }).click();
await page.locator(".badge", { hasText: "Archived" }).first().waitFor();
check("archived opportunity is kept and badged", (await page.locator("h1").innerText()).includes("Archived"));

// Accounts and Contacts
await page.getByRole("link", { name: "Accounts", exact: true }).click();
await page.getByRole("heading", { level: 1, name: "Accounts" }).waitFor();
check("Accounts list shows the ten accounts", (await page.locator("tbody tr").count()) === 10);
await page.getByRole("link", { name: "New account" }).click();
await page.getByLabel("Name", { exact: true }).fill("Harbour Ports");
await page.getByLabel("Segment").fill("Logistics");
await page.getByLabel("Market").fill("Italy");
await page.getByLabel("Owner (account executive)").fill("Lucía Moreno");
await page.getByLabel("Email domains").fill("harbourports.example");
await page.getByRole("button", { name: "Create account" }).click();
await page.getByRole("heading", { level: 1, name: /Harbour Ports/ }).waitFor();
check("account created and opened", (await page.locator(".subtitle").innerText()).includes("Logistics · Italy"));
await page.getByRole("link", { name: "Add contact" }).click();
await page.getByLabel("Name", { exact: true }).fill("Paola Ricci");
await page.getByLabel("Title").fill("Head of Procurement");
await page.getByLabel("Email").fill("p.ricci@harbourports.example");
await page.getByRole("combobox", { name: /^Role on the deal/ }).selectOption("procurement");
await page.getByRole("button", { name: "Create contact" }).click();
await page.getByRole("heading", { level: 1, name: /Harbour Ports/ }).waitFor();
check("contact added from the account page appears on it", (await page.locator("tbody", { hasText: "Paola Ricci" }).count()) === 1);
await page.getByRole("link", { name: "Contacts", exact: true }).first().click();
await page.getByRole("heading", { level: 1, name: "Contacts" }).waitFor();
await page.getByRole("link", { name: "Paola Ricci" }).click();
await page.getByRole("button", { name: "Edit" }).click();
await page.getByLabel("Title").fill("Chief Procurement Officer");
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Chief Procurement Officer").first().waitFor();
check("contact edit is logged", /title\s+Head of Procurement\s+Chief Procurement Officer/.test(await page.locator("table").last().innerText()));

// Path to signature checklist on National Bank
await page.goto(`${base}/crm/opportunities/opp-natbank`);
await page.locator(".checklist li").first().waitFor();
const path = await page.locator(".checklist").innerText();
check("National Bank: security blocked until Mar 16", path.includes("Blocked until Mar 16, 2027"), path.replace(/\s+/g, " ").slice(0, 200));
check("National Bank: 5 of 7 steps ticked", (await page.locator(".tick.ticked").count()) === 5);
check("Big Deal National Bank is $20M", (await page.locator(".details.revenue").innerText()).includes("$20,000,000"));

// Evidence review: the VP Sales overturns National Bank's confirmed block (test 9)
await role.selectOption("u-vp-sales");
await page.getByRole("link", { name: "Evidence review" }).click();
await page.getByRole("heading", { level: 1, name: "Evidence review" }).waitFor();
const blockRow = page.locator("tr", { hasText: "National Bank" }).filter({ hasText: "risk committee" });
await blockRow.getByRole("button", { name: "Overturn…" }).click();
await blockRow.getByLabel("Reason to overturn").fill("Committee date not final");
await blockRow.getByRole("button", { name: "Reject" }).click();
await page.locator("tr", { hasText: "Committee date not final" }).waitFor();
check("VP Sales rejection is logged with the reason", (await page.locator("tr", { hasText: "Committee date not final" }).innerText()).includes("Daniel Avraham"));
await page.getByRole("link", { name: "Forecast", exact: true }).first().click();
await page.getByTestId("stretch").waitFor();
// $49.5M on the baseline, plus the $0.5M Retail TCV edit made earlier in this script.
check("test 9: Stretch rises by National Bank's $20M to $50.0M", (await page.getByTestId("stretch").innerText()) === "$50.0M", await page.getByTestId("stretch").innerText());

// Submission by a Sales Manager, then Next week
await role.selectOption("u-mgr-a");
await page.getByRole("link", { name: "Forecast", exact: true }).first().click();
await page.getByTestId("submit").click();
await page.getByText(/Submitted Mar 1, 2027/).waitFor();
await page.locator("table").last().locator("td", { hasText: "Submission" }).waitFor({ timeout: 5000 }).catch(() => {});
check("Sales Manager submission freezes a run", (await page.locator("table").last().innerText()).includes("Submission"));
await page.goto(`${base}/forecast/deals/opp-natbank`);
await page.getByTestId("dispute").waitFor();
await page.getByRole("button", { name: "Withdraw this Dispute" }).click();
await page.getByRole("button", { name: "Raise Dispute In" }).waitFor();
await page.getByLabel("Reason").fill("Legal will run in parallel");
await page.getByRole("button", { name: "Raise Dispute In" }).click();
await page.locator(".form-error").waitFor();
check("a Bet on security alone is refused: the deal would still be late", (await page.locator(".form-error").innerText()).includes("would not count"));
await page.getByRole("combobox", { name: "Step you bet on" }).selectOption("procurement_legal");
await page.getByRole("button", { name: "Raise Dispute In" }).click();
await page.getByTestId("dispute").waitFor();
check("manager withdraws and re-raises a Dispute In with a Bet", (await page.getByTestId("dispute").innerText()).includes("Legal will run in parallel"));
await page.getByRole("link", { name: "Administration" }).click();
await page.getByTestId("next-week").click();
await page.locator(".today", { hasText: "Mar 8, 2027" }).waitFor();
check("Next week moves today to Mar 8", (await page.locator(".today").innerText()).includes("Mar 8, 2027"));

await page.getByRole("link", { name: "Administration" }).click();
await page.getByTestId("reset-start").click();
await page.getByTestId("reset").click();
await page.waitForFunction(() => document.querySelector('select[aria-label="Signed in as"]')?.value === "u-cro");
check("Restore baseline data resets everything (signed in as CRO again)", (await role.inputValue()) === "u-cro");
// Backtest (DR-15, test 60): no closed quarter yet; the example quarter shows no label (R-8)
await page.goto(`${base}/forecast`);
await page.getByRole("link", { name: "Backtest" }).click();
await page.getByTestId("not-backtested").waitFor();
check("no closed quarter: Not yet backtested", (await page.getByTestId("not-backtested").innerText()).includes("Not yet backtested"));
await page.getByTestId("show-synthetic").click();
const bt = await page.getByTestId("synthetic").innerText();
check("test 60: BT-1 shows $1.0M / $3.0M / $4.0M, Actual $2.0M, precision 33.3%, capture 50.0%, bias −2.5 days",
  ["$1.0M / $3.0M / $4.0M", "$2.0M", "33.3%", "50.0%", "+$1.0M", "−2.5 days"].every((x) => bt.includes(x)), bt.replace(/\s+/g, " ").slice(0, 300));
check("example carries no synthetic label (R-8, Liran's decision)", (await page.locator('[data-testid="synthetic"] .synthetic-tag').count()) === 0);

// Planning standard v2 (test 45): RevOps approves Procurement and legal 12 / 30 / 40 from today
await role.selectOption("u-revops");
await page.getByRole("link", { name: "Administration" }).click();
await page.getByTestId("standard-form").waitFor();
check("standards table shows Security Banks v1", /approval\s+Banks\s+v1\s+24 \/ 30 \/ 45 days/.test(await page.getByTestId("standards").innerText()));
await page.getByRole("combobox", { name: "Standard step" }).selectOption("procurement_legal");
await page.getByLabel("Fast days").fill("12");
await page.getByLabel("Standard days").fill("30");
await page.getByLabel("Slow days").fill("40");
await page.getByLabel("Rationale").fill("Legal teams are slower this year");
await page.getByRole("button", { name: "Approve version" }).click();
await page.getByTestId("standard-result").waitFor();
check("Procurement and legal v2 approved", (await page.getByTestId("standard-result").innerText()).includes("v2: 12 / 30 / 40"));
await page.getByRole("link", { name: "Forecast", exact: true }).first().click();
await page.getByTestId("core").waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="core"]')?.textContent === "$13.5M", null, { timeout: 5000 }).catch(() => {});
check("test 45: Core falls to $13.5M as Energy Group moves to Stretch", (await page.getByTestId("core").innerText()) === "$13.5M", await page.getByTestId("core").innerText());
check("test 45: Conservative $3.5M as Insurance Group leaves Firm", (await page.getByTestId("conservative").innerText()) === "$3.5M", await page.getByTestId("conservative").innerText());

// RevOps waiver (test 53): a Sales Manager sees no form; RevOps waives Legal on Retail, which drops to Core
await role.selectOption("u-mgr-a");
await page.goto(`${base}/forecast/deals/opp-retail`);
await page.getByRole("heading", { name: "Manager's position" }).waitFor();
check("a Sales Manager has no waiver form", (await page.getByTestId("revops-form").count()) === 0);
await role.selectOption("u-revops");
await page.getByTestId("revops-form").waitFor();
check("Budget is never offered for a waiver", !(await page.getByRole("combobox", { name: "Step to waive" }).innerText()).includes("Budget"));
await page.getByRole("combobox", { name: "Step to waive" }).selectOption("procurement_legal");
await page.getByLabel("Change reason").fill("Customer's standard paper");
await page.getByRole("button", { name: "Waive step" }).click();
await page.getByTestId("revops-result").waitFor();
await page.getByText("waiver in place").first().waitFor({ timeout: 5000 }).catch(() => {});
check("waiver on Retail: Core with 'waiver in place'", (await page.locator("main").innerText()).includes("waiver in place"));
await page.goto(`${base}/crm/opportunities/opp-retail`);
await page.getByText("waiver: Procurement").first().waitFor({ timeout: 5000 }).catch(() => {});
check("the waiver is in the deal's change log", (await page.locator("main").innerText()).includes("Customer's standard paper"));

await page.goto(`${base}/crm/opportunities`);
await page.locator("tbody tr").first().waitFor();
check("restore removes the created opportunity and restores TCV", (await page.locator("tbody tr").count()) === 10 && (await page.locator("tbody tr", { hasText: "Retail Enterprise" }).innerText()).includes("$1.5M"));

check("no page errors", errors.length === 0, errors.join("; "));
await browser.close();
if (failures.length) {
  console.error(`${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("All smoke checks passed");
