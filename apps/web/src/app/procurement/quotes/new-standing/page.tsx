'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader } from '@vapour/ui';
import { Home as HomeIcon, Save as SaveIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { CurrencyCode } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { createVendorQuote } from '@/lib/vendorQuotes/vendorQuoteService';

export default function NewVendorOfferPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db, storage } = getFirebase();

  const [vendorName, setVendorName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [useEntitySelector, setUseEntitySelector] = useState(true);
  const [offerDate, setOfferDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10 MB');
        return;
      }
      setFile(selected);
      setError('');
    }
  };

  const uploadFile = async (): Promise<{ url: string; name: string } | null> => {
    if (!file || !storage) return null;

    setUploading(true);
    const storagePath = `vendor-offers/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (err) => {
          setUploading(false);
          reject(err);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setUploading(false);
          resolve({ url, name: file.name });
        }
      );
    });
  };

  const handleSubmit = async () => {
    const name = useEntitySelector ? '' : vendorName.trim();
    if (!useEntitySelector && !name) {
      setError('Vendor name is required');
      return;
    }
    if (useEntitySelector && !vendorId) {
      setError('Please select a vendor');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Upload file first if selected
      let fileData: { url: string; name: string } | null = null;
      if (file) {
        fileData = await uploadFile();
      }

      const quoteId = await createVendorQuote(
        db,
        {
          sourceType: 'STANDING_QUOTE',
          vendorName: useEntitySelector ? vendorName || 'Unknown Vendor' : name,
          ...(vendorId ? { vendorId } : {}),
          ...(offerDate ? { vendorOfferDate: new Date(offerDate) } : {}),
          ...(validityDate ? { validityDate: new Date(validityDate) } : {}),
          currency,
          ...(remarks ? { remarks } : {}),
          ...(fileData ? { fileUrl: fileData.url, fileName: fileData.name } : {}),
          tenantId: claims?.tenantId || 'default-entity',
        },
        [], // items added one-by-one on the detail page
        user!.uid,
        user!.displayName ?? 'Unknown',
        claims?.permissions ?? 0
      );

      router.push(`/procurement/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Quotes', href: '/procurement/quotes' },
            { label: 'Add Standing Quote' },
          ]}
        />

        <PageHeader
          title="Add Standing Quote"
          subtitle="Capture a vendor's standing rate card or catalog price"
        />
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Vendor Selection */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useEntitySelector}
                    onChange={(e) => {
                      setUseEntitySelector(e.target.checked);
                      if (e.target.checked) {
                        setVendorName('');
                      } else {
                        setVendorId(null);
                      }
                    }}
                  />
                }
                label="Select from existing vendors"
              />
            </Grid>

            {useEntitySelector ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <EntitySelector
                  value={vendorId}
                  onChange={(id) => setVendorId(id)}
                  onEntitySelect={(entity) => {
                    setVendorName(entity?.name ?? '');
                  }}
                  label="Vendor"
                  filterByRole="VENDOR"
                  required
                />
              </Grid>
            ) : (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Vendor Name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                  size="small"
                />
              </Grid>
            )}

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="Offer Date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="Validity Date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select
                  value={currency}
                  label="Currency"
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                >
                  <MenuItem value="INR">INR</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="SGD">SGD</MenuItem>
                  <MenuItem value="AED">AED</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                fullWidth
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                size="small"
                multiline
                rows={2}
              />
            </Grid>

            {/* File Upload */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Offer Document
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  disabled={uploading}
                >
                  {file ? file.name : 'Choose File'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                </Button>
                {file && (
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </Typography>
                )}
              </Box>
              {uploading && (
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
              )}
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/procurement/quotes')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || uploading}
            >
              {saving ? 'Creating...' : 'Create Offer'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
