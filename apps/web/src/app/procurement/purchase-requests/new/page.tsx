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
import {
  createPurchaseRequest,
  submitPurchaseRequestForApproval,
  type CreatePurchaseRequestInput,
  type CreatePurchaseRequestItemInput,
} from '@/lib/procurement/purchaseRequestService';
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
    title: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    requiredBy: '',
  });

  const [lineItems, setLineItems] = useState<CreatePurchaseRequestItemInput[]>([
    {
      description: '',
      quantity: 1,
      unit: 'NOS',
      equipmentCode: '',
    },
  ]);

  const steps = ['Basic Information', 'Line Items', 'Review & Submit'];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProjectSelect = (projectId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      projectId: projectId || '',
      projectName: '', // TODO: Get project name from projectId
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    if (item) {
      updatedItems[index] = {
        ...item,
        [field]: value,
      };
      setLineItems(updatedItems);
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit: 'NOS',
        equipmentCode: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportFromExcel = (importedItems: CreatePurchaseRequestItemInput[]) => {
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
      if (!formData.title.trim()) {
        setError('Please enter title');
        return false;
      }
      if (!formData.description.trim()) {
        setError('Please enter description');
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
        if (!item) continue;
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
      router.push(`/procurement/purchase-requests/${result.prId}`);
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

      // Submit for approval immediately
      await submitPurchaseRequestForApproval(
        result.prId,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      router.push(`/procurement/purchase-requests/${result.prId}`);
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

              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                fullWidth
                required
                placeholder="e.g., Raw Materials for Project X"
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                fullWidth
                required
                placeholder="Detailed description of the purchase request and its purpose"
              />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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

                <TextField
                  label="Required By Date"
                  type="date"
                  value={formData.requiredBy}
                  onChange={(e) => handleInputChange('requiredBy', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  helperText="When do you need these items?"
                />
              </Stack>
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
                    <TableCell width={60}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
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
                    <strong>Title:</strong> {formData.title}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Description:</strong> {formData.description}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Priority:</strong> {formData.priority}
                  </Typography>
                  {formData.requiredBy && (
                    <Typography variant="body2">
                      <strong>Required By:</strong>{' '}
                      {new Date(formData.requiredBy).toLocaleDateString()}
                    </Typography>
                  )}
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
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{index + 1}</TableCell>
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
