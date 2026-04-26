#!/usr/bin/env node
/**
 * Structural Consistency Check (CLAUDE.md rules #4, #24, #28)
 *
 * Catches:
 *   #4:  Collections referenced in code that have no firestore.rules entry.
 *   #24: switch (txn.type) blocks that include a `default:` case (rule says
 *        list every TransactionType explicitly so the compiler catches misses).
 *   #28: Modules under apps/web/src/app/<module>/ missing required pages
 *        (page.tsx + new/page.tsx + [id]/page.tsx + [id]/edit/page.tsx).
 *
 * Notes:
 *   - Rule #2 (composite indexes) is best caught by Firestore at query time.
 *   - Rule #11 (null-checks on optional fields) is largely covered by
 *     tsconfig `strictNullChecks` + `noUncheckedIndexedAccess` already on.
 *   - Rule #29 (user-visible labels in labels.ts) is too noisy to enforce
 *     statically — leave for review.
 *
 * Exit code 0 = pass, 1 = fail.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const ADVISORY = args.includes('--advisory');
const QUIET = args.includes('--quiet');

const ROOT = path.resolve(__dirname, '..', '..');
const COLLECTIONS_FILE = path.join(ROOT, 'packages/firebase/src/collections.ts');
const RULES_FILE = path.join(ROOT, 'firestore.rules');
const APP_DIR = path.join(ROOT, 'apps/web/src/app');

const violations = {
  rule4: [],
  rule24: [],
  rule28: [],
};

// ─── Rule #4: collections in code without security rules ──────────────────

function loadCollectionMap() {
  // Returns { CONST_NAME: 'firestoreName' } from packages/firebase/src/collections.ts.
  const content = fs.readFileSync(COLLECTIONS_FILE, 'utf8');
  const map = {};
  // Match `KEY: 'value',` lines inside the COLLECTIONS object.
  const re = /^\s*([A-Z][A-Z0-9_]*):\s*['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(content))) map[m[1]] = m[2];
  return map;
}

function loadRulesCollections() {
  // Returns Set of collection names that have a `match /<name>/{...}` block —
  // including subcollections like `match /projects/{id}/masterDocuments/{...}`.
  const content = fs.readFileSync(RULES_FILE, 'utf8');
  const names = new Set();
  // Match every `/<segmentName>/{<param>}` occurrence anywhere in the file.
  const re = /\/([A-Za-z_][\w]*)\/\{[^/{}]+\}/g;
  let m;
  while ((m = re.exec(content))) names.add(m[1]);
  return names;
}

function findUsedCollections(collectionMap) {
  // Returns Set of firestore collection names actually referenced in code.
  const used = new Set();

  // Pattern A: collection(db, COLLECTIONS.X) or collection(db, COLLECTIONS['X']).
  // Pattern B: collection(db, 'literal-name').
  // Pattern C: doc(db, 'literal-name', ...).
  const dirs = ['apps/web/src', 'functions/src'];
  for (const dir of dirs) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    try {
      const grepOut = execSync(
        `grep -rohn -E "(collection|doc|collectionGroup)\\([^,]+,\\s*['\\\"]([a-zA-Z_][a-zA-Z0-9_]*)['\\\"]|COLLECTIONS\\.([A-Z_][A-Z0-9_]*)" "${full}" --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
        { encoding: 'utf8' }
      );
      for (const line of grepOut.split('\n')) {
        const constMatch = line.match(/COLLECTIONS\.([A-Z_][A-Z0-9_]*)/);
        if (constMatch && collectionMap[constMatch[1]]) used.add(collectionMap[constMatch[1]]);

        const literalMatch = line.match(
          /(?:collection|doc|collectionGroup)\([^,]+,\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/
        );
        if (literalMatch) used.add(literalMatch[1]);
      }
    } catch {
      /* empty */
    }
  }
  return used;
}

function checkRule4() {
  const collectionMap = loadCollectionMap();
  const ruleNames = loadRulesCollections();
  const used = findUsedCollections(collectionMap);

  // Subcollections nested under a parent often inherit parent rules in
  // Firestore (depending on your rules). Flag only top-level collections
  // that are clearly tenant-scoped writes.
  // Subcollection hint: name starts lowercase and is short (heuristic too weak),
  // so we just report all unmatched ones — user can audit.
  for (const name of [...used].sort()) {
    if (!ruleNames.has(name)) {
      violations.rule4.push({
        collection: name,
        reason: `collection "${name}" is referenced in code but has no match block in firestore.rules (rule #4)`,
      });
    }
  }
}

// ─── Rule #24: switch (txn.type) blocks with default: cases ────────────────

function checkRule24() {
  // Scan all .ts/.tsx files for switch statements whose discriminant looks
  // like a TransactionType reference, and flag any that contain `default:`.
  const dirs = ['apps/web/src', 'functions/src'];
  for (const dir of dirs) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    let files = [];
    try {
      const out = execSync(
        `find "${full}" -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -name "*.test.*" ! -name "*.d.ts"`,
        { encoding: 'utf8' }
      ).trim();
      if (out) files = out.split('\n');
    } catch {
      continue;
    }
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Find every `switch (...something.type...)` block.
      const switchRe = /switch\s*\(\s*([^)]*\.type)\s*\)\s*\{/g;
      let m;
      while ((m = switchRe.exec(content))) {
        const discriminant = m[1].trim();
        // Heuristic: the discriminant should hint at a transaction.
        if (
          !/\b(?:txn|transaction|tx|t|trans|entry)\b/i.test(discriminant) &&
          !/\b(?:type)$/i.test(discriminant)
        )
          continue;
        const start = m.index;
        const openBrace = content.indexOf('{', start);
        const closeBrace = findMatchingBrace(content, openBrace);
        if (closeBrace < 0) continue;
        const body = content.slice(openBrace, closeBrace + 1);
        // Match `default:` not inside a string/comment.
        if (/^\s*default\s*:/m.test(body)) {
          // Check that the TransactionType cases are present — heuristic.
          const hasTxnCases =
            /\bcase\s+['"](?:CUSTOMER_INVOICE|CUSTOMER_PAYMENT|VENDOR_BILL|VENDOR_PAYMENT|JOURNAL_ENTRY|BANK_TRANSFER|EXPENSE_CLAIM|DIRECT_PAYMENT|DIRECT_RECEIPT)['"]/.test(
              body
            );
          if (hasTxnCases) {
            const line = content.slice(0, start).split('\n').length;
            violations.rule24.push({
              file: path.relative(ROOT, file),
              line,
              discriminant,
              reason:
                'switch on TransactionType uses a `default:` clause — list every type explicitly (rule #24)',
            });
          }
        }
      }
    }
  }
}

function findMatchingBrace(s, startIdx) {
  let depth = 0;
  let i = startIdx;
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  const tplExprDepth = [];
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
    } else if (inBlockComment) {
      if (c === '*' && n === '/') {
        inBlockComment = false;
        i++;
      }
    } else if (inStr) {
      if (c === '\\') i++;
      else if (inStr === '`' && c === '$' && n === '{') {
        tplExprDepth.push(depth);
        inStr = null;
        depth++;
        i++;
      } else if (c === inStr) inStr = null;
    } else {
      if (c === '/' && n === '/') {
        inLineComment = true;
        i++;
      } else if (c === '/' && n === '*') {
        inBlockComment = true;
        i++;
      } else if (c === '"' || c === "'" || c === '`') inStr = c;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return i;
        if (tplExprDepth.length && tplExprDepth[tplExprDepth.length - 1] === depth) {
          tplExprDepth.pop();
          inStr = '`';
        }
      }
    }
    i++;
  }
  return -1;
}

// ─── Rule #28: module completeness ─────────────────────────────────────────

const SYSTEM_DIRS = new Set([
  'api',
  'auth',
  'login',
  'unauthorized',
  'pending-approval',
  'flow',
  'super-admin',
  'admin',
  'guide',
  'thermal', // calculator suite, not an entity module
  'services',
  'company',
  'dashboard',
  'ssot',
  'feedback',
]);

function isEntityModule(dir) {
  // An entity module is a directory that BOTH lists items AND has either a
  // detail page or a new page. Plain dashboards (single page.tsx, no
  // [id]/ or new/) are not entity modules.
  const hasList =
    fs.existsSync(path.join(dir, 'page.tsx')) || fs.existsSync(path.join(dir, 'list', 'page.tsx'));
  if (!hasList) return false;
  const hasDetail = fs.existsSync(path.join(dir, '[id]'));
  const hasNew = fs.existsSync(path.join(dir, 'new'));
  return hasDetail || hasNew;
}

function walkForEntityModules(rootDir, relPath = '') {
  // Recursively find every entity module under rootDir.
  const result = [];
  if (!fs.existsSync(rootDir)) return result;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('[') || entry.name.startsWith('(') || entry.name === 'new') continue;
    if (relPath === '' && SYSTEM_DIRS.has(entry.name)) continue;
    const dir = path.join(rootDir, entry.name);
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (isEntityModule(dir)) {
      result.push({ dir, rel: childRel });
    }
    // Continue recursing — modules can be nested deeper.
    result.push(...walkForEntityModules(dir, childRel));
  }
  return result;
}

function checkRule28() {
  const modules = walkForEntityModules(APP_DIR);
  for (const { dir, rel } of modules) {
    const required = [
      { kind: 'List', candidates: ['page.tsx', 'list/page.tsx'] },
      { kind: 'New', candidates: ['new/page.tsx'] },
      { kind: 'View', candidates: ['[id]/page.tsx'] },
      { kind: 'Edit', candidates: ['[id]/edit/page.tsx'] },
    ];
    const missing = [];
    for (const r of required) {
      const exists = r.candidates.some((c) => fs.existsSync(path.join(dir, c)));
      if (!exists) missing.push(r.kind);
    }
    if (missing.length > 0) {
      violations.rule28.push({
        module: `apps/web/src/app/${rel}`,
        missing,
        reason: `module incomplete — missing ${missing.join(', ')} (rule #28)`,
      });
    }
  }
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printRule(title, items, formatter) {
  if (items.length === 0) {
    console.log(`  ${GREEN}✅ ${title} — clean${RESET}`);
    return;
  }
  console.log(`  ${RED}❌ ${title} — ${items.length} violation(s)${RESET}`);
  if (QUIET) return;
  for (const v of items.slice(0, 50)) {
    console.log(formatter(v));
  }
  if (items.length > 50) console.log(`    ${DIM}… and ${items.length - 50} more${RESET}`);
}

function main() {
  console.log(`${CYAN}━━ Structural consistency check (rules #4, #24, #28) ━━${RESET}\n`);

  checkRule4();
  checkRule24();
  checkRule28();

  printRule(
    'Rule #4 — collections referenced in code need firestore.rules entries',
    violations.rule4,
    (v) => `    ${DIM}${v.collection}${RESET}\n      ${v.reason}`
  );

  printRule(
    'Rule #24 — TransactionType switches must be exhaustive (no `default:`)',
    violations.rule24,
    (v) =>
      `    ${DIM}${v.file}:${v.line}  ${CYAN}switch(${v.discriminant})${RESET}\n      ${v.reason}`
  );

  printRule(
    'Rule #28 — modules need List + New + View + Edit pages',
    violations.rule28,
    (v) => `    ${DIM}${v.module}${RESET}\n      ${v.reason}`
  );

  const total = violations.rule4.length + violations.rule24.length + violations.rule28.length;

  console.log();
  if (total === 0) {
    console.log(`${GREEN}✅ Structural check passed.${RESET}`);
    process.exit(0);
  }
  console.log(`${RED}❌ Structural check found ${total} violation(s).${RESET}`);
  process.exit(ADVISORY ? 0 : 1);
}

main();
