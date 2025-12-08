'use client';

/**
 * Approve User Dialog
 *
 * Dialog for approving new users and setting their initial permissions.
 * Uses RESTRICTED_MODULES config for a clean 6-row permission table.
 * Matches the structure of EditUserDialog.
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Checkbox,
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
import type { User, Department } from '@vapour/types';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  PERMISSION_PRESETS,
  hasPermission,
  hasPermission2,
  RESTRICTED_MODULES,
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
} from '@vapour/constants';

interface ApproveUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApproveUserDialog({ open, user, onClose, onSuccess }: ApproveUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [permissions, setPermissions] = useState(0);
  const [permissions2, setPermissions2] = useState(0);
  const [department, setDepartment] = useState<Department | ''>('');
  const [jobTitle, setJobTitle] = useState('');

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

  // Apply a permission preset
  const applyPreset = useCallback((presetName: keyof typeof PERMISSION_PRESETS) => {
    const presetValue = PERMISSION_PRESETS[presetName];
    setPermissions(presetValue);
    // Full access gets all permissions2
    if (presetName === 'FULL_ACCESS') {
      setPermissions2(getAllPermissions2());
    } else {
      setPermissions2(0);
    }
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
    setPermissions(0);
    setPermissions2(0);
  }, []);

  const grantFullAccess = useCallback(() => {
    setPermissions(getAllPermissions());
    setPermissions2(getAllPermissions2());
  }, []);

  const handleApprove = async () => {
    if (!user) return;

    // Validation
    if (permissions === 0) {
      setError('At least one permission is required');
      return;
    }

    if (!department) {
      setError('Department is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);

      // Update user document - set to active and assign permissions
      await updateDoc(userRef, {
        permissions,
        permissions2,
        department,
        jobTitle: jobTitle.trim() || null,
        status: 'active',
        isActive: true,
        updatedAt: Timestamp.now(),
      });

      // Note: Custom claims will be set by Cloud Function trigger
      onSuccess();
      onClose();

      // Reset form
      setPermissions(0);
      setPermissions2(0);
      setDepartment('');
      setJobTitle('');
    } catch (err: unknown) {
      console.error('Error approving user:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to approve user. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;

    if (
      !confirm(
        `Are you sure you want to reject ${user.displayName}? This will mark them as inactive.`
      )
    ) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);

      // Mark as inactive/rejected
      await updateDoc(userRef, {
        status: 'inactive',
        isActive: false,
        updatedAt: Timestamp.now(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error rejecting user:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reject user. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setPermissions(0);
      setPermissions2(0);
      setDepartment('');
      setJobTitle('');
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Approve New User</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* User Info */}
        <Box sx={{ mb: 3, mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            User Information
          </Typography>
          <Typography variant="body2">
            <strong>Name:</strong> {user.displayName}
          </Typography>
          <Typography variant="body2">
            <strong>Email:</strong> {user.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Signed up: {user.createdAt?.toDate().toLocaleString()}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Job Title & Department */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Job Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g., Senior Engineer"
            />
            <FormControl fullWidth required size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={department}
                label="Department"
                onChange={(e) => setDepartment(e.target.value as Department | '')}
              >
                {getDepartmentOptions().map((dept) => (
                  <MenuItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider sx={{ my: 1 }} />

          {/* Quick Presets */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Quick Presets
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" onClick={() => applyPreset('FULL_ACCESS')}>
                Full Access
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('MANAGER')}>
                Manager
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('FINANCE')}>
                Finance
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('ENGINEERING')}>
                Engineering
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('PROCUREMENT')}>
                Procurement
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('VIEWER')}>
                Viewer
              </Button>
            </Stack>
          </Box>

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

          {/* Info */}
          <Alert severity="info" sx={{ mt: 1 }}>
            Once approved, the user will be able to sign in with their assigned permissions.
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleReject} color="error" disabled={loading}>
          Reject
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleApprove}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Approving...' : 'Approve User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
