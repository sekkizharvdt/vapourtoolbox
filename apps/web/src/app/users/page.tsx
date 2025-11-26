'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Container,
  Typography,
  Box,
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
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
import { useAuth } from '@/contexts/AuthContext';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { ApproveUserDialog } from '@/components/admin/ApproveUserDialog';
import {
  PageHeader,
  FilterBar,
  LoadingState,
  EmptyState,
  TableActionCell,
  getStatusColor,
  getRoleColor,
} from '@vapour/ui';
import { PERMISSION_FLAGS, hasPermission, getAllPermissions } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';

export default function UserManagementPage() {
  const { claims } = useAuth();
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
  const pendingUsers = users.filter((user) => user.status === 'pending');

  // Client-side filtering (excluding pending users - they're shown separately)
  const filteredUsers = users.filter((user) => {
    // Exclude pending users (shown in separate section)
    if (user.status === 'pending') return false;

    // Search filter
    const matchesSearch = searchTerm
      ? (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    return matchesSearch;
  });

  // Pagination
  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get user role label based on permissions
  const getUserRoleLabel = (permissions: number | undefined): string => {
    if (!permissions || permissions === 0) return 'No permissions';
    const allPermissions = getAllPermissions();
    if (permissions === allPermissions) return 'Super Admin';
    return 'User';
  };

  // Check user permissions - support both MANAGE_USERS and VIEW_USERS
  const userPermissions = claims?.permissions || 0;
  const canManageUsers = hasPermission(userPermissions, PERMISSION_FLAGS.MANAGE_USERS);
  const canViewUsers = hasPermission(userPermissions, PERMISSION_FLAGS.VIEW_USERS);
  const hasAccess = canManageUsers || canViewUsers;

  if (!hasAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            You do not have permission to view or manage users.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="User Management"
          subtitle="Manage users, roles, and permissions"
          action={
            canManageUsers ? (
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => {
                  // TODO: Open invite user dialog
                  alert('Create user dialog coming soon');
                }}
              >
                Invite User
              </Button>
            ) : undefined
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
              p: 2,
              mb: 2,
              bgcolor: 'warning.50',
              border: '1px solid',
              borderColor: 'warning.main',
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Chip label={pendingUsers.length} color="warning" size="small" />
              {pendingUsers.length === 1 ? 'User' : 'Users'} Awaiting Approval
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              {pendingUsers.map((user) => (
                <Box
                  key={user.uid}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {user.photoURL && (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName}
                        width={40}
                        height={40}
                        style={{ borderRadius: '50%' }}
                        unoptimized
                      />
                    )}
                    <div>
                      <Typography variant="body1">{user.displayName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Signed up: {formatDate(user.createdAt)}
                      </Typography>
                    </div>
                  </Box>
                  {canManageUsers && (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => {
                        setUserToApprove(user);
                        setApproveDialogOpen(true);
                      }}
                    >
                      Review & Approve
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Filters */}
        <FilterBar onClear={() => window.location.reload()}>
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
            <LoadingState message="Loading users..." variant="table" colSpan={7} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState message="No users found" variant="table" colSpan={7} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Projects</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.uid} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.photoURL && (
                            <Image
                              src={user.photoURL}
                              alt={user.displayName}
                              width={32}
                              height={32}
                              style={{ borderRadius: '50%' }}
                              unoptimized
                            />
                          )}
                          <Typography variant="body2">{user.displayName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getUserRoleLabel(user.permissions)}
                          size="small"
                          color={getRoleColor(getUserRoleLabel(user.permissions).toUpperCase())}
                        />
                      </TableCell>
                      <TableCell>
                        {user.department && (
                          <Chip label={user.department} size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status}
                          size="small"
                          color={getStatusColor(user.status, 'user')}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(user.assignedProjects || []).length} project(s)
                        </Typography>
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
                              show: canManageUsers,
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
    </Container>
  );
}
