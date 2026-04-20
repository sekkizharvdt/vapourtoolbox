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

// ─── Check 6: setDoc/addDoc/batch.set in tenant-scoped collections must include tenantId ──

function checkDocCreationHasTenantId() {
  console.log(
    '\n  Check 6: Document creation calls include tenantId for tenant-scoped collections'
  );

  // Collections that are NOT tenant-scoped (safe to create without tenantId)
  const nonTenantCollections = [
    'users',
    'taskNotifications',
    'entities',
    'entity_contacts',
    'materials',
    'shapes',
    'boughtOutItems',
    'bought_out_items',
    'auditLogs',
    'notificationSettings',
    'company',
    'counters',
    'idempotency',
    'aggregations',
    'materialPrices',
    'stockMovements',
    'exchangeRates',
    'currencyConfig',
    'systemStatus',
    'feedback',
    'hrConfig',
    'hrHolidays',
    'holidayWorkingOverrides',
    'hrLeaveTypes',
    'hrLeaveBalances',
    'hrLeaveRequests',
    'hrCompOffGrants',
    'onDutyRecords',
    'periodLockAudit',
    'amendmentApprovalHistory',
    'timeEntries',
    'time_entries', // scoped by userId, not tenantId (see firestore.rules:300)
    'TIME_ENTRIES', // matches `COLLECTIONS.TIME_ENTRIES` literal in source
    // Transactions are explicitly single-tenant per CLAUDE.md rule 1
    // ("Transaction queries should NOT filter by tenant"). BaseTransaction
    // has no tenantId field — entityId on transactions refers to the
    // counterparty (vendor/customer), not the business tenant.
    'transactions',
    'TRANSACTIONS',
  ];

  // Get staged .ts/.tsx files (only check what's being committed)
  let stagedFiles;
  try {
    stagedFiles = execSync(
      'git diff --cached --name-only --diff-filter=ACM -- "*.ts" "*.tsx" 2>/dev/null || true',
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    stagedFiles = [];
  }

  if (stagedFiles.length === 0) {
    pass('No staged TypeScript files to check');
    return;
  }

  // Skip test files and migration scripts — they create test fixtures, not real documents
  const filesToCheck = stagedFiles.filter(
    (f) =>
      !f.includes('__test__') &&
      !f.includes('__integration__') &&
      !f.includes('.test.') &&
      !f.includes('.spec.') &&
      !f.includes('scripts/') &&
      !f.includes('seed/')
  );

  if (filesToCheck.length === 0) {
    pass('No non-test staged files to check');
    return;
  }

  let violations = 0;
  let filesChecked = 0;

  for (const file of filesToCheck) {
    const fullPath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    // Find setDoc(, addDoc(, batch.set( calls
    const docWritePattern = /\b(setDoc|addDoc)\s*\(|batch\.set\s*\(/;

    for (let i = 0; i < lines.length; i++) {
      if (!docWritePattern.test(lines[i])) continue;

      // Extract the statement: from the write call to its closing ");".
      // Track parenthesis depth to find the full call expression.
      let depth = 0;
      let statementLines = [];
      let foundOpen = false;
      for (let j = i; j < Math.min(lines.length, i + 50); j++) {
        statementLines.push(lines[j]);
        for (const ch of lines[j]) {
          if (ch === '(') {
            depth++;
            foundOpen = true;
          }
          if (ch === ')') {
            depth--;
          }
        }
        if (foundOpen && depth <= 0) break;
      }
      const statement = statementLines.join('\n');

      // Also grab a small window before the call for variable refs (e.g., the data var)
      const preambleStart = Math.max(0, i - 10);
      const preamble = lines.slice(preambleStart, i).join('\n');

      // Check if this targets a non-tenant-scoped collection.
      // Matches either a literal string ('time_entries' / "time_entries")
      // OR a COLLECTIONS.KEY reference (SCREAMING_SNAKE_CASE with word boundary),
      // so files that reference collections via `COLLECTIONS.TIME_ENTRIES` are
      // recognised too.
      const fullContext = preamble + '\n' + statement;
      const isNonTenant = nonTenantCollections.some((col) => {
        const stringMatch =
          fullContext.includes(`'${col}'`) ||
          fullContext.includes(`"${col}"`) ||
          fullContext.includes(`\`${col}\``);
        if (stringMatch) return true;
        // Bare identifier match for SCREAMING_SNAKE_CASE collection keys.
        if (/^[A-Z][A-Z0-9_]*$/.test(col)) {
          return new RegExp(`\\b${col}\\b`).test(fullContext);
        }
        return false;
      });

      if (isNonTenant) continue;

      // Check if this is a subcollection write (e.g., boms/{id}/items) — these
      // inherit tenant scope from the parent document
      if (
        fullContext.includes('/items') ||
        fullContext.includes('SUBCOLLECTIONS') ||
        fullContext.includes('subcollection')
      ) {
        continue;
      }

      // Check if this is writing to a utility/system collection (counters, idempotency, aggregations)
      if (
        fullContext.includes('counterRef') ||
        fullContext.includes('CounterRef') ||
        fullContext.includes('idempotency') ||
        fullContext.includes('aggregation') ||
        fullContext.includes('Aggregation') ||
        fullContext.includes('placeholderDoc')
      ) {
        continue;
      }

      // Check if tenantId is in the data being written.
      // First check the statement itself (catches inline objects with tenantId).
      if (statement.includes('tenantId')) continue;

      // If data is passed as a variable, check the surrounding function scope.
      // Search 300 lines above the call for tenantId — this covers the data
      // object construction and function parameters even in large functions.
      const scopeStart = Math.max(0, i - 300);
      const scope = lines.slice(scopeStart, i + 5).join('\n');
      if (scope.includes('tenantId')) continue;

      // This is a potential violation
      violations++;
      fail(
        `${file}:${i + 1} — setDoc/addDoc/batch.set without tenantId in data (tenant-scoped collection)`
      );
      console.log(`    ${lines[i].trim()}`);
    }

    filesChecked++;
  }

  if (violations === 0) {
    pass(
      `All document creation calls in ${filesChecked} staged file(s) include tenantId or target non-tenant collections`
    );
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
  checkDocCreationHasTenantId();

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
