'use client';

/**
 * Edit Purchase Request Page
 *
 * Edit an existing purchase request
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Home as HomeIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { PRLinkageSelector, type PRLinkage } from '@/components/procurement/PRLinkageSelector';
import { SubmitPRForApprovalDialog } from '@/components/procurement/SubmitPRForApprovalDialog';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import CatalogPickerDialog, {
  type CatalogSelection,
} from '@/components/catalog/CatalogPickerDialog';
import EditLineDimensionsDialog from '@/components/materials/EditLineDimensionsDialog';
import { formatLineDimensions, withQuantity } from '@/lib/catalog/lineDimensions';
import type {
  PurchaseRequest,
  PurchaseRequestAttachment,
  PurchaseRequestItem,
  PurchaseRequestCategory,
  PurchaseRequestRaisedFor,
  CatalogLineDimensions,
  CatalogRef,
} from '@vapour/types';
import { catalogKindToItemType } from '@vapour/types';
import {
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PURCHASE_REQUEST_RAISED_FOR_LABELS,
  PURCHASE_REQUEST_BUDGETARY_LABEL,
} from '@vapour/constants';
import {
  getPurchaseRequestById,
  getPurchaseRequestItems,
  getPRAttachments,
  submitPurchaseRequestForApproval,
} from '@/lib/procurement/purchaseRequest';
import PRAttachmentUpload from '@/components/procurement/PRAttachmentUpload';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { doc, collection, Timestamp, writeBatch } from 'firebase/firestore';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { purchaseRequestStateMachine } from '@/lib/workflow/stateMachines';

/**
 * Restore the unified catalogRef from a saved line (rule 22). Lines saved
 * before Phase 2 carry only the legacy per-kind ids — synthesize the ref from
 * them so saving the PR backfills catalogRef (migrate-on-write, design
 * 2026-06-15 §5 back-compat).
 */
function resolveCatalogRef(item: PurchaseRequestItem): CatalogRef | undefined {
  if (item.catalogRef) return item.catalogRef;
  if (item.serviceId) {
    return {
      kind: 'SERVICE',
      id: item.serviceId,
      code: item.serviceCode ?? '',
      name: item.serviceName ?? '',
    };
  }
  if (item.boughtOutItemId) {
    return {
      kind: 'BOUGHT_OUT',
      id: item.boughtOutItemId,
      code: item.boughtOutItemCode ?? '',
      name: item.boughtOutItemName ?? '',
    };
  }
  if (item.materialId) {
    return {
      kind: 'RAW_MATERIAL',
      id: item.materialId,
      code: item.materialCode ?? '',
      name: item.materialName ?? '',
    };
  }
  return undefined;
}

interface LineItemFormData {
  id?: string;
  description: string;
  specification: string;
  /** Structured plate size; when set, `quantity` is a piece count. */
  dimensions?: CatalogLineDimensions;
  quantity: number;
  unit: string;
  equipmentCode: string;
  estimatedUnitCost: number;
  materialId?: string;
  materialCode?: string;
  materialName?: string;
  boughtOutItemId?: string;
  boughtOutItemCode?: string;
  boughtOutItemName?: string;
  itemType?: 'MATERIAL' | 'BOUGHT_OUT' | 'SERVICE';
  /** Unified catalog linkage — written alongside the legacy per-kind ids. */
  catalogRef?: CatalogRef;
  serviceId?: string;
  serviceCode?: string;
  serviceName?: string;
  serviceCategory?: string;
  turnaroundDays?: number;
  testMethodStandard?: string;
  sampleRequirements?: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export default function EditPRPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, claims } = useAuth();
  const { confirm } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prId, setPrId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    raisedFor: PurchaseRequestRaisedFor;
    category: PurchaseRequestCategory;
    isBudgetary: boolean;
    linkage: PRLinkage;
    title: string;
    description: string;
    requiredBy: string;
  }>({
    raisedFor: 'PROJECT',
    category: 'RAW_MATERIAL',
    isBudgetary: false,
    linkage: {},
    title: '',
    description: '',
    requiredBy: '',
  });

  // Approver is asked for by the submit dialog, not the form (rule: a draft
  // never needs one).
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);
  // Row whose dimensions are being adjusted after the fact, or null.
  const [dimensionsRowIndex, setDimensionsRowIndex] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<PurchaseRequestAttachment[]>([]);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [catalogPickerIndex, setCatalogPickerIndex] = useState<number>(0);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/purchase-requests\/([^/]+)\/edit/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setPrId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (prId) {
      loadPR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prId]);

  const loadPR = async () => {
    if (!prId) return;
    setLoading(true);
    setError(null);
    try {
      const [prData, itemsData, attachmentsData] = await Promise.all([
        getPurchaseRequestById(prId),
        getPurchaseRequestItems(prId),
        getPRAttachments(prId),
      ]);

      if (!prData) {
        setError('Purchase Request not found');
        return;
      }

      // Check if PR can be edited
      if (prData.status !== 'DRAFT' && prData.status !== 'REJECTED') {
        setError('This Purchase Request cannot be edited in its current status');
        return;
      }

      setPr(prData);

      // Populate form data — every saved field is restored, including the
      // linkage triple that matches raisedFor (rule 22).
      setFormData({
        raisedFor: prData.raisedFor,
        category: prData.category,
        isBudgetary: prData.isBudgetary === true,
        linkage: {
          ...(prData.projectId && {
            projectId: prData.projectId,
            projectName: prData.projectName,
          }),
          ...(prData.proposalId && {
            proposalId: prData.proposalId,
            proposalNumber: prData.proposalNumber,
          }),
          ...(prData.costCentreId && {
            costCentreId: prData.costCentreId,
            costCentreCode: prData.costCentreCode,
          }),
        },
        title: prData.title,
        description: prData.description,
        requiredBy: prData.requiredBy?.toDate?.()?.toISOString().split('T')[0] || '',
      });

      // Populate line items
      setLineItems(
        itemsData.map((item) => ({
          id: item.id,
          description: item.description,
          specification: item.specification || '',
          dimensions: item.dimensions,
          quantity: item.quantity,
          unit: item.unit,
          equipmentCode: item.equipmentCode || '',
          estimatedUnitCost: item.estimatedUnitCost || 0,
          catalogRef: resolveCatalogRef(item),
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          boughtOutItemId: item.boughtOutItemId,
          boughtOutItemCode: item.boughtOutItemCode,
          boughtOutItemName: item.boughtOutItemName,
          serviceId: item.serviceId,
          serviceCode: item.serviceCode,
          serviceName: item.serviceName,
          serviceCategory: item.serviceCategory,
          turnaroundDays: item.turnaroundDays,
          testMethodStandard: item.testMethodStandard,
          sampleRequirements: item.sampleRequirements,
        }))
      );

      // Populate attachments
      setAttachments(attachmentsData);
    } catch (err) {
      console.error('[EditPRPage] Error loading PR:', err);
      setError('Failed to load Purchase Request');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
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
   * request cannot hold a bought-out reference. Confirm before discarding.
   */
  const handleCategoryChange = async (category: PurchaseRequestCategory) => {
    if (category === formData.category) return;

    const linkedCount = lineItems.filter(
      (item) => !item.isDeleted && (item.materialId || item.boughtOutItemId || item.serviceId)
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
    setLineItems((prev) =>
      prev.map((item) =>
        item.isDeleted
          ? item
          : {
              ...item,
              catalogRef: undefined,
              dimensions: undefined,
              materialId: undefined,
              materialCode: undefined,
              materialName: undefined,
              boughtOutItemId: undefined,
              boughtOutItemCode: undefined,
              boughtOutItemName: undefined,
              serviceId: undefined,
              serviceCode: undefined,
              serviceName: undefined,
              serviceCategory: undefined,
              turnaroundDays: undefined,
              testMethodStandard: undefined,
              sampleRequirements: undefined,
            }
      )
    );
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item) {
        const next = { ...item, [field]: value };
        // Re-derive the total weight when the piece count changes (see the
        // matching note on the New PR page).
        if (field === 'quantity' && next.dimensions) {
          next.dimensions = withQuantity(next.dimensions, Number(value) || 0);
        }
        updated[index] = next;
      }
      return updated;
    });
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        description: '',
        specification: '',
        quantity: 1,
        unit: 'NOS',
        equipmentCode: '',
        estimatedUnitCost: 0,
        isNew: true,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item) {
        if (item.isNew) {
          // New items can be removed directly
          return prev.filter((_, i) => i !== index);
        } else {
          // Existing items are marked for deletion
          updated[index] = { ...item, isDeleted: true };
        }
      }
      return updated;
    });
  };

  /**
   * The picker is locked to the request's one category, so the selection can
   * only be of that kind. Writes the legacy per-kind fields PLUS the unified
   * catalogRef (rule 26).
   */
  const handleCatalogSelect = (selection: CatalogSelection) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = updated[catalogPickerIndex];
      if (item) {
        const cleared: LineItemFormData = {
          ...item,
          catalogRef: selection.ref,
          dimensions: undefined,
          materialId: undefined,
          materialCode: undefined,
          materialName: undefined,
          boughtOutItemId: undefined,
          boughtOutItemCode: undefined,
          boughtOutItemName: undefined,
          serviceId: undefined,
          serviceCode: undefined,
          serviceName: undefined,
          serviceCategory: undefined,
          turnaroundDays: undefined,
          testMethodStandard: undefined,
          sampleRequirements: undefined,
        };
        const { source } = selection;
        if (source.kind === 'RAW_MATERIAL') {
          const { material, fullCode } = source;
          // A sized plate arrives with its piece count; an unsized material
          // keeps asking in its own base unit.
          const sized = selection.dimensions;
          updated[catalogPickerIndex] = {
            ...cleared,
            description: material.name,
            // Show the material's real spec, not the code (feedback CxERG78).
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
          updated[catalogPickerIndex] = {
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
          updated[catalogPickerIndex] = {
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
      }
      return updated;
    });
    setCatalogPickerOpen(false);
  };

  // The picker is locked to the request's one category — no tab choice per row.
  const openPickerForRow = (index: number) => {
    if (!lineItems[index]) return;
    setCatalogPickerIndex(index);
    setCatalogPickerOpen(true);
  };

  const handleSave = async (approver?: { id: string; name: string }) => {
    if (!user || !pr) return;
    const submitForApproval = Boolean(approver);

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (formData.raisedFor === 'PROJECT' && !formData.linkage.projectId) {
      setError('Please select the project this request is raised for');
      return;
    }
    if (formData.raisedFor === 'PROPOSAL' && !formData.linkage.proposalId) {
      setError('Please select the proposal this request is raised for');
      return;
    }
    if (formData.raisedFor === 'INTERNAL' && !formData.linkage.costCentreId) {
      setError(
        'The administration cost centre could not be found, so this internal request cannot be charged anywhere.'
      );
      return;
    }

    const activeItems = lineItems.filter((item) => !item.isDeleted);
    if (activeItems.length === 0) {
      setError('At least one line item is required');
      return;
    }

    for (let i = 0; i < activeItems.length; i++) {
      const item = activeItems[i];
      if (!item?.description.trim()) {
        setError(`Line ${i + 1}: Description is required`);
        return;
      }
      if (item.quantity <= 0) {
        setError(`Line ${i + 1}: Quantity must be greater than 0`);
        return;
      }
      // Every line needs the catalog link its category implies (rule 23).
      const missingLink =
        (formData.category === 'SERVICE' && !item.serviceId) ||
        (formData.category === 'BOUGHT_OUT' && !item.boughtOutItemId) ||
        (formData.category === 'RAW_MATERIAL' && !item.materialId);
      if (missingLink) {
        setError(
          `Line ${i + 1}: Please pick a ${PURCHASE_REQUEST_CATEGORY_LABELS[
            formData.category
          ].toLowerCase()} item from the catalog.`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { db } = getFirebase();
      const batch = writeBatch(db);
      const now = Timestamp.now();

      // Auto-generate description from line items
      const validItems = activeItems.filter((item) => item.description.trim());
      const itemSummary = validItems
        .slice(0, 3)
        .map((item) => item.description.trim())
        .join(', ');
      const autoDescription =
        validItems.length > 3
          ? `${itemSummary}, and ${validItems.length - 3} more item(s)`
          : itemSummary;

      // Update PR header
      const prRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, pr.id);
      // Exactly one linkage triple survives a save — the others are nulled so
      // switching what the PR is raised for cannot leave a stale project on it.
      const { linkage } = formData;

      // Saving a REJECTED PR revives it as a DRAFT (feedback
      // EIJ6u3qCGvNjJR0PDDFT) — the edit page admits rejected PRs precisely
      // so they can be revised and resubmitted; without the transition the PR
      // stayed under Rejected and Save & Submit was refused.
      const revivingRejected = pr.status === 'REJECTED';
      if (revivingRejected) {
        requireValidTransition(purchaseRequestStateMachine, pr.status, 'DRAFT', 'PurchaseRequest');
      }

      batch.update(prRef, {
        raisedFor: formData.raisedFor,
        category: formData.category,
        isBudgetary: formData.isBudgetary,
        projectId: linkage.projectId ?? null,
        projectName: linkage.projectName ?? null,
        proposalId: linkage.proposalId ?? null,
        proposalNumber: linkage.proposalNumber ?? null,
        costCentreId: linkage.costCentreId ?? null,
        costCentreCode: linkage.costCentreCode ?? null,
        title: formData.title,
        description: autoDescription,
        ...(formData.requiredBy && {
          requiredBy: Timestamp.fromDate(new Date(formData.requiredBy)),
        }),
        ...(approver && { approverId: approver.id, approverName: approver.name }),
        ...(revivingRejected && {
          status: 'DRAFT',
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
          reviewedByName: null,
        }),
        itemCount: activeItems.length,
        updatedAt: now,
        updatedBy: user.uid,
      });

      // Process line items - track line number separately for non-deleted items.
      // rule20-exempt: bounded by line items on a single PR (UI typical < 50).
      let lineNumber = 0;
      for (const item of lineItems) {
        if (item.isDeleted && item.id) {
          // Delete existing item
          const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
          batch.delete(itemRef);
        } else if (item.isNew && !item.isDeleted) {
          // Add new item
          lineNumber++;
          const newItemRef = doc(collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS));
          batch.set(newItemRef, {
            purchaseRequestId: pr.id,
            lineNumber,
            description: item.description,
            ...(item.specification && { specification: item.specification }),
            ...(item.dimensions && { dimensions: item.dimensions }),
            quantity: item.quantity,
            unit: item.unit,
            ...(item.equipmentCode && { equipmentCode: item.equipmentCode }),
            ...(item.estimatedUnitCost > 0 && {
              estimatedUnitCost: item.estimatedUnitCost,
              estimatedTotalCost: item.estimatedUnitCost * item.quantity,
            }),
            // Item kind follows the request's category, not the row.
            itemType: catalogKindToItemType(formData.category),
            ...(item.catalogRef && { catalogRef: item.catalogRef }),
            ...(item.materialId && { materialId: item.materialId }),
            ...(item.materialCode && { materialCode: item.materialCode }),
            ...(item.materialName && { materialName: item.materialName }),
            ...(item.boughtOutItemId && { boughtOutItemId: item.boughtOutItemId }),
            ...(item.boughtOutItemCode && { boughtOutItemCode: item.boughtOutItemCode }),
            ...(item.boughtOutItemName && { boughtOutItemName: item.boughtOutItemName }),
            ...(item.serviceId && { serviceId: item.serviceId }),
            ...(item.serviceCode && { serviceCode: item.serviceCode }),
            ...(item.serviceName && { serviceName: item.serviceName }),
            ...(item.serviceCategory && { serviceCategory: item.serviceCategory }),
            ...(item.turnaroundDays && { turnaroundDays: item.turnaroundDays }),
            ...(item.testMethodStandard && { testMethodStandard: item.testMethodStandard }),
            ...(item.sampleRequirements && { sampleRequirements: item.sampleRequirements }),
            attachmentCount: 0,
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
          });
        } else if (item.id && !item.isDeleted) {
          // Update existing item
          lineNumber++;
          const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
          batch.update(itemRef, {
            lineNumber,
            description: item.description,
            specification: item.specification || null,
            dimensions: item.dimensions || null,
            quantity: item.quantity,
            unit: item.unit,
            equipmentCode: item.equipmentCode || null,
            estimatedUnitCost: item.estimatedUnitCost || null,
            estimatedTotalCost:
              item.estimatedUnitCost > 0 ? item.estimatedUnitCost * item.quantity : null,
            itemType: catalogKindToItemType(formData.category),
            catalogRef: item.catalogRef || null,
            materialId: item.materialId || null,
            materialCode: item.materialCode || null,
            materialName: item.materialName || null,
            boughtOutItemId: item.boughtOutItemId || null,
            boughtOutItemCode: item.boughtOutItemCode || null,
            boughtOutItemName: item.boughtOutItemName || null,
            serviceId: item.serviceId || null,
            serviceCode: item.serviceCode || null,
            serviceName: item.serviceName || null,
            serviceCategory: item.serviceCategory || null,
            turnaroundDays: item.turnaroundDays || null,
            testMethodStandard: item.testMethodStandard || null,
            sampleRequirements: item.sampleRequirements || null,
            // Rejection marks every line item REJECTED — reviving the PR
            // must reset them or the items stay rejected inside a draft
            ...(revivingRejected && { status: 'PENDING' }),
            updatedAt: now,
          });
        }
      }

      await batch.commit();

      if (submitForApproval) {
        await submitPurchaseRequestForApproval(
          pr.id,
          user.uid,
          user.displayName || user.email || 'Unknown',
          claims?.permissions ?? 0
        );
        setSuccess('Purchase Request updated and submitted for approval');
        setTimeout(() => {
          router.push(`/procurement/purchase-requests/${pr.id}`);
        }, 1500);
      } else {
        setSuccess('Purchase Request updated successfully');
        // Reload to refresh line item IDs
        await loadPR();
      }
    } catch (err) {
      console.error('[EditPRPage] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !pr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => router.push('/procurement/purchase-requests')} sx={{ mt: 2 }}>
          Back to Purchase Requests
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <PageBreadcrumbs
              items={[
                { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
                { label: 'Purchase Requests', href: '/procurement/purchase-requests' },
                {
                  label: pr?.number ?? prId ?? '',
                  href: `/procurement/purchase-requests/${prId ?? ''}`,
                },
                { label: 'Edit' },
              ]}
            />
            <Typography variant="h4" gutterBottom>
              Edit {pr?.number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Make changes to your purchase request
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => router.push(`/procurement/purchase-requests/${prId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => setSubmitDialogOpen(true)}
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Save & Submit'}
            </Button>
          </Stack>
        </Stack>

        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Basic Information */}
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
                required
                sx={{ flex: 2 }}
              />

              <TextField
                label="Required By Date"
                type="date"
                value={formData.requiredBy}
                onChange={(e) => handleInputChange('requiredBy', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </Paper>

        {/* Line Items */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h6">Line Items</Typography>
              <Chip
                label={PURCHASE_REQUEST_CATEGORY_LABELS[formData.category]}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Button startIcon={<AddIcon />} onClick={handleAddLineItem} size="small">
              Add Item
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Description *</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell sx={{ width: 100 }}>Qty *</TableCell>
                  <TableCell sx={{ width: 100 }}>Unit *</TableCell>
                  <TableCell>Equipment Code</TableCell>
                  <TableCell sx={{ width: 120 }}>Est. Unit Cost</TableCell>
                  <TableCell sx={{ width: 60 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.filter((item) => !item.isDeleted).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No line items. Click &quot;Add Item&quot; to add one.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => !item.isDeleted)
                    .map(({ item, index }, displayIndex) => (
                      <TableRow key={item.id || `new-${index}`}>
                        <TableCell>{displayIndex + 1}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="flex-start">
                            <TextField
                              size="small"
                              fullWidth
                              value={item.description}
                              onChange={(e) =>
                                handleLineItemChange(index, 'description', e.target.value)
                              }
                              placeholder="Item description"
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
                          {item.materialCode && (
                            <Chip
                              label={item.materialCode}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {/* Sized plate — click to adjust without re-picking. */}
                          {item.dimensions && (
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
                          {item.boughtOutItemCode && (
                            <Chip
                              label={item.boughtOutItemCode}
                              size="small"
                              variant="outlined"
                              color="info"
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
                            size="small"
                            fullWidth
                            value={item.specification}
                            onChange={(e) =>
                              handleLineItemChange(index, 'specification', e.target.value)
                            }
                            placeholder="Specification"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            fullWidth
                            value={item.quantity}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                'quantity',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={item.unit}
                            onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                            placeholder="NOS"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={item.equipmentCode}
                            onChange={(e) =>
                              handleLineItemChange(index, 'equipmentCode', e.target.value)
                            }
                            placeholder="Equipment code"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            fullWidth
                            value={item.estimatedUnitCost || ''}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                'estimatedUnitCost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveLineItem(index)}
                            aria-label="Remove"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Attachments */}
        {prId && (
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <AttachFileIcon color="action" />
              <Typography variant="h6">Attachments ({attachments.length})</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <PRAttachmentUpload
              prId={prId}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={saving}
            />

            {attachments.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', py: 2 }}
              >
                No attachments uploaded yet. Add technical specs, datasheets, or drawings to support
                this purchase request.
              </Typography>
            )}
          </Paper>
        )}
      </Stack>

      {/* Unified Catalog Picker — Materials / Bought-Out / Services as tabs */}
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
        onConfirm={async (approverId, approverName) => {
          await handleSave({ id: approverId, name: approverName });
          setSubmitDialogOpen(false);
        }}
        prNumber={pr?.number}
        excludeUserIds={user ? [user.uid] : []}
      />
    </Box>
  );
}
