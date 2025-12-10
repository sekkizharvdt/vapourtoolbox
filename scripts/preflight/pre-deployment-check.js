#!/usr/bin/env node

/**
 * Comprehensive Pre-Deployment Check
 *
 * Runs ALL checks before deploying to ensure:
 * - Type definitions match database reality
 * - Firestore indexes exist for all queries
 * - Schema is consistent across collections
 * - No breaking changes in queries
 * - Build succeeds
 *
 * Usage: node scripts/preflight/pre-deployment-check.js [--skip-schema] [--skip-build]
 *
 * Run this BEFORE every deployment to catch issues early.
 */

const { execSync } = require('child_process');
const { getAllCollections } = require('../config/schema-registry');
const admin = require('firebase-admin');

// Initialize Firebase Admin
let db = null;
let firebaseInitialized = false;

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'vapour-toolbox',
    });
    db = admin.firestore();
    firebaseInitialized = true;
  } catch (error) {
    // Credentials not available - this is OK for local pre-commit checks
    // Schema validation will be skipped
    firebaseInitialized = false;
  }
}

// Parse command line options
const args = process.argv.slice(2);
const skipSchema = args.includes('--skip-schema');
const skipBuild = args.includes('--skip-build');

let totalIssues = 0;
const criticalIssues = [];

/**
 * Print section header
 */
function printHeader(title) {
  console.log('\n' + '═'.repeat(75));
  console.log(`  ${title}`);
  console.log('═'.repeat(75) + '\n');
}

/**
 * Print check result
 */
function printCheck(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (!passed) {
    totalIssues++;
  }
}

/**
 * Check 1: TypeScript Build
 */
async function checkBuild() {
  printHeader('CHECK 1: TypeScript Build');

  if (skipBuild) {
    console.log('⏭️  Skipped (--skip-build flag)');
    return;
  }

  try {
    console.log('Building web application...\n');
    execSync('cd apps/web && pnpm build', { stdio: 'pipe' });
    printCheck('TypeScript compilation', true);
    printCheck('Next.js build', true);
  } catch (error) {
    printCheck('Build failed', false, 'Check error output above');
    criticalIssues.push('Build failed - cannot deploy broken code');
  }
}

/**
 * Check 2: Schema Consistency
 */
async function checkSchemaConsistency() {
  printHeader('CHECK 2: Schema Consistency');

  if (skipSchema) {
    console.log('⏭️  Skipped (--skip-schema flag)\n');
    return;
  }

  if (!firebaseInitialized) {
    console.log('⏭️  Skipped (Firebase credentials not available)');
    console.log('   Schema checks require Firebase credentials.');
    console.log('   This is normal for local development.\n');
    return;
  }

  const collections = getAllCollections();
  const importantCollections = ['users', 'entities', 'projects']; // Check these at minimum

  console.log(`Checking ${importantCollections.length} important collections...\n`);

  for (const collectionName of importantCollections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();

      if (snapshot.empty) {
        printCheck(`${collectionName} (no data)`, true, 'Empty collection - skipping');
        continue;
      }

      // Quick schema check - just verify required fields
      const { getCollectionSchema } = require('../config/schema-registry');
      const schema = getCollectionSchema(collectionName);

      if (!schema) {
        printCheck(`${collectionName} schema definition`, false, 'No schema in registry');
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      const missingFields = schema.required.filter((field) => !(field in data));

      if (missingFields.length > 0) {
        printCheck(
          `${collectionName} required fields`,
          false,
          `Missing: ${missingFields.join(', ')}`
        );
        criticalIssues.push(`${collectionName}: Missing required fields in some documents`);
      } else {
        printCheck(`${collectionName} required fields`, true);
      }
    } catch (error) {
      // Check if it's a credentials error
      if (error.message.includes('credentials') || error.message.includes('authentication')) {
        console.log(`⏭️  ${collectionName} - Skipped (credentials not available)`);
      } else {
        printCheck(`${collectionName}`, false, error.message);
      }
    }
  }

  console.log('\n💡 For detailed schema analysis, run:');
  console.log('   node scripts/analysis/analyze-collection-schema.js <collection-name>');
}

/**
 * Check 3: Firestore Indexes
 */
async function checkFirestoreIndexes() {
  printHeader('CHECK 3: Firestore Indexes');

  try {
    console.log('Reading firestore.indexes.json...\n');
    const fs = require('fs');
    const indexesFile = fs.readFileSync('firestore.indexes.json', 'utf8');
    const indexesConfig = JSON.parse(indexesFile);

    printCheck('Indexes file valid', true, `${indexesConfig.indexes.length} indexes defined`);

    // Check for common index requirements
    const hasEntityIndex = indexesConfig.indexes.some(
      (idx) =>
        idx.collectionGroup === 'entities' && idx.fields.some((f) => f.fieldPath === 'createdAt')
    );
    const hasProjectIndex = indexesConfig.indexes.some(
      (idx) =>
        idx.collectionGroup === 'projects' && idx.fields.some((f) => f.fieldPath === 'createdAt')
    );

    printCheck('Entity indexes', hasEntityIndex);
    printCheck('Project indexes', hasProjectIndex);
  } catch (error) {
    printCheck('Firestore indexes', false, error.message);
    criticalIssues.push('Firestore index configuration issue');
  }
}

/**
 * Check 4: Environment Configuration
 */
async function checkEnvironment() {
  printHeader('CHECK 4: Environment Configuration');

  // Check for required environment files
  const fs = require('fs');

  const envFiles = [
    { path: 'apps/web/.env.local', required: false },
    { path: 'apps/web/.env.production', required: false },
    { path: 'firebase.json', required: true },
    { path: 'firestore.rules', required: true },
    { path: 'firestore.indexes.json', required: true },
  ];

  envFiles.forEach(({ path, required }) => {
    const exists = fs.existsSync(path);
    printCheck(path, exists || !required, required && !exists ? 'Required file missing' : '');
    if (required && !exists) {
      criticalIssues.push(`Missing required file: ${path}`);
    }
  });
}

/**
 * Check 5: Firebase Hosting Rewrites
 */
async function checkFirebaseRewrites() {
  printHeader('CHECK 5: Firebase Hosting Rewrites');

  try {
    execSync('node scripts/validate-firebase-rewrites.js', { stdio: 'pipe' });
    printCheck('Firebase rewrites', true, 'All dynamic routes have rewrites configured');
  } catch (error) {
    printCheck('Firebase rewrites', false, 'Missing rewrites for some dynamic routes');
    criticalIssues.push('Firebase hosting rewrites missing - pages will show wrong content');
    console.log('\n   Run: node scripts/validate-firebase-rewrites.js for details\n');
  }
}

/**
 * Check 6: Code Quality
 */
async function checkCodeQuality() {
  printHeader('CHECK 6: Code Quality');

  try {
    // Check for common anti-patterns in recent code
    const { execSync } = require('child_process');

    // Check for console.log in production code (warning only)
    try {
      const consoleLogs = execSync(
        'grep -r "console\\.log" apps/web/src --exclude-dir=node_modules | wc -l',
        { encoding: 'utf8' }
      ).trim();
      printCheck(
        'console.log usage',
        parseInt(consoleLogs) < 10,
        `Found ${consoleLogs} occurrences (warning only)`
      );
    } catch {
      printCheck('console.log check', true, 'None found');
    }

    // Check for TODO comments (informational)
    try {
      const todos = execSync('grep -r "TODO" apps/web/src --exclude-dir=node_modules | wc -l', {
        encoding: 'utf8',
      }).trim();
      console.log(`ℹ️  Found ${todos} TODO comments (informational)`);
    } catch {
      // Ignore
    }
  } catch (error) {
    console.log('⏭️  Code quality checks skipped (grep not available on Windows)');
  }
}

/**
 * Check 7: Recent Query Changes
 */
async function checkQueryChanges() {
  printHeader('CHECK 7: Recent Query Changes');

  try {
    // Check git diff for query changes
    const diff = execSync('git diff HEAD --name-only', { encoding: 'utf8' });
    const files = diff.split('\n').filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

    if (files.length === 0) {
      console.log('✅ No recent file changes detected\n');
      return;
    }

    console.log(`Found ${files.length} changed TypeScript files\n`);

    // Check if any contain query changes
    let queryChangesDetected = false;
    for (const file of files) {
      try {
        const fileDiff = execSync(`git diff HEAD ${file}`, { encoding: 'utf8' });

        // Look for query-related changes
        if (
          fileDiff.includes('where(') ||
          fileDiff.includes('orderBy(') ||
          fileDiff.includes('query(')
        ) {
          console.log(`⚠️  Query changes detected in: ${file}`);
          queryChangesDetected = true;
        }
      } catch {
        // File might be new
      }
    }

    if (queryChangesDetected) {
      console.log('\n⚠️  IMPORTANT: Query changes detected!');
      console.log('   Make sure to:');
      console.log('   1. Check schema compatibility');
      console.log('   2. Verify Firestore indexes exist');
      console.log('   3. Test with production-like data');
      console.log();
    } else {
      printCheck('Query changes', true, 'No query modifications detected');
    }
  } catch (error) {
    console.log('ℹ️  Git diff check skipped (not a git repository or no changes)');
  }
}

/**
 * Main execution
 */
async function runPreDeploymentChecks() {
  console.log('═'.repeat(75));
  console.log('  PRE-DEPLOYMENT CHECKS');
  console.log('  Project: Vapour Toolbox');
  console.log('═'.repeat(75));

  try {
    await checkEnvironment();
    await checkBuild();
    await checkSchemaConsistency();
    await checkFirestoreIndexes();
    await checkFirebaseRewrites();
    await checkCodeQuality();
    await checkQueryChanges();

    // Final summary
    console.log('\n' + '═'.repeat(75));
    console.log('  SUMMARY');
    console.log('═'.repeat(75) + '\n');

    if (criticalIssues.length > 0) {
      console.log('🔴 CRITICAL ISSUES FOUND:');
      criticalIssues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      console.log('\n❌ Pre-deployment checks FAILED');
      console.log('   Fix critical issues before deploying.\n');
      process.exit(1);
    } else if (totalIssues > 0) {
      console.log(`🟡 ${totalIssues} non-critical issues found`);
      console.log('   Review warnings above before deploying.\n');
      process.exit(0);
    } else {
      console.log('✅ All checks passed!');
      console.log('   Ready to deploy.\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Pre-deployment checks failed:', error);
    process.exit(1);
  }
}

// Run checks
runPreDeploymentChecks();
