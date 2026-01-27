'use client';

/**
 * Payment Schedule Editor
 *
 * Editable table for defining payment milestones with percentage-based payments.
 * Validates that total percentages sum to 100%.
 */

import { useState, useCallback } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import type { PaymentMilestone } from '@vapour/types';
import { createEmptyMilestone, validatePaymentSchedule } from '@/lib/procurement/commercialTerms';

interface PaymentScheduleEditorProps {
  milestones: PaymentMilestone[];
  onChange: (milestones: PaymentMilestone[]) => void;
  disabled?: boolean;
}

export function PaymentScheduleEditor({
  milestones,
  onChange,
  disabled = false,
}: PaymentScheduleEditorProps) {
  const [validationResult, setValidationResult] = useState(() =>
    validatePaymentSchedule(milestones)
  );

  const handleMilestoneChange = useCallback(
    (index: number, field: keyof PaymentMilestone, value: string | number) => {
      const updated = milestones.map((m, i): PaymentMilestone => {
        if (i !== index) return m;
        const updatedMilestone: PaymentMilestone = {
          id: m.id,
          serialNumber: field === 'serialNumber' ? Number(value) : m.serialNumber,
          paymentType: field === 'paymentType' ? String(value) : m.paymentType,
          percentage: field === 'percentage' ? Number(value) : m.percentage,
          deliverables: field === 'deliverables' ? String(value) : m.deliverables,
        };
        return updatedMilestone;
      });

      // Validate
      const result = validatePaymentSchedule(updated);
      setValidationResult(result);

      onChange(updated);
    },
    [milestones, onChange]
  );

  const handleAddMilestone = useCallback(() => {
    const maxSerial = Math.max(0, ...milestones.map((m) => m.serialNumber));
    const newMilestone = createEmptyMilestone(maxSerial + 1);
    const updated = [...milestones, newMilestone];

    const result = validatePaymentSchedule(updated);
    setValidationResult(result);

    onChange(updated);
  }, [milestones, onChange]);

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

      const result = validatePaymentSchedule(updated);
      setValidationResult(result);

      onChange(updated);
    },
    [milestones, onChange]
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
    </Box>
  );
}

export default PaymentScheduleEditor;
