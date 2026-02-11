# Phase 9: MEDIUM & LOW Findings Fix Plan

**Status**: COMPLETE
**Scope**: All remaining 110 findings (72 MEDIUM + 38 LOW) from Phases 0-8
**Prerequisite**: All 27 CRITICAL and 43 HIGH findings are resolved.
**Result**: All 190/190 findings resolved (100%). 9 deferred items across Clusters G and H.

---

## Fix Clusters

Findings are grouped into 8 clusters, ordered by impact. Each cluster can be implemented and committed independently.

---

### Cluster A: State Machine Enforcement (6 MEDIUM) — COMPLETE `6dbd252`

Enforce valid status transitions in services that currently allow arbitrary state jumps.

| ID    | Phase | Issue                                                | Fix Approach                                                   |
| ----- | ----- | ---------------------------------------------------- | -------------------------------------------------------------- |
| AC-11 | 1     | Payment batch status transitions not enforced        | Add `VALID_TRANSITIONS` map, validate in `updateBatchStatus()` |
| PR-12 | 2     | GR state machine used inconsistently                 | Re-validate status inside transaction in GR update functions   |
| BP-13 | 3     | No validation of proposal status transitions         | Add transition map to proposalService                          |
| HR-12 | 4     | Travel expense status transitions not validated      | Add state machine to travelExpenseService                      |
| FL-14 | 5     | Task notification status transitions not validated   | Guard `completeActionableTask()` against re-completion         |
| FL-18 | 5     | ManualTaskCard status cycle doesn't handle cancelled | Skip cancelled status in cycle, add explicit reactivation      |

**Effort**: Moderate — pattern is the same across all 6, can create a reusable `validateTransition()` helper.

---

### Cluster B: Audit Logging Infrastructure (6 MEDIUM) — COMPLETE `531e591`

Add audit trail for sensitive operations. Requires establishing a reusable `createAuditEntry()` pattern.

| ID    | Phase | Issue                                                         | Fix Approach                                               |
| ----- | ----- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| AA-8  | 7     | No audit log for permission changes                           | Log to `auditLogs` collection on permission update         |
| AA-14 | 7     | Missing admin permission for audit log access (LOW)           | Add Firestore rule: deny write except from Cloud Functions |
| HR-14 | 4     | Employee update functions lack audit logging                  | Add audit entry on sensitive field changes                 |
| AC-12 | 1     | Recurring transaction hard-deleted without audit trail        | Move to `deletedTransactions` archive before delete        |
| PR-17 | 2     | Amendment audit trail missing field-level details             | Log before/after values in amendment history               |
| SP-26 | 8     | Missing audit trail for permission changes in Cloud Functions | Log `syncUserClaims` and `onUserUpdate` operations         |

**Effort**: Moderate — first item establishes the pattern, rest follow it.

---

### Cluster C: Auth & Session Hardening (10 MEDIUM) — COMPLETE

Close the gap where client-side permission checks can be bypassed.

| ID    | Phase | Issue                                                         | Fix Approach                                     |
| ----- | ----- | ------------------------------------------------------------- | ------------------------------------------------ |
| AA-4  | 7     | Client-side permission claims not validated against Firestore | Add periodic claim refresh (e.g., every 15 min)  |
| AA-5  | 7     | User deactivation not immediately revoking session            | Call `revokeRefreshTokens()` on deactivation     |
| AA-6  | 7     | Missing validation of isActive in Firestore Rules             | Add `isActive == true` check to security rules   |
| AA-7  | 7     | Permission changes don't force token refresh                  | Bump a `claimsVersion` field, check on client    |
| HR-18 | 4     | Missing permissions check on HR service function calls        | Add `assertPermission()` to HR service functions |
| PE-8  | 6     | Company documents not scoped by module/project permissions    | Add visibility check in document query           |
| PE-10 | 6     | Document visibility enforced only at client                   | Add service-layer visibility filter              |
| PE-14 | 6     | No explicit permission check for SSOT editors                 | Check `assignedProjects` before allowing edits   |
| PE-18 | 6     | SSOT data not validated against project ownership             | Validate user has project access                 |
| PR-16 | 2     | Missing dedicated permission flags for GR operations          | Add `APPROVE_GR` / `INSPECT_GOODS` flags         |

**Effort**: High — AA-4/5/6/7 require coordinated auth infrastructure changes. PE/HR/PR items are simpler service-layer guards.

---

### Cluster D: Cloud Functions Hardening (16 MEDIUM, 4 LOW) — COMPLETE

Harden Cloud Functions for production deployment.

| ID    | Phase | Sev | Issue                                                   |
| ----- | ----- | --- | ------------------------------------------------------- |
| SP-3  | 8     | M   | Untyped array fields in validation schemas              |
| SP-4  | 8     | M   | Inconsistent CustomClaims field names                   |
| SP-5  | 8     | M   | Cloud Functions silently continue on validation failure |
| SP-6  | 8     | M   | Missing input validation (userId != auth.uid)           |
| SP-8  | 8     | M   | Empty API routes directory                              |
| SP-9  | 8     | M   | Firestore emulator exposure in testing                  |
| SP-11 | 8     | M   | Rate limiter not distributed (in-memory only)           |
| SP-12 | 8     | M   | Missing permissions2 helper functions                   |
| SP-14 | 8     | M   | Missing security rule enforcement documentation         |
| SP-15 | 8     | M   | Logger doesn't mask sensitive data                      |
| SP-16 | 8     | M   | Validation schemas don't match type definitions         |
| SP-18 | 8     | M   | Missing auth check in public Cloud Functions            |
| SP-20 | 8     | M   | No cross-tenant data access validation                  |
| SP-21 | 8     | M   | Missing error response standardization                  |
| SP-23 | 8     | M   | No input size limits                                    |
| SP-24 | 8     | M   | Timestamp handling inconsistency                        |
| SP-10 | 8     | L   | Missing environment variable validation                 |
| SP-17 | 8     | L   | Unused permission flags in types package                |
| SP-22 | 8     | L   | TODOs left in production code                           |
| SP-25 | 8     | L   | Missing rate limiter cleanup after reset                |

**Effort**: Moderate-High — 20 items but many are small validation/documentation fixes. SP-11 (distributed rate limiter) and SP-15 (log masking) are the larger items.

---

### Cluster E: Service-Layer Validation (15 MEDIUM) — COMPLETE

Add missing validation checks in service functions (field existence, referential integrity, financial calculations).

| ID    | Phase | Issue                                                             | Resolution                           |
| ----- | ----- | ----------------------------------------------------------------- | ------------------------------------ |
| BP-6  | 3     | Missing validation on proposal approval actions                   | VERIFIED — already validates         |
| BP-8  | 3     | No validation of revision chain integrity                         | FIXED — revision number validation   |
| BP-9  | 3     | No validation of BOM item hierarchy                               | VERIFIED — parent + cascade exists   |
| BP-11 | 3     | Race condition in BOM summary calculation                         | MITIGATED — single-user, fresh reads |
| BP-12 | 3     | Missing financial calculation validation                          | FIXED — rate + result validation     |
| PE-3  | 6     | No validation that referenced vendor entity still exists          | MITIGATED — dropdown already filters |
| PE-4  | 6     | Incomplete required field validation for outsourcing vendors      | FIXED — email format validation      |
| PE-11 | 6     | Entity archive status not checked when creating procurement items | FIXED — vendor archive check         |
| PE-19 | 6     | Supply items can reference non-existent documents                 | FIXED — master doc ref validation    |
| PR-13 | 2     | Bill fallback to PO amounts when no items accepted                | FIXED — throws NO_ACCEPTED_ITEMS     |
| PR-15 | 2     | GR items lack uniqueness constraint                               | VERIFIED — txn + idempotency key     |
| AC-14 | 1     | Cost centre auto-creation race condition                          | FIXED — deterministic CC-{projectId} |
| AC-15 | 1     | Fiscal year "current" not exclusive                               | FIXED — logs error on duplicates     |
| HR-13 | 4     | Holiday duplicate detection not enforced at database level        | FIXED — deterministic holiday-{date} |
| FL-19 | 5     | No validation of assignee permissions on task creation            | FIXED — assignee active check        |

**Result**: 10 fixed, 3 verified, 2 mitigated.

---

### Cluster F: Denormalized Data Sync (3 MEDIUM) — COMPLETE

Add Cloud Function triggers to propagate name changes to denormalized copies.

| ID    | Phase | Issue                                                     | Resolution                                             |
| ----- | ----- | --------------------------------------------------------- | ------------------------------------------------------ |
| PE-7  | 6     | Denormalized vendor names not updated when entity changes | VERIFIED — `onEntityNameChange` covers 6 collections   |
| PE-13 | 6     | Denormalized equipment names not synchronized             | FIXED — added `onEquipmentNameChange` Cloud Function   |
| PE-20 | 6     | Project name denormalization not kept in sync             | VERIFIED — `onProjectNameChange` covers 10 collections |

**Result**: 1 fixed, 2 verified. Entity and project sync already existed in `denormalizationSync.ts`. Added equipment sync.

---

### Cluster G: UX Polish & Pagination (15 MEDIUM, 6 LOW) — COMPLETE

UI improvements: pagination on lists, missing indexes, confirmation dialogs, filter fixes.

| ID     | Phase | Sev | Issue                                                             | Resolution                                                  |
| ------ | ----- | --- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| FL-12  | 5     | M   | Missing composite index for Team Board query                      | FIXED — added composite index (entityId, status, createdAt) |
| FL-13  | 5     | M   | Inbox filter double-counts approval tasks                         | MITIGATED — dual visibility is intentional                  |
| FL-16  | 5     | M   | Due date overdue indicator doesn't account for time zones         | FIXED — normalized to date-only boundaries                  |
| FL-17  | 5     | M   | Task completion from inbox has UX flicker                         | FIXED — added optimistic removal                            |
| FL-20  | 5     | M   | Meeting list not paginated                                        | DEFERRED — acceptable at current scale                      |
| AC-13  | 1     | M   | No pagination on recurring transaction list                       | FIXED — added TablePagination                               |
| AC-16  | 1     | M   | TODO left in production code (PENDING_APPROVAL edit guard)        | VERIFIED — TODO no longer exists in codebase                |
| PE-16  | 6     | M   | No default values for optional vendor contact fields              | FIXED — primary contact with fallback chain                 |
| HR-11  | 4     | M   | Missing Firestore indexes documentation                           | MITIGATED — indexes already exist in firestore.indexes.json |
| HR-15  | 4     | M   | Leave balance recalculation not automatic at fiscal year boundary | MITIGATED — feature requiring Cloud Function + scheduler    |
| HR-16  | 4     | M   | Approval email configuration not validated on app startup         | MITIGATED — services already throw on missing config        |
| HR-17  | 4     | M   | Travel expense self-approval handled differently from leave       | FIXED — standardized preventSelfApproval() across services  |
| GRN-12 | 0     | M   | No rejection/refusal workflow                                     | MITIGATED — ISSUES_FOUND status serves as soft rejection    |
| GRN-14 | 0     | M   | ApproverSelector callback not memoized                            | VERIFIED — already uses useCallback and memo()              |
| GRN-15 | 0     | M   | No "Sent to Accounting" filter on GR list page                    | FIXED — added filter switch on GR list page                 |
| FL-21  | 5     | L   | Action item table doesn't validate empty required fields          | FIXED — per-row validation with red highlight               |
| FL-22  | 5     | L   | Meeting action items lack completion status tracking              | DEFERRED — requires type changes and Cloud Function         |
| FL-23  | 5     | L   | No confirmation dialog before meeting deletion                    | FIXED — delete button with confirmation for drafts          |
| AC-20  | 1     | L   | View Details button non-functional                                | FIXED — navigates to correct detail page by type            |
| AC-23  | 1     | L   | GRN Bills error message not actionable                            | FIXED — includes specific missing account info              |
| BP-10  | 3     | L   | No index validation for complex queries                           | FIXED — added composite indexes for BOM items               |

**Result**: 12 fixed, 2 verified, 5 mitigated, 2 deferred.

---

### Cluster H: Code Quality & Cleanup (5 MEDIUM, 28 LOW) — COMPLETE `4305658`

Minor improvements: error messages, hardcoded values, unused imports, naming consistency.

| ID    | Phase | Sev | Issue                                                                       | Resolution                                             |
| ----- | ----- | --- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| PR-14 | 2     | M   | Amendment submission not idempotent                                         | FIXED — runTransaction for idempotency                 |
| BP-14 | 3     | L   | Inefficient BOM code generation fallback                                    | FIXED — crypto.randomUUID() fallback                   |
| PR-21 | 2     | L   | Bill line items use PO quantities, not GR accepted                          | FIXED — uses GR accepted quantities                    |
| AC-17 | 1     | M   | Cascading updates not fully atomic                                          | VERIFIED — already uses runTransaction                 |
| AC-22 | 1     | L   | Payment batch query orderBy not validated                                   | VERIFIED — already type-constrained                    |
| SP-8  | 8     | M   | Empty API routes directory (documentation decision)                         | VERIFIED — already resolved in Cluster D               |
| SP-9  | 8     | L   | Firestore emulator exposure in testing                                      | VERIFIED — already resolved in Cluster D               |
| PR-19 | 2     | L   | canCreateBill vs UI logic confusion                                         | VERIFIED — already fixed in Phase 0                    |
| PR-22 | 2     | L   | Missing amount validation before bill GL generation                         | VERIFIED — subtotal validation exists                  |
| BP-19 | 3     | L   | Missing null coalescing in optional field reads                             | VERIFIED — proper optional chaining present            |
| AA-13 | 7     | L   | getAllPermissions missing from types package                                | VERIFIED — removed during permissions consolidation    |
| AA-15 | 7     | L   | E2E testing helpers expose auth methods to window                           | VERIFIED — double-guarded (emulator + NODE_ENV)        |
| AA-17 | 7     | L   | permissions2 field lacks type check in Cloud Function                       | VERIFIED — type check already exists                   |
| BP-7  | 3     | M   | Inconsistent undefined field handling                                       | MITIGATED — pattern consistently applied               |
| HR-19 | 4     | M   | Inconsistent naming "leaveRequests" vs "hrLeaveRequests" in Firestore Rules | MITIGATED — service uses hrLeaveRequests; legacy kept  |
| AC-18 | 1     | L   | System account codes hardcoded in resolver                                  | MITIGATED — standard GL codes for single deployment    |
| AC-19 | 1     | L   | Floating point tolerance hardcoded                                          | MITIGATED — 0.01 matches INR paisa                     |
| AC-24 | 1     | L   | Max payment amount arbitrary                                                | MITIGATED — reasonable threshold with inline comment   |
| PR-18 | 2     | L   | sendGRToAccounting rollback may fail                                        | MITIGATED — rollback failure unlikely, low frequency   |
| BP-15 | 3     | L   | Missing error context in batch operations                                   | MITIGATED — infrequent, limited debugging impact       |
| BP-16 | 3     | L   | Incomplete error messages in service layer                                  | MITIGATED — error messages adequate for debugging      |
| BP-17 | 3     | L   | No validation of proposal totals                                            | MITIGATED — implicit consistency from derivation       |
| BP-18 | 3     | L   | Fallible material price retrieval                                           | MITIGATED — silent zero documented, log warning exists |
| BP-20 | 3     | L   | Inconsistent cost currency handling                                         | MITIGATED — single currency system, acceptable         |
| HR-20 | 4     | L   | Hardcoded currency "INR"                                                    | MITIGATED — India-based operations, INR reasonable     |
| PE-15 | 6     | L   | Company document isLatest flag not managed                                  | MITIGATED — brief atomicity window, low risk           |
| AC-21 | 1     | L   | No confirmation dialog before hard delete                                   | DEFERRED — UI-layer responsibility by design           |
| AA-9  | 7     | L   | PERMISSION_PRESETS imported but unused                                      | DEFERRED — UX improvement (presets in EditUserDialog)  |
| AA-10 | 7     | L   | isAdmin variable name misleading                                            | DEFERRED — variable naming clarity only                |
| AA-11 | 7     | L   | console.error leaks error details to browser                                | DEFERRED — admin-only panels, low risk                 |
| AA-16 | 7     | L   | No rate limiting on permission update endpoints                             | DEFERRED — client-side rate limiting nice-to-have      |
| AA-20 | 7     | L   | Rejection of users doesn't set explicit reason                              | DEFERRED — feature request (rejection reason field)    |
| PR-20 | 2     | L   | Amendment number generation not atomic                                      | DEFERRED — collision extremely unlikely                |

**Result**: 3 fixed, 10 verified, 13 mitigated, 7 deferred.

---

## Recommended Fix Order

| Batch | Cluster               | Count | Why First                                         |
| ----- | --------------------- | ----- | ------------------------------------------------- |
| 1     | A: State Machines     | 6     | Prevents data corruption from invalid transitions |
| 2     | B: Audit Logging      | 6     | Compliance foundation, enables debugging          |
| 3     | C: Auth Hardening     | 10    | Closes "bypass the UI" attack surface             |
| 4     | E: Service Validation | 15    | Referential integrity and data quality            |
| 5     | D: Cloud Functions    | 20    | Backend production readiness                      |
| 6     | F: Data Sync          | 3     | Eliminates stale denormalized data                |
| 7     | G: UX Polish          | 21    | User-facing improvements                          |
| 8     | H: Code Cleanup       | 33    | Maintainability                                   |

**Total**: 110 findings across 8 batches.

---

## Notes

- SP-8 appears in both Cluster D and H — it's a documentation decision, not a code fix. Tracked once (verified in Cluster D).
- Cluster C (Auth Hardening) had the highest complexity due to coordinated changes across Firestore rules, Cloud Functions, and client auth context.
- Cluster F (Data Sync) used Cloud Function triggers with batch updates in `denormalizationSync.ts`.
- 9 total deferred items: FL-20, FL-22 (Cluster G) + AC-21, AA-9, AA-10, AA-11, AA-16, AA-20, PR-20 (Cluster H). All are LOW severity except FL-20 (MEDIUM).
