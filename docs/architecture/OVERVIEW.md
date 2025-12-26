# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Hosting                         │
│                   (Static Export Build)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 15 (React 19)                    │
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
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Firebase                               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Firestore │  │   Auth   │  │ Storage  │  │Functions │    │
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
├── types/         # Shared TypeScript types
├── firebase/      # Firebase SDK, collection names
├── constants/     # Permissions, modules, status enums
├── validation/    # Zod schemas
├── ui/            # Shared React components
└── logger/        # Structured logging

apps/
└── web/           # Main Next.js application

functions/         # Firebase Cloud Functions
```

## Authentication Flow

1. User signs in with Google (Firebase Auth)
2. Cloud Function `syncCustomClaims` copies Firestore user data to custom claims
3. Client reads claims from `AuthContext`
4. Permissions checked via bitwise flags in `@vapour/constants`

## Permission System

Permissions are stored as bitwise flags:

```typescript
// Example permission check
import { hasPermission, PermissionFlag } from '@vapour/constants';

if (hasPermission(user.permissions, PermissionFlag.MANAGE_USERS)) {
  // can manage users
}
```

See `packages/constants/src/permissions.ts` for all flags.

## Data Flow

```
User Action
    │
    ▼
React Component (UI)
    │
    ▼
React Query Hook (State)
    │
    ▼
Service Function (Business Logic)
    │
    ▼
Firestore (Database)
```

## Key Design Decisions

| Decision            | Rationale                                          |
| ------------------- | -------------------------------------------------- |
| Static export       | Simple deployment, CDN caching, no server costs    |
| Firestore           | Realtime sync, offline support, Firebase ecosystem |
| Bitwise permissions | Efficient storage in custom claims (1KB limit)     |
| Service layer       | Separation of concerns, testability                |
| React Query         | Caching, background refetch, optimistic updates    |
