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
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  createPurchaseRequest,
  submitPurchaseRequestForApproval,
  uploadPRAttachment,
  type CreatePurchaseRequestInput,
  type CreatePurchaseRequestItemInput,
} from '@/lib/procurement/purchaseRequest';
import type { PurchaseRequestAttachmentType } from '@vapour/types';
import ExcelUploadDialog from '@/components/procurement/ExcelUploadDialog';
import DocumentParseDialog from '@/components/procurement/DocumentParseDialog';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';
import ServicePickerDialog from '@/components/services/ServicePickerDialog';
import type { Material, MaterialVariant, Service } from '@vapour/types';

interface FormData {
  type: 'PROJECT' | 'BUDGETARY' | 'INTERNAL';
  category: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy: string;
  approverId: string;
  approverName: string;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Staged attachments — queued locally during creation, uploaded after the PR doc exists
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ file: File; type: PurchaseRequestAttachmentType; description: string }>
  >([]);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialPickerIndex, setMaterialPickerIndex] = useState<number>(0);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerIndex, setServicePickerIndex] = useState<number>(0);
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
    approverId: '',
    approverName: '',
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

  const handleDocumentImport = (importedItems: CreatePurchaseRequestItemInput[]) => {
    setLineItems(importedItems);
    setDocumentDialogOpen(false);
  };

  const handleMaterialSelect = (
    material: Material,
    _variant?: MaterialVariant,
    fullCode?: string
  ) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[materialPickerIndex];
    if (item) {
      updatedItems[materialPickerIndex] = {
        ...item,
        description: material.name,
        specification: fullCode || material.materialCode || '',
        unit: (material.baseUnit || 'NOS').toUpperCase(),
        materialId: material.id,
        materialCode: material.materialCode,
        materialName: material.name,
      };
      setLineItems(updatedItems);
    }
    setMaterialPickerOpen(false);
  };

  const handleServiceSelect = (service: Service) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[servicePickerIndex];
    if (item) {
      updatedItems[servicePickerIndex] = {
        ...item,
        itemType: 'SERVICE',
        description: service.name,
        specification: service.description || '',
        unit: (service.unit || 'NOS').toUpperCase(),
        serviceId: service.id,
        serviceCode: service.serviceCode,
        serviceName: service.name,
        serviceCategory: service.category,
        turnaroundDays: service.estimatedTurnaroundDays,
        testMethodStandard: service.testMethodStandard,
        sampleRequirements: service.sampleRequirements,
      };
      setLineItems(updatedItems);
    }
    setServicePickerOpen(false);
  };

  const isServiceCategory = formData.category === 'SERVICE';

  const validateForm = (requireApprover: boolean = false): boolean => {
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

    // Validate approver is selected when submitting for approval
    if (requireApprover && !formData.approverId) {
      setError('Please select an approver before submitting for approval');
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

  const buildInput = (): CreatePurchaseRequestInput => {
    // Auto-generate description from line items (first 3 items summarized)
    const validItems = lineItems.filter((item) => item.description.trim() !== '');
    const itemSummary = validItems
      .slice(0, 3)
      .map((item) => item.description.trim())
      .join(', ');
    const autoDescription =
      validItems.length > 3
        ? `${itemSummary}, and ${validItems.length - 3} more item(s)`
        : itemSummary;

    return {
      type: formData.type,
      category: formData.category,
      projectId: formData.projectId,
      projectName: formData.projectName,
      title: formData.title,
      description: autoDescription,
      priority: formData.priority,
      requiredBy: formData.requiredBy ? new Date(formData.requiredBy) : undefined,
      items: validItems,
      ...(formData.approverId && { approverId: formData.approverId }),
      ...(formData.approverName && { approverName: formData.approverName }),
    };
  };

  /**
   * Upload each pending attachment sequentially after the PR document exists.
   * A failure on one attachment is logged but doesn't abort the PR flow —
   * the user can still retry from the detail page.
   */
  const uploadPendingAttachments = async (prId: string): Promise<void> => {
    if (!user || pendingAttachments.length === 0) return;
    const userName = user.displayName || user.email || 'Unknown';
    for (const entry of pendingAttachments) {
      try {
        await uploadPRAttachment(
          prId,
          entry.file,
          entry.type,
          user.uid,
          userName,
          undefined,
          entry.description || undefined
        );
      } catch (err) {
        console.error('[NewPurchaseRequest] Failed to upload attachment', {
          fileName: entry.file.name,
          error: err,
        });
      }
    }
  };

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
      await uploadPendingAttachments(result.prId);
      router.push('/procurement/purchase-requests/' + result.prId + '/edit');
    } catch (err) {
      console.error('[NewPurchaseRequest] Error saving draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !validateForm(true)) return; // true = require approver

    setSubmitting(true);
    setError(null);

    try {
      const result = await createPurchaseRequest(
        buildInput(),
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      await uploadPendingAttachments(result.prId);

      await submitPurchaseRequestForApproval(
        result.prId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        claims?.permissions ?? 0
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
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Purchase Requests', href: '/procurement/purchase-requests' },
            { label: 'New' },
          ]}
        />

        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={() => router.back()} aria-label="Go back">
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4">New Purchase Request</Typography>
              <Typography variant="body2" color="text.secondary">
                Create a new purchase request for approval
              </Typography>
            </Box>
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

            {(formData.type === 'PROJECT' || formData.type === 'BUDGETARY') && (
              <ProjectSelector
                value={formData.projectId}
                onChange={handleProjectSelect}
                required={formData.type === 'PROJECT'}
              />
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

            <ApproverSelector
              value={formData.approverId || null}
              onChange={(userId) => handleInputChange('approverId', userId || '')}
              onChangeWithName={(userId, displayName) => {
                handleInputChange('approverId', userId || '');
                handleInputChange('approverName', displayName || '');
              }}
              label="Approver"
              approvalType="pr"
              helperText="Select who should approve this purchase request"
              excludeUserIds={user ? [user.uid] : []}
              required
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
                startIcon={<DescriptionIcon />}
                onClick={() => setDocumentDialogOpen(true)}
                size="small"
              >
                Import PDF
              </Button>
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
                        <Stack direction="row" spacing={0.5} alignItems="flex-start">
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
                          <Tooltip
                            title={
                              isServiceCategory
                                ? 'Pick from Services Catalog'
                                : 'Pick from Materials DB'
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (isServiceCategory) {
                                  setServicePickerIndex(index);
                                  setServicePickerOpen(true);
                                } else {
                                  setMaterialPickerIndex(index);
                                  setMaterialPickerOpen(true);
                                }
                              }}
                              sx={{ mt: 0.25 }}
                              aria-label="Search"
                            >
                              <SearchIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                        {item.materialCode && (
                          <Chip
                            label={item.materialCode}
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        {item.serviceCode && (
                          <Chip
                            label={item.serviceCode}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            sx={{ mt: 0.5 }}
                          />
                        )}
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
                          {isServiceCategory && [
                            <MenuItem key="PER TEST" value="PER TEST">
                              PER TEST
                            </MenuItem>,
                            <MenuItem key="PER SAMPLE" value="PER SAMPLE">
                              PER SAMPLE
                            </MenuItem>,
                            <MenuItem key="PER DAY" value="PER DAY">
                              PER DAY
                            </MenuItem>,
                            <MenuItem key="LUMP SUM" value="LUMP SUM">
                              LUMP SUM
                            </MenuItem>,
                            <MenuItem key="PER HOUR" value="PER HOUR">
                              PER HOUR
                            </MenuItem>,
                          ]}
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
                          aria-label="Remove"
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

        {/* Attachments — staged locally, uploaded after the PR is created */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <UploadIcon color="primary" />
            <Typography variant="h6">Attachments</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Queue files here — technical specs, datasheets, drawings, and so on. They will be
            uploaded against the PR as soon as it is created.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'flex-end' }}
            sx={{ mb: 2 }}
          >
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadIcon />}
              disabled={isProcessing}
            >
              Choose Files
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  setPendingAttachments((prev) => [
                    ...prev,
                    ...files.map((file) => ({
                      file,
                      type: 'TECHNICAL_SPEC' as PurchaseRequestAttachmentType,
                      description: '',
                    })),
                  ]);
                  e.target.value = '';
                }}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Max 25 MB per file · PDF, Word, Excel, images, CAD
            </Typography>
          </Stack>
          {pendingAttachments.length > 0 && (
            <Stack spacing={1}>
              {pendingAttachments.map((entry, idx) => (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {entry.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(entry.file.size / 1024).toFixed(1)} KB · {entry.file.type || 'unknown'}
                    </Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    label="Type"
                    value={entry.type}
                    onChange={(e) =>
                      setPendingAttachments((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? { ...p, type: e.target.value as PurchaseRequestAttachmentType }
                            : p
                        )
                      )
                    }
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="TECHNICAL_SPEC">Technical Spec</MenuItem>
                    <MenuItem value="DATA_SHEET">Data Sheet</MenuItem>
                    <MenuItem value="DRAWING">Drawing</MenuItem>
                    <MenuItem value="QUOTATION">Quotation</MenuItem>
                    <MenuItem value="OTHER">Other</MenuItem>
                  </TextField>
                  <TextField
                    size="small"
                    label="Description"
                    value={entry.description}
                    onChange={(e) =>
                      setPendingAttachments((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p))
                      )
                    }
                    sx={{ minWidth: 200 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    disabled={isProcessing}
                    aria-label="Remove"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ))}
            </Stack>
          )}
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

      {/* Document Parse Dialog (PDF/DOC) */}
      <DocumentParseDialog
        open={documentDialogOpen}
        onClose={() => setDocumentDialogOpen(false)}
        onItemsImported={handleDocumentImport}
        projectName={formData.projectName || undefined}
      />

      {/* Material Picker Dialog */}
      <MaterialPickerDialog
        open={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        onSelect={handleMaterialSelect}
        title="Select Material for Line Item"
        requireVariantSelection={false}
      />

      {/* Service Picker Dialog */}
      <ServicePickerDialog
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        onSelect={handleServiceSelect}
      />
    </Box>
  );
}
