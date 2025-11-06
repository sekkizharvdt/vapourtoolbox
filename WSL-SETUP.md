# WSL Setup Guide for VDT-Unified

This guide explains how to work with the VDT-Unified project in WSL (Windows Subsystem for Linux).

## ✅ Setup Complete

The WSL environment has been configured with:

- **Node.js:** v20.19.5 (via NVM)
- **npm:** 10.8.2
- **pnpm:** 10.19.0
- **Project Location:** `/mnt/c/Users/sekki/VDT-Unified`

## Quick Start

### Option 1: Using the Helper Script (Recommended)

```bash
# Open WSL terminal
wsl -d Ubuntu

# Source the environment script
cd /mnt/c/Users/sekki/VDT-Unified
source ./wsl-env.sh

# Now you can run any command
pnpm dev
pnpm build
pnpm type-check
```

### Option 2: Manual Setup

```bash
# Open WSL terminal
wsl -d Ubuntu

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Navigate to project
cd /mnt/c/Users/sekki/VDT-Unified

# Run commands
pnpm dev
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build project
pnpm build

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode
pnpm test:e2e:ui
```

## Important Notes

### Line Endings

- Shell scripts (`.sh`) must use LF line endings (Unix style)
- The `.gitattributes` file ensures this automatically
- If you create new shell scripts, they will use LF automatically

### File Permissions

- WSL can access Windows files at `/mnt/c/Users/sekki/VDT-Unified`
- Changes made in WSL are immediately visible in Windows and vice versa
- Both environments work with the **same files** (not separate copies)

### Node.js Setup

- WSL uses its own Node.js installation (separate from Windows)
- Node.js v20.19.5 is installed via NVM
- NVM allows easy switching between Node versions if needed

### Git

- Git operations work the same in both Windows and WSL
- Both use the same `.git` directory
- Commits, branches, etc. are shared between Windows and WSL

## Troubleshooting

### "node: command not found"

Make sure NVM is loaded:

```bash
source ~/.nvm/nvm.sh
# Or use the helper script
source ./wsl-env.sh
```

### "permission denied" errors

Make scripts executable:

```bash
chmod +x script-name.sh
```

### Line ending issues

Convert Windows (CRLF) to Unix (LF):

```bash
sed -i 's/\r$//' file-name.sh
```

## Claude Code Working Directory

To work exclusively in WSL with Claude Code:

1. **Current Windows path:** `C:\Users\sekki\VDT-Unified`
2. **Equivalent WSL path:** `/mnt/c/Users/sekki/VDT-Unified`

Both paths point to the **same physical files** on your Windows drive.

**Note:** You need to configure your Claude Code client to use the WSL path. The exact method depends on how you're running Claude Code.

## Verifying Setup

Run this command to verify everything works:

```bash
wsl -d Ubuntu bash -c '. ~/.nvm/nvm.sh && cd /mnt/c/Users/sekki/VDT-Unified && pnpm type-check'
```

Expected output:

- All type checks should pass
- Shows turbo cache hits
- Takes ~2-3 minutes on first run (cached on subsequent runs)

## Next Steps

1. ✅ WSL environment is ready
2. ✅ Node.js and pnpm installed
3. ✅ Project verified working
4. ⏭️ Configure Claude Code to use WSL path
5. ⏭️ Start development in WSL

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-05
