#!/usr/bin/env node
/**
 * Permission & Self-Approval Gate Check (CLAUDE.md rules #5, #6, #7)
 *
 * Catches:
 *   #5: Service-layer functions that write to Firestore without `requirePermission`.
 *   #6: Approve/reject/submit functions without `preventSelfApproval`.
 *   #7: Hardcoded numeric permission flags instead of `PERMISSION_FLAGS` import.
 *
 * Strategy: walk service-layer files, extract function bodies via brace-balancing,
 * inspect each body for write ops vs gating calls.
 *
 * Exit code 0 = pass, 1 = fail.
 *
 * Usage:
 *   node scripts/audit/check-permissions.js              # report all violations
 *   node scripts/audit/check-permissions.js --advisory   # report but exit 0
 *   node scripts/audit/check-permissions.js --quiet      # only print summary
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
const TARGET_DIRS = ['apps/web/src/lib', 'functions/src'];

const violations = {
  rule5: [], // missing requirePermission
  rule6: [], // missing preventSelfApproval
  rule7: [], // hardcoded permission flags
};

const stats = {
  filesScanned: 0,
  functionsScanned: 0,
};

// ─── File discovery ────────────────────────────────────────────────────────

function findServiceFiles() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    try {
      // Service-layer files: anything that suggests a write boundary.
      const out = execSync(
        `find "${full}" -type f \\( -name "*[Ss]ervice*.ts" -o -name "*orkflow*.ts" -o -name "crud.ts" -o -name "index.ts" \\) ! -name "*.test.ts" ! -name "*.spec.ts"`,
        { encoding: 'utf8' }
      ).trim();
      if (out) files.push(...out.split('\n'));
    } catch {
      // find returns non-zero when nothing matches
    }
  }
  return files;
}

// ─── Brace-balanced function body extractor ────────────────────────────────

/**
 * Extract top-level function declarations and their bodies.
 *
 * Handles: export function NAME(...) { ... }
 *          export async function NAME(...) { ... }
 *          export const NAME = async (...) => { ... }
 *          export const NAME = (...) => { ... }
 *
 * Returns [{ name, body, lineNumber }].
 */
function extractFunctions(content) {
  const fns = [];

  // Function declaration pattern.
  const declRe = /^[ \t]*(export\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/gm;
  // Arrow / function-expression assigned to const.
  const constRe =
    /^[ \t]*(export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:function\s*[\w]*\s*)?\(/gm;

  const collect = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const isExported = !!m[1];
      const name = m[2];
      if (!name) continue;
      // Find the opening brace of the function body.
      // We need to skip past the parameter list and any return type annotation.
      const headerStart = m.index;
      let i = headerStart;
      let parenDepth = 0;
      let foundParen = false;
      // Walk forward until we find { at zero paren depth and after =>/closing-paren.
      let sawArrow = false;
      while (i < content.length) {
        const c = content[i];
        if (c === '(') {
          parenDepth++;
          foundParen = true;
        } else if (c === ')') {
          parenDepth--;
        } else if (c === '=' && content[i + 1] === '>' && parenDepth === 0) {
          sawArrow = true;
          i++;
        } else if (c === '{' && parenDepth === 0 && (kind === 'decl' || sawArrow || foundParen)) {
          break;
        } else if (c === ';' && parenDepth === 0 && foundParen && !sawArrow && kind === 'const') {
          // const NAME = something(); — not a function with a body.
          i = -1;
          break;
        }
        i++;
      }
      if (i < 0 || i >= content.length || content[i] !== '{') continue;

      const bodyStart = i;
      const bodyEnd = findMatchingBrace(content, bodyStart);
      if (bodyEnd < 0) continue;

      fns.push({
        name,
        isExported,
        body: content.slice(bodyStart, bodyEnd + 1),
        lineNumber: content.slice(0, headerStart).split('\n').length,
      });
    }
  };

  collect(declRe, 'decl');
  collect(constRe, 'const');

  // Sort by line number so output is stable.
  fns.sort((a, b) => a.lineNumber - b.lineNumber);
  return fns;
}

/**
 * Find the matching `}` for the `{` at startIdx.
 * Skips strings (', ", `) and comments (// and /* *\/).
 * Template literal expressions ${...} are tracked too.
 */
function findMatchingBrace(s, startIdx) {
  let depth = 0;
  let i = startIdx;
  let inStr = null; // ', ", or `
  let inLineComment = false;
  let inBlockComment = false;
  const tplExprDepth = []; // stack of brace depths at which we entered a ${ inside a `

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
      if (c === '\\') {
        i++; // skip escaped char
      } else if (inStr === '`' && c === '$' && n === '{') {
        tplExprDepth.push(depth);
        inStr = null;
        depth++;
        i++;
      } else if (c === inStr) {
        inStr = null;
      }
    } else {
      if (c === '/' && n === '/') {
        inLineComment = true;
        i++;
      } else if (c === '/' && n === '*') {
        inBlockComment = true;
        i++;
      } else if (c === '"' || c === "'" || c === '`') {
        inStr = c;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
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

// ─── Detection patterns ────────────────────────────────────────────────────

// Write operations that mutate Firestore (client SDK + admin SDK + transactions).
const WRITE_RE =
  /\b(?:setDoc|updateDoc|addDoc|deleteDoc|writeBatch\(|\.commit\(\)|tx\.set\(|tx\.update\(|tx\.delete\(|tx\.create\(|batch\.set\(|batch\.update\(|batch\.delete\(|batch\.create\(|runTransaction)\b/;

const PERMISSION_RE = /\b(?:requirePermission|requireAnyPermission|requireOwnerOrPermission)\b/;

const PREVENT_SELF_RE = /\bpreventSelfApproval\s*\(/;

// Approval-pattern names. `cancel*` is intentionally excluded — cancellations
// are usually done by the original requester, where preventSelfApproval would
// be incorrect.
const APPROVAL_NAME_RE = /^(approve|reject)\w*$|^submit\w*[Ff]orApproval$/;

// Read-only function names to exclude from rule #5.
const READ_ONLY_NAME_RE = /^(get|list|find|query|fetch|search|count|load|read|view|select)/i;

// Hardcoded permission flag patterns:
//  - bitmap shifts written outside permissions.ts  (e.g. `1 << 16`)
//  - numeric flag in requirePermission(_, 65536, ...)
const BITSHIFT_RE = /\b1\s*<<\s*\d+\b/;
const NUMERIC_FLAG_IN_REQUIRE_RE =
  /\brequirePermission\s*\(\s*[^,]+,\s*(?:0[xX][0-9a-fA-F]+|\d+)\s*,/;

// Rule #7 exemption files.
const PERM_DEF_RE = /\bpermissions(?:2)?\.ts$|\bpermissions\/index\.ts$/;

// ─── Per-file analysis ─────────────────────────────────────────────────────

function analyseFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  stats.filesScanned++;

  // Rule #7: hardcoded flag patterns at file level.
  if (!PERM_DEF_RE.test(filePath)) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Skip comments & test fixtures; tolerate `1 << 0` for permission constants only in def files.
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (BITSHIFT_RE.test(line)) {
        violations.rule7.push({
          file: rel,
          line: idx + 1,
          excerpt: line.trim(),
          reason: 'bitmap shift outside permissions.ts (rule #7)',
        });
      }
      if (NUMERIC_FLAG_IN_REQUIRE_RE.test(line)) {
        violations.rule7.push({
          file: rel,
          line: idx + 1,
          excerpt: line.trim(),
          reason: 'numeric permission flag passed to requirePermission (rule #7)',
        });
      }
    });
  }

  // Per-function analysis for rules #5 and #6.
  const fns = extractFunctions(content);
  for (const fn of fns) {
    stats.functionsScanned++;

    const writes = WRITE_RE.test(fn.body);
    const hasPerm = PERMISSION_RE.test(fn.body);
    const hasPreventSelf = PREVENT_SELF_RE.test(fn.body);
    const isReadOnly = READ_ONLY_NAME_RE.test(fn.name);
    const isApproval = APPROVAL_NAME_RE.test(fn.name);

    // Rule #5: writes without permission gate.
    // Only flag exported functions — private helpers are assumed to be called
    // by an exported function that already gated.
    if (writes && !hasPerm && !isReadOnly && fn.isExported) {
      violations.rule5.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason:
          'service function writes to Firestore but does not call requirePermission (rule #5)',
      });
    }

    // Rule #6: approval without preventSelfApproval.
    if (isApproval && !hasPreventSelf && fn.isExported) {
      violations.rule6.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason: 'approval/rejection function does not call preventSelfApproval (rule #6)',
      });
    }
  }
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printRule(title, items, ruleColor = RED) {
  if (items.length === 0) {
    console.log(`  ${GREEN}✅ ${title} — clean${RESET}`);
    return;
  }
  console.log(`  ${ruleColor}❌ ${title} — ${items.length} violation(s)${RESET}`);
  if (QUIET) return;
  const grouped = items.slice(0, 50); // cap noisy output
  for (const v of grouped) {
    const loc = v.fn ? `${v.file}:${v.line}  ${CYAN}${v.fn}()${RESET}` : `${v.file}:${v.line}`;
    console.log(`    ${DIM}${loc}${RESET}`);
    console.log(`      ${v.reason}`);
    if (v.excerpt) console.log(`      ${DIM}> ${v.excerpt}${RESET}`);
  }
  if (items.length > 50) {
    console.log(`    ${DIM}… and ${items.length - 50} more${RESET}`);
  }
}

function main() {
  console.log(`${CYAN}━━ Permission & self-approval gate check (rules #5, #6, #7) ━━${RESET}`);

  const files = findServiceFiles();
  for (const f of files) {
    try {
      analyseFile(f);
    } catch (err) {
      console.error(
        `  ${YELLOW}⚠️  failed to analyse ${path.relative(ROOT, f)}: ${err.message}${RESET}`
      );
    }
  }

  console.log(`\n  Scanned ${stats.filesScanned} files, ${stats.functionsScanned} functions.\n`);

  printRule('Rule #5 — service writes need requirePermission', violations.rule5);
  printRule('Rule #6 — approve/reject needs preventSelfApproval', violations.rule6);
  printRule('Rule #7 — no hardcoded permission flags', violations.rule7);

  const total = violations.rule5.length + violations.rule6.length + violations.rule7.length;

  console.log();
  if (total === 0) {
    console.log(`${GREEN}✅ Permission gate check passed.${RESET}`);
    process.exit(0);
  }
  console.log(`${RED}❌ Permission gate check found ${total} violation(s).${RESET}`);
  process.exit(ADVISORY ? 0 : 1);
}

main();
