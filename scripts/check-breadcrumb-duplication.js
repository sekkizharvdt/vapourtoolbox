#!/usr/bin/env node
/**
 * Breadcrumb Duplication Safety Check (runs in pre-commit hook)
 *
 * Pages inside route trees whose parent layout already renders breadcrumbs
 * MUST NOT render their own. Two breadcrumb bars stacked on top of each
 * other is the bug this guard prevents.
 *
 * Current auto-breadcrumb layouts:
 *   - apps/web/src/app/admin/layout.tsx (covers /admin/*)
 *   - apps/web/src/app/projects/[id]/components/ProjectSubPageWrapper.tsx
 *     (covers any project sub-page that wraps itself in the component)
 *
 * This script checks: no file under app/admin/** imports `Breadcrumbs` from
 * `@mui/material` or uses `<PageBreadcrumbs>`. The only allowed Breadcrumbs
 * in that tree is admin/layout.tsx itself.
 *
 * The ProjectSubPageWrapper case is harder to detect statically (would need
 * AST analysis to spot `<Breadcrumbs>` inside a component that renders
 * `<ProjectSubPageWrapper>`), so it's documented in UI-STANDARDS rule 5.4
 * and relies on code review.
 *
 * Exit code 0 = pass, 1 = fail (blocks commit)
 *
 * See UI-STANDARDS.md rule 5.4 for the full rule.
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let failures = 0;

function fail(msg) {
  failures++;
  console.log(`  ${RED}❌ ${msg}${RESET}`);
}

function pass(msg) {
  console.log(`  ${GREEN}✅ ${msg}${RESET}`);
}

/**
 * Recursively walk a directory and yield every .ts/.tsx file path.
 */
function* walkTs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      yield* walkTs(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

function checkAdminTree() {
  console.log('\n  Check 1: No hand-rolled breadcrumbs inside /admin/* pages');

  const adminDir = path.resolve(__dirname, '..', 'apps/web/src/app/admin');
  if (!fs.existsSync(adminDir)) {
    pass('admin tree not present — skipping');
    return;
  }

  const layoutPath = path.join(adminDir, 'layout.tsx');

  // Patterns that indicate a page is rendering its own breadcrumbs:
  //   - import { ..., Breadcrumbs, ... } from '@mui/material'
  //   - import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs'
  // Either one means a second breadcrumb bar will stack on top of the
  // layout's auto-generated breadcrumbs.
  const muiBreadcrumbsImport = /import[^;]*\bBreadcrumbs\b[^;]*from\s+['"]@mui\/material['"]/s;
  const pageBreadcrumbsImport =
    /import[^;]*\bPageBreadcrumbs\b[^;]*from\s+['"]@\/components\/common\/PageBreadcrumbs['"]/s;

  let offenders = 0;

  for (const file of walkTs(adminDir)) {
    if (file === layoutPath) continue; // The layout IS the owner; it's allowed.

    const content = fs.readFileSync(file, 'utf8');
    if (muiBreadcrumbsImport.test(content) || pageBreadcrumbsImport.test(content)) {
      offenders++;
      const rel = path.relative(path.resolve(__dirname, '..'), file);
      fail(
        `${rel} — renders its own breadcrumbs, but admin/layout.tsx already does. ` +
          `Remove the page-level breadcrumbs (see UI-STANDARDS rule 5.4).`
      );
    }
  }

  if (offenders === 0) {
    pass('All admin/* pages defer to admin/layout.tsx for breadcrumbs');
  }
}

function checkRawMuiBreadcrumbsOutsidePrimitive() {
  console.log('\n  Check 2: Direct @mui/material Breadcrumbs import is discouraged');

  // This is a soft-warn check. UI-STANDARDS rule 5.4 says feature code should
  // use <PageBreadcrumbs> instead of importing Breadcrumbs directly. But this
  // check is informational only (not failing) because there are legitimate
  // uses (e.g. inside PageBreadcrumbs.tsx itself) and the migration is
  // incremental.
  const repoRoot = path.resolve(__dirname, '..');
  const primitivePath = path.resolve(
    repoRoot,
    'apps/web/src/components/common/PageBreadcrumbs.tsx'
  );
  const allowed = new Set([
    primitivePath,
    // BreadcrumbNav is a folder-path navigator inside the doc browser (JS
    // onNavigate callbacks, custom separator, bordered container). It is a
    // different semantic to the route-level PageBreadcrumbs primitive and is
    // intentionally kept on raw MUI Breadcrumbs.
    path.resolve(repoRoot, 'apps/web/src/components/documents/browser/BreadcrumbNav.tsx'),
  ]);

  const appDir = path.resolve(repoRoot, 'apps/web/src');
  const muiImport = /import[^;]*\bBreadcrumbs\b[^;]*from\s+['"]@mui\/material['"]/s;

  let count = 0;
  for (const file of walkTs(appDir)) {
    if (allowed.has(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (muiImport.test(content)) count++;
  }

  if (count > 0) {
    console.log(
      `  ⓘ  ${count} files still import Breadcrumbs from @mui/material directly. ` +
        'Migration to <PageBreadcrumbs> is incremental (UI-UPGRADES-TRACKER §2.4).'
    );
  } else {
    pass('All files use the <PageBreadcrumbs> primitive');
  }
}

console.log('🔍 Breadcrumb duplication safety check...');
checkAdminTree();
checkRawMuiBreadcrumbsOutsidePrimitive();

if (failures > 0) {
  console.log(`\n${RED}❌ Breadcrumb safety check failed — ${failures} issue(s)${RESET}`);
  console.log('   See UI-STANDARDS.md rule 5.4.');
  process.exit(1);
}

console.log(`\n${GREEN}✅ Breadcrumb safety check passed${RESET}`);
process.exit(0);
