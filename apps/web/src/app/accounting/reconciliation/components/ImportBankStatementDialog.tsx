'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  LinearProgress,
  TextField,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  parseBankStatement,
  convertToBankTransactions,
  detectBankFormat,
  validateImportConfig,
  BANK_PRESETS,
  type ImportConfig,
  type ParseResult,
} from '@/lib/accounting/bankStatementParser';
import { createBankStatement, addBankTransactions } from '@/lib/accounting/bankReconciliation';
import { Timestamp } from 'firebase/firestore';

interface ImportBankStatementDialogProps {
  open: boolean;
  onClose: () => void;
  accountId?: string;
  accountName?: string;
}

const steps = ['Upload File', 'Configure Mapping', 'Preview & Validate', 'Import'];

export function ImportBankStatementDialog({
  open,
  onClose,
  accountId: initialAccountId,
  accountName: initialAccountName,
}: ImportBankStatementDialogProps) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [config, setConfig] = useState<ImportConfig>(BANK_PRESETS.HDFC!);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Statement metadata
  const [accountId, setAccountId] = useState(initialAccountId || '');
  const [accountName, setAccountName] = useState(initialAccountName || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0] || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      // Try to detect bank format
      const detected = detectBankFormat(text);
      if (detected) {
        setSelectedBank(detected);
        setConfig(BANK_PRESETS[detected]!);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(uploadedFile);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.endsWith('.csv')) {
      setError('Only CSV files are supported');
      return;
    }

    setFile(droppedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      const detected = detectBankFormat(text);
      if (detected) {
        setSelectedBank(detected);
        setConfig(BANK_PRESETS[detected]!);
      }
    };
    reader.readAsText(droppedFile);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleBankChange = (bank: string) => {
    setSelectedBank(bank);
    setConfig(BANK_PRESETS[bank]!);
  };

  const handleParse = () => {
    if (!csvText) {
      setError('No file uploaded');
      return;
    }

    // Validate config
    const validation = validateImportConfig(config);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    // Parse
    const result = parseBankStatement(csvText, config);
    setParseResult(result);

    if (result.success || result.validRows > 0) {
      // Auto-fill dates if not set
      if (!startDate && result.rows.length > 0) {
        const firstValidRow = result.rows.find((r) => r.transactionDate);
        if (firstValidRow?.transactionDate) {
          setStartDate(firstValidRow.transactionDate.toISOString().split('T')[0]!);
        }
      }
      if (!endDate && result.rows.length > 0) {
        const lastValidRow = [...result.rows].reverse().find((r) => r.transactionDate);
        if (lastValidRow?.transactionDate) {
          setEndDate(lastValidRow.transactionDate.toISOString().split('T')[0]!);
        }
      }

      // Auto-fill balances if available
      if (!openingBalance && result.rows.length > 0) {
        const firstRow = result.rows[0];
        if (firstRow?.balance) {
          setOpeningBalance(firstRow.balance.toString());
        }
      }
      if (!closingBalance && result.rows.length > 0) {
        const lastRow = result.rows[result.rows.length - 1];
        if (lastRow?.balance) {
          setClosingBalance(lastRow.balance.toString());
        }
      }

      setActiveStep(2);
    } else {
      setError('Failed to parse file. Please check the format.');
    }
  };

  const handleImport = async () => {
    if (!parseResult || !user) {
      setError('Cannot import: missing data');
      return;
    }

    if (!accountId || !accountName || !accountNumber || !bankName) {
      setError('Please fill in all statement details');
      return;
    }

    if (!startDate || !endDate || !statementDate) {
      setError('Please fill in all dates');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Create bank statement
      const statementId = await createBankStatement(
        db,
        {
          accountId,
          accountName,
          accountNumber,
          bankName,
          statementDate: Timestamp.fromDate(new Date(statementDate)),
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: Timestamp.fromDate(new Date(endDate)),
          openingBalance: parseFloat(openingBalance) || 0,
          closingBalance: parseFloat(closingBalance) || 0,
          totalDebits: parseResult.rows.reduce((sum, r) => sum + r.debitAmount, 0),
          totalCredits: parseResult.rows.reduce((sum, r) => sum + r.creditAmount, 0),
        },
        user.uid
      );

      // Convert and add transactions
      const transactions = convertToBankTransactions(parseResult.rows, statementId, accountId);
      await addBankTransactions(db, statementId, transactions);

      setActiveStep(3);
    } catch (err) {
      console.error('[ImportBankStatement] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import statement');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setFile(null);
    setCsvText('');
    setParseResult(null);
    setError('');
    onClose();
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!file || !csvText) {
        setError('Please upload a file first');
        return;
      }
      setActiveStep(1);
    } else if (activeStep === 1) {
      handleParse();
    } else if (activeStep === 2) {
      handleImport();
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import Bank Statement</DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Step 0: Upload File */}
        {activeStep === 0 && (
          <Box>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: 'action.hover',
                cursor: 'pointer',
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                type="file"
                id="file-upload"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drop CSV file here or click to browse
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: CSV
              </Typography>
              {file && (
                <Chip label={file.name} color="primary" icon={<CheckIcon />} sx={{ mt: 2 }} />
              )}
            </Box>

            {file && (
              <Alert severity="info" sx={{ mt: 2 }}>
                File loaded: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </Alert>
            )}
          </Box>
        )}

        {/* Step 1: Configure Mapping */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Bank Format
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Bank</InputLabel>
              <Select value={selectedBank} onChange={(e) => handleBankChange(e.target.value)}>
                {Object.keys(BANK_PRESETS).map((bank) => (
                  <MenuItem key={bank} value={bank}>
                    {bank}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selected format: {selectedBank}. The column mapping will be configured automatically.
              If your bank format is not listed, select GENERIC and contact support for custom
              mapping.
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Account ID"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  helperText="Chart of Accounts bank account ID"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Account Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 2: Preview & Validate */}
        {activeStep === 2 && parseResult && (
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Statement Date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Period Start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Period End"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Opening Balance"
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Closing Balance"
                  type="number"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  required
                />
              </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Import Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Chip
                    label={`Total: ${parseResult.totalRows}`}
                    color="default"
                    sx={{ width: '100%' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Chip
                    label={`Valid: ${parseResult.validRows}`}
                    color="success"
                    icon={<CheckIcon />}
                    sx={{ width: '100%' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Chip
                    label={`Invalid: ${parseResult.invalidRows}`}
                    color="error"
                    icon={<ErrorIcon />}
                    sx={{ width: '100%' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Chip
                    label={`Warnings: ${parseResult.warnings.length}`}
                    color="warning"
                    icon={<WarningIcon />}
                    sx={{ width: '100%' }}
                  />
                </Grid>
              </Grid>
            </Box>

            {parseResult.errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Errors:
                </Typography>
                {parseResult.errors.slice(0, 5).map((err, i) => (
                  <Typography key={i} variant="body2">
                    • {err}
                  </Typography>
                ))}
                {parseResult.errors.length > 5 && (
                  <Typography variant="body2">
                    ... and {parseResult.errors.length - 5} more
                  </Typography>
                )}
              </Alert>
            )}

            {parseResult.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Warnings:
                </Typography>
                {parseResult.warnings.slice(0, 3).map((warn, i) => (
                  <Typography key={i} variant="body2">
                    • {warn}
                  </Typography>
                ))}
                {parseResult.warnings.length > 3 && (
                  <Typography variant="body2">
                    ... and {parseResult.warnings.length - 3} more
                  </Typography>
                )}
              </Alert>
            )}

            <Typography variant="h6" gutterBottom>
              Preview (first 10 valid transactions)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parseResult.rows
                    .filter((r) => r.errors.length === 0)
                    .slice(0, 10)
                    .map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.transactionDate?.toLocaleDateString() || '-'}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell align="right">
                          {row.debitAmount > 0 ? row.debitAmount.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {row.creditAmount > 0 ? row.creditAmount.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {row.balance ? row.balance.toFixed(2) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Step 3: Success */}
        {activeStep === 3 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Import Successful!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {parseResult?.validRows} transactions imported successfully.
            </Typography>
          </Box>
        )}

        {importing && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions>
        {activeStep < 3 && (
          <>
            <Button onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={importing}>
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={importing || (activeStep === 0 && !file)}
            >
              {activeStep === 2 ? 'Import' : 'Next'}
            </Button>
          </>
        )}
        {activeStep === 3 && (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
