'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Chip,
  Breadcrumbs,
  Link,
  Collapse,
  IconButton,
  Button,
} from '@mui/material';
import {
  Home as HomeIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  OpenInNew as OpenInNewIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { TransactionType } from '@vapour/types';
import { TRANSACTION_TYPE_SHORT_LABELS } from '@vapour/constants';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { getTransactionRoute } from '@/lib/accounting/reports/glDrilldown';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';

interface LedgerEntry {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
  entityId?: string;
  entityName?: string;
}

interface Transaction {
  id: string;
  type: string;
  date: unknown;
  transactionDate?: unknown;
  description: string;
  entries: LedgerEntry[];
  transactionNumber?: string;
  referenceNumber?: string;
  vendorInvoiceNumber?: string;
  entityName?: string;
  status?: string;
}

// Helper to safely convert Firestore Timestamp or Date to Date
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

interface LedgerLine {
  date: Date;
  description: string;
  typeLabel: string;
  type: string;
  reference: string;
  vendorRef?: string;
  debit: number;
  credit: number;
  balance: number;
  transactionId: string;
  allEntries: LedgerEntry[];
  entityName?: string;
  status?: string;
}

function getTransactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_SHORT_LABELS[type as TransactionType] ?? (type || 'Entry');
}

export default function AccountLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get('accountId');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preselectedAccountId);
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'Dr' | 'Cr'>('Dr');
  const [closingBalance, setClosingBalance] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Sync preselected account from URL
  useEffect(() => {
    if (preselectedAccountId) {
      setSelectedAccountId(preselectedAccountId);
    }
  }, [preselectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountLedger(selectedAccountId);
    } else {
      setLedgerLines([]);
      setOpeningBalance(0);
      setClosingBalance(0);
    }
  }, [selectedAccountId]);

  const loadAccountLedger = async (accountId: string) => {
    setLoadingLedger(true);
    setExpandedRow(null);
    try {
      const { db } = getFirebase();

      // Fetch account record to get actual opening balance
      const accountDoc = await getDoc(doc(db, COLLECTIONS.ACCOUNTS, accountId));
      const accountData = accountDoc.data();
      const acctOpeningBalance = accountData?.openingBalance ?? 0;
      const acctCode = accountData?.code ?? '';
      const firstChar = acctCode.charAt(0);
      const balType: 'Dr' | 'Cr' = ['1', '5', '6', '7'].includes(firstChar) ? 'Dr' : 'Cr';
      setOpeningBalance(acctOpeningBalance);
      setOpeningBalanceType(balType);

      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
      const snapshot = await getDocs(transactionsRef);

      const lines: LedgerLine[] = [];
      let runningBalance = acctOpeningBalance;

      // Get all transactions and filter those affecting this account
      const relevantTransactions: Transaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Transaction;
        const hasEntry = data.entries?.some((entry) => entry.accountId === accountId);
        if (hasEntry) {
          relevantTransactions.push({ ...data, id: doc.id });
        }
      });

      // Sort by date ascending (use safe conversion — some transactions may have
      // transactionDate instead of date, or Firestore Timestamps vs Date objects)
      relevantTransactions.sort((a, b) => {
        const dateA = toDate(a.date) || toDate(a.transactionDate) || new Date(0);
        const dateB = toDate(b.date) || toDate(b.transactionDate) || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      // Build ledger lines with running balance
      relevantTransactions.forEach((transaction) => {
        transaction.entries.forEach((entry) => {
          if (entry.accountId === accountId) {
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;
            runningBalance += debit - credit;

            const txnDate =
              toDate(transaction.date) || toDate(transaction.transactionDate) || new Date();

            lines.push({
              date: txnDate,
              description: entry.description || transaction.description || '',
              typeLabel: getTransactionTypeLabel(transaction.type),
              type: transaction.type,
              reference:
                transaction.transactionNumber || transaction.referenceNumber || transaction.id,
              vendorRef: transaction.vendorInvoiceNumber,
              debit,
              credit,
              balance: runningBalance,
              transactionId: transaction.id,
              allEntries: transaction.entries,
              entityName: transaction.entityName,
              status: transaction.status,
            });
          }
        });
      });

      setClosingBalance(runningBalance);
      setLedgerLines(lines);
    } catch (error) {
      console.error('Error loading account ledger:', error);
    } finally {
      setLoadingLedger(false);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedRow((prev) => (prev === index ? null : index));
  };

  const buildLedgerExportSections = (): ExportSection[] => {
    const cols = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Reference', key: 'reference', width: 15 },
      {
        header: 'Debit',
        key: 'debit',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'Credit',
        key: 'credit',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'Balance',
        key: 'balance',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
    ];
    return [
      {
        title: 'Account Ledger',
        columns: cols,
        rows: ledgerLines.map((line) => ({
          date: line.date,
          description: line.description,
          type: line.typeLabel,
          reference: line.reference,
          debit: line.debit > 0 ? line.debit : 0,
          credit: line.credit > 0 ? line.credit : 0,
          balance: line.balance,
        })),
        summary: {
          date: null,
          description: 'Closing Balance',
          type: null,
          reference: null,
          debit: ledgerLines.reduce((s, l) => s + l.debit, 0),
          credit: ledgerLines.reduce((s, l) => s + l.credit, 0),
          balance: closingBalance,
        },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(
      buildLedgerExportSections(),
      `Account_Ledger_${new Date().toISOString().slice(0, 10)}`
    );
  const handleExportExcel = () =>
    downloadReportExcel(
      buildLedgerExportSections(),
      `Account_Ledger_${new Date().toISOString().slice(0, 10)}`,
      'Account Ledger'
    );

  return (
    <Box p={3}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/accounting"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Link
          color="inherit"
          href="/accounting/reports"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/reports');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Reports
        </Link>
        <Typography color="text.primary">Account Ledger</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Account Ledger
        </Typography>
        {ledgerLines.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={handleExportCSV} size="small" title="Export CSV">
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={handleExportExcel}
              size="small"
              color="primary"
              title="Export Excel"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 3, mb: 3 }}>
        <AccountSelector
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          label="Select Account"
          placeholder="Search by code or name..."
          size="medium"
        />
      </Box>

      {selectedAccountId && (
        <>
          {loadingLedger ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
            <Paper sx={{ mt: 3 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40, p: 0.5 }} />
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openingBalance !== 0 && (
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ p: 0.5 }} />
                        <TableCell colSpan={3}>
                          <strong>Opening Balance ({openingBalanceType})</strong>
                        </TableCell>
                        <TableCell align="right">
                          {openingBalanceType === 'Dr' ? (
                            <strong>{Math.abs(openingBalance).toFixed(2)}</strong>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {openingBalanceType === 'Cr' ? (
                            <strong>{Math.abs(openingBalance).toFixed(2)}</strong>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <strong>{openingBalance.toFixed(2)}</strong>
                        </TableCell>
                      </TableRow>
                    )}
                    {ledgerLines.map((line, index) => (
                      <Fragment key={index}>
                        <TableRow
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => toggleExpand(index)}
                        >
                          <TableCell sx={{ p: 0.5 }}>
                            <IconButton size="small">
                              {expandedRow === index ? (
                                <CollapseIcon fontSize="small" />
                              ) : (
                                <ExpandIcon fontSize="small" />
                              )}
                            </IconButton>
                          </TableCell>
                          <TableCell>{line.date.toLocaleDateString('en-IN')}</TableCell>
                          <TableCell>{line.description}</TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Chip label={line.typeLabel} size="small" variant="outlined" />
                              <Typography variant="body2">{line.reference}</Typography>
                              {line.vendorRef && (
                                <Typography variant="caption" color="text.secondary">
                                  / {line.vendorRef}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {line.debit > 0 ? line.debit.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {line.credit > 0 ? line.credit.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell align="right">{line.balance.toFixed(2)}</TableCell>
                        </TableRow>

                        {/* Expandable detail row */}
                        <TableRow>
                          <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                            <Collapse in={expandedRow === index} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1.5, px: 2, bgcolor: 'grey.50' }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    fontWeight="bold"
                                    color="text.secondary"
                                  >
                                    GL Entries for {line.reference}
                                    {line.entityName && ` — ${line.entityName}`}
                                    {line.status && (
                                      <Chip
                                        label={line.status}
                                        size="small"
                                        variant="outlined"
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    endIcon={<OpenInNewIcon fontSize="small" />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(getTransactionRoute(line.type));
                                    }}
                                  >
                                    View Transaction
                                  </Button>
                                </Box>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                                        Account
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                                        Description
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                                      >
                                        Debit
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                                      >
                                        Credit
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {line.allEntries.map((entry, i) => (
                                      <TableRow
                                        key={i}
                                        sx={
                                          entry.accountId === selectedAccountId
                                            ? { bgcolor: 'action.selected' }
                                            : undefined
                                        }
                                      >
                                        <TableCell sx={{ fontSize: '0.75rem' }}>
                                          {entry.accountCode && (
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              component="span"
                                            >
                                              {entry.accountCode}{' '}
                                            </Typography>
                                          )}
                                          {entry.accountName || entry.accountId}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>
                                          {entry.description || '-'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                          {(entry.debit || 0) > 0
                                            ? (entry.debit || 0).toFixed(2)
                                            : '-'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                          {(entry.credit || 0) > 0
                                            ? (entry.credit || 0).toFixed(2)
                                            : '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ))}
                    <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      <TableCell sx={{ p: 0.5 }} />
                      <TableCell colSpan={3}>
                        <strong>Closing Balance</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {ledgerLines.reduce((sum, line) => sum + line.debit, 0).toFixed(2)}
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {ledgerLines.reduce((sum, line) => sum + line.credit, 0).toFixed(2)}
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{closingBalance.toFixed(2)}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {ledgerLines.length === 0 && (
                <Box p={3} textAlign="center">
                  <Typography color="text.secondary">
                    No transactions found for this account.
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {!selectedAccountId && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Please select an account to view its ledger.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
