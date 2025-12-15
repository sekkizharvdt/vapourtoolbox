/**
 * Constraints Section Component
 */

'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  IconButton,
  List,
  ListItem,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import type { ProjectConstraint } from '@vapour/types';

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

interface ConstraintsSectionProps {
  hasManageAccess: boolean;
  loading: boolean;
  constraints: ProjectConstraint[];
  onSave: (constraints: ProjectConstraint[]) => void;
}

export function ConstraintsSection({
  hasManageAccess,
  loading,
  constraints: initialConstraints,
  onSave,
}: ConstraintsSectionProps) {
  const [constraints, setConstraints] = useState<ProjectConstraint[]>(initialConstraints);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectConstraint | null>(null);
  const [form, setForm] = useState({
    description: '',
    category: 'OTHER' as ProjectConstraint['category'],
    severity: 'MEDIUM' as ProjectConstraint['severity'],
    impact: '',
  });

  const handleOpenDialog = (constraint?: ProjectConstraint) => {
    if (constraint) {
      setEditing(constraint);
      setForm({
        description: constraint.description,
        category: constraint.category,
        severity: constraint.severity,
        impact: constraint.impact || '',
      });
    } else {
      setEditing(null);
      setForm({
        description: '',
        category: 'OTHER',
        severity: 'MEDIUM',
        impact: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSaveConstraint = () => {
    if (!form.description.trim()) {
      alert('Description is required');
      return;
    }

    if (editing) {
      // Update existing
      const updated = constraints.map((c) =>
        c.id === editing.id
          ? {
              ...c,
              description: form.description.trim(),
              category: form.category,
              severity: form.severity,
              impact: form.impact.trim() || undefined,
            }
          : c
      );
      setConstraints(updated);
      onSave(updated);
    } else {
      // Add new
      const newConstraint: ProjectConstraint = {
        id: `constraint-${crypto.randomUUID().slice(0, 8)}`,
        description: form.description.trim(),
        category: form.category,
        severity: form.severity,
        impact: form.impact.trim() || undefined,
      };
      const updated = [...constraints, newConstraint];
      setConstraints(updated);
      onSave(updated);
    }

    setDialogOpen(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const updated = constraints.filter((c) => c.id !== id);
    setConstraints(updated);
    onSave(updated);
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
    <>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Constraints</Typography>
          {hasManageAccess && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
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
                        onClick={() => handleOpenDialog(constraint)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(constraint.id)}>
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
      </Paper>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Constraint' : 'Add Constraint'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={form.category}
                  label="Category"
                  onChange={(e) =>
                    setForm({
                      ...form,
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
                  value={form.severity}
                  label="Severity"
                  onChange={(e) =>
                    setForm({
                      ...form,
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
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: e.target.value })}
                placeholder="Describe how this constrains the project"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConstraint} disabled={loading}>
            {editing ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
