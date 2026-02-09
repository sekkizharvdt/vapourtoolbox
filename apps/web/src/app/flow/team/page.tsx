'use client';

/**
 * Team Board Page
 *
 * Grid of team members showing their active tasks (todo + in progress).
 * Queries manualTasks for the entity and groups by assignee.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Avatar,
  Chip,
  Stack,
  TextField,
  InputAdornment,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Flag as FlagIcon,
  RadioButtonUnchecked as TodoIcon,
  PlayCircleOutline as InProgressIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToTeamTasks } from '@/lib/tasks/manualTaskService';
import { COLLECTIONS } from '@vapour/firebase';
import type { ManualTask } from '@vapour/types';

interface TeamMember {
  uid: string;
  displayName: string;
  department?: string;
  photoURL?: string;
}

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

export default function TeamBoardPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const entityId = claims?.entityId || 'default-entity';

  // FL-15: Load active users filtered by entity
  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      where('entityId', '==', entityId),
      orderBy('displayName', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: TeamMember[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            uid: doc.id,
            displayName: data.displayName || data.email || 'Unknown',
            department: data.department,
            photoURL: data.photoURL,
          });
        });
        setMembers(list);
        setLoadingMembers(false);
      },
      () => {
        setLoadingMembers(false);
      }
    );

    return () => unsubscribe();
  }, [db, entityId]);

  // Subscribe to all active team tasks
  useEffect(() => {
    if (!db) return;

    setLoadingTasks(true);

    const unsubscribe = subscribeToTeamTasks(
      db,
      entityId,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setLoadingTasks(false);
      },
      () => {
        setLoadingTasks(false);
      }
    );

    return () => unsubscribe();
  }, [db, entityId]);

  // Group tasks by assignee
  const tasksByAssignee = useMemo(() => {
    const grouped: Record<string, ManualTask[]> = {};
    tasks.forEach((task) => {
      const key = task.assigneeId;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key]!.push(task);
    });
    return grouped;
  }, [tasks]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) => m.displayName.toLowerCase().includes(q) || m.department?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  // Sort: members with tasks first, then alphabetical
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      const aCount = tasksByAssignee[a.uid]?.length || 0;
      const bCount = tasksByAssignee[b.uid]?.length || 0;
      if (aCount > 0 && bCount === 0) return -1;
      if (aCount === 0 && bCount > 0) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [filteredMembers, tasksByAssignee]);

  const loading = loadingMembers || loadingTasks;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalActiveTasks = tasks.length;
  const membersWithTasks = Object.keys(tasksByAssignee).length;

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
        <Typography color="text.primary">Team Board</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Team Board
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {totalActiveTasks} active task{totalActiveTasks !== 1 ? 's' : ''} across{' '}
          {membersWithTasks} member{membersWithTasks !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <TextField
        size="small"
        placeholder="Search team members..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3, maxWidth: 400 }}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {sortedMembers.length === 0 ? (
        <Alert severity="info">No team members found.</Alert>
      ) : (
        <Grid container spacing={2}>
          {sortedMembers.map((member) => {
            const memberTasks = tasksByAssignee[member.uid] || [];
            const todoCount = memberTasks.filter((t) => t.status === 'todo').length;
            const inProgressCount = memberTasks.filter((t) => t.status === 'in_progress').length;

            return (
              <Grid key={member.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    opacity: memberTasks.length === 0 ? 0.6 : 1,
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    {/* Member header */}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Avatar src={member.photoURL} sx={{ width: 40, height: 40, fontSize: 18 }}>
                        {member.displayName.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle1" noWrap>
                          {member.displayName}
                        </Typography>
                        {member.department && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {member.department}
                          </Typography>
                        )}
                      </Box>
                      {/* Status summary chips */}
                      <Stack direction="row" spacing={0.5}>
                        {todoCount > 0 && (
                          <Chip
                            icon={<TodoIcon sx={{ fontSize: 14 }} />}
                            label={todoCount}
                            size="small"
                            variant="outlined"
                            sx={{ height: 24 }}
                          />
                        )}
                        {inProgressCount > 0 && (
                          <Chip
                            icon={<InProgressIcon sx={{ fontSize: 14 }} />}
                            label={inProgressCount}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 24 }}
                          />
                        )}
                      </Stack>
                    </Stack>

                    {/* Task list */}
                    {memberTasks.length === 0 ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                      >
                        No active tasks
                      </Typography>
                    ) : (
                      <Stack spacing={0.75}>
                        {memberTasks.slice(0, 5).map((task) => (
                          <Box
                            key={task.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              py: 0.5,
                              px: 1,
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                            }}
                          >
                            {task.status === 'in_progress' ? (
                              <InProgressIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                            ) : (
                              <TodoIcon sx={{ fontSize: 16, color: 'action.active' }} />
                            )}
                            <Typography
                              variant="body2"
                              sx={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {task.title}
                            </Typography>
                            <Chip
                              icon={<FlagIcon />}
                              label={task.priority}
                              size="small"
                              color={PRIORITY_COLORS[task.priority] || 'default'}
                              variant="outlined"
                              sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.65rem' } }}
                            />
                          </Box>
                        ))}
                        {memberTasks.length > 5 && (
                          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                            +{memberTasks.length - 5} more
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
