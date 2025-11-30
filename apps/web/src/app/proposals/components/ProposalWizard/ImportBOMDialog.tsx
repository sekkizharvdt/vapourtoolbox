'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  CircularProgress,
  TextField,
  Box,
  Chip,
  Stack,
  Divider,
  Paper,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs, getBOMById } from '@/lib/bom/bomService';
import type { BOM } from '@vapour/types';

export interface ImportBOMResult {
  bomId: string;
  bom: BOM;
  includeCostConfig: boolean;
}

interface ImportBOMDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: ImportBOMResult) => void;
}

export function ImportBOMDialog({ open, onClose, onSelect }: ImportBOMDialogProps) {
  const db = useFirestore();
  const { claims } = useAuth();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [includeCostConfig, setIncludeCostConfig] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (open && db && claims?.entityId) {
      const fetchBOMs = async () => {
        setLoading(true);
        try {
          const data = await listBOMs(db, {
            entityId: claims.entityId || '',
            limit: 50,
          });
          setBoms(data);
        } catch (error) {
          console.error('Error fetching BOMs:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchBOMs();
    }
  }, [open, db, claims]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBom(null);
      setIncludeCostConfig(true);
      setSearchTerm('');
    }
  }, [open]);

  const filteredBoms = boms.filter(
    (bom) =>
      bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bom.bomCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectBom = async (bom: BOM) => {
    if (!db) return;
    setLoadingDetails(true);
    try {
      // Fetch full BOM details to get latest summary
      const fullBom = await getBOMById(db, bom.id);
      if (fullBom) {
        setSelectedBom(fullBom);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      setSelectedBom(bom); // Use the list version as fallback
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirmImport = () => {
    if (!selectedBom) return;
    onSelect({
      bomId: selectedBom.id,
      bom: selectedBom,
      includeCostConfig,
    });
    onClose();
  };

  const formatCurrency = (amount: number | undefined, currency: string = 'INR') => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasCostConfig =
    selectedBom?.summary &&
    ((selectedBom.summary.overhead?.amount || 0) > 0 ||
      (selectedBom.summary.contingency?.amount || 0) > 0 ||
      (selectedBom.summary.profit?.amount || 0) > 0);

  // BOM Details view
  if (selectedBom) {
    const summary = selectedBom.summary;
    const currency = summary?.currency || 'INR';

    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              startIcon={<BackIcon />}
              onClick={() => setSelectedBom(null)}
              size="small"
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Typography variant="h6" component="span">
              Import BOM
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* BOM Info */}
            <Box>
              <Typography variant="subtitle1" fontWeight="medium">
                {selectedBom.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Chip label={selectedBom.bomCode} size="small" variant="outlined" />
                <Chip
                  label={selectedBom.status}
                  size="small"
                  color={selectedBom.status === 'APPROVED' ? 'success' : 'default'}
                />
              </Stack>
              {selectedBom.projectName && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Project: {selectedBom.projectName}
                </Typography>
              )}
            </Box>

            <Divider />

            {/* Cost Summary */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Cost Summary
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Items
                  </Typography>
                  <Typography variant="body2">{summary?.itemCount || 0}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Material Cost
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(summary?.totalMaterialCost?.amount, currency)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Fabrication Cost
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(summary?.totalFabricationCost?.amount, currency)}
                  </Typography>
                </Stack>
                {(summary?.totalServiceCost?.amount || 0) > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Service Cost
                    </Typography>
                    <Typography variant="body2">
                      {formatCurrency(summary?.totalServiceCost?.amount, currency)}
                    </Typography>
                  </Stack>
                )}
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight="medium">
                    Direct Cost
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(summary?.totalDirectCost?.amount, currency)}
                  </Typography>
                </Stack>

                {hasCostConfig && (
                  <>
                    {(summary?.overhead?.amount || 0) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Overhead
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(summary?.overhead?.amount, currency)}
                        </Typography>
                      </Stack>
                    )}
                    {(summary?.contingency?.amount || 0) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Contingency
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(summary?.contingency?.amount, currency)}
                        </Typography>
                      </Stack>
                    )}
                    {(summary?.profit?.amount || 0) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Profit
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(summary?.profit?.amount, currency)}
                        </Typography>
                      </Stack>
                    )}
                  </>
                )}

                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2">Total Cost</Typography>
                  <Typography variant="subtitle2" color="primary.main">
                    {formatCurrency(summary?.totalCost?.amount, currency)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            {/* Import Options */}
            {hasCostConfig && (
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeCostConfig}
                      onChange={(e) => setIncludeCostConfig(e.target.checked)}
                    />
                  }
                  label={
                    <Stack>
                      <Typography variant="body2">
                        Include overhead, contingency & profit configuration
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        These values will be pre-filled in the Pricing step
                      </Typography>
                    </Stack>
                  }
                />
              </Box>
            )}

            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              This will import all {summary?.itemCount || 0} items from the BOM into your Scope of
              Supply.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmImport}>
            Import BOM
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // BOM List view
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import from Bill of Materials</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <TextField
            fullWidth
            placeholder="Search BOMs by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
          />
        </Box>

        {loading || loadingDetails ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : filteredBoms.length === 0 ? (
          <Typography color="text.secondary" align="center" py={4}>
            No BOMs found.
          </Typography>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredBoms.map((bom) => (
              <ListItem key={bom.id} disablePadding divider>
                <ListItemButton onClick={() => handleSelectBom(bom)}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">{bom.name}</Typography>
                        <Chip label={bom.bomCode} size="small" variant="outlined" />
                        <Chip
                          label={bom.status}
                          size="small"
                          color={bom.status === 'APPROVED' ? 'success' : 'default'}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          Project: {bom.projectName || 'N/A'}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Items: {bom.summary?.itemCount || 0} | Total Cost:{' '}
                          {bom.summary?.totalCost?.amount?.toLocaleString()} {bom.summary?.currency}
                        </Typography>
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
