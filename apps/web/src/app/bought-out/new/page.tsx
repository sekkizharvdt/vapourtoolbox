'use client';

import { useState } from 'react';
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  BoughtOutCategory,
  BOUGHT_OUT_CATEGORY_LABELS,
  CreateBoughtOutItemInput,
  CurrencyCode,
} from '@vapour/types';
import { createBoughtOutItem } from '@/lib/boughtOut/boughtOutService';
import SpecificationForm from '../components/SpecificationForm';

export default function NewBoughtOutItemPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  // Single-tenant: Use 'company' as entityId
  const entityId = 'company';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setError(null);

      const input: CreateBoughtOutItemInput = {
        entityId,
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
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/bought-out"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/bought-out');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Bought Out
        </Link>
        <Typography color="text.primary">New Item</Typography>
      </Breadcrumbs>

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
