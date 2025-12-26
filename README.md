# Vapour Toolbox

Enterprise resource planning system for Vapour Desal Technologies.

**Live**: https://toolbox.vapourdesal.com

## Modules

| Module      | Status     | Description                                                   |
| ----------- | ---------- | ------------------------------------------------------------- |
| Procurement | Production | Purchase requests, RFQs, POs, Goods receipts, Three-way match |
| Accounting  | Production | Multi-currency, Chart of accounts, GL, Bank reconciliation    |
| Projects    | Production | Project management, Charters, Objectives                      |
| Materials   | Production | Pipes, Plates, Fittings, Flanges inventory                    |
| Documents   | Production | Document management, CRS, Transmittals                        |
| Proposals   | Production | Enquiries, Proposals, Estimation                              |
| Estimation  | Production | BOM editor, Cost estimation                                   |
| HR          | Beta       | Leave requests, Travel expenses                               |
| Thermal     | Alpha      | Steam tables, Pipe sizing, Heat duty calculators              |
| Admin       | Production | Users, Permissions, Entity management                         |

## Tech Stack

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Frontend   | Next.js 15, React 19, Material UI 7            |
| Backend    | Firebase (Firestore, Auth, Functions, Storage) |
| Monorepo   | pnpm workspaces, Turborepo                     |
| Language   | TypeScript 5.7 (strict mode)                   |
| Testing    | Jest, Playwright                               |
| Monitoring | Sentry                                         |

## Project Structure

```
VDT-Unified/
├── apps/
│   └── web/                 # Next.js web application
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── firebase/            # Firebase SDK wrappers
│   ├── constants/           # Constants, permissions, modules
│   ├── validation/          # Zod schemas
│   ├── ui/                  # Shared UI components
│   └── logger/              # Logging utilities
├── functions/               # Firebase Cloud Functions
├── scripts/                 # Utility scripts
└── docs/                    # Documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Documentation

- [Getting Started](docs/getting-started/SETUP.md)
- [Architecture](docs/architecture/OVERVIEW.md)
- [Development Patterns](docs/development/PATTERNS.md)
- [Contributing](CONTRIBUTING.md)

## Deployment

```bash
# Build for production
pnpm --filter @vapour/web build

# Deploy to Firebase
firebase deploy
```

## Key Directories

| Path                       | Description                          |
| -------------------------- | ------------------------------------ |
| `apps/web/src/app/`        | Next.js App Router pages             |
| `apps/web/src/lib/`        | Service layer (Firestore operations) |
| `apps/web/src/components/` | React components                     |
| `packages/types/src/`      | Shared type definitions              |
| `functions/src/`           | Cloud Functions                      |

---

Proprietary - Vapour Desal Technologies Private Limited
