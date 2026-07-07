#!/usr/bin/env node
/**
 * UI/UX Standardisation Guardrails (docs/archive/2026-07-03-ui-ux-standardisation-plan.md, Phase 5)
 *
 * Two check classes:
 *
 *   Zero-tolerance (blocks the commit once its category is clean):
 *     A. Local formatCurrency/formatDate/formatMoney/formatPercentage
 *        re-implementations outside apps/web/src/lib/utils/formatters.ts
 *     B. Raw `.toLocaleDateString(` calls in apps/web/src
 *     C. Local getStatusColor/getPriorityColor re-implementations outside
 *        the canonical packages/constants/src/statuses.ts
 *     D. `<Snackbar` usage outside components/common/Toast.tsx
 *     E. `ConfirmDialog` imported from '@vapour/ui' (canonical lives in
 *        apps/web/src/components/common/ConfirmDialog.tsx)
 *
 *   Count-ratchet (baseline in scripts/audit/ui-baselines.json; count may
 *   fall, never rise — these are large pre-existing backlogs, not bugs):
 *     F. Files with a raw `<TablePagination` (new list pages must use DataTable)
 *     G. Files with a raw `<CircularProgress` (new pages must use LoadingState)
 *     H. `page.tsx` files with no `PageHeader`
 *
 * A category only blocks the commit if it's listed in `enforced` in
 * ui-baselines.json — same enforcement model as scripts/audit/check-rules.js.
 * Categories that are still mid-sweep (e.g. B, which needs an exhaustive
 * sweep beyond the Phase 4 targeted-sweep scope) stay advisory until clean.
 *
 * A definition is treated as compliant (not a violation) if:
 *   - it's a bare alias (`const formatDate = someOtherName;`), or
 *   - its body calls a name imported from the canonical module in the same file, or
 *   - it has a `ui-standards-exempt: <reason>` comment on the line directly above.
 *
 * Exit code 0 = pass, 1 = fail (unless --advisory).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const ADVISORY = args.includes('--advisory');
const QUIET = args.includes('--quiet');

const ROOT = path.resolve(__dirname, '..', '..');
const WEB_SRC = path.join(ROOT, 'apps/web/src');
const FORMATTERS_FILE = path.join(WEB_SRC, 'lib/utils/formatters.ts');
const TOAST_FILE = path.join(WEB_SRC, 'components/common/Toast.tsx');
const STATUS_CANONICAL_FILES = [
  path.join(ROOT, 'packages/constants/src/statuses.ts'),
  path.join(ROOT, 'packages/ui/src/utils/statusColors.ts'),
];

const CONFIG_FILE = path.join(__dirname, 'ui-baselines.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { enforced: [], ratchetBaselines: {} };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { enforced: [], ratchetBaselines: {} };
  }
}

const CONFIG = loadConfig();
const ENFORCED = new Set(CONFIG.enforced || []);

function listFiles(dir, exts) {
  const out = [];
  try {
    const found = execSync(
      `find "${dir}" -type f \\( ${exts.map((e) => `-name "*${e}"`).join(' -o ')} \\)`,
      { encoding: 'utf8' }
    ).trim();
    if (found) out.push(...found.split('\n'));
  } catch {
    /* empty */
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

const violations = { A: [], B: [], C: [], D: [], E: [] };
const ratchets = { F: null, G: null, H: null };

// ─── Shared helper: is this local `format*`/`get*Color` definition actually
// delegating to the canonical implementation (compliant), or a real
// reimplementation (violation)? ───────────────────────────────────────────

function importedNamesFromModules(content, modulePatterns) {
  // Returns the set of local names (post-`as` alias) imported from any of
  // the given module specifiers in this file.
  const names = new Set();
  const importRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(content))) {
    const moduleSpecifier = m[2];
    if (!modulePatterns.some((p) => moduleSpecifier === p || moduleSpecifier.endsWith(p))) continue;
    for (const part of m[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const asMatch = piece.match(/\bas\s+(\w+)/);
      names.add(asMatch ? asMatch[1] : piece.split(/\s+/)[0]);
    }
  }
  return names;
}

function hasExemptMarker(content, matchIndex) {
  const before = content.slice(0, matchIndex);
  const lines = before.split('\n');
  // Check the few lines directly above the match — covers both single-line
  // and small multi-line comment blocks.
  const window = lines.slice(Math.max(0, lines.length - 4), lines.length - 1).join('\n');
  return /ui-standards-exempt\s*:/i.test(window);
}

function isBareAlias(content, matchIndex, name) {
  const lineEnd = content.indexOf('\n', matchIndex);
  const line = content.slice(matchIndex, lineEnd === -1 ? undefined : lineEnd);
  return new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*[\\w$]+\\s*;?\\s*$`).test(line);
}

function delegatesToCanonical(content, matchIndex, canonicalNames) {
  // Look at a window of source after the definition starts (covers typical
  // one-line and small multi-line function bodies) for a call to any name
  // imported from the canonical module.
  const windowEnd = Math.min(content.length, matchIndex + 400);
  const window = content.slice(matchIndex, windowEnd);
  return [...canonicalNames].some((n) => n && new RegExp(`\\b${n}\\s*\\(`).test(window));
}

// ─── A: local formatCurrency/formatDate/formatMoney/formatPercentage ──────

function checkA() {
  const files = listFiles(WEB_SRC, ['.ts', '.tsx']).filter((f) => f !== FORMATTERS_FILE);
  const defRe =
    /^[ \t]*(?:export\s+)?(?:function\s+(formatCurrency|formatDate|formatMoney|formatPercentage)\s*\(|const\s+(formatCurrency|formatDate|formatMoney|formatPercentage)\s*=)/gm;
  for (const file of files) {
    if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
      continue;
    const content = fs.readFileSync(file, 'utf8');
    const canonicalNames = importedNamesFromModules(content, ['@/lib/utils/formatters']);
    let m;
    defRe.lastIndex = 0;
    while ((m = defRe.exec(content))) {
      const name = m[1] || m[2];
      if (hasExemptMarker(content, m.index)) continue;
      if (isBareAlias(content, m.index, name)) continue;
      if (delegatesToCanonical(content, m.index, canonicalNames)) continue;
      const line = content.slice(0, m.index).split('\n').length;
      violations.A.push({
        file: rel(file),
        line,
        name,
        reason: `local "${name}" re-implementation outside formatters.ts — delegate to the canonical formatter instead (rule 32)`,
      });
    }
  }
}

// ─── B: raw .toLocaleDateString( calls ─────────────────────────────────────

function checkB() {
  const files = listFiles(WEB_SRC, ['.ts', '.tsx']);
  for (const file of files) {
    if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
      continue;
    const content = fs.readFileSync(file, 'utf8');
    const idx = content.indexOf('.toLocaleDateString(');
    if (idx === -1) continue;
    const line = content.slice(0, idx).split('\n').length;
    violations.B.push({
      file: rel(file),
      line,
      reason:
        'raw .toLocaleDateString() — use the canonical formatDate() from lib/utils/formatters.ts instead (rule 14)',
    });
  }
}

// ─── C: local getStatusColor/getPriorityColor ──────────────────────────────

function checkC() {
  const dirs = [WEB_SRC, path.join(ROOT, 'packages')];
  const defRe = /^[ \t]*(?:export\s+)?function\s+(getStatusColor|getPriorityColor)\s*\(/gm;
  for (const dir of dirs) {
    const files = listFiles(dir, ['.ts', '.tsx']).filter(
      (f) => !STATUS_CANONICAL_FILES.includes(f)
    );
    for (const file of files) {
      if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
        continue;
      const content = fs.readFileSync(file, 'utf8');
      const canonicalNames = importedNamesFromModules(content, [
        '@vapour/constants',
        '@vapour/ui',
        '@/utils/statusColors',
      ]);
      let m;
      defRe.lastIndex = 0;
      while ((m = defRe.exec(content))) {
        const name = m[1];
        if (hasExemptMarker(content, m.index)) continue;
        if (delegatesToCanonical(content, m.index, canonicalNames)) continue;
        const line = content.slice(0, m.index).split('\n').length;
        violations.C.push({
          file: rel(file),
          line,
          name,
          reason: `local "${name}" re-implementation outside packages/constants/src/statuses.ts — delegate to the canonical function or add a ui-standards-exempt comment if this is a genuinely different concept (rule 32)`,
        });
      }
    }
  }
}

// ─── D: <Snackbar outside Toast.tsx ─────────────────────────────────────────

function checkD() {
  const files = listFiles(WEB_SRC, ['.tsx']).filter((f) => f !== TOAST_FILE);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const idx = content.indexOf('<Snackbar');
    if (idx === -1) continue;
    const line = content.slice(0, idx).split('\n').length;
    violations.D.push({
      file: rel(file),
      line,
      reason: 'local <Snackbar> — use the shared useToast() hook instead (rule 32)',
    });
  }
}

// ─── E: ConfirmDialog imported from @vapour/ui ─────────────────────────────

function checkE() {
  const files = listFiles(WEB_SRC, ['.tsx']);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const re = /import\s+(?:type\s+)?\{[^}]*\bConfirmDialog\b[^}]*\}\s+from\s+['"]@vapour\/ui['"]/;
    const m = re.exec(content);
    if (!m) continue;
    const line = content.slice(0, m.index).split('\n').length;
    violations.E.push({
      file: rel(file),
      line,
      reason:
        'ConfirmDialog imported from @vapour/ui — the canonical version is components/common/ConfirmDialog.tsx (rule 32)',
    });
  }
}

// ─── F/G/H: count-ratchets ─────────────────────────────────────────────────

function countFilesContaining(dir, exts, needle, excludeFiles = []) {
  const files = listFiles(dir, exts).filter((f) => !excludeFiles.includes(f));
  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(needle)) count++;
  }
  return count;
}

function checkRatchet(key, label, currentCount) {
  const baseline = (CONFIG.ratchetBaselines || {})[key];
  const regressed = typeof baseline === 'number' && currentCount > baseline;
  ratchets[key] = { label, currentCount, baseline: baseline ?? null, regressed };
}

function checkF() {
  const count = countFilesContaining(WEB_SRC, ['.tsx'], '<TablePagination');
  checkRatchet('F', 'raw <TablePagination usage (new list pages must use DataTable)', count);
}

function checkG() {
  const count = countFilesContaining(
    WEB_SRC,
    ['.tsx'],
    '<CircularProgress',
    // packages/ui isn't under WEB_SRC so no exclusion needed here; LoadingState/
    // FormDialog legitimately render CircularProgress internally as the
    // canonical implementation.
    []
  );
  checkRatchet('G', 'raw <CircularProgress usage (new pages must use LoadingState)', count);
}

function checkH() {
  const pageFiles = listFiles(path.join(WEB_SRC, 'app'), ['page.tsx']).filter(
    (f) => path.basename(f) === 'page.tsx'
  );
  let missing = 0;
  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('PageHeader')) missing++;
  }
  checkRatchet('H', 'page.tsx files without PageHeader', missing);
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function categoryLabel(key) {
  return {
    A: 'A — local formatCurrency/formatDate/formatMoney/formatPercentage re-implementations',
    B: 'B — raw .toLocaleDateString( calls',
    C: 'C — local getStatusColor/getPriorityColor re-implementations',
    D: 'D — <Snackbar> outside Toast.tsx',
    E: 'E — ConfirmDialog imported from @vapour/ui',
  }[key];
}

function printZeroTolerance(key, items) {
  const enforced = ENFORCED.has(key);
  const tag = enforced ? `${RED}[ENFORCED]${RESET}` : `${CYAN}[advisory]${RESET}`;
  if (items.length === 0) {
    console.log(`  ${GREEN}✅ ${categoryLabel(key)} — clean${RESET} ${tag}`);
    return;
  }
  console.log(`  ${RED}❌ ${categoryLabel(key)} — ${items.length} violation(s)${RESET} ${tag}`);
  if (QUIET) return;
  for (const v of items.slice(0, 30)) {
    console.log(`    ${DIM}${v.file}:${v.line}${RESET}\n      ${v.reason}`);
  }
  if (items.length > 30) console.log(`    ${DIM}… and ${items.length - 30} more${RESET}`);
}

function printRatchet(key) {
  const r = ratchets[key];
  const status = r.regressed
    ? `${RED}❌ ${r.currentCount} (baseline ${r.baseline}) — regression${RESET}`
    : `${GREEN}${r.currentCount}${RESET}${
        typeof r.baseline === 'number' ? ` ${DIM}(baseline ${r.baseline})${RESET}` : ''
      }`;
  console.log(`  ${r.regressed ? '' : GREEN + '✓ ' + RESET}${key} — ${r.label}: ${status}`);
}

function main() {
  console.log(`${CYAN}━━ UI/UX standardisation guardrails (Phase 5) ━━${RESET}\n`);

  checkA();
  checkB();
  checkC();
  checkD();
  checkE();
  checkF();
  checkG();
  checkH();

  console.log(`${CYAN}Zero-tolerance categories:${RESET}`);
  printZeroTolerance('A', violations.A);
  printZeroTolerance('B', violations.B);
  printZeroTolerance('C', violations.C);
  printZeroTolerance('D', violations.D);
  printZeroTolerance('E', violations.E);

  console.log(`\n${CYAN}Count-ratchets (baseline may fall, never rise):${RESET}`);
  printRatchet('F');
  printRatchet('G');
  printRatchet('H');

  const zeroToleranceEnforcedFailures = ['A', 'B', 'C', 'D', 'E']
    .filter((k) => ENFORCED.has(k))
    .reduce((sum, k) => sum + violations[k].length, 0);
  const ratchetRegressions = ['F', 'G', 'H'].filter((k) => ratchets[k].regressed);

  const totalViolations = Object.values(violations).reduce((s, v) => s + v.length, 0);

  console.log();
  if (zeroToleranceEnforcedFailures === 0 && ratchetRegressions.length === 0) {
    if (totalViolations === 0) {
      console.log(`${GREEN}✅ UI standards check passed — no violations at all.${RESET}`);
    } else {
      console.log(
        `${GREEN}✅ UI standards check passed.${RESET} ${CYAN}(${totalViolations} advisory violation(s) reported but not blocking.)${RESET}`
      );
    }
    process.exit(0);
  }

  if (ratchetRegressions.length > 0) {
    console.log(
      `${RED}❌ Ratchet regression on: ${ratchetRegressions.join(', ')}. Lower the count back to baseline (or update the baseline in ui-baselines.json if the increase is intentional and reviewed).${RESET}`
    );
  }
  if (zeroToleranceEnforcedFailures > 0) {
    console.log(
      `${RED}❌ ${zeroToleranceEnforcedFailures} violation(s) on enforced zero-tolerance categor${zeroToleranceEnforcedFailures === 1 ? 'y' : 'ies'}.${RESET}`
    );
  }
  process.exit(ADVISORY ? 0 : 1);
}

main();
