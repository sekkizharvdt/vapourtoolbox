# VDT-Unified Project Context

**Comprehensive Codebase Documentation**

**Project:** Vapour Toolbox - Unified Business Management Platform
**Company:** Vapour Desal Technologies Private Limited
**Version:** Phase 2 Complete - Active Development
**Overall Completion:** ~75%
**Last Updated:** 2025-01-05

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Domain](#business-domain)
3. [Monorepo Architecture](#monorepo-architecture)
4. [Technology Stack](#technology-stack)
5. [Module Registry & Status](#module-registry--status)
6. [Authentication & Authorization](#authentication--authorization)
7. [Database Schema](#database-schema)
8. [Shared Libraries](#shared-libraries)
9. [Integration Points](#integration-points)
10. [Development Workflow](#development-workflow)
11. [Testing Strategy](#testing-strategy)
12. [Current Phase & Roadmap](#current-phase--roadmap)
13. [Known Issues & Priorities](#known-issues--priorities)
14. [Module Deep Dives](#module-deep-dives)
15. [Code Quality & Security](#code-quality--security)

---

## Executive Summary

### Quick Facts

| Aspect             | Details                                                              |
| ------------------ | -------------------------------------------------------------------- |
| **Project Name**   | Vapour Toolbox (VDT-Unified)                                         |
| **Purpose**        | Unified business management platform for engineering & manufacturing |
| **Company**        | Vapour Desal Technologies Pvt Ltd (Water desalination equipment)     |
| **Tech Stack**     | Next.js 15, React 19, TypeScript 5.7, Firebase, Material UI 7        |
| **Repository**     | https://github.com/sekkizharvdt/vapourtoolbox                        |
| **Live URL**       | https://toolbox.vapourdesal.com                                      |
| **Codebase Size**  | 571 TypeScript files                                                 |
| **Modules**        | 11 total (4 Core, 4 Apps, 3 Future)                                  |
| **Overall Status** | 75% Complete                                                         |
| **Phase**          | Phase 2 Complete - Active Development                                |

### Project Vision

**VDT-Unified** is an integrated business management platform designed specifically for **Vapour Desal Technologies**, a company specializing in water desalination equipment manufacturing and engineering. The platform consolidates multiple business functions into a single, cohesive system:

- **User & Entity Management** - Manage internal users, customers, vendors, partners
- **Project Management** - Track projects, teams, budgets, timelines
- **Time Tracking** - Employee time entries, leave requests, task management
- **Accounting** - Complete double-entry accounting with Indian GST/TDS support
- **Procurement** - Purchase requisitions, RFQs, POs, vendor management
- **Estimation** - Equipment costing, material databases, quotation generation
- **Document Management** - Centralized document storage with version control

### Key Differentiators

1. **Industry-Specific** - Built for desalination equipment manufacturing
2. **Indian Tax Compliance** - Full GST (CGST/SGST/IGST) and TDS support
3. **Integrated Workflow** - Seamless data flow between modules
4. **Bitwise Permissions** - Granular access control (32 permission flags)
5. **Type-Safe** - 100% TypeScript with strict type checking
6. **Monorepo** - Turborepo + pnpm for efficient code sharing

---

## Business Domain

### Company: Vapour Desal Technologies Private Limited

**Industry:** Water Desalination Equipment Manufacturing
**Location:** India
**Business Model:** Project-based engineering, manufacturing, and installation

**Core Business Functions:**

1. **Estimation & Quoting** - Cost estimation for desalination projects
2. **Project Execution** - Engineering design, procurement, manufacturing
3. **Procurement** - Material & equipment sourcing
4. **Financial Management** - Accounting, GST compliance, vendor payments
5. **Time & Resource Management** - Employee time tracking, task management

### User Roles

**Internal Users** (@vapourdesal.com domain):

- **Super Admin** - Full system access
- **Director** - Approval & oversight
- **Project Manager** - Project execution & team management
- **Procurement Manager** - Procurement cycle management
- **Accountant** - Transaction creation & management
- **Finance Manager** - Financial approvals
- **HR Admin** - User & leave management
- **Team Member** - Basic time tracking & tasks

**External Users** (Client Project Managers):

- **Client PM** - View-only access to assigned projects
- Limited visibility (project-specific data only)

### Business Processes

#### 1. Project Workflow

```
New Project → Estimation → Client Approval → Engineering Design →
Procurement → Manufacturing → Installation → Completion
```

#### 2. Procurement Workflow

```
Purchase Request → Engineering Approval → RFQ Creation →
Vendor Quotations → Comparison → Purchase Order → Goods Receipt →
Payment
```

#### 3. Accounting Workflow

```
Transaction Entry → GL Entry Generation → Approval →
Posting → Financial Reporting
```

#### 4. Time Tracking Workflow

```
Time Entry → Task Assignment → Submission → Approval →
Timesheet Generation
```

---

## Monorepo Architecture

### Structure Overview

```
VDT-Unified/
├── apps/
│   └── web/                          # Next.js 15 web application
│       ├── src/
│       │   ├── app/                 # Next.js App Router pages
│       │   │   ├── accounting/      # Accounting module
│       │   │   ├── company/         # Company settings
│       │   │   ├── entities/        # Business entities
│       │   │   ├── estimation/      # Estimation (partial)
│       │   │   ├── procurement/     # Procurement module
│       │   │   ├── projects/        # Project management
│       │   │   ├── tasks/           # Time tracking & tasks
│       │   │   └── users/           # User management
│       │   ├── components/          # Shared React components
│       │   ├── contexts/            # React Context providers
│       │   ├── lib/                 # Service & helper functions
│       │   └── styles/              # Global styles
│       ├── e2e/                     # Playwright E2E tests
│       └── public/                  # Static assets
│
├── packages/
│   ├── types/                       # TypeScript type definitions (17 files)
│   │   └── src/
│   │       ├── accounting.ts        # Accounting types
│   │       ├── audit.ts             # Audit logging
│   │       ├── common.ts            # Shared types
│   │       ├── company.ts           # Company settings
│   │       ├── core.ts              # Core enums
│   │       ├── documents.ts         # Document management
│   │       ├── entity.ts            # Business entities
│   │       ├── invitation.ts        # User invitations
│   │       ├── notification.ts      # Notifications
│   │       ├── permissions.ts       # Bitwise permissions
│   │       ├── procurement.ts       # Procurement types
│   │       ├── project.ts           # Project management
│   │       ├── task.ts              # Task-notification system
│   │       ├── transaction.ts       # Financial transactions
│   │       ├── user.ts              # User profiles
│   │       └── data/
│   │           └── indian-coa-template.ts  # Default Chart of Accounts
│   │
│   ├── constants/                   # Module registry & configuration
│   │   └── src/
│   │       ├── index.ts             # Re-exports
│   │       ├── modules.ts           # 11 module definitions
│   │       ├── permissions.ts       # 32 permission flags
│   │       ├── roles.ts             # Pre-defined roles
│   │       └── workAreas.ts         # Work area definitions
│   │
│   ├── validation/                  # Zod schemas & sanitization
│   │   └── src/
│   │       ├── schemas/             # Validation schemas
│   │       └── sanitization.ts      # Input sanitization (DOMPurify)
│   │
│   ├── firebase/                    # Firebase SDK wrappers
│   │   └── src/
│   │       ├── collections.ts       # Collection name constants
│   │       └── typeHelpers.ts       # Firestore type helpers
│   │
│   ├── ui/                          # Material UI theme & components
│   │   └── src/
│   │       ├── theme.ts             # MUI v7 theme (Vapour branding)
│   │       └── components/          # Shared UI components
│   │
│   └── functions/                   # Shared Cloud Functions utilities
│       └── src/
│           └── utils.ts             # Helper functions
│
├── functions/                       # Firebase Cloud Functions (Node 20)
│   ├── src/
│   │   ├── auth/                    # Auth triggers
│   │   │   └── onUserCreated.ts     # Sync custom claims
│   │   └── index.ts                 # Function exports
│   └── package.json
│
├── docs/                            # 40+ documentation files
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── MODULE_*.md                  # Per-module docs
│   └── TYPESCRIPT_GUIDELINES.md
│
├── scripts/                         # Utility scripts
│   ├── preflight/                   # Pre-deployment checks
│   └── admin/                       # Admin utilities
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # CI/CD pipeline
│       └── deploy.yml               # Manual deployment
│
├── firebase.json                    # Firebase configuration
├── firestore.rules                  # Firestore security rules (408 lines)
├── firestore.indexes.json           # 36 composite indexes
├── turbo.json                       # Turborepo configuration
├── package.json                     # Workspace root
└── pnpm-workspace.yaml              # pnpm workspace config
```

### Build System

**Turborepo Configuration** (`turbo.json`):

```json
{
  "pipeline": {
    "build": {
      "outputs": [".next/**", "out/**", "lib/**"],
      "dependsOn": ["^build"]
    },
    "type-check": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  }
}
```

**Key Features:**

- **Caching** - Turbo caches build outputs for speed
- **Dependency graph** - Builds packages in correct order
- **Parallelization** - Runs independent tasks concurrently
- **Fast builds** - 144ms cached builds

---

## Technology Stack

### Frontend Stack

| Technology      | Version | Purpose                            |
| --------------- | ------- | ---------------------------------- |
| **Next.js**     | 15.1.0  | React framework with App Router    |
| **React**       | 19.0.0  | UI library                         |
| **TypeScript**  | 5.7.2   | Type-safe JavaScript (strict mode) |
| **Material UI** | 7.3.4   | Component library                  |
| **Emotion**     | 11.14.0 | CSS-in-JS styling                  |
| **date-fns**    | 4.1.0   | Date manipulation                  |
| **Zod**         | 3.24.1  | Runtime validation                 |
| **DOMPurify**   | 3.2.3   | HTML sanitization                  |

**Key Decisions:**

- **Static Export** - `output: 'export'` for Firebase Hosting
- **App Router** - Next.js 15 app directory structure
- **Client-Side Rendering** - `'use client'` for all pages (Firebase integration)
- **Material UI v7** - Latest version with React 19 support

### Backend & Infrastructure

| Technology           | Version | Purpose                        |
| -------------------- | ------- | ------------------------------ |
| **Firebase Auth**    | 11.2.0  | Google Sign-In authentication  |
| **Firestore**        | 11.2.0  | NoSQL database (real-time)     |
| **Cloud Functions**  | 6.1.1   | Serverless functions (Node 20) |
| **Firebase Hosting** | Latest  | Static hosting with CDN        |
| **Firebase Storage** | 11.2.0  | File storage                   |
| **firebase-admin**   | 13.1.0  | Admin SDK for Cloud Functions  |

**Firebase Project:**

- **Project ID:** `vapour-toolbox`
- **Region:** `asia-south1` (Mumbai, India)
- **Firestore Mode:** Native mode
- **Authentication:** Google Sign-In only
- **Domain:** toolbox.vapourdesal.com

### Development Tools

| Tool            | Version  | Purpose                   |
| --------------- | -------- | ------------------------- |
| **pnpm**        | 10.19.0  | Package manager           |
| **Turborepo**   | 2.3.3    | Monorepo build system     |
| **Node.js**     | >=20.0.0 | Runtime                   |
| **Playwright**  | 1.49.1   | E2E testing               |
| **ESLint**      | 9.18.0   | Code linting              |
| **Prettier**    | 3.4.2    | Code formatting           |
| **Husky**       | 9.1.7    | Git hooks                 |
| **lint-staged** | 15.2.11  | Pre-commit formatting     |
| **commitlint**  | 19.6.1   | Commit message validation |

### CI/CD

**Platform:** GitHub Actions

**Workflows:**

1. **CI** (`.github/workflows/ci.yml`)
   - Lint & Type Check
   - Build Application
   - Pre-deployment Checks
   - Security Audit

2. **Deploy** (`.github/workflows/deploy.yml`)
   - Manual trigger only
   - Deploy Firestore Rules
   - Deploy Firestore Indexes
   - Deploy Cloud Functions
   - Deploy to Firebase Hosting
   - Health check

---

## Module Registry & Status

### All 11 Modules

The VDT-Unified platform consists of **11 modules** organized into 3 categories:

#### Category 1: Core Modules (4) - Sidebar Only

These modules are essential infrastructure and always visible in the sidebar.

##### 1. User Management ✅ 90% Complete

**Purpose:** Manage internal users and external client PMs

**Location:** `/users`
**Permission Required:** MANAGE_USERS (bit 0)
**Priority:** N/A (Core module)

**Features Implemented:**

- [x] CRUD operations for users
- [x] Role assignment with bitwise permissions
- [x] Department assignment
- [x] Pending user approval workflow
- [x] Custom claims auto-sync (Cloud Functions)
- [x] Domain-based access control (internal/external)
- [x] User list with filtering & search
- [x] E2E tests

**Features Missing:**

- [ ] User activity tracking
- [ ] Bulk user import/export
- [ ] Password reset functionality (uses Firebase)
- [ ] User profile photos

**Key Files:**

- `apps/web/src/app/users/page.tsx` (389 lines)
- `apps/web/src/components/users/CreateUserDialog.tsx`
- `apps/web/src/components/users/EditUserDialog.tsx`
- `functions/src/auth/onUserCreated.ts` (Custom claims sync)

**Status:** Production-ready for basic operations

---

##### 2. Entity Management ✅ 95% Complete

**Purpose:** Manage vendors, customers, partners, and suppliers

**Location:** `/entities`
**Permission Required:** VIEW_ENTITIES (bit 5)
**Priority:** N/A (Core module)

**Features Implemented:**

- [x] CRUD operations (Create, Read, Update, Soft Delete)
- [x] Multiple roles: VENDOR, CUSTOMER, PARTNER, SUPPLIER
- [x] Multiple contacts per entity (name, email, phone)
- [x] Tax identifiers (GSTIN, PAN, TRN, VAT)
- [x] Bank account details
- [x] Credit terms & payment terms
- [x] State selection (36 Indian states/territories)
- [x] Duplicate detection (normalized names)
- [x] Permission-based operations
- [x] Real-time list with filters
- [x] E2E tests (full CRUD coverage)

**Features Missing:**

- [ ] Entity merge functionality (for duplicates)
- [ ] Advanced search filters (by tax ID, bank details)
- [ ] Entity relationship mapping
- [ ] Credit limit tracking

**Key Files:**

- `apps/web/src/app/entities/page.tsx` (428 lines)
- `apps/web/src/components/entities/CreateEntityDialog.tsx`
- `apps/web/src/components/entities/EditEntityDialog.tsx`
- `packages/types/src/entity.ts`

**Data Model:**

```typescript
interface BusinessEntity {
  id: string;
  name: string;
  normalizedName: string; // For duplicate detection
  role: EntityRole; // VENDOR | CUSTOMER | PARTNER | SUPPLIER
  type: 'COMPANY' | 'INDIVIDUAL';

  // Tax & Registration
  gstin?: string; // Indian GST Number
  pan?: string; // Indian PAN
  trn?: string; // UAE TRN
  vatNumber?: string; // VAT Number

  // Contact Information
  contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
  }>;

  // Address
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: IndianState; // 36 states/territories
    postalCode: string;
    country: string;
  };

  // Banking
  bankAccounts?: Array<{
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode?: string;
    swiftCode?: string;
    branchName?: string;
  }>;

  // Business Terms
  creditTermDays?: number;
  paymentTerms?: string;

  // Metadata
  isDeleted: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Status:** Production-ready, most complete core module

---

##### 3. Project Management ✅ 85% Complete

**Purpose:** Track projects, teams, budgets, and timelines

**Location:** `/projects`
**Permission Required:** VIEW_PROJECTS (bit 4)
**Priority:** N/A (Core module)

**Features Implemented:**

- [x] CRUD operations
- [x] Project team assignment (multiple users)
- [x] Client linkage (to BusinessEntity)
- [x] Status tracking (PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED)
- [x] Priority levels (LOW, MEDIUM, HIGH, URGENT)
- [x] Budget tracking (estimated budget)
- [x] Start & end date tracking
- [x] Description & notes
- [x] Project code (unique identifier)
- [x] Real-time project list
- [x] Permission-based access

**Features Missing:**

- [ ] Milestone tracking
- [ ] Budget vs actual tracking
- [ ] Project timeline/Gantt chart
- [ ] Resource allocation
- [ ] Project documents tab
- [ ] Financial summary (linked to accounting)
- [ ] E2E tests

**Key Files:**

- `apps/web/src/app/projects/page.tsx` (331 lines)
- `apps/web/src/components/projects/CreateProjectDialog.tsx`
- `apps/web/src/components/projects/EditProjectDialog.tsx`
- `apps/web/src/components/projects/ViewProjectDialog.tsx`
- `packages/types/src/project.ts`

**Data Model:**

```typescript
interface Project {
  id: string;
  code: string; // Unique project code (e.g., PRJ-2025-001)
  name: string;
  description?: string;

  // Client & Team
  clientId: string; // Reference to BusinessEntity
  clientName: string; // Denormalized for display
  team: string[]; // Array of user IDs

  // Status & Priority
  status: ProjectStatus;
  priority: ProjectPriority;

  // Timeline & Budget
  startDate?: Timestamp;
  endDate?: Timestamp;
  estimatedBudget?: number;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Status:** Production-ready for basic project tracking

---

##### 4. Company Settings ✅ 80% Complete

**Purpose:** One-time setup wizard for company configuration

**Location:** `/company`
**Permission Required:** MANAGE_COMPANY_SETTINGS (bit 9)
**Priority:** N/A (Core module)

**Features Implemented:**

- [x] Setup wizard (multi-step form)
- [x] Company information (name, email, phone, address)
- [x] Tax identifiers (GSTIN, PAN)
- [x] Fiscal year start month configuration
- [x] Chart of Accounts initialization (48 default accounts)
- [x] Logo upload support (UI ready, storage integration needed)
- [x] Company state selection
- [x] Real-time setup status tracking

**Features Missing:**

- [ ] Banking configuration (bank accounts)
- [ ] Multi-currency setup
- [ ] Default tax rates configuration
- [ ] Email templates configuration
- [ ] Company branding (colors, logo)
- [ ] E2E tests

**Key Files:**

- `apps/web/src/app/company/page.tsx` (291 lines)
- `apps/web/src/app/company/components/SetupWizard.tsx`
- `apps/web/src/lib/initializeChartOfAccounts.ts`
- `packages/types/src/company.ts`

**Setup Wizard Steps:**

1. **Company Information** - Name, contact details, address
2. **Tax Configuration** - GSTIN, PAN, state selection
3. **Fiscal Year** - Financial year start month
4. **Chart of Accounts** - Initialize default accounts (48 accounts)
5. **Review & Complete** - Summary and confirmation

**Status:** Functional, needs banking and advanced configuration

---

#### Category 2: Application Modules (4) - Dashboard Cards

These are feature-rich application modules shown as cards on the dashboard.

##### 5. Time Tracking ✅ 70% Complete

**Purpose:** Employee time tracking, task management, and leave requests

**Location:** `/tasks`
**Permission Required:** None (all authenticated users)
**Priority:** 1 (Highest)

**Features Implemented:**

- [x] Time entry creation & tracking
- [x] Task-notification system (unified tasks)
- [x] Leave request workflow (create, submit, approve/reject)
- [x] On-duty records
- [x] Task assignment
- [x] Status tracking (PENDING, APPROVED, REJECTED)
- [x] Project linkage (time entries linked to projects)
- [x] Work area selection
- [x] Duration tracking (start/end time or total duration)
- [x] Real-time task list

**Features Missing:**

- [ ] Timesheet generation & reporting
- [ ] Bulk approval of time entries
- [ ] Time entry editing after submission
- [ ] Manager view (team time tracking)
- [ ] Analytics & reporting
- [ ] Calendar view
- [ ] E2E tests

**Key Files:**

- `apps/web/src/app/tasks/page.tsx`
- `apps/web/src/lib/tasks/taskNotificationService.ts`
- `apps/web/src/lib/tasks/timeEntryService.ts`
- `packages/types/src/task.ts`

**Task-Notification System:**

```typescript
interface TaskNotification {
  id: string;
  type: 'task' | 'notification';
  category: 'ASSIGNED_TO_YOU' | 'CREATED_BY_YOU' | 'PROJECT_UPDATE';

  // Task Details
  taskType?: 'TIME_ENTRY' | 'LEAVE_REQUEST' | 'ON_DUTY';
  title: string;
  message: string;

  // Assignment
  userId: string; // User who owns this task
  assignedBy?: string;

  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

  // Links
  projectId?: string;
  entityId?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  dueDate?: Timestamp;
}
```

**Status:** Functional but needs reporting and approvals

---

##### 6. Accounting ✅ 85% Complete (Most Mature Module)

**Purpose:** Complete double-entry accounting with Indian GST/TDS support

**Location:** `/accounting`
**Permission Required:** VIEW_ACCOUNTING (bit 15)
**Priority:** 4

**Features Implemented:**

**Chart of Accounts:**

- [x] 4-level hierarchy (Type → Category → Group → Account)
- [x] 48 pre-configured accounts (Indian template)
- [x] Account types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
- [x] GST & TDS account flagging
- [x] Bank account configuration
- [x] Real-time tree view
- [x] Search & filtering
- [x] E2E tests

**Journal Entries:**

- [x] Create balanced journal entries (debits = credits)
- [x] Multiple ledger lines (minimum 2)
- [x] Cost centre allocation
- [x] Project linking
- [x] Sequential numbering (JE/2025/001)
- [x] Status tracking (DRAFT, POSTED)
- [x] Edit & delete operations
- [x] E2E tests

**Customer Invoices:**

- [x] Line items with quantity, rate, tax
- [x] Automatic GST calculation (CGST+SGST vs IGST)
- [x] State-based tax determination
- [x] Invoice number auto-generation (INV/2025/001)
- [x] Status lifecycle (DRAFT, APPROVED, SENT, PAID)
- [x] Due date tracking
- [x] Customer entity linking
- [x] E2E tests

**Vendor Bills:**

- [x] Line items with GST calculation
- [x] TDS (Tax Deducted at Source) calculation
- [x] TDS section selection (194C, 194I, 194J, etc.)
- [x] Vendor state-based tax computation
- [x] Bill number auto-generation (BILL/2025/001)
- [x] Status tracking (DRAFT, APPROVED, VOID)
- [x] Payment recording button
- [x] E2E tests

**Payments:**

- [x] Customer receipts (payments received)
- [x] Vendor payments (payments made)
- [x] Payment method support (Bank Transfer, UPI, Card, Cheque, Cash)
- [x] Payment allocation to invoices/bills
- [x] Cheque number & UPI transaction ID
- [x] Status lifecycle
- [x] Real-time payment list
- [ ] Payment allocation UI (needs completion)
- [ ] E2E tests

**Financial Reports:**

- [x] **Trial Balance** - All accounts with debit/credit totals (70% complete)
- [x] **Account Ledger** - Transaction history for an account (75% complete)
- [x] **Balance Sheet** - Assets vs Liabilities & Equity (85% complete)
- [x] **Profit & Loss** - Revenue vs Expenses (85% complete)
- [ ] **Cash Flow Statement** (Not started)

**GST & TDS Infrastructure:**

- [x] GST calculation logic (36 Indian states)
- [x] TDS calculation with sections & rates
- [x] Type definitions
- [ ] GST return generation (GSTR-1, GSTR-2, GSTR-3B)
- [ ] TDS certificate generation

**Features Missing:**

- [ ] Multi-currency support
- [ ] Bank reconciliation
- [ ] Recurring transactions
- [ ] Cash flow statement
- [ ] Budget vs actual reports
- [ ] Advanced filters & search
- [ ] Export to PDF/Excel

**Key Files:**

- `apps/web/src/app/accounting/` (10 page.tsx files)
- `apps/web/src/lib/accounting/` (9 service files, 2,475 lines)
  - `glEntryGenerator.ts` (621 lines) - GL entry generation
  - `auditLogger.ts` (318 lines) - Audit trail
  - `paymentHelpers.ts` (401 lines) - Payment allocation
  - `gstCalculator.ts` (195 lines) - GST logic
  - `tdsCalculator.ts` (141 lines) - TDS logic
  - `ledgerValidator.ts` (165 lines) - Entry validation
  - `transactionNumberGenerator.ts` (99 lines) - Sequential numbering
- `apps/web/e2e/06-accounting-chart-of-accounts.spec.ts`
- `apps/web/e2e/07-accounting-journal-entries.spec.ts`
- `apps/web/e2e/08-accounting-invoices.spec.ts`
- `apps/web/e2e/09-accounting-bills.spec.ts`
- `apps/web/e2e/10-accounting-payments.spec.ts`

**Indian Tax System Support:**

**GST Calculation:**

```typescript
// For intra-state (same state)
// Total GST = CGST + SGST
// Example: 18% GST = 9% CGST + 9% SGST

// For inter-state (different states)
// Total GST = IGST
// Example: 18% GST = 18% IGST
```

**TDS Sections:**

- **194C** - Contractors (1% with PAN, 2% without)
- **194I** - Rent (10% land/building, 2% equipment)
- **194J** - Professional/Technical Services (10%)
- **194H** - Commission/Brokerage (5%)
- And 10+ more sections

**Status:** Most complete module, production-ready for core accounting

---

##### 7. Procurement ✅ 65% Complete

**Purpose:** Purchase requisition workflow, RFQs, and purchase orders

**Location:** `/procurement`
**Permission Required:** VIEW_PROCUREMENT (bit 17)
**Priority:** 3

**Features Implemented:**

**Purchase Requests:**

- [x] Create purchase requests with line items
- [x] Project linkage (mandatory)
- [x] Category selection (RAW_MATERIAL, EQUIPMENT, SERVICE, etc.)
- [x] Type selection (CAPEX, OPEX, PROJECT_SPECIFIC)
- [x] Priority levels
- [x] Workflow status tracking
- [x] Engineering approval
- [x] Budget tracking
- [x] Justification & notes
- [x] Sequential numbering (PR/2025/001)
- [x] Real-time list with filters

**Request for Quotation (RFQ):**

- [x] Basic type definitions
- [x] RFQ creation (stub)
- [ ] Vendor selection (multiple vendors)
- [ ] RFQ email sending
- [ ] Vendor quotation submission
- [ ] Quotation comparison

**Purchase Orders:**

- [x] Type definitions
- [ ] PO creation from RFQ
- [ ] PO approval workflow
- [ ] PO sending to vendor
- [ ] Goods receipt against PO

**Features Missing:**

- [ ] Complete RFQ workflow
- [ ] Quotation comparison UI
- [ ] Purchase order generation
- [ ] Goods receipt module
- [ ] Vendor performance tracking
- [ ] Payment request from PO
- [ ] E2E tests

**Key Files:**

- `apps/web/src/app/procurement/purchase-requests/page.tsx` (287 lines)
- `apps/web/src/app/procurement/purchase-requests/new/page.tsx` (Create PR)
- `apps/web/src/lib/procurement/purchaseRequestService.ts` (Large file)
- `apps/web/src/lib/procurement/purchaseRequestHelpers.ts`
- `packages/types/src/procurement.ts`

**Purchase Request Workflow:**

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → CONVERTED_TO_RFQ
                                 ↘ REJECTED
```

**Data Model:**

```typescript
interface PurchaseRequest {
  id: string;
  number: string; // PR/2025/001
  type: PRType; // CAPEX | OPEX | PROJECT_SPECIFIC
  category: PRCategory; // RAW_MATERIAL | EQUIPMENT | SERVICE | ...

  // Project
  projectId: string;
  projectName: string;

  // Items
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    estimatedUnitCost?: number;
    estimatedTotalCost?: number;
    specifications?: string;
  }>;

  // Workflow
  status: PRStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Timestamp;

  // Justification
  justification: string;
  notes?: string;

  // Approval
  submittedBy?: string;
  submittedAt?: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Status:** Basic PR workflow functional, RFQ/PO needs work

---

##### 8. Estimation 🚧 30% Complete

**Purpose:** Equipment costing, material databases, and quotation generation

**Location:** `/estimation` (placeholder)
**Permission Required:** VIEW_ESTIMATION (bit 19)
**Priority:** 5

**Features Implemented:**

- [x] Type definitions for Equipment, Material, Estimate
- [x] Equipment database structure
- [x] Material database structure
- [x] Revision control structure
- [ ] Equipment CRUD operations
- [ ] Material CRUD operations
- [ ] Cost estimation workflow
- [ ] Template management
- [ ] Quotation generation
- [ ] E2E tests

**Data Model (Planned):**

```typescript
interface Equipment {
  id: string;
  code: string; // Equipment code (e.g., MED-100)
  name: string;
  category: string; // MED, MSF, RO, etc.
  description: string;

  // Specifications
  specifications: {
    capacity?: number; // m³/day
    material?: string;
    power?: number; // kW
    // ... more specs
  };

  // Costing
  baseCost: number;
  materialCost: number;
  laborCost: number;
  overheadPercentage: number;

  // Metadata
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Estimate {
  id: string;
  number: string; // EST/2025/001
  projectId: string;
  clientId: string;

  // Equipment & Materials
  equipment: Array<{
    equipmentId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;

  materials: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;

  // Totals
  subtotal: number;
  tax: number;
  totalCost: number;

  // Revision Control
  version: number;
  previousVersionId?: string;

  // Metadata
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  createdAt: Timestamp;
}
```

**Status:** Placeholder only, needs full implementation

---

#### Category 3: Coming Soon Modules (3)

##### 9. Document Management (Priority 2) 🚧 40% Complete

**Purpose:** Centralized document storage with version control

**Features Implemented:**

- [x] Type definitions (comprehensive)
- [x] Firebase Storage integration
- [x] Document service (upload, versioning, search)
- [x] Version history tracking
- [x] Module & entity linking
- [ ] Upload/download UI
- [ ] Document list page
- [ ] Access control
- [ ] Search & filters
- [ ] Preview functionality

**Key Files:**

- `apps/web/src/lib/documents/documentService.ts` (570 lines)
- `packages/types/src/documents.ts`

**Status:** Backend ready, UI needs implementation

---

##### 10. Proposal Management 🔜 0% Complete (Planned Q1 2026)

**Purpose:** Proposal creation, estimation linking, contract generation

**Priority:** 6

**Features Planned:**

- Proposal templates
- Estimation linking
- Terms & conditions management
- Document generation (PDF)
- Approval workflow
- Revision tracking

**Status:** Not started

---

##### 11. Thermal Desalination Design 🔜 0% Complete (Planned Q2 2026)

**Purpose:** MED/MSF calculations and engineering design tools

**Priority:** 7

**Features Planned:**

- MED (Multi-Effect Distillation) calculations
- MSF (Multi-Stage Flash) calculations
- Heat transfer calculations
- Equipment sizing
- Performance predictions

**Status:** Not started (domain-specific, low priority)

---

## Authentication & Authorization

### Firebase Authentication

**Provider:** Google Sign-In only

**Configuration:**

```json
{
  "auth": {
    "provider": "google.com",
    "allowedDomains": ["vapourdesal.com"],
    "externalUsers": "project-based access"
  }
}
```

**User Types:**

1. **Internal Users** (@vapourdesal.com domain)
   - Full access based on role/permissions
   - Managed through User Management module

2. **External Users** (Client PMs)
   - Invited via invitation system
   - Project-specific access only
   - Read-only permissions
   - Cannot see other projects

### Custom Claims

Firebase Auth custom claims store user metadata:

```typescript
interface CustomClaims {
  department?: Department; // ENGINEERING | PROCUREMENT | FINANCE | ...
  permissions: number; // Bitwise permissions (32 flags)
  domain: 'internal' | 'external';
}
```

**Custom Claims Sync (Cloud Function):**

```typescript
// functions/src/auth/onUserCreated.ts
export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const userData = event.data?.data();
  await setCustomUserClaims(event.params.userId, {
    department: userData.department,
    permissions: userData.permissions,
    domain: userData.domain,
  });
});
```

### Bitwise Permission System

**32 Permission Flags (bits 0-31):**

```typescript
export const PERMISSIONS = {
  // User Management (bits 0-2): 3 permissions
  MANAGE_USERS: 1 << 0, // 0x00000001
  VIEW_USER_DETAILS: 1 << 1, // 0x00000002
  APPROVE_USERS: 1 << 2, // 0x00000004

  // Project Management (bits 3-4): 2 permissions
  MANAGE_PROJECTS: 1 << 3, // 0x00000008
  VIEW_PROJECTS: 1 << 4, // 0x00000010

  // Entity Management (bits 5-8): 4 permissions
  VIEW_ENTITIES: 1 << 5, // 0x00000020
  CREATE_ENTITIES: 1 << 6, // 0x00000040
  EDIT_ENTITIES: 1 << 7, // 0x00000080
  DELETE_ENTITIES: 1 << 8, // 0x00000100

  // Company Settings (bit 9): 1 permission
  MANAGE_COMPANY_SETTINGS: 1 << 9, // 0x00000200

  // Analytics (bits 10-11): 2 permissions
  VIEW_ANALYTICS: 1 << 10, // 0x00000400
  VIEW_FINANCIAL_ANALYTICS: 1 << 11, // 0x00000800

  // Time Tracking (bits 12-13): 2 permissions
  APPROVE_LEAVE: 1 << 12, // 0x00001000
  APPROVE_TIME_ENTRIES: 1 << 13, // 0x00002000

  // Accounting (bits 14-15, 20-25): 8 permissions
  CREATE_TRANSACTIONS: 1 << 14, // 0x00004000
  VIEW_ACCOUNTING: 1 << 15, // 0x00008000
  APPROVE_TRANSACTIONS: 1 << 20, // 0x00100000
  POST_TRANSACTIONS: 1 << 21, // 0x00200000
  VIEW_FINANCIAL_REPORTS: 1 << 22, // 0x00400000
  MANAGE_CHART_OF_ACCOUNTS: 1 << 23, // 0x00800000
  RECONCILE_ACCOUNTS: 1 << 24, // 0x01000000
  MANAGE_ACCOUNTING_SETTINGS: 1 << 25, // 0x02000000

  // Procurement (bits 16-17): 2 permissions
  CREATE_PURCHASE_REQUESTS: 1 << 16, // 0x00010000
  VIEW_PROCUREMENT: 1 << 17, // 0x00020000

  // Estimation (bits 18-19): 2 permissions
  CREATE_ESTIMATES: 1 << 18, // 0x00040000
  VIEW_ESTIMATION: 1 << 19, // 0x00080000
};
```

**Checking Permissions:**

```typescript
// Single permission check
function hasPermission(userPermissions: number, permission: number): boolean {
  return (userPermissions & permission) === permission;
}

// Multiple permissions check (has ALL)
function hasAllPermissions(userPermissions: number, ...permissions: number[]): boolean {
  const combined = permissions.reduce((acc, p) => acc | p, 0);
  return (userPermissions & combined) === combined;
}

// Multiple permissions check (has ANY)
function hasAnyPermission(userPermissions: number, ...permissions: number[]): boolean {
  return permissions.some((p) => (userPermissions & p) === p);
}
```

**Pre-defined Roles:**

```typescript
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: 0xffffffff, // All 32 bits set
  DIRECTOR: 0x03f0f7ff, // All except low-level operations
  PROJECT_MANAGER: 0x00070fb8, // Project execution
  PROCUREMENT_MANAGER: 0x000300f0, // Procurement cycle
  ACCOUNTANT: 0x0000c000, // Transaction creation
  FINANCE_MANAGER: 0x03f0c800, // Financial oversight
  HR_ADMIN: 0x00003007, // User & leave management
  TEAM_MEMBER: 0x00000010, // Minimal permissions
  CLIENT_PM: 0x00000010, // View projects only
};
```

### Firestore Security Rules (Bitwise)

```javascript
// firestore.rules

// Helper function to check permission
function hasPermission(permission) {
  return request.auth != null &&
    (request.auth.token.permissions % (permission * 2)) >= permission;
}

match /transactions/{transactionId} {
  allow read: if hasPermission(32768);     // VIEW_ACCOUNTING (bit 15)
  allow create: if hasPermission(16384);   // CREATE_TRANSACTIONS (bit 14)
  allow update: if hasPermission(1048576); // APPROVE_TRANSACTIONS (bit 20)
}

match /projects/{projectId} {
  allow read: if hasPermission(16);        // VIEW_PROJECTS (bit 4)
  allow write: if hasPermission(8);        // MANAGE_PROJECTS (bit 3)
}
```

**Why Bitwise Permissions?**

1. **Efficient Storage** - Single integer (4 bytes) stores 32 permissions
2. **Fast Checks** - O(1) bitwise operations
3. **Firestore-Compatible** - Security rules support modulo arithmetic
4. **Scalable** - Easy to add new permissions (up to 32)
5. **Type-Safe** - TypeScript constants ensure correctness

---

## Database Schema

### Firestore Collections (16 Total)

#### 1. users

**Purpose:** User profiles, permissions, department assignment

**Key Fields:**

- `email` (string) - User email address
- `displayName` (string) - Full name
- `domain` ('internal' | 'external') - User type
- `department` (Department enum) - User department
- `permissions` (number) - Bitwise permissions
- `status` ('ACTIVE' | 'PENDING' | 'INACTIVE')
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(status, createdAt DESC)` - List active users
- `(department, status)` - Department-based filtering
- `(domain, status)` - Internal vs external users

---

#### 2. entities

**Purpose:** Vendors, customers, partners, suppliers

**Key Fields:**

- `name` (string) - Entity name
- `normalizedName` (string) - Lowercase for duplicate detection
- `role` ('VENDOR' | 'CUSTOMER' | 'PARTNER' | 'SUPPLIER')
- `type` ('COMPANY' | 'INDIVIDUAL')
- `gstin` (string) - Indian GST Number
- `pan` (string) - Indian PAN
- `contacts` (array) - Multiple contacts
- `state` (IndianState) - For GST calculation
- `isDeleted` (boolean) - Soft delete
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(role, isDeleted, createdAt DESC)` - List by role
- `(normalizedName, isDeleted)` - Duplicate detection
- `(state, role)` - State-based filtering

---

#### 3. projects

**Purpose:** Project master data

**Key Fields:**

- `code` (string) - Unique project code
- `name` (string) - Project name
- `clientId` (string) - Reference to entity
- `team` (array of strings) - User IDs
- `status` (ProjectStatus)
- `priority` (ProjectPriority)
- `startDate` (Timestamp)
- `endDate` (Timestamp)
- `estimatedBudget` (number)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(status, priority DESC, createdAt DESC)` - Dashboard listing
- `(clientId, status)` - Client-specific projects
- `(status, startDate DESC)` - Active projects by start date

---

#### 4. accounts

**Purpose:** Chart of Accounts (4-level hierarchy)

**Key Fields:**

- `code` (string) - Account code (e.g., 1000)
- `name` (string) - Account name
- `type` ('ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE')
- `category` (string) - Sub-type (e.g., CURRENT_ASSET)
- `group` (string) - Account group (e.g., CASH)
- `parentId` (string) - Parent account (hierarchy)
- `isGSTAccount` (boolean) - GST-related account
- `isTDSAccount` (boolean) - TDS-related account
- `isBankAccount` (boolean) - Bank account
- `bankDetails` (object) - IFSC, account number, branch
- `balance` (number) - Current balance
- `isActive` (boolean)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(type, isActive, code ASC)` - Chart of Accounts listing
- `(parentId, code ASC)` - Hierarchical queries
- `(isGSTAccount, isActive)` - GST account filtering

**4-Level Hierarchy:**

```
Type (ASSET)
  └─ Category (CURRENT_ASSET)
      └─ Group (CASH)
          └─ Account (Cash in Hand - INR)
```

---

#### 5. transactions

**Purpose:** Unified financial transactions (5 types)

**Key Fields:**

- `type` ('JOURNAL_ENTRY' | 'CUSTOMER_INVOICE' | 'VENDOR_BILL' | 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT')
- `number` (string) - Sequential number (e.g., JE/2025/001)
- `date` (Timestamp) - Transaction date
- `status` (TransactionStatus)
- `entityId` (string) - Customer/vendor reference
- `projectId` (string) - Project reference (optional)
- `description` (string)
- `amount` (number) - Total amount
- `ledgerEntries` (array) - Debit/credit entries
- `lineItems` (array) - For invoices/bills
- `gstDetails` (object) - GST breakdown
- `tdsDetails` (object) - TDS calculation
- `createdBy` (string)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(type, status, date DESC)` - Transaction listing
- `(entityId, type, status)` - Entity-specific transactions
- `(projectId, type, date DESC)` - Project-wise transactions
- `(date DESC, type)` - Date-range queries
- `(number ASC)` - Sequential number lookup

**Ledger Entry Structure:**

```typescript
interface LedgerEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  costCentreId?: string; // Project reference
}
```

**Sequential Numbering:**

- `JE/2025/001`, `JE/2025/002` - Journal Entries
- `INV/2025/001`, `INV/2025/002` - Customer Invoices
- `BILL/2025/001` - Vendor Bills
- `RCP/2025/001` - Customer Receipts
- `PAY/2025/001` - Vendor Payments

---

#### 6. purchaseRequests

**Purpose:** Purchase requisitions

**Key Fields:**

- `number` (string) - PR number (e.g., PR/2025/001)
- `type` ('CAPEX' | 'OPEX' | 'PROJECT_SPECIFIC')
- `category` (PRCategory)
- `projectId` (string) - Project reference
- `items` (array) - Line items
- `status` (PRStatus)
- `priority` (Priority)
- `justification` (string)
- `submittedBy` (string)
- `submittedAt` (Timestamp)
- `reviewedBy` (string)
- `reviewedAt` (Timestamp)
- `createdBy` (string)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(status, priority DESC, createdAt DESC)` - PR listing
- `(projectId, status)` - Project-specific PRs
- `(createdBy, status)` - User's PRs

---

#### 7. rfqs

**Purpose:** Request for Quotations

**Key Fields:**

- `number` (string) - RFQ number
- `purchaseRequestId` (string) - Source PR
- `vendorIds` (array) - Selected vendors
- `dueDate` (Timestamp)
- `status` ('DRAFT' | 'SENT' | 'RESPONSES_RECEIVED' | 'COMPLETED')
- `items` (array)
- `createdBy` (string)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(status, dueDate ASC)` - Active RFQs
- `(purchaseRequestId)` - Link to PR

---

#### 8. purchaseOrders

**Purpose:** Purchase orders

**Key Fields:**

- `number` (string) - PO number
- `rfqId` (string) - Source RFQ
- `vendorId` (string) - Selected vendor
- `items` (array)
- `totalAmount` (number)
- `status` ('DRAFT' | 'APPROVED' | 'SENT' | 'RECEIVED')
- `deliveryDate` (Timestamp)
- `createdBy` (string)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(status, deliveryDate ASC)` - Active POs
- `(vendorId, status)` - Vendor-specific POs

---

#### 9. quotations

**Purpose:** Vendor quotations (responses to RFQs)

**Key Fields:**

- `rfqId` (string) - RFQ reference
- `vendorId` (string) - Vendor submitting quote
- `items` (array) - Quoted items with prices
- `validUntil` (Timestamp)
- `notes` (string)
- `status` ('SUBMITTED' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED')
- `submittedAt` (Timestamp)

**Indexes:**

- `(rfqId, status)` - RFQ quotations
- `(vendorId, rfqId)` - Vendor's quote for RFQ

---

#### 10. timeEntries

**Purpose:** Employee time tracking

**Key Fields:**

- `userId` (string) - Employee
- `taskNotificationId` (string) - Related task
- `projectId` (string) - Project reference
- `workArea` (WorkArea) - Type of work
- `startTime` (Timestamp)
- `endTime` (Timestamp)
- `duration` (number) - Minutes
- `description` (string)
- `status` ('DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED')
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(userId, status, startTime DESC)` - User's time entries
- `(projectId, status, startTime DESC)` - Project time tracking
- `(status, startTime DESC)` - Pending approvals

---

#### 11. leaveRequests

**Purpose:** Employee leave applications

**Key Fields:**

- `userId` (string) - Employee
- `leaveType` ('ANNUAL' | 'SICK' | 'CASUAL' | 'MATERNITY' | 'PATERNITY')
- `startDate` (Timestamp)
- `endDate` (Timestamp)
- `duration` (number) - Days
- `reason` (string)
- `status` ('PENDING' | 'APPROVED' | 'REJECTED')
- `approvedBy` (string)
- `approvedAt` (Timestamp)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(userId, status, startDate DESC)` - User's leaves
- `(status, startDate ASC)` - Pending approvals

---

#### 12. onDutyRecords

**Purpose:** On-duty travel records

**Key Fields:**

- `userId` (string) - Employee
- `purpose` (string) - Travel purpose
- `location` (string) - Destination
- `startDate` (Timestamp)
- `endDate` (Timestamp)
- `status` ('PENDING' | 'APPROVED' | 'REJECTED')
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(userId, status, startDate DESC)` - User's records
- `(status, startDate ASC)` - Pending approvals

---

#### 13. estimates

**Purpose:** Cost estimates (planned, not fully implemented)

**Key Fields:**

- `number` (string) - Estimate number
- `projectId` (string)
- `clientId` (string)
- `equipment` (array) - Equipment items
- `materials` (array) - Material items
- `subtotal` (number)
- `tax` (number)
- `totalCost` (number)
- `version` (number) - Revision tracking
- `previousVersionId` (string)
- `status` ('DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED')
- `createdBy` (string)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

---

#### 14. taskNotifications

**Purpose:** Unified task and notification system

**Key Fields:**

- `type` ('task' | 'notification')
- `category` ('ASSIGNED_TO_YOU' | 'CREATED_BY_YOU' | 'PROJECT_UPDATE')
- `taskType` ('TIME_ENTRY' | 'LEAVE_REQUEST' | 'ON_DUTY')
- `userId` (string) - Owner
- `title` (string)
- `message` (string)
- `status` ('PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED')
- `projectId` (string)
- `entityId` (string)
- `dueDate` (Timestamp)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Indexes:**

- `(userId, status, createdAt DESC)` - User's tasks
- `(status, dueDate ASC)` - Pending tasks by due date

---

#### 15. auditLogs

**Purpose:** Audit trail for compliance

**Key Fields:**

- `entityType` (string) - Type of entity (e.g., 'transaction')
- `entityId` (string) - Entity ID
- `action` (string) - Action performed (e.g., 'CREATE', 'UPDATE')
- `actor` (string) - User ID who performed action
- `actorName` (string) - User display name
- `changes` (object) - Before/after values
- `ipAddress` (string)
- `userAgent` (string)
- `timestamp` (Timestamp)

**Indexes:**

- `(entityType, entityId, timestamp DESC)` - Entity audit trail
- `(actor, timestamp DESC)` - User activity log
- `(timestamp DESC)` - Recent audit logs

**Security:** Read-only, written by Cloud Functions

---

#### 16. invitations

**Purpose:** External user invitations

**Key Fields:**

- `email` (string) - Invited email
- `role` (string) - Assigned role
- `permissions` (number) - Bitwise permissions
- `projectIds` (array) - Project access (for external users)
- `status` ('PENDING' | 'ACCEPTED' | 'EXPIRED')
- `invitedBy` (string)
- `expiresAt` (Timestamp)
- `acceptedAt` (Timestamp)
- `createdAt` (Timestamp)

**Indexes:**

- `(email, status)` - Lookup by email
- `(status, expiresAt ASC)` - Pending invitations

---

### Firestore Indexes (36 Composite Indexes)

**Defined in:** `firestore.indexes.json`

**Purpose:** Optimize common query patterns

**Examples:**

```json
{
  "collectionGroup": "transactions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "projectId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
}
```

**Deployment:**

```bash
firebase deploy --only firestore:indexes
```

---

### Firestore Security Rules (408 Lines)

**Defined in:** `firestore.rules`

**Key Patterns:**

**Permission-based Access:**

```javascript
function hasPermission(permission) {
  return request.auth != null &&
    (request.auth.token.permissions % (permission * 2)) >= permission;
}

match /transactions/{transactionId} {
  allow read: if hasPermission(32768);  // VIEW_ACCOUNTING
  allow create: if hasPermission(16384); // CREATE_TRANSACTIONS
}
```

**Project-based Isolation (External Users):**

```javascript
function canAccessProject(projectId) {
  return request.auth.token.domain == 'internal' ||
    (request.auth.token.domain == 'external' &&
     exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid)));
}

match /projects/{projectId} {
  allow read: if canAccessProject(projectId);
}
```

**Audit Log Protection:**

```javascript
match /auditLogs/{logId} {
  allow read: if request.auth != null;
  allow write: if false;  // Only Cloud Functions can write
}
```

---

## Shared Libraries

### @vapour/types (17 Type Files)

**Purpose:** Unified TypeScript type definitions for the entire project

**Key Type Files:**

#### 1. accounting.ts

- `Account` - Chart of Accounts
- `AccountType` - ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
- `AccountCategory` - Sub-types
- `IndianState` - 36 states/territories
- `GSTDetails` - CGST, SGST, IGST breakdown

#### 2. transaction.ts

- `Transaction` - Unified transaction record
- `TransactionType` - 5 transaction types
- `LedgerEntry` - Debit/credit entry
- `LineItem` - Invoice/bill line item
- `PaymentAllocation` - Payment to invoice/bill mapping

#### 3. procurement.ts

- `PurchaseRequest` - PR with items
- `PRStatus` - Workflow states
- `RFQ` - Request for Quotation
- `Quotation` - Vendor quote
- `PurchaseOrder` - PO record

#### 4. project.ts

- `Project` - Project master record
- `ProjectStatus` - Lifecycle states
- `ProjectPriority` - Priority levels
- `ProjectMember` - Team member record

#### 5. user.ts

- `User` - User profile
- `CustomClaims` - Firebase Auth custom claims
- `UserStatus` - ACTIVE, PENDING, INACTIVE
- `Department` - Organizational departments

#### 6. entity.ts

- `BusinessEntity` - Vendor/customer/partner
- `EntityRole` - VENDOR, CUSTOMER, PARTNER, SUPPLIER
- `Contact` - Contact person
- `BankAccount` - Banking details

#### 7. task.ts

- `TaskNotification` - Unified task system
- `TimeEntry` - Time tracking
- `LeaveRequest` - Leave application
- `OnDutyRecord` - Travel record

#### 8. documents.ts

- `DocumentRecord` - Document metadata
- `DocumentUploadRequest` - Upload parameters
- `DocumentSearchFilters` - Query filters
- `DocumentVersionHistory` - Version tracking

#### 9. permissions.ts

- Permission constants (32 flags)
- Helper functions for permission checks
- Role-permission mappings

#### 10. common.ts

- `AuditLog` - Audit trail record
- `Notification` - In-app notification
- `Invitation` - User invitation

---

### @vapour/constants

**Purpose:** Module registry, permission definitions, configuration

**Key Exports:**

#### modules.ts

```typescript
export const MODULES: Module[] = [
  {
    id: 'users',
    name: 'User Management',
    path: '/users',
    icon: 'PeopleIcon',
    category: 'core',
    requiredPermission: PERMISSIONS.MANAGE_USERS,
  },
  // ... 10 more modules
];
```

#### permissions.ts

```typescript
export const PERMISSIONS = {
  MANAGE_USERS: 1 << 0,
  VIEW_ACCOUNTING: 1 << 15,
  // ... 26 more permissions
};

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: 0xffffffff,
  DIRECTOR: 0x03f0f7ff,
  // ... 7 more roles
};
```

#### roles.ts

```typescript
export const ROLES = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'PROJECT_MANAGER',
  // ... more roles
];
```

#### workAreas.ts

```typescript
export const WORK_AREAS = [
  'DESIGN',
  'PROCUREMENT',
  'MANUFACTURING',
  'INSTALLATION',
  'TESTING',
  'DOCUMENTATION',
];
```

---

### @vapour/validation

**Purpose:** Zod schemas for runtime validation & sanitization

**Key Features:**

- Input validation with Zod
- HTML sanitization with DOMPurify
- Type-safe validation helpers

**Example Schema:**

```typescript
import { z } from 'zod';

export const entitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['VENDOR', 'CUSTOMER', 'PARTNER', 'SUPPLIER']),
  email: z.string().email('Invalid email').optional(),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')
    .optional(),
});
```

---

### @vapour/firebase

**Purpose:** Firebase SDK wrappers and helpers

**Key Exports:**

#### collections.ts

```typescript
export const COLLECTIONS = {
  USERS: 'users',
  ENTITIES: 'entities',
  PROJECTS: 'projects',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  PURCHASE_REQUESTS: 'purchaseRequests',
  // ... more collections
};
```

#### typeHelpers.ts

```typescript
import { Timestamp } from 'firebase/firestore';

export function toFirestoreTimestamp(dateString: string): Timestamp {
  return Timestamp.fromDate(new Date(dateString));
}

export function fromFirestoreTimestamp(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString();
}
```

---

### @vapour/ui

**Purpose:** Material UI v7 theme and shared components

**Vapour Branding Colors:**

```typescript
const vapo urColors = {
  primary: {
    main: '#1976d2',      // Blue (from logo)
    light: '#42a5f5',
    dark: '#1565c0',
  },
  secondary: {
    main: '#dc004e',      // Red accent
    light: '#e33371',
    dark: '#9a0036',
  },
};
```

**Theme Features:**

- Dark mode support
- Desktop-first responsive design
- Custom component overrides
- Typography scale
- Consistent spacing

---

## Integration Points

### Module Relationships

```
Projects
  ├─ Used by: Time Tracking (time entries)
  ├─ Used by: Procurement (purchase requests)
  ├─ Used by: Accounting (cost centre allocation)
  └─ Used by: Estimation (estimates)

Entities
  ├─ Used by: Accounting (customers, vendors)
  ├─ Used by: Procurement (vendors for RFQs)
  └─ Used by: Projects (clients)

Accounting
  ├─ Integrates: Projects (cost centre)
  ├─ Integrates: Entities (customers, vendors)
  └─ Integrates: Procurement (vendor bills from POs)

Procurement
  ├─ Integrates: Projects (project-specific PRs)
  ├─ Integrates: Entities (vendor selection)
  └─ Integrates: Accounting (bills from POs)

Time Tracking
  ├─ Integrates: Projects (time entries per project)
  └─ Integrates: Users (employee time tracking)
```

### Data Flow Examples

#### 1. Purchase-to-Pay Flow

```
Purchase Request → Engineering Approval → RFQ Creation →
Vendor Quotations → Purchase Order → Goods Receipt →
Vendor Bill (Accounting) → Payment (Accounting)
```

#### 2. Quote-to-Cash Flow

```
Estimate → Client Approval → Project Creation →
Time Tracking → Invoice Creation (Accounting) →
Payment Receipt (Accounting)
```

#### 3. Time-to-Invoice Flow

```
Time Entry → Approval → Timesheet Generation →
Invoice Creation (with time entry details)
```

---

## Development Workflow

### Local Development

**Prerequisites:**

- Node.js >= 20.0.0
- pnpm 10.19.0
- Firebase CLI

**Setup:**

```bash
# Clone repository
git clone https://github.com/sekkizharvdt/vapourtoolbox.git
cd VDT-Unified

# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env.local

# Start dev server
cd apps/web
pnpm dev
```

**Environment Variables:**

```env
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Private)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Git Workflow

**Commit Message Format:**

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
```

**Pre-commit Hooks:**

1. Prettier formatting (lint-staged)
2. TypeScript type check
3. Pre-deployment checks
4. Commitlint validation

**Bypass (NOT RECOMMENDED):**

```bash
git commit --no-verify
```

### Build & Deploy

**Build Commands:**

```bash
# Type check all packages
pnpm type-check

# Lint all packages
pnpm lint

# Build all packages
pnpm build

# Build specific package
pnpm --filter @vapour/web build
```

**Deployment:**

```bash
# Trigger deployment workflow (manual)
gh workflow run deploy.yml
```

---

## Testing Strategy

### E2E Testing (Playwright)

**Test Suites (11 Total):**

1. `01-homepage.spec.ts` - Homepage rendering
2. `02-authentication.spec.ts` - Google Sign-In
3. `03-navigation.spec.ts` - Sidebar navigation
4. `04-dashboard.spec.ts` - Dashboard cards
5. `05-entities.spec.ts` - Entity CRUD (full coverage)
6. `06-accounting-chart-of-accounts.spec.ts` - Chart of Accounts
7. `07-accounting-journal-entries.spec.ts` - Journal entries
8. `08-accounting-invoices.spec.ts` - Customer invoices
9. `09-accounting-bills.spec.ts` - Vendor bills
10. `10-accounting-payments.spec.ts` - Payments
11. `11-accounting-reports.spec.ts` - Financial reports

**Running Tests:**

```bash
# Run all tests
pnpm test:e2e

# Run specific test
pnpm test:e2e tests/05-entities.spec.ts

# Interactive UI mode
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug
```

**Test Environment:**

- Firebase Emulators (Auth + Firestore)
- Seed data from `global-setup.ts`
- Parallel execution (workers)
- Screenshot + video on failure

### Unit Testing (Planned - Vitest)

**TODO:**

- Set up Vitest
- Test utility functions
- Test validation logic
- Test calculations (GST, TDS, etc.)
- Target: 70% coverage

---

## Current Phase & Roadmap

### Phase 2 Complete (Current Status)

**Completed Modules:**

- [x] User Management (90%)
- [x] Entity Management (95%)
- [x] Project Management (85%)
- [x] Company Settings (80%)
- [x] Time Tracking (70%)
- [x] Accounting (85%) - Most complete
- [x] Procurement (65%) - Basic PR workflow
- [ ] Estimation (30%) - Placeholder

**Infrastructure:**

- [x] Monorepo setup
- [x] Type system (100% coverage)
- [x] Firebase integration
- [x] Material UI theme
- [x] CI/CD pipeline
- [x] E2E testing framework
- [x] Documentation (40+ files)

**Overall Completion: 75%**

---

### Phase 3 Roadmap (Next 6 Months)

#### Q1 2026 (Jan-Mar)

**Accounting Module:**

- [ ] Complete payment allocation UI
- [ ] Bank reconciliation module
- [ ] Cash flow statement
- [ ] Multi-currency support
- [ ] Recurring transactions
- [ ] GST return generation (GSTR-1, GSTR-2)

**Procurement Module:**

- [ ] Complete RFQ workflow
- [ ] Quotation comparison UI
- [ ] Purchase order generation
- [ ] Goods receipt module
- [ ] Vendor performance tracking

**Estimation Module:**

- [ ] Equipment CRUD operations
- [ ] Material CRUD operations
- [ ] Cost estimation workflow
- [ ] Template management
- [ ] Quotation generation

**Document Management:**

- [ ] Upload/download UI
- [ ] Document list page
- [ ] Version control UI
- [ ] Access control
- [ ] Search & filters

#### Q2 2026 (Apr-Jun)

**Proposal Management:**

- [ ] Proposal creation workflow
- [ ] Estimation linking
- [ ] Terms & conditions management
- [ ] Document generation (PDF)
- [ ] Approval workflow

**Analytics & Reporting:**

- [ ] Admin dashboard
- [ ] Financial analytics
- [ ] Project analytics
- [ ] Resource utilization
- [ ] Performance metrics

**Mobile Optimization:**

- [ ] Responsive design improvements
- [ ] Mobile-first pages
- [ ] Touch-friendly UI

---

## Known Issues & Priorities

### High Priority Issues

1. **Payment Allocation UI** (Accounting)
   - Payment allocation dialog needs completion
   - Currently shows button but no functionality
   - **Impact:** Cannot allocate payments to multiple invoices

2. **Bank Reconciliation** (Accounting)
   - No bank reconciliation module
   - Critical for month-end closing
   - **Impact:** Manual reconciliation required

3. **RFQ Workflow** (Procurement)
   - RFQ creation is stub only
   - No vendor selection or quotation submission
   - **Impact:** Cannot complete procurement cycle

4. **Estimation Module** (Estimation)
   - Equipment/material CRUD not implemented
   - No costing workflow
   - **Impact:** Manual estimates required

5. **Document Management UI** (Document Management)
   - Backend ready, UI missing
   - No upload/download interface
   - **Impact:** Cannot use document management

### Medium Priority Issues

6. **Project Timeline/Gantt** (Project Management)
   - No visual timeline
   - No milestone tracking
   - **Impact:** Limited project planning

7. **Timesheet Generation** (Time Tracking)
   - No timesheet reports
   - No bulk approval
   - **Impact:** Manual timesheet creation

8. **Multi-currency** (Accounting)
   - No forex support
   - Single currency (INR) only
   - **Impact:** Cannot handle foreign transactions

9. **Unit Tests** (Testing)
   - No unit test framework
   - Only E2E tests
   - **Impact:** Limited test coverage

10. **Mobile Responsiveness** (UI/UX)
    - Desktop-first design
    - Mobile experience needs improvement
    - **Impact:** Poor mobile usability

### Low Priority Issues

11. **User Activity Tracking** (User Management)
12. **Entity Merge** (Entity Management)
13. **Advanced Search** (Multiple modules)
14. **Bulk Operations** (Multiple modules)
15. **Data Export** (CSV/PDF)

---

## Code Quality & Security

### Type Safety

- **100% TypeScript coverage**
- **Strict mode enabled**
- **571 TypeScript files**
- **No `as any` casts** (CI enforced)

### Security Measures

1. **Authentication** - Firebase Auth with Google Sign-In
2. **Authorization** - Bitwise permissions (32 flags)
3. **Row-Level Security** - Firestore security rules (408 lines)
4. **Input Validation** - Zod runtime validation
5. **HTML Sanitization** - DOMPurify
6. **Audit Logging** - All operations logged
7. **HTTPS Only** - Firebase Hosting with CDN
8. **Domain Restrictions** - Email domain-based access

### Code Quality Metrics

- **Linting:** ESLint v9 (zero errors)
- **Formatting:** Prettier (100% formatted)
- **Type Checking:** TypeScript strict (zero errors)
- **E2E Tests:** 11 test suites
- **Documentation:** 40+ documentation files
- **Pre-commit Hooks:** 4 automated checks

---

## Conclusion

**VDT-Unified** is a well-architected, type-safe, enterprise-grade business management platform at **~75% completion**. The infrastructure is solid with excellent developer experience, comprehensive documentation, and production-ready features in core modules.

**Key Strengths:**

- Robust type system with 100% type safety
- Comprehensive security with bitwise permissions
- Well-documented (40+ docs)
- Automated CI/CD pipeline
- Production deployment infrastructure
- Strong code quality enforcement
- Most complete Accounting module (85%)

**Next Steps:**

1. Complete Estimation module CRUD operations
2. Finish Procurement RFQ workflow
3. Implement Document Management UI
4. Add Bank Reconciliation to Accounting
5. Enhance mobile responsiveness
6. Add unit tests with Vitest

**Production Readiness:**

- ✅ User Management
- ✅ Entity Management
- ✅ Project Management (basic)
- ✅ Company Settings (basic)
- ✅ Time Tracking (basic)
- ✅ Accounting (core features)
- ⚠️ Procurement (basic PR only)
- ❌ Estimation (not ready)
- ❌ Document Management (backend only)

The codebase provides a solid foundation for completing remaining features and scaling to meet business requirements.

---

**For Questions or Contributions:**

- Repository: https://github.com/sekkizharvdt/vapourtoolbox
- Live Application: https://toolbox.vapourdesal.com
- Documentation: See `docs/` directory
- AI Guidelines: See `.claude/claude.md`
