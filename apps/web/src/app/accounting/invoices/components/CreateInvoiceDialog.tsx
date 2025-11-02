'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerInvoice, LineItem, TransactionStatus } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { calculateGST, getGSTRateSuggestions } from '@/lib/accounting/gstCalculator';
import { generateInvoiceGLEntries, type InvoiceGLInput } from '@/lib/accounting/glEntryGenerator';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  editingInvoice?: CustomerInvoice | null;
}

export function CreateInvoiceDialog({ open, onClose, editingInvoice }: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');
  const [dueDate, setDueDate] = useState<string>('');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('DRAFT');
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

  // Company state for GST calculation
  const [companyState, setCompanyState] = useState('');
  const [customerState, setCustomerState] = useState('');

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

  // Fetch customer state when entity changes
  useEffect(() => {
    async function fetchCustomerState() {
      if (!entityId) return;
      const { db } = getFirebase();
      const entityDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, entityId));
      if (entityDoc.exists()) {
        const data = entityDoc.data();
        setEntityName(data.name || '');
        setCustomerState(data.billingAddress?.state || '');
      }
    }
    fetchCustomerState();
  }, [entityId]);

  // Reset form when dialog opens/closes or editing invoice changes
  useEffect(() => {
    if (open) {
      if (editingInvoice) {
        // Convert Date to string for date inputs
        const dateStr =
          editingInvoice.date instanceof Date
            ? editingInvoice.date.toISOString().split('T')[0] || ''
            : typeof editingInvoice.date === 'string'
              ? editingInvoice.date
              : '';
        const dueDateStr = editingInvoice.dueDate
          ? editingInvoice.dueDate instanceof Date
            ? editingInvoice.dueDate.toISOString().split('T')[0] || ''
            : typeof editingInvoice.dueDate === 'string'
              ? editingInvoice.dueDate
              : ''
          : '';
        setDate(dateStr || new Date().toISOString().split('T')[0] || '');
        setDueDate(dueDateStr || '');
        setEntityId(editingInvoice.entityId ?? null);
        setEntityName(editingInvoice.entityName || '');
        setDescription(editingInvoice.description || '');
        setReference(editingInvoice.referenceNumber || '');
        setProjectId(editingInvoice.projectId ?? null);
        setStatus(editingInvoice.status);
        setLineItems(editingInvoice.lineItems || []);
      } else {
        setDate(new Date().toISOString().split('T')[0] || '');
        setDueDate('');
        setEntityId(null);
        setEntityName('');
        setDescription('');
        setReference('');
        setProjectId(null);
        setStatus('DRAFT');
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
  }, [open, editingInvoice]);

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
    const item = newLineItems[index];
    if (!item) return;

    newLineItems[index] = { ...item, [field]: value };

    // Recalculate amount
    if (field === 'quantity' || field === 'unitPrice') {
      const updatedItem = newLineItems[index];
      if (updatedItem) {
        updatedItem.amount = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0);
      }
    }

    setLineItems(newLineItems);
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxableAmount = subtotal;

  // Calculate GST
  const gstDetails = React.useMemo(() => {
    if (companyState && customerState && taxableAmount > 0) {
      const avgGstRate =
        lineItems.reduce((sum, item) => sum + (item.gstRate || 0), 0) / lineItems.length;
      return calculateGST({
        taxableAmount,
        gstRate: avgGstRate,
        sourceState: companyState,
        destinationState: customerState,
      });
    }
    return undefined;
  }, [companyState, customerState, taxableAmount, lineItems]);

  const totalAmount = subtotal + (gstDetails?.totalGST || 0);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!entityId) {
        setError('Please select a customer');
        setLoading(false);
        return;
      }

      if (lineItems.length === 0 || lineItems.every((item) => item.amount === 0)) {
        setError('Please add at least one line item with an amount');
        setLoading(false);
        return;
      }

      const { db } = getFirebase();

      // Convert string dates to Date objects for Firestore
      const invoiceDate = new Date(date);
      const invoiceDueDate = dueDate ? new Date(dueDate) : undefined;

      // Generate transaction number
      const transactionNumber =
        editingInvoice?.transactionNumber || (await generateTransactionNumber('CUSTOMER_INVOICE'));

      // Generate GL entries using new GL entry generator
      const glInput: InvoiceGLInput = {
        transactionId: editingInvoice?.id || '',
        transactionNumber,
        transactionDate: Timestamp.fromDate(invoiceDate),
        subtotal,
        lineItems,
        gstDetails: gstDetails as any,
        currency: 'INR',
        description: description || `Invoice for ${entityName}`,
        entityId,
        projectId: projectId || undefined,
      };

      const glResult = await generateInvoiceGLEntries(db, glInput);

      if (!glResult.success) {
        setError(`Failed to generate GL entries: ${glResult.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const invoice: Partial<CustomerInvoice> = {
        type: 'CUSTOMER_INVOICE',
        date: invoiceDate as any,
        dueDate: invoiceDueDate as any,
        entityId,
        entityName,
        description,
        referenceNumber: reference || undefined,
        projectId: projectId || undefined,
        status,
        lineItems,
        subtotal,
        gstDetails: gstDetails as any,
        totalAmount,
        amount: totalAmount,
        transactionNumber,
        entries: glResult.entries,
        glGeneratedAt: Timestamp.now(),
        createdAt: editingInvoice?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency: 'INR',
        baseAmount: totalAmount,
        attachments: [],
        invoiceDate: invoiceDate as any,
        paymentTerms: 'Net 30',
        paidAmount: 0,
        outstandingAmount: totalAmount,
        paymentStatus: 'UNPAID',
        taxAmount: gstDetails?.totalGST || 0,
      } as any;

      if (editingInvoice?.id) {
        // Update existing invoice
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingInvoice.id), invoice);
      } else {
        // Create new invoice
        await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), invoice);
      }

      onClose();
    } catch (err) {
      console.error('[CreateInvoiceDialog] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingInvoice ? 'Edit Invoice' : 'Create Invoice'}
      loading={loading}
      error={error}
      onError={setError}
      maxWidth="lg"
      actions={
        <FormDialogActions
          onCancel={onClose}
          onSubmit={handleSave}
          loading={loading}
          submitLabel={editingInvoice ? 'Update' : 'Create'}
        />
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
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
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <EntitySelector
            value={entityId}
            onChange={setEntityId}
            label="Customer"
            required
            filterByRole="CUSTOMER"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus)}
            required
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="POSTED">Posted</MenuItem>
            <MenuItem value="VOID">Void</MenuItem>
          </TextField>
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
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            helperText="PO number, job reference, etc."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            label="Project / Cost Centre"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box sx={{ mt: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Line Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addLineItem}>
                Add Item
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="30%">Description</TableCell>
                    <TableCell width="10%" align="right">
                      Qty
                    </TableCell>
                    <TableCell width="15%" align="right">
                      Unit Price
                    </TableCell>
                    <TableCell width="10%" align="right">
                      GST %
                    </TableCell>
                    <TableCell width="10%">HSN Code</TableCell>
                    <TableCell width="15%" align="right">
                      Amount
                    </TableCell>
                    <TableCell width="10%" align="right">
                      Actions
                    </TableCell>
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
                          onChange={(e) =>
                            updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          select
                          value={item.gstRate}
                          onChange={(e) =>
                            updateLineItem(index, 'gstRate', parseFloat(e.target.value))
                          }
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
                        <Typography variant="body2">{item.amount.toFixed(2)}</Typography>
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
                              <Typography variant="body2">
                                CGST ({gstDetails.cgstRate}%):
                              </Typography>
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
                              <Typography variant="body2">
                                SGST ({gstDetails.sgstRate}%):
                              </Typography>
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
      </Grid>
    </FormDialog>
  );
}
