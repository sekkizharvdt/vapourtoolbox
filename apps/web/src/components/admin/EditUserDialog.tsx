'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { User, Department, UserStatus } from '@vapour/types';
import { getDepartmentOptions, PERMISSION_FLAGS, hasPermission, MODULES } from '@vapour/constants';
import { Divider, FormGroup, FormControlLabel } from '@mui/material';

// Get all active modules for the module selection
const ALL_MODULES = Object.values(MODULES)
  .filter((m) => m.status === 'active')
  .map((m) => ({ id: m.id, name: m.name }));

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
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [allModulesAccess, setAllModulesAccess] = useState(true);

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
      // Module visibility: empty array means all modules
      const userModules = user.allowedModules || [];
      setSelectedModules(userModules);
      setAllModulesAccess(userModules.length === 0);
      setSaveSuccess(false);
      setError('');
    }
  }, [user, open]);

  // Permission toggle handler
  const togglePermission = (permission: number) => {
    setPermissions((prev) => {
      if (hasPermission(prev, permission)) {
        // Remove permission (bitwise AND with NOT)
        return prev & ~permission;
      } else {
        // Add permission (bitwise OR)
        return prev | permission;
      }
    });
  };

  // Toggle module selection
  const toggleModule = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      setSelectedModules(selectedModules.filter((m) => m !== moduleId));
    } else {
      setSelectedModules([...selectedModules, moduleId]);
    }
  };

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
        allowedModules: allModulesAccess ? [] : selectedModules,
        updatedAt: Timestamp.now(),
      });

      // Note: Custom claims will be updated by Cloud Function trigger
      // The Cloud Function will detect the permissions change and update claims

      // Show success message
      setSaveSuccess(true);

      // Auto-close after showing success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 4000); // Give user 4 seconds to read the token refresh message
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
            <br />
            <strong>Important:</strong> The affected user must sign out and sign back in for
            permission changes to take effect. Firebase Authentication tokens are cached and will
            not reflect new permissions until refreshed.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Email (Read-only) */}
          <TextField
            label="Email"
            value={user.email}
            disabled
            fullWidth
            helperText="Email cannot be changed"
          />

          {/* Display Name */}
          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            fullWidth
          />

          {/* Phone */}
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />

          {/* Mobile */}
          <TextField
            label="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            fullWidth
          />

          {/* Job Title */}
          <TextField
            label="Job Title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            fullWidth
          />

          {/* Department */}
          <FormControl fullWidth>
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

          {/* Status */}
          <FormControl fullWidth required>
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

          {/* Permissions Matrix */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Permissions Matrix
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Module</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>View</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Manage</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Edit</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Delete</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Users */}
                  <TableRow>
                    <TableCell>Users</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_USERS)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_USERS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_USERS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ROLES)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_ROLES)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Projects */}
                  <TableRow>
                    <TableCell>Projects</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROJECTS)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_PROJECTS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROJECTS)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_PROJECTS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Entities */}
                  <TableRow>
                    <TableCell>Entities</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ENTITIES)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_ENTITIES)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.CREATE_ENTITIES)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.CREATE_ENTITIES)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.EDIT_ENTITIES)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.EDIT_ENTITIES)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.DELETE_ENTITIES)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.DELETE_ENTITIES)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>

                  {/* Time Tracking */}
                  <TableRow>
                    <TableCell>Time Tracking</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_TIME_TRACKING)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_TIME_TRACKING)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_TIME_TRACKING)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_TIME_TRACKING)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Accounting */}
                  <TableRow>
                    <TableCell>Accounting</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ACCOUNTING)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_ACCOUNTING)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_ACCOUNTING)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Procurement */}
                  <TableRow>
                    <TableCell>Procurement</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROCUREMENT)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_PROCUREMENT)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_PROCUREMENT)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Estimation */}
                  <TableRow>
                    <TableCell>Estimation</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ESTIMATION)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_ESTIMATION)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ESTIMATION)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_ESTIMATION)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Document Management */}
                  <TableRow>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Documents
                        <Tooltip title="Manage: Create/edit master document list, bulk imports. Submit: Submit documents for review. Approve: Approve submissions">
                          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Submit documents for review">
                        <Checkbox
                          checked={hasPermission(permissions, PERMISSION_FLAGS.SUBMIT_DOCUMENTS)}
                          onChange={() => togglePermission(PERMISSION_FLAGS.SUBMIT_DOCUMENTS)}
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Manage master document list">
                        <Checkbox
                          checked={hasPermission(permissions, PERMISSION_FLAGS.MANAGE_DOCUMENTS)}
                          onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_DOCUMENTS)}
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Approve document submissions">
                        <Checkbox
                          checked={hasPermission(permissions, PERMISSION_FLAGS.APPROVE_DOCUMENTS)}
                          onChange={() => togglePermission(PERMISSION_FLAGS.APPROVE_DOCUMENTS)}
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  {/* Material Database (Read-only indicator) */}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Material Database
                        <Tooltip title="Access controlled by Estimation → View permission">
                          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ESTIMATION)}
                        disabled
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Shape Database (Read-only indicator) */}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Shape Database
                        <Tooltip title="Access controlled by Estimation → View permission">
                          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ESTIMATION)}
                        disabled
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Bought Out Database (Read-only indicator) */}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Bought Out Database
                        <Tooltip title="Access controlled by Estimation → View permission">
                          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ESTIMATION)}
                        disabled
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Analytics */}
                  <TableRow>
                    <TableCell>Analytics</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.VIEW_ANALYTICS)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.VIEW_ANALYTICS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(permissions, PERMISSION_FLAGS.EXPORT_DATA)}
                        onChange={() => togglePermission(PERMISSION_FLAGS.EXPORT_DATA)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>

                  {/* Company Settings */}
                  <TableRow>
                    <TableCell>Company Settings</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={hasPermission(
                          permissions,
                          PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS
                        )}
                        onChange={() => togglePermission(PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Note:</strong> — indicates permission not applicable for this module
              </Typography>
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  <strong>Engineering Databases:</strong> Material Database, Shape Database, and
                  Bought Out Database are automatically accessible when Estimation → View is
                  enabled.
                  <br />
                  <strong>Document Management:</strong> Accessible to all users regardless of
                  permissions.
                </Typography>
              </Alert>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Module Visibility */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Module Visibility
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Control which modules appear in the sidebar for this user. Even with access to all
              modules, permissions still apply.
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
                  Select specific modules this user can see:
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

          {/* Info about custom claims */}
          <Alert severity="info">
            When you save changes to department, permissions, or module visibility, custom claims
            will be automatically updated by the system. Users may need to sign out and sign back in
            to see permission changes.
          </Alert>
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
