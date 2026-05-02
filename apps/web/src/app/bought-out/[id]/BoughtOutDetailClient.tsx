'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import type { VendorQuote, VendorQuoteItem, BoughtOutPrice } from '@vapour/types';
import { getQuoteRowsByBoughtOutItemId } from '@/lib/vendorQuotes/vendorQuoteService';
import { getBoughtOutPriceHistory } from '@/lib/boughtOut/pricing';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Home as HomeIcon,
  Save as SaveIcon,
  RateReview as RateReviewIcon,
  CheckCircle as AcceptedIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  BoughtOutItem,
  BoughtOutCategory,
  BOUGHT_OUT_CATEGORY_LABELS,
  UpdateBoughtOutItemInput,
  CurrencyCode,
} from '@vapour/types';
import { getBoughtOutItemById, updateBoughtOutItem } from '@/lib/boughtOut/boughtOutService';
import SpecificationForm from '../components/SpecificationForm';
import { formatDate } from '@/lib/utils/formatters';

export default function BoughtOutItemDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [item, setItem] = useState<BoughtOutItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BoughtOutCategory>('VALVE');

  // ... (inside component)

  // Specifications State - Dynamic based on category
  // Using a flexible state object to hold all potential fields
  const [specs, setSpecs] = useState<Record<string, unknown>>({});

  // Pricing
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [leadTime, setLeadTime] = useState('');
  const [moq, setMoq] = useState('');

  // Recent quotes — every line item across vendor quotes that links to this
  // bought-out record. Mirrors the material/service detail pages so the
  // catalog page surfaces the price points feeding back into the master.
  const [quoteRows, setQuoteRows] = useState<Array<{ item: VendorQuoteItem; quote: VendorQuote }>>(
    []
  );
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Price history — distinct from the quote rows above: this is the
  // accepted-only timeline (each entry was promoted to the catalog) rather
  // than every received price. Lets the catalog show how this part's
  // canonical price has moved over time.
  const [priceHistory, setPriceHistory] = useState<BoughtOutPrice[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);

  // Extract ID from pathname for static export compatibility
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/bought-out\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setId(extractedId);
      }
    }
  }, [pathname]);

  const loadItem = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const fetchedItem = await getBoughtOutItemById(db, id);

      if (!fetchedItem) {
        setError('Item not found');
        return;
      }

      setItem(fetchedItem);

      // Populate form
      setName(fetchedItem.name);
      setDescription(fetchedItem.description || '');
      setCategory(fetchedItem.category);

      // Load specs into state
      setSpecs((fetchedItem.specifications as unknown as Record<string, unknown>) || {});

      setPrice(fetchedItem.pricing.listPrice.amount.toString());
      setCurrency(fetchedItem.pricing.currency);
      setLeadTime(fetchedItem.pricing.leadTime?.toString() || '');
      setMoq(fetchedItem.pricing.moq?.toString() || '');
    } catch (err) {
      console.error('Error loading item:', err);
      setError('Failed to load item details');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setQuotesLoading(true);
    setPriceHistoryLoading(true);
    Promise.all([
      getQuoteRowsByBoughtOutItemId(db, id).then((rows) => {
        if (!cancelled) setQuoteRows(rows);
      }),
      getBoughtOutPriceHistory(db, id, { limitResults: 25 }).then((rows) => {
        if (!cancelled) setPriceHistory(rows);
      }),
    ])
      .catch((err) => {
        console.warn('[BoughtOutDetail] Failed to load quotes/prices', err);
      })
      .finally(() => {
        if (!cancelled) {
          setQuotesLoading(false);
          setPriceHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const input: UpdateBoughtOutItemInput = {
        name,
        description,
        category,
        specifications: specs, // Pass the dynamic specs object
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

      await updateBoughtOutItem(db, id, input, user.uid);
      setSuccess('Item updated successfully');

      // Reload item to get updated timestamps
      loadItem();
    } catch (err) {
      console.error('Error updating item:', err);
      setError('Failed to update item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !id) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!item) {
    return (
      <Box>
        <Alert severity="error">Item not found</Alert>
        <Button sx={{ mt: 2 }} onClick={() => router.push('/bought-out')}>
          Back to List
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
      <PageBreadcrumbs
        items={[
          { label: 'Bought Out Items', href: '/bought-out', icon: <HomeIcon fontSize="small" /> },
          { label: item.itemCode },
        ]}
      />
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1">
            {item.itemCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created on {formatDate(item.createdAt)}
          </Typography>
        </Box>
        <Chip
          label={item.isActive ? 'Active' : 'Inactive'}
          color={item.isActive ? 'success' : 'default'}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Review banner — shown when the AI quote parser auto-created this
          item. Reviewer verifies the extracted spec, then clicks "Mark as
          reviewed" to clear the flag and remove it from the review queue. */}
      {item.needsReview && (
        <Alert
          severity="warning"
          icon={<RateReviewIcon />}
          sx={{ mb: 3 }}
          action={
            <Button
              size="small"
              variant="contained"
              color="warning"
              disabled={saving || !user || !id}
              onClick={async () => {
                if (!user || !id) return;
                try {
                  setSaving(true);
                  setError(null);
                  await updateBoughtOutItem(db, id, { needsReview: false }, user.uid);
                  setSuccess('Marked as reviewed');
                  loadItem();
                } catch (err) {
                  console.error('Error clearing review flag:', err);
                  setError('Failed to mark as reviewed');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Mark as reviewed
            </Button>
          }
        >
          This item was auto-created by the AI quote parser. Verify the extracted spec, save any
          corrections, then mark it as reviewed.
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
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Last updated: {formatDate(item.pricing.lastUpdated)}
                    </Typography>
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
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>

      {/* Price History — every accepted price written to this bought-out
          item across vendors / over time. Distinct from the Quotes card
          below: this is the canonical-price timeline, that one shows every
          received quote (accepted or not). */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6">Price History</Typography>
            <Chip
              label={priceHistoryLoading ? '…' : priceHistory.length}
              size="small"
              color={priceHistory.length > 0 ? 'primary' : 'default'}
            />
          </Stack>
          {priceHistoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : priceHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No accepted prices yet. When you accept a quoted price for this item, it&apos;ll be
              recorded here.
            </Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {priceHistory.map((p) => {
                  const effective = p.effectiveDate?.toDate?.();
                  return (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{ cursor: p.sourceQuoteId ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (p.sourceQuoteId) {
                          router.push(`/procurement/quotes/${p.sourceQuoteId}`);
                        }
                      }}
                    >
                      <TableCell sx={{ py: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: p.currency,
                          }).format(p.unitPrice)}{' '}
                          / {p.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {p.vendorName ?? 'Unknown vendor'}
                          {effective ? ` · ${formatDate(effective)}` : ''}
                          {p.sourceType !== 'VENDOR_QUOTE' ? ` · ${p.sourceType}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1 }}>
                        {p.documentReference && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {p.documentReference}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Quotes — every vendor quote line that linked to this
          bought-out record. Mirrors the same section on material / service
          detail pages. Accepted prices (the canonical pick) are highlighted. */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6">Quotes</Typography>
            <Chip
              label={quotesLoading ? '…' : quoteRows.length}
              size="small"
              color={quoteRows.length > 0 ? 'primary' : 'default'}
            />
          </Stack>
          {quotesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : quoteRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No vendor quotes for this item yet. They&apos;ll appear here automatically as you log
              quotes that include this item.
            </Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {quoteRows.map(({ item: line, quote }) => {
                  const dateVal =
                    quote.vendorOfferDate &&
                    typeof (quote.vendorOfferDate as { toDate?: () => Date }).toDate === 'function'
                      ? (quote.vendorOfferDate as { toDate: () => Date }).toDate()
                      : null;
                  const accepted = line.priceAccepted === true;
                  return (
                    <TableRow
                      key={line.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        ...(accepted && { backgroundColor: 'success.light', opacity: 0.95 }),
                      }}
                      onClick={() => router.push(`/procurement/quotes/${quote.id}`)}
                    >
                      <TableCell sx={{ py: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {accepted && (
                            <AcceptedIcon
                              fontSize="small"
                              color="success"
                              titleAccess="Accepted price"
                            />
                          )}
                          <Box>
                            <Typography variant="body2" fontWeight={accepted ? 600 : 500}>
                              {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: quote.currency,
                              }).format(line.unitPrice)}{' '}
                              / {line.unit}
                              {line.gstRate ? ` · GST ${line.gstRate}%` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {quote.vendorName || '—'}
                              {dateVal ? ` · ${formatDate(dateVal)}` : ''}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1 }}>
                        <Chip
                          label={accepted ? 'Accepted' : quote.status}
                          size="small"
                          color={accepted ? 'success' : 'default'}
                          variant={accepted ? 'filled' : 'outlined'}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.5, fontFamily: 'monospace' }}
                        >
                          {quote.number}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
