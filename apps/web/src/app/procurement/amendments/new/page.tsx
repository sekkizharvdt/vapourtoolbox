'use client';

/**
 * Create PO Amendment Page
 *
 * Create an amendment for an approved Purchase Order
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Autocomplete,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Breadcrumbs,
  Link,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderChange } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { createAmendment } from '@/lib/procurement/amendment';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

type TermsField = 'paymentTerms' | 'deliveryTerms' | 'warrantyTerms' | 'penaltyClause';

const TERMS_FIELD_LABELS: Record<TermsField, string> = {
  paymentTerms: 'Payment Terms',
  deliveryTerms: 'Delivery Terms',
  warrantyTerms: 'Warranty Terms',
  penaltyClause: 'Penalty Clause',
};

/**
 * Convert a Firestore Timestamp / Date / string to a YYYY-MM-DD string for a
 * <TextField type="date">. Returns '' when the value is unset (CLAUDE.md rule 14).
 */
function timestampToDateInput(value: unknown): string {
  if (!value) return '';
  try {
    const date =
      value && typeof value === 'object' && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : value instanceof Date
          ? value
          : new Date(value as string);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0] ?? '';
  } catch {
    return '';
  }
}

export default function NewAmendmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // PO Selection
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form: reason is always required; a single amendment can carry multiple
  // typed changes (price + delivery + terms + notes).
  const [reason, setReason] = useState('');

  // Which change types the user wants to include on this amendment
  const [priceChecked, setPriceChecked] = useState(false);
  const [deliveryChecked, setDeliveryChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [quantityChecked, setQuantityChecked] = useState(false);
  const [generalChecked, setGeneralChecked] = useState(false);

  // Type-specific inputs
  const [newGrandTotal, setNewGrandTotal] = useState('');
  const [newExpectedDeliveryDate, setNewExpectedDeliveryDate] = useState('');
  const [newDeliveryAddress, setNewDeliveryAddress] = useState('');
  const [termsField, setTermsField] = useState<TermsField>('paymentTerms');
  const [newTermsValue, setNewTermsValue] = useState('');
  const [quantityNote, setQuantityNote] = useState('');
  const [generalNote, setGeneralNote] = useState('');

  // Load available POs
  useEffect(() => {
    loadAvailablePOs();
  }, []);

  // Load preselected PO
  useEffect(() => {
    if (preselectedPoId && availablePOs.length > 0) {
      const po = availablePOs.find((p) => p.id === preselectedPoId);
      if (po) {
        setSelectedPO(po);
      }
    }
  }, [preselectedPoId, availablePOs]);

  const loadAvailablePOs = async () => {
    setLoading(true);
    try {
      const pos = await listPOs({});
      // Filter to approved/issued POs that can be amended
      const eligiblePOs = pos.filter((po) =>
        ['APPROVED', 'ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewAmendmentPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback((po: PurchaseOrder | null) => {
    setSelectedPO(po);
    // Seed editable fields with the PO's current values so users see what they
    // are changing from.
    if (po) {
      setNewGrandTotal(po.grandTotal ? po.grandTotal.toString() : '');
      setNewExpectedDeliveryDate(timestampToDateInput(po.expectedDeliveryDate));
      setNewDeliveryAddress(po.deliveryAddress ?? '');
    } else {
      setNewGrandTotal('');
      setNewExpectedDeliveryDate('');
      setNewDeliveryAddress('');
    }
  }, []);

  /** Return the current PO value for a given terms field (for the "Current" helper). */
  const currentTermsValue = (field: TermsField): string => {
    if (!selectedPO) return '';
    const v = selectedPO[field];
    return typeof v === 'string' ? v : '';
  };

  /**
   * Build the structured changes[] array from the checked type sections.
   *
   * Each entry uses a real field path from ALLOWED_AMENDMENT_FIELDS in
   * amendment/crud.ts so the approval step actually applies the change to the
   * PO. Quantity and general types use the `items[].amendmentNote` sentinel
   * which the approval step skips, keeping them as documentation-only.
   */
  const buildChanges = (): { changes: PurchaseOrderChange[]; error: string | null } => {
    if (!selectedPO) return { changes: [], error: 'No PO selected' };
    const changes: PurchaseOrderChange[] = [];

    if (priceChecked) {
      const value = Number(newGrandTotal);
      if (!Number.isFinite(value) || value <= 0) {
        return { changes: [], error: 'Price Change: enter a valid new grand total' };
      }
      if (value === selectedPO.grandTotal) {
        return { changes: [], error: 'Price Change: new grand total matches the current value' };
      }
      changes.push({
        field: 'grandTotal',
        fieldLabel: 'Grand Total',
        oldValue: selectedPO.grandTotal,
        newValue: value,
        oldValueDisplay: formatCurrency(selectedPO.grandTotal, selectedPO.currency),
        newValueDisplay: formatCurrency(value, selectedPO.currency),
        category: 'FINANCIAL',
      });
    }

    if (deliveryChecked) {
      const currentDate = timestampToDateInput(selectedPO.expectedDeliveryDate);
      const dateChanged = newExpectedDeliveryDate && newExpectedDeliveryDate !== currentDate;
      const addressChanged =
        newDeliveryAddress.trim() !== '' &&
        newDeliveryAddress.trim() !== (selectedPO.deliveryAddress ?? '').trim();

      if (!dateChanged && !addressChanged) {
        return {
          changes: [],
          error:
            'Delivery Change: change either the expected delivery date or the delivery address',
        };
      }
      if (dateChanged) {
        changes.push({
          field: 'expectedDeliveryDate',
          fieldLabel: 'Expected Delivery Date',
          oldValue: currentDate || null,
          newValue: newExpectedDeliveryDate,
          oldValueDisplay: currentDate || 'Not set',
          newValueDisplay: newExpectedDeliveryDate,
          category: 'SCHEDULE',
        });
      }
      if (addressChanged) {
        changes.push({
          field: 'deliveryAddress',
          fieldLabel: 'Delivery Address',
          oldValue: selectedPO.deliveryAddress ?? '',
          newValue: newDeliveryAddress.trim(),
          category: 'SCHEDULE',
        });
      }
    }

    if (termsChecked) {
      if (!newTermsValue.trim()) {
        return {
          changes: [],
          error: `Terms Change: enter the new ${TERMS_FIELD_LABELS[termsField]}`,
        };
      }
      const currentValue = currentTermsValue(termsField);
      if (newTermsValue.trim() === currentValue.trim()) {
        return {
          changes: [],
          error: `Terms Change: new ${TERMS_FIELD_LABELS[termsField]} matches the current value`,
        };
      }
      changes.push({
        field: termsField,
        fieldLabel: TERMS_FIELD_LABELS[termsField],
        oldValue: currentValue,
        newValue: newTermsValue.trim(),
        category: 'TERMS',
      });
    }

    if (quantityChecked) {
      if (!quantityNote.trim()) {
        return {
          changes: [],
          error: 'Quantity Change: describe the quantity change (line-item editing coming soon)',
        };
      }
      // Item-level quantity edits aren't wired into the approval step yet, so
      // capture this as a note that the approval loop silently skips.
      changes.push({
        field: 'items[].amendmentNote',
        fieldLabel: `Quantity Change — ${quantityNote.slice(0, 80)}`,
        oldValue: null,
        newValue: quantityNote.trim(),
        category: 'SCOPE',
      });
    }

    if (generalChecked) {
      if (!generalNote.trim()) {
        return { changes: [], error: 'General Note: enter a note describing the amendment' };
      }
      changes.push({
        field: 'items[].amendmentNote',
        fieldLabel: `General Note — ${generalNote.slice(0, 80)}`,
        oldValue: null,
        newValue: generalNote.trim(),
        category: 'SCOPE',
      });
    }

    if (changes.length === 0) {
      return { changes: [], error: 'Select at least one change type and fill in its fields' };
    }

    return { changes, error: null };
  };

  const handleCreateAmendment = async () => {
    if (!user || !selectedPO) return;

    if (!reason.trim()) {
      setError('Reason for amendment is required');
      return;
    }

    const { changes, error: buildError } = buildChanges();
    if (buildError) {
      setError(buildError);
      return;
    }

    setCreating(true);
    setError('');

    try {
      const { db } = getFirebase();

      const amendmentId = await createAmendment(
        db,
        selectedPO.id,
        changes,
        reason,
        user.uid,
        user.displayName || 'Unknown',
        tenantId
      );

      router.push(`/procurement/amendments/${amendmentId}`);
    } catch (err) {
      console.error('[NewAmendmentPage] Error creating amendment:', err);
      setError('Failed to create amendment. Please try again.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 0 }}>
          <Link
            color="inherit"
            href="/procurement"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Procurement
          </Link>
          <Link
            color="inherit"
            href="/procurement/amendments"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement/amendments');
            }}
            sx={{ cursor: 'pointer' }}
          >
            PO Amendments
          </Link>
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/amendments')}
            sx={{ mb: 1 }}
          >
            Back to Amendments
          </Button>
          <Typography variant="h4" gutterBottom>
            Create PO Amendment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create an amendment to modify an approved purchase order
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* PO Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Purchase Order
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Autocomplete
            options={availablePOs}
            value={selectedPO}
            onChange={(_, newValue) => handlePOSelect(newValue)}
            getOptionLabel={(option) =>
              `${option.number} - ${option.vendorName} (${formatCurrency(option.grandTotal, option.currency)})`
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Purchase Order"
                placeholder="Search by PO number or vendor..."
                required
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />

          {selectedPO && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{selectedPO.vendorName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{selectedPO.projectNames?.[0] || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Total
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatCurrency(selectedPO.grandTotal, selectedPO.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        {selectedPO && (
          <>
            {/* Amendment Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Amendment Details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select one or more change types to include in this amendment. Each selected type
                will be applied to the PO on approval.
              </Typography>
              <Divider sx={{ my: 2 }} />

              <TextField
                label="Reason for Amendment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                fullWidth
                required
                multiline
                rows={2}
                placeholder="Why is this amendment needed?"
                sx={{ mb: 3 }}
              />

              <Stack spacing={2}>
                {/* Price Change */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={priceChecked}
                        onChange={(e) => setPriceChecked(e.target.checked)}
                      />
                    }
                    label={<Typography fontWeight={600}>Price Change</Typography>}
                  />
                  {priceChecked && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current grand total:{' '}
                        {formatCurrency(selectedPO.grandTotal, selectedPO.currency)}
                      </Typography>
                      <TextField
                        label="New Grand Total"
                        type="number"
                        value={newGrandTotal}
                        onChange={(e) => setNewGrandTotal(e.target.value)}
                        fullWidth
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {selectedPO.currency || '₹'}
                            </InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Box>
                  )}
                </Paper>

                {/* Delivery Change */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={deliveryChecked}
                        onChange={(e) => setDeliveryChecked(e.target.checked)}
                      />
                    }
                    label={<Typography fontWeight={600}>Delivery Change</Typography>}
                  />
                  {deliveryChecked && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current expected delivery:{' '}
                        {timestampToDateInput(selectedPO.expectedDeliveryDate) || 'Not set'}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="New Expected Delivery Date"
                            type="date"
                            value={newExpectedDeliveryDate}
                            onChange={(e) => setNewExpectedDeliveryDate(e.target.value)}
                            fullWidth
                            size="small"
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            label="New Delivery Address"
                            value={newDeliveryAddress}
                            onChange={(e) => setNewDeliveryAddress(e.target.value)}
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            placeholder="Leave as current address if only changing the date"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Paper>

                {/* Terms Change */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={termsChecked}
                        onChange={(e) => setTermsChecked(e.target.checked)}
                      />
                    }
                    label={<Typography fontWeight={600}>Terms Change</Typography>}
                  />
                  {termsChecked && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Which Term</InputLabel>
                            <Select
                              value={termsField}
                              onChange={(e) => setTermsField(e.target.value as TermsField)}
                              label="Which Term"
                            >
                              {(Object.keys(TERMS_FIELD_LABELS) as TermsField[]).map((k) => (
                                <MenuItem key={k} value={k}>
                                  {TERMS_FIELD_LABELS[k]}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Current value: {currentTermsValue(termsField) || 'Not set'}
                          </Typography>
                          <TextField
                            label={`New ${TERMS_FIELD_LABELS[termsField]}`}
                            value={newTermsValue}
                            onChange={(e) => setNewTermsValue(e.target.value)}
                            fullWidth
                            size="small"
                            multiline
                            rows={3}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Paper>

                {/* Quantity Change (note-only for now) */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={quantityChecked}
                        onChange={(e) => setQuantityChecked(e.target.checked)}
                      />
                    }
                    label={<Typography fontWeight={600}>Quantity Change</Typography>}
                  />
                  {quantityChecked && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      <Alert severity="info" sx={{ mb: 1 }}>
                        Line-item quantity editing is coming soon. For now, describe the quantity
                        change here and it will be captured as an amendment note.
                      </Alert>
                      <TextField
                        label="Quantity Change Note"
                        value={quantityNote}
                        onChange={(e) => setQuantityNote(e.target.value)}
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        placeholder="e.g. Increase Item 2 (Valves) quantity from 10 to 15"
                      />
                    </Box>
                  )}
                </Paper>

                {/* General Note */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={generalChecked}
                        onChange={(e) => setGeneralChecked(e.target.checked)}
                      />
                    }
                    label={<Typography fontWeight={600}>General Note</Typography>}
                  />
                  {generalChecked && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      <TextField
                        label="Note"
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        placeholder="Free-text amendment note (no PO fields will be modified)"
                      />
                    </Box>
                  )}
                </Paper>
              </Stack>
            </Paper>

            {/* Info */}
            <Alert severity="info">
              After creating the amendment, you can review it and submit it for approval. Price,
              delivery and terms changes are applied to the PO on approval. Quantity-change notes
              and general notes are captured for audit without modifying PO fields.
            </Alert>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => router.push('/procurement/amendments')} disabled={creating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreateAmendment}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Amendment'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
