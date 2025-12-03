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
  PERMISSION_FLAGS_2,
  PERMISSION_PRESETS,
  MODULES,
  hasPermission,
  getAllPermissions2,
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

// Extended permission groups (permissions2 field)
const PERMISSION_GROUPS_2 = {
  'Engineering Tools': [
    { flag: 'VIEW_MATERIAL_DB', label: 'View Material Database' },
    { flag: 'MANAGE_MATERIAL_DB', label: 'Manage Material Database' },
    { flag: 'VIEW_SHAPE_DB', label: 'View Shape Database' },
    { flag: 'MANAGE_SHAPE_DB', label: 'Manage Shape Database' },
    { flag: 'VIEW_BOUGHT_OUT_DB', label: 'View Bought Out Database' },
    { flag: 'MANAGE_BOUGHT_OUT_DB', label: 'Manage Bought Out Database' },
    { flag: 'VIEW_THERMAL_DESAL', label: 'View Thermal Desalination' },
    { flag: 'MANAGE_THERMAL_DESAL', label: 'Manage Thermal Desalination' },
    { flag: 'VIEW_THERMAL_CALCS', label: 'View Thermal Calculators' },
    { flag: 'MANAGE_THERMAL_CALCS', label: 'Manage Thermal Calculators' },
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
  const [permissions2, setPermissions2] = useState(0);
  const [department, setDepartment] = useState<Department | ''>('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [allModulesAccess, setAllModulesAccess] = useState(true);

  // Apply a permission preset
  const applyPreset = (presetName: keyof typeof PERMISSION_PRESETS) => {
    const presetValue = PERMISSION_PRESETS[presetName];
    setPermissions(presetValue);

    // For presets that include VIEW_ESTIMATION, also grant all engineering tool permissions
    if (hasPermission(presetValue, PERMISSION_FLAGS.VIEW_ESTIMATION)) {
      const viewPerms2 =
        PERMISSION_FLAGS_2.VIEW_MATERIAL_DB |
        PERMISSION_FLAGS_2.VIEW_SHAPE_DB |
        PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB |
        PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL |
        PERMISSION_FLAGS_2.VIEW_THERMAL_CALCS;

      const managePerms2 = hasPermission(presetValue, PERMISSION_FLAGS.MANAGE_ESTIMATION)
        ? PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB |
          PERMISSION_FLAGS_2.MANAGE_SHAPE_DB |
          PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB |
          PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL |
          PERMISSION_FLAGS_2.MANAGE_THERMAL_CALCS
        : 0;

      setPermissions2(viewPerms2 | managePerms2);
    } else if (presetName === 'FULL_ACCESS') {
      // Full access gets all permissions2
      setPermissions2(getAllPermissions2());
    } else {
      setPermissions2(0);
    }
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

  // Toggle a permission2 flag (extended permissions)
  const togglePermission2 = (flag: keyof typeof PERMISSION_FLAGS_2) => {
    const flagValue = PERMISSION_FLAGS_2[flag];
    if ((permissions2 & flagValue) === flagValue) {
      setPermissions2(permissions2 & ~flagValue);
    } else {
      setPermissions2(permissions2 | flagValue);
    }
  };

  // Check if a permission is set
  const hasPermissionFlag = (flag: keyof typeof PERMISSION_FLAGS) => {
    const flagValue = PERMISSION_FLAGS[flag];
    return (permissions & flagValue) === flagValue;
  };

  // Check if a permission2 is set
  const hasPermission2Flag = (flag: keyof typeof PERMISSION_FLAGS_2) => {
    const flagValue = PERMISSION_FLAGS_2[flag];
    return (permissions2 & flagValue) === flagValue;
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
        permissions2,
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
      setPermissions2(0);
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
      setPermissions2(0);
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
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={() => {
                  setPermissions(0);
                  setPermissions2(0);
                }}
              >
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
                            checked={hasPermissionFlag(flag as keyof typeof PERMISSION_FLAGS)}
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
            {/* Extended Permissions (permissions2) */}
            {Object.entries(PERMISSION_GROUPS_2).map(([groupName, perms]) => (
              <Accordion key={groupName}>
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
                            checked={hasPermission2Flag(flag as keyof typeof PERMISSION_FLAGS_2)}
                            onChange={() =>
                              togglePermission2(flag as keyof typeof PERMISSION_FLAGS_2)
                            }
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
