'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { Project, ProjectConstraint } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface ScopeTabProps {
  project: Project;
}

const CONSTRAINT_CATEGORIES = [
  'BUDGET',
  'SCHEDULE',
  'RESOURCE',
  'TECHNICAL',
  'REGULATORY',
  'ENVIRONMENTAL',
  'OTHER',
] as const;

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

// Helper function to convert Firestore Timestamp to Date
const convertToDate = (timestamp: unknown): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const tsObj = timestamp as { toDate?: () => Date };
    return tsObj.toDate?.() || null;
  }
  return null;
};

export function ScopeTab({ project }: ScopeTabProps) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery Period state
  const [editingDeliveryPeriod, setEditingDeliveryPeriod] = useState(false);
  const [deliveryStartDate, setDeliveryStartDate] = useState(() => {
    const date = convertToDate(project.charter?.deliveryPeriod?.startDate);
    return date ? date.toISOString().split('T')[0] : '';
  });
  const [deliveryEndDate, setDeliveryEndDate] = useState(() => {
    const date = convertToDate(project.charter?.deliveryPeriod?.endDate);
    return date ? date.toISOString().split('T')[0] : '';
  });
  const [deliveryDuration, setDeliveryDuration] = useState(
    project.charter?.deliveryPeriod?.duration?.toString() || ''
  );
  const [deliveryDescription, setDeliveryDescription] = useState(
    project.charter?.deliveryPeriod?.description || ''
  );

  // Assumptions state
  const [assumptions, setAssumptions] = useState<string[]>(
    project.charter?.scope?.assumptions || []
  );
  const [newAssumption, setNewAssumption] = useState('');
  const [editingAssumption, setEditingAssumption] = useState<number | null>(null);
  const [editAssumptionText, setEditAssumptionText] = useState('');

  // Constraints state
  const [constraints, setConstraints] = useState<ProjectConstraint[]>(
    project.charter?.scope?.constraints || []
  );
  const [constraintDialog, setConstraintDialog] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<ProjectConstraint | null>(null);
  const [constraintForm, setConstraintForm] = useState({
    description: '',
    category: 'OTHER' as ProjectConstraint['category'],
    severity: 'MEDIUM' as ProjectConstraint['severity'],
    impact: '',
  });

  // In-Scope state
  const [inScope, setInScope] = useState<string[]>(project.charter?.scope?.inScope || []);
  const [newInScope, setNewInScope] = useState('');
  const [editingInScope, setEditingInScope] = useState<number | null>(null);
  const [editInScopeText, setEditInScopeText] = useState('');

  // Out-of-Scope state
  const [outOfScope, setOutOfScope] = useState<string[]>(project.charter?.scope?.outOfScope || []);
  const [newOutOfScope, setNewOutOfScope] = useState('');
  const [editingOutOfScope, setEditingOutOfScope] = useState<number | null>(null);
  const [editOutOfScopeText, setEditOutOfScopeText] = useState('');

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  // Save all scope changes to Firestore
  const saveScope = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      // Prepare delivery period
      const deliveryPeriod =
        deliveryStartDate || deliveryEndDate || deliveryDuration || deliveryDescription
          ? {
              startDate: deliveryStartDate ? Timestamp.fromDate(new Date(deliveryStartDate)) : null,
              endDate: deliveryEndDate ? Timestamp.fromDate(new Date(deliveryEndDate)) : null,
              duration: deliveryDuration ? parseInt(deliveryDuration, 10) : null,
              description: deliveryDescription || null,
            }
          : null;

      await updateDoc(projectRef, {
        'charter.deliveryPeriod': deliveryPeriod,
        'charter.scope.assumptions': assumptions,
        'charter.scope.constraints': constraints,
        'charter.scope.inScope': inScope,
        'charter.scope.outOfScope': outOfScope,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setEditingDeliveryPeriod(false);
      alert('Scope updated successfully');
    } catch (err) {
      console.error('[ScopeTab] Error saving scope:', err);
      setError(err instanceof Error ? err.message : 'Failed to save scope');
    } finally {
      setLoading(false);
    }
  };

  // Delivery Period handlers
  const handleSaveDeliveryPeriod = () => {
    saveScope();
  };

  // Assumptions handlers
  const handleAddAssumption = () => {
    if (newAssumption.trim()) {
      setAssumptions([...assumptions, newAssumption.trim()]);
      setNewAssumption('');
    }
  };

  const handleEditAssumption = (index: number) => {
    setEditingAssumption(index);
    setEditAssumptionText(assumptions[index] || '');
  };

  const handleSaveAssumptionEdit = () => {
    if (editingAssumption !== null && editAssumptionText.trim()) {
      const updated = [...assumptions];
      updated[editingAssumption] = editAssumptionText.trim();
      setAssumptions(updated);
      setEditingAssumption(null);
      setEditAssumptionText('');
    }
  };

  const handleDeleteAssumption = (index: number) => {
    setAssumptions(assumptions.filter((_, i) => i !== index));
  };

  // Constraints handlers
  const handleOpenConstraintDialog = (constraint?: ProjectConstraint) => {
    if (constraint) {
      setEditingConstraint(constraint);
      setConstraintForm({
        description: constraint.description,
        category: constraint.category,
        severity: constraint.severity,
        impact: constraint.impact || '',
      });
    } else {
      setEditingConstraint(null);
      setConstraintForm({
        description: '',
        category: 'OTHER',
        severity: 'MEDIUM',
        impact: '',
      });
    }
    setConstraintDialog(true);
  };

  const handleSaveConstraint = () => {
    if (!constraintForm.description.trim()) {
      alert('Description is required');
      return;
    }

    if (editingConstraint) {
      // Update existing constraint
      setConstraints(
        constraints.map((c) =>
          c.id === editingConstraint.id
            ? {
                ...c,
                description: constraintForm.description.trim(),
                category: constraintForm.category,
                severity: constraintForm.severity,
                impact: constraintForm.impact.trim() || undefined,
              }
            : c
        )
      );
    } else {
      // Add new constraint
      const newConstraint: ProjectConstraint = {
        id: `constraint-${Date.now()}`,
        description: constraintForm.description.trim(),
        category: constraintForm.category,
        severity: constraintForm.severity,
        impact: constraintForm.impact.trim() || undefined,
      };
      setConstraints([...constraints, newConstraint]);
    }

    setConstraintDialog(false);
    setEditingConstraint(null);
  };

  const handleDeleteConstraint = (id: string) => {
    setConstraints(constraints.filter((c) => c.id !== id));
  };

  // In-Scope handlers
  const handleAddInScope = () => {
    if (newInScope.trim()) {
      setInScope([...inScope, newInScope.trim()]);
      setNewInScope('');
    }
  };

  const handleEditInScope = (index: number) => {
    setEditingInScope(index);
    setEditInScopeText(inScope[index] || '');
  };

  const handleSaveInScopeEdit = () => {
    if (editingInScope !== null && editInScopeText.trim()) {
      const updated = [...inScope];
      updated[editingInScope] = editInScopeText.trim();
      setInScope(updated);
      setEditingInScope(null);
      setEditInScopeText('');
    }
  };

  const handleDeleteInScope = (index: number) => {
    setInScope(inScope.filter((_, i) => i !== index));
  };

  // Out-of-Scope handlers
  const handleAddOutOfScope = () => {
    if (newOutOfScope.trim()) {
      setOutOfScope([...outOfScope, newOutOfScope.trim()]);
      setNewOutOfScope('');
    }
  };

  const handleEditOutOfScope = (index: number) => {
    setEditingOutOfScope(index);
    setEditOutOfScopeText(outOfScope[index] || '');
  };

  const handleSaveOutOfScopeEdit = () => {
    if (editingOutOfScope !== null && editOutOfScopeText.trim()) {
      const updated = [...outOfScope];
      updated[editingOutOfScope] = editOutOfScopeText.trim();
      setOutOfScope(updated);
      setEditingOutOfScope(null);
      setEditOutOfScopeText('');
    }
  };

  const handleDeleteOutOfScope = (index: number) => {
    setOutOfScope(outOfScope.filter((_, i) => i !== index));
  };

  const getSeverityColor = (
    severity: string
  ): 'default' | 'primary' | 'warning' | 'error' | 'success' => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'primary';
      case 'LOW':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Delivery Period Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Delivery Period</Typography>
          {hasManageAccess && !editingDeliveryPeriod && (
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setEditingDeliveryPeriod(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {editingDeliveryPeriod ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={deliveryStartDate}
                onChange={(e) => setDeliveryStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={deliveryEndDate}
                onChange={(e) => setDeliveryEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Duration (days)"
                type="number"
                value={deliveryDuration}
                onChange={(e) => setDeliveryDuration(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={deliveryDescription}
                onChange={(e) => setDeliveryDescription(e.target.value)}
                placeholder="e.g., 12 months from order date"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveDeliveryPeriod}
                  disabled={loading}
                >
                  Save
                </Button>
                <Button
                  startIcon={<CancelIcon />}
                  onClick={() => setEditingDeliveryPeriod(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Start Date
              </Typography>
              <Typography variant="body1">{deliveryStartDate || 'Not set'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                End Date
              </Typography>
              <Typography variant="body1">{deliveryEndDate || 'Not set'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Duration
              </Typography>
              <Typography variant="body1">
                {deliveryDuration ? `${deliveryDuration} days` : 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{deliveryDescription || 'Not set'}</Typography>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Assumptions Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assumptions
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {hasManageAccess && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add new assumption..."
              value={newAssumption}
              onChange={(e) => setNewAssumption(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddAssumption()}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddAssumption}>
              Add
            </Button>
          </Box>
        )}

        {assumptions.length === 0 ? (
          <Alert severity="info">No assumptions defined yet</Alert>
        ) : (
          <List>
            {assumptions.map((assumption, index) => (
              <ListItem key={index} divider>
                {editingAssumption === index ? (
                  <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={editAssumptionText}
                      onChange={(e) => setEditAssumptionText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveAssumptionEdit()}
                    />
                    <IconButton onClick={handleSaveAssumptionEdit} color="primary">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => setEditingAssumption(null)}>
                      <CancelIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText primary={assumption} />
                    {hasManageAccess && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditAssumption(index)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleDeleteAssumption(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </>
                )}
              </ListItem>
            ))}
          </List>
        )}

        {hasManageAccess && (
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={saveScope} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Constraints Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Constraints</Typography>
          {hasManageAccess && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenConstraintDialog()}
            >
              Add Constraint
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        {constraints.length === 0 ? (
          <Alert severity="info">No constraints defined yet</Alert>
        ) : (
          <List>
            {constraints.map((constraint) => (
              <ListItem key={constraint.id} divider sx={{ display: 'block', py: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={constraint.category} size="small" />
                    <Chip
                      label={constraint.severity}
                      size="small"
                      color={getSeverityColor(constraint.severity)}
                    />
                  </Box>
                  {hasManageAccess && (
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenConstraintDialog(constraint)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteConstraint(constraint.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                <Typography variant="body1" fontWeight="medium" gutterBottom>
                  {constraint.description}
                </Typography>
                {constraint.impact && (
                  <Typography variant="body2" color="text.secondary">
                    Impact: {constraint.impact}
                  </Typography>
                )}
              </ListItem>
            ))}
          </List>
        )}

        {hasManageAccess && constraints.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={saveScope} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* In-Scope Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          In-Scope Items
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {hasManageAccess && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add in-scope item..."
              value={newInScope}
              onChange={(e) => setNewInScope(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddInScope()}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddInScope}>
              Add
            </Button>
          </Box>
        )}

        {inScope.length === 0 ? (
          <Alert severity="info">No in-scope items defined yet</Alert>
        ) : (
          <List>
            {inScope.map((item, index) => (
              <ListItem key={index} divider>
                {editingInScope === index ? (
                  <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={editInScopeText}
                      onChange={(e) => setEditInScopeText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveInScopeEdit()}
                    />
                    <IconButton onClick={handleSaveInScopeEdit} color="primary">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => setEditingInScope(null)}>
                      <CancelIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText primary={item} />
                    {hasManageAccess && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditInScope(index)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleDeleteInScope(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </>
                )}
              </ListItem>
            ))}
          </List>
        )}

        {hasManageAccess && inScope.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={saveScope} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Out-of-Scope Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Out-of-Scope / Exclusions
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {hasManageAccess && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add exclusion..."
              value={newOutOfScope}
              onChange={(e) => setNewOutOfScope(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddOutOfScope()}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddOutOfScope}>
              Add
            </Button>
          </Box>
        )}

        {outOfScope.length === 0 ? (
          <Alert severity="info">No exclusions defined yet</Alert>
        ) : (
          <List>
            {outOfScope.map((item, index) => (
              <ListItem key={index} divider>
                {editingOutOfScope === index ? (
                  <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={editOutOfScopeText}
                      onChange={(e) => setEditOutOfScopeText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveOutOfScopeEdit()}
                    />
                    <IconButton onClick={handleSaveOutOfScopeEdit} color="primary">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => setEditingOutOfScope(null)}>
                      <CancelIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText primary={item} />
                    {hasManageAccess && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditOutOfScope(index)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleDeleteOutOfScope(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </>
                )}
              </ListItem>
            ))}
          </List>
        )}

        {hasManageAccess && outOfScope.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={saveScope} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Constraint Dialog */}
      <Dialog
        open={constraintDialog}
        onClose={() => setConstraintDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingConstraint ? 'Edit Constraint' : 'Add Constraint'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={constraintForm.description}
                onChange={(e) =>
                  setConstraintForm({ ...constraintForm, description: e.target.value })
                }
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={constraintForm.category}
                  label="Category"
                  onChange={(e) =>
                    setConstraintForm({
                      ...constraintForm,
                      category: e.target.value as ProjectConstraint['category'],
                    })
                  }
                >
                  {CONSTRAINT_CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={constraintForm.severity}
                  label="Severity"
                  onChange={(e) =>
                    setConstraintForm({
                      ...constraintForm,
                      severity: e.target.value as ProjectConstraint['severity'],
                    })
                  }
                >
                  {SEVERITY_LEVELS.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Impact (Optional)"
                multiline
                rows={2}
                value={constraintForm.impact}
                onChange={(e) => setConstraintForm({ ...constraintForm, impact: e.target.value })}
                placeholder="Describe how this constrains the project"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConstraintDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConstraint}>
            {editingConstraint ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
