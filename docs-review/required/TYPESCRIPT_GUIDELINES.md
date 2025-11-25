# TypeScript & Firebase Development Guidelines

This document provides comprehensive guidelines for maintaining type safety and code quality in our TypeScript/Firebase codebase.

## Table of Contents

1. [Type Safety Rules](#type-safety-rules)
2. [Firebase/Firestore Best Practices](#firebasefirestore-best-practices)
3. [Common Patterns](#common-patterns)
4. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
5. [Automated Enforcement](#automated-enforcement)

---

## Type Safety Rules

### Rule 1: Never Use `as any`

**❌ NEVER DO THIS:**

```typescript
const transaction = {
  date: new Date(),
} as any;

await addDoc(collection(db, 'transactions'), transaction as any);
```

**✅ DO THIS INSTEAD:**

```typescript
import { toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const transaction = {
  type: 'JOURNAL_ENTRY' as const,
  date: toFirestoreTimestamp(dateString),
  description: 'Entry description',
  // ... other fields
};

await addDoc(collection(db, 'transactions'), transaction);
```

**Why:** `as any` bypasses all TypeScript type checking, hiding bugs that would be caught at compile time.

### Rule 2: Use Type Inference Over Explicit Types

**❌ AVOID:**

```typescript
const invoice: Partial<CustomerInvoice> = {
  type: 'CUSTOMER_INVOICE',
  date: timestamp,
  // ... causes type conflicts
} as any;
```

**✅ PREFER:**

```typescript
const invoice = {
  type: 'CUSTOMER_INVOICE' as const,
  date: toFirestoreTimestamp(invoiceDate),
  // TypeScript infers the correct type
};
```

**Why:** TypeScript's type inference is often more accurate than explicit types, especially with Firebase documents.

### Rule 3: Use `as const` for Literal Types

**❌ AVOID:**

```typescript
type: 'JOURNAL_ENTRY'; // Type is 'string'
```

**✅ DO THIS:**

```typescript
type: 'JOURNAL_ENTRY' as const; // Type is literal 'JOURNAL_ENTRY'
```

**Why:** Discriminated unions and type narrowing work better with literal types.

---

## Firebase/Firestore Best Practices

### Date Handling

#### Converting User Input to Timestamps

**✅ CORRECT PATTERN:**

```typescript
import { toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

// From date input field
const [dateString, setDateString] = useState<string>(new Date().toISOString().split('T')[0] || '');

// When saving to Firestore
const transaction = {
  date: toFirestoreTimestamp(dateString),
  // ...
};
```

#### Reading Timestamps from Firestore

**✅ CORRECT PATTERN:**

```typescript
import { fromFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

// When displaying in a form
useEffect(() => {
  if (editingEntry?.date) {
    setDate(fromFirestoreTimestamp(editingEntry.date));
  }
}, [editingEntry]);
```

### Creating Firestore Documents

**✅ RECOMMENDED PATTERN:**

```typescript
import { createFirestoreDoc, toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const documentData = createFirestoreDoc({
  type: 'JOURNAL_ENTRY' as const,
  date: toFirestoreTimestamp(dateString),
  description,
  amount: parseFloat(amount),
  currency: 'INR',
  status: status as TransactionStatus,
  // ... other fields
});

await addDoc(collection(db, 'transactions'), documentData);
```

**Benefits:**

- Automatically adds `createdAt` and `updatedAt` timestamps
- Type-safe
- Consistent across the codebase

### Updating Firestore Documents

**✅ RECOMMENDED PATTERN:**

```typescript
import { updateFirestoreDoc, toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const updateData = updateFirestoreDoc({
  description: newDescription,
  status: newStatus,
  date: toFirestoreTimestamp(newDate),
});

await updateDoc(doc(db, 'transactions', documentId), updateData);
```

### Conditional Properties

**✅ CORRECT PATTERN:**

```typescript
import { conditionalProps } from '@/lib/firebase/typeHelpers';

const documentData = {
  name: companyName,
  email: email,
  ...conditionalProps({
    website: website || undefined, // Only added if has value
    projectId: projectId || undefined,
  }),
};
```

**❌ AVOID:**

```typescript
const documentData: Record<string, any> = { name, email };
if (website) {
  (documentData as any).website = website; // Using 'as any'
}
```

---

## Common Patterns

### Pattern 1: Creating Transactions

```typescript
import { toFirestoreTimestamp, createTransactionDoc } from '@/lib/firebase/typeHelpers';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';

const createJournalEntry = async () => {
  const transactionData = createTransactionDoc({
    type: 'JOURNAL_ENTRY' as const,
    date: toFirestoreTimestamp(dateString),
    journalDate: toFirestoreTimestamp(dateString),
    description,
    referenceNumber: reference || undefined,
    projectId: projectId || undefined,
    status: status as TransactionStatus,
    entries: ledgerEntries,
    amount: totalAmount,
    transactionNumber: await generateTransactionNumber('JOURNAL_ENTRY'),
    currency: 'INR',
    baseAmount: totalAmount,
    attachments: [],
    journalType: 'GENERAL',
    isReversed: false,
  });

  await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), transactionData);
};
```

### Pattern 2: Editing Existing Documents

```typescript
import { toFirestoreTimestamp, updateFirestoreDoc } from '@/lib/firebase/typeHelpers';

const updateJournalEntry = async (entryId: string, existingEntry: JournalEntry) => {
  const updateData = updateFirestoreDoc({
    type: 'JOURNAL_ENTRY' as const,
    date: toFirestoreTimestamp(dateString),
    description,
    status: status as TransactionStatus,
    entries: ledgerEntries,
    amount: totalAmount,
    transactionNumber: existingEntry.transactionNumber,
    // updatedAt is automatically added by updateFirestoreDoc
  });

  await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, entryId), updateData);
};
```

### Pattern 3: Handling Optional Fields

```typescript
import { conditionalProps, toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const documentData = {
  // Required fields
  companyName,
  legalName,
  baseCurrency: 'INR',

  // Optional fields - only added if they have values
  ...conditionalProps({
    website: website || undefined,
    gstin: gstin || undefined,
    pan: pan || undefined,
    projectId: projectId || undefined,
  }),
};
```

### Pattern 4: Type-Safe State Management

```typescript
import { fromFirestoreTimestamp, toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

// State initialization
const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');

// Loading from Firestore
useEffect(() => {
  if (editingEntry?.date) {
    const dateStr = fromFirestoreTimestamp(editingEntry.date);
    setDate(dateStr || new Date().toISOString().split('T')[0] || '');
  }
}, [editingEntry]);

// Saving to Firestore
const handleSave = async () => {
  const transaction = {
    date: toFirestoreTimestamp(date),
    // ...
  };

  await addDoc(collection(db, 'transactions'), transaction);
};
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Using `as any` to Bypass Type Errors

```typescript
// NEVER DO THIS
const transaction = {
  /* ... */
} as any;
await addDoc(collection(db, 'transactions'), transaction as any);
```

**Why it's bad:** Hides type errors that could cause runtime bugs.

### ❌ Anti-Pattern 2: Storing Date Objects Directly

```typescript
// NEVER DO THIS
const transaction = {
  date: new Date(dateString), // Don't use Date objects
};
```

**Why it's bad:** Firestore doesn't properly serialize JavaScript Date objects. Always use Timestamp.

### ❌ Anti-Pattern 3: Manual Timestamp Creation

```typescript
// AVOID THIS
const transaction = {
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  // ... manually adding these to every document
};
```

**Why it's bad:** Error-prone and inconsistent. Use helper functions instead.

### ❌ Anti-Pattern 4: Overly Strict Type Annotations

```typescript
// AVOID THIS
const invoice: Partial<CustomerInvoice> = {
  type: 'CUSTOMER_INVOICE',
  date: timestamp,
};
// Then having to cast it later: invoice as any
```

**Why it's bad:** Creates unnecessary type conflicts. Let TypeScript infer types.

### ❌ Anti-Pattern 5: Ignoring Type Errors

```typescript
// NEVER DO THIS
// @ts-ignore
const transaction = { date: new Date() };

// OR
// @ts-expect-error
const transaction = { date: new Date() };
```

**Why it's bad:** Suppresses errors without fixing the underlying issue.

---

## Automated Enforcement

Our codebase includes automated checks to enforce these guidelines:

### 1. ESLint Rules

The following ESLint rules are enforced:

```json
{
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/consistent-type-assertions": "error"
}
```

**Run manually:**

```bash
pnpm lint
```

### 2. Pre-Commit Hooks

Husky pre-commit hooks automatically run:

- ESLint checks
- TypeScript type checking
- Code formatting
- Pre-deployment validation

These checks prevent commits with type errors.

**To bypass (NOT RECOMMENDED):**

```bash
git commit --no-verify
```

### 3. TypeScript Type Checking

Type checking runs automatically on:

- Pre-commit
- Pull request CI/CD
- Build process

**Run manually:**

```bash
pnpm type-check
```

### 4. CI/CD Pipeline

GitHub Actions automatically:

- Run type checks
- Run linting
- Run tests
- Block merges if checks fail

---

## Quick Reference

### Import Statement

```typescript
import {
  toFirestoreTimestamp,
  fromFirestoreTimestamp,
  createFirestoreDoc,
  updateFirestoreDoc,
  conditionalProps,
  createTransactionDoc,
  safeToTimestamp,
  isFirestoreTimestamp,
} from '@/lib/firebase/typeHelpers';
```

### Common Conversions

```typescript
// String date → Timestamp
toFirestoreTimestamp('2025-01-15');

// Timestamp → String date
fromFirestoreTimestamp(transaction.date);

// Any date-like → Timestamp (safe)
safeToTimestamp(unknownDateValue);

// Check if value is Timestamp
if (isFirestoreTimestamp(value)) {
  /* ... */
}
```

---

## Getting Help

- **Questions?** Ask in the team Slack channel
- **Found a bug?** Create a GitHub issue
- **Suggestions?** Submit a pull request

## Related Documentation

- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint TypeScript Plugin](https://typescript-eslint.io/)

---

**Last Updated:** 2025-11-03
**Maintained by:** Development Team
