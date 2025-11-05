#!/bin/bash

# WSL Setup Script for VDT-Unified Project
# This script will install all dependencies and set up the development environment

set -e  # Exit on error

echo "=========================================="
echo "VDT-Unified WSL Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Update system packages
echo -e "${BLUE}Step 1/8: Updating system packages...${NC}"
sudo apt-get update -qq
echo -e "${GREEN}✓ System packages updated${NC}"
echo ""

# Step 2: Install prerequisites
echo -e "${BLUE}Step 2/8: Installing prerequisites (curl, git, build-essential)...${NC}"
sudo apt-get install -y curl git build-essential > /dev/null 2>&1
echo -e "${GREEN}✓ Prerequisites installed${NC}"
echo ""

# Step 3: Configure Git
echo -e "${BLUE}Step 3/8: Configuring Git...${NC}"
git config --global core.autocrlf input
git config --global core.eol lf
echo -e "${GREEN}✓ Git configured for Linux line endings${NC}"
echo ""

# Step 4: Install nvm (Node Version Manager)
echo -e "${BLUE}Step 4/8: Installing nvm...${NC}"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  echo -e "${GREEN}✓ nvm installed${NC}"
else
  echo -e "${YELLOW}⊙ nvm already installed${NC}"
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi
echo ""

# Step 5: Install Node.js 20
echo -e "${BLUE}Step 5/8: Installing Node.js 20...${NC}"
nvm install 20 > /dev/null 2>&1
nvm use 20 > /dev/null 2>&1
nvm alias default 20 > /dev/null 2>&1
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} installed${NC}"
echo ""

# Step 6: Install pnpm
echo -e "${BLUE}Step 6/8: Installing pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm > /dev/null 2>&1
  echo -e "${GREEN}✓ pnpm installed${NC}"
else
  PNPM_VERSION=$(pnpm --version)
  echo -e "${YELLOW}⊙ pnpm ${PNPM_VERSION} already installed${NC}"
fi
echo ""

# Step 7: Install Firebase CLI
echo -e "${BLUE}Step 7/8: Installing Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
  npm install -g firebase-tools > /dev/null 2>&1
  echo -e "${GREEN}✓ Firebase CLI installed${NC}"
else
  FIREBASE_VERSION=$(firebase --version)
  echo -e "${YELLOW}⊙ Firebase CLI ${FIREBASE_VERSION} already installed${NC}"
fi
echo ""

# Step 8: Create project directory
echo -e "${BLUE}Step 8/8: Creating projects directory...${NC}"
mkdir -p ~/projects
echo -e "${GREEN}✓ ~/projects directory created${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}✓ WSL Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Installed versions:"
echo "  Node.js:  $(node --version)"
echo "  npm:      $(npm --version)"
echo "  pnpm:     $(pnpm --version)"
echo "  Firebase: $(firebase --version)"
echo ""
echo "Next steps:"
echo "  1. Copy project to WSL:   cp -r /mnt/c/Users/sekki/VDT-Unified ~/projects/"
echo "  2. Navigate to project:   cd ~/projects/VDT-Unified"
echo "  3. Install dependencies:  pnpm install"
echo ""
