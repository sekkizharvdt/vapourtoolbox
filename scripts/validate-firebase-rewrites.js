#!/usr/bin/env node
/**
 * Validate Firebase Hosting Rewrites
 *
 * This script ensures that all dynamic routes in the Next.js app have
 * corresponding Firebase hosting rewrites configured.
 *
 * Run: node scripts/validate-firebase-rewrites.js
 *
 * This prevents the recurring issue where new dynamic routes are added
 * but Firebase rewrites are forgotten, causing pages to show the wrong
 * content (e.g., HomePage instead of the actual page).
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../apps/web/src/app');
const FIREBASE_JSON = path.join(__dirname, '../firebase.json');

/**
 * Recursively find all dynamic route directories with page.tsx files
 */
function findDynamicRoutes(dir, basePath = '') {
  const routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);
    const routePath = path.join(basePath, entry.name);

    // Check if this is a dynamic route directory (contains [param])
    if (entry.name.startsWith('[') && entry.name.endsWith(']')) {
      // Check if it has a page.tsx file
      const hasPage = fs.existsSync(path.join(fullPath, 'page.tsx'));
      if (hasPage) {
        routes.push(routePath);
      }
    }

    // Recurse into subdirectories
    const subRoutes = findDynamicRoutes(fullPath, routePath);
    routes.push(...subRoutes);
  }

  return routes;
}

/**
 * Convert Next.js route path to Firebase rewrite pattern
 * e.g., "procurement/rfqs/[id]" -> "/procurement/rfqs/*"
 */
function routeToFirebasePattern(route) {
  // Replace [param] with *
  return '/' + route.replace(/\[([^\]]+)\]/g, '*');
}

/**
 * Convert Next.js route path to expected placeholder destination
 * e.g., "procurement/rfqs/[id]" -> "/procurement/rfqs/placeholder.html"
 */
function routeToPlaceholderPath(route) {
  // Replace [param] with "placeholder"
  return '/' + route.replace(/\[([^\]]+)\]/g, 'placeholder') + '.html';
}

/**
 * Main validation function
 */
function validateRewrites() {
  console.log('🔍 Validating Firebase hosting rewrites...\n');

  // Find all dynamic routes
  const dynamicRoutes = findDynamicRoutes(APP_DIR);
  console.log(`Found ${dynamicRoutes.length} dynamic routes in Next.js app:\n`);

  // Load firebase.json
  const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
  const rewrites = firebaseConfig.hosting?.rewrites || [];

  // Create a map of existing rewrites (source -> destination)
  const rewriteMap = new Map();
  for (const rewrite of rewrites) {
    if (rewrite.source && rewrite.destination) {
      rewriteMap.set(rewrite.source, rewrite.destination);
    }
  }

  const missing = [];
  const correct = [];

  for (const route of dynamicRoutes) {
    const pattern = routeToFirebasePattern(route);
    const expectedDest = routeToPlaceholderPath(route);

    if (rewriteMap.has(pattern)) {
      const actualDest = rewriteMap.get(pattern);
      if (actualDest === expectedDest) {
        correct.push({ route, pattern, destination: expectedDest });
      } else {
        // Pattern exists but destination is wrong
        missing.push({
          route,
          pattern,
          expectedDest,
          actualDest,
          issue: 'wrong_destination',
        });
      }
    } else {
      missing.push({
        route,
        pattern,
        expectedDest,
        issue: 'missing',
      });
    }
  }

  // Report results
  if (correct.length > 0) {
    console.log('✅ Correctly configured rewrites:');
    for (const item of correct) {
      console.log(`   ${item.pattern} -> ${item.destination}`);
    }
    console.log('');
  }

  if (missing.length > 0) {
    console.log('❌ Missing or incorrect rewrites:\n');
    for (const item of missing) {
      if (item.issue === 'missing') {
        console.log(`   MISSING: ${item.pattern}`);
        console.log(`            Expected: ${item.expectedDest}`);
      } else {
        console.log(`   WRONG:   ${item.pattern}`);
        console.log(`            Expected: ${item.expectedDest}`);
        console.log(`            Actual:   ${item.actualDest}`);
      }
      console.log('');
    }

    // Generate the JSON to add
    console.log('\n📋 Add these rewrites to firebase.json (before the catch-all "**" rule):\n');
    const newRewrites = missing.map((item) => ({
      source: item.pattern,
      destination: item.expectedDest,
    }));
    console.log(JSON.stringify(newRewrites, null, 2));

    console.log('\n❌ Validation FAILED - Firebase hosting rewrites are incomplete');
    process.exit(1);
  } else {
    console.log('✅ All dynamic routes have correct Firebase hosting rewrites configured!');
    process.exit(0);
  }
}

// Run validation
validateRewrites();
