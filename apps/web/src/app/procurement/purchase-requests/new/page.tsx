'use client';

/**
 * Create Purchase Request Page
 *
 * Form to create a new purchase request with line items and documents
 */

import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  createPurchaseRequest,
  submitPurchaseRequestForApproval,
  type CreatePurchaseRequestInput,
} from '@/lib/procurement/purchaseRequestService';
import ExcelUploadDialog from '@/components/procurement/ExcelUploadDialog';
import { usePurchaseRequestForm } from './components/usePurchaseRequestForm';
import { BasicInformationStep } from './components/BasicInformationStep';
import { LineItemsStep } from './components/LineItemsStep';
import { ReviewStep } from './components/ReviewStep';
import { NavigationButtons } from './components/NavigationButtons';

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);

  const {
    formData,
    lineItems,
    activeStep,
    error,
    handleInputChange,
    handleProjectSelect,
    handleLineItemChange,
    handleAddLineItem,
    handleRemoveLineItem,
    handleImportFromExcel,
    validateStep,
    setActiveStep,
    setError,
  } = usePurchaseRequestForm();

  const steps = ['Basic Information', 'Line Items', 'Review & Submit'];

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
    setError(null);
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    if (!validateStep(0)) return;

    setSaving(true);
    setError(null);

    try {
      const input: CreatePurchaseRequestInput = {
        type: formData.type,
        category: formData.category,
        projectId: formData.projectId,
        projectName: formData.projectName,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        requiredBy: formData.requiredBy ? new Date(formData.requiredBy) : undefined,
        items: lineItems.filter((item) => item.description.trim() !== ''),
      };

      const result = await createPurchaseRequest(
        input,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      router.push('/procurement/purchase-requests/' + result.prId);
    } catch (err) {
      console.error('[NewPurchaseRequest] Error saving draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep(0) || !validateStep(1)) return;

    setSaving(true);
    setError(null);

    try {
      const input: CreatePurchaseRequestInput = {
        type: formData.type,
        category: formData.category,
        projectId: formData.projectId,
        projectName: formData.projectName,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        requiredBy: formData.requiredBy ? new Date(formData.requiredBy) : undefined,
        items: lineItems,
      };

      const result = await createPurchaseRequest(
        input,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      await submitPurchaseRequestForApproval(
        result.prId,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      router.push('/procurement/purchase-requests/' + result.prId);
    } catch (err) {
      console.error('[NewPurchaseRequest] Error submitting:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit purchase request');
    } finally {
      setSaving(false);
    }
  };

  const handleExcelImport = (importedItems: typeof lineItems) => {
    handleImportFromExcel(importedItems);
    setExcelDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => router.back()}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4">New Purchase Request</Typography>
            <Typography variant="body2" color="text.secondary">
              Create a new purchase request for approval
            </Typography>
          </Box>
        </Stack>

        {/* Stepper */}
        <Paper sx={{ p: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step Content */}
        {activeStep === 0 && (
          <BasicInformationStep
            formData={formData}
            onInputChange={handleInputChange}
            onProjectSelect={handleProjectSelect}
          />
        )}

        {activeStep === 1 && (
          <LineItemsStep
            lineItems={lineItems}
            onLineItemChange={handleLineItemChange}
            onAddLineItem={handleAddLineItem}
            onRemoveLineItem={handleRemoveLineItem}
            onImportClick={() => setExcelDialogOpen(true)}
          />
        )}

        {activeStep === 2 && <ReviewStep formData={formData} lineItems={lineItems} />}

        {/* Navigation Buttons */}
        <NavigationButtons
          activeStep={activeStep}
          totalSteps={steps.length}
          saving={saving}
          onCancel={() => router.back()}
          onBack={handleBack}
          onNext={handleNext}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      </Stack>

      {/* Excel Upload Dialog */}
      <ExcelUploadDialog
        open={excelDialogOpen}
        onClose={() => setExcelDialogOpen(false)}
        onItemsImported={handleExcelImport}
      />
    </Box>
  );
}
