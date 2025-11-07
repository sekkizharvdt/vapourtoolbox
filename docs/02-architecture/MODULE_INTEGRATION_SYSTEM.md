# Module Integration System

**Version:** 1.0
**Status:** Active (Blueprint Phase)
**Last Updated:** 2025-11-07
**Author:** Claude Code

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Model](#data-model)
4. [Cloud Functions API](#cloud-functions-api)
5. [Frontend Components](#frontend-components)
6. [Accounting Module Integrations](#accounting-module-integrations)
7. [Cross-Module Reference Fields](#cross-module-reference-fields)
8. [Usage Guide](#usage-guide)
9. [Future Enhancements](#future-enhancements)
10. [Implementation Timeline](#implementation-timeline)

---

## Overview

### Purpose

The Module Integration System provides a **centralized registry and visualization** of all data flows between system modules. It serves as:

- **Integration Blueprint**: Documents all planned cross-module interactions
- **Development Roadmap**: Tracks implementation status of each integration
- **Architectural Documentation**: Shows system-wide data dependencies
- **Stakeholder Communication**: Visual representation of module interconnections

### Current Status: Blueprint Phase

This initial implementation focuses on **integration registry** (what SHOULD happen), not real-time monitoring (what IS happening). Future phases will add live event tracking and statistics.

**What's Built:**

- ✅ Super-admin dashboard for integration management
- ✅ Integration registry with 18 Accounting module definitions
- ✅ Four-quadrant visualization by data flow direction
- ✅ Status tracking (active, planned, in-development)
- ✅ Cross-module reference fields in data types
- ✅ Cloud Function for seeding integration data

**What's Planned:**

- ⏳ Live integration event tracking
- ⏳ Real-time statistics and metrics
- ⏳ Activity timeline showing recent data flows
- ⏳ Module communication heat map
- ⏳ Failed integration queue and retry mechanism

### Key Concepts

**Integration Direction:**

- **Incoming**: Data the target module receives from source modules
- **Outgoing**: Data the source module sends to target modules
- **Dependency**: Master data the module relies on from other modules
- **Reporting**: Data the module provides to other modules for analytics

**Integration Status:**

- **Active**: Currently implemented and functional
- **Planned**: Documented but not yet implemented
- **In Development**: Currently being built

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Super-Admin Dashboard                        │
│                   (/super-admin/page.tsx)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ├─ Permission Check: SUPER_ADMIN
                             │  (ALL_PERMISSIONS = 134217727)
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼───────┐         ┌─────▼─────────┐
        │ Module Cards  │         │  Integration  │
        │  - Accounting │         │   Overview    │
        │  - Procurement│         │  (Future)     │
        │  - Projects   │         └───────────────┘
        │  - Engineering│
        └───────┬───────┘
                │
                │ Click "View Integrations"
                │
        ┌───────▼───────────────────────────────────────────────┐
        │   Accounting Integration Dashboard                    │
        │   (/super-admin/module-integrations/accounting)       │
        │                                                        │
        │   ┌─────────────────────┬─────────────────────┐      │
        │   │  Incoming Data (6)  │  Outgoing Data (5)  │      │
        │   │  - Procurement →    │  - → Procurement    │      │
        │   │  - Projects →       │  - → Projects       │      │
        │   │  - HR →             │  - → Management     │      │
        │   │  - Inventory →      │                     │      │
        │   ├─────────────────────┼─────────────────────┤      │
        │   │  Dependencies (3)   │  Reporting Data (4) │      │
        │   │  - Entities (2)     │  - → Projects (2)   │      │
        │   │  - Projects (1)     │  - → Procurement (2)│      │
        │   │                     │  - → Management (2) │      │
        │   └─────────────────────┴─────────────────────┘      │
        │                                                        │
        │   [Status Filter: All | Active | Planned]             │
        └────────────────────────────┬───────────────────────────┘
                                     │
                                     │ Click Integration Card
                                     │
                        ┌────────────▼────────────┐
                        │  Integration Detail     │
                        │       Modal             │
                        │                         │
                        │  - Data Flow            │
                        │  - Field Mappings       │
                        │  - Trigger Conditions   │
                        │  - Implementation Date  │
                        │  - Notes                │
                        └─────────────────────────┘
```

### Data Flow

```
1. Super-admin accesses dashboard
   ↓
2. Frontend checks user.permissions === 134217727
   ↓
3. If authorized, show module cards
   ↓
4. User clicks "Accounting" → Integration Dashboard
   ↓
5. Frontend queries moduleIntegrations collection:
   - WHERE sourceModule == 'accounting'
   - WHERE targetModule == 'accounting'
   ↓
6. Real-time listener updates UI automatically
   ↓
7. Four quadrants display filtered integrations by type
   ↓
8. User clicks card → Modal shows detailed field mappings
```

### Firestore Collections

#### moduleIntegrations Collection

**Purpose:** Store all integration definitions across the system

**Document Structure:**

```typescript
{
  id: string;                                    // Auto-generated
  sourceModule: string;                          // e.g., "procurement"
  targetModule: string;                          // e.g., "accounting"
  integrationType: 'incoming' | 'outgoing' |
                   'dependency' | 'reporting';
  dataType: string;                              // e.g., "Vendor Invoices → Bills"
  description: string;                           // Detailed explanation
  status: 'active' | 'planned' | 'in-development';

  // Optional: Field mappings for data transformation
  fieldMappings?: Array<{
    source: string;                              // e.g., "vendorInvoice.amount"
    target: string;                              // e.g., "bill.amount"
  }>;

  // Optional: Trigger condition for automated flows
  triggerCondition?: string;                     // e.g., "vendorInvoice.status === 'APPROVED'"

  // Optional: Implementation tracking
  implementationDate?: string;                   // e.g., "2024-Q4"
  notes?: string;                                // Additional context

  // Audit fields
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes Required:**

```json
{
  "collectionGroup": "moduleIntegrations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "sourceModule", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "moduleIntegrations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "targetModule", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

---

## Data Model

### TypeScript Interfaces

#### IntegrationDefinition

```typescript
interface IntegrationDefinition {
  sourceModule: string;
  targetModule: string;
  integrationType: 'incoming' | 'outgoing' | 'dependency' | 'reporting';
  dataType: string;
  description: string;
  status: 'active' | 'planned' | 'in-development';
  fieldMappings?: Array<{ source: string; target: string }>;
  triggerCondition?: string;
  implementationDate?: string;
  notes?: string;
}
```

#### ModuleIntegration (Firestore Document)

```typescript
interface ModuleIntegration extends IntegrationDefinition {
  id?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Integration Types Explained

**1. Incoming Data**

- Target module RECEIVES data from source module
- Example: Accounting receives Vendor Invoices from Procurement
- Creates new records in target module
- Usually triggered by status change in source module

**2. Outgoing Data**

- Source module SENDS data to target module
- Example: Accounting sends Payment Confirmations to Procurement
- Updates existing records in target module
- Usually triggered by transaction completion in source module

**3. Dependency**

- Module RELIES ON master data from another module
- Example: Accounting depends on Vendor Master Data from Entities
- Read-only relationship
- Target module queries source module data directly

**4. Reporting**

- Module PROVIDES data to others for reporting/analytics
- Example: Accounting provides Financial Statements to Management
- Read-only relationship
- Source module exposes data through reports or APIs

---

## Cloud Functions API

### seedAccountingIntegrations

**Type:** Callable HTTPS Function
**Region:** us-central1
**Memory:** 256 MiB
**Permissions:** SUPER_ADMIN only

**Purpose:** One-time seeding of Accounting module integration definitions

#### Authentication & Authorization

```typescript
// Permission Check
const userPermissions = request.auth.token.permissions as number;
const ALL_PERMISSIONS = 134217727; // All 27 permission bits set

if (userPermissions !== ALL_PERMISSIONS) {
  throw new HttpsError('permission-denied', 'Super Admin privileges required');
}
```

**Why 134217727?**

```
ALL_PERMISSIONS = (1 << 27) - 1
                = 2^27 - 1
                = 134,217,727
                = 0b111111111111111111111111111 (27 ones)
```

#### Request

**Parameters:** None

**Example (from client):**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const seedIntegrations = httpsCallable(functions, 'seedAccountingIntegrations');

try {
  const result = await seedIntegrations();
  console.log('Success:', result.data);
  // {
  //   success: true,
  //   integrationsCreated: 18,
  //   breakdown: {
  //     byType: { incoming: 6, outgoing: 5, dependency: 3, reporting: 4 },
  //     byStatus: { active: 3, planned: 15 }
  //   }
  // }
} catch (error) {
  console.error('Error:', error.message);
  // "Super Admin privileges required"
  // "Accounting integrations already exist (18 documents found)"
}
```

#### Response

**Success (200):**

```typescript
{
  success: true;
  integrationsCreated: number;
  breakdown: {
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }
}
```

**Errors:**

- `permission-denied`: User is not SUPER_ADMIN
- `already-exists`: Integrations already seeded (prevents duplicates)
- `internal`: Unexpected error during seeding

#### Implementation Details

**Duplicate Prevention:**

```typescript
// Checks both directions
const existing1 = await db
  .collection('moduleIntegrations')
  .where('sourceModule', '==', 'accounting')
  .get();
const existing2 = await db
  .collection('moduleIntegrations')
  .where('targetModule', '==', 'accounting')
  .get();

if (existing1.size + existing2.size > 0) {
  throw new HttpsError('already-exists', `${existing1.size + existing2.size} documents found`);
}
```

**Batch Write:**

```typescript
const batch = db.batch();
for (const integration of ACCOUNTING_INTEGRATIONS) {
  const docRef = db.collection('moduleIntegrations').doc();
  batch.set(docRef, { ...integration, createdBy, createdAt, updatedAt });
}
await batch.commit();
```

---

## Frontend Components

### Super-Admin Layout

**File:** `apps/web/src/app/super-admin/layout.tsx`

**Purpose:** Permission guard for all super-admin routes

**Implementation:**

```typescript
export default function SuperAdminLayout({ children }: Props) {
  const { claims } = useAuth();

  const isSuperAdmin = (claims?.permissions || 0) === getAllPermissions();

  if (!isSuperAdmin) {
    return (
      <Alert severity="error">
        Access Denied: Super Admin privileges required
      </Alert>
    );
  }

  return <>{children}</>;
}
```

**Key Features:**

- Checks `claims.permissions === 134217727`
- Blocks access for non-super-admin users
- Shows clear error message

### Super-Admin Dashboard

**File:** `apps/web/src/app/super-admin/page.tsx`

**Purpose:** Home page showing all module cards

**UI Structure:**

```
┌────────────────────────────────────────────────┐
│  Super Admin Dashboard                         │
│  System-wide module integration management     │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Accounting│  │Procurement│  │ Projects │   │
│  │  [Icon]  │  │  [Icon]  │  │  [Icon]  │   │
│  │          │  │          │  │          │   │
│  │18 Integs │  │Coming    │  │Coming    │   │
│  │[View]    │  │Soon      │  │Soon      │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Engineering│  │Documents │  │Integration│  │
│  │  [Icon]  │  │  [Icon]  │  │  [Icon]  │   │
│  │          │  │          │  │          │   │
│  │Coming    │  │Coming    │  │Coming    │   │
│  │Soon      │  │Soon      │  │Soon      │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────────────────────────────┘
```

**Module Card Data:**

```typescript
interface ModuleCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: 'active' | 'coming-soon';
  integrationCount?: number;
}
```

### Accounting Integration Dashboard

**File:** `apps/web/src/app/super-admin/module-integrations/accounting/page.tsx`

**Purpose:** Four-quadrant visualization of Accounting integrations

**Real-time Data Loading:**

```typescript
useEffect(() => {
  const { db } = getFirebase();

  // Listen to integrations where Accounting is source
  const q1 = query(collection(db, 'moduleIntegrations'), where('sourceModule', '==', 'accounting'));

  // Listen to integrations where Accounting is target
  const q2 = query(collection(db, 'moduleIntegrations'), where('targetModule', '==', 'accounting'));

  const unsubscribe1 = onSnapshot(q1, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setIntegrations((prev) => [...prev, ...data]);
  });

  const unsubscribe2 = onSnapshot(q2, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setIntegrations((prev) => [...prev, ...data]);
  });

  return () => {
    unsubscribe1();
    unsubscribe2();
  };
}, []);
```

**Status Filter:**

```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');

const filterIntegrations = (type: string) => {
  return integrations.filter((i) => {
    const matchesType = i.integrationType === type;
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesType && matchesStatus;
  });
};
```

**Four Quadrants:**

1. **Top-Left:** Incoming Data
   - Filter: `integrationType === 'incoming'`
   - Shows integrations where Accounting is target

2. **Top-Right:** Outgoing Data
   - Filter: `integrationType === 'outgoing'`
   - Shows integrations where Accounting is source

3. **Bottom-Left:** Data Dependencies
   - Filter: `integrationType === 'dependency'`
   - Shows master data Accounting relies on

4. **Bottom-Right:** Reporting Data
   - Filter: `integrationType === 'reporting'`
   - Shows data Accounting provides for reports

**Integration Card Component:**

```typescript
const IntegrationCard = ({ integration }) => {
  const sourceModule =
    integration.integrationType === 'incoming' ||
    integration.integrationType === 'dependency'
      ? integration.sourceModule
      : 'accounting';

  const targetModule =
    integration.integrationType === 'incoming' ||
    integration.integrationType === 'dependency'
      ? 'accounting'
      : integration.targetModule;

  return (
    <Card onClick={() => handleViewDetails(integration)}>
      <CardHeader
        avatar={<Avatar>{sourceModule[0].toUpperCase()}</Avatar>}
        action={<Chip label={integration.status} color={...} />}
        title={`${sourceModule} → ${targetModule}`}
        subheader={integration.dataType}
      />
      <CardContent>
        <Typography>{integration.description}</Typography>
      </CardContent>
    </Card>
  );
};
```

### Integration Detail Modal

**Purpose:** Show comprehensive integration information

**Content:**

- Data flow visualization (source → target)
- Data type and description
- Trigger condition (if defined)
- Field mappings table (if defined)
- Implementation date (if defined)
- Additional notes

**Field Mappings Table:**

```typescript
<TableContainer>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Source Field</TableCell>
        <TableCell>Target Field</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {integration.fieldMappings?.map((mapping, index) => (
        <TableRow key={index}>
          <TableCell sx={{ fontFamily: 'monospace' }}>
            {mapping.source}
          </TableCell>
          <TableCell sx={{ fontFamily: 'monospace' }}>
            {mapping.target}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

---

## Accounting Module Integrations

### Summary Statistics

- **Total Integrations:** 18
- **Active:** 3 (17%)
- **Planned:** 15 (83%)
- **By Type:**
  - Incoming: 6 (33%)
  - Outgoing: 5 (28%)
  - Dependency: 3 (17%)
  - Reporting: 4 (22%)

### Incoming Data (6 integrations)

#### 1. Procurement → Accounting: Vendor Invoices → Bills

**Status:** Planned
**Trigger:** `vendorInvoice.status === "APPROVED"`

**Description:**
When a vendor invoice is approved in Procurement module, automatically create a corresponding bill in Accounting module.

**Field Mappings:**

```
vendorInvoice.vendorId        → bill.entityId
vendorInvoice.invoiceNumber   → bill.vendorInvoiceNumber
vendorInvoice.invoiceDate     → bill.billDate
vendorInvoice.dueDate         → bill.dueDate
vendorInvoice.amount          → bill.amount
vendorInvoice.lineItems       → bill.lineItems
vendorInvoice.gstDetails      → bill.gstDetails
```

**Implementation Notes:**

- Reference fields already added to VendorBill type
- Cloud Function trigger will be implemented when Procurement launches
- Bill creation will be automatic (no manual intervention)

---

#### 2. Procurement → Accounting: Purchase Orders → Commitments

**Status:** Planned
**Trigger:** `purchaseOrder.status === "ISSUED"`

**Description:**
When a PO is issued, create a financial commitment/encumbrance in Accounting for budget tracking.

**Benefits:**

- Helps with budget tracking
- Enables cash flow forecasting
- Shows committed but not yet spent funds

---

#### 3. Projects → Accounting: Project Expenses → Transactions

**Status:** Planned
**Trigger:** `projectExpense.status === "APPROVED"`

**Description:**
Project-related expenses are automatically posted to cost centres for project accounting.

**Field Mappings:**

```
projectExpense.projectId    → transaction.costCentreId
projectExpense.amount       → transaction.amount
projectExpense.description  → transaction.description
```

---

#### 4. Projects → Accounting: Budget Allocations → Cost Centres

**Status:** Planned
**Trigger:** `project.budget` created or updated

**Description:**
Project budgets are synced to cost centres for budget vs actual tracking.

**Field Mappings:**

```
project.id     → costCentre.projectId
project.budget → costCentre.budget
```

---

#### 5. HR → Accounting: Payroll → Journal Entries

**Status:** Planned

**Description:**
Monthly payroll data creates journal entries for salary expenses, deductions, and liabilities.

**Notes:**
Will be implemented when HR module includes payroll functionality.

---

#### 6. Inventory → Accounting: Stock Valuations → Asset Accounts

**Status:** Planned

**Description:**
Inventory valuations update asset accounts for stock on hand.

**Notes:**
Will be implemented when Inventory module is built.

---

### Outgoing Data (5 integrations)

#### 1. Accounting → Procurement: Payment Confirmations → Invoice Status

**Status:** Planned
**Trigger:** `vendorPayment.status === "POSTED"`

**Description:**
When a vendor payment is made, update the corresponding vendor invoice status in Procurement.

**Field Mappings:**

```
vendorPayment.billAllocations → vendorInvoice.paymentStatus
vendorPayment.paymentDate     → vendorInvoice.paidDate
vendorPayment.totalAmount     → vendorInvoice.paidAmount
```

**Implementation Notes:**

- Reference fields already added to VendorPayment type
- `notifyModules: ['procurement']` will trigger update
- Bidirectional sync with invoice payment tracking

---

#### 2. Accounting → Projects: Actual Costs → Project Financials

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Real-time cost tracking - cost centre transactions update project financial summaries.

**Trigger:** `transaction.costCentreId` is not null

**Notes:**
Currently active through costCentres collection. Transactions tagged with cost centres automatically update project financials.

---

#### 3. Accounting → Projects: Budget Utilization Alerts

**Status:** Planned

**Description:**
Alert project managers when budget thresholds are reached (e.g., 75%, 90%, 100%).

**Alert Thresholds:**

- Warning: 75% budget used
- Critical: 90% budget used
- Exceeded: 100% budget used

---

#### 4. Accounting → Procurement: Vendor Payment History

**Status:** Planned

**Description:**
Payment history data for vendor performance evaluation and payment terms negotiation.

**Use Cases:**

- Vendor evaluation (on-time payment rate)
- Payment terms negotiation (based on history)
- Cash flow planning

**Notes:**
Read-only integration for reporting purposes.

---

#### 5. Accounting → Management: Financial Reports

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Management dashboards display financial statements and key metrics from Accounting.

**Reports Available:**

- Trial Balance
- Balance Sheet
- Profit & Loss Statement
- Cash Flow Statement
- Account Ledger
- Project Financial Reports

---

### Data Dependencies (3 integrations)

#### 1. Entities → Accounting: Vendor Master Data

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Accounting transactions reference vendor data from the Entities module.

**Fields Used:**

- `entity.id` → `bill.entityId` / `payment.entityId`
- `entity.name` → `transaction.entityName` (denormalized)
- `entity.gstNumber` → `bill.vendorGSTIN`

**Notes:**
Vendor bills and payments require entityId from entities collection. This is a core dependency.

---

#### 2. Entities → Accounting: Customer Master Data

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Accounting invoices and receipts reference customer data from the Entities module.

**Fields Used:**

- `entity.id` → `invoice.entityId` / `receipt.entityId`
- `entity.name` → `transaction.entityName` (denormalized)
- `entity.gstNumber` → `invoice.customerGSTIN`

**Notes:**
Customer invoices and payments require entityId from entities collection.

---

#### 3. Projects → Accounting: Project List for Cost Centres

**Status:** Planned

**Description:**
Cost centres map to projects for project-based accounting and cost tracking.

**Notes:**
Cost centres will reference active projects once Projects module is built. Currently cost centres can be created independently.

---

### Reporting Data (4 integrations)

#### 1. Accounting → Projects: Project Cost Reports

**Status:** Planned

**Description:**
Detailed cost breakdowns by project for project financial analysis.

**Report Contents:**

- Expenses by category
- Expenses by vendor
- Expenses by time period
- Budget vs actual comparison

---

#### 2. Accounting → Projects: Budget vs Actual Reports

**Status:** Planned

**Description:**
Comparison of budgeted vs actual costs for project financial control.

**Metrics:**

- Total budget allocated
- Total spend to date
- Variance (amount and %)
- Projected final cost

---

#### 3. Accounting → Procurement: Vendor Payment History Reports

**Status:** Planned

**Description:**
Historical payment data for vendor evaluation and payment terms analysis.

**Report Contents:**

- Payment amounts by vendor
- Payment frequency
- Average payment delay
- Outstanding payables

---

#### 4. Accounting → Procurement: Outstanding Payables Report

**Status:** Planned

**Description:**
Aging analysis of outstanding vendor bills for cash flow planning.

**Aging Buckets:**

- Current (0-30 days)
- 31-60 days
- 61-90 days
- Over 90 days

---

#### 5. Accounting → Management: Financial Statements

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Full suite of financial reports currently available.

**Reports:**

- Trial Balance (all account balances)
- Balance Sheet (assets, liabilities, equity)
- Profit & Loss (revenue and expenses)
- Cash Flow (operating, investing, financing)

---

#### 6. Accounting → Management: Cash Flow Analysis

**Status:** Active ✓
**Implementation Date:** 2024-Q4

**Description:**
Detailed cash flow projections and analysis for treasury management.

**Analysis Includes:**

- Historical cash flow trends
- Cash flow by category
- Cash flow projections
- Working capital analysis

---

## Cross-Module Reference Fields

### VendorBill Type Extensions

**File:** `packages/types/src/transaction.ts`

**Added Fields:**

```typescript
interface VendorBill extends BaseTransaction {
  type: 'VENDOR_BILL';

  // ... existing fields ...

  // Cross-module integration (for future use)
  sourceModule?: 'procurement' | 'projects' | null;
  sourceDocumentId?: string; // ID of vendor invoice or project expense
  sourceDocumentType?: 'vendorInvoice' | 'projectExpense' | null;
}
```

**Purpose:**

- Track which module created this bill
- Link back to source document for bidirectional navigation
- Enable audit trail across modules

**Usage Example (Procurement → Accounting):**

```typescript
// When Procurement creates a bill from vendor invoice
const bill: VendorBill = {
  // ... standard bill fields ...
  sourceModule: 'procurement',
  sourceDocumentId: 'VI-001',
  sourceDocumentType: 'vendorInvoice',
};
```

---

### VendorPayment Type Extensions

**File:** `packages/types/src/transaction.ts`

**Added Fields:**

```typescript
interface VendorPayment extends BaseTransaction {
  type: 'VENDOR_PAYMENT';

  // ... existing fields ...

  // Cross-module integration (for future use)
  notifyModules?: Array<'procurement' | 'projects'>;
  sourceReferences?: Array<{
    module: 'procurement' | 'projects';
    documentId: string;
    documentType: string;
  }>;
}
```

**Purpose:**

- Define which modules should be notified of payment
- Track all source documents related to this payment
- Enable reverse updates (payment → invoice status)

**Usage Example (Accounting → Procurement):**

```typescript
// When payment is made for bill linked to procurement
const payment: VendorPayment = {
  // ... standard payment fields ...
  notifyModules: ['procurement'],
  sourceReferences: [
    {
      module: 'procurement',
      documentId: 'VI-001',
      documentType: 'vendorInvoice',
    },
  ],
};
```

---

## Usage Guide

### For Super-Admins

#### 1. Access the Super-Admin Dashboard

**URL:** `https://vapour-toolbox.web.app/super-admin`

**Requirements:**

- Must be logged in
- Must have SUPER_ADMIN permissions (all 27 permission bits set)

**What You'll See:**

- Module cards for Accounting, Procurement, Projects, etc.
- Accounting shows "18 Integrations" badge
- Other modules show "Coming Soon"

---

#### 2. View Accounting Integrations

**Steps:**

1. Click "View Integrations" on Accounting card
2. Dashboard loads with four quadrants
3. Summary stats show total integrations by status

**Status Filter:**

- **All:** Show all integrations
- **Active:** Show only implemented integrations (3)
- **Planned:** Show only future integrations (15)

---

#### 3. Explore Integration Details

**Click any integration card to see:**

**Data Flow:**

- Source module → Target module
- Visual chip representation

**Data Type:**

- High-level description of data being transferred
- Example: "Vendor Invoices → Bills"

**Description:**

- Detailed explanation of what happens
- When it's triggered
- Business logic involved

**Field Mappings (if applicable):**
| Source Field | Target Field |
|--------------|--------------|
| vendorInvoice.vendorId | bill.entityId |
| vendorInvoice.amount | bill.amount |

**Trigger Condition (if applicable):**

```
vendorInvoice.status === "APPROVED"
```

**Implementation Date:**

- When this integration was/will be implemented
- Example: "2024-Q4" or "Planned"

**Notes:**

- Additional context
- Dependencies
- Special considerations

---

#### 4. Seed Integration Data (First-Time Setup)

**⚠️ Only needs to be done ONCE**

**Option A: From Firebase Console**

1. Open Firebase Console → Functions
2. Find `seedAccountingIntegrations`
3. Click "Test function"
4. Run with empty request body
5. Check response for success

**Option B: From Client Application**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

async function seedIntegrations() {
  const functions = getFunctions();
  const seedFn = httpsCallable(functions, 'seedAccountingIntegrations');

  try {
    const result = await seedFn();
    console.log('✓ Integrations seeded:', result.data);

    // Expected output:
    // {
    //   success: true,
    //   integrationsCreated: 18,
    //   breakdown: {
    //     byType: { incoming: 6, outgoing: 5, dependency: 3, reporting: 4 },
    //     byStatus: { active: 3, planned: 15 }
    //   }
    // }
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.error('✗ Super-admin privileges required');
    } else if (error.message.includes('already exist')) {
      console.log('ℹ Integrations already seeded');
    } else {
      console.error('✗ Error:', error.message);
    }
  }
}
```

**After Seeding:**

- Refresh the Accounting Integration Dashboard
- All 18 integrations will appear
- 3 will show "Active" status (green)
- 15 will show "Planned" status (gray)

---

### For Developers

#### When Building a New Module

**Step 1: Document Integrations**

Before coding, add integration definitions to `moduleIntegrations` collection:

```typescript
{
  sourceModule: 'newModule',
  targetModule: 'accounting',
  integrationType: 'outgoing',
  dataType: 'New Data → Transactions',
  description: 'When new data is created, post to accounting',
  status: 'in-development',
  triggerCondition: 'newData.status === "APPROVED"',
  fieldMappings: [
    { source: 'newData.amount', target: 'transaction.amount' },
    // ... more mappings
  ],
}
```

**Step 2: Add Reference Fields**

Update relevant types to include cross-module references:

```typescript
interface Transaction extends BaseTransaction {
  // Add source tracking
  sourceModule?: 'procurement' | 'projects' | 'newModule';
  sourceDocumentId?: string;
  sourceDocumentType?: string;
}
```

**Step 3: Implement Cloud Function Trigger**

```typescript
// functions/src/newModuleIntegration.ts
export const onNewDataApproved = onDocumentWritten('newModule/{id}', async (event) => {
  const newData = event.data.after.data();

  if (newData.status !== 'APPROVED') return;

  // Create integration event (for tracking)
  await db.collection('integrationEvents').add({
    sourceModule: 'newModule',
    targetModule: 'accounting',
    eventType: 'NEW_DATA_APPROVED',
    status: 'PENDING',
    sourceDocumentId: event.params.id,
    createdAt: Timestamp.now(),
  });

  // Create transaction in accounting
  try {
    await db.collection('transactions').add({
      type: 'JOURNAL_ENTRY',
      amount: newData.amount,
      sourceModule: 'newModule',
      sourceDocumentId: event.params.id,
      // ... other fields
    });

    // Update integration event
    await updateIntegrationEvent(eventId, 'SUCCESS');
  } catch (error) {
    await updateIntegrationEvent(eventId, 'FAILED', error);
  }
});
```

**Step 4: Update Integration Status**

```typescript
// Update Firestore document
await db
  .collection('moduleIntegrations')
  .where('sourceModule', '==', 'newModule')
  .where('targetModule', '==', 'accounting')
  .get()
  .then((snapshot) => {
    snapshot.docs[0].ref.update({
      status: 'active',
      implementationDate: '2025-Q1',
    });
  });
```

**Step 5: Test Integration**

1. Create test data in new module
2. Verify Cloud Function triggers
3. Check transaction created in Accounting
4. Verify integration event logged
5. Confirm bidirectional navigation works

---

## Future Enhancements

### Phase 2: Live Integration Monitoring

**Goal:** Show real-time data flow statistics

**New Collection: integrationEvents**

```typescript
interface IntegrationEvent {
  id: string;
  sourceModule: string;
  targetModule: string;
  eventType: string;
  sourceDocumentId: string;
  targetDocumentId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  retryCount: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

**Dashboard Additions:**

1. **Statistics Cards:**

   ```
   Procurement → Accounting
   ├─ Events this month: 45
   ├─ Success rate: 98%
   ├─ Failed: 1 (view queue)
   └─ Avg processing time: 1.2s
   ```

2. **Activity Timeline:**

   ```
   2 mins ago: VI-001 → BILL-234 ✓
   5 mins ago: VI-002 → BILL-235 ✓
   10 mins ago: VI-003 → BILL-236 ✗ (retry)
   ```

3. **Module Communication Heat Map:**
   ```
   [Visual diagram showing volume of data flows]
   Procurement ──────────────→ Accounting (45 events)
               ←───────────── (12 events)
   Projects ────────────────→ Accounting (23 events)
   ```

---

### Phase 3: Failed Integration Queue

**Goal:** Manual retry and resolution of failed integrations

**Features:**

- List all failed integration events
- View error details and stacktrace
- Retry individual events
- Bulk retry by error type
- Mark as resolved (with notes)

**UI:**

```
Failed Integrations Queue
─────────────────────────────────────────────
Event ID    | Source → Target       | Error
─────────────────────────────────────────────
EVT-001     | Procurement → Account | Vendor not found
EVT-002     | Projects → Account    | Invalid cost centre
EVT-003     | Procurement → Account | Network timeout
─────────────────────────────────────────────
[Retry All] [Filter by Error Type] [Export]
```

---

### Phase 4: Integration Performance Analytics

**Goal:** Optimize integration performance

**Metrics:**

- Processing time by integration type
- Success rate trends over time
- Bottleneck identification
- Resource usage (Cloud Function invocations)

**Reports:**

- Integration health dashboard
- Performance comparison across integrations
- Cost analysis (Cloud Function costs)

---

## Implementation Timeline

### Completed (2025-Q1)

- ✅ Super-admin dashboard structure
- ✅ Module cards with status badges
- ✅ Accounting integration dashboard (four-quadrant layout)
- ✅ Integration detail modal with field mappings
- ✅ moduleIntegrations Firestore collection
- ✅ seedAccountingIntegrations Cloud Function
- ✅ 18 Accounting integration definitions
- ✅ Cross-module reference fields in types
- ✅ Real-time integration data loading
- ✅ Status filtering (active/planned)

### Planned (2025-Q2)

- ⏳ Procurement module integration implementation
- ⏳ Projects module integration implementation
- ⏳ Live integration event tracking
- ⏳ Integration statistics and metrics
- ⏳ Activity timeline component

### Planned (2025-Q3)

- ⏳ Failed integration queue
- ⏳ Manual retry mechanism
- ⏳ Module communication heat map
- ⏳ Integration performance analytics

### Planned (2025-Q4)

- ⏳ HR module integrations
- ⏳ Inventory module integrations
- ⏳ Engineering module integrations
- ⏳ Document Management integrations
- ⏳ Advanced alerting and notifications

---

## Appendix

### Related Documentation

- [Module Structure](./MODULE_STRUCTURE.md)
- [Phase 2 Complete](./PHASE_2_COMPLETE.md)
- [Cross-Module Integration Analysis](../archive/planning/CROSS_MODULE_INTEGRATION_ANALYSIS.md)

### Firestore Security Rules

```javascript
// moduleIntegrations collection
match /moduleIntegrations/{integrationId} {
  // Anyone authenticated can read integrations
  allow read: if request.auth != null;

  // Only super-admin can write
  allow write: if request.auth != null &&
    request.auth.token.permissions == 134217727;
}
```

### API Endpoints

- **Super-Admin Dashboard:** `/super-admin`
- **Accounting Integrations:** `/super-admin/module-integrations/accounting`
- **Seed Function:** `seedAccountingIntegrations` (callable)

### Support

For questions or issues:

- GitHub Issues: https://github.com/sekkizharvdt/vapourtoolbox/issues
- Documentation: docs/README.md

---

**Last Updated:** 2025-11-07
**Maintained By:** VDT Development Team
