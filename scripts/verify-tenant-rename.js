#!/usr/bin/env node
/**
 * Verification script: Validate tenantId rename is complete and consistent.
 *
 * Checks:
 *   1. All tenant-scoped Firestore documents have `tenantId` (not stale `entityId`)
 *   2. All user documents have `tenantId`
 *   3. All user custom claims include `tenantId`
 *   4. Transaction documents still have `entityId` (counterparty — should NOT be renamed)
 *   5. No tenant-scoped documents are missing `tenantId` entirely
 *   6. Firestore rules & code consistency (static checks logged as info)
 *
 * Usage:
 *   node scripts/verify-tenant-rename.js [--fix]
 *
 *   --fix   Automatically fix issues:
 *           - Add tenantId to user docs missing it (copies from entityId or uses 'default-entity')
 *           - Trigger claims sync for users with stale claims
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key not found at: ${serviceAccountPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();
const FIX_MODE = process.argv.includes('--fix');

// ─── Collections ────────────────────────────────────────────────────────────

// Tenant-scoped collections: MUST have `tenantId`, MUST NOT have stale `entityId`
const TENANT_COLLECTIONS = [
  'accounts',
  'boms',
  'bought_out_items',
  'costConfigurations',
  'enquiries',
  'fixedAssets',
  'goodsReceipts',
  'hrLeaveRequests',
  'hrLeaveBalances',
  'hrLeaveTypes',
  'hrTravelExpenses',
  'manualTasks',
  'meetings',
  'offers',
  'onDutyRecords',
  'paymentBatches',
  'projects',
  'proposals',
  'proposalTemplates',
  'purchaseOrders',
  'purchaseRequests',
  'recurringTransactions',
  'rfqs',
  'services',
];

// Counterparty collections: `entityId` here is correct (vendor/customer ref)
const COUNTERPARTY_COLLECTIONS = ['transactions', 'auditLogs'];

// ─── Result tracking ────────────────────────────────────────────────────────

let totalChecks = 0;
let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;
const issues = [];

function pass(msg) {
  totalChecks++;
  totalPass++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  totalChecks++;
  totalFail++;
  issues.push(msg);
  console.log(`  ❌ ${msg}`);
}

function warn(msg) {
  totalChecks++;
  totalWarn++;
  console.log(`  ⚠️  ${msg}`);
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ─── Test 1: Tenant-scoped documents ────────────────────────────────────────

async function checkTenantDocuments() {
  section('1. Tenant-scoped documents — must have tenantId, no stale entityId');

  for (const col of TENANT_COLLECTIONS) {
    const snapshot = await db.collection(col).get();
    if (snapshot.empty) {
      console.log(`  ── ${col}: empty (skipped)`);
      continue;
    }

    let missingTenantId = 0;
    let hasStaleEntityId = 0;
    let ok = 0;
    const missingDocs = [];
    const staleDocs = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const hasTenant = data.tenantId !== undefined;
      // stale = has entityId that looks like a tenant value (not a counterparty doc ID)
      const hasEntity = data.entityId !== undefined;

      if (!hasTenant) {
        missingTenantId++;
        missingDocs.push(doc.id);
      } else {
        ok++;
      }

      if (hasEntity) {
        hasStaleEntityId++;
        staleDocs.push(doc.id);
      }
    }

    if (missingTenantId === 0 && hasStaleEntityId === 0) {
      pass(`${col}: ${ok} docs — all have tenantId, no stale entityId`);
    } else {
      if (missingTenantId > 0) {
        fail(
          `${col}: ${missingTenantId}/${snapshot.size} docs MISSING tenantId — ${missingDocs.slice(0, 5).join(', ')}${missingDocs.length > 5 ? '...' : ''}`
        );
      }
      if (hasStaleEntityId > 0) {
        warn(
          `${col}: ${hasStaleEntityId}/${snapshot.size} docs still have stale entityId field — ${staleDocs.slice(0, 5).join(', ')}${staleDocs.length > 5 ? '...' : ''}`
        );
      }
    }
  }
}

// ─── Test 2: User documents ─────────────────────────────────────────────────

async function checkUserDocuments() {
  section('2. User documents — must have tenantId');

  const snapshot = await db.collection('users').get();
  let missingTenantId = 0;
  let hasStaleEntityId = 0;
  let hasBoth = 0;
  let ok = 0;
  const fixBatch = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasTenant = data.tenantId !== undefined;
    const hasEntity = data.entityId !== undefined;

    if (hasTenant && !hasEntity) {
      ok++;
    } else if (hasTenant && hasEntity) {
      hasBoth++;
      warn(
        `users/${doc.id} (${data.email}): has both tenantId="${data.tenantId}" and entityId="${data.entityId}"`
      );
    } else if (!hasTenant && hasEntity) {
      missingTenantId++;
      fail(`users/${doc.id} (${data.email}): has entityId="${data.entityId}" but no tenantId`);
      fixBatch.push({ ref: doc.ref, entityId: data.entityId });
    } else {
      missingTenantId++;
      fail(`users/${doc.id} (${data.email}): missing both tenantId and entityId`);
      fixBatch.push({ ref: doc.ref, entityId: null });
    }
  }

  if (ok === snapshot.size) {
    pass(`users: all ${ok} docs have tenantId, no stale entityId`);
  } else {
    console.log(
      `  Summary: ${ok} ok, ${missingTenantId} missing tenantId, ${hasBoth} have both fields`
    );
  }

  if (FIX_MODE && fixBatch.length > 0) {
    console.log(`\n  🔧 FIX: Adding tenantId to ${fixBatch.length} user docs...`);
    for (let i = 0; i < fixBatch.length; i += 500) {
      const batch = db.batch();
      fixBatch.slice(i, i + 500).forEach(({ ref, entityId }) => {
        batch.update(ref, {
          tenantId: entityId || 'default-entity',
        });
      });
      await batch.commit();
    }
    console.log(`  🔧 Fixed ${fixBatch.length} user docs`);
  }
}

// ─── Test 3: Custom claims ──────────────────────────────────────────────────

async function checkCustomClaims() {
  section('3. Auth custom claims — active users must have tenantId in claims');

  const snapshot = await db.collection('users').where('status', '==', 'active').get();
  let ok = 0;
  let missingClaim = 0;
  let mismatch = 0;
  const problemUsers = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    try {
      const userRecord = await admin.auth().getUser(doc.id);
      const claims = userRecord.customClaims || {};

      if (!claims.tenantId) {
        missingClaim++;
        problemUsers.push({ id: doc.id, email: data.email, issue: 'missing tenantId claim' });
        fail(`users/${doc.id} (${data.email}): active user has NO tenantId in claims`);
      } else if (data.tenantId && claims.tenantId !== data.tenantId) {
        mismatch++;
        problemUsers.push({ id: doc.id, email: data.email, issue: 'tenantId mismatch' });
        fail(
          `users/${doc.id} (${data.email}): claim tenantId="${claims.tenantId}" ≠ doc tenantId="${data.tenantId}"`
        );
      } else {
        ok++;
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        warn(`users/${doc.id} (${data.email}): Firestore doc exists but no Auth record`);
      } else {
        fail(`users/${doc.id} (${data.email}): error checking claims — ${err.message}`);
      }
    }
  }

  if (ok === snapshot.size) {
    pass(`All ${ok} active users have correct tenantId in claims`);
  } else {
    console.log(`  Summary: ${ok} ok, ${missingClaim} missing claim, ${mismatch} mismatched`);
  }

  if (FIX_MODE && problemUsers.length > 0) {
    console.log(`\n  🔧 FIX: Triggering claims resync for ${problemUsers.length} users...`);
    console.log(`  (Update their user doc to trigger onUserUpdate Cloud Function)`);
    const batch = db.batch();
    for (const user of problemUsers) {
      batch.update(db.collection('users').doc(user.id), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(
      `  🔧 Touched ${problemUsers.length} user docs — Cloud Function will resync claims`
    );
  }
}

// ─── Test 4: Transaction counterparty entityId ──────────────────────────────

async function checkTransactionEntityId() {
  section('4. Transactions — entityId (counterparty) must be preserved');

  const snapshot = await db.collection('transactions').limit(50).get();
  if (snapshot.empty) {
    console.log('  ── transactions: empty (skipped)');
    return;
  }

  let hasEntityId = 0;
  let wronglyRenamed = 0;
  let neither = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.entityId !== undefined) {
      hasEntityId++;
    } else if (data.tenantId !== undefined && data.entityId === undefined) {
      // entityId was wrongly renamed to tenantId on a transaction
      wronglyRenamed++;
      fail(
        `transactions/${doc.id}: entityId was incorrectly renamed to tenantId (type: ${data.type})`
      );
    } else {
      // Some transactions may legitimately lack entityId (journal entries, bank transfers)
      neither++;
    }
  }

  if (wronglyRenamed === 0) {
    pass(
      `transactions: ${hasEntityId}/${snapshot.size} have entityId (counterparty), ${neither} have no entity (expected for JE/BT)`
    );
  }
}

// ─── Test 5: Firestore indexes ──────────────────────────────────────────────

async function checkIndexes() {
  section('5. Firestore indexes — static check');

  const indexPath = path.resolve(__dirname, '../firestore.indexes.json');
  if (!fs.existsSync(indexPath)) {
    warn('firestore.indexes.json not found — skipping index check');
    return;
  }

  const indexFile = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const indexes = indexFile.indexes || [];

  // Check that tenant-scoped collections use tenantId, not entityId
  const tenantSet = new Set(TENANT_COLLECTIONS);
  tenantSet.add('users');
  let wrongIndexes = 0;
  let correctTenantIndexes = 0;

  for (const idx of indexes) {
    const fields = idx.fields.map((f) => f.fieldPath);
    const col = idx.collectionGroup;

    if (tenantSet.has(col) && fields.includes('entityId')) {
      wrongIndexes++;
      fail(`Index on "${col}" still references entityId: [${fields.join(', ')}]`);
    }
    if (tenantSet.has(col) && fields.includes('tenantId')) {
      correctTenantIndexes++;
    }
  }

  if (wrongIndexes === 0) {
    pass(`No tenant-scoped indexes reference entityId`);
  }
  pass(`${correctTenantIndexes} indexes correctly use tenantId`);

  // Check counterparty indexes are preserved
  const counterpartySet = new Set(COUNTERPARTY_COLLECTIONS);
  let counterpartyIndexes = 0;
  for (const idx of indexes) {
    const fields = idx.fields.map((f) => f.fieldPath);
    if (counterpartySet.has(idx.collectionGroup) && fields.includes('entityId')) {
      counterpartyIndexes++;
    }
  }
  pass(`${counterpartyIndexes} counterparty indexes correctly retain entityId`);
}

// ─── Test 6: Firestore rules (static) ───────────────────────────────────────

async function checkFirestoreRules() {
  section('6. Firestore rules — tenantId enforcement on create');

  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    warn('firestore.rules not found — skipping');
    return;
  }

  const rules = fs.readFileSync(rulesPath, 'utf8');

  // Collections that SHOULD have tenantId validation on create
  const shouldHaveTenantCheck = [
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

  // Parse rules to find which collections enforce tenantId on create
  for (const col of shouldHaveTenantCheck) {
    // Look for the collection match block and check if tenantId validation exists nearby
    const matchRegex = new RegExp(
      `match /${col}/\\{[^}]+\\}[\\s\\S]*?allow create:([\\s\\S]*?)(?=allow |match /|$)`,
      'g'
    );
    const match = matchRegex.exec(rules);
    if (!match) {
      warn(`${col}: no create rule found in firestore.rules`);
      continue;
    }

    const createBlock = match[1];
    if (createBlock.includes('request.resource.data.tenantId == request.auth.token.tenantId')) {
      pass(`${col}: create rule enforces tenantId match`);
    } else {
      fail(`${col}: create rule does NOT enforce tenantId == auth.token.tenantId`);
    }
  }
}

// ─── Test 7: AuthContext (static) ───────────────────────────────────────────

async function checkAuthContext() {
  section('7. AuthContext — new user documents must include tenantId');

  const authContextPath = path.resolve(__dirname, '../apps/web/src/contexts/AuthContext.tsx');
  if (!fs.existsSync(authContextPath)) {
    warn('AuthContext.tsx not found — skipping');
    return;
  }

  const content = fs.readFileSync(authContextPath, 'utf8');

  // Find setDoc calls that create user documents (match until closing });)
  const setDocBlocks = content.match(/await setDoc\(userDocRef,\s*\{[\s\S]*?\}\);/g) || [];

  if (setDocBlocks.length === 0) {
    warn('No setDoc(userDocRef, ...) calls found in AuthContext');
    return;
  }

  let hasTenantId = 0;
  let missingTenantId = 0;

  for (let i = 0; i < setDocBlocks.length; i++) {
    if (setDocBlocks[i].includes('tenantId')) {
      hasTenantId++;
    } else {
      missingTenantId++;
    }
  }

  if (missingTenantId > 0) {
    fail(
      `AuthContext: ${missingTenantId}/${setDocBlocks.length} setDoc(userDocRef) calls are MISSING tenantId field`
    );
    console.log(`    → New users created via sign-in will lack tenantId`);
    console.log(
      `    → Cloud Function fallback sets claims to 'default-entity', but doc is incomplete`
    );
  } else {
    pass(`AuthContext: all ${hasTenantId} setDoc(userDocRef) calls include tenantId`);
  }
}

// ─── Test 8: Cloud Functions (static) ───────────────────────────────────────

async function checkCloudFunctions() {
  section('8. Cloud Functions — tenantId handling');

  const functionsDir = path.resolve(__dirname, '../packages/functions/src');
  const functionsDir2 = path.resolve(__dirname, '../functions/src');

  const filesToCheck = [];
  for (const dir of [functionsDir, functionsDir2]) {
    if (fs.existsSync(dir)) {
      const files = getAllFiles(dir, ['.ts', '.js']);
      filesToCheck.push(...files);
    }
  }

  let fallbackCount = 0;
  let directTenantCount = 0;

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(path.resolve(__dirname, '..'), file);

    // Check for entityId fallback patterns
    const fallbacks = content.match(/\.entityId\s*\|\|/g) || [];
    const directTenant = content.match(/userData\.tenantId/g) || [];

    if (fallbacks.length > 0) {
      fallbackCount += fallbacks.length;
      warn(
        `${relPath}: ${fallbacks.length} fallback(s) to entityId (backward compat — remove after migration confirmed)`
      );
    }
    if (directTenant.length > 0) {
      directTenantCount += directTenant.length;
    }
  }

  if (fallbackCount === 0) {
    pass('No Cloud Functions still fall back to entityId');
  } else {
    console.log(`    → ${fallbackCount} total entityId fallbacks across Cloud Functions`);
    console.log(`    → Safe to remove now that migration is complete`);
  }
  pass(`${directTenantCount} references to userData.tenantId (correct)`);
}

function getAllFiles(dir, extensions) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...getAllFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       TENANT RENAME VERIFICATION — vapour-toolbox        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  if (FIX_MODE) {
    console.log('\n  🔧 FIX MODE ENABLED — will attempt to fix issues\n');
  }

  await checkTenantDocuments();
  await checkUserDocuments();
  await checkCustomClaims();
  await checkTransactionEntityId();
  await checkIndexes();
  await checkFirestoreRules();
  await checkAuthContext();
  await checkCloudFunctions();

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  ✅ Passed:    ${totalPass}`);
  console.log(`  ❌ Failed:    ${totalFail}`);
  console.log(`  ⚠️  Warnings:  ${totalWarn}`);

  if (issues.length > 0) {
    console.log(`\n  Issues requiring attention:`);
    issues.forEach((issue, i) => console.log(`    ${i + 1}. ${issue}`));
  }

  if (totalFail > 0) {
    console.log(`\n  ❌ VERIFICATION FAILED — ${totalFail} issue(s) found`);
    if (!FIX_MODE) {
      console.log('  Run with --fix to auto-fix where possible');
    }
    process.exit(1);
  } else if (totalWarn > 0) {
    console.log(`\n  ⚠️  VERIFICATION PASSED WITH WARNINGS — ${totalWarn} warning(s)`);
    process.exit(0);
  } else {
    console.log('\n  ✅ ALL CHECKS PASSED');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
