/**
 * Service Rate Management
 *
 * Mirrors `apps/web/src/lib/materials/pricing.ts` for the services catalog.
 * Every procured service rate (accepted vendor quote line, manual entry)
 * appends a `serviceRates` history record AND denormalizes the latest active
 * rate onto the parent `services` doc (`currentRate` / `lastRateUpdate`) —
 * exactly how `addMaterialPrice` maintains `material.currentPrice`.
 *
 * BOM service costing reads `Service.currentRate` as the PROCURED_RATE tier
 * of the rate fallback chain (see `resolveServiceRates`), so the previously
 * write-only serviceRates collection now closes the pricing feedback loop.
 */

import {
  collection,
  doc,
  addDoc,
  runTransaction,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Service, ServiceRate } from '@vapour/types';

const logger = createLogger({ context: 'serviceRates' });

/**
 * Append a new service rate record and denormalize it onto the parent
 * service doc when it is active and at least as new as the existing
 * `currentRate`. Returns the created row with id.
 *
 * Fields with `undefined` values are dropped before the write (Firestore
 * rejects `undefined` — rule 12).
 */
export async function addServiceRate(
  db: Firestore,
  rate: Omit<ServiceRate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<ServiceRate> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred (static-export build)
  const now = Timestamp.now();
  const newRate: Omit<ServiceRate, 'id'> = {
    ...rate,
    tenantId: rate.tenantId || 'default-entity',
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  // Strip undefined optional fields (rule 12)
  const payload = Object.fromEntries(Object.entries(newRate).filter(([, v]) => v !== undefined));

  const ref = await addDoc(collection(db, COLLECTIONS.SERVICE_RATES), payload);
  logger.info('Service rate added', {
    rateId: ref.id,
    serviceId: rate.serviceId,
    rateValue: rate.rateValue,
  });

  // Denormalize onto the parent service doc (mirrors material.currentPrice).
  // runTransaction (rule 19): the recency check reads currentRate and writes
  // conditionally — two concurrent accepts must not let the older rate win.
  if (newRate.isActive) {
    try {
      await runTransaction(db, async (tx) => {
        const serviceRef = doc(db, COLLECTIONS.SERVICES, rate.serviceId);
        const serviceSnap = await tx.get(serviceRef);
        if (!serviceSnap.exists()) {
          logger.warn('Service not found for rate denormalization', {
            serviceId: rate.serviceId,
          });
          return;
        }
        const service = serviceSnap.data() as Omit<Service, 'id'>;
        const existingDate = service.currentRate?.effectiveDate;
        const isNewer =
          !existingDate || newRate.effectiveDate.toMillis() >= existingDate.toMillis();
        if (isNewer) {
          tx.update(serviceRef, {
            currentRate: { ...payload, id: ref.id },
            lastRateUpdate: now,
            updatedAt: now,
            updatedBy: userId,
          });
        }
      });
      logger.info('Service current rate denormalization evaluated', {
        serviceId: rate.serviceId,
        rateValue: rate.rateValue,
      });
    } catch (denormError) {
      // Non-fatal: the history row is written; the parent doc keeps its
      // previous currentRate until the next successful update.
      logger.warn('Failed to denormalize service current rate', {
        serviceId: rate.serviceId,
        error: denormError,
      });
    }
  }

  return { ...newRate, id: ref.id };
}
