'use client';

/**
 * Equipment Tab Component
 *
 * Displays and manages process equipment.
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { ProcessEquipment, ProcessEquipmentInput } from '@vapour/types';
import {
  subscribeToEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '@/lib/ssot/equipmentService';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'EquipmentTab' });

interface EquipmentTabProps {
  projectId: string;
  userId: string;
}

export default function EquipmentTab({ projectId, userId }: EquipmentTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [equipment, setEquipment] = useState<ProcessEquipment[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ProcessEquipment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEquipment, setDeletingEquipment] = useState<ProcessEquipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentTag, setEquipmentTag] = useState('');
  const [operatingPressure, setOperatingPressure] = useState<number | ''>('');
  const [operatingTemperature, setOperatingTemperature] = useState<number | ''>('');
  const [fluidIn, setFluidIn] = useState('');
  const [fluidOut, setFluidOut] = useState('');

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    const unsubscribe = subscribeToEquipment(
      projectId,
      (data) => {
        setEquipment(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to equipment', { error: err });
        setError('Failed to load equipment');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const resetForm = () => {
    setEquipmentName('');
    setEquipmentTag('');
    setOperatingPressure('');
    setOperatingTemperature('');
    setFluidIn('');
    setFluidOut('');
  };

  const handleAdd = () => {
    setEditingEquipment(null);
    resetForm();
    setFormOpen(true);
  };

  const handleEdit = (item: ProcessEquipment) => {
    setEditingEquipment(item);
    setEquipmentName(item.equipmentName);
    setEquipmentTag(item.equipmentTag);
    setOperatingPressure(item.operatingPressure);
    setOperatingTemperature(item.operatingTemperature);
    setFluidIn(item.fluidIn.join(', '));
    setFluidOut(item.fluidOut.join(', '));
    setFormOpen(true);
  };

  const handleDeleteClick = (item: ProcessEquipment) => {
    setDeletingEquipment(item);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!equipmentName.trim() || !equipmentTag.trim()) {
      setError('Equipment name and tag are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: ProcessEquipmentInput = {
        equipmentName: equipmentName.trim(),
        equipmentTag: equipmentTag.trim(),
        operatingPressure: Number(operatingPressure) || 0,
        operatingTemperature: Number(operatingTemperature) || 0,
        fluidIn: fluidIn
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        fluidOut: fluidOut
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (editingEquipment) {
        await updateEquipment(projectId, editingEquipment.id, input, userId);
      } else {
        await createEquipment(projectId, input, userId);
      }

      setFormOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error saving equipment', { error: err });
      setError('Failed to save equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEquipment) return;

    setDeleting(true);
    try {
      await deleteEquipment(projectId, deletingEquipment.id);
      setDeleteDialogOpen(false);
      setDeletingEquipment(null);
    } catch (err) {
      logger.error('Error deleting equipment', { error: err });
      setError('Failed to delete equipment');
    } finally {
      setDeleting(false);
    }
  };

  const paginatedEquipment = equipment.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Equipment
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Equipment Tag</TableCell>
              <TableCell>Equipment Name</TableCell>
              <TableCell align="right">Operating Pressure (mbar)</TableCell>
              <TableCell align="right">Operating Temp (°C)</TableCell>
              <TableCell>Inlet Streams</TableCell>
              <TableCell>Outlet Streams</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading equipment..." variant="table" colSpan={7} />
            ) : equipment.length === 0 ? (
              <EmptyState message="No equipment found." variant="table" colSpan={7} />
            ) : (
              paginatedEquipment.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <strong>{item.equipmentTag}</strong>
                  </TableCell>
                  <TableCell>{item.equipmentName}</TableCell>
                  <TableCell align="right">{item.operatingPressure}</TableCell>
                  <TableCell align="right">{item.operatingTemperature}</TableCell>
                  <TableCell>
                    {item.fluidIn.map((f) => (
                      <Chip key={f} label={f} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    {item.fluidOut.map((f) => (
                      <Chip key={f} label={f} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteClick(item)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={equipment.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Equipment Tag"
                value={equipmentTag}
                onChange={(e) => setEquipmentTag(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Equipment Name"
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Operating Pressure"
                type="number"
                value={operatingPressure}
                onChange={(e) => setOperatingPressure(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">mbar(a)</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Operating Temperature"
                type="number"
                value={operatingTemperature}
                onChange={(e) =>
                  setOperatingTemperature(e.target.value ? Number(e.target.value) : '')
                }
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Inlet Streams"
                value={fluidIn}
                onChange={(e) => setFluidIn(e.target.value)}
                fullWidth
                helperText="Comma-separated stream tags (e.g., SW1, D19)"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Outlet Streams"
                value={fluidOut}
                onChange={(e) => setFluidOut(e.target.value)}
                fullWidth
                helperText="Comma-separated stream tags"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingEquipment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Equipment"
        message={`Delete "${deletingEquipment?.equipmentTag}"?`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
