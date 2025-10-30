# VDT Unified Platform - Modular Architecture Design

**Version:** 1.0
**Date:** October 27, 2025
**Approach:** Monorepo with Independent Modules

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Module Design Principles](#module-design-principles)
5. [Inter-Module Communication](#inter-module-communication)
6. [Deployment Strategy](#deployment-strategy)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     VDT UNIFIED PLATFORM                        │
│                    (Single Firebase Project)                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (App Router)                                       │
│  ├── /app/users        → User Management UI                     │
│  ├── /app/entities     → Entity Management UI                   │
│  ├── /app/projects     → Project Management UI                  │
│  ├── /app/accounting   → Accounting Module UI                   │
│  ├── /app/procurement  → Procurement Module UI                  │
│  ├── /app/time         → Time Tracking Module UI                │
│  └── /app/estimation   → Estimation Module UI                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  CORE MODULES (Foundation)                                      │
│  ├── @vdt/user-management     → User & auth services            │
│  ├── @vdt/entity-management   → Entity CRUD services            │
│  ├── @vdt/project-management  → Project services                │
│  └── @vdt/company-management  → Company/dept services           │
│                                                                  │
│  APPLICATION MODULES (Features)                                 │
│  ├── @vdt/accounting          → Transaction services            │
│  ├── @vdt/procurement         → RFQ/PO services                 │
│  ├── @vdt/time-tracking       → Task/time services              │
│  └── @vdt/estimation          → Equipment/calc services         │
│                                                                  │
│  SHARED UTILITIES                                               │
│  ├── @vdt/validation          → Zod schemas                     │
│  ├── @vdt/firebase-client     → Firebase SDK wrapper            │
│  └── @vdt/ui-components       → Shared UI library               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Services                                               │
│  ├── Cloud Firestore          → NoSQL database                  │
│  ├── Firebase Auth             → Authentication                  │
│  ├── Cloud Storage             → File storage                    │
│  ├── Cloud Functions           → Backend logic                   │
│  └── Firebase Hosting          → Web hosting                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Framework** | Next.js | 15.x | App Router, RSC, best DX |
| **Language** | TypeScript | 5.9+ | Type safety across modules |
| **UI Library** | Material UI | v7 | Most apps already use MUI |
| **Styling** | MUI + Emotion | v7 | Consistent with MUI |
| **State Management** | React Query | v5 | Server state caching |
| **Form Handling** | React Hook Form + Zod | Latest | Type-safe forms |
| **Charts** | Recharts | v3 | Already used in 2 apps |
| **Tables** | TanStack Table | v8 | Best React table library |
| **Export** | xlsx, jspdf, papaparse | Latest | Multi-format export |

### Backend

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Runtime** | Node.js | 20 LTS | Firebase Functions requirement |
| **Backend** | Firebase (serverless) | Latest | Existing infrastructure |
| **Database** | Cloud Firestore | Latest | Already in use |
| **Auth** | Firebase Auth | Latest | With Custom Claims |
| **Storage** | Cloud Storage | Latest | For file uploads |
| **Functions** | Cloud Functions Gen 2 | Latest | Backend logic |

### Development Tools

| Purpose | Tool | Justification |
|---------|------|---------------|
| **Monorepo** | Turborepo | Fast, simple, great DX |
| **Package Manager** | pnpm | Efficient, fast, workspace support |
| **Testing** | Vitest + Playwright | Modern, fast |
| **Linting** | ESLint + TypeScript ESLint | Code quality |
| **Formatting** | Prettier | Consistent style |
| **CI/CD** | GitHub Actions | Firebase integration |

---

## Monorepo Structure

### File System Layout

```
vdt-unified/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Run tests on PR
│       ├── deploy-staging.yml     # Deploy to staging
│       └── deploy-production.yml  # Deploy to production
│
├── apps/
│   ├── web/                       # Main Next.js application
│   │   ├── app/                   # App Router pages
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx     # Dashboard layout
│   │   │   │   ├── users/         # User management pages
│   │   │   │   ├── entities/      # Entity management pages
│   │   │   │   ├── projects/      # Project management pages
│   │   │   │   ├── accounting/    # Accounting module pages
│   │   │   │   ├── procurement/   # Procurement module pages
│   │   │   │   ├── time/          # Time tracking module pages
│   │   │   │   └── estimation/    # Estimation module pages
│   │   │   └── api/               # API routes (if needed)
│   │   ├── components/            # App-level components
│   │   ├── lib/                   # App-level utilities
│   │   ├── public/                # Static assets
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   └── functions/                 # Firebase Cloud Functions
│       ├── src/
│       │   ├── auth/              # Auth triggers
│       │   │   ├── onCreate.ts    # Set custom claims
│       │   │   └── onDelete.ts    # Cleanup
│       │   ├── users/             # User management
│       │   │   └── updateRole.ts  # Update user roles
│       │   ├── entities/          # Entity management
│       │   │   └── generateCode.ts # Auto-generate entity codes
│       │   ├── projects/          # Project management
│       │   │   └── calculateStats.ts # Compute project stats
│       │   └── index.ts           # Export all functions
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── ============================================
│   ├── CORE MODULES
│   ├── ============================================
│   ├── user-management/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # User types
│   │   │   ├── services/
│   │   │   │   ├── userService.ts
│   │   │   │   ├── roleService.ts
│   │   │   │   └── permissionService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useUser.ts
│   │   │   │   ├── useCurrentUser.ts
│   │   │   │   └── usePermissions.ts
│   │   │   ├── components/
│   │   │   │   ├── UserForm.tsx
│   │   │   │   ├── UserList.tsx
│   │   │   │   └── RoleSelector.tsx
│   │   │   ├── validation/
│   │   │   │   └── schemas.ts     # Zod schemas
│   │   │   └── index.ts           # Public API
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── entity-management/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Entity types
│   │   │   ├── services/
│   │   │   │   ├── entityService.ts
│   │   │   │   └── documentService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useEntity.ts
│   │   │   │   ├── useEntities.ts
│   │   │   │   └── useEntityDocuments.ts
│   │   │   ├── components/
│   │   │   │   ├── EntityForm.tsx
│   │   │   │   ├── EntityList.tsx
│   │   │   │   └── EntityDocuments.tsx
│   │   │   ├── validation/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── project-management/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Project types
│   │   │   ├── services/
│   │   │   │   ├── projectService.ts
│   │   │   │   ├── teamService.ts
│   │   │   │   └── activityService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useProject.ts
│   │   │   │   ├── useProjects.ts
│   │   │   │   └── useProjectTeam.ts
│   │   │   ├── components/
│   │   │   │   ├── ProjectForm.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   └── TeamManager.tsx
│   │   │   ├── validation/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── company-management/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Company/dept types
│   │   │   ├── services/
│   │   │   │   ├── companyService.ts
│   │   │   │   └── departmentService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useCompany.ts
│   │   │   │   └── useDepartments.ts
│   │   │   ├── components/
│   │   │   │   ├── CompanyForm.tsx
│   │   │   │   └── DepartmentTree.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ============================================
│   ├── APPLICATION MODULES
│   ├── ============================================
│   ├── accounting/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Transaction types
│   │   │   ├── services/
│   │   │   │   ├── transactionService.ts
│   │   │   │   ├── accountService.ts
│   │   │   │   └── reportService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useTransaction.ts
│   │   │   │   ├── useAccounts.ts
│   │   │   │   └── useBalanceSheet.ts
│   │   │   ├── components/
│   │   │   │   ├── TransactionForm.tsx
│   │   │   │   ├── JournalEntryForm.tsx
│   │   │   │   ├── ChartOfAccounts.tsx
│   │   │   │   └── BalanceSheet.tsx
│   │   │   ├── validation/
│   │   │   │   └── schemas.ts     # Double-entry validation
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── procurement/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # PR/RFQ/PO types
│   │   │   ├── services/
│   │   │   │   ├── requirementService.ts
│   │   │   │   ├── rfqService.ts
│   │   │   │   ├── poService.ts
│   │   │   │   └── offerService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useRequirements.ts
│   │   │   │   ├── useRFQs.ts
│   │   │   │   └── usePOs.ts
│   │   │   ├── components/
│   │   │   │   ├── RequirementForm.tsx
│   │   │   │   ├── RFQForm.tsx
│   │   │   │   ├── POForm.tsx
│   │   │   │   └── PriceComparison.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── time-tracking/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Task/time types
│   │   │   ├── services/
│   │   │   │   ├── taskService.ts
│   │   │   │   ├── timeService.ts
│   │   │   │   ├── leaveService.ts
│   │   │   │   └── onDutyService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useTasks.ts
│   │   │   │   ├── useTimer.ts
│   │   │   │   ├── useLeaves.ts
│   │   │   │   └── useOnDuty.ts
│   │   │   ├── components/
│   │   │   │   ├── Timer.tsx
│   │   │   │   ├── TaskList.tsx
│   │   │   │   ├── TaskForm.tsx
│   │   │   │   ├── LeaveForm.tsx
│   │   │   │   └── OnDutyForm.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── estimation/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── index.ts       # Equipment types
│   │   │   ├── services/
│   │   │   │   ├── estimateService.ts
│   │   │   │   ├── equipmentService.ts
│   │   │   │   └── calculationService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useEstimate.ts
│   │   │   │   └── useEquipment.ts
│   │   │   ├── components/
│   │   │   │   ├── EquipmentEditor.tsx
│   │   │   │   ├── ComponentList.tsx
│   │   │   │   └── WeightCalculator.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ============================================
│   ├── SHARED UTILITIES
│   ├── ============================================
│   ├── validation/
│   │   ├── src/
│   │   │   ├── patterns.ts        # Regex patterns
│   │   │   ├── messages.ts        # Error messages
│   │   │   └── schemas/
│   │   │       ├── user.ts
│   │   │       ├── entity.ts
│   │   │       ├── project.ts
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── firebase-client/
│   │   ├── src/
│   │   │   ├── firebaseConfig.ts
│   │   │   ├── firestore.ts
│   │   │   ├── auth.ts
│   │   │   ├── storage.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui-components/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── index.ts
│   │   │   ├── theme/
│   │   │   │   └── muiTheme.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── constants/
│       ├── src/
│       │   ├── work-areas.ts
│       │   ├── departments.ts
│       │   ├── currencies.ts
│       │   ├── countries.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── turbo.json               # Turborepo config
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # Workspace config
├── firebase.json            # Firebase config
├── firestore.rules          # Unified security rules
├── firestore.indexes.json   # Database indexes
└── README.md
```

---

## Module Design Principles

### 1. Module Independence

Each module is **self-contained** with its own:
- ✅ Types (`types/index.ts`)
- ✅ Services (`services/*.ts`)
- ✅ React hooks (`hooks/*.ts`)
- ✅ Components (`components/*.tsx`)
- ✅ Validation (`validation/schemas.ts`)

**Example: Entity Management Module**

```typescript
// packages/entity-management/src/index.ts

// Public API - only export what other modules need
export * from './types';
export * from './services/entityService';
export * from './hooks/useEntity';
export * from './hooks/useEntities';
export * from './components/EntityForm';
export * from './components/EntityList';

// Internal implementation details are NOT exported
// (validation, utilities, internal components)
```

### 2. Dependency Direction

```
Application Modules → Core Modules → Shared Utilities

✅ Allowed:
- Accounting can import from User Management
- Procurement can import from Entity Management
- Time Tracking can import from Project Management

❌ Forbidden:
- User Management cannot import from Accounting
- Core modules cannot import from application modules
- Modules at same level should minimize dependencies
```

### 3. Module Communication

**Direct Imports (Preferred)**
```typescript
// In Accounting module
import { useEntity } from '@vdt/entity-management';
import { useProject } from '@vdt/project-management';
import { useCurrentUser } from '@vdt/user-management';

export function TransactionForm() {
  const { user } = useCurrentUser();
  const { entities } = useEntity({ roles: ['VENDOR'] });
  const { projects } = useProject({ status: 'active' });

  // Use data from core modules
}
```

**Events (For Loose Coupling)**
```typescript
// When a module needs to notify others without direct dependency

// In Entity Management
import { emitEvent } from '@vdt/events';

async function createEntity(data: EntityFormData) {
  const entity = await entityService.create(data);

  // Emit event for other modules to react
  emitEvent('entity:created', entity);

  return entity;
}

// In Accounting (listening)
import { onEvent } from '@vdt/events';

onEvent('entity:created', async (entity) => {
  // Create default accounts for new vendor
  if (entity.roles.includes('VENDOR')) {
    await accountService.createVendorAccounts(entity.id);
  }
});
```

### 4. Shared State Management

**React Query for Server State**
```typescript
// In each module's hooks
import { useQuery, useMutation } from '@tanstack/react-query';

export function useEntities(filters?: EntityFilters) {
  return useQuery({
    queryKey: ['entities', filters],
    queryFn: () => entityService.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: entityService.create,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}
```

**Context for UI State**
```typescript
// For app-wide UI state (theme, sidebar, etc.)
import { createContext } from 'react';

// apps/web/contexts/AppContext.tsx
export const AppContext = createContext({
  theme: 'light',
  sidebarOpen: true,
  // ...
});
```

---

## Inter-Module Communication

### Communication Patterns

#### 1. Direct Service Calls (Synchronous)

```typescript
// Time Tracking module calling Project Management

import { projectService } from '@vdt/project-management';

async function validateTaskProject(taskData: TaskFormData) {
  // Directly call project service
  const project = await projectService.getById(taskData.projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.status !== 'active') {
    throw new Error('Cannot create task for inactive project');
  }

  return project;
}
```

#### 2. Firebase Listeners (Real-time)

```typescript
// Modules can listen to Firestore changes

import { onSnapshot } from 'firebase/firestore';
import { db } from '@vdt/firebase-client';

// In Procurement module, listen to entity changes
export function useVendorUpdates(vendorId: string) {
  const [vendor, setVendor] = useState<BusinessEntity | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'entities', vendorId),
      (snapshot) => {
        setVendor(snapshot.data() as BusinessEntity);
      }
    );

    return unsubscribe;
  }, [vendorId]);

  return vendor;
}
```

#### 3. Cloud Functions (Async Processing)

```typescript
// For complex cross-module operations

// apps/functions/src/procurement/onPOApproval.ts

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createTransactionForPO } from '../accounting/transactions';
import { updateProjectSpend } from '../projects/stats';

export const onPOApproval = onDocumentUpdated('pos/{poId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  // PO was approved
  if (before.status !== 'approved' && after.status === 'approved') {
    // Create accounting transaction
    await createTransactionForPO(after);

    // Update project stats
    await updateProjectSpend(after.projectId);

    // Send notifications
    // ... etc
  }
});
```

---

## Deployment Strategy

### Development Environment

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# This runs:
# - Next.js dev server (apps/web)
# - Firebase emulators (Firestore, Auth, Functions, Storage)
# - All packages in watch mode
```

### Build & Deploy

```bash
# Build all packages
pnpm build

# Deploy to Firebase
pnpm deploy

# Or deploy specific targets
pnpm deploy:functions
pnpm deploy:firestore
pnpm deploy:hosting
```

### Environment Variables

```env
# .env.local (development)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase emulator ports
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Build all packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: pnpm deploy:staging
```

---

## Summary

### ✅ Architecture Benefits

1. **Module Independence** - Each module can be developed/tested/deployed independently
2. **Code Reusability** - Core modules shared across all applications
3. **Type Safety** - TypeScript across entire stack
4. **Performance** - Turborepo caching, Next.js optimization
5. **Scalability** - Easy to add new modules
6. **Maintainability** - Clear boundaries, single responsibility

### 📦 Deployment Flexibility

- **Monolithic** - Deploy as single Next.js app (current plan)
- **Micro-frontends** - Split modules into separate apps (future)
- **Serverless** - Firebase handles scaling automatically

### 🚀 Migration Path

1. Start with core modules (User, Entity, Project)
2. Add one application module at a time
3. Gradually migrate features from old apps
4. Run old and new in parallel during transition
5. Deprecate old apps once migration complete

---

**Status:** Modular Architecture Complete
**Next:** Implementation Roadmap & Migration Strategy
