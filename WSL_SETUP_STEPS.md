# WSL Setup - Step by Step Guide

Follow these steps in order. Copy and paste each command into your WSL Ubuntu terminal.

## Step 1: Open WSL Ubuntu Terminal

Open Windows Terminal (or PowerShell) and run:

```bash
wsl -d Ubuntu
```

You should now see a Linux prompt like: `username@hostname:~$`

---

## Step 2: Update System & Install Prerequisites (2-3 minutes)

```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential
```

**Expected output:** Packages will install, may ask for your password

---

## Step 3: Configure Git

```bash
git config --global core.autocrlf input
git config --global core.eol lf
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Note:** Replace "Your Name" and email with your actual details

---

## Step 4: Install nvm (Node Version Manager) (1 minute)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

**Then reload your shell:**

```bash
source ~/.bashrc
```

**Verify nvm installed:**

```bash
nvm --version
```

**Expected output:** `0.39.7` or similar

---

## Step 5: Install Node.js 20 (2-3 minutes)

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

**Verify Node.js installed:**

```bash
node --version
npm --version
```

**Expected output:**

- Node: `v20.x.x`
- npm: `10.x.x`

---

## Step 6: Install pnpm (1 minute)

```bash
npm install -g pnpm
```

**Verify pnpm installed:**

```bash
pnpm --version
```

**Expected output:** `9.x.x` or similar

---

## Step 7: Install Firebase CLI (1-2 minutes)

```bash
npm install -g firebase-tools
```

**Verify Firebase CLI installed:**

```bash
firebase --version
```

**Expected output:** `13.x.x` or similar

---

## Step 8: Create Projects Directory

```bash
mkdir -p ~/projects
cd ~/projects
```

---

## Step 9: Copy Project from Windows to WSL (5-10 minutes)

**Option A: Copy from Windows (Faster - recommended)**

```bash
cp -r /mnt/c/Users/sekki/VDT-Unified ~/projects/
cd ~/projects/VDT-Unified
```

**Option B: Clone from GitHub (if you want a fresh copy)**

```bash
cd ~/projects
git clone https://github.com/sekkizharvdt/vapourtoolbox.git VDT-Unified
cd VDT-Unified
```

**Verify you're in the project:**

```bash
pwd
ls -la
```

**Expected output:**

- pwd: `/home/username/projects/VDT-Unified`
- ls: Should show apps/, packages/, functions/, etc.

---

## Step 10: Install Project Dependencies (5-10 minutes)

```bash
pnpm install
```

**This will take 5-10 minutes.** You'll see many packages being installed.

**Expected output:**

```
Packages: +2847
+++++++++++++++++++++++++++
Progress: resolved 2847, reused 2847, downloaded 0, added 2847
```

---

## Step 11: Copy Environment Files

```bash
# Copy .env.local
cp /mnt/c/Users/sekki/VDT-Unified/apps/web/.env.local apps/web/

# Copy .env.production
cp /mnt/c/Users/sekki/VDT-Unified/apps/web/.env.production apps/web/

# Verify they exist
ls -la apps/web/.env*
```

**Expected output:** Should show `.env.local` and `.env.production`

---

## Step 12: Copy Firebase Service Account Key

```bash
cp /mnt/c/Users/sekki/VDT-Unified/serviceAccountKey.json .

# Verify it exists
ls -la serviceAccountKey.json
```

**Expected output:** Should show the service account key file

---

## Step 13: Test TypeScript Build (1-2 minutes)

```bash
pnpm type-check
```

**Expected output:** Should complete without errors

---

## Step 14: Build Firebase Functions (1-2 minutes)

```bash
cd functions
pnpm build
cd ..
```

**Expected output:**

```
> build
> tsc
```

Should complete without errors.

---

## Step 15: Test Dev Server (Open in 2 terminals)

**Terminal 1: Start Dev Server**

```bash
cd ~/projects/VDT-Unified/apps/web
pnpm dev
```

**Expected output:**

```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
✓ Ready in 3s
```

**Terminal 2: Start Firebase Emulators**

Open a NEW WSL terminal (keep the dev server running), then:

```bash
cd ~/projects/VDT-Unified
firebase emulators:start
```

**Expected output:**

```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready!                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────┬────────────────┬─────────────────────────────┐│
│ │ Emulator  │ Host:Port      │ View in Emulator UI         ││
│ ├───────────┼────────────────┼─────────────────────────────┤│
│ │ Auth      │ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth ││
│ │ Functions │ 127.0.0.1:5001 │ http://127.0.0.1:4000/...  ││
│ │ Firestore │ 127.0.0.1:8080 │ http://127.0.0.1:4000/...  ││
│ └───────────┴────────────────┴─────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Step 16: Test in Browser

Open your browser to: **http://localhost:3000**

You should see the VDT-Unified login page.

---

## ✅ Setup Complete!

### Your WSL Environment is Ready! 🎉

**Installed:**

- ✅ Ubuntu (WSL 2)
- ✅ Node.js 20
- ✅ pnpm
- ✅ Firebase CLI
- ✅ Project dependencies
- ✅ Environment files
- ✅ Dev server running
- ✅ Firebase emulators running

---

## Daily Workflow (After Setup)

### Starting Your Dev Environment

1. **Open WSL Terminal:**

   ```bash
   wsl -d Ubuntu
   cd ~/projects/VDT-Unified
   ```

2. **Terminal 1 - Start Dev Server:**

   ```bash
   cd apps/web
   pnpm dev
   ```

3. **Terminal 2 - Start Firebase Emulators:**

   ```bash
   firebase emulators:start
   ```

4. **Open Browser:**
   - Dev app: http://localhost:3000
   - Emulator UI: http://localhost:4000

### Opening Project in VS Code (WSL Mode)

```bash
cd ~/projects/VDT-Unified
code .
```

This will open VS Code connected to WSL (you'll see "WSL: Ubuntu" in the bottom-left corner).

---

## Troubleshooting

### Issue: "nvm: command not found" after installation

**Fix:**

```bash
source ~/.bashrc
# Or restart your terminal
```

### Issue: Port 3000 already in use

**Fix:**

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

### Issue: "Permission denied" errors

**Fix:**

```bash
chmod +x scripts/*.sh
```

### Issue: Firebase emulator won't start

**Fix:**

```bash
# Clear emulator data
rm -rf ~/.config/firebase

# Restart
firebase emulators:start
```

---

## Performance Gains You'll See

**Before (Windows):**

- `pnpm install`: 8-12 minutes
- `pnpm build`: 45-60 seconds
- Hot reload: 2-3 seconds

**After (WSL):**

- `pnpm install`: 3-5 minutes ⚡ (2-3x faster)
- `pnpm build`: 25-35 seconds ⚡ (2x faster)
- Hot reload: 0.5-1 second ⚡ (3x faster)

---

## Next Steps

Once WSL is working, proceed to **Day 1 Afternoon** of the sprint plan:

- Build Balance Sheet report (Part 1)

Open `SPRINT_PLAN_2_WEEKS.md` for detailed instructions.

---

## Need Help?

If you get stuck at any step:

1. Note which step you're on
2. Copy the error message
3. Ask for help

Let's get you up and running! 🚀
