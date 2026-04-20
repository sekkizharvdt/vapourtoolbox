'use client';

/**
 * Purchase Order Selector Component
 *
 * Autocomplete selector for Purchase Orders, optionally filtered by vendor.
 * Shows PO number, title, and grand total. Only shows POs in actionable statuses.
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Skeleton,
  Box,
  Typography,
} from '@mui/material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseOrder } from '@vapour/types';

/** Minimal PO shape needed by the selector (avoids loading full PO items) */
interface POOption {
  id: string;
  number: string;
  title: string;
  vendorId: string;
  vendorName: string;
  grandTotal: number;
  currency: string;
  status: string;
}

interface PurchaseOrderSelectorProps {
  value: string | null;
  onChange: (poId: string | null) => void;
  /** Called with the full PO option when selected (or null on clear) */
  onPOSelect?: (po: POOption | null) => void;
  /** Filter POs to a specific vendor */
  vendorId?: string | null;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
}

/** Statuses where a PO can reasonably be linked to a vendor bill */
const LINKABLE_STATUSES = new Set([
  'APPROVED',
  'ISSUED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
]);

function PurchaseOrderSelectorComponent({
  value,
  onChange,
  onPOSelect,
  vendorId,
  label = 'Purchase Order',
  placeholder = 'Search POs...',
  required = false,
  disabled = false,
  error = false,
  size = 'small',
  helperText,
}: PurchaseOrderSelectorProps) {
  const [allPOs, setAllPOs] = useState<POOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<POOption | null>(null);

  // Subscribe to POs from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const posRef = collection(db, COLLECTIONS.PURCHASE_ORDERS);

    // Base query — ordered by creation date descending (most recent first)
    const q = query(posRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const options: POOption[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as PurchaseOrder;
        // Only include POs in linkable statuses
        if (LINKABLE_STATUSES.has(data.status)) {
          options.push({
            id: doc.id,
            number: data.number,
            title: data.title || '',
            vendorId: data.vendorId,
            vendorName: data.vendorName || '',
            grandTotal: data.grandTotal ?? 0,
            currency: data.currency || 'INR',
            status: data.status,
          });
        }
      });
      setAllPOs(options);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter by vendor client-side
  const filteredPOs = useMemo(() => {
    if (!vendorId) return allPOs;
    return allPOs.filter((po) => po.vendorId === vendorId);
  }, [allPOs, vendorId]);

  // Sync selected PO when value or options change
  useEffect(() => {
    if (value) {
      // Look in allPOs (not just filtered) so edit mode can still resolve
      const po = allPOs.find((p) => p.id === value);
      setSelectedPO(po || null);
    } else {
      setSelectedPO(null);
    }
  }, [value, allPOs]);

  const handleChange = useCallback(
    (_: unknown, newValue: POOption | null) => {
      onChange(newValue?.id || null);
      onPOSelect?.(newValue);
    },
    [onChange, onPOSelect]
  );

  const getOptionLabel = useCallback(
    (option: POOption) => `${option.number} — ${option.title}`,
    []
  );

  const isOptionEqualToValue = useCallback(
    (option: POOption, val: POOption) => option.id === val.id,
    []
  );

  if (loading && allPOs.length === 0) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Autocomplete
      value={selectedPO}
      onChange={handleChange}
      options={filteredPOs}
      getOptionLabel={getOptionLabel}
      filterOptions={(options, { inputValue }) => {
        const term = inputValue.toLowerCase();
        return options.filter(
          (o) =>
            o.number.toLowerCase().includes(term) ||
            o.title.toLowerCase().includes(term) ||
            o.vendorName.toLowerCase().includes(term)
        );
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" fontWeight={600}>
              {option.number}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.title}
              {option.grandTotal > 0 &&
                ` — ${option.currency} ${option.grandTotal.toLocaleString('en-IN')}`}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          size={size}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
      loading={loading}
      disabled={disabled}
      size={size}
      isOptionEqualToValue={isOptionEqualToValue}
      noOptionsText={vendorId ? 'No POs for this vendor' : 'No POs available'}
      slotProps={{
        popper: {
          style: { minWidth: 360 },
        },
      }}
    />
  );
}

export const PurchaseOrderSelector = memo(PurchaseOrderSelectorComponent);
