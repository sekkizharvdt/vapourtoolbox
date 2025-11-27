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
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department } from '@vapour/types';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  PERMISSION_PRESETS,
  MODULES,
} from '@vapour/constants';

interface ApproveUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Group permissions by category for the UI
const PERMISSION_GROUPS = {
  'User & System': [
    { flag: 'MANAGE_USERS', label: 'Manage Users' },
    { flag: 'VIEW_USERS', label: 'View Users' },
    { flag: 'MANAGE_ROLES', label: 'Manage Roles' },
    { flag: 'MANAGE_COMPANY_SETTINGS', label: 'Manage Company Settings' },
  ],
  Projects: [
    { flag: 'MANAGE_PROJECTS', label: 'Manage Projects' },
    { flag: 'VIEW_PROJECTS', label: 'View Projects' },
  ],
  Entities: [
    { flag: 'VIEW_ENTITIES', label: 'View Entities' },
    { flag: 'CREATE_ENTITIES', label: 'Create Entities' },
    { flag: 'EDIT_ENTITIES', label: 'Edit Entities' },
    { flag: 'DELETE_ENTITIES', label: 'Delete Entities' },
  ],
  Procurement: [
    { flag: 'MANAGE_PROCUREMENT', label: 'Manage Procurement' },
    { flag: 'VIEW_PROCUREMENT', label: 'View Procurement' },
  ],
  Accounting: [
    { flag: 'MANAGE_ACCOUNTING', label: 'Manage Accounting' },
    { flag: 'VIEW_ACCOUNTING', label: 'View Accounting' },
    { flag: 'MANAGE_CHART_OF_ACCOUNTS', label: 'Manage Chart of Accounts' },
    { flag: 'CREATE_TRANSACTIONS', label: 'Create Transactions' },
    { flag: 'APPROVE_TRANSACTIONS', label: 'Approve Transactions' },
    { flag: 'VIEW_FINANCIAL_REPORTS', label: 'View Financial Reports' },
    { flag: 'MANAGE_COST_CENTRES', label: 'Manage Cost Centres' },
    { flag: 'MANAGE_FOREX', label: 'Manage Forex' },
    { flag: 'RECONCILE_ACCOUNTS', label: 'Reconcile Accounts' },
  ],
  Estimation: [
    { flag: 'MANAGE_ESTIMATION', label: 'Manage Estimation' },
    { flag: 'VIEW_ESTIMATION', label: 'View Estimation' },
  ],
  'Time & Analytics': [
    { flag: 'MANAGE_TIME_TRACKING', label: 'Manage Time Tracking' },
    { flag: 'VIEW_TIME_TRACKING', label: 'View Time Tracking' },
    { flag: 'VIEW_ANALYTICS', label: 'View Analytics' },
    { flag: 'EXPORT_DATA', label: 'Export Data' },
  ],
} as const;

// Get all module IDs for the module selection
const ALL_MODULES = Object.values(MODULES)
  .filter((m) => m.status === 'active')
  .map((m) => ({ id: m.id, name: m.name }));

export function ApproveUserDialog({ open, user, onClose, onSuccess }: ApproveUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [permissions, setPermissions] = useState(0);
  const [department, setDepartment] = useState<Department | ''>('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [allModulesAccess, setAllModulesAccess] = useState(true);

  // Apply a permission preset
  const applyPreset = (presetName: keyof typeof PERMISSION_PRESETS) => {
    setPermissions(PERMISSION_PRESETS[presetName]);
  };

  // Toggle a permission flag
  const togglePermission = (flag: keyof typeof PERMISSION_FLAGS) => {
    const flagValue = PERMISSION_FLAGS[flag];
    if ((permissions & flagValue) === flagValue) {
      setPermissions(permissions & ~flagValue);
    } else {
      setPermissions(permissions | flagValue);
    }
  };

  // Check if a permission is set
  const hasPermission = (flag: keyof typeof PERMISSION_FLAGS) => {
    const flagValue = PERMISSION_FLAGS[flag];
    return (permissions & flagValue) === flagValue;
  };

  // Toggle module selection
  const toggleModule = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      setSelectedModules(selectedModules.filter((m) => m !== moduleId));
    } else {
      setSelectedModules([...selectedModules, moduleId]);
    }
  };

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
        department,
        jobTitle: jobTitle.trim() || null,
        allowedModules: allModulesAccess ? [] : selectedModules,
        status: 'active',
        isActive: true,
        updatedAt: Timestamp.now(),
      });

      // Note: Custom claims will be set by Cloud Function trigger
      // The Cloud Function will detect the status change and set claims

      onSuccess();
      onClose();

      // Reset form
      setPermissions(0);
      setDepartment('');
      setJobTitle('');
      setSelectedModules([]);
      setAllModulesAccess(true);
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
      setDepartment('');
      setJobTitle('');
      setSelectedModules([]);
      setAllModulesAccess(true);
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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

          <Divider sx={{ my: 1 }} />

          {/* Permission Presets */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Quick Permission Presets
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
              <Button size="small" variant="text" color="inherit" onClick={() => setPermissions(0)}>
                Clear All
              </Button>
            </Box>
          </Box>

          {/* Detailed Permissions */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Detailed Permissions
            </Typography>
            {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => (
              <Accordion key={groupName} defaultExpanded={groupName === 'User & System'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">{groupName}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup row>
                    {perms.map(({ flag, label }) => (
                      <FormControlLabel
                        key={flag}
                        control={
                          <Checkbox
                            checked={hasPermission(flag as keyof typeof PERMISSION_FLAGS)}
                            onChange={() => togglePermission(flag as keyof typeof PERMISSION_FLAGS)}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2">{label}</Typography>}
                        sx={{ minWidth: '180px' }}
                      />
                    ))}
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Module Access */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Module Access
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allModulesAccess}
                  onChange={(e) => setAllModulesAccess(e.target.checked)}
                />
              }
              label="Access to all modules (based on permissions)"
            />
            {!allModulesAccess && (
              <Box sx={{ mt: 1, pl: 2 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                  Select specific modules this user can access:
                </Typography>
                <FormGroup row>
                  {ALL_MODULES.map((module) => (
                    <FormControlLabel
                      key={module.id}
                      control={
                        <Checkbox
                          checked={selectedModules.includes(module.id)}
                          onChange={() => toggleModule(module.id)}
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">{module.name}</Typography>}
                      sx={{ minWidth: '180px' }}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}
          </Box>

          {/* Info */}
          <Alert severity="info">
            Once approved, the user will receive an in-app notification and their custom claims will
            be automatically configured. They will need to refresh the page to see the changes.
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
