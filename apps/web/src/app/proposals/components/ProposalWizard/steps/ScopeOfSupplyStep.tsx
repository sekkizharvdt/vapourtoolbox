'use client';

import { useState } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { ImportBOMDialog } from '../ImportBOMDialog';
import { useFirestore } from '@/lib/firebase/hooks';
import { getBOMItems } from '@/lib/bom/bomService';
import type { ProposalLineItem } from '@vapour/types';

const CATEGORIES = [
  'EQUIPMENT',
  'MATERIAL',
  'SERVICE',
  'DESIGN',
  'INSTALLATION',
  'COMMISSIONING',
  'TRAINING',
  'OTHER',
];

export function ScopeOfSupplyStep() {
  const { control, register } = useFormContext();
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'scopeOfSupply',
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const db = useFirestore();

  const handleImportBOM = async (bomId: string) => {
    if (!db) return;
    setImportError(null);
    try {
      const items = await getBOMItems(db, bomId);

      const proposalItems: ProposalLineItem[] = items.map((item, index) => {
        const totalAmount =
          (item.cost?.totalMaterialCost?.amount || 0) +
          (item.cost?.totalFabricationCost?.amount || 0) +
          (item.cost?.totalServiceCost?.amount || 0);

        const currency = item.cost?.totalMaterialCost?.currency || 'INR';

        return {
          id: crypto.randomUUID(),
          itemNumber: `${index + 1}`,
          itemName: item.name,
          description: item.description || item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: 'EQUIPMENT', // Default, logic could be improved
          unitPrice: {
            amount: item.quantity ? totalAmount / item.quantity : 0,
            currency: currency,
          },
          totalPrice: {
            amount: totalAmount,
            currency: currency,
          },
          bomItemId: item.id,
        };
      });

      replace(proposalItems);
      setImportDialogOpen(false);
    } catch (error) {
      console.error('Error importing BOM:', error);
      setImportError('Failed to import BOM items. Please try again.');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Scope of Supply</Typography>
        <Button
          variant="outlined"
          startIcon={<CloudDownloadIcon />}
          onClick={() => setImportDialogOpen(true)}
        >
          Import from BOM
        </Button>
      </Box>

      {importError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setImportError(null)}>
          {importError}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="20%">Item Name</TableCell>
              <TableCell width="25%">Description</TableCell>
              <TableCell width="15%">Category</TableCell>
              <TableCell width="10%">Qty</TableCell>
              <TableCell width="10%">Unit</TableCell>
              <TableCell width="15%">Unit Price</TableCell>
              <TableCell width="5%"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <TextField
                    {...register(`scopeOfSupply.${index}.itemName`)}
                    fullWidth
                    size="small"
                    variant="standard"
                    placeholder="Item Name"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    {...register(`scopeOfSupply.${index}.description`)}
                    fullWidth
                    size="small"
                    variant="standard"
                    placeholder="Description"
                  />
                </TableCell>
                <TableCell>
                  <Controller
                    name={`scopeOfSupply.${index}.category`}
                    control={control}
                    defaultValue="EQUIPMENT"
                    render={({ field }) => (
                      <TextField {...field} select fullWidth size="small" variant="standard">
                        {CATEGORIES.map((cat) => (
                          <MenuItem key={cat} value={cat}>
                            {cat}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    {...register(`scopeOfSupply.${index}.quantity`, { valueAsNumber: true })}
                    type="number"
                    fullWidth
                    size="small"
                    variant="standard"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    {...register(`scopeOfSupply.${index}.unit`)}
                    fullWidth
                    size="small"
                    variant="standard"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    {...register(`scopeOfSupply.${index}.unitPrice.amount`, {
                      valueAsNumber: true,
                    })}
                    type="number"
                    fullWidth
                    size="small"
                    variant="standard"
                    InputProps={{
                      startAdornment: (
                        <Typography variant="caption" sx={{ mr: 0.5 }}>
                          ₹
                        </Typography>
                      ),
                    }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => remove(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No items added. Import from BOM or add manually.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddIcon />}
        onClick={() =>
          append({
            itemName: '',
            description: '',
            quantity: 1,
            unit: 'Nos',
            category: 'EQUIPMENT',
            unitPrice: { amount: 0, currency: 'INR' },
            totalPrice: { amount: 0, currency: 'INR' },
          })
        }
        sx={{ mt: 2 }}
      >
        Add Item
      </Button>

      <ImportBOMDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSelect={handleImportBOM}
      />
    </Box>
  );
}
