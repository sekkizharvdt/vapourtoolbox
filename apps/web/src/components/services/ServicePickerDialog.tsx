'use client';

/**
 * Service Picker Dialog
 *
 * Allows users to search and select a service from the catalog
 * when adding service line items to a purchase request.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { createService } from '@/lib/services/crud';
import type { Service } from '@vapour/types';
import {
  ServiceCategory,
  ServiceCalculationMethod,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CALCULATION_METHOD_LABELS,
} from '@vapour/types';

interface ServicePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (service: Service) => void;
  /** Optional: pre-filter to a specific category */
  categoryFilter?: ServiceCategory;
  /**
   * Optional defaults for the inline "Create new service" form. The picker
   * pre-fills the create form with these values when the user clicks Create
   * — useful when opening the picker from a row that the AI parser has
   * already filled with a description / unit / price.
   */
  createDefaults?: {
    name?: string;
    unit?: string;
    defaultRateValue?: number;
    category?: ServiceCategory;
  };
}

export default function ServicePickerDialog({
  open,
  onClose,
  onSelect,
  categoryFilter,
  createDefaults,
}: ServicePickerDialogProps) {
  const { user, claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(categoryFilter ?? '');

  // Inline-create state — toggled when user clicks "Create new service".
  // Hides the search/list and shows a minimal create form instead so the
  // user doesn't lose their place in the picker. On save, the new service
  // is auto-selected back into whatever opened the picker.
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState<ServiceCategory>(ServiceCategory.CONSULTING);
  const [createMethod, setCreateMethod] = useState<ServiceCalculationMethod>(
    ServiceCalculationMethod.PER_UNIT
  );
  const [createUnit, setCreateUnit] = useState('LOT');
  const [createRate, setCreateRate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { db } = getFirebase();

  useEffect(() => {
    if (!open || !db) return;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const constraints: QueryConstraint[] = [where('isActive', '==', true)];

        if (category) {
          constraints.push(where('category', '==', category));
        }

        constraints.push(orderBy('name', 'asc'));

        const q = query(collection(db, COLLECTIONS.SERVICES), ...constraints);
        const snap = await getDocs(q);
        setServices(snap.docs.map((d) => docToTyped<Service>(d.id, d.data())));
      } catch (error) {
        console.error('Error loading services:', error);
        setServices([]);
        setLoadError(
          error instanceof Error
            ? `Failed to load services: ${error.message}`
            : 'Failed to load services.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, db, category]);

  // Reset search + create form when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      if (categoryFilter) setCategory(categoryFilter);
      setShowCreate(false);
      setCreateError(null);
      setCreating(false);
      // Pre-fill the create form from row context — saves the user from
      // re-typing what's already in the parsed line item.
      setCreateName(createDefaults?.name ?? '');
      setCreateUnit(createDefaults?.unit ?? 'LOT');
      setCreateRate(
        createDefaults?.defaultRateValue != null && Number.isFinite(createDefaults.defaultRateValue)
          ? String(createDefaults.defaultRateValue)
          : ''
      );
      setCreateCategory(createDefaults?.category ?? categoryFilter ?? ServiceCategory.CONSULTING);
      setCreateMethod(ServiceCalculationMethod.PER_UNIT);
    }
  }, [open, categoryFilter, createDefaults]);

  const handleCreate = async () => {
    if (!user?.uid || !db) {
      setCreateError('You must be signed in to create a service.');
      return;
    }
    if (!createName.trim()) {
      setCreateError('Service name is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const rateValue = createRate ? parseFloat(createRate) : undefined;
      const created = await createService(
        db,
        {
          serviceCode: '',
          name: createName.trim(),
          category: createCategory,
          calculationMethod: createMethod,
          ...(rateValue != null && Number.isFinite(rateValue) && { defaultRateValue: rateValue }),
          ...(createUnit.trim() && { unit: createUnit.trim() }),
          tenantId,
          isActive: true,
          isStandard: false,
        },
        user.uid
      );
      onSelect(created);
      onClose();
    } catch (err) {
      console.error('[ServicePickerDialog] createService failed', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create service.');
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const term = search.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.serviceCode.toLowerCase().includes(term) ||
        (s.description ?? '').toLowerCase().includes(term)
    );
  }, [services, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {showCreate ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" onClick={() => setShowCreate(false)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <span>Create New Service</span>
          </Stack>
        ) : (
          <span>Select Service</span>
        )}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {showCreate ? (
          /* Inline create form — minimum required fields. Extended editing
             happens on the full Services page after creation. */
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="Service Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              fullWidth
              required
              autoFocus
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={createCategory}
                  label="Category"
                  onChange={(e) => setCreateCategory(e.target.value as ServiceCategory)}
                >
                  {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" required>
                <InputLabel>Calculation Method</InputLabel>
                <Select
                  value={createMethod}
                  label="Calculation Method"
                  onChange={(e) => setCreateMethod(e.target.value as ServiceCalculationMethod)}
                >
                  {Object.entries(SERVICE_CALCULATION_METHOD_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Unit"
                value={createUnit}
                onChange={(e) => setCreateUnit(e.target.value.toUpperCase())}
                fullWidth
                size="small"
                helperText="e.g. LOT, NOS, PER TEST, PER DAY"
              />
              <TextField
                label="Default Rate"
                value={createRate}
                onChange={(e) => setCreateRate(e.target.value)}
                fullWidth
                size="small"
                inputMode="decimal"
                helperText="Optional — used as a starting point in future quotes"
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              You can edit additional details (description, accreditations, deliverables, etc.) from
              the full Services page later.
            </Typography>
          </Stack>
        ) : (
          <>
            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                autoFocus
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowCreate(true)}
              >
                Create New
              </Button>
            </Box>

            {/* Results */}
            {loadError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loadError}
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {loadError
                  ? '—'
                  : search
                    ? 'No services match your search'
                    : 'No services in this category'}
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Turnaround</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((service) => (
                      <TableRow
                        key={service.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          onSelect(service);
                          onClose();
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                            {service.serviceCode}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {service.name}
                          </Typography>
                          {service.description && (
                            <Typography variant="caption" color="text.secondary">
                              {service.description.length > 60
                                ? service.description.substring(0, 60) + '...'
                                : service.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={SERVICE_CATEGORY_LABELS[service.category]}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{service.unit ?? '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {service.estimatedTurnaroundDays
                              ? `${service.estimatedTurnaroundDays}d`
                              : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
      {showCreate && (
        <DialogActions>
          <Button onClick={() => setShowCreate(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create & Use'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
