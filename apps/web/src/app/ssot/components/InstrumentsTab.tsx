'use client';

/**
 * Instruments Tab Component
 *
 * Displays and manages process instruments.
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
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { ProcessInstrument, ProcessInstrumentInput } from '@vapour/types';
import {
  subscribeToInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from '@/lib/ssot/instrumentService';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'InstrumentsTab' });

interface InstrumentsTabProps {
  projectId: string;
  userId: string;
}

export default function InstrumentsTab({ projectId, userId }: InstrumentsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [instruments, setInstruments] = useState<ProcessInstrument[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<ProcessInstrument | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInstrument, setDeletingInstrument] = useState<ProcessInstrument | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [sNo, setSNo] = useState<number | ''>('');
  const [pidNo, setPidNo] = useState('');
  const [lineNo, setLineNo] = useState('');
  const [tagNo, setTagNo] = useState('');
  const [instrumentValveNo, setInstrumentValveNo] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [instrumentType, setInstrumentType] = useState('');
  const [fluid, setFluid] = useState('');
  const [pressureNor, setPressureNor] = useState<number | ''>('');
  const [temperatureNor, setTemperatureNor] = useState<number | ''>('');
  const [flowRateNor, setFlowRateNor] = useState<number | ''>('');

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    const unsubscribe = subscribeToInstruments(
      projectId,
      (data) => {
        setInstruments(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to instruments', { error: err });
        setError('Failed to load instruments');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const resetForm = () => {
    setSNo('');
    setPidNo('');
    setLineNo('');
    setTagNo('');
    setInstrumentValveNo('');
    setServiceLocation('');
    setInstrumentType('');
    setFluid('');
    setPressureNor('');
    setTemperatureNor('');
    setFlowRateNor('');
  };

  const handleAdd = () => {
    setEditingInstrument(null);
    resetForm();
    setSNo(instruments.length + 1);
    setFormOpen(true);
  };

  const handleEdit = (item: ProcessInstrument) => {
    setEditingInstrument(item);
    setSNo(item.sNo);
    setPidNo(item.pidNo);
    setLineNo(item.lineNo);
    setTagNo(item.tagNo);
    setInstrumentValveNo(item.instrumentValveNo || '');
    setServiceLocation(item.serviceLocation);
    setInstrumentType(item.instrumentType);
    setFluid(item.fluid);
    setPressureNor(item.pressureNor || '');
    setTemperatureNor(item.temperatureNor || '');
    setFlowRateNor(item.flowRateNor || '');
    setFormOpen(true);
  };

  const handleDeleteClick = (item: ProcessInstrument) => {
    setDeletingInstrument(item);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!tagNo.trim()) {
      setError('Tag number is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: ProcessInstrumentInput = {
        sNo: Number(sNo) || instruments.length + 1,
        pidNo: pidNo.trim(),
        lineNo: lineNo.trim(),
        tagNo: tagNo.trim(),
        instrumentValveNo: instrumentValveNo.trim() || undefined,
        serviceLocation: serviceLocation.trim(),
        instrumentType: instrumentType.trim(),
        fluid: fluid.trim(),
        pressureNor: pressureNor !== '' ? Number(pressureNor) : undefined,
        temperatureNor: temperatureNor !== '' ? Number(temperatureNor) : undefined,
        flowRateNor: flowRateNor !== '' ? Number(flowRateNor) : undefined,
      };

      if (editingInstrument) {
        await updateInstrument(projectId, editingInstrument.id, input, userId);
      } else {
        await createInstrument(projectId, input, userId);
      }

      setFormOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error saving instrument', { error: err });
      setError('Failed to save instrument');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingInstrument) return;

    setDeleting(true);
    try {
      await deleteInstrument(projectId, deletingInstrument.id);
      setDeleteDialogOpen(false);
      setDeletingInstrument(null);
    } catch (err) {
      logger.error('Error deleting instrument', { error: err });
      setError('Failed to delete instrument');
    } finally {
      setDeleting(false);
    }
  };

  const paginatedInstruments = instruments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Instrument
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
              <TableCell>Tag No.</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Line No.</TableCell>
              <TableCell>Service Location</TableCell>
              <TableCell>Fluid</TableCell>
              <TableCell align="right">Pressure (mbar)</TableCell>
              <TableCell align="right">Temp (°C)</TableCell>
              <TableCell align="right">Flow (kg/hr)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading instruments..." variant="table" colSpan={10} />
            ) : instruments.length === 0 ? (
              <EmptyState message="No instruments found." variant="table" colSpan={10} />
            ) : (
              paginatedInstruments.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.sNo}</TableCell>
                  <TableCell>
                    <strong>{item.tagNo}</strong>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.instrumentType} size="small" />
                  </TableCell>
                  <TableCell>{item.lineNo}</TableCell>
                  <TableCell>{item.serviceLocation}</TableCell>
                  <TableCell>{item.fluid}</TableCell>
                  <TableCell align="right">{item.pressureNor || '-'}</TableCell>
                  <TableCell align="right">{item.temperatureNor || '-'}</TableCell>
                  <TableCell align="right">{item.flowRateNor || '-'}</TableCell>
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
          count={instruments.length}
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
        <DialogTitle>{editingInstrument ? 'Edit Instrument' : 'Add Instrument'}</DialogTitle>
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
                label="Tag No."
                value={tagNo}
                onChange={(e) => setTagNo(e.target.value)}
                fullWidth
                required
                placeholder="e.g., PIT-101"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Instrument Type"
                value={instrumentType}
                onChange={(e) => setInstrumentType(e.target.value)}
                fullWidth
                placeholder="e.g., Pressure Transmitter"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Instrument Valve No."
                value={instrumentValveNo}
                onChange={(e) => setInstrumentValveNo(e.target.value)}
                fullWidth
                placeholder="e.g., IV-101"
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
                label="Line No."
                value={lineNo}
                onChange={(e) => setLineNo(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Fluid"
                value={fluid}
                onChange={(e) => setFluid(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Service Location"
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                fullWidth
                placeholder="e.g., Suction Side - Sea water pump"
              />
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Operating Conditions (Normal)
                </Typography>
              </Divider>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Pressure"
                type="number"
                value={pressureNor}
                onChange={(e) => setPressureNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">mbar(a)</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Temperature"
                type="number"
                value={temperatureNor}
                onChange={(e) => setTemperatureNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Flow Rate"
                type="number"
                value={flowRateNor}
                onChange={(e) => setFlowRateNor(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">kg/hr</InputAdornment> }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingInstrument ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Instrument"
        message={`Delete instrument "${deletingInstrument?.tagNo}"?`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
