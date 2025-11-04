'use client';

import React, { useState } from 'react';
import { Grid, Box, Typography, Stack } from '@mui/material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { TransactionFormFields } from '@/components/accounting/shared/TransactionFormFields';
import { LineItemsTable } from '@/components/accounting/shared/LineItemsTable';
import { TDSSection } from '@/components/accounting/shared/TDSSection';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateBillGLEntries, type BillGLInput } from '@/lib/accounting/glEntryGenerator';
import { useTransactionForm } from '@/hooks/accounting/useTransactionForm';
import { useLineItemManagement } from '@/hooks/accounting/useLineItemManagement';
import { useEntityStateFetch } from '@/hooks/accounting/useEntityStateFetch';
import { useGSTCalculation } from '@/hooks/accounting/useGSTCalculation';
import { useTDSCalculation } from '@/hooks/accounting/useTDSCalculation';

interface CreateBillDialogProps {
  open: boolean;
  onClose: () => void;
  editingBill?: VendorBill | null;
}

export function CreateBillDialog({ open, onClose, editingBill }: CreateBillDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Use transaction form hook
  const formState = useTransactionForm({
    initialData: editingBill
      ? {
          date: editingBill.date,
          dueDate: editingBill.dueDate,
          entityId: editingBill.entityId,
          entityName: editingBill.entityName,
          description: editingBill.description,
          reference: editingBill.reference,
          projectId: editingBill.projectId,
          status: editingBill.status,
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
    initialLineItems: editingBill?.lineItems,
    onError: setError,
  });

  // Use entity state fetch hook (for GST calculation)
  const { companyState, entityState, setEntityName } = useEntityStateFetch(formState.entityId);

  // Use GST calculation hook
  const { gstDetails, grandTotal: amountBeforeTDS } = useGSTCalculation({
    lineItems,
    subtotal,
    companyState: entityState, // Note: For bills, source is vendor
    entityState: companyState, // Note: For bills, destination is company
  });

  // Use TDS calculation hook
  const {
    tdsDeducted,
    setTdsDeducted,
    tdsSection,
    setTdsSection,
    vendorPAN,
    setVendorPAN,
    tdsDetails,
    tdsAmount,
  } = useTDSCalculation({
    amount: amountBeforeTDS,
  });

  // Calculate final total after TDS deduction
  const totalAmount = amountBeforeTDS - tdsAmount;

  // Sync entity name when entity changes
  React.useEffect(() => {
    if (formState.entityName) {
      setEntityName(formState.entityName);
    }
  }, [formState.entityName, setEntityName]);

  // Load TDS data when editing
  React.useEffect(() => {
    if (open && editingBill) {
      if (editingBill.tdsDeducted) {
        setTdsDeducted(true);
        setTdsSection((editingBill.tdsDetails?.section as any) || '194C');
        setVendorPAN(editingBill.tdsDetails?.panNumber || '');
      }
    }
  }, [open, editingBill, setTdsDeducted, setTdsSection, setVendorPAN]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!formState.entityId) {
        setError('Please select a vendor');
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
      const billDate = new Date(formState.date);
      const billDueDate = formState.dueDate ? new Date(formState.dueDate) : undefined;

      // Generate transaction number
      const transactionNumber =
        editingBill?.transactionNumber || (await generateTransactionNumber('VENDOR_BILL'));

      // Generate GL entries using new GL entry generator
      const glInput: BillGLInput = {
        transactionId: editingBill?.id || '',
        transactionNumber,
        transactionDate: Timestamp.fromDate(billDate),
        subtotal,
        lineItems,
        gstDetails,
        tdsDetails: tdsDeducted ? tdsDetails : undefined,
        currency: 'INR',
        description: formState.description || `Bill from ${formState.entityName}`,
        entityId: formState.entityId,
        projectId: formState.projectId || undefined,
      };

      const glResult = await generateBillGLEntries(db, glInput);

      if (!glResult.success) {
        setError(`Failed to generate GL entries: ${glResult.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const bill = {
        type: 'VENDOR_BILL' as const,
        date: billDate ? Timestamp.fromDate(billDate) : Timestamp.now(),
        dueDate: billDueDate ? Timestamp.fromDate(billDueDate) : Timestamp.now(),
        entityId: formState.entityId,
        entityName: formState.entityName,
        description: formState.description,
        reference: formState.reference || undefined,
        projectId: formState.projectId || undefined,
        status: formState.status,
        lineItems,
        subtotal,
        gstDetails,
        tdsDeducted,
        tdsDetails,
        tdsAmount,
        totalAmount,
        amount: totalAmount,
        transactionNumber,
        entries: glResult.entries,
        glGeneratedAt: Timestamp.now(),
        createdAt: editingBill?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency: 'INR',
        baseAmount: totalAmount,
        attachments: [],
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
          entityLabel="Vendor"
          entityRole="VENDOR"
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
              tdsAmount={tdsAmount}
              tdsRate={tdsDetails?.tdsRate}
              totalAmount={totalAmount}
            />
          </Box>
        </Grid>

        {/* TDS Section */}
        <TDSSection
          tdsDeducted={tdsDeducted}
          onTdsDeductedChange={setTdsDeducted}
          tdsSection={tdsSection}
          onTdsSectionChange={setTdsSection}
          vendorPAN={vendorPAN}
          onVendorPANChange={setVendorPAN}
        />
      </Grid>
    </FormDialog>
  );
}
