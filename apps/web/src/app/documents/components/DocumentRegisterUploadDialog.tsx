'use client';

/**
 * Document Register Upload Dialog
 *
 * Upload and parse Excel files to create master document entries
 * for a project's document register (checklist of required documents)
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
  Chip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  bulkCreateMasterDocuments,
  checkDuplicateDocumentNumbers,
  type DocumentRegisterRow,
  type BulkImportResult,
} from '@/lib/documents/masterDocumentService';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentRegisterUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectCode: string;
  onDocumentsImported: () => void;
}

interface ParsedRow extends DocumentRegisterRow {
  rowNumber: number;
  isDuplicate?: boolean;
}

export default function DocumentRegisterUploadDialog({
  open,
  onClose,
  projectId,
  projectCode,
  onDocumentsImported,
}: DocumentRegisterUploadDialogProps) {
  const { db } = getFirebase();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsedRows([]);
    setDuplicates([]);
    setImportResult(null);
  };

  const handleParseFile = async () => {
    if (!file || !db) return;

    setParsing(true);
    setError(null);

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

      // Parse rows
      const rows: ParsedRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) return;

        const getCellValue = (colNumber: number): string => {
          const cell = row.getCell(colNumber);
          if (cell.value === null || cell.value === undefined) return '';
          if (typeof cell.value === 'object' && 'text' in cell.value) {
            return String(cell.value.text || '');
          }
          return String(cell.value);
        };

        // Expected format: Document Number, Document Title, Discipline Code, Document Type, Description
        const documentNumber = getCellValue(1).trim();
        const documentTitle = getCellValue(2).trim();
        const disciplineCode = getCellValue(3).trim() || undefined;
        const documentType = getCellValue(4).trim() || undefined;
        const description = getCellValue(5).trim() || undefined;

        // Skip rows without both document number and title
        if (!documentNumber && !documentTitle) return;

        rows.push({
          rowNumber,
          documentNumber,
          documentTitle,
          disciplineCode,
          documentType,
          description,
        });
      });

      if (rows.length === 0) {
        setError('No valid rows found. Ensure each row has a Document Number and Title.');
        return;
      }

      // Check for duplicates in existing project documents
      const docNumbers = rows.map((r) => r.documentNumber).filter(Boolean);
      const existingDuplicates = await checkDuplicateDocumentNumbers(db, projectId, docNumbers);
      setDuplicates(existingDuplicates);

      // Mark duplicates in parsed rows
      const duplicateSet = new Set(existingDuplicates.map((d) => d.toLowerCase()));
      const markedRows = rows.map((row) => ({
        ...row,
        isDuplicate: duplicateSet.has(row.documentNumber.toLowerCase()),
      }));

      setParsedRows(markedRows);
    } catch (err) {
      console.error('[DocumentRegisterUploadDialog] Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    } finally {
      setParsing(false);
    }
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!user) {
      setError('You must be logged in to import documents');
      return;
    }

    // Filter out duplicates and invalid rows
    const validRows = parsedRows.filter(
      (row) => !row.isDuplicate && row.documentNumber && row.documentTitle
    );

    if (validRows.length === 0) {
      setError('No valid rows to import');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await bulkCreateMasterDocuments(
        projectId,
        projectCode,
        validRows,
        user.uid,
        user.displayName || user.email || 'Unknown User'
      );

      setImportResult(result);

      if (result.created > 0) {
        onDocumentsImported();
      }
    } catch (err) {
      console.error('[DocumentRegisterUploadDialog] Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import documents');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Document Register');

    // Add headers
    worksheet.columns = [
      { header: 'Document Number', key: 'documentNumber', width: 20 },
      { header: 'Document Title', key: 'documentTitle', width: 40 },
      { header: 'Discipline Code', key: 'disciplineCode', width: 15 },
      { header: 'Document Type', key: 'documentType', width: 15 },
      { header: 'Description', key: 'description', width: 50 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add example rows
    worksheet.addRows([
      {
        documentNumber: `${projectCode}-01-001`,
        documentTitle: 'Process Flow Diagram',
        disciplineCode: '01',
        documentType: 'DRAWING',
        description: 'Main process flow diagram for the project',
      },
      {
        documentNumber: `${projectCode}-02-001`,
        documentTitle: 'General Arrangement Drawing',
        disciplineCode: '02',
        documentType: 'DRAWING',
        description: 'Equipment layout and general arrangement',
      },
      {
        documentNumber: `${projectCode}-03-001`,
        documentTitle: 'Structural Calculations',
        disciplineCode: '03',
        documentType: 'CALCULATION',
        description: 'Structural design calculations',
      },
    ]);

    // Generate and download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `document_register_template_${projectCode}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setDuplicates([]);
    setError(null);
    setImportResult(null);
    onClose();
  };

  const validRowCount = parsedRows.filter(
    (row) => !row.isDuplicate && row.documentNumber && row.documentTitle
  ).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Import Document Register</Typography>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Import Result */}
          {importResult && (
            <Alert severity={importResult.errors.length > 0 ? 'warning' : 'success'}>
              <Typography variant="body2" fontWeight={600}>
                Import completed: {importResult.created} documents created
              </Typography>
              {importResult.errors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="error">
                    {importResult.errors.length} rows had errors:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {importResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row} ({err.documentNumber}): {err.message}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...and {importResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </Box>
              )}
            </Alert>
          )}

          {/* Instructions */}
          <Alert severity="info">
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="body2" gutterBottom fontWeight={600}>
                  Excel Format Requirements:
                </Typography>
                <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
                  <li>
                    Column A: <strong>Document Number</strong> (required)
                  </li>
                  <li>
                    Column B: <strong>Document Title</strong> (required)
                  </li>
                  <li>
                    Column C: Discipline Code (optional, e.g., &quot;01&quot;, &quot;02&quot;)
                  </li>
                  <li>
                    Column D: Document Type (optional, e.g., &quot;DRAWING&quot;, &quot;SPEC&quot;)
                  </li>
                  <li>Column E: Description (optional)</li>
                </ul>
              </Box>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ flexShrink: 0 }}
              >
                Download Template
              </Button>
            </Stack>
          </Alert>

          {/* Duplicates Warning */}
          {duplicates.length > 0 && (
            <Alert severity="warning" icon={<WarningIcon />}>
              <Typography variant="body2" fontWeight={600}>
                {duplicates.length} document number(s) already exist in this project:
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {duplicates.slice(0, 10).map((num) => (
                  <Chip key={num} label={num} size="small" color="warning" />
                ))}
                {duplicates.length > 10 && (
                  <Chip label={`+${duplicates.length - 10} more`} size="small" variant="outlined" />
                )}
              </Box>
              <Typography variant="body2" sx={{ mt: 1 }}>
                These will be skipped during import.
              </Typography>
            </Alert>
          )}

          {/* File Upload */}
          {!file && !parsedRows.length && !importResult && (
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
              <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileSelect} />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                Click to upload Excel file
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports .xlsx and .xls files (max 10MB)
              </Typography>
            </Box>
          )}

          {/* Selected File */}
          {file && !parsedRows.length && !importResult && (
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

          {/* Importing Progress */}
          {importing && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Importing {validRowCount} documents...
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

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && !importResult && (
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">
                  Parsed Rows ({parsedRows.length} total, {validRowCount} valid)
                </Typography>
                {duplicates.length > 0 && (
                  <Typography variant="caption" color="warning.main">
                    {duplicates.length} duplicates will be skipped
                  </Typography>
                )}
              </Stack>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Document Number</TableCell>
                      <TableCell>Document Title</TableCell>
                      <TableCell>Discipline</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedRows.map((row, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          bgcolor: row.isDuplicate ? 'warning.lighter' : undefined,
                          opacity: row.isDuplicate ? 0.7 : 1,
                        }}
                      >
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.documentNumber || <em>Missing</em>}</TableCell>
                        <TableCell>{row.documentTitle || <em>Missing</em>}</TableCell>
                        <TableCell>{row.disciplineCode || '-'}</TableCell>
                        <TableCell>{row.documentType || '-'}</TableCell>
                        <TableCell>
                          {row.isDuplicate ? (
                            <Chip label="Duplicate" size="small" color="warning" />
                          ) : !row.documentNumber || !row.documentTitle ? (
                            <Chip label="Invalid" size="small" color="error" />
                          ) : (
                            <Chip label="Valid" size="small" color="success" />
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleRemoveRow(index)}>
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
        <Button onClick={handleClose}>{importResult ? 'Close' : 'Cancel'}</Button>
        {file && !parsedRows.length && !importResult && (
          <Button variant="contained" onClick={handleParseFile} disabled={parsing}>
            Parse File
          </Button>
        )}
        {parsedRows.length > 0 && !importResult && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || validRowCount === 0}
          >
            Import {validRowCount} Documents
          </Button>
        )}
        {importResult && importResult.created > 0 && (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
