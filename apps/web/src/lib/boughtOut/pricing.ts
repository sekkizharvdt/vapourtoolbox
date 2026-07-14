/**
 * Bought-Out Item Price Management
 *
 * Mirrors `apps/web/src/lib/materials/pricing.ts` for the bought-out
 * catalog. Every accepted price from a vendor quote, PO creation, or
 * GR-backed bill appends a record here so the catalog has a per-vendor,
 * time-series view of how a specific valve / pump / instrument's price
 * has moved — instead of silently overwriting `pricing.listPrice` on
 * the parent doc.
 *
 * `addBoughtOutPrice` also denormalizes the latest active price onto
 * `bought_out_items.pricing` (listPrice / currency / vendorId /
 * effectiveDate), mirroring how `addMaterialPrice` maintains
 * `material.currentPrice` — the catalog picker and BOM costing read the
 * parent doc directly.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  addDoc,
  runTransaction,
  doc,
  Timestamp,
  type Firestore,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import type { BoughtOutItem, BoughtOutPrice } from '@vapour/types';

const logger = createLogger({ context: 'boughtOutService:pricing' });

/**
 * Bought-out price history lives in its own top-level collection, mirroring
 * `materialPrices`. Snake_case to align with `bought_out_items`.
 */
export const BOUGHT_OUT_PRICES_COLLECTION = 'bought_out_prices';

/** Parent catalog collection (same constant as boughtOutService). */
const BOUGHT_OUT_ITEMS_COLLECTION = 'bought_out_items';

export interface PriceHistoryOptions {
  vendorId?: string;
  startDate?: Date;
  endDate?: Date;
  limitResults?: number;
}

/**
 * Append a new bought-out price record. Returns the created row with id.
 * Caller is expected to have already authorised the action (typically via
 * `acceptQuoteItemPrice` which checks MANAGE_PROCUREMENT).
 *
 * When the price is active (not a budgetary forecast) and at least as new
 * as the parent item's current price, the parent's `pricing` block is
 * updated in place (dot-path update — leadTime/moq are preserved), exactly
 * mirroring `addMaterialPrice` → `material.currentPrice`.
 */
export async function addBoughtOutPrice(
  db: Firestore,
  price: Omit<BoughtOutPrice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<BoughtOutPrice> {
  // rule5-exempt: entity-management write; firestore.rules enforce MANAGE_ENTITIES / MANAGE_PROCUREMENT — server-side gated
  const now = Timestamp.now();
  const tenantId = price.tenantId;
  const newPrice: Omit<BoughtOutPrice, 'id'> = {
    ...price,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };
  // Explicit tenantId pass-through for the tenant-ID safety audit
  // (CLAUDE.md rule #1). Caller may or may not supply it; we don't
  // fabricate one — undefined stays undefined.
  const ref = await addDoc(collection(db, BOUGHT_OUT_PRICES_COLLECTION), {
    ...newPrice,
    ...(tenantId && { tenantId }),
  });
  logger.info('Bought-out price added', {
    priceId: ref.id,
    boughtOutItemId: price.boughtOutItemId,
    vendorId: price.vendorId,
  });

  // Denormalize the latest active price onto the parent bought_out_items
  // doc so the catalog picker and BOM costing see it without querying the
  // history collection. Only if this price is at least as new as the one
  // currently shown (pricing.effectiveDate; absent = hand-edited legacy →
  // treated as older).
  // runTransaction (rule 19): the recency check reads pricing.effectiveDate
  // and writes conditionally — two concurrent price accepts must not let the
  // older price win.
  if (newPrice.isActive) {
    try {
      await runTransaction(db, async (tx) => {
        const itemRef = doc(db, BOUGHT_OUT_ITEMS_COLLECTION, price.boughtOutItemId);
        const itemSnap = await tx.get(itemRef);
        if (itemSnap.exists()) {
          const item = itemSnap.data() as Omit<BoughtOutItem, 'id'>;
          const existingDate = item.pricing?.effectiveDate;
          const isNewer =
            !existingDate || newPrice.effectiveDate.toMillis() >= existingDate.toMillis();
          if (isNewer) {
            tx.update(itemRef, {
              'pricing.listPrice': { amount: newPrice.unitPrice, currency: newPrice.currency },
              'pricing.currency': newPrice.currency,
              ...(newPrice.vendorId && { 'pricing.vendorId': newPrice.vendorId }),
              'pricing.effectiveDate': newPrice.effectiveDate,
              'pricing.lastUpdated': now,
              updatedAt: now,
              updatedBy: userId,
            });
            logger.info('Bought-out current price denormalized', {
              boughtOutItemId: price.boughtOutItemId,
              unitPrice: newPrice.unitPrice,
            });
          }
        } else {
          logger.warn('Bought-out item not found for price denormalization', {
            boughtOutItemId: price.boughtOutItemId,
          });
        }
      });
    } catch (denormError) {
      // Non-fatal: the history row is written; the parent doc just keeps its
      // previous price until the next successful update.
      logger.warn('Failed to denormalize bought-out current price', {
        boughtOutItemId: price.boughtOutItemId,
        error: denormError,
      });
    }
  }

  return { ...newPrice, id: ref.id };
}

/**
 * Return price history for a bought-out item. Newest-first by effectiveDate.
 * Optional vendor / date / limit filters mirror `getMaterialPriceHistory`.
 */
export async function getBoughtOutPriceHistory(
  db: Firestore,
  boughtOutItemId: string,
  options: PriceHistoryOptions = {}
): Promise<BoughtOutPrice[]> {
  let priceQuery: Query<DocumentData> = query(
    collection(db, BOUGHT_OUT_PRICES_COLLECTION),
    where('boughtOutItemId', '==', boughtOutItemId),
    orderBy('effectiveDate', 'desc')
  );

  if (options.vendorId) {
    priceQuery = query(priceQuery, where('vendorId', '==', options.vendorId));
  }

  if (options.limitResults) {
    priceQuery = query(priceQuery, firestoreLimit(options.limitResults));
  }

  const snap = await getDocs(priceQuery);
  let prices = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BoughtOutPrice[];

  if (options.startDate) {
    prices = prices.filter((p) => p.effectiveDate.toDate() >= options.startDate!);
  }
  if (options.endDate) {
    prices = prices.filter((p) => p.effectiveDate.toDate() <= options.endDate!);
  }

  return prices;
}
