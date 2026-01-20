'use client';

/**
 * Upload Offer Dialog
 *
 * Upload and parse vendor offer documents (PDF/DOC) using either:
 * - Google Document AI
 * - Claude AI
 *
 * Supports side-by-side comparison of both parsers for evaluation.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  IconButton,
  Chip,
  TextField,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Compare as CompareIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateOffer,
  type CreateOfferInput,
  type CreateOfferItemInput,
} from '@/lib/procurement/offer';
import type { RFQ, RFQItem } from '@vapour/types';
import type { OfferParsingResult, ParsedOfferItem } from '@vapour/types';

interface UploadOfferDialogProps {
  open: boolean;
  onClose: () => void;
  rfq: RFQ;
  rfqItems: RFQItem[];
  onSuccess?: (offerId: string) => void;
}

interface OfferItemData {
  rfqItemId: string;
  rfqItemDescription: string;
  rfqItemQuantity: number;
  rfqItemUnit: string;
  description: string;
  quotedQuantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
  deliveryPeriod: string;
  makeModel: string;
  meetsSpec: boolean;
  deviations: string;
  vendorNotes: string;
  matchConfidence?: number;
  isMatched: boolean;
}

interface SingleParserResult {
  success: boolean;
  error?: string;
  header?: {
    vendorOfferNumber?: string;
    vendorOfferDate?: string;
    validityDate?: string;
    subtotal?: number;
    taxAmount?: number;
    totalAmount?: number;
    currency?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    warrantyTerms?: string;
  };
  items: ParsedOfferItem[];
  totalItemsFound: number;
  matchedItems: number;
  unmatchedItems: number;
  highConfidenceItems: number;
  lowConfidenceItems: number;
  calculatedSubtotal: number;
  calculatedTax: number;
  calculatedTotal: number;
  warnings?: string[];
  processingTimeMs: number;
  modelUsed: string;
}

interface CompareParsingResult {
  success: boolean;
  googleDocumentAI: SingleParserResult;
  claudeAI: SingleParserResult;
  sourceFileName: string;
  sourceFileSize: number;
  totalProcessingTimeMs: number;
}

export default function UploadOfferDialog({
  open,
  onClose,
  rfq,
  rfqItems,
  onSuccess,
}: UploadOfferDialogProps) {
  const { user } = useAuth();
  const createOfferMutation = useCreateOffer();

  // Form state
  const [selectedVendorIndex, setSelectedVendorIndex] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');

  // Parsing state
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parseResult, setParseResult] = useState<OfferParsingResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareParsingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Comparison view state
  const [showComparison, setShowComparison] = useState(false);
  const [selectedParser, setSelectedParser] = useState<'google' | 'claude' | null>(null);

  // Parsed header data
  const [vendorOfferNumber, setVendorOfferNumber] = useState('');
  const [vendorOfferDate, setVendorOfferDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');

  // Offer items
  const [offerItems, setOfferItems] = useState<OfferItemData[]>([]);

  // Creating state
  const [creating, setCreating] = useState(false);

  // Initialize offer items from RFQ items
  const initializeOfferItems = () => {
    if (rfqItems.length === 0) return; // Don't initialize with empty items
    const items: OfferItemData[] = rfqItems.map((rfqItem) => ({
      rfqItemId: rfqItem.id,
      rfqItemDescription: rfqItem.description,
      rfqItemQuantity: rfqItem.quantity,
      rfqItemUnit: rfqItem.unit,
      description: rfqItem.description,
      quotedQuantity: rfqItem.quantity,
      unit: rfqItem.unit,
      unitPrice: 0,
      gstRate: 18,
      deliveryPeriod: '',
      makeModel: '',
      meetsSpec: true,
      deviations: '',
      vendorNotes: '',
      isMatched: false,
    }));
    setOfferItems(items);
  };

  // Initialize offer items when rfqItems become available and dialog is open
  useEffect(() => {
    if (open && rfqItems.length > 0 && offerItems.length === 0 && selectedVendorIndex !== '') {
      initializeOfferItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rfqItems.length, selectedVendorIndex]);

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    offerItems.forEach((item) => {
      const lineAmount = item.unitPrice * item.quotedQuantity;
      const lineTax = (lineAmount * item.gstRate) / 100;
      subtotal += lineAmount;
      taxAmount += lineTax;
    });

    return {
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
    };
  }, [offerItems]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size exceeds 20MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);

    if (!user) return;

    setUploading(true);
    setProgress(10);

    try {
      const { storage } = getFirebase();
      const timestamp = Date.now();
      const storagePath = `offers/${rfq.id}/${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, storagePath);

      setProgress(30);
      await uploadBytes(storageRef, selectedFile);
      setProgress(50);

      const url = await getDownloadURL(storageRef);
      setFileUrl(url);
      setProgress(100);

      if (offerItems.length === 0) {
        initializeOfferItems();
      }
    } catch (err) {
      console.error('[UploadOfferDialog] Upload error:', err);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleCompareWithBothParsers = async () => {
    if (!file || !user || selectedVendorIndex === '') return;

    const vendorId = rfq.vendorIds[selectedVendorIndex] ?? '';
    const vendorName = rfq.vendorNames[selectedVendorIndex] ?? '';

    if (!vendorId || !vendorName) {
      setError('Invalid vendor selection');
      return;
    }

    setParsing(true);
    setProgress(10);
    setError(null);
    setShowComparison(true);
    setCompareResult(null);

    try {
      const { storage, app } = getFirebase();
      // Use asia-south1 region where compareOfferParsers is deployed
      const functionsAsiaSouth1 = getFunctions(app, 'asia-south1');

      let storagePath = '';
      if (fileUrl) {
        const urlObj = new URL(fileUrl);
        storagePath = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
      }

      if (!storagePath) {
        const timestamp = Date.now();
        storagePath = `offers/${rfq.id}/${timestamp}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setFileUrl(url);
      }

      setProgress(30);

      const rfqItemsForParsing = rfqItems.map((item) => ({
        id: item.id,
        lineNumber: item.lineNumber,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
      }));

      const compareParsersFn = httpsCallable<
        {
          fileName: string;
          storagePath: string;
          mimeType: string;
          fileSize: number;
          rfqId: string;
          rfqNumber: string;
          vendorId: string;
          vendorName: string;
          rfqItems: typeof rfqItemsForParsing;
        },
        CompareParsingResult
      >(functionsAsiaSouth1, 'compareOfferParsers');

      setProgress(50);
      const result = await compareParsersFn({
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        rfqId: rfq.id,
        rfqNumber: rfq.number,
        vendorId,
        vendorName,
        rfqItems: rfqItemsForParsing,
      });

      setProgress(100);
      setCompareResult(result.data);
    } catch (err) {
      console.error('[UploadOfferDialog] Compare error:', err);
      setError(
        err instanceof Error ? `Comparison failed: ${err.message}` : 'Failed to compare parsers'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleSelectParser = (parser: 'google' | 'claude') => {
    if (!compareResult) return;

    setSelectedParser(parser);
    const result = parser === 'google' ? compareResult.googleDocumentAI : compareResult.claudeAI;

    if (!result.success) {
      setError(
        `${parser === 'google' ? 'Google' : 'Claude'} parser failed. Please try the other parser or enter data manually.`
      );
      return;
    }

    // Apply the selected parser's results
    applyParsedData(result);
    setShowComparison(false);
  };

  const applyParsedData = (result: SingleParserResult) => {
    if (result.header) {
      if (result.header.vendorOfferNumber) setVendorOfferNumber(result.header.vendorOfferNumber);
      if (result.header.vendorOfferDate) setVendorOfferDate(result.header.vendorOfferDate);
      if (result.header.validityDate) setValidityDate(result.header.validityDate);
      if (result.header.paymentTerms) setPaymentTerms(result.header.paymentTerms);
      if (result.header.deliveryTerms) setDeliveryTerms(result.header.deliveryTerms);
      if (result.header.warrantyTerms) setWarrantyTerms(result.header.warrantyTerms);
    }

    const updatedItems = [...offerItems];

    result.items.forEach((parsedItem: ParsedOfferItem) => {
      if (parsedItem.matchedRfqItemId) {
        const index = updatedItems.findIndex(
          (item) => item.rfqItemId === parsedItem.matchedRfqItemId
        );
        const existingItem = updatedItems[index];
        if (index !== -1 && existingItem) {
          updatedItems[index] = {
            ...existingItem,
            description: parsedItem.description || existingItem.description,
            quotedQuantity: parsedItem.quantity || existingItem.quotedQuantity,
            unit: parsedItem.unit || existingItem.unit,
            unitPrice: parsedItem.unitPrice || 0,
            gstRate: parsedItem.gstRate || 18,
            deliveryPeriod: parsedItem.deliveryPeriod || '',
            makeModel: parsedItem.makeModel || '',
            meetsSpec: parsedItem.meetsSpec ?? true,
            deviations: parsedItem.deviations || '',
            vendorNotes: parsedItem.vendorNotes || '',
            matchConfidence: parsedItem.matchConfidence,
            isMatched: true,
          };
        }
      }
    });

    setOfferItems(updatedItems);

    // Also set parse result for UI display
    setParseResult({
      success: result.success,
      header: result.header ? { ...result.header, confidence: 0.8 } : undefined,
      items: result.items,
      totalItemsFound: result.totalItemsFound,
      matchedItems: result.matchedItems,
      unmatchedItems: result.unmatchedItems,
      highConfidenceItems: result.highConfidenceItems,
      lowConfidenceItems: result.lowConfidenceItems,
      calculatedSubtotal: result.calculatedSubtotal,
      calculatedTax: result.calculatedTax,
      calculatedTotal: result.calculatedTotal,
      warnings: result.warnings,
      processingTimeMs: result.processingTimeMs,
      modelUsed: result.modelUsed,
      sourceFileName: compareResult?.sourceFileName || file?.name || '',
      sourceFileSize: compareResult?.sourceFileSize || file?.size || 0,
    });
  };

  const handleItemChange = (
    index: number,
    field: keyof OfferItemData,
    value: string | number | boolean
  ) => {
    setOfferItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const handleCreateOffer = async () => {
    if (!user || selectedVendorIndex === '' || !fileUrl) {
      setError('Please select a vendor and upload a file');
      return;
    }

    const hasValidPrices = offerItems.every((item) => item.unitPrice > 0);
    if (!hasValidPrices) {
      setError('Please enter unit prices for all items');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const vendorId = rfq.vendorIds[selectedVendorIndex] ?? '';
      const vendorName = rfq.vendorNames[selectedVendorIndex] ?? '';

      if (!vendorId || !vendorName) {
        setError('Invalid vendor selection');
        setCreating(false);
        return;
      }

      const offerInput: CreateOfferInput = {
        rfqId: rfq.id,
        rfqNumber: rfq.number,
        vendorId,
        vendorName,
        offerFileUrl: fileUrl,
        vendorOfferNumber: vendorOfferNumber || undefined,
        vendorOfferDate: vendorOfferDate ? new Date(vendorOfferDate) : undefined,
        validityDate: validityDate ? new Date(validityDate) : undefined,
        paymentTerms: paymentTerms || undefined,
        deliveryTerms: deliveryTerms || undefined,
        warrantyTerms: warrantyTerms || undefined,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        currency: 'INR',
      };

      const itemInputs: CreateOfferItemInput[] = offerItems.map((item) => ({
        rfqItemId: item.rfqItemId,
        description: item.description,
        quotedQuantity: item.quotedQuantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        deliveryPeriod: item.deliveryPeriod || undefined,
        makeModel: item.makeModel || undefined,
        meetsSpec: item.meetsSpec,
        deviations: item.deviations || undefined,
        vendorNotes: item.vendorNotes || undefined,
      }));

      const offerId = await createOfferMutation.mutateAsync({
        input: offerInput,
        items: itemInputs,
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
      });

      onSuccess?.(offerId);
      handleClose();
    } catch (err) {
      console.error('[UploadOfferDialog] Create error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedVendorIndex('');
    setFile(null);
    setFileUrl('');
    setUploading(false);
    setParsing(false);
    setProgress(0);
    setParseResult(null);
    setCompareResult(null);
    setShowComparison(false);
    setSelectedParser(null);
    setError(null);
    setVendorOfferNumber('');
    setVendorOfferDate('');
    setValidityDate('');
    setPaymentTerms('');
    setDeliveryTerms('');
    setWarrantyTerms('');
    setOfferItems([]);
    setCreating(false);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'error';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const canCompare = file && selectedVendorIndex !== '' && !parsing && !uploading;

  // Check which items are missing prices
  const itemsMissingPrice = offerItems.filter((item) => item.unitPrice <= 0);
  const allItemsHavePrice = itemsMissingPrice.length === 0;

  const canCreate =
    selectedVendorIndex !== '' &&
    fileUrl &&
    offerItems.length > 0 &&
    allItemsHavePrice &&
    !creating;

  // Build validation message for Create Offer button
  const getCreateButtonTooltip = (): string => {
    if (creating) return 'Creating offer...';
    if (selectedVendorIndex === '') return 'Please select a vendor';
    if (!fileUrl) return 'Please upload an offer document';
    if (offerItems.length === 0) return 'No items to create offer';
    if (!allItemsHavePrice) {
      return `Please enter unit price for ${itemsMissingPrice.length} item${itemsMissingPrice.length > 1 ? 's' : ''} (highlighted in red)`;
    }
    return '';
  };

  // Render comparison view
  const renderComparisonView = () => {
    if (!compareResult) return null;

    const { googleDocumentAI, claudeAI } = compareResult;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Parser Comparison Results
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Both parsers analyzed your document. Compare the results below and select which one to
          use.
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
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Google Document AI
                  </Typography>
                  <Chip
                    size="small"
                    color={googleDocumentAI.success ? 'success' : 'error'}
                    label={googleDocumentAI.success ? 'Success' : 'Failed'}
                  />
                </Stack>

                {googleDocumentAI.error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {googleDocumentAI.error}
                  </Alert>
                ) : (
                  <>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Items Found:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {googleDocumentAI.totalItemsFound}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Matched to RFQ:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {googleDocumentAI.matchedItems}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Total Amount:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(googleDocumentAI.calculatedTotal)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Processing Time:
                        </Typography>
                        <Chip
                          size="small"
                          icon={<SpeedIcon />}
                          label={`${googleDocumentAI.processingTimeMs}ms`}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>

                    {googleDocumentAI.warnings && googleDocumentAI.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {googleDocumentAI.warnings.length} warning(s)
                      </Alert>
                    )}

                    {/* Preview items */}
                    {googleDocumentAI.items.length > 0 && (
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Extracted Items Preview:
                        </Typography>
                        {googleDocumentAI.items.slice(0, 5).map((item, idx) => (
                          <Box
                            key={idx}
                            sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 0.5 }}
                          >
                            <Typography variant="caption" noWrap>
                              {item.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Qty: {item.quantity} | Price: {formatCurrency(item.unitPrice)}
                            </Typography>
                          </Box>
                        ))}
                        {googleDocumentAI.items.length > 5 && (
                          <Typography variant="caption" color="text.secondary">
                            +{googleDocumentAI.items.length - 5} more items...
                          </Typography>
                        )}
                      </Box>
                    )}
                  </>
                )}

                <Button
                  variant={selectedParser === 'google' ? 'contained' : 'outlined'}
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => handleSelectParser('google')}
                  disabled={!googleDocumentAI.success}
                >
                  {selectedParser === 'google' ? 'Selected' : 'Use These Results'}
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
                borderColor: selectedParser === 'claude' ? 'secondary.main' : 'divider',
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Claude AI
                  </Typography>
                  <Chip
                    size="small"
                    color={claudeAI.success ? 'success' : 'error'}
                    label={claudeAI.success ? 'Success' : 'Failed'}
                  />
                </Stack>

                {claudeAI.error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {claudeAI.error}
                  </Alert>
                ) : (
                  <>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Items Found:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {claudeAI.totalItemsFound}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Matched to RFQ:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {claudeAI.matchedItems}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Total Amount:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(claudeAI.calculatedTotal)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Processing Time:
                        </Typography>
                        <Chip
                          size="small"
                          icon={<SpeedIcon />}
                          label={`${claudeAI.processingTimeMs}ms`}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>

                    {claudeAI.warnings && claudeAI.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {claudeAI.warnings.length} warning(s)
                      </Alert>
                    )}

                    {/* Preview items */}
                    {claudeAI.items.length > 0 && (
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Extracted Items Preview:
                        </Typography>
                        {claudeAI.items.slice(0, 5).map((item, idx) => (
                          <Box
                            key={idx}
                            sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 0.5 }}
                          >
                            <Typography variant="caption" noWrap>
                              {item.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Qty: {item.quantity} | Price: {formatCurrency(item.unitPrice)}
                            </Typography>
                          </Box>
                        ))}
                        {claudeAI.items.length > 5 && (
                          <Typography variant="caption" color="text.secondary">
                            +{claudeAI.items.length - 5} more items...
                          </Typography>
                        )}
                      </Box>
                    )}
                  </>
                )}

                <Button
                  variant={selectedParser === 'claude' ? 'contained' : 'outlined'}
                  color="secondary"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => handleSelectParser('claude')}
                  disabled={!claudeAI.success}
                >
                  {selectedParser === 'claude' ? 'Selected' : 'Use These Results'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Total comparison time: {compareResult.totalProcessingTimeMs}ms
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon color="primary" />
            <Typography variant="h6">Upload Vendor Offer</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose} aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Vendor Selection */}
          <FormControl fullWidth required>
            <InputLabel>Select Vendor</InputLabel>
            <Select
              value={selectedVendorIndex}
              onChange={(e) => {
                setSelectedVendorIndex(e.target.value as number);
                if (offerItems.length === 0) {
                  initializeOfferItems();
                }
              }}
              label="Select Vendor"
            >
              {rfq.vendorNames.map((name, index) => (
                <MenuItem key={rfq.vendorIds[index]} value={index}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Instructions */}
          <Alert severity="info">
            <Typography variant="body2">
              Upload the vendor&apos;s quotation document (PDF or Word). Click &quot;Compare AI
              Parsers&quot; to analyze the document with both Google Document AI and Claude AI, then
              choose which results to use.
            </Typography>
          </Alert>

          {/* File Upload */}
          {!file && (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              component="label"
            >
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                Click to upload vendor offer document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports .pdf, .doc, .docx files (max 20MB)
              </Typography>
            </Box>
          )}

          {/* Selected File */}
          {file && (
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={2} alignItems="center">
                  <DescriptionIcon color="primary" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024).toFixed(2)} KB •{' '}
                      {file.type === 'application/pdf' ? 'PDF' : 'Word Document'}
                      {fileUrl && ' • Uploaded'}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                  {canCompare && !showComparison && !parseResult && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<CompareIcon />}
                      onClick={handleCompareWithBothParsers}
                    >
                      Compare AI Parsers
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setFile(null);
                      setFileUrl('');
                      setParseResult(null);
                      setCompareResult(null);
                      setShowComparison(false);
                    }}
                    size="small"
                    disabled={uploading || parsing}
                  >
                    Remove
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* Progress */}
          {(uploading || parsing) && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {uploading ? 'Uploading document...' : 'Analyzing document with both AI parsers...'}
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {progress}% complete
              </Typography>
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Comparison View */}
          {showComparison && compareResult && renderComparisonView()}

          {/* Parse Result Summary (after selection) */}
          {parseResult && !showComparison && (
            <Paper sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">AI Parse Results</Typography>
                  <Chip
                    size="small"
                    label={parseResult.modelUsed}
                    color={parseResult.modelUsed.includes('Claude') ? 'secondary' : 'primary'}
                  />
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${parseResult.totalItemsFound} items found`}
                    color="success"
                    size="small"
                  />
                  <Chip
                    icon={<LinkIcon />}
                    label={`${parseResult.matchedItems} matched to RFQ`}
                    color="primary"
                    size="small"
                  />
                  {parseResult.unmatchedItems > 0 && (
                    <Chip
                      icon={<LinkOffIcon />}
                      label={`${parseResult.unmatchedItems} unmatched`}
                      color="warning"
                      size="small"
                    />
                  )}
                  <Chip
                    label={`${parseResult.processingTimeMs}ms`}
                    variant="outlined"
                    size="small"
                  />
                </Stack>

                {parseResult.warnings && parseResult.warnings.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {parseResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </Stack>
            </Paper>
          )}

          {/* Offer Header Details */}
          {(fileUrl || parseResult) && !showComparison && (
            <Accordion defaultExpanded={!!parseResult}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Offer Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Vendor Offer Number"
                      value={vendorOfferNumber}
                      onChange={(e) => setVendorOfferNumber(e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Vendor Offer Date"
                      type="date"
                      value={vendorOfferDate}
                      onChange={(e) => setVendorOfferDate(e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Validity Date"
                      type="date"
                      value={validityDate}
                      onChange={(e) => setValidityDate(e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Payment Terms"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                    />
                    <TextField
                      label="Delivery Terms"
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Stack>
                  <TextField
                    label="Warranty Terms"
                    value={warrantyTerms}
                    onChange={(e) => setWarrantyTerms(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Offer Items Table */}
          {offerItems.length > 0 && !showComparison && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Line Items ({offerItems.length})
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Enter quoted prices for each RFQ item. Items highlighted have AI-extracted data.
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={50}>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell width={80}>Qty</TableCell>
                      <TableCell width={80}>Unit</TableCell>
                      <TableCell width={120}>Unit Price</TableCell>
                      <TableCell width={80}>GST %</TableCell>
                      <TableCell width={120}>Amount</TableCell>
                      <TableCell width={80}>Match</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {offerItems.map((item, index) => {
                      const lineAmount = item.unitPrice * item.quotedQuantity;
                      const lineTax = (lineAmount * item.gstRate) / 100;
                      const lineTotal = lineAmount + lineTax;

                      return (
                        <TableRow
                          key={item.rfqItemId}
                          sx={{
                            bgcolor: item.isMatched ? 'success.50' : 'inherit',
                          }}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Tooltip title={`RFQ: ${item.rfqItemDescription}`}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {item.description}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={item.quotedQuantity}
                              onChange={(e) =>
                                handleItemChange(index, 'quotedQuantity', Number(e.target.value))
                              }
                              sx={{ width: 70 }}
                              inputProps={{ min: 0 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={item.unit}
                              onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                              sx={{ width: 70 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={item.unitPrice || ''}
                              onChange={(e) =>
                                handleItemChange(index, 'unitPrice', Number(e.target.value))
                              }
                              sx={{ width: 110 }}
                              inputProps={{ min: 0, step: 0.01 }}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                              }}
                              error={item.unitPrice <= 0}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={item.gstRate}
                              onChange={(e) =>
                                handleItemChange(index, 'gstRate', Number(e.target.value))
                              }
                              sx={{ width: 70 }}
                              inputProps={{ min: 0, max: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatCurrency(lineTotal)}</Typography>
                          </TableCell>
                          <TableCell>
                            {item.isMatched && item.matchConfidence !== undefined && (
                              <Chip
                                size="small"
                                label={`${Math.round(item.matchConfidence * 100)}%`}
                                color={getConfidenceColor(item.matchConfidence)}
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Paper sx={{ p: 2, mt: 2 }}>
                <Stack direction="row" justifyContent="flex-end" spacing={4}>
                  <Box textAlign="right">
                    <Typography variant="body2" color="text.secondary">
                      Subtotal
                    </Typography>
                    <Typography variant="body1">{formatCurrency(totals.subtotal)}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" color="text.secondary">
                      GST
                    </Typography>
                    <Typography variant="body1">{formatCurrency(totals.taxAmount)}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                    <Typography variant="h6">{formatCurrency(totals.totalAmount)}</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 2 }}>
        {/* Validation message when button is disabled */}
        {!canCreate && offerItems.length > 0 && !creating && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            {getCreateButtonTooltip()}
          </Alert>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={handleClose}>Cancel</Button>
          <Tooltip title={getCreateButtonTooltip()} arrow disableHoverListener={canCreate || false}>
            <span>
              <Button variant="contained" onClick={handleCreateOffer} disabled={!canCreate}>
                {creating ? 'Creating...' : 'Create Offer'}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
