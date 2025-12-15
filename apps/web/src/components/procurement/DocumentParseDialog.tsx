'use client';

/**
 * Document Parse Dialog
 *
 * Upload and parse PDF/DOC files using Google Cloud Document AI
 * to extract structured data for Purchase Request creation.
 */

import { useState } from 'react';
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
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { CreatePurchaseRequestItemInput } from '@/lib/procurement/purchaseRequest';

interface DocumentParseDialogProps {
  open: boolean;
  onClose: () => void;
  onItemsImported: (items: CreatePurchaseRequestItemInput[]) => void;
  projectName?: string;
}

interface ParsedItem {
  lineNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  equipmentCode?: string;
  makeModel?: string;
  remarks?: string;
  confidence: {
    description: number;
    quantity: number;
    unit: number;
    overall: number;
  };
  sourceText?: string;
}

interface ParsedHeader {
  title?: string;
  description?: string;
  priority?: string;
  requiredBy?: string;
  documentDate?: string;
  documentReference?: string;
  vendor?: string;
  customer?: string;
}

interface ParseResult {
  success: boolean;
  header?: ParsedHeader;
  items: ParsedItem[];
  totalItemsFound: number;
  highConfidenceItems: number;
  lowConfidenceItems: number;
  warnings?: string[];
  errors?: string[];
  processingTimeMs: number;
  modelUsed: string;
  sourceFileName: string;
  sourceFileSize: number;
  pageCount?: number;
}

export default function DocumentParseDialog({
  open,
  onClose,
  onItemsImported,
  projectName,
}: DocumentParseDialogProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parsedHeader, setParsedHeader] = useState<ParsedHeader | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    // Validate file size (max 20MB)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size exceeds 20MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleParseFile = async () => {
    if (!file || !user) return;

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      // Upload file to Firebase Storage
      const { storage, functions } = getFirebase();
      const timestamp = Date.now();
      const storagePath = `parsing/${user.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      setProgress(20);
      await uploadBytes(storageRef, file);
      setProgress(40);
      setUploading(false);
      setParsing(true);

      // Call Cloud Function to parse
      const parseDocumentFn = httpsCallable<
        {
          fileName: string;
          storagePath: string;
          mimeType: string;
          fileSize: number;
          context?: {
            projectName?: string;
          };
        },
        ParseResult
      >(functions, 'parseDocumentForPR');

      setProgress(60);
      const result = await parseDocumentFn({
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        context: projectName ? { projectName } : undefined,
      });

      setProgress(100);

      if (result.data.success) {
        setParsedItems(result.data.items);
        setParsedHeader(result.data.header || null);
        setParseResult(result.data);
      } else {
        setError('Document parsing failed. Please try a different file or format.');
      }
    } catch (err) {
      console.error('[DocumentParseDialog] Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse document');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number, field: keyof ParsedItem, value: string | number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const handleImport = () => {
    const items: CreatePurchaseRequestItemInput[] = parsedItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      equipmentCode: item.equipmentCode,
      specification: item.specification,
      makeModel: item.makeModel,
    }));

    onItemsImported(items);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParsedItems([]);
    setParsedHeader(null);
    setParseResult(null);
    setError(null);
    setProgress(0);
    setEditingIndex(null);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon color="primary" />
            <Typography variant="h6">Import Items from Document</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Instructions */}
          <Alert severity="info">
            <Typography variant="body2">
              Upload a PDF or Word document containing item lists (e.g., quotation, BOQ, or
              specification sheet). The AI will extract line items automatically.
            </Typography>
          </Alert>

          {/* File Upload */}
          {!file && !parsedItems.length && (
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
                Click to upload PDF or Word document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports .pdf, .doc, .docx files (max 20MB)
              </Typography>
            </Box>
          )}

          {/* Selected File */}
          {file && !parsedItems.length && (
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
                    </Typography>
                  </Box>
                </Stack>
                <Button onClick={() => setFile(null)} size="small" disabled={uploading || parsing}>
                  Remove
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Progress */}
          {(uploading || parsing) && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {uploading ? 'Uploading document...' : 'Analyzing document with AI...'}
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

          {/* Parse Result Summary */}
          {parseResult && parsedItems.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Parse Results</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${parseResult.totalItemsFound} items found`}
                    color="success"
                    size="small"
                  />
                  {parseResult.highConfidenceItems > 0 && (
                    <Chip
                      label={`${parseResult.highConfidenceItems} high confidence`}
                      color="success"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {parseResult.lowConfidenceItems > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={`${parseResult.lowConfidenceItems} need review`}
                      color="warning"
                      size="small"
                    />
                  )}
                  <Chip
                    label={`${parseResult.processingTimeMs}ms`}
                    variant="outlined"
                    size="small"
                  />
                  {parseResult.pageCount && (
                    <Chip
                      label={`${parseResult.pageCount} pages`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Stack>

                {/* Warnings */}
                {parseResult.warnings && parseResult.warnings.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {parseResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {/* Parsed Header Info */}
                {parsedHeader && (parsedHeader.title || parsedHeader.documentReference) && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Detected document info:
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      {parsedHeader.title && (
                        <Chip label={`Title: ${parsedHeader.title}`} size="small" />
                      )}
                      {parsedHeader.documentReference && (
                        <Chip label={`Ref: ${parsedHeader.documentReference}`} size="small" />
                      )}
                      {parsedHeader.vendor && (
                        <Chip label={`Vendor: ${parsedHeader.vendor}`} size="small" />
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>
          )}

          {/* Parsed Items Table */}
          {parsedItems.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Extracted Items ({parsedItems.length})
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Review and edit items before importing. Low confidence items may need manual
                correction.
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={50}>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell width={80}>Qty</TableCell>
                      <TableCell width={80}>Unit</TableCell>
                      <TableCell width={100}>Confidence</TableCell>
                      <TableCell width={80}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedItems.map((item, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          bgcolor: item.confidence.overall < 0.5 ? 'warning.50' : 'inherit',
                        }}
                      >
                        <TableCell>{item.lineNumber}</TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={item.description}
                              onChange={(e) => handleEditItem(index, 'description', e.target.value)}
                              onBlur={() => setEditingIndex(null)}
                              autoFocus
                            />
                          ) : (
                            <Tooltip title={item.sourceText || item.description}>
                              <span>{item.description}</span>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <TextField
                              type="number"
                              size="small"
                              value={item.quantity}
                              onChange={(e) =>
                                handleEditItem(index, 'quantity', Number(e.target.value))
                              }
                              onBlur={() => setEditingIndex(null)}
                              sx={{ width: 70 }}
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <TextField
                              size="small"
                              value={item.unit}
                              onChange={(e) => handleEditItem(index, 'unit', e.target.value)}
                              onBlur={() => setEditingIndex(null)}
                              sx={{ width: 70 }}
                            />
                          ) : (
                            item.unit
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getConfidenceLabel(item.confidence.overall)}
                            color={getConfidenceColor(item.confidence.overall)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => setEditingIndex(index)}
                              title="Edit"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveItem(index)}
                              title="Remove"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {file && !parsedItems.length && (
          <Button
            variant="contained"
            onClick={handleParseFile}
            disabled={uploading || parsing}
            startIcon={uploading || parsing ? undefined : <CloudUploadIcon />}
          >
            {uploading ? 'Uploading...' : parsing ? 'Analyzing...' : 'Parse Document'}
          </Button>
        )}
        {parsedItems.length > 0 && (
          <Button variant="contained" onClick={handleImport}>
            Import {parsedItems.length} Items
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
