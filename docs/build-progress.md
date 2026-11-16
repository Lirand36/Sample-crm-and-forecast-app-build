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
- [ ] Next: waiver and link change (RevOps), planning-standard approval (test 45), backtest (BT-1, DR-15; R-8 open question on the synthetic label).
- [ ] Raise and withdraw Disputes from the UI, Bet acceptance check.
- [ ] Next week control, backtest (BT-1, DR-15 open question R-8).

Dollar figures in spec tests convert by re-summing with R-9 amounts (see implementation-decisions.md).
