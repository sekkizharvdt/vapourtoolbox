/**
 * PO Line Items Table Component
 *
 * Displays PO line items with delivery status. When `editable`, the HSN/SAC
 * code is captured inline (saved on blur) — it is not carried up the
 * offer→PO chain, so the buyer enters it here.
 */

'use client';

import { useState } from 'react';
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
  TextField,
} from '@mui/material';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import LineDimensionsChip from '@/components/procurement/LineDimensionsChip';

interface POLineItemsTableProps {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  /** When true, the HSN/SAC cell becomes an editable input. */
  editable?: boolean;
  /** Persist a new HSN/SAC code for a line item (called on blur when changed). */
  onUpdateHsnSac?: (itemId: string, hsnSacCode: string) => void | Promise<void>;
}

/**
 * Per-line discount display (feedback Mqj9wmh96ui3mlBtWNOF). New POs carry
 * discountType/discountValue/discountAmount copied from the vendor quote;
 * older POs only baked the discount into `amount`, so derive it from
 * quantity × unitPrice − amount.
 */
export function getLineDiscountAmount(item: PurchaseOrderItem): number {
  if (item.discountAmount != null) return item.discountAmount;
  const derived = item.quantity * item.unitPrice - item.amount;
  return derived > 0.005 ? Math.round(derived * 100) / 100 : 0;
}

function formatLineDiscount(item: PurchaseOrderItem, currency: string): string {
  const amount = getLineDiscountAmount(item);
  if (amount <= 0) return '—';
  const pct =
    item.discountType === 'PERCENT' && item.discountValue != null
      ? item.discountValue
      : item.quantity * item.unitPrice > 0
        ? Math.round((amount / (item.quantity * item.unitPrice)) * 10000) / 100
        : null;
  return `${formatCurrency(amount, currency)}${pct != null ? ` (${pct}%)` : ''}`;
}

function HsnSacCell({
  item,
  editable,
  onUpdateHsnSac,
}: {
  item: PurchaseOrderItem;
  editable: boolean;
  onUpdateHsnSac?: (itemId: string, hsnSacCode: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(item.hsnSacCode ?? '');

  if (!editable) {
    return <>{item.hsnSacCode || '—'}</>;
  }

  return (
    <TextField
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed !== (item.hsnSacCode ?? '')) {
          onUpdateHsnSac?.(item.id, trimmed);
        }
      }}
      size="small"
      variant="standard"
      placeholder="HSN/SAC"
      sx={{ width: 90 }}
    />
  );
}

export function POLineItemsTable({
  po,
  items,
  editable = false,
  onUpdateHsnSac,
}: POLineItemsTableProps) {
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
              <TableCell>Specification</TableCell>
              <TableCell>HSN/SAC</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Discount</TableCell>
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
                <TableCell>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {item.specification || '—'}
                  </Typography>
                  <LineDimensionsChip dimensions={item.dimensions} />
                </TableCell>
                <TableCell>
                  <HsnSacCell item={item} editable={editable} onUpdateHsnSac={onUpdateHsnSac} />
                </TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell align="right">{formatCurrency(item.unitPrice, po.currency)}</TableCell>
                <TableCell align="right">{formatLineDiscount(item, po.currency)}</TableCell>
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
