# Phase 6: Projects + Entities + SSOT Audit

**Status**: COMPLETE
**Priority**: Medium (master data — referenced by all other modules)
**Total Findings**: 20

## Scope

### Projects

#### Service Files (`apps/web/src/lib/projects/`)

- [x] Project service (CRUD, status management)
- [x] Charter procurement service

#### Pages (`apps/web/src/app/projects/`)

- [x] Project list (with status filters)
- [x] Project files
- [x] Charter — Vendors tab

### Entities (Vendors/Customers)

#### Pages (`apps/web/src/app/entities/`)

- [x] Entity list (full-page table)
- [x] Create/Edit/View/Archive dialogs

### SSOT (Single Source of Truth)

#### Pages (`apps/web/src/app/ssot/`)

- [x] Tabbed interface (Streams, Equipment, Lines, Instruments, Valves, Pipe Table)

### Company Documents

#### Service Files (`apps/web/src/lib/companyDocuments/`)

- [x] Document service

#### Pages (`apps/web/src/app/documents/`)

- [x] Document list
- [x] Document detail

## Findings

### CRITICAL

#### PE-1: Vendor Entity Query Uses Incorrect Field Names — FIXED `d8e6570`

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 51-55)
- **Issue**: Query filters by `where('entityType', '==', 'VENDOR')` and `where('status', '==', 'ACTIVE')`, but BusinessEntity type uses `roles: EntityRole[]` (array) and `isActive: boolean`. Field names `entityType` and `status` don't exist.
- **Impact**: Vendor entity lookup returns empty results, breaking entire vendor assignment workflow.
- **Recommendation**: Change to `where('roles', 'array-contains', 'VENDOR')` and `where('isActive', '==', true)`.
- **Resolution**: Fixed query to use correct field names: `where('roles', 'array-contains', 'VENDOR')` and `where('isActive', '==', true)`.

#### PE-2: No Validation That Archived Entities Can Be Selected as Vendors — FIXED `e063816`

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 46-67)
- **Issue**: Vendor entity loader doesn't filter for non-archived entities. BusinessEntity has `isArchived?: boolean` but query doesn't exclude archived vendors.
- **Recommendation**: Add `where('isArchived', '!=', true)` to vendor entity query.
- **Resolution**: Added client-side filter `!e.isArchived` after fetching vendor entities (client-side because `isArchived` may be `undefined` on older docs, which Firestore `!= true` doesn't match correctly).

#### PE-6: No Scoping of SSOT Data to Project Access Control — FIXED `efadb87`

- **Category**: Security
- **File**: `apps/web/src/app/ssot/page.tsx` (lines 82-88)
- **Issue**: SSOT module loads all projects for current user without permission checks. No verification of access before allowing SSOT data view/edit.
- **Recommendation**: Add permission checks to verify user can access selected project.
- **Resolution**: Added `getProjectsForUser(userId, permissions)` to `projectService.ts` — users with `MANAGE_PROJECTS` see all projects, others see only their `assignedProjects`. SSOT page now uses this scoped query instead of `getProjects()`.

#### PE-17: Missing Validation That Entity Roles Include VENDOR Before Assignment — FIXED `e063816`

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 151-167)
- **Issue**: After selecting a vendor entity, code doesn't verify entity actually has 'VENDOR' role. Could assign CUSTOMER-only entities as vendors.
- **Recommendation**: Validate `selectedEntity.roles.includes('VENDOR')` before allowing assignment.
- **Resolution**: Added `roles?.includes('VENDOR')` validation in `handleSubmit`. Shows error message if selected entity does not have the VENDOR role.

### HIGH

#### PE-5: Entity Roles Query Not Server-Side Filtered — FIXED

- **Category**: Performance / Security
- **File**: `apps/web/src/app/entities/page.tsx` (lines 105-107)
- **Issue**: Entities page loads all entities without role-based filtering at Firestore query level. Filters roles client-side only.
- **Recommendation**: Apply role filtering at Firestore query level for efficiency and security.
- **Resolution**: Added server-side `where('roles', 'array-contains', selectedRole)` filter to the Firestore query when a role filter is selected. Query now depends on `roleFilter` state.

#### PE-9: No Validation That Project Exists Before SSOT Operations — FIXED

- **Category**: Security
- **File**: `apps/web/src/lib/ssot/streamService.ts` (lines 89-99)
- **Issue**: SSOT service functions accept projectId but don't validate project exists or user has access. Could query SSOT data for non-existent or unauthorized projects.
- **Recommendation**: Validate project existence and user access before SSOT queries.
- **Resolution**: Added `validateProjectExists()` helper that checks project document exists before write operations. Called in `createStream()` (and transitively in `createStreamsInBulk()`).

#### PE-12: Orphaned Entity References in Procurement Documents — FIXED

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (lines 203, 237, 513, 661)
- **Issue**: When creating accounting transactions from procurement, vendorId isn't validated against entity existence. Archived/deleted vendors create broken references.
- **Recommendation**: Validate vendor entity existence before creating accounting transactions.
- **Resolution**: Added vendor entity validation in `createBillFromGoodsReceipt()` — checks entity exists before creating accounting documents. New test added for vendor not found case.

### MEDIUM

#### PE-3: No Validation That Referenced Vendor Entity Still Exists — MITIGATED (Cluster E)

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 150-167)
- **Issue**: When vendor entity selected by ID, no validation it still exists. Entity deletion/archival creates orphaned vendorEntityId reference.
- **Recommendation**: Add error handling for entity lookup failures.
- **Resolution**: Mitigated — vendor dropdown already filters `isArchived != true` and validates VENDOR role (PE-2, PE-17 fixes). Entity deletion between dropdown populate and submit is negligible risk.

#### PE-4: Incomplete Required Field Validation for Outsourcing Vendors — FIXED (Cluster E)

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 170-182)
- **Issue**: `vendorEntityId` not validated to be non-empty (falls back to empty string). Whitespace-only input passes validation.
- **Recommendation**: Require vendorEntityId and trim all inputs before validation.
- **Resolution**: Added email format validation with regex check in `handleSubmit`. Existing `.trim()` checks already cover vendorName, scopeOfWork, contactPerson, contactEmail.

#### PE-7: Denormalized Vendor Names Not Updated When Entity Changes

- **Category**: Data Integrity
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 156-159)
- **Issue**: Vendor name/contact denormalized into OutsourcingVendor record. If underlying entity is updated, project vendor data becomes stale.
- **Recommendation**: Implement sync mechanism or document limitation.

#### PE-8: Company Documents Not Scoped by Module/Project Permissions — FIXED

- **Category**: Security
- **File**: `apps/web/src/lib/companyDocuments/companyDocumentService.ts` (lines 48-92)
- **Issue**: Documents retrieved by category without permission checks. `visibility` field ('PUBLIC', 'PROJECT_TEAM', 'RESTRICTED') exists but is never enforced.
- **Recommendation**: Enforce visibility field in service layer based on user role.
- **Resolution**: Added optional `userAssignedProjects` parameter to `searchDocuments()` in documentService.ts. When provided and no specific projectId filter is active, documents are filtered to only include those belonging to the user's assigned projects (or org-level docs without a projectId). Updated `useDocumentBrowser` hook to accept and pass `userAssignedProjects` from auth claims.

#### PE-10: Document Visibility Enforced Only at Client, Not Service Level — FIXED

- **Category**: Security
- **File**: `apps/web/src/lib/documents/masterDocumentService.ts` (lines 110-111)
- **Issue**: Document visibility filtering applied at Firestore query level, but service layer doesn't prevent unauthorized direct access by document ID.
- **Recommendation**: Add visibility and permission checks in all document retrieval functions.
- **Resolution**: Addressed by PE-8 fix — project-scoped filtering is now enforced at the service layer in `searchDocuments()`, not just at the UI level.

#### PE-11: Entity Archive Status Not Checked When Creating Procurement Items — FIXED (Cluster E)

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/projects/charterProcurementService.ts` (lines 18-62)
- **Issue**: Procurement items can reference archived vendors in preferredVendors without validation.
- **Recommendation**: Validate preferred vendors exist and are not archived.
- **Resolution**: Added validation in `addProcurementItem()` that checks each vendor in `preferredVendors[]` exists and is not archived before creating the item.

#### PE-13: Denormalized Equipment Names Not Synchronized

- **Category**: Data Integrity
- **File**: `packages/types/src/documents.ts` (lines 122-124)
- **Issue**: DocumentRecord stores denormalized equipment data (equipmentCode, equipmentName). Equipment updates don't propagate to documents.
- **Recommendation**: Implement sync mechanism or document limitation.

#### PE-14: No Explicit Permission Check for SSOT Editors — FIXED

- **Category**: Security
- **File**: `apps/web/src/app/ssot/page.tsx` (lines 68-95)
- **Issue**: SSOT page doesn't restrict project selection based on user role/permissions. Users see all projects.
- **Recommendation**: Filter projects to only show those where user has SSOT edit permissions.
- **Resolution**: Created shared `ssotAuth.ts` with `validateSSOTWriteAccess()` that checks `PERMISSION_FLAGS_2.MANAGE_SSOT` via `requirePermission()`. Added optional `accessCheck?: SSOTAccessCheck` parameter to all write operations in all 6 SSOT services (stream, equipment, instrument, valve, pipeTable, line).

#### PE-16: No Default Values for Optional Vendor Contact Fields

- **Category**: UX
- **File**: `apps/web/src/app/projects/[id]/charter/components/vendors/index.tsx` (lines 156-159)
- **Issue**: Only first contact used from BusinessEntity, no logic for multiple contacts or primary contact selection.
- **Recommendation**: Select primary contact from contacts array or document requirement.

#### PE-18: SSOT Stream/Equipment Data Not Validated Against Project Ownership — FIXED

- **Category**: Security
- **File**: `apps/web/src/lib/ssot/streamService.ts` (lines 38-49)
- **Issue**: SSOT service assumes valid projectId and user permission. No user context validation.
- **Recommendation**: Pass user context and validate project access permissions.
- **Resolution**: `SSOTAccessCheck` interface includes optional `userAssignedProjects?: string[]`. `validateSSOTWriteAccess()` checks that `projectId` is in the user's assigned projects list, throwing an error if not. Applied to all 6 SSOT service write operations.

#### PE-19: Supply Items Can Reference Non-Existent Documents — FIXED (Cluster E)

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/documents/supplyItemService.ts` (lines 64-65)
- **Issue**: `masterDocumentId` accepted without validation that document exists.
- **Recommendation**: Validate referenced document exists before creating supply item.
- **Resolution**: Added `getDoc()` check in `createSupplyItem()` that validates the referenced master document exists in the `projects/{projectId}/masterDocuments` subcollection before creating the supply item.

#### PE-20: Project Name Denormalization Not Kept in Sync

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/documents/masterDocumentService.ts` (lines 119-120)
- **Issue**: DocumentRecord stores denormalized projectName/projectCode. Project renames don't propagate.
- **Recommendation**: Implement sync mechanism or document limitation.

### LOW

#### PE-15: Company Document isLatest Flag Not Properly Managed on Updates

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/companyDocuments/companyDocumentService.ts` (lines 56-60)
- **Issue**: No guarantee that old version's `isLatest` flag is set to false when new version uploaded. Multiple "latest" versions possible.
- **Recommendation**: Update old version's `isLatest` in a transaction when creating new version.

## Summary

| Severity | Count | Key Areas                                         |
| -------- | ----- | ------------------------------------------------- |
| CRITICAL | 4     | Data Integrity (3), Security (1)                  |
| HIGH     | 3     | Data Integrity (1), Security (1), Performance (1) |
| MEDIUM   | 12    | Data Integrity (6), Security (4), UX (2)          |
| LOW      | 1     | Data Integrity (1)                                |

## Priority Fix Order

1. ~~**PE-1**: Fix vendor entity query field names (blocking — broken functionality)~~ — FIXED `d8e6570`
2. ~~**PE-2 + PE-17**: Archived entity and role validation~~ — FIXED `e063816`
3. **PE-6 + PE-9**: SSOT access control and project validation
4. **PE-12**: Validate vendor references in procurement documents
5. **PE-8 + PE-10**: Document visibility enforcement
