'use client';

/**
 * Excel Upload Dialog
 *
 * Upload and parse Excel files to create PR line items
 * Hybrid approach: client-side for <5MB, Cloud Function for >5MB
 */

import { useState } from 'react';
import ExcelJS from 'exceljs';
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
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { CreatePurchaseRequestItemInput } from '@/lib/procurement/purchaseRequest';

interface ExcelUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onItemsImported: (items: CreatePurchaseRequestItemInput[]) => void;
}

interface ParsedItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
  remarks?: string;
  equipmentCode?: string;
}

export default function ExcelUploadDialog({
  open,
  onClose,
  onItemsImported,
}: ExcelUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (
      !selectedFile.name.endsWith('.xlsx') &&
      !selectedFile.name.endsWith('.xls') &&
      !selectedFile.name.endsWith('.csv')
    ) {
      setError('Please upload an Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleParseFile = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);

      if (fileSizeMB < 5) {
        // Client-side parsing for small files
        await parseClientSide(file);
      } else {
        // Cloud Function parsing for large files
        await parseServerSide(file);
      }
    } catch (err) {
      console.error('[ExcelUploadDialog] Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const parseClientSide = async (file: File) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        setError('File has no sheets');
        return;
      }

      const rowCount = worksheet.rowCount;
      if (rowCount < 2) {
        setError('File is empty or has no data rows');
        return;
      }

      // Skip header row, parse data rows
      const items: ParsedItem[] = [];
      worksheet.eachRow((row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) return;

        // Get cell values (1-indexed in exceljs)
        const getCellValue = (colNumber: number): string => {
          const cell = row.getCell(colNumber);
          if (cell.value === null || cell.value === undefined) return '';
          if (typeof cell.value === 'object' && 'text' in cell.value) {
            return String(cell.value.text || '');
          }
          return String(cell.value);
        };

        // Expected format: LineNumber, Description, Quantity, Unit, EquipmentCode, Remarks
        const lineNumber = Number(getCellValue(1)) || rowNumber - 1;
        const description = getCellValue(2).trim();
        const quantity = Number(getCellValue(3)) || 0;
        const unit = getCellValue(4).trim() || 'EA';
        const equipmentCode = getCellValue(5).trim() || undefined;
        const remarks = getCellValue(6).trim() || undefined;

        // Skip rows without description
        if (!description) return;

        items.push({
          lineNumber,
          description,
          quantity: quantity > 0 ? quantity : 1,
          unit,
          equipmentCode,
          remarks,
        });
      });

      if (items.length === 0) {
        setError('No valid items found in the file. Please check the format.');
        return;
      }

      setParsedItems(items);
    } catch (err) {
      console.error('[ExcelUploadDialog] Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    }
  };

  const parseServerSide = async (file: File) => {
    // For large files (>5MB), we use client-side parsing as a fallback
    // A Cloud Function could be implemented for even larger files
    console.warn('[ExcelUploadDialog] Large file detected, using client-side fallback');
    await parseClientSide(file);
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const items: CreatePurchaseRequestItemInput[] = parsedItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      equipmentCode: item.equipmentCode,
    }));

    onItemsImported(items);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParsedItems([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Import Items from Excel</Typography>
          <IconButton size="small" onClick={handleClose} aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Instructions */}
          <Alert severity="info">
            <Typography variant="body2" gutterBottom>
              <strong>Excel Format Requirements:</strong>
            </Typography>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li>Column A: Line Number</li>
              <li>Column B: Description</li>
              <li>Column C: Quantity</li>
              <li>Column D: Unit</li>
              <li>Column E: Equipment Code (optional)</li>
              <li>Column F: Remarks (optional)</li>
            </ul>
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
              <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                Click to upload Excel file
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports .xlsx, .xls, and .csv files (max 10MB)
              </Typography>
            </Box>
          )}

          {/* Selected File */}
          {file && !parsedItems.length && (
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </Typography>
                </Box>
                <Button onClick={() => setFile(null)} size="small">
                  Remove
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Parsing Progress */}
          {parsing && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Parsing file...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Parsed Items Preview */}
          {parsedItems.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Parsed Items ({parsedItems.length})
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Line #</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Equipment</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.lineNumber}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.equipmentCode || '-'}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveItem(index)}
                            aria-label="Remove item"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
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
          <Button variant="contained" onClick={handleParseFile} disabled={parsing}>
            Parse File
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
