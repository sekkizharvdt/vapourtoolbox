# Database Management System

## Overview

This document describes the comprehensive database management system for the VDT-Unified project. This system was created to prevent common database-related issues and ensure schema consistency across all 29 Firestore collections.

## Table of Contents

1. [Why This System Exists](#why-this-system-exists)
2. [The 30-Minute Rule](#the-30-minute-rule)
3. [System Components](#system-components)
4. [Workflow for Database Changes](#workflow-for-database-changes)
5. [Tool Usage Guide](#tool-usage-guide)
6. [Schema Registry](#schema-registry)
7. [Migration Guide](#migration-guide)
8. [Pre-flight Checks](#pre-flight-checks)
9. [Common Scenarios](#common-scenarios)
10. [Troubleshooting](#troubleshooting)

---

## Why This System Exists

### The Problem

Previously, a simple UI change (switching from card view to list view) caused cascading issues:
- Missing Firestore composite indexes
- Documents missing required fields
- Query failures due to backward incompatibility
- Hours of debugging and fixing

### The Root Cause

Changes were made **code-first** without analyzing the database impact:
1. Changed UI component (cards → table)
2. Changed query (added `orderBy` + `where`)
3. Deployed → **Index error**
4. Created index → **Missing field error**
5. Fixed field → **Old documents still broken**

### The Solution

This database management system enforces a **database-first** workflow:
1. **Analyze** before changing
2. **Design** the migration path
3. **Implement** with safeguards
4. **Deploy** with confidence

---

## The 30-Minute Rule

**Spend 30 minutes analyzing BEFORE coding to save hours of debugging.**

Before making ANY database-related change, ask:

```bash
# Run schema analysis first
node scripts/analysis/analyze-collection-schema.js entities

# Review the output:
# - Field coverage percentages
# - Missing required fields
# - Deprecated fields
# - Migration recommendations
```

**Key Questions:**
1. Does this collection have the field I need?
2. What percentage of documents have this field?
3. Will my query exclude documents without this field?
4. Do I need a Firestore composite index?
5. Do I need a migration to add missing fields?

---

## System Components

### 1. Schema Registry
**Location**: `scripts/config/schema-registry.js`

Central schema definitions for all 29 collections:
- **Required fields** - Must exist in all documents
- **Recommended fields** - Should exist (80%+ coverage)
- **Optional fields** - Can exist
- **Deprecated fields** - Being phased out

### 2. Schema Analyzer
**Location**: `scripts/analysis/analyze-collection-schema.js`

Universal tool that analyzes ANY collection:
- Field coverage percentages
- Missing required/recommended fields
- Deprecation warnings
- Migration recommendations
- Exit code 1 if high-severity issues found

### 3. Migration Framework
**Location**: `scripts/migrations/migration-framework.js`

Robust migration system with:
- Migration tracking in Firestore (`system_migrations` collection)
- Dry-run mode for testing
- Batch processing (default 500 documents)
- Progress reporting
- Error handling and recovery

### 4. Migration Template
**Location**: `scripts/migrations/migrations/_TEMPLATE.js`

Template for creating new migrations with:
- Best practices built-in
- Batch processing logic
- Dry-run support
- Statistics tracking
- Error handling

### 5. Pre-deployment Check
**Location**: `scripts/preflight/pre-deployment-check.js`

Comprehensive checks before deployment:
1. **TypeScript Build** - Ensure code compiles
2. **Schema Consistency** - Check required fields exist
3. **Firestore Indexes** - Verify indexes defined
4. **Environment Configuration** - Check required files
5. **Code Quality** - Warn about console.log, TODOs
6. **Recent Query Changes** - Detect query modifications

### 6. Pre-flight Checklist
**Location**: `scripts/preflight/check-before-db-change.sh`

Quick checklist for database changes:
- Runs schema analysis
- Lists recommended actions
- Provides migration guidance

---

## Workflow for Database Changes

### Phase 1: Discovery (30 minutes)

**BEFORE writing any code:**

```bash
# 1. Analyze the collection schema
node scripts/analysis/analyze-collection-schema.js entities

# 2. Review the output carefully
# - What fields exist?
# - What fields are missing?
# - What's the field coverage percentage?

# 3. Check if query needs a composite index
# Rule: Any query with where() + orderBy() on DIFFERENT fields needs an index
```

**Questions to Answer:**
- [ ] Does the field I need exist in 100% of documents?
- [ ] If not, can I handle missing fields in my query?
- [ ] Do I need a migration to add the field?
- [ ] Do I need a new Firestore composite index?
- [ ] Will this break existing queries or code?

### Phase 2: Design (15 minutes)

**Design the migration path:**

1. **For new required fields:**
   ```
   Plan: Create migration to add field with default value
   Timeline: Run migration BEFORE deploying new query
   Rollback: How to undo if needed
   ```

2. **For new composite indexes:**
   ```
   Plan: Add to firestore.indexes.json
   Timeline: Deploy index BEFORE deploying query
   Test: Verify index creation in Firebase Console
   ```

3. **For backward compatibility:**
   ```
   Option A: Client-side filtering (if (data.field !== value))
   Option B: Migration to ensure field exists in all docs
   Option C: Multiple queries with different strategies
   ```

### Phase 3: Implementation (coding time)

```bash
# 1. Create migration if needed
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/add-myfield.js

# Edit the migration file:
# - Set collection name
# - Define update logic
# - Add to MIGRATIONS registry in migration-framework.js

# 2. Test migration in dry-run mode
node scripts/migrations/migration-framework.js add-myfield --dry-run

# Review output:
# - How many documents will be updated?
# - Are there any errors?
# - Does the logic look correct?

# 3. Run migration (if needed)
node scripts/migrations/migration-framework.js add-myfield

# 4. Update schema registry
# Edit scripts/config/schema-registry.js
# Add new field to appropriate category (required/recommended/optional)

# 5. Update TypeScript types
# Edit packages/types/src/*.ts
# Add field to interface definition

# 6. Implement the code change
# Write your component/query with confidence
```

### Phase 4: Deployment

```bash
# 1. Run pre-deployment checks
node scripts/preflight/pre-deployment-check.js

# If checks fail:
# - Fix critical issues before deploying
# - Review warnings

# 2. Build the application
cd apps/web && pnpm build

# 3. Deploy to Firebase
firebase deploy

# 4. Monitor for errors
# - Check Firebase Console
# - Check application logs
# - Test critical user flows

# 5. If issues found:
# - Rollback deployment if critical
# - Fix forward if minor
```

---

## Tool Usage Guide

### Schema Analyzer

**Purpose**: Analyze field coverage and schema consistency

```bash
# Analyze a collection
node scripts/analysis/analyze-collection-schema.js entities

# Output includes:
# - Field coverage percentages with visual bars
# - Missing required fields (HIGH SEVERITY)
# - Missing recommended fields (MEDIUM SEVERITY)
# - Deprecated field warnings
# - Migration recommendations
# - Exit code 1 if critical issues found
```

**When to Use**:
- Before adding new queries to a collection
- Before adding new fields
- Before making schema changes
- During code review
- Before deployment

**Example Output**:
```
📈 FIELD COVERAGE REPORT
═══════════════════════════════════════════════════════════════════════════

🔴 Required Fields:
───────────────────────────────────────────────────────────────────────────
✅ id                          ████████████████████ 100.0% (150/150)
✅ code                        ████████████████████ 100.0% (150/150)
⚠️  isDeleted                  ██████████           52.7% (79/150)

💡 RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════

1. [HIGH] 47.3% of documents missing required field: isDeleted
   Action: Add migration to set default value for missing isDeleted
   Impact: Queries filtering on this field will exclude these documents
```

### Migration Framework

**Purpose**: Run tracked, testable migrations with dry-run support

```bash
# List all migrations and their status
node scripts/migrations/migration-framework.js list

# Run a migration in dry-run mode (no changes)
node scripts/migrations/migration-framework.js add-isDeleted-field --dry-run

# Run a migration for real
node scripts/migrations/migration-framework.js add-isDeleted-field

# Run with custom batch size (default 500)
node scripts/migrations/migration-framework.js add-isDeleted-field --batch-size=100
```

**When to Use**:
- Adding new required fields to existing documents
- Migrating data structure (e.g., single contact → contacts array)
- Removing deprecated fields
- Fixing data inconsistencies
- Normalizing data formats

**Creating a New Migration**:

```bash
# 1. Copy the template
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/add-newfield.js

# 2. Edit the migration file
# - Set name, description, collection
# - Define logic in run() function
# - Optionally implement rollback()

# 3. Register the migration
# Edit scripts/migrations/migration-framework.js
# Add to MIGRATIONS object:
const MIGRATIONS = {
  'add-isDeleted-field': require('./migrations/add-isDeleted-field'),
  'add-newfield': require('./migrations/add-newfield'),  // Add this line
};

# 4. Test in dry-run mode
node scripts/migrations/migration-framework.js add-newfield --dry-run

# 5. Run migration
node scripts/migrations/migration-framework.js add-newfield
```

### Pre-deployment Check

**Purpose**: Catch issues before deploying to production

```bash
# Run all checks
node scripts/preflight/pre-deployment-check.js

# Skip schema checks (faster)
node scripts/preflight/pre-deployment-check.js --skip-schema

# Skip build (if already built)
node scripts/preflight/pre-deployment-check.js --skip-build

# Skip both (minimal check)
node scripts/preflight/pre-deployment-check.js --skip-schema --skip-build
```

**Checks Performed**:

1. **Environment Configuration**
   - `firebase.json` exists
   - `firestore.rules` exists
   - `firestore.indexes.json` exists

2. **TypeScript Build**
   - Code compiles without errors
   - Next.js build succeeds

3. **Schema Consistency**
   - Important collections have required fields
   - Documents match expected schema

4. **Firestore Indexes**
   - `firestore.indexes.json` is valid JSON
   - Common indexes defined (entities, projects)

5. **Code Quality**
   - Warns about excessive console.log usage
   - Reports TODO count

6. **Recent Query Changes**
   - Detects query modifications in recent commits
   - Reminds to check schema compatibility and indexes

**When to Use**:
- **Always** before deploying to production
- Before creating a pull request
- After making database-related changes
- After adding new queries

---

## Schema Registry

**Location**: `scripts/config/schema-registry.js`

### Collections Covered

**Core Module** (11 collections):
- `users` - User accounts and profiles
- `companies` - Company/organization data
- `departments` - Department hierarchies
- `entities` - Business entities (customers/vendors/contractors)
- `entity_contacts` - Standalone contact records
- `projects` - Project records
- `project_activities` - Project activity logs
- `project_milestones` - Project milestones
- `invitations` - User invitations
- `notifications` - User notifications
- `audit_logs` - System audit trail

**Time Tracking Module** (4 collections):
- `tasks` - Task definitions
- `time_entries` - Time tracking entries
- `leaves` - Leave requests and records
- `on_duty` - On-duty records

**Accounting Module** (4 collections):
- `accounts` - Chart of accounts
- `transactions` - Financial transactions
- `journal_entries` - Journal entries
- `ledger_entries` - Ledger entries

**Procurement Module** (6 collections):
- `purchase_requisitions` - Purchase requests
- `rfqs` - Request for Quotations
- `quotations` - Vendor quotations
- `purchase_orders` - Purchase orders
- `pr_items` - PR line items

**Estimation Module** (3 collections):
- `estimates` - Project estimates
- `equipment` - Equipment catalog
- `components` - Component catalog

### Schema Field Categories

**Required Fields**: Must exist in 100% of documents
```javascript
required: ['id', 'code', 'name', 'status', 'createdAt', 'updatedAt']
```

**Recommended Fields**: Should exist in 80%+ of documents
```javascript
recommended: ['isDeleted', 'isActive', 'description']
```

**Optional Fields**: May exist, depends on use case
```javascript
optional: ['notes', 'tags', 'metadata']
```

**Deprecated Fields**: Being phased out, should not be used in new code
```javascript
deprecated: ['oldContactPerson', 'oldEmail']  // Replaced by contacts array
```

### Usage in Code

```javascript
const { getCollectionSchema } = require('../config/schema-registry');

// Get schema for a collection
const schema = getCollectionSchema('entities');

console.log(schema.required);      // ['id', 'code', 'name', ...]
console.log(schema.recommended);   // ['isDeleted', 'isActive', ...]
console.log(schema.optional);      // ['tags', 'notes', ...]
console.log(schema.deprecated);    // ['contactPerson', 'email', ...]
```

---

## Migration Guide

### When to Create a Migration

**Required**:
- Adding a new **required** field to an existing collection
- Changing data structure (e.g., string → array)
- Removing deprecated fields
- Fixing data inconsistencies

**Not Required**:
- Adding optional fields (can be added on write)
- Adding new collections (no existing data)
- Updating a few specific documents manually

### Migration Lifecycle

```
1. Create migration file
   ↓
2. Test with --dry-run
   ↓
3. Review output
   ↓
4. Run migration
   ↓
5. Check system_migrations collection
   ↓
6. Verify data in Firebase Console
   ↓
7. Deploy code changes
```

### Migration Template Structure

```javascript
module.exports = {
  name: 'migration-name',
  description: 'What this migration does',
  collection: 'collection_name',

  async run(db, options = {}) {
    const { dryRun = false, batchSize = 500 } = options;

    // 1. Get documents
    const snapshot = await db.collection(this.collection).get();

    // 2. Process in batches
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 3. Determine if needs migration
      if (needsMigration(data)) {
        // 4. Prepare update
        const updateData = {
          newField: defaultValue,
          updatedAt: admin.firestore.Timestamp.now()
        };

        if (!dryRun) {
          batch.update(doc.ref, updateData);
          batchCount++;

          // 5. Commit batch when full
          if (batchCount >= batchSize) {
            await batch.commit();
            batchCount = 0;
          }
        }

        stats.updated++;
      }
    }

    // 6. Commit remaining
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

    return stats;
  },

  async rollback(db) {
    // Optional: Implement if migration is reversible
  }
};
```

### Example: Adding isDeleted Field

**File**: `scripts/migrations/migrations/add-isDeleted-field.js`

```javascript
module.exports = {
  name: 'add-isDeleted-field',
  description: 'Add isDeleted field to entities collection',
  collection: 'entities',

  async run(db, options = {}) {
    const { dryRun = false, batchSize = 500 } = options;
    const stats = { total: 0, updated: 0, skipped: 0, errors: 0 };

    const snapshot = await db.collection('entities').get();
    stats.total = snapshot.size;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Check if field is missing
      if (data.isDeleted === undefined || data.isDeleted === null) {
        if (!dryRun) {
          batch.update(doc.ref, {
            isDeleted: false,
            updatedAt: admin.firestore.Timestamp.now()
          });
          batchCount++;

          if (batchCount >= batchSize) {
            await batch.commit();
            batchCount = 0;
          }
        }
        stats.updated++;
      } else {
        stats.skipped++;
      }
    }

    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

    return stats;
  }
};
```

### Testing Migrations

```bash
# Always test with --dry-run first
node scripts/migrations/migration-framework.js add-isDeleted-field --dry-run

# Review the output:
# - How many documents would be updated?
# - How many would be skipped?
# - Are there any errors?
# - Does the logic look correct?

# If satisfied, run for real
node scripts/migrations/migration-framework.js add-isDeleted-field
```

### Migration Tracking

Migrations are tracked in the `system_migrations` Firestore collection:

```javascript
{
  name: 'add-isDeleted-field',
  status: 'completed',  // or 'running', 'failed', 'dry-run'
  startedAt: Timestamp,
  completedAt: Timestamp,
  stats: {
    total: 150,
    updated: 71,
    skipped: 79,
    errors: 0
  }
}
```

**Re-running Migrations**:
To re-run a completed migration, delete the document from `system_migrations`:

```bash
# In Firebase Console:
# 1. Navigate to Firestore
# 2. Open system_migrations collection
# 3. Delete the migration document
# 4. Re-run the migration
```

---

## Pre-flight Checks

### When to Run

**Always**:
- Before deploying to production
- Before creating a pull request
- After making database changes

**Recommended**:
- Before committing code
- After adding new queries
- After schema changes

### Understanding the Output

#### Check 1: Environment Configuration
```
✅ firebase.json
✅ firestore.rules
✅ firestore.indexes.json
```
All required configuration files exist.

#### Check 2: TypeScript Build
```
✅ TypeScript compilation
✅ Next.js build
```
Code compiles without errors.

#### Check 3: Schema Consistency
```
✅ users required fields
✅ entities required fields
⚠️  projects required fields - Missing: isDeleted
```
Important collections checked for required fields.

#### Check 4: Firestore Indexes
```
✅ Indexes file valid (12 indexes defined)
✅ Entity indexes
✅ Project indexes
```
Composite indexes properly configured.

#### Check 5: Code Quality
```
⚠️  console.log usage - Found 23 occurrences (warning only)
ℹ️  Found 15 TODO comments (informational)
```
Non-critical quality warnings.

#### Check 6: Recent Query Changes
```
⚠️  Query changes detected in: apps/web/src/app/entities/page.tsx

⚠️  IMPORTANT: Query changes detected!
   Make sure to:
   1. Check schema compatibility
   2. Verify Firestore indexes exist
   3. Test with production-like data
```
Reminds you to check database compatibility.

### Exit Codes

- **Exit 0**: All checks passed or minor warnings only
- **Exit 1**: Critical issues found - DO NOT DEPLOY

---

## Common Scenarios

### Scenario 1: Adding a New Query Filter

**Example**: Add filter to show only active entities

```bash
# BEFORE writing code:

# 1. Check if 'isActive' field exists in all documents
node scripts/analysis/analyze-collection-schema.js entities

# Output shows:
# isActive - 52.7% (79/150) ← Problem! Only half have this field

# 2. Decide strategy:
# Option A: Client-side filter (handles missing field)
# Option B: Migration to add field to all documents

# Option A - Client-side filtering (quick fix):
const entitiesData = [];
snapshot.forEach((doc) => {
  const data = doc.data();
  // Include if isActive is true or undefined (backward compatible)
  if (data.isActive !== false) {
    entitiesData.push({ ...data, id: doc.id });
  }
});

# Option B - Migration (proper fix):

# a. Create migration
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/add-isActive-field.js

# b. Edit migration to set isActive: true for all entities

# c. Test migration
node scripts/migrations/migration-framework.js add-isActive-field --dry-run

# d. Run migration
node scripts/migrations/migration-framework.js add-isActive-field

# e. Now you can use server-side filtering safely
const q = query(
  collection(db, 'entities'),
  where('isActive', '==', true)
);
```

### Scenario 2: Changing Data Structure

**Example**: Migrate from single contact to contacts array

```javascript
// OLD SCHEMA (deprecated):
{
  contactPerson: 'John Doe',
  email: 'john@example.com',
  phone: '123-456-7890'
}

// NEW SCHEMA:
{
  contacts: [
    {
      id: 'generated-id',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      isPrimary: true
    }
  ],
  primaryContactId: 'generated-id'
}
```

**Migration Steps**:

```bash
# 1. Create migration
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/migrate-contacts-to-array.js

# 2. Edit migration:
```

```javascript
async run(db, options = {}) {
  const { dryRun = false, batchSize = 500 } = options;
  const stats = { total: 0, updated: 0, skipped: 0, errors: 0 };

  const snapshot = await db.collection('entities').get();
  stats.total = snapshot.size;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check if already migrated
    if (data.contacts && Array.isArray(data.contacts)) {
      stats.skipped++;
      continue;
    }

    // Check if has old contact fields
    if (data.contactPerson || data.email || data.phone) {
      const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const updateData = {
        contacts: [
          {
            id: contactId,
            name: data.contactPerson || 'Unknown',
            email: data.email || '',
            phone: data.phone || '',
            mobile: data.mobile || '',
            isPrimary: true,
            designation: data.designation || '',
            notes: ''
          }
        ],
        primaryContactId: contactId,
        updatedAt: admin.firestore.Timestamp.now()
      };

      if (!dryRun) {
        batch.update(doc.ref, updateData);
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batchCount = 0;
        }
      }
      stats.updated++;
    } else {
      stats.skipped++;
    }
  }

  if (batchCount > 0 && !dryRun) {
    await batch.commit();
  }

  return stats;
}
```

```bash
# 3. Update schema registry
# Edit scripts/config/schema-registry.js
# Move old fields to deprecated, add new fields to recommended

entities: {
  required: [...],
  recommended: ['contacts', 'primaryContactId', ...],
  optional: [...],
  deprecated: ['contactPerson', 'email', 'phone', 'mobile'],
}

# 4. Test migration
node scripts/migrations/migration-framework.js migrate-contacts-to-array --dry-run

# 5. Run migration
node scripts/migrations/migration-framework.js migrate-contacts-to-array

# 6. Update TypeScript types
# Add to packages/types/src/entity.ts:
contacts?: Array<{
  id: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}>;
primaryContactId?: string;

# 7. Update code to use new structure
# Continue using old fields as fallback for a grace period
```

### Scenario 3: Adding Composite Index

**Example**: Query entities by status and sort by creation date

```bash
# Code you want to write:
const q = query(
  collection(db, 'entities'),
  where('status', '==', 'active'),
  orderBy('createdAt', 'desc')
);

# This requires a composite index!

# 1. Add to firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "entities",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}

# 2. Deploy the index BEFORE deploying the code
firebase deploy --only firestore:indexes

# 3. Wait for index to build (check Firebase Console)

# 4. Verify index is ready
# Firebase Console → Firestore → Indexes
# Status should be "Enabled"

# 5. Now deploy the code that uses this query
firebase deploy --only hosting
```

### Scenario 4: Removing Deprecated Fields

**Example**: Clean up old contact fields after migration

```bash
# ONLY do this after:
# 1. Migration to new structure is complete
# 2. All code updated to use new structure
# 3. Grace period elapsed (e.g., 30 days)

# 1. Create migration
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/remove-deprecated-contact-fields.js

# 2. Edit migration:
```

```javascript
async run(db, options = {}) {
  const { dryRun = false, batchSize = 500 } = options;
  const stats = { total: 0, updated: 0, skipped: 0, errors: 0 };

  const snapshot = await db.collection('entities').get();
  stats.total = snapshot.size;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check if has deprecated fields
    const hasDeprecatedFields =
      'contactPerson' in data ||
      'email' in data ||
      'phone' in data ||
      'mobile' in data;

    if (hasDeprecatedFields) {
      // Verify new structure exists
      if (!data.contacts || !Array.isArray(data.contacts) || data.contacts.length === 0) {
        console.error(`⚠️  Document ${doc.id} has deprecated fields but no contacts array!`);
        stats.errors++;
        continue;
      }

      // Remove deprecated fields using FieldValue.delete()
      const updateData = {
        contactPerson: admin.firestore.FieldValue.delete(),
        email: admin.firestore.FieldValue.delete(),
        phone: admin.firestore.FieldValue.delete(),
        mobile: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      if (!dryRun) {
        batch.update(doc.ref, updateData);
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batchCount = 0;
        }
      }
      stats.updated++;
    } else {
      stats.skipped++;
    }
  }

  if (batchCount > 0 && !dryRun) {
    await batch.commit();
  }

  return stats;
}
```

```bash
# 3. Test thoroughly
node scripts/migrations/migration-framework.js remove-deprecated-contact-fields --dry-run

# 4. Backup database before running
# Firebase Console → Firestore → Import/Export

# 5. Run migration
node scripts/migrations/migration-framework.js remove-deprecated-contact-fields

# 6. Update schema registry
# Edit scripts/config/schema-registry.js
# Remove fields from deprecated array
```

---

## Troubleshooting

### Issue 1: Schema Analyzer Shows Missing Required Fields

**Symptom**:
```
🔴 HIGH SEVERITY (Missing Required Fields):
Field: "isDeleted" - Missing in 71 documents
```

**Solution**:
```bash
# Create and run migration to add the field
node scripts/migrations/migration-framework.js add-isDeleted-field --dry-run
node scripts/migrations/migration-framework.js add-isDeleted-field
```

### Issue 2: Query Fails with "Missing Index" Error

**Symptom**:
```
FirebaseError: The query requires an index.
```

**Solution**:
```bash
# 1. Click the link in the error (opens Firebase Console)
# OR manually add to firestore.indexes.json

# 2. Deploy the index
firebase deploy --only firestore:indexes

# 3. Wait for index to build (can take minutes)

# 4. Check status in Firebase Console → Firestore → Indexes
```

### Issue 3: Migration Fails with "Permission Denied"

**Symptom**:
```
❌ Migration failed: Permission denied
```

**Solution**:
```bash
# Re-authenticate with Firebase
firebase login

# Or use service account
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Issue 4: Documents Not Showing After Query Change

**Symptom**: Changed query from card view to list view, now some documents don't appear

**Root Cause**: Query filters out documents with missing fields

**Solution**:
```javascript
// BEFORE (excludes documents without isDeleted field):
const q = query(
  collection(db, 'entities'),
  where('isDeleted', '==', false),
  orderBy('createdAt', 'desc')
);

// AFTER (client-side filtering - backward compatible):
const q = query(
  collection(db, 'entities'),
  orderBy('createdAt', 'desc')
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const entitiesData = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Include if isDeleted is not true (handles undefined)
    if (data.isDeleted !== true) {
      entitiesData.push({ ...data, id: doc.id });
    }
  });
  setEntities(entitiesData);
});

// BEST (after running migration):
# Run migration to add isDeleted: false to all documents
# Then use server-side filtering safely
```

### Issue 5: Pre-deployment Check Fails

**Symptom**:
```
❌ Build failed - cannot deploy broken code
```

**Solution**:
```bash
# 1. Check the error output above the summary
# 2. Fix TypeScript errors
# 3. Re-run build
cd apps/web && pnpm build

# 4. Re-run pre-deployment check
node scripts/preflight/pre-deployment-check.js
```

### Issue 6: Migration Stuck or Taking Too Long

**Symptom**: Migration running for hours

**Solution**:
```bash
# 1. Check system_migrations collection for status
# If status is "running", check timestamp

# 2. If truly stuck, you can:
# a. Cancel the migration (Ctrl+C)
# b. Fix the issue in code
# c. Delete migration record from system_migrations
# d. Re-run migration

# 3. Use smaller batch size for large collections
node scripts/migrations/migration-framework.js my-migration --batch-size=100
```

---

## Quick Reference

### Before Making Database Changes

```bash
# 1. Analyze schema
node scripts/analysis/analyze-collection-schema.js <collection>

# 2. Run pre-flight checklist
bash scripts/preflight/check-before-db-change.sh <collection>

# 3. Answer the questions:
# - Does the field exist in 100% of documents?
# - Do I need a migration?
# - Do I need a composite index?
# - Will this break existing code?
```

### Creating a Migration

```bash
# 1. Copy template
cp scripts/migrations/migrations/_TEMPLATE.js scripts/migrations/migrations/my-migration.js

# 2. Edit migration file

# 3. Register in migration-framework.js

# 4. Test with dry-run
node scripts/migrations/migration-framework.js my-migration --dry-run

# 5. Run migration
node scripts/migrations/migration-framework.js my-migration
```

### Before Deployment

```bash
# 1. Run pre-deployment checks
node scripts/preflight/pre-deployment-check.js

# 2. Build
cd apps/web && pnpm build

# 3. Deploy
firebase deploy

# 4. Monitor for errors
```

### File Locations

```
scripts/
├── config/
│   └── schema-registry.js          # Schema definitions for all collections
├── analysis/
│   └── analyze-collection-schema.js  # Universal schema analyzer
├── migrations/
│   ├── migration-framework.js       # Migration runner with tracking
│   └── migrations/
│       ├── _TEMPLATE.js             # Migration template
│       └── *.js                     # Individual migrations
└── preflight/
    ├── check-before-db-change.sh    # Pre-flight checklist
    └── pre-deployment-check.js      # Comprehensive pre-deployment checks
```

---

## Best Practices

1. **Always analyze before changing** - Use schema analyzer before every database change
2. **Test migrations with --dry-run** - Never run migrations without testing first
3. **Run pre-deployment checks** - Catch issues before they reach production
4. **Update schema registry** - Keep it synchronized with reality
5. **Use client-side filtering for backward compatibility** - Handles missing fields gracefully
6. **Add composite indexes before deploying queries** - Avoid index errors in production
7. **Document migrations** - Explain why and what changed
8. **Monitor after deployment** - Check logs for unexpected issues
9. **Keep grace periods** - Don't remove deprecated fields immediately
10. **Backup before major migrations** - Use Firestore export functionality

---

## Next Steps

1. **Familiarize yourself with the tools** - Run schema analysis on a few collections
2. **Review existing schemas** - Check `scripts/config/schema-registry.js`
3. **Practice with dry-runs** - Test migrations on non-critical collections
4. **Integrate into workflow** - Make pre-deployment checks mandatory
5. **Update documentation** - Add project-specific scenarios as they arise

---

## Support

If you encounter issues or have questions:

1. Check this documentation
2. Review `scripts/README.md` for tool-specific help
3. Check `docs/WORKFLOW_ANALYSIS.md` for detailed workflow analysis
4. Review existing migrations in `scripts/migrations/migrations/`
5. Consult Firebase documentation for Firestore-specific questions
