/**
 * Vendor Quote Counters
 *
 * Cloud Function trigger that keeps `rfqs/{rfqId}.offersReceived` in sync
 * with the actual count of vendor quotes linked to that RFQ. The counter
 * lets the RFQ list show "3 quotes received" without a fan-out query and
 * gives the requester a fast signal that quotes have started arriving.
 *
 * Field name: we write to `offersReceived` (not a new `quotesReceived`)
 * because the field already exists on the RFQ type — it was set to 0 at
 * RFQ creation but never actually incremented. This trigger fills that gap.
 *
 * What counts: a quote with `rfqId` set and `isActive !== false`. Status
 * doesn't matter — once received, it stays received even if rejected or
 * withdrawn (we want a "vendors responded" signal, not a "winning bid"
 * count). Soft-deletes (isActive=false) decrement; hard-deletes likewise.
 *
 * Edge case handled: the rfqId on a quote changes after creation. We
 * decrement the old RFQ and increment the new one. In practice this is
 * very rare, but the bookkeeping stays clean.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

interface QuoteCountFields {
  rfqId?: string;
  isActive?: boolean;
}

function isCounted(data: QuoteCountFields | undefined): { counted: boolean; rfqId?: string } {
  if (!data) return { counted: false };
  const counted = !!data.rfqId && data.isActive !== false;
  return { counted, ...(data.rfqId && { rfqId: data.rfqId }) };
}

export const onVendorQuoteWriteUpdateCounter = onDocumentWritten(
  {
    document: 'vendorQuotes/{quoteId}',
    region: 'us-central1',
  },
  async (event) => {
    const quoteId = event.params.quoteId;
    const before = event.data?.before.data() as QuoteCountFields | undefined;
    const after = event.data?.after.data() as QuoteCountFields | undefined;

    const beforeState = isCounted(before);
    const afterState = isCounted(after);

    // Same RFQ before and after: apply the delta to that RFQ.
    if (beforeState.rfqId && afterState.rfqId && beforeState.rfqId === afterState.rfqId) {
      const delta = (afterState.counted ? 1 : 0) - (beforeState.counted ? 1 : 0);
      if (delta === 0) return;
      await applyDelta(beforeState.rfqId, delta, quoteId);
      return;
    }

    // RFQ link changed (or only one side has it): rebalance.
    if (beforeState.rfqId && beforeState.counted) {
      await applyDelta(beforeState.rfqId, -1, quoteId);
    }
    if (afterState.rfqId && afterState.counted) {
      await applyDelta(afterState.rfqId, +1, quoteId);
    }
  }
);

/**
 * One-shot backfill — recompute `offersReceived` for every RFQ from the
 * current vendor quotes. Run once after deploying the trigger so existing
 * RFQs (which have always read `offersReceived: 0`) catch up. Subsequent
 * writes are kept in sync by `onVendorQuoteWriteUpdateCounter`.
 *
 * Admin-only. Returns a summary of how many RFQs were updated and the
 * total quote count it walked. Idempotent — safe to run multiple times.
 */
export const backfillRFQOfferCounts = onCall(
  { region: 'us-central1', timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    // MANAGE_USERS = bit 0 (value 1) is the SuperAdmin marker used elsewhere
    // for admin-only callable functions.
    const permissions = Number(request.auth.token['permissions'] ?? 0);
    if ((permissions & 1) !== 1) {
      throw new HttpsError('permission-denied', 'Admin permission required');
    }

    const db = admin.firestore();
    const counts = new Map<string, number>();

    // Walk every active RFQ-linked vendor quote.
    const snap = await db.collection('vendorQuotes').where('rfqId', '!=', null).get();
    let walked = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as QuoteCountFields;
      if (!data.rfqId || data.isActive === false) continue;
      counts.set(data.rfqId, (counts.get(data.rfqId) ?? 0) + 1);
      walked++;
    }

    // Get every RFQ id so we also reset RFQs with zero quotes (in case
    // they used to have some that were since soft-deleted).
    const rfqsSnap = await db.collection('rfqs').select().get();
    const updates: Array<Promise<unknown>> = [];
    let updated = 0;

    for (let i = 0; i < rfqsSnap.docs.length; i += 400) {
      const batch = db.batch();
      const slice = rfqsSnap.docs.slice(i, i + 400);
      for (const rfqDoc of slice) {
        const target = counts.get(rfqDoc.id) ?? 0;
        batch.update(rfqDoc.ref, { offersReceived: target });
        updated++;
      }
      updates.push(batch.commit());
    }
    await Promise.all(updates);

    logger.info('[backfillRFQOfferCounts] complete', {
      rfqsUpdated: updated,
      quotesWalked: walked,
      uniqueRfqs: counts.size,
    });

    return {
      success: true,
      rfqsUpdated: updated,
      quotesWalked: walked,
      uniqueRfqsWithQuotes: counts.size,
    };
  }
);

async function applyDelta(rfqId: string, delta: number, quoteId: string): Promise<void> {
  try {
    await admin
      .firestore()
      .doc(`rfqs/${rfqId}`)
      .update({
        offersReceived: admin.firestore.FieldValue.increment(delta),
      });
    logger.info('[onVendorQuoteWriteUpdateCounter] Counter updated', { rfqId, delta, quoteId });
  } catch (err) {
    // RFQ may have been hard-deleted out from under the quote — log & move on
    // rather than failing the trigger (would burn retries forever).
    logger.warn('[onVendorQuoteWriteUpdateCounter] Counter update failed', {
      rfqId,
      delta,
      quoteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
