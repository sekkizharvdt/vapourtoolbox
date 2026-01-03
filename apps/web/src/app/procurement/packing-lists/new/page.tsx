'use client';

/**
 * Create Packing List Page
 *
 * Create a packing list from a Purchase Order
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder } from '@vapour/types';
import { listPOs, getPOItems } from '@/lib/procurement/purchaseOrderService';
import { createPackingList } from '@/lib/procurement/packingListService';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

interface PackingItem {
  poItemId: string;
  description: string;
  availableQty: number;
  quantity: number;
  unit: string;
  packageNumber: string;
  weight?: number;
  dimensions?: string;
  selected: boolean;
  equipmentId?: string;
  equipmentCode?: string;
}

export default function NewPackingListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // PO Selection
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form fields
  const [numberOfPackages, setNumberOfPackages] = useState(1);
  const [totalWeight, setTotalWeight] = useState<number | ''>('');
  const [totalVolume, setTotalVolume] = useState<number | ''>('');
  const [shippingMethod, setShippingMethod] = useState<'AIR' | 'SEA' | 'ROAD' | 'COURIER' | ''>('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [packingInstructions, setPackingInstructions] = useState('');
  const [handlingInstructions, setHandlingInstructions] = useState('');

  // Items to pack
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);

  // Load available POs
  useEffect(() => {
    loadAvailablePOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load preselected PO
  useEffect(() => {
    if (preselectedPoId && availablePOs.length > 0) {
      const po = availablePOs.find((p) => p.id === preselectedPoId);
      if (po) {
        handlePOSelect(po);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPoId, availablePOs]);

  const loadAvailablePOs = async () => {
    setLoading(true);
    try {
      // Load POs that are issued or in progress (eligible for packing lists)
      const pos = await listPOs({});
      const eligiblePOs = pos.filter((po) =>
        ['ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewPackingListPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback(async (po: PurchaseOrder | null) => {
    setSelectedPO(po);
    if (!po) {
      setPackingItems([]);
      setDeliveryAddress('');
      return;
    }

    try {
      const items = await getPOItems(po.id);

      // Initialize packing items from PO items
      const packItems: PackingItem[] = items.map((item, index) => ({
        poItemId: item.id,
        description: item.description,
        availableQty: item.quantity - (item.quantityDelivered || 0),
        quantity: item.quantity - (item.quantityDelivered || 0),
        unit: item.unit,
        packageNumber: `PKG-${String(index + 1).padStart(3, '0')}`,
        selected: true,
        equipmentId: item.equipmentId,
        equipmentCode: item.equipmentCode,
      }));

      setPackingItems(packItems);

      // Pre-fill delivery address if available
      if (po.deliveryAddress) {
        setDeliveryAddress(po.deliveryAddress);
      }
    } catch (err) {
      console.error('[NewPackingListPage] Error loading PO items:', err);
      setError('Failed to load PO items');
    }
  }, []);

  const handleItemChange = (
    index: number,
    field: keyof PackingItem,
    value: string | number | boolean
  ) => {
    const updated = [...packingItems];
    const item = updated[index];
    if (item) {
      (item as unknown as Record<string, unknown>)[field] = value;
    }
    setPackingItems(updated);
  };

  const handleCreatePL = async () => {
    if (!user || !selectedPO) return;

    // Validation
    if (!deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }

    const selectedItems = packingItems.filter((item) => item.selected && item.quantity > 0);
    if (selectedItems.length === 0) {
      setError('At least one item must be selected for packing');
      return;
    }

    // Validate quantities
    for (const item of selectedItems) {
      if (item.quantity > item.availableQty) {
        setError(`Quantity for "${item.description}" exceeds available quantity`);
        return;
      }
    }

    setCreating(true);
    setError('');

    try {
      const plId = await createPackingList(
        {
          purchaseOrderId: selectedPO.id,
          projectId: selectedPO.projectIds?.[0] || '',
          projectName: selectedPO.projectNames?.[0] || '',
          numberOfPackages,
          totalWeight: totalWeight || undefined,
          totalVolume: totalVolume || undefined,
          shippingMethod: shippingMethod || undefined,
          shippingCompany: shippingCompany || undefined,
          trackingNumber: trackingNumber || undefined,
          estimatedDeliveryDate: estimatedDeliveryDate
            ? new Date(estimatedDeliveryDate)
            : undefined,
          deliveryAddress,
          contactPerson: contactPerson || undefined,
          contactPhone: contactPhone || undefined,
          packingInstructions: packingInstructions || undefined,
          handlingInstructions: handlingInstructions || undefined,
          items: selectedItems.map((item) => ({
            poItemId: item.poItemId,
            quantity: item.quantity,
            packageNumber: item.packageNumber,
            weight: item.weight,
            dimensions: item.dimensions,
          })),
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/packing-lists/${plId}`);
    } catch (err) {
      console.error('[NewPackingListPage] Error creating packing list:', err);
      setError('Failed to create packing list. Please try again.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 0 }}>
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
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/packing-lists')}
            sx={{ mb: 1 }}
          >
            Back to Packing Lists
          </Button>
          <Typography variant="h4" gutterBottom>
            Create Packing List
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a packing list for shipment from a Purchase Order
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* PO Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Purchase Order
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Autocomplete
            options={availablePOs}
            value={selectedPO}
            onChange={(_, newValue) => handlePOSelect(newValue)}
            getOptionLabel={(option) =>
              `${option.number} - ${option.vendorName} (${formatCurrency(option.grandTotal, option.currency)})`
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Purchase Order"
                placeholder="Search by PO number or vendor..."
                required
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />

          {selectedPO && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{selectedPO.vendorName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{selectedPO.projectNames?.[0] || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatCurrency(selectedPO.grandTotal, selectedPO.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        {selectedPO && (
          <>
            {/* Shipping Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Shipping Details
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Number of Packages"
                    type="number"
                    value={numberOfPackages}
                    onChange={(e) => setNumberOfPackages(Number(e.target.value))}
                    fullWidth
                    required
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel>Shipping Method</InputLabel>
                    <Select
                      value={shippingMethod}
                      onChange={(e) =>
                        setShippingMethod(e.target.value as 'AIR' | 'SEA' | 'ROAD' | 'COURIER' | '')
                      }
                      label="Shipping Method"
                    >
                      <MenuItem value="">Not specified</MenuItem>
                      <MenuItem value="AIR">Air Freight</MenuItem>
                      <MenuItem value="SEA">Sea Freight</MenuItem>
                      <MenuItem value="ROAD">Road Transport</MenuItem>
                      <MenuItem value="COURIER">Courier</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Total Weight (kg)"
                    type="number"
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value ? Number(e.target.value) : '')}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Total Volume (m³)"
                    type="number"
                    value={totalVolume}
                    onChange={(e) => setTotalVolume(e.target.value ? Number(e.target.value) : '')}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Shipping Company"
                    value={shippingCompany}
                    onChange={(e) => setShippingCompany(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Tracking Number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Estimated Delivery Date"
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Delivery Address */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Delivery Address
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Delivery Address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    fullWidth
                    required
                    multiline
                    rows={3}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Contact Person"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Contact Phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Items to Pack */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Items to Pack
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={packingItems.every((item) => item.selected)}
                          indeterminate={
                            packingItems.some((item) => item.selected) &&
                            !packingItems.every((item) => item.selected)
                          }
                          onChange={(e) => {
                            const updated = packingItems.map((item) => ({
                              ...item,
                              selected: e.target.checked,
                            }));
                            setPackingItems(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Available</TableCell>
                      <TableCell align="right">Qty to Pack</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Package #</TableCell>
                      <TableCell>Weight (kg)</TableCell>
                      <TableCell>Dimensions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {packingItems.map((item, index) => (
                      <TableRow key={item.poItemId} sx={{ opacity: item.selected ? 1 : 0.5 }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={item.selected}
                            onChange={(e) => handleItemChange(index, 'selected', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.equipmentCode && (
                            <Typography variant="caption" color="text.secondary">
                              {item.equipmentCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{item.availableQty}</TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', Number(e.target.value))
                            }
                            size="small"
                            sx={{ width: 80 }}
                            inputProps={{ min: 0, max: item.availableQty }}
                            disabled={!item.selected}
                          />
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <TextField
                            value={item.packageNumber}
                            onChange={(e) =>
                              handleItemChange(index, 'packageNumber', e.target.value)
                            }
                            size="small"
                            sx={{ width: 100 }}
                            disabled={!item.selected}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={item.weight || ''}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'weight',
                                e.target.value ? Number(e.target.value) : ''
                              )
                            }
                            size="small"
                            sx={{ width: 80 }}
                            disabled={!item.selected}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.dimensions || ''}
                            onChange={(e) => handleItemChange(index, 'dimensions', e.target.value)}
                            size="small"
                            placeholder="LxWxH cm"
                            sx={{ width: 120 }}
                            disabled={!item.selected}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Instructions */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Instructions (Optional)
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Packing Instructions"
                    value={packingInstructions}
                    onChange={(e) => setPackingInstructions(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Special packing requirements..."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Handling Instructions"
                    value={handlingInstructions}
                    onChange={(e) => setHandlingInstructions(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Fragile, keep upright, etc..."
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => router.push('/procurement/packing-lists')} disabled={creating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreatePL}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Packing List'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
