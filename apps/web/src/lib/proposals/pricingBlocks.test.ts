/**
 * Pricing blocks — BOM cost sheet linkage (completion plan A1).
 *
 * Covers the denormalized-snapshot design: linking BOMs stores a cost
 * snapshot on the block, the sync subtotal recompute sums the snapshots
 * with paisa rounding (rule 21), "Refresh from BOMs" updates changed
 * costs (rule 13 sync strategy), unlink clears both id and snapshot, and
 * the new fields survive the save→edit round-trip (rule 22) through the
 * same deep-clean the proposal service applies before updateDoc.
 */

// typeHelpers (removeUndefinedDeep) imports Timestamp from firebase/firestore,
// which is undefined under jsdom without this mock (same pattern as the other
// suites in this directory). The pricing-block helpers themselves are pure.
jest.mock('firebase/firestore', () => ({
  Timestamp: class MockTimestamp {},
  serverTimestamp: jest.fn(),
  getDocs: jest.fn(),
}));

import {
  createBOMCostSheetBlock,
  recomputeBlockSubtotal,
  bomToSnapshot,
  linkBomToBlock,
  unlinkBomFromBlock,
  refreshBomSnapshots,
} from './pricingBlocks';
import { computeCommercialSummary } from './commercialSummary';
import { removeUndefinedDeep } from '@/lib/firebase/typeHelpers';
import type { BOM, BOMCostSheetBlock, Proposal } from '@vapour/types';

/** Minimal BOM double — only the fields bomToSnapshot reads. */
function makeBom(id: string, bomCode: string, name: string, amount: number): BOM {
  return {
    id,
    bomCode,
    name,
    summary: { totalCost: { amount, currency: 'INR' } },
  } as unknown as BOM;
}

function makeBlock(): BOMCostSheetBlock {
  return createBOMCostSheetBlock('INR', 'INTERNAL', 'Equipment BOMs');
}

describe('BOM cost sheet linkage', () => {
  describe('linkBomToBlock', () => {
    it('adds the BOM id and cost snapshot and recomputes the subtotal', () => {
      const block = linkBomToBlock(
        makeBlock(),
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'HX-101', 150000))
      );

      expect(block.linkedBomIds).toEqual(['b1']);
      expect(block.linkedBomSnapshots).toEqual([
        { bomId: 'b1', bomCode: 'EST-2026-0001', name: 'HX-101', totalCostAmount: 150000 },
      ]);
      expect(block.subtotal).toBe(150000);
    });

    it('sums multiple linked BOMs with paisa rounding (rule 21)', () => {
      let block = makeBlock();
      // 1000.1 + 2000.2 = 3000.2999999999997 in raw IEEE754
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1000.1)));
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b2', 'EST-2026-0002', 'B', 2000.2)));

      expect(block.linkedBomIds).toEqual(['b1', 'b2']);
      expect(block.subtotal).toBe(3000.3);
    });

    it('is idempotent — re-linking a BOM replaces its snapshot instead of duplicating', () => {
      let block = linkBomToBlock(
        makeBlock(),
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 100))
      );
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 250)));

      expect(block.linkedBomIds).toEqual(['b1']);
      expect(block.linkedBomSnapshots).toHaveLength(1);
      expect(block.subtotal).toBe(250);
    });
  });

  describe('unlinkBomFromBlock', () => {
    it('clears the id, the snapshot, and the cost from the subtotal', () => {
      let block = makeBlock();
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1000)));
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b2', 'EST-2026-0002', 'B', 500)));

      block = unlinkBomFromBlock(block, 'b1');

      expect(block.linkedBomIds).toEqual(['b2']);
      expect(block.linkedBomSnapshots).toEqual([
        { bomId: 'b2', bomCode: 'EST-2026-0002', name: 'B', totalCostAmount: 500 },
      ]);
      expect(block.subtotal).toBe(500);
    });

    it('unlinking the last BOM zeroes the subtotal', () => {
      let block = linkBomToBlock(
        makeBlock(),
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1000))
      );
      block = unlinkBomFromBlock(block, 'b1');

      expect(block.linkedBomIds).toEqual([]);
      expect(block.linkedBomSnapshots).toEqual([]);
      expect(block.subtotal).toBe(0);
    });
  });

  describe('refreshBomSnapshots (rule 13 sync strategy)', () => {
    it('updates the snapshot and subtotal when a BOM cost changed', () => {
      let block = linkBomToBlock(
        makeBlock(),
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1000))
      );

      block = refreshBomSnapshots(block, [
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1750.55)),
      ]);

      expect(block.linkedBomSnapshots?.[0]?.totalCostAmount).toBe(1750.55);
      expect(block.subtotal).toBe(1750.55);
    });

    it('keeps the last-known snapshot for BOMs missing from the refresh (graceful degrade)', () => {
      let block = makeBlock();
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 1000)));
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b2', 'EST-2026-0002', 'B', 500)));

      // Only b1 could be fetched; b2 (deleted / permission denied) keeps its snapshot.
      block = refreshBomSnapshots(block, [
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 2000)),
      ]);

      expect(block.subtotal).toBe(2500);
      expect(block.linkedBomSnapshots).toHaveLength(2);
      expect(block.linkedBomSnapshots?.find((s) => s.bomId === 'b2')?.totalCostAmount).toBe(500);
    });
  });

  describe('recomputeBlockSubtotal (BOM_COST_SHEET)', () => {
    it('drops phantom snapshots whose BOM is no longer linked', () => {
      const block = linkBomToBlock(
        makeBlock(),
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 100))
      );
      const tampered: BOMCostSheetBlock = {
        ...block,
        linkedBomSnapshots: [
          ...(block.linkedBomSnapshots ?? []),
          { bomId: 'ghost', bomCode: 'EST-0000-0000', name: 'Ghost', totalCostAmount: 99999 },
        ],
      };

      const recomputed = recomputeBlockSubtotal(tampered) as BOMCostSheetBlock;

      expect(recomputed.subtotal).toBe(100);
      expect(recomputed.linkedBomSnapshots).toHaveLength(1);
    });

    it('treats a legacy block without snapshots as zero cost', () => {
      const legacy = makeBlock(); // linkedBomIds: [], no snapshots
      const recomputed = recomputeBlockSubtotal({ ...legacy, subtotal: 12345 });
      expect(recomputed.subtotal).toBe(0);
    });
  });

  describe('commercial summary integration', () => {
    it('the BOM block subtotal flows into the cost basis and revenue target', () => {
      let block = makeBlock();
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'A', 100000)));
      block = linkBomToBlock(block, bomToSnapshot(makeBom('b2', 'EST-2026-0002', 'B', 50000.5)));

      const proposal = {
        pricingBlocks: [block],
        clientPricing: {
          overheadPercent: 10,
          contingencyPercent: 0,
          profitPercent: 0,
          priceSections: [],
          taxRate: 0,
          taxLabel: 'Tax',
          currency: 'INR',
          fxRate: 1,
        },
      } as unknown as Proposal;

      const summary = computeCommercialSummary(proposal);

      expect(summary?.costBasisInr).toBe(150000.5);
      expect(summary?.targetRevenueInr).toBe(165000.55); // ×1.10, paisa-rounded
    });
  });

  describe('save→edit round-trip (rule 22)', () => {
    it('linkedBomIds and linkedBomSnapshots survive the persistence deep-clean unchanged', () => {
      let block = makeBlock();
      block = linkBomToBlock(
        block,
        bomToSnapshot(makeBom('b1', 'EST-2026-0001', 'HX-101', 150000))
      );
      block = linkBomToBlock(
        block,
        bomToSnapshot(makeBom('b2', 'EST-2026-0002', 'Tank', 42000.42))
      );

      // updateProposal deep-strips undefined before updateDoc — same helper.
      const persisted = removeUndefinedDeep({ pricingBlocks: [block] });
      // Simulate reload from Firestore (plain JSON data back into the editor).
      const restored = JSON.parse(JSON.stringify(persisted)).pricingBlocks[0] as BOMCostSheetBlock;

      expect(restored.linkedBomIds).toEqual(['b1', 'b2']);
      expect(restored.linkedBomSnapshots).toEqual(block.linkedBomSnapshots);
      expect(restored.subtotal).toBe(192000.42);
      // And the reloaded block recomputes to the same subtotal (edit reopens clean).
      expect(recomputeBlockSubtotal(restored).subtotal).toBe(192000.42);
    });
  });
});
