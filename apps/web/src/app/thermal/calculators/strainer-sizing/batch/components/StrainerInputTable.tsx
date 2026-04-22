'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Button,
  Paper,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  getAvailableLineSizes,
  STRAINER_TYPE_LABELS,
  type StrainerType,
} from '@/lib/thermal/strainerSizingCalculator';

export interface StrainerRow {
  id: string;
  tag: string;
  flowRate: string;
  lineSize: string;
  strainerType: StrainerType;
}

interface StrainerInputTableProps {
  rows: StrainerRow[];
  onChange: (rows: StrainerRow[]) => void;
}

const LINE_SIZES = getAvailableLineSizes();

let nextId = 1;
export function createDefaultRows(): StrainerRow[] {
  return [
    {
      id: `str-${nextId++}`,
      tag: 'STR-001',
      flowRate: '50',
      lineSize: '4',
      strainerType: 'y_type',
    },
    {
      id: `str-${nextId++}`,
      tag: 'STR-002',
      flowRate: '100',
      lineSize: '6',
      strainerType: 'y_type',
    },
    {
      id: `str-${nextId++}`,
      tag: 'STR-003',
      flowRate: '200',
      lineSize: '8',
      strainerType: 'bucket_type',
    },
  ];
}

export function StrainerInputTable({ rows, onChange }: StrainerInputTableProps) {
  const updateRow = (index: number, field: keyof StrainerRow, value: string) => {
    const updated = rows.map((r, i): StrainerRow => {
      if (i !== index) return r;
      return { ...r, [field]: value };
    });
    onChange(updated);
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        id: `str-${nextId++}`,
        tag: `STR-${String(rows.length + 1).padStart(3, '0')}`,
        flowRate: '',
        lineSize: '4',
        strainerType: 'y_type',
      },
    ]);
  };

  const deleteRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Tag</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Flow (m&sup3;/hr)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Line Size</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 160 }}>Strainer Type</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell sx={{ py: 0.5 }}>
                  <TextField
                    value={row.tag}
                    onChange={(e) => updateRow(i, 'tag', e.target.value)}
                    size="small"
                    variant="standard"
                    fullWidth
                  />
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <TextField
                    value={row.flowRate}
                    onChange={(e) => updateRow(i, 'flowRate', e.target.value)}
                    type="number"
                    size="small"
                    variant="standard"
                    fullWidth
                  />
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <FormControl size="small" variant="standard" fullWidth>
                    <Select
                      value={row.lineSize}
                      onChange={(e) => updateRow(i, 'lineSize', e.target.value)}
                    >
                      {LINE_SIZES.map((nps) => (
                        <MenuItem key={nps} value={nps}>
                          {nps}&quot;
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <FormControl size="small" variant="standard" fullWidth>
                    <Select
                      value={row.strainerType}
                      onChange={(e) => updateRow(i, 'strainerType', e.target.value)}
                    >
                      {(Object.entries(STRAINER_TYPE_LABELS) as [StrainerType, string][]).map(
                        ([key, label]) => (
                          <MenuItem key={key} value={key}>
                            {label}
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <Tooltip title="Remove row">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => deleteRow(i)}
                        disabled={rows.length <= 1}
                        aria-label="Remove"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button startIcon={<AddIcon />} size="small" onClick={addRow} sx={{ m: 1 }}>
        Add Strainer
      </Button>
    </Paper>
  );
}
