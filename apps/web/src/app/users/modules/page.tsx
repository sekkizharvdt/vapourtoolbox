'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Snackbar,
  Badge,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User } from '@vapour/types';
import {
  PERMISSION_FLAGS,
  PERMISSION_FLAGS_2,
  hasPermission,
  hasPermission2,
} from '@vapour/constants';

// Define module permission mappings
interface ModulePermissionConfig {
  id: string;
  name: string;
  viewFlag: number;
  manageFlag: number;
  field: 'permissions' | 'permissions2';
}

const MODULE_PERMISSIONS: ModulePermissionConfig[] = [
  // permissions field modules
  {
    id: 'user-management',
    name: 'User Management',
    viewFlag: PERMISSION_FLAGS.VIEW_USERS,
    manageFlag: PERMISSION_FLAGS.MANAGE_USERS,
    field: 'permissions',
  },
  {
    id: 'project-management',
    name: 'Project Management',
    viewFlag: PERMISSION_FLAGS.VIEW_PROJECTS,
    manageFlag: PERMISSION_FLAGS.MANAGE_PROJECTS,
    field: 'permissions',
  },
  {
    id: 'entity-management',
    name: 'Entity Management',
    viewFlag: PERMISSION_FLAGS.VIEW_ENTITIES,
    manageFlag: PERMISSION_FLAGS.CREATE_ENTITIES,
    field: 'permissions',
  },
  {
    id: 'time-tracking',
    name: 'Time Tracking',
    viewFlag: PERMISSION_FLAGS.VIEW_TIME_TRACKING,
    manageFlag: PERMISSION_FLAGS.MANAGE_TIME_TRACKING,
    field: 'permissions',
  },
  {
    id: 'accounting',
    name: 'Accounting',
    viewFlag: PERMISSION_FLAGS.VIEW_ACCOUNTING,
    manageFlag: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    field: 'permissions',
  },
  {
    id: 'procurement',
    name: 'Procurement',
    viewFlag: PERMISSION_FLAGS.VIEW_PROCUREMENT,
    manageFlag: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    field: 'permissions',
  },
  {
    id: 'estimation',
    name: 'Estimation',
    viewFlag: PERMISSION_FLAGS.VIEW_ESTIMATION,
    manageFlag: PERMISSION_FLAGS.MANAGE_ESTIMATION,
    field: 'permissions',
  },
  {
    id: 'documents',
    name: 'Documents',
    viewFlag: PERMISSION_FLAGS.SUBMIT_DOCUMENTS,
    manageFlag: PERMISSION_FLAGS.MANAGE_DOCUMENTS,
    field: 'permissions',
  },
  // permissions2 field modules
  {
    id: 'material-database',
    name: 'Material Database',
    viewFlag: PERMISSION_FLAGS_2.VIEW_MATERIAL_DB,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB,
    field: 'permissions2',
  },
  {
    id: 'shape-database',
    name: 'Shape Database',
    viewFlag: PERMISSION_FLAGS_2.VIEW_SHAPE_DB,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_SHAPE_DB,
    field: 'permissions2',
  },
  {
    id: 'bought-out-database',
    name: 'Bought Out Database',
    viewFlag: PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB,
    field: 'permissions2',
  },
  {
    id: 'thermal-desal',
    name: 'Thermal Desalination',
    viewFlag: PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL,
    field: 'permissions2',
  },
  {
    id: 'process-data',
    name: 'Process Data (SSOT)',
    viewFlag: PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL, // Shares permission with Thermal Desal
    manageFlag: PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL,
    field: 'permissions2',
  },
  // Note: Thermal Calculators is open to all users - no permission management needed
];

export default function ModuleAccessPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<ModulePermissionConfig | null>(
    MODULE_PERMISSIONS[0] ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load active users
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          uid: doc.id,
        })) as User[];
        setUsers(usersData.sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Calculate user counts per module
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MODULE_PERMISSIONS.forEach((module) => {
      counts[module.id] = users.filter((user) => {
        if (module.field === 'permissions') {
          return hasPermission(user.permissions || 0, module.viewFlag);
        } else {
          return hasPermission2(user.permissions2 || 0, module.viewFlag);
        }
      }).length;
    });
    return counts;
  }, [users]);

  // Filter users for selected module
  const filteredUsers = useMemo(() => {
    if (!selectedModule) return [];

    return users.filter((user) => {
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !user.displayName.toLowerCase().includes(query) &&
          !user.email.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, selectedModule, searchQuery]);

  // Check if user has permission
  const userHasViewPermission = (user: User, module: ModulePermissionConfig) => {
    if (module.field === 'permissions') {
      return hasPermission(user.permissions || 0, module.viewFlag);
    }
    return hasPermission2(user.permissions2 || 0, module.viewFlag);
  };

  const userHasManagePermission = (user: User, module: ModulePermissionConfig) => {
    if (module.field === 'permissions') {
      return hasPermission(user.permissions || 0, module.manageFlag);
    }
    return hasPermission2(user.permissions2 || 0, module.manageFlag);
  };

  // Toggle permission for a user
  const togglePermission = async (
    user: User,
    module: ModulePermissionConfig,
    type: 'view' | 'manage'
  ) => {
    const flag = type === 'view' ? module.viewFlag : module.manageFlag;
    const field = module.field;
    const currentPerms = field === 'permissions' ? user.permissions || 0 : user.permissions2 || 0;

    const hasFlag =
      field === 'permissions'
        ? hasPermission(currentPerms, flag)
        : hasPermission2(currentPerms, flag);

    const newPerms = hasFlag ? currentPerms & ~flag : currentPerms | flag;

    setUpdating(`${user.uid}-${type}`);

    try {
      const { db } = getFirebase();
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);

      await updateDoc(userRef, {
        [field]: newPerms,
        updatedAt: Timestamp.now(),
      });

      setSnackbar({
        open: true,
        message: `${type === 'view' ? 'View' : 'Manage'} permission ${hasFlag ? 'removed from' : 'granted to'} ${user.displayName}`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating permission:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update permission',
        severity: 'error',
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Module Access Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage user permissions by module. Select a module to see and modify which users have
        access.
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 250px)' }}>
        {/* Module List */}
        <Paper sx={{ width: 280, flexShrink: 0, overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              MODULES
            </Typography>
          </Box>
          <List dense>
            {MODULE_PERMISSIONS.map((module) => (
              <ListItemButton
                key={module.id}
                selected={selectedModule?.id === module.id}
                onClick={() => setSelectedModule(module)}
              >
                <ListItemText primary={module.name} />
                <Badge badgeContent={moduleCounts[module.id]} color="primary" sx={{ mr: 1 }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* User List */}
        <Paper sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedModule && (
            <>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle1">
                    Users with {selectedModule.name} Access
                    <Chip
                      label={moduleCounts[selectedModule.id]}
                      size="small"
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 300 }}
                />
              </Box>

              <TableContainer sx={{ flex: 1 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="center" sx={{ width: 100 }}>
                        View
                      </TableCell>
                      <TableCell align="center" sx={{ width: 100 }}>
                        Manage
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const hasView = userHasViewPermission(user, selectedModule);
                      const hasManage = userHasManagePermission(user, selectedModule);

                      return (
                        <TableRow
                          key={user.uid}
                          sx={{
                            bgcolor: hasView || hasManage ? 'action.selected' : 'transparent',
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2">{user.displayName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={hasView}
                              onChange={() => togglePermission(user, selectedModule, 'view')}
                              disabled={updating === `${user.uid}-view`}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={hasManage}
                              onChange={() => togglePermission(user, selectedModule, 'manage')}
                              disabled={updating === `${user.uid}-manage`}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                            {searchQuery ? 'No users found matching your search' : 'No users found'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        Changes are saved immediately. Users may need to sign out and sign back in for permission
        changes to take effect.
      </Alert>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
