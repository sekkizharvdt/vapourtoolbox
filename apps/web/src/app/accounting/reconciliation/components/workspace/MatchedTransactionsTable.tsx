/**
 * Matched Transactions Table Component
 *
 * Displays matched transactions with unmatch action
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
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { LinkOff as LinkOffIcon } from '@mui/icons-material';
import type { BankTransaction } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface MatchedTransactionsTableProps {
  transactions: BankTransaction[];
  onUnmatch: (txnId: string) => void;
}

export function MatchedTransactionsTable({
  transactions,
  onUnmatch,
}: MatchedTransactionsTableProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Matched Transactions ({transactions.length})
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Bank Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Match Type</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>{new Date(txn.transactionDate.toDate()).toLocaleDateString()}</TableCell>
                <TableCell>{txn.description}</TableCell>
                <TableCell align="right">
                  {formatCurrency(txn.debitAmount || txn.creditAmount)}
                </TableCell>
                <TableCell>
                  <Chip label={txn.matchType || 'MANUAL'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Unmatch">
                    <IconButton size="small" onClick={() => onUnmatch(txn.id!)}>
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
