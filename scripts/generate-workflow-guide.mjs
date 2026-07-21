#!/usr/bin/env node
/**
 * Generates the in-app workflow guide dataset from the user-testing markdown.
 *
 * Source:  docs/workflows/user-testing/uat-*.md   (hand-maintained, user-facing)
 * Output:  apps/web/src/data/workflowGuide/*.ts   (generated — do not hand-edit)
 *
 * Run after editing any user-testing doc:  node scripts/generate-workflow-guide.mjs
 *
 * One source doc can feed more than one guide section (the documents doc feeds both
 * Documents and Materials, for instance); `prefixes` decides which workflows land where.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs/workflows/user-testing');
const OUT = path.join(ROOT, 'apps/web/src/data/workflowGuide');

/** Guide section id → source doc + the test-id prefixes that belong to it. */
const TARGETS = [
  {
    id: 'proposals',
    file: 'uat-enquiries-proposals-projects.md',
    prefixes: ['ENQ', 'PROP', 'PROJ'],
    label: 'Enquiries, Proposals & Projects',
    primary: true,
  },
  { id: 'procurement', file: 'uat-procurement.md', prefixes: ['PROC'], label: 'Procurement', primary: true },
  { id: 'accounting', file: 'uat-accounting.md', prefixes: ['ACCT'], label: 'Accounting', primary: true },
  {
    id: 'documents',
    file: 'uat-documents-estimation-materials.md',
    prefixes: ['DOC'],
    label: 'Document Control',
    primary: true,
  },
  {
    id: 'materials',
    file: 'uat-documents-estimation-materials.md',
    prefixes: ['EST', 'MAT'],
    label: 'Estimation & Catalogs',
  },
  {
    id: 'entities',
    file: 'uat-entities-ssot-thermal.md',
    prefixes: ['ENT', 'SSOT'],
    label: 'Entities & Process Data',
    primary: true,
  },
  { id: 'thermal', file: 'uat-entities-ssot-thermal.md', prefixes: ['THRM'], label: 'Thermal Calculators' },
  { id: 'hr', file: 'uat-hr-and-flow.md', prefixes: ['HR'], label: 'HR & Leave', primary: true },
  { id: 'flow', file: 'uat-hr-and-flow.md', prefixes: ['FLOW'], label: 'Flow — Tasks & Meetings' },
  { id: 'admin', file: 'uat-admin-and-permissions.md', prefixes: ['ADM'], label: 'Administration', primary: true },
];

const META_KEYS = /\*\*(Goal|Who|Before you start|Also check|Should NOT be possible):?\*\*/gi;
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSep = (l) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(l.trim()) && l.includes('-');

/** Markdown block subset → structured blocks. Inline markup (**bold**, `code`) is kept verbatim. */
function toBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const t = (lines[i] ?? '').trim();
    if (!t || /^---+$/.test(t)) {
      i++;
      continue;
    }

    if (/^#{3,6}\s/.test(t)) {
      out.push({ k: 'h', text: t.replace(/^#+\s*/, '') });
      i++;
      continue;
    }

    if (t.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const text = buf.join(' ').trim();
      if (text) {
        out.push({
          k: 'note',
          text,
          warn: /known issue|expected to fail|expected to be empty|do not file|don't file/i.test(text),
        });
      }
      continue;
    }

    if (t.startsWith('|') && isSep(lines[i + 1] ?? '')) {
      const head = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const steps = head.some((h) => /^pass\??$/i.test(h));
      const drop = head
        .map((h, ix) => (/^(pass\??|notes)$/i.test(h) ? ix : -1))
        .filter((ix) => ix >= 0);
      const keep = (arr) => arr.filter((_, ix) => !drop.includes(ix));
      out.push({
        k: 'table',
        steps,
        head: keep(head),
        rows: rows.map((r) => keep(head.map((_, ix) => r[ix] ?? ''))),
      });
      continue;
    }

    if (/^([-*]|\d+\.)\s/.test(t)) {
      const ordered = /^\d+\.\s/.test(t);
      const items = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (/^([-*]|\d+\.)\s/.test(lt)) {
          items.push(lt.replace(/^([-*]|\d+\.)\s+/, ''));
          i++;
        } else if (lt && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lt;
          i++;
        } else break;
      }
      out.push({ k: ordered ? 'ol' : 'ul', items });
      continue;
    }

    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[|>#]/.test(lines[i].trim()) &&
      !/^([-*]|\d+\.)\s/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    if (!buf.length) {
      i++;
      continue;
    }

    // One run of text can hold several labelled parts (Goal: … Who: … ).
    const p = buf.join(' ');
    const hits = [...p.matchAll(META_KEYS)];
    if (!hits.length) {
      out.push({ k: 'p', text: p });
      continue;
    }
    if (hits[0].index > 0) {
      const lead = p.slice(0, hits[0].index).trim();
      if (lead) out.push({ k: 'p', text: lead });
    }
    hits.forEach((h, ix) => {
      const from = h.index + h[0].length;
      const to = ix + 1 < hits.length ? hits[ix + 1].index : p.length;
      const text = p.slice(from, to).replace(/^[:\s]+/, '').trim();
      out.push({ k: 'meta', label: h[1], text });
    });
  }
  return out;
}

/** Split a doc into intro sections, workflows (## UAT-…), and trailing sections. */
function parseDoc(md) {
  const lines = md.split('\n');
  const doc = { intro: [], workflows: [], tail: [] };
  let cur = null;
  let seen = false;
  for (const l of lines) {
    if (/^#\s/.test(l)) continue;
    const h2 = l.match(/^##\s+(.*)$/);
    if (h2) {
      const txt = h2[1].trim();
      const m = txt.match(/^(UAT-([A-Z]+)-\d+)\s*[—–-]\s*(.*)$/);
      if (m) {
        cur = { id: m[1], prefix: m[2], title: m[3], lines: [] };
        doc.workflows.push(cur);
        seen = true;
      } else if (/^test index$/i.test(txt)) {
        cur = { drop: true, lines: [] };
      } else {
        cur = { section: txt, lines: [] };
        (seen ? doc.tail : doc.intro).push(cur);
      }
      continue;
    }
    if (cur) cur.lines.push(l);
  }
  return doc;
}

/** Known-issue entries carry "Affects UAT-PROC-31" — route each to the owning section. */
function gapPrefixes(text) {
  return [...text.matchAll(/UAT-([A-Z]+)-\d+/g)].map((m) => m[1]);
}

function collectGaps(tailSections) {
  const gaps = [];
  for (const s of tailSections) {
    if (!/^known issues/i.test(s.section)) continue;
    let group = null;
    for (const b of toBlocks(s.lines)) {
      if (b.k === 'h') group = b.text;
      else if (b.k === 'ul' || b.k === 'ol') {
        b.items.forEach((text) => gaps.push({ text, group, prefixes: gapPrefixes(text) }));
      } else if (b.k === 'table') {
        const affIx = b.head.findIndex((h) => /affect/i.test(h));
        const txtIx = b.head.findIndex((h) => /what|issue|problem/i.test(h));
        b.rows.forEach((r) => {
          const text = r[txtIx >= 0 ? txtIx : r.length - 1] ?? '';
          const aff = affIx >= 0 ? r[affIx] ?? '' : '';
          if (text) gaps.push({ text, group, prefixes: gapPrefixes(text + ' ' + aff), affects: aff });
        });
      } else if (b.k === 'note' || b.k === 'p') {
        // narrative lead-in to the list — keep only if it names specific tests
        if (gapPrefixes(b.text).length) gaps.push({ text: b.text, group, prefixes: gapPrefixes(b.text) });
      }
    }
  }
  return gaps;
}

const ts = (v) => JSON.stringify(v, null, 2);

/* ---------------------------------------------------------------- build */
fs.mkdirSync(OUT, { recursive: true });
const docCache = new Map();
const registry = [];

for (const target of TARGETS) {
  if (!docCache.has(target.file)) {
    docCache.set(target.file, parseDoc(fs.readFileSync(path.join(SRC, target.file), 'utf8')));
  }
  const doc = docCache.get(target.file);

  const workflows = doc.workflows
    .filter((w) => target.prefixes.includes(w.prefix))
    .map((w) => {
      const blocks = toBlocks(w.lines);
      const known = blocks.some((b) => b.k === 'note' && b.warn);
      return { id: w.id, title: w.title, knownIssue: known, blocks };
    });

  const allGaps = collectGaps(doc.tail);
  const gaps = allGaps
    .filter((g) => (g.prefixes.length ? g.prefixes.some((p) => target.prefixes.includes(p)) : target.primary))
    .map((g) => ({ text: g.text, ...(g.group ? { group: g.group } : {}) }));

  const intro = doc.intro
    .filter((s) => !/^test index$/i.test(s.section))
    .map((s) => ({ section: s.section, blocks: toBlocks(s.lines) }));

  const data = { id: target.id, label: target.label, intro, workflows, gaps };

  fs.writeFileSync(
    path.join(OUT, `${target.id}.ts`),
    `// GENERATED by scripts/generate-workflow-guide.mjs — do not edit by hand.\n` +
      `// Source: docs/workflows/user-testing/${target.file}\n` +
      `import type { WorkflowGuideModule } from './types';\n\n` +
      `export const ${target.id}Guide: WorkflowGuideModule = ${ts(data)};\n\n` +
      `export default ${target.id}Guide;\n`
  );

  registry.push({ id: target.id, label: target.label, workflows: workflows.length, gaps: gaps.length });
  console.log(
    `${target.id.padEnd(12)} ${String(workflows.length).padStart(3)} workflows  ${String(gaps.length).padStart(2)} gaps`
  );
}

fs.writeFileSync(
  path.join(OUT, 'types.ts'),
  `// GENERATED by scripts/generate-workflow-guide.mjs — do not edit by hand.\n
/** A row in a step table, or any other content table in the guide. */
export interface WorkflowTableBlock {
  k: 'table';
  /** true when this is the click-by-click step table for a workflow */
  steps: boolean;
  head: string[];
  rows: string[][];
}

/** Inline markup in \`text\` is a small markdown subset: \`**bold**\` and backtick code. */
export type WorkflowBlock =
  | { k: 'p'; text: string }
  | { k: 'h'; text: string }
  | { k: 'meta'; label: string; text: string }
  | { k: 'note'; text: string; warn?: boolean }
  | { k: 'ul' | 'ol'; items: string[] }
  | WorkflowTableBlock;

export interface WorkflowCase {
  /** Stable id, e.g. UAT-PROC-01 — quote this when reporting a problem. */
  id: string;
  title: string;
  /** true when a step is already known to fail; shown as a warning banner. */
  knownIssue: boolean;
  blocks: WorkflowBlock[];
}

export interface WorkflowGuideIntro {
  section: string;
  blocks: WorkflowBlock[];
}

export interface WorkflowGuideGap {
  text: string;
  group?: string;
}

export interface WorkflowGuideModule {
  id: string;
  label: string;
  intro: WorkflowGuideIntro[];
  workflows: WorkflowCase[];
  gaps: WorkflowGuideGap[];
}
`
);

fs.writeFileSync(
  path.join(OUT, 'index.ts'),
  `// GENERATED by scripts/generate-workflow-guide.mjs — do not edit by hand.\n` +
    `import type { WorkflowGuideModule } from './types';\n\n` +
    `export type { WorkflowGuideModule, WorkflowCase, WorkflowBlock } from './types';\n\n` +
    `export interface WorkflowGuideSummary {\n  id: string;\n  label: string;\n  workflows: number;\n  gaps: number;\n}\n\n` +
    `/** Counts only — the content itself is loaded on demand. */\n` +
    `export const WORKFLOW_GUIDE_SUMMARY: Record<string, WorkflowGuideSummary> = ${ts(
      Object.fromEntries(registry.map((r) => [r.id, r]))
    )};\n\n` +
    `/** Lazily loads one section's content so the guide bundle stays small. */\n` +
    `export const WORKFLOW_GUIDE_LOADERS: Record<string, () => Promise<WorkflowGuideModule>> = {\n` +
    registry
      .map((r) => `  ${r.id}: () => import('./${r.id}').then((m) => m.${r.id}Guide),`)
      .join('\n') +
    `\n};\n`
);

const totals = registry.reduce(
  (a, r) => ({ workflows: a.workflows + r.workflows, gaps: a.gaps + r.gaps }),
  { workflows: 0, gaps: 0 }
);
console.log(`\ntotal: ${totals.workflows} workflows, ${totals.gaps} gaps across ${registry.length} sections`);
