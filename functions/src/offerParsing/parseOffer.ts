/**
 * Parse Vendor Offer (Claude AI)
 *
 * Single-parser callable for the RFQ "Upload Offer" flow: Claude extracts the
 * offer header + line items from the uploaded quotation and matches them to the
 * RFQ items.
 *
 * Supersedes the former dual-parser `compareOfferParsers` + the Google Document
 * AI parser (`parseOfferDocument`), both removed — the Document AI Form Parser
 * returned empty results for line-item quotations, so Claude is the only parser.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { parseOfferWithClaude, anthropicApiKey } from './parseOfferWithClaude';
import {
  enforceFirestoreRateLimit,
  PARSE_OFFER_LIMIT,
  RateLimitError,
} from '../utils/firestoreRateLimit';

interface RFQItemContext {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
}

interface ParseOfferRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  rfqItems: RFQItemContext[];
}

export const parseOffer = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 10,
    secrets: [anthropicApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Firestore-backed rate limit — the most expensive callable in the app
    // (Claude reads the whole uploaded document).
    try {
      await enforceFirestoreRateLimit(PARSE_OFFER_LIMIT, request.auth.uid);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new HttpsError('resource-exhausted', error.message, {
          retryAfter: error.retryAfter,
        });
      }
      throw error;
    }

    const data = request.data as ParseOfferRequest;

    if (!data.storagePath) {
      throw new HttpsError('invalid-argument', 'Storage path is required');
    }
    if (!data.rfqId || !data.rfqNumber) {
      throw new HttpsError('invalid-argument', 'RFQ ID and number are required');
    }
    if (!data.vendorId || !data.vendorName) {
      throw new HttpsError('invalid-argument', 'Vendor ID and name are required');
    }
    if (!data.rfqItems || data.rfqItems.length === 0) {
      throw new HttpsError('invalid-argument', 'RFQ items are required for matching');
    }

    logger.info('Parse offer (Claude) request received', {
      fileName: data.fileName,
      storagePath: data.storagePath,
      rfqId: data.rfqId,
      userId: request.auth.uid,
    });

    return parseOfferWithClaude({
      fileName: data.fileName,
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      rfqId: data.rfqId,
      rfqNumber: data.rfqNumber,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      rfqItems: data.rfqItems,
      userId: request.auth.uid,
    });
  }
);
