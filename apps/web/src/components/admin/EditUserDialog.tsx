'use client';

/**
 * Edit User Dialog
 *
 * Dialog for editing user information and permissions.
 * Uses MODULE_PERMISSIONS for accordion-based permission editing.
 * Each module shows its permissions grouped together, with View permission
 * controlling access to other permissions in that module.
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department, UserStatus } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { logAuditEvent, createFieldChanges, createAuditContext } from '@/lib/audit';
import {
  getDepartmentOptions,
  PERMISSION_FLAGS,
  hasPermission,
  hasPermission2,
  OPEN_MODULES,
  getAllPermissions,
  getAllPermissions2,
  MODULE_PERMISSIONS,
  type PermissionModuleDef,
  type PermissionDef,
} from '@vapour/constants';

interface EditUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Identify admin-only modules (user-management, analytics, company-settings, time-tracking)
const ADMIN_MODULE_IDS = [
  'user-management',
  'analytics',
  'company-settings',
  'time-tracking',
  'documents',
];

export function EditUserDialog({ open, user, onClose, onSuccess }: EditUserDialogProps) {
  const { user: authUser } = useAuth();
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

  // Accordion expansion state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Split modules into regular and admin-only
  const regularModules = useMemo(
    () => MODULE_PERMISSIONS.filter((m) => !ADMIN_MODULE_IDS.includes(m.id)),
    []
  );
  const adminModules = useMemo(
    () => MODULE_PERMISSIONS.filter((m) => ADMIN_MODULE_IDS.includes(m.id)),
    []
  );

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
      setExpandedModules(new Set());
    }
  }, [user, open]);

  // Check if a permission is set
  const hasPermissionCheck = useCallback(
    (perm: PermissionDef): boolean => {
      if (perm.field === 'permissions2') {
        return hasPermission2(permissions2, perm.flag);
      }
      return hasPermission(permissions, perm.flag);
    },
    [permissions, permissions2]
  );

  // Toggle a permission
  const togglePermission = useCallback((perm: PermissionDef) => {
    if (perm.field === 'permissions2') {
      setPermissions2((prev) => (prev & perm.flag ? prev & ~perm.flag : prev | perm.flag));
    } else {
      setPermissions((prev) => (prev & perm.flag ? prev & ~perm.flag : prev | perm.flag));
    }
  }, []);

  // Get the "View" permission for a module (first permission with category 'view')
  const getViewPermission = useCallback((module: PermissionModuleDef): PermissionDef | null => {
    return module.permissions.find((p) => p.category === 'view') || null;
  }, []);

  // Check if module has view access
  const hasModuleViewAccess = useCallback(
    (module: PermissionModuleDef): boolean => {
      const viewPerm = getViewPermission(module);
      if (!viewPerm) return true; // No view permission means always accessible
      return hasPermissionCheck(viewPerm);
    },
    [getViewPermission, hasPermissionCheck]
  );

  // Handle accordion expansion
  const handleAccordionChange = useCallback((moduleId: string, isExpanded: boolean) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(moduleId);
      } else {
        next.delete(moduleId);
      }
      return next;
    });
  }, []);

  // Quick actions
  const selectAll = useCallback(() => {
    let newPerms = permissions;
    let newPerms2 = permissions2;
    regularModules.forEach((module) => {
      module.permissions.forEach((perm) => {
        if (perm.field === 'permissions2') {
          newPerms2 |= perm.flag;
        } else {
          newPerms |= perm.flag;
        }
      });
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2, regularModules]);

  const clearAll = useCallback(() => {
    let newPerms = permissions;
    let newPerms2 = permissions2;
    // Clear all module permissions
    MODULE_PERMISSIONS.forEach((module) => {
      module.permissions.forEach((perm) => {
        if (perm.field === 'permissions2') {
          newPerms2 &= ~perm.flag;
        } else {
          newPerms &= ~perm.flag;
        }
      });
    });
    setPermissions(newPerms);
    setPermissions2(newPerms2);
  }, [permissions, permissions2]);

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
        updatedBy: authUser?.uid || 'unknown',
      });

      // Audit log: track what changed (AA-8)
      const oldData: Record<string, unknown> = {
        displayName: user.displayName,
        phone: user.phone || null,
        mobile: user.mobile || null,
        jobTitle: user.jobTitle || null,
        department: user.department || null,
        status: user.status,
        permissions: user.permissions || 0,
        permissions2: user.permissions2 || 0,
      };
      const newData: Record<string, unknown> = {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        jobTitle: jobTitle.trim() || null,
        department: department || null,
        status,
        permissions,
        permissions2,
      };
      const changes = createFieldChanges(oldData, newData);
      if (changes.length > 0) {
        const auditCtx = createAuditContext(
          authUser?.uid || 'unknown',
          authUser?.email || '',
          authUser?.displayName || ''
        );
        await logAuditEvent(
          db,
          auditCtx,
          'USER_UPDATED',
          'USER',
          user.uid,
          `Updated user ${user.email}`,
          {
            entityName: user.email,
            changes,
            metadata: { section: 'admin-edit' },
          }
        );
      }

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

  // Render a module accordion with permissions
  const renderModuleAccordion = (module: PermissionModuleDef) => {
    const viewPerm = getViewPermission(module);
    const otherPerms = module.permissions.filter((p) => p !== viewPerm);
    const hasView = hasModuleViewAccess(module);
    const isExpanded = expandedModules.has(module.id);

    // Count enabled permissions for summary
    const enabledCount = module.permissions.filter((p) => hasPermissionCheck(p)).length;
    const totalCount = module.permissions.length;

    return (
      <Accordion
        key={module.id}
        expanded={isExpanded}
        onChange={(_, expanded) => handleAccordionChange(module.id, expanded)}
        sx={{
          '&:before': { display: 'none' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          mb: 1,
          '&.Mui-expanded': { margin: 0, mb: 1 },
        }}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: 48,
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              gap: 1,
              my: 0,
            },
          }}
        >
          {viewPerm && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasPermissionCheck(viewPerm)}
                  onChange={(e) => {
                    e.stopPropagation();
                    togglePermission(viewPerm);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  size="small"
                />
              }
              label=""
              sx={{ m: 0, mr: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {module.name}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            {enabledCount}/{totalCount}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {module.description}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 1 }}>
            {otherPerms.map((perm) => (
              <Tooltip key={perm.flag} title={perm.description} arrow placement="left">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasPermissionCheck(perm)}
                      onChange={() => togglePermission(perm)}
                      size="small"
                      disabled={!!viewPerm && !hasView}
                    />
                  }
                  label={
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.85rem',
                        color: viewPerm && !hasView ? 'text.disabled' : 'text.primary',
                      }}
                    >
                      {perm.label}
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              </Tooltip>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
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
            <strong>User updated successfully!</strong> Permission changes take effect
            automatically.
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
                Module Permissions
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

            {/* Regular Module Permissions - Accordion list */}
            <Box sx={{ mb: 2 }}>
              {regularModules.map((module) => renderModuleAccordion(module))}
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
                backgroundColor: isAdmin ? 'action.hover' : 'transparent',
                p: 1,
                borderRadius: 1,
              }}
            >
              {adminModules.map((module) => renderModuleAccordion(module))}
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
