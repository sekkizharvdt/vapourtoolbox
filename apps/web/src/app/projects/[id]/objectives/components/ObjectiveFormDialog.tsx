'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Grid,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { ProjectObjective } from '@vapour/types';

interface ObjectiveFormDialogProps {
  open: boolean;
  onClose: () => void;
  objective?: ProjectObjective;
  onSave: (objective: Omit<ProjectObjective, 'id'> & { id?: string }) => void;
  loading: boolean;
}

export function ObjectiveFormDialog({
  open,
  onClose,
  objective,
  onSave,
  loading,
}: ObjectiveFormDialogProps) {
  const [description, setDescription] = useState(objective?.description || '');
  const [priority, setPriority] = useState<ProjectObjective['priority']>(
    objective?.priority || 'MEDIUM'
  );
  const [status, setStatus] = useState<ProjectObjective['status']>(
    objective?.status || 'NOT_STARTED'
  );
  const [successCriteria, setSuccessCriteria] = useState<string[]>(
    objective?.successCriteria || []
  );
  const [newCriterion, setNewCriterion] = useState('');

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setSuccessCriteria([...successCriteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleRemoveCriterion = (index: number) => {
    setSuccessCriteria(successCriteria.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!description.trim()) return;
    onSave({
      id: objective?.id,
      description: description.trim(),
      priority,
      status,
      successCriteria,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{objective ? 'Edit Objective' : 'Add Objective'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            required
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  label="Priority"
                  onChange={(e) => setPriority(e.target.value as ProjectObjective['priority'])}
                >
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as ProjectObjective['status'])}
                >
                  <MenuItem value="NOT_STARTED">Not Started</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="ACHIEVED">Achieved</MenuItem>
                  <MenuItem value="AT_RISK">At Risk</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Success Criteria
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Add criterion"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              fullWidth
              size="small"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCriterion())}
            />
            <Button variant="outlined" onClick={handleAddCriterion}>
              Add
            </Button>
          </Box>
          <List dense>
            {successCriteria.map((criterion, index) => (
              <ListItem key={index}>
                <ListItemText primary={criterion} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => handleRemoveCriterion(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !description.trim()}
        >
          {objective ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
