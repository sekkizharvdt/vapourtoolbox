'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { TDSChallan, TDSSection } from '@/lib/accounting/tdsReportGenerator';
import { TDS_SECTIONS } from '@/lib/accounting/tdsReportGenerator';

interface TDSChallanTrackingProps {
  challans: TDSChallan[];
  onAddChallan: (challan: TDSChallan) => Promise<void>;
  onUpdateChallan: (index: number, challan: TDSChallan) => Promise<void>;
  onDeleteChallan: (index: number) => Promise<void>;
}

export function TDSChallanTracking({
  challans,
  onAddChallan,
  onUpdateChallan,
  onDeleteChallan,
}: TDSChallanTrackingProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<TDSChallan>>({
    bsrCode: '',
    challanSerialNumber: '',
    depositDate: new Date(),
    amount: 0,
    tdsSection: '194J',
    assessmentYear: '',
    quarter: 1,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenDialog = (challan?: TDSChallan, index?: number) => {
    if (challan && index !== undefined) {
      setFormData(challan);
      setEditIndex(index);
    } else {
      // Set default values for new challan
      const today = new Date();
      const currentFY = getCurrentFinancialYear();
      const currentAY = getAssessmentYearFromFY(currentFY);
      const currentQuarter = getQuarterFromDate(today);

      setFormData({
        bsrCode: '',
        challanSerialNumber: '',
        depositDate: today,
        amount: 0,
        tdsSection: '194J',
        assessmentYear: currentAY,
        quarter: currentQuarter,
      });
      setEditIndex(null);
    }
    setError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({
      bsrCode: '',
      challanSerialNumber: '',
      depositDate: new Date(),
      amount: 0,
      tdsSection: '194J',
      assessmentYear: '',
      quarter: 1,
    });
    setEditIndex(null);
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.bsrCode || formData.bsrCode.length !== 7) {
      setError('BSR Code must be 7 digits');
      return false;
    }
    if (!formData.challanSerialNumber || formData.challanSerialNumber.length === 0) {
      setError('Challan Serial Number is required');
      return false;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return false;
    }
    if (!formData.assessmentYear) {
      setError('Assessment Year is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const challan: TDSChallan = {
        bsrCode: formData.bsrCode!,
        challanSerialNumber: formData.challanSerialNumber!,
        depositDate: formData.depositDate!,
        amount: formData.amount!,
        tdsSection: formData.tdsSection!,
        assessmentYear: formData.assessmentYear!,
        quarter: formData.quarter!,
      };

      if (editIndex !== null) {
        await onUpdateChallan(editIndex, challan);
      } else {
        await onAddChallan(challan);
      }

      handleCloseDialog();
    } catch (err) {
      console.error('[TDSChallan] Error saving challan:', err);
      setError('Failed to save challan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (index: number) => {
    if (window.confirm('Are you sure you want to delete this challan?')) {
      try {
        await onDeleteChallan(index);
      } catch (err) {
        console.error('[TDSChallan] Error deleting challan:', err);
        alert('Failed to delete challan. Please try again.');
      }
    }
  };

  // Calculate totals
  const totalAmount = challans.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">TDS Challan Tracking</Typography>
          <Typography variant="body2" color="text.secondary">
            Track TDS tax payments deposited with the government
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Challan
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Record all TDS challans (tax deposits) here. Each challan represents tax deposited with the
        Income Tax Department. These details are required for filing Form 26Q and issuing Form 16A
        certificates.
      </Alert>

      {challans.length > 0 ? (
        <>
          {/* Summary Card */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Total Challans
                </Typography>
                <Typography variant="h5">{challans.length}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="textSecondary">
                  Total TDS Deposited
                </Typography>
                <Typography variant="h5">{formatCurrency(totalAmount)}</Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Challan Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>BSR Code</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Challan Number</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Deposit Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Section</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Quarter</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Assessment Year</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Amount</strong>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {challans.map((challan, index) => (
                  <TableRow key={index}>
                    <TableCell>{challan.bsrCode}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ReceiptIcon fontSize="small" color="action" />
                        {challan.challanSerialNumber}
                      </Box>
                    </TableCell>
                    <TableCell>{challan.depositDate.toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <Chip label={challan.tdsSection} size="small" color="primary" />
                    </TableCell>
                    <TableCell>Q{challan.quarter}</TableCell>
                    <TableCell>{challan.assessmentYear}</TableCell>
                    <TableCell align="right">{formatCurrency(challan.amount)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(challan, index)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(index)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Challans Recorded
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start by adding your TDS challans to track tax deposits
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add First Challan
          </Button>
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editIndex !== null ? 'Edit Challan' : 'Add New Challan'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="BSR Code"
                value={formData.bsrCode}
                onChange={(e) => setFormData({ ...formData, bsrCode: e.target.value })}
                placeholder="7-digit BSR code"
                helperText="Bank BSR code (e.g., 0123456)"
                inputProps={{ maxLength: 7 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Challan Serial Number"
                value={formData.challanSerialNumber}
                onChange={(e) => setFormData({ ...formData, challanSerialNumber: e.target.value })}
                placeholder="Challan identification number"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Deposit Date"
                type="date"
                value={
                  formData.depositDate
                    ? new Date(formData.depositDate).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setFormData({ ...formData, depositDate: new Date(e.target.value) })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                placeholder="TDS amount deposited"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                select
                label="TDS Section"
                value={formData.tdsSection}
                onChange={(e) =>
                  setFormData({ ...formData, tdsSection: e.target.value as TDSSection })
                }
              >
                {Object.entries(TDS_SECTIONS).map(([code, description]) => (
                  <MenuItem key={code} value={code}>
                    {code} - {description}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                select
                label="Quarter"
                value={formData.quarter}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quarter: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4,
                  })
                }
              >
                <MenuItem value={1}>Q1 (Apr-Jun)</MenuItem>
                <MenuItem value={2}>Q2 (Jul-Sep)</MenuItem>
                <MenuItem value={3}>Q3 (Oct-Dec)</MenuItem>
                <MenuItem value={4}>Q4 (Jan-Mar)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Assessment Year"
                value={formData.assessmentYear}
                onChange={(e) => setFormData({ ...formData, assessmentYear: e.target.value })}
                placeholder="e.g., 2024-25"
                helperText="Format: YYYY-YY"
              />
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
            {submitting ? 'Saving...' : editIndex !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// Helper functions
function getCurrentFinancialYear(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
}

function getAssessmentYearFromFY(financialYear: string): string {
  const parts = financialYear.split('-');
  if (parts.length < 1 || !parts[0]) {
    throw new Error('Invalid financial year format');
  }
  const start = parseInt(parts[0], 10);
  return `${start + 1}-${(start + 2).toString().slice(2)}`;
}

function getQuarterFromDate(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
}
