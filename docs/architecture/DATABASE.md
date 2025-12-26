# Database Schema

Firestore collections and their structure.

## Core Collections

### users

User accounts and permissions.

```typescript
{
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  roles: string[];
  permissions: number;        // Bitwise flags
  permissions2: number;       // Extended flags
  departmentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### entities

Companies, vendors, customers.

```typescript
{
  id: string;
  name: string;
  type: 'VENDOR' | 'CUSTOMER' | 'BOTH';
  gstNumber?: string;
  panNumber?: string;
  addresses: Address[];
  contacts: Contact[];
  bankDetails?: BankDetails[];
  isActive: boolean;
  createdAt: Timestamp;
}
```

## Procurement Collections

### purchaseRequests

```typescript
{
  id: string;
  prNumber: string;           // PR-2025-0001
  projectId?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  items: PRItem[];
  requestedBy: string;
  approvedBy?: string;
  createdAt: Timestamp;
}
```

### rfqs

Request for quotations.

```typescript
{
  id: string;
  rfqNumber: string;          // RFQ-2025-0001
  purchaseRequestId?: string;
  vendorIds: string[];
  items: RFQItem[];
  status: 'DRAFT' | 'SENT' | 'CLOSED';
  dueDate: Timestamp;
  createdAt: Timestamp;
}
```

### purchaseOrders

```typescript
{
  id: string;
  poNumber: string;           // PO-2025-0001
  vendorId: string;
  rfqId?: string;
  offerId?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED' | 'COMPLETED' | 'CANCELLED';
  items: POItem[];
  currency: string;
  totalAmount: number;
  createdAt: Timestamp;
}
```

### goodsReceipts

```typescript
{
  id: string;
  grnNumber: string;          // GRN-2025-0001
  purchaseOrderId: string;
  items: GRNItem[];
  receivedBy: string;
  receivedAt: Timestamp;
  createdAt: Timestamp;
}
```

## Accounting Collections

### accounts

Chart of accounts.

```typescript
{
  id: string;
  code: string;               // 1000, 2000, etc.
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
  isActive: boolean;
  createdAt: Timestamp;
}
```

### transactions

General ledger entries.

```typescript
{
  id: string;
  transactionNumber: string;  // TXN-2025-0001
  date: Timestamp;
  description: string;
  entries: JournalEntry[];    // Debits and credits
  sourceType?: 'BILL' | 'PAYMENT' | 'INVOICE' | 'MANUAL';
  sourceId?: string;
  createdAt: Timestamp;
}
```

### bankReconciliations

```typescript
{
  id: string;
  bankAccountId: string;
  statementDate: Timestamp;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  items: ReconciliationItem[];
  createdAt: Timestamp;
}
```

## HR Collections

### hrLeaveRequests

```typescript
{
  id: string;
  requestNumber: string;      // LR-2025-0001
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
  reportNumber: string;       // TE-2025-0001
  employeeId: string;
  tripPurpose: string;
  tripStartDate: Timestamp;
  tripEndDate: Timestamp;
  destinations: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  items: ExpenseItem[];
  totalAmount: number;
  createdAt: Timestamp;
}
```

## Document Collections

### documents

Project/entity documents.

```typescript
{
  id: string;
  documentNumber: string;
  title: string;
  projectId?: string;
  entityId?: string;
  type: 'DRAWING' | 'SPEC' | 'REPORT' | 'OTHER';
  status: 'DRAFT' | 'FOR_REVIEW' | 'APPROVED' | 'SUPERSEDED';
  currentRevision: string;
  filePath: string;
  createdAt: Timestamp;
}
```

### folders

Document folder hierarchy.

```typescript
{
  id: string;
  name: string;
  parentId?: string;
  projectId?: string;
  createdAt: Timestamp;
}
```

## Indexes

Key composite indexes defined in `firestore.indexes.json`:

```
purchaseOrders: (projectId, status, createdAt DESC)
purchaseOrders: (vendorId, status, createdAt DESC)
transactions: (date DESC, createdAt DESC)
hrLeaveRequests: (employeeId, status, createdAt DESC)
hrTravelExpenses: (employeeId, status, createdAt DESC)
```

## Security Rules

See `firestore.rules` for collection-level security.

Key patterns:

- Owner-based access for personal data (leave requests, expenses)
- Permission-based access for module data
- Super admin override for all collections
