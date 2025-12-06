'use client';

/**
 * Streams Tab Component
 *
 * Displays and manages process streams (INPUT_DATA).
 * Includes table view, create/edit dialog, and delete functionality.
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
  Tooltip,
  Alert,
  TablePagination,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { LoadingState, EmptyState, ConfirmDialog } from '@vapour/ui';
import type { ProcessStream } from '@vapour/types';
import { subscribeToStreams, deleteStream } from '@/lib/ssot/streamService';
import { createLogger } from '@vapour/logger';
import StreamFormDialog from './StreamFormDialog';

const logger = createLogger({ context: 'StreamsTab' });

interface StreamsTabProps {
  projectId: string;
  userId: string;
}

export default function StreamsTab({ projectId, userId }: StreamsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streams, setStreams] = useState<ProcessStream[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<ProcessStream | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStream, setDeletingStream] = useState<ProcessStream | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError('');

    const unsubscribe = subscribeToStreams(
      projectId,
      (data) => {
        setStreams(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error subscribing to streams', { error: err });
        setError('Failed to load streams');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const handleAddStream = () => {
    setEditingStream(null);
    setFormOpen(true);
  };

  const handleEditStream = (stream: ProcessStream) => {
    setEditingStream(stream);
    setFormOpen(true);
  };

  const handleDeleteClick = (stream: ProcessStream) => {
    setDeletingStream(stream);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStream) return;

    setDeleting(true);
    try {
      await deleteStream(projectId, deletingStream.id);
      setDeleteDialogOpen(false);
      setDeletingStream(null);
    } catch (err) {
      logger.error('Error deleting stream', { error: err });
      setError('Failed to delete stream');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate streams
  const paginatedStreams = streams.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Fluid type color mapping
  const getFluidTypeColor = (fluidType: string) => {
    switch (fluidType) {
      case 'SEA WATER':
        return 'primary';
      case 'BRINE WATER':
        return 'warning';
      case 'DISTILLATE WATER':
        return 'success';
      case 'STEAM':
        return 'error';
      case 'NCG':
        return 'default';
      case 'FEED WATER':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header with Add button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddStream}>
          Add Stream
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Streams Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Line Tag</TableCell>
              <TableCell>Fluid Type</TableCell>
              <TableCell align="right">Flow (kg/s)</TableCell>
              <TableCell align="right">Flow (kg/hr)</TableCell>
              <TableCell align="right">Pressure (mbar)</TableCell>
              <TableCell align="right">Temp (°C)</TableCell>
              <TableCell align="right">Density (kg/m³)</TableCell>
              <TableCell align="right">TDS (ppm)</TableCell>
              <TableCell align="right">Enthalpy (kJ/kg)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingState message="Loading streams..." variant="table" colSpan={10} />
            ) : streams.length === 0 ? (
              <EmptyState
                message="No streams found. Add your first stream to get started."
                variant="table"
                colSpan={10}
              />
            ) : (
              paginatedStreams.map((stream) => (
                <TableRow key={stream.id} hover>
                  <TableCell>
                    <strong>{stream.lineTag}</strong>
                    {stream.description && (
                      <Tooltip title={stream.description}>
                        <span style={{ marginLeft: 4, color: '#999' }}>ⓘ</span>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={stream.fluidType}
                      size="small"
                      color={getFluidTypeColor(stream.fluidType)}
                    />
                  </TableCell>
                  <TableCell align="right">{stream.flowRateKgS?.toFixed(3)}</TableCell>
                  <TableCell align="right">{stream.flowRateKgHr?.toFixed(1)}</TableCell>
                  <TableCell align="right">{stream.pressureMbar?.toFixed(0)}</TableCell>
                  <TableCell align="right">{stream.temperature?.toFixed(1)}</TableCell>
                  <TableCell align="right">{stream.density?.toFixed(2)}</TableCell>
                  <TableCell align="right">{stream.tds?.toFixed(0) || '-'}</TableCell>
                  <TableCell align="right">{stream.enthalpy?.toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditStream(stream)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(stream)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={streams.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Create/Edit Dialog */}
      <StreamFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
        userId={userId}
        stream={editingStream}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Stream"
        message={`Are you sure you want to delete stream "${deletingStream?.lineTag}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="error"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
