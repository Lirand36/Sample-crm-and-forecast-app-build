# Readiness note — Signature Path Forecasting, Full MVP

Prepared 16 November 2026. Phase 0 deliverable (handoff v2, Part V and Part VIII). No code has been written.

## 1. Sources read

All read in full, in the order Part V requires:

| # | Document | Used for |
|---|---|---|
| 1 | `06_Claude_Code_Master_Build_Handoff_v2.md` | Decision Record DR-01 to DR-19, product contract, CRM spec, tests 1–61, seed changes, phases |
| 2 | `PRD_v5_Signature_Path_Forecasting.md` | Definitions, methodology A–K, data model, seed, tests 1–44, scope |
| 3 | `Forecast_Logic_Integrity_Review.md` | Section 6 final gate (items 1–8 and 10 binding; item 9 superseded by DR-02; item 4's "sample values" replaced by DR-01) |
| — | `00_KICKOFF_PROMPT.md` | Confirms the above and the decided facts; adds no rules |

No other document was used. The repository was empty (no commits) when this note was written.

## 2. Hierarchy I will apply

1. Handoff Part II, Decision Record (DR-01 to DR-19).
2. Integrity Review §6, except item 9 (replaced by DR-02) and the words "the sample values behind each duration" in item 4 (replaced by "the planning-standard version and values used").
3. PRD v5 §4 Methodology and §3 Definitions.
4. PRD v5 §10 MVP column, as amended by Part II.
5. The rest of PRD v5.
6. Handoff Parts IV–IX as technical recommendations; they never change business meaning.

Integrity Review §1–§5 (issues, earlier resolutions, ledger, commercial challenge, assumptions) are background. Where they differ from §6 or the Decision Record (for example the 3-day duplicate window, auto-acceptance on model confidence, start-by = QE minus X's days, the presenter choosing origin), the higher source wins.

Anything that survives the hierarchy goes to `docs/open-issues.md` with both passages, and only that item stops.

## 3. Verification done before writing this note

I recomputed by hand, from the rules as amended, every seed result and the expected values of tests 1–4, 5, 6, 7, 8, 9, 10, 12, 16, 17, 29, 30, 31, 32, 34, 36, 40, 41, 42, 45, 52, 55, 56, 60 and 61. All of them agree with the rules: the seed totals ($5.5M / $8.0M / $11.5M, Manager commitment $13.0M), both managers' figures, the Feb 22 bridge (−$9.3M), both Interventions (start by Mar 10), the DR-02 pilot dates (Mar 8 / Mar 10 / Mar 14), test 7 at Mar 8 ($5.5M / $8.0M / $11.5M, commitment $10.0M), test 36 ($14.5M Stretch, commitment $13.0M), test 45 under Procurement v2 ($3.5M / $5.5M / $11.5M, commitment $10.5M) and the BT-1 metrics in test 60.

So the problems below are about how a test is run or what a rule leaves unsaid. None of them changes a number in the documents.

## 4. Contradictions and gaps

Each one is also logged in `docs/open-issues.md`. "Proposed reading" is what I will build unless you say otherwise; none of them is a new business rule, but each needs your OK because it touches business meaning.

### 4.1 Contradictions between passages

**C-1. Test 45 expects a "new run" that DR-16 does not create.**
- Test 45: "RevOps approves 'Procurement and legal' v2 … effective Mar 1 … The new run records v2 and its values."
- DR-16: "A Forecast run is stored automatically the first time the app computes an as-of date that has no run yet, and on every Submission." Test 44 (re-baselined): "exactly one automatic run exists for that as-of date."
- Consequence: on Mar 1 the automatic run already exists before the standard changes, so changing a standard on the same as-of date stores no run.
- Proposed reading: test 45 makes a Submission after the change, and that run is the one that records v2. No rule changes.

**C-2. Test 45's bridge baseline is not the default one.**
- Test 45: "Energy Group … Core → Stretch: bridge line Slipped −$2.5M, cause 'planning standard changed'."
- PRD §4J: "Home compares the live view with last week's stored run by default; any stored run can be chosen." Last week's run is Feb 22, where Energy Group's TCV was $3.0M. Against Feb 22 the line would be −$3.0M, with CRM change and Evidence as extra causes.
- Proposed reading: test 45 explicitly chooses the Mar 1 automatic run (stored before the change) as the baseline. Both values then hold. Home's default stays "last week's run", meaning the latest stored run with an as-of date at least 7 days earlier, which is what test 1 needs.

**C-3. Archived deals could never reach the "Removed" line.**
- DR-14: "New line Removed: in Core before, archived in the CRM now … Ordered after 'Other exclusion'."
- PRD §4J: "Other exclusion: In Core before, Excluded for any other reason now," first match.
- Consequence: if an archived deal is treated as Excluded, it lands in "Other exclusion" first and test 59 fails.
- Proposed reading: an archived Opportunity is left out of evaluation entirely (it is neither evaluated nor Excluded and is absent from new runs). "Removed" matches deals present in the earlier run and archived now. This needs no change to the PRD eligibility table.

**C-4. Part VII says every PRD §8 result is unchanged, but DR-02 changes Airline Group's row.**
- Part VII: "All nine keep the seven Conditions, so every PRD §8 result is unchanged."
- PRD §8 Airline Group: ESD "Mar 11 / Mar 19 / Mar 29", Readiness "Slow", "Targets met Mar 6 / Mar 7 / Mar 8".
- Re-baselined test 5 (DR-02): ESD Mar 13 / Mar 22 / Apr 4, which is ready at standard pace.
- Resolved by the hierarchy (DR-02 wins). Group (Stretch) and every total are unchanged. The seed expectations file will carry the DR-02 values.

**C-5. Tests 11 and 43 still say "add a duration sample".**
- PRD tests 11 and 43: "… add a duration sample …" / "… add duration samples …"
- DR-01 and DR-18 remove DurationSample.
- Proposed reading: the step becomes "RevOps approves a new planning-standard version, and an observed calibration span is added". The expected result is that the stored run still shows the versions and values it used (as re-baselined).

### 4.2 Gaps the documents leave open

**G-1. No one is named for rejecting Evidence that is already confirmed or approved.** DR-04 covers rejecting a provisional reversing claim only. Test 9 rejects the National Bank block, which the seed marks "confirmed". Tests 11 and 43 "reject Evidence" without naming it. Proposed reading: the same rights apply as for the matching row (rejecting good news on Conditions 2, 3 or 4 is RevOps only; otherwise the deal's Sales Manager or RevOps). The tests run as RevOps, so no number depends on this.

**G-2. Lookup precedence when a planning standard has deal_type "all".** DR-01 defines (deal_type, segment) then (deal_type, null). Part VII's rows all use "all". Proposed reading: exact deal_type beats "all" at the same segment level, and segment beats null. The full order is (deal_type, segment) → (all, segment) → (deal_type, null) → (all, null). No seed value or test depends on this today.

**G-3. Opportunities have no creation date.** DR-07 fixes the land or expand variant "when this one is created" and compares against a "signed date before this one's creation". Neither PRD §7 nor Part IV lists a created date. I will add `created_at` as a technical field. Seed creation dates will be set before each deal's earliest Event, and Iberia Logistics's before Feb 12.

**G-4. Timing bias population (DR-15).** "For signed deals: signed date − standard-pace planned date." Test 60 expects −2.5 days, which only holds for deals signed inside the quarter (A +5, C −10). Including deal E would give −3.3. Proposed reading: deals signed in the quarter, simple mean in days. TCV-weighting gives the same answer for BT-1, so I need a choice for the general case. I recommend the simple mean.

**G-5. Seed facts the bridge needs but §8 does not list.** Test 1's causes ("CRM change" for City Transit and Energy Group) need ChangeLog entries between Feb 22 and Mar 1. I will seed City Transit → Lost on Feb 25 and Energy Group TCV $3.0M → $2.5M on Feb 23. The date of the TCV edit is my choice and affects no value. The Feb 22 run is a stored fixture recording planning standards v1, so test 1 shows no "planning standard changed" cause.

**G-6. Bet validation with a future Done date.** DR-10 and §4I treat the Bet's Conditions as "Done on those dates". When a date is after the as-of date, I will treat the Condition's finish as the Bet date in every timing case. For the seed (National Bank: Procurement by Mar 31) both possible readings give Core, so the documented values hold either way.

**G-7. Engagement recency boundary.** "Within the last 30 days" is read as 30 days or fewer. Tests 19 and 38 (31 days → Unproven) are consistent with this, and so is Savings Bank (Feb 10) at Mar 12 in test 56.

**G-8. Grade when origin is internal but the source type is a "Direct" type.** For example, a rep uploads a purchase order. DR-05 says Asserted is "any Event whose origin is internal". I read Asserted as taking precedence over source_type, which matches test 51.

**G-9. CRM validations make two eligibility branches unreachable from the UI.** "Open non-PAYG needs TCV > 0" and "Won needs a signed date" (Part IV) mean the "no TCV" and "data error" exclusions (PRD §4A, test 18) cannot be produced from the CRM screens. The engine keeps both branches, and test 18 exercises them with synthetic data.

**G-10. Test coverage lost by re-baselining test 22.** PRD test 22 was the only test proving that an Intervention lifts several soft Links together (Integrity Review §2 item 9, ledger row 14). Re-baselined, it now proves that Engaged deals get no Intervention. I will add an unnumbered supplementary test, 22b: a Committed synthetic deal with Vendor selection and Security open and Procurement not started is offered one Intervention, and that Intervention lifts both soft Links. Numbering 1–61 stays as written.

**G-11. Small run details.** Test 48 gives no as-of date; I will use Mar 20 so the week-ending-Mar-20 reading is visible. Duplicate content hashes (DR-06, test 27) are computed over sender and body, not the logged date, so re-logging the Feb 24 email on Feb 25 is a duplicate. ChangeLog and decision timestamps use the app's simulated date (the as-of date) plus a sequence number, so tests 44 and 58 are reproducible and nothing reads the system clock.

## 5. Phase 1 plan: Foundation

Goal (Part VIII gate): the app boots locally and on a Vercel preview, and reset is reproducible.

**Stack [RECOMMENDATION].** Next.js (App Router) with TypeScript strict, one app with `/crm` and `/forecast` on one origin. IndexedDB through a small wrapper (`idb`). Vitest for unit, acceptance and integration tests, fast-check for property tests, Playwright for one smoke e2e. ESLint and `tsc --noEmit`. npm scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`. No server database, no API routes that hold state, no paid add-ons.

**Work items:**

1. Scaffold the Part VIII tree (`src/app`, `features`, `domain`, `application`, `infrastructure/storage`, `infrastructure/adapters`, `seed`, `tests/*`). Add a lint rule that blocks `domain/` from importing UI, storage, network or `Date.now`.
2. Repository ports in `application/ports` for every entity in PRD §7 plus the DR-18 additions. Runs, RunLines, EvidenceDecisions, ConditionWaivers and ChangeLog get append-only methods with no update or delete.
3. Two implementations: in-memory (tests) and IndexedDB (browser), with a schema version. Both run against one shared contract test suite.
4. Canonical seed as bundled JSON and `.eml` fixtures. That covers Users, Accounts with `.example` domains, Contacts, ten Opportunities (including Travel Marketplace PAYG), Events and stored Evidence, Airline PilotPlan and readings, planning standards v1, the three Disputes, the Feb 22 stored run, the G-5 ChangeLog entries, and BT-1 kept separate and labelled synthetic. A seed-integrity test checks counts and referential integrity.
5. App shell: toolbar with role switcher (CRO, RevOps, Manager A, Manager B), simulated as-of date (Mar 1, 2027), "Reset", and a visible note that each browser holds its own copy. `/crm` and `/forecast` are placeholder pages that read from the repository.
6. Reset: clear IndexedDB and reload the seed. The test is seed → mutate → reset → the serialised store hash equals the fresh-seed hash.
7. Living docs: `docs/implementation-decisions.md`, `docs/open-issues.md`, `docs/traceability.md` (test # | rule | domain function | test file | status) with all 61 tests plus 22b listed as "not started".
8. Vercel: the repo builds with default Next.js settings. You link the Vercel project to this repo (Hobby tier); I then confirm a preview deployment boots and that reset works there.

**Phase 1 report will include** files changed, decisions taken, commands run with real output, test counts, and open issues, as Part V requires.

## 6. What I need from you

- A yes, or corrections, on the proposed readings for C-1 to C-3, C-5 and G-1 to G-4. C-4 and the rest are covered by the hierarchy or are purely technical.
- Linking Vercel to this repo once Phase 1 is pushed, as planned.
