'use client';

/**
 * Log Vendor Quote — Procurement
 *
 * Records a vendor quote obtained outside the in-app RFQ flow (phone, email,
 * WhatsApp, trade show, etc.). Optionally ties it back to an RFQ that was
 * sent offline.
 *
 * Creates a VendorQuote with:
 * - sourceType = 'OFFLINE_RFQ' if an RFQ is selected, otherwise 'UNSOLICITED'
 * - rfqMode = 'OFFLINE' when rfqId is set
 *
 * Line items get added on the detail page after the quote is created.
 */

import { useEffect, useState } from 'react';
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
  Alert,
  Autocomplete,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader } from '@vapour/ui';
import { Home as HomeIcon, Save as SaveIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { CurrencyCode, RFQ } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { createVendorQuote } from '@/lib/vendorQuotes';
import { listRFQs } from '@/lib/procurement/rfq';

interface RFQOption {
  id: string;
  number: string;
  title?: string;
}

export default function NewProcurementQuotePage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db, storage } = getFirebase();

  // Vendor
  const [vendorName, setVendorName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [useEntitySelector, setUseEntitySelector] = useState(true);

  // RFQ linkage (optional)
  const [selectedRfq, setSelectedRfq] = useState<RFQOption | null>(null);
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [rfqOptionsLoading, setRfqOptionsLoading] = useState(true);

  // Quote metadata
  const [vendorOfferNumber, setVendorOfferNumber] = useState('');
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

  // Load RFQ options for the optional picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listRFQs({ limit: 100 });
        if (cancelled) return;
        setRfqOptions(
          result.items.map((r: RFQ) => ({ id: r.id, number: r.number, title: r.title }))
        );
      } catch (err) {
        console.warn('[NewQuotePage] Failed to load RFQs for picker', err);
      } finally {
        if (!cancelled) setRfqOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const storagePath = `vendor-quotes/${Date.now()}_${file.name}`;
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
    const name = useEntitySelector ? vendorName : vendorName.trim();
    if (!useEntitySelector && !name) {
      setError('Vendor name is required');
      return;
    }
    if (useEntitySelector && !vendorId) {
      setError('Please select a vendor');
      return;
    }
    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      setSaving(true);
      setError('');

      let fileData: { url: string; name: string } | null = null;
      if (file) {
        fileData = await uploadFile();
      }

      const quoteId = await createVendorQuote(
        db,
        {
          sourceType: selectedRfq ? 'OFFLINE_RFQ' : 'UNSOLICITED',
          ...(selectedRfq && {
            rfqId: selectedRfq.id,
            rfqNumber: selectedRfq.number,
            rfqMode: 'OFFLINE',
          }),
          tenantId: claims?.tenantId || 'default-entity',
          vendorName: useEntitySelector ? vendorName || 'Unknown Vendor' : name,
          ...(vendorId ? { vendorId } : {}),
          ...(vendorOfferNumber ? { vendorOfferNumber } : {}),
          ...(offerDate ? { vendorOfferDate: new Date(offerDate) } : {}),
          ...(validityDate ? { validityDate: new Date(validityDate) } : {}),
          currency,
          ...(remarks ? { remarks } : {}),
          ...(fileData ? { fileUrl: fileData.url, fileName: fileData.name } : {}),
        },
        [], // Items added on the detail page (DRAFT-first pattern).
        user.uid,
        user.displayName ?? user.email ?? 'Unknown',
        claims?.permissions ?? 0
      );

      // The quote detail UI lives under /materials/vendor-offers/[id] and works for
      // any sourceType — reuse it rather than duplicate.
      router.push(`/materials/vendor-offers/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
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
            { label: 'New Quote' },
          ]}
        />

        <PageHeader
          title="Log Vendor Quote"
          subtitle="Record a quote received by phone, email, or WhatsApp — with or without a linked RFQ"
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Vendor selection */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useEntitySelector}
                    onChange={(e) => {
                      setUseEntitySelector(e.target.checked);
                      if (e.target.checked) setVendorName('');
                      else setVendorId(null);
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
                  onEntitySelect={(entity) => setVendorName(entity?.name ?? '')}
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
                  helperText="Use this when the vendor isn't in your entity list yet"
                />
              </Grid>
            )}

            {/* Optional RFQ link */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                value={selectedRfq}
                onChange={(_e, val) => setSelectedRfq(val)}
                options={rfqOptions}
                loading={rfqOptionsLoading}
                getOptionLabel={(o) => (o.title ? `${o.number} — ${o.title}` : o.number)}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Link to RFQ (optional)"
                    size="small"
                    helperText={
                      selectedRfq
                        ? 'Marked as an offline RFQ response'
                        : 'Leave blank to log as an unsolicited quote'
                    }
                  />
                )}
              />
            </Grid>

            {/* Vendor's own ref */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Vendor's Quote No."
                value={vendorOfferNumber}
                onChange={(e) => setVendorOfferNumber(e.target.value)}
                size="small"
                helperText="Reference number from the vendor's quote"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Quote Date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Valid Until"
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
                helperText="Context: how you obtained this quote, scope covered, etc."
              />
            </Grid>

            {/* Optional file attachment */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Quote Document (optional)
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
              onClick={() => router.push('/procurement')}
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
              {saving ? 'Creating...' : 'Create Quote'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
