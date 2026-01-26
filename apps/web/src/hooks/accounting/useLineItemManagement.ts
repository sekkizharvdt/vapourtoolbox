import { useState, useCallback, useMemo, useEffect } from 'react';
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
  updateLineItem: (index: number, field: keyof LineItem, value: string | number | null) => void;
  /**
   * Calculate subtotal from all line items
   */
  subtotal: number;
  /**
   * Reset line items to initial state
   */
  resetLineItems: () => void;
}

/**
 * Generate a unique ID for line items
 * Uses crypto.randomUUID when available, falls back to timestamp-based ID
 */
const generateLineItemId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const createEmptyLineItem = (gstRate = 18): LineItem => ({
  id: generateLineItemId(),
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
  const { initialLineItems, defaultGstRate = 18, minItems = 1, onError } = options;

  const getInitialLineItems = useCallback(() => {
    if (initialLineItems && initialLineItems.length > 0) {
      // Ensure all items have IDs (existing items from Firestore may not have them)
      return initialLineItems.map((item) => ({
        ...item,
        id: item.id || generateLineItemId(),
      }));
    }
    return [createEmptyLineItem(defaultGstRate)];
  }, [initialLineItems, defaultGstRate]);

  const [lineItems, setLineItems] = useState<LineItem[]>(getInitialLineItems);

  // Memoize serialized version for dependency tracking
  const serializedInitialItems = useMemo(
    () => JSON.stringify(initialLineItems),
    [initialLineItems]
  );

  // Update line items when initialLineItems changes (for editing mode)
  useEffect(() => {
    if (initialLineItems && initialLineItems.length > 0) {
      // Ensure all items have IDs
      const itemsWithIds = initialLineItems.map((item) => ({
        ...item,
        id: item.id || generateLineItemId(),
      }));
      setLineItems(itemsWithIds);
    } else {
      setLineItems([createEmptyLineItem(defaultGstRate)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedInitialItems, defaultGstRate]);

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

  const updateLineItem = useCallback(
    (index: number, field: keyof LineItem, value: string | number | null) => {
      setLineItems((prev) => {
        const newLineItems = [...prev];
        const item = newLineItems[index];
        if (!item) return prev;

        // Handle null values for optional fields like accountId
        if (value === null) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [field]: _removed, ...rest } = item;
          newLineItems[index] = rest as LineItem;
        } else {
          newLineItems[index] = { ...item, [field]: value };
        }

        // Recalculate amount when quantity or unitPrice changes
        if (field === 'quantity' || field === 'unitPrice') {
          const updatedItem = newLineItems[index];
          if (updatedItem) {
            updatedItem.amount = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0);
          }
        }

        return newLineItems;
      });
    },
    []
  );

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
