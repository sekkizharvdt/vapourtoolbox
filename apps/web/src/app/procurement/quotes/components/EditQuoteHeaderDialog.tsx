'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Alert,
} from '@mui/material';
import type { VendorQuote, CurrencyCode } from '@vapour/types';

/**
 * Edit dialog for the quote header. Covers the fields a procurement user
 * is realistically going to fix after the fact: vendor's own reference,
 * dates, currency, terms, remarks, discount. Source-type / RFQ-link /
 * vendor-id are intentionally NOT editable here — those change the
 * meaning of the document and are managed by support flows elsewhere.
 *
 * State is reset every time the dialog opens (rule 14b — useEffect on
 * open + offer), so reopening for a different quote shows the right data.
 */

export interface EditQuoteHeaderInput {
  vendorName: string;
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;
  validityDate?: Date;
  currency: CurrencyCode;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  remarks?: string;
  discount?: number;
}

interface EditQuoteHeaderDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (updates: EditQuoteHeaderInput) => Promise<void>;
  offer: VendorQuote | null;
  saving: boolean;
}

function tsToInputDate(ts: unknown): string {
  if (!ts) return '';
  let d: Date | null = null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    d = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    d = ts;
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DD for <input type="date">
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EditQuoteHeaderDialog({
  open,
  onClose,
  onSave,
  offer,
  saving,
}: EditQuoteHeaderDialogProps) {
  const [vendorName, setVendorName] = useState('');
  const [vendorOfferNumber, setVendorOfferNumber] = useState('');
  const [vendorOfferDate, setVendorOfferDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [remarks, setRemarks] = useState('');
  const [discount, setDiscount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !offer) return;
    setVendorName(offer.vendorName ?? '');
    setVendorOfferNumber(offer.vendorOfferNumber ?? '');
    setVendorOfferDate(tsToInputDate(offer.vendorOfferDate));
    setValidityDate(tsToInputDate(offer.validityDate));
    setCurrency((offer.currency ?? 'INR') as CurrencyCode);
    setPaymentTerms(offer.paymentTerms ?? '');
    setDeliveryTerms(offer.deliveryTerms ?? '');
    setWarrantyTerms(offer.warrantyTerms ?? '');
    setRemarks(offer.remarks ?? '');
    setDiscount(offer.discount != null ? String(offer.discount) : '');
    setError(null);
  }, [open, offer]);

  if (!offer) return null;

  const handleSave = async () => {
    if (!(vendorName ?? '').trim()) {
      setError('Vendor name is required.');
      return;
    }
    const discountNum = discount.trim() ? Number(discount) : undefined;
    if (discount.trim() && (!Number.isFinite(discountNum) || (discountNum ?? 0) < 0)) {
      setError('Discount must be a non-negative number.');
      return;
    }

    const updates: EditQuoteHeaderInput = {
      vendorName: vendorName.trim(),
      vendorOfferNumber: vendorOfferNumber.trim() || undefined,
      vendorOfferDate: vendorOfferDate ? new Date(vendorOfferDate) : undefined,
      validityDate: validityDate ? new Date(validityDate) : undefined,
      currency,
      paymentTerms: paymentTerms.trim() || undefined,
      deliveryTerms: deliveryTerms.trim() || undefined,
      warrantyTerms: warrantyTerms.trim() || undefined,
      remarks: remarks.trim() || undefined,
      discount: discountNum,
    };
    try {
      await onSave(updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Quote Details</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              required
              label="Vendor Name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Vendor's Quote Number"
              value={vendorOfferNumber}
              onChange={(e) => setVendorOfferNumber(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="date"
              label="Quote Date"
              value={vendorOfferDate}
              onChange={(e) => setVendorOfferDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="date"
              label="Valid Until"
              value={validityDate}
              onChange={(e) => setValidityDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              <MenuItem value="INR">INR (₹)</MenuItem>
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
              <MenuItem value="GBP">GBP (£)</MenuItem>
              <MenuItem value="SGD">SGD ($)</MenuItem>
              <MenuItem value="AED">AED</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Payment Terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Delivery Terms"
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Warranty Terms"
              value={warrantyTerms}
              onChange={(e) => setWarrantyTerms(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              type="number"
              label="Discount (in quote currency)"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              helperText="Absolute amount, applied before tax"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
