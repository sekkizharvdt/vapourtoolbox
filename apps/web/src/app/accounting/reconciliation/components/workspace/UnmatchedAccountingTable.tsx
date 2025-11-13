/**
 * Unmatched Accounting Transactions Table Component
 *
 * Displays unmatched accounting transactions with selection capability
 */

'use client';

import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
} from '@mui/material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface UnmatchedAccountingTableProps {
  transactions: unknown[];
  selectedTxnId: string | null;
  onSelect: (txnId: string | null) => void;
}

export function UnmatchedAccountingTable({
  transactions,
  selectedTxnId,
  onSelect,
}: UnmatchedAccountingTableProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Unmatched Accounting Transactions ({transactions.length})
      </Typography>
      <TableContainer sx={{ maxHeight: 500 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((txn) => {
              const typedTxn = txn as {
                id?: string;
                date?: { toDate: () => Date };
                description?: string;
                transactionNumber?: string;
                amount?: number;
                totalAmount?: number;
              };
              return (
                <TableRow
                  key={typedTxn.id}
                  hover
                  selected={selectedTxnId === typedTxn.id}
                  onClick={() => onSelect(selectedTxnId === typedTxn.id ? null : typedTxn.id!)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedTxnId === typedTxn.id} />
                  </TableCell>
                  <TableCell>
                    {typedTxn.date && new Date(typedTxn.date.toDate()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {typedTxn.description}
                    </Typography>
                    {typedTxn.transactionNumber && (
                      <Typography variant="caption" color="text.secondary">
                        {typedTxn.transactionNumber}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(typedTxn.amount || typedTxn.totalAmount || 0)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
