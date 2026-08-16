/**
 * Materials → bought-out taxonomy migration.
 *
 * Plan of record: docs/reviews/2026-08-16-materials-taxonomy-cleanup.md
 *
 * The rule: priced in Rs/kg or Rs/m → raw material (stays in `materials`);
 * priced as a unit rate → bought-out item. `baseUnit` encodes it already.
 *
 * Moves the 427 unit-rate documents out of `materials` and into
 * `bought_out_items`, CONSOLIDATING them into ~30 products with variants —
 * `familyCode` already carries the grouping for piping, and the NOS-priced
 * groups are collapsed by product name.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *
 *   node ./scripts/analysis/migrate-boughtout-taxonomy.js            # dry run
 *   node ./scripts/analysis/migrate-boughtout-taxonomy.js --backup   # write backup only
 *   node ./scripts/analysis/migrate-boughtout-taxonomy.js --apply    # backup + migrate
 *
 * Run from the repo root so `firebase-admin` resolves.
 *
 * NOT handled here — see the plan's open items:
 *   - the 24 `OTHER` strays (14 already exist as variants of the piping
 *     families; blocked on the schedule + Duplex-family questions)
 *   - deleting the source `materials` docs. This script marks them
 *     `isMigrated: true` (the same flag the earlier piping migration used),
 *     so nothing is destroyed and the queries already skip them.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BACKUP_ONLY = process.argv.includes('--backup');

const key = require('../../docs/inputs/firebase-service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

/** Categories that stay in `materials` — everything priced by weight or length. */
const RAW_CATEGORIES = new Set([
  'PLATES_CARBON_STEEL',
  'PLATES_STAINLESS_STEEL',
  'PLATES_DUPLEX_STEEL',
  'PLATES_ALLOY_STEEL',
  'PIPES_CARBON_STEEL',
  'PIPES_STAINLESS_304L',
  'PIPES_STAINLESS_316L',
  'PIPES_ALLOY_STEEL',
  'PIPES_DUPLEX_2205',
  'PIPES_SUPER_DUPLEX_2507',
]);
/** Aluminium Tubes sits in OTHER but is priced per KG — genuine raw material. */
const RAW_CODES = new Set(['OT-6063T6']);

/** materials category → BoughtOutCategory. */
const TO_BOUGHT_OUT_CATEGORY = {
  FLANGES_WELD_NECK: 'ACCESSORY',
  FLANGES_SLIP_ON: 'ACCESSORY',
  FLANGES_BLIND: 'ACCESSORY',
  FITTINGS_BUTT_WELD: 'ACCESSORY',
  FITTINGS_SOCKET_WELD: 'ACCESSORY',
  DEMISTER_PAD: 'ACCESSORY',
  STRAINERS: 'ACCESSORY',
  EXPANSION_BELLOWS: 'ACCESSORY',
  RUBBER: 'ACCESSORY',
  INSTRUMENT_OTHER: 'INSTRUMENT',
  VALVE_GLOBE: 'VALVE',
};

/** Which product a NOS-priced doc belongs to, and how its variant reads. */
function productFor(m) {
  const desc = String(m.description || '');
  switch (m.category) {
    case 'DEMISTER_PAD': {
      const size = desc.match(/(\d+)\s*[xX]\s*(\d+)/);
      const thk = desc.match(/(\d+)\s*mm\s*thk/i) || desc.match(/Thk\s*-\s*(\d+)\s*mm/i);
      return {
        product: 'Demister Pad w/ Grids',
        variantCode: size && thk ? `${size[1]}x${size[2]}-${thk[1]}` : m.materialCode,
        displayName:
          size && thk ? `${size[1]}×${size[2]}, ${thk[1]}mm thk` : desc || m.materialCode,
      };
    }
    case 'STRAINERS': {
      const basket = /BASKET/i.test(desc);
      const size = desc.match(/([\d.]+\s*NB\s*[xX]\s*[\d.]+\s*NB)/i);
      const service = desc.match(/(SEAWATER|BRINE|DISTILLATE|WARM WATER)/i);
      const compact = size ? size[1].replace(/\s+/g, '').toUpperCase() : m.materialCode;
      const svc = service
        ? ' — ' + service[1].replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
        : '';
      return {
        product: basket ? 'Basket Strainer' : 'Y-Type Strainer',
        variantCode: compact,
        displayName: compact.replace('X', '×') + svc,
      };
    }
    case 'EXPANSION_BELLOWS': {
      const s = desc.match(/(\d+)\s*NB\s*[xX]\s*(\d+)\s*MM/i);
      return {
        product: 'Single Axial Expansion Joint',
        variantCode: s ? `${s[1]}NB-${s[2]}` : m.materialCode,
        displayName: s ? `${s[1]}NB × ${s[2]}mm Long` : desc || m.materialCode,
      };
    }
    case 'INSTRUMENT_OTHER': {
      const tag = desc.match(/(PSL-\d+)/i);
      return {
        product: 'Weatherproof Pressure Switch S201',
        variantCode: tag ? tag[1].toUpperCase() : m.materialCode,
        displayName: tag ? tag[1].toUpperCase() : 'Untagged',
      };
    }
    default:
      // Piping groups by familyCode — but a fitting family mixes types
      // (FT-BW-CS-A234 holds elbows, tees, caps and reducers), and a tee is
      // not a variant of an elbow. Split those on fittingType. Flanges need
      // no such split: each type is already its own family.
      if (m.familyCode) {
        const parts = [];
        if (m.nps) parts.push(`NPS ${m.nps}`);
        if (m.pressureClass) parts.push(String(m.pressureClass));
        if (m.schedule) parts.push(`Sch ${m.schedule}`);
        return {
          product: m.fittingType ? `${m.familyCode} · ${m.fittingType}` : m.familyCode,
          variantCode: m.materialCode,
          displayName: parts.join(' ') || m.name,
        };
      }
      return { product: m.name, variantCode: m.materialCode, displayName: m.name, single: true };
  }
}

/** Product-level display name for a piping family, from its members. */
function productName(key, members) {
  const first = members[0];
  if (!/^F[LT]-/.test(key)) return key;
  // A fitting product is one type within a family, so its name must come from
  // the type — the family's members disagree on it by design.
  // "90° Elbow Long Radius Carbon Steel ASTM A234 WPB NPS 4" → drop the size tail.
  return String(first.name)
    .replace(/\s+NPS\s+[\d/.\sx]+.*$/i, '')
    .trim();
}

/** Carry the piping dimensions onto the variant so nothing is lost in the move. */
function variantSpecifications(m) {
  const spec = {};
  for (const f of [
    'nps',
    'dn',
    'pressureClass',
    'schedule',
    'scheduleType',
    'fittingType',
    'outsideDiameter_mm',
    'wallThickness_mm',
    'weightPerMeter_kg',
  ]) {
    if (m[f] !== undefined) spec[f] = m[f];
  }
  if (m.specification && Object.keys(m.specification).length) spec.materialSpec = m.specification;
  return spec;
}

(async () => {
  const snap = await db.collection('materials').get();
  const live = [];
  snap.forEach((d) => {
    const m = d.data();
    if (m.isMigrated !== true) live.push({ id: d.id, ...m });
  });

  const moving = live.filter(
    (m) => !(RAW_CATEGORIES.has(m.category) || RAW_CODES.has(m.materialCode))
  );
  // `OTHER` is deferred — see the plan's open items.
  const deferred = moving.filter((m) => m.category === 'OTHER');
  const target = moving.filter((m) => m.category !== 'OTHER');

  // ---- Backup -------------------------------------------------------------
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join('docs', 'inputs', 'backups');
  const backupFile = path.join(backupDir, `materials-before-taxonomy-${stamp}.json`);
  if (APPLY || BACKUP_ONLY) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify(live, null, 2));
    console.log(`backup written: ${backupFile} (${live.length} docs)`);
    if (BACKUP_ONLY) process.exit(0);
  }

  // ---- Group into products ------------------------------------------------
  const products = new Map();
  for (const m of target) {
    const p = productFor(m);
    if (!products.has(p.product)) products.set(p.product, { key: p.product, members: [] });
    products.get(p.product).members.push({ m, p });
  }

  console.log(`\nstays in materials : ${live.length - moving.length}`);
  console.log(`moving             : ${target.length} docs → ${products.size} products`);
  console.log(`deferred (OTHER)   : ${deferred.length}`);
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — no writes'}\n`);

  const rows = [];
  for (const [key, { members }] of products) {
    const first = members[0].m;
    const name =
      members.length > 1
        ? productName(
            key,
            members.map((x) => x.m)
          )
        : first.name;
    rows.push({
      product: name,
      familyKey: key,
      category: TO_BOUGHT_OUT_CATEGORY[first.category] || 'OTHER',
      variants: members.length,
    });
  }
  rows
    .sort((a, b) => b.variants - a.variants)
    .forEach((r) =>
      console.log(
        `  ${String(r.familyKey).padEnd(30)} ${String(r.variants).padStart(3)} variants  ` +
          `[${r.category}]  "${r.product}"`
      )
    );

  if (!APPLY) {
    console.log('\nRe-run with --apply to write (a backup is taken first).');
    process.exit(0);
  }

  // ---- Write --------------------------------------------------------------
  const now = admin.firestore.Timestamp.now();
  const tenantId = target.find((m) => m.tenantId)?.tenantId || 'default-entity';
  let created = 0;
  let flagged = 0;

  for (const [key, { members }] of products) {
    const first = members[0].m;
    const name =
      members.length > 1
        ? productName(
            key,
            members.map((x) => x.m)
          )
        : first.name;

    const variants = members.map(({ m, p }, i) => ({
      id: `v${String(i + 1).padStart(3, '0')}`,
      variantCode: p.variantCode,
      displayName: p.displayName,
      specifications: variantSpecifications(m),
      priceHistory: [],
      isAvailable: m.isActive !== false,
      migratedFromMaterialCode: m.materialCode,
    }));

    const ref = db.collection('bought_out_items').doc();
    const doc = {
      tenantId,
      itemCode: key,
      name,
      description: members.length > 1 ? '' : first.description || '',
      category: TO_BOUGHT_OUT_CATEGORY[first.category] || 'OTHER',
      specifications: {},
      pricing: {
        listPrice: { amount: 0, currency: 'INR' },
        currency: 'INR',
        lastUpdated: now,
      },
      variants,
      // Price and make/model were never captured on the source docs — flag for
      // a human pass rather than pretending the record is complete.
      needsReview: true,
      tags: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'taxonomy-migration',
      updatedBy: 'taxonomy-migration',
    };
    await ref.set(doc);
    created++;

    // Flag the sources rather than deleting: `isMigrated` is already honoured
    // by queryMaterials, and the referencing lines still resolve their code.
    for (let i = 0; i < members.length; i += 400) {
      const batch = db.batch();
      for (const { m } of members.slice(i, i + 400)) {
        batch.update(db.collection('materials').doc(m.id), {
          isMigrated: true,
          migratedToBoughtOutItemId: ref.id,
          updatedAt: now,
        });
        flagged++;
      }
      await batch.commit();
    }
  }

  console.log(`\ncreated ${created} bought_out_items, flagged ${flagged} materials as isMigrated`);
  console.log('references are NOT repointed yet — 32 lines, see the plan.');
  process.exit(0);
})().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
