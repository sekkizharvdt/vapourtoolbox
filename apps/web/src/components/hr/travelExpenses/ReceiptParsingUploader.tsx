'use client';

/**
 * Receipt Parsing Uploader
 *
 * Upload and parse travel expense receipts using either:
 * - Google Document AI
 * - Claude AI
 *
 * Supports side-by-side comparison of both parsers for evaluation.
 */

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
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Stack,
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
  Compare as CompareIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
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

interface SingleParserResult {
  success: boolean;
  error?: string;
  data?: ParsedReceiptData;
  processingTimeMs: number;
  modelUsed: string;
}

interface CompareReceiptParsingResult {
  success: boolean;
  googleDocumentAI: SingleParserResult;
  claudeAI: SingleParserResult;
  sourceFileName: string;
  sourceFileSize: number;
  totalProcessingTimeMs: number;
  attachmentId: string;
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
  const [step, setStep] = useState<'upload' | 'parsing' | 'comparison' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);
  const [compareResult, setCompareResult] = useState<CompareReceiptParsingResult | null>(null);
  const [selectedParser, setSelectedParser] = useState<'google' | 'claude' | null>(null);

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

          // Start comparison parsing (both AI models)
          await compareReceipts(newReceipt, file.type, file.size);

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

  const compareReceipts = async (
    receiptData: ReceiptAttachment,
    mimeType: string,
    fileSize: number
  ) => {
    setStep('parsing');
    setError(null);

    try {
      const { app } = getFirebase();
      const functionsAsiaSouth1 = getFunctions(app, 'asia-south1');
      const compareReceiptsFn = httpsCallable<
        {
          fileName: string;
          storagePath: string;
          mimeType: string;
          fileSize: number;
          reportId: string;
        },
        CompareReceiptParsingResult
      >(functionsAsiaSouth1, 'compareReceiptParsers');

      const result = await compareReceiptsFn({
        fileName: receiptData.name,
        storagePath: receiptData.storagePath,
        mimeType,
        fileSize,
        reportId,
      });

      if (result.data.success) {
        setCompareResult(result.data);
        setStep('comparison');
      } else {
        setError('Comparison failed. Please enter details manually.');
        setStep('review');
      }
    } catch (err) {
      console.error('Error comparing receipts:', err);
      setError('Receipt parsing failed. Please enter details manually.');
      setStep('review');
    }
  };

  const applyParsedData = (data: ParsedReceiptData) => {
    setParsedData(data);
    setFormData({
      category: (data.suggestedCategory as TravelExpenseCategory) || 'OTHER',
      description: data.vendorName || '',
      expenseDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
      amount: data.totalAmount || 0,
      vendorName: data.vendorName || '',
      invoiceNumber: data.invoiceNumber || '',
      gstRate: data.gstRate,
      gstAmount: data.gstAmount,
      cgstAmount: data.cgstAmount,
      sgstAmount: data.sgstAmount,
      igstAmount: data.igstAmount,
      taxableAmount: data.taxableAmount,
      vendorGstin: data.vendorGstin || '',
    });
  };

  const handleSelectParser = (parser: 'google' | 'claude') => {
    if (!compareResult) return;

    setSelectedParser(parser);
    const result = parser === 'google' ? compareResult.googleDocumentAI : compareResult.claudeAI;

    if (!result.success || !result.data) {
      setError(
        `${parser === 'google' ? 'Google' : 'Claude'} parser failed. Please try the other parser or enter data manually.`
      );
      return;
    }

    applyParsedData(result.data);
    setStep('review');
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
    setCompareResult(null);
    setSelectedParser(null);
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

  // Render comparison view
  const renderComparisonView = () => {
    if (!compareResult) return null;

    const { googleDocumentAI, claudeAI } = compareResult;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Parser Comparison Results
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Both parsers analyzed your receipt. Compare the results below and select which one to use.
        </Typography>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Google Document AI Results */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: '100%',
                border: selectedParser === 'google' ? 2 : 1,
                borderColor: selectedParser === 'google' ? 'primary.main' : 'divider',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Google Document AI
                  </Typography>
                  {googleDocumentAI.success ? (
                    <Chip label="Success" size="small" color="success" />
                  ) : (
                    <Chip label="Failed" size="small" color="error" />
                  )}
                </Stack>

                {googleDocumentAI.success && googleDocumentAI.data ? (
                  <>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Vendor:
                        </Typography>
                        <Typography variant="body2">
                          {googleDocumentAI.data.vendorName || '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Amount:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {googleDocumentAI.data.totalAmount
                            ? formatExpenseAmount(googleDocumentAI.data.totalAmount)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Date:
                        </Typography>
                        <Typography variant="body2">
                          {googleDocumentAI.data.transactionDate
                            ? String(googleDocumentAI.data.transactionDate)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Invoice #:
                        </Typography>
                        <Typography variant="body2">
                          {googleDocumentAI.data.invoiceNumber || '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          GST Amount:
                        </Typography>
                        <Typography variant="body2">
                          {googleDocumentAI.data.gstAmount
                            ? formatExpenseAmount(googleDocumentAI.data.gstAmount)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Category:
                        </Typography>
                        <Chip
                          icon={
                            CATEGORY_ICONS[
                              (googleDocumentAI.data.suggestedCategory as TravelExpenseCategory) ||
                                'OTHER'
                            ]
                          }
                          label={googleDocumentAI.data.suggestedCategory || 'OTHER'}
                          size="small"
                        />
                      </Box>
                      {googleDocumentAI.data.companyGstinFound && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Company GST:
                          </Typography>
                          <Chip
                            icon={<VerifiedIcon />}
                            label="Found"
                            size="small"
                            color="success"
                          />
                        </Box>
                      )}
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <SpeedIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {googleDocumentAI.processingTimeMs}ms •{' '}
                        {Math.round((googleDocumentAI.data.confidence || 0) * 100)}% confidence
                      </Typography>
                    </Stack>
                  </>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {googleDocumentAI.error || 'Parsing failed'}
                  </Alert>
                )}

                <Button
                  variant={selectedParser === 'google' ? 'contained' : 'outlined'}
                  fullWidth
                  onClick={() => handleSelectParser('google')}
                  disabled={!googleDocumentAI.success}
                >
                  Use These Results
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Claude AI Results */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: '100%',
                border: selectedParser === 'claude' ? 2 : 1,
                borderColor: selectedParser === 'claude' ? 'primary.main' : 'divider',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Claude AI
                  </Typography>
                  {claudeAI.success ? (
                    <Chip label="Success" size="small" color="success" />
                  ) : (
                    <Chip label="Failed" size="small" color="error" />
                  )}
                </Stack>

                {claudeAI.success && claudeAI.data ? (
                  <>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Vendor:
                        </Typography>
                        <Typography variant="body2">{claudeAI.data.vendorName || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Amount:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {claudeAI.data.totalAmount
                            ? formatExpenseAmount(claudeAI.data.totalAmount)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Date:
                        </Typography>
                        <Typography variant="body2">
                          {claudeAI.data.transactionDate
                            ? String(claudeAI.data.transactionDate)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Invoice #:
                        </Typography>
                        <Typography variant="body2">
                          {claudeAI.data.invoiceNumber || '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          GST Amount:
                        </Typography>
                        <Typography variant="body2">
                          {claudeAI.data.gstAmount
                            ? formatExpenseAmount(claudeAI.data.gstAmount)
                            : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Category:
                        </Typography>
                        <Chip
                          icon={
                            CATEGORY_ICONS[
                              (claudeAI.data.suggestedCategory as TravelExpenseCategory) || 'OTHER'
                            ]
                          }
                          label={claudeAI.data.suggestedCategory || 'OTHER'}
                          size="small"
                        />
                      </Box>
                      {claudeAI.data.companyGstinFound && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Company GST:
                          </Typography>
                          <Chip
                            icon={<VerifiedIcon />}
                            label="Found"
                            size="small"
                            color="success"
                          />
                        </Box>
                      )}
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <SpeedIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {claudeAI.processingTimeMs}ms •{' '}
                        {Math.round((claudeAI.data.confidence || 0) * 100)}% confidence
                      </Typography>
                    </Stack>
                  </>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {claudeAI.error || 'Parsing failed'}
                  </Alert>
                )}

                <Button
                  variant={selectedParser === 'claude' ? 'contained' : 'outlined'}
                  fullWidth
                  onClick={() => handleSelectParser('claude')}
                  disabled={!claudeAI.success}
                >
                  Use These Results
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Manual entry option */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Neither result looks right?
          </Typography>
          <Button
            variant="text"
            onClick={() => {
              setStep('review');
              setFormData({
                category: 'OTHER',
                description: '',
                expenseDate: new Date(),
                amount: 0,
                vendorName: '',
                invoiceNumber: '',
              });
            }}
          >
            Enter details manually
          </Button>
        </Box>

        {/* Cancel */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
        </Box>
      </Box>
    );
  };

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
            <Typography variant="body2" color="text.secondary" gutterBottom>
              PDF, JPG, PNG, WebP up to 5MB
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
              <Chip icon={<CompareIcon />} label="Compares both AI parsers" size="small" />
            </Stack>
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
          Analyzing with both Google Document AI and Claude AI
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

  // Render comparison step
  if (step === 'comparison') {
    return renderComparisonView();
  }

  // Render review/edit step
  return (
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <ParseIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Parsing confidence: {Math.round((parsedData.confidence || 0) * 100)}%
                </Typography>
                {selectedParser && (
                  <Chip
                    label={`Using ${selectedParser === 'google' ? 'Google' : 'Claude'} AI`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
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
            format="dd/MM/yyyy"
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
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
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

        {/* GST Amount - simplified single field */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="GST Amount (if any)"
            fullWidth
            type="number"
            value={formData.gstAmount || ''}
            onChange={(e) =>
              setFormData({ ...formData, gstAmount: parseFloat(e.target.value) || undefined })
            }
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Total GST charged on receipt (CGST+SGST or IGST)"
          />
        </Grid>
      </Grid>

      {/* Summary */}
      <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Total Amount
            </Typography>
            <Typography variant="h6">{formatExpenseAmount(formData.amount || 0)}</Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              GST Amount
            </Typography>
            <Typography variant="body1">
              {formData.gstAmount ? formatExpenseAmount(formData.gstAmount) : '-'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Our GST on Bill
            </Typography>
            <Typography variant="body1">
              {parsedData?.companyGstinFound ? (
                <Chip icon={<VerifiedIcon />} label="Yes" size="small" color="success" />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No
                </Typography>
              )}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          startIcon={<CompareIcon />}
          onClick={() => setStep('comparison')}
          disabled={!compareResult}
        >
          Back to Comparison
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
    </Box>
  );
}

export default ReceiptParsingUploader;
