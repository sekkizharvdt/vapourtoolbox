'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Typography,
  Paper,
  MenuItem,
  Box,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { LineItem, GSTDetails } from '@vapour/types';

const GST_RATE_SUGGESTIONS = [0, 5, 12, 18, 28];

/**
 * Returns common GST rate suggestions for India
 */
function getGSTRateSuggestions(): number[] {
  return GST_RATE_SUGGESTIONS;
}

interface LineItemsTableProps {
  /**
   * Array of line items to display
   */
  lineItems: LineItem[];
  /**
   * Callback to update a specific field of a line item
   */
  onUpdateLineItem: (index: number, field: keyof LineItem, value: string | number) => void;
  /**
   * Callback to remove a line item
   */
  onRemoveLineItem: (index: number) => void;
  /**
   * Callback to add a new line item
   */
  onAddLineItem: () => void;
  /**
   * Subtotal amount (sum of all line item amounts)
   */
  subtotal: number;
  /**
   * GST calculation result (CGST/SGST or IGST breakdown)
   */
  gstDetails?: GSTDetails;
  /**
   * TDS deduction amount (for bills only)
   */
  tdsAmount?: number;
  /**
   * TDS rate percentage (for bills only)
   */
  tdsRate?: number;
  /**
   * Total amount including GST and TDS adjustments
   */
  totalAmount: number;
  /**
   * Whether line items can be removed (disable remove button when only 1 item)
   */
  minItems?: number;
  /**
   * Whether the table is read-only
   */
  readOnly?: boolean;
}

/**
 * Reusable table component for displaying and editing line items in invoices and bills.
 * Includes automatic amount calculation, GST breakdown, and optional TDS row.
 *
 * @example
 * ```tsx
 * <LineItemsTable
 *   lineItems={lineItems}
 *   onUpdateLineItem={updateLineItem}
 *   onRemoveLineItem={removeLineItem}
 *   onAddLineItem={addLineItem}
 *   subtotal={subtotal}
 *   gstDetails={gstDetails}
 *   totalAmount={grandTotal}
 * />
 * ```
 */
export function LineItemsTable({
  lineItems,
  onUpdateLineItem,
  onRemoveLineItem,
  onAddLineItem,
  subtotal,
  gstDetails,
  tdsAmount,
  tdsRate,
  totalAmount,
  minItems = 1,
  readOnly = false,
}: LineItemsTableProps) {
  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="30%">Description</TableCell>
              <TableCell width="10%" align="right">
                Qty
              </TableCell>
              <TableCell width="15%" align="right">
                Unit Price
              </TableCell>
              <TableCell width="10%" align="right">
                GST %
              </TableCell>
              <TableCell width="10%">HSN Code</TableCell>
              <TableCell width="15%" align="right">
                Amount
              </TableCell>
              {!readOnly && (
                <TableCell width="10%" align="right">
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    value={item.description}
                    onChange={(e) => onUpdateLineItem(index, 'description', e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)
                    }
                    inputProps={{ min: 0, step: 0.01 }}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      onUpdateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    inputProps={{ min: 0, step: 0.01 }}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    value={item.gstRate}
                    onChange={(e) =>
                      onUpdateLineItem(index, 'gstRate', parseFloat(e.target.value))
                    }
                    disabled={readOnly}
                  >
                    {getGSTRateSuggestions().map((rate) => (
                      <MenuItem key={rate} value={rate}>
                        {rate}%
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    value={item.hsnCode}
                    onChange={(e) => onUpdateLineItem(index, 'hsnCode', e.target.value)}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{item.amount.toFixed(2)}</Typography>
                </TableCell>
                {!readOnly && (
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => onRemoveLineItem(index)}
                      disabled={lineItems.length <= minItems}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {/* Subtotal Row */}
            <TableRow>
              <TableCell colSpan={5} align="right">
                <Typography variant="subtitle2">Subtotal:</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" fontWeight="bold">
                  {subtotal.toFixed(2)}
                </Typography>
              </TableCell>
              {!readOnly && <TableCell />}
            </TableRow>

            {/* GST Breakdown Rows */}
            {gstDetails && (
              <>
                {gstDetails.gstType === 'CGST_SGST' && (
                  <>
                    <TableRow>
                      <TableCell colSpan={5} align="right">
                        <Typography variant="body2">
                          CGST ({gstDetails.cgstRate}%):
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {gstDetails.cgstAmount?.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {!readOnly && <TableCell />}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} align="right">
                        <Typography variant="body2">
                          SGST ({gstDetails.sgstRate}%):
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {gstDetails.sgstAmount?.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {!readOnly && <TableCell />}
                    </TableRow>
                  </>
                )}
                {gstDetails.gstType === 'IGST' && (
                  <TableRow>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="body2">IGST ({gstDetails.igstRate}%):</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {gstDetails.igstAmount?.toFixed(2)}
                      </Typography>
                    </TableCell>
                    {!readOnly && <TableCell />}
                  </TableRow>
                )}
              </>
            )}

            {/* TDS Deduction Row (for bills only) */}
            {tdsAmount !== undefined && tdsAmount > 0 && tdsRate !== undefined && (
              <TableRow>
                <TableCell colSpan={5} align="right">
                  <Typography variant="body2" color="error">
                    TDS Deducted ({tdsRate}%):
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="error">
                    -{tdsAmount.toFixed(2)}
                  </Typography>
                </TableCell>
                {!readOnly && <TableCell />}
              </TableRow>
            )}

            {/* Total Amount Row */}
            <TableRow>
              <TableCell colSpan={5} align="right">
                <Typography variant="h6">Total Amount:</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" fontWeight="bold">
                  {totalAmount.toFixed(2)}
                </Typography>
              </TableCell>
              {!readOnly && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Line Item Button */}
      {!readOnly && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={onAddLineItem}
            size="small"
          >
            Add Line Item
          </Button>
        </Box>
      )}
    </Box>
  );
}
