'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
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
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  type BoughtOutItem,
  type BoughtOutCategory,
  type CreateBoughtOutItemInput,
  type CurrencyCode,
  BOUGHT_OUT_CATEGORY_LABELS,
  getCatalogCategoryOptions,
} from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { listBoughtOutItems, createBoughtOutItem } from '@/lib/boughtOut/boughtOutService';
import { getFriendlyQueryError } from '@/lib/utils/errorHandling';
import { rankByNameSimilarity } from '@/lib/catalog/similarity';

interface BoughtOutPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: BoughtOutItem) => void;
  tenantId: string;
  /** Optional category filter — narrows the list when the row already has a category hint. */
  category?: BoughtOutCategory;
  title?: string;
  /**
   * Optional content rendered between the title and the dialog body —
   * used by CatalogPickerDialog to inject the catalog-kind tabs.
   */
  headerSlot?: ReactNode;
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
  headerSlot,
}: BoughtOutPickerDialogProps) {
  const { db } = getFirebase();
  const { user } = useAuth();

  const [items, setItems] = useState<BoughtOutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BoughtOutCategory | 'ALL'>(
    category ?? 'ALL'
  );

  // Inline-create state — toggled by "Create New". Mirrors MaterialPickerDialog
  // so both pickers behave the same. Detailed specs are added later from the
  // Bought-Out page; here we capture the minimum to get the item into the catalog.
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState<BoughtOutCategory>('OTHER');
  const [createManufacturer, setCreateManufacturer] = useState('');
  const [createModel, setCreateModel] = useState('');
  const [createSpec, setCreateSpec] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createCurrency, setCreateCurrency] = useState<CurrencyCode>('INR');
  // Possible-duplicate candidates surfaced before creating (5C — "always ask").
  // Non-null means the confirm panel is showing; the user picks one or proceeds.
  const [dupCandidates, setDupCandidates] = useState<BoughtOutItem[] | null>(null);

  // Reset state on open and re-apply external category hint.
  useEffect(() => {
    if (open) {
      setSearchText('');
      setError(null);
      setShowCreate(false);
      setCreateError(null);
      setCreateName('');
      setCreateCategory(category ?? 'OTHER');
      setCreateManufacturer('');
      setCreateModel('');
      setCreateSpec('');
      setCreatePrice('');
      setCreateCurrency('INR');
      setDupCandidates(null);
      setCategoryFilter(category ?? 'ALL');
    }
  }, [open, category]);

  const handleCreate = async (force = false) => {
    if (!user?.uid) {
      setCreateError('You must be signed in to create a bought-out item.');
      return;
    }
    if (!createName.trim()) {
      setCreateError('Name is required.');
      return;
    }
    // Duplicate gate: unless the user already chose "create anyway", look for
    // existing same-category items with a similar name and ask first.
    if (!force) {
      const similar = rankByNameSimilarity(
        items.filter((i) => i.category === createCategory),
        (i) => i.name,
        createName.trim()
      ).map((c) => c.item);
      if (similar.length > 0) {
        setDupCandidates(similar);
        return;
      }
    }
    setCreating(true);
    setCreateError(null);
    try {
      const input: CreateBoughtOutItemInput = {
        tenantId,
        name: createName.trim(),
        category: createCategory,
        // Minimal spec — manufacturer/model/free-text; the deterministic spec
        // code is only built when structured fields exist, so this stays
        // un-deduped until refined on the Bought-Out page (acceptable).
        specifications: {
          ...(createManufacturer.trim() && { manufacturer: createManufacturer.trim() }),
          ...(createModel.trim() && { model: createModel.trim() }),
          ...(createSpec.trim() && { specification: createSpec.trim() }),
        },
        pricing: {
          listPrice: { amount: parseFloat(createPrice) || 0, currency: createCurrency },
          currency: createCurrency,
        },
        ...(createSpec.trim() && { description: createSpec.trim() }),
        // Quick mid-quote create captures minimal spec — flag for later refinement
        // on the Bought-Out page (surfaces in the needs-review queue). 5D.
        needsReview: true,
      };
      const created = await createBoughtOutItem(db, input, user.uid);
      onSelect(created);
      onClose();
    } catch (err) {
      console.error('[BoughtOutPickerDialog] createBoughtOutItem failed', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create bought-out item.');
    } finally {
      setCreating(false);
    }
  };

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
      <DialogTitle>
        {showCreate ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" onClick={() => setShowCreate(false)} disabled={creating}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" component="span">
              Create New Bought-Out Item
            </Typography>
          </Stack>
        ) : (
          title
        )}
      </DialogTitle>
      {headerSlot}
      <DialogContent>
        {showCreate && dupCandidates ? (
          /* Possible-duplicate gate (5C) — surfaced before creating. */
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {dupCandidates.length === 1
                ? 'A similar item already exists. Use it instead of creating a duplicate?'
                : `${dupCandidates.length} similar items already exist. Use one instead of creating a duplicate?`}
            </Alert>
            <List sx={{ maxHeight: 360, overflow: 'auto' }}>
              {dupCandidates.map((item) => (
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
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                        >
                          <Typography variant="body2" fontWeight="medium">
                            {item.itemCode}
                          </Typography>
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
                      secondary={item.name}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Stack>
        ) : showCreate ? (
          /* Inline create — minimum fields; refine specs later on the Bought-Out page. */
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              fullWidth
              required
              autoFocus
              size="small"
              helperText="General item name, e.g. Centrifugal Pump, Motorized Control Valve"
            />
            <FormControl fullWidth size="small" required>
              <InputLabel>Category</InputLabel>
              <Select
                value={createCategory}
                label="Category"
                onChange={(e) => setCreateCategory(e.target.value as BoughtOutCategory)}
              >
                {getCatalogCategoryOptions('BOUGHT_OUT').map(({ value, label }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Manufacturer (optional)"
                value={createManufacturer}
                onChange={(e) => setCreateManufacturer(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Model (optional)"
                value={createModel}
                onChange={(e) => setCreateModel(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="List Price (optional)"
                type="number"
                value={createPrice}
                onChange={(e) => setCreatePrice(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: '0.01' }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={createCurrency}
                  label="Currency"
                  onChange={(e) => setCreateCurrency(e.target.value as CurrencyCode)}
                >
                  {(['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'] as CurrencyCode[]).map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Specification (optional)"
              value={createSpec}
              onChange={(e) => setCreateSpec(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              helperText="Technical details — you can refine these from the Bought-Out page later."
            />
          </Stack>
        ) : (
          <>
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
                  {/* Category filter reads the unified taxonomy registry (design §3.4). */}
                  {getCatalogCategoryOptions('BOUGHT_OUT').map(({ value, label }) => (
                    <MenuItem key={value} value={value}>
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
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Typography variant="body2" fontWeight="medium">
                              {item.itemCode}
                            </Typography>
                            {/* specCode is an internal match key — not shown (5A). */}
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
          </>
        )}
      </DialogContent>
      <DialogActions>
        {showCreate && dupCandidates ? (
          <>
            <Button onClick={() => setDupCandidates(null)} disabled={creating}>
              Back to edit
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                setDupCandidates(null);
                void handleCreate(true);
              }}
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Create new anyway'}
            </Button>
          </>
        ) : showCreate ? (
          <>
            <Button onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => handleCreate()} disabled={creating}>
              {creating ? 'Creating…' : 'Create & Use'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setShowCreate(true)}>
              Create New
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
