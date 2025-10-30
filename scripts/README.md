# Utility Scripts

This folder contains utility scripts for managing the VDT-Unified platform. Scripts are organized by category for easier maintenance and discovery.

## ⚠️ CRITICAL: Database Change Workflow

**BEFORE making ANY Firestore query changes, follow this workflow:**

```bash
# 1. Run pre-flight check (checks schema, indexes, backward compatibility)
bash scripts/preflight/check-before-db-change.sh entities

# 2. Review schema analysis output - DO NOT SKIP THIS
# 3. Plan backward-compatible implementation
# 4. Deploy in strict order: Indexes → Code → Migration
```

**Why this matters:** A simple UI change (card view → list view) can break production if:
- Existing documents don't have fields you're querying
- Required Firestore composite indexes don't exist
- Types don't match actual database state

See **[docs/WORKFLOW_ANALYSIS.md](../docs/WORKFLOW_ANALYSIS.md)** for complete guidance.

## Directory Structure

```
scripts/
├── analysis/           # Schema analysis and validation (NEW)
├── audit/              # Audit log verification and management
├── deployment/         # Deployment scripts for Firebase services
├── migrations/         # Database migrations (NEW)
├── permissions/        # Permission and role management scripts
├── preflight/          # Pre-deployment checks (NEW)
├── testing/           # Testing and trigger scripts for development
└── user-management/   # User creation, migration, and debugging
```

---

## Analysis Scripts (`analysis/`) - NEW

### `check-entity-schema.js`
Analyze entity collection schema to identify inconsistencies.

**Usage:**
```bash
node scripts/analysis/check-entity-schema.js
```

**Purpose:**
- Check which fields exist in which documents
- Identify missing required/recommended fields
- Detect schema inconsistencies before making query changes
- Get field coverage percentages
- Generate recommendations for migrations

**When to use:**
- BEFORE modifying any Firestore queries on entities collection
- BEFORE deploying code that adds new field filters
- When debugging "no data showing" issues
- During data migration planning

---

## Migrations Scripts (`migrations/`) - NEW

### `add-isDeleted-to-entities.js`
Add isDeleted field to entities that don't have it.

**Usage:**
```bash
node scripts/migrations/add-isDeleted-to-entities.js
```

**Purpose:**
- Migrate existing entities to support soft-delete functionality
- Add missing `isDeleted: false` to all entities
- Ensure backward compatibility with new queries

**Safety:**
- Dry-run mode available
- Shows progress and results
- Only updates documents missing the field

---

## Pre-Flight Scripts (`preflight/`) - NEW

### `check-before-db-change.sh`
Pre-flight checklist for database-related changes.

**Usage:**
```bash
bash scripts/preflight/check-before-db-change.sh entities
```

**Purpose:**
- Run schema analysis automatically
- Display manual checklist of things to verify
- Remind about common gotchas
- Ensure proper deployment order

**When to use:**
- ALWAYS before making Firestore query changes
- Before adding where() clauses
- Before changing orderBy() fields
- Before deploying code that assumes fields exist

---

## Audit Scripts (`audit/`)

### `check-audit-logs.js`
View recent audit log entries from Firestore.

**Usage:**
```bash
node scripts/audit/check-audit-logs.js
```

**Purpose:**
- Verify the audit logging system is working correctly
- View recent security and compliance events
- Debug audit trail issues

**Output:**
- Last 10 audit log entries with full details
- Actor information, actions performed, and changes made
- Timestamps and severity levels

---

## Deployment Scripts (`deployment/`)

### `deploy-firestore.bat` (Windows)
Deploy Firestore rules and indexes to Firebase.

**Usage:**
```bash
scripts\deployment\deploy-firestore.bat
```

**Purpose:**
- Deploy security rules changes
- Deploy index definitions
- Update database schema

### `deploy-functions.bat` (Windows)
Deploy Cloud Functions to Firebase.

**Usage:**
```bash
scripts\deployment\deploy-functions.bat
```

**Purpose:**
- Deploy Cloud Functions updates
- Update function triggers and configurations

---

## Permission Scripts (`permissions/`)

### `add-project-permissions.js`
Add project-based permissions to the system.

**Usage:**
```bash
node scripts/permissions/add-project-permissions.js
```

**Purpose:** Configure project-level access controls and permissions.

### `check-all-permissions.js`
Verify all users have correct permissions based on their roles.

**Usage:**
```bash
node scripts/permissions/check-all-permissions.js
```

**Purpose:**
- Audit permission consistency across all users
- Identify users with missing or incorrect permissions
- Verify role-to-permission mappings

### `check-user-permissions.js`
Check specific user's permission configuration.

**Usage:**
```bash
node scripts/permissions/check-user-permissions.js
```

**Purpose:**
- Debug individual user permission issues
- View detailed permission breakdown
- Verify custom claims match expected permissions

### `grant-entity-permissions.js`
Grant entity-level permissions to users.

**Usage:**
```bash
node scripts/permissions/grant-entity-permissions.js
```

**Purpose:**
- Configure entity-specific access controls
- Grant permissions for suppliers, clients, partners

### `reset-permissions-to-roles.js`
Reset all user permissions to match their current roles.

**Usage:**
```bash
node scripts/permissions/reset-permissions-to-roles.js
```

**Purpose:**
- Fix permission inconsistencies across all users
- Recalculate permissions based on current role definitions
- Recovery tool after permission system updates

---

## Testing Scripts (`testing/`)

### `test-role-change.js`
Test role assignment and permission updates.

**Usage:**
```bash
node scripts/testing/test-role-change.js
```

**Purpose:**
- Verify Cloud Function triggers correctly on role changes
- Test permission recalculation
- Validate audit logging for role changes

### `trigger-claims-update.js`
Manually trigger custom claims update for a user.

**Usage:**
```bash
node scripts/testing/trigger-claims-update.js
```

**Purpose:**
- Force refresh of user custom claims
- Test claims synchronization
- Debug claims not updating

### `trigger-force-update.js`
Force update all user documents to trigger Cloud Functions.

**Usage:**
```bash
node scripts/testing/trigger-force-update.js
```

**Purpose:**
- Batch trigger Cloud Function for all users
- Useful after Cloud Function updates
- Mass permission resync

### `trigger-one-user.js`
Trigger Cloud Function for a single specific user.

**Usage:**
```bash
# Edit script to set user ID
node scripts/testing/trigger-one-user.js
```

**Purpose:**
- Debug Cloud Function for specific user
- Test permission updates for individual users

### `trigger-permission-sync.js`
Synchronize permissions for all users.

**Usage:**
```bash
node scripts/testing/trigger-permission-sync.js
```

**Purpose:**
- Mass update all user permissions
- Verify audit logging at scale
- Performance testing

### `trigger-wait-longer.js`
Trigger updates with longer wait times for debugging.

**Usage:**
```bash
node scripts/testing/trigger-wait-longer.js
```

**Purpose:**
- Debug timing-related issues
- Allow time to observe Cloud Function execution
- Test asynchronous operations

---

## User Management Scripts (`user-management/`)

### `check-all-users-data.js`
Display comprehensive data for all users.

**Usage:**
```bash
node scripts/user-management/check-all-users-data.js
```

**Purpose:**
- Get complete overview of all users
- View Auth data, Firestore documents, and claims
- Export user data for reporting

### `check-kumaran-simple.js`
Check specific user configuration (Kumaran).

**Usage:**
```bash
node scripts/user-management/check-kumaran-simple.js
```

**Purpose:**
- Debug specific user setup
- Simplified user data view

### `check-user-claims.js`
Check the current custom claims for a user.

**Usage:**
```bash
node scripts/user-management/check-user-claims.js <email@vapourdesal.com>
# Example: node scripts/user-management/check-user-claims.js sekkizhar@vapourdesal.com
```

**Purpose:**
- View what custom claims (roles, permissions, domain) are currently set for a user in Firebase Authentication
- Debug claims-related issues
- Verify claims match Firestore data

### `check-user-for-pm.js`
Check user configuration for Project Manager role.

**Usage:**
```bash
node scripts/user-management/check-user-for-pm.js
```

**Purpose:**
- Verify Project Manager permissions
- Debug PM-specific issues

### `create-pending-user.js`
Create a pending user document in Firestore for an existing Firebase Auth user.

**Usage:**
```bash
# Edit the script to set the user email
node scripts/user-management/create-pending-user.js
```

**Purpose:**
- Manually create Firestore user documents for users who signed up before the auto-creation feature was added
- Set up initial user state as "pending" for approval workflow

### `debug-user.js`
Comprehensive debugging information for a specific user.

**Usage:**
```bash
# Edit script to set user email
node scripts/user-management/debug-user.js
```

**Purpose:**
- Deep dive into user configuration
- View all data sources (Auth, Firestore, claims)
- Identify discrepancies

### `fix-all-users-domain.js`
Fix domain field for all users based on email.

**Usage:**
```bash
node scripts/user-management/fix-all-users-domain.js
```

**Purpose:**
- Correct domain assignments (internal/external)
- Data migration after domain logic changes
- Bulk fix for domain-related issues

### `list-all-users.js`
List all users in Firebase Authentication and their Firestore data.

**Usage:**
```bash
node scripts/user-management/list-all-users.js
```

**Purpose:**
- Get a complete overview of all users
- View Firebase Auth data, Firestore user documents, custom claims
- Export user lists
- User audit and reporting

### `migrate-user-data.js`
Migrate user data between schema versions.

**Usage:**
```bash
node scripts/user-management/migrate-user-data.js
```

**Purpose:**
- Update user documents after schema changes
- Add new required fields to existing users
- Data migration for system upgrades

### `set-admin-claims.js`
Set custom claims for a user by email.

**Usage:**
```bash
node scripts/user-management/set-admin-claims.js <email@vapourdesal.com> <ROLE>
# Example: node scripts/user-management/set-admin-claims.js sekkizhar@vapourdesal.com SUPER_ADMIN
```

**Purpose:**
- Manually set Firebase custom claims for users
- Useful for:
  - Setting up the first admin user
  - Manually fixing claims if the Cloud Function fails
  - Testing different permission combinations

### `update-all-users-domain.js`
Update domain field for all users.

**Usage:**
```bash
node scripts/user-management/update-all-users-domain.js
```

**Purpose:**
- Recalculate and update domains for all users
- Verify domain logic is correctly applied
- Mass update after domain rules change

---

## Prerequisites

All scripts require:
- Node.js 18 or later
- Firebase Admin credentials (`serviceAccountKey.json` in project root)
- Firebase project ID: `vapour-toolbox`

## Important Notes

- **Automatic Management**: The Cloud Function `onUserUpdate` now handles most user management automatically. These scripts are primarily for:
  - Manual intervention when needed
  - Debugging and troubleshooting
  - Testing and development
  - Data migration and bulk operations

- **Safety**: Always test scripts in a development environment first before running in production

- **Audit Logging**: Most operations performed by these scripts are logged in the audit trail for compliance

- **Service Account**: Keep `serviceAccountKey.json` secure and never commit to version control

## Common Workflows

### Setting Up First Admin User
```bash
# 1. List all users to find the email
node scripts/user-management/list-all-users.js

# 2. Set admin claims (replace with actual email)
node scripts/user-management/set-admin-claims.js <your-email@vapourdesal.com> SUPER_ADMIN

# 3. Verify claims were set
node scripts/user-management/check-user-claims.js <your-email@vapourdesal.com>
```

### Fixing Permission Issues
```bash
# 1. Check current permissions
node scripts/permissions/check-all-permissions.js

# 2. Reset to match current roles
node scripts/permissions/reset-permissions-to-roles.js

# 3. Verify fix
node scripts/permissions/check-all-permissions.js
```

### Verifying Audit Logs
```bash
# 1. Check recent audit entries
node scripts/audit/check-audit-logs.js

# 2. Trigger test events
node scripts/testing/test-role-change.js

# 3. Verify logs captured the events
node scripts/audit/check-audit-logs.js
```

### Data Migration
```bash
# 1. Backup current data (manual Firebase export recommended)

# 2. Run migration script
node scripts/user-management/migrate-user-data.js

# 3. Verify migration
node scripts/user-management/list-all-users.js

# 4. Reset permissions if needed
node scripts/permissions/reset-permissions-to-roles.js
```

---

**Last Updated**: October 2025
**Maintainer**: Development Team
