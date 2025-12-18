'use client';

/**
 * Feedback List Component
 *
 * Admin interface to view and manage user feedback submissions
 * - Bug reports
 * - Feature requests
 * - General feedback
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import {
  FeedbackItem,
  FeedbackType,
  FeedbackStatus,
  FeedbackModule,
  FeedbackFilters,
  FeedbackTable,
  FeedbackDetailDialog,
} from './feedback';

export function FeedbackList() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [moduleFilter, setModuleFilter] = useState<FeedbackModule | 'all'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Subscribe to feedback collection
  useEffect(() => {
    const { db } = getFirebase();
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FeedbackItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as FeedbackItem);
        });
        setFeedback(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching feedback:', err);
        setError('Failed to load feedback. Make sure you have admin permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter feedback
  const filteredFeedback = feedback.filter((item) => {
    // Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;

    // Module filter (handle older records without module field)
    if (moduleFilter !== 'all') {
      const itemModule = item.module || 'other';
      if (itemModule !== moduleFilter) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.userEmail.toLowerCase().includes(query) ||
        item.userName.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleStatusChange = useCallback(
    async (feedbackId: string, newStatus: FeedbackStatus) => {
      setUpdating(true);
      try {
        const { db } = getFirebase();
        const feedbackRef = doc(db, 'feedback', feedbackId);
        await updateDoc(feedbackRef, {
          status: newStatus,
          updatedAt: Timestamp.now(),
        });

        // Update selected feedback if it's the one being modified
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } catch (err) {
        console.error('Error updating status:', err);
        setError('Failed to update status');
      } finally {
        setUpdating(false);
      }
    },
    [selectedFeedback]
  );

  const handleAdminNotesChange = useCallback(async (feedbackId: string, notes: string) => {
    try {
      const { db } = getFirebase();
      const feedbackRef = doc(db, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        adminNotes: notes,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating notes:', err);
    }
  }, []);

  const handleResolutionNotesChange = useCallback(async (feedbackId: string, notes: string) => {
    try {
      const { db } = getFirebase();
      const feedbackRef = doc(db, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        resolutionNotes: notes,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating resolution notes:', err);
    }
  }, []);

  const openDetailDialog = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setDetailDialogOpen(true);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginated feedback
  const paginatedFeedback = filteredFeedback.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <FeedbackFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        moduleFilter={moduleFilter}
        setModuleFilter={setModuleFilter}
        filteredCount={filteredFeedback.length}
        totalCount={feedback.length}
      />

      {/* Feedback Table */}
      {filteredFeedback.length === 0 ? (
        <Alert severity="info">
          {feedback.length === 0
            ? 'No feedback submissions yet.'
            : 'No feedback matches your filters.'}
        </Alert>
      ) : (
        <FeedbackTable
          items={paginatedFeedback}
          page={page}
          rowsPerPage={rowsPerPage}
          totalCount={filteredFeedback.length}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          onViewDetails={openDetailDialog}
        />
      )}

      {/* Detail Dialog */}
      <FeedbackDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        feedback={selectedFeedback}
        onFeedbackChange={setSelectedFeedback}
        onStatusChange={handleStatusChange}
        onAdminNotesChange={handleAdminNotesChange}
        onResolutionNotesChange={handleResolutionNotesChange}
        updating={updating}
      />
    </Box>
  );
}
