'use client';

import { useState } from 'react';
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
  Chip,
  Box,
  Typography,
  Alert,
  CircularProgress,
  OutlinedInput,
  SelectChangeEvent,
  TextField,
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, UserRole, Department } from '@vapour/types';
import { getDepartmentOptions } from '@vapour/constants';

interface ApproveUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Internal roles only (CLIENT_PM not allowed for approval)
const INTERNAL_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'HR_ADMIN',
  'FINANCE_MANAGER',
  'ACCOUNTANT',
  'PROJECT_MANAGER',
  'ENGINEERING_HEAD',
  'ENGINEER',
  'PROCUREMENT_MANAGER',
  'SITE_ENGINEER',
  'TEAM_MEMBER',
];

export function ApproveUserDialog({ open, user, onClose, onSuccess }: ApproveUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [department, setDepartment] = useState<Department | ''>('');
  const [jobTitle, setJobTitle] = useState('');

  const handleRolesChange = (event: SelectChangeEvent<UserRole[]>) => {
    const value = event.target.value;
    setSelectedRoles(typeof value === 'string' ? [value as UserRole] : value);
  };

  const handleApprove = async () => {
    if (!user) return;

    // Validation
    if (selectedRoles.length === 0) {
      setError('At least one role is required');
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

      // Update user document - set to active and assign roles
      await updateDoc(userRef, {
        roles: selectedRoles,
        department,
        jobTitle: jobTitle.trim() || null,
        status: 'active',
        isActive: true,
        updatedAt: Timestamp.now(),
      });

      // Note: Custom claims will be set by Cloud Function trigger
      // The Cloud Function will detect the status change and set claims

      onSuccess();
      onClose();

      // Reset form
      setSelectedRoles([]);
      setDepartment('');
      setJobTitle('');
    } catch (err: unknown) {
      console.error('Error approving user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve user. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;

    if (!confirm(`Are you sure you want to reject ${user.displayName}? This will mark them as inactive.`)) {
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject user. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSelectedRoles([]);
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

        <Box sx={{ mb: 3, mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            User Information
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Name:</strong> {user.displayName}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Email:</strong> {user.email}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Signed up: {user.createdAt?.toDate().toLocaleString()}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Job Title */}
          <TextField
            label="Job Title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            fullWidth
            placeholder="e.g., Senior Engineer"
          />

          {/* Roles (Multi-select) */}
          <FormControl fullWidth required>
            <InputLabel>Roles</InputLabel>
            <Select
              multiple
              value={selectedRoles}
              onChange={handleRolesChange}
              input={<OutlinedInput label="Roles" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((role) => (
                    <Chip key={role} label={role.replace(/_/g, ' ')} size="small" />
                  ))}
                </Box>
              )}
            >
              {INTERNAL_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Department */}
          <FormControl fullWidth required>
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

          {/* Info */}
          <Alert severity="info">
            Once approved, the user will receive an in-app notification and their custom claims
            will be automatically configured. They will need to refresh the page to see the
            changes.
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
