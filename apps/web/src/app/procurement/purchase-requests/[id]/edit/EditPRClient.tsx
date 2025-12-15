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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';
import type { PurchaseRequest } from '@vapour/types';
import {
  getPurchaseRequestById,
  getPurchaseRequestItems,
  submitPurchaseRequestForApproval,
} from '@/lib/procurement/purchaseRequest';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { doc, collection, Timestamp, writeBatch } from 'firebase/firestore';

interface LineItemFormData {
  id?: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  equipmentCode: string;
  estimatedUnitCost: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

export default function EditPRPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prId, setPrId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    type: 'PROJECT' as 'PROJECT' | 'BUDGETARY' | 'INTERNAL',
    category: 'RAW_MATERIAL' as 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT',
    projectId: '',
    projectName: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    requiredBy: '',
    approverId: '', // User ID of the selected approver
  });

  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);

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
      const [prData, itemsData] = await Promise.all([
        getPurchaseRequestById(prId),
        getPurchaseRequestItems(prId),
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

      // Populate form data
      setFormData({
        type: prData.type,
        category: prData.category,
        projectId: prData.projectId || '',
        projectName: prData.projectName || '',
        title: prData.title,
        description: prData.description,
        priority: prData.priority,
        requiredBy: prData.requiredBy?.toDate?.()?.toISOString().split('T')[0] || '',
        approverId: prData.approverId || '',
      });

      // Populate line items
      setLineItems(
        itemsData.map((item) => ({
          id: item.id,
          description: item.description,
          specification: item.specification || '',
          quantity: item.quantity,
          unit: item.unit,
          equipmentCode: item.equipmentCode || '',
          estimatedUnitCost: item.estimatedUnitCost || 0,
        }))
      );
    } catch (err) {
      console.error('[EditPRPage] Error loading PR:', err);
      setError('Failed to load Purchase Request');
    } finally {
      setLoading(false);
    }
  };

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
    setLineItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item) {
        updated[index] = { ...item, [field]: value };
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

  const handleSave = async (submitForApproval: boolean = false) => {
    if (!user || !pr) return;

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    if (formData.type === 'PROJECT' && !formData.projectId) {
      setError('Please select a project');
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
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { db } = getFirebase();
      const batch = writeBatch(db);
      const now = Timestamp.now();

      // Update PR header
      const prRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, pr.id);
      batch.update(prRef, {
        type: formData.type,
        category: formData.category,
        ...(formData.projectId && { projectId: formData.projectId }),
        ...(formData.projectName && { projectName: formData.projectName }),
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        ...(formData.requiredBy && {
          requiredBy: Timestamp.fromDate(new Date(formData.requiredBy)),
        }),
        ...(formData.approverId && { approverId: formData.approverId }),
        itemCount: activeItems.length,
        updatedAt: now,
        updatedBy: user.uid,
      });

      // Process line items - track line number separately for non-deleted items
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
            quantity: item.quantity,
            unit: item.unit,
            ...(item.equipmentCode && { equipmentCode: item.equipmentCode }),
            ...(item.estimatedUnitCost > 0 && {
              estimatedUnitCost: item.estimatedUnitCost,
              estimatedTotalCost: item.estimatedUnitCost * item.quantity,
            }),
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
            quantity: item.quantity,
            unit: item.unit,
            equipmentCode: item.equipmentCode || null,
            estimatedUnitCost: item.estimatedUnitCost || null,
            estimatedTotalCost:
              item.estimatedUnitCost > 0 ? item.estimatedUnitCost * item.quantity : null,
            updatedAt: now,
          });
        }
      }

      await batch.commit();

      if (submitForApproval) {
        await submitPurchaseRequestForApproval(
          pr.id,
          user.uid,
          user.displayName || user.email || 'Unknown'
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
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/purchase-requests')}
          sx={{ mt: 2 }}
        >
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
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push(`/procurement/purchase-requests/${prId}`)}
              sx={{ mb: 1 }}
            >
              Back to Details
            </Button>
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
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSave(true)}
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
              <ProjectSelector value={formData.projectId} onChange={handleProjectSelect} required />
            )}

            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={3}
              fullWidth
              required
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
              />
            </Stack>

            <ApproverSelector
              value={formData.approverId || null}
              onChange={(userId) => handleInputChange('approverId', userId || '')}
              label="Approver"
              approvalType="pr"
              helperText="Select who should approve this purchase request"
              excludeUserIds={user ? [user.uid] : []}
            />
          </Stack>
        </Paper>

        {/* Line Items */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Line Items</Typography>
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
                          <TextField
                            size="small"
                            fullWidth
                            value={item.description}
                            onChange={(e) =>
                              handleLineItemChange(index, 'description', e.target.value)
                            }
                            placeholder="Item description"
                          />
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
      </Stack>
    </Box>
  );
}
