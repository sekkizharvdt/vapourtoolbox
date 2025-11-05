# WSL Migration Plan

## Why Migrate to WSL?

### Current Issues on Windows:

- File path issues ("nul" file conflicts)
- Line ending warnings (CRLF vs LF)
- Slower npm/pnpm operations
- Git hooks have compatibility issues
- Firebase emulators sometimes hang

### Benefits of WSL:

- ✅ Native Linux environment (same as production)
- ✅ Faster file I/O and build times
- ✅ Better Docker/container support
- ✅ No line ending issues
- ✅ Better Firebase emulator performance
- ✅ Native bash/shell scripts

## Prerequisites

✅ WSL is already installed (confirmed by user)

Check WSL version:

```bash
wsl --version
```

Check installed distributions:

```bash
wsl --list --verbose
```

## Migration Steps

### Phase 1: WSL Environment Setup (30 minutes)

#### 1.1 Install/Update WSL Distribution

```bash
# If Ubuntu not installed:
wsl --install -d Ubuntu

# Or update existing:
wsl --update
```

#### 1.2 Configure Git in WSL

```bash
# Inside WSL
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global core.autocrlf input
git config --global core.eol lf
```

#### 1.3 Install Node.js via nvm (recommended)

```bash
# Inside WSL
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version
npm --version
```

#### 1.4 Install pnpm

```bash
npm install -g pnpm
pnpm --version
```

#### 1.5 Install Firebase CLI

```bash
npm install -g firebase-tools
firebase --version
```

### Phase 2: Project Migration (30 minutes)

#### 2.1 Clone Project in WSL

```bash
# Inside WSL
cd ~
mkdir projects
cd projects

# Clone from GitHub
git clone https://github.com/yourusername/VDT-Unified.git
cd VDT-Unified

# OR copy from Windows (faster if already checked out)
# cp -r /mnt/c/Users/sekki/VDT-Unified ~/projects/
```

#### 2.2 Install Dependencies

```bash
# Inside project root
pnpm install

# This will take 5-10 minutes
# Should be faster than Windows
```

#### 2.3 Copy Environment Files

```bash
# Copy .env files from Windows
cp /mnt/c/Users/sekki/VDT-Unified/apps/web/.env.local apps/web/
cp /mnt/c/Users/sekki/VDT-Unified/apps/web/.env.production apps/web/

# Verify they exist
ls -la apps/web/.env*
```

#### 2.4 Copy Firebase Service Account

```bash
# Copy service account key
cp /mnt/c/Users/sekki/VDT-Unified/serviceAccountKey.json .

# Verify
ls -la serviceAccountKey.json
```

### Phase 3: Verification (15 minutes)

#### 3.1 Test TypeScript Build

```bash
pnpm type-check
```

#### 3.2 Test Firebase Functions Build

```bash
cd functions
pnpm build
cd ..
```

#### 3.3 Test Dev Server

```bash
cd apps/web
pnpm dev
```

Open browser to http://localhost:3000

#### 3.4 Test Firebase Emulators

```bash
# In a separate terminal
firebase emulators:start
```

### Phase 4: VS Code Setup (10 minutes)

#### 4.1 Install VS Code WSL Extension

In Windows VS Code:

- Install "Remote - WSL" extension
- Click green icon in bottom-left corner
- Select "Connect to WSL"

#### 4.2 Open Project in WSL

```bash
# Inside WSL project directory
code .
```

This opens VS Code in WSL mode with full Linux integration.

#### 4.3 Recommended VS Code Extensions for WSL

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Firebase (Syntax highlighting)
- GitLens
- Tailwind CSS IntelliSense

### Phase 5: Cleanup (5 minutes)

#### 5.1 Stop Windows Services

- Stop any running dev servers on Windows
- Stop Firebase emulators on Windows
- Close all Windows terminals

#### 5.2 Update .gitignore (Already Done)

The .gitignore is already configured to ignore:

- node_modules
- .next/
- .env\*
- test-results/
- \*.log

## Post-Migration Workflow

### Daily Development

```bash
# Open WSL Terminal (Windows Terminal recommended)
wsl

# Navigate to project
cd ~/projects/VDT-Unified

# Start dev server
cd apps/web && pnpm dev

# In another terminal: Start emulators
firebase emulators:start
```

### VS Code Workflow

1. Open Windows Terminal
2. Type `wsl`
3. Navigate to `cd ~/projects/VDT-Unified`
4. Type `code .`
5. VS Code opens in WSL mode

## Troubleshooting

### Issue: "command not found"

```bash
# Reload shell
source ~/.bashrc

# Or restart WSL
exit
wsl
```

### Issue: Port already in use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

### Issue: Firebase emulator won't start

```bash
# Clear emulator data
rm -rf ~/.config/firebase

# Restart
firebase emulators:start
```

### Issue: Permission denied

```bash
# Fix file permissions
chmod +x scripts/*.sh
```

## Performance Comparison

### Windows (estimated):

- `pnpm install`: 8-12 minutes
- `pnpm build`: 45-60 seconds
- `pnpm dev` (hot reload): 2-3 seconds
- Git operations: Slower with hooks

### WSL (estimated):

- `pnpm install`: 3-5 minutes (2-3x faster)
- `pnpm build`: 25-35 seconds (2x faster)
- `pnpm dev` (hot reload): 0.5-1 second (3x faster)
- Git operations: Much faster

## Migration Checklist

- [ ] WSL Ubuntu installed and updated
- [ ] Git configured in WSL
- [ ] Node.js 20 installed via nvm
- [ ] pnpm installed globally
- [ ] Firebase CLI installed
- [ ] Project cloned/copied to WSL
- [ ] Dependencies installed (`pnpm install`)
- [ ] Environment files copied
- [ ] Service account key copied
- [ ] TypeScript build works
- [ ] Dev server starts successfully
- [ ] Firebase emulators start successfully
- [ ] VS Code Remote-WSL extension installed
- [ ] Project opens in VS Code WSL mode
- [ ] Can commit and push to GitHub

## Estimated Total Time: 90 minutes

**Recommended approach:**

1. Do Phase 1-3 first (75 minutes)
2. Test everything works
3. Then do Phase 4-5 (15 minutes)
4. Keep Windows version as backup for 1 week
5. Delete Windows node_modules after confirming WSL works

## Next Steps After Migration

Once WSL is set up, proceed with:

1. Build Balance Sheet report
2. Build P&L Statement
3. Build Cash Flow report
4. Add Bank Reconciliation
5. Complete Accounting module to 100%
