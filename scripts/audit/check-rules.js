#!/usr/bin/env node
/**
 * Run all four agent-readiness rule checks in sequence.
 *
 *   #1: Permission & self-approval gate           (rules #5, #6, #7)
 *   #2: State-machine & audit-log enforcement     (rules #8, #17, #18)
 *   #3: Financial math, concurrency, soft-delete  (rules #3, #19, #20, #21)
 *   #4: Structural consistency                    (rules #4, #24, #28)
 *
 * Per-rule enforcement model:
 *   - The set of *enforced* rules lives in scripts/audit/enforced-rules.json.
 *   - Enforced rules block on any violation (exit 1).
 *   - Non-enforced rules are reported but never block (exit stays 0).
 *   - As you close rule violations, add the rule number to the JSON to gate
 *     against regressions. See RULE-VIOLATIONS-PUNCHLIST-*.md.
 *
 * Flags:
 *   --advisory     never exit non-zero, even on regressions (pure report mode)
 *   --quiet        print only summary lines, not per-violation detail
 *   --only=N       run only check #N (1, 2, 3, or 4)
 *   --enforce=A,B  CLI override of enforced-rules.json (e.g. --enforce=4,17)
 *   --no-enforce   nothing is enforced this run (same as --advisory for exit code)
 *   --md           also write a dated markdown snapshot to reports/rule-check-YYYY-MM-DD.md
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const ADVISORY = args.includes('--advisory');
const QUIET = args.includes('--quiet');
const MD = args.includes('--md');
const NO_ENFORCE = args.includes('--no-enforce');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? Number(onlyArg.split('=')[1]) : null;
const enforceArg = args.find((a) => a.startsWith('--enforce='));

const ROOT = path.resolve(__dirname, '..', '..');

// ─── Load enforced-rules config ────────────────────────────────────────────

function loadEnforcedRules() {
  if (NO_ENFORCE) return new Set();
  if (enforceArg) {
    return new Set(
      enforceArg
        .split('=')[1]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    );
  }
  const configPath = path.join(__dirname, 'enforced-rules.json');
  if (!fs.existsSync(configPath)) return new Set();
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return new Set(Array.isArray(cfg.enforced) ? cfg.enforced : []);
  } catch {
    return new Set();
  }
}

const ENFORCED = loadEnforcedRules();

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const checks = [
  { id: 1, label: 'Permission & self-approval', file: 'check-permissions.js' },
  { id: 2, label: 'State machine & audit log', file: 'check-state-machines.js' },
  { id: 3, label: 'Financial / concurrency', file: 'check-financial-and-concurrency.js' },
  { id: 4, label: 'Structural consistency', file: 'check-structure.js' },
];

const childArgs = [];
if (ADVISORY) childArgs.push('--advisory');
if (QUIET) childArgs.push('--quiet');

let totalFailures = 0;
const summaries = [];
// When --md is set we also collect each child's full (verbose) output for the
// markdown snapshot. The on-screen output still respects --quiet.
const fullOutputForMd = [];

console.log(
  `${CYAN}╔════════════════════════════════════════════════════════════════════╗${RESET}`
);
console.log(`${CYAN}║          CLAUDE.md rule checks — agent-readiness suite            ║${RESET}`);
console.log(
  `${CYAN}╚════════════════════════════════════════════════════════════════════╝${RESET}\n`
);

// We need to capture each child's stdout so we can detect "found N violation(s)"
// even when the child is run in advisory mode (which makes it exit 0).
for (const c of checks) {
  if (only !== null && only !== c.id) continue;
  const scriptPath = path.join(__dirname, c.file);
  // Run child without --advisory so we see honest exit codes; preserve --quiet
  // and any other flags from the runner.
  const childChildArgs = childArgs.filter((a) => a !== '--advisory');
  const result = spawnSync('node', [scriptPath, ...childChildArgs], { encoding: 'utf8' });
  const out = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(out);
  console.log();
  // Parse "found N violation(s)" from output.
  const totalMatch = out.match(/found\s+(\d+)\s+violation/);
  const ruleCounts = [...out.matchAll(/Rule\s+#(\d+)\s+—\s+[^\n]+—\s+(\d+)\s+violation/g)].map(
    (m) => ({
      rule: Number(m[1]),
      count: Number(m[2]),
    })
  );
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  if (total > 0) totalFailures++;
  summaries.push({ id: c.id, label: c.label, total, ruleCounts });

  // For the markdown snapshot, re-run verbosely if the on-screen run was quiet.
  if (MD) {
    let verboseOut = out;
    if (QUIET) {
      const verboseArgs = childChildArgs.filter((a) => a !== '--quiet');
      const vr = spawnSync('node', [scriptPath, ...verboseArgs], { encoding: 'utf8' });
      verboseOut = (vr.stdout || '') + (vr.stderr || '');
    }
    fullOutputForMd.push({ check: c, body: stripAnsi(verboseOut) });
  }
}

console.log(
  `${CYAN}╔════════════════════════════════════════════════════════════════════╗${RESET}`
);
console.log(
  `${CYAN}║                            Summary                                 ║${RESET}`
);
console.log(
  `${CYAN}╚════════════════════════════════════════════════════════════════════╝${RESET}\n`
);

// Show which rules are currently enforced.
const enforcedList = [...ENFORCED].sort((a, b) => a - b);
if (enforcedList.length > 0) {
  console.log(
    `  ${CYAN}Enforced rules:${RESET} ${enforcedList.map((r) => `#${r}`).join(', ')}  ` +
      `${CYAN}(violations on these block; others are advisory)${RESET}\n`
  );
} else {
  console.log(`  ${CYAN}Enforced rules:${RESET} none ${CYAN}(all advisory)${RESET}\n`);
}

let grandTotal = 0;
let enforcedFailures = 0;
const enforcedFailing = [];
for (const s of summaries) {
  const status = s.total === 0 ? `${GREEN}✅${RESET}` : `${RED}${s.total} violation(s)${RESET}`;
  console.log(`  Check ${s.id}: ${s.label.padEnd(28)} ${status}`);
  for (const rc of s.ruleCounts) {
    const isEnforced = ENFORCED.has(rc.rule);
    const tag = isEnforced ? `${RED}[ENFORCED]${RESET}` : `${CYAN}[advisory]${RESET}`;
    console.log(`           ${RED}└ rule #${rc.rule}: ${rc.count}${RESET} ${tag}`);
    if (isEnforced && rc.count > 0) {
      enforcedFailures += rc.count;
      enforcedFailing.push(rc.rule);
    }
  }
  grandTotal += s.total;
}
console.log();
if (grandTotal === 0) {
  console.log(`  ${GREEN}✅ All checks passed.${RESET}\n`);
} else if (enforcedFailures > 0) {
  console.log(
    `  ${RED}❌ ${enforcedFailures} violation(s) on enforced rule(s) ${enforcedFailing
      .map((r) => `#${r}`)
      .join(', ')}.${RESET}`
  );
  console.log(
    `  ${CYAN}+ ${grandTotal - enforcedFailures} advisory violation(s) reported but not blocking.${RESET}`
  );
  if (ADVISORY) {
    console.log(`  ${CYAN}(--advisory set — exiting 0)${RESET}\n`);
  } else {
    console.log();
  }
} else {
  console.log(
    `  ${GREEN}✅ All enforced rules clean.${RESET} ${CYAN}(${grandTotal} advisory violation(s) reported but not blocking.)${RESET}\n`
  );
}

// ─── Markdown snapshot ─────────────────────────────────────────────────────

if (MD) {
  const reportsDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const date = todayISO();
  const outFile = path.join(reportsDir, `rule-check-${date}.md`);

  const lines = [];
  lines.push(`# CLAUDE.md rule check snapshot`);
  lines.push('');
  lines.push(`**Date:** ${date}`);
  lines.push(`**Generated by:** \`pnpm check-rules --md\``);
  lines.push(
    `**Enforced rules:** ${
      enforcedList.length ? enforcedList.map((r) => `#${r}`).join(', ') : 'none (all advisory)'
    }`
  );
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Check | Group | Total | Per-rule (status) |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const s of summaries) {
    const perRule = s.ruleCounts.length
      ? s.ruleCounts
          .map(
            (r) =>
              `#${r.rule}: ${r.count} ${ENFORCED.has(r.rule) ? '**[enforced]**' : '_[advisory]_'}`
          )
          .join(', ')
      : '—';
    lines.push(`| ${s.id} | ${s.label} | ${s.total} | ${perRule} |`);
  }
  lines.push(
    `| | **Grand total** | **${grandTotal}** | enforced failing: **${enforcedFailures}** |`
  );
  lines.push('');
  lines.push(`## Full output`);
  lines.push('');
  for (const block of fullOutputForMd) {
    lines.push(`### Check ${block.check.id}: ${block.check.label}`);
    lines.push('');
    lines.push('```');
    lines.push(block.body.trim());
    lines.push('```');
    lines.push('');
  }
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(`  ${CYAN}📄 Snapshot written to ${path.relative(ROOT, outFile)}${RESET}\n`);
}

// Exit code:
//   --advisory    → always 0 (pure report mode)
//   otherwise     → 1 if any enforced rule has violations, else 0
//                   (advisory-rule violations never block).
process.exit(ADVISORY ? 0 : enforcedFailures > 0 ? 1 : 0);
