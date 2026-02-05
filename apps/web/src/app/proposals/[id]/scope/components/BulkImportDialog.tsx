'use client';

/**
 * Bulk Import Dialog
 *
 * Allows users to paste data from Excel/CSV to bulk import scope items.
 * Supports tab-separated values (Excel default) and comma-separated values.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ContentPaste as PasteIcon,
  Delete as DeleteIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import type { ScopeItem, ScopeItemType, ProjectPhase } from '@vapour/types';
import { PROJECT_PHASE_LABELS, PROJECT_PHASE_ORDER, SCOPE_ITEM_TYPE_LABELS } from '@vapour/types';

interface BulkImportDialogProps {
  open: boolean;
  type: ScopeItemType;
  onClose: () => void;
  onImport: (items: ScopeItem[]) => void;
  existingItems: ScopeItem[];
}

interface ParsedRow {
  name: string;
  description: string;
  phase?: ProjectPhase;
  quantity?: number;
  unit?: string;
  deliverable?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

// Map common phase names to ProjectPhase
const PHASE_ALIASES: Record<string, ProjectPhase> = {
  engineering: 'ENGINEERING',
  eng: 'ENGINEERING',
  design: 'ENGINEERING',
  procurement: 'PROCUREMENT',
  proc: 'PROCUREMENT',
  purchase: 'PROCUREMENT',
  manufacturing: 'MANUFACTURING',
  mfg: 'MANUFACTURING',
  fabrication: 'MANUFACTURING',
  fab: 'MANUFACTURING',
  logistics: 'LOGISTICS',
  shipping: 'LOGISTICS',
  transport: 'LOGISTICS',
  site: 'SITE',
  installation: 'SITE',
  erection: 'SITE',
  commissioning: 'COMMISSIONING',
  comm: 'COMMISSIONING',
  startup: 'COMMISSIONING',
  documentation: 'DOCUMENTATION',
  docs: 'DOCUMENTATION',
  documents: 'DOCUMENTATION',
};

function parsePhase(value: string): ProjectPhase | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();

  // Direct match
  if (PROJECT_PHASE_ORDER.includes(normalized.toUpperCase() as ProjectPhase)) {
    return normalized.toUpperCase() as ProjectPhase;
  }

  // Alias match
  return PHASE_ALIASES[normalized];
}

export function BulkImportDialog({
  open,
  type,
  onClose,
  onImport,
  existingItems,
}: BulkImportDialogProps) {
  const [rawData, setRawData] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [delimiter, setDelimiter] = useState<'tab' | 'comma'>('tab');
  const [hasHeaders, setHasHeaders] = useState(true);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRawData('');
      setParsedRows([]);
      setDelimiter('tab');
      setHasHeaders(true);
    }
  }, [open]);

  // Parse the raw data whenever it changes
  useEffect(() => {
    if (!rawData.trim()) {
      setParsedRows([]);
      return;
    }

    const sep = delimiter === 'tab' ? '\t' : ',';
    const lines = rawData.trim().split('\n');

    // Skip header row if specified
    const dataLines = hasHeaders ? lines.slice(1) : lines;

    const rows: ParsedRow[] = dataLines.map((line) => {
      const cols = line.split(sep).map((c) => c.trim());
      const errors: string[] = [];

      // Expected columns depend on type:
      // SERVICE: Name, Description, Phase, Deliverable, Notes
      // SUPPLY: Name, Description, Phase, Quantity, Unit, Notes
      // EXCLUSION: Name, Description, Notes

      const name = cols[0] || '';
      const description = cols[1] || '';

      if (!name) errors.push('Name is required');
      if (!description) errors.push('Description is required');

      let phase: ProjectPhase | undefined;
      let quantity: number | undefined;
      let unit: string | undefined;
      let deliverable: string | undefined;
      let notes: string | undefined;

      if (type === 'SERVICE') {
        phase = parsePhase(cols[2] || '');
        deliverable = cols[3] || undefined;
        notes = cols[4] || undefined;
      } else if (type === 'SUPPLY') {
        phase = parsePhase(cols[2] || '');
        const qtyStr = cols[3];
        if (qtyStr) {
          const parsed = parseFloat(qtyStr);
          if (!isNaN(parsed)) {
            quantity = parsed;
          } else {
            errors.push('Invalid quantity');
          }
        }
        unit = cols[4] || undefined;
        notes = cols[5] || undefined;
      } else {
        // EXCLUSION
        notes = cols[2] || undefined;
      }

      return {
        name,
        description,
        phase,
        quantity,
        unit,
        deliverable,
        notes,
        isValid: errors.length === 0 && !!name && !!description,
        errors,
      };
    });

    setParsedRows(rows);
  }, [rawData, delimiter, hasHeaders, type]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawData(text);

      // Auto-detect delimiter
      if (text.includes('\t')) {
        setDelimiter('tab');
      } else if (text.includes(',')) {
        setDelimiter('comma');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleDeleteRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    const existingCount = existingItems.filter((i) => i.type === type).length;

    const newItems: ScopeItem[] = validRows.map((row, index) => {
      const typePrefix = type === 'SERVICE' ? 'S' : type === 'SUPPLY' ? 'M' : 'E';
      const itemNumber =
        row.phase && type !== 'EXCLUSION'
          ? `${PROJECT_PHASE_ORDER.indexOf(row.phase) + 1}.${existingCount + index + 1}`
          : `${typePrefix}${existingCount + index + 1}`;

      return {
        id: crypto.randomUUID(),
        itemNumber,
        type,
        name: row.name,
        description: row.description,
        phase: row.phase,
        quantity: row.quantity,
        unit: row.unit,
        deliverable: row.deliverable,
        notes: row.notes,
        order: existingCount + index,
      };
    });

    onImport(newItems);
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  // Column headers based on type
  const getColumnHeaders = () => {
    if (type === 'SERVICE') {
      return ['Name*', 'Description*', 'Phase', 'Deliverable', 'Notes'];
    } else if (type === 'SUPPLY') {
      return ['Name*', 'Description*', 'Phase', 'Quantity', 'Unit', 'Notes'];
    } else {
      return ['Name*', 'Description*', 'Notes'];
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Bulk Import {SCOPE_ITEM_TYPE_LABELS[type]} Items</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            <Typography variant="body2">
              Copy data from Excel or CSV and paste below. Expected columns:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
              {getColumnHeaders().join(' | ')}
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              label="Paste data here"
              multiline
              rows={6}
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              fullWidth
              placeholder="Copy from Excel and paste here..."
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PasteIcon />}
                onClick={handlePasteFromClipboard}
              >
                Paste
              </Button>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Delimiter</InputLabel>
                <Select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value as 'tab' | 'comma')}
                  label="Delimiter"
                >
                  <MenuItem value="tab">Tab</MenuItem>
                  <MenuItem value="comma">Comma</MenuItem>
                </Select>
              </FormControl>
              <Button
                size="small"
                variant={hasHeaders ? 'contained' : 'outlined'}
                onClick={() => setHasHeaders(!hasHeaders)}
              >
                {hasHeaders ? 'Has Headers' : 'No Headers'}
              </Button>
            </Box>
          </Box>

          {parsedRows.length > 0 && (
            <>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="subtitle2">Preview ({parsedRows.length} rows)</Typography>
                {validCount > 0 && (
                  <Chip
                    icon={<ValidIcon />}
                    label={`${validCount} valid`}
                    color="success"
                    size="small"
                  />
                )}
                {invalidCount > 0 && (
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${invalidCount} invalid`}
                    color="error"
                    size="small"
                  />
                )}
              </Box>

              <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }}>#</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      {type !== 'EXCLUSION' && <TableCell>Phase</TableCell>}
                      {type === 'SUPPLY' && (
                        <>
                          <TableCell>Qty</TableCell>
                          <TableCell>Unit</TableCell>
                        </>
                      )}
                      {type === 'SERVICE' && <TableCell>Deliverable</TableCell>}
                      <TableCell>Status</TableCell>
                      <TableCell sx={{ width: 40 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedRows.map((row, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          bgcolor: row.isValid ? undefined : 'error.light',
                          '&:hover': { bgcolor: row.isValid ? 'action.hover' : 'error.light' },
                        }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.name || '-'}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.description || '-'}
                        </TableCell>
                        {type !== 'EXCLUSION' && (
                          <TableCell>{row.phase ? PROJECT_PHASE_LABELS[row.phase] : '-'}</TableCell>
                        )}
                        {type === 'SUPPLY' && (
                          <>
                            <TableCell>{row.quantity ?? '-'}</TableCell>
                            <TableCell>{row.unit || '-'}</TableCell>
                          </>
                        )}
                        {type === 'SERVICE' && <TableCell>{row.deliverable || '-'}</TableCell>}
                        <TableCell>
                          {row.isValid ? (
                            <ValidIcon color="success" fontSize="small" />
                          ) : (
                            <Tooltip title={row.errors.join(', ')}>
                              <ErrorIcon color="error" fontSize="small" />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleDeleteRow(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={validCount === 0}>
          Import {validCount} Items
        </Button>
      </DialogActions>
    </Dialog>
  );
}
