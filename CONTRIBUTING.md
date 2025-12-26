# Contributing

Guidelines for contributing to Vapour Toolbox.

## Development Workflow

1. Create a feature branch from `main`
2. Make changes following the patterns below
3. Run tests and linting
4. Create a pull request

## Code Standards

### TypeScript

- Strict mode enabled - no `any` types
- Use type helpers from `@vapour/types`
- Exhaustive switch statements with `never` check

### File Organization

```
lib/{module}/
├── index.ts          # Barrel exports
├── *Service.ts       # CRUD operations
├── *Helpers.ts       # Pure functions
├── hooks/            # React Query hooks
└── __tests__/        # Tests
```

### Naming Conventions

| Type       | Convention             | Example                   |
| ---------- | ---------------------- | ------------------------- |
| Files      | camelCase              | `purchaseOrderService.ts` |
| Components | PascalCase             | `PurchaseOrderList.tsx`   |
| Functions  | camelCase, verb prefix | `createPurchaseOrder()`   |
| Types      | PascalCase             | `PurchaseOrder`           |
| Constants  | UPPER_SNAKE            | `DEFAULT_PAGE_SIZE`       |

### Imports

```typescript
// External packages first
import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

// Monorepo packages
import { PurchaseOrder } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';

// Local imports
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
```

## Critical Patterns

### Dynamic Routes

Use `usePathname()` instead of `useParams()` for static export:

```typescript
const pathname = usePathname();
const [id, setId] = useState<string | null>(null);

useEffect(() => {
  const match = pathname?.match(/\/route\/([^/]+)/);
  if (match?.[1] && match[1] !== 'placeholder') {
    setId(match[1]);
  }
}, [pathname]);
```

See [Development Patterns](docs/development/PATTERNS.md) for more.

### Firestore Operations

- Use `COLLECTIONS` constants
- Use transactions for multi-document updates
- Use soft deletes (`isDeleted: true`)

### Error Handling

```typescript
import { withErrorHandling } from '@/lib/utils/errorHandling';

const result = await withErrorHandling(async () => await operation(), { context: 'operationName' });
```

## Before Submitting

```bash
# Run all checks
pnpm type-check
pnpm lint
pnpm test

# Build to verify
pnpm build
```

## Commit Messages

Follow conventional commits:

```
feat(procurement): add three-way match validation
fix(hr): correct leave balance calculation
docs: update API documentation
refactor(accounting): simplify GL entry generation
test(documents): add folder service tests
```

## Pull Request Process

1. Fill out PR template
2. Ensure CI passes
3. Request review
4. Address feedback
5. Squash and merge

## Questions?

Check [docs/](docs/) or ask in the team channel.
