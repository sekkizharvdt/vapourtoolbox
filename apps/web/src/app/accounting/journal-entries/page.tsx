'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { JournalEntry } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateJournalEntryDialog } from './components/CreateJournalEntryDialog';

export default function JournalEntriesPage() {
  const { userData } = useAuth();
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const canManage = hasPermission(userData?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Real-time listener for journal entries
  useEffect(() => {
    const { db } = getFirebase();
    const entriesRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(
      entriesRef,
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entriesData: JournalEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'JOURNAL_ENTRY') {
          entriesData.push({ id: doc.id, ...data } as JournalEntry);
        }
      });
      setJournalEntries(entriesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = () => {
    setEditingEntry(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    try {
      const { db } = getFirebase();
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, entryId));
    } catch (error) {
      console.error('[JournalEntriesPage] Error deleting entry:', error);
      alert('Failed to delete journal entry');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingEntry(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading journal entries...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Journal Entries</Typography>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            New Journal Entry
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Transaction Number</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {journalEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No journal entries found. Click &quot;New Journal Entry&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              journalEntries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    {new Date(entry.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{entry.transactionNumber}</TableCell>
                  <TableCell>{entry.description || '-'}</TableCell>
                  <TableCell>{entry.reference || '-'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.status}
                      size="small"
                      color={
                        entry.status === 'POSTED' ? 'success' :
                        entry.status === 'DRAFT' ? 'default' :
                        'warning'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => handleEdit(entry)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(entry)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(entry.id!)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateJournalEntryDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingEntry={editingEntry}
      />
    </Box>
  );
}
