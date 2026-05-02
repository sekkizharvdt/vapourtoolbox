/**
 * Vendor Quote Workflow Tests
 *
 * Tests the lifecycle operations on a quote — selecting a winner from
 * an RFQ (with sibling rejection + RFQ status sync), rejecting,
 * withdrawing, evaluating, and recommending. Audit logging is
 * fire-and-forget; we verify the call was made, not its delivery.
 *
 * State-machine validity is owned by `offerStateMachine`; we mock the
 * machine here so each test can pin a specific transition outcome.
 */

import { Timestamp } from 'firebase/firestore';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { VendorQuote } from '@vapour/types';

// ============================================================================
// Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const batchUpdates: Array<{ ref: unknown; data: unknown }> = [];
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({
  set: jest.fn(),
  update: (ref: unknown, data: unknown) => batchUpdates.push({ ref, data }),
  commit: mockBatchCommit,
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_db: unknown, name: string, id?: string) => ({ doc: name, id: id ?? 'auto' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  query: jest.fn((...args: unknown[]) => ({ query: args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  orderBy: jest.fn((field: string, dir?: string) => ({ orderBy: [field, dir] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1735689600,
      nanoseconds: 0,
      toDate: () => new Date('2025-01-01'),
    })),
    fromDate: jest.fn((d: Date) => ({
      toDate: () => d,
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    VENDOR_QUOTES: 'vendorQuotes',
    VENDOR_QUOTE_ITEMS: 'vendorQuoteItems',
    RFQS: 'rfqs',
    RFQ_ITEMS: 'rfqItems',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockRequirePermission = jest.fn();
const mockPreventSelfApproval = jest.fn();
jest.mock('@/lib/auth', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  preventSelfApproval: (...args: unknown[]) => mockPreventSelfApproval(...args),
  AuthorizationError: class extends Error {},
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: jest.fn((userId, email, name) => ({ userId, email, name })),
}));

// Explicit type so .mockReturnValueOnce({ allowed: false, reason }) is
// valid — without it, the inferred return is `{ allowed: boolean }` only.
type TransitionResult = { allowed: boolean; reason?: string };
const mockOfferStateMachine = {
  validateTransition: jest.fn<TransitionResult, [string, string]>(() => ({ allowed: true })),
  canTransitionTo: jest.fn(() => true),
  isTerminal: jest.fn(() => false),
  getAvailableTransitions: jest.fn(() => []),
  getAvailableActions: jest.fn(() => ({})),
};
const mockRfqStateMachine = {
  validateTransition: jest.fn<TransitionResult, [string, string]>(() => ({ allowed: true })),
  canTransitionTo: jest.fn(() => true),
};
jest.mock('@/lib/workflow/stateMachines', () => ({
  offerStateMachine: mockOfferStateMachine,
  rfqStateMachine: mockRfqStateMachine,
}));

const mockRequireValidTransition = jest.fn();
jest.mock('@/lib/utils/stateMachine', () => ({
  requireValidTransition: (...args: unknown[]) => mockRequireValidTransition(...args),
}));

const mockRecordProcurementPrices = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/materials/pricing', () => ({
  recordProcurementPrices: (...args: unknown[]) => mockRecordProcurementPrices(...args),
}));

const mockIncrementOffersEvaluated = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/procurement/rfq', () => ({
  incrementOffersEvaluated: (...args: unknown[]) => mockIncrementOffersEvaluated(...args),
}));

// Import after mocks
import {
  selectVendorQuote,
  rejectVendorQuote,
  withdrawVendorQuote,
  evaluateVendorQuote,
  markVendorQuoteAsRecommended,
} from './vendorQuoteWorkflow';

// ============================================================================
// Fixtures
// ============================================================================

const MANAGE = PERMISSION_FLAGS.MANAGE_PROCUREMENT;

function makeTimestamp(date: Date): Timestamp {
  const stamp = {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
  return stamp as unknown as Timestamp;
}

function makeQuote(overrides: Partial<VendorQuote> = {}): VendorQuote {
  const quote = {
    id: 'q-1',
    number: 'Q-2025-0001',
    tenantId: 'tenant-1',
    sourceType: 'RFQ_RESPONSE',
    rfqId: 'rfq-1',
    rfqNumber: 'RFQ/2025/001',
    vendorId: 'vendor-1',
    vendorName: 'Acme Pumps',
    subtotal: 100000,
    taxAmount: 18000,
    totalAmount: 118000,
    currency: 'INR',
    status: 'EVALUATED',
    isRecommended: false,
    itemCount: 2,
    acceptedCount: 0,
    isActive: true,
    createdBy: 'creator-1',
    createdByName: 'Bob',
    createdAt: makeTimestamp(new Date('2025-01-01')),
    updatedAt: makeTimestamp(new Date('2025-01-01')),
    ...overrides,
  };
  return quote as unknown as VendorQuote;
}

beforeEach(() => {
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockUpdateDoc.mockReset().mockResolvedValue(undefined);
  mockBatchCommit.mockReset().mockResolvedValue(undefined);
  mockWriteBatch.mockClear();
  mockRequirePermission.mockReset();
  mockPreventSelfApproval.mockReset();
  mockLogAuditEvent.mockReset().mockResolvedValue(undefined);
  mockOfferStateMachine.validateTransition.mockReset().mockReturnValue({ allowed: true });
  mockRfqStateMachine.validateTransition.mockReset().mockReturnValue({ allowed: true });
  mockRequireValidTransition.mockReset();
  mockRecordProcurementPrices.mockReset().mockResolvedValue(undefined);
  mockIncrementOffersEvaluated.mockReset().mockResolvedValue(undefined);
  batchUpdates.length = 0;
});

// ============================================================================
// selectVendorQuote
// ============================================================================

describe('selectVendorQuote', () => {
  function setupSelect(quote: VendorQuote, siblings: VendorQuote[], rfqStatus = 'IN_PROGRESS') {
    // 1) getVendorQuoteById fetch
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: quote.id,
      data: () => quote,
    });
    // 2) getQuotesByRFQ → listVendorQuotes uses getDocs
    mockGetDocs.mockResolvedValueOnce({
      docs: siblings.map((s) => ({ id: s.id, data: () => s })),
    });
    // 3) RFQ status fetch
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: quote.rfqId!,
      data: () => ({ status: rfqStatus }),
    });
  }

  it('checks MANAGE_PROCUREMENT permission', async () => {
    const quote = makeQuote({ status: 'EVALUATED' });
    setupSelect(quote, [quote]);
    await selectVendorQuote({} as never, 'q-1', 'user-1', MANAGE);
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'select quote'
    );
  });

  it('throws when quote not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(selectVendorQuote({} as never, 'q-missing', 'user-1', MANAGE)).rejects.toThrow(
      /not found/i
    );
  });

  it('rejects standing / unsolicited quotes (no rfqId)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ rfqId: undefined, sourceType: 'STANDING_QUOTE' }),
    });
    await expect(selectVendorQuote({} as never, 'q-1', 'user-1', MANAGE)).rejects.toThrow(
      /RFQ-linked/i
    );
  });

  it('refuses transition when state-machine says no', async () => {
    mockOfferStateMachine.validateTransition.mockReturnValueOnce({
      allowed: false,
      reason: 'cannot select archived quote',
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ status: 'ARCHIVED' }),
    });
    await expect(selectVendorQuote({} as never, 'q-1', 'user-1', MANAGE)).rejects.toThrow(
      /archived/i
    );
  });

  it('marks the chosen quote SELECTED in the batch', async () => {
    const winner = makeQuote({ id: 'q-winner', status: 'EVALUATED' });
    setupSelect(winner, [winner]);
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE);
    const winnerUpdate = batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-winner');
    expect(winnerUpdate?.data).toMatchObject({ status: 'SELECTED', updatedBy: 'user-1' });
  });

  it('rejects every live sibling quote in the same batch', async () => {
    const winner = makeQuote({ id: 'q-winner', status: 'EVALUATED' });
    const siblings = [
      winner,
      makeQuote({ id: 'q-sib1', status: 'EVALUATED' }),
      makeQuote({ id: 'q-sib2', status: 'UPLOADED' }),
    ];
    setupSelect(winner, siblings);
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE);
    const sib1 = batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-sib1');
    const sib2 = batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-sib2');
    expect(sib1?.data).toMatchObject({ status: 'REJECTED' });
    expect(sib2?.data).toMatchObject({ status: 'REJECTED' });
  });

  it('does NOT re-reject already-WITHDRAWN or already-REJECTED siblings', async () => {
    const winner = makeQuote({ id: 'q-winner', status: 'EVALUATED' });
    const siblings = [
      winner,
      makeQuote({ id: 'q-withdrawn', status: 'WITHDRAWN' }),
      makeQuote({ id: 'q-rejected', status: 'REJECTED' }),
    ];
    setupSelect(winner, siblings);
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE);
    expect(
      batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-withdrawn')
    ).toBeUndefined();
    expect(
      batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-rejected')
    ).toBeUndefined();
  });

  it('moves the RFQ to COMPLETED with selectedOfferId set', async () => {
    const winner = makeQuote({ id: 'q-winner' });
    setupSelect(winner, [winner], 'IN_PROGRESS');
    await selectVendorQuote(
      {} as never,
      'q-winner',
      'user-1',
      MANAGE,
      'Alice',
      'alice@example.com',
      'Best price'
    );
    const rfqUpdate = batchUpdates.find((u) => (u.ref as { doc?: string }).doc === 'rfqs');
    expect(rfqUpdate?.data).toMatchObject({
      status: 'COMPLETED',
      selectedOfferId: 'q-winner',
      completionNotes: 'Best price',
    });
  });

  it('skips RFQ → COMPLETED transition when RFQ is already PO_PROCESSED', async () => {
    const winner = makeQuote({ id: 'q-winner' });
    setupSelect(winner, [winner], 'PO_PROCESSED');
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE);
    const rfqUpdate = batchUpdates.find((u) => (u.ref as { doc?: string }).doc === 'rfqs');
    expect(rfqUpdate).toBeUndefined();
    expect(mockRequireValidTransition).not.toHaveBeenCalled();
  });

  it('logs OFFER_SELECTED audit with the rejected count', async () => {
    const winner = makeQuote({ id: 'q-winner' });
    const siblings = [winner, makeQuote({ id: 'q-loser', status: 'EVALUATED' })];
    setupSelect(winner, siblings);
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE, 'Alice', 'alice@x.com');
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const auditCall = mockLogAuditEvent.mock.calls[0];
    expect(auditCall?.[2]).toBe('OFFER_SELECTED');
    expect(auditCall?.[3]).toBe('OFFER');
    expect(auditCall?.[4]).toBe('q-winner');
    const metadata = (auditCall?.[6] as { metadata: { rejectedOfferCount: number } }).metadata;
    expect(metadata.rejectedOfferCount).toBe(1);
  });

  it('commits the batch exactly once', async () => {
    const winner = makeQuote({ id: 'q-winner' });
    setupSelect(winner, [winner]);
    await selectVendorQuote({} as never, 'q-winner', 'user-1', MANAGE);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// rejectVendorQuote — self-rejection guard + audit
// ============================================================================

describe('rejectVendorQuote', () => {
  function setupReject(quote: VendorQuote) {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: quote.id,
      data: () => quote,
    });
  }

  it('checks MANAGE_PROCUREMENT', async () => {
    setupReject(makeQuote({ status: 'EVALUATED' }));
    await rejectVendorQuote({} as never, 'q-1', 'reason', 'user-1', MANAGE);
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'reject quote'
    );
  });

  it('prevents the quote uploader from rejecting their own quote', async () => {
    setupReject(makeQuote({ createdBy: 'user-1', status: 'EVALUATED' }));
    await rejectVendorQuote({} as never, 'q-1', 'reason', 'user-1', MANAGE);
    expect(mockPreventSelfApproval).toHaveBeenCalledWith('user-1', 'user-1', 'reject vendor quote');
  });

  it('refuses transition when state-machine says no', async () => {
    setupReject(makeQuote({ status: 'ARCHIVED' }));
    mockOfferStateMachine.validateTransition.mockReturnValueOnce({
      allowed: false,
      reason: 'cannot reject archived',
    });
    await expect(rejectVendorQuote({} as never, 'q-1', 'reason', 'user-1', MANAGE)).rejects.toThrow(
      /archived/i
    );
  });

  it('writes status=REJECTED with the reason as evaluationNotes', async () => {
    setupReject(makeQuote({ status: 'EVALUATED' }));
    await rejectVendorQuote({} as never, 'q-1', 'price too high', 'user-1', MANAGE);
    const written = mockUpdateDoc.mock.calls[0]?.[1] as {
      status: string;
      evaluationNotes: string;
    };
    expect(written.status).toBe('REJECTED');
    expect(written.evaluationNotes).toBe('price too high');
  });

  it('logs OFFER_REJECTED audit with the reason in metadata', async () => {
    setupReject(makeQuote({ status: 'EVALUATED' }));
    await rejectVendorQuote(
      {} as never,
      'q-1',
      'spec deviation',
      'user-1',
      MANAGE,
      'Alice',
      'alice@x.com'
    );
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const call = mockLogAuditEvent.mock.calls[0];
    expect(call?.[2]).toBe('OFFER_REJECTED');
    expect((call?.[6] as { metadata: { rejectionReason: string } }).metadata.rejectionReason).toBe(
      'spec deviation'
    );
  });
});

// ============================================================================
// withdrawVendorQuote
// ============================================================================

describe('withdrawVendorQuote', () => {
  it('writes status=WITHDRAWN and audits OFFER_WITHDRAWN', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ status: 'EVALUATED' }),
    });
    await withdrawVendorQuote(
      {} as never,
      'q-1',
      'vendor pulled out',
      'user-1',
      MANAGE,
      'Alice',
      'alice@x.com'
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as {
      status: string;
      evaluationNotes: string;
    };
    expect(written.status).toBe('WITHDRAWN');
    expect(written.evaluationNotes).toBe('vendor pulled out');
    expect(mockLogAuditEvent).toHaveBeenCalled();
    expect(mockLogAuditEvent.mock.calls[0]?.[2]).toBe('OFFER_WITHDRAWN');
  });

  it('refuses transition when state-machine says no', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ status: 'ARCHIVED' }),
    });
    mockOfferStateMachine.validateTransition.mockReturnValueOnce({
      allowed: false,
      reason: 'archived',
    });
    await expect(
      withdrawVendorQuote({} as never, 'q-1', 'reason', 'user-1', MANAGE)
    ).rejects.toThrow(/archived/i);
  });
});

// ============================================================================
// evaluateVendorQuote
// ============================================================================

describe('evaluateVendorQuote', () => {
  it('marks status=EVALUATED with score, recommended-flag, and red-flags', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ status: 'UPLOADED' }),
    });
    await evaluateVendorQuote(
      {} as never,
      'q-1',
      {
        evaluationScore: 85,
        evaluationNotes: 'Solid technical fit',
        isRecommended: true,
        recommendationReason: 'lowest cost meeting spec',
        redFlags: ['unverified vendor'],
      },
      'user-1',
      'Alice'
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as {
      status: string;
      evaluationScore: number;
      isRecommended: boolean;
      redFlags: string[];
      evaluationNotes: string;
      recommendationReason: string;
      evaluatedBy: string;
      evaluatedByName: string;
    };
    expect(written).toMatchObject({
      status: 'EVALUATED',
      evaluationScore: 85,
      isRecommended: true,
      redFlags: ['unverified vendor'],
      evaluationNotes: 'Solid technical fit',
      recommendationReason: 'lowest cost meeting spec',
      evaluatedBy: 'user-1',
      evaluatedByName: 'Alice',
    });
  });

  it('defaults isRecommended to false and redFlags to []', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote(),
    });
    await evaluateVendorQuote({} as never, 'q-1', {}, 'user-1', 'Alice');
    const written = mockUpdateDoc.mock.calls[0]?.[1] as {
      isRecommended: boolean;
      redFlags: string[];
    };
    expect(written.isRecommended).toBe(false);
    expect(written.redFlags).toEqual([]);
  });

  it('bumps RFQ.offersEvaluated when the quote is RFQ-linked', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ rfqId: 'rfq-42' }),
    });
    await evaluateVendorQuote({} as never, 'q-1', {}, 'user-1', 'Alice');
    expect(mockIncrementOffersEvaluated).toHaveBeenCalledWith('rfq-42');
  });

  it('skips offersEvaluated bump for standing / unsolicited quotes', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ rfqId: undefined, sourceType: 'STANDING_QUOTE' }),
    });
    await evaluateVendorQuote({} as never, 'q-1', {}, 'user-1', 'Alice');
    expect(mockIncrementOffersEvaluated).not.toHaveBeenCalled();
  });

  it('does not throw if the offersEvaluated bump fails', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ rfqId: 'rfq-1' }),
    });
    mockIncrementOffersEvaluated.mockRejectedValueOnce(new Error('counter glitch'));
    await expect(
      evaluateVendorQuote({} as never, 'q-1', {}, 'user-1', 'Alice')
    ).resolves.not.toThrow();
  });
});

// ============================================================================
// markVendorQuoteAsRecommended
// ============================================================================

describe('markVendorQuoteAsRecommended', () => {
  it('throws when the quote is not RFQ-linked', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ rfqId: undefined }),
    });
    await expect(
      markVendorQuoteAsRecommended({} as never, 'q-1', 'reason', 'user-1')
    ).rejects.toThrow(/RFQ-linked/i);
  });

  it('clears isRecommended on prior siblings, then sets it on the chosen quote', async () => {
    const target = makeQuote({ id: 'q-target' });
    const siblings = [
      target,
      makeQuote({ id: 'q-prior', isRecommended: true }),
      makeQuote({ id: 'q-other', isRecommended: false }),
    ];
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: target.id,
      data: () => target,
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: siblings.map((s) => ({ id: s.id, data: () => s })),
    });
    await markVendorQuoteAsRecommended({} as never, 'q-target', 'best price', 'user-1');

    // The prior recommended one gets cleared
    const cleared = batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-prior');
    expect(cleared?.data).toMatchObject({ isRecommended: false });

    // The "other" non-recommended sibling is left alone
    expect(batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-other')).toBeUndefined();

    // The target gets marked recommended with the reason
    const recommended = batchUpdates.find((u) => (u.ref as { id?: string }).id === 'q-target');
    expect(recommended?.data).toMatchObject({
      isRecommended: true,
      recommendationReason: 'best price',
    });
  });
});
