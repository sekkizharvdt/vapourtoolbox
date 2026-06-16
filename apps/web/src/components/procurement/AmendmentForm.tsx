'use client';

/**
 * Shared PO Amendment form.
 *
 * Renders the reason + change-type sections used by BOTH the create
 * (`/procurement/amendments/new`) and edit (`/procurement/amendments/[id]/edit`)
 * flows, so there is a single source of truth for the change set, the
 * field-path mapping (see ALLOWED_AMENDMENT_FIELDS in amendment/crud.ts) and the
 * validation (rule 32 — one canonical implementation).
 *
 * In edit mode `initialChanges` is reconstructed back into form state so a saved
 * draft round-trips faithfully (rule 22).
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Alert,
  Divider,
  Grid,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import type { PurchaseOrder, PurchaseOrderChange } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import { formatDate } from '@/lib/utils/formatters';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';

type TermsField = 'paymentTerms' | 'deliveryTerms' | 'warrantyTerms' | 'penaltyClause';

const TERMS_FIELD_LABELS: Record<TermsField, string> = {
  paymentTerms: 'Payment Terms',
  deliveryTerms: 'Delivery Terms',
  warrantyTerms: 'Warranty Terms',
  penaltyClause: 'Penalty Clause',
};

const TERMS_FIELDS = Object.keys(TERMS_FIELD_LABELS) as TermsField[];

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

interface AmendmentFormProps {
  po: PurchaseOrder;
  /** Pre-fill in edit mode. */
  initialReason?: string;
  /** Pre-fill in edit mode — reconstructed back into the section state. */
  initialChanges?: PurchaseOrderChange[];
  submitting: boolean;
  submitLabel: string;
  /** Error from the parent's save call (service failures). */
  externalError?: string;
  onCancel: () => void;
  onSubmit: (reason: string, changes: PurchaseOrderChange[]) => void;
}

export function AmendmentForm({
  po,
  initialReason,
  initialChanges,
  submitting,
  submitLabel,
  externalError,
  onCancel,
  onSubmit,
}: AmendmentFormProps) {
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Which change types are included on this amendment
  const [priceChecked, setPriceChecked] = useState(false);
  const [deliveryChecked, setDeliveryChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [quantityChecked, setQuantityChecked] = useState(false);
  const [generalChecked, setGeneralChecked] = useState(false);

  // Type-specific inputs
  const [priceMode, setPriceMode] = useState<'GRAND_TOTAL' | 'BASE'>('GRAND_TOTAL');
  const [newGrandTotal, setNewGrandTotal] = useState('');
  const [newSubtotal, setNewSubtotal] = useState('');
  const [newExpectedDeliveryDate, setNewExpectedDeliveryDate] = useState('');
  const [addressChangeRequested, setAddressChangeRequested] = useState(false);
  const [newDeliveryAddress, setNewDeliveryAddress] = useState('');
  const [termsField, setTermsField] = useState<TermsField>('paymentTerms');
  const [newTermsValue, setNewTermsValue] = useState('');
  const [quantityNote, setQuantityNote] = useState('');
  const [generalNote, setGeneralNote] = useState('');

  // Seed state from the PO + any initial changes whenever the target changes
  // (rule 22 — restore every saved field on edit; rule 14b — sync on prop change).
  useEffect(() => {
    setReason(initialReason ?? '');
    setFormError(null);

    // Defaults from the PO's current values
    let pGrand = po.grandTotal ? String(po.grandTotal) : '';
    let pSubtotal = po.subtotal ? String(po.subtotal) : '';
    let pPriceMode: 'GRAND_TOTAL' | 'BASE' = 'GRAND_TOTAL';
    let pDate = timestampToDateInput(po.expectedDeliveryDate);
    let pAddrChange = false;
    let pAddr = ''; // current address is shown as reference; input starts empty
    let pTermsField: TermsField = 'paymentTerms';
    let pTermsValue = '';
    let pQtyNote = '';
    let pGenNote = '';
    const checks = {
      price: false,
      delivery: false,
      terms: false,
      quantity: false,
      general: false,
    };

    for (const c of initialChanges ?? []) {
      if (c.field === 'subtotal') {
        checks.price = true;
        pPriceMode = 'BASE';
        pSubtotal = String(c.newValue ?? '');
      } else if (c.field === 'grandTotal') {
        checks.price = true;
        pGrand = String(c.newValue ?? '');
      } else if (c.field === 'expectedDeliveryDate') {
        checks.delivery = true;
        pDate = String(c.newValue ?? '');
      } else if (c.field === 'deliveryAddress') {
        checks.delivery = true;
        pAddrChange = true;
        pAddr = String(c.newValue ?? '');
      } else if ((TERMS_FIELDS as string[]).includes(c.field)) {
        checks.terms = true;
        pTermsField = c.field as TermsField;
        pTermsValue = String(c.newValue ?? '');
      } else if (c.field === 'items[].amendmentNote') {
        if (c.fieldLabel?.startsWith('Quantity Change')) {
          checks.quantity = true;
          pQtyNote = String(c.newValue ?? '');
        } else {
          checks.general = true;
          pGenNote = String(c.newValue ?? '');
        }
      }
    }

    setPriceChecked(checks.price);
    setDeliveryChecked(checks.delivery);
    setTermsChecked(checks.terms);
    setQuantityChecked(checks.quantity);
    setGeneralChecked(checks.general);
    setPriceMode(pPriceMode);
    setNewGrandTotal(pGrand);
    setNewSubtotal(pSubtotal);
    setNewExpectedDeliveryDate(pDate);
    setAddressChangeRequested(pAddrChange);
    setNewDeliveryAddress(pAddr);
    setTermsField(pTermsField);
    setNewTermsValue(pTermsValue);
    setQuantityNote(pQtyNote);
    setGeneralNote(pGenNote);
  }, [po, initialReason, initialChanges]);

  /** Current PO value for a terms field (for the "Current value" helper). */
  const currentTermsValue = (field: TermsField): string => {
    const v = po[field];
    return typeof v === 'string' ? v : '';
  };

  /**
   * Build the structured changes[] array from the checked sections. Each entry
   * uses a real field path from ALLOWED_AMENDMENT_FIELDS so the approval step
   * applies it to the PO. Quantity/general notes use the `items[].amendmentNote`
   * sentinel which the approval step skips (documentation only).
   */
  const buildChanges = (): { changes: PurchaseOrderChange[]; error: string | null } => {
    const changes: PurchaseOrderChange[] = [];

    if (priceChecked) {
      if (priceMode === 'BASE') {
        // Amend the base price; recompute GST on it using the PO's effective
        // rate and re-derive the grand total (consistent with Phase B's pre-tax
        // model). Emit subtotal + tax + grandTotal so all stay consistent.
        const newSub = Number(newSubtotal);
        if (!Number.isFinite(newSub) || newSub <= 0) {
          return { changes: [], error: 'Price Change: enter a valid new base price' };
        }
        if (newSub === po.subtotal) {
          return { changes: [], error: 'Price Change: new base price matches the current value' };
        }
        const rate = po.subtotal > 0 ? po.totalTax / po.subtotal : 0;
        const newTax = roundToPaisa(newSub * rate);
        const usesIgst = (po.igst ?? 0) > 0;
        const newCgst = usesIgst ? 0 : roundToPaisa(newTax / 2);
        const newSgst = usesIgst ? 0 : roundToPaisa(newTax - newCgst);
        const newIgst = usesIgst ? newTax : 0;
        const newGrand = roundToPaisa(newSub + newTax);

        changes.push({
          field: 'subtotal',
          fieldLabel: 'Base Price',
          oldValue: po.subtotal,
          newValue: newSub,
          oldValueDisplay: formatCurrency(po.subtotal, po.currency),
          newValueDisplay: formatCurrency(newSub, po.currency),
          category: 'FINANCIAL',
        });
        changes.push({
          field: 'cgst',
          fieldLabel: 'CGST',
          oldValue: po.cgst,
          newValue: newCgst,
          category: 'FINANCIAL',
        });
        changes.push({
          field: 'sgst',
          fieldLabel: 'SGST',
          oldValue: po.sgst,
          newValue: newSgst,
          category: 'FINANCIAL',
        });
        changes.push({
          field: 'igst',
          fieldLabel: 'IGST',
          oldValue: po.igst,
          newValue: newIgst,
          category: 'FINANCIAL',
        });
        changes.push({
          field: 'totalTax',
          fieldLabel: 'Total Tax',
          oldValue: po.totalTax,
          newValue: newTax,
          category: 'FINANCIAL',
        });
        changes.push({
          field: 'grandTotal',
          fieldLabel: 'Grand Total',
          oldValue: po.grandTotal,
          newValue: newGrand,
          oldValueDisplay: formatCurrency(po.grandTotal, po.currency),
          newValueDisplay: formatCurrency(newGrand, po.currency),
          category: 'FINANCIAL',
        });
      } else {
        const value = Number(newGrandTotal);
        if (!Number.isFinite(value) || value <= 0) {
          return { changes: [], error: 'Price Change: enter a valid new grand total' };
        }
        if (value === po.grandTotal) {
          return { changes: [], error: 'Price Change: new grand total matches the current value' };
        }
        changes.push({
          field: 'grandTotal',
          fieldLabel: 'Grand Total',
          oldValue: po.grandTotal,
          newValue: value,
          oldValueDisplay: formatCurrency(po.grandTotal, po.currency),
          newValueDisplay: formatCurrency(value, po.currency),
          category: 'FINANCIAL',
        });
      }
    }

    if (deliveryChecked) {
      const currentDate = timestampToDateInput(po.expectedDeliveryDate);
      const dateChanged = !!newExpectedDeliveryDate && newExpectedDeliveryDate !== currentDate;
      // Address only changes when the user explicitly asked to change it (D5).
      const addressChanged =
        addressChangeRequested &&
        newDeliveryAddress.trim() !== '' &&
        newDeliveryAddress.trim() !== (po.deliveryAddress ?? '').trim();

      if (addressChangeRequested && !newDeliveryAddress.trim()) {
        return { changes: [], error: 'Delivery Change: enter the new delivery address' };
      }
      if (!dateChanged && !addressChanged) {
        return {
          changes: [],
          error:
            'Delivery Change: change the expected delivery date, or tick "change delivery address" and enter a new address',
        };
      }
      if (dateChanged) {
        changes.push({
          field: 'expectedDeliveryDate',
          fieldLabel: 'Expected Delivery Date',
          oldValue: currentDate || null,
          newValue: newExpectedDeliveryDate,
          // Render as DD-MMM-YYYY in the Changes table (raw value stays YYYY-MM-DD
          // for the actual PO update). Feedback 8ImQ5sgbK0uSZGuhRTqE.
          oldValueDisplay: currentDate ? formatDate(currentDate) : 'Not set',
          newValueDisplay: formatDate(newExpectedDeliveryDate),
          category: 'SCHEDULE',
        });
      }
      if (addressChanged) {
        changes.push({
          field: 'deliveryAddress',
          fieldLabel: 'Delivery Address',
          oldValue: po.deliveryAddress ?? '',
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

  const handleSave = () => {
    if (!reason.trim()) {
      setFormError('Reason for amendment is required');
      return;
    }
    const { changes, error } = buildChanges();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    onSubmit(reason, changes);
  };

  return (
    <Stack spacing={3}>
      {(formError || externalError) && <Alert severity="error">{formError || externalError}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Amendment Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select one or more change types to include in this amendment. Each selected type will be
          applied to the PO on approval.
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
                <FormControl size="small" sx={{ minWidth: 220, mb: 1 }}>
                  <InputLabel>Amend by</InputLabel>
                  <Select
                    value={priceMode}
                    label="Amend by"
                    onChange={(e) => setPriceMode(e.target.value as 'GRAND_TOTAL' | 'BASE')}
                  >
                    <MenuItem value="GRAND_TOTAL">Grand Total</MenuItem>
                    <MenuItem value="BASE">Base Price (recompute tax)</MenuItem>
                  </Select>
                </FormControl>
                {priceMode === 'BASE' ? (
                  <>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current base price: {formatCurrency(po.subtotal, po.currency)} (grand total{' '}
                      {formatCurrency(po.grandTotal, po.currency)})
                    </Typography>
                    <TextField
                      label="New Base Price"
                      type="number"
                      value={newSubtotal}
                      onChange={(e) => setNewSubtotal(e.target.value)}
                      fullWidth
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">{po.currency || '₹'}</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: 0.01 }}
                      helperText="GST and grand total are recomputed from this base price"
                    />
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current grand total: {formatCurrency(po.grandTotal, po.currency)}
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
                          <InputAdornment position="start">{po.currency || '₹'}</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </>
                )}
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
                  {po.expectedDeliveryDate
                    ? formatDate(timestampToDateInput(po.expectedDeliveryDate))
                    : 'Not set'}
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
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={addressChangeRequested}
                          onChange={(e) => setAddressChangeRequested(e.target.checked)}
                        />
                      }
                      label="Change delivery address?"
                    />
                    {addressChangeRequested && (
                      <>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-line', mb: 1 }}
                        >
                          Current address: {po.deliveryAddress || 'Not set'}
                        </Typography>
                        <TextField
                          label="New Delivery Address"
                          value={newDeliveryAddress}
                          onChange={(e) => setNewDeliveryAddress(e.target.value)}
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          placeholder="Enter the new delivery address"
                        />
                      </>
                    )}
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
                        {TERMS_FIELDS.map((k) => (
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
                  Line-item quantity editing is coming soon. For now, describe the quantity change
                  here and it will be captured as an amendment note.
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

      <Alert severity="info">
        After saving the amendment, you can review it and submit it for approval. Price, delivery
        and terms changes are applied to the PO on approval. Quantity-change notes and general notes
        are captured for audit without modifying PO fields.
      </Alert>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : submitLabel}
        </Button>
      </Stack>
    </Stack>
  );
}
