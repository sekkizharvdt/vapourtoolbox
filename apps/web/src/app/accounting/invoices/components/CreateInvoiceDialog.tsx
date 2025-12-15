'use client';

import React, { useState } from 'react';
import {
  Grid,
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { TransactionFormFields } from '@/components/accounting/shared/TransactionFormFields';
import { LineItemsTable } from '@/components/accounting/shared/LineItemsTable';
import { TransactionNumberDisplay } from '@/components/accounting/shared/TransactionNumberDisplay';
import { FileUpload, type FileAttachment } from '@/components/accounting/shared/FileUpload';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerInvoice, CurrencyCode } from '@vapour/types';
import { CURRENCIES, DEFAULT_CURRENCY } from '@vapour/constants';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateInvoiceGLEntries, type InvoiceGLInput } from '@/lib/accounting/glEntry';
import { useTransactionForm } from '@/hooks/accounting/useTransactionForm';
import { useLineItemManagement } from '@/hooks/accounting/useLineItemManagement';
import { useEntityStateFetch } from '@/hooks/accounting/useEntityStateFetch';
import { useGSTCalculation } from '@/hooks/accounting/useGSTCalculation';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  editingInvoice?: CustomerInvoice | null;
  viewOnly?: boolean;
}

export function CreateInvoiceDialog({
  open,
  onClose,
  editingInvoice,
  viewOnly = false,
}: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>(
    (editingInvoice?.currency as CurrencyCode) || DEFAULT_CURRENCY
  );
  const [exchangeRate, setExchangeRate] = useState<number>(editingInvoice?.exchangeRate || 1);

  // Use transaction form hook
  const formState = useTransactionForm({
    initialData: editingInvoice
      ? {
          date: editingInvoice.date,
          dueDate: editingInvoice.dueDate,
          entityId: editingInvoice.entityId,
          entityName: editingInvoice.entityName,
          description: editingInvoice.description,
          reference: editingInvoice.reference,
          projectId: editingInvoice.projectId,
          status: editingInvoice.status,
        }
      : undefined,
    isOpen: open,
  });

  // Use line item management hook
  const { lineItems, addLineItem, removeLineItem, updateLineItem, subtotal } =
    useLineItemManagement({
      initialLineItems: editingInvoice?.lineItems,
      onError: setError,
    });

  // Use entity state fetch hook (for GST calculation)
  const {
    companyState,
    entityState,
    entityName: fetchedEntityName,
  } = useEntityStateFetch(formState.entityId);

  // Use GST calculation hook
  const { gstDetails, totalGstAmount, grandTotal } = useGSTCalculation({
    lineItems,
    subtotal,
    companyState,
    entityState,
  });

  // Reset form state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setCustomInvoiceNumber('');
      setError('');
      setAttachments([]);
      setCurrency(DEFAULT_CURRENCY);
      setExchangeRate(1);
    } else if (editingInvoice) {
      // Load existing data when editing
      setCurrency((editingInvoice.currency as CurrencyCode) || DEFAULT_CURRENCY);
      setExchangeRate(editingInvoice.exchangeRate || 1);
      if (editingInvoice.attachments) {
        const loadedAttachments = (editingInvoice.attachments as unknown as FileAttachment[]).map(
          (att) => ({
            ...att,
            uploadedAt:
              att.uploadedAt instanceof Date
                ? att.uploadedAt
                : new Date(att.uploadedAt as unknown as string | number),
          })
        );
        setAttachments(loadedAttachments);
      }
    }
  }, [open, editingInvoice]);

  // Sync entity name from useEntityStateFetch to form state when entity is selected
  React.useEffect(() => {
    if (fetchedEntityName && formState.entityId) {
      formState.setEntityName(fetchedEntityName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedEntityName, formState.entityId, formState.setEntityName]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!formState.entityId) {
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
      const invoiceDate = new Date(formState.date);
      const invoiceDueDate = formState.dueDate ? new Date(formState.dueDate) : undefined;

      // Use custom invoice number if provided, otherwise generate automatically
      const transactionNumber =
        editingInvoice?.transactionNumber ||
        customInvoiceNumber.trim() ||
        (await generateTransactionNumber('CUSTOMER_INVOICE'));

      // Calculate base amount (in INR) for foreign currency invoices
      const isForexInvoice = currency !== 'INR';
      const baseAmount = isForexInvoice ? grandTotal * exchangeRate : grandTotal;

      // Generate GL entries using new GL entry generator
      const glInput: InvoiceGLInput = {
        transactionId: editingInvoice?.id || '',
        transactionNumber,
        transactionDate: Timestamp.fromDate(invoiceDate),
        subtotal: isForexInvoice ? subtotal * exchangeRate : subtotal,
        lineItems: isForexInvoice
          ? lineItems.map((item) => ({ ...item, amount: item.amount * exchangeRate }))
          : lineItems,
        gstDetails:
          isForexInvoice && gstDetails
            ? {
                ...gstDetails,
                taxableAmount: gstDetails.taxableAmount * exchangeRate,
                cgstAmount: gstDetails.cgstAmount
                  ? gstDetails.cgstAmount * exchangeRate
                  : undefined,
                sgstAmount: gstDetails.sgstAmount
                  ? gstDetails.sgstAmount * exchangeRate
                  : undefined,
                igstAmount: gstDetails.igstAmount
                  ? gstDetails.igstAmount * exchangeRate
                  : undefined,
                totalGST: gstDetails.totalGST * exchangeRate,
              }
            : gstDetails,
        currency: 'INR', // GL entries are always in base currency
        description: formState.description || `Invoice for ${formState.entityName}`,
        entityId: formState.entityId,
        projectId: formState.projectId || undefined,
      };

      const glResult = await generateInvoiceGLEntries(db, glInput);

      if (!glResult.success) {
        setError(`Failed to generate GL entries: ${glResult.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      // Convert FileAttachment dates to Firestore Timestamps
      const firestoreAttachments = attachments.map((att) => ({
        ...att,
        uploadedAt:
          att.uploadedAt instanceof Date ? Timestamp.fromDate(att.uploadedAt) : att.uploadedAt,
      }));

      // Clean gstDetails to remove undefined values (Firestore doesn't accept undefined)
      const cleanGstDetails = gstDetails
        ? Object.fromEntries(Object.entries(gstDetails).filter(([, value]) => value !== undefined))
        : undefined;

      const invoice = {
        type: 'CUSTOMER_INVOICE' as const,
        date: invoiceDate ? Timestamp.fromDate(invoiceDate) : Timestamp.now(),
        dueDate: invoiceDueDate ? Timestamp.fromDate(invoiceDueDate) : Timestamp.now(),
        entityId: formState.entityId,
        entityName: formState.entityName,
        description: formState.description,
        reference: formState.reference || undefined,
        projectId: formState.projectId || undefined,
        status: formState.status,
        lineItems,
        subtotal,
        ...(cleanGstDetails ? { gstDetails: cleanGstDetails } : {}),
        totalAmount: grandTotal,
        amount: grandTotal,
        transactionNumber,
        entries: glResult.entries,
        glGeneratedAt: Timestamp.now(),
        createdAt: editingInvoice?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency,
        exchangeRate: isForexInvoice ? exchangeRate : 1,
        baseAmount, // Amount in INR
        attachments: firestoreAttachments,
        invoiceDate: invoiceDate ? Timestamp.fromDate(invoiceDate) : Timestamp.now(),
        paymentTerms: 'Net 30',
        paidAmount: 0,
        outstandingAmount: baseAmount, // Always track outstanding in INR for consistent payment allocation
        paymentStatus: 'UNPAID',
        taxAmount: totalGstAmount,
      };

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

  const dialogTitle = viewOnly
    ? 'View Invoice'
    : editingInvoice
      ? 'Edit Invoice'
      : 'Create Invoice';

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      loading={loading}
      error={error}
      onError={setError}
      maxWidth="lg"
      actions={
        viewOnly ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose} variant="contained">
              Close
            </Button>
          </Box>
        ) : (
          <FormDialogActions
            onCancel={onClose}
            onSubmit={handleSave}
            loading={loading}
            submitLabel={editingInvoice ? 'Update' : 'Create'}
          />
        )
      }
    >
      <Grid container spacing={2}>
        {/* Invoice Number */}
        <TransactionNumberDisplay
          transactionNumber={editingInvoice?.transactionNumber}
          label="Invoice Number"
          placeholder="Will be auto-generated (INV-XXXX)"
          editable={!editingInvoice}
          value={customInvoiceNumber}
          onChange={setCustomInvoiceNumber}
          helperText={
            editingInvoice
              ? 'Invoice number cannot be changed'
              : 'Leave blank to auto-generate, or enter a custom invoice number'
          }
        />

        {/* Transaction Form Fields */}
        <TransactionFormFields
          date={formState.date}
          onDateChange={formState.setDate}
          dueDate={formState.dueDate}
          onDueDateChange={formState.setDueDate}
          entityId={formState.entityId}
          onEntityChange={formState.setEntityId}
          status={formState.status}
          onStatusChange={formState.setStatus}
          description={formState.description}
          onDescriptionChange={formState.setDescription}
          reference={formState.reference}
          onReferenceChange={formState.setReference}
          projectId={formState.projectId}
          onProjectChange={formState.setProjectId}
          entityLabel="Customer"
          entityRole="CUSTOMER"
          disabled={viewOnly}
        />

        {/* Currency Selection */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            label="Currency"
            value={currency}
            onChange={(e) => {
              const newCurrency = e.target.value as CurrencyCode;
              setCurrency(newCurrency);
              // Reset exchange rate to 1 when switching to INR
              if (newCurrency === 'INR') {
                setExchangeRate(1);
              }
            }}
            disabled={viewOnly}
          >
            {Object.values(CURRENCIES).map((curr) => (
              <MenuItem key={curr.code} value={curr.code}>
                {curr.symbol} {curr.code} - {curr.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Exchange Rate (only for foreign currencies) */}
        {currency !== 'INR' && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Exchange Rate"
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
              disabled={viewOnly}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">1 {currency} =</InputAdornment>,
                  endAdornment: <InputAdornment position="end">INR</InputAdornment>,
                },
              }}
              helperText={`Base amount: ₹${(grandTotal * exchangeRate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            />
          </Grid>
        )}

        {/* Line Items Table */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ mt: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Line Items</Typography>
            </Stack>

            <LineItemsTable
              lineItems={lineItems}
              onUpdateLineItem={updateLineItem}
              onRemoveLineItem={removeLineItem}
              onAddLineItem={addLineItem}
              subtotal={subtotal}
              gstDetails={gstDetails}
              totalAmount={grandTotal}
              readOnly={viewOnly}
            />
          </Box>
        </Grid>

        {/* Attachments Section */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Attachments
            </Typography>
            <FileUpload
              attachments={attachments}
              onChange={setAttachments}
              storagePath={`invoices/${editingInvoice?.transactionNumber || customInvoiceNumber || 'draft'}/`}
              disabled={viewOnly}
              maxSizeMB={10}
              maxFiles={5}
            />
          </Box>
        </Grid>
      </Grid>
    </FormDialog>
  );
}
