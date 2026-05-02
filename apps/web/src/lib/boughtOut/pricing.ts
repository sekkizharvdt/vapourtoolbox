/**
 * Bought-Out Item Price Management
 *
 * Mirrors `apps/web/src/lib/materials/pricing.ts` for the bought-out
 * catalog. Every accepted price from a vendor quote appends a record
 * here so the catalog has a per-vendor, time-series view of how a
 * specific valve / pump / instrument's price has moved — instead of
 * silently overwriting `pricing.listPrice` on the parent doc.
 *
 * The accept-price flow in `vendorQuoteService.acceptQuoteItemPrice`
 * still updates `bought_out_items.pricing.listPrice` (so the catalog
 * keeps showing the latest accepted price prominently); this module
 * adds the historical trail alongside.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  addDoc,
  Timestamp,
  type Firestore,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import type { BoughtOutPrice } from '@vapour/types';

const logger = createLogger({ context: 'boughtOutService:pricing' });

/**
 * Bought-out price history lives in its own top-level collection, mirroring
 * `materialPrices`. Snake_case to align with `bought_out_items`.
 */
export const BOUGHT_OUT_PRICES_COLLECTION = 'bought_out_prices';

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
 */
export async function addBoughtOutPrice(
  db: Firestore,
  price: Omit<BoughtOutPrice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<BoughtOutPrice> {
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
