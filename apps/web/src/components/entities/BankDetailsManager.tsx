'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Paper,
  Grid,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  AccountBalance as BankIcon,
} from '@mui/icons-material';

export interface BankDetailsData {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  ifscCode?: string;
  swiftCode?: string;
  iban?: string;
  branchName?: string;
  branchAddress?: string;
}

interface BankDetailsManagerProps {
  bankDetails: BankDetailsData[];
  onChange: (bankDetails: BankDetailsData[]) => void;
  disabled?: boolean;
}

export function BankDetailsManager({
  bankDetails,
  onChange,
  disabled = false,
}: BankDetailsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state for adding/editing
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAccountName, setFormAccountName] = useState('');
  const [formIfscCode, setFormIfscCode] = useState('');
  const [formSwiftCode, setFormSwiftCode] = useState('');
  const [formIban, setFormIban] = useState('');
  const [formBranchName, setFormBranchName] = useState('');
  const [formBranchAddress, setFormBranchAddress] = useState('');

  const resetForm = () => {
    setFormBankName('');
    setFormAccountNumber('');
    setFormAccountName('');
    setFormIfscCode('');
    setFormSwiftCode('');
    setFormIban('');
    setFormBranchName('');
    setFormBranchAddress('');
  };

  const loadBankDetailsToForm = (details: BankDetailsData) => {
    setFormBankName(details.bankName);
    setFormAccountNumber(details.accountNumber);
    setFormAccountName(details.accountName);
    setFormIfscCode(details.ifscCode || '');
    setFormSwiftCode(details.swiftCode || '');
    setFormIban(details.iban || '');
    setFormBranchName(details.branchName || '');
    setFormBranchAddress(details.branchAddress || '');
  };

  const isFormValid = () => {
    return formBankName.trim() && formAccountNumber.trim() && formAccountName.trim();
  };

  const handleAdd = () => {
    if (!isFormValid()) {
      return;
    }

    const newBankDetails: BankDetailsData = {
      id: `bank-${crypto.randomUUID().slice(0, 8)}`,
      bankName: formBankName.trim(),
      accountNumber: formAccountNumber.trim(),
      accountName: formAccountName.trim(),
      ifscCode: formIfscCode.trim() || undefined,
      swiftCode: formSwiftCode.trim() || undefined,
      iban: formIban.trim() || undefined,
      branchName: formBranchName.trim() || undefined,
      branchAddress: formBranchAddress.trim() || undefined,
    };

    onChange([...bankDetails, newBankDetails]);
    resetForm();
    setAdding(false);
  };

  const handleEdit = (bankId: string) => {
    if (!isFormValid()) {
      return;
    }

    const updatedBankDetails = bankDetails.map((details) => {
      if (details.id === bankId) {
        return {
          ...details,
          bankName: formBankName.trim(),
          accountNumber: formAccountNumber.trim(),
          accountName: formAccountName.trim(),
          ifscCode: formIfscCode.trim() || undefined,
          swiftCode: formSwiftCode.trim() || undefined,
          iban: formIban.trim() || undefined,
          branchName: formBranchName.trim() || undefined,
          branchAddress: formBranchAddress.trim() || undefined,
        };
      }
      return details;
    });

    onChange(updatedBankDetails);
    resetForm();
    setEditingId(null);
  };

  const handleDelete = (bankId: string) => {
    const updatedBankDetails = bankDetails.filter((d) => d.id !== bankId);
    onChange(updatedBankDetails);
  };

  const startEdit = (details: BankDetailsData) => {
    loadBankDetailsToForm(details);
    setEditingId(details.id);
    setAdding(false);
  };

  const cancelEdit = () => {
    resetForm();
    setEditingId(null);
    setAdding(false);
  };

  const startAdd = () => {
    resetForm();
    setAdding(true);
    setEditingId(null);
  };

  const renderForm = (isEdit: boolean, bankId?: string) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!isEdit && <Typography variant="subtitle2">New Bank Account</Typography>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Bank Name"
            value={formBankName}
            onChange={(e) => setFormBankName(e.target.value)}
            required
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="e.g., State Bank of India"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Account Name"
            value={formAccountName}
            onChange={(e) => setFormAccountName(e.target.value)}
            required
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="Name on the account"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Account Number"
            value={formAccountNumber}
            onChange={(e) => setFormAccountNumber(e.target.value)}
            required
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="Account number"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="IFSC Code"
            value={formIfscCode}
            onChange={(e) => setFormIfscCode(e.target.value.toUpperCase())}
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="e.g., SBIN0001234"
            inputProps={{ maxLength: 11, style: { textTransform: 'uppercase' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="SWIFT Code"
            value={formSwiftCode}
            onChange={(e) => setFormSwiftCode(e.target.value.toUpperCase())}
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="For international transfers"
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="IBAN"
            value={formIban}
            onChange={(e) => setFormIban(e.target.value.toUpperCase())}
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="For international transfers"
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Branch Name"
            value={formBranchName}
            onChange={(e) => setFormBranchName(e.target.value)}
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="Branch name"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Branch Address"
            value={formBranchAddress}
            onChange={(e) => setFormBranchAddress(e.target.value)}
            fullWidth
            size="small"
            disabled={disabled}
            placeholder="Branch address"
          />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<CloseIcon />} onClick={cancelEdit} disabled={disabled}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={isEdit ? <CheckIcon /> : <AddIcon />}
          onClick={() => (isEdit && bankId ? handleEdit(bankId) : handleAdd())}
          disabled={disabled || !isFormValid()}
        >
          {isEdit ? 'Save' : 'Add Bank Account'}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          Bank Details ({bankDetails.length})
        </Typography>
        {!adding && !editingId && (
          <Button size="small" startIcon={<AddIcon />} onClick={startAdd} disabled={disabled}>
            Add Bank Account
          </Button>
        )}
      </Box>

      {/* Existing Bank Details List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: adding ? 2 : 0 }}>
        {bankDetails.map((details) => (
          <Paper
            key={details.id}
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'background.paper',
            }}
          >
            {editingId === details.id ? (
              renderForm(true, details.id)
            ) : (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BankIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight="medium">
                      {details.bankName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit Bank Details">
                      <IconButton
                        size="small"
                        onClick={() => startEdit(details)}
                        disabled={disabled}
                        aria-label="Edit bank details"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Bank Details">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(details.id)}
                        disabled={disabled}
                        color="error"
                        aria-label="Delete bank details"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Account Name:
                    </Typography>
                    <Typography variant="body2">{details.accountName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Account Number:
                    </Typography>
                    <Typography variant="body2">{details.accountNumber}</Typography>
                  </Grid>
                  {details.ifscCode && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        IFSC Code:
                      </Typography>
                      <Typography variant="body2">{details.ifscCode}</Typography>
                    </Grid>
                  )}
                  {details.swiftCode && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        SWIFT Code:
                      </Typography>
                      <Typography variant="body2">{details.swiftCode}</Typography>
                    </Grid>
                  )}
                  {details.iban && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        IBAN:
                      </Typography>
                      <Typography variant="body2">{details.iban}</Typography>
                    </Grid>
                  )}
                  {details.branchName && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Branch:
                      </Typography>
                      <Typography variant="body2">{details.branchName}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      {/* Add Bank Details Form */}
      {adding && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          {renderForm(false)}
        </Paper>
      )}

      {bankDetails.length === 0 && !adding && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            No bank accounts added yet. Click &quot;Add Bank Account&quot; to add bank details.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
