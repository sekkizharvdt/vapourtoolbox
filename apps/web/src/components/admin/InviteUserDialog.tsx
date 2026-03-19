'use client';

/**
 * Invite User Dialog
 *
 * Dialog for inviting new users by pre-configuring their email,
 * department, job title, and permissions. When the invited user
 * signs in for the first time, they get these permissions automatically
 * instead of needing manual approval.
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
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Department } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
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

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserDialog({ open, onClose, onSuccess }: InviteUserDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
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

  const resetForm = useCallback(() => {
    setEmail('');
    setDisplayName('');
    setPermissions(0);
    setPermissions2(0);
    setDepartment('');
    setJobTitle('');
    setError('');
    setSuccess('');
  }, []);

  const handleInvite = async () => {
    // Validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

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
    setSuccess('');

    try {
      const { db } = getFirebase();

      // Check if an invitation already exists for this email
      const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
      const existingQuery = query(
        invitationsRef,
        where('email', '==', trimmedEmail),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        setError('A pending invitation already exists for this email address');
        setLoading(false);
        return;
      }

      // Check if user already exists in the system
      const usersRef = collection(db, COLLECTIONS.USERS);
      const userQuery = query(usersRef, where('email', '==', trimmedEmail));
      const userSnap = await getDocs(userQuery);

      if (!userSnap.empty) {
        setError(
          'A user with this email already exists. Use the edit button to update their permissions.'
        );
        setLoading(false);
        return;
      }

      // Extract domain from email
      const domain = trimmedEmail.split('@')[1];

      // Create invitation document
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days for internal invitations
      );

      await addDoc(invitationsRef, {
        email: trimmedEmail,
        domain,
        role: 'INTERNAL',
        ...(displayName.trim() && { displayName: displayName.trim() }),
        department,
        ...(jobTitle.trim() && { jobTitle: jobTitle.trim() }),
        permissions,
        ...(permissions2 > 0 && { permissions2 }),
        assignedProjects: [],
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
        createdAt: now,
        expiresAt,
        status: 'pending',
      });

      setSuccess(
        `Invitation sent to ${trimmedEmail}. They will receive their permissions when they first sign in.`
      );

      // Reset form after short delay so user can see success message
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('Error creating invitation:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create invitation. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Email & Display Name */}
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            size="small"
            placeholder="name@vapourdesal.com"
            autoFocus
          />

          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            size="small"
            placeholder="Optional — will use Google account name if not set"
            helperText="Leave blank to use the name from their Google account"
          />

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
            When this user signs in for the first time, they will automatically receive these
            permissions without needing manual approval.
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleInvite}
          variant="contained"
          disabled={loading || !!success}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
