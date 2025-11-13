/**
 * PO Line Items Table Component
 *
 * Displays PO line items with delivery status
 */

'use client';

import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

interface POLineItemsTableProps {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
}

export function POLineItemsTable({ po, items }: POLineItemsTableProps) {
  return (
    <Paper>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Line Items
        </Typography>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Line</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Delivery Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.lineNumber}</TableCell>
                <TableCell>
                  <Typography variant="body2">{item.description}</Typography>
                  {item.makeModel && (
                    <Typography variant="caption" color="text.secondary">
                      {item.makeModel}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell align="right">{formatCurrency(item.unitPrice, po.currency)}</TableCell>
                <TableCell align="right">{formatCurrency(item.amount, po.currency)}</TableCell>
                <TableCell>
                  <Chip label={item.deliveryStatus} size="small" variant="outlined" />
                  <Typography variant="caption" display="block" color="text.secondary">
                    Delivered: {item.quantityDelivered}/{item.quantity}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
