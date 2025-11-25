'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import type { MasterDocumentEntry, WorkItem } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import AddWorkItemDialog, { type WorkItemData } from './work/AddWorkItemDialog';
import WorkItemsTable from './work/WorkItemsTable';

interface DocumentWorkListProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentWorkList({ document, onUpdate }: DocumentWorkListProps) {
  const { db } = getFirebase();

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    loadWorkItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const loadWorkItems = async () => {
    if (!db) {
      console.error('[DocumentWorkList] Firebase db not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemsRef = collection(db, 'projects', document.projectId, 'workItems');
      const q = query(
        itemsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const data: WorkItem[] = [];

      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as WorkItem);
      });

      setItems(data);
    } catch (err) {
      console.error('[DocumentWorkList] Error loading work items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (data: WorkItemData) => {
    try {
      console.warn('Adding work item:', data);
      alert('Work item creation will be implemented with Firestore integration');
      await loadWorkItems();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add work item');
    }
  };

  const handleDeleteItem = async (item: WorkItem) => {
    try {
      if (window.confirm(`Delete work item "${item.activityName}"?`)) {
        alert('Work item deletion will be implemented');
        await loadWorkItems();
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete work item:', err);
    }
  };

  const totalHours = items.reduce((sum, item) => sum + (item.estimatedHours || 0), 0);

  if (loading) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Work List</Typography>
            <Typography variant="body2" color="text.secondary">
              {items.length} item{items.length !== 1 ? 's' : ''} • Est. {totalHours} hours
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={loadWorkItems} size="small">
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Work Item
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <WorkItemsTable items={items} onDeleteItem={handleDeleteItem} />
      </Stack>

      <AddWorkItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        document={document}
        onSubmit={handleAddItem}
      />
    </Box>
  );
}
