'use client';

/**
 * User Management Page
 *
 * Admin page for managing users, permissions, and access control.
 * Shows module access chips for each user using RESTRICTED_MODULES config.
 * Permission check is handled by the parent admin layout.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  TablePagination,
  Chip,
  Button,
  Alert,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Avatar,
  Stack,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckIcon,
  RemoveCircle as ViewOnlyIcon,
  Star as FullAccessIcon,
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, UserStatus } from '@vapour/types';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { ApproveUserDialog } from '@/components/admin/ApproveUserDialog';
import {
  PageHeader,
  FilterBar,
  LoadingState,
  EmptyState,
  TableActionCell,
  getStatusColor,
} from '@vapour/ui';
import {
  RESTRICTED_MODULES,
  OPEN_MODULES,
  hasPermission,
  hasPermission2,
  getAllPermissions,
} from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';

/**
 * Get module access chips for a user
 * Returns array of { moduleId, moduleName, access: 'manage' | 'view' | 'none' }
 */
function getModuleAccess(
  permissions: number,
  permissions2: number
): Array<{ id: string; name: string; access: 'manage' | 'view' | 'none' }> {
  return RESTRICTED_MODULES.map((module) => {
    const permsToCheck = module.field === 'permissions2' ? permissions2 : permissions;
    const checkFn = module.field === 'permissions2' ? hasPermission2 : hasPermission;

    const hasManage = checkFn(permsToCheck, module.manageFlag);
    const hasView = checkFn(permsToCheck, module.viewFlag);

    return {
      id: module.id,
      name: module.name.replace(' + Process Data', ''), // Shorten for display
      access: hasManage ? 'manage' : hasView ? 'view' : 'none',
    };
  });
}

/**
 * Check if user has full access (all permissions)
 */
function hasFullAccess(permissions: number): boolean {
  const allPerms = getAllPermissions();
  return permissions === allPerms;
}

/**
 * Module Access Chips Component
 */
function ModuleAccessChips({
  permissions,
  permissions2,
}: {
  permissions: number;
  permissions2: number;
}) {
  const moduleAccess = getModuleAccess(permissions, permissions2);
  const isFullAccess = hasFullAccess(permissions);

  if (isFullAccess) {
    return (
      <Chip
        icon={<FullAccessIcon sx={{ fontSize: 14 }} />}
        label="Full Access"
        size="small"
        color="primary"
        variant="filled"
      />
    );
  }

  // Filter to only show modules with at least view access
  const accessibleModules = moduleAccess.filter((m) => m.access !== 'none');

  if (accessibleModules.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No module access
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {accessibleModules.map((module) => (
        <Tooltip
          key={module.id}
          title={`${module.name}: ${module.access === 'manage' ? 'Can manage' : 'View only'}`}
        >
          <Chip
            icon={
              module.access === 'manage' ? (
                <CheckIcon sx={{ fontSize: 12 }} />
              ) : (
                <ViewOnlyIcon sx={{ fontSize: 12 }} />
              )
            }
            label={module.name.slice(0, 4)}
            size="small"
            color={module.access === 'manage' ? 'success' : 'default'}
            variant={module.access === 'manage' ? 'filled' : 'outlined'}
            sx={{ height: 22, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

/**
 * Pending User Card Component
 */
function PendingUserCard({ user, onApprove }: { user: User; onApprove: (user: User) => void }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt={user.displayName}
            width={40}
            height={40}
            style={{ borderRadius: '50%' }}
            unoptimized
          />
        ) : (
          <Avatar sx={{ width: 40, height: 40 }}>
            {user.displayName?.charAt(0).toUpperCase()}
          </Avatar>
        )}
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {user.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Signed up: {formatDate(user.createdAt)}
          </Typography>
        </Box>
      </Box>
      <Button variant="contained" color="success" size="small" onClick={() => onApprove(user)}>
        Review & Approve
      </Button>
    </Box>
  );
}

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit user dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Approve user dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [userToApprove, setUserToApprove] = useState<User | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Pending section expanded state
  const [pendingExpanded, setPendingExpanded] = useState(true);

  // Load users from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);

    // Build query
    let q = query(usersRef, orderBy('createdAt', 'desc'), firestoreLimit(100));

    // Apply status filter
    if (statusFilter !== 'all') {
      q = query(
        usersRef,
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      );
    }

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData: User[] = [];
        snapshot.forEach((doc) => {
          usersData.push({ ...doc.data(), uid: doc.id } as User);
        });
        setUsers(usersData);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Error loading users:', err);
        setError('Failed to load users. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  // Separate pending users
  const pendingUsers = useMemo(() => users.filter((user) => user.status === 'pending'), [users]);

  // Client-side filtering (excluding pending users - they're shown separately)
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Exclude pending users (shown in separate section)
      if (user.status === 'pending') return false;

      // Search filter
      const matchesSearch = searchTerm
        ? (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      return matchesSearch;
    });
  }, [users, searchTerm]);

  // Pagination
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Manage users, permissions, and module access"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => router.push('/admin/users/permissions')}>
              Permission Matrix
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => {
                // Invite user dialog (future enhancement)
                alert('Invite user dialog coming soon');
              }}
            >
              Invite User
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <Paper
          sx={{
            mb: 2,
            bgcolor: 'warning.50',
            border: '1px solid',
            borderColor: 'warning.main',
          }}
        >
          <Box
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setPendingExpanded(!pendingExpanded)}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={pendingUsers.length} color="warning" size="small" />
              <Typography variant="subtitle1" fontWeight="medium">
                {pendingUsers.length === 1 ? 'User' : 'Users'} Awaiting Approval
              </Typography>
            </Stack>
            <IconButton size="small">
              {pendingExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={pendingExpanded}>
            <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {pendingUsers.map((user) => (
                <PendingUserCard
                  key={user.uid}
                  user={user}
                  onApprove={(u) => {
                    setUserToApprove(u);
                    setApproveDialogOpen(true);
                  }}
                />
              ))}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Info about open modules */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Open to all users:</strong> {OPEN_MODULES.join(', ')}
        </Typography>
      </Alert>

      {/* Filters */}
      <FilterBar
        onClear={() => {
          setSearchTerm('');
          setStatusFilter('all');
          setPage(0);
        }}
      >
        <TextField
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | 'all');
              setPage(0);
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      {/* Users Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <LoadingState message="Loading users..." variant="table" colSpan={5} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState message="No users found" variant="table" colSpan={5} />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Module Access</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.uid} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {user.photoURL ? (
                          <Image
                            src={user.photoURL}
                            alt={user.displayName}
                            width={36}
                            height={36}
                            style={{ borderRadius: '50%' }}
                            unoptimized
                          />
                        ) : (
                          <Avatar sx={{ width: 36, height: 36 }}>
                            {user.displayName?.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {user.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.email}
                          </Typography>
                          {user.jobTitle && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {user.jobTitle}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.department ? (
                        <Chip label={user.department} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <ModuleAccessChips
                        permissions={user.permissions || 0}
                        permissions2={user.permissions2 || 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status}
                        size="small"
                        color={getStatusColor(user.status, 'user')}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            icon: <EditIcon />,
                            label: 'Edit User',
                            onClick: () => {
                              setSelectedUser(user);
                              setEditDialogOpen(true);
                            },
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </TableContainer>

      {/* Chip Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Legend:
        </Typography>
        <Chip
          icon={<CheckIcon sx={{ fontSize: 12 }} />}
          label="Manage"
          size="small"
          color="success"
          variant="filled"
          sx={{ height: 22 }}
        />
        <Chip
          icon={<ViewOnlyIcon sx={{ fontSize: 12 }} />}
          label="View Only"
          size="small"
          color="default"
          variant="outlined"
          sx={{ height: 22 }}
        />
      </Box>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => {
          // User data will update automatically via real-time listener
          setEditDialogOpen(false);
          setSelectedUser(null);
        }}
      />

      {/* Approve User Dialog */}
      <ApproveUserDialog
        open={approveDialogOpen}
        user={userToApprove}
        onClose={() => {
          setApproveDialogOpen(false);
          setUserToApprove(null);
        }}
        onSuccess={() => {
          // User data will update automatically via real-time listener
          setApproveDialogOpen(false);
          setUserToApprove(null);
        }}
      />
    </Box>
  );
}
