# Test Infrastructure Assessment

**Date**: November 13, 2025
**Scope**: Complete test coverage expansion plan (80 hours)
**Current Status**: 2 test files, 10 tests, < 1% coverage
**Target**: 80% coverage across all critical modules

## Executive Summary

The VDT Unified application currently has minimal test coverage (< 1%) with only 2 test files covering basic functionality. This assessment outlines a comprehensive plan to expand test coverage to 80% across all critical business modules within 80 hours.

### Current Test Infrastructure

**✅ What's Working:**

- Jest v30.2.0 configured with ts-jest
- React Testing Library v16.3.0 for component testing
- jsdom test environment for DOM simulation
- Custom test utilities (`@/test-utils`) with MUI theming
- Path aliases configured (`@/`, `@vapour/`)
- CSS modules and static assets mocked
- Next.js navigation mocked globally
- 2 test suites passing (100% pass rate)
  - `paymentHelpers.test.ts` - 3 tests for GL entry validation
  - `error.test.tsx` - 7 tests for error boundary

**⚠️ Gaps Identified:**

- **Coverage**: < 1% overall (0.49% statements, 5.98% branches, 1.76% functions)
- **Service Layer**: 0 tests for 50+ service files
- **Context Providers**: 0 tests for AuthContext
- **UI Components**: Only 1 error boundary tested
- **Workflows**: 0 tests for procurement/accounting workflows
- **Integration Tests**: 0 cross-module tests
- **Firebase Mocking**: Minimal mocking infrastructure
- **Test Utilities**: Basic setup, needs expansion

### Coverage Thresholds

Current configuration (`jest.config.ts:65-72`):

```typescript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

**Current vs Target:**

| Metric     | Current | Threshold | Gap   |
| ---------- | ------- | --------- | ----- |
| Statements | 0.49%   | 50%       | 49.5% |
| Branches   | 5.98%   | 50%       | 44%   |
| Functions  | 1.76%   | 50%       | 48.2% |
| Lines      | 0.49%   | 50%       | 49.5% |

## Test Infrastructure Components

### 1. Jest Configuration (`apps/web/jest.config.ts`)

**Features:**

- V8 coverage provider
- ts-jest preset for TypeScript
- jsdom environment
- Setup file: `jest.setup.ts`
- Path alias mapping
- Module mocking for CSS, images
- Test patterns: `**/__tests__/**/*.[jt]s?(x)`, `**/?(*.)+(spec|test).[jt]s?(x)`

**Strengths:**

- Comprehensive path mapping
- Proper TypeScript configuration
- Coverage collection configured

**Improvements Needed:**

- Add Firebase SDK mocking at global level
- Add Firestore emulator test utilities
- Configure test data factories
- Add custom matchers for Firebase types

### 2. Test Setup (`apps/web/jest.setup.ts`)

**Current Mocks:**

- `@testing-library/jest-dom` - DOM matchers
- `next/navigation` - Router, useSearchParams, usePathname
- Firebase environment variables
- Global React for JSX

**Missing Mocks:**

- Firebase Auth
- Firestore
- Firebase Storage
- Cloud Functions SDK
- Real-time listeners (onSnapshot)
- Query cursors for pagination

### 3. Test Utilities (`apps/web/src/test-utils/index.tsx`)

**Current Features:**

- Custom render with MUI ThemeProvider
- CssBaseline wrapper
- Re-exports from RTL

**Needed Additions:**

- AuthContext provider wrapper
- Mock user fixtures (different roles)
- Firestore data factories
- Custom queries (by role, data-testid patterns)
- Snapshot utilities
- Async utilities for Firestore
- Mock service layer
- Test fixtures for common entities

## Codebase Structure Analysis

### Module Breakdown

**1. Authentication & Authorization** (Estimated: 20 hours)

- **Files**: 1 context file (`AuthContext.tsx`)
- **Coverage**: 0%
- **Priority**: Critical (affects all other modules)
- **Tests Needed**:
  - User login/logout flows
  - Permission checks (canManageProjects, canViewAccounting, etc.)
  - Role-based access control (Super Admin, Admin, Project Manager, etc.)
  - Custom claims validation
  - Token refresh logic
  - Session management
  - Error handling

**2. Procurement Workflows** (Estimated: 20 hours)

- **Files**: 20+ service files
  - `purchaseRequestService` (6 modules, 735 lines)
  - `rfqService` (6 modules, 735 lines)
  - `offerService` (7 modules, 835 lines)
  - `purchaseOrderService`
  - `threeWayMatchService` (7 modules)
  - `goodsReceiptService`
  - `workCompletionService`
- **Coverage**: 0%
- **Priority**: High
- **Tests Needed**:
  - Purchase request creation and approval
  - RFQ generation from PR
  - Vendor offer submission and evaluation
  - PO creation from winning offer
  - Goods receipt and quality checks
  - Three-way matching (PO + GRN + Invoice)
  - Work completion and payment approval
  - Status transitions and validations
  - Permission-based workflow gates

**3. Accounting & Financial** (Estimated: 15 hours)

- **Files**: 35+ service files
  - `glEntryGenerator.ts` - GL entry generation
  - `bankReconciliationService` (6 modules)
  - `autoMatchingEngine` (5 modules)
  - `gstReportGenerator` (5 modules)
  - `tdsCalculator.ts` - TDS calculation
  - `fiscalYearService.ts`
  - `costCentreService.ts`
  - `paymentHelpers.ts` (✅ 3 tests exist)
- **Coverage**: ~5% (only paymentHelpers tested)
- **Priority**: High
- **Tests Needed**:
  - GL entry generation and validation
  - Double-entry bookkeeping enforcement
  - Bank reconciliation (manual + auto-matching)
  - GST calculation and reporting
  - TDS calculation and compliance
  - Payment allocation across invoices
  - Chart of accounts management
  - Cost centre allocation
  - Fiscal year transitions
  - Financial report generation

**4. Projects Management** (Estimated: 10 hours)

- **Files**: 4 service files
  - `budgetCalculationService.ts`
  - `charterProcurementService.ts`
  - `charterValidationService.ts`
  - `documentRequirementService.ts`
- **Coverage**: 0%
- **Priority**: Medium
- **Tests Needed**:
  - Project charter creation and approval
  - Budget calculations and locking
  - Cost centre integration
  - Scope definition
  - Timeline management
  - Team assignment
  - Vendor management
  - Document requirements validation
  - Charter approval workflow
  - Budget vs actual tracking

**5. UI Components** (Estimated: 10 hours)

- **Files**: 100+ React components
  - Error boundaries (✅ 1 tested: `dashboard/error.tsx`)
  - Forms and dialogs (RecordVendorPaymentDialog, CreateBillDialog, etc.)
  - Tables and lists (with pagination)
  - Multi-step forms (purchase request, RFQ, etc.)
  - Custom hooks (useEditableList, useWorkflowDialogs, etc.)
- **Coverage**: ~0.5%
- **Priority**: Medium
- **Tests Needed**:
  - Form validation and submission
  - Dialog open/close behavior
  - User interactions (button clicks, input changes)
  - Error states and loading states
  - Table sorting and pagination
  - File upload components
  - Custom hooks behavior
  - Accessibility compliance

**6. Integration Tests** (Estimated: 5 hours)

- **Coverage**: 0%
- **Priority**: Medium
- **Tests Needed**:
  - End-to-end procurement workflow (PR → RFQ → PO → GRN → Match)
  - Accounting integration (PO → Bill creation → Payment)
  - Project budget → Cost centre → GL posting
  - User permissions across modules
  - Real-time data synchronization
  - Error propagation and recovery
  - Concurrent user scenarios

## Testing Strategy

### Phase 1: Foundation (5 hours)

**1.1 Enhanced Test Utilities** (2 hours)

- Create comprehensive Firebase mocks
- Build test data factories
- Add custom matchers
- Create AuthContext test wrapper

**1.2 Shared Test Fixtures** (2 hours)

- User fixtures (all roles)
- Entity fixtures (vendors, customers)
- Project fixtures
- Transaction fixtures
- Permission sets

**1.3 Mock Service Layer** (1 hour)

- Firestore operation mocks
- Cloud Functions mocks
- Real-time listener mocks

### Phase 2: Authentication & Authorization (20 hours)

**2.1 AuthContext Tests** (8 hours)

- Login/logout flows (2h)
- Permission checks (3h)
- Role-based access (2h)
- Token management (1h)

**2.2 Permission Utilities** (6 hours)

- canManageProjects tests
- canViewAccounting tests
- canManageEntities tests
- canAccessSuperAdmin tests
- Custom permission combinations

**2.3 Session Management** (6 hours)

- Session timeout hook
- Token refresh logic
- Idle detection
- Multi-tab synchronization

### Phase 3: Procurement Workflows (20 hours)

**3.1 Purchase Request Module** (5 hours)

- CRUD operations
- Approval workflow
- Status transitions
- Line item management

**3.2 RFQ Module** (5 hours)

- RFQ creation from PR
- Vendor selection
- Quote submission
- Evaluation criteria

**3.3 Offer & PO Module** (5 hours)

- Offer comparison
- Winner selection
- PO generation
- Terms and conditions

**3.4 Three-Way Match Module** (5 hours)

- PO + GRN + Invoice matching
- Tolerance checks
- Discrepancy handling
- Bill creation integration

### Phase 4: Accounting & Financial (15 hours)

**4.1 GL Entry Generation** (4 hours)

- Double-entry validation
- Account mapping
- Entry balancing
- Transaction types

**4.2 Payment Processing** (3 hours)

- ✅ Existing: Payment allocation tests
- Enhance: Multiple invoice allocation
- Add: Payment method handling
- Add: Currency conversion

**4.3 Bank Reconciliation** (4 hours)

- Manual matching
- Auto-matching engine
- Fuzzy matching algorithm
- Reporting

**4.4 Tax Compliance** (4 hours)

- GST calculation
- TDS calculation
- Report generation
- Filing interface

### Phase 5: Projects Management (10 hours)

**5.1 Charter Management** (5 hours)

- Charter creation
- Validation rules
- Approval workflow
- Budget locking

**5.2 Budget & Cost Centre** (5 hours)

- Budget calculations
- Cost centre creation
- GL integration
- Variance tracking

### Phase 6: UI Components (10 hours)

**6.1 Critical Forms** (4 hours)

- Payment dialogs
- Entity creation
- Purchase request form
- Bill creation

**6.2 Custom Hooks** (3 hours)

- useEditableList
- useWorkflowDialogs
- useReconciliationData
- usePurchaseRequestForm

**6.3 Error Boundaries** (3 hours)

- ✅ Existing: Dashboard error boundary
- Add: Module error boundaries (accounting, procurement, projects)
- Add: Error recovery flows

### Phase 7: Integration Tests (5 hours)

**7.1 Procurement E2E** (2 hours)

- Full workflow: PR → RFQ → PO → GRN
- Cross-module validations

**7.2 Accounting Integration** (2 hours)

- PO → Bill → Payment flow
- GL posting verification

**7.3 Project Integration** (1 hour)

- Charter → Cost Centre → Budget
- Procurement linkage

## Test Naming Conventions

### File Naming

- **Unit tests**: `filename.test.ts` or `filename.test.tsx`
- **Integration tests**: `filename.integration.test.ts`
- **Component tests**: `ComponentName.test.tsx`

### Test Structure

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do X when Y condition', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error when Z condition', () => {
      // Test error case
    });
  });
});
```

### Test Categories

- **Happy path**: Normal successful operations
- **Error handling**: Invalid inputs, edge cases
- **Permissions**: Role-based access control
- **State management**: React state, context updates
- **Side effects**: Firestore writes, Cloud Function calls

## Code Coverage Goals

### Target Coverage by Module

| Module               | Statements | Branches | Functions | Lines   |
| -------------------- | ---------- | -------- | --------- | ------- |
| Authentication       | 90%        | 85%      | 90%       | 90%     |
| Procurement Services | 80%        | 75%      | 80%       | 80%     |
| Accounting Services  | 80%        | 75%      | 80%       | 80%     |
| Projects Services    | 75%        | 70%      | 75%       | 75%     |
| UI Components        | 70%        | 65%      | 70%       | 70%     |
| Utilities            | 85%        | 80%      | 85%       | 85%     |
| **Overall Target**   | **80%**    | **75%**  | **80%**   | **80%** |

### Progressive Thresholds

**Week 1** (Foundation + Auth):

```typescript
coverageThreshold: {
  global: { statements: 30, branches: 25, functions: 30, lines: 30 }
}
```

**Week 2** (+ Procurement):

```typescript
coverageThreshold: {
  global: { statements: 50, branches: 45, functions: 50, lines: 50 }
}
```

**Week 3** (+ Accounting):

```typescript
coverageThreshold: {
  global: { statements: 65, branches: 60, functions: 65, lines: 65 }
}
```

**Week 4** (+ Projects + UI + Integration):

```typescript
coverageThreshold: {
  global: { statements: 80, branches: 75, functions: 80, lines: 80 }
}
```

## Implementation Roadmap

### Week 1: Foundation & Authentication (25 hours)

- **Days 1-2**: Test utilities and fixtures (5h)
- **Days 3-5**: Authentication & Authorization tests (20h)
- **Deliverable**: AuthContext fully tested, foundation ready

### Week 2: Procurement (20 hours)

- **Days 1-2**: Purchase Request module (5h)
- **Days 3-4**: RFQ module (5h)
- **Days 5-6**: Offer & PO module (5h)
- **Days 7**: Three-Way Match module (5h)
- **Deliverable**: Procurement workflows tested

### Week 3: Accounting (15 hours)

- **Days 1-2**: GL Entry & Payment (7h)
- **Days 3-4**: Bank Reconciliation (4h)
- **Days 5**: Tax Compliance (4h)
- **Deliverable**: Accounting services tested

### Week 4: Projects, UI & Integration (20 hours)

- **Days 1-2**: Projects Management (10h)
- **Days 3-4**: UI Components (10h)
- **Day 5**: Integration tests (5h)
- **Deliverable**: Full test coverage achieved

**Total Time**: 80 hours
**Total Duration**: 4 weeks (assuming 4 hours/day)

## Recommended Test Execution

### Local Development

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific file
pnpm test -- paymentHelpers.test.ts
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: pnpm test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./apps/web/coverage/coverage-final.json
```

## Success Metrics

### Quantitative

- ✅ **80% coverage** across all modules
- ✅ **100% pass rate** for all tests
- ✅ **< 5 minute** test execution time
- ✅ **Zero false positives** in CI/CD

### Qualitative

- ✅ **Confidence** in refactoring code
- ✅ **Faster** bug detection
- ✅ **Better** code documentation (tests as docs)
- ✅ **Easier** onboarding for new developers
- ✅ **Reduced** regression bugs

## Next Steps

1. **Review and Approve**: Review this assessment with team
2. **Start Week 1**: Begin with test utilities and authentication tests
3. **Daily Standup**: Track progress on each module
4. **Weekly Review**: Assess coverage growth and adjust plan
5. **Final Review**: Verify 80% coverage achieved across all modules

---

**Status**: 📋 **PLAN READY**
**Next Task**: Create test utilities and mock infrastructure
**Estimated Completion**: 4 weeks (80 hours total)
