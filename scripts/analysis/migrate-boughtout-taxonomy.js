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

/**
 * Duplex 2205 butt-weld fittings (ASTM A815), synthesized from the stainless
 * set — required 2026-08-16; super duplex explicitly not wanted.
 *
 * B16.9 geometry is a dimensional standard, not a material property: a 90°
 * long-radius elbow at NPS 4 has the same centre-to-end whatever it is forged
 * from. So the duplex family is the A403 family's type/size set re-badged to
 * A815, with schedules and wall thicknesses sourced from the DUPLEX pipe
 * catalogue (PP-DX2205-A790-SMLS) rather than the stainless one. Nothing
 * dimensional is invented — sizes above the duplex pipe range get no schedule,
 * exactly as they do for carbon and stainless.
 */
function synthesizeDuplexFittings(live) {
  const source = live.filter((m) => m.familyCode === 'FT-BW-SS-A403');
  return source.map((m) => {
    // "FT-BW-SS-A403-90ELR-12" → type code "90ELR"
    const tail = String(m.materialCode).slice('FT-BW-SS-A403-'.length);
    const typeCode = tail.replace(/-[^-]*$/, '');
    return {
      ...m,
      materialCode: `FT-BW-DX-A815-${typeCode}-${m.nps}`,
      familyCode: 'FT-BW-DX-A815',
      name: String(m.name).replace(
        /Stainless Steel ASTM A403 WP304L\/WP316L/,
        'Duplex Steel ASTM A815 UNS S31803'
      ),
      specification: { grade: 'UNS S31803 (2205)', standard: 'ASME B16.9-2024' },
      seedMetadata: {
        standard: 'ASME B16.9-2024',
        specification: 'ASTM A815 (Duplex)',
        derivedFrom: m.materialCode,
      },
      /** Marks a record this migration created rather than moved. */
      isSynthesized: true,
      // The source's document id must NOT ride along: a synthesized record has
      // no `materials` document of its own, and leaving the stainless id here
      // would make the flagging pass below stamp the stainless docs with the
      // DUPLEX product's id.
      id: undefined,
    };
  });
}

/** Normalize an NPS string so "2 1/2", "2-1/2" and "21/2" compare equal. */
function normNps(v) {
  return String(v).replace(/\s+/g, '').replace(/-/g, '');
}

/**
 * Which pipe grade a fitting family welds to. Wall thickness for a given
 * NPS + schedule is a dimensional standard (B36.10 for carbon, B36.19M for
 * stainless/duplex), so the mating pipe is the honest source — inventing a
 * wall thickness per fitting would be a second, unsourced copy of that table.
 */
const FITTING_TO_PIPE_GRADE = {
  'FT-BW-CS-A234': 'PIPES_CARBON_STEEL',
  'FT-BW-SS-A403': 'PIPES_STAINLESS_316L',
  'FT-BW-DX-A815': 'PIPES_DUPLEX_2205',
};

/**
 * Build `grade → nps → schedule → { od, wall, kgPerM }` from the pipe catalogue.
 * This is what lets a fitting variant state a schedule and still be traceable
 * to a real dimensional record.
 */
function buildPipeIndex(live) {
  const index = {};
  for (const p of live) {
    if (!String(p.category).startsWith('PIPES')) continue;
    if (!p.nps || !p.schedule) continue; // one malformed doc has neither
    const byNps = (index[p.category] = index[p.category] || {});
    const bySch = (byNps[normNps(p.nps)] = byNps[normNps(p.nps)] || {});
    bySch[String(p.schedule)] = {
      outsideDiameter_mm: p.outsideDiameter_mm,
      wallThickness_mm: p.wallThickness_mm,
      weightPerMeter_kg: p.weightPerMeter_kg,
      sourceMaterialCode: p.materialCode,
    };
  }
  return index;
}

/**
 * Schedules a fitting is available in, and where each one's dimensions come from.
 *
 * A reducer's NPS is a pair ("6 x 4"); it is bored for both, so only schedules
 * the LARGER bore offers are valid. Sizes above the pipe catalogue's range
 * (fittings reach NPS 24, pipes stop at 12) return no schedules — they stay
 * single variants flagged `scheduleUnsourced` rather than inventing a wall.
 */
function schedulesForFitting(m, pipeIndex) {
  const pipeCategory = FITTING_TO_PIPE_GRADE[m.familyCode];
  const byNps = pipeIndex[pipeCategory];
  if (!byNps) return [];

  const bores = normNps(m.nps).split('x').filter(Boolean);
  const perBore = bores.map((b) => byNps[b]).filter(Boolean);
  if (perBore.length !== bores.length) return []; // some bore has no pipe

  // Intersect: a reducer must be orderable in the schedule at both ends.
  const [first, ...rest] = perBore;
  return Object.keys(first)
    .filter((sch) => rest.every((b) => b[sch]))
    .sort((a, b) => Number(a) - Number(b))
    .map((sch) => ({ schedule: sch, dims: perBore[perBore.length - 1][sch] }));
}

/**
 * Variants for one product. Butt-weld fittings expand each catalogue NPS into
 * one variant per schedule its mating pipe offers (decided 2026-08-16 — a
 * Sch 160 elbow and a Sch 10 elbow are different unit rates, so schedule has
 * to be a variant, not a line-level note). Everything else is one variant per
 * source document.
 */
function buildVariants(members, pipeIndex) {
  const out = [];
  for (const { m, p } of members) {
    const scheds = m.category === 'FITTINGS_BUTT_WELD' ? schedulesForFitting(m, pipeIndex) : [];

    if (scheds.length === 0) {
      out.push({
        variantCode: p.variantCode,
        displayName: p.displayName,
        specifications: variantSpecifications(m),
        priceHistory: [],
        isAvailable: m.isActive !== false,
        migratedFromMaterialCode: m.materialCode,
        // Fittings above the pipe catalogue's range (NPS 14-24) get no
        // schedule rather than an invented wall thickness.
        ...(m.category === 'FITTINGS_BUTT_WELD' && { scheduleUnsourced: true }),
      });
      continue;
    }

    for (const { schedule, dims } of scheds) {
      out.push({
        variantCode: `${p.variantCode}-SCH${schedule}`,
        displayName: `${p.displayName} Sch ${schedule}`,
        specifications: {
          ...variantSpecifications(m),
          schedule,
          // Sourced from the mating pipe, not invented.
          wallThickness_mm: dims.wallThickness_mm,
          ...(dims.outsideDiameter_mm !== undefined && {
            outsideDiameter_mm: dims.outsideDiameter_mm,
          }),
          wallThicknessSource: dims.sourceMaterialCode,
        },
        priceHistory: [],
        isAvailable: m.isActive !== false,
        migratedFromMaterialCode: m.materialCode,
      });
    }
  }
  return out.map((v, i) => ({ id: `v${String(i + 1).padStart(3, '0')}`, ...v }));
}

/**
 * Everything dimensional on the source document, carried onto the variant.
 *
 * DENYLIST, not an allowlist. The first version listed the fields it thought
 * mattered and silently dropped 16 of the 25 that exist — every flange's bolt
 * circle, hole count, bolt size, raised face and thickness, both reducer end
 * sizes, and weightPerPiece_kg. A migration that quietly loses data is worse
 * than one that carries a field nobody reads, so the default is now "keep it".
 */
const NON_DIMENSIONAL_FIELDS = new Set([
  'materialCode',
  'name',
  'description',
  'category',
  'materialType',
  'specification',
  'properties',
  'hasVariants',
  'baseUnit',
  'preferredVendors',
  'priceHistory',
  'trackInventory',
  'tags',
  'isActive',
  'isStandard',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'familyCode',
  'seedMetadata',
  'isMigrated',
  'isSynthesized',
  'variants',
  'tenantId',
  'customCode',
  'subCategory',
  'needsReview',
  'id',
  'currentPrice',
  'currentStock',
  'reorderLevel',
  'reorderQuantity',
  'leadTimeDays',
  'minimumOrderQuantity',
  'datasheetUrl',
  'imageUrl',
  'substituteMaterials',
  'substituteNotes',
  'alternateUnits',
]);

function variantSpecifications(m) {
  const spec = {};
  for (const [key, value] of Object.entries(m)) {
    if (NON_DIMENSIONAL_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;
    spec[key] = value;
  }
  // The grade/standard block travels whole — it is what tells a duplex elbow
  // from a stainless one once the piping fields look identical.
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

  const pipeIndex = buildPipeIndex(live);

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
  // Duplex fittings do not exist in `materials` — they are created here, so
  // they join the same grouping/variant path as everything being moved.
  const synthesized = synthesizeDuplexFittings(live);
  const products = new Map();
  for (const m of [...target, ...synthesized]) {
    const p = productFor(m);
    if (!products.has(p.product)) products.set(p.product, { key: p.product, members: [] });
    products.get(p.product).members.push({ m, p });
  }

  console.log(`\nstays in materials : ${live.length - moving.length}`);
  console.log(`moving             : ${target.length} docs → ${products.size} products`);
  console.log(
    `synthesized (DX)   : ${synthesized.length} duplex fitting sizes (new catalogue data)`
  );
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
    const built = buildVariants(members, pipeIndex);
    rows.push({
      product: name,
      familyKey: key,
      category: TO_BOUGHT_OUT_CATEGORY[first.category] || 'OTHER',
      variants: built.length,
      sources: members.length,
      unsourced: built.filter((v) => v.scheduleUnsourced).length,
    });
  }
  rows
    .sort((a, b) => b.variants - a.variants)
    .forEach((r) =>
      console.log(
        `  ${String(r.familyKey).padEnd(38)} ${String(r.variants).padStart(4)} variants ` +
          `(${String(r.sources).padStart(3)} docs` +
          `${r.unsourced ? `, ${r.unsourced} without schedule` : ''})  "${r.product}"`
      )
    );

  const totalVariants = rows.reduce((n, r) => n + r.variants, 0);
  const totalUnsourced = rows.reduce((n, r) => n + (r.unsourced || 0), 0);
  console.log(
    `\n  ${target.length} docs → ${rows.length} products → ${totalVariants} variants` +
      `${totalUnsourced ? ` (${totalUnsourced} fitting variants have no schedule — NPS above the pipe range)` : ''}`
  );

  if (!APPLY) {
    console.log('\nRe-run with --apply to write (a backup is taken first).');
    process.exit(0);
  }

  // ---- Write --------------------------------------------------------------
  const now = admin.firestore.Timestamp.now();
  // All 138 existing bought_out_items carry 'default-entity', and
  // listBoughtOutItems filters `where('tenantId','==',...)` — a product written
  // with anything else would migrate "successfully" and then be invisible in
  // the picker. Materials are inconsistent here (368 undefined, 32
  // 'default-entity'), so deriving it from the sources would be luck.
  const tenantId = 'default-entity';
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

    const variants = buildVariants(members, pipeIndex);

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
        // Synthesized records (the duplex family) have no source document to
        // flag — they are created here, not moved.
        if (m.isSynthesized || !m.id) continue;
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
