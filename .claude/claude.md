# Claude Code Operational Guidelines for VDT-Unified

**Project:** Vapour Toolbox - Unified Business Management Platform
**Company:** Vapour Desal Technologies Private Limited
**Version:** Phase 2 Complete - Active Development
**Last Updated:** 2026-01-11

---

## ⚠️ CRITICAL: UI Framework

**This project uses Material UI (MUI) v7 - NOT shadcn/ui, Radix, or Tailwind UI.**

Before creating any new UI component or page:

1. Check existing pages in the same module for patterns
2. Import from `@mui/material` and `@mui/icons-material`
3. Use MUI's Grid v7 syntax: `<Grid size={{ xs: 12, md: 6 }}>`
4. Use MUI Dialog, not custom modal components

```typescript
// ✅ CORRECT - Use MUI components
import { Button, Dialog, TextField, Card } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

// ❌ WRONG - These don't exist in this project
import { Button } from '@/components/ui/button'; // shadcn
import { Dialog } from '@radix-ui/react-dialog'; // Radix
```

---

## ⚠️ Data Fetching: React Query vs Firestore Listeners

This project uses **both** patterns. Choose based on data freshness needs:

| Pattern                  | When to Use                                            | Example                          |
| ------------------------ | ------------------------------------------------------ | -------------------------------- |
| **React Query**          | Paginated lists, search results, one-time fetches      | Cost centres list, entity search |
| **Firestore onSnapshot** | Real-time dashboards, live updates, collaborative data | Transactions, approvals          |

```typescript
// ✅ React Query for list pages (with query key factory)
import { useQuery } from '@tanstack/react-query';
import { accountingKeys } from '@/lib/queryKeys/accounting';

const { data } = useQuery({
  queryKey: accountingKeys.transactions.list(filters),
  queryFn: () => getTransactions(db, filters),
});

// ✅ Firestore listener for real-time (with cleanup)
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    setData(snapshot.docs.map((doc) => docToTyped(doc.id, doc.data())));
  });
  return () => unsubscribe(); // ALWAYS cleanup
}, []);
```

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
- **Suffixes:** `*Service.ts`, `*Helpers.ts`, `*Validator.ts`, `*Calculator.ts`

**When to use each suffix:**

| Suffix           | Purpose                                                       | Example                   |
| ---------------- | ------------------------------------------------------------- | ------------------------- |
| `*Service.ts`    | Firestore CRUD operations (create, read, update, delete)      | `purchaseOrderService.ts` |
| `*Helpers.ts`    | Pure functions, transformations, formatting (no DB calls)     | `paymentHelpers.ts`       |
| `*Calculator.ts` | Mathematical/financial calculations                           | `gstCalculator.ts`        |
| `*Generator.ts`  | Creates complex objects (GL entries, documents)               | `glEntryGenerator.ts`     |
| `*Validator.ts`  | Validation logic (prefer Zod schemas in `@vapour/validation`) | `invoiceValidator.ts`     |

**Examples:**

```typescript
// purchaseOrderService.ts - Firestore operations
export async function createPurchaseOrder(data: PurchaseOrderInput): Promise<string> {
  const { db } = getFirebase();
  const docRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), data);
  return docRef.id;
}

// paymentHelpers.ts - Pure functions, no DB
export function calculatePaymentStatus(paid: number, total: number): PaymentStatus {
  if (paid >= total) return 'FULLY_PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}
```

#### Type Definitions

- **camelCase:** `accounting.ts`, `procurement.ts`
- **Grouped by domain**
- **Location:** `packages/types/src/`

#### Test Files

- **Pattern:** `{number}-{description}.spec.ts` for E2E tests
- **Pattern:** `*.test.ts` for unit tests (co-located with source)
- **Location preference:** Co-locate unit tests with source files

**E2E Tests (Playwright):**

```
apps/web/tests/
├── 01-homepage.spec.ts
├── 07-accounting-journal-entries.spec.ts
└── ...
```

**Unit Tests (Vitest):**

```
lib/accounting/
├── glEntryGenerator.ts
├── glEntryGenerator.test.ts    ← Co-located
├── helpers/
│   ├── index.ts
│   └── calculations.test.ts    ← Co-located
└── __tests__/                  ← Also acceptable
    └── integration.test.ts
```

---

### Date & Timestamp Handling

**Rule:** Use JavaScript `Date` at boundaries, Firebase `Timestamp` in Firestore.

| Context             | Type        | Example                                    |
| ------------------- | ----------- | ------------------------------------------ |
| Form inputs         | `Date`      | `<DatePicker value={date} />`              |
| React state         | `Date`      | `const [date, setDate] = useState<Date>()` |
| Firestore documents | `Timestamp` | `createdAt: Timestamp.now()`               |
| Display formatting  | `Date`      | `formatDate(timestamp.toDate())`           |

**Conversion helpers:**

```typescript
import { Timestamp } from 'firebase/firestore';

// Date → Timestamp (before saving to Firestore)
const timestamp = Timestamp.fromDate(date);

// Timestamp → Date (after reading from Firestore)
const date = timestamp.toDate();

// Safe conversion (handles both)
function toDate(value: Date | Timestamp): Date {
  return value instanceof Timestamp ? value.toDate() : value;
}
```

**Common pattern in services:**

```typescript
// When creating documents
export async function createRecord(data: RecordInput): Promise<string> {
  const docData = {
    ...data,
    date: Timestamp.fromDate(data.date), // Convert Date → Timestamp
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  // ...
}

// When reading documents
export function mapDocument(doc: DocumentSnapshot): Record {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    date: data.date.toDate(), // Convert Timestamp → Date
    createdAt: data.createdAt.toDate(),
  } as Record;
}
```

---

### Form Validation with Zod

**Standard:** Use Zod schemas from `@vapour/validation` for all form validation.

**Schema location:** `packages/validation/src/`

```typescript
// packages/validation/src/accounting.ts
import { z } from 'zod';

export const journalEntrySchema = z
  .object({
    date: z.date(),
    description: z.string().min(1, 'Description is required'),
    lineItems: z
      .array(
        z.object({
          accountId: z.string().min(1, 'Account is required'),
          debit: z.number().min(0),
          credit: z.number().min(0),
        })
      )
      .min(2, 'At least 2 line items required'),
  })
  .refine(
    (data) => {
      const totalDebit = data.lineItems.reduce((sum, item) => sum + item.debit, 0);
      const totalCredit = data.lineItems.reduce((sum, item) => sum + item.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: 'Debits must equal credits' }
  );

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
```

**Usage in components:**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { journalEntrySchema, JournalEntryInput } from '@vapour/validation';

const form = useForm<JournalEntryInput>({
  resolver: zodResolver(journalEntrySchema),
  defaultValues: {
    date: new Date(),
    description: '',
    lineItems: [],
  },
});
```

---

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

## Custom Hooks & Query Keys

### Query Keys Factory Pattern

All query keys are centralized in `@/lib/queryKeys/`. Use these instead of inline arrays:

```typescript
// ✅ CORRECT - Use query key factory
import { accountingKeys } from '@/lib/queryKeys/accounting';

const { data } = useQuery({
  queryKey: accountingKeys.transactions.list({ status: 'POSTED' }),
  queryFn: fetchTransactions,
});

// When invalidating:
queryClient.invalidateQueries({ queryKey: accountingKeys.transactions.all });

// ❌ WRONG - Inline query keys
const { data } = useQuery({
  queryKey: ['transactions', 'list', { status: 'POSTED' }], // Don't do this
  queryFn: fetchTransactions,
});
```

### Custom Hooks (in `@/hooks/`)

| Hook                    | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `useFirestoreQuery<T>`  | Real-time Firestore listener with automatic cleanup |
| `useTransactionForm`    | Form state for bills/invoices with line items       |
| `useLineItemManagement` | Add/remove/update line items in forms               |
| `useGSTCalculation`     | GST computation (CGST/SGST/IGST)                    |
| `useTDSCalculation`     | TDS computation by section                          |
| `useLocalStorage`       | Persist state to localStorage                       |
| `useKeyboardShortcuts`  | Register keyboard shortcuts                         |

```typescript
// Example: useFirestoreQuery eliminates boilerplate
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

const accountsQuery = useMemo(
  () => query(collection(db, COLLECTIONS.ACCOUNTS), where('isActive', '==', true)),
  [db]
);
const { data: accounts, loading, error } = useFirestoreQuery<Account>(accountsQuery);
```

### ConfirmDialog Pattern

Use the global confirm dialog for destructive actions:

```typescript
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

const { confirm } = useConfirmDialog();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: 'Delete Invoice',
    message: 'This action cannot be undone.',
    confirmColor: 'error',
  });
  if (confirmed) {
    await deleteInvoice(id);
  }
};
```

### Toast Pattern (Ephemeral Notifications)

Use the global toast for success/error feedback after operations:

```typescript
import { useToast } from '@/components/common/Toast';

const { toast } = useToast();

// After successful operation
toast.success('Invoice created successfully');

// After error
toast.error('Failed to save changes');

// Other severities
toast.info('Processing...');
toast.warning('This action cannot be undone');

// With custom options (duration in ms)
toast.success('Saved!', { duration: 3000 });
```

**Toast vs NotificationCenter:**

| System                 | Purpose                    | Storage               | When to Use                        |
| ---------------------- | -------------------------- | --------------------- | ---------------------------------- |
| **Toast**              | Ephemeral UI feedback      | None (auto-dismisses) | Form submissions, CRUD operations  |
| **NotificationCenter** | Persistent activity alerts | Firestore             | Approvals, mentions, system events |

**Usage in mutations:**

```typescript
const createMutation = useMutation({
  mutationFn: createInvoice,
  onSuccess: () => {
    toast.success('Invoice created successfully');
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : 'Failed to create invoice');
  },
});
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

### ⚠️ IMPORTANT: Commit vs Push

**Commit locally, but DO NOT push unless explicitly requested.**

- ✅ `git commit` - Always allowed, do this freely
- ❌ `git push` - Only when user says "push", "push to remote", or similar

This prevents wasting GitHub Actions minutes on intermediate fixes. Wait for user confirmation before pushing.

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

### 7. Material-UI Grid v7 API Changes

**Problem:** Using old Grid API with `item` prop instead of `size`.

```typescript
// ❌ WRONG - Old Material-UI Grid API
<Grid item xs={12} md={6}>
  <TextField />
</Grid>

// ✅ CORRECT - Material-UI v7 Grid API
<Grid size={{ xs: 12, md: 6 }}>
  <TextField />
</Grid>

// ✅ CORRECT - Multiple breakpoints
<Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
  <Card />
</Grid>
```

### 8. Account Type Properties

**Problem:** Trying to access nested `bankDetails` that don't exist.

```typescript
// ❌ WRONG - bankDetails doesn't exist in Account type
const accountNumber = account.bankDetails?.accountNumber;
const bankName = account.bankDetails?.bankName;

// ✅ CORRECT - Use direct properties
const accountNumber = account.accountNumber;
const bankName = account.bankName;
const ifscCode = account.ifscCode;
const branch = account.branch;
```

**Account Type Structure:**

```typescript
interface Account {
  // ... other fields

  // Bank Properties (direct, not nested)
  isBankAccount: boolean;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
}
```

### 9. useEffect with Async and Cleanup

**Problem:** Not properly handling cleanup functions in useEffect with async operations.

```typescript
// ❌ WRONG - Can't directly return from async function
useEffect(() => {
  async function loadData() {
    const unsubscribe = onSnapshot(/* ... */);
    return () => unsubscribe(); // ❌ This won't work
  }
  loadData();
}, []);

// ✅ CORRECT - Store unsubscribe outside async function
useEffect(() => {
  let unsubscribe: (() => void) | undefined;

  async function loadData() {
    unsubscribe = onSnapshot(/* ... */);
  }

  loadData();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, []);
```

### 10. Component Props Validation

**Problem:** Passing props that don't exist in component interface.

```typescript
// ❌ WRONG - FormDialogActions doesn't support 'disabled' prop
<FormDialogActions
  onCancel={onClose}
  onSubmit={handleSubmit}
  submitLabel="Save"
  loading={loading}
  disabled={someCondition}  // ❌ Error: Property 'disabled' does not exist
/>

// ✅ CORRECT - Handle disabled state differently
<FormDialogActions
  onCancel={onClose}
  onSubmit={someCondition ? undefined : handleSubmit}  // Disable by not providing handler
  submitLabel="Save"
  loading={loading}
/>

// OR disable the button in the dialog content
<Button
  onClick={handleSubmit}
  disabled={someCondition}
>
  Save
</Button>
```

### 11. Firebase Type Mismatches

**Problem:** Missing required fields when creating Firebase documents.

```typescript
// ❌ WRONG - Missing 'uploadedBy' field
await createBankStatement(
  db,
  {
    accountId,
    accountName,
    statementDate: Timestamp.now(),
    // ... other fields
    // uploadedBy is missing but required!
  },
  userId
);

// ✅ CORRECT - Include all required fields
await createBankStatement(
  db,
  {
    accountId,
    accountName,
    statementDate: Timestamp.now(),
    uploadedBy: userId, // ✅ Required field included
    // ... other fields
  },
  userId
);
```

**Best Practice:** Always check the interface definition for required fields before creating objects.

### 12. Custom Hook Pattern for Firestore Queries

**Problem:** Repeating boilerplate code for Firestore listeners across many pages.

```typescript
// ❌ WRONG - Manual useEffect/onSnapshot pattern (lots of boilerplate)
const [data, setData] = useState<Item[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<Error | null>(null);

useEffect(() => {
  const q = query(collection(db, 'items'), where('status', '==', 'active'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as Item
      );
      setData(items);
      setLoading(false);
    },
    (err) => {
      setError(err);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, []);

// ✅ CORRECT - Use custom hook with useMemo
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

const { db } = getFirebase();
const itemsQuery = useMemo(
  () => query(collection(db, 'items'), where('status', '==', 'active')),
  [db]
);

const { data: items, loading, error } = useFirestoreQuery<Item>(itemsQuery);
```

**Benefits:**

- Reduces boilerplate by ~20 lines per page
- Automatic cleanup of listeners
- Consistent error handling
- Type-safe with generics

**IMPORTANT:** Use `useMemo` for query creation to prevent re-creation on every render.

### 13. Error Handling with Custom Hooks

**Problem:** Mixing local error state with hook's error handling.

```typescript
// ❌ WRONG - Unused local error state
const [error, setError] = useState<string>('');
const { data, loading, error: hookError } = useFirestoreQuery<Item>(query);

// 'error' is declared but never used (TS6133)

// ✅ CORRECT - Use hook's error property
const { data, loading, error } = useFirestoreQuery<Item>(query);

// Display error in UI
{error && (
  <Alert severity="error" sx={{ mb: 2 }}>
    {error.message}  {/* error is Error object, use .message */}
  </Alert>
)}
```

**Pattern:** When using custom hooks that provide error handling, don't create duplicate local error state.

### 14. Adding New Permission Constants

**Problem:** Forgetting to add helper functions and role assignments when adding new permissions.

```typescript
// ❌ INCOMPLETE - Only added the bit flag
export const PERMISSION_FLAGS = {
  // ... existing flags
  NEW_PERMISSION: 1 << 26,  // ❌ Missing helper function and role assignments
} as const;

// ✅ CORRECT - Complete permission implementation
export const PERMISSION_FLAGS = {
  // ... existing flags
  NEW_PERMISSION: 1 << 26,
} as const;

// Add helper function
export function canUseNewFeature(permissions: number): boolean {
  return (permissions & PERMISSION_FLAGS.NEW_PERMISSION) !== 0;
}

// Add to relevant roles
DIRECTOR: PERMISSION_FLAGS.NEW_PERMISSION | /* other flags */,
MANAGER: PERMISSION_FLAGS.NEW_PERMISSION | /* other flags */,
```

**Checklist for adding new permissions:**

1. Add bit flag to `PERMISSION_FLAGS`
2. Create helper function `can{Action}(permissions: number)`
3. Add to role definitions (DIRECTOR, MANAGER, etc.)
4. Update Firestore security rules if needed

### 15. Pre-commit Hooks vs CI Type-checking

**Problem:** Pre-commit hooks pass but CI fails on type errors.

**Why:** Pre-commit hooks only check **changed files**, while CI runs type-check on the **entire codebase**.

```bash
# Pre-commit (via Husky) - Only checks staged files
pnpm type-check  # May pass

# GitHub Actions CI - Checks entire codebase
pnpm type-check  # May fail if there are pre-existing errors elsewhere
```

**Solution:** Before pushing, run full type-check manually:

```bash
# Check entire codebase (what CI will run)
pnpm type-check

# If errors exist in other files, fix them before proceeding
```

**Best Practice:** When refactoring, fix all type errors in the codebase before starting new work to avoid CI failures.

---

## Development Lessons & Patterns

This section captures key lessons learned during development that inform future architectural decisions and implementation approaches.

### Lesson 1: Cloud Functions Cannot Import Workspace Packages ⚠️

**Context:** Module Integration System - `seedAccountingIntegrations` function
**Date:** November 2025

**Problem:**

```typescript
// ❌ This failed during deployment
import { getAllPermissions } from '@vapour/constants';

const allPermissions = getAllPermissions(); // Cannot find module '@vapour/constants'
```

**Root Cause:**
Cloud Functions are deployed as standalone packages and cannot access monorepo workspace dependencies (`workspace:*` in package.json).

**Solution:**

```typescript
// ✅ Hardcode constants or copy utility functions
const ALL_PERMISSIONS = 134217727; // All 27 permission bits set
// Calculated as: (1 << 27) - 1 = 134,217,727
```

**Best Practices:**

- Keep Cloud Functions self-contained
- Avoid importing from `@vapour/*` packages in functions/
- Use environment variables for configuration
- Copy shared utilities into functions/ if needed
- Inline constants with clear documentation

**When to Apply:**
Every time you write a Cloud Function that needs shared constants or utilities.

---

### Lesson 2: Integration Dashboard - Blueprint vs Live Monitoring 📋

**Context:** Super-Admin Module Integration Dashboard
**Date:** November 2025

**Decision:** Built integration registry/blueprint first, NOT live monitoring

**Rationale:**

1. **Other modules don't exist yet** - Procurement, Projects, HR, Inventory not built
2. **No integration events to monitor** - No actual data flows happening
3. **Blueprint serves as specification** - Documents WHAT should happen, not WHAT IS happening
4. **Development roadmap** - Status field (active/planned) tracks implementation progress

**Two-Phase Approach:**

**Phase 1 (Built - November 2025):**

```typescript
interface ModuleIntegration {
  // Static definitions showing WHAT integrations should exist
  sourceModule: 'procurement';
  targetModule: 'accounting';
  dataType: 'Vendor Invoices → Bills';
  status: 'planned'; // Not yet implemented
  fieldMappings: [...]; // How data WILL transform
}
```

**Phase 2 (Future):**

```typescript
interface IntegrationEvent {
  // Runtime tracking showing HOW MUCH data flows
  sourceModule: 'procurement';
  targetModule: 'accounting';
  sourceDocumentId: 'VI-001';
  targetDocumentId: 'BILL-234';
  status: 'SUCCESS';
  createdAt: Timestamp.now();
}

// Dashboard shows:
// "Procurement → Accounting: 45 events this month, 98% success rate"
```

**Best Practice:**

- Document planned integrations early as executable specifications
- Use integration registry as development roadmap
- Add live monitoring only when integrations are actually running
- Status field bridges planning and implementation phases

**When to Apply:**
When building cross-module features before all modules exist.

---

### Lesson 3: Cross-Module Reference Fields Added Proactively 🔗

**Context:** VendorBill and VendorPayment type extensions
**Date:** November 2025

**Approach:** Added optional integration fields BEFORE Procurement module exists

**Fields Added:**

```typescript
interface VendorBill {
  // Existing fields...

  // ✅ Added proactively (all optional)
  sourceModule?: 'procurement' | 'projects' | null;
  sourceDocumentId?: string;
  sourceDocumentType?: 'vendorInvoice' | 'projectExpense' | null;
}

interface VendorPayment {
  // Existing fields...

  // ✅ Added proactively (all optional)
  notifyModules?: Array<'procurement' | 'projects'>;
  sourceReferences?: Array<{
    module: 'procurement' | 'projects';
    documentId: string;
    documentType: string;
  }>;
}
```

**Benefits:**

1. **No schema migration needed** when Procurement launches
2. **Existing bills/payments unaffected** (fields optional, defaults undefined)
3. **Integration code can be added incrementally** without breaking changes
4. **Clear architectural intent** documented in types

**Tradeoffs:**

- ⚠️ Adds unused fields to schema initially (minimal cost)
- ⚠️ Could confuse developers if not documented (solved with comments)
- ✅ Avoids future data migration complexity
- ✅ Enables smooth integration rollout

**Best Practice:**

- Add cross-module reference fields early if architecture is clear
- Make fields optional to avoid breaking existing documents
- Document the purpose and future usage in type comments
- Include in integration blueprint documentation

**When to Apply:**
When designing data models for modules that will integrate with future (not yet built) modules.

**Anti-Pattern to Avoid:**

```typescript
// ❌ DON'T wait until integration time
// This requires:
// 1. Type changes
// 2. Data migration for existing documents
// 3. Backward compatibility handling
// 4. Potential downtime during migration
```

---

### Lesson 4: Super-Admin Permission Pattern 👑

**Context:** Super-admin dashboard access control
**Date:** November 2025

**Approach:** Check if user has ALL permissions (bitwise equality)

**Implementation:**

**Frontend:**

```typescript
import { getAllPermissions } from '@vapour/constants';

const isSuperAdmin = (claims?.permissions || 0) === getAllPermissions();
// Returns true only if user has every single permission bit set
```

**Backend (Cloud Functions):**

```typescript
const ALL_PERMISSIONS = 134217727; // All 27 permission bits
const userPermissions = request.auth.token.permissions as number;

if (userPermissions !== ALL_PERMISSIONS) {
  throw new HttpsError('permission-denied', 'Super Admin required');
}
```

**Why Bitwise Equality?**

```
getAllPermissions() = (1 << 27) - 1 = 134,217,727
                    = 0b111111111111111111111111111 (27 ones)

Super-Admin = user with EVERY permission bit set
            ≠ user with a separate "super-admin" role flag
```

**Benefits:**

- ✅ No separate super-admin flag needed
- ✅ Automatically includes any new permissions added
- ✅ Clear semantic meaning: "has all permissions"
- ✅ Works with existing bitwise permission system

**Best Practice:**

- Use bitwise equality check for super-admin (`=== getAllPermissions()`)
- Don't create separate `isSuperAdmin` flag in database
- Document the constant value (134217727) when used in Cloud Functions
- Use `getAllPermissions()` helper in frontend code

**When to Apply:**
Anytime you need to restrict access to super-admin-only features (system configuration, integration management, global settings).

---

### Lesson 5: Four-Quadrant Integration Visualization 📊

**Context:** Accounting Integration Dashboard UI
**Date:** November 2025

**Pattern:** Organize integrations by data flow direction, not by partner module

**Four Quadrants:**

```
┌─────────────────────┬─────────────────────┐
│  Incoming Data (6)  │  Outgoing Data (5)  │
│  Module RECEIVES    │  Module SENDS       │
│                     │                     │
│  Procurement →      │  → Procurement      │
│  Projects →         │  → Projects         │
│  HR →               │  → Management       │
│  Inventory →        │                     │
├─────────────────────┼─────────────────────┤
│  Dependencies (3)   │  Reporting Data (4) │
│  Module RELIES ON   │  Module PROVIDES    │
│                     │                     │
│  Entities (Vendors) │  → Projects Reports │
│  Entities (Customers│  → Procurement Rpt  │
│  Projects (List)    │  → Management Dash  │
└─────────────────────┴─────────────────────┘
```

**Alternative Approaches Considered:**

**❌ By Partner Module:**

```
Procurement ─────────────────────────────
├─ Vendor Invoices → Bills (Incoming)
└─ Payment Confirmations ← (Outgoing)

Projects ────────────────────────────────
├─ Project Expenses → Transactions (Incoming)
└─ Actual Costs ← (Outgoing)
```

**Problem:** Doesn't show the module's role clearly; mixes directions

**❌ Chronological (by implementation date):**
**Problem:** Doesn't help understand data dependencies

**✅ By Direction (Chosen):**
**Benefits:**

1. **Clear role visualization** - Immediately see what module does
2. **Identify bidirectional flows** - Same partner appears in multiple quadrants
3. **Non-technical understanding** - Stakeholders grasp data movement
4. **Architectural patterns visible** - Dependencies separate from operations

**Best Practice:**

- Visualize integrations by direction: incoming, outgoing, dependency, reporting
- Use quadrant layout for balanced visual representation
- Color-code by status (green=active, gray=planned)
- Include counts in quadrant headers (e.g., "Incoming Data (6)")

**When to Apply:**
When designing dashboards showing cross-module relationships, data flows, or system architecture.

---

### Lesson 6: Integration Status as Development Roadmap 🗺️

**Context:** 18 integrations with "active" vs "planned" status
**Date:** November 2025

**Approach:** Use integration status field to track implementation progress

**Status Flow:**

```
planned → in-development → active
```

**Status Definitions:**

```typescript
type IntegrationStatus =
  | 'planned' // Documented, not yet implemented
  | 'in-development' // Currently being built
  | 'active'; // Implemented and functional
```

**Example Usage:**

```typescript
// When documenting new integration
{
  sourceModule: 'procurement',
  targetModule: 'accounting',
  dataType: 'Vendor Invoices → Bills',
  status: 'planned', // ← Clearly shows this is future work
  fieldMappings: [...], // ← Serves as implementation spec
}

// When starting implementation
await updateIntegrationStatus(integrationId, 'in-development');

// After deploying Cloud Function
await updateIntegrationStatus(integrationId, 'active');
```

**Dashboard Benefits:**

```
Summary Statistics:
├─ Total: 18 integrations
├─ Active: 3 (17%)     [What's working TODAY]
└─ Planned: 15 (83%)   [What's coming NEXT]

Status Filter:
├─ All: Show everything
├─ Active: Show only working integrations
└─ Planned: Show development roadmap
```

**Benefits:**

1. **Dashboard shows current vs future state** clearly
2. **Development roadmap visible in UI** without separate tracking tool
3. **Easy to communicate to stakeholders** what's working today
4. **Progress tracking** built into the system
5. **No separate project management needed** for integration status

**Best Practice:**

- Use status field in integration registry as implementation tracker
- Update status as work progresses (planned → in-development → active)
- Show status prominently in UI with color coding
- Filter by status to separate planning from operations

**When to Apply:**
When building systems with phased rollouts or when all features won't be implemented simultaneously.

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
