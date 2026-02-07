# Phase 3: Proposals + Estimation/BOM Audit

**Status**: COMPLETE
**Priority**: Medium (revenue pipeline, cost estimation)
**Total Findings**: 20

## Scope

### Proposals

#### Service Files (`apps/web/src/lib/proposals/`)

- [x] Enquiry service
- [x] Scope matrix service
- [x] Pricing service
- [x] Generation/PDF service
- [x] Template service
- [x] Approval workflow
- [x] Revision management
- [x] Project conversion

#### Pages (`apps/web/src/app/proposals/`)

- [x] Enquiries (list, create, detail)
- [x] Scope Matrix
- [x] Pricing configuration
- [x] PDF Generation
- [x] Templates

### Estimation/BOM

#### Service Files (`apps/web/src/lib/bom/`)

- [x] `bomService.ts` — BOM CRUD and calculations
- [x] `bomCalculations.ts` — Cost calculations
- [x] `costConfig.ts` — Cost configuration

#### Pages (`apps/web/src/app/estimation/`)

- [x] BOM list
- [x] BOM create/edit

### Bought-Out Items

#### Service Files (`apps/web/src/lib/boughtOut/`)

- [x] `boughtOutService.ts` — Equipment/component inventory

#### Pages (`apps/web/src/app/bought-out/`)

- [x] Item list
- [x] Item create/edit

## Findings

### CRITICAL

#### BP-3: Weak Entity ID Filtering on Estimation List Page

- **Category**: Security
- **File**: `apps/web/src/app/estimation/page.tsx` (line 55)
- **Issue**: Uses `FALLBACK_ENTITY_ID = 'default-entity'` when user has no entityId assigned. Multi-tenancy bypass allowing cross-entity data access.
- **Impact**: Users without proper entity assignment could access/modify BOMs from other entities.
- **Recommendation**: Require valid entityId; redirect unauthenticated users to error page instead of using fallback.

### HIGH

#### BP-1: Missing Type Definition Fields (Approval Workflow)

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/proposals/approvalWorkflow.ts` (lines 399, 444)
- **Issue**: Code writes `submittedToClientAt` and `statusChangeReason` fields to Firestore, but these fields are NOT defined in the `Proposal` type in `packages/types/src/proposal.ts`.
- **Recommendation**: Add optional fields to the `Proposal` interface: `submittedToClientAt?: Timestamp`, `statusChangeReason?: string`.

#### BP-2: Missing Type Definition Fields (Project Conversion)

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/proposals/projectConversion.ts` (lines 192-193)
- **Issue**: Code writes `convertedToProjectAt` and `convertedToProjectBy` fields to Firestore, but these fields are NOT defined in the `Proposal` type.
- **Recommendation**: Add optional fields: `convertedToProjectAt?: Timestamp`, `convertedToProjectBy?: string`.

#### BP-4: No Permission Check on Proposal List Page

- **Category**: Security
- **File**: `apps/web/src/app/proposals/list/page.tsx` (lines 99-111)
- **Issue**: Page filters by entityId but doesn't validate user has permission to VIEW proposals. No CRUD permissions checked.
- **Recommendation**: Add explicit `hasPermission(claims?.permissions, PermissionFlag.VIEW_PROPOSALS)` check.

#### BP-5: Missing entityId Validation in BOM Service

- **Category**: Security
- **File**: `apps/web/src/lib/bom/bomService.ts` (line 308)
- **Issue**: `listBOMs` requires entityId in options but doesn't validate that it's provided. Calling without entityId would return empty or incorrect results.
- **Recommendation**: Add validation: `if (!options.entityId) throw new Error('entityId is required')`.

### MEDIUM

#### BP-6: Missing Validation on Proposal Approval Actions

- **Category**: Code Quality
- **File**: `apps/web/src/lib/proposals/approvalWorkflow.ts` (lines 114-118, 209-210, 294-298)
- **Issue**: `approveProposal`, `rejectProposal`, `requestProposalChanges` check permission but don't validate that the proposal actually exists before update.
- **Recommendation**: Validate proposal exists after permission check.

#### BP-7: Inconsistent Undefined Field Handling

- **Category**: Code Quality
- **File**: `apps/web/src/lib/proposals/proposalService.ts` (lines 296-298, 490-492, 550-552)
- **Issue**: Multiple places clean undefined values before Firestore writes using `Object.fromEntries(Object.entries().filter(...))` but inconsistently applied.
- **Recommendation**: Create reusable `cleanFirestoreData<T>()` utility function.

#### BP-8: No Validation of Revision Chain Integrity

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/proposals/revisionManagement.ts` (lines 32-92)
- **Issue**: `createProposalRevision` creates a new revision but doesn't validate that `previousRevisionId` correctly references the old proposal.
- **Recommendation**: Add referential integrity check for previous revision.

#### BP-9: No Validation of BOM Item Hierarchy

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/bom/bomService.ts` (lines 86-142)
- **Issue**: `generateItemNumber` trusts that `parentItemId` exists without validation. No cascading delete of children when parent deleted.
- **Recommendation**: Add referential integrity validation in `deleteBOMItem`.

#### BP-10: No Index Validation for Complex Queries

- **Category**: Performance / Reliability
- **File**: `apps/web/src/lib/bom/costConfig.ts` (lines 80-86)
- **Issue**: `getActiveCostConfiguration` uses composite query (entityId + isActive + effectiveFrom + orderBy) without error handling for missing index.
- **Recommendation**: Add try-catch with index-specific error messaging.

#### BP-11: Race Condition in BOM Summary Calculation

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/bom/bomService.ts` (lines 401-402, 458-459, 497-498)
- **Issue**: `recalculateBOMSummary` called after each item add/update/delete, but concurrent operations could race. No transaction ensures atomicity.
- **Recommendation**: Use Firestore `runTransaction()` for summary recalculation.

#### BP-12: Missing Financial Calculation Validation

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/bom/bomService.ts` (lines 585-639)
- **Issue**: Overhead/Contingency/Profit calculations use multiplication without validating intermediate values. Negative costs or infinity could propagate.
- **Recommendation**: Add `Number.isFinite(value) && value >= 0` validation before updating.

#### BP-13: No Validation of Proposal Status Transitions

- **Category**: Code Quality
- **File**: `apps/web/src/lib/proposals/approvalWorkflow.ts` (lines 29-97, 374)
- **Issue**: `submitProposalForApproval` uses state machine, but `markProposalAsSubmitted` directly updates status without state machine validation.
- **Recommendation**: Ensure all status-updating functions use state machine validation consistently.

### LOW

#### BP-14: Inefficient BOM Code Generation Fallback

- **Category**: Code Quality
- **File**: `apps/web/src/lib/bom/bomService.ts` (lines 70-79)
- **Issue**: If counter document fails, fallback uses `timestamp + random` which has collision risk.
- **Recommendation**: Use UUID-based fallback for guaranteed uniqueness.

#### BP-15: Missing Error Context in Batch Operations

- **Category**: Code Quality
- **File**: `apps/web/src/lib/bom/bomCalculations.ts` (lines 303-328)
- **Issue**: `calculateAllItemCosts` logs aggregate success/failure counts but doesn't specify WHICH items failed.
- **Recommendation**: Collect and log failed item IDs for debugging.

#### BP-16: Incomplete Error Messages in Service Layer

- **Category**: Code Quality
- **File**: `apps/web/src/lib/proposals/proposalService.ts` (lines 100, 108, 114)
- **Issue**: Generic "Enquiry not found" errors don't include the IDs being queried.
- **Recommendation**: Include identifiers in error messages.

#### BP-17: No Validation of Proposal Totals

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/proposals/projectConversion.ts` (lines 52-70)
- **Issue**: When converting proposal to project, budget line items generated from `scopeOfSupply` without validating totals match proposal pricing.
- **Recommendation**: Add reconciliation check between budget total and proposal pricing.

#### BP-18: Fallible Material Price Retrieval

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/bom/bomCalculations.ts` (lines 337-352)
- **Issue**: `getMaterialPrice` returns 0 if material not found instead of throwing error.
- **Recommendation**: Return error result or throw to prevent silent underpricing.

#### BP-19: Missing Null Coalescing in Optional Field Reads

- **Category**: Code Quality
- **File**: `apps/web/src/lib/bom/bomCalculations.ts` (lines 67-68)
- **Issue**: Reads `material.currentPrice?.pricePerUnit.amount` but doesn't validate `currentPrice` exists before accessing `.amount`.
- **Recommendation**: Use full optional chaining: `material.currentPrice?.pricePerUnit?.amount ?? 0`.

#### BP-20: Inconsistent Cost Currency Handling

- **Category**: Code Quality
- **File**: `apps/web/src/lib/bom/bomService.ts` (lines 548-552)
- **Issue**: BOM summary currency determined from "first item with cost" instead of entity configuration.
- **Recommendation**: Always use entity-configured currency from cost configuration.

## Summary

| Severity | Count | Key Areas                                      |
| -------- | ----- | ---------------------------------------------- |
| CRITICAL | 1     | Security (1)                                   |
| HIGH     | 4     | Data Integrity (2), Security (2)               |
| MEDIUM   | 8     | Data Integrity (4), Code Quality (3), Perf (1) |
| LOW      | 7     | Code Quality (4), Data Integrity (3)           |

## Priority Fix Order

1. **BP-3**: Multi-tenancy fallback entity ID (security bypass)
2. **BP-1 + BP-2**: Missing type definitions for workflow fields
3. **BP-4 + BP-5**: Permission checks + entityId validation
4. **BP-11 + BP-12**: Race condition + financial validation
5. **BP-8 + BP-9**: Referential integrity for revisions and BOM items
