# Vapour Toolbox

Enterprise resource planning system for Vapour Desal Technologies.

**Live**: https://toolbox.vapourdesal.com

## Modules

| Module              | Status     | Description                                                                                                               |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Procurement         | Production | Purchase requests, RFQs, POs, Goods receipts, Three-way match, Vendor bills & payments, Amendments                        |
| Accounting          | Production | Multi-currency GL, Chart of accounts, Fixed assets, Recurring transactions, Payment batches, Cost centres, Tax compliance |
| Projects            | Production | Project management, Charters, Objectives, Transmittals                                                                    |
| Proposals           | Production | Enquiries, Proposals, Estimation linkage, Contract generation                                                             |
| Estimation          | Production | BOM editor, Cost estimation, Equipment & components                                                                       |
| Materials           | Production | ASME/ASTM materials database — pipes, plates, fittings, flanges                                                           |
| Shapes              | Production | Parametric shapes & components with automated weight/cost calculations                                                    |
| Bought-Out Items    | Production | Valves, pumps, instruments, strainers, separation equipment with spec codes & pricing                                     |
| Documents           | Production | Company-wide documents: SOPs, policies, templates, CRS, transmittals                                                      |
| Entities            | Production | Vendors, customers, and partners                                                                                          |
| Admin               | Production | Users, permissions, company settings, feedback                                                                            |
| Flow                | Beta       | Tasks, notifications, meetings, team collaboration                                                                        |
| Services            | Beta       | Service catalog — engineering, fabrication, lab testing, inspection, consulting                                           |
| HR                  | Beta       | Leave management, travel expenses, attendance, employee directory                                                         |
| Process Data (SSOT) | Beta       | Single source of truth for process engineering data — streams, equipment, lines, instruments, valves                      |
| Thermal Desal       | Alpha      | Design calculations for thermal desalination (MED/MSF)                                                                    |
| Thermal Calculators | Alpha      | Steam tables, seawater properties, pipe sizing, heat duty                                                                 |

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
vapourtoolbox/
├── apps/
│   └── web/                 # Next.js web application
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── firebase/            # Firebase SDK wrappers
│   ├── constants/           # Constants, permissions, modules
│   ├── validation/          # Zod schemas
│   ├── ui/                  # Shared UI components
│   ├── utils/               # Shared utilities
│   ├── logger/              # Logging utilities
│   └── agent-tools/         # AI agent tooling
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
