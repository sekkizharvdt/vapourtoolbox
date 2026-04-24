'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Skeleton,
} from '@mui/material';
import {
  Star as CurrentIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { getFirebase } from '@/lib/firebase';
import { getAvailableFiscalYears, getAccountingPeriods } from '@/lib/accounting/fiscalYearService';
import type { FiscalYear, AccountingPeriod } from '@vapour/types';

function toDate(val: unknown): Date {
  if (val && typeof val === 'object' && 'toDate' in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return val instanceof Date ? val : new Date(val as string);
}

function formatDate(val: unknown): string {
  return toDate(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusChip(status: string) {
  switch (status) {
    case 'OPEN':
      return <Chip label="Open" color="success" size="small" />;
    case 'CLOSED':
      return <Chip label="Closed" color="warning" size="small" />;
    case 'LOCKED':
      return <Chip label="Locked" color="error" size="small" />;
    default:
      return <Chip label={status} size="small" />;
  }
}

export default function FiscalYearsPage() {
  const [loading, setLoading] = useState(true);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expandedFY, setExpandedFY] = useState<string | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const loadFiscalYears = useCallback(async () => {
    try {
      setLoading(true);
      const { db } = getFirebase();
      setFiscalYears(await getAvailableFiscalYears(db));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fiscal years');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiscalYears();
  }, [loadFiscalYears]);

  const handleExpandFY = async (fyId: string) => {
    if (expandedFY === fyId) {
      setExpandedFY(null);
      setPeriods([]);
      return;
    }
    setExpandedFY(fyId);
    setLoadingPeriods(true);
    try {
      const { db } = getFirebase();
      setPeriods(await getAccountingPeriods(db, fyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoadingPeriods(false);
    }
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Fiscal Years' },
        ]}
      />

      <PageHeader
        title="Fiscal Years"
        subtitle="Indian fiscal years (Apr–Mar) are derived from your transaction dates."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={200} />
          </CardContent>
        </Card>
      ) : fiscalYears.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No fiscal years yet
              </Typography>
              <Typography color="text.secondary">
                Fiscal years will appear here once you post transactions.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Name</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Current</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fiscalYears.map((fy) => (
                <>
                  <TableRow
                    key={fy.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleExpandFY(fy.id)}
                  >
                    <TableCell>
                      <IconButton size="small" aria-label="Expand periods">
                        {expandedFY === fy.id ? <CollapseIcon /> : <ExpandIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{fy.name}</Typography>
                    </TableCell>
                    <TableCell>{formatDate(fy.startDate)}</TableCell>
                    <TableCell>{formatDate(fy.endDate)}</TableCell>
                    <TableCell>
                      {fy.isCurrent ? (
                        <Chip label="Current" color="primary" size="small" icon={<CurrentIcon />} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          &mdash;
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedFY === fy.id && (
                    <TableRow key={`${fy.id}-periods`}>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Collapse in={expandedFY === fy.id} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Accounting Periods
                            </Typography>
                            {loadingPeriods ? (
                              <Skeleton variant="rectangular" height={100} />
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>Period</TableCell>
                                    <TableCell>Start</TableCell>
                                    <TableCell>End</TableCell>
                                    <TableCell>Status</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {periods.map((period) => (
                                    <TableRow key={period.id}>
                                      <TableCell>{period.periodNumber}</TableCell>
                                      <TableCell>{period.name}</TableCell>
                                      <TableCell>{formatDate(period.startDate)}</TableCell>
                                      <TableCell>{formatDate(period.endDate)}</TableCell>
                                      <TableCell>{getStatusChip(period.status)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
