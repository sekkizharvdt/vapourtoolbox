# Claude Code Operational Guidelines for VDT-Unified

**Project:** Vapour Toolbox - Unified Business Management Platform
**Company:** Vapour Desal Technologies Private Limited
**Version:** Phase 2 Complete - Active Development
**Last Updated:** 2025-01-05

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Type Safety Rules](#type-safety-rules)
3. [Code Conventions](#code-conventions)
4. [Module-Specific Guidelines](#module-specific-guidelines)
5. [Testing Requirements](#testing-requirements)
6. [Firebase Best Practices](#firebase-best-practices)
7. [Permission System Guide](#permission-system-guide)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Git Workflow & Commits](#git-workflow--commits)
10. [Pre-commit Hooks & CI/CD](#pre-commit-hooks--cicd)
11. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
12. [Priority Guidelines](#priority-guidelines)

---

## Project Overview

### Technology Stack

- **Frontend:** Next.js 15.1.0 (App Router), React 19.0.0, TypeScript 5.7.2
- **UI Library:** Material UI 7.3.4, Emotion (CSS-in-JS)
- **Backend:** Firebase (Auth 11.2.0, Firestore 11.2.0, Cloud Functions 6.1.1, Storage 11.2.0)
- **Monorepo:** Turborepo 2.3.3, pnpm 10.19.0
- **Testing:** Playwright (E2E), Vitest (Unit - planned)
- **Validation:** Zod runtime validation
- **Code Quality:** ESLint v9, Prettier, Husky, commitlint

### Repository Structure

```
VDT-Unified/
├── apps/
│   └── web/                # Next.js 15 application (571 TS files)
├── packages/
│   ├── types/             # TypeScript definitions (17 files)
│   ├── constants/         # Module registry & config
│   ├── validation/        # Zod schemas
│   ├── firebase/          # Firebase SDK wrappers
│   ├── ui/                # Material UI theme
│   └── functions/         # Shared Cloud Functions utilities
├── functions/             # Firebase Cloud Functions
├── docs/                  # 40+ documentation files
└── scripts/               # Utility scripts
```

### Build System

- **Package Manager:** pnpm workspaces (DO NOT use npm or yarn)
- **Task Runner:** Turborepo with caching
- **Node Version:** >=20.0.0
- **Build Command:** `pnpm build` (144ms cached, 100% type safety)

---

## Type Safety Rules

### CRITICAL: Absolute Rules

#### 1. NEVER use `as any` ❌

**Reason:** CI pipeline will FAIL on detection. This rule is enforced at the pipeline level.

```typescript
// ❌ WRONG - CI will fail
const data = result as any;
const item: any = getValue();

// ✅ CORRECT - Use proper types
const data: ExpectedType = result as unknown as ExpectedType;
const item = getValue(); // Let TypeScript infer
```

**If you absolutely need type assertion:**

- Use `as unknown as TargetType` (double assertion)
- Document why type assertion is needed
- Keep it minimal and localized

#### 2. Use Type Inference Over Explicit Types ✅

```typescript
// ❌ WRONG - Redundant type annotation
const name: string = 'John';
const count: number = 0;

// ✅ CORRECT - Let TypeScript infer
const name = 'John';
const count = 0;

// ✅ CORRECT - Use explicit types when inference isn't possible
const user: User = fetchUser();
function processData(input: UserInput): ProcessedData {
  // ...
}
```

#### 3. Firebase Timestamp Handling 📅

**Problem:** Firebase Timestamps are not native Date objects.

```typescript
// ❌ WRONG - Will cause runtime errors
import { Timestamp } from 'firebase/firestore';
const date = new Date(); // JavaScript Date
const firestore Data = {
  createdAt: date, // ❌ Wrong type
};

// ✅ CORRECT - Use Firebase Timestamp
import { Timestamp } from 'firebase/firestore';
const firestoreData = {
  createdAt: Timestamp.now(),
};

// ✅ CORRECT - Use helper for string conversion
import { toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';
const firestoreData = {
  date: toFirestoreTimestamp(dateString), // '2025-01-05' → Timestamp
};
```

#### 4. Firestore Type Assertions Pattern 🔥

**ESLint Rule:** `@typescript-eslint/consistent-type-assertions`
**Configuration:** `objectLiteralTypeAssertions: "allow-as-parameter"`

**Problem:** Firestore `doc.data()` returns `DocumentData` (unknown shape).

```typescript
// ❌ WRONG - Violates ESLint rule
const record: DocumentRecord = {
  id: docSnap.id,
  ...docSnap.data(),
} as DocumentRecord;
return record;

// ❌ WRONG - Direct return with assertion
return {
  id: docSnap.id,
  ...docSnap.data(),
} as DocumentRecord;

// ✅ CORRECT - Use double assertion with const
const record: DocumentRecord = {
  id: docSnap.id,
  ...docSnap.data(),
} as unknown as DocumentRecord;
return record;

// ✅ CORRECT - As parameter (allowed by ESLint)
documents.push({
  id: doc.id,
  ...doc.data(),
} as DocumentRecord);
```

#### 5. Strict Null Checks ✅

```typescript
// ❌ WRONG - Potential null reference error
function processUser(user: User | null) {
  console.log(user.name); // ❌ user might be null
}

// ✅ CORRECT - Null check before access
function processUser(user: User | null) {
  if (!user) return;
  console.log(user.name); // ✅ Safe
}

// ✅ CORRECT - Optional chaining
const userName = user?.name ?? 'Unknown';
```

---

## Code Conventions

### File Naming

#### React Components

- **PascalCase:** `RecordCustomerPaymentDialog.tsx`
- **Pattern:** `{Action}{Entity}{ComponentType}.tsx`
- **Examples:**
  - `CreateAccountDialog.tsx`
  - `EditProjectDialog.tsx`
  - `ViewPurchaseRequestClient.tsx`

#### Services/Helpers

- **camelCase:** `purchaseRequestService.ts`
- **Suffixes:** `*Service.ts`, `*Helper.ts`, `*Validator.ts`, `*Calculator.ts`
- **Examples:**
  - `glEntryGenerator.ts` (generates GL entries)
  - `paymentHelpers.ts` (payment operations)
  - `gstCalculator.ts` (GST calculations)

#### Type Definitions

- **camelCase:** `accounting.ts`, `procurement.ts`
- **Grouped by domain**
- **Location:** `packages/types/src/`

#### Test Files

- **Pattern:** `{number}-{description}.spec.ts`
- **Examples:**
  - `01-homepage.spec.ts`
  - `07-accounting-journal-entries.spec.ts`

### Component Structure

```typescript
// Pattern for all page components
'use client';

import { /* MUI imports */ } from '@mui/material';
import { /* Icons */ } from '@mui/icons-material';
import { /* Local imports */ } from '@/';
import { /* Package imports */ } from '@vapour/';

export default function ModulePage() {
  // 1. Hooks (useAuth, useState, useEffect)
  const { user, claims } = useAuth();
  const [data, setData] = useState<DataType[]>([]);

  // 2. Permission checks
  const hasViewAccess = claims?.permissions
    ? canViewModule(claims.permissions)
    : false;

  // 3. Data fetching (useEffect with Firestore listeners)
  useEffect(() => {
    if (!hasViewAccess) return;

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.MODULE),
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as unknown as DataType));
        setData(items);
      }
    );

    return () => unsubscribe();
  }, [hasViewAccess]);

  // 4. Event handlers
  const handleCreate = async () => { /* ... */ };
  const handleEdit = async (id: string) => { /* ... */ };

  // 5. Permission guard (early return)
  if (!hasViewAccess) {
    return (
      <Container>
        <Typography color="error">
          You do not have permission to access this module.
        </Typography>
      </Container>
    );
  }

  // 6. Main render
  return (
    <Container maxWidth="xl">
      {/* Content */}
    </Container>
  );
}
```

### Service Pattern

```typescript
// lib/module/moduleService.ts

import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { Module, ModuleInput } from '@vapour/types';

/**
 * Create a new module record
 */
export async function createModule(data: ModuleInput, userId: string): Promise<Module> {
  try {
    const now = Timestamp.now();
    const moduleData: Omit<Module, 'id'> = {
      ...data,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MODULES), moduleData);

    return {
      id: docRef.id,
      ...moduleData,
    };
  } catch (error) {
    console.error('[createModule] Error:', error);
    throw new Error('Failed to create module');
  }
}

/**
 * Get module by ID
 */
export async function getModuleById(id: string): Promise<Module | null> {
  try {
    const docRef = doc(db, COLLECTIONS.MODULES, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const record: Module = {
      id: docSnap.id,
      ...docSnap.data(),
    } as unknown as Module;

    return record;
  } catch (error) {
    console.error('[getModuleById] Error:', error);
    throw new Error('Failed to get module');
  }
}

// More service functions...
```

### Error Handling Pattern

```typescript
// Standard error handling in UI components
try {
  await operationAsync();
  setSnackbar({
    message: 'Operation successful!',
    severity: 'success',
  });
} catch (error) {
  console.error('[ComponentName] Error:', error);
  setSnackbar({
    message: error instanceof Error ? error.message : 'Operation failed',
    severity: 'error',
  });
} finally {
  setLoading(false);
}
```

---

## Module-Specific Guidelines

### Accounting Module

#### Transaction Types (Unified Collection)

- `JOURNAL_ENTRY` - Manual accounting entries
- `CUSTOMER_INVOICE` - Sales invoices
- `VENDOR_BILL` - Purchase bills
- `CUSTOMER_PAYMENT` - Payments received
- `VENDOR_PAYMENT` - Payments made

#### Sequential Numbering

- **Pattern:** `{PREFIX}/{YEAR}/{NUMBER}`
- **Examples:** `JE/2025/001`, `INV/2025/042`, `BILL/2025/010`
- **Service:** Use `generateTransactionNumber()` from `transactionNumberGenerator.ts`

```typescript
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';

const transactionNumber = await generateTransactionNumber(db, 'JOURNAL_ENTRY', new Date());
// Result: "JE/2025/001"
```

#### GST Calculation (Indian Tax System)

- **CGST + SGST:** For intra-state transactions (same state)
- **IGST:** For inter-state transactions (different states)
- **Service:** Use `calculateGST()` from `gstCalculator.ts`

```typescript
import { calculateGST } from '@/lib/accounting/gstCalculator';

const gstDetails = calculateGST({
  amount: 10000,
  gstRate: 18,
  customerState: 'MAHARASHTRA',
  companyState: 'MAHARASHTRA',
});
// Result: { cgst: 900, sgst: 900, igst: 0, total: 1800 }
```

#### TDS Calculation

- **Sections:** 194C (Contractors), 194I (Rent), 194J (Professional), etc.
- **Service:** Use `calculateTDS()` from `tdsCalculator.ts`

```typescript
import { calculateTDS, TDS_SECTIONS } from '@/lib/accounting/tdsCalculator';

const tdsDetails = calculateTDS({
  amount: 10000,
  tdsSection: '194C',
  vendorPanAvailable: true,
});
// Result: { tdsAmount: 100, rate: 1, section: '194C' }
```

#### GL Entry Generation

- **ALWAYS** generate GL entries for transactions
- **Service:** Use `generateGLEntries()` from `glEntryGenerator.ts`

```typescript
import { generateGLEntries } from '@/lib/accounting/glEntryGenerator';

const glEntries = await generateGLEntries({
  type: 'CUSTOMER_INVOICE',
  transactionId: invoiceId,
  transactionDate: invoiceDate,
  amount: totalAmount,
  entityId: customerId,
  // ... other fields
});
```

#### Ledger Validation

- **ALWAYS** validate debits = credits before posting
- **Service:** Use `validateLedgerEntry()` from `ledgerValidator.ts`

```typescript
import { validateLedgerEntry } from '@/lib/accounting/ledgerValidator';

const validation = validateLedgerEntry(ledgerEntries);
if (!validation.valid) {
  throw new Error(`Unbalanced entry: ${validation.error}`);
}
```

### Procurement Module

#### Purchase Request Workflow

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → CONVERTED_TO_RFQ
                                 ↘ REJECTED
```

#### Status Transitions

- Only allow valid state transitions
- Update `updatedAt` timestamp on every transition
- Log transitions in audit trail

```typescript
import { auditLogger } from '@/lib/accounting/auditLogger';

await auditLogger.logPurchaseRequestUpdate({
  purchaseRequestId: pr.id,
  actor: userId,
  changes: { status: { from: 'SUBMITTED', to: 'APPROVED' } },
  action: 'STATUS_CHANGE',
});
```

### Time Tracking Module

#### Task-Notification System

- Tasks are represented as `TaskNotification` records
- Tasks can be assigned to users or created by users
- Time entries are linked to task notifications

```typescript
interface TaskNotification {
  type: 'task';
  category: 'ASSIGNED_TO_YOU' | 'CREATED_BY_YOU' | 'PROJECT_UPDATE';
  userId: string;
  title: string;
  message: string;
  taskType: 'TIME_ENTRY' | 'LEAVE_REQUEST' | 'ON_DUTY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  // ...
}
```

---

## Testing Requirements

### E2E Testing with Playwright

#### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Module Name', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to module page
    await page.goto('/module');
    await page.waitForLoadState('networkidle');
  });

  test('should display the module page', async ({ page }) => {
    // Verify page loads
    await expect(page.locator('h1')).toContainText('Module Name');
  });

  test('should create a new record', async ({ page }) => {
    // Click create button
    await page.click('button:has-text("Create New")');

    // Fill form
    await page.fill('input[name="field1"]', 'Value 1');
    await page.fill('input[name="field2"]', 'Value 2');

    // Submit
    await page.click('button:has-text("Save")');

    // Verify success
    await expect(page.locator('text=Created successfully')).toBeVisible();
  });
});
```

#### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e tests/07-accounting-journal-entries.spec.ts

# Run in UI mode (interactive debugging)
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug
```

#### Test Coverage Requirements

- **MUST** write E2E tests for:
  - CRUD operations (Create, Read, Update, Delete)
  - Form validation
  - Permission-based access control
  - Critical workflows (approval, payment allocation, etc.)

- **Test files location:** `apps/web/e2e/`
- **Naming:** `{number}-{module-name}.spec.ts`

### Unit Testing (Planned - Vitest)

**TODO:** Set up Vitest for unit testing

- Test utility functions
- Test validation logic
- Test calculation functions (GST, TDS, etc.)

---

## Firebase Best Practices

### Firestore Operations

#### Real-time Listeners (Preferred)

```typescript
import { collection, onSnapshot, query, where } from 'firebase/firestore';

useEffect(() => {
  const q = query(collection(db, COLLECTIONS.MODULES), where('status', '==', 'ACTIVE'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as Module
      );
      setData(items);
    },
    (error) => {
      console.error('Firestore listener error:', error);
    }
  );

  // IMPORTANT: Clean up listener on unmount
  return () => unsubscribe();
}, []);
```

#### One-time Reads

```typescript
import { collection, getDocs, query, where } from 'firebase/firestore';

const q = query(collection(db, COLLECTIONS.MODULES), where('status', '==', 'ACTIVE'));

const snapshot = await getDocs(q);
const items = snapshot.docs.map(
  (doc) =>
    ({
      id: doc.id,
      ...doc.data(),
    }) as unknown as Module
);
```

#### Batch Writes (Transactions)

```typescript
import { writeBatch, doc } from 'firebase/firestore';

const batch = writeBatch(db);

// Add multiple operations to batch
batch.update(doc(db, COLLECTIONS.INVOICES, invoiceId), {
  status: 'PAID',
  paidAt: Timestamp.now(),
});

batch.update(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
  status: 'POSTED',
});

// Commit all at once (atomic)
await batch.commit();
```

### Firestore Indexes

**IMPORTANT:** Always check if composite indexes are needed for queries.

```typescript
// This query requires a composite index:
const q = query(
  collection(db, COLLECTIONS.TRANSACTIONS),
  where('projectId', '==', projectId),
  where('status', '==', 'POSTED'),
  orderBy('date', 'desc')
);
// Required index: transactions (projectId ASC, status ASC, date DESC)
```

**How to add indexes:**

1. Run the query in development
2. Firestore will provide an error with index creation link
3. OR manually add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Cloud Functions

#### Function Structure

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  const userId = event.params.userId;
  const userData = snapshot.data();

  // Perform background task
  await sendWelcomeEmail(userId, userData.email);
});
```

#### Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:onUserCreated
```

---

## Permission System Guide

### Bitwise Permissions

The project uses a **bitwise permission system** with 32 permission flags (bits 0-31).

#### Permission Constants

```typescript
// packages/constants/src/permissions.ts

export const PERMISSIONS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0, // 0x00000001
  VIEW_USER_DETAILS: 1 << 1, // 0x00000002
  APPROVE_USERS: 1 << 2, // 0x00000004

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3, // 0x00000008
  VIEW_PROJECTS: 1 << 4, // 0x00000010

  // Entity Management (bits 5-8)
  VIEW_ENTITIES: 1 << 5, // 0x00000020
  CREATE_ENTITIES: 1 << 6, // 0x00000040
  EDIT_ENTITIES: 1 << 7, // 0x00000080
  DELETE_ENTITIES: 1 << 8, // 0x00000100

  // Accounting (bits 14-15, 20-25)
  VIEW_ACCOUNTING: 1 << 15, // 0x00008000
  CREATE_TRANSACTIONS: 1 << 14, // 0x00004000
  // ... more permissions
};
```

#### Checking Permissions

```typescript
import { PERMISSIONS } from '@vapour/constants';

// Check single permission
function hasPermission(userPermissions: number, permission: number): boolean {
  return (userPermissions & permission) === permission;
}

// Usage in components
const { claims } = useAuth();
const canViewAccounting = claims?.permissions
  ? hasPermission(claims.permissions, PERMISSIONS.VIEW_ACCOUNTING)
  : false;

// Helper functions (use these)
import { canViewAccounting, canCreateTransactions } from '@vapour/constants';

const canView = canViewAccounting(claims.permissions);
const canCreate = canCreateTransactions(claims.permissions);
```

#### Permission Guards in Components

```typescript
export default function AccountingPage() {
  const { claims } = useAuth();

  const hasViewAccess = claims?.permissions
    ? canViewAccounting(claims.permissions)
    : false;

  const hasCreateAccess = claims?.permissions
    ? canCreateTransactions(claims.permissions)
    : false;

  if (!hasViewAccess) {
    return (
      <Container>
        <Typography color="error">
          You do not have permission to access this module.
        </Typography>
      </Container>
    );
  }

  return (
    <Container>
      {/* Content */}
      {hasCreateAccess && (
        <Button onClick={handleCreate}>Create Transaction</Button>
      )}
    </Container>
  );
}
```

#### Firestore Security Rules

```javascript
// firestore.rules

function hasPermission(permission) {
  return request.auth != null &&
    (request.auth.token.permissions % (permission * 2)) >= permission;
}

match /transactions/{transactionId} {
  allow read: if hasPermission(32768);  // VIEW_ACCOUNTING
  allow write: if hasPermission(16384); // CREATE_TRANSACTIONS
}
```

---

## Error Handling Patterns

### Standard Error Handling

```typescript
// In service functions
export async function createRecord(data: RecordInput): Promise<Record> {
  try {
    // Operation
    const docRef = await addDoc(collection(db, COLLECTIONS.RECORDS), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error('[createRecord] Error:', error);
    throw new Error('Failed to create record');
  }
}

// In UI components
const handleCreate = async () => {
  setLoading(true);
  setError(null);

  try {
    const newRecord = await createRecord(formData);
    setSnackbar({
      message: 'Record created successfully!',
      severity: 'success',
    });
    onClose();
  } catch (error) {
    console.error('[CreateDialog] Error:', error);
    setError(error instanceof Error ? error.message : 'Failed to create record');
    setSnackbar({
      message: error instanceof Error ? error.message : 'Operation failed',
      severity: 'error',
    });
  } finally {
    setLoading(false);
  }
};
```

### Validation Errors

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  amount: z.number().positive('Amount must be positive'),
});

try {
  const validated = schema.parse(formData);
  // Proceed with validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    const fieldErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    setErrors(fieldErrors);
  }
}
```

---

## Git Workflow & Commits

### Branching Strategy

- **main** - Production branch (protected)
- **develop** - Development branch (currently not used, push to main)
- **feature/** - Feature branches (for large features)

### Commit Message Format (Commitlint)

**Pattern:** `<type>(<scope>): <subject>`

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring (no feature/fix)
- `perf` - Performance improvements
- `test` - Adding/updating tests
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Other changes (dependencies, etc.)
- `revert` - Revert previous commit

**Examples:**

```bash
feat: add user authentication
fix: resolve entity loading issue
feat(entities): add contacts array support
docs: update database management guide
refactor(accounting): simplify GL entry generation
test(e2e): add purchase request workflow tests
ci: add deployment workflow
```

### Commit Template (Automatic)

All commits automatically include:

```
[Your commit message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Git Commands

```bash
# Stage changes
git add <files>

# Commit with conventional message
git commit -m "feat: add new feature"

# Push to remote
git push origin main

# Bypass pre-commit hooks (NOT RECOMMENDED)
git commit --no-verify
```

---

## Pre-commit Hooks & CI/CD

### Pre-commit Hooks (Husky)

**Automatically runs on `git commit`:**

1. **lint-staged** - Format changed files with Prettier
2. **TypeScript type check** - Full type checking (`pnpm type-check`)
3. **Pre-deployment checks** - Validate Firestore config, environment files
4. **Commitlint** - Validate commit message format

**Output:**

```
🔍 Running pre-commit checks...
✅ Prettier formatting passed
✅ TypeScript type check passed
✅ Pre-deployment checks passed
✅ Commit message is valid!
```

### CI/CD Pipeline (GitHub Actions)

**Workflow:** `.github/workflows/ci.yml`

**Triggered on:**

- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Jobs:**

1. **Lint & Type Check** (10 min)
   - Run ESLint
   - Run TypeScript type check
   - Check for prohibited `as any` casts

2. **Build Application** (15 min)
   - Build Next.js app
   - Upload build artifacts

3. **Pre-deployment Checks** (10 min)
   - Validate Firestore indexes
   - Validate Firestore rules
   - Check environment files

4. **Security Audit** (5 min)
   - Run `pnpm audit` (high severity)

**Manual Deployment:**

```bash
# Trigger deployment workflow
gh workflow run deploy.yml
```

### What CI Checks For

#### 1. Prohibited Type Casts

```bash
# CI will FAIL if this is found:
grep -r "as any" apps/web/src --include="*.ts" --include="*.tsx"
```

#### 2. Type Errors

```bash
pnpm type-check  # Must pass with 0 errors
```

#### 3. Linting Errors

```bash
pnpm lint  # Must pass with 0 errors
```

---

## Common Pitfalls & Solutions

### 1. Firestore Timestamp vs Date

**Problem:** Using JavaScript `Date` instead of Firebase `Timestamp`.

```typescript
// ❌ WRONG
const data = {
  createdAt: new Date(),
};

// ✅ CORRECT
import { Timestamp } from 'firebase/firestore';
const data = {
  createdAt: Timestamp.now(),
};
```

### 2. Not Cleaning Up Listeners

**Problem:** Memory leaks from unsubscribed listeners.

```typescript
// ❌ WRONG
useEffect(() => {
  onSnapshot(collection(db, 'items'), (snapshot) => {
    setItems(snapshot.docs.map((doc) => doc.data()));
  });
}, []); // No cleanup!

// ✅ CORRECT
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'items'), (snapshot) => {
    setItems(snapshot.docs.map((doc) => doc.data()));
  });

  return () => unsubscribe(); // Clean up on unmount
}, []);
```

### 3. Direct Type Assertion Without Unknown

**Problem:** ESLint error with direct type assertions.

```typescript
// ❌ WRONG - ESLint error
const record: DocumentRecord = {
  id: docSnap.id,
  ...docSnap.data(),
} as DocumentRecord;

// ✅ CORRECT - Double assertion
const record: DocumentRecord = {
  id: docSnap.id,
  ...docSnap.data(),
} as unknown as DocumentRecord;
```

### 4. Missing Composite Indexes

**Problem:** Firestore query fails with index error.

**Solution:**

1. Copy the index creation link from the error
2. OR add to `firestore.indexes.json`
3. Deploy: `firebase deploy --only firestore:indexes`

### 5. Not Checking Permissions

**Problem:** Users can see UI elements they can't use.

```typescript
// ❌ WRONG - No permission check
return (
  <Container>
    <Button onClick={handleCreate}>Create</Button>
  </Container>
);

// ✅ CORRECT - Permission-based rendering
const canCreate = claims?.permissions
  ? canCreateTransactions(claims.permissions)
  : false;

return (
  <Container>
    {canCreate && (
      <Button onClick={handleCreate}>Create</Button>
    )}
  </Container>
);
```

### 6. Unbalanced GL Entries

**Problem:** Creating journal entries where debits ≠ credits.

**Solution:** Always validate before saving.

```typescript
import { validateLedgerEntry } from '@/lib/accounting/ledgerValidator';

const validation = validateLedgerEntry(ledgerEntries);
if (!validation.valid) {
  throw new Error(`Unbalanced entry: ${validation.error}`);
}
```

---

## Priority Guidelines

### When working on VDT-Unified, prioritize in this order:

1. **Security** - Never compromise security for convenience
   - Always check permissions before operations
   - Validate all user inputs
   - Sanitize data before storage

2. **Type Safety** - Maintain 100% type safety
   - Never use `as any`
   - Use proper type assertions
   - Let TypeScript infer types when possible

3. **Consistency** - Follow existing patterns
   - Use established file naming conventions
   - Follow component structure patterns
   - Match existing code style

4. **Testing** - Write tests for critical features
   - E2E tests for CRUD operations
   - E2E tests for workflows
   - Unit tests for utilities (when framework is set up)

5. **Documentation** - Document complex logic
   - Add JSDoc comments for exported functions
   - Update docs/ when adding major features
   - Keep context.md up to date

6. **Performance** - Optimize where it matters
   - Use Firestore indexes for queries
   - Implement pagination for large lists
   - Clean up listeners and subscriptions
   - Use Turbo caching for builds

### Decision Framework

**When making decisions:**

1. **Does it compromise security?** → Don't do it
2. **Does it break type safety?** → Find another way
3. **Does it diverge from patterns?** → Consider if it's worth it
4. **Is it tested?** → Write tests
5. **Is it documented?** → Add documentation
6. **Is it performant?** → Profile and optimize

---

## Quick Reference Checklist

Before committing code, verify:

- [ ] No `as any` type casts (CI will fail)
- [ ] All Firestore listeners have cleanup functions
- [ ] Permission checks are in place for protected operations
- [ ] Firebase Timestamps used (not JavaScript Date)
- [ ] Error handling follows standard pattern
- [ ] Types are properly defined (no implicit any)
- [ ] Commit message follows conventional format
- [ ] E2E tests added for new features (if applicable)
- [ ] Firestore indexes added for new queries (if needed)
- [ ] Documentation updated (if major feature)

---

## Contact & Support

**Primary Repository:** https://github.com/sekkizharvdt/vapourtoolbox
**Live Application:** https://toolbox.vapourdesal.com
**Documentation:** See `docs/` directory

**For Questions:**

1. Check `docs/` directory for detailed documentation
2. Review `.claude/context.md` for project context
3. Refer to existing code patterns in the module

---

**Remember:** The goal is to maintain a high-quality, type-safe, secure codebase that scales. When in doubt, favor safety and consistency over speed.
