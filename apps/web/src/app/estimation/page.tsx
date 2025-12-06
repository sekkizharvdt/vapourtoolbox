'use client';

import {
  Container,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, TableActionCell, getStatusColor } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs, deleteBOM } from '@/lib/bom/bomService';
import { createLogger } from '@vapour/logger';
import type { BOM, BOMCategory } from '@vapour/types';

const logger = createLogger({ context: 'EstimationPage' });

// Fallback entity ID for users without entity assignment
const FALLBACK_ENTITY_ID = 'default-entity';

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
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  // Get entity ID from claims or use fallback
  const entityId = claims?.entityId || FALLBACK_ENTITY_ID;

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
        entityId,
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
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Bill of Materials (BOM)"
          subtitle="Create and manage equipment BOMs with cost estimates"
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} size="large">
              New BOM
            </Button>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

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
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading BOMs..." variant="table" colSpan={9} />
              ) : boms.length === 0 ? (
                <EmptyState
                  message="No BOMs yet. Click 'New BOM' to create your first Bill of Materials."
                  variant="table"
                  colSpan={9}
                  action={
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                      Create First BOM
                    </Button>
                  }
                />
              ) : (
                boms.map((bom) => (
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
                      <Chip
                        label={bom.status}
                        color={getStatusColor(bom.status, 'bom')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(bom.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <TableActionCell
                        actions={[
                          {
                            icon: <EditIcon fontSize="small" />,
                            label: 'Edit',
                            onClick: () => handleEdit(bom.id),
                          },
                          {
                            icon: <DeleteIcon fontSize="small" />,
                            label: 'Delete',
                            onClick: () => handleDelete(bom),
                            color: 'error',
                            disabled: bom.status !== 'DRAFT',
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
}
