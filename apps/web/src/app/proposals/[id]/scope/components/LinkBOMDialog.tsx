'use client';

/**
 * Link BOM Dialog Component
 *
 * Dialog to search and link existing BOMs to a scope item, or create a new BOM.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs } from '@/lib/bom/bomService';
import { createLogger } from '@vapour/logger';
import type { BOM, ScopeItem, LinkedBOM } from '@vapour/types';
import { BOM_CATEGORY_LABELS } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

const logger = createLogger({ context: 'LinkBOMDialog' });

interface LinkBOMDialogProps {
  open: boolean;
  onClose: () => void;
  scopeItem: ScopeItem;
  proposalId: string;
  proposalNumber: string;
  enquiryId?: string;
  enquiryNumber?: string;
  onLink: (linkedBOMs: LinkedBOM[]) => void;
  existingLinkedBOMIds?: string[];
}

export function LinkBOMDialog({
  open,
  onClose,
  scopeItem,
  proposalId,
  proposalNumber,
  enquiryId,
  enquiryNumber,
  onLink,
  existingLinkedBOMIds = [],
}: LinkBOMDialogProps) {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  const [searchTerm, setSearchTerm] = useState('');
  const [boms, setBOMs] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBOMIds, setSelectedBOMIds] = useState<string[]>([]);

  const entityId = claims?.entityId || 'default-entity';

  // Load BOMs when dialog opens
  const loadBOMs = useCallback(async () => {
    if (!db || !user) return;

    try {
      setLoading(true);
      setError(null);

      const bomList = await listBOMs(db, {
        entityId,
        limit: 100,
      });

      // Filter out already linked BOMs
      const filteredBOMs = bomList.filter(
        (bom) => !existingLinkedBOMIds.includes(bom.id)
      );

      setBOMs(filteredBOMs);
      logger.info('BOMs loaded for linking', { count: filteredBOMs.length });
    } catch (err) {
      logger.error('Error loading BOMs', { error: err });
      setError('Failed to load BOMs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [db, user, entityId, existingLinkedBOMIds]);

  useEffect(() => {
    if (open) {
      loadBOMs();
      setSelectedBOMIds([]);
      setSearchTerm('');
    }
  }, [open, loadBOMs]);

  // Filter BOMs by search term
  const filteredBOMs = boms.filter((bom) => {
    const term = searchTerm.toLowerCase();
    return (
      bom.name.toLowerCase().includes(term) ||
      bom.bomCode.toLowerCase().includes(term) ||
      (bom.description?.toLowerCase().includes(term) ?? false) ||
      BOM_CATEGORY_LABELS[bom.category]?.toLowerCase().includes(term)
    );
  });

  const handleToggleBOM = (bomId: string) => {
    setSelectedBOMIds((prev) =>
      prev.includes(bomId)
        ? prev.filter((id) => id !== bomId)
        : [...prev, bomId]
    );
  };

  const handleLink = () => {
    if (!user) return;

    const selectedBOMs = boms.filter((bom) => selectedBOMIds.includes(bom.id));
    const linkedBOMs: LinkedBOM[] = selectedBOMs.map((bom) => ({
      bomId: bom.id,
      bomCode: bom.bomCode,
      bomName: bom.name,
      category: BOM_CATEGORY_LABELS[bom.category],
      totalCost: bom.summary.totalCost,
      linkedAt: Timestamp.now(),
      linkedBy: user.uid,
    }));

    onLink(linkedBOMs);
    onClose();
  };

  const handleCreateNewBOM = () => {
    // Build query params for new BOM page
    const params = new URLSearchParams();
    params.set('proposalId', proposalId);
    params.set('proposalNumber', proposalNumber);
    if (enquiryId) params.set('enquiryId', enquiryId);
    if (enquiryNumber) params.set('enquiryNumber', enquiryNumber);
    params.set('scopeItemId', scopeItem.id);
    params.set('scopeItemName', scopeItem.name);

    router.push(`/estimation/new?${params.toString()}`);
    onClose();
  };

  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Link BOM to Scope Item
        <Typography variant="body2" color="text.secondary">
          {scopeItem.itemNumber} - {scopeItem.name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Search Box */}
        <TextField
          fullWidth
          placeholder="Search BOMs by name, code, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Create New BOM Button */}
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            endIcon={<OpenInNewIcon fontSize="small" />}
            onClick={handleCreateNewBOM}
            fullWidth
          >
            Create New BOM for this Scope Item
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* BOM List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredBOMs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {searchTerm
                ? 'No BOMs match your search.'
                : 'No BOMs available for linking.'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Create a new BOM using the button above.
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredBOMs.map((bom) => (
              <ListItem key={bom.id} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => handleToggleBOM(bom.id)}
                  selected={selectedBOMIds.includes(bom.id)}
                  sx={{
                    border: '1px solid',
                    borderColor: selectedBOMIds.includes(bom.id)
                      ? 'primary.main'
                      : 'divider',
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'primary.50',
                      '&:hover': {
                        bgcolor: 'primary.100',
                      },
                    },
                  }}
                >
                  <Checkbox
                    checked={selectedBOMIds.includes(bom.id)}
                    tabIndex={-1}
                    disableRipple
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {bom.bomCode}
                        </Typography>
                        <Typography variant="body2">{bom.name}</Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={BOM_CATEGORY_LABELS[bom.category]}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {bom.summary.itemCount} items
                        </Typography>
                        {bom.projectName && (
                          <Typography variant="caption" color="text.secondary">
                            • {bom.projectName}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Typography variant="body2" fontWeight="medium" color="primary">
                      {formatCurrency(bom.summary.totalCost)}
                    </Typography>
                  </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* Selection Summary */}
        {selectedBOMIds.length > 0 && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2">
              {selectedBOMIds.length} BOM{selectedBOMIds.length > 1 ? 's' : ''} selected
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              Total:{' '}
              {formatCurrency({
                amount: boms
                  .filter((bom) => selectedBOMIds.includes(bom.id))
                  .reduce((sum, bom) => sum + bom.summary.totalCost.amount, 0),
                currency: 'INR',
              })}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleLink}
          disabled={selectedBOMIds.length === 0}
        >
          Link {selectedBOMIds.length > 0 ? `(${selectedBOMIds.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
