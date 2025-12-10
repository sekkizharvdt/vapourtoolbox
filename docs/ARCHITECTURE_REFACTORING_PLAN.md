# Architecture Refactoring Plan

**Goal:** Improve architecture grade from B to A by establishing clear module boundaries, consistent patterns, and better separation of concerns.

**Timeline:** 3-6 months (incremental, non-breaking changes)

---

## Phase 1: Reorganize lib/ Directory (Weeks 1-4)

### Current State

```
lib/                          # 208 files, 28 modules, mixed responsibilities
├── accounting/               # 50 files - services + helpers + calculations
├── procurement/              # 59 files - services + helpers + workflows
├── documents/                # 16 files - flat structure
├── thermal/                  # 10 files - pure calculations
├── shapes/                   # 5 files - pure calculations
├── utils/                    # 2 files - formatters
└── ... (20+ other modules)
```

### Target State

```
lib/
├── services/                 # Firebase-backed CRUD operations
│   ├── accounting/
│   ├── procurement/
│   ├── documents/
│   └── ...
├── domain/                   # Business logic, workflows, validations
│   ├── accounting/
│   ├── procurement/
│   └── ...
├── calculations/             # Pure functions, no Firebase
│   ├── thermal/
│   ├── shapes/
│   ├── bom/
│   └── gst/
├── helpers/                  # UI formatters, display utilities
│   ├── formatters.ts
│   ├── statusMappings.ts
│   └── ...
└── integrations/             # Cross-module orchestration
    ├── procurementToAccounting.ts
    └── ...
```

### Migration Steps

#### Step 1.1: Create New Directory Structure

```bash
mkdir -p apps/web/src/lib/{services,domain,calculations,helpers,integrations}
```

#### Step 1.2: Move Pure Calculation Files

Move files with NO Firebase imports:

| Current Location                      | New Location                   |
| ------------------------------------- | ------------------------------ |
| `lib/thermal/*.ts`                    | `lib/calculations/thermal/`    |
| `lib/shapes/*.ts`                     | `lib/calculations/shapes/`     |
| `lib/services/serviceCalculations.ts` | `lib/calculations/services.ts` |
| `lib/accounting/gstCalculator.ts`     | `lib/calculations/gst/`        |
| `lib/bom/bomCalculations.ts`          | `lib/calculations/bom/`        |

**Verification:** These files should have 0 Firebase imports.

#### Step 1.3: Extract Helper Functions

Create centralized helpers from scattered files:

```typescript
// lib/helpers/index.ts
export * from './formatters';
export * from './statusMappings';
export * from './dateHelpers';
export * from './currencyHelpers';
```

Files to consolidate:

- `lib/utils/formatters.ts` → `lib/helpers/formatters.ts`
- `lib/procurement/purchaseOrderHelpers.ts` (display functions only)
- `lib/procurement/purchaseRequestHelpers.ts` (display functions only)
- `lib/procurement/rfqHelpers.ts` (display functions only)
- `lib/accounting/paymentHelpers.ts` (display functions only)

#### Step 1.4: Move Firebase Services

Pattern: Files with `getFirebase`, `collection`, `doc`, `getDocs`, `addDoc`, etc.

```typescript
// lib/services/accounting/index.ts
export * from './fiscalYearService';
export * from './chartOfAccountsService';
export * from './costCentreService';
export * from './transactionService';
// ... etc
```

#### Step 1.5: Create Integration Layer

Extract cross-module code:

```typescript
// lib/integrations/procurementToAccounting.ts
// Currently: lib/procurement/accountingIntegration.ts

import { createGLEntry } from '@/lib/services/accounting';
import { getPurchaseOrder } from '@/lib/services/procurement';

export async function createPOAccrualEntry(poId: string) {
  // Orchestration logic
}
```

---

## Phase 2: Standardize Data Fetching (Weeks 5-8)

### Current State (Mixed Patterns)

```typescript
// Pattern 1: Direct Firestore calls
const doc = await getDoc(ref);

// Pattern 2: onSnapshot realtime
onSnapshot(query, (snapshot) => { ... });

// Pattern 3: Custom service functions
const data = await purchaseOrderService.getById(id);

// Pattern 4: Hooks
const { data } = useDocument('collection', id);
```

### Target State (Unified Pattern)

#### Option A: Service + Hook Pattern (Recommended)

```typescript
// 1. Service layer (lib/services/)
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const db = getFirebase().db;
  const docRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, id);
  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...snapshot.data() } as PurchaseOrder;
}

// 2. Hook layer (hooks/)
export function usePurchaseOrder(id: string) {
  const [data, setData] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getPurchaseOrder(id)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

// 3. Realtime variant when needed
export function usePurchaseOrderRealtime(id: string) {
  // Uses onSnapshot internally
}
```

### Migration Steps

#### Step 2.1: Audit Current Data Fetching

```bash
# Find all onSnapshot usages
grep -r "onSnapshot" apps/web/src --include="*.tsx" --include="*.ts" | wc -l

# Find all getDoc usages
grep -r "getDoc" apps/web/src --include="*.tsx" --include="*.ts" | wc -l
```

#### Step 2.2: Create Standard Hooks

```
hooks/
├── useDocument.ts          # Single document fetch
├── useDocumentRealtime.ts  # Single document with realtime
├── useCollection.ts        # Collection query
├── useCollectionRealtime.ts
└── useMutation.ts          # Create/Update/Delete operations
```

#### Step 2.3: Migrate Components

Priority order:

1. Page components (highest impact)
2. Detail views
3. List views
4. Forms

---

## Phase 3: Define Module Boundaries (Weeks 9-12)

### Current Cross-Module Imports

```
procurement/ ──imports──> accounting/glEntryGenerator.ts
                      ──> accounting/paymentHelpers.ts
accounting/  ──imports──> tasks/ (audit logging)
bom/         ──imports──> shapes/, services/
```

### Target: Explicit Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                      EXTERNAL BOUNDARY                       │
│  (Only these modules can import from each other)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │Procurement│────>│Accounting│────>│  Audit   │           │
│  └──────────┘     └──────────┘     └──────────┘           │
│        │                                                    │
│        v                                                    │
│  ┌──────────┐                                              │
│  │ Projects │                                              │
│  └──────────┘                                              │
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │   BOM    │────>│  Shapes  │────>│Materials │           │
│  └──────────┘     └──────────┘     └──────────┘           │
│                                                             │
│  ┌──────────┐     ┌──────────┐                            │
│  │ Thermal  │────>│   SSOT   │  (isolated engineering)    │
│  └──────────┘     └──────────┘                            │
│                                                             │
│  ┌──────────┐                                              │
│  │Documents │  (completely isolated)                       │
│  └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Enforcement Mechanism

#### Step 3.1: Create Module Boundary Config

```typescript
// lib/.module-boundaries.ts (documentation + lint rule reference)
export const MODULE_DEPENDENCIES = {
  procurement: ['accounting', 'projects'],
  accounting: ['audit'],
  bom: ['shapes', 'services', 'materials'],
  thermal: ['ssot'],
  documents: [], // No external dependencies allowed
} as const;
```

#### Step 3.2: Add ESLint Rule

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // Documents cannot import from accounting or procurement
          {
            target: './apps/web/src/lib/documents',
            from: './apps/web/src/lib/accounting',
          },
          {
            target: './apps/web/src/lib/documents',
            from: './apps/web/src/lib/procurement',
          },
          // Accounting cannot import from procurement (reverse dependency)
          {
            target: './apps/web/src/lib/accounting',
            from: './apps/web/src/lib/procurement',
          },
        ],
      },
    ],
  },
};
```

---

## Phase 4: Standardize Layout Patterns (Weeks 13-14)

### Current State (Inconsistent)

```
app/
├── accounting/
│   ├── layout.tsx        # Uses ModuleLayout
│   └── page.tsx          # No wrapper
├── projects/
│   ├── layout.tsx        # Uses ModuleLayout
│   └── [id]/
│       └── page.tsx      # Uses AuthenticatedLayout directly (BUG RISK)
```

### Target State (Consistent)

```typescript
// RULE: Page components NEVER wrap themselves in layout components
// layout.tsx files handle all layout wrapping

// app/[module]/layout.tsx
export default function ModuleLayout({ children }) {
  return (
    <AuthenticatedLayout requiredModule="MODULE_NAME">
      {children}
    </AuthenticatedLayout>
  );
}

// app/[module]/page.tsx
export default function ModulePage() {
  return <ModulePageContent />; // NO layout wrapper
}

// app/[module]/[id]/page.tsx
export default function DetailPage() {
  return <DetailPageContent />; // NO layout wrapper, inherits from parent layout
}
```

### Migration Steps

#### Step 4.1: Audit Layout Usage

```bash
# Find pages that import AuthenticatedLayout
grep -r "AuthenticatedLayout" apps/web/src/app --include="*.tsx" | grep -v layout.tsx
```

#### Step 4.2: Create Layout Convention Document

Document in `.claude/patterns/layout-convention.md`:

- Layout components only in `layout.tsx` files
- Page components receive layout from parent
- Dynamic routes inherit from segment layout

#### Step 4.3: Fix Non-Compliant Pages

Remove layout wrappers from page components that should inherit.

---

## Phase 5: Simplify Permission System (Weeks 15-16)

### Current State

```typescript
// Two bitfield numbers
permissions: number; // bits 0-31 (32 flags)
permissions2: number; // bits 0-11 (12 flags)
// Total: 44 possible permission flags
```

### Target State

```typescript
// Option A: Role-based with overrides
interface UserPermissions {
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
  moduleOverrides?: {
    [module: string]: 'FULL' | 'EDIT' | 'VIEW' | 'NONE';
  };
}

// Option B: Simplified bitfield (single number, 32 bits max)
// Group related permissions, remove unused ones
```

### Analysis Needed

1. Audit which permissions are actually used
2. Identify permission combinations (roles)
3. Determine if 44 flags are necessary

---

## Success Metrics

| Metric                 | Current      | Target                      | How to Measure        |
| ---------------------- | ------------ | --------------------------- | --------------------- |
| Cross-module imports   | Uncontrolled | Explicit graph              | ESLint violations = 0 |
| Data fetching patterns | 4+           | 2 (service + hook)          | Grep for patterns     |
| Layout consistency     | ~60%         | 100%                        | Audit page components |
| Pure calculation files | Mixed        | Isolated in `/calculations` | No Firebase imports   |
| Integration points     | Scattered    | `/integrations`             | Single directory      |

---

## Implementation Priority

### Quick Wins (Do First)

1. ✅ Move pure calculation files (no breaking changes)
2. ✅ Create helpers consolidation
3. ✅ Document layout convention

### Medium Effort

4. Create standard data fetching hooks
5. Add ESLint module boundary rules
6. Migrate integration code

### Long-term

7. Refactor services into new structure
8. Simplify permission system
9. Full layout pattern compliance

---

## Risk Mitigation

| Risk                             | Mitigation                             |
| -------------------------------- | -------------------------------------- |
| Breaking imports during refactor | Use path aliases, update incrementally |
| Test failures after moves        | Run tests after each file move         |
| Team confusion                   | Document changes in PR descriptions    |
| Performance regression           | Monitor bundle size during moves       |

---

_Plan created: December 10, 2025_
_Review date: End of each phase_
