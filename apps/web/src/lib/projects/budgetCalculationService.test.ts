/**
 * Budget Calculation Service Tests
 *
 * Tests for calculating actual costs for project budget line items
 * by aggregating accounting transactions.
 */

import type { Firestore } from 'firebase/firestore';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import after mocks
import {
  calculateProjectBudgetActualCosts,
  calculateProjectTotalActualCost,
  calculateBudgetLineItemActualCost,
} from './budgetCalculationService';

describe('Budget Calculation Service', () => {
  const mockDb = { id: 'mock-db' } as unknown as Firestore;
  const projectId = 'project-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({ id: 'transactions' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
  });

  describe('calculateProjectBudgetActualCosts', () => {
    it('should return empty map when no transactions exist', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
        size: 0,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should aggregate costs by budget line item', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 1000,
            type: 'VENDOR_BILL',
            status: 'POSTED',
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 500,
            type: 'VENDOR_PAYMENT',
            status: 'PAID',
          }),
        },
        {
          id: 'txn-3',
          data: () => ({
            budgetLineItemId: 'budget-item-2',
            totalAmount: 2000,
            type: 'EXPENSE_CLAIM',
            status: 'POSTED',
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.size).toBe(2);
      expect(result.get('budget-item-1')).toEqual({
        budgetLineItemId: 'budget-item-1',
        actualCost: 1500,
        transactionCount: 2,
      });
      expect(result.get('budget-item-2')).toEqual({
        budgetLineItemId: 'budget-item-2',
        actualCost: 2000,
        transactionCount: 1,
      });
    });

    it('should skip transactions without budget line item ID', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 1000,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            // No budgetLineItemId
            totalAmount: 500,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.size).toBe(1);
      expect(result.get('budget-item-1')?.actualCost).toBe(1000);
    });

    it('should use amount field when totalAmount is not available', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            amount: 750,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('budget-item-1')?.actualCost).toBe(750);
    });

    it('should handle transactions with zero amount', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 0,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('budget-item-1')?.actualCost).toBe(0);
    });

    it('should query with correct filters for expense types and posted statuses', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
        size: 0,
      });

      await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(mockWhere).toHaveBeenCalledWith('costCentreId', '==', projectId);
      expect(mockWhere).toHaveBeenCalledWith('type', 'in', [
        'VENDOR_BILL',
        'VENDOR_PAYMENT',
        'EXPENSE_CLAIM',
      ]);
      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['POSTED', 'PAID', 'PARTIALLY_PAID']);
    });

    it('should throw error on Firestore failure', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore connection failed'));

      await expect(calculateProjectBudgetActualCosts(mockDb, projectId)).rejects.toThrow(
        'Failed to calculate actual costs: Firestore connection failed'
      );
    });
  });

  describe('calculateProjectTotalActualCost', () => {
    it('should return zero when no transactions exist', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
        size: 0,
      });

      const result = await calculateProjectTotalActualCost(mockDb, projectId);

      expect(result).toBe(0);
    });

    it('should sum all budget line item costs', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 1000,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            budgetLineItemId: 'budget-item-2',
            totalAmount: 2500,
          }),
        },
        {
          id: 'txn-3',
          data: () => ({
            budgetLineItemId: 'budget-item-3',
            totalAmount: 500,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectTotalActualCost(mockDb, projectId);

      expect(result).toBe(4000);
    });

    it('should propagate errors from budget calculation', async () => {
      mockGetDocs.mockRejectedValue(new Error('Connection timeout'));

      await expect(calculateProjectTotalActualCost(mockDb, projectId)).rejects.toThrow();
    });
  });

  describe('calculateBudgetLineItemActualCost', () => {
    const budgetLineItemId = 'budget-item-123';

    it('should return zero when no transactions exist for budget line item', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
        size: 0,
      });

      const result = await calculateBudgetLineItemActualCost(mockDb, projectId, budgetLineItemId);

      expect(result).toBe(0);
    });

    it('should sum transactions for specific budget line item', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            totalAmount: 1000,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            totalAmount: 750,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateBudgetLineItemActualCost(mockDb, projectId, budgetLineItemId);

      expect(result).toBe(1750);
    });

    it('should query with budget line item ID filter', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
        size: 0,
      });

      await calculateBudgetLineItemActualCost(mockDb, projectId, budgetLineItemId);

      expect(mockWhere).toHaveBeenCalledWith('budgetLineItemId', '==', budgetLineItemId);
    });

    it('should use amount field as fallback', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            amount: 500,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateBudgetLineItemActualCost(mockDb, projectId, budgetLineItemId);

      expect(result).toBe(500);
    });

    it('should throw error on Firestore failure', async () => {
      mockGetDocs.mockRejectedValue(new Error('Permission denied'));

      await expect(
        calculateBudgetLineItemActualCost(mockDb, projectId, budgetLineItemId)
      ).rejects.toThrow('Failed to calculate actual cost: Permission denied');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 999999999.99,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 0.01,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('budget-item-1')?.actualCost).toBe(1000000000);
    });

    it('should handle negative amounts (reversals)', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: 1000,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            totalAmount: -200,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('budget-item-1')?.actualCost).toBe(800);
    });

    it('should handle undefined amount values', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            budgetLineItemId: 'budget-item-1',
            // No amount fields
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('budget-item-1')?.actualCost).toBe(0);
    });

    it('should correctly count multiple transactions', async () => {
      const mockDocs = [
        { id: 'txn-1', data: () => ({ budgetLineItemId: 'item-1', totalAmount: 100 }) },
        { id: 'txn-2', data: () => ({ budgetLineItemId: 'item-1', totalAmount: 200 }) },
        { id: 'txn-3', data: () => ({ budgetLineItemId: 'item-1', totalAmount: 300 }) },
        { id: 'txn-4', data: () => ({ budgetLineItemId: 'item-2', totalAmount: 400 }) },
        { id: 'txn-5', data: () => ({ budgetLineItemId: 'item-2', totalAmount: 500 }) },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => mockDocs.forEach(cb),
        size: mockDocs.length,
      });

      const result = await calculateProjectBudgetActualCosts(mockDb, projectId);

      expect(result.get('item-1')?.transactionCount).toBe(3);
      expect(result.get('item-2')?.transactionCount).toBe(2);
    });
  });
});
