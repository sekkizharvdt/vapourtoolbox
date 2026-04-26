#!/usr/bin/env node
/**
 * State Machine & Audit Log Enforcement (CLAUDE.md rules #8, #17, #18)
 *
 * Catches:
 *   #8:  Status mutations without requireValidTransition().
 *   #17: createStateMachine() defined outside the canonical stateMachines.ts file.
 *   #18: Workflow/approval/financial operations without an audit log call.
 *
 * Reuses the function-extractor pattern from check-permissions.js but lives
 * standalone so each check is independently runnable.
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
const TARGET_DIRS = ['apps/web/src/lib', 'functions/src'];

const STATE_MACHINES_FILE = 'apps/web/src/lib/workflow/stateMachines.ts';

const violations = {
  rule8: [],
  rule17: [],
  rule18: [],
};

const stats = { filesScanned: 0, functionsScanned: 0 };

// ─── File discovery ────────────────────────────────────────────────────────

function findServiceFiles() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    try {
      const out = execSync(
        `find "${full}" -type f -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" ! -name "*.d.ts"`,
        { encoding: 'utf8' }
      ).trim();
      if (out) files.push(...out.split('\n'));
    } catch {
      /* empty */
    }
  }
  return files;
}

// ─── Brace-balanced function body extractor (same as check-permissions.js) ─

function extractFunctions(content) {
  const fns = [];
  const declRe = /^[ \t]*(export\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/gm;
  const constRe =
    /^[ \t]*(export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:function\s*[\w]*\s*)?\(/gm;

  const collect = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const isExported = !!m[1];
      const name = m[2];
      if (!name) continue;
      const headerStart = m.index;
      let i = headerStart;
      let parenDepth = 0;
      let foundParen = false;
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
  fns.sort((a, b) => a.lineNumber - b.lineNumber);
  return fns;
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

// ─── Detection patterns ────────────────────────────────────────────────────

// Status mutation = a write to Firestore that sets a `status` field to a literal.
// Match `status: 'X'` or `status: "X"` inside a function body that also contains
// a write operation (updateDoc/setDoc/transaction.update/etc.).
const STATUS_LITERAL_RE = /\bstatus\s*:\s*['"]([A-Z_]+)['"]/;

const WRITE_RE =
  /\b(?:setDoc|updateDoc|tx\.update\(|tx\.set\(|batch\.update\(|batch\.set\(|transaction\.update\(|transaction\.set\()/;

const REQUIRE_VALID_TRANSITION_RE = /\brequireValidTransition\s*\(/;

// Audit-log call patterns (covers client-side and Cloud Function helpers).
const AUDIT_LOG_RE =
  /\b(?:createAuditLog|logAuditEvent|auditUserAction|auditRoleChange|auditPermissionChange|writeAuditLog)\s*\(/;

// createStateMachine factory call.
const CREATE_SM_RE = /\bcreateStateMachine\s*\(/;

// Inline ad-hoc state-machine pattern: an if-check on `status` that tests a
// literal AND calls a write op on the same entity. Heuristic: any function
// whose body contains BOTH STATUS_COMPARE_RE and WRITE_RE, but does NOT
// import / call requireValidTransition.
const STATUS_COMPARE_RE = /\bstatus\s*(?:!==|===|==|!=)\s*['"][A-Z_]+['"]/;

// Sensitive function-name pattern for rule #18.
const SENSITIVE_NAME_RE =
  /^(approve|reject|submit\w*[Ff]orApproval|post\w+|void\w+|delete\w+|hardDelete\w*|close\w+|lock\w+|reopen\w+|finalise\w+|finalize\w+|execute\w+|issue\w+)/;

// ─── Per-file analysis ─────────────────────────────────────────────────────

function analyseFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  stats.filesScanned++;

  // Rule #17: createStateMachine outside the canonical file.
  if (CREATE_SM_RE.test(content) && rel !== STATE_MACHINES_FILE) {
    // Allow: tests, the utility itself.
    if (!/stateMachine\.test\.ts$/.test(rel) && rel !== 'apps/web/src/lib/utils/stateMachine.ts') {
      const idx = content.search(CREATE_SM_RE);
      const line = content.slice(0, idx).split('\n').length;
      violations.rule17.push({
        file: rel,
        line,
        reason: `createStateMachine() called outside ${STATE_MACHINES_FILE} (rule #17)`,
      });
    }
  }

  // Per-function analysis for rules #8 and #18.
  const fns = extractFunctions(content);
  for (const fn of fns) {
    stats.functionsScanned++;

    const writes = WRITE_RE.test(fn.body);
    const setsStatus = STATUS_LITERAL_RE.test(fn.body);
    const comparesStatus = STATUS_COMPARE_RE.test(fn.body);
    const hasValidTransition = REQUIRE_VALID_TRANSITION_RE.test(fn.body);
    const hasAuditLog = AUDIT_LOG_RE.test(fn.body);
    const isSensitiveName = SENSITIVE_NAME_RE.test(fn.name);

    // Rule #8: status mutation without requireValidTransition.
    if (writes && setsStatus && !hasValidTransition && fn.isExported) {
      violations.rule8.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason:
          'function writes a status literal to Firestore without calling requireValidTransition (rule #8)',
      });
    }

    // Rule #8b: ad-hoc state machine = compares status AND writes, no validation.
    if (writes && comparesStatus && !hasValidTransition && !setsStatus && fn.isExported) {
      violations.rule8.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason: 'function gates a write on a status comparison (ad-hoc state machine — rule #8)',
      });
    }

    // Rule #18: sensitive operations without an audit log call.
    if (isSensitiveName && writes && !hasAuditLog && fn.isExported) {
      violations.rule18.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason: 'sensitive workflow function writes data but does not log to auditLogs (rule #18)',
      });
    }
  }
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printRule(title, items) {
  if (items.length === 0) {
    console.log(`  ${GREEN}✅ ${title} — clean${RESET}`);
    return;
  }
  console.log(`  ${RED}❌ ${title} — ${items.length} violation(s)${RESET}`);
  if (QUIET) return;
  for (const v of items.slice(0, 50)) {
    const loc = v.fn ? `${v.file}:${v.line}  ${CYAN}${v.fn}()${RESET}` : `${v.file}:${v.line}`;
    console.log(`    ${DIM}${loc}${RESET}`);
    console.log(`      ${v.reason}`);
  }
  if (items.length > 50) console.log(`    ${DIM}… and ${items.length - 50} more${RESET}`);
}

function main() {
  console.log(`${CYAN}━━ State machine & audit log enforcement (rules #8, #17, #18) ━━${RESET}`);

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

  printRule('Rule #8 — status changes need requireValidTransition', violations.rule8);
  printRule('Rule #17 — state machines live in stateMachines.ts', violations.rule17);
  printRule('Rule #18 — sensitive ops need an audit log call', violations.rule18);

  const total = violations.rule8.length + violations.rule17.length + violations.rule18.length;

  console.log();
  if (total === 0) {
    console.log(`${GREEN}✅ State machine & audit log check passed.${RESET}`);
    process.exit(0);
  }
  console.log(`${RED}❌ State machine & audit log check found ${total} violation(s).${RESET}`);
  process.exit(ADVISORY ? 0 : 1);
}

main();
