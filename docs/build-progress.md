# Build progress (resume point)

Read this first when resuming. Each line is a pushed, tested piece.

## Forecast app (Phase 3 onward)

- [x] Condition state replay, `src/domain/condition-state.ts` (PRD §4C, R-11, R-12). Tests: `tests/unit/condition-state.test.ts`.
- [x] Timing: planning-standard lookup (G-2), remaining days (§4E), pilot by evaluation date (DR-02), path and planned signature date per case, readiness (§4G). `src/domain/timing.ts`, assembled per deal by `src/domain/deal-view.ts`. Tests: `tests/unit/timing.test.ts` (every seed deal's dates at Mar 1, test 5, test 7 at Mar 8).
- [x] Eligibility, Commitment (PRD §4H, DR-02 wording, expand variant), Group (PRD §4I, DR-08), Scenario totals. `src/domain/classification.ts`. Tests: `tests/unit/classification.test.ts`: every deal's group, $13.5M / $26.0M / $29.5M at Mar 1 and Mar 8. Manager closing a Contrary signal is not built yet (no entity).
- [ ] Next: Forecast home screen (PRD §5 panel 1), deal drill-down.
- [ ] Evidence review queue (DR-04 rights, G-1).
- [ ] Disputes and Manager commitment ($51.0M at Mar 1).
- [ ] Stored runs, movement bridge (DR-14), Submissions (C-1).
- [ ] Interventions and latest viable dates (§4G.5).
- [ ] Next week control, backtest (BT-1, DR-15 open question R-8).

Dollar figures in spec tests convert by re-summing with R-9 amounts (see implementation-decisions.md).
