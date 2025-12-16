'use client';

/**
 * Packing List Detail Page
 *
 * View packing list details with status workflow
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Stack,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Typography,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  LocalShipping as ShippingIcon,
  Inventory as InventoryIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PackingList, PackingListItem } from '@vapour/types';
import {
  getPLById,
  getPLItems,
  updatePackingListStatus,
} from '@/lib/procurement/packingListService';
import {
  getPLStatusText,
  getPLStatusColor,
  getShippingMethodText,
  getAvailableActions,
} from '@/lib/procurement/packingListHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function PLDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pl, setPL] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingListItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [plId, setPlId] = useState<string | null>(null);

  // Dialog states
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompany, setShippingCompany] = useState('');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/packing-lists\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setPlId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (plId) {
      loadPL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plId]);

  const loadPL = async () => {
    if (!plId) return;
    setLoading(true);
    setError('');
    try {
      const [plData, itemsData] = await Promise.all([getPLById(plId), getPLItems(plId)]);

      if (!plData) {
        setError('Packing List not found');
        return;
      }

      setPL(plData);
      setItems(itemsData);
      setTrackingNumber(plData.trackingNumber || '');
      setShippingCompany(plData.shippingCompany || '');
    } catch (err) {
      console.error('[PLDetailClient] Error loading Packing List:', err);
      setError('Failed to load packing list');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!user || !pl || !plId) return;

    setActionLoading(true);
    try {
      await updatePackingListStatus(plId, 'FINALIZED', user.uid);
      setFinalizeDialogOpen(false);
      await loadPL();
    } catch (err) {
      console.error('[PLDetailClient] Error finalizing PL:', err);
      setError('Failed to finalize packing list');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShip = async () => {
    if (!user || !pl || !plId) return;

    setActionLoading(true);
    try {
      await updatePackingListStatus(plId, 'SHIPPED', user.uid);
      setShipDialogOpen(false);
      await loadPL();
    } catch (err) {
      console.error('[PLDetailClient] Error marking as shipped:', err);
      setError('Failed to mark as shipped');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async () => {
    if (!user || !pl || !plId) return;

    setActionLoading(true);
    try {
      await updatePackingListStatus(plId, 'DELIVERED', user.uid);
      setDeliverDialogOpen(false);
      await loadPL();
    } catch (err) {
      console.error('[PLDetailClient] Error marking as delivered:', err);
      setError('Failed to mark as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pl) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Packing List not found'}</Alert>
        <Button onClick={() => router.push('/procurement/packing-lists')} sx={{ mt: 2 }}>
          Back to Packing Lists
        </Button>
      </Box>
    );
  }

  const actions = getAvailableActions(pl.status);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              color="inherit"
              href="/procurement"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement');
              }}
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Procurement
            </Link>
            <Link
              color="inherit"
              href="/procurement/packing-lists"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement/packing-lists');
              }}
              sx={{ cursor: 'pointer' }}
            >
              Packing Lists
            </Link>
            <Typography color="text.primary">{pl.number}</Typography>
          </Breadcrumbs>

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">{pl.number}</Typography>
                <Chip
                  label={getPLStatusText(pl.status)}
                  color={getPLStatusColor(pl.status)}
                  size="medium"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                PO: {pl.poNumber} • Vendor: {pl.vendorName}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {actions.canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => router.push(`/procurement/packing-lists/${plId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {actions.canFinalize && (
                <Button
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setFinalizeDialogOpen(true)}
                >
                  Finalize
                </Button>
              )}
              {actions.canShip && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<ShippingIcon />}
                  onClick={() => setShipDialogOpen(true)}
                >
                  Mark as Shipped
                </Button>
              )}
              {actions.canDeliver && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<InventoryIcon />}
                  onClick={() => setDeliverDialogOpen(true)}
                >
                  Mark as Delivered
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Packing List Details */}
        <Grid container spacing={3}>
          {/* Left Column - Main Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Shipping Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Shipping Information
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Shipping Method
                  </Typography>
                  <Typography variant="body1">
                    {getShippingMethodText(pl.shippingMethod)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Shipping Company
                  </Typography>
                  <Typography variant="body1">{pl.shippingCompany || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tracking Number
                  </Typography>
                  <Typography variant="body1">{pl.trackingNumber || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Number of Packages
                  </Typography>
                  <Typography variant="body1">{pl.numberOfPackages}</Typography>
                </Grid>
                {pl.totalWeight && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Weight
                    </Typography>
                    <Typography variant="body1">{pl.totalWeight} kg</Typography>
                  </Grid>
                )}
                {pl.totalVolume && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Volume
                    </Typography>
                    <Typography variant="body1">{pl.totalVolume} m³</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {/* Items Table */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Packing Items ({items.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Package</TableCell>
                      <TableCell>Weight</TableCell>
                      <TableCell>Dimensions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.lineNumber}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.equipmentCode && (
                            <Typography variant="caption" color="text.secondary">
                              {item.equipmentCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <Chip label={item.packageNumber} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{item.weight ? `${item.weight} kg` : '-'}</TableCell>
                        <TableCell>{item.dimensions || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Right Column - Summary & Dates */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Delivery Address */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Delivery Address
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {pl.deliveryAddress}
              </Typography>
              {pl.contactPerson && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Contact Person
                  </Typography>
                  <Typography variant="body1">{pl.contactPerson}</Typography>
                  {pl.contactPhone && (
                    <Typography variant="body2" color="text.secondary">
                      {pl.contactPhone}
                    </Typography>
                  )}
                </>
              )}
            </Paper>

            {/* Dates */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{formatDate(pl.createdAt)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    by {pl.createdByName}
                  </Typography>
                </Box>
                {pl.estimatedDeliveryDate && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Delivery
                    </Typography>
                    <Typography variant="body1">{formatDate(pl.estimatedDeliveryDate)}</Typography>
                  </Box>
                )}
                {pl.shippedDate && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Shipped
                    </Typography>
                    <Typography variant="body1">{formatDate(pl.shippedDate)}</Typography>
                  </Box>
                )}
                {pl.actualDeliveryDate && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Delivered
                    </Typography>
                    <Typography variant="body1">{formatDate(pl.actualDeliveryDate)}</Typography>
                  </Box>
                )}
              </Stack>
            </Paper>

            {/* Instructions */}
            {(pl.packingInstructions || pl.handlingInstructions) && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Instructions
                </Typography>
                {pl.packingInstructions && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Packing Instructions
                    </Typography>
                    <Typography variant="body2">{pl.packingInstructions}</Typography>
                  </Box>
                )}
                {pl.handlingInstructions && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Handling Instructions
                    </Typography>
                    <Typography variant="body2">{pl.handlingInstructions}</Typography>
                  </Box>
                )}
              </Paper>
            )}
          </Grid>
        </Grid>
      </Stack>

      {/* Finalize Dialog */}
      <Dialog
        open={finalizeDialogOpen}
        onClose={() => setFinalizeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Finalize Packing List</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to finalize this packing list? Once finalized, items cannot be
            modified.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalize}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Finalize
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog
        open={shipDialogOpen}
        onClose={() => setShipDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mark as Shipped</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Enter shipping details to mark this packing list as shipped.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Shipping Company"
              value={shippingCompany}
              onChange={(e) => setShippingCompany(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tracking Number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShipDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleShip}
            variant="contained"
            color="warning"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <ShippingIcon />}
          >
            Mark as Shipped
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deliver Dialog */}
      <Dialog
        open={deliverDialogOpen}
        onClose={() => setDeliverDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mark as Delivered</DialogTitle>
        <DialogContent>
          <Typography>
            Confirm that this shipment has been delivered to the destination. This will record the
            actual delivery date.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeliverDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeliver}
            variant="contained"
            color="success"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <InventoryIcon />}
          >
            Mark as Delivered
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
