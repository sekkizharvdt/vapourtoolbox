/**
 * useGSTCalculation Hook Tests
 *
 * Tests for the useGSTCalculation hook that handles Indian GST tax calculations.
 * Covers intra-state (CGST + SGST) and inter-state (IGST) scenarios.
 */

import { renderHook } from '@testing-library/react';
import { useGSTCalculation } from './useGSTCalculation';
import type { LineItem } from '@vapour/types';

describe('useGSTCalculation Hook', () => {
  const mockLineItems: LineItem[] = [
    {
      id: 'item-1',
      description: 'Laptop',
      quantity: 2,
      unitPrice: 50000,
      amount: 100000,
      gstRate: 18,
    },
    {
      id: 'item-2',
      description: 'Mouse',
      quantity: 5,
      unitPrice: 500,
      amount: 2500,
      gstRate: 18,
    },
  ];

  describe('Intra-State Transactions (CGST + SGST)', () => {
    it('should calculate CGST and SGST for same state transaction', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: '29', // Karnataka
          entityState: '29', // Karnataka
        })
      );

      expect(result.current.averageGstRate).toBe(18);
      expect(result.current.gstDetails).toBeDefined();
      expect(result.current.gstDetails?.cgstAmount).toBe(9225); // 102500 * 9%
      expect(result.current.gstDetails?.sgstAmount).toBe(9225); // 102500 * 9%
      expect(result.current.gstDetails?.igstAmount).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(18450); // CGST + SGST
      expect(result.current.grandTotal).toBe(120950); // 102500 + 18450
    });

    it('should split GST rate equally between CGST and SGST', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Product',
              quantity: 1,
              unitPrice: 10000,
              amount: 10000,
              gstRate: 28,
            },
          ],
          subtotal: 10000,
          companyState: '07', // Delhi
          entityState: '07', // Delhi
        })
      );

      expect(result.current.gstDetails?.cgstAmount).toBe(1400); // 10000 * 14%
      expect(result.current.gstDetails?.sgstAmount).toBe(1400); // 10000 * 14%
      expect(result.current.totalGstAmount).toBe(2800); // 28%
    });
  });

  describe('Inter-State Transactions (IGST)', () => {
    it('should calculate IGST for different state transaction', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: '29', // Karnataka
          entityState: '27', // Maharashtra
        })
      );

      expect(result.current.gstDetails).toBeDefined();
      expect(result.current.gstDetails?.cgstAmount).toBeUndefined();
      expect(result.current.gstDetails?.sgstAmount).toBeUndefined();
      expect(result.current.gstDetails?.igstAmount).toBe(18450); // 102500 * 18%
      expect(result.current.totalGstAmount).toBe(18450);
      expect(result.current.grandTotal).toBe(120950);
    });

    it('should use IGST when states are different', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Service',
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
              gstRate: 12,
            },
          ],
          subtotal: 50000,
          companyState: '07', // Delhi
          entityState: '36', // Telangana
        })
      );

      expect(result.current.gstDetails?.igstAmount).toBe(6000); // 50000 * 12%
      expect(result.current.totalGstAmount).toBe(6000);
    });
  });

  describe('Average GST Rate Calculation', () => {
    it('should calculate average GST rate from multiple line items', () => {
      const mixedLineItems: LineItem[] = [
        {
          id: 'item-1',
          description: 'Product A',
          quantity: 1,
          unitPrice: 10000,
          amount: 10000,
          gstRate: 18,
        },
        {
          id: 'item-2',
          description: 'Product B',
          quantity: 1,
          unitPrice: 5000,
          amount: 5000,
          gstRate: 12,
        },
        {
          id: 'item-3',
          description: 'Product C',
          quantity: 1,
          unitPrice: 2000,
          amount: 2000,
          gstRate: 28,
        },
      ];

      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mixedLineItems,
          subtotal: 17000,
          companyState: '29',
          entityState: '29',
        })
      );

      // Average: (18 + 12 + 28) / 3 = 19.33%
      expect(result.current.averageGstRate).toBeCloseTo(19.33, 2);
    });

    it('should return 0 for empty line items', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [],
          subtotal: 0,
          companyState: '29',
          entityState: '29',
        })
      );

      expect(result.current.averageGstRate).toBe(0);
    });

    it('should handle line items with missing gstRate', () => {
      const lineItemsWithMissingRate: LineItem[] = [
        {
          id: 'item-1',
          description: 'Product',
          quantity: 1,
          unitPrice: 10000,
          amount: 10000,
          // gstRate is optional
        },
      ];

      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: lineItemsWithMissingRate,
          subtotal: 10000,
          companyState: '29',
          entityState: '29',
        })
      );

      expect(result.current.averageGstRate).toBe(0);
    });
  });

  describe('Different GST Rates', () => {
    it('should calculate GST at 5% rate', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Essential goods',
              quantity: 1,
              unitPrice: 10000,
              amount: 10000,
              gstRate: 5,
            },
          ],
          subtotal: 10000,
          companyState: '29',
          entityState: '29',
        })
      );

      expect(result.current.totalGstAmount).toBe(500); // 10000 * 5%
    });

    it('should calculate GST at 12% rate', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Mid-range goods',
              quantity: 1,
              unitPrice: 10000,
              amount: 10000,
              gstRate: 12,
            },
          ],
          subtotal: 10000,
          companyState: '29',
          entityState: '27',
        })
      );

      expect(result.current.totalGstAmount).toBe(1200); // 10000 * 12%
    });

    it('should calculate GST at 28% rate for luxury goods', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Luxury item',
              quantity: 1,
              unitPrice: 10000,
              amount: 10000,
              gstRate: 28,
            },
          ],
          subtotal: 10000,
          companyState: '29',
          entityState: '29',
        })
      );

      expect(result.current.totalGstAmount).toBe(2800); // 10000 * 28%
    });
  });

  describe('Grand Total Calculation', () => {
    it('should calculate grand total as subtotal + GST', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [
            {
              id: 'item-1',
              description: 'Product',
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
              gstRate: 18,
            },
          ],
          subtotal: 50000,
          companyState: '29',
          entityState: '27',
        })
      );

      expect(result.current.totalGstAmount).toBe(9000); // 50000 * 18%
      expect(result.current.grandTotal).toBe(59000); // 50000 + 9000
    });

    it('should update grand total when subtotal changes', () => {
      const { result, rerender } = renderHook(
        ({ subtotal }) =>
          useGSTCalculation({
            lineItems: [
              {
                id: 'item-1',
                description: 'Product',
                quantity: 1,
                unitPrice: subtotal,
                amount: subtotal,
                gstRate: 18,
              },
            ],
            subtotal,
            companyState: '29',
            entityState: '29',
          }),
        { initialProps: { subtotal: 10000 } }
      );

      expect(result.current.grandTotal).toBe(11800); // 10000 + 1800

      // Change subtotal
      rerender({ subtotal: 20000 });
      expect(result.current.grandTotal).toBe(23600); // 20000 + 3600
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should return undefined gstDetails when enabled is false', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: '29',
          entityState: '27',
          enabled: false,
        })
      );

      expect(result.current.gstDetails).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(0);
      expect(result.current.grandTotal).toBe(102500); // Only subtotal, no GST
    });

    it('should return undefined gstDetails when company state is missing', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: undefined,
          entityState: '27',
        })
      );

      expect(result.current.gstDetails).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(0);
    });

    it('should return undefined gstDetails when entity state is missing', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: '29',
          entityState: undefined,
        })
      );

      expect(result.current.gstDetails).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(0);
    });

    it('should return undefined gstDetails when subtotal is 0', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [],
          subtotal: 0,
          companyState: '29',
          entityState: '27',
        })
      );

      expect(result.current.gstDetails).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(0);
      expect(result.current.grandTotal).toBe(0);
    });

    it('should return undefined gstDetails when subtotal is negative', () => {
      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: [],
          subtotal: -10000,
          companyState: '29',
          entityState: '27',
        })
      );

      expect(result.current.gstDetails).toBeUndefined();
    });
  });

  describe('Memoization and Performance', () => {
    it('should memoize calculations when inputs do not change', () => {
      const { result, rerender } = renderHook(() =>
        useGSTCalculation({
          lineItems: mockLineItems,
          subtotal: 102500,
          companyState: '29',
          entityState: '27',
        })
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // Objects should be the same reference (memoized)
      expect(firstResult.gstDetails).toBe(secondResult.gstDetails);
    });

    it('should recalculate when line items change', () => {
      const { result, rerender } = renderHook(
        ({ lineItems }) =>
          useGSTCalculation({
            lineItems,
            subtotal: 102500,
            companyState: '29',
            entityState: '27',
          }),
        { initialProps: { lineItems: mockLineItems } }
      );

      const firstAverageRate = result.current.averageGstRate;

      // Change line items
      const newLineItems: LineItem[] = [
        {
          id: 'item-1',
          description: 'New Product',
          quantity: 1,
          unitPrice: 10000,
          amount: 10000,
          gstRate: 12,
        },
      ];

      rerender({ lineItems: newLineItems });
      expect(result.current.averageGstRate).not.toBe(firstAverageRate);
      expect(result.current.averageGstRate).toBe(12);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should calculate GST for multi-item invoice (intra-state)', () => {
      const invoiceItems: LineItem[] = [
        {
          id: 'item-1',
          description: 'Dell Laptop',
          quantity: 10,
          unitPrice: 60000,
          amount: 600000,
          gstRate: 18,
        },
        {
          id: 'item-2',
          description: 'Keyboard',
          quantity: 10,
          unitPrice: 1500,
          amount: 15000,
          gstRate: 18,
        },
        {
          id: 'item-3',
          description: 'Mouse',
          quantity: 10,
          unitPrice: 800,
          amount: 8000,
          gstRate: 18,
        },
      ];

      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: invoiceItems,
          subtotal: 623000,
          companyState: '29', // Karnataka
          entityState: '29', // Karnataka (same state)
        })
      );

      expect(result.current.averageGstRate).toBe(18);
      expect(result.current.gstDetails?.cgstAmount).toBe(56070); // 623000 * 9%
      expect(result.current.gstDetails?.sgstAmount).toBe(56070); // 623000 * 9%
      expect(result.current.totalGstAmount).toBe(112140); // 623000 * 18%
      expect(result.current.grandTotal).toBe(735140);
    });

    it('should calculate GST for service invoice (inter-state)', () => {
      const serviceItem: LineItem[] = [
        {
          id: 'item-1',
          description: 'Consulting Services',
          quantity: 1,
          unitPrice: 500000,
          amount: 500000,
          gstRate: 18,
        },
      ];

      const { result } = renderHook(() =>
        useGSTCalculation({
          lineItems: serviceItem,
          subtotal: 500000,
          companyState: '29', // Karnataka
          entityState: '07', // Delhi (different state)
        })
      );

      expect(result.current.gstDetails?.igstAmount).toBe(90000); // 500000 * 18%
      expect(result.current.gstDetails?.cgstAmount).toBeUndefined();
      expect(result.current.gstDetails?.sgstAmount).toBeUndefined();
      expect(result.current.totalGstAmount).toBe(90000);
      expect(result.current.grandTotal).toBe(590000);
    });
  });
});
