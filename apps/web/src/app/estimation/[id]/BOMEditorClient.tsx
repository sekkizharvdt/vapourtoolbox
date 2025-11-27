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
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getBOMById, getBOMItems, addBOMItem } from '@/lib/bom/bomService';
import { calculateAllItemCosts } from '@/lib/bom/bomCalculations';
import { createLogger } from '@vapour/logger';
import type { BOM, BOMItem, BOMStatus } from '@vapour/types';
import AddBOMItemDialog, { type AddItemData } from '@/components/bom/AddBOMItemDialog';
import GeneratePDFDialog from '@/components/bom/GeneratePDFDialog';

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
  const pathname = usePathname();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [bom, setBOM] = useState<BOM | null>(null);
  const [items, setItems] = useState<BOMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [bomId, setBomId] = useState<string | null>(null);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/estimation\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setBomId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (bomId) {
      loadBOM();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomId]);

  const loadBOM = async () => {
    // eslint-disable-next-line no-console
    console.log('[BOMEditorClient] loadBOM called', { bomId, hasDb: !!db });
    if (!bomId || bomId === 'placeholder' || !db) {
      // eslint-disable-next-line no-console
      console.log('[BOMEditorClient] loadBOM returning early', { bomId, hasDb: !!db });
      return;
    }

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
    if (!db || !user?.uid || !bom || !bomId) return;

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

  const handleAddItem = async (data: AddItemData) => {
    if (!db || !user?.uid || !bomId) return;

    try {
      logger.info('Adding BOM item', { bomId, data });

      await addBOMItem(db, bomId, data, user.uid);
      logger.info('BOM item added', { bomId });

      // Reload BOM to show new item
      await loadBOM();
    } catch (err) {
      logger.error('Error adding BOM item', { error: err });
      throw err; // Re-throw to let dialog handle error display
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
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={() => setPdfDialogOpen(true)}
              disabled={items.length === 0}
              color="secondary"
            >
              Generate PDF
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
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

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Direct Costs
              </Typography>

              <Box sx={{ mb: 1, pl: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Material
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(bom.summary.totalMaterialCost)}
                </Typography>
              </Box>

              <Box sx={{ mb: 1, pl: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Fabrication
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(bom.summary.totalFabricationCost)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2, pl: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Service
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(bom.summary.totalServiceCost)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2, pl: 1, borderTop: 1, borderColor: 'divider', pt: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="medium">
                  Total Direct
                </Typography>
                <Typography variant="h6">{formatCurrency(bom.summary.totalDirectCost)}</Typography>
              </Box>

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Indirect Costs
              </Typography>

              {bom.summary.overhead.amount > 0 && (
                <Box sx={{ mb: 1, pl: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overhead
                  </Typography>
                  <Typography variant="body1">{formatCurrency(bom.summary.overhead)}</Typography>
                </Box>
              )}

              {bom.summary.contingency.amount > 0 && (
                <Box sx={{ mb: 1, pl: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Contingency
                  </Typography>
                  <Typography variant="body1">{formatCurrency(bom.summary.contingency)}</Typography>
                </Box>
              )}

              {bom.summary.profit.amount > 0 && (
                <Box sx={{ mb: 2, pl: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Profit
                  </Typography>
                  <Typography variant="body1">{formatCurrency(bom.summary.profit)}</Typography>
                </Box>
              )}

              {bom.summary.overhead.amount === 0 &&
                bom.summary.contingency.amount === 0 &&
                bom.summary.profit.amount === 0 && (
                  <Box sx={{ mb: 2, pl: 1 }}>
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      No indirect costs configured
                    </Typography>
                  </Box>
                )}

              <Divider sx={{ my: 2 }} />

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
                    onClick={() => setAddDialogOpen(true)}
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
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {item.itemNumber}. {item.name}
                              </Typography>
                              {item.component?.type === 'BOUGHT_OUT' && (
                                <Chip
                                  label="Bought-Out"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              )}
                              {item.component?.type === 'SHAPE' && (
                                <Chip
                                  label="Fabricated"
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            {item.description && (
                              <Typography variant="body2" color="text.secondary">
                                {item.description}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Quantity: {item.quantity} {item.unit}
                            </Typography>
                            {item.component?.materialCode && (
                              <Typography variant="caption" color="text.secondary">
                                Material: {item.component.materialCode}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ textAlign: 'right', minWidth: 150 }}>
                            {item.cost?.totalMaterialCost ? (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  Total Cost
                                </Typography>
                                <Typography variant="h6" color="primary">
                                  {formatCurrency({
                                    amount:
                                      (item.cost.totalMaterialCost?.amount || 0) +
                                      (item.cost.totalFabricationCost?.amount || 0) +
                                      (item.cost.totalServiceCost?.amount || 0),
                                    currency: item.cost.totalMaterialCost.currency,
                                  })}
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Mat: {formatCurrency(item.cost.totalMaterialCost)}
                                  </Typography>
                                  {item.cost.totalFabricationCost &&
                                    item.cost.totalFabricationCost.amount > 0 && (
                                      <Typography variant="caption" color="text.secondary">
                                        Fab: {formatCurrency(item.cost.totalFabricationCost)}
                                      </Typography>
                                    )}
                                  {item.cost.totalServiceCost &&
                                    item.cost.totalServiceCost.amount > 0 && (
                                      <Typography variant="caption" color="text.secondary">
                                        Svc: {formatCurrency(item.cost.totalServiceCost)}
                                      </Typography>
                                    )}
                                </Box>
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

      {/* BOM Features Info */}
      <Alert severity="success" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>BOM Features:</strong> Add bought-out components (valves, pumps, instruments) or
          fabricated shape-based items (plates, shells, heads, nozzles) with automatic weight and
          cost calculations.
        </Typography>
      </Alert>

      {/* Add Item Dialog */}
      {bom && (
        <>
          <AddBOMItemDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            onAdd={handleAddItem}
            entityId={bom.entityId}
          />
          <GeneratePDFDialog
            open={pdfDialogOpen}
            onClose={() => setPdfDialogOpen(false)}
            bomId={bomId!}
            bomName={bom.name}
          />
        </>
      )}
    </Container>
  );
}
