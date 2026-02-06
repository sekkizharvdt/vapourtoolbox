'use client';

/**
 * Meeting Detail Page
 *
 * Shows meeting details, attendees, and action items table.
 * For draft meetings: allows editing and finalization.
 * For finalized meetings: shows linked task status.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Chip,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as FinalizeIcon,
  Flag as FlagIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import {
  getMeetingById,
  subscribeToActionItems,
  finalizeMeeting,
} from '@/lib/tasks/meetingService';
import type { Meeting, MeetingActionItem, ManualTaskPriority } from '@vapour/types';

const PRIORITY_COLORS: Record<ManualTaskPriority, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const meetingId = params.id as string;
  const entityId = claims?.entityId || 'default-entity';

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  // Load meeting
  useEffect(() => {
    if (!db || !meetingId) return;

    async function load() {
      const m = await getMeetingById(db!, meetingId);
      setMeeting(m);
      setLoading(false);
    }
    load();
  }, [db, meetingId]);

  // Subscribe to action items
  useEffect(() => {
    if (!db || !meetingId) return;

    const unsubscribe = subscribeToActionItems(db, meetingId, (items) => {
      setActionItems(items);
    });

    return () => unsubscribe();
  }, [db, meetingId]);

  const handleFinalize = useCallback(async () => {
    if (!db || !user || !meeting) return;

    try {
      setFinalizing(true);

      const taskCount = await finalizeMeeting(
        db,
        meetingId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        entityId
      );

      // Reload meeting to get updated status
      const updated = await getMeetingById(db, meetingId);
      setMeeting(updated);

      toast.success(`Meeting finalized — ${taskCount} task${taskCount !== 1 ? 's' : ''} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalize meeting');
    } finally {
      setFinalizing(false);
    }
  }, [db, user, meeting, meetingId, entityId, toast]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Meeting not found.
      </Alert>
    );
  }

  const meetingDate = meeting.date?.toDate?.();
  const dateStr = meetingDate
    ? meetingDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
  const isDraft = meeting.status === 'draft';
  const actionableItems = actionItems.filter((item) => item.action && item.assigneeId);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/flow"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Flow
        </Link>
        <Link
          color="inherit"
          href="/flow/meetings"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow/meetings');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Meeting Minutes
        </Link>
        <Typography color="text.primary">{meeting.title}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="h4" component="h1">
              {meeting.title}
            </Typography>
            <Chip
              label={isDraft ? 'Draft' : 'Finalized'}
              size="small"
              color={isDraft ? 'default' : 'success'}
              variant={isDraft ? 'outlined' : 'filled'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {dateStr}
            {meeting.duration ? ` — ${meeting.duration} min` : ''}
            {meeting.location ? ` — ${meeting.location}` : ''}
          </Typography>
        </Box>

        {isDraft && (
          <Button
            variant="contained"
            startIcon={<FinalizeIcon />}
            onClick={handleFinalize}
            disabled={finalizing || actionableItems.length === 0}
          >
            {finalizing ? 'Finalizing...' : `Finalize (${actionableItems.length} tasks)`}
          </Button>
        )}
      </Stack>

      {/* Attendees */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Attendees
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {meeting.attendeeNames.map((name, i) => (
            <Chip
              key={meeting.attendeeIds[i] || i}
              avatar={<Avatar sx={{ width: 24, height: 24 }}>{name.charAt(0)}</Avatar>}
              label={name}
              size="small"
              variant="outlined"
            />
          ))}
        </Stack>
      </Box>

      {/* Agenda & Notes */}
      {(meeting.agenda || meeting.notes) && (
        <Box sx={{ mb: 3 }}>
          {meeting.agenda && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Agenda
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {meeting.agenda}
              </Typography>
            </Box>
          )}
          {meeting.notes && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Notes
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {meeting.notes}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Action Items Table */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Action Items ({actionItems.length})
      </Typography>

      {actionItems.length === 0 ? (
        <Alert severity="info">
          {isDraft ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <EditIcon fontSize="small" />
              <Typography variant="body2">
                No action items yet. This meeting was saved without action items.
              </Typography>
            </Stack>
          ) : (
            'This meeting has no action items.'
          )}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Responsible</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Priority</TableCell>
                {!isDraft && <TableCell>Task Status</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {actionItems.map((item) => {
                const dueDate = item.dueDate?.toDate?.();
                const dueDateStr = dueDate
                  ? dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : '—';

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2">{item.description || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.action || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.assigneeName}
                        size="small"
                        variant="outlined"
                        sx={{ height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{dueDateStr}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<FlagIcon />}
                        label={item.priority}
                        size="small"
                        color={PRIORITY_COLORS[item.priority] || 'default'}
                        variant="outlined"
                        sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                      />
                    </TableCell>
                    {!isDraft && (
                      <TableCell>
                        {item.generatedTaskId ? (
                          <Chip
                            label="Task Created"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22 }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Created by info */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Created by {meeting.createdByName}
        {meeting.finalizedAt?.toDate?.() &&
          ` — Finalized on ${meeting.finalizedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
      </Typography>
    </Box>
  );
}
