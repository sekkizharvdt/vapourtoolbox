#!/usr/bin/env node
/**
 * Catalogue taxonomy guardrail (docs/reviews/2026-08-16-materials-taxonomy-cleanup.md)
 *
 * The catalogue is modelled on three ORTHOGONAL attributes, declared per
 * category in `CATALOG_SIZING` (packages/types/src/catalog.ts):
 *
 *   discriminators  what makes a distinct purchasable article  → variants
 *   orderSizing     what the buyer states on the order line    → line entry
 *   pricingUnit     how quantity × rate works                  → KG/METER/PIECE
 *
 * 33 documents ended up misfiled as RAW_MATERIAL — valves, strainers, demister
 * pads, pressure switches — because nothing ever checked. This is that check.
 * It is a STATIC check: it validates the model in the source tree, not the
 * Firestore data (which needs credentials and cannot run in a git hook).
 *
 * Checks:
 *   A. Every category with a sizing override declares all three attributes,
 *      and pricingUnit / orderSizing are legal values.
 *   B. `orderSizing: 'SHAPE'` is only claimed by categories that a shape in
 *      the shapes dataset actually accepts — otherwise the picker would ask
 *      for dimensions it has no shape to collect.
 *   C. Nothing reintroduces a local "is this a raw material" test. The one
 *      answer is getCatalogSizing(category).pricingUnit; a second predicate
 *      is how the first drift started (rule 32).
 *
 * Usage: node scripts/audit/check-catalog-taxonomy.js [--quiet]
 * Exit 1 on any violation.
 */

const fs = require('fs');
const path = require('path');

const QUIET = process.argv.includes('--quiet');
const ROOT = path.resolve(__dirname, '..', '..');
const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const violations = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// Parse the sizing registry out of the types package.
// ---------------------------------------------------------------------------
const catalogSrc = read('packages/types/src/catalog.ts');

const overridesMatch = catalogSrc.match(
  /const SIZING_OVERRIDES: Record<string, CatalogSizing> = \{([\s\S]*?)\n\};/
);
if (!overridesMatch) {
  console.error(
    C.red('✖ Could not find SIZING_OVERRIDES in packages/types/src/catalog.ts.') +
      '\n  The catalogue sizing model is the source of truth for this check;' +
      '\n  if it moved, update scripts/audit/check-catalog-taxonomy.js to match.'
  );
  process.exit(1);
}

const LEGAL_PRICING = ['KG', 'METER', 'PIECE'];
const LEGAL_ORDER_SIZING = ['NONE', 'LENGTH', 'SHAPE'];

/** category → { discriminators, orderSizing, pricingUnit } */
const sizing = {};
const entryRe =
  /(\w+):\s*\{\s*discriminators:\s*\[([^\]]*)\],\s*orderSizing:\s*'(\w+)',\s*pricingUnit:\s*'(\w+)',?\s*\}/g;
let m;
while ((m = entryRe.exec(overridesMatch[1])) !== null) {
  sizing[m[1]] = {
    discriminators: m[2]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean),
    orderSizing: m[3],
    pricingUnit: m[4],
  };
}

// A. Well-formed entries -----------------------------------------------------
for (const [category, s] of Object.entries(sizing)) {
  if (!s.discriminators.length) {
    violations.push({
      check: 'A',
      detail: `${category} declares no discriminators — every article is distinguished by something.`,
    });
  }
  if (!LEGAL_PRICING.includes(s.pricingUnit)) {
    violations.push({
      check: 'A',
      detail: `${category} has pricingUnit '${s.pricingUnit}' (expected one of ${LEGAL_PRICING.join('/')}).`,
    });
  }
  if (!LEGAL_ORDER_SIZING.includes(s.orderSizing)) {
    violations.push({
      check: 'A',
      detail: `${category} has orderSizing '${s.orderSizing}' (expected one of ${LEGAL_ORDER_SIZING.join('/')}).`,
    });
  }
}

// B. SHAPE categories must be accepted by a real shape -----------------------
const shapeFiles = fs
  .readdirSync(path.join(ROOT, 'apps/web/src/data/shapes'))
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const shapesSrc = shapeFiles.map((f) => read(path.join('apps/web/src/data/shapes', f))).join('\n');
const shapeCategories = new Set(
  [...shapesSrc.matchAll(/MaterialCategory\.(\w+)/g)].map((x) => x[1])
);

for (const [category, s] of Object.entries(sizing)) {
  if (s.orderSizing !== 'SHAPE') continue;
  if (!shapeCategories.has(category)) {
    violations.push({
      check: 'B',
      detail:
        `${category} claims orderSizing 'SHAPE' but no shape in apps/web/src/data/shapes ` +
        `lists it in allowedMaterialCategories — the dimensions step would have nothing to offer.`,
    });
  }
}

// C. No second "is this raw material?" predicate -----------------------------
// getCatalogSizing(...).pricingUnit is the one answer. `usesVariantModel` is
// the pre-existing plate-code helper and is explicitly NOT a rawness test —
// flag any new function whose name implies it is.
const SUSPECT_NAME = /\b(?:function|const)\s+(is(?:Raw|BoughtOut)\w*|needsVariants\w*)\s*[=(]/g;
const scanRoots = ['apps/web/src/lib', 'apps/web/src/components', 'packages/types/src'];
const walk = (dir, out = []) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
};
for (const file of scanRoots.flatMap((d) => walk(d))) {
  const src = read(file);
  let hit;
  SUSPECT_NAME.lastIndex = 0;
  while ((hit = SUSPECT_NAME.exec(src)) !== null) {
    violations.push({
      check: 'C',
      detail:
        `${file} defines \`${hit[1]}\` — a second answer to "how is this item sized/priced". ` +
        `Use getCatalogSizing(category) instead (rule 32).`,
    });
  }
}

// ---------------------------------------------------------------------------
if (!QUIET || violations.length) {
  console.log(C.cyan('\n━━ Catalogue taxonomy guardrail ━━\n'));
  const modelled = Object.keys(sizing).length;
  const byUnit = LEGAL_PRICING.map(
    (u) => `${u}:${Object.values(sizing).filter((s) => s.pricingUnit === u).length}`
  ).join('  ');
  console.log(`  ${modelled} categories modelled  ${C.dim('(' + byUnit + ')')}`);
}

if (violations.length) {
  console.log(C.red(`\n  ✖ ${violations.length} violation(s):\n`));
  for (const v of violations) console.log(`    ${C.red('[' + v.check + ']')} ${v.detail}`);
  console.log(
    C.dim(
      '\n  Model of record: packages/types/src/catalog.ts (CATALOG_SIZING)\n' +
        '  Rationale:       docs/reviews/2026-08-16-materials-taxonomy-cleanup.md\n'
    )
  );
  process.exit(1);
}

if (!QUIET) console.log(C.green('\n✅ Catalogue taxonomy check passed.\n'));
process.exit(0);
