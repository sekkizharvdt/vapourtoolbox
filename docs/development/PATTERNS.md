# Development Patterns

Critical patterns and conventions for this codebase.

## Dynamic Routes with Static Export

### The Problem

With Next.js static export (`output: 'export'`) and Firebase hosting rewrites, `useParams()` returns the placeholder value, NOT the actual URL ID.

### Solution: Use usePathname

```typescript
// WRONG - Returns 'placeholder' with static export
import { useParams } from 'next/navigation';
const params = useParams();
const id = params.id; // 'placeholder' - NOT the actual ID!

// CORRECT - Use usePathname and extract via regex
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const pathname = usePathname();
const [entityId, setEntityId] = useState<string | null>(null);

useEffect(() => {
  if (pathname) {
    const match = pathname.match(/\/your-route\/([^/]+)(?:\/|$)/);
    const extractedId = match?.[1];
    if (extractedId && extractedId !== 'placeholder') {
      setEntityId(extractedId);
    }
  }
}, [pathname]);
```

### Why This Happens

1. `next.config.ts` has `output: 'export'`
2. `generateStaticParams()` returns `[{ id: 'placeholder' }]`
3. Build creates `/your-route/placeholder.html`
4. Firebase rewrites `/your-route/*` → `/your-route/placeholder.html`
5. `useParams()` returns static params (`{ id: 'placeholder' }`)
6. `usePathname()` returns actual browser URL

### Reference Files

- `apps/web/src/app/estimation/[id]/BOMEditorClient.tsx` - Correct pattern
- `apps/web/src/app/hr/travel-expenses/[id]/TravelExpenseDetailClient.tsx` - Correct pattern

---

## Service Layer Organization

### File Structure

```
lib/procurement/amendment/
├── index.ts          # Barrel exports
├── crud.ts           # Create, Read, Update, Delete
├── queries.ts        # List queries, search
├── workflow.ts       # Status transitions, approvals
├── helpers.ts        # Pure utility functions
└── hooks/            # React Query hooks
    ├── useQueries.ts
    └── useMutations.ts
```

### Naming Conventions

```typescript
// CRUD
createXxx();
getXxxById();
updateXxx();
deleteXxx();

// Queries
listXxx();
searchXxx();

// Workflow
approveXxx();
rejectXxx();
submitXxx();

// Helpers
calculateXxx();
formatXxx();
validateXxx();
```

---

## Firestore Patterns

### Use Collection Constants

```typescript
// CORRECT
import { COLLECTIONS } from '@vapour/firebase';
const ref = doc(db, COLLECTIONS.PURCHASE_ORDERS, id);

// WRONG - hardcoded strings
const ref = doc(db, 'purchaseOrders', id);
```

### Transactions for Multi-Document Operations

```typescript
// CORRECT - atomic updates
import { withTransaction } from '@/lib/utils/transactionHelpers';

await withTransaction(db, async (transaction) => {
  const doc = await transaction.get(ref);
  transaction.update(ref, { status: 'APPROVED' });
  transaction.set(auditRef, auditData);
});

// WRONG - separate writes can fail partially
await updateDoc(ref, { status: 'APPROVED' });
await setDoc(auditRef, auditData);
```

### Soft Deletes

```typescript
// CORRECT - preserve audit trail
await updateDoc(ref, {
  isDeleted: true,
  deletedAt: Timestamp.now(),
  deletedBy: userId,
});

// WRONG - loses data
await deleteDoc(ref);
```

---

## State Management

### Query Key Structure

```typescript
export const purchaseOrderKeys = {
  all: ['purchaseOrders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (filters: Filters) => [...purchaseOrderKeys.lists(), filters] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
};
```

### Mutation Invalidation

```typescript
const mutation = useMutation({
  mutationFn: createPurchaseOrder,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
  },
});
```

---

## Error Handling

### Use Error Utilities

```typescript
import { withErrorHandling, withRetry } from '@/lib/utils/errorHandling';

// Wrap fallible operations
const result = await withErrorHandling(async () => await fetchData(), {
  context: 'fetchData',
  rethrow: false,
});

// Retry transient failures
const data = await withRetry(async () => await unreliableApiCall(), {
  maxAttempts: 3,
  delayMs: 1000,
});
```

---

## Type Safety

### Use Type Helpers

```typescript
// CORRECT
import { docToTyped } from '@/lib/firebase/typeHelpers';
const po = docToTyped<PurchaseOrder>(doc.id, doc.data());

// WRONG - unsafe assertion
const po = doc.data() as PurchaseOrder;
```

### Exhaustive Switch

```typescript
function getStatusColor(status: POStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'gray';
    case 'PENDING_APPROVAL':
      return 'yellow';
    case 'APPROVED':
      return 'green';
    default:
      const _exhaustive: never = status;
      throw new Error(`Unhandled: ${_exhaustive}`);
  }
}
```

---

## Authorization

### Validate in Service Functions

```typescript
import { requirePermission } from '@/lib/auth/authorizationService';
import { PermissionFlag } from '@vapour/constants';

export async function deleteDocument(id: string, userId: string, permissions: number) {
  requirePermission(permissions, PermissionFlag.MANAGE_DOCUMENTS);
  // proceed with deletion
}
```

---

## Common Imports

```typescript
// Transactions
import { withTransaction } from '@/lib/utils/transactionHelpers';

// Authorization
import { requirePermission } from '@/lib/auth/authorizationService';
import { PermissionFlag } from '@vapour/constants';

// Error handling
import { withErrorHandling, withRetry } from '@/lib/utils/errorHandling';

// Firestore
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';

// Logging
import { createLogger } from '@vapour/logger';
```
