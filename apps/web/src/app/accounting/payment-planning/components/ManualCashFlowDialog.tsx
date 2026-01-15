'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  createManualCashFlowItem,
  getCategoryLabel,
  getCategoriesByDirection,
} from '@/lib/accounting/paymentPlanningService';
import type { CashFlowDirection, ManualCashFlowCategory } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

interface ManualCashFlowDialogProps {
  open: boolean;
  direction: CashFlowDirection;
  onClose: () => void;
}

export function ManualCashFlowDialog({ open, direction, onClose }: ManualCashFlowDialogProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ManualCashFlowCategory>(
    direction === 'INFLOW' ? 'PROJECT_RECEIPT' : 'VENDOR_PAYMENT'
  );
  const [amount, setAmount] = useState<number>(0);
  const [expectedDate, setExpectedDate] = useState<Date | null>(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>('MONTHLY');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [notes, setNotes] = useState('');

  const categories = getCategoriesByDirection(direction);

  const handleClose = () => {
    // Reset form
    setName('');
    setDescription('');
    setCategory(direction === 'INFLOW' ? 'PROJECT_RECEIPT' : 'VENDOR_PAYMENT');
    setAmount(0);
    setExpectedDate(new Date());
    setIsRecurring(false);
    setRecurrenceFrequency('MONTHLY');
    setRecurrenceEndDate(null);
    setEntityId(null);
    setEntityName(undefined);
    setProjectId(null);
    setProjectName(undefined);
    setNotes('');
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!expectedDate) {
      setError('Expected date is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { db } = getFirebase();

      await createManualCashFlowItem(db, {
        name: name.trim(),
        description: description.trim() || undefined,
        direction,
        category,
        amount,
        currency: 'INR',
        expectedDate,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
        recurrenceEndDate: isRecurring ? recurrenceEndDate ?? undefined : undefined,
        entityId: entityId ?? undefined,
        entityName,
        projectId: projectId ?? undefined,
        projectName,
        status: 'PLANNED',
        createdBy: user?.uid || 'system',
        notes: notes.trim() || undefined,
      });

      handleClose();
    } catch (err) {
      console.error('[ManualCashFlowDialog] Error creating item:', err);
      setError('Failed to create item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add Expected {direction === 'INFLOW' ? 'Receipt' : 'Payment'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={direction === 'INFLOW' ? 'e.g., Expected payment from ABC Corp' : 'e.g., Office rent payment'}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ManualCashFlowCategory)}
              required
            >
              {categories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{
                startAdornment: <span style={{ marginRight: 8 }}>INR</span>,
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Expected Date"
              value={expectedDate}
              onChange={(date) => setExpectedDate(date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <EntitySelector
              value={entityId}
              onChange={setEntityId}
              onEntitySelect={(entity) => setEntityName(entity?.name)}
              label={direction === 'INFLOW' ? 'Customer (optional)' : 'Vendor (optional)'}
              filterByRole={direction === 'INFLOW' ? 'CUSTOMER' : 'VENDOR'}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ProjectSelector
              value={projectId}
              onChange={setProjectId}
              label="Project (optional)"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
              }
              label="This is a recurring item"
            />
          </Grid>

          {isRecurring && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Frequency"
                  value={recurrenceFrequency}
                  onChange={(e) => setRecurrenceFrequency(e.target.value as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY')}
                >
                  <MenuItem value="WEEKLY">Weekly</MenuItem>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="End Date (optional)"
                  value={recurrenceEndDate}
                  onChange={(date) => setRecurrenceEndDate(date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </Grid>
            </>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color={direction === 'INFLOW' ? 'success' : 'error'}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
