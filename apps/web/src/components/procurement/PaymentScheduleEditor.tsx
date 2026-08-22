'use client';

/**
 * Payment Schedule Editor
 *
 * Editable table for defining payment milestones with percentage-based payments.
 * Validates that total percentages sum to 100%.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Button,
  Typography,
  Alert,
  Paper,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import type { PaymentMilestone } from '@vapour/types';
import {
  calculateMilestoneAmounts,
  createEmptyMilestone,
  sumMilestoneAmounts,
  validatePaymentSchedule,
  type PaymentScheduleTotals,
} from '@/lib/procurement/commercialTerms';
import { formatCurrencyCode } from '@/lib/utils/formatters';

interface PaymentScheduleEditorProps {
  milestones: PaymentMilestone[];
  onChange: (milestones: PaymentMilestone[]) => void;
  disabled?: boolean;
  /**
   * PO totals the schedule is priced against. When supplied, each milestone
   * shows its rupee amount and the footer reconciles against `grandTotal` —
   * without it the user is asked to split an order into percentages with no
   * sight of what any of them is worth, and unassigned GST stays invisible.
   */
  totals?: PaymentScheduleTotals;
  /** Currency for the amount column; the PO's own currency. */
  currency?: string;
}

export function PaymentScheduleEditor({
  milestones,
  onChange,
  disabled = false,
  totals,
  currency = 'INR',
}: PaymentScheduleEditorProps) {
  const [validationResult, setValidationResult] = useState(() =>
    validatePaymentSchedule(milestones, totals)
  );

  // Priced view of the rows. Derived on render rather than stored on the
  // milestones so an in-progress edit cannot persist a half-computed amount —
  // the write paths in purchaseOrder/crud.ts do the persisting.
  const pricedMilestones = useMemo(
    () => (totals ? calculateMilestoneAmounts(milestones, totals) : milestones),
    [milestones, totals]
  );
  const amountTotal = useMemo(() => sumMilestoneAmounts(pricedMilestones), [pricedMilestones]);
  const amountsReconcile = totals ? Math.abs(amountTotal - totals.grandTotal) < 0.01 : true;

  // Re-validate when the totals move underneath the schedule (a line-item or
  // discount edit changes grandTotal without touching the milestones).
  useEffect(() => {
    setValidationResult(validatePaymentSchedule(milestones, totals));
  }, [milestones, totals]);

  const handleMilestoneChange = useCallback(
    (index: number, field: keyof PaymentMilestone, value: string | number | boolean) => {
      const updated = milestones.map((m, i): PaymentMilestone => {
        if (i !== index) return m;
        // Spread rather than rebuild field by field: an explicit reconstruction
        // silently drops every property it does not name, which is how a newly
        // added field (`amount`) would vanish the moment a user edited any row.
        switch (field) {
          case 'serialNumber':
            return { ...m, serialNumber: Number(value) };
          case 'percentage':
            return { ...m, percentage: Number(value) };
          case 'carriesTax':
            return { ...m, carriesTax: Boolean(value) };
          case 'paymentType':
            return { ...m, paymentType: String(value) };
          case 'deliverables':
            return { ...m, deliverables: String(value) };
          default:
            return m;
        }
      });

      // Validate
      const result = validatePaymentSchedule(updated, totals);
      setValidationResult(result);

      onChange(updated);
    },
    [milestones, onChange, totals]
  );

  const handleAddMilestone = useCallback(() => {
    const maxSerial = Math.max(0, ...milestones.map((m) => m.serialNumber));
    const newMilestone = createEmptyMilestone(maxSerial + 1);
    const updated = [...milestones, newMilestone];

    const result = validatePaymentSchedule(updated, totals);
    setValidationResult(result);

    onChange(updated);
  }, [milestones, onChange, totals]);

  const handleRemoveMilestone = useCallback(
    (index: number) => {
      if (milestones.length <= 1) {
        return; // Keep at least one milestone
      }

      const updated = milestones.filter((_, i) => i !== index);
      // Re-number serials
      updated.forEach((m, i) => {
        m.serialNumber = i + 1;
      });

      const result = validatePaymentSchedule(updated, totals);
      setValidationResult(result);

      onChange(updated);
    },
    [milestones, onChange, totals]
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Payment Schedule
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="body2"
            color={validationResult.isValid ? 'success.main' : 'error.main'}
            fontWeight="medium"
          >
            Total: {validationResult.totalPercentage}%
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddMilestone}
            disabled={disabled}
          >
            Add Milestone
          </Button>
        </Box>
      </Box>

      {!validationResult.isValid && validationResult.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationResult.error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell width={40} />
              <TableCell width={50}>S.No</TableCell>
              <TableCell width={180}>Payment Type</TableCell>
              <TableCell width={100} align="right">
                %
              </TableCell>
              <TableCell width={70} align="center">
                <Tooltip title="Tick the stage that the GST/tax is paid with">
                  <span>Tax</span>
                </Tooltip>
              </TableCell>
              {totals && (
                <TableCell width={130} align="right">
                  Amount
                </TableCell>
              )}
              <TableCell>Deliverables</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {milestones.map((milestone, index) => (
              <TableRow key={milestone.id} hover>
                <TableCell>
                  <DragIcon
                    fontSize="small"
                    sx={{ color: 'text.disabled', cursor: disabled ? 'default' : 'grab' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{milestone.serialNumber}</Typography>
                </TableCell>
                <TableCell>
                  <TextField
                    value={milestone.paymentType}
                    onChange={(e) => handleMilestoneChange(index, 'paymentType', e.target.value)}
                    size="small"
                    fullWidth
                    disabled={disabled}
                    placeholder="e.g., Advance"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{
                      '& .MuiInputBase-input': { py: 0.5 },
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    value={milestone.percentage}
                    onChange={(e) => handleMilestoneChange(index, 'percentage', e.target.value)}
                    size="small"
                    disabled={disabled}
                    inputProps={{ min: 0, max: 100, style: { textAlign: 'right' } }}
                    sx={{ width: 80 }}
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Checkbox
                    size="small"
                    checked={milestone.carriesTax ?? false}
                    onChange={(e) => handleMilestoneChange(index, 'carriesTax', e.target.checked)}
                    disabled={disabled}
                  />
                </TableCell>
                {totals && (
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrencyCode(pricedMilestones[index]?.amount ?? 0, currency)}
                    </Typography>
                  </TableCell>
                )}
                <TableCell>
                  <TextField
                    value={milestone.deliverables}
                    onChange={(e) => handleMilestoneChange(index, 'deliverables', e.target.value)}
                    size="small"
                    fullWidth
                    disabled={disabled}
                    placeholder="e.g., On PO confirmation"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{
                      '& .MuiInputBase-input': { py: 0.5 },
                    }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveMilestone(index)}
                    disabled={disabled || milestones.length <= 1}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {totals && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'baseline',
            gap: 2,
            mt: 1,
            px: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Milestones total
          </Typography>
          <Typography
            variant="body2"
            fontWeight="medium"
            color={amountsReconcile ? 'success.main' : 'error.main'}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrencyCode(amountTotal, currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            of {formatCurrencyCode(totals.grandTotal, currency)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default PaymentScheduleEditor;
