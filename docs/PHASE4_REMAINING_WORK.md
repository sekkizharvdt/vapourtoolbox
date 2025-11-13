# Phase 4: Remaining UI Component Refactoring

## Completed (3/4 components, 5 hours):

1. ✅ **ScopeTab.tsx**: 844 → 179 lines (79% reduction)
2. ✅ **PODetailClient.tsx**: 785 → 221 lines (72% reduction)
3. ✅ **ReconciliationWorkspace.tsx**: 614 → 226 lines (63% reduction)

**Total Reduction**: 2,243 → 626 lines (72% reduction, 1,617 lines removed)

## Remaining Work (1/4 components, 1.5 hours):

### purchase-requests/new/page.tsx (659 lines)

**File**: `/apps/web/src/app/procurement/purchase-requests/new/page.tsx`

**Current Issues**:

- Multi-step form with repetitive validation logic
- Large component mixing state, handlers, and UI
- 3 major sections that could be separate components

**Recommended Extraction**:

1. **usePurchaseRequestForm Hook** (~80 lines):
   - Form state management (formData, lineItems)
   - Input change handlers
   - Line item CRUD handlers
   - Validation logic for each step

2. **BasicInformationStep Component** (~90 lines):
   - Type, category, project selector
   - Title, description fields
   - Priority and required by date fields

3. **LineItemsStep Component** (~130 lines):
   - Line items table with inline editing
   - Add/remove line item actions
   - Excel import integration
   - Empty state handling

4. **ReviewStep Component** (~80 lines):
   - Summary of basic information
   - Read-only line items table
   - Submission info alert

5. **NavigationButtons Component** (~40 lines):
   - Cancel, Back, Next, Submit buttons
   - Conditional rendering based on active step
   - Loading states

**Expected Result**: 659 → ~240 lines (64% reduction)

**Benefits**:

- Each step component can be tested independently
- Form logic separated from UI rendering
- Easier to add new steps or modify existing ones
- Reusable components for similar multi-step forms

**Estimated Effort**: 1.5 hours

**Priority**: Medium (current code is functional, refactoring improves maintainability)
