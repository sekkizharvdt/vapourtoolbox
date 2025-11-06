#!/bin/bash
# WSL Environment Setup Script
# Source this script before running any commands in WSL
# Usage: . ./wsl-env.sh or source ./wsl-env.sh

# Load NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Navigate to project directory
cd /mnt/c/Users/sekki/VDT-Unified

# Display versions
echo "✅ WSL Environment Ready"
echo "📦 Node.js: $(node --version)"
echo "📦 npm: $(npm --version)"
echo "📦 pnpm: $(pnpm --version)"
echo "📁 Working Directory: $(pwd)"
echo ""
echo "You can now run:"
echo "  pnpm install      - Install dependencies"
echo "  pnpm dev          - Start dev server"
echo "  pnpm build        - Build project"
echo "  pnpm type-check   - Run type checking"
echo "  pnpm lint         - Run linting"
echo "  pnpm test:e2e     - Run E2E tests"
