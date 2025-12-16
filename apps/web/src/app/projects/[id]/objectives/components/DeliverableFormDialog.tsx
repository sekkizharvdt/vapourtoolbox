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
import type { ProjectDeliverable } from '@vapour/types';

interface DeliverableFormDialogProps {
  open: boolean;
  onClose: () => void;
  deliverable?: ProjectDeliverable;
  onSave: (deliverable: Omit<ProjectDeliverable, 'id'> & { id?: string }) => void;
  loading: boolean;
}

export function DeliverableFormDialog({
  open,
  onClose,
  deliverable,
  onSave,
  loading,
}: DeliverableFormDialogProps) {
  const [name, setName] = useState(deliverable?.name || '');
  const [description, setDescription] = useState(deliverable?.description || '');
  const [type, setType] = useState<ProjectDeliverable['type']>(deliverable?.type || 'DOCUMENT');
  const [status, setStatus] = useState<ProjectDeliverable['status']>(
    deliverable?.status || 'PENDING'
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(
    deliverable?.acceptanceCriteria || []
  );
  const [newCriterion, setNewCriterion] = useState('');

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setAcceptanceCriteria([...acceptanceCriteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleRemoveCriterion = (index: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      id: deliverable?.id,
      name: name.trim(),
      description: description.trim(),
      type,
      status,
      acceptanceCriteria,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{deliverable ? 'Edit Deliverable' : 'Add Deliverable'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={type}
                  label="Type"
                  onChange={(e) => setType(e.target.value as ProjectDeliverable['type'])}
                >
                  <MenuItem value="DOCUMENT">Document</MenuItem>
                  <MenuItem value="PRODUCT">Product</MenuItem>
                  <MenuItem value="SERVICE">Service</MenuItem>
                  <MenuItem value="MILESTONE">Milestone</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as ProjectDeliverable['status'])}
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="SUBMITTED">Submitted</MenuItem>
                  <MenuItem value="ACCEPTED">Accepted</MenuItem>
                  <MenuItem value="REJECTED">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Acceptance Criteria
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
            {acceptanceCriteria.map((criterion, index) => (
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
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !name.trim()}>
          {deliverable ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
