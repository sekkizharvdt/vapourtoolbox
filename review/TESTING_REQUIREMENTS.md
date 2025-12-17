# Testing Requirements for Enterprise Grade (10/10)

## Executive Summary

This document outlines the comprehensive testing requirements to achieve enterprise-grade quality (10/10) for the Vapour Toolbox application.

**Current State (December 17, 2025 - PM Update):**

- 2,100+ tests across 53 test suites
- 53/236 lib files have tests (22%)
- Accounting module: **379 tests across 14 test suites** ✅
- Statement coverage: ~10%

**Recent Additions (December 17, 2025):**

- `billVoidService.test.ts` - 19 tests for bill void and void-and-recreate workflows
- `billApprovalService.test.ts` - 14 tests for bill approval workflow
- `invoiceApprovalService.test.ts` - 17 tests for invoice approval workflow ✅ NEW
- `auditLogger.test.ts` - 29 tests for compliance logging with retry/fallback ✅ NEW
- `bankReconciliation/autoMatching.test.ts` - 15 tests for enhanced matching ✅ NEW

**Target:** 80%+ coverage with 10,000+ tests across all testing layers.

---

## 1. Coverage Targets

### 1.1 Statement Coverage by Module

| Module      | Current | Target | Priority |
| ----------- | ------- | ------ | -------- |
| accounting  | ~15% ⬆️ | 90%    | CRITICAL |
| procurement | ~8%     | 90%    | CRITICAL |
| documents   | ~3%     | 85%    | HIGH     |
| entities    | ~15%    | 90%    | CRITICAL |
| projects    | ~5%     | 85%    | HIGH     |
| proposals   | ~5%     | 85%    | HIGH     |
| hr          | ~12% ⬆️ | 85%    | MEDIUM   |
| materials   | ~12%    | 85%    | MEDIUM   |
| thermal     | ~2%     | 80%    | LOW      |
| utils       | ~25% ⬆️ | 95%    | CRITICAL |

### 1.2 Coverage Metrics

- **Statement Coverage**: 80% minimum, 90% target
- **Branch Coverage**: 75% minimum, 85% target
- **Function Coverage**: 85% minimum, 95% target
- **Line Coverage**: 80% minimum, 90% target

---

## 2. Test Categories Required

### 2.1 Unit Tests (Target: 8,000+ tests)

#### Pure Function Tests

Every pure function (no side effects) MUST have 100% coverage:

```typescript
// Example: formatters, calculators, validators
describe('formatCurrency', () => {
  it('formats positive numbers with currency symbol');
  it('formats negative numbers with parentheses');
  it('handles zero');
  it('handles undefined/null gracefully');
  it('respects locale settings');
  it('handles extremely large numbers');
  it('handles decimal precision');
});
```

**Required Test Patterns:**

- Happy path (valid inputs)
- Edge cases (boundaries, empty values)
- Error cases (invalid inputs)
- Type coercion cases
- Null/undefined handling
- Performance regression tests

#### Service Layer Tests

Every service function requires:

```typescript
describe('createPurchaseOrder', () => {
  // Success cases
  it('creates PO with valid data');
  it('generates correct PO number');
  it('links to RFQ correctly');

  // Validation cases
  it('rejects PO without vendor');
  it('rejects PO with negative amounts');
  it('validates item quantities');

  // Authorization cases
  it('enforces role-based access');
  it('validates approval workflow');

  // Concurrency cases
  it('handles simultaneous updates');
  it('uses transactions for consistency');

  // Error cases
  it('handles Firestore errors gracefully');
  it('provides meaningful error messages');
});
```

#### Hook Tests

Every React hook requires:

```typescript
describe('usePurchaseOrders', () => {
  it('fetches data on mount');
  it('handles loading state');
  it('handles error state');
  it('refetches on dependency change');
  it('cancels pending requests on unmount');
  it('handles stale-while-revalidate');
  it('handles network failures');
  it('handles empty results');
});
```

### 2.2 Integration Tests (Target: 500+ tests)

#### Firestore Integration Tests (with Emulator)

```typescript
// Located in: __integration__/firestore/
describe('Purchase Order Workflow', () => {
  beforeAll(async () => {
    await connectToFirestoreEmulator();
  });

  it('creates PO and updates linked PR status');
  it('enforces security rules for vendor access');
  it('triggers Cloud Function on PO creation');
  it('maintains referential integrity');
  it('handles cascade updates');
});
```

**Required Firestore Integration Suites:**

1. **Transactions Module**
   - Double-entry balance validation
   - GL posting accuracy
   - Multi-currency conversions
   - Audit trail generation

2. **Procurement Module**
   - RFQ → Offer → PO workflow
   - Three-way match validation
   - Goods receipt processing
   - Amendment tracking

3. **Documents Module**
   - Revision control
   - Submission workflow
   - Transmittal generation
   - CRS tracking

4. **HR Module**
   - Leave balance calculations
   - Approval workflow
   - Carry-forward logic

#### Firebase Auth Integration Tests

```typescript
describe('Authentication Flows', () => {
  it('enforces role-based route access');
  it('handles session expiration');
  it('validates custom claims');
  it('handles multi-tenant access');
});
```

#### Cloud Functions Integration Tests

```typescript
describe('Cloud Functions', () => {
  it('triggers on document create');
  it('handles function timeout');
  it('retries on transient errors');
  it('maintains idempotency');
});
```

### 2.3 End-to-End Tests (Target: 300+ tests)

#### Critical User Journeys

```typescript
// Located in: e2e/
describe('Complete Procurement Cycle', () => {
  test('PR → RFQ → Offer → PO → GRN → Invoice → Payment', async () => {
    // Create Purchase Request
    await page.goto('/procurement/purchase-requests/new');
    // ... complete workflow

    // Verify final state
    await expect(page.locator('[data-testid="payment-status"]')).toHaveText('Paid');
  });
});
```

**Required E2E Suites:**

| Suite                  | Tests | Priority |
| ---------------------- | ----- | -------- |
| Authentication         | 25    | CRITICAL |
| Dashboard              | 15    | HIGH     |
| Procurement Full Cycle | 50    | CRITICAL |
| Accounting Full Cycle  | 40    | CRITICAL |
| Document Management    | 30    | HIGH     |
| Project Charter        | 25    | HIGH     |
| Bank Reconciliation    | 35    | CRITICAL |
| Reporting              | 20    | MEDIUM   |
| User Management        | 20    | HIGH     |
| Approval Workflows     | 30    | CRITICAL |

### 2.4 Performance Tests (Target: 50+ tests)

```typescript
describe('Performance Benchmarks', () => {
  it('loads dashboard under 2s with 1000 projects');
  it('handles 100 concurrent offer evaluations');
  it('exports 10000 transactions under 30s');
  it('searches 50000 materials under 500ms');
});
```

**Required Performance Suites:**

1. **Load Time Benchmarks**
   - Initial page load < 3s
   - Navigation < 500ms
   - Form submission < 2s

2. **Data Volume Tests**
   - 10,000+ entities
   - 100,000+ transactions
   - 50,000+ documents

3. **Concurrency Tests**
   - 50 simultaneous users
   - 100 concurrent API calls
   - Database connection pooling

### 2.5 Security Tests (Target: 100+ tests)

```typescript
describe('Security Rules', () => {
  it('denies unauthenticated access');
  it('enforces role hierarchy');
  it('prevents cross-tenant data access');
  it('validates input sanitization');
  it('prevents XSS in user content');
  it('enforces rate limiting');
});
```

**Required Security Suites:**

| Category                 | Tests |
| ------------------------ | ----- |
| Authentication Bypass    | 20    |
| Authorization Escalation | 25    |
| Input Validation         | 30    |
| Data Isolation           | 15    |
| API Security             | 10    |

---

## 3. Testing Infrastructure Requirements

### 3.1 Mock Library

Create centralized mock factory:

```typescript
// apps/web/src/__mocks__/mockFactory.ts
export const createMockUser = (overrides?: Partial<User>) => ({
  id: 'user-1',
  email: 'test@example.com',
  role: 'MANAGER',
  ...overrides,
});

export const createMockPurchaseOrder = (overrides?: Partial<PurchaseOrder>) => ({
  id: 'po-1',
  number: 'PO-2024-001',
  status: 'DRAFT',
  ...overrides,
});

// ... factories for all entity types
```

### 3.2 Firestore Mock Utilities

```typescript
// apps/web/src/__mocks__/firestore.ts
export const createMockSnapshot = <T>(docs: T[]) => ({
  docs: docs.map((doc, i) => ({
    id: `doc-${i}`,
    data: () => doc,
    exists: () => true,
  })),
  size: docs.length,
  empty: docs.length === 0,
});

export const createMockDocRef = <T>(id: string, data: T) => ({
  id,
  data: () => data,
  exists: () => true,
});
```

### 3.3 Test Database Seeding

```typescript
// apps/web/src/__fixtures__/seedTestData.ts
export async function seedTestDatabase() {
  // Create test tenant
  await createTestTenant();

  // Create test users with various roles
  await createTestUsers();

  // Seed reference data
  await seedChartOfAccounts();
  await seedMaterialMaster();
  await seedEntities();

  // Seed transactional data
  await seedProjects();
  await seedProcurementData();
}
```

### 3.4 CI/CD Pipeline Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pnpm install
      - name: Run unit tests
        run: pnpm test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      firestore-emulator:
        image: google/cloud-sdk
    steps:
      - uses: actions/checkout@v4
      - name: Start Firebase emulators
        run: firebase emulators:start --only firestore,auth
      - name: Run integration tests
        run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Playwright
        run: npx playwright install
      - name: Run E2E tests
        run: pnpm test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Lighthouse CI
        run: pnpm test:lighthouse
```

---

## 4. Test Quality Standards

### 4.1 Test Naming Convention

```typescript
// Pattern: should_[action]_when_[condition]
it('should_reject_purchase_order_when_total_exceeds_budget');
it('should_generate_grn_when_goods_received');
it('should_notify_approver_when_pr_submitted');
```

### 4.2 Arrange-Act-Assert Pattern

```typescript
it('calculates correct total with tax', () => {
  // Arrange
  const items = [
    { quantity: 10, unitPrice: 100, taxRate: 0.18 },
    { quantity: 5, unitPrice: 200, taxRate: 0.18 },
  ];

  // Act
  const result = calculateTotal(items);

  // Assert
  expect(result.subtotal).toBe(2000);
  expect(result.tax).toBe(360);
  expect(result.total).toBe(2360);
});
```

### 4.3 Test Isolation Requirements

- Each test MUST be independent
- No shared mutable state between tests
- Use `beforeEach` for setup, `afterEach` for cleanup
- Mock all external dependencies

### 4.4 Assertion Requirements

Each test MUST have:

- At least one meaningful assertion
- Specific error messages for debugging
- Type-safe assertions where possible

```typescript
// Bad
expect(result).toBeTruthy();

// Good
expect(result.status).toBe('APPROVED');
expect(result.approvedBy).toBe('user-1');
expect(result.approvedAt).toBeInstanceOf(Date);
```

---

## 5. Module-Specific Testing Requirements

### 5.1 Accounting Module (42 files, 8,867 lines)

**Critical Functions Requiring 100% Coverage:**

| File                         | Functions            | Priority |
| ---------------------------- | -------------------- | -------- |
| glEntryGenerator.ts          | All GL posting       | CRITICAL |
| transactionHelpers.ts        | Balance calculations | CRITICAL |
| paymentHelpers.ts            | Payment processing   | CRITICAL |
| bankReconciliationService.ts | Matching algorithms  | CRITICAL |
| tdsReportGenerator.ts        | Tax calculations     | HIGH     |
| auditLogger.ts               | Compliance logging   | HIGH     |

**Required Test Scenarios:**

1. **Double-Entry Validation**
   - Every transaction debits = credits
   - Currency conversion accuracy
   - Rounding precision (4 decimal places)

2. **Bank Reconciliation**
   - Fuzzy matching with various thresholds
   - Multi-match resolution
   - Historical reconciliation

3. **Tax Compliance**
   - TDS calculation accuracy
   - GST return generation
   - Fiscal year handling

### 5.2 Procurement Module (51 files, 9,525 lines)

**Critical Functions Requiring 100% Coverage:**

| File                    | Functions          | Priority |
| ----------------------- | ------------------ | -------- |
| purchaseOrderHelpers.ts | PO lifecycle       | CRITICAL |
| threeWayMatchHelpers.ts | Match validation   | CRITICAL |
| offerHelpers.ts         | Offer comparison   | HIGH     |
| amendmentHelpers.ts     | Amendment tracking | HIGH     |
| goodsReceiptService.ts  | GRN processing     | CRITICAL |

**Required Test Scenarios:**

1. **Workflow Validation**
   - PR → RFQ → Offer → PO → GRN → Invoice
   - Status transitions only in valid sequence
   - Rollback on failure

2. **Three-Way Match**
   - PO vs GRN vs Invoice matching
   - Tolerance handling
   - Partial match scenarios

3. **Amendment Tracking**
   - Version history
   - Change impact calculation
   - Approval workflow

### 5.3 Documents Module (17 files, 6,034 lines)

**Required Test Scenarios:**

1. **Revision Control**
   - Version numbering (A, B, C, A1, A2)
   - Revision history
   - Supersession handling

2. **Submission Workflow**
   - Status transitions
   - Comments and responses
   - CRS tracking

3. **Transmittal Generation**
   - Document bundling
   - Distribution list
   - Acknowledgment tracking

### 5.4 HR Module (7 files, 1,652 lines)

**Required Test Scenarios:**

1. **Leave Management**
   - Balance calculations
   - Carry-forward logic
   - Encashment calculations

2. **Approval Workflow**
   - Multi-level approvals
   - Delegation handling
   - Auto-approval rules

---

## 6. Test Data Requirements

### 6.1 Fixture Data

Create comprehensive fixtures:

```
apps/web/src/__fixtures__/
├── users/
│   ├── admin.json
│   ├── manager.json
│   ├── engineer.json
│   └── accountant.json
├── entities/
│   ├── vendors.json
│   └── customers.json
├── projects/
│   ├── active-project.json
│   └── completed-project.json
├── procurement/
│   ├── purchase-requests.json
│   ├── rfqs.json
│   ├── offers.json
│   └── purchase-orders.json
└── accounting/
    ├── chart-of-accounts.json
    ├── transactions.json
    └── bank-statements.json
```

### 6.2 Test Data Generation

```typescript
// For performance testing
export function generateBulkTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `txn-${i}`,
    date: randomDate(),
    amount: randomAmount(1000, 100000),
    // ...
  }));
}
```

---

## 7. Continuous Testing Requirements

### 7.1 Pre-Commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm test:affected"
    }
  }
}
```

### 7.2 Pull Request Requirements

- All tests must pass
- Coverage must not decrease
- No skipped tests without approval
- Performance benchmarks must pass

### 7.3 Nightly Test Runs

- Full E2E suite
- Performance regression tests
- Security scan
- Dependency audit

---

## 8. Testing Tools & Configuration

### 8.1 Required Tools

| Tool          | Purpose           | Configuration        |
| ------------- | ----------------- | -------------------- |
| Jest          | Unit/Integration  | jest.config.ts       |
| Playwright    | E2E               | playwright.config.ts |
| Lighthouse CI | Performance       | lighthouserc.js      |
| Snyk          | Security          | .snyk                |
| Codecov       | Coverage tracking | codecov.yml          |

### 8.2 Jest Configuration Enhancements

```typescript
// jest.config.ts
export default {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 85,
      lines: 80,
    },
    './src/lib/accounting/': {
      statements: 90,
      branches: 85,
    },
    './src/lib/procurement/': {
      statements: 90,
      branches: 85,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
    '!src/**/types/**',
  ],
};
```

---

## 9. Test Documentation Requirements

### 9.1 Test Plan Document

Each major feature requires:

- Test scenarios list
- Test data requirements
- Expected results
- Risk assessment

### 9.2 Test Result Reporting

- Daily test execution summary
- Weekly trend analysis
- Monthly coverage report
- Quarterly security audit

---

## 10. Estimated Effort

### 10.1 Test Development Timeline

| Phase                  | Tests      | Effort (days) |
| ---------------------- | ---------- | ------------- |
| Mock Infrastructure    | -          | 5             |
| Accounting Unit Tests  | 800        | 15            |
| Procurement Unit Tests | 900        | 15            |
| Documents Unit Tests   | 300        | 8             |
| HR Unit Tests          | 200        | 5             |
| Other Modules          | 500        | 10            |
| Integration Tests      | 500        | 20            |
| E2E Tests              | 300        | 15            |
| Performance Tests      | 50         | 10            |
| Security Tests         | 100        | 8             |
| **Total**              | **3,650+** | **111 days**  |

### 10.2 Priority Order

1. **Week 1-2**: Mock infrastructure + utils tests
2. **Week 3-4**: Accounting core tests
3. **Week 5-6**: Procurement core tests
4. **Week 7-8**: Integration tests
5. **Week 9-10**: E2E critical paths
6. **Week 11-12**: Security & performance
7. **Week 13+**: Coverage gaps + maintenance

---

## 11. Success Criteria for 10/10 Grade

| Criteria                    | Threshold |
| --------------------------- | --------- |
| Statement Coverage          | ≥ 85%     |
| Branch Coverage             | ≥ 80%     |
| All Critical Paths Tested   | 100%      |
| E2E User Journeys           | ≥ 50      |
| Performance Benchmarks Pass | 100%      |
| Security Tests Pass         | 100%      |
| Zero Flaky Tests            | Required  |
| Test Documentation Complete | Required  |
| CI/CD Integration           | Complete  |

---

## Appendix A: Test File Naming Convention

```
[filename].test.ts       - Unit tests
[filename].spec.ts       - Integration tests (collocated)
__integration__/*.ts     - Integration test suites
e2e/*.spec.ts           - End-to-end tests
```

## Appendix B: Test Command Reference

```bash
# Unit tests
pnpm test                    # Run all unit tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage report
pnpm test -- --filter=accounting  # Filter by path

# Integration tests
pnpm test:integration        # Run integration tests

# E2E tests
pnpm test:e2e               # Run all E2E tests
pnpm test:e2e:headed        # With browser visible
pnpm test:e2e -- --grep="procurement"  # Filter

# Performance
pnpm test:lighthouse        # Lighthouse audit
pnpm test:benchmark         # Performance benchmarks

# All tests
pnpm test:all              # Run everything
```
