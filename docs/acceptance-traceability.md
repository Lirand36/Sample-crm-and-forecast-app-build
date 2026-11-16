# Acceptance traceability: the 61 spec tests

PRD §9 tests 1–44 as amended by Handoff Part VI, plus Handoff tests 45–61. Dollar values are converted per R-9 (Big Deals ×5); the spec value is shown next to the app value. Synthetic deals and BT-1 are not rescaled.

Run it all with `npm run check` (lint, types, 215 unit and integration tests) and `npm run test:e2e` (browser smoke test against a running build). Last run: Nov 16, all green.

**Result: 59 pass, 2 partial, 0 fail.** Seven engine gaps were found and fixed in this pass (marked *fixed*).

| # | What | Spec | App (converted) | Checked in | Result |
|---|---|---|---|---|---|
| 1 | Home as of Mar 1; bridge from Feb 22 | 5.5 / 8.0 / 11.5; 17.3 → 8.0 | 13.5 / 26.0 / 29.5; 65.3 → 26.0 | unit/classification, unit/forecast, unit/bridge, e2e | Pass |
| 2 | Manager A, then B | A 3.5/3.5/7.0, 7.5; B 2.0/4.5/4.5, 5.5 | A 3.5/3.5/7.0, 23.5; B 10.0/22.5/22.5, 27.5 | integration/acceptance | Pass |
| 3 | National Bank: Committed, Late, Security Banks v1 | ESD Apr 1 / Apr 16 / May 10 | same | integration/acceptance, unit/forecast | Pass |
| 4 | Preview National Bank's Intervention | 5.5 / 12.0 / 15.5 | 13.5 / 46.0 / 49.5 | unit/forecast, e2e | Pass |
| 5 | Airline Group pilot | finish Mar 8 / 10 / 14; ESD Mar 13 / 22 / Apr 4; Stretch | same | unit/timing, unit/classification | Pass |
| 6 | Energy Group budget email | 5.5 / 5.5 / 9.0 | 13.5 / 13.5 / 17.0 | integration/acceptance | Pass |
| 7 | Next week (Mar 8) | 5.5 / 8.0 / 11.5, commitment 10.0 | 13.5 / 26.0 / 29.5, commitment 36.0 | integration/runs, unit/* | Pass |
| 8 | Approve waiting Insurance Evidence (Sales Manager may) | ESD Mar 10 / 10 / 19, Firm | same | integration/acceptance | Pass |
| 9 | VP Sales rejects National Bank block | Stretch 15.5 | Stretch 49.5 | integration/evidence-review, e2e | Pass |
| 10 | Withdraw B's Insurance Dispute | 15.0, B 7.5 | 61.0, B 37.5 | integration/acceptance | Pass |
| 11 | Submitted run unchanged after later edits | standards shown, not samples | same | integration/acceptance | Pass |
| 12 | Retail TCV to $2.0M | 6.0 / 8.5 / 12.0, 13.5 | 14.0 / 26.5 / 30.0, 51.5 | integration/acceptance, integration/crm | Pass |
| 13 | Engine twice on the same inputs | identical | identical | integration/acceptance | Pass |
| 14 | 100 generated deals: Home fits one screen, lists ≤ 3 rows | | Every Home list now stops at 3 rows with "And N more" | not automated | Partial: no 100-deal generator |
| 15 | Global Telecom: ready, At risk | ESD Mar 13 / 22 / 31, no Intervention | same | integration/acceptance, unit/forecast | Pass |
| 16 | Retail competitor email | 4.0 / 6.5 / 10.0 | 12.0 / 24.5 / 28.0, Commitment lost −1.5 | integration/acceptance | Pass |
| 17 | Insurance set to Lost | 3.5 / 6.0 / 9.5, 13.0 | 3.5 / 16.0 / 19.5, 51.0 | integration/acceptance | Pass |
| 18 | Won Dec 20; Won with no date | Excluded, reasons | same | unit/synthetic-deals | Pass |
| 19 | All Done, engagement 31 days ago | Unproven, Uncommitted | same | unit/synthetic-deals | Pass |
| 20 | Procurement 40 days in progress (DR-08) | Overdue, Timing unknown | same | unit/synthetic-deals | Pass |
| 21 | Late only via a hard Link | no Intervention | same | unit/synthetic-deals | Pass |
| 22 | Engaged with soft Links open (DR-09) | no Intervention, not Recoverable | same | unit/synthetic-deals | Pass |
| 23 | Internal notes (Feb 28 note; Savings note) | Asserted, nothing changes | same | integration/acceptance | Pass |
| 24 | Stated award only | Core, "no written award" | same | unit/synthetic-deals | Pass |
| 25 | At risk and not ready, then ready | Uncommitted, both reasons | same | unit/synthetic-deals | Pass, *fixed* (R-18) |
| 26 | Quote not in the email | unverifiable | same | integration/import-event | Pass |
| 27 | Feb 24 email logged again | duplicate, no change | same | integration/import-event | Pass |
| 28 | Dispute In without a Bet | refused | same | integration/acceptance | Pass |
| 29 | Procurement only, Mar 10 → Mar 11 | Core → Stretch; Slipped, "time passing" | same; cause reads "no progress" | unit/synthetic-deals | Pass |
| 30 | Airline Won Mar 1 | 8.0 / 10.5 / 11.5 | 16.0 / 28.5 / 29.5, Won outside +2.5 | integration/acceptance | Pass |
| 31 | Airline selection (RevOps approves) | 5.5 / 10.5 / 11.5 | 13.5 / 28.5 / 29.5 | integration/acceptance | Pass |
| 32 | Savings security (Sales Manager approves) | 5.5 / 9.0 / 11.5 | 13.5 / 27.0 / 29.5 | integration/acceptance | Pass |
| 33 | RevOps rejects Energy evidence | 5.5 / 8.0 / 11.5 | 13.5 / 26.0 / 29.5 | integration/acceptance | Pass |
| 34 | Bet that does not unlock, then does | 15.5 | 53.5 | integration/acceptance | Pass |
| 35 | Second Dispute on a deal | refused | same | integration/acceptance | Pass |
| 36 | Telecom sponsor confirmed late | 5.5 / 11.0 / 14.5, 13.0 | 13.5 / 41.0 / 44.5, 51.0 | integration/acceptance | Pass |
| 37 | "No update yet" is status | ESD unchanged | same | integration/acceptance | Pass |
| 38 | Process is not engagement | Unproven, Uncommitted | same | unit/synthetic-deals | Pass |
| 39 | Start-by counts what follows | start-by Feb 28 | same | unit/synthetic-deals | Pass |
| 40 | Pilot below floor (DR-02 rewrite) | finish Mar 21 / 23 / 27; Mar 28 At risk | same | unit/synthetic-deals | Pass |
| 41 | Two blocked intervals | merge Feb 10–18, 9 days remain | same | unit/synthetic-deals | Pass |
| 42 | Energy TCV edit, then its email | −3.0; 17.3 → 5.5 | −15.0; 65.3 → 13.5 | integration/acceptance | Pass |
| 43 | Replay content of a submitted run | quotes, standards, versions | same | integration/acceptance | Pass |
| 44 | Three edits in one day | one automatic run per date | same | integration/acceptance | Pass |
| 45 | Procurement v2 12 / 30 / 40 from Mar 1 | 3.5 / 5.5 / 11.5, 10.5 | 3.5 / 13.5 / 29.5, 38.5 | integration/planning-standards, e2e | Pass |
| 46 | No planning standard row | Timing unknown | same | unit/synthetic-deals | Pass |
| 47 | Observed spans for Security | calibration only, nothing moves | Admin shows spans; the engine has no input for them | e2e (display) | Partial: display only, by design |
| 48 | Automatic pilot pass / fail | Done Mar 20 Direct / At risk | same | unit/synthetic-deals | Pass, *fixed* (failed pilot was never detected) |
| 49 | "Budget for AI initiatives" | status claim | same | integration/acceptance | Pass |
| 50 | Bad news unreviewed 4 days | overdue, no number change | same | integration/acceptance | Pass |
| 51 | Email from outside the domains | internal, Asserted | same | integration/acceptance | Pass |
| 52 | Second Insurance progress email | ESD Mar 9 / 9 / 18, Firm | same | integration/import-event | Pass |
| 53 | Waivers: Sales Manager, Budget, Technical validation | refused / refused / Core "waiver in place" | same | integration/deal-config, e2e | Pass |
| 54 | Land vs expand variant | seven Conditions / no pilot | same | integration/crm | Pass |
| 55 | National Bank postponed, no date | 5.5 / 8.0 / 11.5; Recoverable 1.0 | 13.5 / 26.0 / 29.5; Recoverable 1.0 | integration/import-event, e2e | Pass |
| 56 | Committee moved to Apr 14 | Dispute stale, −4.0 | Dispute stale, −20.0 | integration/acceptance | Pass, *fixed* (Bets were never re-checked) |
| 57 | Dispute Out with no step / a Done step | refused | same | integration/acceptance | Pass, *fixed* (no step was accepted) |
| 58 | Signed Mar 31, recorded Apr 5 vs Apr 9 | counts / does not | same | unit/synthetic-deals | Pass, *fixed* (R-17) |
| 59 | Archive Energy Group | Removed −2.5 | Removed −15.0 (−3.0 in spec units) | integration/acceptance | Pass, *fixed*; spec figure conflicts with DR-14 (R-16) |
| 60 | BT-1 backtest | 1.0 / 3.0 / 4.0, Actual 2.0 | same (not rescaled) | unit/backtest, e2e | Pass |
| 61 | PAYG Travel, open then Won | Excluded "PAYG — not forecast" | same | integration/acceptance | Pass, *fixed* (Won PAYG counted as Signed) |
