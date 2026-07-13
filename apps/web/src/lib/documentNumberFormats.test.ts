/**
 * Document Number Format Tests (known-gaps 2.4)
 *
 * The race-prone query-max / timestamp generators were consolidated onto the
 * shared counter-backed engine (`generateCounterBackedNumber`). These tests
 * pin each document type's number FORMAT byte-exactly so the consolidation
 * can never silently change what users see.
 */

// ---- Mock the Firebase surface the service modules import ----------------

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  serverTimestamp: jest.fn(),
  increment: jest.fn(),
  deleteField: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 0, nanoseconds: 0, toDate: () => new Date(0) })),
    fromDate: jest.fn((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  // Collection names are irrelevant here — formats are pure functions.
  COLLECTIONS: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  requireAnyPermission: jest.fn(),
  requireApprover: jest.fn(),
  preventSelfApproval: jest.fn(),
  requireOwnerOrPermission: jest.fn(),
}));

jest.mock('@/lib/auth/authorizationService', () => ({
  requirePermission: jest.fn(),
  requireAnyPermission: jest.fn(),
  preventSelfApproval: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
  createAuditContext: jest.fn(() => ({})),
}));

// ---- Imports under test ---------------------------------------------------

import { formatProcurementNumber } from '@/lib/procurement/generateProcurementNumber';
import { formatPRNumber } from '@/lib/procurement/purchaseRequest/utils';
import { formatMatchNumber } from '@/lib/procurement/threeWayMatch/matching';
import { formatEnquiryNumber } from '@/lib/enquiry/enquiryService';
import { formatProposalNumber } from '@/lib/proposals/proposalService';
import { formatProjectNumber } from '@/lib/proposals/projectConversion';
import { formatServiceCode } from '@/lib/services/crud';
import { formatBoughtOutItemCode } from '@/lib/boughtOut/boughtOutService';

describe('document number formats stay byte-identical (known-gaps 2.4)', () => {
  it('enquiry: ENQ-YY-NN', () => {
    expect(formatEnquiryNumber(2026, 1)).toBe('ENQ-26-01');
    expect(formatEnquiryNumber(2026, 42)).toBe('ENQ-26-42');
    // Sequences past 99 widen, same as the old parseInt-based generator
    expect(formatEnquiryNumber(2026, 100)).toBe('ENQ-26-100');
  });

  it('proposal: PROP-YY-NN', () => {
    expect(formatProposalNumber(2026, 1)).toBe('PROP-26-01');
    expect(formatProposalNumber(2025, 7)).toBe('PROP-25-07');
    expect(formatProposalNumber(2026, 123)).toBe('PROP-26-123');
  });

  it('project: PROJ-YYYY-NNNN', () => {
    expect(formatProjectNumber(2026, 1)).toBe('PROJ-2026-0001');
    expect(formatProjectNumber(2026, 987)).toBe('PROJ-2026-0987');
  });

  it('purchase request: PR/YYYY/XXXX', () => {
    expect(formatPRNumber(2026, 1)).toBe('PR/2026/0001');
    expect(formatPRNumber(2026, 1234)).toBe('PR/2026/1234');
  });

  it('three-way match: TWM/YYYY/MM/XXXX', () => {
    expect(formatMatchNumber(1, new Date(2026, 6, 11))).toBe('TWM/2026/07/0001');
    expect(formatMatchNumber(42, new Date(2026, 11, 3))).toBe('TWM/2026/12/0042');
  });

  it('service code: SVC-{CATEGORY_PREFIX}-{SEQ}', () => {
    expect(formatServiceCode('ENGINEERING', 1)).toBe('SVC-ENG-001');
    expect(formatServiceCode('FABRICATION', 12)).toBe('SVC-FAB-012');
    expect(formatServiceCode('MAINTENANCE', 345)).toBe('SVC-MNT-345');
    // Unknown category falls back to GEN, same as the old generator
    expect(formatServiceCode('SOMETHING_NEW', 2)).toBe('SVC-GEN-002');
  });

  it('bought-out item: BO-YYYY-NNNN', () => {
    expect(formatBoughtOutItemCode(2026, 1)).toBe('BO-2026-0001');
    expect(formatBoughtOutItemCode(2026, 57)).toBe('BO-2026-0057');
  });

  it('procurement yearly: PREFIX/YYYY/XXX', () => {
    expect(formatProcurementNumber('PO', 'yearly', 1, new Date(2026, 0, 1))).toBe('PO/2026/001');
    expect(formatProcurementNumber('PO', 'yearly', 42, new Date(2026, 6, 11))).toBe('PO/2026/042');
  });

  it('procurement monthly: PREFIX/YYYY/MM/XXXX', () => {
    expect(formatProcurementNumber('GR', 'monthly', 1, new Date(2026, 3, 5))).toBe(
      'GR/2026/04/0001'
    );
    expect(formatProcurementNumber('WCC', 'monthly', 12, new Date(2026, 10, 20))).toBe(
      'WCC/2026/11/0012'
    );
  });
});
