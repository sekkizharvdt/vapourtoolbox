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
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
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
import {
  Home as HomeIcon,
  Save as SaveIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AutoAwesomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { CurrencyCode, Material, MaterialVariant, RFQ, Service } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { createVendorQuote } from '@/lib/vendorQuotes';
import type { CreateVendorQuoteItemInput } from '@/lib/vendorQuotes';
import { listRFQs } from '@/lib/procurement/rfq';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';
import ServicePickerDialog from '@/components/services/ServicePickerDialog';

interface RFQOption {
  id: string;
  number: string;
  title?: string;
}

/**
 * Convert Claude's "DD/MM/YYYY" output into a YYYY-MM-DD string suitable for
 * a `<input type="date">`. Returns empty string if the input doesn't match.
 */
function toDateInputValue(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
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
  const [parseHint, setParseHint] = useState('');

  // File upload state — file is uploaded to Storage as soon as the user picks
  // it, so the parse-with-AI cloud function can read it without re-upload.
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stagedFile, setStagedFile] = useState<{
    storagePath: string;
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // AI parser state
  const [parsing, setParsing] = useState(false);

  // Line items — populated by AI parser, editable, eventually persisted
  // alongside the quote header. NOTE-type rows are free-text (no master link).
  type LineItemRow = CreateVendorQuoteItemInput & { tempKey: string };
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);

  // Picker state
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [pickerRowIndex, setPickerRowIndex] = useState<number>(-1);

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
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10 MB');
      return;
    }
    setFile(selected);
    setError('');
    setStagedFile(null);
    setUploadProgress(0);
    if (storage) {
      uploadFileToStorage(selected);
    }
  };

  const uploadFileToStorage = async (target: File) => {
    if (!storage) return;
    setUploading(true);
    const storagePath = `vendor-quotes/staging/${Date.now()}_${target.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, target);

    return new Promise<void>((resolve) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (err) => {
          console.error('[NewQuotePage] Upload failed', err);
          setError(`Upload failed: ${err.message}`);
          setUploading(false);
          resolve();
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setStagedFile({
              storagePath,
              downloadUrl: url,
              fileName: target.name,
              mimeType: target.type || 'application/pdf',
              fileSize: target.size,
            });
          } catch (err) {
            console.error('[NewQuotePage] downloadURL failed', err);
            setError('Could not finalize the upload — please try a different file.');
          } finally {
            setUploading(false);
            resolve();
          }
        }
      );
    });
  };

  const newRow = (overrides: Partial<CreateVendorQuoteItemInput> = {}): LineItemRow => ({
    tempKey: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemType: 'MATERIAL',
    description: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    ...overrides,
  });

  const handleParseWithAI = async () => {
    if (!stagedFile) {
      setError('Upload the quote document first.');
      return;
    }
    setParsing(true);
    setError('');
    setParseHint('');
    try {
      const fns = getFunctions(undefined, 'asia-south1');
      const callable = httpsCallable<
        {
          storagePath: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
        },
        {
          success: boolean;
          header: {
            vendorOfferNumber?: string;
            vendorOfferDate?: string;
            validityDate?: string;
            currency?: string;
            paymentTerms?: string;
            deliveryTerms?: string;
            warrantyTerms?: string;
            remarks?: string;
          };
          items: Array<{
            description: string;
            itemType: 'MATERIAL' | 'SERVICE' | 'BOUGHT_OUT' | 'NOTE';
            quantity: number;
            unit: string;
            unitPrice: number;
            gstRate?: number;
            deliveryPeriod?: string;
            makeModel?: string;
            vendorNotes?: string;
          }>;
          warnings: string[];
          error?: string;
        }
      >(fns, 'parseQuote');

      const res = await callable({
        storagePath: stagedFile.storagePath,
        fileName: stagedFile.fileName,
        mimeType: stagedFile.mimeType,
        fileSize: stagedFile.fileSize,
      });

      const data = res.data;
      if (!data.success) {
        setError(data.error || 'Parsing failed.');
        return;
      }

      // Header — only fill empty fields so the user's typed input is preserved.
      const h = data.header;
      if (h.vendorOfferNumber && !vendorOfferNumber) setVendorOfferNumber(h.vendorOfferNumber);
      if (h.vendorOfferDate && !offerDate) setOfferDate(toDateInputValue(h.vendorOfferDate));
      if (h.validityDate && !validityDate) setValidityDate(toDateInputValue(h.validityDate));
      if (h.currency && !currency) setCurrency(h.currency as CurrencyCode);
      const remarkBits = [
        remarks,
        h.paymentTerms ? `Payment: ${h.paymentTerms}` : '',
        h.deliveryTerms ? `Delivery: ${h.deliveryTerms}` : '',
        h.warrantyTerms ? `Warranty: ${h.warrantyTerms}` : '',
        h.remarks || '',
      ]
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set(remarkBits)).join('\n');
      if (merged) setRemarks(merged);

      // Items — replace any existing rows with the parsed set. NOTE rows
      // skip the master picker; everything else needs a manual link before save.
      const parsedRows: LineItemRow[] = data.items.map((item) =>
        newRow({
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          ...(item.gstRate != null && { gstRate: item.gstRate }),
          ...(item.deliveryPeriod && { deliveryPeriod: item.deliveryPeriod }),
          ...(item.makeModel && { makeModel: item.makeModel }),
          ...(item.vendorNotes && { vendorNotes: item.vendorNotes }),
        })
      );
      setLineItems(parsedRows);

      const warningText = data.warnings.length > 0 ? ` · ${data.warnings.join(' ')}` : '';
      setParseHint(
        `AI extracted ${parsedRows.length} item${parsedRows.length === 1 ? '' : 's'}. Review each row and link to a master record before saving.${warningText}`
      );
    } catch (err) {
      console.error('[NewQuotePage] parseQuote failed', err);
      setError(err instanceof Error ? err.message : 'AI parser unavailable. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleAddRow = () => setLineItems((prev) => [...prev, newRow()]);
  const handleRemoveRow = (index: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== index));

  const handleRowChange = <K extends keyof CreateVendorQuoteItemInput>(
    index: number,
    field: K,
    value: CreateVendorQuoteItemInput[K]
  ) => {
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const updated: LineItemRow = { ...row, [field]: value };
      // Switching a row TO note clears the master link; switching FROM note
      // to a real type leaves it unlinked so the user picks deliberately.
      if (field === 'itemType' && value === 'NOTE') {
        updated.materialId = undefined;
        updated.materialCode = undefined;
        updated.materialName = undefined;
        updated.serviceId = undefined;
        updated.serviceCode = undefined;
        updated.boughtOutItemId = undefined;
        updated.linkedItemName = undefined;
        updated.linkedItemCode = undefined;
        updated.gstRate = undefined;
      }
      next[index] = updated;
      return next;
    });
  };

  const openPickerFor = (index: number) => {
    const row = lineItems[index];
    if (!row) return;
    setPickerRowIndex(index);
    if (row.itemType === 'SERVICE') setServicePickerOpen(true);
    else if (row.itemType === 'MATERIAL' || row.itemType === 'BOUGHT_OUT')
      setMaterialPickerOpen(true);
  };

  const handleMaterialPicked = (
    material: Material,
    _variant?: MaterialVariant,
    fullCode?: string
  ) => {
    if (pickerRowIndex < 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[pickerRowIndex];
      if (!row) return prev;
      next[pickerRowIndex] = {
        ...row,
        materialId: material.id,
        materialCode: fullCode || material.materialCode,
        materialName: material.name,
        // Keep the AI-extracted description (the vendor's wording) so the
        // user can still verify against the original document.
      };
      return next;
    });
    setMaterialPickerOpen(false);
  };

  const handleServicePicked = (service: Service) => {
    if (pickerRowIndex < 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[pickerRowIndex];
      if (!row) return prev;
      next[pickerRowIndex] = {
        ...row,
        serviceId: service.id,
        serviceCode: service.serviceCode,
      };
      return next;
    });
    setServicePickerOpen(false);
  };

  const isRowLinked = (row: LineItemRow): boolean => {
    if (row.itemType === 'NOTE') return true;
    if (row.itemType === 'SERVICE') return !!row.serviceId;
    if (row.itemType === 'MATERIAL' || row.itemType === 'BOUGHT_OUT') return !!row.materialId;
    return false;
  };

  const grandTotal = lineItems.reduce((sum, r) => {
    const base = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
    const gst = r.gstRate ? base * (r.gstRate / 100) : 0;
    return sum + base + gst;
  }, 0);

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

    // Validate line items. Empty items array is allowed (user may save the
    // header now and add lines later from the detail page) — but if there
    // ARE rows, every non-NOTE row must be linked to a master record.
    for (let i = 0; i < lineItems.length; i++) {
      const r = lineItems[i]!;
      if (!(r.description ?? '').trim()) {
        setError(`Line ${i + 1}: description is required.`);
        return;
      }
      if (!isRowLinked(r)) {
        setError(`Line ${i + 1}: pick a ${r.itemType.toLowerCase()} from the master.`);
        return;
      }
    }

    try {
      setSaving(true);
      setError('');

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
          ...(stagedFile ? { fileUrl: stagedFile.downloadUrl, fileName: stagedFile.fileName } : {}),
        },
        // Strip the UI-only `tempKey` before persisting.
        lineItems.map(({ tempKey: _t, ...rest }) => rest),
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

            {/* Optional file attachment + AI parser entry */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Quote Document (optional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  disabled={uploading || parsing}
                >
                  {file ? file.name : 'Choose File'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                  />
                </Button>
                {file && (
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {stagedFile && ' · uploaded'}
                  </Typography>
                )}
                <Tooltip
                  title={
                    !stagedFile
                      ? 'Upload a quote document first'
                      : 'Extract header fields and line items using Claude AI'
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={parsing ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                      onClick={handleParseWithAI}
                      disabled={!stagedFile || parsing || uploading}
                    >
                      {parsing ? 'Parsing…' : 'Parse with AI'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              {uploading && (
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
              )}
              {parseHint && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {parseHint}
                </Alert>
              )}
            </Grid>
          </Grid>

          {/* Line items section */}
          <Box sx={{ mt: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
              <Typography variant="h6">Line Items</Typography>
              <Chip
                label={`${lineItems.length} row${lineItems.length === 1 ? '' : 's'}`}
                size="small"
                color={lineItems.length > 0 ? 'primary' : 'default'}
              />
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
                Add Row
              </Button>
            </Stack>

            {lineItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Use <strong>Parse with AI</strong> to extract items from the uploaded document, or
                add rows manually. You can also save the header now and add lines later from the
                quote detail page.
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 540 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <TableCell width={140}>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell width={100}>Qty</TableCell>
                      <TableCell width={90}>Unit</TableCell>
                      <TableCell width={130} align="right">
                        Unit Price
                      </TableCell>
                      <TableCell width={80} align="right">
                        GST %
                      </TableCell>
                      <TableCell width={140} align="right">
                        Line Total
                      </TableCell>
                      <TableCell width={56}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((row, index) => {
                      const linked = isRowLinked(row);
                      const lineBase = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                      const lineWithGst =
                        lineBase + (row.gstRate ? lineBase * (row.gstRate / 100) : 0);
                      const isNote = row.itemType === 'NOTE';
                      return (
                        <TableRow key={row.tempKey} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              fullWidth
                              value={row.itemType}
                              onChange={(e) =>
                                handleRowChange(
                                  index,
                                  'itemType',
                                  e.target.value as CreateVendorQuoteItemInput['itemType']
                                )
                              }
                            >
                              <MenuItem value="MATERIAL">Material</MenuItem>
                              <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
                              <MenuItem value="SERVICE">Service</MenuItem>
                              <MenuItem value="NOTE">Note / Charge</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="flex-start">
                              <TextField
                                value={row.description}
                                onChange={(e) =>
                                  handleRowChange(index, 'description', e.target.value)
                                }
                                size="small"
                                fullWidth
                                multiline
                                maxRows={3}
                              />
                              {!isNote && (
                                <Tooltip
                                  title={
                                    row.itemType === 'SERVICE'
                                      ? 'Pick from Services Catalog'
                                      : 'Pick from Materials Database'
                                  }
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => openPickerFor(index)}
                                    sx={{ mt: 0.25 }}
                                  >
                                    <SearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                            {row.materialCode && (
                              <Chip
                                label={row.materialCode}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                            {row.serviceCode && (
                              <Chip
                                label={row.serviceCode}
                                size="small"
                                color="secondary"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                            {!isNote && !linked && (
                              <Chip
                                label="Pick from master"
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.quantity}
                              onChange={(e) =>
                                handleRowChange(index, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={row.unit}
                              onChange={(e) =>
                                handleRowChange(index, 'unit', e.target.value.toUpperCase())
                              }
                              size="small"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.unitPrice}
                              onChange={(e) =>
                                handleRowChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                              }
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                              sx={{
                                '& input': {
                                  color: row.unitPrice < 0 ? 'error.main' : undefined,
                                  textAlign: 'right',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {isNote ? (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            ) : (
                              <TextField
                                type="number"
                                value={row.gstRate ?? ''}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    'gstRate',
                                    e.target.value === ''
                                      ? undefined
                                      : parseFloat(e.target.value) || 0
                                  )
                                }
                                size="small"
                                fullWidth
                                inputProps={{ step: '0.01' }}
                                sx={{ '& input': { textAlign: 'right' } }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={lineWithGst < 0 ? 'error.main' : 'text.primary'}
                            >
                              {currency}{' '}
                              {lineWithGst.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveRow(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {lineItems.length > 0 && (
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Box sx={{ minWidth: 280, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="subtitle2" color="text.secondary">
                      Grand Total (incl. GST)
                    </Typography>
                    <Typography variant="h6">
                      {currency}{' '}
                      {grandTotal.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Box>

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

      {/* Master-record pickers — same components used by the PR creation flow */}
      <MaterialPickerDialog
        open={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        onSelect={handleMaterialPicked}
        title="Link line item to material"
        requireVariantSelection={false}
      />
      <ServicePickerDialog
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        onSelect={handleServicePicked}
        createDefaults={(() => {
          const row = lineItems[pickerRowIndex];
          if (!row) return undefined;
          return {
            ...(row.description && { name: row.description }),
            ...(row.unit && { unit: row.unit }),
            ...(row.unitPrice && { defaultRateValue: row.unitPrice }),
          };
        })()}
      />
    </>
  );
}
