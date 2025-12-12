'use client';

import {
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { MatchLineItem } from '@vapour/types';

interface LineItemsTableProps {
  lineItems: MatchLineItem[];
}

export function LineItemsTable({ lineItems }: LineItemsTableProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Line Items ({lineItems.length})
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">PO Qty</TableCell>
              <TableCell align="right">GR Qty</TableCell>
              <TableCell align="right">Bill Qty</TableCell>
              <TableCell align="right">Variance</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.lineNumber}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{item.orderedQuantity}</TableCell>
                <TableCell align="right">{item.receivedQuantity}</TableCell>
                <TableCell align="right">{item.invoicedQuantity}</TableCell>
                <TableCell align="right">
                  <Typography
                    color={Math.abs(item.quantityVariance) < 0.01 ? 'success.main' : 'error.main'}
                  >
                    {item.quantityVariance}
                  </Typography>
                </TableCell>
                <TableCell>
                  {item.quantityMatched ? (
                    <Chip label="Matched" color="success" size="small" />
                  ) : (
                    <Chip label="Variance" color="warning" size="small" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
