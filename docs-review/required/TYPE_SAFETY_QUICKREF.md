# Type Safety Quick Reference Card

> **TL;DR:** Never use `as any`. Use helper functions and proper types instead.

## Quick Fixes

### ❌ Problem: Need to cast date to Firestore

```typescript
// DON'T
const transaction = {
  date: new Date(dateString) as any,
};
```

```typescript
// DO
import { toFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const transaction = {
  date: toFirestoreTimestamp(dateString),
};
```

---

### ❌ Problem: Type mismatch when creating document

```typescript
// DON'T
const invoice: Partial<Invoice> = {
  type: 'INVOICE',
  // ... fields
} as any;
```

```typescript
// DO
const invoice = {
  type: 'INVOICE' as const,
  // ... fields
  // Let TypeScript infer the type
};
```

---

### ❌ Problem: Optional properties causing errors

```typescript
// DON'T
const data: any = { name };
if (email) data.email = email;
```

```typescript
// DO
import { conditionalProps } from '@/lib/firebase/typeHelpers';

const data = {
  name,
  ...conditionalProps({
    email: email || undefined,
  }),
};
```

---

### ❌ Problem: Reading date from Firestore

```typescript
// DON'T
const dateStr = transaction.date.toDate().toISOString().split('T')[0];
```

```typescript
// DO
import { fromFirestoreTimestamp } from '@/lib/firebase/typeHelpers';

const dateStr = fromFirestoreTimestamp(transaction.date);
```

---

## Helper Functions

```typescript
import {
  toFirestoreTimestamp, // String/Date → Timestamp
  fromFirestoreTimestamp, // Timestamp → String
  createFirestoreDoc, // Add timestamps
  updateFirestoreDoc, // Add updatedAt
  conditionalProps, // Optional fields
  safeToTimestamp, // Safe conversion
} from '@/lib/firebase/typeHelpers';
```

---

## Commands

```bash
# Check for type safety issues
pnpm check-type-safety

# Run TypeScript type check
pnpm type-check

# Run linter
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

---

## Pre-Commit

Every commit automatically runs:

1. ESLint
2. TypeScript type check
3. Code formatting

**If checks fail:** Fix the issues before committing.

**To bypass (NOT recommended):**

```bash
git commit --no-verify
```

---

## Need Help?

- 📖 [Full TypeScript Guidelines](./TYPESCRIPT_GUIDELINES.md)
- 🛡️ [Enforcement Strategy](./ENFORCEMENT_STRATEGY.md)
- 💬 Team Slack channel
- 🐛 GitHub Issues

---

## The Golden Rule

> **If you're reaching for `as any`, there's a better way.**
>
> Check the helper functions first, ask the team, or create a new helper.
