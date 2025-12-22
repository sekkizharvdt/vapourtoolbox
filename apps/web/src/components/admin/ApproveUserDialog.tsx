'use client';

/**
 * Approve User Dialog
 *
 * Dialog for approving new users and setting their initial permissions.
 * Uses ALL_PERMISSIONS for a flat list of all permission checkboxes.
 * Matches the structure of EditUserDialog.
 */

import { useState, useCallback, useMemo } from 'react';
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
  Tooltip,
  FormControlLabel,
  Divider,
  Stack,
} from '@mui/material';
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
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
  ALL_PERMISSIONS,
  type PermissionItem,
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

  // Split permissions into regular and admin-only
  const regularPermissions = useMemo(() => ALL_PERMISSIONS.filter((p) => !p.adminOnly), []);
  const adminPermissions = useMemo(() => ALL_PERMISSIONS.filter((p) => p.adminOnly), []);

  // Check if a permission is set
  const hasPermissionCheck = useCallback(
    (perm: PermissionItem): boolean => {
      if (perm.field === 'permissions2') {
        return hasPermission2(permissions2, perm.flag);
      }
      return hasPermission(permissions, perm.flag);
    },
    [permissions, permissions2]
  );

  // Toggle a permission
  const togglePermissionItem = useCallback((perm: PermissionItem) => {
    if (perm.field === 'permissions2') {
      setPermissions2((prev) => (prev & perm.flag ? prev & ~perm.flag : prev | perm.flag));
    } else {
      setPermissions((prev) => (prev & perm.flag ? prev & ~perm.flag : prev | perm.flag));
    }
  }, []);

  // Check if user has admin permission
  const isAdmin = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);

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
  const selectAll = useCallback(() => {
    let newPerms = permissions;
    let newPerms2 = permissions2;
    regularPermissions.forEach((perm) => {
      if (perm.field === 'permissions2') {
        newPerms2 |= perm.flag;
      } else {
        newPerms |= perm.flag;
      }
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2, regularPermissions]);

  const clearAll = useCallback(() => {
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
    if (permissions === 0 && permissions2 === 0) {
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

          {/* Permissions Section */}
          <Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Permissions
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="text" onClick={selectAll}>
                  Select All
                </Button>
                <Button size="small" variant="text" color="inherit" onClick={clearAll}>
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

            {/* Regular Permissions - Flat checkbox list */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 0.5,
                mb: 2,
              }}
            >
              {regularPermissions.map((perm) => (
                <Tooltip key={`${perm.field}-${perm.flag}`} title={perm.description} arrow>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={hasPermissionCheck(perm)}
                        onChange={() => togglePermissionItem(perm)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {perm.label}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Admin Permissions Section */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Admin Permissions
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              These permissions grant access to sensitive system functions
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 0.5,
                backgroundColor: isAdmin ? 'action.hover' : 'transparent',
                p: 1,
                borderRadius: 1,
              }}
            >
              {adminPermissions.map((perm) => (
                <Tooltip key={`${perm.field}-${perm.flag}`} title={perm.description} arrow>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={hasPermissionCheck(perm)}
                        onChange={() => togglePermissionItem(perm)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {perm.label}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Tooltip>
              ))}
            </Box>
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
