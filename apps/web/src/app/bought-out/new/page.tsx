'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  BoughtOutCategory,
  BOUGHT_OUT_CATEGORY_LABELS,
  CreateBoughtOutItemInput,
  CurrencyCode,
  ValveSpecs,
  PumpSpecs,
  InstrumentSpecs,
} from '@vapour/types';
import { createBoughtOutItem } from '@/lib/boughtOut/boughtOutService';
import {
  buildValveSpecCode,
  buildPumpSpecCode,
  checkInstrumentSpecComplete,
  findBoughtOutBySpecCode,
} from '@/lib/boughtOut/specCode';
import SpecificationForm from '../components/SpecificationForm';

export default function NewBoughtOutItemPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BoughtOutCategory>('VALVE');

  // Specifications State
  const [specs, setSpecs] = useState<Record<string, unknown>>({});

  // Pricing
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [leadTime, setLeadTime] = useState('');
  const [moq, setMoq] = useState('');

  // Single-tenant: default-entity (must match tenantId claim for Firestore rules)
  const tenantId = claims?.tenantId || 'default-entity';

  // Live spec-code preview. As the user fills in valve / pump / instrument
  // attributes, this shows the deterministic code we'll write — and tells
  // them exactly which fields are still missing. Same code that the AI
  // quote parser uses for matching, so manual entries deduplicate against
  // future parsed quotes (and vice versa).
  const specCodePreview = useMemo<{ code: string | null; reason?: string }>(() => {
    if (category === 'VALVE') {
      const r = buildValveSpecCode(specs as ValveSpecs);
      return r.ok ? { code: r.code } : { code: null, reason: r.reason };
    }
    if (category === 'PUMP') {
      const r = buildPumpSpecCode(specs as PumpSpecs);
      return r.ok ? { code: r.code } : { code: null, reason: r.reason };
    }
    if (category === 'INSTRUMENT') {
      const r = checkInstrumentSpecComplete(specs as InstrumentSpecs);
      return r.ok ? { code: r.code } : { code: null, reason: r.reason };
    }
    return { code: null };
  }, [category, specs]);

  // Duplicate-check: when the spec is complete enough to produce a code,
  // poll Firestore to see if another item already has it. Doesn't block
  // typing — surfaces a banner the user can act on (open existing or
  // continue creating intentionally).
  const [duplicate, setDuplicate] = useState<{
    id: string;
    itemCode?: string;
    name?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const code = specCodePreview.code;
    if (!code || code.endsWith('-XXXX')) {
      setDuplicate(null);
      return;
    }
    findBoughtOutBySpecCode(db, code)
      .then((existing) => {
        if (!cancelled) setDuplicate(existing);
      })
      .catch(() => {
        // Best-effort; swallow lookup errors so the form stays usable.
      });
    return () => {
      cancelled = true;
    };
  }, [db, specCodePreview.code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setError(null);

      const input: CreateBoughtOutItemInput = {
        tenantId,
        name,
        description,
        category,
        specifications: specs, // Pass dynamic specs
        pricing: {
          listPrice: {
            amount: parseFloat(price) || 0,
            currency: currency as CurrencyCode,
          },
          currency: currency as CurrencyCode,
          leadTime: leadTime ? parseInt(leadTime) : undefined,
          moq: moq ? parseInt(moq) : undefined,
        },
      };

      await createBoughtOutItem(db, input, user.uid);
      router.push('/bought-out');
    } catch (err) {
      console.error('Error creating item:', err);
      setError('Failed to create item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: 'Bought Out', href: '/bought-out', icon: <HomeIcon fontSize="small" /> },
          { label: 'New Item' },
        ]}
      />

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} variant="outlined">
          Back
        </Button>
        <Typography variant="h4" component="h1">
          New Bought-Out Item
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      required
                      label="Item Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Gate Valve 2 inch Class 150"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      fullWidth
                      required
                      label="Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as BoughtOutCategory)}
                    >
                      {Object.entries(BOUGHT_OUT_CATEGORY_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Specifications
                </Typography>
                <SpecificationForm category={category} specs={specs} onChange={setSpecs} />

                {/* Live spec-code preview. Helps users understand the matching
                    system: same spec → same code → AI parser will link to this
                    record on subsequent quotes (no duplicates). */}
                {(category === 'VALVE' || category === 'PUMP' || category === 'INSTRUMENT') && (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <AutoAwesomeIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle2">Spec code</Typography>
                    </Stack>
                    {specCodePreview.code ? (
                      <Chip
                        label={specCodePreview.code}
                        color="primary"
                        variant="outlined"
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {specCodePreview.reason ??
                          'Fill in the spec fields above to see the auto-generated code.'}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      The AI quote parser uses this code to match equipment against the master.
                      Future quotes for the same spec will link to this record automatically.
                    </Typography>
                  </Box>
                )}

                {/* Duplicate-check banner. Surfaces an existing item with the
                    same spec code BEFORE the user creates a duplicate. */}
                {duplicate && (
                  <Alert
                    severity="warning"
                    sx={{ mt: 2 }}
                    action={
                      <Button
                        size="small"
                        onClick={() => router.push(`/bought-out/${duplicate.id}`)}
                      >
                        Open existing
                      </Button>
                    }
                  >
                    <strong>An item with this spec already exists.</strong>{' '}
                    {duplicate.name ?? duplicate.itemCode ?? 'Existing record'}. You can open it, or
                    continue creating a new one if this is genuinely different.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Pricing & Meta */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pricing
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="List Price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      select
                      fullWidth
                      label="Currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <MenuItem value="INR">INR (₹)</MenuItem>
                      <MenuItem value="USD">USD ($)</MenuItem>
                      <MenuItem value="EUR">EUR (€)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Lead Time (Days)"
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Minimum Order Qty"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Item'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </>
  );
}
