# Database Schema

Firestore collections and their structure. **271 composite indexes** defined in `firestore.indexes.json`. **1,826 lines** of security rules in `firestore.rules`.

## Key Concepts

- **`entityId` on transactions = COUNTERPARTY** (vendor/customer), NOT a tenant ID
- **Multi-tenancy NOT yet implemented** — `accounts` use `entityId: 'default-entity'` as tenant marker
- **Soft deletes**: `isDeleted: true` flag, client-side filtering (never hard delete)
- **Timestamps**: Firestore returns `Timestamp` objects at runtime — always check for `toDate()` method before using date methods

## Core Collections

### users

```typescript
{
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  roles: string[];
  permissions: number;        // Bitwise flags (32 flags)
  permissions2: number;       // Extended bitwise flags (32 more)
  departmentId?: string;
  lastClaimUpdate?: Timestamp; // Triggers token refresh in AuthContext
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### entities

Vendors and customers (counterparties). NOT business tenants.

```typescript
{
  id: string;
  name: string;
  roles: ('VENDOR' | 'CUSTOMER')[];
  gstNumber?: string;
  panNumber?: string;
  addresses: Address[];
  contacts: Contact[];
  bankDetails?: BankDetails[];
  openingBalance?: { amount: number; type: 'DR' | 'CR' };
  isActive: boolean;
  createdAt: Timestamp;
}
```

## Accounting Collections

### accounts

Chart of accounts. Balance fields written atomically by `onTransactionWrite` Cloud Function.

```typescript
{
  id: string;
  code: string;               // 1000, 2000, etc.
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  entityId: string;           // 'default-entity' (tenant marker)
  parentId?: string;
  isGroup: boolean;
  isActive: boolean;
  currentBalance: number;     // Written by Cloud Function
  debit: number;              // Written by Cloud Function
  credit: number;             // Written by Cloud Function
  openingBalance?: number;
  createdAt: Timestamp;
}
```

### transactions

General ledger entries. 9 transaction types.

```typescript
{
  id: string;
  type: TransactionType;      // 9 types (see CLAUDE.md rule 24)
  transactionNumber: string;
  date: Timestamp;
  description: string;
  entityId?: string;          // Counterparty (vendor/customer) — NOT tenant
  entries: JournalEntry[];    // Debits and credits (GL lines)
  totalAmount: number;        // In transaction currency
  baseAmount: number;         // In INR (for multi-currency aggregation)
  currency: string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  isDeleted?: boolean;
  createdAt: Timestamp;
}
```

### fixedAssets

```typescript
{
  id: string;
  assetCode: string;
  name: string;
  category: string;
  acquisitionDate: Timestamp;
  acquisitionCost: number;
  depreciationMethod: 'SLM' | 'WDV';
  usefulLifeYears: number;
  status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF';
  createdAt: Timestamp;
}
```

## Procurement Collections

### purchaseRequests

```typescript
{
  id: string;
  prNumber: string;
  projectId?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  items: PRItem[];
  requestedBy: string;
  approvedBy?: string;
  createdAt: Timestamp;
}
```

### rfqs

```typescript
{
  id: string;
  rfqNumber: string;
  purchaseRequestId?: string;
  vendorIds: string[];
  items: RFQItem[];
  status: 'DRAFT' | 'SENT' | 'CLOSED' | 'PO_PROCESSED';
  dueDate: Timestamp;
  createdAt: Timestamp;
}
```

### purchaseOrders

```typescript
{
  id: string;
  poNumber: string;
  vendorId: string;
  rfqId?: string;
  offerId?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED' | 'COMPLETED' | 'CANCELLED';
  items: POItem[];
  commercialTerms?: CommercialTerms;
  currency: string;
  totalAmount: number;
  createdAt: Timestamp;
}
```

### goodsReceipts

```typescript
{
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  entityId: string;           // Vendor (populated from PO)
  items: GRNItem[];
  receivedBy: string;
  receivedAt: Timestamp;
  createdAt: Timestamp;
}
```

## HR Collections

### hrLeaveRequests

```typescript
{
  id: string;
  requestNumber: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  createdAt: Timestamp;
}
```

### hrTravelExpenses

```typescript
{
  id: string;
  reportNumber: string;
  employeeId: string;
  tripPurpose: string;
  tripStartDate: Timestamp;
  tripEndDate: Timestamp;
  destinations: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  items: ExpenseItem[];       // With receipt OCR from Document AI
  totalAmount: number;
  createdAt: Timestamp;
}
```

## Project & Document Collections

### projects/{id}/masterDocuments

```typescript
{
  id: string;
  documentNumber: string;
  documentTitle: string;
  currentRevision: string;
  status: string;             // State machine managed
  lastSubmissionDate?: Timestamp;
  createdAt: Timestamp;
}
```

### projects/{id}/transmittals

```typescript
{
  id: string;
  transmittalNumber: string;
  documentIds: string[];
  status: string;
  zipFileUrl?: string;
  transmittalPdfUrl?: string;
  createdAt: Timestamp;
}
```

## Flow Collections

### manualTasks

```typescript
{
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  createdBy: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Timestamp;
  createdAt: Timestamp;
}
```

### meetingMinutes

```typescript
{
  id: string;
  title: string;
  date: Timestamp;
  attendees: string[];
  items: MeetingItem[];       // Description, action, responsible, due date
  status: 'DRAFT' | 'FINALIZED';
  createdAt: Timestamp;
}
```

## Security Rules

See `firestore.rules` (1,826 lines) for collection-level security.

Key patterns:

- **Bitwise permission checks** using modulo arithmetic (no bitwise operators in rules)
- **Owner-based access** for personal data (leave requests, expenses, tasks)
- **Permission-based access** for module data (VIEW*\* for read, MANAGE*\* for write)
- **Super admin override** for all collections
- **Custom claims optimization** — user data in `request.auth.token`, no Firestore reads in rules
- **Project assignment checks** via `assignedProjects` custom claim

## Cloud Function Triggers

| Trigger                 | Collection   | Purpose                                                      |
| ----------------------- | ------------ | ------------------------------------------------------------ |
| `onTransactionWrite`    | transactions | Recalculate account balances (debit, credit, currentBalance) |
| `onUserUpdate`          | users        | Sync permissions, domain, entityId to auth custom claims     |
| `onEntityNameChange`    | entities     | Sync vendor/customer names to 6 collections                  |
| `onProjectNameChange`   | projects     | Sync project names/codes to 10 collections                   |
| `onEquipmentNameChange` | equipment    | Sync equipment names/tags to documents and PR items          |

## Indexes

271 composite indexes in `firestore.indexes.json`. Every `where()` + `orderBy()` combination MUST have an index — queries silently fail in production without them.
