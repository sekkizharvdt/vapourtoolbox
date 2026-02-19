'use client';

import React, { useState, useMemo } from 'react';
import { Grid, Box, Typography, Stack, Button as MuiButton } from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { TransactionFormFields } from '@/components/accounting/shared/TransactionFormFields';
import { LineItemsTable } from '@/components/accounting/shared/LineItemsTable';
import { TDSSection } from '@/components/accounting/shared/TDSSection';
import { TransactionNumberDisplay } from '@/components/accounting/shared/TransactionNumberDisplay';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateBillGLEntries, type BillGLInput } from '@/lib/accounting/glEntry';
import { useTransactionForm } from '@/hooks/accounting/useTransactionForm';
import { useLineItemManagement } from '@/hooks/accounting/useLineItemManagement';
import { useEntityStateFetch } from '@/hooks/accounting/useEntityStateFetch';
import { useGSTCalculation } from '@/hooks/accounting/useGSTCalculation';
import { useTDSCalculation } from '@/hooks/accounting/useTDSCalculation';
import type { TDSSection as TDSSectionType } from '@/lib/accounting/tdsCalculator';
import { useAuth } from '@/contexts/AuthContext';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

interface CreateBillDialogProps {
  open: boolean;
  onClose: () => void;
  editingBill?: VendorBill | null;
  viewOnly?: boolean;
}

export function CreateBillDialog({
  open,
  onClose,
  editingBill,
  viewOnly = false,
}: CreateBillDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vendorBillNumber, setVendorBillNumber] = useState('');

  // Memoize initial data to prevent useEffect re-runs on every render
  const initialFormData = useMemo(
    () =>
      editingBill
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
    [editingBill]
  );

  // Use transaction form hook
  const formState = useTransactionForm({
    initialData: initialFormData,
    isOpen: open,
  });

  // Use line item management hook
  const { lineItems, addLineItem, removeLineItem, updateLineItem, subtotal } =
    useLineItemManagement({
      initialLineItems: editingBill?.lineItems,
      onError: setError,
    });

  // Use entity state fetch hook (for GST calculation)
  const {
    companyState,
    entityState,
    entityName: fetchedEntityName,
  } = useEntityStateFetch(formState.entityId);

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
    tdsRateOverride,
    setTdsRateOverride,
    tdsDetails,
    tdsAmount,
  } = useTDSCalculation({
    amount: amountBeforeTDS,
  });

  // Calculate final total after TDS deduction
  const totalAmount = amountBeforeTDS - tdsAmount;

  // Sync entity name from useEntityStateFetch to form state when entity is selected
  React.useEffect(() => {
    if (fetchedEntityName && formState.entityId) {
      formState.setEntityName(fetchedEntityName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedEntityName, formState.entityId, formState.setEntityName]);

  // Load TDS data and vendor bill number when editing
  React.useEffect(() => {
    if (open && editingBill) {
      setVendorBillNumber(editingBill.vendorInvoiceNumber || '');
      if (editingBill.tdsDeducted) {
        setTdsDeducted(true);
        setTdsSection((editingBill.tdsDetails?.section as TDSSectionType) || '194C');
        setVendorPAN(editingBill.tdsDetails?.panNumber || '');
        // Restore rate override if the saved rate differs from auto
        if (editingBill.tdsDetails?.tdsRate != null) {
          setTdsRateOverride(editingBill.tdsDetails.tdsRate);
        }
      }
    } else if (open) {
      setVendorBillNumber('');
    }
  }, [open, editingBill, setTdsDeducted, setTdsSection, setVendorPAN, setTdsRateOverride]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!vendorBillNumber.trim()) {
        setError('Please enter the vendor bill/invoice number');
        setLoading(false);
        return;
      }

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

      // Clean gstDetails to remove undefined values (Firestore doesn't accept undefined)
      const cleanGstDetails = gstDetails
        ? Object.fromEntries(Object.entries(gstDetails).filter(([, v]) => v !== undefined))
        : null;

      const bill = {
        type: 'VENDOR_BILL' as const,
        date: billDate ? Timestamp.fromDate(billDate) : Timestamp.now(),
        billDate: billDate ? Timestamp.fromDate(billDate) : Timestamp.now(),
        dueDate: billDueDate ? Timestamp.fromDate(billDueDate) : Timestamp.now(),
        entityId: formState.entityId,
        entityName: formState.entityName,
        description: formState.description,
        reference: formState.reference || '',
        projectId: formState.projectId || '',
        status: formState.status,
        lineItems: lineItems.map((item) => ({
          ...item,
          // Remove undefined fields from line items
          hsnCode: item.hsnCode || '',
          sacCode: item.sacCode || '',
        })),
        subtotal,
        ...(cleanGstDetails ? { gstDetails: cleanGstDetails } : {}),
        tdsDeducted,
        ...(tdsDetails ? { tdsDetails } : {}),
        tdsAmount,
        totalAmount,
        amount: totalAmount,
        transactionNumber,
        vendorInvoiceNumber: vendorBillNumber.trim(),
        entries: glResult.entries,
        glGeneratedAt: Timestamp.now(),
        createdAt: editingBill?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency: 'INR',
        baseAmount: totalAmount,
        attachments: [],
        // Payment tracking - preserve existing values on edit, initialize on create
        paidAmount: editingBill?.paidAmount ?? 0,
        outstandingAmount: editingBill?.outstandingAmount ?? totalAmount,
        paymentStatus: editingBill?.paymentStatus ?? 'UNPAID',
      };

      if (editingBill?.id) {
        // Update existing bill - recalculate outstanding if total changed
        const existingPaidAmount = editingBill.paidAmount ?? 0;
        const newOutstanding = totalAmount - existingPaidAmount;
        const updatedBill = {
          ...bill,
          outstandingAmount: newOutstanding,
          paymentStatus:
            newOutstanding <= 0 ? 'PAID' : existingPaidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        };
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingBill.id), updatedBill);

        // Audit log: bill updated
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await logAuditEvent(
            db,
            auditContext,
            'BILL_UPDATED',
            'BILL',
            editingBill.id,
            `Bill ${transactionNumber} updated for ${formState.entityName}`,
            {
              entityName: transactionNumber,
              metadata: {
                entityId: formState.entityId,
                entityName: formState.entityName,
                vendorBillNumber: vendorBillNumber.trim(),
                amount: totalAmount,
              },
            }
          );
        }
      } else {
        // Create new bill
        const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), bill);

        // Audit log: bill created
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await logAuditEvent(
            db,
            auditContext,
            'BILL_CREATED',
            'BILL',
            docRef.id,
            `Bill ${transactionNumber} created for ${formState.entityName}`,
            {
              entityName: transactionNumber,
              metadata: {
                entityId: formState.entityId,
                entityName: formState.entityName,
                vendorBillNumber: vendorBillNumber.trim(),
                amount: totalAmount,
              },
            }
          );
        }
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
      title={viewOnly ? 'View Bill' : editingBill ? 'Edit Bill' : 'Create Bill'}
      loading={loading}
      error={error}
      onError={setError}
      maxWidth="lg"
      actions={
        viewOnly ? (
          <MuiButton onClick={onClose}>Close</MuiButton>
        ) : (
          <FormDialogActions
            onCancel={onClose}
            onSubmit={handleSave}
            loading={loading}
            submitLabel={editingBill ? 'Update' : 'Create'}
          />
        )
      }
    >
      <Grid container spacing={2}>
        {/* Vendor Bill/Invoice Number (editable) */}
        <TransactionNumberDisplay
          value={vendorBillNumber}
          onChange={setVendorBillNumber}
          label="Vendor Bill/Invoice Number"
          placeholder="Enter vendor's bill number"
          helperText="Enter the bill/invoice number from the vendor"
          editable={!viewOnly}
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
          entityLabel="Vendor"
          entityRole="VENDOR"
          disabled={viewOnly}
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
              showAccountSelector
              readOnly={viewOnly}
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
          tdsRateOverride={tdsRateOverride}
          onTdsRateOverrideChange={setTdsRateOverride}
          disabled={viewOnly}
        />
      </Grid>
    </FormDialog>
  );
}
