'use client';

/**
 * Document Supply List Component
 *
 * Main component for managing supply items linked to a document
 * Features:
 * - Supply items table
 * - Add new supply items
 * - View item details
 * - Delete items
 * - Summary statistics
 */

import { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import type { MasterDocumentEntry, SupplyItem } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import AddSupplyItemDialog, { type SupplyItemData } from './supply/AddSupplyItemDialog';
import SupplyItemsTable from './supply/SupplyItemsTable';

interface DocumentSupplyListProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentSupplyList({ document, onUpdate }: DocumentSupplyListProps) {
  const { db } = getFirebase();

  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    loadSupplyItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const loadSupplyItems = async () => {
    if (!db) {
      console.error('[DocumentSupplyList] Firebase db not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemsRef = collection(db, 'projects', document.projectId, 'supplyItems');
      const q = query(
        itemsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const data: SupplyItem[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        } as SupplyItem);
      });

      setItems(data);
    } catch (err) {
      console.error('[DocumentSupplyList] Error loading supply items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load supply items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (data: SupplyItemData) => {
    try {
      // TODO: Implement actual supply item creation
      // This will involve:
      // 1. Create SupplyItem in Firestore
      // 2. Update MasterDocumentEntry supplyItemCount
      // 3. Calculate estimated total cost

      console.warn('Adding supply item:', data);

      // For now, show a placeholder alert
      alert('Supply item creation will be implemented with Firestore integration');

      await loadSupplyItems();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add supply item');
    }
  };

  const handleViewItem = (item: SupplyItem) => {
    // TODO: Implement view/edit dialog
    console.warn('Viewing supply item:', item);
    alert('Supply item details view will be implemented');
  };

  const handleDeleteItem = async (item: SupplyItem) => {
    try {
      // TODO: Implement item deletion
      // This will involve:
      // 1. Delete SupplyItem from Firestore
      // 2. Update MasterDocumentEntry supplyItemCount

      console.warn('Deleting supply item:', item);

      if (window.confirm(`Delete supply item "${item.itemName}"?`)) {
        alert('Supply item deletion will be implemented');
        await loadSupplyItems();
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete supply item:', err);
    }
  };

  // Calculate summary statistics
  const totalEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedTotalCost || 0), 0);
  const itemsByStatus = items.reduce(
    (acc, item) => {
      acc[item.procurementStatus] = (acc[item.procurementStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading supply items...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Supply List</Typography>
            <Typography variant="body2" color="text.secondary">
              {items.length} item{items.length !== 1 ? 's' : ''} • Total Est. Cost: INR{' '}
              {totalEstimatedCost.toFixed(2)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadSupplyItems}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Supply Item
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Summary */}
        {items.length > 0 && (
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Procurement Status:</strong> {itemsByStatus['NOT_INITIATED'] || 0} not
              initiated • {itemsByStatus['PR_CREATED'] || 0} PR created •{' '}
              {itemsByStatus['PO_PLACED'] || 0} PO placed • {itemsByStatus['DELIVERED'] || 0}{' '}
              delivered
            </Typography>
          </Alert>
        )}

        {/* Supply Items Table */}
        <SupplyItemsTable
          items={items}
          onViewItem={handleViewItem}
          onDeleteItem={handleDeleteItem}
        />
      </Stack>

      {/* Add Dialog */}
      <AddSupplyItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        document={document}
        onSubmit={handleAddItem}
      />
    </Box>
  );
}
