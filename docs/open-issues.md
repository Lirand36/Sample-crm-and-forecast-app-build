# Open issues

Conflicts or gaps that survive the source hierarchy (handoff v2, Part I). Each row names the passages, the consequence, and the proposed reading awaiting confirmation. Full text: `docs/readiness-note.md` §4. Decisions and rationale: `docs/implementation-decisions.md`.

No open item currently blocks work.

| ID | Passages | Consequence | Proposed reading | Status |
|---|---|---|---|---|
| C-1 | Test 45 "The new run records v2" vs DR-16 / test 44 "exactly one automatic run … for that as-of date" | A same-day standard change stores no run | Test 45 submits after the change; the Submission run records v2 | Resolved: confirmed by Liran 16 Nov (implementation-decisions C-1) |
| C-2 | Test 45 "Slipped −$2.5M" vs PRD §4J default baseline "last week's stored run" (Feb 22 → −$3.0M) | Test fails against default baseline | Test 45 selects the Mar 1 run as baseline; default stays last week's run | Resolved: confirmed by Liran 16 Nov (C-2) |
| C-3 | DR-14 "Removed … ordered after Other exclusion" vs §4J "Other exclusion: Excluded for any other reason" | Archived deals would never reach Removed (test 59) | Archived deals are not evaluated and are absent from new runs; not Excluded | Resolved: confirmed by Liran 16 Nov (C-3) |
| C-4 | Part VII "every PRD §8 result is unchanged" vs DR-02 / test 5 (Airline ESD and Readiness change) | Seed table stale for Airline | Resolved by hierarchy: DR-02 values | Resolved |
| C-5 | Tests 11, 43 "add a duration sample" vs DR-01 / DR-18 (DurationSample removed) | Test step refers to removed entity | Step becomes "approve a new planning-standard version; add a calibration span" | Resolved: confirmed by Liran 16 Nov (C-5) |
| G-1 | DR-04 covers rejecting provisional reversing claims only; test 9 rejects a confirmed one | Rights undefined for rejecting confirmed/approved Evidence | Liran: the VP Sales (CRO role) may reject confirmed or approved Evidence, with a reason | Resolved: decided by Liran 16 Nov (G-1) |
| G-2 | DR-01 lookup order vs Part VII deal_type "all" | Precedence undefined | (deal_type, segment) → (all, segment) → (deal_type, null) → (all, null) | Resolved: delegated by Liran (G-2) |
| G-3 | DR-07 variant fixed "when created"; no created date in PRD §7 / Part IV | Variant cannot be derived | Add `createdAt` (technical) | Resolved: delegated by Liran (G-3) |
| G-4 | DR-15 timing bias "for signed deals" vs test 60 −2.5 | Population and weighting undefined | Deals signed in the quarter; simple mean | Resolved: delegated by Liran (G-4) |
| G-5 | Test 1 causes need ChangeLog entries not listed in §8 | Seed gap | Seed CT Lost Feb 25, Energy TCV edit Feb 23; Feb 22 run records standards v1 | Proceeding |
| G-6 | DR-10 Bet "Done on those dates" when the date is in the future | Finish date undefined | Finish = Bet date in every case; seed values unaffected | Proceeding |
| G-7 | "Recent" = within 30 days | Boundary | ≤ 30 days | Proceeding |
| G-8 | DR-05 internal origin vs Direct source_type | Precedence | Asserted wins | Proceeding |
| G-9 | Part IV validations vs §4A no-TCV / data-error branches | UI cannot reach them | Engine keeps branches; synthetic tests | Proceeding |
| G-10 | Re-baselined test 22 drops the multi-soft-Link Intervention proof | Coverage gap | Add supplementary test 22b | Proceeding |
| G-11 | Test 48 as-of; DR-06 hash scope; edit timestamps | Unstated run details | As-of Mar 20; hash over sender+body; simulated clock + sequence | Proceeding |
