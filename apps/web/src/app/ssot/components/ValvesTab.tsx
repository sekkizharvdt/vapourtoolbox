'use client';

/**
 * Valves Tab Component
 *
 * Displays and manages process valves.
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
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { ProcessValve, ProcessValveInput } from '@vapour/types';
import { VALVE_TYPES, END_CONNECTIONS } from '@vapour/types';
import { subscribeToValves, createValve, updateValve, deleteValve } from '@/lib/ssot/valveService';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ValvesTab' });

interface ValvesTabProps {
  projectId: string;
  userId: string;
}

export default function ValvesTab({ projectId, userId }: ValvesTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valves, setValves] = useState<ProcessValve[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingValve, setEditingValve] = useState<ProcessValve | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingValve, setDeletingValve] = useState<ProcessValve | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [sNo, setSNo] = useState<number | ''>('');
  const [pidNo, setPidNo] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [valveTag, setValveTag] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [valveType, setValveType] = useState('');
  const [endConnection, setEndConnection] = useState('');
  const [sizeNB, setSizeNB] = useState('');
  const [fluid, setFluid] = useState('');
  const [pressureNor, setPressureNor] = useState<number | ''>('');
  const [temperatureNor, setTemperatureNor] = useState<number | ''>('');
  const [flowNor, setFlowNor] = useState<number | ''>('');
  const [deltaPressure, setDeltaPressure] = useState<number | ''>('');

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    const unsubscribe = subscribeToValves(
      projectId,
      (data) => {
        setValves(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to valves', { error: err });
        setError('Failed to load valves');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const resetForm = () => {
    setSNo('');
    setPidNo('');
    setLineNumber('');
    setValveTag('');
    setServiceLocation('');
    setValveType('');
    setEndConnection('');
    setSizeNB('');
    setFluid('');
    setPressureNor('');
    setTemperatureNor('');
    setFlowNor('');
    setDeltaPressure('');
  };

  const handleAdd = () => {
    setEditingValve(null);
    resetForm();
    setSNo(valves.length + 1);
    setFormOpen(true);
  };

  const handleEdit = (item: ProcessValve) => {
    setEditingValve(item);
    setSNo(item.sNo);
    setPidNo(item.pidNo);
    setLineNumber(item.lineNumber);
    setValveTag(item.valveTag);
    setServiceLocation(item.serviceLocation);
    setValveType(item.valveType);
    setEndConnection(item.endConnection);
    setSizeNB(item.sizeNB);
    setFluid(item.fluid);
    setPressureNor(item.pressureNor || '');
    setTemperatureNor(item.temperatureNor || '');
    setFlowNor(item.flowNor || '');
    setDeltaPressure(item.deltaPressure || '');
    setFormOpen(true);
  };

  const handleDeleteClick = (item: ProcessValve) => {
    setDeletingValve(item);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!valveTag.trim()) {
      setError('Valve tag is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: ProcessValveInput = {
        sNo: Number(sNo) || valves.length + 1,
        pidNo: pidNo.trim(),
        lineNumber: lineNumber.trim(),
        valveTag: valveTag.trim(),
        serviceLocation: serviceLocation.trim(),
        valveType: valveType.trim(),
        endConnection: endConnection.trim(),
        sizeNB: sizeNB.trim(),
        fluid: fluid.trim(),
        pressureNor: pressureNor !== '' ? Number(pressureNor) : undefined,
        temperatureNor: temperatureNor !== '' ? Number(temperatureNor) : undefined,
        flowNor: flowNor !== '' ? Number(flowNor) : undefined,
        deltaPressure: deltaPressure !== '' ? Number(deltaPressure) : undefined,
      };

      if (editingValve) {
        await updateValve(projectId, editingValve.id, input, userId);
      } else {
        await createValve(projectId, input, userId);
      }

      setFormOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error saving valve', { error: err });
      setError('Failed to save valve');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingValve) return;

    setDeleting(true);
    try {
      await deleteValve(projectId, deletingValve.id);
      setDeleteDialogOpen(false);
      setDeletingValve(null);
    } catch (err) {
      logger.error('Error deleting valve', { error: err });
      setError('Failed to delete valve');
    } finally {
      setDeleting(false);
    }
  };

  const paginatedValves = valves.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Valve
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
              <TableCell>Valve Tag</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Line No.</TableCell>
              <TableCell>Service Location</TableCell>
              <TableCell>Fluid</TableCell>
              <TableCell align="right">Pressure (bar)</TableCell>
              <TableCell align="right">Temp (°C)</TableCell>
              <TableCell align="right">ΔP (bar)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading valves..." variant="table" colSpan={11} />
            ) : valves.length === 0 ? (
              <EmptyState message="No valves found." variant="table" colSpan={11} />
            ) : (
              paginatedValves.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.sNo}</TableCell>
                  <TableCell>
                    <strong>{item.valveTag}</strong>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.valveType} size="small" />
                  </TableCell>
                  <TableCell>{item.sizeNB}</TableCell>
                  <TableCell>{item.lineNumber}</TableCell>
                  <TableCell>{item.serviceLocation}</TableCell>
                  <TableCell>{item.fluid}</TableCell>
                  <TableCell align="right">{item.pressureNor || '-'}</TableCell>
                  <TableCell align="right">{item.temperatureNor || '-'}</TableCell>
                  <TableCell align="right">{item.deltaPressure || '-'}</TableCell>
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
          count={valves.length}
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
        <DialogTitle>{editingValve ? 'Edit Valve' : 'Add Valve'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="S.No"
                type="number"
                value={sNo}
                onChange={(e) => setSNo(e.target.value ? Number(e.target.value) : '')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Valve Tag"
                value={valveTag}
                onChange={(e) => setValveTag(e.target.value)}
                fullWidth
                required
                placeholder="e.g., BFV-101"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Valve Type</InputLabel>
                <Select
                  value={valveType}
                  onChange={(e) => setValveType(e.target.value)}
                  label="Valve Type"
                >
                  {VALVE_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Size (NB)"
                value={sizeNB}
                onChange={(e) => setSizeNB(e.target.value)}
                fullWidth
                placeholder="e.g., NB200"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="P&ID No."
                value={pidNo}
                onChange={(e) => setPidNo(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Line Number"
                value={lineNumber}
                onChange={(e) => setLineNumber(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>End Connection</InputLabel>
                <Select
                  value={endConnection}
                  onChange={(e) => setEndConnection(e.target.value)}
                  label="End Connection"
                >
                  {END_CONNECTIONS.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Service Location"
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Fluid"
                value={fluid}
                onChange={(e) => setFluid(e.target.value)}
                fullWidth
              />
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Operating Conditions (Normal)
                </Typography>
              </Divider>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Pressure"
                type="number"
                value={pressureNor}
                onChange={(e) => setPressureNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">bar</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Temperature"
                type="number"
                value={temperatureNor}
                onChange={(e) => setTemperatureNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Flow Rate"
                type="number"
                value={flowNor}
                onChange={(e) => setFlowNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">m³/hr</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="ΔP (Pressure Drop)"
                type="number"
                value={deltaPressure}
                onChange={(e) => setDeltaPressure(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">bar</InputAdornment> }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingValve ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Valve"
        message={`Delete valve "${deletingValve?.valveTag}"?`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
