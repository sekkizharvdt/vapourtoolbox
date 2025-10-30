# VDT Unified Platform - Codebase Analysis Part 3

**Analysis Date:** October 27, 2025
**Focus:** Validation Schemas, Constants, Security Rules & Business Logic

---

## Validation Schema Analysis

### 1. Accounting App - Zod Validation

**Location:** `vdt-accounting/src/validation/schemas.ts`

#### Key Validation Patterns:

```typescript
// Reusable field schemas
export const emailSchema = z.string()
  .min(1, VALIDATION_MESSAGES.REQUIRED)
  .regex(EMAIL_REGEX, VALIDATION_MESSAGES.INVALID_EMAIL);

export const gstinSchema = z.string()
  .regex(GSTIN_REGEX, VALIDATION_MESSAGES.INVALID_GSTIN)
  .or(z.literal(''))
  .optional();

export const panSchema = z.string()
  .regex(PAN_REGEX, VALIDATION_MESSAGES.INVALID_PAN)
  .or(z.literal(''))
  .optional();
```

#### Entity Validation (Critical Difference!)

```typescript
// Accounting requires GSTIN but makes contact optional
export const entitySchema = z.object({
  // Required fields
  name: z.string().min(1, VALIDATION_MESSAGES.REQUIRED),
  address: z.string().min(1, VALIDATION_MESSAGES.REQUIRED),
  gstin: z.string().min(1, VALIDATION_MESSAGES.REQUIRED)  // ❌ REQUIRED
    .regex(GSTIN_REGEX, VALIDATION_MESSAGES.INVALID_GSTIN),
  openingBalance: z.number(),
  roles: z.array(z.enum(['VENDOR', 'CUSTOMER'])).min(1),
  status: z.enum(['POTENTIAL', 'ACTIVE', 'INACTIVE']).default('ACTIVE'),

  // Optional fields
  contactPerson: z.string().optional(),  // ❌ Optional in Accounting
  email: z.string().regex(EMAIL_REGEX).optional().or(z.literal('')),
  phone: z.string().regex(PHONE_REGEX).optional().or(z.literal('')),
  phoneCountryCode: z.string().optional(),
  // ... bank details all optional
});
```

#### Double-Entry Accounting Validation (Brilliant!)

```typescript
// Ensures debits = credits (accounting fundamental rule)
export const journalEntrySchema = z.object({
  date: z.date(),
  description: z.string().min(1, VALIDATION_MESSAGES.REQUIRED),
  referenceNumber: z.string().optional(),
  entries: z.array(ledgerEntrySchema).min(2, 'At least 2 entries required'),
}).refine(
  (data) => {
    const totalDebit = data.entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = data.entries.reduce((sum, entry) => sum + entry.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;  // ✅ Floating point tolerance
  },
  {
    message: 'Total debits must equal total credits',  // ✅ Core accounting rule
    path: ['entries'],
  }
);

// Individual ledger entry validation
export const ledgerEntrySchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string().optional(),
}).refine(
  (data) => (data.debit > 0 && data.credit === 0) ||
           (data.credit > 0 && data.debit === 0) ||
           (data.debit === 0 && data.credit === 0),
  {
    message: 'Each entry should have either debit or credit, not both',
  }
);
```

**✅ This is EXCELLENT** - Enforces fundamental accounting principles at the validation layer!

---

### 2. Procure App - Validation Constants

**Location:** `VDT-Procure/src/constants/validation.ts`

#### Validation Functions (Not Zod)

```typescript
// Helper functions for inline validation
export const validateGSTIN = (gstin: string): boolean => {
  if (!gstin) return true; // ✅ Optional field
  return GSTIN_REGEX.test(gstin.toUpperCase());
};

export const validatePAN = (pan: string): boolean => {
  if (!pan) return true; // ✅ Optional field
  return PAN_REGEX.test(pan.toUpperCase());
};

export const validateIFSC = (ifsc: string): boolean => {
  if (!ifsc) return true; // ✅ Optional field
  return IFSC_CODE_REGEX.test(ifsc.toUpperCase());
};
```

**Observation:**
- Procure uses **plain validation functions** (not Zod)
- Makes Indian tax IDs **optional** (correct for international vendors)
- More flexible approach for multi-country support

---

### 3. Regex Pattern Comparison

All apps use **identical regex patterns** (good consistency!):

| Pattern | Regex | Purpose |
|---------|-------|---------|
| **Email** | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | Standard email validation |
| **Phone** | `/^[0-9\s\-().]{7,15}$/` | International phone (without country code) |
| **GSTIN** | `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` | Indian GST (15 chars) |
| **PAN** | `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/` | Indian PAN (10 chars) |
| **Postal Code** | `/^\d{6}$/` | Indian PIN (6 digits) |
| **IFSC** | `/^[A-Z]{4}0[A-Z0-9]{6}$/` | Indian bank code |
| **Account Number** | `/^\d{9,18}$/` | Bank account (9-18 digits) |

**✅ Recommendation:** Extract these to **shared validation package**

---

### 4. Unified Validation Proposal

```typescript
// Proposed: packages/validation/schemas/entity.ts

import { z } from 'zod';
import { EMAIL_REGEX, PHONE_REGEX, GSTIN_REGEX, PAN_REGEX } from './patterns';

// Base entity schema (extensible)
export const baseEntitySchema = z.object({
  // Required core fields
  name: z.string().min(1, 'Entity name is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),  // ✅ REQUIRED
  email: z.string().regex(EMAIL_REGEX, 'Invalid email format'),  // ✅ REQUIRED
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone number'),  // ✅ REQUIRED
  phoneCountryCode: z.string().min(2, 'Country code required'),  // ✅ REQUIRED
  address: z.string().min(1, 'Address is required'),

  // Entity classification
  roles: z.array(z.enum(['VENDOR', 'CUSTOMER', 'EMPLOYEE', 'PARTNER']))
    .min(1, 'At least one role required'),
  status: z.enum(['POTENTIAL', 'ACTIVE', 'INACTIVE', 'BLACKLISTED'])
    .default('ACTIVE'),

  // Financial
  openingBalance: z.number().default(0),

  // Optional address details
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),

  // Optional tax identifiers (region-specific)
  taxIdentifiers: z.object({
    gstin: z.string().regex(GSTIN_REGEX).optional(),  // India
    pan: z.string().regex(PAN_REGEX).optional(),  // India
    vat: z.string().optional(),  // EU
    ein: z.string().optional(),  // US
    // ... extensible
  }).optional(),

  // Optional banking
  bankDetails: z.object({
    accountName: z.string(),
    accountNumber: z.string(),
    bankName: z.string(),
    swiftCode: z.string().optional(),
    ifscCode: z.string().regex(IFSC_CODE_REGEX).optional(),
  }).optional(),

  // Metadata
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// India-specific variant (for Accounting app)
export const indiaEntitySchema = baseEntitySchema.extend({
  taxIdentifiers: z.object({
    gstin: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN')
      .min(1, 'GSTIN required for Indian entities'),  // ✅ Required for India
    pan: z.string().regex(PAN_REGEX).optional(),
  }),
});

// International variant (for Procure app with global vendors)
export const internationalEntitySchema = baseEntitySchema;

export type EntityFormData = z.infer<typeof baseEntitySchema>;
export type IndiaEntityFormData = z.infer<typeof indiaEntitySchema>;
```

**Benefits:**
- ✅ Base schema works globally
- ✅ India-specific schema for compliance
- ✅ Extensible tax identifiers
- ✅ Contact info required (Procure is correct)
- ✅ Tax IDs optional (international support)

---

## Constants Extraction

### 1. Shared Constants Identified

#### Validation Patterns (All Apps)
```typescript
// packages/validation/patterns.ts
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[0-9\s\-().]{7,15}$/,
  // Indian patterns
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  POSTAL_CODE_INDIA: /^\d{6}$/,
  IFSC_CODE: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  ACCOUNT_NUMBER: /^\d{9,18}$/,
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number (7-15 digits)',
  INVALID_GSTIN: 'Please enter a valid 15-character GSTIN',
  INVALID_PAN: 'Please enter a valid 10-character PAN',
  INVALID_POSTAL_CODE: 'Please enter a valid 6-digit PIN code',
  INVALID_IFSC: 'Please enter a valid IFSC code',
  INVALID_ACCOUNT_NUMBER: 'Please enter a valid account number (9-18 digits)',
} as const;
```

#### Work Areas (Time Tracker)
```typescript
// packages/core/constants/work-areas.ts
export const WORK_AREAS = {
  PROPOSAL: {
    value: 'PROPOSAL',
    label: 'Proposal',
    description: 'Pre-sale activities and RFP responses',
    icon: '📋',
    color: '#10B981',
    bgClass: 'bg-green-100 text-green-800 border-green-200',
  },
  DESIGN: {
    value: 'DESIGN',
    label: 'Design',
    description: 'Engineering design and CAD work',
    icon: '🎨',
    color: '#3B82F6',
    bgClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  PROCUREMENT: {
    value: 'PROCUREMENT',
    label: 'Procurement',
    description: 'Vendor sourcing and material procurement',
    icon: '🛒',
    color: '#F59E0B',
    bgClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  PROJECT_MGMT: {
    value: 'PROJECT_MGMT',
    label: 'Project Management',
    description: 'Coordination and client communication',
    icon: '📊',
    color: '#EF4444',
    bgClass: 'bg-red-100 text-red-800 border-red-200',
  },
  ENGINEERING: {
    value: 'ENGINEERING',
    label: 'Engineering',
    description: 'Technical implementation and execution',
    icon: '⚙️',
    color: '#06B6D4',
    bgClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  ACCOUNTS: {
    value: 'ACCOUNTS',
    label: 'Accounts',
    description: 'Financial and billing tasks',
    icon: '💰',
    color: '#F97316',
    bgClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  '3D_PRINTING': {
    value: '3D_PRINTING',
    label: '3D Printing',
    description: 'Prototyping and fabrication',
    icon: '🖨️',
    color: '#6B7280',
    bgClass: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  OTHER: {
    value: 'OTHER',
    label: 'Other',
    description: 'Miscellaneous work',
    icon: '📂',
    color: '#94A3B8',
    bgClass: 'bg-slate-100 text-slate-800 border-slate-200',
  },
} as const;

export type WorkAreaType = keyof typeof WORK_AREAS;
```

**✅ This maps to actual company workflow phases** - should be platform-wide constant

#### Departments (Time Tracker)
```typescript
// packages/core/constants/departments.ts
export const DEPARTMENTS = [
  'Engineering',
  'Procurement',
  'Project Management',
  'HR & Admin',
  'Finance',
  '3D Printing',
  'Design',
] as const;

export type Department = typeof DEPARTMENTS[number];
```

#### Currencies (Accounting)
```typescript
// packages/core/constants/currencies.ts
export const CURRENCIES = {
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£' },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
} as const;

export type Currency = keyof typeof CURRENCIES;
```

#### Transaction Types (Accounting)
```typescript
// packages/accounting/constants/transaction-types.ts
export const TRANSACTION_TYPES = {
  JOURNAL_ENTRY: {
    value: 'JOURNAL_ENTRY',
    label: 'Journal Entry',
    description: 'General ledger entry',
  },
  PAYMENT_VOUCHER: {
    value: 'PAYMENT_VOUCHER',
    label: 'Payment Voucher',
    description: 'Payment made to vendor/entity',
  },
  RECEIPT_VOUCHER: {
    value: 'RECEIPT_VOUCHER',
    label: 'Receipt Voucher',
    description: 'Payment received from customer',
  },
  SALES_INVOICE: {
    value: 'SALES_INVOICE',
    label: 'Sales Invoice',
    description: 'Invoice issued to customer',
  },
  PURCHASE_INVOICE: {
    value: 'PURCHASE_INVOICE',
    label: 'Purchase Invoice',
    description: 'Invoice received from vendor',
  },
  BANK_TRANSFER: {
    value: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    description: 'Transfer between bank accounts',
  },
  INTER_PROJECT_TRANSFER: {
    value: 'INTER_PROJECT_TRANSFER',
    label: 'Inter-Project Transfer',
    description: 'Fund transfer between projects',
  },
} as const;

export type TransactionType = keyof typeof TRANSACTION_TYPES;
```

#### React Query Configuration (Accounting)
```typescript
// packages/core/config/query-client.ts
export const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000,  // 5 minutes
  CACHE_TIME: 10 * 60 * 1000,  // 10 minutes
  RETRY_COUNT: 1,
} as const;

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;
```

---

## Firebase Security Rules Comparison

### 1. Accounting App Security Pattern

**Location:** `vdt-accounting/firestore.rules`

```javascript
// Role-based helpers (reads from users collection)
function isAuthenticated() {
  return request.auth != null;
}

function isAdmin() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN';
}

function isAccountant() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in
      ['ADMIN', 'ACCOUNTANT'];
}

function canViewReports() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in
      ['ADMIN', 'DIRECTOR', 'ACCOUNTANT'];
}
```

**Issues:**
- ❌ **Every permission check reads users collection** (performance cost)
- ❌ No caching - multiple reads per request
- ❌ Firestore charges for these reads
- ❌ Slower than custom claims

**Permission Pattern:**
```javascript
// Entities example
match /entities/{entityId} {
  allow read: if canViewReports();  // 1 Firestore read
  allow write: if isAccountant();   // 1 Firestore read
}

// Every query triggers 1-2 extra reads!
```

---

### 2. Time Tracker Security Pattern (SUPERIOR!)

**Location:** `VDT-Dashboard/firestore.rules`

```javascript
// Uses Firebase Custom Claims (NO database reads!)
function isAuthenticated() {
  return request.auth != null &&
    request.auth.token.email.matches('.*@vapourdesal\\.com$') &&
    isAuthorizedEmail(request.auth.token.email);
}

function getUserRole() {
  return request.auth.token.role;  // ✅ From ID token, NOT database!
}

function isDirector() {
  return isAuthenticated() &&
    getUserRole() == 'DIRECTOR';  // ✅ No database read!
}

function isHRAdmin() {
  return isAuthenticated() &&
    getUserRole() == 'HR_ADMIN';  // ✅ No database read!
}
```

**Benefits:**
- ✅ **Zero database reads** for permission checks
- ✅ Roles stored in Firebase ID token (fast, secure)
- ✅ Updated by Cloud Functions only
- ✅ Email whitelist for additional security

**Permission Pattern:**
```javascript
// User-roles collection (Functions-only write)
match /user-roles/{email} {
  allow read: if isDirector();  // Only directors
  allow write: if false;  // ✅ Functions only! Prevents client manipulation
}

// Tasks with project-based access
match /tasks/{taskId} {
  allow read: if isAuthenticated() && (
    isDirector() ||  // ✅ No DB read
    resource.data.userId == request.auth.uid ||
    resource.data.createdBy == request.auth.uid ||
    // Project membership check (only 1 read for project data)
    (exists(/databases/$(database)/documents/projects/$(resource.data.projectId)) &&
     (request.auth.uid in get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.teamMembers))
  );
}
```

---

### 3. Security Rules Comparison Table

| Aspect | Accounting | Time Tracker | Recommendation |
|--------|-----------|--------------|----------------|
| **Role Storage** | Firestore users collection | Firebase Custom Claims | ✅ Custom Claims |
| **Permission Check** | `get(users/uid).data.role` | `request.auth.token.role` | ✅ Token-based |
| **Database Reads per Check** | 1-2 reads | 0 reads | ✅ Zero reads |
| **Performance** | Slower | Faster | ✅ Faster |
| **Cost** | Higher (Firestore reads) | Lower | ✅ Lower cost |
| **Security** | Client can modify | Functions-only | ✅ Functions-only |
| **Email Whitelist** | No | Yes | ✅ Add whitelist |
| **Domain Restriction** | No | Yes (@vapourdesal.com) | ✅ Add domain check |

---

### 4. Unified Security Rules Proposal

```javascript
// Proposed: firestore.rules (unified)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // AUTHENTICATION HELPERS
    // ============================================

    function isAuthenticated() {
      return request.auth != null &&
        request.auth.token.email.matches('.*@vapourdesal\\.com$') &&
        request.auth.token.email_verified == true;
    }

    // ============================================
    // ROLE HELPERS (using Custom Claims)
    // ============================================

    function getUserRoles() {
      return request.auth.token.roles;  // Array from custom claims
    }

    function hasRole(role) {
      return isAuthenticated() &&
        role in getUserRoles();
    }

    function hasAnyRole(roles) {
      return isAuthenticated() &&
        getUserRoles().hasAny(roles);
    }

    // ============================================
    // PERMISSION HELPERS
    // ============================================

    function getPermissions() {
      return request.auth.token.permissions;  // Object from custom claims
    }

    function canAccess(resource) {
      return isAuthenticated() &&
        resource in getPermissions() &&
        'read' in getPermissions()[resource];
    }

    function canModify(resource) {
      return isAuthenticated() &&
        resource in getPermissions() &&
        ('create' in getPermissions()[resource] ||
         'update' in getPermissions()[resource] ||
         'delete' in getPermissions()[resource]);
    }

    // ============================================
    // USER MANAGEMENT MODULE
    // ============================================

    match /users/{userId} {
      allow read: if isAuthenticated();  // All users can read profiles

      allow create: if isAuthenticated() &&
        userId == request.auth.uid;  // Self-registration

      allow update: if isAuthenticated() && (
        userId == request.auth.uid ||  // Self-update
        hasRole('DIRECTOR') ||  // Directors can update anyone
        hasRole('HR_ADMIN')  // HR can update
      );

      allow delete: if hasRole('DIRECTOR');  // Only directors
    }

    // User-roles collection (Functions-only write)
    match /user-roles/{email} {
      allow read: if hasAnyRole(['DIRECTOR', 'HR_ADMIN']);
      allow write: if false;  // ✅ Cloud Functions only
    }

    // ============================================
    // ENTITY MANAGEMENT MODULE
    // ============================================

    match /entities/{entityId} {
      allow read: if canAccess('entities');

      allow create, update: if canModify('entities');

      allow delete: if hasAnyRole(['DIRECTOR', 'PROCUREMENT_MANAGER']);
    }

    // ============================================
    // PROJECT MANAGEMENT MODULE
    // ============================================

    match /projects/{projectId} {
      allow read: if isAuthenticated() && (
        hasAnyRole(['DIRECTOR', 'HR_ADMIN']) ||
        request.auth.uid in resource.data.teamMembers ||
        resource.data.managerId == request.auth.uid
      );

      allow create, update, delete: if hasAnyRole(['DIRECTOR', 'PROJECT_MANAGER']);
    }

    // ============================================
    // ACCOUNTING MODULE
    // ============================================

    match /transactions/{transactionId} {
      allow read: if canAccess('transactions');

      allow create, update: if hasAnyRole(['ACCOUNTANT', 'DIRECTOR']);

      allow delete: if hasRole('DIRECTOR');
    }

    match /accounts/{accountId} {
      allow read: if canAccess('accounts');
      allow write: if hasAnyRole(['ACCOUNTANT', 'DIRECTOR']);
    }

    // ============================================
    // PROCUREMENT MODULE
    // ============================================

    match /requirements/{reqId} {
      allow read: if isAuthenticated() && (
        hasAnyRole(['DIRECTOR', 'PROCUREMENT_MANAGER', 'ENGINEERING_HEAD']) ||
        resource.data.createdBy == request.auth.uid
      );

      allow create: if hasAnyRole(['ENGINEER', 'ENGINEERING_HEAD', 'PROCUREMENT_MANAGER', 'DIRECTOR']);

      allow update: if isAuthenticated() && (
        (resource.data.createdBy == request.auth.uid && resource.data.status == 'draft') ||
        hasAnyRole(['ENGINEERING_HEAD', 'PROCUREMENT_MANAGER', 'DIRECTOR'])
      );
    }

    // ============================================
    // TIME TRACKING MODULE
    // ============================================

    match /tasks/{taskId} {
      allow read: if isAuthenticated() && (
        hasRole('DIRECTOR') ||
        resource.data.userId == request.auth.uid ||
        resource.data.createdBy == request.auth.uid ||
        (exists(/databases/$(database)/documents/projects/$(resource.data.projectId)) &&
         request.auth.uid in get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.teamMembers)
      );

      allow create: if hasRole('DIRECTOR') || canModify('tasks');

      allow update: if hasRole('DIRECTOR') || resource.data.userId == request.auth.uid;

      allow delete: if hasRole('DIRECTOR') ||
        (resource.data.createdBy == request.auth.uid && resource.data.status == 'todo');
    }

    match /timeEntries/{entryId} {
      allow read: if isAuthenticated() && (
        resource.data.userId == request.auth.uid ||
        hasAnyRole(['DIRECTOR', 'HR_ADMIN'])
      );

      allow write: if isAuthenticated() && (
        hasRole('DIRECTOR') ||
        request.auth.uid == resource.data.userId ||
        request.auth.uid == request.resource.data.userId
      );
    }

    match /leaveApplications/{leaveId} {
      allow read: if isAuthenticated() && (
        resource.data.userId == request.auth.uid ||
        hasAnyRole(['DIRECTOR', 'HR_ADMIN'])
      );

      allow create: if isAuthenticated();

      allow update: if hasAnyRole(['DIRECTOR', 'HR_ADMIN']);
    }

    // ============================================
    // ESTIMATION MODULE
    // ============================================

    match /estimates/{estimateId} {
      // Project-level RBAC from Estimate app
      allow read: if isAuthenticated() && (
        resource.data.ownerId == request.auth.uid ||
        request.auth.uid in resource.data.collaborators ||
        resource.data.visibility == 'organization'
      );

      allow write: if isAuthenticated() && (
        resource.data.ownerId == request.auth.uid ||
        // Check collaborator permissions
        hasEstimatePermission(resource, 'canEdit')
      );
    }

    // ============================================
    // AUDIT LOGS (immutable)
    // ============================================

    match /auditLogs/{logId} {
      allow read: if hasRole('DIRECTOR');
      allow create: if isAuthenticated();  // Auto-generated
      allow update, delete: if false;  // ✅ Immutable
    }

    // ============================================
    // METADATA (counters, etc.)
    // ============================================

    match /_metadata/{document} {
      allow read: if isAuthenticated();
      allow write: if false;  // ✅ Cloud Functions only
    }
  }
}
```

**Benefits:**
- ✅ Uses Firebase Custom Claims (zero DB reads for roles)
- ✅ Unified permission structure
- ✅ Module-specific rules grouped together
- ✅ Functions-only write for sensitive data
- ✅ Immutable audit logs
- ✅ Email domain verification

---

## Key Recommendations

### 1. Validation Strategy
- ✅ Extract all regex patterns to shared package
- ✅ Use Zod for all apps (consistent validation)
- ✅ Create base schemas with regional extensions
- ✅ Enforce accounting rules (debit = credit) at validation layer

### 2. Constants Management
- ✅ Extract work areas, departments, currencies to core package
- ✅ Use typed constants (`as const`) for type safety
- ✅ Include metadata (labels, icons, colors) with constants
- ✅ Version constants for backward compatibility

### 3. Security Rules
- ✅ **Adopt Time Tracker's Custom Claims approach** (superior performance)
- ✅ Store roles in Firebase ID token (updated by Functions)
- ✅ Email domain verification + whitelist
- ✅ Functions-only write for sensitive collections
- ✅ Immutable audit logs

### 4. Business Logic Preservation
- ✅ Keep accounting double-entry validation
- ✅ Keep Time Tracker's task acceptance flow
- ✅ Keep Estimate's project-level RBAC
- ✅ Keep Procure's RFQ approval workflow

---

**Status:** Validation & Constants Analysis Complete
**Next:** Service Layer Patterns & Unified Architecture Design
