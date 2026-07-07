#!/usr/bin/env node
/**
 * Test-presence ratchet (docs/archive/2026-07-05-automated-verification-plan.md, Phase 6)
 *
 * Every in-scope source file must have a test (sibling `X.test.ts` or
 * `__tests__/X.test.ts`) OR be listed in scripts/audit/test-baselines.json.
 * The baseline is the frozen pre-existing backlog and may only SHRINK:
 *
 *   - An untested in-scope file that is NOT in the baseline blocks the
 *     commit — new service code ships with a test, full stop.
 *   - A baseline entry that is stale (file deleted, or a test now exists)
 *     also blocks, prompting its removal — that's the ratchet tightening.
 *   - Editing a baselined file does NOT force a test (too aggressive for
 *     mechanical edits); writing its test and deleting the entry is how the
 *     backlog burns down.
 *
 * Scope (see the plan for rationale):
 *   - apps/web/src/lib/** files ending in Service.ts
 *   - functions/src/ top-level .ts files (top level — the deployed trigger/callable surface;
 *     index.ts barrel and generated files excluded)
 *   - packages/functions/src/ recursive .ts files (legacy package — nothing new should
 *     land there untested, or ideally at all; see Phase 1 notes)
 *
 * Modes:
 *   (default)  enforce; exit 1 on violations
 *   --report   print baseline counts per module and exit 0
 *   --seed     write the current untested set as the baseline — refuses to
 *              run if test-baselines.json already exists (baselines never grow)
 *
 * Exempt a file (rare — say why): list it in test-baselines.json manually
 * with a trailing "  // reason" comment field is NOT supported by JSON, so
 * add the reason to the "exemptions" map instead.
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const REPORT = args.includes('--report');
const SEED = args.includes('--seed');
const QUIET = args.includes('--quiet');

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_FILE = path.join(__dirname, 'test-baselines.json');

/** Recursively collect files under dir matching predicate. */
function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'dist') continue;
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function isSource(file) {
  return (
    file.endsWith('.ts') &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.spec.ts') &&
    !file.endsWith('.d.ts')
  );
}

function collectInScopeFiles() {
  const files = [];

  // apps/web/src/lib/**/*Service.ts
  files.push(
    ...walk(path.join(ROOT, 'apps/web/src/lib'), (f) => isSource(f) && f.endsWith('Service.ts'))
  );

  // functions/src/*.ts — top level only (the deployed surface), minus the barrel
  const functionsSrc = path.join(ROOT, 'functions/src');
  if (fs.existsSync(functionsSrc)) {
    for (const entry of fs.readdirSync(functionsSrc, { withFileTypes: true })) {
      const full = path.join(functionsSrc, entry.name);
      if (entry.isFile() && isSource(full) && entry.name !== 'index.ts') files.push(full);
    }
  }

  // packages/functions/src/**/*.ts — legacy tree, minus barrels
  files.push(
    ...walk(
      path.join(ROOT, 'packages/functions/src'),
      (f) => isSource(f) && path.basename(f) !== 'index.ts'
    )
  );

  return files.map((f) => path.relative(ROOT, f)).sort();
}

function hasTest(relFile) {
  const abs = path.join(ROOT, relFile);
  const dir = path.dirname(abs);
  const base = path.basename(relFile, '.ts');
  return (
    fs.existsSync(path.join(dir, `${base}.test.ts`)) ||
    fs.existsSync(path.join(dir, '__tests__', `${base}.test.ts`))
  );
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { files: [], exemptions: {} };
  const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  return { files: parsed.files ?? [], exemptions: parsed.exemptions ?? {} };
}

const inScope = collectInScopeFiles();
const untested = inScope.filter((f) => !hasTest(f));

if (SEED) {
  if (fs.existsSync(BASELINE_FILE)) {
    console.error(`${RED}Refusing to seed: ${path.relative(ROOT, BASELINE_FILE)} already exists.`);
    console.error(`Baselines only shrink — edit the file manually if you must.${RESET}`);
    process.exit(1);
  }
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify(
      {
        comment:
          'Pre-existing untested backlog frozen by Phase 6 of the automated-verification plan. ' +
          'Entries may only be REMOVED (write the test, delete the line). ' +
          'check-test-presence.js blocks new untested service files and stale entries.',
        seededAt: new Date().toISOString().slice(0, 10),
        files: untested,
        exemptions: {},
      },
      null,
      2
    ) + '\n'
  );
  console.log(`${GREEN}Seeded baseline with ${untested.length} untested file(s).${RESET}`);
  process.exit(0);
}

const baseline = loadBaseline();
const baselineSet = new Set([...baseline.files, ...Object.keys(baseline.exemptions)]);

if (REPORT) {
  const byModule = new Map();
  for (const f of baseline.files.filter((x) => !hasTest(x) && fs.existsSync(path.join(ROOT, x)))) {
    const mod = f.split('/').slice(0, 4).join('/');
    byModule.set(mod, (byModule.get(mod) ?? 0) + 1);
  }
  console.log(`${CYAN}Test-presence baseline (untested backlog) by module:${RESET}`);
  for (const [mod, count] of [...byModule.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${mod}`);
  }
  console.log(`  ${DIM}total: ${baseline.files.length} baselined file(s)${RESET}`);
  process.exit(0);
}

const violations = [];

// New untested in-scope files (not baselined) — the hard gate.
for (const f of untested) {
  if (!baselineSet.has(f)) {
    violations.push(
      `${f}\n    new in-scope file with no test — add ${path.basename(f, '.ts')}.test.ts ` +
        `(sibling or __tests__/)`
    );
  }
}

// Stale baseline entries — the ratchet tightening.
for (const f of baseline.files) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    violations.push(
      `${f}\n    baselined file no longer exists — remove it from test-baselines.json`
    );
  } else if (hasTest(f)) {
    violations.push(
      `${f}\n    baselined file now HAS a test — remove it from test-baselines.json (ratchet down)`
    );
  }
}

if (violations.length > 0) {
  console.error(`${RED}❌ Test-presence check failed (${violations.length} issue(s)):${RESET}\n`);
  for (const v of violations) console.error(`  ${RED}✗${RESET} ${v}\n`);
  console.error(
    `${DIM}Policy: new service/function files ship with a test; the pre-existing backlog\n` +
      `is frozen in scripts/audit/test-baselines.json and only shrinks.${RESET}`
  );
  process.exit(1);
}

if (!QUIET) {
  console.log(
    `${GREEN}✅ Test-presence check passed${RESET} ${DIM}(${inScope.length} in-scope files, ` +
      `${baseline.files.length} baselined)${RESET}`
  );
}
process.exit(0);
