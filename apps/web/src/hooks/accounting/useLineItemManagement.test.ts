/**
 * useLineItemManagement Hook Tests
 *
 * Tests for the useLineItemManagement hook that handles line item CRUD operations.
 * Covers adding, removing, updating line items, and automatic amount calculations.
 */

import { renderHook, act } from '@testing-library/react';
import { useLineItemManagement } from './useLineItemManagement';
import type { LineItem } from '@vapour/types';

describe('useLineItemManagement Hook', () => {
  describe('Initialization', () => {
    it('should initialize with one empty line item by default', () => {
      const { result } = renderHook(() => useLineItemManagement());

      expect(result.current.lineItems).toHaveLength(1);
      expect(result.current.lineItems[0]).toEqual(
        expect.objectContaining({
          description: '',
          quantity: 1,
          unitPrice: 0,
          gstRate: 18,
          amount: 0,
          hsnCode: '',
        })
      );
      expect(result.current.lineItems[0]?.id).toBeDefined();
    });

    it('should initialize with provided initial line items', () => {
      const initialLineItems: LineItem[] = [
        {
          id: 'item-1',
          description: 'Laptop',
          quantity: 2,
          unitPrice: 50000,
          gstRate: 18,
          amount: 100000,
          hsnCode: '8471',
        },
        {
          id: 'item-2',
          description: 'Mouse',
          quantity: 5,
          unitPrice: 500,
          gstRate: 18,
          amount: 2500,
          hsnCode: '8471',
        },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[0]?.description).toBe('Laptop');
      expect(result.current.lineItems[1]?.description).toBe('Mouse');
    });

    it('should use custom default GST rate for new line items', () => {
      const { result } = renderHook(() => useLineItemManagement({ defaultGstRate: 12 }));

      expect(result.current.lineItems[0]?.gstRate).toBe(12);
    });

    it('should initialize with empty line item if initialLineItems is empty array', () => {
      const { result } = renderHook(() => useLineItemManagement({ initialLineItems: [] }));

      expect(result.current.lineItems).toHaveLength(1);
      expect(result.current.lineItems[0]?.gstRate).toBe(18);
    });
  });

  describe('Adding Line Items', () => {
    it('should add a new empty line item', () => {
      const { result } = renderHook(() => useLineItemManagement());

      expect(result.current.lineItems).toHaveLength(1);

      act(() => {
        result.current.addLineItem();
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[1]).toEqual(
        expect.objectContaining({
          description: '',
          quantity: 1,
          unitPrice: 0,
          gstRate: 18,
          amount: 0,
          hsnCode: '',
        })
      );
      expect(result.current.lineItems[1]?.id).toBeDefined();
    });

    it('should add multiple line items', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.addLineItem();
        result.current.addLineItem();
        result.current.addLineItem();
      });

      expect(result.current.lineItems).toHaveLength(4); // 1 initial + 3 added
    });

    it('should use default GST rate when adding line items', () => {
      const { result } = renderHook(() => useLineItemManagement({ defaultGstRate: 28 }));

      act(() => {
        result.current.addLineItem();
      });

      expect(result.current.lineItems[0]?.gstRate).toBe(28);
      expect(result.current.lineItems[1]?.gstRate).toBe(28);
    });
  });

  describe('Removing Line Items', () => {
    it('should remove line item at specified index', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Item 1', quantity: 1, unitPrice: 100, gstRate: 18, amount: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 200, gstRate: 18, amount: 200 },
        { description: 'Item 3', quantity: 1, unitPrice: 300, gstRate: 18, amount: 300 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      act(() => {
        result.current.removeLineItem(1); // Remove 'Item 2'
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[0]?.description).toBe('Item 1');
      expect(result.current.lineItems[1]?.description).toBe('Item 3');
    });

    it('should not remove line item if minimum count would be violated', () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useLineItemManagement({ minItems: 1, onError }));

      expect(result.current.lineItems).toHaveLength(1);

      act(() => {
        result.current.removeLineItem(0);
      });

      // Should not remove
      expect(result.current.lineItems).toHaveLength(1);
      expect(onError).toHaveBeenCalledWith('At least 1 line item is required');
    });

    it('should call onError with plural message when minItems > 1', () => {
      const onError = jest.fn();
      const initialLineItems: LineItem[] = [
        { description: 'Item 1', quantity: 1, unitPrice: 100, gstRate: 18, amount: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 200, gstRate: 18, amount: 200 },
      ];

      const { result } = renderHook(() =>
        useLineItemManagement({ initialLineItems, minItems: 2, onError })
      );

      act(() => {
        result.current.removeLineItem(0);
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(onError).toHaveBeenCalledWith('At least 2 line items are required');
    });

    it('should allow removing when above minimum count', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Item 1', quantity: 1, unitPrice: 100, gstRate: 18, amount: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 200, gstRate: 18, amount: 200 },
        { description: 'Item 3', quantity: 1, unitPrice: 300, gstRate: 18, amount: 300 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems, minItems: 2 }));

      act(() => {
        result.current.removeLineItem(2);
      });

      expect(result.current.lineItems).toHaveLength(2);
    });
  });

  describe('Updating Line Items', () => {
    it('should update line item description', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'description', 'New Product');
      });

      expect(result.current.lineItems[0]?.description).toBe('New Product');
    });

    it('should update line item quantity', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'quantity', 5);
      });

      expect(result.current.lineItems[0]?.quantity).toBe(5);
    });

    it('should update line item unitPrice', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'unitPrice', 1500);
      });

      expect(result.current.lineItems[0]?.unitPrice).toBe(1500);
    });

    it('should update line item gstRate', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'gstRate', 28);
      });

      expect(result.current.lineItems[0]?.gstRate).toBe(28);
    });

    it('should update line item hsnCode', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'hsnCode', '8471');
      });

      expect(result.current.lineItems[0]?.hsnCode).toBe('8471');
    });

    it('should not update if index is out of bounds', () => {
      const { result } = renderHook(() => useLineItemManagement());

      const originalLineItems = result.current.lineItems;

      act(() => {
        result.current.updateLineItem(5, 'description', 'Invalid');
      });

      // Should remain unchanged
      expect(result.current.lineItems).toEqual(originalLineItems);
    });
  });

  describe('Automatic Amount Calculation', () => {
    it('should recalculate amount when quantity is updated', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'unitPrice', 1000);
        result.current.updateLineItem(0, 'quantity', 5);
      });

      expect(result.current.lineItems[0]?.amount).toBe(5000);
    });

    it('should recalculate amount when unitPrice is updated', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'quantity', 3);
        result.current.updateLineItem(0, 'unitPrice', 2500);
      });

      expect(result.current.lineItems[0]?.amount).toBe(7500);
    });

    it('should recalculate amount when both quantity and unitPrice are updated', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'quantity', 10);
      });
      expect(result.current.lineItems[0]?.amount).toBe(0); // unitPrice is still 0

      act(() => {
        result.current.updateLineItem(0, 'unitPrice', 500);
      });
      expect(result.current.lineItems[0]?.amount).toBe(5000); // 10 * 500
    });

    it('should not recalculate amount when other fields are updated', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Product', quantity: 2, unitPrice: 1000, gstRate: 18, amount: 2000 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      act(() => {
        result.current.updateLineItem(0, 'description', 'Updated Product');
      });

      expect(result.current.lineItems[0]?.amount).toBe(2000); // Unchanged

      act(() => {
        result.current.updateLineItem(0, 'gstRate', 28);
      });

      expect(result.current.lineItems[0]?.amount).toBe(2000); // Still unchanged
    });

    it('should handle zero quantity', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'unitPrice', 1000);
        result.current.updateLineItem(0, 'quantity', 0);
      });

      expect(result.current.lineItems[0]?.amount).toBe(0);
    });

    it('should handle zero unitPrice', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'quantity', 5);
        result.current.updateLineItem(0, 'unitPrice', 0);
      });

      expect(result.current.lineItems[0]?.amount).toBe(0);
    });
  });

  describe('Subtotal Calculation', () => {
    it('should calculate subtotal from all line items', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.addLineItem();
        result.current.addLineItem();

        result.current.updateLineItem(0, 'quantity', 2);
        result.current.updateLineItem(0, 'unitPrice', 1000);

        result.current.updateLineItem(1, 'quantity', 3);
        result.current.updateLineItem(1, 'unitPrice', 500);

        result.current.updateLineItem(2, 'quantity', 1);
        result.current.updateLineItem(2, 'unitPrice', 2500);
      });

      // (2*1000) + (3*500) + (1*2500) = 2000 + 1500 + 2500 = 6000
      expect(result.current.subtotal).toBe(6000);
    });

    it('should return 0 for empty amounts', () => {
      const { result } = renderHook(() => useLineItemManagement());

      expect(result.current.subtotal).toBe(0);
    });

    it('should update subtotal when line items are added', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Item 1', quantity: 2, unitPrice: 1000, gstRate: 18, amount: 2000 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      expect(result.current.subtotal).toBe(2000);

      act(() => {
        result.current.addLineItem();
        result.current.updateLineItem(1, 'quantity', 3);
        result.current.updateLineItem(1, 'unitPrice', 500);
      });

      expect(result.current.subtotal).toBe(3500); // 2000 + 1500
    });

    it('should update subtotal when line items are removed', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Item 1', quantity: 2, unitPrice: 1000, gstRate: 18, amount: 2000 },
        { description: 'Item 2', quantity: 3, unitPrice: 500, gstRate: 18, amount: 1500 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      expect(result.current.subtotal).toBe(3500);

      act(() => {
        result.current.removeLineItem(1);
      });

      expect(result.current.subtotal).toBe(2000);
    });

    it('should update subtotal when amounts change', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'quantity', 5);
        result.current.updateLineItem(0, 'unitPrice', 1000);
      });

      expect(result.current.subtotal).toBe(5000);

      act(() => {
        result.current.updateLineItem(0, 'quantity', 10);
      });

      expect(result.current.subtotal).toBe(10000);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial line items', () => {
      const initialLineItems: LineItem[] = [
        { description: 'Original Item', quantity: 2, unitPrice: 1000, gstRate: 18, amount: 2000 },
      ];

      const { result } = renderHook(() => useLineItemManagement({ initialLineItems }));

      // Make changes
      act(() => {
        result.current.addLineItem();
        result.current.updateLineItem(0, 'description', 'Modified');
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[0]?.description).toBe('Modified');

      // Reset
      act(() => {
        result.current.resetLineItems();
      });

      expect(result.current.lineItems).toHaveLength(1);
      expect(result.current.lineItems[0]?.description).toBe('Original Item');
    });

    it('should reset to default empty line item when no initial items', () => {
      const { result } = renderHook(() => useLineItemManagement({ defaultGstRate: 12 }));

      // Make changes
      act(() => {
        result.current.addLineItem();
        result.current.updateLineItem(0, 'description', 'Test');
        result.current.updateLineItem(0, 'quantity', 5);
      });

      expect(result.current.lineItems).toHaveLength(2);

      // Reset
      act(() => {
        result.current.resetLineItems();
      });

      expect(result.current.lineItems).toHaveLength(1);
      expect(result.current.lineItems[0]).toEqual(
        expect.objectContaining({
          description: '',
          quantity: 1,
          unitPrice: 0,
          gstRate: 12,
          amount: 0,
          hsnCode: '',
        })
      );
      expect(result.current.lineItems[0]?.id).toBeDefined();
    });
  });

  describe('Direct State Manipulation', () => {
    it('should allow setting line items directly', () => {
      const { result } = renderHook(() => useLineItemManagement());

      const newLineItems: LineItem[] = [
        { description: 'Direct Item 1', quantity: 1, unitPrice: 100, gstRate: 18, amount: 100 },
        { description: 'Direct Item 2', quantity: 2, unitPrice: 200, gstRate: 18, amount: 400 },
      ];

      act(() => {
        result.current.setLineItems(newLineItems);
      });

      expect(result.current.lineItems).toEqual(newLineItems);
      expect(result.current.subtotal).toBe(500);
    });

    it('should allow functional updates', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.setLineItems((prev) => [
          ...prev,
          { description: 'Functional', quantity: 1, unitPrice: 500, gstRate: 18, amount: 500 },
        ]);
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[1]?.description).toBe('Functional');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support building an invoice with multiple items', () => {
      const { result } = renderHook(() => useLineItemManagement());

      // Add line items for an invoice
      act(() => {
        result.current.updateLineItem(0, 'description', 'Consulting Services');
        result.current.updateLineItem(0, 'quantity', 40); // 40 hours
        result.current.updateLineItem(0, 'unitPrice', 2000); // ₹2000/hour
        result.current.updateLineItem(0, 'gstRate', 18);
        result.current.updateLineItem(0, 'hsnCode', '998314');

        result.current.addLineItem();
        result.current.updateLineItem(1, 'description', 'Software License');
        result.current.updateLineItem(1, 'quantity', 1);
        result.current.updateLineItem(1, 'unitPrice', 50000);
        result.current.updateLineItem(1, 'gstRate', 18);
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[0]?.amount).toBe(80000); // 40 * 2000
      expect(result.current.lineItems[1]?.amount).toBe(50000); // 1 * 50000
      expect(result.current.subtotal).toBe(130000);
    });

    it('should support editing a vendor bill', () => {
      const existingBill: LineItem[] = [
        {
          id: 'item-1',
          description: 'Office Supplies',
          quantity: 10,
          unitPrice: 500,
          gstRate: 18,
          amount: 5000,
          hsnCode: '4820',
        },
        {
          id: 'item-2',
          description: 'Printer Cartridges',
          quantity: 5,
          unitPrice: 1200,
          gstRate: 18,
          amount: 6000,
          hsnCode: '8443',
        },
      ];

      const { result } = renderHook(() =>
        useLineItemManagement({ initialLineItems: existingBill })
      );

      expect(result.current.subtotal).toBe(11000);

      // Update quantity for office supplies
      act(() => {
        result.current.updateLineItem(0, 'quantity', 15);
      });

      expect(result.current.lineItems[0]?.amount).toBe(7500); // 15 * 500
      expect(result.current.subtotal).toBe(13500); // 7500 + 6000

      // Remove printer cartridges
      act(() => {
        result.current.removeLineItem(1);
      });

      expect(result.current.lineItems).toHaveLength(1);
      expect(result.current.subtotal).toBe(7500);
    });

    it('should handle fractional quantities and prices', () => {
      const { result } = renderHook(() => useLineItemManagement());

      act(() => {
        result.current.updateLineItem(0, 'description', 'Material (per kg)');
        result.current.updateLineItem(0, 'quantity', 12.5); // 12.5 kg
        result.current.updateLineItem(0, 'unitPrice', 450.75); // ₹450.75/kg
      });

      expect(result.current.lineItems[0]?.amount).toBeCloseTo(5634.375, 2); // 12.5 * 450.75
    });

    it('should prevent removing all items when required', () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useLineItemManagement({ minItems: 1, onError }));

      act(() => {
        result.current.removeLineItem(0);
      });

      expect(result.current.lineItems).toHaveLength(1);
      expect(onError).toHaveBeenCalled();
    });

    it('should support quick item duplication via add and copy', () => {
      const { result } = renderHook(() => useLineItemManagement());

      // Setup first item
      act(() => {
        result.current.updateLineItem(0, 'description', 'Product A');
        result.current.updateLineItem(0, 'quantity', 5);
        result.current.updateLineItem(0, 'unitPrice', 1000);
        result.current.updateLineItem(0, 'hsnCode', '8471');
      });

      const firstItem = result.current.lineItems[0];

      // Add new item and manually copy values (simulating copy functionality)
      act(() => {
        result.current.addLineItem();
        if (firstItem) {
          result.current.updateLineItem(1, 'description', firstItem.description);
          result.current.updateLineItem(1, 'quantity', firstItem.quantity);
          result.current.updateLineItem(1, 'unitPrice', firstItem.unitPrice);
          result.current.updateLineItem(1, 'hsnCode', firstItem.hsnCode || '');
        }
      });

      expect(result.current.lineItems).toHaveLength(2);
      expect(result.current.lineItems[1]?.description).toBe('Product A');
      expect(result.current.subtotal).toBe(10000); // 2 items * 5000 each
    });
  });
});
