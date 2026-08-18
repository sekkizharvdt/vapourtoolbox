'use client';

/**
 * Create Purchase Request Page (Optimized Single-Page Form)
 *
 * Consolidated single-page form to create purchase requests with all sections visible
 */

import { Fragment, useEffect, useState } from 'react';
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
  Checkbox,
  FormControlLabel,
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
  clearCatalogLinks,
  type CreatePurchaseRequestInput,
  type CreatePurchaseRequestItemInput,
} from '@/lib/procurement/purchaseRequest';
import type {
  Material,
  MaterialCategory,
  PurchaseRequestAttachmentType,
  PurchaseRequestCategory,
  PurchaseRequestRaisedFor,
} from '@vapour/types';
import {
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PURCHASE_REQUEST_RAISED_FOR_LABELS,
  PURCHASE_REQUEST_BUDGETARY_LABEL,
} from '@vapour/constants';
import ExcelUploadDialog from '@/components/procurement/ExcelUploadDialog';
import DocumentParseDialog from '@/components/procurement/DocumentParseDialog';
import { PRLinkageSelector, type PRLinkage } from '@/components/procurement/PRLinkageSelector';
import { SubmitPRForApprovalDialog } from '@/components/procurement/SubmitPRForApprovalDialog';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import CatalogPickerDialog, {
  type CatalogSelection,
} from '@/components/catalog/CatalogPickerDialog';
import EditLineDimensionsDialog from '@/components/materials/EditLineDimensionsDialog';
import InlineMaterialSelector, {
  EMPTY_INLINE_STATE,
  resolveInlineSelection,
  type InlineSelectorState,
} from '@/components/materials/InlineMaterialSelector';
import { getRawMaterialKinds } from '@/lib/catalog/inlineSizing';
import { queryMaterials } from '@/lib/materials/materialService';
import { getFirebase } from '@/lib/firebase';
import { formatLineDimensions, withQuantity } from '@/lib/catalog/lineDimensions';

interface FormData {
  raisedFor: PurchaseRequestRaisedFor;
  category: PurchaseRequestCategory;
  isBudgetary: boolean;
  linkage: PRLinkage;
  title: string;
  requiredBy: string;
}

/** Values of the fixed Unit dropdown options below (SERVICE extras included). */
const PR_UNIT_VALUES = [
  'NOS',
  'KG',
  'METER',
  'LITER',
  'BOX',
  'SET',
  'UNIT',
  'PER TEST',
  'PER SAMPLE',
  'PER DAY',
  'LUMP SUM',
  'PER HOUR',
];

/**
 * Map common Excel/parsed unit spellings onto the dropdown's option values
 * (feedback cwNypIpmnbcOIzeKWv7N — a value outside the option set renders as
 * a BLANK select). Unknown units are kept verbatim; the dropdown renders them
 * as an extra option so nothing imported is ever lost.
 */
function normalizeImportedUnit(raw: string): string {
  const unit = (raw ?? '').trim().toUpperCase();
  if (!unit) return 'NOS';
  const SYNONYMS: Record<string, string> = {
    EA: 'NOS',
    EACH: 'NOS',
    NO: 'NOS',
    'NO.': 'NOS',
    PCS: 'NOS',
    PC: 'NOS',
    PIECE: 'NOS',
    PIECES: 'NOS',
    KGS: 'KG',
    'KG.': 'KG',
    MTR: 'METER',
    M: 'METER',
    METERS: 'METER',
    METRE: 'METER',
    LTR: 'LITER',
    L: 'LITER',
    LITRE: 'LITER',
    LITERS: 'LITER',
    BOXES: 'BOX',
    SETS: 'SET',
  };
  return SYNONYMS[unit] ?? unit;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { confirm } = useConfirmDialog();
  const tenantId = claims?.tenantId || 'default-entity';
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Staged attachments — queued locally during creation, uploaded after the PR doc exists
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ file: File; type: PurchaseRequestAttachmentType; description: string }>
  >([]);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [catalogPickerIndex, setCatalogPickerIndex] = useState<number>(0);
  // Row whose dimensions are being adjusted after the fact, or null.
  const [dimensionsRowIndex, setDimensionsRowIndex] = useState<number | null>(null);
  // Raw materials backing the inline dropdowns (plates + pipes — the only
  // categories priced by weight or length, so the only ones small and
  // structured enough to offer without a dialog).
  const [rawMaterials, setRawMaterials] = useState<Material[]>([]);
  // Inline cascade state, one entry per line item. Kept in lockstep with
  // `lineItems` by every handler that adds, removes or replaces rows.
  const [inlineStates, setInlineStates] = useState<InlineSelectorState[]>([EMPTY_INLINE_STATE]);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    raisedFor: 'PROJECT',
    category: 'RAW_MATERIAL',
    isBudgetary: false,
    linkage: {},
    title: '',
    requiredBy: '',
  });

  // Approver is asked for by the Submit for Approval dialog, not the form —
  // a draft never needs one.
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const [lineItems, setLineItems] = useState<CreatePurchaseRequestItemInput[]>([
    { description: '', quantity: 1, unit: 'NOS', equipmentCode: '' },
  ]);

  // Load the inline-selectable raw materials once. Only plates and pipes
  // qualify (priced by KG / METER), which is ~360 documents — small enough to
  // hold and turn into dropdowns, unlike the full catalogue.
  useEffect(() => {
    if (formData.category !== 'RAW_MATERIAL' || rawMaterials.length > 0) return;
    const { db } = getFirebase();
    if (!db) return;

    let cancelled = false;
    const categories = getRawMaterialKinds().flatMap((k) => k.categories) as MaterialCategory[];
    queryMaterials(db, {
      categories,
      isActive: true,
      sortField: 'name',
      sortDirection: 'asc',
      limitResults: 500,
    })
      .then((result) => {
        if (!cancelled) setRawMaterials(result.materials);
      })
      .catch((err) => {
        // Non-fatal: the catalog picker still works, so degrade to it rather
        // than blocking the form.
        console.warn('[NewPR] inline material load failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [formData.category, rawMaterials.length]);

  /**
   * A completed inline cascade writes the same fields the picker would — the
   * two paths must produce identical line items, or downstream behaviour would
   * depend on how the user happened to choose.
   */
  const handleInlineChange = (index: number, next: InlineSelectorState) => {
    setInlineStates((prev) => prev.map((s, i) => (i === index ? next : s)));

    const resolved = resolveInlineSelection(next, rawMaterials);
    if (!resolved) return;

    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const { material } = resolved;
        return {
          ...clearCatalogLinks(item),
          catalogRef: {
            kind: 'RAW_MATERIAL' as const,
            id: material.id,
            code: material.materialCode,
            name: material.name,
          },
          description: material.name,
          specification: item.specification?.trim() ? item.specification : material.materialCode,
          materialId: material.id,
          materialCode: material.materialCode,
          materialName: material.name,
          unit: resolved.unit,
          ...(resolved.dimensions && { dimensions: resolved.dimensions }),
          ...(resolved.quantity !== undefined && { quantity: resolved.quantity }),
        };
      })
    );
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Switching what the PR is raised for invalidates whatever was linked. */
  const handleRaisedForChange = (raisedFor: PurchaseRequestRaisedFor) => {
    setFormData((prev) => ({ ...prev, raisedFor, linkage: {} }));
  };

  const handleLinkageChange = (linkage: PRLinkage) => {
    setFormData((prev) => ({ ...prev, linkage }));
  };

  /**
   * Changing the category invalidates every line's catalog link — a material
   * PR cannot hold a bought-out reference. Confirm first when there is
   * something to lose, since this clears the whole table at once.
   */
  const handleCategoryChange = async (category: PurchaseRequestCategory) => {
    if (category === formData.category) return;

    const linkedCount = lineItems.filter(
      (item) => item.materialId || item.boughtOutItemId || item.serviceId
    ).length;

    if (linkedCount > 0) {
      const confirmed = await confirm({
        title: 'Change category?',
        message:
          `This request is for ${PURCHASE_REQUEST_CATEGORY_LABELS[formData.category]}. ` +
          `Switching to ${PURCHASE_REQUEST_CATEGORY_LABELS[category]} will clear the ` +
          `${linkedCount} item${linkedCount === 1 ? '' : 's'} already picked from the catalog.`,
        confirmText: 'Change and clear items',
        confirmColor: 'error',
      });
      if (!confirmed) return;
    }

    setFormData((prev) => ({ ...prev, category }));
    setLineItems((prev) => prev.map(clearCatalogLinks));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    if (item) {
      const next = { ...item, [field]: value };
      // A sized line's total weight is derived from the piece count, so editing
      // quantity in the row must re-derive it — otherwise the chip and the
      // vendor-facing documents keep quoting the weight of the old count.
      if (field === 'quantity' && next.dimensions) {
        next.dimensions = withQuantity(next.dimensions, Number(value) || 0);
      }
      updatedItems[index] = next;
      setLineItems(updatedItems);
    }
  };

  const normalizeImportedItems = (items: CreatePurchaseRequestItemInput[]) =>
    items.map((item) => ({ ...item, unit: normalizeImportedUnit(item.unit) }));

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unit: 'NOS', equipmentCode: '' },
    ]);
    setInlineStates((prev) => [...prev, EMPTY_INLINE_STATE]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setInlineStates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExcelImport = (importedItems: CreatePurchaseRequestItemInput[]) => {
    setLineItems(normalizeImportedItems(importedItems));
    setInlineStates(importedItems.map(() => EMPTY_INLINE_STATE));
    setExcelDialogOpen(false);
  };

  const handleDocumentImport = (importedItems: CreatePurchaseRequestItemInput[]) => {
    setLineItems(normalizeImportedItems(importedItems));
    setInlineStates(importedItems.map(() => EMPTY_INLINE_STATE));
    setDocumentDialogOpen(false);
  };

  /**
   * The picker is locked to the PR's category, so the selection can only be
   * of that kind. Writes the legacy per-kind fields PLUS the unified
   * catalogRef (design 2026-06-15 §3.1, rule 26).
   */
  const handleCatalogSelect = (selection: CatalogSelection) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[catalogPickerIndex];
    if (item) {
      const cleared: CreatePurchaseRequestItemInput = {
        ...clearCatalogLinks(item),
        catalogRef: selection.ref,
      };
      const { source } = selection;
      if (source.kind === 'RAW_MATERIAL') {
        const { material, fullCode } = source;
        // A dimensioned material (plate) comes back sized: the piece count and
        // the shape/thickness/size replace "how many kg of this grade", which
        // is what the material's own baseUnit would otherwise ask for.
        const sized = selection.dimensions;
        updatedItems[catalogPickerIndex] = {
          ...cleared,
          description: material.name,
          // Auto-fill with the material's real spec (feedback CxERG78) — not
          // the code; keep the user's text if they already typed a spec.
          specification: item.specification?.trim()
            ? item.specification
            : selection.item.specification || fullCode || material.materialCode || '',
          ...(sized
            ? { dimensions: sized.dimensions, quantity: sized.quantity, unit: 'NOS' }
            : { unit: (material.baseUnit || 'NOS').toUpperCase() }),
          materialId: material.id,
          materialCode: material.materialCode,
          materialName: material.name,
        };
      } else if (source.kind === 'BOUGHT_OUT') {
        const { boughtOutItem } = source;
        updatedItems[catalogPickerIndex] = {
          ...cleared,
          description: boughtOutItem.name,
          specification: item.specification?.trim()
            ? item.specification
            : boughtOutItem.itemCode || '',
          boughtOutItemId: boughtOutItem.id,
          boughtOutItemCode: boughtOutItem.itemCode,
          boughtOutItemName: boughtOutItem.name,
        };
      } else {
        const { service } = source;
        updatedItems[catalogPickerIndex] = {
          ...cleared,
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
      }
      setLineItems(updatedItems);
    }
    setCatalogPickerOpen(false);
  };

  const isServiceCategory = formData.category === 'SERVICE';

  // The picker is locked to the PR's one category — no tab choice per row.
  const openPickerForRow = (index: number) => {
    if (!lineItems[index]) return;
    setCatalogPickerIndex(index);
    setCatalogPickerOpen(true);
  };

  const validateForm = (): boolean => {
    setError(null);

    // The linkage the request needs depends on what it is raised for.
    if (formData.raisedFor === 'PROJECT' && !formData.linkage.projectId) {
      setError('Please select the project this request is raised for');
      return false;
    }
    if (formData.raisedFor === 'PROPOSAL' && !formData.linkage.proposalId) {
      setError('Please select the proposal this request is raised for');
      return false;
    }
    if (formData.raisedFor === 'INTERNAL' && !formData.linkage.costCentreId) {
      setError(
        'The administration cost centre could not be found, so this internal request cannot be charged anywhere.'
      );
      return false;
    }
    if (!formData.title.trim()) {
      setError('Please enter title');
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
      if (!item.description.trim()) continue; // empty rows are dropped in buildInput

      if (item.quantity <= 0) {
        setError(`Line ${i + 1}: Quantity must be greater than 0`);
        return false;
      }

      // Require a master-data reference so downstream cost/stock/pricing
      // feedback loops can attach to the item. See PROCUREMENT-MATERIALS-AUDIT-2026-04-24.md #4.
      // The request carries one category, so every line needs that catalog's link.
      const missingLink =
        (formData.category === 'SERVICE' && !item.serviceId) ||
        (formData.category === 'BOUGHT_OUT' && !item.boughtOutItemId) ||
        (formData.category === 'RAW_MATERIAL' && !item.materialId);

      if (missingLink) {
        setError(
          `Line ${i + 1}: Please pick a ${PURCHASE_REQUEST_CATEGORY_LABELS[
            formData.category
          ].toLowerCase()} item from the catalog (search icon next to the description).`
        );
        return false;
      }
    }

    return true;
  };

  const buildInput = (approver?: { id: string; name: string }): CreatePurchaseRequestInput => {
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
      tenantId,
      raisedFor: formData.raisedFor,
      category: formData.category,
      isBudgetary: formData.isBudgetary,
      ...formData.linkage,
      title: formData.title,
      description: autoDescription,
      requiredBy: formData.requiredBy ? new Date(formData.requiredBy) : undefined,
      items: validItems,
      ...(approver && { approverId: approver.id, approverName: approver.name }),
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

  /** Validate first, then ask for the approver — not the other way round. */
  const handleOpenSubmitDialog = () => {
    if (!user || !validateForm()) return;
    setSubmitDialogOpen(true);
  };

  /**
   * Create the PR with its approver already set, then submit it. Errors are
   * re-thrown so the dialog shows them next to the field instead of behind it.
   */
  const handleSubmit = async (approverId: string, approverName: string) => {
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      const userName = user.displayName || user.email || 'Unknown';
      const result = await createPurchaseRequest(
        buildInput({ id: approverId, name: approverName }),
        user.uid,
        userName
      );

      await uploadPendingAttachments(result.prId);

      await submitPurchaseRequestForApproval(
        result.prId,
        user.uid,
        userName,
        claims?.permissions ?? 0
      );

      setSubmitDialogOpen(false);
      router.push('/procurement/purchase-requests/' + result.prId);
    } catch (err) {
      console.error('[NewPurchaseRequest] Error submitting:', err);
      throw err;
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
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                select
                size="small"
                label="Raised for"
                value={formData.raisedFor}
                onChange={(e) => handleRaisedForChange(e.target.value as PurchaseRequestRaisedFor)}
                required
                sx={{ minWidth: 170 }}
              >
                {Object.entries(PURCHASE_REQUEST_RAISED_FOR_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <PRLinkageSelector
                raisedFor={formData.raisedFor}
                value={formData.linkage}
                onChange={handleLinkageChange}
              />

              <TextField
                select
                size="small"
                label="Category"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value as PurchaseRequestCategory)}
                required
                sx={{ minWidth: 170 }}
                helperText="One kind per request"
              >
                {Object.entries(PURCHASE_REQUEST_CATEGORY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <FormControlLabel
                sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                control={
                  <Checkbox
                    checked={formData.isBudgetary}
                    onChange={(e) => handleInputChange('isBudgetary', e.target.checked)}
                  />
                }
                label={
                  <Tooltip title="Collect quotations for pricing only — this request can never become a purchase order.">
                    <span>{PURCHASE_REQUEST_BUDGETARY_LABEL}</span>
                  </Tooltip>
                }
              />
            </Stack>

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
                label={PURCHASE_REQUEST_CATEGORY_LABELS[formData.category]}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`${validItemsCount} item${validItemsCount !== 1 ? 's' : ''}`}
                size="small"
                color={validItemsCount > 0 ? 'primary' : 'default'}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              {/* PDF parsing only ever produces material links, so it is
                  meaningless on a bought-out or service request. */}
              {formData.category === 'RAW_MATERIAL' && (
                <Button
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={() => setDocumentDialogOpen(true)}
                  size="small"
                >
                  Import PDF
                </Button>
              )}
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
              {/* minWidth makes the container scroll horizontally instead of
                  crushing fixed columns — after an import the Description
                  column's min-content grows and the Qty number input (which
                  has no intrinsic width) collapsed to ~0px, hiding the value
                  (feedback wYDJBZDfirOyen4825aq / z5byKojWw5ViuOK9lqsk). */}
              <Table size="small" sx={{ minWidth: 1050 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={50}>#</TableCell>
                    {/* Explicit widths: these two cells hold auto-resizing
                        textareas; content-sized columns let the two resize
                        observers feed each other and freeze the page
                        (feedback eLMNBph0jKXMT261UuaR). */}
                    <TableCell width="32%">Description *</TableCell>
                    <TableCell width="26%">Specification</TableCell>
                    <TableCell width={100}>Qty *</TableCell>
                    <TableCell width={100}>Unit *</TableCell>
                    <TableCell width={140}>Equipment Code</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => {
                    // The sizing strip needs the whole table width — inside the
                    // Description cell it wrapped into six stacked controls.
                    const showInlineStrip =
                      formData.category === 'RAW_MATERIAL' && rawMaterials.length > 0;
                    return (
                      <Fragment key={index}>
                        <TableRow hover>
                          <TableCell sx={showInlineStrip ? { borderBottom: 'none' } : undefined}>
                            {index + 1}
                          </TableCell>
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
                                  formData.category === 'SERVICE'
                                    ? 'Pick from Services Catalog'
                                    : formData.category === 'BOUGHT_OUT'
                                      ? 'Pick from Bought-Out DB'
                                      : 'Pick from Materials DB'
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => openPickerForRow(index)}
                                  sx={{ mt: 0.25 }}
                                  aria-label="Search"
                                >
                                  <SearchIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                            {/* The material code and size are shown by the sizing
                            strip beneath the row, so no chips here — they
                            repeated what the controls already say. The chip
                            stays only when the strip is absent (a bought-out or
                            service line picked through the dialog). */}
                            {item.materialCode && !showInlineStrip && (
                              <Chip
                                label={item.materialCode}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                            {item.dimensions && !showInlineStrip && (
                              <Chip
                                label={`${formatLineDimensions(item.dimensions)}${
                                  item.dimensions.totalWeightKg !== undefined
                                    ? ` · ${item.dimensions.totalWeightKg} kg`
                                    : ''
                                }`}
                                size="small"
                                color="primary"
                                onClick={() => setDimensionsRowIndex(index)}
                                sx={{ mt: 0.5, ml: 0.5 }}
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
                            {item.boughtOutItemCode && (
                              <Chip
                                label={item.boughtOutItemCode}
                                size="small"
                                variant="outlined"
                                color="info"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                            {item.description.trim() &&
                              !item.materialCode &&
                              !item.serviceCode &&
                              !item.boughtOutItemCode && (
                                <Chip
                                  label={
                                    formData.category === 'SERVICE'
                                      ? 'Pick service from catalog'
                                      : formData.category === 'BOUGHT_OUT'
                                        ? 'Pick item from bought-out DB'
                                        : 'Pick material from master'
                                  }
                                  size="small"
                                  color="warning"
                                  variant="outlined"
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
                                handleLineItemChange(
                                  index,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              size="small"
                              fullWidth
                              // number inputs have no content-derived width — keep a floor
                              sx={{ minWidth: 72 }}
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
                              {/* MUI Select renders BLANK when value isn't among
                              the options — imported units (e.g. "EA", "MTR")
                              vanished that way (feedback cwNypIpmnbcOIzeKWv7N).
                              Render the current value as an extra option when
                              it's not in the fixed list. */}
                              {item.unit && !PR_UNIT_VALUES.includes(item.unit) && (
                                <MenuItem value={item.unit}>{item.unit}</MenuItem>
                              )}
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
                              sx={{ minWidth: 100 }}
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
                        {showInlineStrip && (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={5} sx={{ pt: 0 }}>
                              <InlineMaterialSelector
                                materials={rawMaterials}
                                state={inlineStates[index] ?? EMPTY_INLINE_STATE}
                                onChange={(next) => handleInlineChange(index, next)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
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
            <strong>Ready to submit?</strong> You will be asked who should approve this request. You
            can also save as draft to continue later.
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
            onClick={handleOpenSubmitDialog}
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
        projectName={formData.linkage.projectName || undefined}
      />

      {/* Catalog picker, locked to the request's one category */}
      <CatalogPickerDialog
        open={catalogPickerOpen}
        onClose={() => setCatalogPickerOpen(false)}
        onSelect={handleCatalogSelect}
        defaultKind={formData.category}
        kinds={[formData.category]}
        captureDimensions
      />

      {/* Adjust a sized line without re-picking the material */}
      {dimensionsRowIndex !== null && lineItems[dimensionsRowIndex]?.materialId && (
        <EditLineDimensionsDialog
          open
          onClose={() => setDimensionsRowIndex(null)}
          materialId={lineItems[dimensionsRowIndex].materialId}
          materialName={lineItems[dimensionsRowIndex].materialName}
          dimensions={lineItems[dimensionsRowIndex].dimensions}
          quantity={lineItems[dimensionsRowIndex].quantity}
          onSave={(dimensions, quantity) => {
            const index = dimensionsRowIndex;
            setLineItems((prev) =>
              prev.map((row, i) => (i === index ? { ...row, dimensions, quantity } : row))
            );
          }}
        />
      )}

      <SubmitPRForApprovalDialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        onConfirm={handleSubmit}
        excludeUserIds={user ? [user.uid] : []}
      />
    </Box>
  );
}
