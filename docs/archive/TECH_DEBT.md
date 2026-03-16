# Technical Debt, Security Roadmap & Future Work

Consolidated from: security review (Nov 2025), codebase audit (Feb 2026), and upgrade planning.

---

## Completed Items (Summary)

These items from the Nov 2025 external security review are done:

| #   | Item                                                                    | Commit     | Date       |
| --- | ----------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Service account security verification & Editor role removal             | Audit only | 2025-11-06 |
| 2   | Content-Security-Policy (CSP) header                                    | `3795d5f`  | 2025-11-06 |
| 3   | Strict-Transport-Security (HSTS) header                                 | `3795d5f`  | 2025-11-06 |
| 4   | Remove deprecated X-XSS-Protection header                               | `3795d5f`  | 2025-11-06 |
| 5   | Remove `continue-on-error` from CI security audit                       | `3795d5f`  | 2025-11-06 |
| 6   | Soft-delete data leakage (10+ locations)                                | `c0d4e041` | 2026-02-17 |
| 7   | Tighten Firestore rules (taskNotifications, counters, idempotency_keys) | `d7ce950d` | 2026-02-17 |
| 8   | Add `requirePermission` to PO crud/workflow functions                   | `d7ce950d` | 2026-02-17 |
| 9   | Link Chart of Accounts to customer invoices (per-line-item revenue)     | `8a661b00` | 2026-02-17 |
| 10  | Link Chart of Accounts to payment dialogs (vendor, customer, direct)    | `d529d93c` | 2026-02-17 |

CVE-2025-59472 (Next.js PPR Memory Exhaustion): **NOT AFFECTED** — app uses static export, PPR not enabled.

---

## HIGH PRIORITY

### 1. Migrate Audit Logs to Cloud Functions (Server-Side)

**Effort:** Large (dedicated sprint) | **Source:** Feb 2026 security review

**Problem:** 45+ client-side `logAuditEvent()` calls write directly to Firestore. This is bypassable — a user could skip the call or inject fake entries. Firestore rule `allow create: if isInternalUser()` allows any internal user to write arbitrary audit logs.

**Solution:** Add `onDocumentWritten` Firestore triggers on each audited collection. Triggers read before/after snapshots, calculate changes, and write audit logs server-side using the Admin SDK. Actor info comes from `updatedBy`/`createdBy` fields already on each document.

**Steps:**

1. Create triggered Cloud Functions for each audited collection (~15 triggers):
   - `transactions`, `purchaseRequests`, `rfqs`, `purchaseOrders`, `offers`, `goodsReceipts`, `packingLists`, `workCompletionCertificates`, `materials`, `documents`, `estimates`, `proposals`
2. Server-side utility already exists: `functions/src/utils/audit.ts` (`createAuditLog()`, `calculateFieldChanges()`)
3. Tighten Firestore rule: `allow create: if false` — only Admin SDK can write
4. Remove all 45 client-side `logAuditEvent()` call sites
5. Remove `clientAuditService.ts` (or keep for login events only, which don't have a document trigger)

**Files:**

- Server utility: `functions/src/utils/audit.ts`
- Client service (to remove): `apps/web/src/lib/audit/clientAuditService.ts`
- Firestore rules: `firestore.rules` lines 769-778
- Call sites: `grep -r "logAuditEvent\|createAuditContext" apps/web/src/`

---

### 2. Migrate to OIDC (Workload Identity Federation)

**Effort:** Small (3 hours) | **Source:** Nov 2025 security review

**Problem:** Using long-lived service account JSON in GitHub Secrets. Better: Use short-lived OIDC tokens (no stored credentials).

**Steps:**

1. Create Workload Identity Pool + Provider in GCP
2. Update `.github/workflows/deploy.yml` to use `google-github-actions/auth@v2`
3. Delete `FIREBASE_SERVICE_ACCOUNT` secret

**Blocker:** Requires GCP project owner permissions.

---

### 3. Add Firestore Security Rules Tests

**Effort:** Medium (4 hours) | **Source:** Nov 2025 security review

**Problem:** No automated testing of Firestore security rules. Rule changes could accidentally expose data.

**Steps:**

1. Install `@firebase/rules-unit-testing`
2. Create `tests/firestore.rules.test.ts` — tests for critical rules (users, entities, transactions, accounting)
3. Add test job to CI workflow, make failures block deployment

---

## MEDIUM PRIORITY

### 4. Narrow Firestore Rules — Permission-Based Access

**Effort:** Medium | **Source:** Feb 2026 security review

**Problem:** Several collections use broad `isInternalUser()` for read access instead of permission-flag-based checks.

**Collections to tighten (reads):**

| Collection           | Current Rule       | Recommended                     | Notes                              |
| -------------------- | ------------------ | ------------------------------- | ---------------------------------- |
| `documents`          | `isInternalUser()` | Add `VIEW_DOCUMENTS` flag (new) | No read permission exists yet      |
| `tasks`              | `isInternalUser()` | Add `VIEW_FLOW` flag (new)      | Needs new `PERMISSION_FLAGS_2` bit |
| `manualTasks`        | `isInternalUser()` | Add `VIEW_FLOW` flag (new)      | Part of Flow module                |
| `meetings`           | `isInternalUser()` | Add `VIEW_FLOW` flag (new)      | Part of Flow module                |
| `meetingActionItems` | `isInternalUser()` | Add `VIEW_FLOW` flag (new)      | Part of Flow module                |
| `costCentres`        | `isInternalUser()` | `VIEW_ACCOUNTING` (bit 15)      | Financial data                     |
| `entities`           | `isInternalUser()` | `VIEW_ENTITIES` (bit 5, exists) | Needed by selectors across modules |

**Collections to keep broad (intentional):**

- `company` — essential org config needed everywhere
- `documentTemplates` — reference data for template rendering
- `counters`, `idempotency_keys` — system infrastructure
- `hrLeaveTypes`, `hrHolidays`, `holidayWorkingOverrides` — employees need to see these

**Steps:**

1. Add `VIEW_FLOW` and `MANAGE_FLOW` bits to `PERMISSION_FLAGS_2` in `packages/constants/src/permissions.ts`
2. Optionally add `VIEW_DOCUMENTS` bit (separate from existing `MANAGE_DOCUMENTS`)
3. Add `hasPermission2()` helper function to `firestore.rules` (currently only `hasPermission()` exists)
4. Update rules to use `hasPermission2()` for Flow module collections
5. Update admin UI role editor to show new flags
6. Assign `VIEW_FLOW` to all existing roles (non-breaking rollout)

**Decision needed:** For `entities`, broad read may be acceptable since EntitySelector is used across many modules.

---

### 5. Add `requirePermission` to Remaining Service Functions

**Effort:** Medium | **Source:** Feb 2026 security review

**Problem:** 30+ write functions across 10 service files don't call `requirePermission()`. Client-side checks alone are insufficient.

| Service File                     | Functions Missing Checks                                                                                    | Recommended Flag                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `paymentBatchService.ts`         | `createPaymentBatch`, `addPaymentsToExistingBatch`, `submitBatchForApproval`, `approveBatch`, `rejectBatch` | `MANAGE_ACCOUNTING`                     |
| `recurringTransactionService.ts` | `createRecurringTransaction`, `updateRecurringTransaction`, `deleteRecurringTransaction`                    | `MANAGE_ACCOUNTING`                     |
| `fiscalYearService.ts`           | `createFiscalYear`, `closeFiscalYear`, `reopenFiscalYear`                                                   | `MANAGE_ACCOUNTING`                     |
| `interprojectLoanService.ts`     | `createInterprojectLoan`, `approveLoan`, `rejectLoan`, `processLoanPayment`                                 | `MANAGE_ACCOUNTING`                     |
| `transactionVoidService.ts`      | `voidTransaction`, `reverseVoid`                                                                            | `MANAGE_ACCOUNTING`                     |
| `costCentreService.ts`           | `createCostCentre`, `updateCostCentre`                                                                      | `MANAGE_ACCOUNTING`                     |
| `packingListService.ts`          | `createPackingList`, `updatePackingList`                                                                    | `MANAGE_PROCUREMENT`                    |
| `workCompletionService.ts`       | `createWCC`, `submitWCC`, `approveWCC`                                                                      | `MANAGE_PROCUREMENT`                    |
| `leaveRequestService.ts`         | `createLeaveRequest`, `approveLeave`, `rejectLeave`                                                         | `MANAGE_HR_SETTINGS` / `APPROVE_LEAVES` |
| `manualTaskService.ts`           | `createTask`, `updateTask`, `deleteTask`                                                                    | `MANAGE_FLOW` (new) or keep open        |

**Pattern:** Already implemented in `purchaseOrder/crud.ts` — add `userPermissions: number` param, call `requirePermission()` at function start, update calling UI to pass `claims?.permissions || 0`.

---

### 6. Next.js 16 Migration

**Effort:** Medium (2-3 days) | **Source:** Upgrade planning (Jan 2026)
**Current Version:** Next.js 15.5.11 | **Target:** Next.js 16.x (when stable)

**Breaking changes to handle:**

1. **`next lint` removed** — migrate to ESLint CLI directly. Run codemod: `npx @next/codemod@canary next-lint-to-eslint-cli apps/web`
2. **ESLint flat config** — convert `apps/web/.eslintrc.json` to `apps/web/eslint.config.js`
3. **NextConfig changes** — review `eslint` and `typescript` config options
4. **React 19** — already on 19.2.1, no action needed

**Migration phases:**

1. **Preparation:** Audit ESLint config, run codemods
2. **Upgrade (feature branch):** Update `next@16`, `eslint-config-next@16`, fix breaking changes
3. **Validation:** Full test suite, manual testing, static export verification, Firebase Hosting deploy
4. **Production:** Deploy to staging first, then production

**Dependencies to update:**

| Package            | Current | Target |
| ------------------ | ------- | ------ |
| next               | 15.5.11 | 16.x   |
| eslint-config-next | 15.5.11 | 16.x   |

---

### 7. Enable Dependabot

**Effort:** Small (30 min) | **Source:** Nov 2025 security review

Create `.github/dependabot.yml` for automated weekly dependency PRs covering root workspace, web app, functions, and GitHub Actions.

---

### 8. Add CodeQL Security Scanning

**Effort:** Small (1 hour) | **Source:** Nov 2025 security review

Add `.github/workflows/codeql.yml` for static application security testing (SAST) on push/PR to main, plus weekly scheduled scans.

---

### 9. Add Full Security Audit (Dev Dependencies)

**Effort:** Small (1 hour) | **Source:** Nov 2025 security review

Current CI only audits production dependencies. Add nightly scheduled workflow running `pnpm audit` without `--production` flag, auto-creating GitHub issues on failure.

---

## LOW PRIORITY

### 10. Fix TypeScript Config Inconsistency

**Effort:** Small (2 hours) | **Source:** Nov 2025 security review

Root `tsconfig.json` has both `declaration: true` and `noEmit: true` (contradictory). Create `tsconfig.base.json` for shared strict settings, update package-level configs to extend base.

---

### 11. Add E2E Tests to CI (Scheduled)

**Effort:** Small (2 hours) | **Source:** Nov 2025 security review

Playwright infrastructure exists but isn't running in CI. Add nightly scheduled workflow running against production, with artifact upload and auto-issue creation on failure.

---

### 12. Add Health Check Endpoint

**Effort:** Small (1 hour) | **Source:** Nov 2025 security review

Post-deployment health check is a placeholder. Since app uses static export (`output: 'export'`), create a `health.json` file generated at build time. Update deploy workflow to check it.

---

### 13. Create Security Documentation

**Effort:** Small (2 hours) | **Source:** Nov 2025 security review

Create `docs/SECURITY.md` with security policies, service account permissions, incident response process, vulnerability disclosure policy.

---

### 14. Add Secret Scanning Pre-commit Hook

**Effort:** Small (1 hour) | **Source:** Nov 2025 security review

Install `gitleaks`, add to Husky pre-commit hook. Configure patterns for Firebase keys, GCP service accounts.

---

### 15. Optimize Cache Headers

**Effort:** Small (1 hour) | **Source:** Nov 2025 security review

Configure different cache durations per asset type in `firebase.json` — `must-revalidate` for HTML/JSON, `immutable` for hashed JS/CSS/images.

---

### 16. Currency Math Precision

**Effort:** Very Large | **Source:** Feb 2026 security review

**Status:** Deferred indefinitely. No rounding bugs reported in production. Current floating-point arithmetic with tolerance checks works in practice. If revisited: migrate to integer-based paise or decimal library. Would touch every financial calculation.
