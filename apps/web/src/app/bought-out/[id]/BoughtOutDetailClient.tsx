'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
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
  const params = useParams();
  const { user } = useAuth();
  const { db } = getFirebase();
  const id = params.id as string;

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

  const loadItem = useCallback(async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Item not found</Alert>
        <Button sx={{ mt: 2 }} onClick={() => router.push('/bought-out')}>
          Back to List
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/bought-out')}
            variant="outlined"
          >
            Back
          </Button>
          <Box>
            <Typography variant="h4" component="h1">
              {item.itemCode}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created on {formatDate(item.createdAt)}
            </Typography>
          </Box>
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
    </Container>
  );
}
