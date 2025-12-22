'use client';

/**
 * Edit User Dialog
 *
 * Dialog for editing user information and permissions.
 * Uses ALL_PERMISSIONS for a flat list of all permission checkboxes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FormControlLabel,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department, UserStatus } from '@vapour/types';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  hasPermission,
  hasPermission2,
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
  ALL_PERMISSIONS,
  type PermissionItem,
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

  // Split permissions into regular and admin-only
  const regularPermissions = useMemo(() => ALL_PERMISSIONS.filter((p) => !p.adminOnly), []);
  const adminPermissions = useMemo(() => ALL_PERMISSIONS.filter((p) => p.adminOnly), []);

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
    let newPerms = permissions;
    let newPerms2 = permissions2;
    // Clear all regular permissions
    regularPermissions.forEach((perm) => {
      if (perm.field === 'permissions2') {
        newPerms2 &= ~perm.flag;
      } else {
        newPerms &= ~perm.flag;
      }
    });
    // Also clear admin permissions
    adminPermissions.forEach((perm) => {
      if (perm.field === 'permissions2') {
        newPerms2 &= ~perm.flag;
      } else {
        newPerms &= ~perm.flag;
      }
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2, regularPermissions, adminPermissions]);

  const grantFullAccess = useCallback(() => {
    setPermissions(getAllPermissions());
    setPermissions2(getAllPermissions2());
  }, []);

  // Check if current user is admin (has MANAGE_USERS)
  const isAdmin = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);

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
