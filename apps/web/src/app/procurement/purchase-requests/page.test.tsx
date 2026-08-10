/**
 * Purchase Requests list page — filtering behaviour.
 *
 * The Active/Converted tab strip was removed in favour of a single Status
 * control (docs/reviews/2026-08-10-pr-list-ia-plan.md); these tests pin the
 * behaviour that used to live in the tabs.
 */

import React from 'react';
import { render, screen, waitFor, userEvent } from '@/test-utils';
import { Timestamp } from 'firebase/firestore';
import type { PurchaseRequest } from '@vapour/types';
import PurchaseRequestsPage from './page';

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const mockAuthValue = {
  user: { uid: 'test-uid', displayName: 'Test User', email: 'test@example.com' },
  claims: { permissions: 0 },
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: {} }),
}));

jest.mock('@/components/common/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: jest.fn().mockResolvedValue(true) }),
}));

jest.mock('@/lib/procurement/procurementDeleteService', () => ({
  softDeletePurchaseRequest: jest.fn(),
}));

jest.mock('@/lib/procurement/purchaseRequest/exportPRList', () => ({
  downloadPRListCSV: jest.fn(),
}));

jest.mock('@/lib/procurement/purchaseRequest/prListPDF', () => ({
  downloadPRListPDF: jest.fn(),
}));

const mockListPurchaseRequests = jest.fn();
jest.mock('@/lib/procurement/purchaseRequest', () => ({
  listPurchaseRequests: (...args: unknown[]) => mockListPurchaseRequests(...args),
}));

function makePR(overrides: Partial<PurchaseRequest> & { id: string }): PurchaseRequest {
  const base: PurchaseRequest = {
    id: overrides.id,
    number: 'PR/2026/0001',
    type: 'PROJECT',
    category: 'RAW_MATERIAL',
    title: 'Test PR',
    description: 'Test description',
    priority: 'MEDIUM',
    itemCount: 1,
    isBulkUpload: false,
    status: 'DRAFT',
    submittedBy: 'test-uid',
    submittedByName: 'Test User',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid',
    updatedBy: 'test-uid',
  };

  return { ...base, ...overrides };
}

const DRAFT_PR = makePR({
  id: 'pr-draft',
  number: 'PR/2026/0026',
  title: 'Seamless pipe for evaporator',
  projectName: 'SP 40 Thermal Desalination',
});

const CONVERTED_PR = makePR({
  id: 'pr-converted',
  number: 'PR/2026/0009',
  title: 'Elbows and flanges',
  status: 'CONVERTED_TO_RFQ',
  projectName: 'Administration',
});

describe('PurchaseRequestsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListPurchaseRequests.mockResolvedValue({
      items: [DRAFT_PR, CONVERTED_PR],
      lastDocId: null,
      hasMore: false,
    });
  });

  it('hides converted-to-RFQ requests under the default Active status', async () => {
    render(<PurchaseRequestsPage />);

    expect(await screen.findByText('PR/2026/0026')).toBeInTheDocument();
    expect(screen.queryByText('PR/2026/0009')).not.toBeInTheDocument();
  });

  it('shows converted requests when the Converted to RFQ status is selected', async () => {
    const user = userEvent.setup();
    render(<PurchaseRequestsPage />);
    await screen.findByText('PR/2026/0026');

    await user.click(screen.getByRole('combobox', { name: /Status/i }));
    await user.click(await screen.findByRole('option', { name: 'Converted to RFQ (1)' }));

    await waitFor(() => expect(screen.getByText('PR/2026/0009')).toBeInTheDocument());
    expect(screen.queryByText('PR/2026/0026')).not.toBeInTheDocument();
  });

  it('searches by project name', async () => {
    const user = userEvent.setup();
    render(<PurchaseRequestsPage />);
    await screen.findByText('PR/2026/0026');

    await user.type(
      screen.getByPlaceholderText(/Search PR number, title, description, project/i),
      'thermal'
    );

    await waitFor(() => expect(screen.getByText('PR/2026/0026')).toBeInTheDocument());
  });

  it('keeps loading pages until the cursor is exhausted', async () => {
    mockListPurchaseRequests
      .mockResolvedValueOnce({ items: [DRAFT_PR], lastDocId: 'pr-draft', hasMore: true })
      .mockResolvedValueOnce({ items: [CONVERTED_PR], lastDocId: null, hasMore: false });

    render(<PurchaseRequestsPage />);

    await waitFor(() => expect(mockListPurchaseRequests).toHaveBeenCalledTimes(2));
    expect(mockListPurchaseRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ afterId: 'pr-draft' })
    );
  });
});
