# Implementation decisions

Business readings confirmed by Liran on 16 Nov 2026 (in reply to the readiness note), then technical choices. Each entry says what was decided and why. Business semantics come only from the three source documents and the decisions recorded here.

## A. Business readings confirmed by Liran

Liran approved C-1, C-2, C-3 and C-5 in principle and asked for judgement where a different choice serves the product better, with the logic explained afterwards. G-1 was decided by Liran. G-2 to G-4 were left to me.

### C-1. A same-day planning-standard change is recorded through a Submission

**Decision.** Test 45 submits after RevOps approves Procurement v2. The Submission's run is the "new run" that records v2 and its values. Changing a standard does not by itself store a run.

**Why.** DR-16 keeps runs to one automatic run per as-of date plus one per Submission. Test 44 depends on that rule, and it keeps the run history readable. A standard change still shows immediately: the live view and the movement bridge name "planning standard changed" as the cause. The run that froze the old values stays untouched, so the before and after can both be replayed.

### C-2. The bridge baseline is a choice; Home defaults to last week

**Decision.** By default, Home compares the live view with the latest stored run whose as-of date is at least 7 days earlier (Feb 22 for Mar 1, which test 1 needs). Any stored run can be picked as the baseline, including today's automatic run. Test 45 picks the Mar 1 run, which gives Slipped −$2.5M with the single cause "planning standard changed".

**Why.** The default answers the weekly question in PRD §5 ("what changed since last week"). Picking today's run answers "what did this one change just do", which is what RevOps needs right after approving a new standard. The baseline in use is always named above the bridge, so the two never get mixed up.

### C-3. Archived deals leave the forecast and land in "Removed"

**Decision.** An archived Opportunity is not evaluated and does not appear in new runs. It is not given the "Excluded" status. The bridge's "Removed" line matches a deal that was in Core in the earlier run and is archived now. Archived deals stay visible in the CRM with an Archived badge, and stored runs that included them are unchanged.

**Why.** Archiving means "this record should not be here", for example a duplicate or test record. That is different from a deal that lost or signed in another quarter. Treating it as Excluded would push it into "Other exclusion", and the "Removed" line DR-14 created could never be reached.

### C-5. "Add a duration sample" in tests 11 and 43 now means changing a standard

**Decision.** In tests 11 and 43, the step becomes: RevOps approves a new planning-standard version, and an observed calibration span is added. Expected result: the submitted run still shows the planning-standard versions and values it used.

**Why.** DR-01 removed duration samples. These are the two inputs that replaced them, and both must leave a stored run untouched.

### G-1. The VP Sales may reject Evidence that is already confirmed or approved (Liran's decision)

**Decision.** Rejecting an Evidence record whose status is already *confirmed* (reversing claim) or *approved* (advancing claim) is reserved for the **VP Sales**. In the app, the VP Sales is the CRO role, labelled "CRO / VP Sales" in the role switcher. A reason is required. The rejection is listed in the RevOps review log, and the movement bridge names it as the cause ("Evidence rejected"). Rights over *provisional* and *waiting* Evidence stay exactly as DR-04 sets them.

**Why, and what it means in practice.** Once a manager or RevOps has confirmed a record, overturning it is a second-level decision, so it goes to the most senior sales role. The control is visibility: every reversal carries the VP Sales's name and reason, appears in the RevOps log, and shows in the bridge.

**One consequence to be aware of.** Rejecting confirmed *bad* news raises the forecast. Test 9 is an example: rejecting National Bank's confirmed block lifts Stretch to $15.5M. DR-04's principle is that "the person who benefits must not decide". The VP Sales owns the number, so this is a deliberate exception, made visible rather than prevented. If you would rather RevOps co-sign these, that is a one-line change.

Test 9 runs as the VP Sales. Tests 11 and 43 reject provisional or waiting Evidence, so they keep DR-04 actors.

### G-2. Planning-standard lookup order

**Decision.** For a Condition on a deal, the engine uses the first row in force on the as-of date, in this order:
(deal_type, segment) → ("all", segment) → (deal_type, no segment) → ("all", no segment).
If no row matches, the Condition has no estimate ("no planning standard", DR-08). Among rows of the same specificity, the highest version in force wins.

**Why.** DR-01 already ranks segment above "no segment" within a deal type. Segment describes the customer's own process; a bank's security committee is the reason the Banks row exists. A segment-specific row for all deal types should therefore beat a generic row for one deal type. An exact deal type beats "all" at the same segment level. No seed value depends on this today. The Deal screen shows which row was used.

### G-3. Opportunities get a created date

**Decision.** `Opportunity.createdAt` (date-only) is set at creation and never edited. The land or expand variant and the template version are derived from it once, at creation, and then frozen (DR-07). The seed sets creation dates before each deal's first Event. Savings Bank is the exception: it was created Feb 23 with earlier emails attached, because PRD §8 says it did not exist in the Feb 22 run.

**Why.** DR-07 depends on "when this one is created". Without the date the variant cannot be derived or explained.

### G-4. Timing bias covers deals signed in the quarter, as a simple mean in days

**Decision.** Timing bias = the average of (signed date − standard-pace planned date at the run), over deals that signed inside the quarter (by the DR-12 cutoff) and had a planned date at the run. It is not weighted by TCV. The count of deals is shown beside it. BT-1 gives (+5 − 10) / 2 = −2.5 days, which matches test 60.

**Why.** Timing bias asks whether the planning standards run fast or slow. Size does not change how long legal takes, so weighting by TCV would let one big deal hide the pattern. Deals that sign after the quarter are already scored by "signing rate" and "Late". They are counted in the next quarter's backtest, so they are not counted twice.

### Readings applied without further review (G-5 to G-11, see readiness note §4)

- **G-5.** Seed ChangeLog: Energy Group TCV $3.0M → $2.5M on Feb 23 and City Transit → Lost on Feb 25, both by Manager B. The Feb 22 run is a stored fixture recording planning standards v1.
- **G-6.** In Bet validation, a Bet Condition is treated as Done on its Bet date, so its finish is that date in every timing case.
- **G-7.** "Recent" engagement means within 30 days, inclusive.
- **G-8.** Internal origin always grades Asserted, whatever the source type.
- **G-9.** The engine keeps the "no TCV" and "data error" branches even though CRM validation blocks them; synthetic tests cover them.
- **G-10.** Supplementary test 22b proves that one Intervention lifts several soft Links on a Committed deal.
- **G-11.** Test 48 uses as-of Mar 20. Content hash = sender + normalised body. Every log entry and decision is stamped with the simulated date (the as-of date) plus a sequence number; nothing reads the system clock.

## B. Technical decisions [RECOMMENDATION-level]

| # | Decision | Reason |
|---|---|---|
| T-1 | Next.js 15.5 (App Router), React 19.1, TypeScript 5.9 strict with `noUncheckedIndexedAccess` | Current stable line that Vercel Hobby builds with default settings. Next 16 is newer but not needed. |
| T-2 | npm `overrides` pins `postcss` 8.5.33 | Next 15.5 bundles an older postcss with published advisories. The override clears `npm audit` (0 vulnerabilities) with no behaviour change. |
| T-3 | Vitest 5 + fast-check for unit, integration and property tests; `fake-indexeddb` runs the IndexedDB store in Node | One runner. The same contract suite runs against both stores. |
| T-4 | Browser smoke test is a plain Playwright-library script (`tests/e2e/smoke.mjs`), not `@playwright/test` | Uses whatever Chromium is installed without version pinning. The full e2e suite is Phase 11. |
| T-5 | Storage behind `DataStore` / `Repositories` ports: mutable collections (`get`, `list`, `put`) and append-only collections (`get`, `list`, `append`). IndexedDB via `idb`, one object store per collection, schema version 1 | Append-only is enforced twice: the type has no update or delete method, and `append` uses IndexedDB `add`, which refuses an existing key. |
| T-6 | Reset is the only path that clears append-only collections | Required by the "one-click reset" demo control. It restores the seed exactly, as the hash test proves. |
| T-7 | Seed authored as typed TypeScript (`src/seed/canonical.ts`) and bundled; `.eml` fixtures as files with a stored-extraction table keyed by Message-ID | The compiler and tests check every record and quote. The result is bundled just like JSON would be. |
| T-8 | Condition state, Evidence status and grade are never stored. Evidence status is replayed from the append-only EvidenceDecision log | PRD §7 and Part V: never trust a stored status field. |
| T-9 | Opportunity and Account owner are display names (`ownerName`), not users | Part IV's User roles are Sales Manager, RevOps and CRO. Reps have no forecasting task (PRD §2), so they are not users. |
| T-10 | Domain purity enforced by ESLint (no UI, storage, platform imports; no `Date`, `fetch`, `process`, `Math.random`) and by a test | Part V non-negotiable engine properties. |
| T-11 | Dates are `YYYY-MM-DD` strings with pure calendar arithmetic (no `Date` object); money is integer cents | Part V. Avoids time-zone drift; the quarter's reporting time zone is stored for display. |
| T-12 | The role switcher stores the acting user in the browser store; the CRO is labelled "CRO / VP Sales" | DR-16 single-presenter demo; G-1. |

## C. Phase 2 CRM decisions

| # | Decision | Reason |
|---|---|---|
| P2-1 | Archiving an Opportunity needs the same right as editing its status: the deal's Sales Manager or RevOps. A reason is required. | Archiving removes the deal from the forecast (C-3), so it carries the same weight as a status change. DR-04 lists no archive right of its own. |
| P2-2 | Fields outside DR-04's list (name, owner, CRM close date, CRM stage) can be edited by any role. | Part IV puts permissions beyond DR-04 out of scope. The engine never reads these fields. |
| P2-3 | Every CRM edit is logged field by field with author, simulated date and an optional note, including creation and archive. Only TCV, status, signed date, manager and archive count as bridge causes. | DR-13 says every edit is logged. Restricting bridge causes keeps the bridge focused on what can move the number. |
| P2-4 | Changing status away from Won clears the signed date; changing away from Lost or Disqualified clears the reason. | A stale signed date on a non-Won deal would be read as a data error. |
| P2-5 | An Account's email domains must be valid and unique across Accounts. They are stored lower-case, without a leading "@". | DR-05 derives an email's origin from the sender's domain. A domain shared by two Accounts would make that derivation ambiguous. |
| P2-6 | Only RevOps can archive an Account, and only when it has no open opportunities. | Archiving an Account hides it from pick lists. Doing that while it has open deals would orphan them. |
| P2-7 | Deal type and template variant cannot be edited after creation. | DR-07 fixes the variant at creation. Changing the deal type would change the template. |
