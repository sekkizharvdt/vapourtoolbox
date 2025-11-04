import { useState, useCallback, useMemo } from 'react';
import type { LineItem } from '@vapour/types';

interface UseLineItemManagementOptions {
  /**
   * Initial line items. If not provided, starts with one empty line item.
   */
  initialLineItems?: LineItem[];
  /**
   * Default GST rate for new line items
   */
  defaultGstRate?: number;
  /**
   * Minimum number of line items required
   */
  minItems?: number;
  /**
   * Callback to set error messages
   */
  onError?: (error: string) => void;
}

interface UseLineItemManagementReturn {
  /**
   * Current array of line items
   */
  lineItems: LineItem[];
  /**
   * Set line items directly
   */
  setLineItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  /**
   * Add a new empty line item
   */
  addLineItem: () => void;
  /**
   * Remove a line item at the specified index
   */
  removeLineItem: (index: number) => void;
  /**
   * Update a specific field of a line item
   */
  updateLineItem: (index: number, field: keyof LineItem, value: string | number) => void;
  /**
   * Calculate subtotal from all line items
   */
  subtotal: number;
  /**
   * Reset line items to initial state
   */
  resetLineItems: () => void;
}

const createEmptyLineItem = (gstRate = 18): LineItem => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  gstRate,
  amount: 0,
  hsnCode: '',
});

/**
 * Custom hook for managing line items in invoices and bills.
 * Handles CRUD operations and automatic amount calculations.
 */
export function useLineItemManagement(
  options: UseLineItemManagementOptions = {}
): UseLineItemManagementReturn {
  const {
    initialLineItems,
    defaultGstRate = 18,
    minItems = 1,
    onError,
  } = options;

  const getInitialLineItems = useCallback(() => {
    return initialLineItems && initialLineItems.length > 0
      ? initialLineItems
      : [createEmptyLineItem(defaultGstRate)];
  }, [initialLineItems, defaultGstRate]);

  const [lineItems, setLineItems] = useState<LineItem[]>(getInitialLineItems);

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createEmptyLineItem(defaultGstRate)]);
  }, [defaultGstRate]);

  const removeLineItem = useCallback(
    (index: number) => {
      if (lineItems.length <= minItems) {
        onError?.(`At least ${minItems} line item${minItems > 1 ? 's are' : ' is'} required`);
        return;
      }
      setLineItems((prev) => prev.filter((_, i) => i !== index));
    },
    [lineItems.length, minItems, onError]
  );

  const updateLineItem = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const newLineItems = [...prev];
      const item = newLineItems[index];
      if (!item) return prev;

      newLineItems[index] = { ...item, [field]: value };

      // Recalculate amount when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const updatedItem = newLineItems[index];
        if (updatedItem) {
          updatedItem.amount = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0);
        }
      }

      return newLineItems;
    });
  }, []);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  }, [lineItems]);

  const resetLineItems = useCallback(() => {
    setLineItems(getInitialLineItems());
  }, [getInitialLineItems]);

  return {
    lineItems,
    setLineItems,
    addLineItem,
    removeLineItem,
    updateLineItem,
    subtotal,
    resetLineItems,
  };
}
