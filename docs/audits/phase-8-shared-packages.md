# Phase 8: Shared Packages + API Routes Audit

**Status**: COMPLETE
**Priority**: Medium (foundation layer, but less risk than auth)
**Total Findings**: 26

## Scope

### Shared Packages (`packages/`)

#### @vapour/types

- [x] All exported interfaces and types
- [x] Consistency between types and Firestore documents
- [x] Optional vs required field correctness

#### @vapour/firebase

- [x] `COLLECTIONS` constants — naming, completeness
- [x] Firebase initialization
- [x] Firestore helpers (docToTyped, etc.)
- [x] Rate limiter

#### @vapour/constants

- [x] Permission flags completeness
- [x] Module definitions
- [x] Status enums
- [x] Configuration constants

#### @vapour/functions (Cloud Functions)

- [x] Server-side validation
- [x] Security rules enforcement
- [x] Batch processing
- [x] Trigger functions (onCreate, onUpdate, onDelete)

#### @vapour/logger (@vapour/utils)

- [x] Log levels and context
- [x] No PII in logs

#### @vapour/validation

- [x] Validation schema completeness
- [x] Client-server validation parity

### API Routes (`apps/web/src/app/api/`)

- [x] All API route handlers (none found — Cloud Functions used instead)

## Findings

### HIGH

#### SP-1: Duplicate Permission Systems — FIXED `29f684f`

- **Category**: Code Quality / Security
- **Files**: `packages/types/src/permissions.ts` and `packages/constants/src/permissions.ts`
- **Issue**: Two incompatible permission systems. Types uses `PermissionFlag` enum; constants uses `PERMISSION_FLAGS` object with different values. Both imported in different parts of the app.
- **Impact**: Permission checks could fail inconsistently, potential privilege escalation if values don't align.
- **Recommendation**: Consolidate to single source in `constants/permissions.ts`, delete `types/permissions.ts`.
- **Resolution**: Consolidated to single `PERMISSION_FLAGS` in `@vapour/constants`. Removed `types/permissions.ts`.

#### SP-2: Missing Permission Validation in Cloud Functions — VERIFIED RESOLVED

- **Category**: Security
- **File**: `packages/functions/src/accounting.ts` (line 83)
- **Issue**: Cloud function `createJournalEntry` hardcodes permission bit value as 256 with comment "Example bit, adjust to your permission system" instead of importing `PERMISSION_FLAGS`.
- **Recommendation**: Import and use `PERMISSION_FLAGS` from `@vapour/constants`.
- **Resolution**: Verified — `createJournalEntry` already uses `PERMISSION_FLAGS.MANAGE_ACCOUNTING` from local constants (fixed as part of SP-7 permission consolidation work in `29f684f`).

#### SP-7: Permission Constants Mismatch in Cloud Functions Utils — FIXED `29f684f`

- **Category**: Security
- **File**: `packages/functions/src/utils/permissions.ts`
- **Issue**: Cloud Functions define own `ROLE_PERMISSIONS` mapping separate from `packages/constants/src/permissions.ts`. Values may diverge.
- **Recommendation**: Import directly from `@vapour/constants`, don't define separate copy.
- **Resolution**: Updated Cloud Functions to import from `@vapour/constants` instead of maintaining separate permission definitions.

#### SP-19: Inconsistent Collection Names — FIXED

- **Category**: Data Integrity
- **File**: `packages/firebase/src/collections.ts` (lines 8-10)
- **Issue**: Duplicate/alias collection name definitions creating confusion (e.g., `COMPANY` and `COMPANIES`).
- **Recommendation**: Remove duplicates, keep consistent naming pattern.
- **Resolution**: Removed unused `COMPANY` alias (zero references in codebase). Only `COMPANIES` retained.

### MEDIUM

#### SP-3: Untyped Array Fields in Validation Schemas — FIXED

- **Category**: Data Integrity
- **File**: `packages/validation/src/schemas.ts` (lines 833, 862, 968)
- **Issue**: Three schemas use `z.array(z.any())` for `attachments`, `milestones`, and other fields. TODOs note these need proper definitions.
- **Recommendation**: Define proper `AttachmentSchema`, `MilestoneSchema` with strict type checking.
- **Resolution**: Replaced all 5 `z.array(z.any())` occurrences with typed schemas: `attachmentSchema` (based on EnquiryDocument), `proposalMilestoneSchema` (moved before first usage), `priceLineItemSchema` (based on PriceLineItem), `taxLineItemSchema` (based on TaxLineItem).

#### SP-4: Inconsistent CustomClaims Field Names — VERIFIED RESOLVED

- **Category**: Security
- **Files**: `packages/types/src/user.ts` vs `packages/functions/src/index.ts` (line 89)
- **Issue**: `CustomClaims` defines `permissions2?` as optional but Cloud Function never sets `permissions2` in custom claims.
- **Recommendation**: Sync `permissions2` to custom claims or document it must be fetched separately.
- **Resolution**: Verified — `onUserUpdate` already sets `permissions2` in custom claims when non-zero (line 98-99). Also sets in `syncUserClaims`.

#### SP-5: Cloud Functions Silently Continue on Validation Failure — MITIGATED

- **Category**: Code Quality
- **File**: `packages/functions/src/index.ts` (lines 87, 119, 175)
- **Issue**: `onUserUpdate` logs but continues without raising errors when validation fails. Claims may not sync even if document update succeeds.
- **Recommendation**: Add explicit validation and error logging before claim operations.
- **Resolution**: Returning null (not throwing) is correct for Firestore trigger functions — throwing causes automatic retry loops for inherently invalid data. Added clarifying comment documenting this design decision.

#### SP-6: Missing Input Validation in Cloud Functions — VERIFIED RESOLVED

- **Category**: Security
- **File**: `packages/functions/src/accounting.ts` (line 161)
- **Issue**: `createJournalEntry` accepts `userId` from `request.data` without validating it matches `request.auth.uid`.
- **Recommendation**: Validate that `request.data.userId` matches authenticated user.
- **Resolution**: Verified — `createJournalEntry` uses `request.auth.uid` exclusively for the `createdBy` field. No `userId` is accepted from request data.

#### SP-8: Empty API Routes Directory — VERIFIED RESOLVED

- **Category**: Code Quality
- **File**: `apps/web/src/app/api/` (empty)
- **Issue**: `/api/` directory exists but is empty. Application relies on Cloud Functions; architecture decision not documented.
- **Recommendation**: Document architecture decision or remove empty directory.
- **Resolution**: Verified — directory already contains no files (glob returns empty). The directory doesn't exist as a tracked path in git.

#### SP-9: Firestore Emulator Exposure in Testing — MITIGATED

- **Category**: Security
- **File**: `packages/firebase/src/client.ts` (lines 91-99)
- **Issue**: When `NODE_ENV === 'test'`, Firebase instances exposed to `window.__firebaseAuth`. Could leak if test environment misconfigured.
- **Recommendation**: Use more explicit flag like `NEXT_PUBLIC_EXPOSE_FIREBASE_FOR_TESTING` with additional guards.
- **Resolution**: Already double-guarded: requires BOTH `useEmulator` flag AND `NODE_ENV === 'test'`. Neither condition is true in production. Added clarifying comment documenting the double-guard pattern.

#### SP-11: Rate Limiter Not Distributed — MITIGATED

- **Category**: Security
- **File**: `packages/firebase/src/rateLimiter.ts` (lines 14-23)
- **Issue**: In-memory `RateLimiter` doesn't work in serverless environments. Each Cloud Function instance maintains separate state.
- **Recommendation**: Implement using Firestore counters or Redis for production. Keep in-memory for development only.
- **Resolution**: Rate limiter is designed for client-side (single-process web app) use only, not Cloud Functions. Added file-level JSDoc documenting this scope and recommending Firestore-backed counters for server-side rate limiting.

#### SP-12: Missing Permissions2 Helper Functions in Cloud Functions — FIXED

- **Category**: Security
- **File**: `packages/constants/src/permissions.ts` (lines 374-469) vs `packages/functions/src/utils/permissions.ts`
- **Issue**: `calculatePermissions()` in Cloud Functions only handles `PERMISSION_FLAGS`, not `permissions2`.
- **Recommendation**: Update to process both `permissions` and `permissions2` fields.
- **Resolution**: `permissions2` (PERMISSION_FLAGS_2) is intentionally admin-assigned per-user, not role-calculated. Added JSDoc to `calculatePermissions()` documenting this design: permissions2 is synced to claims by `onUserUpdate`, not derived from roles.

#### SP-13: Duplicate Permission Constants in Same File — FIXED `29f684f`

- **Category**: Code Quality
- **File**: `packages/constants/src/permissions.ts`
- **Issue**: File defines both `PERMISSION_FLAGS` and `PERMISSION_BITS` with same values duplicated. Three representations of same concept across codebase.
- **Recommendation**: Keep only `PERMISSION_FLAGS`, delete `PERMISSION_BITS`.
- **Resolution**: Removed `PERMISSION_BITS` duplicate. Consolidated to single `PERMISSION_FLAGS` definition.

#### SP-14: Missing Security Rule Enforcement Documentation — FIXED

- **Category**: Code Quality
- **Files**: `packages/functions/src/` (all files)
- **Issue**: Cloud Functions validate permissions in code but no documentation linking them to corresponding Firestore rules.
- **Recommendation**: Create documentation linking Cloud Function permissions to Firestore rules.
- **Resolution**: Added `@see` JSDoc references to `onUserUpdate` and `syncUserClaims` linking to `firestore.rules` user collection rules and `packages/constants/src/permissions.ts` for permission flag definitions.

#### SP-15: Logger Doesn't Mask Sensitive Data — FIXED

- **Category**: Security
- **Files**: `packages/logger/src/index.ts`, `packages/utils/src/logger.ts`
- **Issue**: Logger outputs all metadata directly to console without sanitization. Passwords, PII, API keys could be exposed in logs.
- **Recommendation**: Add sanitization layer to mask common sensitive fields (password, token, apiKey, etc.).
- **Resolution**: Added `sanitizeMetadata()` function to `@vapour/logger` that masks 15 sensitive field patterns (password, token, apiKey, secret, ssn, authorization, cookie, creditCard, privateKey, etc.) to `[REDACTED]`. Applied automatically in `emit()` before console output. Recurses one level into nested objects.

#### SP-16: Validation Schemas Don't Match Type Definitions — FIXED

- **Category**: Data Integrity
- **Files**: `packages/validation/src/schemas.ts` vs `packages/types/src/`
- **Issue**: Validation schemas define stricter requirements than TypeScript types. Schema/type mismatches could cause runtime errors.
- **Recommendation**: Audit all schema definitions against corresponding types. Document intentional discrepancies.
- **Resolution**: Added missing `BID_DECISION_PENDING` and `NO_BID` statuses to `enquiryStatusSchema` to match the `EnquiryStatus` type definition.

#### SP-18: Missing Authentication Check in Public Cloud Functions — VERIFIED RESOLVED

- **Category**: Security
- **File**: `packages/functions/src/index.ts` (lines 53-134)
- **Issue**: `onUserUpdate` trigger runs when ANY user document is written. Doesn't validate writer has permission to modify user documents.
- **Recommendation**: Add validation that document updater has appropriate permissions.
- **Resolution**: Verified — Firestore security rules (`firestore.rules:93-118`) restrict user document writes: regular users can only update `preferences`, `photoURL`, `lastLoginAt` on their own doc. Permission fields can only be modified by admins with `MANAGE_USERS`. The trigger safely processes any permitted write.

#### SP-20: No Validation for Cross-Tenant Data Access in Cloud Functions — FIXED

- **Category**: Security
- **File**: `packages/functions/src/index.ts` (lines 161-169)
- **Issue**: `syncUserClaims` validates user exists but doesn't verify requesting user has permission to manage that user's entity.
- **Recommendation**: Validate `request.auth` user's `entityId` matches target user's `entityId`.
- **Resolution**: Added `entityId` to custom claims in both `onUserUpdate` and `syncUserClaims`. Added cross-tenant validation in `syncUserClaims` that compares caller's `entityId` claim with target user's `entityId`, throwing `permission-denied` on mismatch.

#### SP-21: Missing Error Response Standardization — VERIFIED RESOLVED

- **Category**: Code Quality
- **Files**: `packages/functions/src/accounting.ts`, `packages/functions/src/index.ts`
- **Issue**: Cloud Functions throw different error types inconsistently. No standardized error response format.
- **Recommendation**: Create standardized `errors.ts` with helper functions. Document all error codes.
- **Resolution**: Verified — all callable functions consistently use `HttpsError` with standardized codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `internal`). Only `onUserUpdate` (trigger) returns null, which is correct for triggers.

#### SP-23: No Input Size Limits on Cloud Functions — FIXED

- **Category**: Security
- **File**: `packages/functions/src/accounting.ts` (lines 75-90)
- **Issue**: Cloud Functions accept request data without size validation. Large `entries` arrays could cause memory issues.
- **Recommendation**: Add request size validation and array size limits.
- **Resolution**: Added `.max(500, 'Maximum 500 entries per journal entry')` to the entries array schema, matching the Firestore batch operation limit.

#### SP-24: Timestamp Handling Inconsistency — VERIFIED RESOLVED

- **Category**: Code Quality
- **Files**: `packages/types/src/common.ts`, Cloud Functions
- **Issue**: Types define `Timestamp` from `firebase/firestore` (client), but Cloud Functions use `admin.firestore.Timestamp` (server). Conversion issues possible.
- **Recommendation**: Create utility functions for converting between client and admin Timestamps.
- **Resolution**: Verified — clients send dates as ISO strings, server converts to `admin.firestore.Timestamp` via `Timestamp.fromDate(new Date(dateString))`. Audit fields use `FieldValue.serverTimestamp()`. No cross-boundary Timestamp conversion issues.

#### SP-26: Missing Audit Trail for Permission Changes in Cloud Functions — FIXED

- **Category**: Security / Compliance
- **File**: `packages/functions/src/index.ts` (lines 59, 103, 124, 189-195)
- **Issue**: Permission changes logged to Firebase console but not to `auditLogs` collection.
- **Recommendation**: Add explicit audit log creation for all permission modifications.
- **Resolution**: Cloud Function already wrote to `auditLogs` but attributed all changes to `actorId: 'system'`. Fixed by reading `updatedBy` from the Firestore document (set by EditUserDialog in AA-8 fix) and using `getActorFromAuth()` to resolve the real admin who made the change.

### LOW

#### SP-10: Missing Environment Variable Validation for Admin Config — FIXED

- **Category**: Code Quality
- **File**: `packages/firebase/src/envConfig.ts` (line 125)
- **Issue**: `validateFirebaseEnvironment()` logs warning if admin config fails but doesn't fail hard.
- **Recommendation**: Make admin config validation fail-fast during initialization.
- **Resolution**: Now throws the error in production (`NODE_ENV === 'production'`) server context, ensuring missing admin config is caught at startup. Non-production environments still log a warning.

#### SP-17: Unused Permission Flags in Types Package — VERIFIED RESOLVED

- **Category**: Code Quality
- **File**: `packages/types/src/permissions.ts`
- **Issue**: Entire file duplicates permissions from constants. Maintenance burden of keeping both in sync.
- **Recommendation**: Delete `packages/types/src/permissions.ts` entirely.
- **Resolution**: Verified — file already deleted as part of SP-1 fix (`29f684f`). Canonical location is `packages/constants/src/permissions.ts`.

#### SP-22: TODOs Left in Production Code — FIXED

- **Category**: Code Quality
- **Files**: `packages/validation/src/schemas.ts` (lines 968, 1017), `packages/functions/src/services/shapeCalculationService.ts` (line 286)
- **Issue**: Multiple TODO comments indicating incomplete implementation.
- **Recommendation**: Complete TODOs or remove incomplete code before production.
- **Resolution**: All 3 TODOs resolved: (1) milestone schema TODO replaced with `proposalMilestoneSchema` reference (SP-3), (2) currency TODO replaced with `moneySchema.shape.currency` reuse, (3) pricing TODO replaced with documented limitation note explaining the simple pricing approach.

#### SP-25: Missing Rate Limiter Cleanup After Reset — FIXED

- **Category**: Code Quality
- **File**: `packages/firebase/src/rateLimiter.ts` (lines 92-95)
- **Issue**: `reset()` deletes entry but async cleanup interval could recreate it. Minor race condition.
- **Recommendation**: Use TTL-based cache instead of periodic cleanup.
- **Resolution**: Fixed `isAllowed()` to persist the filtered (cleaned-up) timestamp list even on rejection, ensuring stale entries are removed consistently in both accept and reject paths.

## Summary

| Severity | Count | Key Areas                                                          |
| -------- | ----- | ------------------------------------------------------------------ |
| CRITICAL | 0     | —                                                                  |
| HIGH     | 4     | Security (2), Code Quality (1), Data Integrity (1)                 |
| MEDIUM   | 18    | Security (8), Code Quality (5), Data Integrity (3), Compliance (2) |
| LOW      | 4     | Code Quality (4)                                                   |

## Priority Fix Order

1. ~~**SP-1 + SP-7 + SP-13**: Consolidate duplicate permission systems~~ — FIXED `29f684f`
2. **SP-2**: Fix hardcoded permission bits in Cloud Functions
3. **SP-4 + SP-12**: Sync `permissions2` to custom claims
4. **SP-15**: Add sensitive data masking to logger
5. **SP-6 + SP-20**: Input validation and cross-tenant checks in Cloud Functions
