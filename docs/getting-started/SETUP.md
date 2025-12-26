# Development Setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- Firebase CLI (`npm install -g firebase-tools`)

## Installation

```bash
# Clone repository
git clone <repo-url>
cd VDT-Unified

# Install dependencies
pnpm install

# Build shared packages
pnpm build
```

## Environment Variables

Create `apps/web/.env.local`:

```env
# Firebase (get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

## Development Server

```bash
# Start web app
pnpm dev

# Or with emulators
NEXT_PUBLIC_USE_EMULATOR=true pnpm dev
```

Open http://localhost:3000

## Firebase Emulators

```bash
# Start emulators
firebase emulators:start

# Ports:
# Auth: 9099
# Firestore: 8080
# Functions: 5001
# Storage: 9199
```

## Common Commands

```bash
# Type check all packages
pnpm type-check

# Lint
pnpm lint
pnpm lint:fix

# Test
pnpm test
pnpm test:coverage

# Build for production
pnpm --filter @vapour/web build

# Deploy
firebase deploy
```

## IDE Setup

### VS Code Extensions

- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense (if using)

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Troubleshooting

### Build errors after pulling

```bash
pnpm install
pnpm build
```

### Type errors in IDE but not in build

Restart TypeScript server: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### Firebase permission denied

1. Check you're logged in: `firebase login`
2. Check project: `firebase use`
3. Check your user has permissions in Firestore

### Port already in use

```bash
lsof -i :3000
kill -9 <PID>
```
