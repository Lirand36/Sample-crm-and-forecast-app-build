# Traceability matrix

Test # | rule | domain function | test file | status. Tests 1–44 as re-baselined in handoff Part VI, tests 45–61 new, 22b supplementary (G-10).
Engine and acceptance tests start in Phase 4; this matrix is filled in as each one lands.

| Test | Rule | Domain function | Test file | Status |
|---|---|---|---|---|
| 1 | PRD §4I, §4J | — | — | Not started |
| 2 | PRD §4I | — | — | Not started |
| 3 | DR-01, PRD §4E, §4G | — | — | Not started |
| 4 | PRD §4G | — | — | Not started |
| 5 | DR-02 | — | — | Not started |
| 6 | PRD §4B, §4C, DR-05 | — | — | Not started |
| 7 | DR-02, DR-10, PRD §4I | — | — | Not started |
| 8 | DR-04, PRD §4E | — | — | Not started |
| 9 | PRD §4B.6, G-1 | — | — | Not started |
| 10 | PRD §4I | — | — | Not started |
| 11 | PRD §4K, DR-01, C-5 | — | — | Not started |
| 12 | PRD §4J, DR-13 | — | — | Not started |
| 13 | Part V determinism | — | — | Not started |
| 14 | PRD §6 | — | — | Not started |
| 15 | PRD §4H, §4I | — | — | Not started |
| 16 | PRD §4C.3, §4H | — | — | Not started |
| 17 | PRD §4A, §4I | — | — | Not started |
| 18 | PRD §4A | — | — | Not started |
| 19 | PRD §4H | — | — | Not started |
| 20 | DR-08, PRD §4E | — | — | Not started |
| 21 | PRD §4G | — | — | Not started |
| 22 | DR-09 | — | — | Not started |
| 22b | Integrity §2.9, ledger row 14, G-10 | — | — | Not started |
| 23 | PRD §4C.2, DR-05 | — | — | Not started |
| 24 | PRD §4I, DR-03 | — | — | Not started |
| 25 | PRD §4I | — | — | Not started |
| 26 | PRD §4B.3 | — | — | Not started |
| 27 | DR-06 | — | — | Not started |
| 28 | PRD §4I | — | — | Not started |
| 29 | PRD §4E, §4J | — | — | Not started |
| 30 | PRD §4J | — | — | Not started |
| 31 | DR-03, DR-04 | — | — | Not started |
| 32 | DR-04, PRD §4B | — | — | Not started |
| 33 | DR-04 | — | — | Not started |
| 34 | PRD §4I, DR-10 | — | — | Not started |
| 35 | PRD §4I | — | — | Not started |
| 36 | PRD §4I, DR-10 | — | — | Not started |
| 37 | PRD §4E, Integrity §6.5 | — | — | Not started |
| 38 | PRD §4H, Integrity §6.7 | — | — | Not started |
| 39 | PRD §4G, Integrity §6.6 | — | — | Not started |
| 40 | DR-02 | — | — | Not started |
| 41 | PRD §4C.4, §4E | — | — | Not started |
| 42 | PRD §4J | — | — | Not started |
| 43 | PRD §4K, DR-01 | — | — | Not started |
| 44 | DR-16 | — | — | Not started |
| 45 | DR-01, C-1, C-2 | — | — | Not started |
| 46 | DR-01, DR-08 | — | — | Not started |
| 47 | DR-01 | — | — | Not started |
| 48 | DR-02 | — | — | Not started |
| 49 | DR-03 | — | — | Not started |
| 50 | DR-04 | — | — | Not started |
| 51 | DR-05 | — | — | Not started |
| 52 | DR-06 | — | — | Not started |
| 53 | DR-07 | — | — | Not started |
| 54 | DR-07 | — | — | Not started |
| 55 | DR-08, DR-09 | — | — | Not started |
| 56 | DR-10 | — | — | Not started |
| 57 | DR-11 | — | — | Not started |
| 58 | DR-12 | — | — | Not started |
| 59 | DR-14, C-3 | — | — | Not started |
| 60 | DR-15, G-4 | — | — | Not started |
| 61 | DR-07 | — | — | Not started |

## Property tests (Part VI)

| Property | Rule | Test file | Status |
|---|---|---|---|
| Every eligible deal in exactly one Group | Part VI | — | Not started |
| Conservative ≤ Core ≤ Stretch | Part VI | — | Not started |
| Fast ≤ standard ≤ slow | Part VI | — | Not started |
| Bridge lines sum to the change in Core (company and team) | Part VI | — | Not started |
| No deal counted twice in Manager commitment | Part VI | — | Not started |
| Stored run hash never changes after later edits | DR-16 | `tests/property/append-only.test.ts` (storage level) | Passing at storage level; engine-level in Phase 5 |
| Identical output for identical inputs; no clock | Part VI | — | Not started |
| No Intervention lifts a hard Link | Part VI | — | Not started |
| Calibration spans never affect engine output | Part VI | — | Not started |

## Phase 1 foundation tests

| Area | Test file | Status |
|---|---|---|
| Date-only utilities, calendar days | `tests/unit/dates.test.ts` | Passing |
| Money in integer cents | `tests/unit/money.test.ts` | Passing |
| Repository contract, both stores, append-only enforcement | `tests/integration/storage-contract.test.ts` | Passing |
| Reset reproducible, both stores; seed deterministic | `tests/integration/reset.test.ts` | Passing |
| Canonical seed integrity (PRD §8, Part VII) | `tests/unit/seed-integrity.test.ts` | Passing |
| .eml fixtures and stored extraction | `tests/unit/eml-fixtures.test.ts` | Passing |
| Domain purity | `tests/unit/domain-purity.test.ts` + ESLint rules | Passing |
| Browser smoke (boot, persistence, reset) | `tests/e2e/smoke.mjs` | Passing |
