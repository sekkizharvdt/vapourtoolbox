# VDT Unified Platform - Codebase Analysis Part 2

**Analysis Date:** October 27, 2025
**Focus:** Time Tracker, Estimate Apps & Complete User/Entity Management Comparison

---

## Complete User Management Comparison

### Understanding: User Management Will Be A Separate Module ✅

Based on your guidance, User Management is a **core shared module**. Here's how each app currently handles it:

### 1. Accounting App - User Model

```typescript
// vdt-accounting/src/types/index.ts:2-12
export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'PROJECT_MANAGER' | 'DIRECTOR';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;  // SINGLE string
  createdAt: Date;
  updatedAt: Date;
}
```

**Characteristics:**
- ✅ Simple model
- ❌ Only 4 roles (accounting-focused)
- ❌ Single role per user (no multi-role support)
- ❌ No departments
- ❌ No project assignments
- ❌ No permissions structure

---

### 2. Procure App - User Model

```typescript
// VDT-Procure/src/types/index.ts:4-27
export type UserRole =
  | 'engineer'
  | 'engineering_head'
  | 'procurement_manager'
  | 'project_manager'
  | 'accountant'
  | 'site_engineer'
  | 'director'
  | 'client_pm';  // 8 roles (procurement workflow)

export interface User {
  uid: string;  // ❌ Different from Accounting's 'id'
  email: string;
  displayName?: string;
  roles: UserRole[];  // ✅ ARRAY - multi-role support!
  domains: string[];  // Email domain whitelist
  assignedProjects: string[];  // Project access control
  status?: 'active' | 'inactive' | 'pending';
  invitedBy?: string;
  invitedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Characteristics:**
- ✅ Multi-role support (array)
- ✅ Project-based access control
- ✅ Status management
- ✅ Invitation tracking
- ❌ Still procurement-focused roles
- ❌ No department field
- ❌ Field name inconsistency (uid vs id)

---

### 3. Time Tracker (Dashboard) - User Model

```typescript
// VDT-Dashboard/src/contexts/AuthContext.tsx:15-30
export interface UserProfile {
  uid: string;  // Matches Procure, not Accounting
  email: string;
  name: string;  // Different from 'displayName'
  role: 'DIRECTOR' | 'HR_ADMIN' | 'TEAM_MEMBER';  // SINGLE string
  department: string;  // ✅ Has departments!
  isActive: boolean;
  createdAt: any;
  permissions: {  // ✅ Granular permissions!
    canGenerateTimesheets: boolean;
    canViewAllProjects: boolean;
    canManageUsers: boolean;
    canAssignProjects: boolean;
  }
}
```

**Characteristics:**
- ✅ Has departments (Engineering, Procurement, etc.)
- ✅ Explicit permission structure
- ✅ Three clear roles (DIRECTOR, HR_ADMIN, TEAM_MEMBER)
- ✅ isActive flag
- ❌ Single role only
- ❌ No project assignments
- ✅ Uses Firebase Custom Claims for security

**IMPORTANT:** Time Tracker uses **Firebase Custom Claims** for role/permission storage:
```typescript
// Roles stored in Firebase ID token
const customClaims = idTokenResult.claims;
// { role, department, permissions, isActive }
```

---

### 4. Estimate App - User Model

```typescript
// Vdt-Estimate/src/types/rbac.ts:59-70
export interface UserProfile {
  uid: string;  // Matches Procure & Time Tracker
  email: string;
  displayName: string;
  photoURL?: string;
  department?: string;  // Optional department
  title?: string;  // Job title
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Plus Project-Level Roles:**
```typescript
export type ProjectRole = 'owner' | 'reviewer' | 'approver' | 'viewer';

export interface ProjectCollaborator {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: ProjectRole;  // Per-project role
  assignedBy: string;
  assignedDate: string;
  lastAccess?: string;
}
```

**Characteristics:**
- ✅ No global roles - uses project-level permissions instead!
- ✅ Collaborative project model
- ✅ Department support
- ✅ Job title field
- ✅ Last login tracking
- ✅ Photo URL support
- ❌ No global role/permission system
- ❌ Different approach from other apps

---

## User Management Module - Unified Proposal

### Core Principle: **Separation of Concerns**

User Management should be a **standalone core module** that other modules consume.

### Unified User Model

```typescript
// Proposed: packages/user-management/types/index.ts

export interface User {
  // Identity (Firebase Auth)
  uid: string;  // ✅ Firebase UID (standard across Firebase)
  email: string;
  emailVerified: boolean;
  photoURL?: string;

  // Profile Information
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;

  // Organization Structure
  department?: string;  // Engineering, Procurement, HR & Admin, Finance, etc.
  jobTitle?: string;  // Engineer, Manager, Director, etc.
  employeeId?: string;  // Company employee number

  // Access Control
  roles: UserRole[];  // ✅ ARRAY for multi-role support
  globalPermissions: Permission[];  // System-wide permissions

  // Project Access (for project-based modules)
  projectAssignments?: ProjectAssignment[];

  // Status & Metadata
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  isActive: boolean;  // Quick check flag

  // Audit Trail
  createdAt: Timestamp;
  createdBy?: string;
  updatedAt: Timestamp;
  updatedBy?: string;
  lastLoginAt?: Timestamp;

  // Invitation Flow
  invitedBy?: string;
  invitedAt?: Timestamp;

  // Module-Specific Extended Data
  metadata?: Record<string, any>;  // Flexible extension point
}

export type UserRole =
  // Core roles
  | 'DIRECTOR'
  | 'HR_ADMIN'
  | 'PROJECT_MANAGER'

  // Engineering roles
  | 'ENGINEER'
  | 'ENGINEERING_HEAD'
  | 'SITE_ENGINEER'

  // Finance/Accounting roles
  | 'ACCOUNTANT'
  | 'ADMIN'

  // Procurement roles
  | 'PROCUREMENT_MANAGER'
  | 'PROCUREMENT_COORDINATOR'

  // External roles
  | 'CLIENT_PM'
  | 'CLIENT_VIEWER'
  | 'VENDOR'

  // Generic role for custom extensions
  | 'CUSTOM';

export interface Permission {
  resource: string;  // 'users', 'projects', 'timesheets', 'transactions', etc.
  actions: PermissionAction[];
  scope?: PermissionScope;
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export interface PermissionScope {
  type: 'all' | 'own' | 'department' | 'project' | 'custom';
  filter?: Record<string, any>;
}

export interface ProjectAssignment {
  projectId: string;
  projectRole: string;  // Module-specific (e.g., Estimate's 'reviewer')
  assignedBy: string;
  assignedAt: Timestamp;
  lastAccess?: Timestamp;
}
```

### Role-Permission Matrix

```typescript
// Proposed: packages/user-management/config/permissions.ts

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  DIRECTOR: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'], scope: { type: 'all' } }
  ],

  HR_ADMIN: [
    { resource: 'users', actions: ['read', 'update'], scope: { type: 'all' } },
    { resource: 'leaves', actions: ['read', 'approve'], scope: { type: 'all' } },
    { resource: 'timesheets', actions: ['read', 'export'], scope: { type: 'all' } },
  ],

  ACCOUNTANT: [
    { resource: 'transactions', actions: ['create', 'read', 'update'], scope: { type: 'all' } },
    { resource: 'entities', actions: ['read', 'update'], scope: { type: 'all' } },
    { resource: 'invoices', actions: ['create', 'read', 'update', 'approve'], scope: { type: 'all' } },
  ],

  ENGINEER: [
    { resource: 'tasks', actions: ['create', 'read', 'update'], scope: { type: 'own' } },
    { resource: 'requirements', actions: ['create', 'read'], scope: { type: 'own' } },
    { resource: 'projects', actions: ['read'], scope: { type: 'project' } },
  ],

  // ... etc for all roles
};
```

---

## Entity Management Comparison

### Understanding: Entity Management Will Be A Separate Module ✅

**Good News:** Accounting and Procure already share nearly identical BusinessEntity models!

### Current State

**Accounting (`vdt-accounting/src/types/index.ts:161-202`)**
```typescript
export interface BusinessEntity {
  id: string;
  code: string;  // ENT-001, ENT-002
  name: string;
  address: string;
  gstin: string;  // ❌ REQUIRED in Accounting
  roles: EntityRole[];  // ['VENDOR', 'CUSTOMER']
  status: EntityStatus;
  openingBalance: number;
  currentBalance: number;

  // Optional fields
  contactPerson?: string;  // ❌ Optional in Accounting
  email?: string;  // ❌ Optional in Accounting
  phoneCountryCode?: string;
  phone?: string;

  // Banking
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;

  // Metadata
  tags?: string[];
  notes?: string;

  createdAt: Date;  // ❌ JavaScript Date object
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

export type EntityRole = 'VENDOR' | 'CUSTOMER';
export type EntityStatus = 'POTENTIAL' | 'ACTIVE' | 'INACTIVE';
```

**Procure (`VDT-Procure/src/types/index.ts:37-86`)**
```typescript
export interface BusinessEntity {
  id: string;
  code: string;  // ENT-001, ENT-002

  // Required fields
  name: string;  // ✅ REQUIRED
  contactPerson: string;  // ✅ REQUIRED in Procure
  email: string;  // ✅ REQUIRED in Procure
  phoneCountryCode: string;  // ✅ REQUIRED
  phone: string;  // ✅ REQUIRED
  address: string;  // ✅ REQUIRED

  roles: EntityRole[];
  status: EntityStatus;
  openingBalance: number;
  currentBalance: number;

  // Optional fields
  gstin?: string;  // ❌ Optional in Procure
  pan?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  // Banking (optional)
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;

  // Metadata
  tags?: string[];
  notes?: string;

  createdAt: Timestamp;  // ✅ Firestore Timestamp
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;
}
```

### Key Differences

| Field | Accounting | Procure | Unified Proposal |
|-------|-----------|---------|------------------|
| `gstin` | Required | Optional | Optional (India-specific) |
| `contactPerson` | Optional | Required | Required |
| `email` | Optional | Required | Required |
| `phone` | Optional | Required | Required |
| `phoneCountryCode` | Optional | Required | Required |
| `createdAt` type | `Date` | `Timestamp` | `Timestamp` (Firebase standard) |

### Unified Entity Model

```typescript
// Proposed: packages/entity-management/types/index.ts

export interface BusinessEntity {
  // Core Identity
  id: string;
  code: string;  // Auto-generated: ENT-001, ENT-002, ...

  // Basic Information (All REQUIRED)
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  phoneCountryCode: string;  // ISO 3166-1 alpha-2 ('IN', 'US', 'GB')
  address: string;

  // Entity Classification
  roles: EntityRole[];  // Can be BOTH vendor and customer
  status: EntityStatus;

  // Address Details (Optional for flexibility)
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  // Tax Identifiers (Optional - region-specific)
  taxIdentifiers?: {
    gstin?: string;  // India GST
    pan?: string;  // India PAN
    vat?: string;  // EU VAT
    ein?: string;  // US EIN
    // ... extensible for other countries
  };

  // Banking Details (Optional)
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankBranch?: string;
    swiftCode?: string;  // International
    ifscCode?: string;  // India
    iban?: string;  // Europe
    routingNumber?: string;  // US
  };

  // Financial Tracking
  openingBalance: number;
  currentBalance: number;
  creditLimit?: number;
  paymentTermsDays?: number;  // Net 30, Net 60, etc.

  // Metadata
  tags?: string[];
  notes?: string;

  // Document Attachments
  documents?: EntityDocument[];

  // Audit Trail
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;

  // Soft Delete
  deletedAt?: Timestamp;
  deletedBy?: string;
  isDeleted: boolean;
}

export type EntityRole = 'VENDOR' | 'CUSTOMER' | 'EMPLOYEE' | 'PARTNER';
export type EntityStatus = 'POTENTIAL' | 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

export interface EntityDocument {
  id: string;
  type: 'GST_CERTIFICATE' | 'PAN_CARD' | 'MSME' | 'BANK_STATEMENT' | 'CONTRACT' | 'OTHER';
  fileName: string;
  fileUrl: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}
```

**Benefits of Unified Entity Model:**
- ✅ Works for Accounting (transactions, invoices)
- ✅ Works for Procurement (vendors, RFQs, POs)
- ✅ Works for HR (employee entities)
- ✅ Extensible tax identifiers (multi-country support)
- ✅ Extensible bank details (multi-country support)
- ✅ Document management built-in
- ✅ Soft delete support
- ✅ Credit limit and payment terms (accounting needs)

---

## Project Management Comparison

### 1. Accounting App

```typescript
export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  managerId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'ARCHIVED';
  startDate: Date;
  endDate?: Date;
  budget: number;
  budgetCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Procure App

```typescript
export interface Project {
  id: string;
  code: string;
  name: string;
  companyId: string;  // ✅ Company reference
  client: string;  // Legacy field
  clientDomains: string[];  // For client PM access
  status: 'active' | 'onHold' | 'completed' | 'cancelled';
  startDate: Timestamp;
  endDate?: Timestamp;
  stats: {  // ❌ Procurement-specific
    rfqs: number;
    pos: number;
    spend: number;
    deliveryPct: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### 3. Time Tracker App

```typescript
export interface Project {
  id: string;
  name: string;  // e.g., "SP40", "CRA Thermal Oxidiser"
  description?: string;
  status: 'proposal' | 'active' | 'completed' | 'on-hold' | 'archived';
  projectDirectorId: string;  // ✅ Project leader
  teamMembers: string[];  // ✅ Team assignment!
  departments: string[];  // ✅ Multi-department support!
  deadline?: Timestamp;
  estimatedHours?: number;  // ✅ Time tracking specific
  clientName?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  archivedAt?: Timestamp;
}
```

### 4. Estimate App

```typescript
export interface Project {
  id: string;
  name: string;
  description: string;
  client?: string;
  location?: string;
  projectNumber?: string;
  engineer?: string;
  reviewer?: string;
  createdDate: string;
  lastModified: string;
  revisionNumber: number;
  revisionHistory: ProjectRevision[];
  equipment: Equipment[];  // ❌ Estimate-specific
  configuration: Configuration;  // ❌ Estimate-specific
  calculations?: ProjectCalculations;  // ❌ Estimate-specific

  // RBAC
  ownerId: string;
  collaborators: ProjectCollaborator[];
  visibility: 'private' | 'organization';
  status: 'draft' | 'under-review' | 'approved' | 'archived' | 'deleted';
  activityLog?: ProjectActivity[];

  // Soft delete
  deletedAt?: string;
  markedForDeletion?: boolean;
  deletedBy?: UserProfile;
}
```

### Unified Project Model Proposal

```typescript
// Proposed: packages/core/types/Project.ts

export interface Project {
  // Core Identity
  id: string;
  code: string;  // Project code/number
  name: string;
  description?: string;

  // Organization Structure
  companyId?: string;  // For multi-company support
  departmentIds: string[];  // Multi-department projects

  // Client Information
  clientEntityId?: string;  // Reference to BusinessEntity
  clientName?: string;  // Cached for display
  location?: string;

  // Team Structure
  managerId: string;  // Project manager/director
  teamMembers: TeamMember[];

  // Status & Lifecycle
  status: ProjectStatus;
  startDate: Timestamp;
  endDate?: Timestamp;
  deadline?: Timestamp;

  // Budget & Estimation
  budget?: Money;
  estimatedHours?: number;

  // Access Control
  visibility: 'private' | 'team' | 'department' | 'organization' | 'client';
  collaborators?: ProjectCollaborator[];

  // Module-Specific Stats (in subcollections or computed)
  // stats will be computed from module data, not stored here

  // Revision Control
  revisionNumber?: number;
  revisionHistory?: ProjectRevision[];

  // Audit Trail
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;
  archivedAt?: Timestamp;
  archivedBy?: string;

  // Soft Delete
  deletedAt?: Timestamp;
  deletedBy?: string;
  isDeleted: boolean;

  // Activity Tracking
  activityLog?: ProjectActivity[];

  // Flexible Metadata
  metadata?: Record<string, any>;
}

export type ProjectStatus =
  | 'proposal'
  | 'draft'
  | 'active'
  | 'under-review'
  | 'approved'
  | 'on-hold'
  | 'completed'
  | 'archived'
  | 'cancelled';

export interface TeamMember {
  userId: string;
  role: string;  // Project-specific role
  department?: string;
  joinedAt: Timestamp;
  allocation?: number;  // Percentage (0-100)
}

export interface Money {
  amount: number;
  currency: string;  // ISO 4217 currency code
}

export interface ProjectCollaborator {
  userId: string;
  role: string;  // 'owner', 'reviewer', 'approver', 'viewer', etc.
  permissions: string[];
  assignedBy: string;
  assignedAt: Timestamp;
  lastAccess?: Timestamp;
}
```

---

## Module-Specific Stats Pattern

Instead of embedding module-specific stats in the Project model, use **computed aggregations** or **subcollections**:

### Firestore Structure:
```
/projects/{projectId}
  - Core project data (shared)

/projects/{projectId}/procurement_stats/summary
  - rfqs: 5
  - pos: 3
  - spend: 125000
  - deliveryPct: 80

/projects/{projectId}/time_stats/summary
  - totalHours: 240
  - tasksCompleted: 45
  - teamMemberCount: 6

/projects/{projectId}/estimate_stats/summary
  - equipmentCount: 3
  - totalWeight: 15000
  - totalCost: 500000

/projects/{projectId}/accounting_stats/summary
  - revenue: 1000000
  - expenses: 750000
  - profit: 250000
```

**Benefits:**
- ✅ Core project model stays clean
- ✅ Each module owns its own stats
- ✅ Stats computed independently
- ✅ Easy to add new modules
- ✅ No circular dependencies

---

## Time Tracker Specific Features

The Time Tracker has unique features worth preserving:

### 1. Task Management with Acceptance Flow

```typescript
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  projectId: string;  // ✅ Always linked to project
  workArea: WorkArea;  // ✅ Engineering workflow phases
  priority: 'high' | 'medium' | 'low';
  status: 'pending_acceptance' | 'todo' | 'in-progress' | 'completed';

  // ✅ UNIQUE: Formal acceptance tracking
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  declinedAt?: Timestamp;
  declineReason?: string;

  // ✅ Soft delete with reason
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: string;

  deadline?: Timestamp;
  estimatedHours?: number;
  totalCompletedTime?: number;
  createdBy?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export type WorkArea =
  | 'PROPOSAL'
  | 'DESIGN'
  | 'PROCUREMENT'
  | 'PROJECT_MGMT'
  | 'ENGINEERING'
  | 'ACCOUNTS'
  | '3D_PRINTING'
  | 'OTHER';
```

**✅ This is EXCELLENT** - the formal acceptance workflow prevents "task dumping"

### 2. Leave Management

```typescript
export interface LeaveApplication {
  id: string;
  userId: string;
  leaveType: 'casual' | 'sick';
  startDate: Timestamp;
  endDate: Timestamp;
  numberOfDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Timestamp;
  reviewedBy?: string;  // HR_ADMIN or DIRECTOR
  reviewedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  year: number;
  casualLeavesRemaining: number;
  sickLeavesRemaining: number;
  casualLeavesTaken: number;
  sickLeavesTaken: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

**✅ Should be preserved** as HR module feature

### 3. On-Duty Tracking

```typescript
export interface OnDutyRecord {
  id: string;
  userId: string;
  date: Timestamp;
  projectId: string;
  location: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  hoursAllocated: number;  // default 8
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;

  // ✅ UNIQUE: Auto-generates time entry on approval
  timeEntryId?: string;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

**✅ Brilliant feature** - field work automatically becomes billable time

---

## Estimate App Specific Features

### 1. Project-Level RBAC (Role-Based Access Control)

The Estimate app has the most sophisticated permission system:

```typescript
export interface ProjectPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageCollaborators: boolean;
  canApprove: boolean;
  canExport: boolean;
  canChangeStatus: boolean;
}

// Permission matrix by role
export const ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermissions> = {
  owner: { /* all true */ },
  reviewer: { canView: true, canEdit: true, canExport: true /* others false */ },
  approver: { canView: true, canApprove: true, canChangeStatus: true /* others false */ },
  viewer: { canView: true, canExport: true /* all others false */ }
};
```

**✅ This pattern should be adopted platform-wide** for project-level permissions

### 2. Activity Logging

```typescript
export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: ProjectActionType;
  timestamp: string;
  details: Record<string, any>;
  ipAddress?: string;
}

export type ProjectActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'shared'
  | 'role_changed'
  | 'status_changed'
  | 'approved'
  | 'rejected';
```

**✅ Should be platform-wide** audit trail feature

---

## Constants & Enums Extraction

Let me extract key constants that should be shared:

### Work Areas (from Time Tracker)
```typescript
export const WORK_AREAS = [
  'PROPOSAL',      // Pre-sale activities
  'DESIGN',        // Engineering design
  'PROCUREMENT',   // Vendor sourcing
  'PROJECT_MGMT',  // Coordination
  'ENGINEERING',   // Technical work
  'ACCOUNTS',      // Financial tasks
  '3D_PRINTING',   // Fabrication
  'OTHER'
] as const;
```

**✅ Should be shared** - these map to actual company workflow

### Departments (from Time Tracker)
```typescript
export const DEPARTMENTS = [
  'Engineering',
  'Procurement',
  'Project Management',
  'HR & Admin',
  'Finance',
  '3D Printing',
  'Design'
] as const;
```

**✅ Company-wide** constant

### Currencies (from Accounting)
```typescript
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'JPY';
```

**✅ Shared** across all financial modules

### Countries (from Procure)
```typescript
// Procure has comprehensive country code support with flags
export const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  // ... 200+ countries
];
```

**✅ Platform-wide** constant

---

## Next Steps Recommendations

### Immediate Actions:

1. **User Management Module**
   - Adopt Time Tracker's 3-role system (DIRECTOR, HR_ADMIN, TEAM_MEMBER) as base
   - Add module-specific roles (ENGINEER, ACCOUNTANT, PROCUREMENT_MANAGER)
   - Use **multi-role array** (Procure approach is correct)
   - Store roles in **Firebase Custom Claims** (Time Tracker approach)
   - Add explicit permission structure (Time Tracker permissions model)

2. **Entity Management Module**
   - Merge Accounting + Procure BusinessEntity (95% done!)
   - Make contact fields REQUIRED (Procure is correct)
   - Make tax IDs optional (Procure is correct - not all entities are in India)
   - Use extensible `taxIdentifiers` object for multi-country support
   - Add document management

3. **Project Management Module**
   - Use Time Tracker's team member array approach
   - Add Estimate's RBAC permission system
   - Remove module-specific stats from core (use subcollections)
   - Add Estimate's activity logging
   - Support multi-department projects

4. **Preserve Unique Features**
   - Time Tracker: Task acceptance flow, leave management, on-duty tracking
   - Estimate: Project-level RBAC, activity logging, revision control
   - Procure: RFQ/PO workflows, vendor management
   - Accounting: Double-entry accounting, GST/TDS support

---

**Status:** Analysis Complete
**Next Document:** UNIFIED_DATA_MODEL_PROPOSAL.md
