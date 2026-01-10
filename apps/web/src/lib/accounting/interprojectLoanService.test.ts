/**
 * Interproject Loan Service Tests
 *
 * Tests for interproject loan creation, repayment, and schedule generation
 */

import type { InterprojectLoan, CostCentre } from '@vapour/types';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    INTERPROJECT_LOANS: 'interprojectLoans',
    TRANSACTIONS: 'transactions',
    COST_CENTRES: 'costCentres',
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-doc-id' });
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

// Mock transaction number generator
jest.mock('./transactionNumberGenerator', () => ({
  generateTransactionNumber: jest.fn().mockResolvedValue('JE-2024-0001'),
}));

// Mock audit logging
jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn().mockReturnValue({
    userId: 'user-1',
    tenantId: '',
    userName: 'Test User',
  }),
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ ...data, id }) as T,
}));

import {
  createInterprojectLoan,
  getInterprojectLoan,
  recordRepayment,
  generateRepaymentSchedule,
  InterprojectLoanError,
} from './interprojectLoanService';
import type { Firestore } from 'firebase/firestore';

describe('interprojectLoanService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock cost centre
  const createMockCostCentre = (overrides?: Partial<CostCentre>): CostCentre => ({
    id: 'cc-1',
    code: 'CC-001',
    name: 'Project Alpha',
    category: 'PROJECT',
    budgetAmount: 1000000,
    budgetCurrency: 'INR',
    actualSpent: 0,
    variance: null,
    isActive: true,
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    ...overrides,
  });

  // Helper to create mock loan
  const createMockLoan = (overrides?: Partial<InterprojectLoan>): InterprojectLoan => ({
    id: 'loan-1',
    loanNumber: 'IPL-2024-ABC1',
    lendingProjectId: 'cc-1',
    borrowingProjectId: 'cc-2',
    principalAmount: 100000,
    currency: 'INR',
    interestRate: 10,
    interestCalculationMethod: 'SIMPLE',
    startDate: new Date('2024-01-01'),
    maturityDate: new Date('2024-12-31'),
    repaymentSchedule: [],
    remainingPrincipal: 100000,
    totalInterestAccrued: 0,
    totalInterestPaid: 0,
    status: 'ACTIVE',
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    ...overrides,
  });

  describe('generateRepaymentSchedule', () => {
    it('generates monthly repayment schedule with simple interest', () => {
      const schedule = generateRepaymentSchedule(
        120000, // principal
        12, // 12% annual
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'MONTHLY'
      );

      // Should generate approximately 12-13 monthly payments depending on date math
      expect(schedule.length).toBeGreaterThanOrEqual(12);
      expect(schedule.length).toBeLessThanOrEqual(13);
      expect(schedule[0].status).toBe('PENDING');

      // Each month should have principal payment
      const totalPrincipal = schedule.reduce((sum, s) => sum + s.principalAmount, 0);
      expect(totalPrincipal).toBeCloseTo(120000, -1); // Allow small rounding
    });

    it('generates quarterly repayment schedule', () => {
      const schedule = generateRepaymentSchedule(
        100000,
        10,
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'QUARTERLY'
      );

      // Should generate approximately 4-5 quarterly payments
      expect(schedule.length).toBeGreaterThanOrEqual(4);
      expect(schedule.length).toBeLessThanOrEqual(5);
    });

    it('generates bullet payment schedule', () => {
      const schedule = generateRepaymentSchedule(
        100000,
        10,
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'BULLET'
      );

      expect(schedule.length).toBe(1);
      expect(schedule[0].principalAmount).toBe(100000);
    });

    it('calculates compound interest correctly', () => {
      const simpleSchedule = generateRepaymentSchedule(
        100000,
        12,
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'BULLET'
      );

      const compoundSchedule = generateRepaymentSchedule(
        100000,
        12,
        'COMPOUND',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'BULLET'
      );

      // Compound interest should be higher than simple interest
      expect(compoundSchedule[0].interestAmount).toBeGreaterThan(simpleSchedule[0].interestAmount);
    });
  });

  describe('createInterprojectLoan', () => {
    it('returns error when lending project is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await createInterprojectLoan(mockDb, {
        lendingProjectId: 'non-existent',
        borrowingProjectId: 'cc-2',
        principalAmount: 100000,
        interestRate: 10,
        interestCalculationMethod: 'SIMPLE',
        startDate: new Date('2024-01-01'),
        maturityDate: new Date('2024-12-31'),
        repaymentFrequency: 'MONTHLY',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lending project not found');
    });

    it('returns error when lending and borrowing projects are the same', async () => {
      const mockCostCentre = createMockCostCentre();

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-1',
          data: () => mockCostCentre,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-1',
          data: () => mockCostCentre,
        });

      const result = await createInterprojectLoan(mockDb, {
        lendingProjectId: 'cc-1',
        borrowingProjectId: 'cc-1',
        principalAmount: 100000,
        interestRate: 10,
        interestCalculationMethod: 'SIMPLE',
        startDate: new Date('2024-01-01'),
        maturityDate: new Date('2024-12-31'),
        repaymentFrequency: 'MONTHLY',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lending and borrowing projects must be different');
    });

    it('successfully creates an interproject loan', async () => {
      const lendingProject = createMockCostCentre({ id: 'cc-1', name: 'Project Alpha' });
      const borrowingProject = createMockCostCentre({ id: 'cc-2', name: 'Project Beta' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-1',
          data: () => lendingProject,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-2',
          data: () => borrowingProject,
        });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await createInterprojectLoan(mockDb, {
        lendingProjectId: 'cc-1',
        borrowingProjectId: 'cc-2',
        principalAmount: 100000,
        interestRate: 10,
        interestCalculationMethod: 'SIMPLE',
        startDate: new Date('2024-01-01'),
        maturityDate: new Date('2024-12-31'),
        repaymentFrequency: 'MONTHLY',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.loanNumber).toMatch(/^IPL-\d{4}-[A-Z0-9]+$/);
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });

  describe('getInterprojectLoan', () => {
    it('returns null when loan is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await getInterprojectLoan(mockDb, 'non-existent');

      expect(result).toBeNull();
    });

    it('returns loan when found', async () => {
      const mockLoan = createMockLoan();

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'loan-1',
        data: () => mockLoan,
      });

      const result = await getInterprojectLoan(mockDb, 'loan-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('loan-1');
      expect(result?.principalAmount).toBe(100000);
    });
  });

  describe('recordRepayment', () => {
    it('returns error when loan is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await recordRepayment(mockDb, {
        loanId: 'non-existent',
        repaymentDate: new Date(),
        principalAmount: 10000,
        interestAmount: 500,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Loan not found');
    });

    it('returns error when loan is already fully repaid', async () => {
      const mockLoan = createMockLoan({ status: 'FULLY_REPAID' });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'loan-1',
        data: () => mockLoan,
      });

      const result = await recordRepayment(mockDb, {
        loanId: 'loan-1',
        repaymentDate: new Date(),
        principalAmount: 10000,
        interestAmount: 500,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Loan is already fully repaid');
    });

    it('successfully records a repayment', async () => {
      const mockLoan = createMockLoan({
        repaymentSchedule: [
          {
            dueDate: new Date('2024-02-01'),
            principalAmount: 10000,
            interestAmount: 833,
            totalAmount: 10833,
            status: 'PENDING',
          },
        ],
      });

      const lendingProject = createMockCostCentre({ id: 'cc-1', name: 'Project Alpha' });
      const borrowingProject = createMockCostCentre({ id: 'cc-2', name: 'Project Beta' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'loan-1',
          data: () => mockLoan,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-1',
          data: () => lendingProject,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-2',
          data: () => borrowingProject,
        });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await recordRepayment(mockDb, {
        loanId: 'loan-1',
        repaymentDate: new Date('2024-02-01'),
        principalAmount: 10000,
        interestAmount: 833,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.loanNumber).toBe('IPL-2024-ABC1');
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    it('marks loan as fully repaid when remaining principal is zero', async () => {
      const mockLoan = createMockLoan({
        remainingPrincipal: 10000, // Last payment
        repaymentSchedule: [
          {
            dueDate: new Date('2024-12-01'),
            principalAmount: 10000,
            interestAmount: 100,
            totalAmount: 10100,
            status: 'PENDING',
          },
        ],
      });

      const lendingProject = createMockCostCentre({ id: 'cc-1', name: 'Project Alpha' });
      const borrowingProject = createMockCostCentre({ id: 'cc-2', name: 'Project Beta' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'loan-1',
          data: () => mockLoan,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-1',
          data: () => lendingProject,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'cc-2',
          data: () => borrowingProject,
        });

      let updatedStatus: string | undefined;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          set: jest.fn(),
          update: jest.fn((ref, data) => {
            if (data.status) {
              updatedStatus = data.status;
            }
          }),
        };
        return callback(mockTransaction);
      });

      await recordRepayment(mockDb, {
        loanId: 'loan-1',
        repaymentDate: new Date('2024-12-01'),
        principalAmount: 10000, // Full remaining principal
        interestAmount: 100,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(updatedStatus).toBe('FULLY_REPAID');
    });
  });

  describe('interest calculations', () => {
    it('simple interest calculation is correct', () => {
      // 100,000 at 10% for 1 year = approximately 10,000 (may be higher due to leap year/day count)
      const schedule = generateRepaymentSchedule(
        100000,
        10,
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2025-01-01'),
        'BULLET'
      );

      // Should be approximately 10,000-11,000 (may vary due to day count calculation)
      const interest = schedule[0].interestAmount;
      expect(interest).toBeGreaterThan(9500);
      expect(interest).toBeLessThan(11500);
    });

    it('compound interest is higher than simple interest for same terms', () => {
      const simple = generateRepaymentSchedule(
        100000,
        12,
        'SIMPLE',
        new Date('2024-01-01'),
        new Date('2025-01-01'),
        'BULLET'
      );

      const compound = generateRepaymentSchedule(
        100000,
        12,
        'COMPOUND',
        new Date('2024-01-01'),
        new Date('2025-01-01'),
        'BULLET'
      );

      expect(compound[0].interestAmount).toBeGreaterThan(simple[0].interestAmount);
    });
  });
});
