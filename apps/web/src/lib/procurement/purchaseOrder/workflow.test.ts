import type { PurchaseOrder } from '@vapour/types';

// Mock Firebase
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mock-doc-ref'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1702800000, nanoseconds: 0 })),
  },
}));

const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: mockDb })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDERS: 'purchaseOrders',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: jest.fn((userId, _, userName) => ({ userId, userName })),
}));

jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  requireApprover: jest.fn(),
  preventSelfApproval: jest.fn(),
}));

const mockCanTransitionTo = jest.fn();
jest.mock('@/lib/workflow/stateMachines', () => ({
  purchaseOrderStateMachine: {
    canTransitionTo: (...args: unknown[]) => mockCanTransitionTo(...args),
    validateTransition: jest.fn(),
  },
}));

const mockGetPOById = jest.fn();
jest.mock('./crud', () => ({
  getPOById: (...args: unknown[]) => mockGetPOById(...args),
}));

import { advancePOStatusIfAllowed } from './workflow';

const mockPO = {
  id: 'po-1',
  number: 'PO/2026/001',
  status: 'ISSUED',
  vendorName: 'Acme Corp',
} as unknown as PurchaseOrder;

describe('advancePOStatusIfAllowed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advances status and returns true when the transition is currently legal', async () => {
    mockGetPOById.mockResolvedValue(mockPO);
    mockCanTransitionTo.mockReturnValue(true);

    const result = await advancePOStatusIfAllowed('po-1', 'IN_PROGRESS', 'user-1', 'User One');

    expect(result).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({ status: 'IN_PROGRESS' })
    );
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('is a no-op and returns false when the transition is not currently legal', async () => {
    mockGetPOById.mockResolvedValue(mockPO);
    mockCanTransitionTo.mockReturnValue(false);

    const result = await advancePOStatusIfAllowed('po-1', 'IN_PROGRESS', 'user-1', 'User One');

    expect(result).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when the Purchase Order is not found', async () => {
    mockGetPOById.mockResolvedValue(null);

    await expect(advancePOStatusIfAllowed('missing', 'IN_PROGRESS', 'user-1')).rejects.toThrow(
      'Purchase Order not found'
    );
  });
});
