/**
 * Related-document capture for feedback.
 *
 * 77% of bug reports do not identify the record they are about: only 1% name a
 * document number in the text, and 22% are inferable from the pageUrl. The rest
 * have to be reconstructed from a screenshot — the Max Office bill in feedback
 * pznSBK4c cost a download-and-read of a PNG to learn it was TC2IN/2627/133.
 *
 * Users demonstrably will not type this (1% over 168 reports), so it is derived
 * from the URL they were on instead. Phase B1 of
 * docs/reviews/2026-08-07-feedback-intake-plan.md.
 */

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'feedback/relatedDocument' });

export interface RelatedDocument {
  /** Firestore collection the record lives in. */
  collection: string;
  /** Firestore document id, taken from the URL. */
  docId: string;
  /** Human-readable identifier (e.g. "PO/2026/009"), when one could be read. */
  number?: string;
  /** What kind of record this is, for display ("Purchase Order"). */
  label: string;
}

/**
 * Detail routes that identify a single record, mapped to where it is stored.
 *
 * Explicit rather than inferred: an unknown route must capture nothing rather
 * than guess a collection and produce a wrong reference. Keep in step with the
 * `[id]` route directories under app/.
 */
const ROUTE_MAP: Array<{ pattern: RegExp; collection: string; label: string }> = [
  // Procurement
  {
    pattern: /\/procurement\/pos\/([^/?#]+)/,
    collection: COLLECTIONS.PURCHASE_ORDERS,
    label: 'Purchase Order',
  },
  {
    pattern: /\/procurement\/purchase-requests\/([^/?#]+)/,
    collection: COLLECTIONS.PURCHASE_REQUESTS,
    label: 'Purchase Request',
  },
  { pattern: /\/procurement\/rfqs\/([^/?#]+)/, collection: COLLECTIONS.RFQS, label: 'RFQ' },
  {
    pattern: /\/procurement\/quotes\/([^/?#]+)/,
    collection: COLLECTIONS.VENDOR_QUOTES,
    label: 'Vendor Quote',
  },
  {
    pattern: /\/procurement\/goods-receipts\/([^/?#]+)/,
    collection: COLLECTIONS.GOODS_RECEIPTS,
    label: 'Goods Receipt',
  },
  {
    pattern: /\/procurement\/packing-lists\/([^/?#]+)/,
    collection: COLLECTIONS.PACKING_LISTS,
    label: 'Packing List',
  },
  {
    pattern: /\/procurement\/work-completion\/([^/?#]+)/,
    collection: COLLECTIONS.WORK_COMPLETION_CERTIFICATES,
    label: 'Work Completion Certificate',
  },
  {
    pattern: /\/procurement\/amendments\/([^/?#]+)/,
    collection: COLLECTIONS.PURCHASE_ORDER_AMENDMENTS,
    label: 'PO Amendment',
  },
  {
    pattern: /\/procurement\/three-way-match\/([^/?#]+)/,
    collection: COLLECTIONS.THREE_WAY_MATCHES,
    label: 'Three-Way Match',
  },

  // Accounting — bills, invoices, payments and journals are all `transactions`
  {
    pattern: /\/accounting\/cost-centres\/([^/?#]+)/,
    collection: COLLECTIONS.COST_CENTRES,
    label: 'Cost Centre',
  },
  {
    pattern: /\/accounting\/transactions\/([^/?#]+)/,
    collection: COLLECTIONS.TRANSACTIONS,
    label: 'Transaction',
  },

  // Sales
  {
    pattern: /\/proposals\/enquiries\/([^/?#]+)/,
    collection: COLLECTIONS.ENQUIRIES,
    label: 'Enquiry',
  },
  { pattern: /\/proposals\/([^/?#]+)/, collection: COLLECTIONS.PROPOSALS, label: 'Proposal' },

  // Delivery / catalogue
  { pattern: /\/projects\/([^/?#]+)/, collection: COLLECTIONS.PROJECTS, label: 'Project' },
  { pattern: /\/estimation\/([^/?#]+)/, collection: COLLECTIONS.BOMS, label: 'BOM' },
  { pattern: /\/materials\/([^/?#]+)/, collection: COLLECTIONS.MATERIALS, label: 'Material' },
  {
    pattern: /\/bought-out\/([^/?#]+)/,
    collection: COLLECTIONS.BOUGHT_OUT_ITEMS,
    label: 'Bought-Out Item',
  },
  { pattern: /\/services\/([^/?#]+)/, collection: COLLECTIONS.SERVICES, label: 'Service' },
];

/**
 * Fields to read the record's own identifier from, in priority order.
 *
 * Order matters and `number` must come first. Child documents denormalise their
 * parent's number (rule 26) — a goods receipt carries BOTH `poNumber`
 * (PO/2026/004, its parent) and `number` (GR/2026/06/0004, itself). Probing the
 * parent field first would label the GR with its PO's number, which is worse
 * than capturing nothing. Parent fields are deliberately absent from this list.
 */
const IDENTIFIER_FIELDS = [
  'number', // procurement canonical: PO/PR/RFQ/quote/GR/PL/WCC
  'transactionNumber', // accounting
  'proposalNumber',
  'enquiryNumber',
  'amendmentNumber',
  'materialCode',
  'itemCode',
  'code',
  'name', // projects, services, BOMs and cost centres have no number
  'title',
];

/** Route segments that are not real document ids. */
const NOT_AN_ID = new Set(['new', 'placeholder', 'edit', 'list']);

/**
 * Work out which record a URL refers to, without reading Firestore.
 * Returns null when the URL is not a known detail route.
 */
export function parseRelatedDocument(url: string): Omit<RelatedDocument, 'number'> | null {
  if (!url) return null;

  // Compare on the path so a full URL and a bare path behave identically.
  let path = url;
  try {
    path = new URL(url, 'http://localhost').pathname;
  } catch {
    // Not parseable as a URL — fall back to matching the raw string.
  }

  for (const { pattern, collection, label } of ROUTE_MAP) {
    const match = path.match(pattern);
    const docId = match?.[1];
    if (docId && !NOT_AN_ID.has(docId)) {
      return { collection, docId, label };
    }
  }

  return null;
}

/**
 * Resolve a URL to a record reference, reading its identifier where possible.
 *
 * Degrades in steps rather than failing: an unknown route returns null, and a
 * document that cannot be read still returns the collection and id — which is
 * enough to find the record by hand, and strictly better than the 77% of
 * reports that identify nothing at all.
 */
export async function resolveRelatedDocument(
  db: Firestore,
  url: string
): Promise<RelatedDocument | null> {
  const parsed = parseRelatedDocument(url);
  if (!parsed) return null;

  try {
    const snap = await getDoc(doc(db, parsed.collection, parsed.docId));
    if (!snap.exists()) return parsed;

    const data = snap.data();
    const field = IDENTIFIER_FIELDS.find((f) => {
      const value = data[f];
      return typeof value === 'string' ? value.trim() !== '' : value != null;
    });

    return field ? { ...parsed, number: String(data[field]) } : parsed;
  } catch (error) {
    // Permission or network failure — keep the id, which is the useful half.
    logger.warn('Could not read the related document for feedback', {
      collection: parsed.collection,
      docId: parsed.docId,
      error: error instanceof Error ? error.message : String(error),
    });
    return parsed;
  }
}

/** One-line description for the admin list, e.g. "Purchase Order PO/2026/009". */
export function formatRelatedDocument(related: RelatedDocument): string {
  return related.number
    ? `${related.label} ${related.number}`
    : `${related.label} (${related.docId})`;
}
