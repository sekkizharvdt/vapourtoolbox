'use client';

/**
 * Pipe Table Tab Component
 *
 * Displays and manages pipe sizing lookup table.
 * Includes ability to seed default ASME B36.10 data.
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
  Alert,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  InputAdornment,
  Typography,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlaylistAdd as SeedIcon,
} from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { PipeSize, PipeSizeInput } from '@vapour/types';
import {
  subscribeToPipeSizes,
  createPipeSize,
  updatePipeSize,
  deletePipeSize,
  seedDefaultPipeTable,
} from '@/lib/ssot/pipeTableService';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'PipeTableTab' });

interface PipeTableTabProps {
  projectId: string;
  userId: string;
}

export default function PipeTableTab({ projectId, userId }: PipeTableTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pipes, setPipes] = useState<PipeSize[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPipe, setEditingPipe] = useState<PipeSize | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPipe, setDeletingPipe] = useState<PipeSize | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Form fields
  const [idRangeMin, setIdRangeMin] = useState<number | ''>('');
  const [idRangeMax, setIdRangeMax] = useState<number | ''>('');
  const [pipeSizeNB, setPipeSizeNB] = useState<number | ''>('');
  const [outerDiameter, setOuterDiameter] = useState<number | ''>('');
  const [thicknessSch40, setThicknessSch40] = useState<number | ''>('');

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    const unsubscribe = subscribeToPipeSizes(
      projectId,
      (data) => {
        setPipes(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to pipe table', { error: err });
        setError('Failed to load pipe table');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const resetForm = () => {
    setIdRangeMin('');
    setIdRangeMax('');
    setPipeSizeNB('');
    setOuterDiameter('');
    setThicknessSch40('');
  };

  const handleAdd = () => {
    setEditingPipe(null);
    resetForm();
    setFormOpen(true);
  };

  const handleEdit = (item: PipeSize) => {
    setEditingPipe(item);
    setIdRangeMin(item.idRangeMin);
    setIdRangeMax(item.idRangeMax);
    setPipeSizeNB(item.pipeSizeNB);
    setOuterDiameter(item.outerDiameter);
    setThicknessSch40(item.thicknessSch40);
    setFormOpen(true);
  };

  const handleDeleteClick = (item: PipeSize) => {
    setDeletingPipe(item);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (pipeSizeNB === '' || outerDiameter === '') {
      setError('Pipe size NB and OD are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: PipeSizeInput = {
        idRangeMin: Number(idRangeMin) || 0,
        idRangeMax: Number(idRangeMax) || 0,
        pipeSizeNB: Number(pipeSizeNB),
        outerDiameter: Number(outerDiameter),
        thicknessSch40: Number(thicknessSch40) || 0,
      };

      if (editingPipe) {
        await updatePipeSize(projectId, editingPipe.id, input, userId);
      } else {
        await createPipeSize(projectId, input, userId);
      }

      setFormOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error saving pipe size', { error: err });
      setError('Failed to save pipe size');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPipe) return;

    setDeleting(true);
    try {
      await deletePipeSize(projectId, deletingPipe.id);
      setDeleteDialogOpen(false);
      setDeletingPipe(null);
    } catch (err) {
      logger.error('Error deleting pipe size', { error: err });
      setError('Failed to delete pipe size');
    } finally {
      setDeleting(false);
    }
  };

  const handleSeedDefault = async () => {
    setSeeding(true);
    setError('');
    try {
      await seedDefaultPipeTable(projectId, userId);
      setSeedDialogOpen(false);
    } catch (err) {
      logger.error('Error seeding pipe table', { error: err });
      setError('Failed to seed pipe table');
    } finally {
      setSeeding(false);
    }
  };

  const paginatedPipes = pipes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Calculate inner diameter for display
  const getInnerDiameter = (pipe: PipeSize) => {
    return (pipe.outerDiameter - 2 * pipe.thicknessSch40).toFixed(2);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Pipe sizing lookup table (ASME B36.10 Schedule 40)
        </Typography>
        <Stack direction="row" spacing={1}>
          {pipes.length === 0 && (
            <Button
              variant="outlined"
              startIcon={<SeedIcon />}
              onClick={() => setSeedDialogOpen(true)}
            >
              Load Default Table
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Size
          </Button>
        </Stack>
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
              <TableCell>ID Range Min (mm)</TableCell>
              <TableCell>ID Range Max (mm)</TableCell>
              <TableCell>Pipe Size (NB)</TableCell>
              <TableCell>OD (mm)</TableCell>
              <TableCell>Thickness Sch40 (mm)</TableCell>
              <TableCell>ID (mm)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading pipe table..." variant="table" colSpan={7} />
            ) : pipes.length === 0 ? (
              <EmptyState
                message="No pipe sizes found. Click 'Load Default Table' to seed ASME B36.10 data."
                variant="table"
                colSpan={7}
              />
            ) : (
              paginatedPipes.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.idRangeMin}</TableCell>
                  <TableCell>{item.idRangeMax}</TableCell>
                  <TableCell>
                    <strong>NB{item.pipeSizeNB}</strong>
                  </TableCell>
                  <TableCell>{item.outerDiameter}</TableCell>
                  <TableCell>{item.thicknessSch40}</TableCell>
                  <TableCell>{getInnerDiameter(item)}</TableCell>
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
          count={pipes.length}
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
        <DialogTitle>{editingPipe ? 'Edit Pipe Size' : 'Add Pipe Size'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ID Range Min"
                type="number"
                value={idRangeMin}
                onChange={(e) => setIdRangeMin(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ID Range Max"
                type="number"
                value={idRangeMax}
                onChange={(e) => setIdRangeMax(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Pipe Size NB"
                type="number"
                value={pipeSizeNB}
                onChange={(e) => setPipeSizeNB(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Outer Diameter"
                type="number"
                value={outerDiameter}
                onChange={(e) => setOuterDiameter(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                required
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Thickness Sch40"
                type="number"
                value={thicknessSch40}
                onChange={(e) => setThicknessSch40(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingPipe ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Seed Confirmation Dialog */}
      <ConfirmDialog
        open={seedDialogOpen}
        title="Load Default Pipe Table"
        message="This will add 19 standard pipe sizes based on ASME B36.10 Schedule 40. Continue?"
        confirmLabel="Load"
        loading={seeding}
        onConfirm={handleSeedDefault}
        onClose={() => setSeedDialogOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Pipe Size"
        message={`Delete NB${deletingPipe?.pipeSizeNB}?`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
