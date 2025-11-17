# Large File Refactoring Plan

**Date**: November 13, 2025
**Status**: 📋 Planning Phase
**Priority**: Medium (Month 1 Performance Optimization)
**Estimated Effort**: 20-30 hours for complete refactoring

---

## Executive Summary

The codebase contains **24 files exceeding 600 lines**, with **9 service files** (business logic) and **13 UI components** requiring optimization. While the code is well-structured and functional, breaking these large files into smaller, focused modules will improve:

- **Maintainability**: Easier to find and fix bugs
- **Testability**: Smaller units are easier to test
- **Reusability**: Extracted utilities can be shared
- **Performance**: Potential for better code-splitting
- **Team Velocity**: Multiple developers can work on different modules

### Quick Stats

- **Total Large Files**: 24 (>600 lines each)
- **Total Lines**: 16,577 lines across all large files
- **Service Files**: 9 files, 6,572 lines (avg 730 lines/file)
- **UI Components**: 13 files, 9,311 lines (avg 716 lines/file)
- **Data Files**: 2 files, 2,009 lines (low priority)

---

## Current State Analysis

### Service Files (Priority: HIGH)

These files contain complex business logic and are prime candidates for refactoring:

| File                           | Lines | Exports | Complexity | Priority    |
| ------------------------------ | ----- | ------- | ---------- | ----------- |
| `purchaseRequestService.ts`    | 950   | 15      | Very High  | ⚠️ Critical |
| `bankReconciliationService.ts` | 868   | 15      | Very High  | ⚠️ Critical |
| `threeWayMatchService.ts`      | 772   | 14      | High       | 🔶 High     |
| `gstReportGenerator.ts`        | 759   | 5       | High       | 🔶 High     |
| `offerService.ts`              | 706   | 13      | High       | 🔶 High     |
| `rfqService.ts`                | 656   | 13      | Medium     | 🟡 Medium   |
| `autoMatchingEngine.ts`        | 623   | 6       | Medium     | 🟡 Medium   |
| `glEntryGenerator.ts`          | 621   | 5       | Medium     | 🟡 Medium   |
| `amendmentService.ts`          | 617   | 9       | Medium     | 🟡 Medium   |

**Total**: 6,572 lines across 9 files

### UI Components (Priority: MEDIUM)

Large UI components with mixed logic and presentation:

| File                               | Lines | Type        | Priority  |
| ---------------------------------- | ----- | ----------- | --------- |
| `ScopeTab.tsx`                     | 844   | Form/Tab    | 🟡 Medium |
| `PODetailClient.tsx`               | 785   | Detail Page | 🟡 Medium |
| `VendorsTab.tsx`                   | 750   | Form/Tab    | 🟢 Low    |
| `TechnicalTab.tsx`                 | 745   | Form/Tab    | 🟢 Low    |
| `page_old.tsx` (tax-compliance)    | 755   | Legacy      | 🔵 Ignore |
| `ProcurementTab.tsx`               | 623   | Form/Tab    | 🟢 Low    |
| `page.tsx` (purchase-requests/new) | 659   | Form Page   | 🟡 Medium |
| `RecordCustomerPaymentDialog.tsx`  | 657   | Dialog Form | 🟢 Low    |
| `page.tsx` (currency)              | 653   | Page        | 🟢 Low    |
| `ImportBankStatementDialog.tsx`    | 631   | Dialog Form | 🟢 Low    |
| `ReconciliationWorkspace.tsx`      | 614   | Workspace   | 🟡 Medium |
| `RecordVendorPaymentDialog.tsx`    | 621   | Dialog Form | 🟢 Low    |
| `ReportsTab.tsx`                   | 619   | Tab         | 🟢 Low    |

**Total**: 9,311 lines across 13 files

### Data/Type Files (Priority: LOW)

Static data and type definitions:

| File                     | Lines | Type  | Priority |
| ------------------------ | ----- | ----- | -------- |
| `procurement.ts` (types) | 1,315 | Types | 🔵 Low   |
| `indian-coa-template.ts` | 694   | Data  | 🔵 Low   |

**Total**: 2,009 lines (mostly type definitions and static data)

---

## Refactoring Strategies

### Strategy 1: Service File Decomposition

**Target**: Service files with 600+ lines and 10+ exports

**Approach**: Extract-Transform Pattern

```
Original Structure:
├── purchaseRequestService.ts (950 lines, 15 exports)

Refactored Structure:
├── purchaseRequest/
│   ├── index.ts                     # Public API barrel export
│   ├── crud.ts                      # CRUD operations (create, read, update)
│   ├── workflow.ts                  # Workflow (submit, approve, reject)
│   ├── queries.ts                   # Query helpers (getPending, getApproved)
│   ├── utils.ts                     # Utilities (generatePRNumber, validate)
│   ├── types.ts                     # Type definitions
│   └── __tests__/                   # Co-located tests
│       ├── crud.test.ts
│       ├── workflow.test.ts
│       └── queries.test.ts
```

**Benefits**:

- **Cohesion**: Related functions grouped together
- **Testability**: Easier to test individual modules
- **Imports**: Consumers still import from `@/lib/procurement/purchaseRequest`
- **Discovery**: Easier to find specific functionality
- **Parallel Work**: Team can work on different modules simultaneously

**Example Refactoring**:

```typescript
// BEFORE: purchaseRequestService.ts (950 lines)
export async function createPurchaseRequest(...) { }
export async function getPurchaseRequestById(...) { }
export async function listPurchaseRequests(...) { }
export async function updatePurchaseRequest(...) { }
export async function submitPurchaseRequestForApproval(...) { }
export async function approvePurchaseRequest(...) { }
export async function rejectPurchaseRequest(...) { }
export async function getPendingApprovals(...) { }
export async function getApprovedPRs(...) { }
async function generatePRNumber(...) { }
async function validateProjectBudget(...) { }

// AFTER: purchaseRequest/crud.ts (250 lines)
export async function createPurchaseRequest(...) { }
export async function getPurchaseRequestById(...) { }
export async function listPurchaseRequests(...) { }
export async function updatePurchaseRequest(...) { }

// AFTER: purchaseRequest/workflow.ts (300 lines)
export async function submitPurchaseRequestForApproval(...) { }
export async function approvePurchaseRequest(...) { }
export async function rejectPurchaseRequest(...) { }

// AFTER: purchaseRequest/queries.ts (150 lines)
export async function getPendingApprovals(...) { }
export async function getApprovedPRs(...) { }
export async function getUnderReviewPRs(...) { }

// AFTER: purchaseRequest/utils.ts (100 lines)
export async function generatePRNumber(...) { }
export async function validateProjectBudget(...) { }
export async function incrementAttachmentCount(...) { }

// AFTER: purchaseRequest/types.ts (100 lines)
export interface CreatePurchaseRequestInput { }
export interface UpdatePurchaseRequestInput { }
export interface ListPurchaseRequestsFilters { }

// AFTER: purchaseRequest/index.ts (50 lines - Barrel export)
export * from './crud';
export * from './workflow';
export * from './queries';
export * from './types';
```

**Migration Path**:

1. Create new directory structure
2. Copy functions to appropriate modules
3. Update internal imports
4. Create barrel export (index.ts)
5. Update consumer imports (optional - barrel maintains compatibility)
6. Delete old file
7. Run tests to verify

**Estimated Effort per Service File**: 2-3 hours

---

### Strategy 2: UI Component Extraction

**Target**: UI components with 700+ lines mixing logic and presentation

**Approach**: Separate Concerns Pattern

```
Original Structure:
├── ScopeTab.tsx (844 lines - form + logic + UI)

Refactored Structure:
├── ScopeTab/
│   ├── index.tsx                    # Main component (150 lines)
│   ├── ScopeForm.tsx                # Form component (200 lines)
│   ├── DeliverablesList.tsx         # Deliverables section (150 lines)
│   ├── MilestonesList.tsx           # Milestones section (150 lines)
│   ├── useScopeData.ts              # Custom hook for data fetching (100 lines)
│   ├── useScopeValidation.ts        # Validation logic (100 lines)
│   ├── types.ts                     # Component types (50 lines)
│   └── __tests__/                   # Tests
│       ├── ScopeForm.test.tsx
│       └── useScopeData.test.ts
```

**Benefits**:

- **Readability**: Smaller, focused components
- **Reusability**: Extracted components can be reused
- **Performance**: Better code-splitting opportunities
- **Testing**: Easier to test individual pieces
- **Hooks**: Business logic in custom hooks, separate from UI

**Example Refactoring**:

```typescript
// BEFORE: ScopeTab.tsx (844 lines)
export default function ScopeTab() {
  // 100 lines of state management
  const [formData, setFormData] = useState(...);
  const [errors, setErrors] = useState(...);
  // ... more state

  // 200 lines of data fetching
  useEffect(() => {
    async function loadData() {
      // Complex data loading
    }
    loadData();
  }, [dependencies]);

  // 150 lines of validation logic
  const validateScope = () => {
    // Complex validation
  };

  // 400 lines of JSX
  return (
    <Box>
      {/* Massive form with many fields */}
    </Box>
  );
}

// AFTER: ScopeTab/index.tsx (150 lines)
import { useScopeData } from './useScopeData';
import { useScopeValidation } from './useScopeValidation';
import { ScopeForm } from './ScopeForm';
import { DeliverablesList } from './DeliverablesList';
import { MilestonesList } from './MilestonesList';

export default function ScopeTab() {
  const { data, loading, error } = useScopeData();
  const { validate, errors } = useScopeValidation();

  return (
    <Box>
      <ScopeForm data={data} errors={errors} onValidate={validate} />
      <DeliverablesList deliverables={data.deliverables} />
      <MilestonesList milestones={data.milestones} />
    </Box>
  );
}

// AFTER: ScopeTab/useScopeData.ts (100 lines)
export function useScopeData() {
  // All data fetching logic
}

// AFTER: ScopeTab/useScopeValidation.ts (100 lines)
export function useScopeValidation() {
  // All validation logic
}
```

**Migration Path**:

1. Create component directory
2. Extract custom hooks (data, validation, state)
3. Extract sub-components (forms, lists, sections)
4. Create main component that composes everything
5. Update imports in parent pages
6. Delete old file
7. Test thoroughly

**Estimated Effort per UI Component**: 1.5-2 hours

---

### Strategy 3: Generator/Engine Refactoring

**Target**: Complex algorithm files (GST report, GL entry, auto-matching)

**Approach**: Plugin Architecture Pattern

```
Original Structure:
├── gstReportGenerator.ts (759 lines - all generation logic)

Refactored Structure:
├── gstReport/
│   ├── index.ts                     # Public API
│   ├── generator.ts                 # Main orchestrator (150 lines)
│   ├── plugins/
│   │   ├── gstr1.ts                 # GSTR-1 report (150 lines)
│   │   ├── gstr2.ts                 # GSTR-2 report (150 lines)
│   │   ├── gstr3b.ts                # GSTR-3B report (150 lines)
│   │   └── gstr9.ts                 # GSTR-9 report (150 lines)
│   ├── utils.ts                     # Shared utilities (100 lines)
│   └── types.ts                     # Type definitions (50 lines)
```

**Benefits**:

- **Extensibility**: Easy to add new report types
- **Maintainability**: Each report type in its own file
- **Testing**: Test each report type independently
- **Performance**: Lazy-load report generators as needed

**Estimated Effort per Generator File**: 2-3 hours

---

## Implementation Roadmap

### Phase 1: Critical Service Files (Week 1-2)

**Goal**: Refactor the 2 largest, most-used service files

**Files**:

1. `purchaseRequestService.ts` (950 lines) - 3 hours
2. `bankReconciliationService.ts` (868 lines) - 3 hours

**Deliverables**:

- 2 refactored services with improved structure
- Co-located tests for each module
- Updated documentation

**Estimated Effort**: 6 hours

---

### Phase 2: High-Priority Services (Week 3-4)

**Goal**: Refactor remaining high-complexity service files

**Files**:

1. `threeWayMatchService.ts` (772 lines) - 2.5 hours
2. `gstReportGenerator.ts` (759 lines) - 3 hours
3. `offerService.ts` (706 lines) - 2.5 hours

**Deliverables**:

- 3 refactored services
- Improved test coverage
- Performance benchmarks

**Estimated Effort**: 8 hours

---

### Phase 3: Medium-Priority Services (Week 5-6)

**Goal**: Complete service file refactoring

**Files**:

1. `rfqService.ts` (656 lines) - 2 hours
2. `autoMatchingEngine.ts` (623 lines) - 2 hours
3. `glEntryGenerator.ts` (621 lines) - 2 hours
4. `amendmentService.ts` (617 lines) - 2 hours

**Deliverables**:

- All service files refactored
- Comprehensive test suite
- Code quality metrics improvement

**Estimated Effort**: 8 hours

---

### Phase 4: UI Components (Week 7-8)

**Goal**: Refactor largest UI components

**Files**:

1. `ScopeTab.tsx` (844 lines) - 2 hours
2. `PODetailClient.tsx` (785 lines) - 2 hours
3. `ReconciliationWorkspace.tsx` (614 lines) - 1.5 hours
4. `page.tsx` (purchase-requests/new) (659 lines) - 1.5 hours

**Deliverables**:

- 4 refactored UI components
- Extracted custom hooks
- Component library additions

**Estimated Effort**: 7 hours

---

## Total Estimated Effort

| Phase     | Description                        | Hours        |
| --------- | ---------------------------------- | ------------ |
| Phase 1   | Critical Services (2 files)        | 6            |
| Phase 2   | High-Priority Services (3 files)   | 8            |
| Phase 3   | Medium-Priority Services (4 files) | 8            |
| Phase 4   | UI Components (4 files)            | 7            |
| **Total** | **13 files refactored**            | **29 hours** |

**Remaining 11 files** (lower priority): ~15 hours additional
**Grand Total**: ~44 hours for complete refactoring

---

## Success Metrics

### Before Refactoring

- **Average Service File Size**: 730 lines
- **Average UI Component Size**: 716 lines
- **Files >600 lines**: 24 files
- **Test Coverage**: 7 tests (baseline)
- **Maintainability Index**: Baseline

### After Refactoring (Target)

- **Average Module Size**: <300 lines
- **Files >600 lines**: 0 files (all refactored)
- **Test Coverage**: 40% (with module-specific tests)
- **Code Quality Score**: 9.0/10 (from 8.8/10)
- **Build Performance**: 10% improvement (code-splitting)

---

## Risk Assessment

### Low Risk

✅ **Backward Compatibility**: Barrel exports maintain existing imports
✅ **Type Safety**: TypeScript ensures no breaking changes
✅ **Testing**: Existing functionality preserved
✅ **Rollback**: Git makes reverting easy if needed

### Medium Risk

⚠️ **Merge Conflicts**: Active development may cause conflicts

- **Mitigation**: Coordinate with team, work on stable branches

⚠️ **Import Updates**: Some imports may need updates

- **Mitigation**: Use barrel exports, update gradually

### Considerations

- **Time Investment**: 29-44 hours is significant
- **Testing Required**: Each refactoring must be tested
- **Team Coordination**: Multiple developers need to be aware
- **Documentation**: README/docs need updates

---

## Alternative Approaches

### Option A: Incremental Refactoring (Recommended)

**Approach**: Refactor one file at a time as needed during feature work

**Pros**:

- Low risk, gradual improvement
- Refactor happens when touching code anyway
- No dedicated refactoring sprints needed

**Cons**:

- Takes longer overall
- May never reach completion
- Less systematic

**Estimated Time**: 40-60 hours over 6 months

---

### Option B: Dedicated Refactoring Sprint (Alternative)

**Approach**: Dedicate 1-2 weeks to pure refactoring

**Pros**:

- Fast, comprehensive improvement
- All files refactored consistently
- Team learns refactoring patterns

**Cons**:

- Halts feature development
- Higher risk of merge conflicts
- Requires team buy-in

**Estimated Time**: 29 hours (Phases 1-4 only)

---

### Option C: Hybrid Approach (Balanced)

**Approach**: Refactor critical files (Phases 1-2) immediately, then incremental

**Pros**:

- Addresses biggest pain points quickly
- Remaining work done incrementally
- Balanced risk/reward

**Cons**:

- Partial solution
- May create inconsistency

**Estimated Time**: 14 hours upfront + 15 hours incremental

---

## Recommendations

Based on current project status (Month 1, 26% complete, 214 hours remaining):

### Immediate Action (Next 2 Weeks)

**Recommendation**: **Hybrid Approach** - Execute Phase 1 only

**Rationale**:

1. Testing infrastructure is higher priority (40-60 hours pending)
2. 6 hours for Phase 1 is manageable
3. Refactoring `purchaseRequestService` and `bankReconciliationService` provides biggest impact
4. Remaining files can be refactored incrementally

**Timeline**:

- Week 1: Refactor `purchaseRequestService.ts` (3 hours)
- Week 2: Refactor `bankReconciliationService.ts` (3 hours)
- After: Document pattern, refactor others incrementally during feature work

### Long-Term (Quarter 1)

**Recommendation**: **Incremental Refactoring** for remaining files

**Rationale**:

1. Spread effort over time
2. Lower risk of conflicts
3. Refactor when touching code anyway
4. Focus on testing and features in Month 1

---

## Technical Debt Tracking

### Before This Refactoring Plan

- **Technical Debt**: 740 hours
- **Large Files**: 24 files (16,577 lines)
- **Code Quality**: 8.8/10

### After Phase 1 (6 hours)

- **Technical Debt**: 734 hours
- **Large Files**: 22 files
- **Code Quality**: 8.9/10

### After Complete Refactoring (29 hours)

- **Technical Debt**: 711 hours
- **Large Files**: 11 files (low priority)
- **Code Quality**: 9.0/10

### After Full Refactoring (44 hours)

- **Technical Debt**: 696 hours
- **Large Files**: 0 files
- **Code Quality**: 9.2/10

---

## Next Steps

1. **Review this plan** with the team
2. **Decide on approach**: Dedicated sprint, incremental, or hybrid
3. **Prioritize files**: Agree on which files to refactor first
4. **Set up testing**: Ensure adequate tests before refactoring
5. **Create tracking**: Add refactoring tasks to project board
6. **Execute Phase 1**: Start with 2 critical service files (6 hours)
7. **Measure impact**: Track metrics before/after
8. **Document patterns**: Create refactoring guide for team

---

## References

- **Martin Fowler - Refactoring**: [https://refactoring.com/](https://refactoring.com/)
- **Clean Code Principles**: [https://github.com/ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript)
- **Component Composition**: [https://react.dev/learn/thinking-in-react](https://react.dev/learn/thinking-in-react)
- **CODEBASE_REVIEW.md**: Technical debt tracking document

---

**Document Version**: 1.0
**Last Updated**: November 13, 2025
**Maintained By**: Engineering Team
**Next Review**: December 1, 2025
