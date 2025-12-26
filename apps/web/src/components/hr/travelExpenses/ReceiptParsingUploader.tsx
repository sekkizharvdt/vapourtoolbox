'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Receipt as ReceiptIcon,
  AutoAwesome as ParseIcon,
  CheckCircle as VerifiedIcon,
  Flight,
  Hotel,
  LocalTaxi,
  Restaurant,
} from '@mui/icons-material';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { TravelExpenseCategory, ParsedReceiptData } from '@vapour/types';
import { EXPENSE_CATEGORY_LABELS, formatExpenseAmount } from '@/lib/hr';

export interface ReceiptAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  storagePath: string;
  uploadedAt: Date;
}

export interface ParsedExpenseData {
  category: TravelExpenseCategory;
  description: string;
  expenseDate: Date;
  amount: number;
  vendorName?: string;
  invoiceNumber?: string;
  gstRate?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxableAmount?: number;
  vendorGstin?: string;
  ourGstinUsed?: boolean;
  fromLocation?: string;
  toLocation?: string;
  receipt: ReceiptAttachment;
}

interface ReceiptParsingUploaderProps {
  reportId: string;
  onExpenseReady: (data: ParsedExpenseData) => void;
  onCancel: () => void;
  tripStartDate?: Date;
  tripEndDate?: Date;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const CATEGORY_ICONS: Record<TravelExpenseCategory, React.ReactElement> = {
  TRAVEL: <Flight fontSize="small" />,
  ACCOMMODATION: <Hotel fontSize="small" />,
  LOCAL_CONVEYANCE: <LocalTaxi fontSize="small" />,
  FOOD: <Restaurant fontSize="small" />,
  OTHER: <ReceiptIcon fontSize="small" />,
};

export function ReceiptParsingUploader({
  reportId,
  onExpenseReady,
  onCancel,
  tripStartDate,
  tripEndDate,
}: ReceiptParsingUploaderProps) {
  const [step, setStep] = useState<'upload' | 'parsing' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);

  // Editable form state
  const [formData, setFormData] = useState<Partial<ParsedExpenseData>>({
    category: 'OTHER',
    description: '',
    expenseDate: new Date(),
    amount: 0,
    vendorName: '',
    invoiceNumber: '',
    gstRate: undefined,
    gstAmount: undefined,
    cgstAmount: undefined,
    sgstAmount: undefined,
    igstAmount: undefined,
    taxableAmount: undefined,
    vendorGstin: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only PDF, JPEG, PNG, and WebP files are allowed');
      return;
    }

    // Validate file size (5MB)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError('File size exceeds 5MB limit');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const { storage } = getFirebase();
      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `hr/travel-expenses/${reportId}/receipts/${fileName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (err) => {
          console.error('Upload error:', err);
          setError('Failed to upload receipt. Please try again.');
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const newReceipt: ReceiptAttachment = {
            id: fileName,
            name: file.name,
            url: downloadURL,
            size: file.size,
            type: file.type,
            storagePath,
            uploadedAt: new Date(),
          };

          setReceipt(newReceipt);
          setUploading(false);
          setUploadProgress(0);

          // Start parsing
          await parseReceipt(newReceipt, file.type, file.size);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      );
    } catch (err) {
      console.error('Error uploading receipt:', err);
      setError('Failed to upload receipt. Please try again.');
      setUploading(false);
    }
  };

  const parseReceipt = async (
    receiptData: ReceiptAttachment,
    mimeType: string,
    fileSize: number
  ) => {
    setStep('parsing');
    setError(null);

    try {
      const { functions } = getFirebase();
      const parseReceiptFn = httpsCallable<
        {
          fileName: string;
          storagePath: string;
          mimeType: string;
          fileSize: number;
          reportId: string;
        },
        {
          success: boolean;
          data?: ParsedReceiptData;
          error?: string;
          attachmentId: string;
          fileName: string;
        }
      >(functions, 'parseReceiptForExpense');

      const result = await parseReceiptFn({
        fileName: receiptData.name,
        storagePath: receiptData.storagePath,
        mimeType,
        fileSize,
        reportId,
      });

      if (result.data.success && result.data.data) {
        const parsed = result.data.data;
        setParsedData(parsed);

        // Populate form with parsed data
        setFormData({
          category: (parsed.suggestedCategory as TravelExpenseCategory) || 'OTHER',
          description: parsed.vendorName || '',
          expenseDate: parsed.transactionDate ? new Date(parsed.transactionDate) : new Date(),
          amount: parsed.totalAmount || 0,
          vendorName: parsed.vendorName || '',
          invoiceNumber: parsed.invoiceNumber || '',
          gstRate: parsed.gstRate,
          gstAmount: parsed.gstAmount,
          cgstAmount: parsed.cgstAmount,
          sgstAmount: parsed.sgstAmount,
          igstAmount: parsed.igstAmount,
          taxableAmount: parsed.taxableAmount,
          vendorGstin: parsed.vendorGstin || '',
        });

        setStep('review');
      } else {
        // Parsing failed or returned no data, go to manual entry
        setError(result.data.error || 'Could not parse receipt. Please enter details manually.');
        setStep('review');
      }
    } catch (err) {
      console.error('Error parsing receipt:', err);
      setError('Receipt parsing failed. Please enter details manually.');
      setStep('review');
    }
  };

  const handleDeleteReceipt = async () => {
    if (!receipt) return;

    try {
      const { storage } = getFirebase();
      const fileRef = ref(storage, receipt.storagePath);
      await deleteObject(fileRef);
    } catch (err) {
      console.error('Error deleting receipt:', err);
    }

    setReceipt(null);
    setParsedData(null);
    setFormData({
      category: 'OTHER',
      description: '',
      expenseDate: new Date(),
      amount: 0,
      vendorName: '',
      invoiceNumber: '',
    });
    setStep('upload');
    setError(null);
  };

  const handleSubmit = () => {
    if (!receipt || !formData.amount || formData.amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!formData.description?.trim()) {
      setError('Please enter a description');
      return;
    }

    const expenseData: ParsedExpenseData = {
      category: formData.category || 'OTHER',
      description: formData.description?.trim() || '',
      expenseDate: formData.expenseDate || new Date(),
      amount: formData.amount,
      vendorName: formData.vendorName?.trim() || undefined,
      invoiceNumber: formData.invoiceNumber?.trim() || undefined,
      gstRate: formData.gstRate,
      gstAmount: formData.gstAmount,
      cgstAmount: formData.cgstAmount,
      sgstAmount: formData.sgstAmount,
      igstAmount: formData.igstAmount,
      taxableAmount: formData.taxableAmount,
      vendorGstin: formData.vendorGstin?.trim() || undefined,
      ourGstinUsed: parsedData?.companyGstinFound,
      receipt,
    };

    onExpenseReady(expenseData);
  };

  const categoryOptions = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
    value: value as TravelExpenseCategory,
    label,
  }));

  // Render upload step
  if (step === 'upload') {
    return (
      <Box>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading}
        />

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {uploading ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading receipt... {Math.round(uploadProgress)}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'grey.50',
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              Upload Receipt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PDF, JPG, PNG, WebP up to 5MB
            </Typography>
            <Button variant="contained" startIcon={<UploadIcon />} sx={{ mt: 2 }}>
              Choose File
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
        </Box>
      </Box>
    );
  }

  // Render parsing step
  if (step === 'parsing') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Parsing Receipt...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Extracting vendor, amount, GST and other details
        </Typography>
        {receipt && (
          <Chip
            icon={<ReceiptIcon />}
            label={receipt.name}
            sx={{ mt: 2 }}
            color="primary"
            variant="outlined"
          />
        )}
      </Box>
    );
  }

  // Render review/edit step
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {error && (
          <Alert severity="warning" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Receipt info */}
        {receipt && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="success" />
                <Box>
                  <Typography variant="body2">{receipt.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(receipt.size)}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Tooltip title="Preview">
                  <IconButton onClick={() => window.open(receipt.url, '_blank')}>
                    <PreviewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove receipt">
                  <IconButton color="error" onClick={handleDeleteReceipt}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Parsing confidence indicator */}
            {parsedData && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ParseIcon color="primary" fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    Parsing confidence: {Math.round((parsedData.confidence || 0) * 100)}%
                  </Typography>
                  {parsedData.companyGstinFound && (
                    <Chip
                      icon={<VerifiedIcon />}
                      label="Company GST on receipt"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        )}

        <Typography variant="subtitle2" gutterBottom>
          Expense Details
          {parsedData && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (auto-filled from receipt - please review)
            </Typography>
          )}
        </Typography>

        <Grid container spacing={2}>
          {/* Category */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Category"
              fullWidth
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as TravelExpenseCategory })
              }
            >
              {categoryOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {CATEGORY_ICONS[opt.value]}
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Date */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Expense Date"
              value={formData.expenseDate}
              onChange={(date) => {
                const newDate = date as Date | null;
                setFormData({ ...formData, expenseDate: newDate || new Date() });
              }}
              minDate={tripStartDate}
              maxDate={tripEndDate}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          {/* Description */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Description"
              fullWidth
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Flight to Mumbai, Hotel stay, Uber ride"
            />
          </Grid>

          {/* Amount */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Amount (INR)"
              fullWidth
              required
              type="number"
              value={formData.amount || ''}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          {/* Vendor Name */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Vendor Name"
              fullWidth
              value={formData.vendorName}
              onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              placeholder="e.g., Indigo Airlines"
            />
          </Grid>

          {/* Invoice Number */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Invoice/Bill Number"
              fullWidth
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            />
          </Grid>

          {/* Vendor GSTIN */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Vendor GSTIN"
              fullWidth
              value={formData.vendorGstin}
              onChange={(e) => setFormData({ ...formData, vendorGstin: e.target.value })}
              placeholder="e.g., 27AABCU9603R1ZM"
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
          </Grid>

          {/* GST Details */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                GST Details (Optional)
              </Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="GST Rate (%)"
              fullWidth
              type="number"
              value={formData.gstRate || ''}
              onChange={(e) =>
                setFormData({ ...formData, gstRate: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, max: 28, step: 0.5 }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="CGST Amount"
              fullWidth
              type="number"
              value={formData.cgstAmount || ''}
              onChange={(e) =>
                setFormData({ ...formData, cgstAmount: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="SGST Amount"
              fullWidth
              type="number"
              value={formData.sgstAmount || ''}
              onChange={(e) =>
                setFormData({ ...formData, sgstAmount: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="IGST Amount"
              fullWidth
              type="number"
              value={formData.igstAmount || ''}
              onChange={(e) =>
                setFormData({ ...formData, igstAmount: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Taxable Amount"
              fullWidth
              type="number"
              value={formData.taxableAmount || ''}
              onChange={(e) =>
                setFormData({ ...formData, taxableAmount: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Total GST Amount"
              fullWidth
              type="number"
              value={formData.gstAmount || ''}
              onChange={(e) =>
                setFormData({ ...formData, gstAmount: parseFloat(e.target.value) || undefined })
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
        </Grid>

        {/* Summary */}
        <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Total Amount
              </Typography>
              <Typography variant="h6">{formatExpenseAmount(formData.amount || 0)}</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                GST Amount
              </Typography>
              <Typography variant="body1">
                {formatExpenseAmount(formData.gstAmount || 0)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Actions */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.amount || formData.amount <= 0 || !formData.description?.trim()}
          >
            Add Expense
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}

export default ReceiptParsingUploader;
