'use client';

/**
 * Admin Dashboard Page
 *
 * Landing page for the Administration section with cards linking to:
 * - User Management
 * - Company Settings
 * - Feedback
 * - Audit Logs
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  People as UsersIcon,
  Business as CompanyIcon,
  Feedback as FeedbackIcon,
  History as AuditIcon,
  ArrowForward as ArrowIcon,
  Assessment as AnalyticsIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface AdminCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  stats?: { label: string; value: number | string; color?: string }[];
  loading?: boolean;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [userStats, setUserStats] = useState({ active: 0, pending: 0, loading: true });
  const [feedbackStats, setFeedbackStats] = useState({ new: 0, inProgress: 0, loading: true });

  // Load user stats
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);

    // Count active users
    const activeQuery = query(usersRef, where('isActive', '==', true));
    const pendingQuery = query(usersRef, where('status', '==', 'pending'));

    const unsubscribeActive = onSnapshot(
      activeQuery,
      (snapshot) => {
        setUserStats((prev) => ({ ...prev, active: snapshot.size, loading: false }));
      },
      () => setUserStats((prev) => ({ ...prev, loading: false }))
    );

    const unsubscribePending = onSnapshot(
      pendingQuery,
      (snapshot) => {
        setUserStats((prev) => ({ ...prev, pending: snapshot.size }));
      },
      () => {}
    );

    return () => {
      unsubscribeActive();
      unsubscribePending();
    };
  }, []);

  // Load feedback stats
  useEffect(() => {
    const { db } = getFirebase();
    const feedbackRef = collection(db, 'feedback');

    const newQuery = query(feedbackRef, where('status', '==', 'new'));
    const inProgressQuery = query(feedbackRef, where('status', '==', 'in_progress'));

    const unsubscribeNew = onSnapshot(
      newQuery,
      (snapshot) => {
        setFeedbackStats((prev) => ({ ...prev, new: snapshot.size, loading: false }));
      },
      () => setFeedbackStats((prev) => ({ ...prev, loading: false }))
    );

    const unsubscribeInProgress = onSnapshot(
      inProgressQuery,
      (snapshot) => {
        setFeedbackStats((prev) => ({ ...prev, inProgress: snapshot.size }));
      },
      () => {}
    );

    return () => {
      unsubscribeNew();
      unsubscribeInProgress();
    };
  }, []);

  const cards: AdminCard[] = [
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, permissions, and access control',
      icon: <UsersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/users',
      stats: userStats.loading
        ? undefined
        : [
            { label: 'Active', value: userStats.active, color: 'success' },
            ...(userStats.pending > 0
              ? [{ label: 'Pending', value: userStats.pending, color: 'warning' as const }]
              : []),
          ],
      loading: userStats.loading,
    },
    {
      id: 'company',
      title: 'Company Settings',
      description: 'Configure company information, tax IDs, and banking details',
      icon: <CompanyIcon sx={{ fontSize: 48, color: 'info.main' }} />,
      path: '/admin/company',
    },
    {
      id: 'feedback',
      title: 'User Feedback',
      description: 'Review bug reports, feature requests, and user suggestions',
      icon: <FeedbackIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/admin/feedback',
      stats: feedbackStats.loading
        ? undefined
        : [
            ...(feedbackStats.new > 0
              ? [{ label: 'New', value: feedbackStats.new, color: 'error' as const }]
              : []),
            ...(feedbackStats.inProgress > 0
              ? [
                  {
                    label: 'In Progress',
                    value: feedbackStats.inProgress,
                    color: 'warning' as const,
                  },
                ]
              : []),
            ...(feedbackStats.new === 0 && feedbackStats.inProgress === 0
              ? [{ label: 'All clear', value: '', color: 'success' as const }]
              : []),
          ],
      loading: feedbackStats.loading,
    },
    {
      id: 'audit',
      title: 'Audit Logs',
      description: 'View system activity and user action history',
      icon: <AuditIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '/admin/audit-logs',
    },
    {
      id: 'task-analytics',
      title: 'Task Analytics',
      description: 'Track task assignments, completion rates, and user performance',
      icon: <AnalyticsIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/admin/task-analytics',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Administration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, company settings, and system configuration
        </Typography>
      </Box>

      {/* Admin Cards */}
      <Grid container spacing={3}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s',
                '&:hover': {
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 3 }}>
                <Box sx={{ mb: 2 }}>{card.icon}</Box>
                <Typography variant="h6" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {card.description}
                </Typography>

                {/* Stats */}
                {card.loading ? (
                  <Skeleton variant="rectangular" height={24} sx={{ mx: 'auto', width: 100 }} />
                ) : (
                  card.stats && (
                    <Box
                      sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}
                    >
                      {card.stats.map((stat, idx) => (
                        <Chip
                          key={idx}
                          label={stat.value !== '' ? `${stat.value} ${stat.label}` : stat.label}
                          size="small"
                          color={stat.color as 'success' | 'warning' | 'error' | 'default'}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )
                )}
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  endIcon={<ArrowIcon />}
                  onClick={() => router.push(card.path)}
                >
                  {card.id === 'users'
                    ? 'Manage Users'
                    : card.id === 'company'
                      ? 'Configure'
                      : 'View'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
