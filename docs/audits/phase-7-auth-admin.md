# Phase 7: Auth/Permissions + Admin Audit

**Status**: COMPLETE
**Priority**: High (cross-cutting security, access control)
**Total Findings**: 20

## Scope

### Auth

#### Service Files (`apps/web/src/lib/auth/`)

- [x] Auth context (`contexts/AuthContext.tsx`)
- [x] Auth service

#### Pages

- [x] Login page
- [x] Signup page
- [x] Unauthorized page
- [x] Pending approval page

### Permissions

#### Constants (`packages/constants/`)

- [x] `PERMISSION_FLAGS` — bitwise permission definitions
- [x] `PERMISSION_FLAGS2` — extended permissions
- [x] `canViewX()` helper functions
- [x] Module access control (`MODULES` definition)

### Admin

#### Service Files (`apps/web/src/lib/admin/`)

- [x] User management service
- [x] Activity log service
- [x] System status service

#### Pages (`apps/web/src/app/admin/`)

- [x] User management
- [x] Company settings
- [x] Feedback review
- [x] Activity logs
- [x] Audit trails
- [x] Notification settings
- [x] Task analytics
- [x] HR setup

### Super Admin

#### Pages (`apps/web/src/app/super-admin/`)

- [x] Module integration dashboard
- [x] System status

## Findings

### CRITICAL

#### AA-18: Missing MANAGE_ADMIN Permission Flag — FIXED `5bafc70`

- **Category**: Security
- **File**: `packages/constants/src/permissions.ts`
- **Issue**: No distinct `MANAGE_ADMIN` permission flag exists. All admin operations check for `MANAGE_USERS`. Admin panel access is conflated with user management.
- **Impact**: Users managing users get access to ALL admin features (company settings, feedback, activity logs). Violates principle of least privilege.
- **Recommendation**: Add separate `MANAGE_ADMIN` permission flag or create domain-specific permissions for different admin functions.
- **Resolution**: Added `MANAGE_ADMIN: 1 << 16` to `PERMISSION_FLAGS_2`, `canManageAdmin()` helper, added to `ALL_PERMISSIONS` array (adminOnly: true), and added 'admin' module to `MODULE_PERMISSIONS`.

### HIGH

#### AA-1: Inconsistent Permission Constants Between Packages — FIXED `29f684f`

- **Category**: Code Quality / Security
- **Files**: `packages/types/src/permissions.ts` and `packages/constants/src/permissions.ts`
- **Issue**: Two incompatible permission systems: `types` uses `PermissionFlag` enum, `constants` uses `PERMISSION_FLAGS` object with different values. Cloud Functions use constants; app uses both.
- **Impact**: Permission checks could fail inconsistently, potential privilege escalation if values don't align.
- **Recommendation**: Consolidate to single source of truth in `constants/permissions.ts`. Remove `types/permissions.ts`.
- **Resolution**: Consolidated to single `PERMISSION_FLAGS` source in `@vapour/constants`. Removed duplicate `PermissionFlag` enum from `@vapour/types`. Updated all imports across the codebase.

### MEDIUM

#### AA-2: Super Admin Check Uses Strict Equality — VERIFIED RESOLVED

- **Category**: Security
- **File**: `apps/web/src/app/super-admin/layout.tsx` (line 18)
- **Issue**: `const isSuperAdmin = currentPermissions === requiredPermissions;` — strict equality means adding new permissions to `getAllPermissions()` breaks existing super admins.
- **Recommendation**: Change to `(currentPermissions & requiredPermissions) === requiredPermissions`.
- **Resolution**: Verified — already uses bitwise AND with `getAllPermissions2()` check: `(currentPermissions & requiredPermissions) === requiredPermissions` and `(currentPermissions2 & requiredPermissions2) === requiredPermissions2`.

#### AA-3: Missing permissions2 in Cloud Function Claims Sync — VERIFIED RESOLVED

- **Category**: Security
- **File**: `packages/functions/src/index.ts` (lines 87-91)
- **Issue**: `onUserUpdate` Cloud Function only sets `permissions` in custom claims, never `permissions2`. Users with extended permissions (HR, SSOT, etc.) can't exercise them in Firestore rules.
- **Recommendation**: Add `permissions2: userData.permissions2 || 0` to custom claims.
- **Resolution**: Verified — `onUserUpdate` already destructures `permissions2` from userData (line 77), normalizes it with null-check (line 89), and includes it in custom claims when non-zero (lines 97-100).

#### AA-4: Client-Side Permission Claims Not Validated Against Firestore

- **Category**: Security
- **File**: `apps/web/src/contexts/AuthContext.tsx` (lines 41-66)
- **Issue**: Claims validation checks structure only, not legitimacy. Compromised token with inflated permissions would pass client-side validation.
- **Recommendation**: Server-side Firestore rules catch this, but add periodic token refresh to sync with authoritative data.

#### AA-5: User Deactivation Not Immediately Revoking Session

- **Category**: Security
- **Files**: `apps/web/src/components/admin/EditUserDialog.tsx`, `packages/functions/src/index.ts`
- **Issue**: When admin marks user inactive, existing Firebase session with cached ID token remains valid for up to 1 hour.
- **Recommendation**: Implement force logout mechanism or client-side watch on user status.

#### AA-6: Missing Validation of isActive Field in Firestore Rules

- **Category**: Security
- **File**: `firestore.rules` (lines 97, 114)
- **Issue**: Rules check `isActive === true` but don't enforce it for denying access. If `isActive` is missing or null, validation may be inconsistent.
- **Recommendation**: Add explicit `isActive == true` check in all access rules.

#### AA-7: Admin Permission Changes Don't Force Token Refresh

- **Category**: Security / UX
- **File**: `apps/web/src/components/admin/EditUserDialog.tsx` (lines 223-233)
- **Issue**: After admin updates permissions, edited user's session continues with old cached claims for up to 1 hour.
- **Recommendation**: Trigger Cloud Function to force logout or implement notification to prompt re-login.

#### AA-8: No Audit Log for Permission Changes — FIXED

- **Category**: Security / Compliance
- **Files**: `apps/web/src/components/admin/EditUserDialog.tsx`, `ApproveUserDialog.tsx`
- **Issue**: Permission updates and user approvals don't create audit log entries. Sensitive operations untracked.
- **Recommendation**: Add `logAuditEvent()` call with old/new permission values after successful updates.
- **Resolution**: Added `useAuth` + `logAuditEvent()` with `createFieldChanges()` to EditUserDialog. Tracks all field changes (permissions, status, department, etc.) with admin actor attribution. Also writes `updatedBy` for Cloud Function actor resolution (SP-26).

#### AA-19: Claims Validation Doesn't Check permissions2 Existence — VERIFIED RESOLVED

- **Category**: Security
- **File**: `apps/web/src/contexts/AuthContext.tsx` (lines 50-57)
- **Issue**: `validateClaims` checks `permissions` is a number but doesn't validate `permissions2`. Extended permissions unavailable client-side.
- **Recommendation**: Default `permissions2` to 0 if not present in claims.
- **Resolution**: Verified — `validateClaims()` already defaults `permissions2` to 0: `permissions2: typeof claimsObj.permissions2 === 'number' ? claimsObj.permissions2 : 0`.

### LOW

#### AA-9: PERMISSION_PRESETS Not Used in EditUserDialog

- **Category**: UX
- **File**: `apps/web/src/components/admin/EditUserDialog.tsx` (line 51)
- **Issue**: `PERMISSION_PRESETS` imported but unused. ApproveUserDialog has quick presets; EditUserDialog requires manual checkbox selection.
- **Recommendation**: Add "Quick Presets" section to EditUserDialog.

#### AA-10: isAdmin Variable Name Misleading in ApproveUserDialog

- **Category**: Code Quality
- **File**: `apps/web/src/components/admin/ApproveUserDialog.tsx` (line 92)
- **Issue**: `const isAdmin = hasPermission(permissions, ...)` checks if the user being approved will be admin, not if the approver is admin. Confusing name.
- **Recommendation**: Rename to `isBeingApprovedAsAdmin` or `willBeAdmin`.

#### AA-11: console.error Leaks Error Details to Browser Console

- **Category**: Security
- **Files**: `ApproveUserDialog.tsx` (lines 173, 210, 244), `EditUserDialog.tsx` (line 244)
- **Issue**: `console.error('Error approving user:', err)` logs full error objects which could contain sensitive information.
- **Recommendation**: Use `logger.error()` instead, which handles sanitization.

#### AA-12: Missing permissions2 in Manual syncUserClaims — VERIFIED RESOLVED

- **Category**: Security
- **File**: `packages/functions/src/index.ts` (lines 188-192)
- **Issue**: Manual `syncUserClaims` callable function also doesn't include `permissions2` in custom claims (same as AA-3).
- **Recommendation**: Add `permissions2` to custom claims in syncUserClaims as well.
- **Resolution**: Verified — `syncUserClaims` already destructures `permissions2` (line 192), normalizes it (line 199), and includes it in custom claims when non-zero (lines 206-208).

#### AA-13: getAllPermissions Missing from Types Package

- **Category**: Code Quality
- **File**: `packages/types/src/permissions.ts` (lines 145-166)
- **Issue**: Types defines role-based presets but no `getAllPermissions()`. Super-admin layout imports from constants, but consistency is missing.
- **Recommendation**: Delete duplicate `types/permissions.ts` or add missing function.

#### AA-14: Missing Admin Permission for Audit Log Access — VERIFIED RESOLVED

- **Category**: Security
- **File**: `firestore.rules` (lines 957-960)
- **Issue**: Audit logs readable by any admin (MANAGE_USERS). No separate AUDIT_READ permission. Write rules might not be restrictive enough.
- **Recommendation**: Add explicit `allow write: if false;` to ensure audit logs are append-only.
- **Resolution**: Verified rules are correct: `allow read: if isAdmin()`, `allow create: if isInternalUser()`, `allow update, delete: if false`. Audit logs are immutable (append-only). The `isInternalUser()` create rule is needed for client-side `logAuditEvent()` calls.

#### AA-15: E2E Testing Helpers Expose Auth Methods to window

- **Category**: Security
- **File**: `apps/web/src/contexts/AuthContext.tsx` (lines 86-136)
- **Issue**: When `NEXT_PUBLIC_USE_EMULATOR === 'true'`, test sign-in methods exposed to `window.__e2eSignIn`.
- **Recommendation**: Add build-time check to ensure flag is never true in production.

#### AA-16: No Rate Limiting on Permission Update Endpoints

- **Category**: Security
- **File**: `apps/web/src/components/admin/EditUserDialog.tsx` (lines 223-233)
- **Issue**: `updateDoc` called without rate limiting. Rapid updates could create audit log spam.
- **Recommendation**: Add client-side debouncing or server-side rate limiting.

#### AA-17: Permissions2 Field Lacks Type Check in Cloud Function

- **Category**: Code Quality
- **File**: `packages/functions/src/index.ts` (line 87)
- **Issue**: `onUserUpdate` destructures `permissions` without null/undefined checks. Malformed user documents could set claims with undefined values.
- **Recommendation**: Add explicit null checks for both `permissions` and `permissions2`.

#### AA-20: Rejection of Users Doesn't Set Explicit Reason

- **Category**: UX
- **File**: `apps/web/src/components/admin/ApproveUserDialog.tsx` (lines 200-205)
- **Issue**: Rejecting a user only sets `status: 'inactive'`. No field for rejection reason or notes.
- **Recommendation**: Add optional `rejectionReason` field and textarea in rejection dialog.

## Summary

| Severity | Count | Key Areas                                              |
| -------- | ----- | ------------------------------------------------------ |
| CRITICAL | 1     | Security (1)                                           |
| HIGH     | 1     | Security (1)                                           |
| MEDIUM   | 8     | Security (6), UX (1), Compliance (1)                   |
| LOW      | 10    | Security (4), Code Quality (3), UX (2), Compliance (1) |

## Priority Fix Order

1. ~~**AA-3 + AA-12**: Add `permissions2` to custom claims sync~~ — VERIFIED RESOLVED (already implemented)
2. **AA-5 + AA-7**: Implement immediate session revocation on deactivation/permission change
3. ~~**AA-1**: Consolidate permission constants to single source of truth~~ — FIXED `29f684f`
4. ~~**AA-18**: Add proper MANAGE_ADMIN permission structure~~ — FIXED `5bafc70`
5. **AA-8**: Add audit logging for permission changes
