'use client';

/**
 * Vendors Tab Component
 *
 * Manages outsourcing vendors assigned to a project.
 * Split into subcomponents for better maintainability:
 * - VendorStatsCards: Summary statistics
 * - VendorTable: List of vendors with actions
 * - VendorFormDialog: Add/Edit vendor form
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { Project, OutsourcingVendor, BusinessEntity } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

import { VendorStatsCards } from './VendorStatsCards';
import { VendorTable } from './VendorTable';
import { VendorFormDialog } from './VendorFormDialog';
import { EMPTY_FORM, type VendorFormData } from './types';

interface VendorsTabProps {
  project: Project;
}

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

  const handleFormChange = (field: keyof VendorFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
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
      <VendorStatsCards vendors={vendors} />

      {/* Vendors Table */}
      <VendorTable
        vendors={vendors}
        hasManageAccess={hasManageAccess}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Add/Edit Dialog */}
      <VendorFormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        formData={formData}
        onChange={handleFormChange}
        onVendorEntityChange={handleVendorEntityChange}
        selectedVendor={selectedVendor}
        vendorEntities={vendorEntities}
        loadingEntities={loadingEntities}
        loading={loading}
      />
    </Paper>
  );
}

// Re-export for backwards compatibility
export { VendorsTab as default };
