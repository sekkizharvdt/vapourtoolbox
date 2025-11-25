# Vapour Toolbox - Development Guide

**Unified Business Management Platform**

This is the monorepo for Vapour Toolbox, built from scratch to replace 4 fragmented applications with a unified, modular platform.

---

## 🏗️ Project Structure

```
vapour-toolbox/
├── apps/                      # Application packages
│   └── (to be created: web, api, functions)
│
├── packages/                  # Shared packages
│   ├── types/                # TypeScript type definitions
│   ├── firebase/             # Firebase configuration
│   ├── validation/           # Zod schemas & validation
│   ├── constants/            # Shared constants
│   └── ui/                   # Shared UI components (to be created)
│
├── analysis-docs/            # Analysis and design documentation
│   ├── 01-codebase-analysis/
│   ├── 02-design-documents/
│   └── 03-executive-summary/
│
├── package.json              # Root package configuration
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── turbo.json                # Turborepo configuration
└── tsconfig.json             # Root TypeScript configuration
```

---

## 📦 Packages

### Core Packages (Created)

1. **@vapour/types** - TypeScript type definitions ✅
   - User, Entity, Project, Company types
   - All application module types
   - Common types and enums

2. **@vapour/firebase** - Firebase configuration ✅
   - Client-side initialization
   - Admin SDK initialization
   - Collection references

3. **@vapour/validation** - Validation schemas ✅
   - Regex patterns (GST, PAN, phone, email, etc.)
   - Zod validation schemas
   - Helper validation functions

4. **@vapour/constants** - Configuration constants ✅
   - 10 module definitions (8 active + 2 coming soon)
   - Work areas, departments, roles
   - Currency and status configurations
   - Application settings

5. **@vapour/ui** - UI component library ✅
   - Material UI v7 with Vapour branding
   - Theme with logo colors
   - Component foundations (ready for components)

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Installation

```bash
# Install dependencies
pnpm install

# Type check all packages
pnpm type-check

# Format code
pnpm format
```

---

## 🛠️ Development

### Available Scripts

```bash
# Build all packages
pnpm build

# Start development mode
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format

# Clean all build artifacts
pnpm clean
```

### Working with Packages

Each package can be developed independently:

```bash
# Go to a specific package
cd packages/types

# Type check
pnpm type-check
```

---

## 📚 Documentation

All analysis and design documentation is in the `analysis-docs/` folder:

- **Codebase Analysis** - Understanding the current 4 applications
- **Design Documents** - Unified data model, architecture, and roadmap
- **Executive Summary** - Business case and implementation plan

---

## 🏢 Architecture Overview

### Core Principles

1. **Single Firebase Project** - One database for all data
2. **Module Independence** - Each module can function independently
3. **Shared Core** - Common functionality in shared packages
4. **Type Safety** - TypeScript everywhere
5. **Validation First** - Zod schemas for all data

### Technology Stack

- **Framework**: Next.js 15 (to be set up)
- **Language**: TypeScript 5.7+
- **UI Library**: Material UI v7 (to be set up)
- **State Management**: React Query v5 (to be set up)
- **Forms**: React Hook Form + Zod (to be set up)
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Monorepo**: Turborepo + pnpm workspaces

---

## 🔐 Firebase Configuration

Create a `.env.local` file in the root:

```bash
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for Cloud Functions)
FIREBASE_PROJECT_ID=your_project_id
```

---

## 📋 Implementation Status

### Phase 1: Foundation ✅ INFRASTRUCTURE COMPLETE

- ✅ Monorepo structure with Turborepo
- ✅ TypeScript configuration (strict mode)
- ✅ Shared types package (@vapour/types)
- ✅ Firebase configuration package (@vapour/firebase)
- ✅ Validation package (@vapour/validation)
- ✅ Constants package (@vapour/constants) - **ALL 10 MODULES DEFINED**
- ✅ UI components package (@vapour/ui) - **VAPOUR BRANDED THEME**
- ⏳ Next.js web application
- ⏳ User Management module
- ⏳ Entity Management module

### Phase 2: Core Modules (Not Started)

- ⏳ Project Management module
- ⏳ Company Management module
- ⏳ Firebase Cloud Functions
- ⏳ Security rules

### Phase 3-5: Application Modules (Not Started)

- ⏳ Time Tracking
- ⏳ Accounting
- ⏳ Procurement
- ⏳ Estimation

---

## 🤝 Contributing

This is an internal project. For questions or issues, contact the development team.

---

## 📄 License

Proprietary - All rights reserved by Vapour Design & Technology

---

**Current Version**: 0.1.0 (Initial Development)
**Last Updated**: October 27, 2025
