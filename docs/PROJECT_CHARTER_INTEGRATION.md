# Project Charter Integration Documentation

**Date:** 2025-01-10
**Status:** Implementation In Progress
**Phase:** Foundation - Types and UI Structure Complete

## Table of Contents

1. [Overview](#overview)
2. [Document Management Integration](#1-document-management-integration)
3. [Procurement Integration](#2-procurement-integration)
4. [Entity Management Integration](#3-entity-management-vendors)
5. [Cost Centre Integration](#4-cost-centre-integration)
6. [Milestone Management](#5-milestone-management)
7. [Cloud Functions Inventory](#6-cloud-functions-inventory)
8. [Missing Integrations](#7-missing-integrations-to-create)
9. [Potential Conflicts](#8-potential-conflicts--issues)
10. [Implementation Roadmap](#9-implementation-roadmap)

---

## Overview

The Project Charter enhancement adds comprehensive project authorization, planning, and tracking capabilities to VDT-Unified. This document details how charter features integrate with existing modules.

### Key Integration Points

- **Document Management**: Auto-link uploaded documents to charter requirements
- **Procurement**: Auto-draft PRs from charter procurement items on approval
- **Entity Management**: Link outsourcing vendors to BusinessEntity records
- **Cost Centres**: Auto-created on project creation, synced with charter budget
- **Milestones**: Track project timeline and deliverables

---

## 1. Document Management Integration

### ✅ What Already Exists

**Files:**

- `apps/web/src/lib/documents/documentService.ts` - Complete DMS service
- `packages/types/src/documents.ts` - DocumentRecord type definition

**Key Features:**

- Multi-level linking (projectId, equipmentId, entityType, entityId)
- Version control (version, isLatest, previousVersionId)
- Status workflow ('ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'DELETED')
- Storage path: `/documents/{projectId}/{equipmentId}/{module}/{entityType}/{entityId}`
- Search by project: `getDocumentsByProject(projectId, equipmentId?)`

**DocumentRecord Type:**

```typescript
export interface DocumentRecord {
  id: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  equipmentId?: string;
  entityType: DocumentEntityType;
  entityId: string;
  version: number;
  isLatest: boolean;
  status: DocumentStatus;
  // ... metadata fields
}
```

### Charter DocumentRequirement Type

**File:** `packages/types/src/project.ts` (Lines 202-215)

```typescript
export interface DocumentRequirement {
  id: string;
  documentType: string;
  documentCategory:
    | 'PROJECT_PLAN'
    | 'TECHNICAL_DRAWING'
    | 'SPECIFICATION'
    | 'CONTRACT'
    | 'PROGRESS_REPORT'
    | 'MEETING_MINUTES'
    | 'COMPLIANCE'
    | 'OTHER';
  description: string;
  isRequired: boolean;
  dueDate?: Timestamp;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedDate?: Timestamp;
  linkedDocumentId?: string; // Links to DocumentRecord
  assignedTo?: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}
```

### 🔨 What Needs to Be Created

#### 1. Document Requirement Service

**File:** `apps/web/src/lib/projects/documentRequirementService.ts`

```typescript
export async function linkDocumentToRequirement(
  projectId: string,
  requirementId: string,
  documentId: string,
  userId: string
): Promise<void>;

export async function updateRequirementFromDocumentStatus(
  projectId: string,
  requirementId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  userId: string
): Promise<void>;

export async function listDocumentRequirements(
  projectId: string,
  status?: DocumentRequirement['status']
): Promise<DocumentRequirement[]>;
```

#### 2. Cloud Function for Auto-Linking

**File:** `functions/src/documentRequirements.ts`

```typescript
export const onDocumentUploaded = onDocumentCreated(
  { document: 'documents/{documentId}' },
  async (event) => {
    // Check if document has projectId
    // Search for matching DocumentRequirement by type/category
    // Update requirement.linkedDocumentId and status to 'SUBMITTED'
  }
);
```

#### 3. Progress Report Save Service

**File:** `apps/web/src/lib/projects/progressReportService.ts`

```typescript
export async function generateAndSaveProgressReport(
  projectId: string,
  reportData: ProgressReport,
  userId: string
): Promise<{ reportId: string; documentId: string }>;
```

---

## 2. Procurement Integration

### ✅ What Already Exists

**Files:**

- `packages/types/src/procurement.ts` - Complete type definitions
- `apps/web/src/lib/procurement/purchaseRequestService.ts` - PR CRUD operations
- `apps/web/src/lib/procurement/rfqService.ts` - RFQ service
- `apps/web/src/lib/procurement/purchaseOrderService.ts` - PO service

**Collections:**

```
purchaseRequests
purchaseRequestItems (sub-collection)
rfqs
rfqItems (sub-collection)
purchaseOrders
purchaseOrderItems (sub-collection)
```

**PurchaseRequest Type:**

```typescript
export interface PurchaseRequest {
  id: string;
  number: string; // PR/YYYY/MM/XXXX
  projectId: string;
  projectName: string; // Denormalized
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_RFQ';
  items: PurchaseRequestItem[];
  // ... workflow fields
}
```

**Existing Service:**

- `createPurchaseRequest()` - Supports batch item creation, auto-numbering, project linking

### Charter ProcurementItem Type

**File:** `packages/types/src/project.ts` (Lines 220-238)

```typescript
export interface ProcurementItem {
  id: string;
  itemName: string;
  description: string;
  category: 'RAW_MATERIAL' | 'COMPONENT' | 'EQUIPMENT' | 'SERVICE' | 'OTHER';
  quantity: number;
  unit: string;
  estimatedUnitPrice?: Money;
  estimatedTotalPrice?: Money;
  requiredByDate?: Timestamp;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PLANNING' | 'PR_DRAFTED' | 'RFQ_ISSUED' | 'PO_PLACED' | 'DELIVERED' | 'CANCELLED';
  linkedPurchaseRequestId?: string;
  linkedRFQId?: string;
  linkedPOId?: string;
  preferredVendors?: string[];
  technicalSpecs?: string;
  notes?: string;
}
```

### 🔨 What Needs to Be Created

#### 1. Charter Procurement Service

**File:** `apps/web/src/lib/projects/charterProcurementService.ts`

```typescript
export async function createPRsFromCharterItems(
  projectId: string,
  projectName: string,
  procurementItems: ProcurementItem[],
  userId: string,
  userName: string
): Promise<{ createdPRs: string[]; updatedItems: ProcurementItem[] }>;

export async function syncProcurementItemStatus(
  projectId: string,
  itemId: string,
  linkedPRId: string,
  newStatus: ProcurementItem['status']
): Promise<void>;
```

#### 2. Charter Approval Cloud Function

**File:** `functions/src/charterApproval.ts`

```typescript
export const onCharterApproved = onDocumentUpdated(
  { document: 'projects/{projectId}' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Detect charter approval status change
    if (
      after?.charter?.authorization?.approvalStatus === 'APPROVED' &&
      before?.charter?.authorization?.approvalStatus !== 'APPROVED'
    ) {
      // 1. Filter CRITICAL/HIGH priority items
      // 2. Call createPRsFromCharterItems()
      // 3. Update charter.procurementItems with linkedPurchaseRequestId
      // 4. Send notifications to procurement team
    }
  }
);
```

### ⚠️ Type Enhancement Needed

Add equipment linking to ProcurementItem:

```typescript
export interface ProcurementItem {
  // ... existing fields
  equipmentId?: string; // ADD THIS
  equipmentCode?: string; // ADD THIS
  equipmentName?: string; // ADD THIS
}
```

---

## 3. Entity Management (Vendors)

### ✅ What Already Exists

**Files:**

- `packages/types/src/entity.ts` - BusinessEntity type
- `apps/web/src/components/common/forms/EntitySelector.tsx` - Reusable selector

**Collection:** `entities`

**BusinessEntity Type:**

```typescript
export interface BusinessEntity {
  id: string;
  code: string; // ENT-001
  name: string;
  roles: EntityRole[]; // ['VENDOR', 'CUSTOMER', 'PARTNER']
  contactPerson: string;
  email: string;
  phone: string;
  contacts?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }>;
  status: Status;
  isActive: boolean;
  // Address, tax, banking info
}
```

**EntitySelector Component:**

```typescript
<EntitySelector
  value={vendorId}
  onChange={setVendorId}
  filterByRole="VENDOR"
  label="Select Vendor"
/>
```

### Charter OutsourcingVendor Type

**File:** `packages/types/src/project.ts` (Lines 182-197)

```typescript
export interface OutsourcingVendor {
  id: string;
  vendorEntityId: string; // Links to BusinessEntity
  vendorName: string;
  scopeOfWork: string;
  contractValue?: Money;
  contractStartDate?: Timestamp;
  contractEndDate?: Timestamp;
  contractStatus: 'DRAFT' | 'NEGOTIATION' | 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  deliverables: string[];
  performanceRating?: number; // 1-5 stars
  notes?: string;
}
```

### 🔨 What Needs to Be Created

#### 1. Vendor Contract Service

**File:** `apps/web/src/lib/projects/vendorContractService.ts`

```typescript
export async function generateVendorContract(
  projectId: string,
  vendor: OutsourcingVendor,
  userId: string
): Promise<{ documentId: string }>;

export async function updateVendorPerformance(
  projectId: string,
  vendorId: string,
  rating: number,
  notes?: string
): Promise<void>;
```

#### 2. Vendor Performance Component

**File:** `apps/web/src/app/projects/[id]/charter/components/VendorPerformanceCard.tsx`

Display vendor stats from BusinessEntity:

- Total projects worked on
- Average performance rating
- Contract history
- Outstanding payments

---

## 4. Cost Centre Integration

### ✅ What Already Exists

**Files:**

- `apps/web/src/lib/accounting/costCentreService.ts` - Service functions
- `functions/src/projects.ts` - Auto-creation Cloud Functions

**Collection:** `costCentres`

**CostCentre Type:**

```typescript
export interface CostCentre {
  id: string;
  code: string; // CC-PRJ-001 format
  name: string;
  description?: string;
  projectId?: string; // Links to project
  budgetAmount: number | null;
  budgetCurrency: string;
  actualSpent: number;
  variance: number | null;
  isActive: boolean;
  autoCreated?: boolean; // Flag for auto-created
}
```

**Cloud Functions:**

- `onProjectCreated`: Auto-creates cost centre with CC-{projectCode} format
- `onProjectUpdated`: Syncs project name/status/budget changes to cost centre

### 🔨 What Needs to Be Created

#### Charter Budget Sync Service

**File:** `apps/web/src/lib/projects/charterBudgetService.ts`

```typescript
export async function syncCharterBudget(
  projectId: string,
  charterBudget: ProjectBudget
): Promise<void>;

export async function getProjectCostCentre(projectId: string): Promise<CostCentre | null>;
```

---

## 5. Milestone Management

### ✅ What Already Exists

**Type Definition:** `packages/types/src/project.ts` (Lines 115-124)

```typescript
export interface ProjectMilestone extends TimestampFields {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string[];
}
```

**Collection:** `project_milestones`

### 🔨 What Needs to Be Created

#### Milestone Service

**File:** `apps/web/src/lib/projects/milestoneService.ts`

```typescript
export async function createMilestone(
  projectId: string,
  milestoneData: Omit<ProjectMilestone, 'id'>,
  userId: string
): Promise<string>;

export async function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]>;

export async function updateMilestoneStatus(
  milestoneId: string,
  status: ProjectMilestone['status'],
  userId: string
): Promise<void>;

export async function completeMilestone(milestoneId: string, userId: string): Promise<void>;
```

---

## 6. Cloud Functions Inventory

### Existing Functions

**File:** `functions/src/index.ts`

```typescript
// User Management
export { onUserUpdate } from './userManagement';

// Account Balances
export { onTransactionWrite, recalculateAccountBalances } from './accountBalances';

// Entity Management
export { createEntity } from './entities/createEntity';

// Currency
export { fetchDailyExchangeRates, manualFetchExchangeRates } from './currency';

// ✅ Projects (Cost Centre Auto-Creation)
export { onProjectCreated, onProjectUpdated } from './projects';

// Module Integrations
export { seedAccountingIntegrations } from './moduleIntegrations';
```

---

## 7. Missing Integrations to Create

### Priority 1: Critical Path (Weeks 1-2)

#### A. Charter-to-Procurement Integration

- **Service:** `apps/web/src/lib/projects/charterProcurementService.ts`
- **Cloud Function:** `functions/src/charterApproval.ts`
- **Impact:** Auto-draft PRs from approved charters

#### B. Document Requirements Integration

- **Service:** `apps/web/src/lib/projects/documentRequirementService.ts`
- **Cloud Function:** `functions/src/documentRequirements.ts`
- **Component:** `apps/web/src/app/projects/[id]/charter/components/DocumentsTab.tsx`
- **Impact:** Auto-link documents to requirements

#### C. Progress Report Generation

- **Service:** `apps/web/src/lib/projects/progressReportService.ts`
- **Cloud Function:** `functions/src/progressReports.ts`
- **Component:** `apps/web/src/app/projects/[id]/charter/components/ReportsTab.tsx`
- **Impact:** Automated reporting with DMS integration

### Priority 2: Enhanced Features (Weeks 3-4)

#### D. Milestone Management

- **Service:** `apps/web/src/lib/projects/milestoneService.ts`
- **Component:** `apps/web/src/app/projects/[id]/charter/components/MilestoneTimeline.tsx`

#### E. Vendor Management

- **Service:** `apps/web/src/lib/projects/vendorContractService.ts`
- **Component:** `apps/web/src/app/projects/[id]/charter/components/VendorPerformanceCard.tsx`

#### F. Budget Tracking

- **Service:** `apps/web/src/lib/projects/charterBudgetService.ts`

---

## 8. Potential Conflicts & Issues

### Issue 1: Equipment Linking in ProcurementItem

**Problem:** Charter ProcurementItem doesn't have equipmentId, but PR items need it

**Resolution:** Add optional equipmentId/equipmentCode fields to ProcurementItem type

### Issue 2: Transaction Boundaries

**Problem:** Creating multiple PRs on charter approval needs atomicity

**Resolution:** Use Firestore writeBatch for all operations

### Issue 3: Project Name Denormalization

**Problem:** Services need projectName but may only have projectId

**Resolution:** Add helper function to fetch project name from Firestore

### Issue 4: Circular Dependencies

**Problem:** Charter approval triggers PR creation which may update charter

**Resolution:** Use one-way data flow (Charter → PR only), store linkedPRId in charter

---

## 9. Implementation Roadmap

### ✅ Phase 0: Foundation (COMPLETED)

- [x] Type definitions in `packages/types/src/project.ts`
- [x] Charter page structure with 10 tabs
- [x] Overview tab with key stats
- [x] Navigation from projects list to charter

### 🚧 Phase 1: Core Charter Tabs (Weeks 1-2)

- [ ] Implement CharterTab (authorization, objectives, deliverables)
- [ ] Implement TechnicalTab (project type selector, specs)
- [ ] Implement VendorsTab (vendor assignment, contracts)
- [ ] Implement ProcurementTab (items list, status tracking)
- [ ] Implement DocumentsTab (requirements tracker)
- [ ] Implement BudgetTab (cost centre integration)
- [ ] Implement TimelineTab (milestone visualization)
- [ ] Implement TeamTab (team member management)

### 📋 Phase 2: Services & Automation (Weeks 3-4)

- [ ] Document requirement service
- [ ] Charter procurement service
- [ ] Milestone service
- [ ] Vendor contract service
- [ ] Charter budget service

### ⚡ Phase 3: Cloud Functions (Weeks 5-6)

- [ ] Charter approval trigger (auto-create PRs)
- [ ] Document upload auto-linking
- [ ] Progress report scheduler

### 📊 Phase 4: Progress Reports (Weeks 7-8)

- [ ] Progress report generation service
- [ ] Report section selector
- [ ] Scheduled report configuration
- [ ] Report viewer component
- [ ] ReportsTab implementation

---

## Architecture Patterns

### Service Layer Pattern

```typescript
// Location: apps/web/src/lib/*
// Pure TypeScript functions
// Firestore operations only
// No UI dependencies
// Export typed interfaces
```

### Component Pattern

```typescript
// Location: apps/web/src/app/*/components/*
'use client';
// Material-UI components
// Import from service layer
// Form validation with state
// Error handling with alerts
```

### Cloud Function Pattern

```typescript
// Location: functions/src/*
// Event-driven triggers
// Admin SDK operations
// Structured logging
// Error handling (don't throw)
// Use writeBatch for atomicity
```

---

## Firestore Collections

### Used by Charter (All Existing)

```
projects             // Charter stored as nested field
project_milestones   // Milestone tracking
entities            // Vendors/customers
documents           // All documents
purchaseRequests    // Created from charter
purchaseRequestItems
rfqs
purchaseOrders
costCentres         // Auto-created from projects
```

### No New Collections Needed

All charter data stored within `projects` collection as nested fields.

---

## Conclusion

### Strengths

✅ Document Management System production-ready
✅ Procurement workflow complete (PR → RFQ → PO)
✅ Cost Centre auto-creation fully implemented
✅ Entity management with reusable components
✅ Comprehensive type definitions

### Gaps

🔨 Bridge services between charter and modules
🔨 Cloud Function triggers for workflows
🔨 UI component implementations
🔨 Progress report generation

### Risk Level: LOW

Most infrastructure exists. Need glue code and UI components following established patterns.

---

**Last Updated:** 2025-01-10
**Next Review:** After Phase 1 completion
