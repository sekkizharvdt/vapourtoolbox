'use client';

/**
 * Admin Dashboard Page
 *
 * Landing page for the Administration section using the standardized
 * ModuleLandingPage component with live stats via Firestore onSnapshot
 * and quick stats summary cards.
 */

import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, Skeleton } from '@mui/material';
import {
  People as UsersIcon,
  Business as CompanyIcon,
  Feedback as FeedbackIcon,
  History as AuditIcon,
  Assessment as AnalyticsIcon,
  Security as SecurityIcon,
  EventNote as HRIcon,
  Timeline as ActivityIcon,
  Backup as BackupIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  PendingActions as PendingIcon,
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

interface QuickStat {
  label: string;
  value: number;
  loading: boolean;
  color: string;
  icon: React.ReactNode;
}

export default function AdminDashboardPage() {
  const [userCount, setUserCount] = useState<number>(0);
  const [userLoading, setUserLoading] = useState(true);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  const [approvalsLoading, setApprovalsLoading] = useState(true);

  // Load user stats (active users count)
  useEffect(() => {
    const { db } = getFirebase();
    const activeQuery = query(collection(db, COLLECTIONS.USERS), where('isActive', '==', true));

    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => {
        setUserCount(snapshot.size);
        setUserLoading(false);
      },
      (error) => {
        console.error('[AdminDashboard] Error fetching active users:', error.message);
        setUserLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Load feedback stats (new + in-progress count)
  useEffect(() => {
    const { db } = getFirebase();
    const feedbackRef = collection(db, COLLECTIONS.FEEDBACK);

    const newQuery = query(feedbackRef, where('status', '==', 'new'));
    const inProgressQuery = query(feedbackRef, where('status', '==', 'in_progress'));

    let newCount = 0;
    let inProgressCount = 0;

    const unsubscribeNew = onSnapshot(
      newQuery,
      (snapshot) => {
        newCount = snapshot.size;
        setFeedbackCount(newCount + inProgressCount);
        setFeedbackLoading(false);
      },
      (error) => {
        console.error('[AdminDashboard] Error fetching new feedback:', error.message);
        setFeedbackLoading(false);
      }
    );

    const unsubscribeInProgress = onSnapshot(
      inProgressQuery,
      (snapshot) => {
        inProgressCount = snapshot.size;
        setFeedbackCount(newCount + inProgressCount);
      },
      (error) => {
        console.error('[AdminDashboard] Error fetching in-progress feedback:', error.message);
      }
    );

    return () => {
      unsubscribeNew();
      unsubscribeInProgress();
    };
  }, []);

  // Load pending approvals count (POs + PRs + leave requests)
  useEffect(() => {
    async function loadApprovals() {
      const { db } = getFirebase();

      const results = await Promise.allSettled([
        getCountFromServer(
          query(
            collection(db, COLLECTIONS.PURCHASE_ORDERS),
            where('status', '==', 'PENDING_APPROVAL')
          )
        ),
        getCountFromServer(
          query(collection(db, COLLECTIONS.PURCHASE_REQUESTS), where('status', '==', 'SUBMITTED'))
        ),
        getCountFromServer(
          query(
            collection(db, COLLECTIONS.HR_LEAVE_REQUESTS),
            where('status', '==', 'PENDING_APPROVAL')
          )
        ),
      ]);

      let total = 0;
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          total += result.value.data().count;
        }
      });

      setApprovalsCount(total);
      setApprovalsLoading(false);
    }

    loadApprovals();
  }, []);

  const quickStats: QuickStat[] = [
    {
      label: 'Active Users',
      value: userCount,
      loading: userLoading,
      color: 'primary.main',
      icon: <UsersIcon sx={{ fontSize: 28, opacity: 0.7 }} />,
    },
    {
      label: 'Open Feedback',
      value: feedbackCount,
      loading: feedbackLoading,
      color: feedbackCount > 0 ? 'warning.main' : 'success.main',
      icon: <FeedbackIcon sx={{ fontSize: 28, opacity: 0.7 }} />,
    },
    {
      label: 'Pending Approvals',
      value: approvalsCount,
      loading: approvalsLoading,
      color: approvalsCount > 0 ? 'error.main' : 'success.main',
      icon: <PendingIcon sx={{ fontSize: 28, opacity: 0.7 }} />,
    },
  ];

  const modules: ModuleItem[] = [
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, permissions, and access control',
      icon: <UsersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/users',
      count: userCount,
      countLabel: 'users',
      countLoading: userLoading,
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
      count: feedbackCount,
      countLabel: 'open',
      countLoading: feedbackLoading,
    },
    {
      id: 'activity',
      title: 'Activity Feed',
      description: 'Recent organization-wide activity and changes',
      icon: <ActivityIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/activity',
    },
    {
      id: 'audit',
      title: 'Audit Logs',
      description: 'View system activity and user action history',
      icon: <AuditIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '/admin/audit-logs',
    },
    {
      id: 'backup',
      title: 'Data Backup',
      description: 'Export and backup your organization data',
      icon: <BackupIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/backup',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure email notification settings',
      icon: <NotificationsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/notifications',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Email delivery configuration and notification recipients',
      icon: <SettingsIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '/admin/settings',
    },
    {
      id: 'task-analytics',
      title: 'Task Analytics',
      description: 'Track task assignments, completion rates, and user performance',
      icon: <AnalyticsIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/admin/task-analytics',
    },
    {
      id: 'system-status',
      title: 'System Status',
      description: 'Package versions, security vulnerabilities, and updates',
      icon: <SecurityIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/super-admin/system-status',
    },
    {
      id: 'hr-setup',
      title: 'HR Setup',
      description: 'Configure leave types, quotas, and manage employee leave balances',
      icon: <HRIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/hr-setup',
    },
  ];

  return (
    <>
      {/* Quick Stats */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          {quickStats.map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {stat.label}
                      </Typography>
                      {stat.loading ? (
                        <Skeleton width={60} height={36} />
                      ) : (
                        <Typography variant="h4" sx={{ color: stat.color, fontWeight: 700 }}>
                          {stat.value}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <ModuleLandingPage
        title="Administration"
        description="Manage users, company settings, and system configuration"
        items={modules}
      />
    </>
  );
}
