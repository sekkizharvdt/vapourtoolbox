'use client';

/**
 * Meeting List Page
 *
 * Lists all meetings with status badges (draft/finalized).
 * Links to detail pages and provides "New Meeting" button.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Stack,
} from '@mui/material';
import {
  Home as HomeIcon,
  Add as AddIcon,
  EventNote as MeetingIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToMeetings } from '@/lib/tasks/meetingService';
import type { Meeting } from '@vapour/types';

export default function MeetingsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const entityId = claims?.entityId || 'default-entity';

  useEffect(() => {
    if (!db) return;

    setLoading(true);

    const unsubscribe = subscribeToMeetings(
      db,
      entityId,
      (updated) => {
        setMeetings(updated);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, entityId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

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
        <Typography color="text.primary">Meeting Minutes</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Meeting Minutes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/flow/meetings/new')}
        >
          New Meeting
        </Button>
      </Box>

      {meetings.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MeetingIcon />
            <Typography variant="body2">
              No meetings yet. Click <strong>New Meeting</strong> to record minutes.
            </Typography>
          </Stack>
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {meetings.map((meeting) => {
            const meetingDate = meeting.date?.toDate?.();
            const dateStr = meetingDate
              ? meetingDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '';

            return (
              <Card key={meeting.id} variant="outlined" sx={{ '&:hover': { boxShadow: 2 } }}>
                <CardActionArea onClick={() => router.push(`/flow/meetings/${meeting.id}`)}>
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="flex-start" spacing={2}>
                      <MeetingIcon color="action" sx={{ mt: 0.25 }} />

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
                            {meeting.title}
                          </Typography>
                          <Chip
                            label={meeting.status === 'finalized' ? 'Finalized' : 'Draft'}
                            size="small"
                            color={meeting.status === 'finalized' ? 'success' : 'default'}
                            variant={meeting.status === 'finalized' ? 'filled' : 'outlined'}
                          />
                        </Stack>

                        <Stack direction="row" spacing={2} alignItems="center">
                          {dateStr && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {dateStr}
                              </Typography>
                            </Stack>
                          )}

                          {meeting.duration && (
                            <Typography variant="body2" color="text.secondary">
                              {meeting.duration} min
                            </Typography>
                          )}

                          {meeting.attendeeNames.length > 0 && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {meeting.attendeeNames.length} attendee
                                {meeting.attendeeNames.length !== 1 ? 's' : ''}
                              </Typography>
                            </Stack>
                          )}

                          {meeting.createdByName && (
                            <Typography variant="body2" color="text.secondary">
                              by {meeting.createdByName}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
