'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { getFirebase } from '@/lib/firebase';
import { addBatchReceipt } from '@/lib/accounting/paymentBatchService';
import type { BatchReceiptSourceType, Project, BusinessEntity } from '@vapour/types';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { EntitySelector } from '@/components/common/forms/EntitySelector';

interface AddReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  onAdded: () => void;
}

export default function AddReceiptDialog({
  open,
  onClose,
  batchId,
  onAdded,
}: AddReceiptDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sourceType, setSourceType] = useState<BatchReceiptSourceType>('OTHER_RECEIPT');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [receiptDate, setReceiptDate] = useState<Date | null>(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);

  const resetForm = () => {
    setSourceType('OTHER_RECEIPT');
    setDescription('');
    setAmount('');
    setCurrency('INR');
    setReceiptDate(new Date());
    setSelectedProject(null);
    setSelectedEntity(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!receiptDate) {
      setError('Please select a receipt date');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      await addBatchReceipt(db, batchId, {
        sourceType,
        description: description.trim(),
        amount: parseFloat(amount),
        currency,
        receiptDate: receiptDate,
        projectId: selectedProject?.id,
        projectName: selectedProject?.name,
        entityId: selectedEntity?.id,
        entityName: selectedEntity?.name,
      });
      onAdded();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add receipt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Receipt</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth>
            <InputLabel>Receipt Type</InputLabel>
            <Select
              value={sourceType}
              label="Receipt Type"
              onChange={(e) => setSourceType(e.target.value as BatchReceiptSourceType)}
            >
              <MenuItem value="CUSTOMER_PAYMENT">Customer Payment</MenuItem>
              <MenuItem value="OTHER_RECEIPT">Other Receipt</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Desolenator USD 13,922 x 89.62"
            helperText="Describe the receipt source"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">INR</InputAdornment>,
              }}
            />
            <FormControl sx={{ minWidth: 100 }}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={currency}
                label="Currency"
                onChange={(e) => setCurrency(e.target.value)}
              >
                <MenuItem value="INR">INR</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <DatePicker
            label="Receipt Date"
            value={receiptDate}
            onChange={setReceiptDate}
            slotProps={{
              textField: { fullWidth: true },
            }}
          />

          <ProjectSelector
            value={selectedProject?.id || null}
            onChange={(projectId, projectName) => {
              if (projectId && projectName) {
                setSelectedProject({ id: projectId, name: projectName } as Project);
              } else {
                setSelectedProject(null);
              }
            }}
            label="Project (Optional)"
            helperText="Link this receipt to a project for interproject loan tracking"
          />

          {sourceType === 'CUSTOMER_PAYMENT' && (
            <EntitySelector
              value={selectedEntity?.id || null}
              onChange={() => {}}
              onEntitySelect={(entity: BusinessEntity | null) => setSelectedEntity(entity)}
              label="Customer"
              filterByRole="CUSTOMER"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !description.trim() || !amount}
        >
          {saving ? 'Adding...' : 'Add Receipt'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
