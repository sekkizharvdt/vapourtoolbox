'use client';

import React, { useState } from 'react';
import { Grid, Box, Typography, Stack } from '@mui/material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { TransactionFormFields } from '@/components/accounting/shared/TransactionFormFields';
import { LineItemsTable } from '@/components/accounting/shared/LineItemsTable';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerInvoice } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateInvoiceGLEntries, type InvoiceGLInput } from '@/lib/accounting/glEntryGenerator';
import { useTransactionForm } from '@/hooks/accounting/useTransactionForm';
import { useLineItemManagement } from '@/hooks/accounting/useLineItemManagement';
import { useEntityStateFetch } from '@/hooks/accounting/useEntityStateFetch';
import { useGSTCalculation } from '@/hooks/accounting/useGSTCalculation';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  editingInvoice?: CustomerInvoice | null;
}

export function CreateInvoiceDialog({ open, onClose, editingInvoice }: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Use transaction form hook
  const formState = useTransactionForm({
    initialData: editingInvoice
      ? {
          date: editingInvoice.date,
          dueDate: editingInvoice.dueDate,
          entityId: editingInvoice.entityId,
          entityName: editingInvoice.entityName,
          description: editingInvoice.description,
          reference: editingInvoice.referenceNumber,
          projectId: editingInvoice.projectId,
          status: editingInvoice.status,
        }
      : undefined,
    isOpen: open,
  });

  // Use line item management hook
  const {
    lineItems,
    addLineItem,
    removeLineItem,
    updateLineItem,
    subtotal,
  } = useLineItemManagement({
    initialLineItems: editingInvoice?.lineItems,
    onError: setError,
  });

  // Use entity state fetch hook (for GST calculation)
  const { companyState, entityState, setEntityName } = useEntityStateFetch(formState.entityId);

  // Use GST calculation hook
  const { gstDetails, totalGstAmount, grandTotal } = useGSTCalculation({
    lineItems,
    subtotal,
    companyState,
    entityState,
  });

  // Sync entity name when entity changes
  React.useEffect(() => {
    if (formState.entityName) {
      setEntityName(formState.entityName);
    }
  }, [formState.entityName, setEntityName]);

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
        gstDetails,
        currency: 'INR',
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

      const invoice = {
        type: 'CUSTOMER_INVOICE' as const,
        date: invoiceDate ? Timestamp.fromDate(invoiceDate) : Timestamp.now(),
        dueDate: invoiceDueDate ? Timestamp.fromDate(invoiceDueDate) : Timestamp.now(),
        entityId: formState.entityId,
        entityName: formState.entityName,
        description: formState.description,
        referenceNumber: formState.reference || undefined,
        projectId: formState.projectId || undefined,
        status: formState.status,
        lineItems,
        subtotal,
        gstDetails,
        totalAmount: grandTotal,
        amount: grandTotal,
        transactionNumber,
        entries: glResult.entries,
        glGeneratedAt: Timestamp.now(),
        createdAt: editingInvoice?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency: 'INR',
        baseAmount: grandTotal,
        attachments: [],
        invoiceDate: invoiceDate ? Timestamp.fromDate(invoiceDate) : Timestamp.now(),
        paymentTerms: 'Net 30',
        paidAmount: 0,
        outstandingAmount: grandTotal,
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
        />

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
            />
          </Box>
        </Grid>
      </Grid>
    </FormDialog>
  );
}
