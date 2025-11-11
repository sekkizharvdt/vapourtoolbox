'use client';

import { useState, useEffect, useCallback } from 'react';

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
  Rating,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as VendorIcon,
} from '@mui/icons-material';
import type { Project, OutsourcingVendor, BusinessEntity } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface VendorsTabProps {
  project: Project;
}

interface VendorFormData {
  vendorEntityId: string;
  vendorName: string;
  scopeOfWork: string;
  contractValue: string;
  contractStartDate: string;
  contractEndDate: string;
  contractStatus: OutsourcingVendor['contractStatus'];
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  deliverables: string;
  performanceRating: number;
  notes: string;
}

const EMPTY_FORM: VendorFormData = {
  vendorEntityId: '',
  vendorName: '',
  scopeOfWork: '',
  contractValue: '',
  contractStartDate: '',
  contractEndDate: '',
  contractStatus: 'DRAFT',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  deliverables: '',
  performanceRating: 0,
  notes: '',
};

export function VendorsTab({ project }: VendorsTabProps) {
  const { claims, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<OutsourcingVendor | null>(null);
  const [formData, setFormData] = useState<VendorFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorEntities, setVendorEntities] = useState<BusinessEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const vendors = project.vendors || [];
  const userId = user?.uid || '';

  const loadVendorEntities = useCallback(async () => {
    setLoadingEntities(true);
    try {
      const { db } = getFirebase();
      const entitiesRef = collection(db, COLLECTIONS.ENTITIES);
      const q = query(
        entitiesRef,
        where('entityType', '==', 'VENDOR'),
        where('status', '==', 'ACTIVE')
      );
      const snapshot = await getDocs(q);
      const entities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessEntity[];
      setVendorEntities(entities);
    } catch (err) {
      console.error('[VendorsTab] Error loading vendor entities:', err);
    } finally {
      setLoadingEntities(false);
    }
  }, []);

  // Load vendor entities when dialog opens
  useEffect(() => {
    if (dialogOpen && !selectedVendor) {
      loadVendorEntities();
    }
  }, [dialogOpen, selectedVendor, loadVendorEntities]);

  const handleAdd = () => {
    setSelectedVendor(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (vendor: OutsourcingVendor) => {
    setSelectedVendor(vendor);

    let contractStartDateString = '';
    if (vendor.contractStartDate) {
      let dateObj: Date;
      if (vendor.contractStartDate instanceof Date) {
        dateObj = vendor.contractStartDate;
      } else if (
        typeof vendor.contractStartDate === 'object' &&
        'toDate' in vendor.contractStartDate
      ) {
        dateObj = vendor.contractStartDate.toDate();
      } else if (typeof vendor.contractStartDate === 'string') {
        dateObj = new Date(vendor.contractStartDate);
      } else {
        dateObj = new Date();
      }
      contractStartDateString = dateObj.toISOString().split('T')[0] || '';
    }

    let contractEndDateString = '';
    if (vendor.contractEndDate) {
      let dateObj: Date;
      if (vendor.contractEndDate instanceof Date) {
        dateObj = vendor.contractEndDate;
      } else if (typeof vendor.contractEndDate === 'object' && 'toDate' in vendor.contractEndDate) {
        dateObj = vendor.contractEndDate.toDate();
      } else if (typeof vendor.contractEndDate === 'string') {
        dateObj = new Date(vendor.contractEndDate);
      } else {
        dateObj = new Date();
      }
      contractEndDateString = dateObj.toISOString().split('T')[0] || '';
    }

    setFormData({
      vendorEntityId: vendor.vendorEntityId,
      vendorName: vendor.vendorName,
      scopeOfWork: vendor.scopeOfWork,
      contractValue: vendor.contractValue?.amount?.toString() || '',
      contractStartDate: contractStartDateString,
      contractEndDate: contractEndDateString,
      contractStatus: vendor.contractStatus,
      contactPerson: vendor.contactPerson,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      deliverables: vendor.deliverables.join(', '),
      performanceRating: vendor.performanceRating || 0,
      notes: vendor.notes || '',
    });
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedVendor(null);
    setFormData(EMPTY_FORM);
    setError(null);
  };

  const handleChange =
    (field: keyof VendorFormData) =>
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

  const handleVendorEntityChange = (entityId: string) => {
    const selectedEntity = vendorEntities.find((e) => e.id === entityId);
    if (selectedEntity) {
      setFormData((prev) => ({
        ...prev,
        vendorEntityId: entityId,
        vendorName: selectedEntity.name,
        contactPerson: selectedEntity.contactPerson || '',
        contactEmail: selectedEntity.email || '',
        contactPhone: selectedEntity.phone || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        vendorEntityId: entityId,
      }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.vendorName.trim()) {
      setError('Vendor name is required');
      return;
    }
    if (!formData.scopeOfWork.trim()) {
      setError('Scope of work is required');
      return;
    }
    if (!formData.contactPerson.trim() || !formData.contactEmail.trim()) {
      setError('Contact person and email are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const vendorData: Omit<OutsourcingVendor, 'id'> = {
        vendorEntityId: formData.vendorEntityId || '',
        vendorName: formData.vendorName.trim(),
        scopeOfWork: formData.scopeOfWork.trim(),
        contractValue: formData.contractValue
          ? { amount: parseFloat(formData.contractValue), currency: 'INR' }
          : undefined,
        contractStartDate: formData.contractStartDate
          ? Timestamp.fromDate(new Date(formData.contractStartDate))
          : undefined,
        contractEndDate: formData.contractEndDate
          ? Timestamp.fromDate(new Date(formData.contractEndDate))
          : undefined,
        contractStatus: formData.contractStatus,
        contactPerson: formData.contactPerson.trim(),
        contactEmail: formData.contactEmail.trim(),
        contactPhone: formData.contactPhone.trim(),
        deliverables: formData.deliverables
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        performanceRating: formData.performanceRating > 0 ? formData.performanceRating : undefined,
        notes: formData.notes.trim() || undefined,
      };

      let updatedVendors: OutsourcingVendor[];

      if (selectedVendor) {
        // Update existing vendor
        updatedVendors = vendors.map((v) =>
          v.id === selectedVendor.id ? { ...vendorData, id: selectedVendor.id } : v
        );
      } else {
        // Add new vendor
        const vendorId = `VND-${Date.now()}`;
        updatedVendors = [...vendors, { ...vendorData, id: vendorId }];
      }

      await updateDoc(projectRef, {
        vendors: updatedVendors,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      handleClose();
    } catch (err) {
      console.error('[VendorsTab] Error saving vendor:', err);
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (vendor: OutsourcingVendor) => {
    if (!window.confirm(`Delete vendor "${vendor.vendorName}"?`)) {
      return;
    }

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const updatedVendors = vendors.filter((v) => v.id !== vendor.id);

      await updateDoc(projectRef, {
        vendors: updatedVendors,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } catch (err) {
      console.error('[VendorsTab] Error deleting vendor:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete vendor');
    }
  };

  const getStatusColor = (
    status: OutsourcingVendor['contractStatus']
  ): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'NEGOTIATION':
        return 'warning';
      case 'COMPLETED':
        return 'primary';
      case 'TERMINATED':
        return 'error';
      case 'DRAFT':
      default:
        return 'default';
    }
  };

  const calculateContractDuration = (vendor: OutsourcingVendor): string => {
    if (!vendor.contractStartDate || !vendor.contractEndDate) {
      return 'Not specified';
    }

    let startDate: Date;
    if (vendor.contractStartDate instanceof Date) {
      startDate = vendor.contractStartDate;
    } else if (
      typeof vendor.contractStartDate === 'object' &&
      'toDate' in vendor.contractStartDate
    ) {
      startDate = vendor.contractStartDate.toDate();
    } else if (typeof vendor.contractStartDate === 'string') {
      startDate = new Date(vendor.contractStartDate);
    } else {
      return 'Not specified';
    }

    let endDate: Date;
    if (vendor.contractEndDate instanceof Date) {
      endDate = vendor.contractEndDate;
    } else if (typeof vendor.contractEndDate === 'object' && 'toDate' in vendor.contractEndDate) {
      endDate = vendor.contractEndDate.toDate();
    } else if (typeof vendor.contractEndDate === 'string') {
      endDate = new Date(vendor.contractEndDate);
    } else {
      return 'Not specified';
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMonths > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
    }
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  // Calculate stats
  const stats = {
    total: vendors.length,
    active: vendors.filter((v) => v.contractStatus === 'ACTIVE').length,
    negotiation: vendors.filter((v) => v.contractStatus === 'NEGOTIATION').length,
    completed: vendors.filter((v) => v.contractStatus === 'COMPLETED').length,
    totalValue: vendors.reduce((sum, v) => sum + (v.contractValue?.amount || 0), 0),
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Outsourcing Vendors
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage vendors and contractors assigned to this project. Track contracts, deliverables,
            and performance.
          </Typography>
        </Box>
        {hasManageAccess && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Vendor
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Vendors
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'success.light' }}>
            <CardContent>
              <Typography variant="h4">{stats.active}</Typography>
              <Typography variant="body2">Active Contracts</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'warning.light' }}>
            <CardContent>
              <Typography variant="h4">{stats.negotiation}</Typography>
              <Typography variant="body2">In Negotiation</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4">₹{(stats.totalValue / 100000).toFixed(1)}L</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Contract Value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vendors Table */}
      {vendors.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <VendorIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            No vendors assigned yet. Click &quot;Add Vendor&quot; to get started.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Scope of Work</TableCell>
                <TableCell>Contract Value</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Performance</TableCell>
                <TableCell>Deliverables</TableCell>
                {hasManageAccess && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {vendor.vendorName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 200 }}
                    >
                      {vendor.scopeOfWork}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {vendor.contractValue
                        ? `₹${(vendor.contractValue.amount / 100000).toFixed(2)}L`
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{calculateContractDuration(vendor)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={vendor.contractStatus.replace(/_/g, ' ')}
                      size="small"
                      color={getStatusColor(vendor.contractStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{vendor.contactPerson}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {vendor.contactEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {vendor.performanceRating ? (
                      <Rating value={vendor.performanceRating} readOnly size="small" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not rated
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200 }}>
                      {vendor.deliverables.slice(0, 2).map((deliverable, idx) => (
                        <Chip key={idx} label={deliverable} size="small" variant="outlined" />
                      ))}
                      {vendor.deliverables.length > 2 && (
                        <Chip
                          label={`+${vendor.deliverables.length - 2}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  {hasManageAccess && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(vendor)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(vendor)}
                            color="error"
                          >
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
        <DialogTitle>{selectedVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Vendor Entity Selector (only when adding new) */}
            {!selectedVendor && (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <InputLabel>Select Vendor Entity (Optional)</InputLabel>
                  <Select
                    value={formData.vendorEntityId}
                    label="Select Vendor Entity (Optional)"
                    onChange={(e) => handleVendorEntityChange(e.target.value)}
                    disabled={loadingEntities}
                  >
                    <MenuItem value="">
                      <em>Enter vendor details manually</em>
                    </MenuItem>
                    {vendorEntities.map((entity) => (
                      <MenuItem key={entity.id} value={entity.id}>
                        {entity.name} - {entity.billingAddress.city}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Vendor Name"
                value={formData.vendorName}
                onChange={handleChange('vendorName')}
                required
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Scope of Work"
                value={formData.scopeOfWork}
                onChange={handleChange('scopeOfWork')}
                multiline
                rows={2}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Contract Value (INR)"
                type="number"
                value={formData.contractValue}
                onChange={handleChange('contractValue')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Contract Status</InputLabel>
                <Select
                  value={formData.contractStatus}
                  label="Contract Status"
                  onChange={handleChange('contractStatus')}
                >
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="NEGOTIATION">Negotiation</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="TERMINATED">Terminated</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Contract Start Date"
                type="date"
                value={formData.contractStartDate}
                onChange={handleChange('contractStartDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Contract End Date"
                type="date"
                value={formData.contractEndDate}
                onChange={handleChange('contractEndDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Contact Person"
                value={formData.contactPerson}
                onChange={handleChange('contactPerson')}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Contact Email"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange('contactEmail')}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Contact Phone"
                value={formData.contactPhone}
                onChange={handleChange('contactPhone')}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Deliverables"
                value={formData.deliverables}
                onChange={handleChange('deliverables')}
                placeholder="Comma-separated list (e.g., Design docs, Installation, Testing)"
                helperText="Enter deliverables separated by commas"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Performance Rating
                </Typography>
                <Rating
                  value={formData.performanceRating}
                  onChange={(_, newValue) => {
                    setFormData((prev) => ({ ...prev, performanceRating: newValue || 0 }));
                  }}
                />
              </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={handleChange('notes')}
                multiline
                rows={2}
                placeholder="Additional notes about this vendor"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : selectedVendor ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
