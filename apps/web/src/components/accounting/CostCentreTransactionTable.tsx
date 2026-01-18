'use client';

/**
 * Generic Cost Centre Transaction Table
 *
 * Table for displaying invoices or bills associated with a cost centre.
 * Consolidates InvoicesTable and BillsTable from cost-centres/[id]/components.
 */

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

export type CostCentreTransactionType = 'invoice' | 'bill';

export interface CostCentreTransaction {
  id?: string;
  transactionNumber?: string;
  date?: Date;
  entityName?: string;
  totalAmount?: number;
  amount?: number;
  paidAmount?: number;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  referenceNumber?: string;
  reference?: string;
}

interface CostCentreTransactionTableProps {
  transactionType: CostCentreTransactionType;
  transactions: CostCentreTransaction[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function CostCentreTransactionTable({
  transactionType,
  transactions,
  formatCurrency,
  formatDate,
}: CostCentreTransactionTableProps) {
  const router = useRouter();

  const isInvoice = transactionType === 'invoice';
  const entityLabel = isInvoice ? 'Invoice' : 'Bill';
  const entitiesLabelLower = isInvoice ? 'invoices' : 'vendor bills';
  const counterpartyLabel = isInvoice ? 'Customer' : 'Vendor';
  const routePath = isInvoice ? '/accounting/invoices' : '/accounting/bills';

  if (transactions.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No {entitiesLabelLower} found for this cost centre.</Alert>
      </Box>
    );
  }

  /**
   * Get status chip color based on transaction status
   */
  const getStatusColor = (transaction: CostCentreTransaction) => {
    const status = transaction.paymentStatus || transaction.status;
    if (status === 'PAID') return 'success';
    if (status === 'PARTIALLY_PAID') return 'warning';
    if (status === 'POSTED') return 'info';
    return 'default';
  };

  /**
   * Get display status text
   */
  const getStatusText = (transaction: CostCentreTransaction) => {
    return transaction.paymentStatus || transaction.status || '-';
  };

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{entityLabel} #</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>{counterpartyLabel}</TableCell>
            {!isInvoice && <TableCell>Reference</TableCell>}
            <TableCell align="right">Amount</TableCell>
            {isInvoice && <TableCell align="right">Paid</TableCell>}
            <TableCell>Status</TableCell>
            {isInvoice && <TableCell align="center">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {transaction.transactionNumber}
                </Typography>
              </TableCell>
              <TableCell>{formatDate(transaction.date)}</TableCell>
              <TableCell>{transaction.entityName || '-'}</TableCell>
              {!isInvoice && (
                <TableCell>{transaction.referenceNumber || transaction.reference || '-'}</TableCell>
              )}
              <TableCell align="right">
                {formatCurrency(
                  transaction.totalAmount || transaction.amount,
                  transaction.currency
                )}
              </TableCell>
              {isInvoice && (
                <TableCell align="right">
                  {formatCurrency(transaction.paidAmount || 0, transaction.currency)}
                </TableCell>
              )}
              <TableCell>
                <Chip
                  label={getStatusText(transaction)}
                  color={getStatusColor(transaction)}
                  size="small"
                />
              </TableCell>
              {isInvoice && (
                <TableCell align="center">
                  <Tooltip title={`View ${entityLabel}`}>
                    <IconButton
                      size="small"
                      onClick={() => router.push(`${routePath}/${transaction.id}`)}
                    >
                      <OpenIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
