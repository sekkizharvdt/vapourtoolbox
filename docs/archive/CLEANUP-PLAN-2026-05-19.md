# Cleanup & Consolidation Plan — 2026-05-19

Derived from the over-engineering review on 2026-05-19. Goal: a tighter, easier-to-use app for the 10-person team. Phased to minimize risk and ship value early.

Phases are ordered by **value per hour of work**, not by topic. Phase 0 is the smallest reversible wins; later phases require schema or data changes.

---

## Phase 0 — Dead code strip ✅ DONE 2026-05-19 (scope shrank after verification)

- [x] Deleted [`purchaseRequestHelpers.ts`](apps/web/src/lib/procurement/) + its test — 450 LOC source (1325 lines incl. test), zero source importers (the PR UI duplicated the logic inline). Commit `a0757043`. tsc + lint clean.

**The rest of the "dead defensive code" was a false alarm — verified before touching, most is load-bearing or already gone. DO NOT re-attempt these:**

| Flagged site                                                         | Verified verdict                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditEntityDialog` `contactPerson/email/phone` fallback + dual-write | **Load-bearing.** The single-contact fields are read by PO PDFs ([`POPDFDocument.tsx:275`](apps/web/src/components/pdf/POPDFDocument.tsx#L275)), RFQ PDFs, `EntitySelector`, `ViewEntityDialog`, and entity search ([`businessEntityService.ts:366`](apps/web/src/lib/entities/businessEntityService.ts#L366)). The dual-write keeps them in sync with `contacts[]`. 1 entity (Grundfos) still has only the old fields. Removing this breaks PDFs + search. |
| `materials/queries.ts` `isMigrated === true` filter                  | **Load-bearing.** 3 materials carry `isMigrated=true` in Firestore — the migration DID run. Removing the filter resurfaces 3 stale parent docs.                                                                                                                                                                                                                                                                                                             |
| `projectConversion.ts` budget fallback                               | **Already removed** by the recent proposals commits (now uses `computeCommercialSummary`).                                                                                                                                                                                                                                                                                                                                                                  |
| `migratedFromCollection`                                             | **Already gone** from code.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `revisionManagement.ts` `terms` compare                              | Active development (recent proposals work) — risky, left alone.                                                                                                                                                                                                                                                                                                                                                                                             |
| `rfqPdfService.ts` `pdfVersion \|\| 0`                               | Harmless 1-line guard — not worth the risk.                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Lesson:** the audit's "~70–80 LOC of dead defensive code" estimate was wrong. Verification against Firestore + grep for readers prevented two regressions. Always verify before stripping (rule 31 + "check data before migration code").

**Exit criterion met:** 450 LOC removed, CI green, no behavior change.

---

## Phase 1 — Turn on the recurring transactions engine ✅ DONE 2026-05-19

The module is built and shipped. Engine is disconnected: all 5 existing templates show `totalOccurrences = 0` and `lastGeneratedAt = undefined`. One Cloud Function lights it up.

- [x] Added `scheduledRecurringGeneration` (`onSchedule('30 0 * * *')` = daily 06:00 IST) and `manualRecurringGeneration` (`onCall`, gated on `MANAGE_ACCOUNTING`) in [`functions/src/recurringTransactions/generateOccurrences.ts`](functions/src/recurringTransactions/generateOccurrences.ts). Commit `13d9b567`.
- [x] Added **Generate now** button on [`/accounting/recurring/upcoming`](apps/web/src/app/accounting/recurring/upcoming/page.tsx) (visible to manage-accounting users, surfaces success/error in an inline alert).
- [x] Deployed via CI (`.github/workflows/deploy.yml` triggers on `functions/` changes).
- [x] Fixed the **New** form's End Date picker to enforce `minDate=startDate`, become clearable, and explain "blank = run indefinitely" (commit `de3dbbea`).

**Exit criterion met:** All 5 templates ACTIVE with `nextOccurrence = 2026-06-01`. Manual trigger correctly reports "No occurrences due" until the May 30 generate window opens.

### What we learned (record for future-you)

**Trap discovered on first deploy:** Every existing template had a bogus `endDate` (start ± a few days; one was a month _before_ startDate). The form had no `minDate` constraint on the End Date picker and no validation; the user had clicked the picker accidentally and saved nearby dates. My catch-up loop correctly detected `scheduledDate > endDate` and marked all 5 templates COMPLETED after producing 0–1 occurrences each.

**Recovery script** (one-shot, lived at `/tmp/cleanup-recurring.js`, not committed) restored: `status='ACTIVE'`, deleted `endDate`, reset `nextOccurrence` to 2026-06-01, deleted 3 backdated PENDING occurrences. If this happens again on any future template, the same pattern works.

**Form fix is in place** so the trap can't recur on newly-created templates. The pre-existing 5 docs were the only ones with the bad data.

### Catch-up loop notes for future debugging

The Cloud Function has a `MAX_CATCHUP = 24` per template per run. With `daysBeforeToGenerate = 2` on these templates, the generate window for a monthly template opens 2 days before the scheduled date. A template that's been paused for >24 months would only catch up the most recent 24 occurrences and log a warning.

The scheduler is `maxInstances: 1` on both the scheduled and manual functions — concurrent runs cannot race the `nextOccurrence` advance.

---

## Phase 2 — Shadow collection cleanup ✅ DONE 2026-05-19

Rule 32 violations in production data. Both pairs cleaned; parsing jobs deferred. Commit `82d65189`.

### 2a. `boughtOutItems` → `bought_out_items` ✅

- [x] Confirmed schema identical. The 1 camelCase orphan (a CAIR control valve, created by "AI Quote Parser") was unique — no dup in snake_case.
- [x] Migrated the orphan into `bought_out_items` (now 62 docs), deleted the source. Verified canonical collection is `bought_out_items` (`BOUGHT_OUT_COLLECTION` constant, all app + function code).
- [x] Dropped 2 stale `boughtOutItems` composite indexes from `firestore.indexes.json`.
- [x] Removed the dead entry from `scripts/check-tenant-id-safety.js`. (No `firestore.rules` block existed for the camelCase name.)
- [x] `boughtOutItems` collection now empty.

### 2b. `exchangeRates` + `exchange_rates` — DELETED, not merged ✅

**Key decision (record this):** Vapour does NOT track FX rates as a lookup table. The exchange rate is derived per-transaction — a USD invoice is settled by an INR bank receipt, and that day's rate falls out of the two amounts. The bank-conversion rate is entered directly on `RecordCustomerPaymentDialog` / `CreateInvoiceDialog`. **No code anywhere reads either rate collection.** So this was a delete, not a merge.

- [x] Deleted both collections (`exchangeRates` 10 manual docs, `exchange_rates` 10 RBI-cron docs).
- [x] Deleted `functions/src/currency.ts` (the daily RBI `fetchDailyExchangeRates` cron + the `manualFetchExchangeRates` callable) and removed both exports from `functions/src/index.ts`.
- [x] Removed the unused `EXCHANGE_RATES` constant, 2 indexes, the `firestore.rules` block, the backup-list entry, the safety-check entries, the one-shot `scripts/migrate-exchange-rates.js`, and the deprecated `packages/functions/src/currency.ts.deprecated`.
- [x] ~920 LOC removed. Side-effect: the daily RBI HTTP fetch stops.

### 2c. Parsing jobs — DEFERRED (unchanged)

`OFFER_PARSING_JOBS` (24) + `PARSING_JOBS` (36) + `receiptParsingJobs` (27) + `enquiryParsingJobs` (2). Append-only job logs, harmless. Next parsing flow built goes into one `parsingJobs` collection with a `jobType` discriminator; old ones phase out. Consider TTL after 90 days.

**Exit criterion met:** One canonical collection per concept. `bought_out_items` is the only bought-out collection; no FX rate collections remain.

### Deploy — DONE 2026-05-20, but required a forced full deploy

`fetchDailyExchangeRates` + `manualFetchExchangeRates` were **deleted from production** (confirmed in the Deploy Cloud Functions log: "Successful delete operation"). The RBI cron is gone; `exchange_rates` will not be recreated.

**⚠️ Gotcha for next time:** the normal change-detection deploy did NOT prune them. Its `prod-deployed` tag diff window started at a commit _after_ the removal (`82d65189`), so the detect step set `functions=false` and skipped the functions step — a fast (~1m30s) hosting-only deploy. The prune only happened after re-running the **"Deploy all targets (skip change detection)"** workflow_dispatch option, which forces every target and runs `firebase deploy --only functions --force`.

Lesson: when a cleanup commit _removes_ a function/index/rule, don't trust the incremental deploy to prune it — trigger a forced full deploy. The `--force` flags (functions line 192, indexes line 180) only prune when their step actually runs.

---

## Phase 3 — Employees ↔ Users unification ✅ ALREADY DONE (verified 2026-05-19)

**No work required — this was a false alarm in the original audit.** The audit flagged "`/hr/employees` reads `users`, no `employees` collection" as a problem to fix. On inspection, reading `users` IS the unified architecture, and it's already fully built:

- HR data lives in `User.hrProfile` ([`packages/types/src/hr/employee.ts:78`](packages/types/src/hr/employee.ts#L78) — `HRProfile` interface). The `User` type carries `hrProfile?`, `jobTitle`, `department`, `assignedProjects`.
- [`employeeService.ts`](apps/web/src/lib/hr/employees/employeeService.ts) reads `COLLECTIONS.USERS` and maps `User` → `EmployeeListItem` / `EmployeeDetail`. No separate `employees` collection exists or is referenced anywhere in code.
- Edits write `hrProfile` back to the user doc via `updateEmployeeHRProfile`, gated on `MANAGE_HR_PROFILES` (PERMISSION_FLAGS_2), with audit logging.
- `hrLeaveBalances` / `hrLeaveRequests` already key by `userId`.

Every field the plan wanted already exists: `employeeId`, `dateOfJoining`, `jobTitle` (designation), `reportingManagerId` (+name), `panNumber`, `aadhaarNumber`, `bankDetails` — plus employmentType, gender, blood group, addresses, emergency contacts, PF/UAN/ESIC, identity documents.

**Exit criterion already met.** `/hr/employees` is a view of `users`; edits write back to `users`; `/admin/users` manages auth/permissions on the same docs.

**One real gap, deferred to Phase 4:** `HRProfile` has no `currentSalary` / compensation field. Phase 4's salary fan-out (one occurrence per employee using their salary) needs it. Add it there, not here.

---

## Phase 4 — Recurring transactions expansion (2–3 days, medium risk)

Add the missing template types, schema fields, and the 12 real recurring patterns from the ledger. Do **not** start this before Phase 1 — the scheduler must be working so you can validate each new template.

### 4a. Schema + code changes ✅ DONE 2026-05-20 (commit `a28583a4`)

- [x] `RecurringTransactionType` now includes `VENDOR_PAYMENT` + `DIRECT_PAYMENT`.
- [x] Template + input gained optional `projectId`/`projectName`/`costCentreId`/`costCentreName` (denormalized names, rule 26).
- [x] Service writes the allocation fields; summary counts the new types and treats both payment types as outflow (JOURNAL_ENTRY stays excluded — it's an accounting entry, not a cash flow). Admin-side generator needed no change (type is a passthrough).
- [x] Form: new type options, vendor required for VENDOR_PAYMENT, optional payee for DIRECT_PAYMENT, plus a Cost Allocation section (project + cost centre) for any type.
- [x] List + upcoming pages: labels, chip colors, outflow sign, filter tabs.
- [x] tsc (web + types + functions) clean, lint clean, 26 recurring tests pass.
- [~] `linkedBillTemplateId` — **skipped** (rule 31: no consumer yet; it only matters for the deferred bill→payment auto-derivation in 4d).

### 4b. SALARY type — KEPT (decision made 2026-05-20)

Chose to **keep `SALARY`** rather than drop it. Reasoning: it's a working type with a live template ("Salary Feb 2026"), and removing it would be destructive and require migrating that record. Adding the two payment types is strictly additive and reversible — the user can restructure to per-employee templates later if they want. The auto-fan-out + `HRProfile.currentSalary` field (Phase 3 noted the gap) are deferred with 4d since nothing consumes them yet.

### 4c. Create 12 templates for ledger patterns — USER DATA ENTRY (not code)

The code is shipped; these are now enterable via the enhanced form. Left to the user because amounts (some variable), GL accounts, day-of-month, and project tags need real judgment — scripting them with guessed values would just create records the user has to audit. Enter via `/accounting/recurring/new`, one per line:

| Template                              | Type           | Amount        | Cadence                     | Notes                                                                     |
| ------------------------------------- | -------------- | ------------- | --------------------------- | ------------------------------------------------------------------------- |
| Salary provision — Revathi            | JOURNAL_ENTRY  | 53,000        | Monthly, 1st                | 0% variance                                                               |
| Salary provision — Mecanroe           | JOURNAL_ENTRY  | 75,000        | Monthly, 1st                | 0% variance                                                               |
| Salary provision — Raaja              | JOURNAL_ENTRY  | 55,109        | Monthly, 1st                |                                                                           |
| Salary provision — Mohamed            | JOURNAL_ENTRY  | 26,136        | Monthly, 1st                |                                                                           |
| Salary provision — Prasanna           | JOURNAL_ENTRY  | 144,654       | Monthly, 1st                | Variable comp — modify per occurrence                                     |
| Salary provision — Kumaran            | JOURNAL_ENTRY  | 56,000        | Monthly, 1st                |                                                                           |
| Salary payment — each of above        | DIRECT_PAYMENT | matches above | Monthly, month-end          | Link to corresponding provision via `linkedBillTemplateId` if implemented |
| Rent — Max Office payment             | VENDOR_PAYMENT | 46,771        | Monthly, ~10th              | Link to existing Rent bill template                                       |
| TDS monthly remittance                | JOURNAL_ENTRY  | 34,090        | Monthly, statutory due date |                                                                           |
| V Subramanyam — Aquatherm SG retainer | VENDOR_PAYMENT | 157,500       | Monthly                     | Tag `projectId` = Aquatherm Singapore                                     |
| TUV India — inspection                | VENDOR_BILL    | 28,320        | Monthly                     | Variable amount, modify per occurrence                                    |
| Brio Technologies — Microsoft 365     | VENDOR_BILL    | 13,276        | Quarterly                   |                                                                           |

### 4d. Defer to a later sprint

These are nice-to-have, not blockers:

- Paired bill+payment occurrence generation (one click projects both cash legs).
- "Default to last occurrence's amount" mode for variable templates.
- Auto-posting (occurrence → actual `transaction` document). Today the occurrence is a reminder; the user still posts manually. Keep this manual until usage proves the demand.

**Exit criterion:** All 12 templates active, generating occurrences. The `/upcoming` view shows the next 30 days of expected entries. Manual transaction entry for these patterns drops to near-zero.

---

## Phase 5 — Fixed assets verification ✅ DONE 2026-05-19 (module was already complete; fixed one real bug)

**The audit's "orphan module, no rules, collection doesn't exist" was wrong again.** On inspection the module is fully built and wired:

- **Routes**: list ([`page.tsx`](apps/web/src/app/accounting/fixed-assets/page.tsx)), `[id]` detail, `depreciation` page, + Create/Edit/Dispose/WriteOff dialogs.
- **Rules** ✅ already present ([`firestore.rules:451`](firestore.rules#L451)): read=`VIEW_ACCOUNTING`, create/update=`MANAGE_ACCOUNTING`+tenant guard, delete=superadmin. (Uses the accounting flags, not dedicated `*_FIXED_ASSETS` flags — sensible, no new flag needed.)
- **Indexes** ✅ 3 composite indexes already present (`firestore.indexes.json`).
- **Nav** ✅ tile on the accounting landing page ([`accounting/page.tsx:160`](apps/web/src/app/accounting/page.tsx#L160)).
- **GL accounts** ✅ all 19 required codes exist in the Chart of Accounts — asset 1501–1509, accum-dep 1601–1609, dep-expense 5208. (Create throws a clear error if a code is missing, but none are.)
- **Tests** ✅ 41 passing (depreciation math + constants). GL posting balance verified by reading: debit dep-expense total = sum of accum-dep credits, rounded to paisa at each step.
- **Depreciation cadence**: already **manual** (user runs it from the depreciation page; no auto-cron). Matches the recommended option.

**The one real gap — fixed (commit `dd5d646c`):** `runDepreciation` had no idempotency guard. A double-click or second user would post a second `DEP-YYYY-MM` journal entry and double-depreciate every asset. Added a service-layer existence check (rule 9, rule 23) — refuses to post if a non-deleted `DEP-YYYY-MM` entry already exists; ignores voided ones so a voided month can be re-run.

**Remaining (manual, for the user — can't be done from here):**

- [ ] One live end-to-end smoke test in the app: create a dummy asset, confirm it saves + opens in detail, run one month of depreciation, confirm the `DEP-YYYY-MM` JE posts and GL balances move correctly, then try running the same month again and confirm it's now blocked.
- [ ] Announce to the team that asset entry is open.

**Exit criterion:** infra verified + idempotency bug fixed. Final sign-off is the live smoke test above.

---

## Phase 6 — Procurement chain dry run (when ready, not blocking)

You said you want to keep GR / Packing List / 3-way match / PO Amendments and have users run dummy POs through the full workflow. This is the right test.

- [ ] Pick one real upcoming small-value PO. Run it through the full chain: PR → RFQ → Offer → PO → GR → Packing List → 3-way match → VendorBill → VendorPayment.
- [ ] At each step, note: what felt redundant, what was missing, what failed. The data says the team currently jumps from PO straight to VendorBill (195 bills, 1 GR). The dry run will tell you why — UX friction, missing fields, or just habit.
- [ ] Based on findings, decide per module: keep, simplify, or remove. Don't make this call from theory.

---

## Out of scope for this plan

Listed for traceability — addressed in the prior review, deferred by decision or by being lower-impact than the above:

- HR approval workflows (leave, on-duty, travel) — keep as-is; small team makes single-approver-bypass tempting but not yet painful enough to refactor.
- Proposals heavy editor — freeze new features until proposals #2 and #3 exist.
- `BANK_TRANSFER` / `EXPENSE_CLAIM` unused transaction types — defer; consider deletion after 6 more months of zero use.
- Duplicate dialog/selector consolidation (VoidRecreate, SubmitForApproval, Material/Shape selectors, formatters) — useful but not blocking. Tackle opportunistically when touching those files.
- Parsing jobs unification — incremental, as new flows are built.

---

## Suggested sequencing

Three small PRs in week 1 unblock most of the value:

1. **Day 1:** Phase 0 (dead code) + Phase 1 (scheduler) — one PR each. Validates the pipeline and turns on the recurring engine.
2. **Day 2:** Phase 2 (shadow collections) + Phase 3 (employees/users) — one PR each.
3. **Week 2:** Phase 4 (recurring expansion) — needs schema + UI changes, give it a few days.
4. **Week 2 or 3:** Phase 5 (fixed assets) before announcing to the team.
5. **When ready:** Phase 6 (procurement dry run) — separate cadence, driven by an actual PO.
