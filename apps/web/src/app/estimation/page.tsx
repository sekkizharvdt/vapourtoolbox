'use client';

import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs, deleteBOM } from '@/lib/bom/bomService';
import { createLogger } from '@vapour/logger';
import type { BOM, BOMStatus, BOMCategory } from '@vapour/types';

const logger = createLogger({ context: 'EstimationPage' });

// Week 1: Temporary hardcoded entity ID (will be replaced with proper entity management)
const DEFAULT_ENTITY_ID = 'default-entity';

// Status color mapping
const statusColors: Record<BOMStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  RELEASED: 'warning',
  ARCHIVED: 'error',
};

// Category labels
const categoryLabels: Record<BOMCategory, string> = {
  HEAT_EXCHANGER: 'Heat Exchanger',
  PRESSURE_VESSEL: 'Pressure Vessel',
  STORAGE_TANK: 'Storage Tank',
  PIPING_ASSEMBLY: 'Piping Assembly',
  PUMP_PACKAGE: 'Pump Package',
  STRUCTURE: 'Structure',
  ELECTRICAL: 'Electrical',
  INSTRUMENTATION_PACKAGE: 'Instrumentation Package',
  HVAC: 'HVAC',
  GENERAL_EQUIPMENT: 'General Equipment',
  OTHER: 'Other',
};

export default function EstimationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [boms, setBOMs] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBOMs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadBOMs = async () => {
    if (!user || !db) return;

    try {
      setLoading(true);
      setError(null);

      const bomList = await listBOMs(db, {
        entityId: DEFAULT_ENTITY_ID,
        limit: 100,
      });

      setBOMs(bomList);
      logger.info('BOMs loaded', { count: bomList.length });
    } catch (err) {
      logger.error('Error loading BOMs', { error: err });
      setError('Failed to load BOMs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push('/estimation/new');
  };

  const handleEdit = (bomId: string) => {
    router.push(`/estimation/${bomId}`);
  };

  const handleDelete = async (bom: BOM) => {
    if (!db) return;

    if (!confirm(`Are you sure you want to delete "${bom.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteBOM(db, bom.id);
      logger.info('BOM deleted', { bomId: bom.id });
      loadBOMs(); // Reload list
    } catch (err) {
      logger.error('Error deleting BOM', { error: err });
      alert('Failed to delete BOM. Please try again.');
    }
  };

  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  };

  const formatDate = (timestamp: { toDate?: () => Date } | Date | string | null | undefined) => {
    if (!timestamp) return '-';
    const date =
      timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp as Date | string);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Bill of Materials (BOM)
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage equipment BOMs with cost estimates
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} size="large">
          New BOM
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : boms.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No BOMs Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first Bill of Materials to get started
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                Create First BOM
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>BOM Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Project</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Total Cost</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {boms.map((bom) => (
                <TableRow
                  key={bom.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleEdit(bom.id)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {bom.bomCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{bom.name}</Typography>
                    {bom.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {bom.description.length > 50
                          ? `${bom.description.substring(0, 50)}...`
                          : bom.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {categoryLabels[bom.category] || bom.category}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{bom.projectName || '-'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{bom.summary.itemCount}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(bom.summary.totalCost)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={bom.status} color={statusColors[bom.status]} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(bom.createdAt)}</Typography>
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => handleEdit(bom.id)} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(bom)}
                      title="Delete"
                      disabled={bom.status !== 'DRAFT'}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}
