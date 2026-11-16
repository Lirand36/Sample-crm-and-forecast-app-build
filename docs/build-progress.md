# Build progress (resume point)

Read this first when resuming. Each line is a pushed, tested piece.

## Forecast app (Phase 3 onward)

- [x] Condition state replay, `src/domain/condition-state.ts` (PRD §4C, R-11, R-12). Tests: `tests/unit/condition-state.test.ts`.
- [x] Timing: planning-standard lookup (G-2), remaining days (§4E), pilot by evaluation date (DR-02), path and planned signature date per case, readiness (§4G). `src/domain/timing.ts`, assembled per deal by `src/domain/deal-view.ts`. Tests: `tests/unit/timing.test.ts` (every seed deal's dates at Mar 1, test 5, test 7 at Mar 8).
- [x] Eligibility, Commitment (PRD §4H, DR-02 wording, expand variant), Group (PRD §4I, DR-08), Scenario totals. `src/domain/classification.ts`. Tests: `tests/unit/classification.test.ts`: every deal's group, $13.5M / $26.0M / $29.5M at Mar 1 and Mar 8. Manager closing a Contrary signal is not built yet (no entity).
- [x] Live forecast aggregate `src/domain/forecast.ts`, disputes `src/domain/disputes.ts` (stale rules, Bet missed), service `src/application/forecast.ts`. Forecast home (`src/app/forecast/page.tsx`): number block, Manager commitment box, Downside exposure, Ready not committed, by-manager table, Deals table, stored runs. Tests: `tests/unit/forecast.test.ts` ($51.0M at Mar 1, $36.0M at Mar 8).
- [x] Forecast deal screen `src/app/forecast/deals/[id]/page.tsx`: verdict, commitment, three planned dates vs quarter end, path calendar, steps with evidence (grade, status, quote) and planning standard.
- [x] Evidence review: rights `src/domain/evidence-review.ts` (DR-04, G-1), service `src/application/evidence.ts`, page `/evidence` (queue with overdue flag, review log, VP Sales overturn). Test 9 passes (Stretch $49.5M, spec $15.5M).
- [x] Interventions `src/domain/interventions.ts`, latest viable dates in `timing.ts`, preview via `computeForecast(..., preview)`. Recoverable on Home; Interventions block with Preview on the deal screen. Tests 3, 4 and PRD §8 intervention values pass (Recoverable $21.0M).
- [x] Movement bridge `src/domain/bridge.ts` (PRD §4J, DR-14 Removed and transfers, causes), `loadBridge` with C-2 default baseline, "What changed" block on Home with a baseline picker. Test 1 bridge passes (from $65.3M: Lost −$1.8M, Commitment lost −$15.0M, Slipped −$20.0M, TCV change −$2.5M).
- [x] Stored runs `src/domain/run-snapshot.ts` (copies per line), `src/application/runs.ts`: one automatic run per as-of date, Submission (Sales Manager, "Submit my forecast" on Home), "Move to next week" in Administration (stores the day's run, as-of +7, loads the fifth Airline reading). Test 7 passes at Mar 8 ($36.0M Manager commitment; Mar 1 run becomes the default baseline).
- [x] Disputes: `src/domain/dispute-rules.ts` (Bet acceptance check reruns the path with the Bet steps done), `src/application/disputes.ts` (deal's Sales Manager only, one live per deal per quarter, logged), "Manager's position" block on the deal screen. One Bet per Dispute in the UI; the service accepts several.
- [x] Add an email to a deal: .eml import (D-09), origin from the Account's domains (DR-05), duplicate by content hash or Message-ID (DR-06), unverifiable quote check; tests 26, 27, 52, 55; sample emails on the deal screen.
- [x] RevOps waiver and per-deal Link change (DR-07, test 53): never Budget or Vendor selection, reason required, acyclic, logged; waived deal never Firm; panel on the deal screen.
- [x] Planning-standard approval (DR-01, test 45): RevOps only, new version, never retroactive, logged; standards table with calibration spans in Administration; bridge cause "planning standard changed" (R-14).
- [x] Backtest (DR-15, test 60): real backtest per stored run of each closed quarter; "Not yet backtested" until then; example quarter BT-1 with no label (R-8, Liran's call).
- [x] Design pass: runway hero on Forecast (target line, manager marker), teal system / plum manager palette, Schibsted Grotesk, lighter top bar, no all-caps labels, phone layout fixed, product name "Wonderful CRM".
- [x] Forecast home rebuilt with Liran (Nov 16): headline vs target, moves with the email behind them, What to do, collapsible cards, Previous quarters under Forecast, managers' forecast broken down, ARR and non-recurring in Deals.
- [x] All 61 spec tests checked one by one: `docs/acceptance-traceability.md` (59 pass, 2 partial: test 14 has no 100-deal generator, test 47 is display only). New suites `tests/integration/acceptance.test.ts` (seed) and `tests/unit/synthetic-deals.test.ts`. Fixed on the way: Bets re-checked on every recompute (DR-10), Dispute Out must name a step (DR-11), PAYG excluded when Won (DR-07), automatic pilot failure (DR-02), Actual at the cutoff (DR-12, R-17), Uncommitted names its timing (R-18), Removed uses the earlier TCV (R-16). Home lists stop at 3 rows.
- [ ] Next: whatever Liran asks; offered the same simplification pass on the deal screen.

Dollar figures in spec tests convert by re-summing with R-9 amounts (see implementation-decisions.md).
