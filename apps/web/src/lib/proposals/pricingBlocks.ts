/**
 * Costing & Pricing helpers (Stages 2 + 2.5).
 *
 * Seeds the Costing tab's default blocks from the work components on the
 * parent enquiry, and seeds a starter ClientPricing for the Pricing tab.
 */

import type {
  CurrencyCode,
  PricingBlock,
  WorkComponent,
  ManpowerRosterBlock,
  PerMandayCostBlock,
  LumpSumLinesBlock,
  BOMCostSheetBlock,
  ClientPricing,
} from '@vapour/types';

const newId = (): string => Math.random().toString(36).slice(2, 11);

/**
 * Seed the default Costing-tab blocks for a freshly created proposal,
 * based on the work components inherited from the parent enquiry.
 *
 * All blocks are INTERNAL — Costing is by definition internal. Markup,
 * client-facing lump sums, and tax live on the Pricing tab and are
 * seeded by `createDefaultClientPricing` below.
 *
 *  - SURVEY        → Manpower roster + Per-manday site costs
 *  - ENGINEERING   → Manpower roster (engineering team)
 *  - SUPPLY        → BOM cost sheet
 *  - INSTALLATION  → Manpower roster (site commissioning)
 *  - OM            → Manpower roster (O&M team)
 */
export function seedPricingBlocksForComponents(
  components: WorkComponent[],
  currency: CurrencyCode
): PricingBlock[] {
  const blocks: PricingBlock[] = [];

  for (const c of components) {
    if (c === 'SURVEY') {
      blocks.push(createManpowerBlock(currency, 'INTERNAL', 'Survey team'));
      blocks.push(createPerMandayBlock(currency, 'INTERNAL', 'Site costs'));
    } else if (c === 'ENGINEERING') {
      blocks.push(createManpowerBlock(currency, 'INTERNAL', 'Engineering team'));
    } else if (c === 'SUPPLY') {
      blocks.push(createBOMCostSheetBlock(currency, 'INTERNAL', 'Equipment BOMs'));
    } else if (c === 'INSTALLATION') {
      blocks.push(createManpowerBlock(currency, 'INTERNAL', 'Site commissioning'));
    } else if (c === 'OM') {
      blocks.push(createManpowerBlock(currency, 'INTERNAL', 'O&M team'));
    }
  }

  return blocks;
}

/**
 * Seed a starter ClientPricing for a freshly created proposal.
 *
 * Defaults match Indian-domestic supply (INR + GST 18% + fxRate 1). The
 * user can switch the quote currency and rate on the Pricing tab if the
 * offer is going to a foreign client.
 */
export function createDefaultClientPricing(): ClientPricing {
  return {
    overheadPercent: 0,
    contingencyPercent: 0,
    profitPercent: 0,
    lumpSumLines: [],
    taxRate: 18,
    taxLabel: 'GST 18%',
    currency: 'INR',
    fxRate: 1,
  };
}

export function createManpowerBlock(
  currency: CurrencyCode,
  audience: ManpowerRosterBlock['audience'],
  label: string
): ManpowerRosterBlock {
  return {
    id: newId(),
    kind: 'MANPOWER_ROSTER',
    label,
    audience,
    currency,
    subtotal: 0,
    rows: [],
  };
}

export function createPerMandayBlock(
  currency: CurrencyCode,
  audience: PerMandayCostBlock['audience'],
  label: string
): PerMandayCostBlock {
  return {
    id: newId(),
    kind: 'PER_MANDAY_COST',
    label,
    audience,
    currency,
    subtotal: 0,
    rows: [],
  };
}

export function createLumpSumBlock(
  currency: CurrencyCode,
  audience: LumpSumLinesBlock['audience'],
  label: string
): LumpSumLinesBlock {
  return {
    id: newId(),
    kind: 'LUMP_SUM_LINES',
    label,
    audience,
    currency,
    subtotal: 0,
    rows: [],
  };
}

export function createBOMCostSheetBlock(
  currency: CurrencyCode,
  audience: BOMCostSheetBlock['audience'],
  label: string
): BOMCostSheetBlock {
  return {
    id: newId(),
    kind: 'BOM_COST_SHEET',
    label,
    audience,
    currency,
    subtotal: 0,
    linkedBomIds: [],
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Recompute subtotals for every row + the block as a whole.
 * Pure function — does not mutate the input.
 */
export function recomputeBlockSubtotal(block: PricingBlock): PricingBlock {
  switch (block.kind) {
    case 'MANPOWER_ROSTER': {
      const rows = block.rows.map((r) => ({
        ...r,
        total: round2((r.mandays || 0) * (r.dayRate || 0)),
      }));
      return { ...block, rows, subtotal: round2(rows.reduce((s, r) => s + r.total, 0)) };
    }
    case 'PER_MANDAY_COST': {
      const rows = block.rows.map((r) => ({
        ...r,
        total: round2((r.mandays || 0) * (r.ratePerManday || 0)),
      }));
      return { ...block, rows, subtotal: round2(rows.reduce((s, r) => s + r.total, 0)) };
    }
    case 'LUMP_SUM_LINES': {
      return {
        ...block,
        subtotal: round2(block.rows.reduce((s, r) => s + (r.amount || 0), 0)),
      };
    }
    case 'BOM_COST_SHEET': {
      // Subtotal computed elsewhere from linked BOM totals; pass through.
      return block;
    }
  }
}
