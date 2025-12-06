'use client';

/**
 * Lines Tab Component
 *
 * Displays and manages process lines with pipe sizing calculations.
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
  Divider,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { ProcessLine, ProcessLineInput } from '@vapour/types';
import { subscribeToLines, createLine, updateLine, deleteLine } from '@/lib/ssot/lineService';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'LinesTab' });

interface LinesTabProps {
  projectId: string;
  userId: string;
}

export default function LinesTab({ projectId, userId }: LinesTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lines, setLines] = useState<ProcessLine[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProcessLine | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLine, setDeletingLine] = useState<ProcessLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [sNo, setSNo] = useState<number | ''>('');
  const [lineNumber, setLineNumber] = useState('');
  const [fluid, setFluid] = useState('');
  const [inputDataTag, setInputDataTag] = useState('');
  const [flowRateKgS, setFlowRateKgS] = useState<number | ''>('');
  const [density, setDensity] = useState<number | ''>('');
  const [designVelocity, setDesignVelocity] = useState<number | ''>(1.5);
  const [selectedID, setSelectedID] = useState<number | ''>('');

  // Calculated values
  const [calculatedID, setCalculatedID] = useState<number | null>(null);
  const [actualVelocity, setActualVelocity] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    const unsubscribe = subscribeToLines(
      projectId,
      (data) => {
        setLines(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to lines', { error: err });
        setError('Failed to load lines');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  // Auto-calculate when inputs change
  useEffect(() => {
    if (
      flowRateKgS !== '' &&
      density !== '' &&
      Number(density) > 0 &&
      designVelocity !== '' &&
      Number(designVelocity) > 0
    ) {
      const Q = Number(flowRateKgS) / Number(density); // m³/s
      const V = Number(designVelocity);
      const A = Q / V; // m²
      const D = Math.sqrt((4 * A) / Math.PI) * 1000; // mm
      setCalculatedID(D);
    } else {
      setCalculatedID(null);
    }

    if (
      flowRateKgS !== '' &&
      density !== '' &&
      Number(density) > 0 &&
      selectedID !== '' &&
      Number(selectedID) > 0
    ) {
      const Q = Number(flowRateKgS) / Number(density); // m³/s
      const D = Number(selectedID) / 1000; // m
      const A = (Math.PI * D * D) / 4; // m²
      const V = Q / A; // m/s
      setActualVelocity(V);
    } else {
      setActualVelocity(null);
    }
  }, [flowRateKgS, density, designVelocity, selectedID]);

  const resetForm = () => {
    setSNo('');
    setLineNumber('');
    setFluid('');
    setInputDataTag('');
    setFlowRateKgS('');
    setDensity('');
    setDesignVelocity(1.5);
    setSelectedID('');
    setCalculatedID(null);
    setActualVelocity(null);
  };

  const handleAdd = () => {
    setEditingLine(null);
    resetForm();
    // Auto-generate S.No
    setSNo(lines.length + 1);
    setFormOpen(true);
  };

  const handleEdit = (item: ProcessLine) => {
    setEditingLine(item);
    setSNo(item.sNo);
    setLineNumber(item.lineNumber);
    setFluid(item.fluid);
    setInputDataTag(item.inputDataTag);
    setFlowRateKgS(item.flowRateKgS);
    setDensity(item.density);
    setDesignVelocity(item.designVelocity);
    setSelectedID(item.selectedID);
    setCalculatedID(item.calculatedID);
    setActualVelocity(item.actualVelocity);
    setFormOpen(true);
  };

  const handleDeleteClick = (item: ProcessLine) => {
    setDeletingLine(item);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!lineNumber.trim()) {
      setError('Line number is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: ProcessLineInput = {
        sNo: Number(sNo) || lines.length + 1,
        lineNumber: lineNumber.trim(),
        fluid: fluid.trim(),
        inputDataTag: inputDataTag.trim(),
        flowRateKgS: Number(flowRateKgS) || 0,
        density: Number(density) || 1000,
        designVelocity: Number(designVelocity) || 1.5,
        calculatedID: calculatedID || 0,
        selectedID: Number(selectedID) || 0,
        actualVelocity: actualVelocity || 0,
      };

      if (editingLine) {
        await updateLine(projectId, editingLine.id, input, userId);
      } else {
        await createLine(projectId, input, userId);
      }

      setFormOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error saving line', { error: err });
      setError('Failed to save line');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLine) return;

    setDeleting(true);
    try {
      await deleteLine(projectId, deletingLine.id);
      setDeleteDialogOpen(false);
      setDeletingLine(null);
    } catch (err) {
      logger.error('Error deleting line', { error: err });
      setError('Failed to delete line');
    } finally {
      setDeleting(false);
    }
  };

  const paginatedLines = lines.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Line
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
              <TableCell>S.No</TableCell>
              <TableCell>Line No.</TableCell>
              <TableCell>Fluid</TableCell>
              <TableCell>Input Tag</TableCell>
              <TableCell align="right">Flow (kg/s)</TableCell>
              <TableCell align="right">Density (kg/m³)</TableCell>
              <TableCell align="right">Calc. Velocity (m/s)</TableCell>
              <TableCell align="right">Calc. ID (mm)</TableCell>
              <TableCell align="right">Selected ID (mm)</TableCell>
              <TableCell align="right">Actual Velocity (m/s)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading lines..." variant="table" colSpan={11} />
            ) : lines.length === 0 ? (
              <EmptyState message="No lines found." variant="table" colSpan={11} />
            ) : (
              paginatedLines.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.sNo}</TableCell>
                  <TableCell>
                    <strong>{item.lineNumber}</strong>
                  </TableCell>
                  <TableCell>{item.fluid}</TableCell>
                  <TableCell>{item.inputDataTag}</TableCell>
                  <TableCell align="right">{item.flowRateKgS?.toFixed(3)}</TableCell>
                  <TableCell align="right">{item.density?.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.designVelocity?.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.calculatedID?.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.selectedID?.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.actualVelocity?.toFixed(3)}</TableCell>
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
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={lines.length}
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
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingLine ? 'Edit Line' : 'Add Line'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="S.No"
                type="number"
                value={sNo}
                onChange={(e) => setSNo(e.target.value ? Number(e.target.value) : '')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Line Number"
                value={lineNumber}
                onChange={(e) => setLineNumber(e.target.value)}
                fullWidth
                required
                placeholder="e.g., 200-40-SS-SW-01"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Input Data Tag"
                value={inputDataTag}
                onChange={(e) => setInputDataTag(e.target.value)}
                fullWidth
                placeholder="e.g., SW1"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Fluid"
                value={fluid}
                onChange={(e) => setFluid(e.target.value)}
                fullWidth
                placeholder="e.g., Sea water"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Flow Rate"
                type="number"
                value={flowRateKgS}
                onChange={(e) => setFlowRateKgS(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">kg/s</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Density"
                type="number"
                value={density}
                onChange={(e) => setDensity(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">kg/m³</InputAdornment> }}
              />
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Pipe Sizing
                </Typography>
              </Divider>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Design Velocity"
                type="number"
                value={designVelocity}
                onChange={(e) => setDesignVelocity(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">m/s</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Calculated ID
                </Typography>
                <Typography>{calculatedID !== null ? calculatedID.toFixed(2) : '-'} mm</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Selected ID"
                type="number"
                value={selectedID}
                onChange={(e) => setSelectedID(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Actual Velocity
                </Typography>
                <Typography>
                  {actualVelocity !== null ? actualVelocity.toFixed(3) : '-'} m/s
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingLine ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Line"
        message={`Delete line "${deletingLine?.lineNumber}"?`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
