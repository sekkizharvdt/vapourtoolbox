'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShoppingCart as CartIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { Project, ProcurementItem } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import {
  addProcurementItem,
  updateProcurementItem,
  deleteProcurementItem,
  createPRFromCharterItem,
} from '@/lib/projects/charterProcurementService';

interface ProcurementTabProps {
  project: Project;
}

interface ProcurementItemFormData {
  itemName: string;
  description: string;
  category: ProcurementItem['category'];
  quantity: string;
  unit: string;
  estimatedUnitPrice: string;
  priority: ProcurementItem['priority'];
  requiredByDate: string;
  equipmentCode: string;
  equipmentName: string;
  technicalSpecs: string;
  notes: string;
}

const EMPTY_FORM: ProcurementItemFormData = {
  itemName: '',
  description: '',
  category: 'COMPONENT',
  quantity: '',
  unit: '',
  estimatedUnitPrice: '',
  priority: 'MEDIUM',
  requiredByDate: '',
  equipmentCode: '',
  equipmentName: '',
  technicalSpecs: '',
  notes: '',
};

export function ProcurementTab({ project }: ProcurementTabProps) {
  const { claims, user } = useAuth();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProcurementItem | null>(null);
  const [formData, setFormData] = useState<ProcurementItemFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const procurementItems = project.procurementItems || [];

  const userId = user?.uid || '';
  const userName = user?.displayName || user?.email || 'Unknown';

  const handleAdd = () => {
    setSelectedItem(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (item: ProcurementItem) => {
    setSelectedItem(item);

    let requiredByDateString = '';
    if (item.requiredByDate) {
      let dateObj: Date;
      if (item.requiredByDate instanceof Date) {
        dateObj = item.requiredByDate;
      } else if (typeof item.requiredByDate === 'object' && 'toDate' in item.requiredByDate) {
        dateObj = item.requiredByDate.toDate();
      } else if (typeof item.requiredByDate === 'string') {
        dateObj = new Date(item.requiredByDate);
      } else {
        dateObj = new Date();
      }
      requiredByDateString = dateObj.toISOString().split('T')[0] || '';
    }

    setFormData({
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      quantity: item.quantity.toString(),
      unit: item.unit,
      estimatedUnitPrice: item.estimatedUnitPrice?.amount?.toString() || '',
      priority: item.priority,
      requiredByDate: requiredByDateString,
      equipmentCode: item.equipmentCode || '',
      equipmentName: item.equipmentName || '',
      technicalSpecs: item.technicalSpecs || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedItem(null);
    setFormData(EMPTY_FORM);
    setError(null);
  };

  const handleChange =
    (field: keyof ProcurementItemFormData) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | { target: { value: string } }
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async () => {
    // Validation
    if (!formData.itemName.trim()) {
      setError('Item name is required');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemData: Omit<ProcurementItem, 'id' | 'status'> = {
        itemName: formData.itemName.trim(),
        description: formData.description.trim(),
        category: formData.category,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        estimatedUnitPrice: formData.estimatedUnitPrice
          ? { amount: parseFloat(formData.estimatedUnitPrice), currency: 'INR' }
          : undefined,
        estimatedTotalPrice: formData.estimatedUnitPrice
          ? {
              amount: parseFloat(formData.estimatedUnitPrice) * parseFloat(formData.quantity),
              currency: 'INR',
            }
          : undefined,
        priority: formData.priority,
        requiredByDate: formData.requiredByDate
          ? Timestamp.fromDate(new Date(formData.requiredByDate))
          : undefined,
        equipmentCode: formData.equipmentCode || undefined,
        equipmentName: formData.equipmentName || undefined,
        technicalSpecs: formData.technicalSpecs || undefined,
        notes: formData.notes || undefined,
        preferredVendors: [],
      };

      if (selectedItem) {
        // Update existing item
        await updateProcurementItem(
          project.id,
          selectedItem.id,
          itemData as Partial<ProcurementItem>,
          userId
        );
      } else {
        // Add new item
        await addProcurementItem(project.id, itemData, userId);
      }

      // Refresh page to show updated data
      router.refresh();
      handleClose();
    } catch (err) {
      console.error('[ProcurementTab] Error saving item:', err);
      setError(err instanceof Error ? err.message : 'Failed to save procurement item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: ProcurementItem) => {
    if (!window.confirm(`Delete procurement item "${item.itemName}"?`)) {
      return;
    }

    try {
      await deleteProcurementItem(project.id, item.id, userId);
      router.refresh();
    } catch (err) {
      console.error('[ProcurementTab] Error deleting item:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete procurement item');
    }
  };

  const handleCreatePR = async (item: ProcurementItem) => {
    if (!window.confirm(`Create Purchase Request for "${item.itemName}"?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createPRFromCharterItem(
        project.id,
        project.name,
        item,
        userId,
        userName
      );

      // Show success and refresh
      alert(`Purchase Request ${result.prNumber} created successfully!`);
      router.refresh();
    } catch (err) {
      console.error('[ProcurementTab] Error creating PR:', err);
      setError(err instanceof Error ? err.message : 'Failed to create purchase request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (
    status: ProcurementItem['status']
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'PLANNING':
        return 'default';
      case 'PR_DRAFTED':
        return 'primary';
      case 'RFQ_ISSUED':
        return 'secondary';
      case 'PO_PLACED':
        return 'warning';
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (
    priority: ProcurementItem['priority']
  ): 'default' | 'warning' | 'error' => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount?: number, currency = 'INR') => {
    if (!amount) return '-';
    return `${currency} ${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const calculateTotalPrice = (item: ProcurementItem) => {
    if (!item.estimatedUnitPrice?.amount) return null;
    return item.quantity * item.estimatedUnitPrice.amount;
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Procurement Planning
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage components and materials required for this project. High/Critical priority items
            will automatically draft PRs when charter is approved.
          </Typography>
        </Box>
        {hasManageAccess && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Item
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Info Alert for Charter Approval */}
      {project.charter?.authorization?.approvalStatus !== 'APPROVED' &&
        procurementItems.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            When the project charter is approved, Purchase Requests will be automatically drafted
            for all HIGH and CRITICAL priority items.
          </Alert>
        )}

      {/* Items Table */}
      {procurementItems.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No procurement items defined yet. Click &quot;Add Item&quot; to get started.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Est. Unit Price</TableCell>
                <TableCell align="right">Est. Total</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Linked PR/RFQ/PO</TableCell>
                {hasManageAccess && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {procurementItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.itemName}
                    </Typography>
                    {item.equipmentCode && (
                      <Typography variant="caption" color="text.secondary">
                        Equipment: {item.equipmentCode}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={item.category.replace(/_/g, ' ')} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(
                      item.estimatedUnitPrice?.amount,
                      item.estimatedUnitPrice?.currency
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(
                      calculateTotalPrice(item) || undefined,
                      item.estimatedUnitPrice?.currency
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.priority}
                      size="small"
                      color={getPriorityColor(item.priority)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status.replace(/_/g, ' ')}
                      size="small"
                      color={getStatusColor(item.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {item.linkedPurchaseRequestId && (
                        <Tooltip title="Purchase Request">
                          <Chip label="PR" size="small" icon={<LinkIcon />} />
                        </Tooltip>
                      )}
                      {item.linkedRFQId && (
                        <Tooltip title="RFQ">
                          <Chip label="RFQ" size="small" icon={<LinkIcon />} />
                        </Tooltip>
                      )}
                      {item.linkedPOId && (
                        <Tooltip title="Purchase Order">
                          <Chip label="PO" size="small" icon={<LinkIcon />} />
                        </Tooltip>
                      )}
                      {!item.linkedPurchaseRequestId && !item.linkedRFQId && !item.linkedPOId && (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  {hasManageAccess && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        {!item.linkedPurchaseRequestId && item.status === 'PLANNING' && (
                          <Tooltip title="Create PR">
                            <IconButton size="small" onClick={() => handleCreatePR(item)}>
                              <CartIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(item)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{selectedItem ? 'Edit Procurement Item' : 'Add Procurement Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                label="Item Name"
                value={formData.itemName}
                onChange={handleChange('itemName')}
                required
                placeholder="e.g., Heat Exchanger Tubes"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={handleChange('category')}
                >
                  <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
                  <MenuItem value="COMPONENT">Component</MenuItem>
                  <MenuItem value="EQUIPMENT">Equipment</MenuItem>
                  <MenuItem value="SERVICE">Service</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={2}
                placeholder="Detailed description of the item"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={formData.quantity}
                onChange={handleChange('quantity')}
                required
                slotProps={{ htmlInput: { min: '0', step: '1' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Unit"
                value={formData.unit}
                onChange={handleChange('unit')}
                placeholder="e.g., pcs, kg, m"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Est. Unit Price (INR)"
                type="number"
                value={formData.estimatedUnitPrice}
                onChange={handleChange('estimatedUnitPrice')}
                slotProps={{ htmlInput: { min: '0', step: '0.01' } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={handleChange('priority')}
                >
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Required By Date"
                type="date"
                value={formData.requiredByDate}
                onChange={handleChange('requiredByDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Equipment Code"
                value={formData.equipmentCode}
                onChange={handleChange('equipmentCode')}
                placeholder="Optional equipment reference"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Equipment Name"
                value={formData.equipmentName}
                onChange={handleChange('equipmentName')}
                placeholder="Equipment name"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Technical Specifications"
                value={formData.technicalSpecs}
                onChange={handleChange('technicalSpecs')}
                multiline
                rows={2}
                placeholder="Technical requirements, standards, certifications"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={handleChange('notes')}
                multiline
                rows={2}
                placeholder="Additional notes"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : selectedItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
