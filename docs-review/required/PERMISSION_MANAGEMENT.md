# Permission Management System

## Overview

This document explains the permission management system, the systemic issue that was discovered and fixed, and how to maintain permission consistency going forward.

## The Problem

### Original Issue (October 31, 2025)

When new granular accounting permissions (bits 20-25) were added to the role definitions in `packages/constants/src/permissions.ts`, existing users did not automatically receive these new permissions.

#### Root Cause

The Cloud Function `onUserUpdate` (in `functions/src/userManagement.ts`) had an early-return optimization that prevented permission recalculation unless specific fields changed:

```typescript
// OLD CODE (REMOVED):
if (!rolesChanged && !statusChanged && !emailChanged && !permissionsChanged) {
  return; // ← EARLY RETURN - skipped permission recalculation
}
```

**Impact:**

- When permission definitions were updated, existing users retained their old permission values
- This created "permission schema drift" between the code and the database
- Users were stuck with outdated permissions until they were manually updated

### The Fix

**Three-part solution implemented:**

1. **Removed Early-Return Logic** (functions/src/userManagement.ts:functions/src/userManagement.ts:251-254)
   - Cloud Function now ALWAYS recalculates permissions from roles
   - Ensures permissions stay in sync with role definitions
   - Any document write will trigger permission update

2. **Migration Script** (scripts/migrate-permissions.js)
   - One-time script to update all users with correct permissions
   - Recalculates permissions from current role definitions
   - Supports dry-run mode for safety

3. **Audit Script** (scripts/audit-permissions.js)
   - Validates permission consistency across all users
   - Reports any mismatches between actual and expected permissions
   - Can be run periodically to catch drift

---

## Permission System Architecture

### Bitwise Permissions

Permissions are stored as a single integer using bitwise flags (bits 0-25):

```javascript
Bit  0: MANAGE_USERS          (1)
Bit  1: VIEW_USERS            (2)
Bit  2: MANAGE_ROLES          (4)
...
Bit 20: MANAGE_CHART_OF_ACCOUNTS (1048576)
Bit 21: CREATE_TRANSACTIONS      (2097152)
Bit 22: APPROVE_TRANSACTIONS     (4194304)
Bit 23: VIEW_FINANCIAL_REPORTS   (8388608)
Bit 24: MANAGE_COST_CENTRES      (16777216)
Bit 25: MANAGE_FOREX             (33554432)
```

**Example:** SUPER_ADMIN has all 26 bits enabled = **67108863** (2^26 - 1)

### Source of Truth

**Single Source of Truth:** `packages/constants/src/permissions.ts`

**Synchronized Locations:**

- `functions/src/userManagement.ts` - Cloud Function (auto-syncs to Auth claims)
- `scripts/migrate-permissions.js` - Migration script
- `scripts/audit-permissions.js` - Audit script

**⚠️ IMPORTANT:** When updating permission definitions, you must update ALL three locations to maintain consistency.

### Permission Flow

```
1. User Document Updated (Firestore)
   ↓
2. onUserUpdate Cloud Function Triggered
   ↓
3. Recalculate Permissions from Roles
   ↓
4. Update Firestore User Document (permissions field)
   ↓
5. Update Firebase Auth Custom Claims
   ↓
6. User Refreshes Token (logout/login)
   ↓
7. Client Receives Updated Permissions
```

---

## Scripts

### 1. Migration Script (`migrate-permissions.js`)

**Purpose:** Update all users' permissions to match current role definitions.

**Usage:**

```bash
# Preview changes (dry-run mode - recommended first)
node scripts/migrate-permissions.js --dry-run

# Apply changes to production
node scripts/migrate-permissions.js
```

**When to Use:**

- After adding new permission bits to role definitions
- After discovering permission inconsistencies
- As part of a permission schema upgrade

**What It Does:**

1. Fetches all users from Firestore
2. Recalculates expected permissions from their roles
3. Compares actual vs. expected permissions
4. Updates mismatched users (triggers Cloud Function)
5. Logs all changes for audit trail

**Output Example:**

```
🔄 [user@vapourdesal.com]
   Roles: DIRECTOR
   Current:  1048575 (0b00011111111111111111)
   Expected: 67108863 (0b11111111111111111111111111)
   Diff:     +66060288
   ✅ Updated
```

### 2. Audit Script (`audit-permissions.js`)

**Purpose:** Validate that all users' permissions match their role definitions.

**Usage:**

```bash
# Run permission audit
node scripts/audit-permissions.js
```

**When to Use:**

- Periodically (monthly/quarterly) to catch drift
- After permission schema changes
- Before major deployments
- To verify migration script results

**What It Does:**

1. Fetches all users from Firestore
2. Calculates expected permissions from their roles
3. Identifies mismatches (missing or extra permissions)
4. Generates detailed report with recommendations

**Output Example:**

```
❌ user@vapourdesal.com
   Roles: FINANCE_MANAGER
   Current:  131071 (0b00011111111111111111)
   Expected: 67108863 (0b11111111111111111111111111)
   Missing:  66977792 (0b11111100000000000000000000)
             MANAGE_CHART_OF_ACCOUNTS, CREATE_TRANSACTIONS,
             APPROVE_TRANSACTIONS, VIEW_FINANCIAL_REPORTS,
             MANAGE_COST_CENTRES, MANAGE_FOREX
```

---

## Maintenance Procedures

### Adding New Permission Bits

When adding new permission bits, follow these steps:

1. **Update Source of Truth**
   - Edit `packages/constants/src/permissions.ts`
   - Add new permission flag(s)
   - Update role mappings

2. **Sync Cloud Function**
   - Edit `functions/src/userManagement.ts`
   - Copy PERMISSION_FLAGS from packages/constants
   - Copy ROLE_PERMISSIONS from packages/constants
   - Deploy: `cd functions && firebase deploy --only functions:onUserUpdate`

3. **Sync Migration Script**
   - Edit `scripts/migrate-permissions.js`
   - Copy PERMISSION_FLAGS from packages/constants
   - Copy ROLE_PERMISSIONS from packages/constants

4. **Sync Audit Script**
   - Edit `scripts/audit-permissions.js`
   - Copy PERMISSION_FLAGS from packages/constants
   - Copy ROLE_PERMISSIONS from packages/constants

5. **Migrate Existing Users**

   ```bash
   # Preview changes
   node scripts/migrate-permissions.js --dry-run

   # Apply changes
   node scripts/migrate-permissions.js
   ```

6. **Verify Results**
   ```bash
   # Run audit to confirm all users updated
   node scripts/audit-permissions.js
   ```

### Regular Audits

**Recommended Schedule:**

- **Monthly:** Run audit script to catch drift
- **Before Releases:** Verify permission consistency
- **After Schema Changes:** Confirm successful migration

```bash
# Monthly audit command
node scripts/audit-permissions.js > audits/audit-$(date +%Y-%m-%d).log
```

---

## Troubleshooting

### Script Authentication Errors

**Error:**

```
Error: Unable to detect a Project Id in the current environment
```

**Solution:**
Scripts require Firebase service account credentials. Run from a machine with:

- Firebase CLI logged in (`firebase login`)
- Service account key file (set `GOOGLE_APPLICATION_CREDENTIALS`)

**Alternative:** Run scripts in Cloud Functions or Cloud Shell where credentials are automatic.

### Permission Not Updating

**Symptoms:**

- Migration script shows "Updated" but permissions unchanged in Firestore
- Audit script still shows mismatches

**Possible Causes:**

1. **Cloud Function Outdated**
   - Check `functions/src/userManagement.ts` has latest permission definitions
   - Redeploy: `cd functions && firebase deploy --only functions:onUserUpdate`

2. **User Token Not Refreshed**
   - Changes require user to log out and log back in
   - Or wait for token to expire (~1 hour)

3. **Cloud Function Error**
   - Check logs: `firebase functions:log --only onUserUpdate`
   - Look for errors during permission recalculation

### Audit Shows Extra Permissions

**Meaning:** User has more permissions than their role should grant.

**Common Causes:**

- Role was downgraded but user hasn't logged in since
- Manual permission override in Firestore (not recommended)

**Fix:** Run migration script to recalculate from roles.

### Audit Shows Missing Permissions

**Meaning:** User has fewer permissions than their role should grant.

**Common Causes:**

- Permission schema was updated but user not migrated
- Role was upgraded but Cloud Function didn't trigger

**Fix:** Run migration script to recalculate from roles.

---

## Best Practices

### 1. Always Use Dry-Run First

```bash
# ALWAYS run with --dry-run first
node scripts/migrate-permissions.js --dry-run

# Review output carefully

# Then run without --dry-run
node scripts/migrate-permissions.js
```

### 2. Keep Definitions in Sync

**DO:**

- Update `packages/constants/src/permissions.ts` first (source of truth)
- Copy to all three locations (Cloud Function, migration script, audit script)
- Deploy Cloud Function immediately after updating

**DON'T:**

- Manually edit permissions in Firestore (they'll be overwritten)
- Update only one location (creates inconsistency)
- Skip migration script after schema changes

### 3. Document Changes

Create a git commit message explaining:

- Which permissions were added/changed
- Which roles are affected
- Expected impact on users

Example:

```
feat: add granular accounting permissions (bits 20-25)

- Added MANAGE_CHART_OF_ACCOUNTS, CREATE_TRANSACTIONS,
  APPROVE_TRANSACTIONS, VIEW_FINANCIAL_REPORTS,
  MANAGE_COST_CENTRES, MANAGE_FOREX

- Updated roles: SUPER_ADMIN, DIRECTOR, FINANCE_MANAGER, ACCOUNTANT

- Impact: ~15 users will receive new accounting permissions
  after migration script runs

Migration: node scripts/migrate-permissions.js
```

### 4. Test in Development First

Before running migration in production:

1. Test with Firebase emulator
2. Run dry-run against production
3. Verify expected changes match reality
4. Have rollback plan ready

---

## Migration History

### 2025-10-31: Granular Accounting Permissions

**Changes:**

- Added bits 20-25 for granular accounting control
- Removed early-return optimization from Cloud Function
- Created migration and audit scripts

**Permissions Added:**

- MANAGE_CHART_OF_ACCOUNTS (bit 20: 1048576)
- CREATE_TRANSACTIONS (bit 21: 2097152)
- APPROVE_TRANSACTIONS (bit 22: 4194304)
- VIEW_FINANCIAL_REPORTS (bit 23: 8388608)
- MANAGE_COST_CENTRES (bit 24: 16777216)
- MANAGE_FOREX (bit 25: 33554432)

**Roles Updated:**

- SUPER_ADMIN: All bits (67108863)
- DIRECTOR: Added bits 20-25
- FINANCE_MANAGER: Added bits 20-25
- ACCOUNTANT: Added bits 21, 23 (removed MANAGE_ACCOUNTING)

**Files Changed:**

- `packages/constants/src/permissions.ts`
- `functions/src/userManagement.ts`
- Created: `scripts/migrate-permissions.js`
- Created: `scripts/audit-permissions.js`
- Created: `scripts/PERMISSION_MANAGEMENT.md`

---

## Future Improvements

### Automated Testing

Create tests to ensure:

- Permission calculations match across all locations
- No permission bits overlap
- All roles have valid permission combinations

### Schema Version Tracking

Add `permissionSchemaVersion` field to track:

- Which version of permissions each user has
- Automatic migration triggers when version changes
- Audit trail of schema evolution

### Web UI for Permission Management

Build admin interface for:

- Viewing current permission schema
- Comparing user permissions vs. role definitions
- Triggering migrations
- Running audits with visual reports

---

## Support

For questions or issues with the permission system:

1. Check Cloud Function logs: `firebase functions:log --only onUserUpdate`
2. Run audit script to diagnose: `node scripts/audit-permissions.js`
3. Review this documentation
4. Check git history for recent permission changes

---

**Last Updated:** October 31, 2025
**Version:** 1.0
**Author:** Claude Code (System Maintenance)
