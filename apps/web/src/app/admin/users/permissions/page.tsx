'use client';

/**
 * Permission Matrix Page
 *
 * Comprehensive permission visibility with dual views:
 * - By Module: Select a module, see all users and their permissions
 * - By User: Select a user, see all their permissions across modules
 *
 * Provides a complete overview of who has what access in the system.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Avatar,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  ViewModule as ViewModuleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User } from '@vapour/types';
import { LoadingState } from '@vapour/ui';
import {
  MODULE_PERMISSIONS,
  hasPermission,
  hasPermission2,
  type PermissionDef,
} from '@vapour/constants';

type ViewMode = 'by-module' | 'by-user';

/**
 * User with ID type for Firestore documents
 */
type UserWithId = User & { id: string };

/**
 * Check if user has a specific permission
 */
function userHasPermission(user: UserWithId, permission: PermissionDef): boolean {
  const perms =
    permission.field === 'permissions2' ? user.permissions2 || 0 : user.permissions || 0;
  const checkFn = permission.field === 'permissions2' ? hasPermission2 : hasPermission;
  return checkFn(perms, permission.flag);
}

/**
 * Get permission cell content
 */
function PermissionCell({ hasPermission }: { hasPermission: boolean }) {
  return (
    <TableCell align="center" sx={{ p: 1 }}>
      {hasPermission ? (
        <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
      ) : (
        <Box sx={{ width: 20, height: 20 }} /> // Empty space for alignment
      )}
    </TableCell>
  );
}

/**
 * Get category color for chips
 */
function getCategoryColor(
  category: PermissionDef['category']
): 'success' | 'primary' | 'warning' | 'default' {
  switch (category) {
    case 'view':
      return 'default';
    case 'manage':
      return 'primary';
    case 'approve':
      return 'success';
    case 'action':
      return 'warning';
    default:
      return 'default';
  }
}

export default function PermissionMatrixPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('by-module');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(MODULE_PERMISSIONS[0]?.id || '');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  // Load users
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);

    const constraints: QueryConstraint[] = [orderBy('displayName', 'asc')];
    if (statusFilter === 'active') {
      constraints.unshift(where('isActive', '==', true));
    }

    const q = query(usersRef, ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserWithId[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserWithId);
      });
      setUsers(usersData);
      setLoading(false);

      // Auto-select first user if not set
      if (!selectedUserId && usersData.length > 0) {
        setSelectedUserId(usersData[0]?.id || '');
      }
    });

    return () => unsubscribe();
  }, [statusFilter, selectedUserId]);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.displayName?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Get selected module
  const selectedModule = useMemo(() => {
    return MODULE_PERMISSIONS.find((m) => m.id === selectedModuleId);
  }, [selectedModuleId]);

  // Get selected user
  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId);
  }, [users, selectedUserId]);

  // Calculate summary stats for current view
  const summary = useMemo(() => {
    if (viewMode === 'by-module' && selectedModule) {
      const stats = selectedModule.permissions.map((perm) => {
        const count = filteredUsers.filter((u) => userHasPermission(u, perm)).length;
        return { label: perm.label, count };
      });
      return stats;
    }
    return [];
  }, [viewMode, selectedModule, filteredUsers]);

  // Export to CSV
  const handleExport = () => {
    let csvContent = '';

    if (viewMode === 'by-module' && selectedModule) {
      // Headers
      csvContent = 'User,' + selectedModule.permissions.map((p) => p.label).join(',') + '\n';

      // Data rows
      filteredUsers.forEach((user) => {
        const row = [
          user.displayName || user.email || 'Unknown',
          ...selectedModule.permissions.map((perm) =>
            userHasPermission(user, perm) ? 'Yes' : 'No'
          ),
        ];
        csvContent += row.join(',') + '\n';
      });
    } else if (viewMode === 'by-user' && selectedUser) {
      // Headers
      csvContent = 'Module,Permission,Has Access\n';

      // Data rows
      MODULE_PERMISSIONS.forEach((module) => {
        module.permissions.forEach((perm) => {
          csvContent += `"${module.name}","${perm.label}",${userHasPermission(selectedUser, perm) ? 'Yes' : 'No'}\n`;
        });
      });
    }

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      viewMode === 'by-module'
        ? `permissions-${selectedModuleId}.csv`
        : `permissions-${selectedUser?.displayName || 'user'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState message="Loading permission data..." />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push('/admin/users')}
              sx={{ mb: 1 }}
            >
              Back to Users
            </Button>
            <Typography variant="h4" gutterBottom>
              Permission Matrix
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive view of user permissions across all modules
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
              Export CSV
            </Button>
          </Stack>
        </Box>

        {/* View Mode Toggle and Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="by-module">
                <ViewModuleIcon sx={{ mr: 1 }} />
                By Module
              </ToggleButton>
              <ToggleButton value="by-user">
                <PersonIcon sx={{ mr: 1 }} />
                By User
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: 'none', md: 'block' } }}
            />

            {/* Module/User Selector based on view mode */}
            {viewMode === 'by-module' ? (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Module</InputLabel>
                <Select
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  label="Module"
                >
                  {MODULE_PERMISSIONS.map((module) => (
                    <MenuItem key={module.id} value={module.id}>
                      {module.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>User</InputLabel>
                <Select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  label="User"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.displayName || user.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Search (only for by-module view) */}
            {viewMode === 'by-module' && (
              <TextField
                placeholder="Search users..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200 }}
              />
            )}

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all')}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Summary Stats (for by-module view) */}
        {viewMode === 'by-module' && selectedModule && summary.length > 0 && (
          <Alert severity="info" icon={false}>
            <Typography variant="body2">
              <strong>{selectedModule.name}</strong> - {filteredUsers.length} users shown
              {summary.map((s, i) => (
                <span key={s.label}>
                  {i === 0 ? ': ' : ', '}
                  {s.count} with {s.label}
                </span>
              ))}
            </Typography>
          </Alert>
        )}

        {/* By User Summary */}
        {viewMode === 'by-user' && selectedUser && (
          <Alert severity="info" icon={false}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ width: 32, height: 32 }}>{selectedUser.displayName?.[0] || 'U'}</Avatar>
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {selectedUser.displayName || selectedUser.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedUser.email} | {selectedUser.department || 'No department'}
                </Typography>
              </Box>
            </Stack>
          </Alert>
        )}

        {/* Matrix Table */}
        <Paper>
          {viewMode === 'by-module' && selectedModule ? (
            /* By Module View - Users as rows, permissions as columns */
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>User</TableCell>
                    {selectedModule.permissions.map((perm) => (
                      <TableCell
                        key={perm.label}
                        align="center"
                        sx={{ fontWeight: 'bold', minWidth: 80 }}
                      >
                        <Tooltip title={perm.description}>
                          <Chip
                            label={perm.label}
                            size="small"
                            color={getCategoryColor(perm.category)}
                            variant="outlined"
                          />
                        </Tooltip>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedModule.permissions.length + 1} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No users found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                              {user.displayName?.[0] || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {user.displayName || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {user.email}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        {selectedModule.permissions.map((perm) => (
                          <PermissionCell
                            key={perm.label}
                            hasPermission={userHasPermission(user, perm)}
                          />
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : viewMode === 'by-user' && selectedUser ? (
            /* By User View - Modules as rows, permissions as columns */
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Module</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 300 }}>Permissions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MODULE_PERMISSIONS.map((module) => {
                    const userPerms = module.permissions.filter((p) =>
                      userHasPermission(selectedUser, p)
                    );
                    const hasAny = userPerms.length > 0;

                    return (
                      <TableRow key={module.id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={hasAny ? 'bold' : 'normal'}>
                              {module.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {module.description}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {hasAny ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                              {userPerms.map((perm) => (
                                <Chip
                                  key={perm.label}
                                  label={perm.label}
                                  size="small"
                                  color={getCategoryColor(perm.category)}
                                  icon={<CheckIcon sx={{ fontSize: 14 }} />}
                                />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              No access
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Select a view
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a module or user to view permissions
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Legend */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Permission Categories
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip label="View" size="small" color="default" variant="outlined" />
            <Chip label="Manage" size="small" color="primary" variant="outlined" />
            <Chip label="Approve" size="small" color="success" variant="outlined" />
            <Chip label="Action" size="small" color="warning" variant="outlined" />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
