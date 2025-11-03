'use client';

/**
 * Create Purchase Request Page
 *
 * Form to create a new purchase request with line items and documents
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stack,
  MenuItem,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { CreatePurchaseRequestInput, PurchaseRequestItemInput } from '@vapour/types';
import { createPurchaseRequest } from '@/lib/procurement/purchaseRequestService';
import ExcelUploadDialog from '@/components/procurement/ExcelUploadDialog';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    type: 'PROJECT' as 'PROJECT' | 'BUDGETARY' | 'INTERNAL',
    category: 'RAW_MATERIAL' as 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT',
    projectId: '',
    projectName: '',
    department: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    requiredByDate: '',
    purpose: '',
    justification: '',
  });

  const [lineItems, setLineItems] = useState<PurchaseRequestItemInput[]>([
    {
      lineNumber: 1,
      description: '',
      quantity: 1,
      unit: 'NOS',
      equipmentCode: '',
      remarks: '',
    },
  ]);

  const steps = ['Basic Information', 'Line Items', 'Review & Submit'];

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setFormData((prev) => ({
      ...prev,
      projectId,
      projectName,
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setLineItems(updatedItems);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        lineNumber: prev.length + 1,
        description: '',
        quantity: 1,
        unit: 'NOS',
        equipmentCode: '',
        remarks: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber line items
      return updated.map((item, i) => ({
        ...item,
        lineNumber: i + 1,
      }));
    });
  };

  const handleImportFromExcel = (importedItems: PurchaseRequestItemInput[]) => {
    setLineItems(importedItems);
    setExcelDialogOpen(false);
  };

  const validateStep = (step: number): boolean => {
    setError(null);

    if (step === 0) {
      // Validate basic information
      if (formData.type === 'PROJECT' && !formData.projectId) {
        setError('Please select a project');
        return false;
      }
      if (!formData.department) {
        setError('Please enter department');
        return false;
      }
      if (!formData.purpose) {
        setError('Please enter purpose');
        return false;
      }
      return true;
    }

    if (step === 1) {
      // Validate line items
      if (lineItems.length === 0) {
        setError('Please add at least one line item');
        return false;
      }

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        if (!item.description.trim()) {
          setError(`Line ${i + 1}: Description is required`);
          return false;
        }
        if (item.quantity <= 0) {
          setError(`Line ${i + 1}: Quantity must be greater than 0`);
          return false;
        }
        if (!item.unit.trim()) {
          setError(`Line ${i + 1}: Unit is required`);
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
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
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || undefined,
        department: formData.department,
        priority: formData.priority,
        requiredByDate: formData.requiredByDate ? new Date(formData.requiredByDate) : undefined,
        purpose: formData.purpose,
        justification: formData.justification || undefined,
        items: lineItems.filter((item) => item.description.trim() !== ''),
        submittedBy: user.uid,
        submittedByName: user.displayName || user.email || 'Unknown',
      };

      const prId = await createPurchaseRequest(input);
      router.push(`/procurement/purchase-requests/${prId}`);
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
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || undefined,
        department: formData.department,
        priority: formData.priority,
        requiredByDate: formData.requiredByDate ? new Date(formData.requiredByDate) : undefined,
        purpose: formData.purpose,
        justification: formData.justification || undefined,
        items: lineItems,
        submittedBy: user.uid,
        submittedByName: user.displayName || user.email || 'Unknown',
        submitImmediately: true, // Submit for approval
      };

      const prId = await createPurchaseRequest(input);
      router.push(`/procurement/purchase-requests/${prId}`);
    } catch (err) {
      console.error('[NewPurchaseRequest] Error submitting:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit purchase request');
    } finally {
      setSaving(false);
    }
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

        {/* Step 1: Basic Information */}
        {activeStep === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Type"
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="PROJECT">Project</MenuItem>
                  <MenuItem value="BUDGETARY">Budgetary</MenuItem>
                  <MenuItem value="INTERNAL">Internal</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="SERVICE">Service</MenuItem>
                  <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
                  <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
                </TextField>
              </Stack>

              {formData.type === 'PROJECT' && (
                <ProjectSelector
                  value={formData.projectId}
                  onChange={handleProjectSelect}
                  required
                />
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  fullWidth
                  required
                  placeholder="e.g., Engineering, Procurement"
                />

                <TextField
                  select
                  label="Priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="URGENT">Urgent</MenuItem>
                </TextField>
              </Stack>

              <TextField
                label="Required By Date"
                type="date"
                value={formData.requiredByDate}
                onChange={(e) => handleInputChange('requiredByDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                helperText="When do you need these items?"
              />

              <TextField
                label="Purpose"
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                multiline
                rows={2}
                fullWidth
                required
                placeholder="Brief description of why these items are needed"
              />

              <TextField
                label="Justification (Optional)"
                value={formData.justification}
                onChange={(e) => handleInputChange('justification', e.target.value)}
                multiline
                rows={3}
                fullWidth
                placeholder="Detailed justification if required"
              />
            </Stack>
          </Paper>
        )}

        {/* Step 2: Line Items */}
        {activeStep === 1 && (
          <Paper sx={{ p: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Line Items ({lineItems.length})</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setExcelDialogOpen(true)}
                  size="small"
                >
                  Import from Excel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddLineItem}
                  size="small"
                >
                  Add Item
                </Button>
              </Stack>
            </Stack>
            <Divider sx={{ mb: 3 }} />

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Line #</TableCell>
                    <TableCell>Description *</TableCell>
                    <TableCell width={100}>Quantity *</TableCell>
                    <TableCell width={100}>Unit *</TableCell>
                    <TableCell width={150}>Equipment Code</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell width={60}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.lineNumber}</TableCell>
                      <TableCell>
                        <TextField
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(index, 'description', e.target.value)
                          }
                          placeholder="Item description"
                          size="small"
                          fullWidth
                          required
                          multiline
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(index, 'quantity', parseFloat(e.target.value))
                          }
                          size="small"
                          fullWidth
                          required
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          value={item.unit}
                          onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                          size="small"
                          fullWidth
                          required
                        >
                          <MenuItem value="NOS">NOS</MenuItem>
                          <MenuItem value="KG">KG</MenuItem>
                          <MenuItem value="METER">METER</MenuItem>
                          <MenuItem value="LITER">LITER</MenuItem>
                          <MenuItem value="BOX">BOX</MenuItem>
                          <MenuItem value="SET">SET</MenuItem>
                          <MenuItem value="UNIT">UNIT</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.equipmentCode || ''}
                          onChange={(e) =>
                            handleLineItemChange(index, 'equipmentCode', e.target.value)
                          }
                          placeholder="Optional"
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.remarks || ''}
                          onChange={(e) => handleLineItemChange(index, 'remarks', e.target.value)}
                          placeholder="Optional"
                          size="small"
                          fullWidth
                          multiline
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveLineItem(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {lineItems.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No line items added yet
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddLineItem}>
                  Add First Item
                </Button>
              </Box>
            )}
          </Paper>
        )}

        {/* Step 3: Review & Submit */}
        {activeStep === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review & Submit
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
              {/* Basic Info Summary */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Basic Information
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Type:</strong> {formData.type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Category:</strong> {formData.category}
                  </Typography>
                  {formData.projectName && (
                    <Typography variant="body2">
                      <strong>Project:</strong> {formData.projectName}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Department:</strong> {formData.department}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Priority:</strong> {formData.priority}
                  </Typography>
                  {formData.requiredByDate && (
                    <Typography variant="body2">
                      <strong>Required By:</strong>{' '}
                      {new Date(formData.requiredByDate).toLocaleDateString()}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Purpose:</strong> {formData.purpose}
                  </Typography>
                </Stack>
              </Box>

              <Divider />

              {/* Line Items Summary */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Line Items ({lineItems.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Line #</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Unit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.lineNumber}>
                          <TableCell>{item.lineNumber}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Alert severity="info">
                Once submitted, this purchase request will be sent to the Engineering Head for
                approval.
              </Alert>
            </Stack>
          </Paper>
        )}

        {/* Navigation Buttons */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between">
            <Button onClick={() => router.back()} disabled={saving}>
              Cancel
            </Button>
            <Stack direction="row" spacing={2}>
              {activeStep === 0 && (
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveDraft}
                  disabled={saving}
                >
                  Save Draft
                </Button>
              )}
              {activeStep > 0 && (
                <Button onClick={handleBack} disabled={saving}>
                  Back
                </Button>
              )}
              {activeStep < steps.length - 1 && (
                <Button variant="contained" onClick={handleNext}>
                  Next
                </Button>
              )}
              {activeStep === steps.length - 1 && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      {/* Excel Upload Dialog */}
      <ExcelUploadDialog
        open={excelDialogOpen}
        onClose={() => setExcelDialogOpen(false)}
        onItemsImported={handleImportFromExcel}
      />
    </Box>
  );
}
