/**
 * Unmatched Bank Transactions Table Component
 *
 * Displays unmatched bank transactions with selection capability
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
import type { BankTransaction } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface UnmatchedBankTableProps {
  transactions: BankTransaction[];
  selectedTxnId: string | null;
  onSelect: (txnId: string | null) => void;
}

export function UnmatchedBankTable({
  transactions,
  selectedTxnId,
  onSelect,
}: UnmatchedBankTableProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Unmatched Bank Transactions ({transactions.length})
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
            {transactions.map((txn) => (
              <TableRow
                key={txn.id}
                hover
                selected={selectedTxnId === txn.id}
                onClick={() => onSelect(selectedTxnId === txn.id ? null : txn.id!)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedTxnId === txn.id} />
                </TableCell>
                <TableCell>{new Date(txn.transactionDate.toDate()).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {txn.description}
                  </Typography>
                  {txn.chequeNumber && (
                    <Typography variant="caption" color="text.secondary">
                      Cheque: {txn.chequeNumber}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={txn.debitAmount > 0 ? 'error.main' : 'success.main'}
                  >
                    {txn.debitAmount > 0 ? '-' : '+'}
                    {formatCurrency(txn.debitAmount || txn.creditAmount)}
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
