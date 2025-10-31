'use client';

import { useState, useEffect } from 'react';
import {
  TextField,
  Grid,
  MenuItem,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  Stack,
  Button,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill, LineItem } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { calculateGST, getGSTRateSuggestions } from '@/lib/accounting/gstCalculator';
import { calculateTDS, getCommonTDSSections, type TDSSection } from '@/lib/accounting/tdsCalculator';

interface CreateBillDialogProps {
  open: boolean;
  onClose: () => void;
  editingBill?: VendorBill | null;
}

export function CreateBillDialog({
  open,
  onClose,
  editingBill,
}: CreateBillDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'APPROVED' | 'PAID' | 'OVERDUE'>('DRAFT');
  const [tdsDeducted, setTdsDeducted] = useState(false);
  const [tdsSection, setTdsSection] = useState<TDSSection>('194C');
  const [vendorPAN, setVendorPAN] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      gstRate: 18,
      amount: 0,
      hsnCode: '',
    },
  ]);

  // Company and vendor states for GST calculation
  const [companyState, setCompanyState] = useState('');
  const [vendorState, setVendorState] = useState('');

  // Fetch company state
  useEffect(() => {
    async function fetchCompanyState() {
      const { db } = getFirebase();
      const companyDoc = await getDoc(doc(db, COLLECTIONS.COMPANY, 'settings'));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setCompanyState(data.address?.state || '');
      }
    }
    fetchCompanyState();
  }, []);

  // Fetch vendor state and PAN when entity changes
  useEffect(() => {
    async function fetchVendorDetails() {
      if (!entityId) return;
      const { db } = getFirebase();
      const entityDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, entityId));
      if (entityDoc.exists()) {
        const data = entityDoc.data();
        setEntityName(data.name || '');
        setVendorState(data.billingAddress?.state || '');
        setVendorPAN(data.taxInfo?.panNumber || '');
      }
    }
    fetchVendorDetails();
  }, [entityId]);

  // Reset form when dialog opens/closes or editing bill changes
  useEffect(() => {
    if (open) {
      if (editingBill) {
        setDate(editingBill.date);
        setDueDate(editingBill.dueDate || '');
        setEntityId(editingBill.entityId || null);
        setEntityName(editingBill.entityName || '');
        setDescription(editingBill.description || '');
        setReference(editingBill.reference || '');
        setProjectId(editingBill.projectId || null);
        setStatus(editingBill.status);
        setTdsDeducted(editingBill.tdsDeducted || false);
        setTdsSection(editingBill.tdsDetails?.section || '194C');
        setVendorPAN(editingBill.tdsDetails?.panNumber || '');
        setLineItems(editingBill.lineItems || []);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setEntityId(null);
        setEntityName('');
        setDescription('');
        setReference('');
        setProjectId(null);
        setStatus('DRAFT');
        setTdsDeducted(false);
        setTdsSection('194C');
        setVendorPAN('');
        setLineItems([
          {
            description: '',
            quantity: 1,
            unitPrice: 0,
            gstRate: 18,
            amount: 0,
            hsnCode: '',
          },
        ]);
      }
      setError('');
    }
  }, [open, editingBill]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        gstRate: 18,
        amount: 0,
        hsnCode: '',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      setError('At least one line item is required');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    // Recalculate amount
    if (field === 'quantity' || field === 'unitPrice') {
      const item = newLineItems[index];
      item.amount = item.quantity * item.unitPrice;
    }

    setLineItems(newLineItems);
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxableAmount = subtotal;

  // Calculate GST
  let gstDetails;
  if (companyState && vendorState && taxableAmount > 0) {
    const avgGstRate = lineItems.reduce((sum, item) => sum + (item.gstRate || 0), 0) / lineItems.length;
    gstDetails = calculateGST({
      taxableAmount,
      gstRate: avgGstRate,
      sourceState: vendorState,
      destinationState: companyState,
    });
  }

  const gstAmount = gstDetails?.totalGST || 0;
  const amountBeforeTDS = subtotal + gstAmount;

  // Calculate TDS
  let tdsDetails;
  let tdsAmount = 0;
  if (tdsDeducted && amountBeforeTDS > 0) {
    tdsDetails = calculateTDS({
      amount: amountBeforeTDS,
      section: tdsSection,
      panNumber: vendorPAN,
    });
    tdsAmount = tdsDetails.tdsAmount;
  }

  const totalAmount = amountBeforeTDS - tdsAmount;

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!entityId) {
        setError('Please select a vendor');
        setLoading(false);
        return;
      }

      if (lineItems.length === 0 || lineItems.every(item => item.amount === 0)) {
        setError('Please add at least one line item with an amount');
        setLoading(false);
        return;
      }

      const { db } = getFirebase();

      const bill: Partial<VendorBill> = {
        type: 'VENDOR_BILL',
        date,
        dueDate: dueDate || null,
        entityId,
        entityName,
        description,
        reference,
        projectId,
        status,
        lineItems,
        subtotal,
        gstDetails,
        tdsDeducted,
        tdsDetails,
        tdsAmount,
        totalAmount,
        amount: totalAmount,
        transactionNumber: editingBill?.transactionNumber || await generateTransactionNumber('VENDOR_BILL'),
        entries: [], // Ledger entries will be generated when posted
        createdAt: editingBill?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (editingBill?.id) {
        // Update existing bill
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingBill.id), bill);
      } else {
        // Create new bill
        await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), bill);
      }

      onClose();
    } catch (err) {
      console.error('[CreateBillDialog] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingBill ? 'Edit Bill' : 'Create Bill'}
      loading={loading}
      error={error}
      onError={setError}
      maxWidth="lg"
      actions={
        <FormDialogActions
          onCancel={onClose}
          onSubmit={handleSave}
          loading={loading}
          submitLabel={editingBill ? 'Update' : 'Create'}
        />
      }
    >
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntitySelector
            value={entityId}
            onChange={setEntityId}
            label="Vendor"
            required
            filterByRole="VENDOR"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'APPROVED' | 'PAID' | 'OVERDUE')}
            required
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="OVERDUE">Overdue</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Reference / Invoice Number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            helperText="Vendor's invoice number"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            label="Project / Cost Centre"
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Line Items</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addLineItem}
              >
                Add Item
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="30%">Description</TableCell>
                    <TableCell width="10%" align="right">Qty</TableCell>
                    <TableCell width="15%" align="right">Unit Price</TableCell>
                    <TableCell width="10%" align="right">GST %</TableCell>
                    <TableCell width="10%">HSN Code</TableCell>
                    <TableCell width="15%" align="right">Amount</TableCell>
                    <TableCell width="10%" align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          select
                          value={item.gstRate}
                          onChange={(e) => updateLineItem(index, 'gstRate', parseFloat(e.target.value))}
                        >
                          {getGSTRateSuggestions().map((rate) => (
                            <MenuItem key={rate} value={rate}>
                              {rate}%
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.hsnCode}
                          onChange={(e) => updateLineItem(index, 'hsnCode', e.target.value)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {item.amount.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length <= 1}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="subtitle2">Subtotal:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        {subtotal.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {gstDetails && (
                    <>
                      {gstDetails.gstType === 'CGST_SGST' && (
                        <>
                          <TableRow>
                            <TableCell colSpan={5} align="right">
                              <Typography variant="body2">CGST ({gstDetails.cgstRate}%):</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {gstDetails.cgstAmount?.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={5} align="right">
                              <Typography variant="body2">SGST ({gstDetails.sgstRate}%):</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {gstDetails.sgstAmount?.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      )}
                      {gstDetails.gstType === 'IGST' && (
                        <TableRow>
                          <TableCell colSpan={5} align="right">
                            <Typography variant="body2">IGST ({gstDetails.igstRate}%):</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {gstDetails.igstAmount?.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </>
                  )}
                  {tdsDeducted && tdsDetails && (
                    <TableRow>
                      <TableCell colSpan={5} align="right">
                        <Typography variant="body2" color="error">
                          TDS Deducted ({tdsDetails.tdsRate}%):
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error">
                          -{tdsAmount.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="h6">Total Amount:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" fontWeight="bold">
                        {totalAmount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={tdsDeducted}
                  onChange={(e) => setTdsDeducted(e.target.checked)}
                />
              }
              label="TDS Deducted"
            />
            {tdsDeducted && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="TDS Section"
                    select
                    value={tdsSection}
                    onChange={(e) => setTdsSection(e.target.value as TDSSection)}
                    required
                  >
                    {getCommonTDSSections().map((section) => (
                      <MenuItem key={section} value={section}>
                        Section {section}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Vendor PAN"
                    value={vendorPAN}
                    onChange={(e) => setVendorPAN(e.target.value.toUpperCase())}
                    helperText="Required for correct TDS calculation"
                  />
                </Grid>
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </FormDialog>
  );
}
