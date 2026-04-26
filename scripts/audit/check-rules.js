#!/usr/bin/env node
/**
 * Run all four agent-readiness rule checks in sequence.
 *
 *   #1: Permission & self-approval gate           (rules #5, #6, #7)
 *   #2: State-machine & audit-log enforcement     (rules #8, #17, #18)
 *   #3: Financial math, concurrency, soft-delete  (rules #3, #19, #20, #21)
 *   #4: Structural consistency                    (rules #4, #24, #28)
 *
 * Each child script exits 0/1 independently. This wrapper aggregates results
 * so a single command tells you the overall punch list.
 *
 * Flags:
 *   --advisory   never exit non-zero, even if violations found (CI warn mode)
 *   --quiet      print only summary lines, not per-violation detail
 *   --only=N     run only check #N (1, 2, 3, or 4)
 *   --md         also write a dated markdown snapshot to reports/rule-check-YYYY-MM-DD.md
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const ADVISORY = args.includes('--advisory');
const QUIET = args.includes('--quiet');
const MD = args.includes('--md');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? Number(onlyArg.split('=')[1]) : null;

const ROOT = path.resolve(__dirname, '..', '..');

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
let grandTotal = 0;
for (const s of summaries) {
  const status = s.total === 0 ? `${GREEN}✅${RESET}` : `${RED}${s.total} violation(s)${RESET}`;
  console.log(`  Check ${s.id}: ${s.label.padEnd(28)} ${status}`);
  for (const rc of s.ruleCounts) {
    console.log(`           ${RED}└ rule #${rc.rule}: ${rc.count}${RESET}`);
  }
  grandTotal += s.total;
}
console.log();
if (grandTotal === 0) {
  console.log(`  ${GREEN}✅ All checks passed.${RESET}\n`);
} else {
  console.log(
    `  ${RED}❌ ${grandTotal} total violation(s) across ${totalFailures} of ${checks.length} check groups.${RESET}`
  );
  if (ADVISORY) {
    console.log(`  ${CYAN}(advisory mode — exiting 0; drop --advisory to enforce)${RESET}\n`);
  } else {
    console.log();
  }
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
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Check | Group | Total | Per-rule |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const s of summaries) {
    const perRule = s.ruleCounts.length
      ? s.ruleCounts.map((r) => `#${r.rule}: ${r.count}`).join(', ')
      : '—';
    lines.push(`| ${s.id} | ${s.label} | ${s.total} | ${perRule} |`);
  }
  lines.push(`| | **Grand total** | **${grandTotal}** | |`);
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

process.exit(ADVISORY ? 0 : grandTotal > 0 ? 1 : 0);
