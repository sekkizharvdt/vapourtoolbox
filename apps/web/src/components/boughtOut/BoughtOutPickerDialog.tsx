'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import {
  type BoughtOutItem,
  type BoughtOutCategory,
  BOUGHT_OUT_CATEGORY_LABELS,
} from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { listBoughtOutItems } from '@/lib/boughtOut/boughtOutService';
import { getFriendlyQueryError } from '@/lib/utils/errorHandling';

interface BoughtOutPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: BoughtOutItem) => void;
  tenantId: string;
  /** Optional category filter — narrows the list when the row already has a category hint. */
  category?: BoughtOutCategory;
  title?: string;
}

/**
 * Bought-out item picker. Used by quote/offer forms to link a line item to
 * a master bought-out record. Mirrors the shape of MaterialPickerDialog but
 * skipping family/variant drilldown — bought-out items are flat.
 */
export default function BoughtOutPickerDialog({
  open,
  onClose,
  onSelect,
  tenantId,
  category,
  title = 'Select Bought-Out Item',
}: BoughtOutPickerDialogProps) {
  const { db } = getFirebase();

  const [items, setItems] = useState<BoughtOutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BoughtOutCategory | 'ALL'>(
    category ?? 'ALL'
  );

  // Reset state on open and re-apply external category hint.
  useEffect(() => {
    if (open) {
      setSearchText('');
      setError(null);
      setCategoryFilter(category ?? 'ALL');
    }
  }, [open, category]);

  // Load items when the dialog opens or filters change.
  useEffect(() => {
    if (!open || !db) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await listBoughtOutItems(db, {
          tenantId,
          isActive: true,
          ...(categoryFilter !== 'ALL' ? { category: categoryFilter } : {}),
          limit: 500,
        });
        if (!cancelled) setItems(list);
      } catch (err) {
        // Never surface the raw Firestore error (it leaks the index-creation
        // URL and internal codes). Log it for devs, show a friendly message.
        console.error('[BoughtOutPickerDialog] failed to load items', err);
        if (!cancelled) {
          setItems([]);
          setError(getFriendlyQueryError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, db, tenantId, categoryFilter]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.itemCode,
        item.specCode,
        item.name,
        item.description,
        item.specifications?.manufacturer,
        item.specifications?.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchText]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by code, name, manufacturer, model..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value as BoughtOutCategory | 'ALL')}
            >
              <MenuItem value="ALL">All Categories</MenuItem>
              {Object.entries(BOUGHT_OUT_CATEGORY_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? null : filteredItems.length === 0 ? (
          <Alert severity="info">
            {searchText
              ? 'No bought-out items match your search.'
              : 'No bought-out items in the master. Add one from the Bought-Out page first.'}
          </Alert>
        ) : (
          <List sx={{ maxHeight: 480, overflow: 'auto' }}>
            {filteredItems.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight="medium">
                          {item.itemCode}
                        </Typography>
                        {item.specCode && (
                          <Chip
                            label={item.specCode}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                        <Chip
                          label={BOUGHT_OUT_CATEGORY_LABELS[item.category] ?? item.category}
                          size="small"
                          variant="outlined"
                        />
                        {item.needsReview && (
                          <Chip label="Needs review" size="small" color="warning" />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2">{item.name}</Typography>
                        {(item.specifications?.manufacturer || item.specifications?.model) && (
                          <Typography variant="caption" color="text.secondary">
                            {[item.specifications?.manufacturer, item.specifications?.model]
                              .filter(Boolean)
                              .join(' — ')}
                          </Typography>
                        )}
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
