# High-Value Areas Review Report

This report provides a detailed analysis of four high-value areas of the Vapour Toolbox application as requested: Firestore Security Rules, Financial Calculation Logic, Permission Enforcement Consistency, and Soft-Delete Data Leakage.

---

## 1. Firestore Security Rules Analysis

The `firestore.rules` file is comprehensive and uses good practices like helper functions and a default-deny policy. However, several rules are overly permissive and present security risks.

### Critical Vulnerability

- **Finding:** The `taskNotifications` collection allows any authenticated user (including external clients) to create a notification for any other user (`allow create: if isAuthenticated();`).
- **Impact:** This is a significant security risk. A malicious actor could abuse this to spam any user with notifications. Relying on client-side logic to control this is insecure.
- **Recommendation:** This rule must be tightened immediately. Notification creation should likely be restricted to a backend process or gated by specific, verifiable conditions within the rule itself.

### High-Severity Issues

- **Finding:** The `counters` and `idempotency_keys` collections allow any authenticated user to write to any document.
- **Impact:** A malicious user could corrupt document numbering sequences (e.g., for purchase orders) or block other users' operations by manipulating idempotency keys.
- **Recommendation:** Writes to `counters` should be handled by transactional Cloud Functions. Writes to `idempotency_keys` should be restricted so a user can only create a key associated with their own user ID.

### Medium-Severity Issues

- **Broad Internal Access:** Many collections (`tasks`, `documents`, `purchaseRequests`, etc.) grant universal read/write access to all internal users via `if isInternalUser()`. This provides no data segregation between projects or departments for internal staff.
- **Client-Side Audit Logs:** Any internal user can create `auditLogs`. Client-side logging is inherently untrustworthy and can be spoofed. For a reliable audit trail, log creation should be handled exclusively by backend triggers.

---

## 2. Financial Calculation Logic Analysis

The architecture of the accounting module is strong, with excellent designs for enforcing double-entry bookkeeping and atomic writes. However, the implementation of the calculations themselves has a critical flaw.

### Critical Flaw: Systemic Use of Floating-Point Arithmetic

- **Finding:** The codebase consistently uses standard JavaScript `number` types for all currency calculations. The core ledger validator (`ledgerValidator.ts`) explicitly uses a `tolerance` of `0.01` to check if debits and credits are balanced, acknowledging the imprecision.
- **Impact:** This is a critical vulnerability in a financial application. Floating-point math is inherently imprecise and will lead to rounding errors. Using a tolerance can mask real data entry mistakes and allow account balances to "drift" over time as small errors accumulate. This fundamentally undermines the integrity of the accounting ledger.
- **Recommendation:** **Migrate all currency-related mathematics to a dedicated decimal arithmetic library.** The project already has `mathjs` as a dependency, which provides a `Decimal` type suitable for this. Alternatively, refactor the logic to work exclusively with integers by storing all currency values in their smallest unit (e.g., cents). This is the highest-priority technical debt item identified in the accounting module.

---

## 3. Permission Enforcement Consistency Analysis

The application has a robust client-side authorization service, but it is applied inconsistently, leaving critical security gaps in key mutation paths.

### Inconsistent Enforcement

- **Finding:** High-stakes workflow actions like `approvePO` and `rejectPO` correctly use the `requirePermission` function to gate access. However, fundamental operations like `createPOFromOffer`, `updateDraftPO`, and `submitPOForApproval` are completely missing these client-side checks.
- **Impact:** This creates a confusing and insecure user experience. The UI will allow an unauthorized user to perform an action, only for it to be silently blocked by the more secure Firestore rules. This indicates a lack of a consistent security standard for service-layer functions.
- **Recommendation:** Conduct a full audit of all service files. **Every function that performs a write operation (`create`, `update`, `delete`) must be retrofitted with a `requirePermission` check at the beginning of the function.** This should be treated as a high-priority task to ensure consistent security behavior.

---

## 4. Soft-Delete Data Leakage Analysis

The handling of soft-deleted data is inconsistent across the codebase, leading to several instances where deleted data is incorrectly included in financial reports and calculations.

### Critical Data Leakage

- **Finding:** Several critical financial services **do not** filter out soft-deleted documents (where `isDeleted: true`).
  - `lib/projects/budgetCalculationService.ts`: "Actual cost" calculations for project budgets include deleted bills, leading to inflated cost reports.
  - `lib/accounting/paymentHelpers.ts`: The calculation for an invoice's "outstanding amount" includes deleted payments, making it seem like less is owed than is actually the case.
- **Impact:** This is a high-severity issue that leads to incorrect financial reporting and calculations. It breaks the integrity of the soft-delete pattern.
- **Recommendation:** Enforce a strict, non-negotiable standard for all data-fetching queries. **Every `getDocs` call that lists data must include a `where('isDeleted', '==', false)` clause** (or an equivalent) unless it is explicitly intended to operate on deleted data (e.g., the "Trash" view). The leaks in `budgetCalculationService` and `paymentHelpers` should be fixed immediately.
