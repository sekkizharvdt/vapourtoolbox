/**
 * Tests for related-document capture (Phase B1).
 */

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { getDoc, type Firestore } from 'firebase/firestore';
import {
  parseRelatedDocument,
  formatRelatedDocument,
  resolveRelatedDocument,
} from './relatedDocument';

const mockGetDoc = getDoc as jest.Mock;
const mockDb = {} as unknown as Firestore;

describe('parseRelatedDocument', () => {
  it('identifies a purchase order from a full URL', () => {
    expect(
      parseRelatedDocument('https://toolbox.vapourdesal.com/procurement/pos/qxBe8jnvjENS7lx1640x')
    ).toEqual({
      collection: 'purchaseOrders',
      docId: 'qxBe8jnvjENS7lx1640x',
      label: 'Purchase Order',
    });
  });

  it('identifies a record from a bare path', () => {
    expect(parseRelatedDocument('/procurement/rfqs/abc123')).toMatchObject({
      collection: 'rfqs',
      docId: 'abc123',
    });
  });

  it('maps each procurement detail route to its own collection', () => {
    const cases: Array<[string, string]> = [
      ['/procurement/purchase-requests/x', 'purchaseRequests'],
      ['/procurement/quotes/x', 'vendorQuotes'],
      ['/procurement/goods-receipts/x', 'goodsReceipts'],
      ['/procurement/packing-lists/x', 'packingLists'],
      ['/procurement/work-completion/x', 'workCompletionCertificates'],
      ['/procurement/amendments/x', 'purchaseOrderAmendments'],
    ];
    for (const [path, collection] of cases) {
      expect(parseRelatedDocument(path)?.collection).toBe(collection);
    }
  });

  it('prefers the enquiry route over the broader proposal route', () => {
    // /proposals/([^/]+) would otherwise swallow /proposals/enquiries/<id>
    expect(parseRelatedDocument('/proposals/enquiries/enq1')).toMatchObject({
      collection: 'enquiries',
      docId: 'enq1',
    });
  });

  it('ignores query strings and fragments', () => {
    expect(parseRelatedDocument('/procurement/pos/po1?tab=items#terms')).toMatchObject({
      docId: 'po1',
    });
  });

  it('returns null for list pages, which identify no single record', () => {
    expect(parseRelatedDocument('/procurement/pos')).toBeNull();
    expect(parseRelatedDocument('/accounting/bills')).toBeNull();
  });

  it('returns null for routes that are not mapped', () => {
    expect(parseRelatedDocument('/flow/portfolio')).toBeNull();
    expect(parseRelatedDocument('')).toBeNull();
  });

  it('rejects route segments that are not real ids', () => {
    // 'placeholder' is what static export pre-renders dynamic routes against
    expect(parseRelatedDocument('/procurement/pos/placeholder')).toBeNull();
    expect(parseRelatedDocument('/procurement/pos/new')).toBeNull();
  });
});

describe('resolveRelatedDocument', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the record own identifier, NOT its denormalised parent number', async () => {
    // A goods receipt carries both its parent's poNumber (rule 26) and its own
    // `number`. Reading poNumber first would label the GR with the PO's number.
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ poNumber: 'PO/2026/004', number: 'GR/2026/06/0004' }),
    });

    const result = await resolveRelatedDocument(mockDb, '/procurement/goods-receipts/gr1');

    expect(result?.number).toBe('GR/2026/06/0004');
  });

  it('reads transactionNumber for accounting records', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ transactionNumber: 'BILL-2627-0029' }),
    });

    const result = await resolveRelatedDocument(mockDb, '/accounting/transactions/t1');

    expect(result?.number).toBe('BILL-2627-0029');
  });

  it('falls back to name for records with no number, such as projects', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Narippaiyur - KGDS' }),
    });

    const result = await resolveRelatedDocument(mockDb, '/projects/p1');

    expect(result?.number).toBe('Narippaiyur - KGDS');
  });

  it('keeps the id when the document cannot be read', async () => {
    mockGetDoc.mockRejectedValue(new Error('permission-denied'));

    const result = await resolveRelatedDocument(mockDb, '/procurement/pos/po1');

    // The id alone still beats the 77% of reports that identify nothing.
    expect(result).toEqual({
      collection: 'purchaseOrders',
      docId: 'po1',
      label: 'Purchase Order',
    });
  });

  it('keeps the id when the document no longer exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await resolveRelatedDocument(mockDb, '/procurement/pos/po1');

    expect(result).toMatchObject({ docId: 'po1' });
    expect(result?.number).toBeUndefined();
  });

  it('does not read Firestore for an unmapped route', async () => {
    const result = await resolveRelatedDocument(mockDb, '/flow/portfolio');

    expect(result).toBeNull();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});

describe('formatRelatedDocument', () => {
  it('uses the number when one was read', () => {
    expect(
      formatRelatedDocument({
        collection: 'purchaseOrders',
        docId: 'abc',
        label: 'Purchase Order',
        number: 'PO/2026/009',
      })
    ).toBe('Purchase Order PO/2026/009');
  });

  it('falls back to the document id when no number could be read', () => {
    expect(
      formatRelatedDocument({
        collection: 'purchaseOrders',
        docId: 'abc',
        label: 'Purchase Order',
      })
    ).toBe('Purchase Order (abc)');
  });
});
