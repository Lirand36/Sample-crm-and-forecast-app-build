# Build progress (resume point)

Read this first when resuming. Each line is a pushed, tested piece.

## Forecast app (Phase 3 onward)

- [x] Condition state replay, `src/domain/condition-state.ts` (PRD §4C, R-11, R-12). Tests: `tests/unit/condition-state.test.ts`.
- [x] Timing: planning-standard lookup (G-2), remaining days (§4E), pilot by evaluation date (DR-02), path and planned signature date per case, readiness (§4G). `src/domain/timing.ts`, assembled per deal by `src/domain/deal-view.ts`. Tests: `tests/unit/timing.test.ts` (every seed deal's dates at Mar 1, test 5, test 7 at Mar 8).
- [x] Eligibility, Commitment (PRD §4H, DR-02 wording, expand variant), Group (PRD §4I, DR-08), Scenario totals. `src/domain/classification.ts`. Tests: `tests/unit/classification.test.ts`: every deal's group, $13.5M / $26.0M / $29.5M at Mar 1 and Mar 8. Manager closing a Contrary signal is not built yet (no entity).
- [x] Live forecast aggregate `src/domain/forecast.ts`, disputes `src/domain/disputes.ts` (stale rules, Bet missed), service `src/application/forecast.ts`. Forecast home (`src/app/forecast/page.tsx`): number block, Manager commitment box, Downside exposure, Ready not committed, by-manager table, Deals table, stored runs. Tests: `tests/unit/forecast.test.ts` ($51.0M at Mar 1, $36.0M at Mar 8).
- [x] Forecast deal screen `src/app/forecast/deals/[id]/page.tsx`: verdict, commitment, three planned dates vs quarter end, path calendar, steps with evidence (grade, status, quote) and planning standard.
- [ ] Next: Evidence review queue (approve / confirm / reject per DR-04 and G-1), then Interventions (latest viable dates, start-by, preview; DR-09) and Recoverable.
- [ ] Evidence review queue (DR-04 rights, G-1).
- [ ] Raise and withdraw Disputes from the UI, Bet acceptance check.
- [ ] Stored runs, movement bridge (DR-14), Submissions (C-1).
- [ ] Interventions and latest viable dates (§4G.5).
- [ ] Next week control, backtest (BT-1, DR-15 open question R-8).

Dollar figures in spec tests convert by re-summing with R-9 amounts (see implementation-decisions.md).
