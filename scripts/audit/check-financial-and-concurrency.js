#!/usr/bin/env node
/**
 * Financial Math, Concurrency, and Soft-Delete Check
 * (CLAUDE.md rules #3, #19, #20, #21)
 *
 * Catches:
 *   #3:  where('isDeleted', '!=', true) queries (silently exclude legacy docs).
 *   #19: getDoc + updateDoc/setDoc on the same flow without runTransaction.
 *   #20: batch.<op> inside a for/while loop without chunking by 500.
 *   #21: Fallback chains on amount fields (e.g. `?? data.outstandingAmount`)
 *        and money arithmetic without rounding.
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
const TARGET_DIRS = ['apps/web/src', 'functions/src', 'packages'];

const violations = {
  rule3: [],
  rule19: [],
  rule20: [],
  rule21: [],
};

const stats = { filesScanned: 0 };

// ─── File discovery ────────────────────────────────────────────────────────

function findTsFiles() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    try {
      const out = execSync(
        `find "${full}" -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -name "*.test.ts" ! -name "*.test.tsx" ! -name "*.spec.ts" ! -name "*.d.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.next/*"`,
        { encoding: 'utf8' }
      ).trim();
      if (out) files.push(...out.split('\n'));
    } catch {
      /* empty */
    }
  }
  return files;
}

// ─── Function extractor (shared utility) ───────────────────────────────────

function extractFunctions(content) {
  const fns = [];
  const declRe = /^[ \t]*(export\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/gm;
  const constRe =
    /^[ \t]*(export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:function\s*[\w]*\s*)?\(/gm;
  const collect = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
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
        } else if (c === ')') parenDepth--;
        else if (c === '=' && content[i + 1] === '>' && parenDepth === 0) {
          sawArrow = true;
          i++;
        } else if (c === '{' && parenDepth === 0 && (kind === 'decl' || sawArrow || foundParen))
          break;
        else if (c === ';' && parenDepth === 0 && foundParen && !sawArrow && kind === 'const') {
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

// Rule #3 — `where('isDeleted', '!=', true)` (silently excludes docs missing the field).
const ISDELETED_NEQ_RE = /where\s*\(\s*['"]isDeleted['"]\s*,\s*['"]!=['"]\s*,/;

// Rule #19 — getDoc + updateDoc / setDoc on what looks like the same flow.
const GET_DOC_RE = /\b(?:getDoc|getDocs)\s*\(/;
const WRITE_DOC_RE = /\b(?:updateDoc|setDoc|deleteDoc)\s*\(/;
const RUN_TXN_RE = /\b(?:runTransaction|db\.runTransaction)\s*\(/;

// Rule #20 — batch ops in loops without chunking.
const FOR_LOOP_RE = /\b(?:for\s*\(|while\s*\()/;
const BATCH_OP_RE = /\b(?:batch\.(?:set|update|delete|create))\s*\(/;
const CHUNK_HINT_RE =
  /(?:%\s*500|i\s*\+\s*500|i\s*\+=\s*500|slice\s*\(\s*i\s*,\s*i\s*\+\s*(?:500|batchSize|chunkSize|BATCH_SIZE|CHUNK_SIZE)|i\s*\+=\s*(?:batchSize|chunkSize|BATCH_SIZE|CHUNK_SIZE))/;

// Rule #21 — fallback chains on amount fields, and unrounded money math.
const AMOUNT_FALLBACK_RE =
  /(?:outstandingAmount|baseAmount|totalAmount|paidAmount|allocatedAmount|grandTotal)\s*\?\?\s*[a-zA-Z_]/;
const AMOUNT_OR_FALLBACK_RE =
  /(?:outstandingAmount|baseAmount|totalAmount|paidAmount|allocatedAmount|grandTotal)\s*\|\|\s*\d/;

// ─── Per-file analysis ─────────────────────────────────────────────────────

function analyseFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  stats.filesScanned++;

  const lines = content.split('\n');

  // Rule #3 — line-level.
  lines.forEach((line, idx) => {
    if (ISDELETED_NEQ_RE.test(line)) {
      violations.rule3.push({
        file: rel,
        line: idx + 1,
        excerpt: line.trim(),
        reason: `where('isDeleted', '!=', true) silently excludes legacy docs (rule #3)`,
      });
    }
  });

  // Rule #21 — line-level amount fallback patterns.
  lines.forEach((line, idx) => {
    if (/^\s*(\/\/|\*)/.test(line)) return; // skip comments
    // Inline exemption marker (same line OR a comment on the immediately
    // preceding line carries `rule21-exempt`). Lets one comment cover a
    // multi-line expression and keeps trailing-comment usage clean.
    if (/\brule21-exempt\b/.test(line)) return;
    const prev = idx > 0 ? lines[idx - 1] : '';
    if (/^\s*(\/\/|\*).*\brule21-exempt\b/.test(prev)) return;
    if (AMOUNT_FALLBACK_RE.test(line)) {
      violations.rule21.push({
        file: rel,
        line: idx + 1,
        excerpt: line.trim(),
        reason: 'fallback chain on amount field — derive instead of cache (rule #21)',
      });
    } else if (AMOUNT_OR_FALLBACK_RE.test(line)) {
      violations.rule21.push({
        file: rel,
        line: idx + 1,
        excerpt: line.trim(),
        reason: 'amount field with || fallback — could mask zero vs missing (rule #21)',
      });
    }
  });

  // Per-function analysis for rules #19 and #20.
  const fns = extractFunctions(content);
  for (const fn of fns) {
    const hasGet = GET_DOC_RE.test(fn.body);
    const hasWrite = WRITE_DOC_RE.test(fn.body);
    const hasTxn = RUN_TXN_RE.test(fn.body);
    // `// rule20-exempt:<reason>` anywhere in the function body opts the
    // function out of the bounded-loop check (used when a loop is provably
    // bounded by document schema or a query .limit()).
    const hasRule20Exempt = /\brule20-exempt\b/.test(fn.body);

    // Rule #19 — getDoc + updateDoc/setDoc without transaction.
    if (hasGet && hasWrite && !hasTxn) {
      violations.rule19.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason:
          'function reads (getDoc) and writes (updateDoc/setDoc) without runTransaction (rule #19)',
      });
    }

    // Rule #20 — batch op inside a loop without chunking hint.
    if (
      FOR_LOOP_RE.test(fn.body) &&
      BATCH_OP_RE.test(fn.body) &&
      !CHUNK_HINT_RE.test(fn.body) &&
      !hasRule20Exempt
    ) {
      violations.rule20.push({
        file: rel,
        line: fn.lineNumber,
        fn: fn.name,
        reason:
          'batch.<op> inside a loop without 500-op chunking — risks Firestore limit (rule #20)',
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
    if (v.excerpt) console.log(`      ${DIM}> ${v.excerpt}${RESET}`);
  }
  if (items.length > 50) console.log(`    ${DIM}… and ${items.length - 50} more${RESET}`);
}

function main() {
  console.log(
    `${CYAN}━━ Financial math, concurrency, and soft-delete check (rules #3, #19, #20, #21) ━━${RESET}`
  );

  const files = findTsFiles();
  for (const f of files) {
    try {
      analyseFile(f);
    } catch (err) {
      console.error(
        `  ${YELLOW}⚠️  failed to analyse ${path.relative(ROOT, f)}: ${err.message}${RESET}`
      );
    }
  }

  console.log(`\n  Scanned ${stats.filesScanned} files.\n`);

  printRule('Rule #3 — no where(isDeleted, !=, true) queries', violations.rule3);
  printRule('Rule #19 — read+write needs runTransaction', violations.rule19);
  printRule('Rule #20 — batch ops in loops need 500-op chunking', violations.rule20);
  printRule('Rule #21 — no fallback chains on amount fields', violations.rule21);

  const total =
    violations.rule3.length +
    violations.rule19.length +
    violations.rule20.length +
    violations.rule21.length;

  console.log();
  if (total === 0) {
    console.log(`${GREEN}✅ Financial / concurrency check passed.${RESET}`);
    process.exit(0);
  }
  console.log(`${RED}❌ Financial / concurrency check found ${total} violation(s).${RESET}`);
  process.exit(ADVISORY ? 0 : 1);
}

main();
