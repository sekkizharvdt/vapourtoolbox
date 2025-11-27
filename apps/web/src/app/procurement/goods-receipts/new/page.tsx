'use client';

/**
 * Create Goods Receipt Page
 *
 * Create a goods receipt from a Purchase Order for inspection
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, ItemCondition } from '@vapour/types';
import { listPOs, getPOItems } from '@/lib/procurement/purchaseOrderService';
import { createGoodsReceipt } from '@/lib/procurement/goodsReceiptService';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

interface InspectionItem {
  poItemId: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: string;
  condition: ItemCondition;
  conditionNotes: string;
  testingRequired: boolean;
  testingCompleted: boolean;
  testResult: 'PASS' | 'FAIL' | 'CONDITIONAL' | '';
  hasIssues: boolean;
  issues: string;
  equipmentId?: string;
  equipmentCode?: string;
}

export default function NewGoodsReceiptPage() {
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

  // Inspection Details
  const [inspectionType, setInspectionType] = useState<
    'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY'
  >('DELIVERY_SITE');
  const [inspectionLocation, setInspectionLocation] = useState('');
  const [inspectionDate, setInspectionDate] = useState(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    return dateStr ?? '';
  });
  const [overallNotes, setOverallNotes] = useState('');

  // Items to inspect
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);

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
      // Load POs that are issued or in progress (eligible for goods receipts)
      const pos = await listPOs({});
      const eligiblePOs = pos.filter((po) =>
        ['ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewGoodsReceiptPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback(async (po: PurchaseOrder | null) => {
    setSelectedPO(po);
    if (!po) {
      setInspectionItems([]);
      return;
    }

    try {
      const items = await getPOItems(po.id);

      // Initialize inspection items from PO items
      const inspectItems: InspectionItem[] = items.map((item) => {
        const pending = item.quantity - (item.quantityDelivered || 0);
        return {
          poItemId: item.id,
          description: item.description,
          orderedQuantity: item.quantity,
          receivedQuantity: pending,
          acceptedQuantity: pending,
          rejectedQuantity: 0,
          unit: item.unit,
          condition: 'GOOD' as ItemCondition,
          conditionNotes: '',
          testingRequired: false,
          testingCompleted: false,
          testResult: '',
          hasIssues: false,
          issues: '',
          equipmentId: item.equipmentId,
          equipmentCode: item.equipmentCode,
        };
      });

      setInspectionItems(inspectItems);
    } catch (err) {
      console.error('[NewGoodsReceiptPage] Error loading PO items:', err);
      setError('Failed to load PO items');
    }
  }, []);

  const handleItemChange = (
    index: number,
    field: keyof InspectionItem,
    value: string | number | boolean
  ) => {
    const updated = [...inspectionItems];
    const item = updated[index];
    if (item) {
      (item as unknown as Record<string, unknown>)[field] = value;

      // Auto-calculate accepted/rejected quantities
      if (field === 'receivedQuantity' || field === 'rejectedQuantity') {
        const received = field === 'receivedQuantity' ? (value as number) : item.receivedQuantity;
        const rejected = field === 'rejectedQuantity' ? (value as number) : item.rejectedQuantity;
        item.acceptedQuantity = Math.max(0, received - rejected);
      }

      // Auto-set hasIssues if rejected or condition is poor
      if (field === 'rejectedQuantity' || field === 'condition') {
        item.hasIssues =
          item.rejectedQuantity > 0 || ['DAMAGED', 'DEFECTIVE'].includes(item.condition);
      }
    }
    setInspectionItems(updated);
  };

  const handleCreateGR = async () => {
    if (!user || !selectedPO) return;

    // Validation
    if (!inspectionLocation.trim()) {
      setError('Inspection location is required');
      return;
    }

    if (inspectionItems.length === 0) {
      setError('No items to inspect');
      return;
    }

    // Validate quantities
    for (const item of inspectionItems) {
      if (item.acceptedQuantity + item.rejectedQuantity !== item.receivedQuantity) {
        setError(`Accepted + Rejected must equal Received for "${item.description}"`);
        return;
      }
    }

    setCreating(true);
    setError('');

    try {
      const grId = await createGoodsReceipt(
        {
          purchaseOrderId: selectedPO.id,
          projectId: selectedPO.projectIds?.[0] || '',
          projectName: selectedPO.projectNames?.[0] || '',
          inspectionType,
          inspectionLocation,
          inspectionDate: new Date(inspectionDate),
          overallNotes: overallNotes || undefined,
          items: inspectionItems.map((item) => ({
            poItemId: item.poItemId,
            receivedQuantity: item.receivedQuantity,
            acceptedQuantity: item.acceptedQuantity,
            rejectedQuantity: item.rejectedQuantity,
            condition: item.condition,
            conditionNotes: item.conditionNotes || undefined,
            testingRequired: item.testingRequired,
            testingCompleted: item.testingCompleted,
            testResult: item.testResult || undefined,
            hasIssues: item.hasIssues,
            issues: item.issues ? item.issues.split('\n').filter(Boolean) : undefined,
          })),
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/goods-receipts/${grId}`);
    } catch (err) {
      console.error('[NewGoodsReceiptPage] Error creating goods receipt:', err);
      setError('Failed to create goods receipt. Please try again.');
      setCreating(false);
    }
  };

  const getConditionColor = (condition: ItemCondition) => {
    switch (condition) {
      case 'GOOD':
        return 'success';
      case 'INCOMPLETE':
        return 'info';
      case 'DAMAGED':
        return 'warning';
      case 'DEFECTIVE':
        return 'error';
      default:
        return 'default';
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
        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/goods-receipts')}
            sx={{ mb: 1 }}
          >
            Back to Goods Receipts
          </Button>
          <Typography variant="h4" gutterBottom>
            Create Goods Receipt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Record inspection and receipt of goods from a Purchase Order
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
            {/* Inspection Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Inspection Details
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Inspection Type</InputLabel>
                    <Select
                      value={inspectionType}
                      onChange={(e) =>
                        setInspectionType(
                          e.target.value as 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY'
                        )
                      }
                      label="Inspection Type"
                    >
                      <MenuItem value="VENDOR_SITE">Vendor Site</MenuItem>
                      <MenuItem value="DELIVERY_SITE">Delivery Site</MenuItem>
                      <MenuItem value="THIRD_PARTY">Third Party</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Inspection Location"
                    value={inspectionLocation}
                    onChange={(e) => setInspectionLocation(e.target.value)}
                    fullWidth
                    required
                    placeholder="Enter inspection location..."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Inspection Date"
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Overall Notes"
                    value={overallNotes}
                    onChange={(e) => setOverallNotes(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="General observations about the inspection..."
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Items to Inspect */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Items Inspection
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Ordered</TableCell>
                      <TableCell align="right">Received</TableCell>
                      <TableCell align="right">Accepted</TableCell>
                      <TableCell align="right">Rejected</TableCell>
                      <TableCell>Condition</TableCell>
                      <TableCell>Testing</TableCell>
                      <TableCell>Issues</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inspectionItems.map((item, index) => (
                      <TableRow key={item.poItemId}>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.equipmentCode && (
                            <Typography variant="caption" color="text.secondary">
                              {item.equipmentCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {item.orderedQuantity} {item.unit}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.receivedQuantity}
                            onChange={(e) =>
                              handleItemChange(index, 'receivedQuantity', Number(e.target.value))
                            }
                            size="small"
                            sx={{ width: 80 }}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            color={
                              item.acceptedQuantity === item.receivedQuantity
                                ? 'success.main'
                                : 'warning.main'
                            }
                          >
                            {item.acceptedQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.rejectedQuantity}
                            onChange={(e) =>
                              handleItemChange(index, 'rejectedQuantity', Number(e.target.value))
                            }
                            size="small"
                            sx={{ width: 80 }}
                            inputProps={{ min: 0, max: item.receivedQuantity }}
                            error={item.rejectedQuantity > 0}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={item.condition}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'condition',
                                  e.target.value as ItemCondition
                                )
                              }
                            >
                              <MenuItem value="GOOD">Good</MenuItem>
                              <MenuItem value="INCOMPLETE">Incomplete</MenuItem>
                              <MenuItem value="DAMAGED">Damaged</MenuItem>
                              <MenuItem value="DEFECTIVE">Defective</MenuItem>
                            </Select>
                          </FormControl>
                          <Chip
                            label={item.condition}
                            color={getConditionColor(item.condition)}
                            size="small"
                            sx={{ ml: 1, display: { xs: 'none', md: 'inline-flex' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.testingRequired}
                                onChange={(e) =>
                                  handleItemChange(index, 'testingRequired', e.target.checked)
                                }
                                size="small"
                              />
                            }
                            label="Req"
                            sx={{ mr: 0 }}
                          />
                          {item.testingRequired && (
                            <FormControl size="small" sx={{ minWidth: 90, ml: 1 }}>
                              <Select
                                value={item.testResult}
                                onChange={(e) =>
                                  handleItemChange(index, 'testResult', e.target.value)
                                }
                                displayEmpty
                              >
                                <MenuItem value="">Pending</MenuItem>
                                <MenuItem value="PASS">Pass</MenuItem>
                                <MenuItem value="FAIL">Fail</MenuItem>
                                <MenuItem value="CONDITIONAL">Conditional</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.hasIssues}
                                onChange={(e) =>
                                  handleItemChange(index, 'hasIssues', e.target.checked)
                                }
                                size="small"
                              />
                            }
                            label=""
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Detailed item notes */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Item Notes & Issues
                </Typography>
                {inspectionItems.map((item, index) => (
                  <Box key={item.poItemId} sx={{ mb: 2 }}>
                    {(item.hasIssues || item.condition !== 'GOOD') && (
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <Typography variant="body2" sx={{ minWidth: 200, pt: 1 }}>
                          {item.description}:
                        </Typography>
                        <TextField
                          label="Condition Notes"
                          value={item.conditionNotes}
                          onChange={(e) =>
                            handleItemChange(index, 'conditionNotes', e.target.value)
                          }
                          size="small"
                          sx={{ flex: 1 }}
                          placeholder="Describe the condition..."
                        />
                        {item.hasIssues && (
                          <TextField
                            label="Issues (one per line)"
                            value={item.issues}
                            onChange={(e) => handleItemChange(index, 'issues', e.target.value)}
                            size="small"
                            multiline
                            rows={2}
                            sx={{ flex: 1 }}
                            placeholder="List issues..."
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                onClick={() => router.push('/procurement/goods-receipts')}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreateGR}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Goods Receipt'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
