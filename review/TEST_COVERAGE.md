# Test Coverage by Module

This document provides a comprehensive overview of all unit tests, integration tests, and E2E tests organized by module.

**Last Updated:** December 23, 2025

---

## Summary

| Category | Suites | Tests |
|----------|--------|-------|
| Unit Tests | 104 | 3,815 |
| Integration Tests | 5 | 48 |
| E2E Tests | 8 | 192+ |
| **Total** | **117** | **4,055+** |

*Note: Test counts updated Dec 23, 2025 - includes 163 new tests for BOM/Estimation module + 150 tests for Admin Settings, Materials, and Shapes modules + 31 new integration tests + 79 new E2E tests + 97 new Projects module tests (67 unit + 8 integration + 22 E2E)*

---

## Test Coverage Matrix

| Module | Unit Tests | Integration Tests | E2E Tests | Total |
|--------|------------|-------------------|-----------|-------|
| **User Management** | 210 | 20 | 19 | 249 |
| **Accounting** | 564 | 0 | 0 | 564 |
| **Procurement** | 636 | 9 | 0 | 645 |
| **Documents** | 180 | 0 | 0 | 180 |
| **Entities** | 232 | 12 | 30 | 274 |
| **Projects** | 169 | 8 | 22 | 199 |
| **Feedback** | 230 | 23 | 28 | 281 |
| **Thermal Calculators** | 173 | 0 | 0 | 173 |
| **HR / Leaves** | 41 | 0 | 0 | 41 |
| **SSOT** | 77 | 0 | 0 | 77 |
| **BOM / Estimation** | 247 | 9 | 21 | 277 |
| **Materials** | 131 | 10 | 25 | 166 |
| **Shapes** | 102 | 0 | 0 | 102 |
| **Tasks / Flow** | 32 | 0 | 0 | 32 |
| **Workflow Engine** | 57 | 0 | 0 | 57 |
| **Shared Utilities** | 349 | 0 | 0 | 349 |
| **Shared UI (@vapour/ui)** | 111 | 0 | 0 | 111 |
| **Shared Packages** | 190 | 0 | 0 | 190 |
| **Core / Context** | 114 | 0 | 0 | 114 |
| **Cross-Module E2E** | 0 | 0 | 14 | 14 |
| **Proposals/Enquiries** | 0 | 0 | 0 | 0 |
| **Bought Out Items** | 0 | 0 | 0 | 0 |
| **Company Documents** | 0 | 0 | 0 | 0 |
| **Admin Settings** | 55 | 12 | 21 | 88 |
| **Currency/Forex** | 0 | 0 | 0 | 0 |
| **Chart of Accounts** | 0 | 0 | 0 | 0 |
| **Total** | **3,815** | **103** | **180** | **4,098** |

### Coverage Status Legend

| Status | Description |
|--------|-------------|
| ✅ Well Covered | >100 tests with unit, integration, and E2E coverage |
| ⚠️ Partial Coverage | Some tests exist but missing test types |
| ❌ No Coverage | No tests exist for this module |

### Module Coverage Status

| Module | Status | Notes |
|--------|--------|-------|
| User Management | ✅ | Full coverage with unit, integration, and E2E |
| Accounting | ⚠️ | Extensive unit tests, needs E2E |
| Procurement | ✅ | Full coverage with integration tests |
| Documents | ⚠️ | Unit tests only, needs integration/E2E |
| Entities | ✅ | Full coverage with unit, integration, and E2E |
| Projects | ✅ | Full coverage with unit, integration, and E2E (199 tests) |
| Feedback | ✅ | Full coverage across all types |
| Thermal Calculators | ⚠️ | Unit tests only |
| HR / Leaves | ⚠️ | Limited unit tests |
| SSOT | ⚠️ | Unit tests only |
| BOM / Estimation | ✅ | Full coverage with unit, integration, and E2E (277 tests) |
| Materials | ✅ | Full coverage with unit, integration, and E2E (166 tests) |
| Shapes | ⚠️ | Good unit coverage (102 tests) |
| Tasks / Flow | ⚠️ | Unit tests only |
| Workflow Engine | ⚠️ | Unit tests only |
| Proposals/Enquiries | ❌ | No tests |
| Bought Out Items | ❌ | No tests |
| Company Documents | ❌ | No tests |
| Admin Settings | ✅ | Full coverage with unit, integration, and E2E (88 tests) |
| Currency/Forex | ❌ | No tests |
| Chart of Accounts | ❌ | No tests |

---

## 1. User Management Module

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/components/admin/__tests__/EditUserDialog.test.tsx` | 25 | Edit user dialog rendering, validation, permissions |
| `apps/web/src/components/admin/__tests__/ApproveUserDialog.test.tsx` | 32 | User approval workflow, presets, rejection |
| `packages/constants/src/permissions.test.ts` | 90 | Permission flags, presets, helper functions |
| `packages/types/src/permissions.test.ts` | 63 | Permission type definitions |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/app/admin/users/__tests__/page.test.tsx` | 20 | User management page with Firestore, filtering, dialogs |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/users.spec.ts` | 19 | User management workflows, dialogs, accessibility |

**Total: 249 tests**

---

## 2. Accounting Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/accounting/accounting.test.ts` | 36 | Core accounting functions |
| `apps/web/src/lib/accounting/transactionService.test.ts` | 40 | Transaction CRUD operations |
| `apps/web/src/lib/accounting/transactionHelpers.test.ts` | 40 | Transaction utility functions |
| `apps/web/src/lib/accounting/transactionNumberGenerator.test.ts` | 38 | Auto-numbering logic |
| `apps/web/src/lib/accounting/auditLogger.test.ts` | 29 | Audit trail logging |
| `apps/web/src/lib/accounting/ledgerValidator.test.ts` | 32 | Ledger validation rules |
| `apps/web/src/lib/accounting/paymentHelpers.test.ts` | 3 | Payment processing helpers |

### Unit Tests - Tax Calculations
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/accounting/gstCalculator.test.ts` | 23 | GST calculations |
| `apps/web/src/lib/accounting/tdsCalculator.test.ts` | 46 | TDS calculations |

### Unit Tests - Bills & Invoices
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/accounting/billApprovalService.test.ts` | 14 | Bill approval workflow |
| `apps/web/src/lib/accounting/billVoidService.test.ts` | 19 | Bill voiding logic |
| `apps/web/src/lib/accounting/invoiceApprovalService.test.ts` | 17 | Invoice approval workflow |

### Unit Tests - Bank Reconciliation
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/accounting/bankReconciliation/autoMatching.test.ts` | 15 | Auto-matching algorithm |
| `apps/web/src/lib/accounting/bankReconciliation/crud.test.ts` | 25 | Reconciliation CRUD |
| `apps/web/src/lib/accounting/bankReconciliation/matching.test.ts` | 23 | Manual matching logic |
| `apps/web/src/lib/accounting/bankStatementParser.test.ts` | 44 | Bank statement parsing |

### Unit Tests - Hooks
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/hooks/accounting/useGSTCalculation.test.ts` | 21 | GST calculation hook |
| `apps/web/src/hooks/accounting/useLineItemManagement.test.ts` | 37 | Line item management hook |
| `apps/web/src/hooks/accounting/useTransactionForm.test.ts` | 30 | Transaction form hook |

### Component Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/app/accounting/reports/entity-ledger/components/__tests__/EntityLedger.test.tsx` | 32 | Entity ledger component |

**Total: 564 tests**

---

## 3. Procurement Module

### Unit Tests - Purchase Requests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/purchaseRequest/purchaseRequest.test.ts` | 27 | PR CRUD operations |
| `apps/web/src/lib/procurement/purchaseRequestHelpers.test.ts` | 79 | PR utility functions |

### Unit Tests - RFQs
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/rfq/rfq.test.ts` | 44 | RFQ CRUD operations |
| `apps/web/src/lib/procurement/rfqHelpers.test.ts` | 72 | RFQ utility functions |

### Unit Tests - Purchase Orders
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/purchaseOrder/purchaseOrder.test.ts` | 50 | PO CRUD operations |
| `apps/web/src/lib/procurement/purchaseOrderHelpers.test.ts` | 67 | PO utility functions |
| `apps/web/src/lib/procurement/purchaseOrderService.test.ts` | 35 | PO service layer |

### Unit Tests - Offers
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/offerHelpers.test.ts` | 65 | Offer comparison helpers |

### Unit Tests - Goods Receipt & Three-Way Match
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/goodsReceiptService.test.ts` | 20 | Goods receipt service |
| `apps/web/src/lib/procurement/threeWayMatch/threeWayMatch.test.ts` | 54 | Three-way match logic |
| `apps/web/src/lib/procurement/threeWayMatch/utils.test.ts` | 36 | Three-way match utilities |

### Unit Tests - Integrations
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/procurement/accountingIntegration.test.ts` | 25 | Accounting integration |

### Component Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/app/procurement/three-way-match/[id]/components/__tests__/ThreeWayMatch.test.tsx` | 62 | Three-way match component |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/procurement-workflow.integration.test.ts` | 1 | Full procurement workflow |

**Total: 637 tests**

---

## 4. Documents Module

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/documents/documents.test.ts` | 56 | Core document functions |
| `apps/web/src/lib/documents/documentService.test.ts` | 25 | Document service layer |
| `apps/web/src/lib/documents/documentNumberingService.test.ts` | 40 | Document numbering |
| `apps/web/src/lib/documents/folderService.test.ts` | 41 | Folder management |
| `apps/web/src/lib/documents/commentService.test.ts` | 18 | Document comments |

**Total: 180 tests**

---

## 5. Entities Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/entities/businessEntityService.test.ts` | 32 | Entity service layer |
| `apps/web/src/lib/entities/hooks/__tests__/useEntities.test.tsx` | 28 | Entity hooks |

### Component Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/components/entities/__tests__/ViewEntityDialog.test.tsx` | 49 | View entity dialog |
| `apps/web/src/components/entities/__tests__/ContactsManager.test.tsx` | 34 | Contact management |
| `apps/web/src/components/entities/__tests__/BankDetailsManager.test.tsx` | 33 | Bank details management |
| `apps/web/src/components/entities/__tests__/ArchiveEntityDialog.test.tsx` | 30 | Archive dialog |
| `apps/web/src/components/entities/__tests__/UnarchiveEntityDialog.test.tsx` | 26 | Unarchive dialog |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/entities.spec.ts` | 30 | Entity management workflows |

**Total: 262 tests**

---

## 6. Projects Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/projects/projects.test.ts` | 45 | Core project functions |
| `apps/web/src/lib/projects/projectService.test.ts` | 6 | Project service layer |
| `apps/web/src/lib/projects/charterValidation.test.ts` | 51 | Charter validation rules |
| `apps/web/src/lib/projects/budgetCalculationService.test.ts` | 27 | Budget actual cost calculations, transaction aggregation |
| `apps/web/src/lib/projects/charterProcurementService.test.ts` | 25 | Charter procurement items CRUD, PR creation from charter |
| `apps/web/src/lib/projects/documentRequirementService.test.ts` | 15 | Document requirements CRUD, status transitions |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/project-charter-workflow.integration.test.ts` | 8 | Charter workflow: create project → add procurement items → document requirements → PR creation → budget tracking → approval |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/projects.spec.ts` | 22 | Project page navigation, list view, detail view, charter sections, procurement items, document requirements, accessibility |

**Total: 199 tests** (169 unit + 8 integration + 22 E2E)

---

## 7. Feedback Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/feedback/feedbackStatsService.test.ts` | 21 | Feedback statistics |
| `apps/web/src/lib/feedback/feedbackTaskService.test.ts` | 12 | Feedback task integration |

### Component Tests - User Feedback Form
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/components/common/FeedbackForm/__tests__/FeedbackForm.test.tsx` | 51 | Main feedback form |
| `apps/web/src/components/common/FeedbackForm/__tests__/FeedbackFormMain.test.tsx` | 22 | Form main section |
| `apps/web/src/components/common/FeedbackForm/__tests__/ScreenshotUpload.test.tsx` | 22 | Screenshot upload |
| `apps/web/src/components/common/FeedbackForm/__tests__/ConsoleErrorInstructions.test.tsx` | 14 | Error instructions |

### Component Tests - Admin Feedback
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/components/admin/feedback/__tests__/FeedbackComponents.test.tsx` | 62 | Admin feedback components |
| `apps/web/src/app/feedback/__tests__/FeedbackDetailClient.test.tsx` | 26 | Feedback detail page |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/app/feedback/__tests__/feedback.integration.test.tsx` | 11 | Feedback submission flow |
| `apps/web/src/components/admin/feedback/__tests__/adminFeedback.integration.test.tsx` | 12 | Admin feedback flow |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/feedback.spec.ts` | 28 | Feedback workflows |

**Total: 281 tests**

---

## 8. Thermal Calculators Module

### Unit Tests - Calculators
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/thermal/heatDutyCalculator.test.ts` | 24 | Heat duty calculations |
| `apps/web/src/lib/thermal/pressureDropCalculator.test.ts` | 38 | Pressure drop calculations |
| `apps/web/src/lib/thermal/npshaCalculator.test.ts` | 33 | NPSHA calculations |
| `apps/web/src/lib/thermal/pipeService.test.ts` | 34 | Pipe service utilities |

### Component Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/app/thermal/calculators/pipe-sizing/components/__tests__/PipeSizing.test.tsx` | 11 | Pipe sizing component |
| `apps/web/src/app/thermal/calculators/pressure-drop/components/__tests__/PressureDrop.test.tsx` | 33 | Pressure drop component |

**Total: 173 tests**

---

## 9. HR / Leaves Module

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/hr/leaves/displayHelpers.test.ts` | 16 | Leave display helpers |
| `apps/web/src/lib/hr/leaves/leaveBalanceService.test.ts` | 25 | Leave balance service |

**Total: 41 tests**

---

## 10. SSOT Module

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/ssot/streamCalculations.test.ts` | 55 | Stream calculations |
| `apps/web/src/lib/ssot/lineCalculations.test.ts` | 22 | Line calculations |

**Total: 77 tests**

---

## 11. BOM / Estimation Module

### Unit Tests - Core Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/bom/bomService.test.ts` | 45 | BOM CRUD operations, item management, summary recalculation |
| `apps/web/src/lib/bom/bomCalculations.test.ts` | 40 | Cost calculations for shapes and bought-out items |
| `apps/web/src/lib/bom/bomSummary.test.ts` | 38 | BOM summary calculations |
| `apps/web/src/lib/bom/costConfig.test.ts` | 35 | Cost configuration CRUD operations |
| `apps/web/src/lib/bom/boughtOutHelpers.test.ts` | 43 | Bought-out item category helpers |
| `apps/web/src/lib/services/serviceCalculations.test.ts` | 46 | Service calculations |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/bom-workflow.integration.test.ts` | 9 | Complete BOM workflow: create → add items → calculate costs → approve |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/bom-estimation.spec.ts` | 21 | BOM page navigation, list view, create flow, detail view, cost calculation, status workflow |

**Total: 277 tests** (247 unit + 9 integration + 21 E2E)

---

## 12. Materials Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/materials/crud.test.ts` | 33 | Material CRUD operations (create, update, delete, get) |
| `apps/web/src/lib/materials/queries.test.ts` | 40 | Material querying, filtering, and search |
| `apps/web/src/lib/materials/variantUtils.test.ts` | 58 | Material variant utilities |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/materials-workflow.integration.test.ts` | 10 | Material lifecycle: create → query → search → update → vendor association |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/materials.spec.ts` | 25 | Material page navigation, categories, list view, create flow, price management |

**Total: 166 tests** (131 unit + 10 integration + 25 E2E)

---

## 13. Shapes Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/shapes/shapeCalculator.test.ts` | 45 | Shape calculations (volume, weight, surface area, costs) |
| `apps/web/src/lib/shapes/shapeData.test.ts` | 27 | Shape data retrieval and filtering by category |
| `apps/web/src/lib/shapes/formulaEvaluator.test.ts` | 30 | Shape formula evaluation |

**Total: 102 tests**

---

## 14. Tasks / Flow Module

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/tasks/tasks.test.ts` | 32 | Task management |

**Total: 32 tests**

---

## 15. Workflow Engine

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/workflow/stateMachines.test.ts` | 57 | Workflow state machines |

**Total: 57 tests**

---

## 16. Shared Utilities

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/utils/formatters.test.ts` | 96 | Formatting utilities |
| `apps/web/src/lib/utils/dateTime.test.ts` | 53 | Date/time utilities |
| `apps/web/src/lib/utils/errorHandling.test.ts` | 39 | Error handling |
| `apps/web/src/lib/utils/materializedAggregations.test.ts` | 39 | Aggregation utilities |
| `apps/web/src/lib/utils/stateMachine.test.ts` | 30 | State machine utilities |
| `apps/web/src/lib/utils/compensatingTransaction.test.ts` | 25 | Compensating transactions |
| `apps/web/src/lib/utils/batchProcessor.test.ts` | 24 | Batch processing |
| `apps/web/src/lib/utils/optimisticLocking.test.ts` | 22 | Optimistic locking |
| `apps/web/src/lib/utils/idempotencyService.test.ts` | 21 | Idempotency service |

**Total: 349 tests**

---

## 17. Shared UI Components (@vapour/ui)

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `packages/ui/src/components/dialogs/ConfirmDialog.test.tsx` | 39 | Confirm dialog |
| `packages/ui/src/components/__tests__/EmptyState.test.tsx` | 21 | Empty state component |
| `packages/ui/src/components/__tests__/LoadingState.test.tsx` | 18 | Loading state component |
| `packages/ui/src/components/__tests__/ThemeToggle.test.tsx` | 17 | Theme toggle |
| `packages/ui/src/components/__tests__/States.test.tsx` | 5 | State components |
| `packages/ui/src/components/__tests__/FilterBar.test.tsx` | 3 | Filter bar |
| `packages/ui/src/components/__tests__/StatCard.test.tsx` | 3 | Stat card |
| `packages/ui/src/components/__tests__/TableActionCell.test.tsx` | 3 | Table action cell |
| `packages/ui/src/components/__tests__/PageHeader.test.tsx` | 2 | Page header |

**Total: 111 tests**

---

## 18. Shared Packages

### @vapour/constants
| File | Tests | Description |
|------|-------|-------------|
| `packages/constants/src/permissions.test.ts` | 90 | Permission constants |

### @vapour/types
| File | Tests | Description |
|------|-------|-------------|
| `packages/types/src/permissions.test.ts` | 63 | Permission types |

### @vapour/utils
| File | Tests | Description |
|------|-------|-------------|
| `packages/utils/src/logger.test.ts` | 8 | Logger utility |

### @vapour/functions
| File | Tests | Description |
|------|-------|-------------|
| `packages/functions/src/services/__tests__/formulaEngineService.test.ts` | 29 | Formula engine service |

**Total: 190 tests**

---

## 19. Core / Context

### Unit Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/contexts/AuthContext.test.tsx` | 25 | Authentication context |
| `apps/web/src/hooks/hooks.test.ts` | 29 | Core hooks |
| `apps/web/src/lib/firebase/typeHelpers.test.ts` | 19 | Firebase type helpers |
| `apps/web/src/components/common/forms/FormDialog.test.tsx` | 34 | Form dialog component |
| `apps/web/src/app/dashboard/error.test.tsx` | 7 | Error boundary |

**Total: 114 tests**

---

## 20. Admin Settings Module

### Unit Tests - Services
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/lib/audit/auditLogService.test.ts` | 45 | Audit log queries, filters, categories, and severity config |
| `apps/web/src/lib/admin/systemStatusService.test.ts` | 10 | System status retrieval and error handling |

### Integration Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/admin-settings-workflow.integration.test.ts` | 12 | Entity CRUD, query operations, status management, cascade delete checks |

### E2E Tests
| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/admin-settings.spec.ts` | 21 | Admin page navigation, system status, user management, company settings |

**Total: 88 tests** (55 unit + 12 integration + 21 E2E)

---

## 21. E2E Tests (Cross-Module)

| File | Tests | Description |
|------|-------|-------------|
| `apps/web/e2e/critical-path.spec.ts` | 14 | Critical user journeys |
| `apps/web/e2e/entities.spec.ts` | 30 | Entity workflows |
| `apps/web/e2e/feedback.spec.ts` | 28 | Feedback workflows |
| `apps/web/e2e/users.spec.ts` | 19 | User management workflows |
| `apps/web/e2e/bom-estimation.spec.ts` | 21 | BOM/Estimation workflows |
| `apps/web/e2e/materials.spec.ts` | 25 | Materials workflows |
| `apps/web/e2e/admin-settings.spec.ts` | 21 | Admin settings workflows |
| `apps/web/e2e/projects.spec.ts` | 22 | Projects and charter workflows |

**Total: 180 E2E tests**

---

## 22. Integration Tests (Cross-Module)

| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__integration__/procurement-workflow.integration.test.ts` | 9 | PR → RFQ → PO procurement flow |
| `apps/web/src/__integration__/bom-workflow.integration.test.ts` | 9 | BOM creation and cost calculation workflow |
| `apps/web/src/__integration__/materials-workflow.integration.test.ts` | 10 | Material CRUD and lifecycle workflow |
| `apps/web/src/__integration__/admin-settings-workflow.integration.test.ts` | 12 | Entity management and admin settings workflow |
| `apps/web/src/__integration__/project-charter-workflow.integration.test.ts` | 8 | Project charter workflow with procurement and documents |

**Total: 48 integration tests**

---

## Coverage Gaps

### Modules Needing More Tests

| Module | Current Tests | Recommended |
|--------|--------------|-------------|
| Proposals/Enquiries | 0 | 100+ |
| Bought Out Items | 0 | 50+ |
| Company Documents | 0 | 50+ |
| Currency/Forex | 0 | 40+ |
| Chart of Accounts | 0 | 50+ |
| Shapes (E2E) | 0 | 20+ |

### Test Types Needed

| Type | Current | Gap |
|------|---------|-----|
| E2E - Procurement | 0 | PR → RFQ → PO flow |
| E2E - Accounting | 0 | Transaction workflows |
| Integration - Notifications | 0 | Cross-module notifications |
| Performance Tests | 0 | Load testing for lists |

---

## Running Tests

```bash
# Run all unit tests
pnpm test

# Run specific module tests
pnpm --filter @vapour/web test src/lib/accounting
pnpm --filter @vapour/web test src/lib/procurement

# Run E2E tests
pnpm --filter @vapour/web exec playwright test

# Run with coverage
pnpm --filter @vapour/web test:coverage
```
