/**
 * Line Items Step Component
 *
 * Second step of purchase request form for managing line items
 */

'use client';

import {
  Paper,
  Typography,
  Divider,
  Stack,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Upload as UploadIcon } from '@mui/icons-material';
import type { CreatePurchaseRequestItemInput } from '@/lib/procurement/purchaseRequestService';

interface LineItemsStepProps {
  lineItems: CreatePurchaseRequestItemInput[];
  onLineItemChange: (index: number, field: string, value: string | number) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onImportClick: () => void;
}

export function LineItemsStep({
  lineItems,
  onLineItemChange,
  onAddLineItem,
  onRemoveLineItem,
  onImportClick,
}: LineItemsStepProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Line Items ({lineItems.length})</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={onImportClick}
            size="small"
          >
            Import from Excel
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAddLineItem} size="small">
            Add Item
          </Button>
        </Stack>
      </Stack>
      <Divider sx={{ mb: 3 }} />

      {lineItems.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No line items added yet
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAddLineItem}>
            Add First Item
          </Button>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Line #</TableCell>
                <TableCell>Description *</TableCell>
                <TableCell width={100}>Quantity *</TableCell>
                <TableCell width={100}>Unit *</TableCell>
                <TableCell width={150}>Equipment Code</TableCell>
                <TableCell width={60}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <TextField
                      value={item.description}
                      onChange={(e) => onLineItemChange(index, 'description', e.target.value)}
                      placeholder="Item description"
                      size="small"
                      fullWidth
                      required
                      multiline
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onLineItemChange(index, 'quantity', parseFloat(e.target.value))
                      }
                      size="small"
                      fullWidth
                      required
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      value={item.unit}
                      onChange={(e) => onLineItemChange(index, 'unit', e.target.value)}
                      size="small"
                      fullWidth
                      required
                    >
                      <MenuItem value="NOS">NOS</MenuItem>
                      <MenuItem value="KG">KG</MenuItem>
                      <MenuItem value="METER">METER</MenuItem>
                      <MenuItem value="LITER">LITER</MenuItem>
                      <MenuItem value="BOX">BOX</MenuItem>
                      <MenuItem value="SET">SET</MenuItem>
                      <MenuItem value="UNIT">UNIT</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.equipmentCode || ''}
                      onChange={(e) => onLineItemChange(index, 'equipmentCode', e.target.value)}
                      placeholder="Optional"
                      size="small"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => onRemoveLineItem(index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
