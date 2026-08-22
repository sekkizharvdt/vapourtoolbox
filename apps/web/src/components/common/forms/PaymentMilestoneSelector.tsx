'use client';

/**
 * Payment Milestone Selector
 *
 * Picks which milestone of a purchase order's payment schedule a bill or a
 * direct payment settles. Sits beside `PurchaseOrderSelector` — pass the PO id
 * that selector produced and this loads that PO's schedule.
 *
 * The milestone is what makes PO-wise payment tracking possible: without it a
 * bill is only attributable to the PO as a whole, so "how much of the 30%
 * advance is paid" has no answer. See `lib/procurement/poPaymentAttribution.ts`
 * for why the tag lives on the bill.
 */

import { useState, useEffect } from 'react';
import { MenuItem, TextField, Typography, Box } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { PurchaseOrder } from '@vapour/types';
import { milestoneOptions, type MilestoneOption } from '@/lib/procurement/poPaymentAttribution';
import { formatCurrencyCode } from '@/lib/utils/formatters';

const logger = createLogger({ context: 'PaymentMilestoneSelector' });

interface PaymentMilestoneSelectorProps {
  /** PO whose schedule to offer. Null clears and disables the field. */
  purchaseOrderId: string | null;
  value: string | null;
  onChange: (milestoneId: string | null) => void;
  label?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
}

export function PaymentMilestoneSelector({
  purchaseOrderId,
  value,
  onChange,
  label = 'Payment Milestone',
  disabled = false,
  size = 'small',
  helperText,
}: PaymentMilestoneSelectorProps) {
  const [options, setOptions] = useState<MilestoneOption[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  // Which PO the options in state belong to. `loading` alone is not enough to
  // gate the stale-value cleanup below: on the first render of an edit both
  // effects run in the same commit, and the cleanup reads `loading` as false
  // from that render's closure — so it would clear a perfectly valid restored
  // milestone before the fetch had even started.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the schedule whenever the PO changes. A selector callback does not
  // fire when `purchaseOrderId` is pre-populated in edit mode (rule 15), so the
  // fetch is driven by the prop rather than by a selection event.
  useEffect(() => {
    let cancelled = false;

    if (!purchaseOrderId) {
      setOptions([]);
      setLoadedFor(null);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { db } = getFirebase();
        const snap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, purchaseOrderId));
        if (cancelled) return;

        if (!snap.exists()) {
          logger.warn('PO not found for milestone selector', { purchaseOrderId });
          setOptions([]);
          setLoadedFor(purchaseOrderId);
          return;
        }
        const po = docToTyped<PurchaseOrder>(snap.id, snap.data());
        setOptions(milestoneOptions(po));
        setCurrency(po.currency || 'INR');
        setLoadedFor(purchaseOrderId);
      } catch (error) {
        // Degrade to "no milestones offered" rather than breaking the dialog:
        // the milestone is optional metadata on the bill, and the user can
        // still save without it (rule 27).
        logger.warn('Could not load payment schedule for milestone selector', {
          purchaseOrderId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setOptions([]);
          setLoadedFor(purchaseOrderId);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [purchaseOrderId]);

  // Drop a stale selection when the PO changes to one that has no such
  // milestone, so the saved id can never point at another PO's schedule. Only
  // once the options in state actually belong to the current PO.
  useEffect(() => {
    if (!value) return;
    if (loadedFor !== purchaseOrderId) return;
    if (!options.some((o) => o.id === value)) onChange(null);
  }, [options, value, loadedFor, purchaseOrderId, onChange]);

  const noSchedule =
    Boolean(purchaseOrderId) && loadedFor === purchaseOrderId && options.length === 0;

  return (
    <TextField
      select
      fullWidth
      size={size}
      label={label}
      value={options.some((o) => o.id === value) ? value : ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || !purchaseOrderId || loading || noSchedule}
      helperText={
        noSchedule
          ? 'This PO has no structured payment schedule'
          : !purchaseOrderId
            ? 'Select a purchase order first'
            : helperText
      }
    >
      <MenuItem value="">
        <em>Not milestone-specific</em>
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option.id} value={option.id}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}
            component="span"
          >
            <span>{option.label}</span>
            {option.amount !== undefined && (
              <Typography component="span" variant="body2" color="text.secondary">
                {formatCurrencyCode(option.amount, currency)}
                {option.carriesTax ? ' (incl. tax)' : ''}
              </Typography>
            )}
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
}

export default PaymentMilestoneSelector;
