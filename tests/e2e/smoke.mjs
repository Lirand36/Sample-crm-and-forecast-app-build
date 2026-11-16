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
await page.getByRole("heading", { level: 1, name: /CRM/ }).waitFor();
check("CRM lists ten opportunities", (await page.locator("tbody tr").count()) === 10);
check("PAYG deal shown without TCV", (await page.locator("tbody tr", { hasText: "Travel Marketplace" }).innerText()).includes("PAYG"));

const role = page.getByLabel("Acting as (role switcher)");
await role.selectOption("u-revops");
await page.reload();
await page.getByRole("heading", { level: 1, name: /CRM/ }).waitFor();
check("role choice persists in IndexedDB across reload", (await role.inputValue()) === "u-revops");

await page.getByTestId("reset").click();
await page.waitForFunction(() => document.querySelector('select[aria-label="Acting as (role switcher)"]')?.value === "u-cro");
check("Reset restores the seed (acting user back to CRO)", (await role.inputValue()) === "u-cro");

check("no page errors", errors.length === 0, errors.join("; "));
await browser.close();
if (failures.length) {
  console.error(`${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("All smoke checks passed");
