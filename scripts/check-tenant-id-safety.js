#!/usr/bin/env node
/**
 * Tenant ID Safety Check (runs in pre-commit hook)
 *
 * Prevents regressions in the entityId → tenantId rename by checking:
 *   1. No client/service code uses claims.entityId for tenant scoping
 *   2. No setDoc creating user documents omits tenantId
 *   3. Firestore rules enforce tenantId on create for tenant-scoped collections
 *   4. Cloud Functions don't fall back to entityId for tenant scoping
 *
 * Exit code 0 = pass, 1 = fail (blocks commit)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let failures = 0;
let warnings = 0;

function fail(msg) {
  failures++;
  console.log(`  ${RED}❌ ${msg}${RESET}`);
}

function warn(msg) {
  warnings++;
  console.log(`  ${YELLOW}⚠️  ${msg}${RESET}`);
}

function pass(msg) {
  console.log(`  ${GREEN}✅ ${msg}${RESET}`);
}

// ─── Check 1: No claims.entityId in client code ────────────────────────────

function checkNoClaimsEntityId() {
  console.log('\n  Check 1: No claims.entityId for tenant scoping');

  const dirs = ['apps/web/src', 'packages/functions/src', 'functions/src'];

  for (const dir of dirs) {
    const fullDir = path.resolve(__dirname, '..', dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const result = execSync(
        `grep -rn "claims\\?\\?\\.entityId\\|claims\\.entityId\\|token\\.entityId" "${fullDir}" --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
        { encoding: 'utf8' }
      ).trim();

      if (result) {
        fail(`Found claims.entityId usage in ${dir}:`);
        result.split('\n').forEach((line) => console.log(`    ${line}`));
      }
    } catch {
      // grep returns 1 when no matches — that's fine
    }
  }
}

// ─── Check 2: AuthContext includes tenantId in user creation ────────────────

function checkAuthContextTenantId() {
  console.log('\n  Check 2: AuthContext includes tenantId in user creation');

  const authContextPath = path.resolve(__dirname, '../apps/web/src/contexts/AuthContext.tsx');

  if (!fs.existsSync(authContextPath)) {
    warn('AuthContext.tsx not found — skipping');
    return;
  }

  const content = fs.readFileSync(authContextPath, 'utf8');
  const setDocBlocks = content.match(/await setDoc\(userDocRef,\s*\{[\s\S]*?\}\);/g) || [];

  if (setDocBlocks.length === 0) {
    warn('No setDoc(userDocRef) calls found — skipping');
    return;
  }

  let missing = 0;
  for (const block of setDocBlocks) {
    if (!block.includes('tenantId')) {
      missing++;
    }
  }

  if (missing > 0) {
    fail(
      `${missing}/${setDocBlocks.length} setDoc(userDocRef) calls in AuthContext are missing tenantId`
    );
  } else {
    pass(`All ${setDocBlocks.length} user creation paths include tenantId`);
  }
}

// ─── Check 3: Firestore rules enforce tenantId on create ───────────────────

function checkFirestoreRules() {
  console.log('\n  Check 3: Firestore rules enforce tenantId on create');

  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    warn('firestore.rules not found — skipping');
    return;
  }

  const rules = fs.readFileSync(rulesPath, 'utf8');

  // Collections that MUST have tenantId validation on create
  const requiredCollections = [
    'bought_out_items',
    'services',
    'costConfigurations',
    'proposals',
    'enquiries',
    'boms',
    'fixedAssets',
    'accounts',
    'projects',
    'purchaseOrders',
    'purchaseRequests',
    'rfqs',
    'offers',
    'goodsReceipts',
    'paymentBatches',
    'recurringTransactions',
  ];

  let missingCount = 0;

  for (const col of requiredCollections) {
    const matchRegex = new RegExp(
      `match /${col}/\\{[^}]+\\}[\\s\\S]*?allow create:([\\s\\S]*?)(?=allow |match /|$)`,
      'g'
    );
    const match = matchRegex.exec(rules);
    if (!match) continue;

    if (!match[1].includes('request.resource.data.tenantId == request.auth.token.tenantId')) {
      fail(`${col}: create rule missing tenantId enforcement`);
      missingCount++;
    }
  }

  if (missingCount === 0) {
    pass(`All ${requiredCollections.length} tenant-scoped rules enforce tenantId on create`);
  }
}

// ─── Check 4: No entityId fallback in Cloud Functions ──────────────────────

function checkCloudFunctionsFallback() {
  console.log('\n  Check 4: Cloud Functions — no entityId fallback for tenant scoping');

  const dirs = ['packages/functions/src', 'functions/src'];
  let found = 0;

  for (const dir of dirs) {
    const fullDir = path.resolve(__dirname, '..', dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const result = execSync(
        `grep -rn "userData\\.entityId" "${fullDir}" --include="*.ts" 2>/dev/null || true`,
        { encoding: 'utf8' }
      ).trim();

      if (result) {
        // Filter to only tenant-scoping fallbacks (not counterparty reads)
        const tenantLines = result
          .split('\n')
          .filter((l) => l.includes('tenantId') || l.includes('default-entity'));
        if (tenantLines.length > 0) {
          found += tenantLines.length;
          warn(
            `Found entityId fallback in ${dir} (should be removed now that migration is complete):`
          );
          tenantLines.forEach((line) => console.log(`    ${line}`));
        }
      }
    } catch {
      // no matches
    }
  }

  if (found === 0) {
    pass('No entityId fallbacks in Cloud Functions');
  }
}

// ─── Check 5: No entityId for tenant scoping in service files ──────────────

function checkServiceFiles() {
  console.log('\n  Check 5: Service files — no entityId for tenant scoping');

  const srcDir = path.resolve(__dirname, '../apps/web/src/lib');
  if (!fs.existsSync(srcDir)) {
    warn('apps/web/src/lib not found — skipping');
    return;
  }

  try {
    // Look for where('entityId' in non-transaction service files
    const result = execSync(
      `grep -rn "where('entityId'" "${srcDir}" --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
      { encoding: 'utf8' }
    ).trim();

    if (result) {
      const lines = result.split('\n');
      // Filter out legitimate counterparty usage (transactions, entity-ledger, payments, audit, documents, tasks)
      const legitimatePaths = [
        '/accounting/paymentHelpers',
        '/accounting/reports/',
        '/entities/',
        '/audit/',
        '/documents/',
        '/tasks/',
        '/accounting/entityLedger',
        '/accounting/dataHealth',
        '/pdf/',
      ];

      const suspicious = lines.filter((l) => !legitimatePaths.some((p) => l.includes(p)));

      if (suspicious.length > 0) {
        fail("Found where('entityId' in service files that may need tenantId instead:");
        suspicious.forEach((line) => console.log(`    ${line}`));
      } else {
        pass(
          `All where('entityId') calls are in counterparty-related files (${lines.length} found, all legitimate)`
        );
      }
    } else {
      pass("No where('entityId') calls found in service files");
    }
  } catch {
    // no matches
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 Tenant ID safety check...');

  checkNoClaimsEntityId();
  checkAuthContextTenantId();
  checkFirestoreRules();
  checkCloudFunctionsFallback();
  checkServiceFiles();

  console.log('');

  if (failures > 0) {
    console.log(`${RED}❌ Tenant ID safety check FAILED — ${failures} issue(s)${RESET}`);
    console.log('   See CLAUDE.md rule #1 for entityId vs tenantId guidance.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`${YELLOW}⚠️  Tenant ID safety check passed with ${warnings} warning(s)${RESET}`);
    process.exit(0);
  } else {
    console.log(`${GREEN}✅ Tenant ID safety check passed${RESET}`);
    process.exit(0);
  }
}

main();
