# Testing

## Test Stack

- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright
- **Coverage**: Jest coverage reports

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @vapour/web test
pnpm --filter @vapour/ui test

# Run E2E tests
pnpm test:e2e
```

## Unit Tests

### File Location

Tests are co-located with source files:

```
lib/procurement/
├── purchaseOrderService.ts
├── purchaseOrderService.test.ts    # Unit tests here
└── purchaseOrderHelpers.ts
```

Or in `__tests__` folder for larger suites:

```
lib/procurement/
├── __tests__/
│   ├── purchaseOrder.test.ts
│   └── fixtures/
└── purchaseOrderService.ts
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { calculateTotal } from './purchaseOrderHelpers';

describe('calculateTotal', () => {
  it('should sum item amounts', () => {
    const items = [{ amount: 100 }, { amount: 200 }];
    expect(calculateTotal(items)).toBe(300);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

### Mocking Firebase

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  getFirebase: () => ({
    db: mockDb,
    auth: mockAuth,
  }),
}));
```

## E2E Tests

### Running E2E

```bash
# Start dev server first
pnpm dev

# Run Playwright tests
pnpm test:e2e

# Run with UI
pnpm exec playwright test --ui

# Run specific test
pnpm exec playwright test procurement.spec.ts
```

### Writing E2E Tests

```typescript
// e2e/procurement.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Purchase Orders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/procurement/pos');
  });

  test('should display PO list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible();
  });

  test('should create new PO', async ({ page }) => {
    await page.click('text=New PO');
    await page.fill('[name="vendorId"]', 'vendor-1');
    await page.click('text=Save');
    await expect(page.getByText('PO created')).toBeVisible();
  });
});
```

## Test Coverage Requirements

| Category           | Target |
| ------------------ | ------ |
| Financial services | 80%+   |
| Workflow services  | 70%+   |
| CRUD services      | 50%+   |
| Utility functions  | 90%+   |

## Test Utilities

Located in `apps/web/src/test-utils/`:

```typescript
import { renderWithProviders, mockUser, mockFirebase } from '@/test-utils';

test('component with auth', () => {
  renderWithProviders(<Component />, {
    user: mockUser({ permissions: 0xFF }),
  });
});
```
