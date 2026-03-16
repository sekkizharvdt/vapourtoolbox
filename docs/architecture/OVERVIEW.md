# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Hosting                         │
│                   (Static Export + CDN)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 15 (React 19)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   App Router │  │  Components  │  │   Contexts   │       │
│  │   /app/*     │  │              │  │   (Auth)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │              Service Layer (/lib)                 │       │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │       │
│  │  │  CRUD  │ │Queries │ │Workflow│ │ Hooks  │     │       │
│  │  └────────┘ └────────┘ └────────┘ └────────┘     │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │              PDF Reports (@react-pdf/renderer)    │       │
│  │  Shared components, utilities, logo management    │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Firebase                               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Firestore │  │   Auth   │  │ Storage  │  │Functions │    │
│  │ 271 idx  │  │ Claims   │  │ Docs/PDF │  │ 7 fns    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Claude   │  │Doc AI    │  │ Gmail    │  │ Sentry   │    │
│  │ (AI Help)│  │ (Parsing)│  │ (Email)  │  │ (Errors) │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Static Export Architecture

This app uses Next.js static export (`output: 'export'`) deployed to Firebase Hosting.

### Dynamic Routes

Dynamic routes use a placeholder pattern:

1. `generateStaticParams()` returns `[{ id: 'placeholder' }]`
2. Build creates `/route/placeholder.html`
3. Firebase rewrites `/route/*` → `/route/placeholder.html`
4. Client extracts actual ID from `usePathname()`

See [Development Patterns](../development/PATTERNS.md) for implementation details.

## Monorepo Structure

```
packages/
├── types/         # Shared TypeScript types (accounting, procurement, HR, thermal, etc.)
├── firebase/      # Firebase SDK wrappers, collection names, rate limiter
├── constants/     # Permissions (32+ bitwise flags), modules, status enums, transaction types
├── validation/    # Zod schemas, DOMPurify sanitization
├── functions/     # Cloud Functions source (triggers, callable functions)
├── ui/            # Shared React components
├── utils/         # Shared helper functions
└── logger/        # Structured logging (Sentry + console)

apps/
└── web/           # Main Next.js application (1,500+ source files)

mcp-servers/       # MCP servers (firebase-feedback)
scripts/           # Utility scripts (data-wipe, migrations)
```

## Authentication Flow

1. User signs in via Firebase Auth (email/password)
2. Cloud Function `onUserUpdate` syncs Firestore user data to custom claims (`permissions`, `permissions2`, `domain`, `entityId`)
3. Client `AuthContext` reads claims; `onSnapshot` listener detects `lastClaimUpdate` changes and forces token refresh
4. Permissions checked via bitwise flags in `@vapour/constants`
5. Inactive/deleted users have claims removed automatically

## Permission System

Two permission words (32 flags each) stored as bitwise integers in custom claims:

```typescript
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';

// Service-layer check (throws AuthorizationError)
requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING, userId, 'create journal entry');

// Client-side check (returns boolean)
if (hasPermission(user.permissions, PERMISSION_FLAGS.MANAGE_USERS)) { ... }
```

**Presets**: FULL_ACCESS, MANAGER, FINANCE, ENGINEERING, PROJECT_MANAGER, HR_MANAGER, PROCURER, ESTIMATOR

See `packages/constants/src/permissions.ts` for all flags.

## Data Flow

```
User Action
    │
    ▼
React Component (UI) ─── MUI v7, React Hook Form
    │
    ▼
React Query Hook (State) ─── TanStack React Query v5
    │
    ▼
Service Function (Business Logic) ─── requirePermission() + validation
    │
    ▼
Firestore (Database) ─── Security rules (1,826 lines) + triggers
    │
    ▼
Cloud Functions (Side Effects) ─── Balance recalculation, email, claims sync
```

## Key Design Decisions

| Decision            | Rationale                                               |
| ------------------- | ------------------------------------------------------- |
| Static export       | Simple deployment, CDN caching, no server costs         |
| Firestore           | Realtime sync, offline support, Firebase ecosystem      |
| Bitwise permissions | Efficient storage in custom claims (1KB limit)          |
| Service layer       | Separation of concerns, testability, permission checks  |
| React Query         | Caching, background refetch, optimistic updates         |
| Client-side PDF     | `@react-pdf/renderer` avoids Cloud Function cold starts |
| DOMPurify + Zod     | Input sanitization + type-safe validation in shared pkg |
| State machines      | All status transitions validated via `stateMachines.ts` |
| Soft deletes        | Preserve audit trail; client-side `isDeleted` filtering |

## External Integrations

| Service            | Purpose                           | Auth Method                            |
| ------------------ | --------------------------------- | -------------------------------------- |
| Anthropic Claude   | AI help widget, offer parsing     | Firebase Secret (`ANTHROPIC_API_KEY`)  |
| Google Document AI | PR form parsing, receipt OCR      | Service account                        |
| Gmail SMTP         | Email notifications (17 triggers) | Firebase Secret (`GMAIL_APP_PASSWORD`) |
| Sentry             | Error tracking and monitoring     | `NEXT_PUBLIC_SENTRY_DSN`               |

## Security Architecture

- **Defense-in-depth**: Firestore rules + service-layer `requirePermission()` + custom claims
- **Input sanitization**: DOMPurify (HTML) + Zod (structure) in `@vapour/validation`
- **HTTP headers**: HSTS, CSP, X-Frame-Options DENY, Permissions-Policy
- **Audit logging**: Financial operations, permission changes, approval workflows
- **190-finding audit**: Completed March 2026, 100% CRITICAL/HIGH resolved

See [Security Findings](../reviews/2026-03-15-security-findings.md) for full review.
