'use client';

/**
 * Edit User Dialog
 *
 * Simplified dialog for editing user information and permissions.
 * Uses RESTRICTED_MODULES config for a clean 6-row permission table.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Checkbox,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  FormControlLabel,
  Divider,
  Stack,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department, UserStatus } from '@vapour/types';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  hasPermission,
  hasPermission2,
  RESTRICTED_MODULES,
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
} from '@vapour/constants';

interface EditUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserDialog({ open, user, onClose, onSuccess }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [status, setStatus] = useState<UserStatus>('active');
  const [permissions, setPermissions] = useState<number>(0);
  const [permissions2, setPermissions2] = useState<number>(0);

  // Initialize form when user changes
  useEffect(() => {
    if (user && open) {
      setDisplayName(user.displayName);
      setPhone(user.phone || '');
      setMobile(user.mobile || '');
      setJobTitle(user.jobTitle || '');
      setDepartment(user.department || '');
      setStatus(user.status);
      setPermissions(user.permissions || 0);
      setPermissions2(user.permissions2 || 0);
      setSaveSuccess(false);
      setError('');
    }
  }, [user, open]);

  // Check if permission is set
  const hasViewPermission = useCallback(
    (module: (typeof RESTRICTED_MODULES)[number]): boolean => {
      if (module.field === 'permissions2') {
        return hasPermission2(permissions2, module.viewFlag);
      }
      return hasPermission(permissions, module.viewFlag);
    },
    [permissions, permissions2]
  );

  const hasManagePermission = useCallback(
    (module: (typeof RESTRICTED_MODULES)[number]): boolean => {
      if (module.field === 'permissions2') {
        return hasPermission2(permissions2, module.manageFlag);
      }
      return hasPermission(permissions, module.manageFlag);
    },
    [permissions, permissions2]
  );

  // Toggle permission
  const togglePermission = useCallback(
    (flag: number, field: 'permissions' | 'permissions2' = 'permissions') => {
      if (field === 'permissions2') {
        setPermissions2((prev) => (prev & flag ? prev & ~flag : prev | flag));
      } else {
        setPermissions((prev) => (prev & flag ? prev & ~flag : prev | flag));
      }
    },
    []
  );

  // Toggle view permission (also clears manage if unchecking view)
  const toggleView = useCallback(
    (module: (typeof RESTRICTED_MODULES)[number]) => {
      const field = module.field || 'permissions';
      const perms = field === 'permissions2' ? permissions2 : permissions;
      const hasView =
        field === 'permissions2'
          ? hasPermission2(perms, module.viewFlag)
          : hasPermission(perms, module.viewFlag);

      if (hasView) {
        // Unchecking view - also remove manage
        if (field === 'permissions2') {
          setPermissions2((prev) => prev & ~module.viewFlag & ~module.manageFlag);
        } else {
          setPermissions((prev) => prev & ~module.viewFlag & ~module.manageFlag);
        }
      } else {
        // Adding view
        togglePermission(module.viewFlag, field);
      }
    },
    [permissions, permissions2, togglePermission]
  );

  // Toggle manage permission (automatically adds view)
  const toggleManage = useCallback(
    (module: (typeof RESTRICTED_MODULES)[number]) => {
      const field = module.field || 'permissions';
      const perms = field === 'permissions2' ? permissions2 : permissions;
      const hasManage =
        field === 'permissions2'
          ? hasPermission2(perms, module.manageFlag)
          : hasPermission(perms, module.manageFlag);

      if (hasManage) {
        // Just remove manage, keep view
        togglePermission(module.manageFlag, field);
      } else {
        // Add manage + view
        if (field === 'permissions2') {
          setPermissions2((prev) => prev | module.viewFlag | module.manageFlag);
        } else {
          setPermissions((prev) => prev | module.viewFlag | module.manageFlag);
        }
      }
    },
    [permissions, permissions2, togglePermission]
  );

  // Check if user has admin permission
  const isAdmin = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);

  // Toggle admin permission
  const toggleAdmin = useCallback(() => {
    setPermissions((prev) =>
      prev & PERMISSION_FLAGS.MANAGE_USERS
        ? prev & ~PERMISSION_FLAGS.MANAGE_USERS
        : prev | PERMISSION_FLAGS.MANAGE_USERS
    );
  }, []);

  // Quick actions
  const grantAllView = useCallback(() => {
    let newPerms = permissions;
    let newPerms2 = permissions2;
    RESTRICTED_MODULES.forEach((module) => {
      if (module.field === 'permissions2') {
        newPerms2 |= module.viewFlag;
      } else {
        newPerms |= module.viewFlag;
      }
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2]);

  const grantAllManage = useCallback(() => {
    let newPerms = permissions;
    let newPerms2 = permissions2;
    RESTRICTED_MODULES.forEach((module) => {
      if (module.field === 'permissions2') {
        newPerms2 |= module.viewFlag | module.manageFlag;
      } else {
        newPerms |= module.viewFlag | module.manageFlag;
      }
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2]);

  const clearAllPermissions = useCallback(() => {
    // Clear module permissions but keep other flags
    let newPerms = permissions;
    let newPerms2 = permissions2;
    RESTRICTED_MODULES.forEach((module) => {
      if (module.field === 'permissions2') {
        newPerms2 &= ~module.viewFlag & ~module.manageFlag;
      } else {
        newPerms &= ~module.viewFlag & ~module.manageFlag;
      }
    });
    // Also clear admin
    newPerms &= ~PERMISSION_FLAGS.MANAGE_USERS;
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2]);

  const grantFullAccess = useCallback(() => {
    setPermissions(getAllPermissions());
    setPermissions2(getAllPermissions2());
  }, []);

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);

      // Update user document
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        jobTitle: jobTitle.trim() || null,
        department: department || null,
        status,
        permissions,
        permissions2,
        updatedAt: Timestamp.now(),
      });

      // Show success message
      setSaveSuccess(true);

      // Auto-close after showing success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } catch (err: unknown) {
      console.error('Error updating user:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update user. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Prevent closing during save or during success message display
    if (!loading && !saveSuccess) {
      setError('');
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>User updated successfully!</strong>
            <br />
            The user may need to sign out and back in for permission changes to take effect.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Basic Info Section */}
          <Typography variant="subtitle2" color="text.secondary">
            Basic Information
          </Typography>

          {/* Email (Read-only) */}
          <TextField
            label="Email"
            value={user.email}
            disabled
            fullWidth
            size="small"
            helperText="Email cannot be changed"
          />

          {/* Display Name */}
          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            fullWidth
            size="small"
          />

          {/* Row: Phone, Mobile */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>

          {/* Row: Job Title, Department */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Job Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={department}
                label="Department"
                onChange={(e) => setDepartment(e.target.value as Department | '')}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {getDepartmentOptions().map((dept) => (
                  <MenuItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Status */}
          <FormControl fullWidth required size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e) => setStatus(e.target.value as UserStatus)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>

          <Divider sx={{ my: 1 }} />

          {/* Module Access Section */}
          <Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Module Access
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="text" onClick={grantAllView}>
                  All View
                </Button>
                <Button size="small" variant="text" onClick={grantAllManage}>
                  All Manage
                </Button>
                <Button size="small" variant="text" color="inherit" onClick={clearAllPermissions}>
                  Clear
                </Button>
                <Button size="small" variant="outlined" onClick={grantFullAccess}>
                  Full Access
                </Button>
              </Stack>
            </Box>

            {/* Open modules info */}
            <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
              <Typography variant="caption">
                <strong>Open to all:</strong> {OPEN_MODULES.join(', ')}
              </Typography>
            </Alert>

            {/* Restricted Modules Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Module</strong>
                    </TableCell>
                    <TableCell align="center" sx={{ width: 80 }}>
                      <strong>View</strong>
                    </TableCell>
                    <TableCell align="center" sx={{ width: 80 }}>
                      <strong>Manage</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {RESTRICTED_MODULES.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {module.name}
                          {module.note && (
                            <Tooltip title={module.note}>
                              <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox
                          checked={hasViewPermission(module)}
                          onChange={() => toggleView(module)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox
                          checked={hasManagePermission(module)}
                          onChange={() => toggleManage(module)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Admin Access */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Admin Access
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={isAdmin} onChange={toggleAdmin} />}
              label="Can manage users (Administrator)"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              Grants access to Administration section: User Management, Company Settings, Feedback
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
