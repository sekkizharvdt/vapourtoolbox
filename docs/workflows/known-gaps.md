# Known Gaps & Problems — Consolidated List

> Extracted 2026-07-03 from the code-grounded [workflow documentation](README.md). Every item was verified against the code (file references inline). Ordered by priority. Check items off / delete rows as they are fixed, and update the corresponding module doc.

## Priority 0 — Blocking real, current work

### 0.1 Proposal acceptance → project conversion is unreachable from the UI

**Status: ✅ FIXED 2026-07-03 (working tree, ships on next Deploy dispatch).** New `recordProposalOutcome()` in `approvalWorkflow.ts` (permission-checked, state-machine validated, audit-logged, syncs enquiry ACCEPTED→WON / REJECTED→LOST) plus proposal detail-page actions: **Mark as Awarded** header button and Mark Under Negotiation / Lost / Expired menu items for SUBMITTED/UNDER_NEGOTIATION proposals. Also fixed a latent rule-12 bug (`statusChangeReason: undefined` write in `updateProposalStatus`). Remaining from the original chain: the enquiry-side "Mark as Won/Lost" still does not transition the linked proposal (proposal-side is now the canonical entry point).

Originally blocking an actual awarded project — PO26XP062901, "Baseline MEP Survey — Narippaiyur Solar-MED Plant Restoration & Upgrade" for Desolenator B.V. (signed agreement at `docs/inputs/PO26XP062901 Signed Consultancy Agreement - Baseline MEP Survey (Vapour Desal).pdf`), which needs to be converted from its quoted proposal into a project.

The (formerly) broken chain:

1. `updateProposalStatus` (`apps/web/src/lib/proposals/approvalWorkflow.ts`) is the only path for `SUBMITTED → UNDER_NEGOTIATION / ACCEPTED / REJECTED / EXPIRED`, and no UI called it. _(Fixed — see above.)_
2. **Convert to Project** requires `status === 'ACCEPTED'` (`projectConversion.ts:265`), so the button never appeared through the standard flow. _(Unblocked by 1.)_
3. Enquiry **Mark as Won / Lost** (`EnquiryDetailClient.tsx:246` → `updateEnquiryStatus`) updates only the enquiry — it does not transition the linked proposal. _(Still open, mitigated: proposal-side outcome now syncs enquiry.)_

**Next step — verify `convertProposalToProject` end-to-end with the real case.** Acceptance checklist from the signed agreement:

- Client: Desolenator B.V. (entity must exist with CUSTOMER role).
- **USD-denominated proposal** (lump sum USD 7,958) — client pricing currency/fxRate must survive conversion; project `budget.estimated` comes from `computeCommercialSummary().targetRevenueInr`, so confirm the INR target is right for a USD quote.
- 3 payment milestones (20% / 50% / 30%) → `deliveryPeriod.milestones` → payment terms.
- Deliverables (daily reports, equipment register, instrument schedule, cable & wiring register, photo record, baseline survey report, exit briefing) → charter deliverables / document requirements.
- 2-week duration incl. 5 days on-site → project dates from `durationInWeeks`.
- Related gaps 0.2 and 2.x below should be considered in the same design pass since conversion exercises them.

### 0.2 Charter approval: no submit step, no self-approval prevention, duplicate cost centres

Immediately downstream of 0.1 — the first thing the new project hits.

- Charter goes straight DRAFT → APPROVED by any `MANAGE_PROJECTS` user, including its author; `PENDING_APPROVAL` is defined but never written (`CharterTab.tsx:110-188`). Every other approval flow in the app has `preventSelfApproval`; this one doesn't.
- `onProjectCreated` (`functions/src/projects.ts:19`) creates a cost centre at project creation **and** `CharterTab.proceedWithApproval` (`CharterTab.tsx:159`) calls `createProjectCostCentre` again on charter approval — potential duplicate.

---

## Priority 1 — Broken user-facing workflows (coded but unwired / wrong)

| #   | Module      | Problem                                                                                                                                                                                  | Impact                                                                              | Where                                                          |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1.1 | Accounting  | **Payment batch execution unwired** — no `executeBatch` function; "Execute Payments" button has no `onClick`; `EXECUTING`/`COMPLETED` unreachable; interproject-loan posting never fires | Batches can be approved but never do anything                                       | `PaymentBatchDetailClient.tsx:466-475`                         |
| 1.2 | Accounting  | **Bank Transfer & Expense Claim have no create UI** — types fully exist (numbering, labels, reports)                                                                                     | Two of the nine transaction types unusable                                          | `transactions/page.tsx` (filter label only)                    |
| 1.3 | Accounting  | **Fiscal period close/lock/reopen has no UI**; year-end helpers (`calculateYearEndBalances`, `finalClose`, `createAdjustmentPeriod`) are stubs that throw                                | Periods can never actually be closed; year-end close impossible                     | `fiscal-years/page.tsx`, `fiscalYearService.ts:426-451`        |
| 1.4 | HR          | **On-duty email trigger listens on the wrong collection** — `onDutyRecords` vs actual `hrOnDutyRequests`                                                                                 | On-duty approval emails silently never fire                                         | `functions/src/email/triggers.ts` vs `onDutyRequestService.ts` |
| 1.5 | Documents   | **Server-side `generateTransmittal` reads a stale schema** — expects `submissions` subcollection + `documentFileUrl`; data lives in `documentSubmissions` with `files[]`                 | Server ZIP is cover-sheet-only; only the client-side generation path works          | `functions/src/transmittals.ts` (`gatherDocumentFiles`)        |
| 1.6 | Procurement | **WCC notification deep-link 404s** — links `/procurement/work-completions/{id}`; route is `work-completion` (singular)                                                                  | "Ready for billing" task dead-ends                                                  | `workCompletionService.ts`                                     |
| 1.7 | Estimation  | **BOM → purchase request handoff does not exist** (no service, button, or trigger), and BOM statuses beyond DRAFT are unused (no submit/approve UI)                                      | BOMs are cost sheets only; the PR path is exclusively via charter procurement items | `lib/bom/**`, `app/estimation/**`                              |
| 1.8 | Accounting  | **Invoice "Send Invoice" action is an empty handler**; no explicit POSTED step for invoices/bills                                                                                        | Approved invoices have a dead button                                                | `invoices/page.tsx:614`                                        |

---

## Priority 2 — Financial / data-integrity risks

| #   | Module         | Problem                                                                                                                                                                                                                                          | Impact                                                                                 | Where                                                                                                                                                          |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Accounting     | **DRAFT transactions move GL balances** — `onTransactionWrite` applies entries regardless of status (dialogs attach GL entries at creation)                                                                                                      | Chart-of-accounts balances include unapproved drafts; only hard-delete reverses        | `functions/src/accountBalances.ts:146`                                                                                                                         |
| 2.2 | Accounting     | **Fixed-asset disposal / write-off posts no GL journal** (status changes only; "TODO Phase 2")                                                                                                                                                   | Books diverge from asset register on disposal                                          | `fixedAssetService.ts:353,389`                                                                                                                                 |
| 2.3 | Procurement    | **Accounting handoffs are best-effort** — advance payment (PO approval), bill (GR completion), payment (GR payment approval), bill (3-way match) all swallow errors                                                                              | A silent failure leaves an approved PO / completed GR with no downstream financial doc | `purchaseOrder/workflow.ts`, `goodsReceiptService.ts`, `threeWayMatch/workflow.ts`                                                                             |
| 2.4 | Sales/Projects | **Race-prone numbering** — enquiry/proposal "last+1" (not transactional); project & PR numbers timestamp-based (explicit TODOs); also TWM (`Date.now()`), bought-out `BO-` (query-max), service `SVC-` (count-based, collides after soft-delete) | Duplicate document numbers under concurrency                                           | `enquiryService.ts:50`, `proposalService.ts:96`, `projectConversion.ts:246`, `charterApproval.ts:43`, `matching.ts`, `boughtOutService.ts`, `services/crud.ts` |
| 2.5 | Entities       | **GSTIN denormalization sync reads the wrong field** — trigger reads top-level `gstin`; data is stored at `taxIdentifiers.gstin`                                                                                                                 | GSTIN edits never propagate to POs                                                     | `functions/src/denormalizationSync.ts` vs `createEntity.ts:116`                                                                                                |
| 2.6 | Admin          | **`PERMISSION_FLAGS` hand-duplicated in the claims Cloud Function** with a "keep in sync" TODO                                                                                                                                                   | New/changed flags can silently diverge between client and claims                       | `functions/src/userManagement.ts`                                                                                                                              |
| 2.7 | Accounting     | **Payment batch creation uses a hardcoded placeholder bank account** (`'primary-bank'`)                                                                                                                                                          | Wrong fund source recorded                                                             | `PaymentBatchDetailClient.tsx:183-185`                                                                                                                         |
| 2.8 | HR             | **Comp-off lifecycle incomplete** — no scheduled expiry/warning job (grants carry 1-yr expiry; `findExpiringCompOffs` unused); cancelling an approved on-duty doesn't revoke the granted comp-off; annual reset omits COMP_OFF balances          | Comp-off balances drift upward                                                         | `compOffService.ts`, `onDutyApprovalService.ts:681`, `functions/src/hr/leaveBalanceReset.ts`                                                                   |

---

## Priority 3 — Authorization / audit hygiene

| #   | Module         | Problem                                                                                                                                           | Where                              |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 3.1 | Admin          | Entire `/admin/*` tree gated only on `MANAGE_USERS`; declared `MANAGE_ADMIN` flag never checked                                                   | `admin/layout.tsx:~75`             |
| 3.2 | Admin          | `ApproveUserDialog` omits `updatedBy` → user-approval audit rows attributed to `system` instead of the approving admin                            | `ApproveUserDialog.tsx:~153`       |
| 3.3 | Sales/Projects | `markProposalAsSubmitted` helper bypassed — Preview page writes `status:'SUBMITTED'` directly                                                     | `PreviewClient.tsx:171`            |
| 3.4 | Sales/Projects | Charter-approval PR auto-draft attributes approver as `'System'` (name lookup TODO)                                                               | `charterApproval.ts:219`           |
| 3.5 | HR             | Employee-edit permission check only enforced when caller passes `userPermissions2` (optional param)                                               | `employeeService.ts:159,242`       |
| 3.6 | SSOT           | `validateSSOTWriteAccess` checks (MANAGE_SSOT + project assignment) skipped — tabs never build `accessCheck`; enforcement is Firestore rules only | `ssotAuth.ts`, `ssot/components/*` |
| 3.7 | Entities       | Entity edits/archive are direct client Firestore writes (only create goes through the permission-checked callable)                                | `EditEntityDialog.tsx:416`         |
| 3.8 | Cross-cutting  | Soft-delete is app-wide but Trash/restore UIs exist only for accounting & procurement; only accounting can purge                                  | various                            |

---

## Priority 4 — Minor / polish

| #    | Module         | Problem                                                                                                                                                                                        | Where                                              |
| ---- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 4.1  | Procurement    | Amendment can't be recalled — `PENDING_APPROVAL` only → APPROVED/REJECTED (terminal); mis-addressed amendments must be rejected and re-raised                                                  | `stateMachines.ts` (amendment)                     |
| 4.2  | Procurement    | GR `PENDING` state dead — creation writes directly at `IN_PROGRESS`                                                                                                                            | `goodsReceiptService.ts`                           |
| 4.3  | Procurement    | RFQ "issue to vendors" is a status stamp only — PDF + vendor email are `// Future` comments                                                                                                    | `rfq/workflow.ts`                                  |
| 4.4  | Sales/Projects | Budget 90%/100% threshold alerts logged only; task notifications TODO                                                                                                                          | `projectFinancials.ts:162`                         |
| 4.5  | Entities       | Role filter offers `SUPPLIER` but Create dialog only allows VENDOR/CUSTOMER/PARTNER — filter can never match; duplicate-_name_ precheck is server-only (client checks email/PAN/GSTIN)         | `entities/page.tsx:342`, `CreateEntityDialog.tsx`  |
| 4.6  | SSOT           | Excel export is a "coming soon" toast; tag-string references have no cascade/integrity checks (deleting a stream leaves dangling `inputDataTag`/`fluidIn` refs)                                | `ssot/page.tsx:117`, services                      |
| 4.7  | Thermal        | Save/Load uneven — `desuperheating`, `tvc`, `vacuum-breaker`, `heat-transfer`, `med-plant` have types but no wired dialogs; `gor`/`heat-transfer`/`heat-duty` routes missing from the hub grid | `thermal/calculators/**`                           |
| 4.8  | Documents      | `transmittalZipService` handles a single file per document (TODO: native+PDF pairs); submission numbers are `max+1` (not counter-backed)                                                       | `transmittalZipService.ts`, `submissionService.ts` |
| 4.9  | Admin          | `agentTasks` expiry sweep lacks a `(status, expiresAt)` composite index — filters client-side (acceptable at current volume, noted in code)                                                    | `agentTaskExpiry.ts`                               |
| 4.10 | Flow/Docs      | No email triggers for Flow (tasks/threads/mentions/meetings) — in-app only (may be by design)                                                                                                  | `functions/src/email/triggers.ts`                  |

---

## Notes

- One suspected problem turned out to be **already fixed**: the PO amendment approver assignment (flagged in the round-3 procurement review) is now wired — approver selected at submit, persisted, enforced via `requireApprover`, self-approval blocked. Only the recall limitation (4.1) remains.
- Items 2.4's PR-numbering and 0.2's charter behaviour both sit on the conversion path, so the Priority-0 design pass should decide whether to fix them together or defer.
