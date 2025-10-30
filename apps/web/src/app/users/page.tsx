'use client';

import { useState, useEffect } from 'react';
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
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, UserStatus, UserRole } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { ApproveUserDialog } from '@/components/admin/ApproveUserDialog';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

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
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

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
      q = query(usersRef, where('status', '==', statusFilter), orderBy('createdAt', 'desc'), firestoreLimit(100));
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

    // Role filter
    const matchesRole = roleFilter === 'all' || (user.roles || []).includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  // Pagination
  const paginatedUsers = filteredUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get user status color
  const getStatusColor = (status: UserStatus): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'inactive':
        return 'error';
      default:
        return 'warning';
    }
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage users, roles, and permissions
            </Typography>
          </div>
          {canManageUsers && (
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
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Pending Users Section */}
        {pendingUsers.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        style={{ width: 40, height: 40, borderRadius: '50%' }}
                      />
                    )}
                    <div>
                      <Typography variant="body1">{user.displayName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Signed up: {user.createdAt?.toDate().toLocaleDateString()}
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
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => {
                  setRoleFilter(e.target.value as UserRole | 'all');
                  setPage(0);
                }}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                <MenuItem value="DIRECTOR">Director</MenuItem>
                <MenuItem value="HR_ADMIN">HR Admin</MenuItem>
                <MenuItem value="FINANCE_MANAGER">Finance Manager</MenuItem>
                <MenuItem value="ACCOUNTANT">Accountant</MenuItem>
                <MenuItem value="PROJECT_MANAGER">Project Manager</MenuItem>
                <MenuItem value="ENGINEERING_HEAD">Engineering Head</MenuItem>
                <MenuItem value="ENGINEER">Engineer</MenuItem>
                <MenuItem value="PROCUREMENT_MANAGER">Procurement Manager</MenuItem>
                <MenuItem value="SITE_ENGINEER">Site Engineer</MenuItem>
                <MenuItem value="TEAM_MEMBER">Team Member</MenuItem>
                <MenuItem value="CLIENT_PM">Client PM</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Users Table */}
        <TableContainer component={Paper}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No users found
              </Typography>
            </Box>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Roles</TableCell>
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
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              style={{ width: 32, height: 32, borderRadius: '50%' }}
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
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(user.roles || []).map((role) => (
                            <Chip
                              key={role}
                              label={role.replace(/_/g, ' ')}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
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
                          color={getStatusColor(user.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(user.assignedProjects || []).length} project(s)
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {canManageUsers && (
                          <Tooltip title="Edit User">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
