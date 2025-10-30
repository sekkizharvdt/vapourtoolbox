# VDT Unified Platform - Unified Data Model

**Version:** 1.0
**Date:** October 27, 2025
**Status:** Proposal for Implementation

---

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [Core Modules](#core-modules)
3. [Application Modules](#application-modules)
4. [Firestore Database Structure](#firestore-database-structure)
5. [Type Definitions](#type-definitions)

---

## Architecture Principles

### 1. Module Independence
- Each module is a **standalone package** with its own types, services, and components
- Modules communicate through **well-defined interfaces**
- Core modules provide shared functionality to application modules

### 2. Single Source of Truth
- **One User model** across all applications
- **One Entity model** for vendors/customers/partners
- **One Project model** as the foundation
- Module-specific data in **subcollections** or **separate collections**

### 3. Data Ownership
```
Core Modules (Foundation)
├── User Management → owns /users, /user-roles
├── Entity Management → owns /entities, /entity-documents
├── Project Management → owns /projects, /project-activities
└── Company Management → owns /companies, /departments

Application Modules (Build on Core)
├── Accounting → owns /transactions, /accounts, /currencies
├── Procurement → owns /requirements, /rfqs, /pos, /offers
├── Time Tracking → owns /tasks, /timeEntries, /leaves
└── Estimation → owns /estimates, /equipment, /components
```

### 4. Firebase Custom Claims for Permissions
- Roles stored in **Firebase ID token** (not database)
- Updated by **Cloud Functions only**
- Zero database reads for permission checks
- Fast, secure, cost-effective

---

## Core Modules

### Module 1: User Management

**Location:** `packages/user-management/`

#### User Model (Unified)

```typescript
// packages/user-management/types/index.ts

import { Timestamp } from 'firebase/firestore';

export interface User {
  // ============================================
  // IDENTITY (Firebase Auth)
  // ============================================
  uid: string;  // ✅ Firebase UID (standard)
  email: string;
  emailVerified: boolean;
  photoURL?: string;

  // ============================================
  // PROFILE INFORMATION
  // ============================================
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;  // ISO 3166-1 alpha-2

  // ============================================
  // ORGANIZATION STRUCTURE
  // ============================================
  companyId?: string;  // For multi-company support
  department?: Department;
  jobTitle?: string;
  employeeId?: string;  // Company employee number

  // ============================================
  // ACCESS CONTROL
  // ============================================
  roles: UserRole[];  // ✅ ARRAY for multi-role support

  // NOTE: Permissions are stored in Firebase Custom Claims
  // Access via: request.auth.token.permissions
  // Updated by Cloud Functions only

  // ============================================
  // PROJECT ACCESS (for project-based modules)
  // ============================================
  assignedProjects?: string[];  // Project IDs for quick filtering

  // ============================================
  // STATUS & METADATA
  // ============================================
  status: UserStatus;
  isActive: boolean;  // Quick check flag

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdAt: Timestamp;
  createdBy?: string;
  updatedAt: Timestamp;
  updatedBy?: string;
  lastLoginAt?: Timestamp;

  // ============================================
  // INVITATION FLOW
  // ============================================
  invitedBy?: string;
  invitedAt?: Timestamp;

  // ============================================
  // MODULE-SPECIFIC EXTENSIONS
  // ============================================
  metadata?: Record<string, any>;  // Flexible extension point
}

// ============================================
// USER ROLES (Company-Wide)
// ============================================

export type UserRole =
  // Core Leadership
  | 'DIRECTOR'
  | 'HR_ADMIN'
  | 'PROJECT_MANAGER'

  // Engineering
  | 'ENGINEER'
  | 'ENGINEERING_HEAD'
  | 'SITE_ENGINEER'

  // Finance/Accounting
  | 'ACCOUNTANT'
  | 'ADMIN'

  // Procurement
  | 'PROCUREMENT_MANAGER'
  | 'PROCUREMENT_COORDINATOR'

  // External
  | 'CLIENT_PM'
  | 'CLIENT_VIEWER'
  | 'VENDOR'

  // Extensibility
  | 'CUSTOM';

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export type Department =
  | 'Engineering'
  | 'Procurement'
  | 'Project Management'
  | 'HR & Admin'
  | 'Finance'
  | '3D Printing'
  | 'Design'
  | 'Sales';

// ============================================
// PERMISSIONS (stored in Custom Claims)
// ============================================

export interface Permission {
  resource: string;  // 'users', 'projects', 'timesheets', 'transactions'
  actions: PermissionAction[];
  scope?: PermissionScope;
}

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export';

export interface PermissionScope {
  type: 'all' | 'own' | 'department' | 'project' | 'team' | 'custom';
  filter?: Record<string, any>;
}

// ============================================
// PROJECT ASSIGNMENT
// ============================================

export interface ProjectAssignment {
  projectId: string;
  projectRole: string;  // Module-specific role
  assignedBy: string;
  assignedAt: Timestamp;
  allocation?: number;  // Percentage (0-100)
  startDate?: Timestamp;
  endDate?: Timestamp;
  lastAccess?: Timestamp;
}
```

#### Firebase Custom Claims Structure

```typescript
// Stored in Firebase ID Token (not Firestore!)
interface CustomClaims {
  roles: UserRole[];
  department: Department;
  permissions: {
    [resource: string]: {
      actions: PermissionAction[];
      scope: PermissionScope;
    };
  };
  isActive: boolean;
  claimsSetAt: number;  // Timestamp
}

// Access in security rules:
// request.auth.token.roles
// request.auth.token.permissions
```

---

### Module 2: Entity Management

**Location:** `packages/entity-management/`

#### Entity Model (Unified)

```typescript
// packages/entity-management/types/index.ts

export interface BusinessEntity {
  // ============================================
  // CORE IDENTITY
  // ============================================
  id: string;
  code: string;  // Auto-generated: ENT-001, ENT-002, ...

  // ============================================
  // BASIC INFORMATION (All REQUIRED)
  // ============================================
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  phoneCountryCode: string;  // ISO 3166-1 alpha-2 ('IN', 'US', 'GB')
  address: string;

  // ============================================
  // ENTITY CLASSIFICATION
  // ============================================
  roles: EntityRole[];  // Can be multiple (VENDOR + CUSTOMER)
  status: EntityStatus;

  // ============================================
  // ADDRESS DETAILS (Optional)
  // ============================================
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  // ============================================
  // TAX IDENTIFIERS (Region-Specific, Optional)
  // ============================================
  taxIdentifiers?: TaxIdentifiers;

  // ============================================
  // BANKING DETAILS (Optional)
  // ============================================
  bankDetails?: BankDetails;

  // ============================================
  // FINANCIAL TRACKING
  // ============================================
  openingBalance: number;
  currentBalance: number;
  creditLimit?: number;
  paymentTermsDays?: number;  // Net 30, Net 60, etc.

  // ============================================
  // METADATA
  // ============================================
  tags?: string[];
  notes?: string;
  website?: string;
  linkedInProfile?: string;

  // ============================================
  // DOCUMENT ATTACHMENTS
  // ============================================
  documents?: EntityDocument[];

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;

  // ============================================
  // SOFT DELETE
  // ============================================
  deletedAt?: Timestamp;
  deletedBy?: string;
  isDeleted: boolean;
}

// ============================================
// SUPPORTING TYPES
// ============================================

export type EntityRole =
  | 'VENDOR'
  | 'CUSTOMER'
  | 'EMPLOYEE'
  | 'PARTNER'
  | 'CONTRACTOR';

export type EntityStatus =
  | 'POTENTIAL'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'BLACKLISTED';

export interface TaxIdentifiers {
  // India
  gstin?: string;  // GST Identification Number
  pan?: string;    // Permanent Account Number
  tan?: string;    // Tax Deduction Account Number

  // International
  vat?: string;    // EU Value Added Tax
  ein?: string;    // US Employer Identification Number
  abn?: string;    // Australia Business Number
  gst?: string;    // Generic GST for other countries

  // Custom (extensible)
  [key: string]: string | undefined;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankBranch?: string;

  // International codes
  swiftCode?: string;   // International
  ifscCode?: string;    // India
  iban?: string;        // Europe
  routingNumber?: string;  // US
  sortCode?: string;    // UK
  bsb?: string;         // Australia

  // Account type
  accountType?: 'SAVINGS' | 'CURRENT' | 'CHECKING';
}

export interface EntityDocument {
  id: string;
  type: EntityDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
  expiryDate?: Timestamp;  // For certificates/licenses
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
}

export type EntityDocumentType =
  | 'GST_CERTIFICATE'
  | 'PAN_CARD'
  | 'TAN_CERTIFICATE'
  | 'MSME_CERTIFICATE'
  | 'BANK_STATEMENT'
  | 'CANCELLED_CHEQUE'
  | 'TRADE_LICENSE'
  | 'INCORPORATION_CERTIFICATE'
  | 'CONTRACT'
  | 'NDA'
  | 'OTHER';
```

---

### Module 3: Project Management

**Location:** `packages/project-management/`

#### Project Model (Unified)

```typescript
// packages/project-management/types/index.ts

export interface Project {
  // ============================================
  // CORE IDENTITY
  // ============================================
  id: string;
  code: string;  // Project code/number (e.g., "SP40", "CRA-2024-001")
  name: string;
  description?: string;

  // ============================================
  // ORGANIZATION STRUCTURE
  // ============================================
  companyId?: string;  // For multi-company support
  departmentIds: string[];  // Multi-department projects

  // ============================================
  // CLIENT INFORMATION
  // ============================================
  clientEntityId?: string;  // Reference to BusinessEntity
  clientName?: string;  // Cached for display
  clientContactPerson?: string;
  location?: string;

  // ============================================
  // TEAM STRUCTURE
  // ============================================
  managerId: string;  // Project manager/director
  teamMembers: TeamMember[];

  // ============================================
  // STATUS & LIFECYCLE
  // ============================================
  status: ProjectStatus;
  startDate: Timestamp;
  endDate?: Timestamp;
  deadline?: Timestamp;
  actualCompletionDate?: Timestamp;

  // ============================================
  // BUDGET & ESTIMATION
  // ============================================
  budget?: Money;
  estimatedHours?: number;
  estimatedCost?: Money;

  // ============================================
  // ACCESS CONTROL
  // ============================================
  visibility: ProjectVisibility;
  collaborators?: ProjectCollaborator[];

  // ============================================
  // REVISION CONTROL
  // ============================================
  revisionNumber?: number;
  revisionHistory?: ProjectRevision[];

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;
  archivedAt?: Timestamp;
  archivedBy?: string;

  // ============================================
  // SOFT DELETE
  // ============================================
  deletedAt?: Timestamp;
  deletedBy?: string;
  markedForDeletion?: boolean;
  isDeleted: boolean;

  // ============================================
  // ACTIVITY TRACKING
  // ============================================
  lastActivityAt?: Timestamp;
  lastActivityBy?: string;

  // ============================================
  // FLEXIBLE METADATA
  // ============================================
  metadata?: Record<string, any>;
}

// ============================================
// SUPPORTING TYPES
// ============================================

export type ProjectStatus =
  | 'proposal'        // Pre-sale phase
  | 'draft'          // Being planned
  | 'active'         // Currently executing
  | 'under-review'   // Awaiting approval
  | 'approved'       // Approved to proceed
  | 'on-hold'        // Temporarily paused
  | 'completed'      // Successfully delivered
  | 'archived'       // Historical project
  | 'cancelled';     // Terminated

export type ProjectVisibility =
  | 'private'        // Owner only
  | 'team'           // Team members only
  | 'department'     // Department-wide
  | 'organization'   // Company-wide
  | 'client';        // Shared with client

export interface TeamMember {
  userId: string;
  role: string;  // Project-specific role
  department?: Department;
  joinedAt: Timestamp;
  leftAt?: Timestamp;
  allocation?: number;  // Percentage (0-100)
  isActive: boolean;
}

export interface Money {
  amount: number;
  currency: Currency;  // ISO 4217 currency code
}

export type Currency =
  | 'INR'  // Indian Rupee
  | 'USD'  // US Dollar
  | 'EUR'  // Euro
  | 'GBP'  // British Pound
  | 'AED'  // UAE Dirham
  | 'SGD'  // Singapore Dollar
  | 'JPY'; // Japanese Yen

export interface ProjectCollaborator {
  userId: string;
  role: ProjectRole;  // 'owner', 'reviewer', 'approver', 'viewer'
  permissions: ProjectPermission[];
  assignedBy: string;
  assignedAt: Timestamp;
  lastAccess?: Timestamp;
}

export type ProjectRole = 'owner' | 'reviewer' | 'approver' | 'viewer' | 'contributor';

export type ProjectPermission =
  | 'canView'
  | 'canEdit'
  | 'canDelete'
  | 'canManageCollaborators'
  | 'canApprove'
  | 'canExport'
  | 'canChangeStatus';

export interface ProjectRevision {
  revisionNumber: number;
  createdDate: Timestamp;
  createdBy: string;
  description: string;
  changes: Record<string, any>;
  snapshot?: any;
}
```

---

## Application Modules

### Module 4: Accounting Module

**Location:** `packages/accounting/`

#### Transaction Model

```typescript
// packages/accounting/types/index.ts

export interface Transaction {
  // ============================================
  // CORE IDENTITY
  // ============================================
  id: string;
  type: TransactionType;
  transactionNumber: string;  // Auto-generated
  date: Timestamp;

  // ============================================
  // PROJECT & ENTITY LINKAGE
  // ============================================
  projectId?: string;  // Optional - some transactions are company-wide
  entityId?: string;   // Link to BusinessEntity (vendor/customer)
  entityRole?: EntityRole;  // How entity participated in transaction

  // ============================================
  // FINANCIAL DETAILS
  // ============================================
  description: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount: number;  // Amount in base currency

  // ============================================
  // DOUBLE-ENTRY ACCOUNTING
  // ============================================
  entries: LedgerEntry[];  // Must balance (debit = credit)

  // ============================================
  // TAX DETAILS
  // ============================================
  gstDetails?: GSTDetails;
  tdsDetails?: TDSDetails;

  // ============================================
  // WORKFLOW
  // ============================================
  status: TransactionStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // ============================================
  // REFERENCES
  // ============================================
  referenceNumber?: string;  // External reference
  dueDate?: Timestamp;
  paymentDate?: Timestamp;

  // ============================================
  // BANK RECONCILIATION
  // ============================================
  reconciledBankAccountId?: string;
  reconciledDate?: Timestamp;
  reconciledBy?: string;

  // ============================================
  // DOCUMENT ATTACHMENTS
  // ============================================
  attachments: string[];  // Document IDs

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
  postedAt?: Timestamp;
  postedBy?: string;
}

export type TransactionType =
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'PAYMENT_VOUCHER'
  | 'RECEIPT_VOUCHER'
  | 'JOURNAL_ENTRY'
  | 'BANK_TRANSFER'
  | 'INTER_PROJECT_TRANSFER';

export type TransactionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'CANCELLED';

export interface LedgerEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  projectId?: string;  // For project-wise accounting
}

export interface GSTDetails {
  gstType: 'CGST_SGST' | 'IGST';
  taxableAmount: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalGST: number;
  hsnCode?: string;  // For goods
  sacCode?: string;  // For services
}

export interface TDSDetails {
  tdsRate: number;
  tdsAmount: number;
  section: string;  // e.g., "194C", "194J"
}
```

---

### Module 5: Procurement Module

**Location:** `packages/procurement/`

#### Requirement (Purchase Request) Model

```typescript
// packages/procurement/types/index.ts

export interface Requirement {
  // ============================================
  // CORE IDENTITY
  // ============================================
  id: string;
  projectId: string;  // Always linked to project
  type: RequirementType;

  // ============================================
  // ITEMS
  // ============================================
  items: RequirementItem[];
  notes?: string;

  // ============================================
  // WORKFLOW STATUS
  // ============================================
  status: RequirementStatus;

  // ============================================
  // FILE ATTACHMENT
  // ============================================
  uploadedFile?: DocumentRef;

  // ============================================
  // SUBMISSION TRACKING
  // ============================================
  submittedAt?: Timestamp;
  submittedBy?: string;

  // ============================================
  // ENGINEERING HEAD APPROVAL
  // ============================================
  approvedAt?: Timestamp;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;

  // ============================================
  // DIRECTOR APPROVAL
  // ============================================
  directorApprovedAt?: Timestamp;
  directorApprovedBy?: string;
  directorRejectedAt?: Timestamp;
  directorRejectionReason?: string;

  // ============================================
  // CONVERSION TRACKING
  // ============================================
  convertedToRFQId?: string;
  convertedAt?: Timestamp;
  convertedBy?: string;

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type RequirementType = 'internal' | 'budgetary' | 'project';

export type RequirementStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'converted';

export interface RequirementItem {
  id: string;
  name: string;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  category: ItemCategory;
  notes?: string;
  attachment?: DocumentRef;
  preferredVendorId?: string;
  preferredVendorName?: string;
}

export type ItemCategory = 'services' | 'raw_material' | 'bought_outs';

export interface DocumentRef {
  bucket: string;
  path: string;
  name: string;
  url?: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}
```

---

### Module 6: Time Tracking Module

**Location:** `packages/time-tracking/`

#### Task Model

```typescript
// packages/time-tracking/types/index.ts

export interface Task {
  // ============================================
  // CORE IDENTITY
  // ============================================
  id: string;
  userId: string;  // Assignee
  title: string;
  description?: string;

  // ============================================
  // PROJECT LINKAGE
  // ============================================
  projectId: string;  // ✅ Always linked to project
  workArea: WorkArea;

  // ============================================
  // TASK DETAILS
  // ============================================
  priority: TaskPriority;
  status: TaskStatus;
  parentTaskId?: string;  // For sub-tasks
  deadline?: Timestamp;
  estimatedHours?: number;

  // ============================================
  // TIME TRACKING
  // ============================================
  totalCompletedTime?: number;  // Total seconds
  lastTimeUpdate?: Timestamp;

  // ============================================
  // FORMAL ACCEPTANCE FLOW (UNIQUE!)
  // ============================================
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  declinedAt?: Timestamp;
  declineReason?: string;

  // ============================================
  // AUDIT TRAIL
  // ============================================
  createdAt: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;

  // ============================================
  // SOFT DELETE WITH REASON
  // ============================================
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: string;

  // ============================================
  // TEAM VIEW FIELDS (added dynamically)
  // ============================================
  assignedUserName?: string;
  assignedUserEmail?: string;
}

export type WorkArea =
  | 'PROPOSAL'       // Pre-sale activities
  | 'DESIGN'         // Engineering design
  | 'PROCUREMENT'    // Vendor sourcing
  | 'PROJECT_MGMT'   // Coordination
  | 'ENGINEERING'    // Technical work
  | 'ACCOUNTS'       // Financial tasks
  | '3D_PRINTING'    // Fabrication
  | 'OTHER';         // Miscellaneous

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskStatus =
  | 'pending_acceptance'  // ✅ Unique: Awaiting assignee acceptance
  | 'todo'
  | 'in-progress'
  | 'completed';

export interface TimeEntry {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  workArea: WorkArea;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration: number;  // Milliseconds
  description?: string;
  isActive: boolean;
  source: TimeEntrySource;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type TimeEntrySource =
  | 'timer'      // From active timer
  | 'on_duty'    // From approved on-duty record
  | 'manual';    // Manually entered

export interface LeaveApplication {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: Timestamp;
  endDate: Timestamp;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type LeaveType = 'casual' | 'sick' | 'emergency';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface OnDutyRecord {
  id: string;
  userId: string;
  date: Timestamp;
  projectId: string;
  location: string;
  description: string;
  status: OnDutyStatus;
  hoursAllocated: number;  // Default 8
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  timeEntryId?: string;  // ✅ Auto-generated on approval
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type OnDutyStatus = 'pending' | 'approved' | 'rejected';
```

---

## Firestore Database Structure

### Unified Firebase Project

```
/databases/unified-vdt-platform/
├── ============================================
├── CORE MODULES
├── ============================================
├── /users/{userId}
│   ├── uid: string
│   ├── email: string
│   ├── displayName: string
│   ├── roles: UserRole[]
│   ├── department: Department
│   ├── status: UserStatus
│   └── ... (see User model)
│
├── /user-roles/{email}  # Functions-only write
│   ├── roles: UserRole[]
│   ├── permissions: Permission[]
│   └── updatedAt: Timestamp
│
├── /entities/{entityId}
│   ├── code: string
│   ├── name: string
│   ├── roles: EntityRole[]
│   └── ... (see Entity model)
│
├── /projects/{projectId}
│   ├── code: string
│   ├── name: string
│   ├── managerId: string
│   ├── teamMembers: TeamMember[]
│   ├── status: ProjectStatus
│   └── ... (see Project model)
│
├── /companies/{companyId}
│   ├── name: string
│   ├── legalName: string
│   └── ... (company details)
│
├── /departments/{deptId}
│   ├── name: string
│   ├── parentDeptId?: string
│   └── ... (department structure)
│
├── ============================================
├── APPLICATION MODULES
├── ============================================
├── /transactions/{txnId}  # Accounting
│   ├── type: TransactionType
│   ├── projectId?: string
│   ├── entityId?: string
│   ├── entries: LedgerEntry[]
│   └── ... (see Transaction model)
│
├── /accounts/{accountId}  # Accounting
│   ├── code: string
│   ├── name: string
│   ├── type: AccountType
│   └── ... (chart of accounts)
│
├── /requirements/{reqId}  # Procurement
│   ├── projectId: string
│   ├── items: RequirementItem[]
│   ├── status: RequirementStatus
│   └── ... (see Requirement model)
│
├── /rfqs/{rfqId}  # Procurement
│   ├── projectId: string
│   ├── requirementId: string
│   └── ... (RFQ details)
│
├── /pos/{poId}  # Procurement
│   ├── projectId: string
│   ├── vendorId: string
│   └── ... (PO details)
│
├── /tasks/{taskId}  # Time Tracking
│   ├── userId: string
│   ├── projectId: string
│   ├── workArea: WorkArea
│   ├── status: TaskStatus
│   └── ... (see Task model)
│
├── /timeEntries/{entryId}  # Time Tracking
│   ├── userId: string
│   ├── taskId: string
│   ├── duration: number
│   └── ... (see TimeEntry model)
│
├── /leaveApplications/{leaveId}  # Time Tracking
│   ├── userId: string
│   ├── leaveType: LeaveType
│   └── ... (see LeaveApplication model)
│
├── /onDutyRecords/{recordId}  # Time Tracking
│   ├── userId: string
│   ├── projectId: string
│   └── ... (see OnDutyRecord model)
│
├── /estimates/{estimateId}  # Estimation
│   ├── projectId: string
│   ├── equipment: Equipment[]
│   └── ... (estimation details)
│
├── ============================================
├── MODULE-SPECIFIC STATS (Subcollections)
├── ============================================
├── /projects/{projectId}/procurement_stats/summary
│   ├── rfqs: number
│   ├── pos: number
│   ├── spend: number
│   └── deliveryPct: number
│
├── /projects/{projectId}/time_stats/summary
│   ├── totalHours: number
│   ├── tasksCompleted: number
│   └── teamMemberCount: number
│
├── /projects/{projectId}/accounting_stats/summary
│   ├── revenue: number
│   ├── expenses: number
│   └── profit: number
│
├── /projects/{projectId}/activities/{activityId}
│   ├── action: string
│   ├── userId: string
│   ├── timestamp: Timestamp
│   └── details: Record<string, any>
│
├── ============================================
├── SYSTEM COLLECTIONS
├── ============================================
├── /auditLogs/{logId}  # Immutable
│   ├── userId: string
│   ├── action: string
│   ├── resource: string
│   ├── changes: Record<string, any>
│   └── timestamp: Timestamp
│
└── /_metadata/{document}  # Functions-only write
    ├── entityCounter: number
    ├── transactionCounter: number
    └── ... (auto-increment counters)
```

---

## Summary

### ✅ What This Achieves

1. **Single User Model** - All apps use the same user structure
2. **Single Entity Model** - Vendors/customers shared across modules
3. **Single Project Model** - Foundation for all work
4. **Module Independence** - Each module owns its data
5. **Zero Permission Overhead** - Custom Claims = no DB reads
6. **Extensible** - Metadata fields for future needs
7. **Type Safe** - TypeScript interfaces for everything

### 📦 Package Structure

```
packages/
├── core/
│   ├── types/           # Shared types
│   ├── constants/       # Shared constants
│   └── validation/      # Shared validation
├── user-management/
│   ├── types/
│   ├── services/
│   └── components/
├── entity-management/
│   ├── types/
│   ├── services/
│   └── components/
├── project-management/
│   ├── types/
│   ├── services/
│   └── components/
├── accounting/
│   ├── types/
│   ├── services/
│   └── components/
├── procurement/
│   ├── types/
│   ├── services/
│   └── components/
├── time-tracking/
│   ├── types/
│   ├── services/
│   └── components/
└── estimation/
    ├── types/
    ├── services/
    └── components/
```

---

**Status:** Unified Data Model Complete
**Next:** Modular Architecture Design & Implementation Roadmap
