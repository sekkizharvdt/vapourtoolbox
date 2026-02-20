'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Paper,
  Chip,
} from '@mui/material';
import {
  Flight,
  Hotel,
  Restaurant,
  LocalTaxi,
  Receipt,
  AutoAwesome as ParseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { TravelExpenseCategory } from '@vapour/types';
import { getExpenseCategoryOptions } from '@/lib/hr';
import {
  ReceiptUploader,
  ReceiptParsingUploader,
  type ReceiptAttachment,
  type ParsedExpenseData,
} from '@/components/hr/travelExpenses';

const CATEGORY_ICONS: Record<TravelExpenseCategory, React.ReactElement> = {
  TRAVEL: <Flight fontSize="small" />,
  ACCOMMODATION: <Hotel fontSize="small" />,
  LOCAL_CONVEYANCE: <LocalTaxi fontSize="small" />,
  FOOD: <Restaurant fontSize="small" />,
  OTHER: <Receipt fontSize="small" />,
};

export interface ManualExpenseInput {
  category: TravelExpenseCategory;
  description: string;
  expenseDate: Date;
  amount: number;
  vendorName?: string;
  fromLocation?: string;
  toLocation?: string;
}

interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  reportId: string;
  onAddManualItem: (input: ManualExpenseInput, receipt: ReceiptAttachment | null) => Promise<void>;
  onAddParsedExpense: (data: ParsedExpenseData) => Promise<void>;
  tripStartDate?: Date;
  tripEndDate?: Date;
  isSubmitting: boolean;
  storagePath: string;
}

const INITIAL_FORM = {
  category: 'OTHER' as TravelExpenseCategory,
  description: '',
  expenseDate: new Date(),
  amount: '',
  vendorName: '',
  fromLocation: '',
  toLocation: '',
};

export function AddExpenseDialog({
  open,
  onClose,
  reportId,
  onAddManualItem,
  onAddParsedExpense,
  tripStartDate,
  tripEndDate,
  isSubmitting,
  storagePath,
}: AddExpenseDialogProps) {
  const [mode, setMode] = useState<'select' | 'receipt' | 'manual'>('select');
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);

  const categoryOptions = getExpenseCategoryOptions();
  const showLocationFields = formData.category === 'TRAVEL';

  const handleClose = () => {
    setMode('select');
    setFormData(INITIAL_FORM);
    setReceipt(null);
    onClose();
  };

  const handleAddItem = async () => {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) return;

    await onAddManualItem(
      {
        category: formData.category,
        description: formData.description.trim(),
        expenseDate: formData.expenseDate,
        amount,
        vendorName: formData.vendorName.trim() || undefined,
        fromLocation: formData.fromLocation.trim() || undefined,
        toLocation: formData.toLocation.trim() || undefined,
      },
      receipt
    );

    handleClose();
  };

  const handleParsedExpense = async (data: ParsedExpenseData) => {
    await onAddParsedExpense(data);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === 'select' && 'Add Expense'}
        {mode === 'receipt' && 'Upload Receipt'}
        {mode === 'manual' && 'Manual Entry'}
      </DialogTitle>
      <DialogContent>
        {/* Mode selection */}
        {mode === 'select' && (
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose how to add your expense:
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                  }}
                  onClick={() => setMode('receipt')}
                >
                  <ParseIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    Upload Receipt
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Auto-extract details using OCR
                  </Typography>
                  <Chip label="Recommended" color="primary" size="small" sx={{ mt: 1 }} />
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
                  }}
                  onClick={() => setMode('manual')}
                >
                  <Receipt sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    Manual Entry
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Enter expense details manually
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Receipt upload with OCR parsing */}
        {mode === 'receipt' && (
          <Box sx={{ pt: 1 }}>
            <ReceiptParsingUploader
              reportId={reportId}
              onExpenseReady={handleParsedExpense}
              onCancel={handleClose}
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
            />
          </Box>
        )}

        {/* Manual entry form */}
        {mode === 'manual' && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                label="Category"
                fullWidth
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as TravelExpenseCategory })
                }
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {CATEGORY_ICONS[option.value]}
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                fullWidth
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Flight ticket to Mumbai"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Expense Date"
                value={formData.expenseDate}
                onChange={(date) => {
                  const newDate = date as Date | null;
                  setFormData({ ...formData, expenseDate: newDate || new Date() });
                }}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: { fullWidth: true, required: true },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Amount (INR)"
                fullWidth
                required
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Vendor Name"
                fullWidth
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="e.g., Indigo Airlines, IRCTC, Uber"
              />
            </Grid>

            {showLocationFields && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="From Location"
                    fullWidth
                    value={formData.fromLocation}
                    onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                    placeholder="e.g., Chennai"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="To Location"
                    fullWidth
                    value={formData.toLocation}
                    onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                    placeholder="e.g., Mumbai"
                  />
                </Grid>
              </>
            )}

            {/* Receipt Upload for manual entry */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" gutterBottom>
                Receipt (Optional)
              </Typography>
              <ReceiptUploader receipt={receipt} onChange={setReceipt} storagePath={storagePath} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      {/* Only show actions for select and manual modes */}
      {(mode === 'select' || mode === 'manual') && (
        <DialogActions>
          {mode === 'manual' && <Button onClick={() => setMode('select')}>Back</Button>}
          <Button onClick={handleClose}>Cancel</Button>
          {mode === 'manual' && (
            <Button
              variant="contained"
              onClick={handleAddItem}
              disabled={
                !formData.description.trim() ||
                !formData.amount ||
                parseFloat(formData.amount) <= 0 ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
