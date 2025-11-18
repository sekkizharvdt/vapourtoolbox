'use client';

import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getBOMById, getBOMItems } from '@/lib/bom/bomService';
import { calculateAllItemCosts } from '@/lib/bom/bomCalculations';
import { createLogger } from '@vapour/logger';
import type { BOM, BOMItem, BOMStatus } from '@vapour/types';

const logger = createLogger({ context: 'BOMEditorPage' });

// Status color mapping
const statusColors: Record<BOMStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  RELEASED: 'warning',
  ARCHIVED: 'error',
};

export default function BOMEditorClient() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { db } = getFirebase();

  const bomId = params?.id as string;

  const [bom, setBOM] = useState<BOM | null>(null);
  const [items, setItems] = useState<BOMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBOM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomId]);

  const loadBOM = async () => {
    if (!bomId || !db) return;

    try {
      setLoading(true);
      setError(null);

      const [bomData, itemsData] = await Promise.all([
        getBOMById(db, bomId),
        getBOMItems(db, bomId),
      ]);

      if (!bomData) {
        setError('BOM not found');
        return;
      }

      setBOM(bomData);
      setItems(itemsData);
      logger.info('BOM loaded', { bomId, itemCount: itemsData.length });
    } catch (err) {
      logger.error('Error loading BOM', { error: err });
      setError('Failed to load BOM. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateCosts = async () => {
    if (!db || !user?.uid || !bom) return;

    try {
      setCalculating(true);
      setError(null);

      await calculateAllItemCosts(db, bomId, items, user.uid);
      logger.info('Costs calculated', { bomId });

      // Reload BOM to get updated summary
      await loadBOM();
      alert('Cost calculation completed successfully!');
    } catch (err) {
      logger.error('Error calculating costs', { error: err });
      setError('Failed to calculate costs. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const handleBack = () => {
    router.push('/estimation');
  };

  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !bom) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'BOM not found'}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to BOMs
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to BOMs
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h4" component="h1">
                {bom.name}
              </Typography>
              <Chip label={bom.status} color={statusColors[bom.status]} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              BOM Code: {bom.bomCode}
            </Typography>
            {bom.description && (
              <Typography variant="body2" color="text.secondary">
                {bom.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={calculating ? <CircularProgress size={20} /> : <CalculateIcon />}
              onClick={handleCalculateCosts}
              disabled={calculating || items.length === 0}
            >
              {calculating ? 'Calculating...' : 'Calculate Costs'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => alert('Add Item feature coming in next iteration')}
            >
              Add Item
            </Button>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Summary Card */}
        <Box sx={{ flex: { md: '0 0 33%' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Items
                </Typography>
                <Typography variant="h5">{bom.summary.itemCount}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Weight
                </Typography>
                <Typography variant="h5">{bom.summary.totalWeight.toFixed(2)} kg</Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Material Cost
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(bom.summary.totalMaterialCost)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">
                  Total Cost
                </Typography>
                <Typography variant="h4" color="primary">
                  {formatCurrency(bom.summary.totalCost)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Items List */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                BOM Items
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {items.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No items yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Add items to start building your BOM
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => alert('Add Item feature coming in next iteration')}
                  >
                    Add First Item
                  </Button>
                </Box>
              ) : (
                <Box>
                  {items.map((item) => (
                    <Card key={item.id} variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {item.itemNumber}. {item.name}
                            </Typography>
                            {item.description && (
                              <Typography variant="body2" color="text.secondary">
                                {item.description}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Quantity: {item.quantity} {item.unit}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            {item.cost?.totalMaterialCost ? (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  Cost
                                </Typography>
                                <Typography variant="h6" color="primary">
                                  {formatCurrency(item.cost.totalMaterialCost)}
                                </Typography>
                              </>
                            ) : (
                              <Chip label="Not calculated" size="small" variant="outlined" />
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Week 1 Implementation Note */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Week 1 Implementation:</strong> This is a simplified BOM editor showing summary
          and items list. Item management (add/edit/delete), shape/material selectors, and
          hierarchical tree view will be added in the next iteration.
        </Typography>
      </Alert>
    </Container>
  );
}
