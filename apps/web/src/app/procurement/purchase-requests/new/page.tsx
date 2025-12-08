'use client';

/**
 * Create Purchase Request Page (Optimized Single-Page Form)
 *
 * Consolidated single-page form to create purchase requests with all sections visible
 */

import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Paper,
  Alert,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Save as SaveIcon,
  Send as SendIcon,
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

interface FormData {
  type: 'PROJECT' | 'BUDGETARY' | 'INTERNAL';
  category: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy: string;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    type: 'PROJECT',
    category: 'RAW_MATERIAL',
    projectId: '',
    projectName: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    requiredBy: '',
  });

  const [lineItems, setLineItems] = useState<CreatePurchaseRequestItemInput[]>([
    { description: '', quantity: 1, unit: 'NOS', equipmentCode: '' },
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProjectSelect = (projectId: string | null, projectName?: string) => {
    setFormData((prev) => ({
      ...prev,
      projectId: projectId || '',
      projectName: projectName || '',
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    if (item) {
      updatedItems[index] = { ...item, [field]: value };
      setLineItems(updatedItems);
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unit: 'NOS', equipmentCode: '' },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExcelImport = (importedItems: CreatePurchaseRequestItemInput[]) => {
    setLineItems(importedItems);
    setExcelDialogOpen(false);
  };

  const validateForm = (): boolean => {
    setError(null);

    // Validate basic info
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

    // Validate line items
    const validItems = lineItems.filter((item) => item.description.trim() !== '');
    if (validItems.length === 0) {
      setError('Please add at least one line item with a description');
      return false;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item) continue;
      if (item.description.trim() && item.quantity <= 0) {
        setError(`Line ${i + 1}: Quantity must be greater than 0`);
        return false;
      }
    }

    return true;
  };

  const buildInput = (): CreatePurchaseRequestInput => ({
    type: formData.type,
    category: formData.category,
    projectId: formData.projectId,
    projectName: formData.projectName,
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    requiredBy: formData.requiredBy ? new Date(formData.requiredBy) : undefined,
    items: lineItems.filter((item) => item.description.trim() !== ''),
  });

  const handleSaveDraft = async () => {
    if (!user || !validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await createPurchaseRequest(
        buildInput(),
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
    if (!user || !validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createPurchaseRequest(
        buildInput(),
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
      setSubmitting(false);
    }
  };

  const validItemsCount = lineItems.filter((item) => item.description.trim() !== '').length;
  const isProcessing = saving || submitting;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
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
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSaveDraft}
              disabled={isProcessing}
            >
              Save Draft
            </Button>
            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={handleSubmit}
              disabled={isProcessing}
            >
              Submit for Approval
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Basic Information Section */}
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

            {formData.type === 'PROJECT' && (
              <ProjectSelector value={formData.projectId} onChange={handleProjectSelect} required />
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                fullWidth
                required
                placeholder="e.g., Raw Materials for Project X"
                sx={{ flex: 2 }}
              />

              <TextField
                label="Required By Date"
                type="date"
                value={formData.requiredBy}
                onChange={(e) => handleInputChange('requiredBy', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
                helperText="Optional"
              />
            </Stack>

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={2}
              fullWidth
              required
              placeholder="Detailed description of the purchase request and its purpose"
            />
          </Stack>
        </Paper>

        {/* Line Items Section */}
        <Paper sx={{ p: 3 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
            flexWrap="wrap"
            gap={1}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h6">Line Items</Typography>
              <Chip
                label={`${validItemsCount} item${validItemsCount !== 1 ? 's' : ''}`}
                size="small"
                color={validItemsCount > 0 ? 'primary' : 'default'}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => setExcelDialogOpen(true)}
                size="small"
              >
                Import Excel
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
          <Divider sx={{ mb: 2 }} />

          {lineItems.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No line items added yet
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddLineItem}>
                Add First Item
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={50}>#</TableCell>
                    <TableCell>Description *</TableCell>
                    <TableCell>Specification</TableCell>
                    <TableCell width={100}>Qty *</TableCell>
                    <TableCell width={100}>Unit *</TableCell>
                    <TableCell width={140}>Equipment Code</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index} hover>
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
                          multiline
                          maxRows={3}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.specification || ''}
                          onChange={(e) =>
                            handleLineItemChange(index, 'specification', e.target.value)
                          }
                          placeholder="Specification"
                          size="small"
                          fullWidth
                          multiline
                          maxRows={3}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          size="small"
                          fullWidth
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
                        >
                          <MenuItem value="NOS">NOS</MenuItem>
                          <MenuItem value="KG">KG</MenuItem>
                          <MenuItem value="METER">MTR</MenuItem>
                          <MenuItem value="LITER">LTR</MenuItem>
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
                          disabled={lineItems.length === 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Quick add row */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddLineItem}>
              Add Another Item
            </Button>
          </Box>
        </Paper>

        {/* Summary/Info Section */}
        <Alert severity="info" icon={<SendIcon />}>
          <Typography variant="body2">
            <strong>Ready to submit?</strong> Once submitted, this purchase request will be sent to
            the Engineering Head for approval. You can also save as draft to continue later.
          </Typography>
        </Alert>

        {/* Bottom Action Buttons (Mobile friendly) */}
        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pb: 2 }}>
          <Button variant="text" onClick={() => router.back()} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSaveDraft}
            disabled={isProcessing}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={isProcessing}
          >
            Submit for Approval
          </Button>
        </Stack>
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
