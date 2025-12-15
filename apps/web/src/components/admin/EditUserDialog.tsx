'use client';

/**
 * Edit User Dialog
 *
 * Enhanced dialog for editing user information and permissions.
 * Features:
 * - Role presets for quick permission assignment
 * - Grouped module view by category
 * - Visual permission indicators
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
  Chip,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Engineering as EngineeringIcon,
  AccountBalance as FinanceIcon,
  ShoppingCart as ProcurementIcon,
  Visibility as ViewerIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
} from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department, UserStatus } from '@vapour/types';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  PERMISSION_FLAGS_2,
  hasPermission,
  hasPermission2,
  RESTRICTED_MODULES,
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
  PERMISSION_PRESETS,
} from '@vapour/constants';

// Role presets for quick assignment
const ROLE_PRESETS = [
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to most modules',
    icon: ViewerIcon,
    color: 'default' as const,
    permissions: PERMISSION_PRESETS.VIEWER,
    permissions2: 0,
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Projects, estimation, and documents',
    icon: EngineeringIcon,
    color: 'info' as const,
    permissions: PERMISSION_PRESETS.ENGINEERING,
    permissions2:
      PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL |
      PERMISSION_FLAGS_2.VIEW_SSOT |
      PERMISSION_FLAGS_2.EDIT_MATERIALS |
      PERMISSION_FLAGS_2.EDIT_SHAPES,
  },
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Purchase requests, RFQs, POs',
    icon: ProcurementIcon,
    color: 'warning' as const,
    permissions: PERMISSION_PRESETS.PROCUREMENT,
    permissions2: 0,
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Accounting and financial reports',
    icon: FinanceIcon,
    color: 'success' as const,
    permissions: PERMISSION_PRESETS.FINANCE,
    permissions2: 0,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Full module access without admin',
    icon: ManagerIcon,
    color: 'primary' as const,
    permissions: PERMISSION_PRESETS.MANAGER,
    permissions2:
      PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL |
      PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL |
      PERMISSION_FLAGS_2.VIEW_SSOT |
      PERMISSION_FLAGS_2.MANAGE_SSOT |
      PERMISSION_FLAGS_2.VIEW_HR |
      PERMISSION_FLAGS_2.APPROVE_LEAVES,
  },
  {
    id: 'admin',
    name: 'Full Admin',
    description: 'Complete system access',
    icon: AdminIcon,
    color: 'error' as const,
    permissions: getAllPermissions(),
    permissions2: getAllPermissions2(),
  },
];

// Module categories for grouped display
const MODULE_CATEGORIES = [
  {
    id: 'operations',
    name: 'Operations',
    description: 'Day-to-day business operations',
    modules: ['projects', 'proposals', 'entities'],
  },
  {
    id: 'procurement-finance',
    name: 'Procurement & Finance',
    description: 'Purchasing and accounting',
    modules: ['procurement', 'accounting'],
  },
  {
    id: 'engineering-data',
    name: 'Engineering & Data',
    description: 'Technical data and calculations',
    modules: ['thermal-desal', 'process-data'],
  },
  {
    id: 'hr',
    name: 'HR & Administration',
    description: 'Human resources management',
    modules: ['hr'],
  },
];

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
  const [permissionTab, setPermissionTab] = useState(0); // 0: Presets, 1: Custom

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [status, setStatus] = useState<UserStatus>('active');
  const [permissions, setPermissions] = useState<number>(0);
  const [permissions2, setPermissions2] = useState<number>(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

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
      setSelectedPreset(null);
      // Check if current permissions match any preset
      const matchingPreset = ROLE_PRESETS.find(
        (p) => p.permissions === (user.permissions || 0) && p.permissions2 === (user.permissions2 || 0)
      );
      if (matchingPreset) {
        setSelectedPreset(matchingPreset.id);
        setPermissionTab(0);
      } else {
        setPermissionTab(1); // Show custom tab if no preset matches
      }
    }
  }, [user, open]);

  // Apply a role preset
  const applyPreset = useCallback((preset: (typeof ROLE_PRESETS)[number]) => {
    setPermissions(preset.permissions);
    setPermissions2(preset.permissions2);
    setSelectedPreset(preset.id);
  }, []);

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

  // Toggle permission (clears preset selection)
  const togglePermission = useCallback(
    (flag: number, field: 'permissions' | 'permissions2' = 'permissions') => {
      setSelectedPreset(null); // Clear preset when making custom changes
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
      setSelectedPreset(null); // Clear preset when making custom changes
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
        if (field === 'permissions2') {
          setPermissions2((prev) => prev | module.viewFlag);
        } else {
          setPermissions((prev) => prev | module.viewFlag);
        }
      }
    },
    [permissions, permissions2]
  );

  // Toggle manage permission (automatically adds view)
  const toggleManage = useCallback(
    (module: (typeof RESTRICTED_MODULES)[number]) => {
      setSelectedPreset(null); // Clear preset when making custom changes
      const field = module.field || 'permissions';
      const perms = field === 'permissions2' ? permissions2 : permissions;
      const hasManage =
        field === 'permissions2'
          ? hasPermission2(perms, module.manageFlag)
          : hasPermission(perms, module.manageFlag);

      if (hasManage) {
        // Just remove manage, keep view
        if (field === 'permissions2') {
          setPermissions2((prev) => prev & ~module.manageFlag);
        } else {
          setPermissions((prev) => prev & ~module.manageFlag);
        }
      } else {
        // Add manage + view
        if (field === 'permissions2') {
          setPermissions2((prev) => prev | module.viewFlag | module.manageFlag);
        } else {
          setPermissions((prev) => prev | module.viewFlag | module.manageFlag);
        }
      }
    },
    [permissions, permissions2]
  );

  // Check if user has admin permission
  const isAdmin = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);

  // Toggle admin permission
  const toggleAdmin = useCallback(() => {
    setSelectedPreset(null); // Clear preset when making custom changes
    setPermissions((prev) =>
      prev & PERMISSION_FLAGS.MANAGE_USERS
        ? prev & ~PERMISSION_FLAGS.MANAGE_USERS
        : prev | PERMISSION_FLAGS.MANAGE_USERS
    );
  }, []);

  // Quick actions for custom permissions
  const grantAllView = useCallback(() => {
    setSelectedPreset(null);
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
    setSelectedPreset(null);
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
    setSelectedPreset(null);
    // Clear all module permissions
    let newPerms = 0;
    let newPerms2 = 0;
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, []);

  // Get modules for a category
  const getModulesForCategory = useCallback((moduleIds: string[]) => {
    return RESTRICTED_MODULES.filter((m) => moduleIds.includes(m.id));
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Module Access
            </Typography>

            {/* Tabs for Presets vs Custom */}
            <Tabs
              value={permissionTab}
              onChange={(_, v) => setPermissionTab(v)}
              sx={{ mb: 2, minHeight: 36 }}
            >
              <Tab label="Role Presets" sx={{ minHeight: 36, py: 0.5 }} />
              <Tab label="Custom Permissions" sx={{ minHeight: 36, py: 0.5 }} />
            </Tabs>

            {/* Tab Panel: Role Presets */}
            {permissionTab === 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  Select a role to quickly assign common permission sets
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                  {ROLE_PRESETS.map((preset) => {
                    const PresetIcon = preset.icon;
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <Paper
                        key={preset.id}
                        variant="outlined"
                        onClick={() => applyPreset(preset)}
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          borderColor: isSelected ? `${preset.color}.main` : 'divider',
                          borderWidth: isSelected ? 2 : 1,
                          bgcolor: isSelected ? `${preset.color}.50` : 'background.paper',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: `${preset.color}.main`,
                            bgcolor: `${preset.color}.50`,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PresetIcon
                            sx={{
                              fontSize: 20,
                              color: isSelected ? `${preset.color}.main` : 'text.secondary',
                            }}
                          />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: isSelected ? 600 : 500 }}>
                              {preset.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {preset.description}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>

                {/* Show current selection summary */}
                {selectedPreset && (
                  <Alert severity="success" sx={{ mt: 2, py: 0.5 }}>
                    <Typography variant="caption">
                      <strong>{ROLE_PRESETS.find((p) => p.id === selectedPreset)?.name}</strong>{' '}
                      permissions will be applied on save
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            {/* Tab Panel: Custom Permissions */}
            {permissionTab === 1 && (
              <Box>
                {/* Quick action buttons */}
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button size="small" variant="outlined" onClick={grantAllView}>
                    Grant All View
                  </Button>
                  <Button size="small" variant="outlined" onClick={grantAllManage}>
                    Grant All Manage
                  </Button>
                  <Button size="small" variant="outlined" color="inherit" onClick={clearAllPermissions}>
                    Clear All
                  </Button>
                </Stack>

                {/* Open modules info */}
                <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                  <Typography variant="caption">
                    <strong>Always accessible:</strong> {OPEN_MODULES.join(', ')}
                  </Typography>
                </Alert>

                {/* Grouped Modules */}
                {MODULE_CATEGORIES.map((category) => {
                  const categoryModules = getModulesForCategory(category.modules);
                  if (categoryModules.length === 0) return null;

                  return (
                    <Accordion
                      key={category.id}
                      defaultExpanded
                      disableGutters
                      sx={{
                        mb: 1,
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        '&:first-of-type': { borderRadius: 1 },
                        '&:last-of-type': { borderRadius: 1 },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                      >
                        <Box>
                          <Typography variant="subtitle2">{category.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {category.description}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ py: 0.5, fontWeight: 600 }}>Module</TableCell>
                                <TableCell align="center" sx={{ py: 0.5, width: 70, fontWeight: 600 }}>
                                  View
                                </TableCell>
                                <TableCell align="center" sx={{ py: 0.5, width: 70, fontWeight: 600 }}>
                                  Manage
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {categoryModules.map((module) => (
                                <TableRow key={module.id}>
                                  <TableCell sx={{ py: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      {module.name}
                                      {module.note && (
                                        <Tooltip title={module.note}>
                                          <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        </Tooltip>
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 0 }}>
                                    <Checkbox
                                      checked={hasViewPermission(module)}
                                      onChange={() => toggleView(module)}
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 0 }}>
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
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}
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
