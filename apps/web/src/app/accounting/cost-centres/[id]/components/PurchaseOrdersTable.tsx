'use client';

import {
  Alert,
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { OpenInNew as OpenIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { PurchaseOrder } from '@vapour/types';

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
}

export function PurchaseOrdersTable({ purchaseOrders, formatCurrency }: PurchaseOrdersTableProps) {
  const router = useRouter();

  if (purchaseOrders.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No purchase orders found for this cost centre.</Alert>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>PO #</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Vendor</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {purchaseOrders.map((po) => (
            <TableRow key={po.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {po.number}
                </Typography>
              </TableCell>
              <TableCell>{po.title || '-'}</TableCell>
              <TableCell>{po.vendorName || '-'}</TableCell>
              <TableCell align="right">{formatCurrency(po.grandTotal, po.currency)}</TableCell>
              <TableCell>
                <Chip
                  label={po.status}
                  color={
                    po.status === 'COMPLETED'
                      ? 'success'
                      : po.status === 'DELIVERED'
                        ? 'info'
                        : po.status === 'CANCELLED'
                          ? 'error'
                          : 'warning'
                  }
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="View PO">
                  <IconButton size="small" onClick={() => router.push(`/procurement/pos/${po.id}`)}>
                    <OpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
