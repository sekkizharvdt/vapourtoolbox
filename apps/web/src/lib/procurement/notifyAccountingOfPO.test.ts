import { notifyAccountingOfApprovedPO, notifyAccountingOfAmendedPO } from './notifyAccountingOfPO';
import type { PurchaseOrder } from '@vapour/types';

const mockGetUsersWithPermission = jest.fn();
jest.mock('@/lib/auth/userLookup', () => ({
  getUsersWithPermission: (...args: unknown[]) => mockGetUsersWithPermission(...args),
}));

const mockCreateTaskNotification = jest.fn();
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: (...args: unknown[]) => mockCreateTaskNotification(...args),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: {} }),
}));

const mockWarn = jest.fn();
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const po = {
  id: 'po-1',
  number: 'PO/2026/007',
  vendorName: 'Acme Fabricators',
  projectIds: ['proj-1'],
  projectNames: ['Narippaiyur'],
  grandTotal: 318600,
  currency: 'INR',
  commercialTerms: {
    paymentSchedule: [
      { id: 'm1', serialNumber: 1, paymentType: 'Advance', percentage: 20, deliverables: '' },
      {
        id: 'm2',
        serialNumber: 2,
        paymentType: 'Before Dispatch',
        percentage: 80,
        deliverables: '',
        carriesTax: true,
      },
    ],
  },
} as unknown as PurchaseOrder;

describe('notifyAccountingOfApprovedPO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersWithPermission.mockResolvedValue(['acct-1', 'acct-2']);
    mockCreateTaskNotification.mockResolvedValue('notif-1');
  });

  it('notifies every accounting user', async () => {
    await notifyAccountingOfApprovedPO({ po, actorId: 'approver-1' });

    expect(mockCreateTaskNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateTaskNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'PO_APPROVED_FOR_PAYMENT',
        userId: 'acct-1',
        entityType: 'PURCHASE_ORDER',
        entityId: 'po-1',
        linkUrl: '/procurement/pos/po-1',
      })
    );
  });

  it('summarises the payment terms in the message', async () => {
    await notifyAccountingOfApprovedPO({ po, actorId: 'approver-1' });

    const call = mockCreateTaskNotification.mock.calls[0]?.[0] as { message: string };
    expect(call.message).toContain('20% Advance');
    expect(call.message).toContain('80% Before Dispatch (incl. tax)');
    expect(call.message).toContain('Narippaiyur');
  });

  it('warns rather than throwing when nobody holds the permission', async () => {
    mockGetUsersWithPermission.mockResolvedValue([]);

    await expect(
      notifyAccountingOfApprovedPO({ po, actorId: 'approver-1' })
    ).resolves.toBeUndefined();
    expect(mockCreateTaskNotification).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalled();
  });

  it('never throws — a PO approval must not fail on a notification', async () => {
    mockCreateTaskNotification.mockRejectedValue(new Error('firestore down'));

    await expect(
      notifyAccountingOfApprovedPO({ po, actorId: 'approver-1' })
    ).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
  });

  it('says so plainly when the PO has no structured schedule', async () => {
    await notifyAccountingOfApprovedPO({
      po: { ...po, commercialTerms: undefined } as PurchaseOrder,
      actorId: 'approver-1',
    });

    const call = mockCreateTaskNotification.mock.calls[0]?.[0] as { message: string };
    expect(call.message).toContain('no structured payment schedule');
  });
});

describe('notifyAccountingOfAmendedPO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersWithPermission.mockResolvedValue(['acct-1']);
    mockCreateTaskNotification.mockResolvedValue('notif-1');
  });

  it('reports the value change and the revised terms', async () => {
    await notifyAccountingOfAmendedPO({
      po,
      actorId: 'approver-1',
      previousGrandTotal: 300000,
      amendmentNumber: 2,
    });

    const call = mockCreateTaskNotification.mock.calls[0]?.[0] as {
      category: string;
      title: string;
      message: string;
    };
    expect(call.category).toBe('PO_PAYMENT_TERMS_AMENDED');
    expect(call.title).toContain('amendment 2');
    expect(call.message).toContain('80% Before Dispatch (incl. tax)');
  });
});
