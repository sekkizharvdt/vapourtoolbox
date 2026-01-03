'use client';

/**
 * Task Analytics Page
 *
 * Admin-only dashboard showing task metrics:
 * - Tasks assigned vs completed per user
 * - Completion rates
 * - Average response time
 * - Task category breakdown
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Skeleton,
  Stack,
  LinearProgress,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  CheckCircle as CompletedIcon,
  Pending as PendingIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { differenceInHours, startOfDay, subDays } from 'date-fns';

interface TaskStats {
  userId: string;
  userName: string;
  totalAssigned: number;
  completed: number;
  pending: number;
  inProgress: number;
  completionRate: number;
  avgResponseTimeHours: number;
}

interface CategoryStats {
  category: string;
  total: number;
  completed: number;
  pending: number;
}

interface OverallStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overallCompletionRate: number;
  avgResponseTimeHours: number;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function TaskAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<TaskStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Load task analytics data
  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const { db } = getFirebase();
        const tasksRef = collection(db, COLLECTIONS.TASK_NOTIFICATIONS);
        const usersRef = collection(db, COLLECTIONS.USERS);

        // Calculate date filter based on time range
        let startDate: Date | null = null;
        if (timeRange !== 'all') {
          const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
          startDate = subDays(startOfDay(new Date()), days);
        }

        // Build query with optional date filter
        let tasksQuery = query(tasksRef, orderBy('createdAt', 'desc'));
        if (startDate) {
          tasksQuery = query(
            tasksRef,
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'desc')
          );
        }

        // Fetch tasks and users
        const [tasksSnapshot, usersSnapshot] = await Promise.all([
          getDocs(tasksQuery),
          getDocs(query(usersRef, where('isActive', '==', true))),
        ]);

        // Build user map
        const userMap = new Map<string, string>();
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          userMap.set(doc.id, data.displayName || data.email || 'Unknown');
        });

        // Process tasks
        const userTaskMap = new Map<
          string,
          {
            assigned: number;
            completed: number;
            pending: number;
            inProgress: number;
            responseTimes: number[];
          }
        >();
        const categoryMap = new Map<
          string,
          { total: number; completed: number; pending: number }
        >();

        let totalTasks = 0;
        let completedTasks = 0;
        let pendingTasks = 0;
        let inProgressTasks = 0;
        const allResponseTimes: number[] = [];

        tasksSnapshot.forEach((doc) => {
          const task = doc.data();
          totalTasks++;

          // Count by status
          if (task.status === 'completed') {
            completedTasks++;
          } else if (task.status === 'pending') {
            pendingTasks++;
          } else if (task.status === 'in_progress') {
            inProgressTasks++;
          }

          // Calculate response time for completed tasks
          let responseTime: number | null = null;
          if (task.status === 'completed' && task.createdAt && task.timeCompleted) {
            const created = task.createdAt.toDate();
            const completed = task.timeCompleted.toDate();
            responseTime = differenceInHours(completed, created);
            allResponseTimes.push(responseTime);
          }

          // User stats
          const userId = task.userId;
          if (userId) {
            const existing = userTaskMap.get(userId) || {
              assigned: 0,
              completed: 0,
              pending: 0,
              inProgress: 0,
              responseTimes: [],
            };
            existing.assigned++;
            if (task.status === 'completed') {
              existing.completed++;
              if (responseTime !== null) {
                existing.responseTimes.push(responseTime);
              }
            } else if (task.status === 'pending') {
              existing.pending++;
            } else if (task.status === 'in_progress') {
              existing.inProgress++;
            }
            userTaskMap.set(userId, existing);
          }

          // Category stats
          const category = task.category || 'UNKNOWN';
          const catExisting = categoryMap.get(category) || { total: 0, completed: 0, pending: 0 };
          catExisting.total++;
          if (task.status === 'completed') {
            catExisting.completed++;
          } else if (task.status === 'pending' || task.status === 'in_progress') {
            catExisting.pending++;
          }
          categoryMap.set(category, catExisting);
        });

        // Calculate user stats
        const calculatedUserStats: TaskStats[] = [];
        userTaskMap.forEach((stats, usrId) => {
          const avgResponseTime =
            stats.responseTimes.length > 0
              ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
              : 0;
          calculatedUserStats.push({
            userId: usrId,
            userName: userMap.get(usrId) || 'Unknown User',
            totalAssigned: stats.assigned,
            completed: stats.completed,
            pending: stats.pending,
            inProgress: stats.inProgress,
            completionRate: stats.assigned > 0 ? (stats.completed / stats.assigned) * 100 : 0,
            avgResponseTimeHours: avgResponseTime,
          });
        });

        // Sort by total assigned descending
        calculatedUserStats.sort((a, b) => b.totalAssigned - a.totalAssigned);

        // Calculate category stats
        const calculatedCategoryStats: CategoryStats[] = [];
        categoryMap.forEach((stats, cat) => {
          calculatedCategoryStats.push({
            category: cat,
            total: stats.total,
            completed: stats.completed,
            pending: stats.pending,
          });
        });
        calculatedCategoryStats.sort((a, b) => b.total - a.total);

        // Calculate overall stats
        const avgResponseTime =
          allResponseTimes.length > 0
            ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
            : 0;

        setUserStats(calculatedUserStats);
        setCategoryStats(calculatedCategoryStats);
        setOverallStats({
          totalTasks,
          completedTasks,
          pendingTasks,
          inProgressTasks,
          overallCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
          avgResponseTimeHours: avgResponseTime,
        });
      } catch (err) {
        console.error('Error loading task analytics:', err);
        setError('Failed to load task analytics');
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [timeRange]);

  // Format category name for display
  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format hours to readable string
  const formatResponseTime = (hours: number) => {
    if (hours < 1) return '< 1 hour';
    if (hours < 24) return `${Math.round(hours)} hours`;
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Task Analytics
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 4 }}>
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Task Analytics
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/admin"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/admin');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Administration
        </Link>
        <Typography color="text.primary">Task Analytics</Typography>
      </Breadcrumbs>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Task Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track task assignments and completion metrics across users
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, value) => value && setTimeRange(value)}
          size="small"
        >
          <ToggleButton value="7d">7 Days</ToggleButton>
          <ToggleButton value="30d">30 Days</ToggleButton>
          <ToggleButton value="90d">90 Days</ToggleButton>
          <ToggleButton value="all">All Time</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Summary Cards */}
      {overallStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <TaskIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4">{overallStats.totalTasks}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Tasks
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <CompletedIcon sx={{ fontSize: 40, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4">{overallStats.completedTasks}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <PendingIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4">
                      {overallStats.pendingTasks + overallStats.inProgressTasks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'info.main' }} />
                  <Box>
                    <Typography variant="h4">
                      {overallStats.overallCompletionRate.toFixed(0)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completion Rate
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* User Performance Table */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        User Performance
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell align="center">Assigned</TableCell>
              <TableCell align="center">Completed</TableCell>
              <TableCell align="center">Pending</TableCell>
              <TableCell align="center">Completion Rate</TableCell>
              <TableCell align="center">Avg Response Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userStats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No task data available</Typography>
                </TableCell>
              </TableRow>
            ) : (
              userStats.map((stat) => (
                <TableRow key={stat.userId} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography>{stat.userName}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={stat.totalAssigned} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={stat.completed} size="small" color="success" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={stat.pending + stat.inProgress}
                      size="small"
                      color={stat.pending + stat.inProgress > 5 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={`${stat.completed} of ${stat.totalAssigned} completed`}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={stat.completionRate}
                          sx={{ width: 60, height: 8, borderRadius: 4 }}
                          color={
                            stat.completionRate >= 80
                              ? 'success'
                              : stat.completionRate >= 50
                                ? 'warning'
                                : 'error'
                          }
                        />
                        <Typography variant="body2">{stat.completionRate.toFixed(0)}%</Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      justifyContent="center"
                    >
                      <TimeIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {stat.avgResponseTimeHours > 0
                          ? formatResponseTime(stat.avgResponseTimeHours)
                          : '-'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Category Breakdown */}
      <Typography variant="h6" gutterBottom>
        Task Categories
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="center">Total</TableCell>
              <TableCell align="center">Completed</TableCell>
              <TableCell align="center">Pending</TableCell>
              <TableCell align="center">Completion Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categoryStats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary">No category data available</Typography>
                </TableCell>
              </TableRow>
            ) : (
              categoryStats.map((stat) => (
                <TableRow key={stat.category} hover>
                  <TableCell>
                    <Chip label={formatCategory(stat.category)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">{stat.total}</TableCell>
                  <TableCell align="center">{stat.completed}</TableCell>
                  <TableCell align="center">{stat.pending}</TableCell>
                  <TableCell align="center">
                    {stat.total > 0 ? ((stat.completed / stat.total) * 100).toFixed(0) : 0}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
