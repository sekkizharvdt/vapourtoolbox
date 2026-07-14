/**
 * Costing & Pricing helpers (Stages 2 + 2.5).
 *
 * Seeds the Costing tab's default blocks from the work components on the
 * parent enquiry, and seeds a starter ClientPricing for the Pricing tab.
 */

import type {
  BOM,
  CurrencyCode,
  PricingBlock,
  WorkComponent,
  ManpowerRosterBlock,
  PerMandayCostBlock,
  LumpSumLinesBlock,
  BOMCostSheetBlock,
  LinkedBomSnapshot,
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
    priceSections: [],
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
        subtotal: round2(block.rows.reduce((s, r) => s + (r.amount ?? 0), 0)),
      };
    }
    case 'BOM_COST_SHEET': {
      // Sum the denormalized cost snapshots of the linked BOMs (rule 26).
      // Snapshots for BOMs no longer in linkedBomIds are dropped so an
      // unlink can never leave a phantom cost behind.
      const snapshots = (block.linkedBomSnapshots ?? []).filter((s) =>
        block.linkedBomIds.includes(s.bomId)
      );
      return {
        ...block,
        linkedBomSnapshots: snapshots,
        subtotal: round2(snapshots.reduce((s, x) => s + (x.totalCostAmount || 0), 0)),
      };
    }
  }
}

/* ─── BOM cost sheet linkage helpers (all pure) ───────────────────────── */

/**
 * Build the denormalized snapshot for a BOM (rule 26: id + display fields
 * + the cost that drives the subtotal). INR basis — BOM summaries are INR.
 */
export function bomToSnapshot(bom: BOM): LinkedBomSnapshot {
  return {
    bomId: bom.id,
    bomCode: bom.bomCode,
    name: bom.name,
    totalCostAmount: round2(bom.summary?.totalCost?.amount ?? 0),
  };
}

/**
 * Link a BOM to a BOM_COST_SHEET block. Idempotent — re-linking an
 * already-linked BOM just replaces its snapshot with the fresh one.
 */
export function linkBomToBlock(
  block: BOMCostSheetBlock,
  snapshot: LinkedBomSnapshot
): BOMCostSheetBlock {
  const linkedBomIds = block.linkedBomIds.includes(snapshot.bomId)
    ? block.linkedBomIds
    : [...block.linkedBomIds, snapshot.bomId];
  const linkedBomSnapshots = [
    ...(block.linkedBomSnapshots ?? []).filter((s) => s.bomId !== snapshot.bomId),
    snapshot,
  ];
  return recomputeBlockSubtotal({
    ...block,
    linkedBomIds,
    linkedBomSnapshots,
  }) as BOMCostSheetBlock;
}

/** Unlink a BOM from a BOM_COST_SHEET block (id + snapshot + subtotal). */
export function unlinkBomFromBlock(block: BOMCostSheetBlock, bomId: string): BOMCostSheetBlock {
  return recomputeBlockSubtotal({
    ...block,
    linkedBomIds: block.linkedBomIds.filter((id) => id !== bomId),
    linkedBomSnapshots: (block.linkedBomSnapshots ?? []).filter((s) => s.bomId !== bomId),
  }) as BOMCostSheetBlock;
}

/**
 * Refresh a block's snapshots against freshly fetched BOM data (the rule 13
 * sync strategy for this denormalization). BOMs that could not be fetched
 * (deleted, permission, offline) keep their existing snapshot — the block
 * degrades gracefully instead of zeroing the cost basis.
 */
export function refreshBomSnapshots(
  block: BOMCostSheetBlock,
  currentSnapshots: LinkedBomSnapshot[]
): BOMCostSheetBlock {
  const byId = new Map(currentSnapshots.map((s) => [s.bomId, s]));
  const linkedBomSnapshots = block.linkedBomIds
    .map((id) => byId.get(id) ?? (block.linkedBomSnapshots ?? []).find((s) => s.bomId === id))
    .filter((s): s is LinkedBomSnapshot => s !== undefined);
  return recomputeBlockSubtotal({ ...block, linkedBomSnapshots }) as BOMCostSheetBlock;
}
