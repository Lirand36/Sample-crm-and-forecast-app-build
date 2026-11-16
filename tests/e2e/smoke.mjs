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
await page.waitForURL(/\/forecast$/);
await page.getByRole("heading", { name: "Forecast", exact: true }).waitFor();
check("root redirects to /forecast", page.url().endsWith("/forecast"));
const runRow = page.locator("tbody tr").first();
check("seeded Feb 22 run shows Core $17.3M", (await runRow.innerText()).includes("$17.3M"), await runRow.innerText());
check("as-of date is the demo date", (await page.locator(".asof").innerText()).includes("Mar 1, 2027"));

await page.getByRole("link", { name: "CRM" }).click();
await page.getByRole("heading", { level: 1, name: /Opportunities/ }).waitFor();
check("CRM lists ten opportunities", (await page.locator("tbody tr").count()) === 10);
check("PAYG deal shown without TCV", (await page.locator("tbody tr", { hasText: "Travel Marketplace" }).innerText()).includes("PAYG"));

const role = page.getByLabel("Acting as (role switcher)");
await role.selectOption("u-revops");
await page.reload();
await page.getByRole("heading", { level: 1, name: /Opportunities/ }).waitFor();
check("role choice persists in IndexedDB across reload", (await role.inputValue()) === "u-revops");

// ----- Phase 2 slice 1: Opportunity edit, rights, create, archive -----
await role.selectOption("u-mgr-b");
await page.getByRole("link", { name: "Retail Enterprise — Wonderful platform" }).click();
await page.getByRole("heading", { level: 1, name: /Retail Enterprise/ }).waitFor();
check("Opportunity detail lists its Events read-only", (await page.locator("text=Seeded demo").count()) >= 8);
await page.getByRole("button", { name: "Edit" }).click();
check("another manager cannot edit TCV (DR-04)", await page.getByLabel("TCV (USD)").isDisabled());
await page.getByRole("button", { name: "Cancel" }).click();

await role.selectOption("u-mgr-a");
await page.getByRole("button", { name: "Edit" }).click();
await page.getByLabel("TCV (USD)").fill("2000000");
await page.getByRole("button", { name: "Save changes" }).click();
await page.locator(".details").waitFor();
check("deal's manager edits TCV; detail shows $2,000,000", (await page.locator(".details").innerText()).includes("$2,000,000"));
const historyRow = await page.locator("h2:has-text('Change history') + table tbody tr").first().innerText();
check("change history logs field, old and new value, author", /tcv/.test(historyRow) && historyRow.includes("$1,500,000") && historyRow.includes("Elena Ruiz"), historyRow.replace(/\s+/g, " "));

await page.getByRole("link", { name: "Opportunities" }).first().click();
await page.getByRole("link", { name: "New opportunity" }).click();
await page.getByRole("combobox", { name: /^Account/ }).selectOption({ label: "Iberia Logistics" });
await page.getByLabel("Name", { exact: true }).fill("Iberia expansion");
await page.getByLabel("Owner (account executive)").fill("Lucía Moreno");
await page.getByRole("combobox", { name: /^Deal type/ }).selectOption("land_and_expand");
await page.getByLabel("TCV (USD)").fill("1000000");
await page.getByRole("button", { name: "Create opportunity" }).click();
await page.getByRole("heading", { level: 1, name: /Iberia expansion/ }).waitFor();
const det = await page.locator(".details").innerText();
check("Land and Expand on an Account with a prior win is the expand variant (DR-07)", det.includes("expand variant"), det.replace(/\s+/g, " "));
check("expand variant has six Conditions, no pilot", (await page.locator(".conditions li").count()) === 6);

await page.getByRole("button", { name: "Archive" }).click();
await page.getByRole("button", { name: "Archive opportunity" }).click();
check("archive requires a reason", (await page.locator(".form-error").innerText()).includes("reason"));
await page.getByLabel("Reason").fill("Created by mistake");
await page.getByRole("button", { name: "Archive opportunity" }).click();
await page.locator(".badge", { hasText: "Archived" }).first().waitFor();
check("archived opportunity is kept and badged", (await page.locator("h1").innerText()).includes("Archived"));

await page.getByTestId("reset").click();
await page.waitForFunction(() => document.querySelector('select[aria-label="Acting as (role switcher)"]')?.value === "u-cro");
check("Reset restores the seed (acting user back to CRO)", (await role.inputValue()) === "u-cro");
await page.goto(`${base}/crm/opportunities`);
await page.locator("tbody tr").first().waitFor();
check("Reset removes created opportunity and restores TCV", (await page.locator("tbody tr").count()) === 10 && (await page.locator("tbody tr", { hasText: "Retail Enterprise" }).innerText()).includes("$1.5M"));

check("no page errors", errors.length === 0, errors.join("; "));
await browser.close();
if (failures.length) {
  console.error(`${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("All smoke checks passed");
