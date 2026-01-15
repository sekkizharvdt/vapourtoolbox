'use client';

import React, { useState, useMemo } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Collapse,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Loop as RecurringIcon,
  Edit as ManualIcon,
} from '@mui/icons-material';
import type { CashFlowForecast, ForecastItem, ForecastItemSource, CashFlowDirection } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface ForecastTableProps {
  forecast: CashFlowForecast;
}

type FilterSource = ForecastItemSource | 'ALL';
type FilterDirection = CashFlowDirection | 'ALL';

export function ForecastTable({ forecast }: ForecastTableProps) {
  const [filterSource, setFilterSource] = useState<FilterSource>('ALL');
  const [filterDirection, setFilterDirection] = useState<FilterDirection>('ALL');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'daily' | 'items'>('daily');

  const filteredItems = useMemo(() => {
    return forecast.allItems.filter((item) => {
      if (filterSource !== 'ALL' && item.source !== filterSource) return false;
      if (filterDirection !== 'ALL' && item.direction !== filterDirection) return false;
      return true;
    });
  }, [forecast.allItems, filterSource, filterDirection]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const getSourceIcon = (source: ForecastItemSource) => {
    switch (source) {
      case 'INVOICE':
        return <ReceiptIcon fontSize="small" />;
      case 'BILL':
        return <PaymentIcon fontSize="small" />;
      case 'RECURRING':
        return <RecurringIcon fontSize="small" />;
      case 'MANUAL':
        return <ManualIcon fontSize="small" />;
    }
  };

  const getSourceLabel = (source: ForecastItemSource) => {
    switch (source) {
      case 'INVOICE':
        return 'Invoice';
      case 'BILL':
        return 'Bill';
      case 'RECURRING':
        return 'Recurring';
      case 'MANUAL':
        return 'Manual';
    }
  };

  const getRiskColor = (item: ForecastItem): 'success' | 'warning' | 'error' | 'default' => {
    if (item.riskStatus === 'OVERDUE') return 'error';
    if (item.riskStatus === 'AT_RISK') return 'warning';
    return 'success';
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs value={viewMode} onChange={(_, v) => setViewMode(v)}>
          <Tab label="Daily View" value="daily" />
          <Tab label="All Items" value="items" />
        </Tabs>

        <Box sx={{ flexGrow: 1 }} />

        <TextField
          select
          size="small"
          label="Source"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as FilterSource)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="ALL">All Sources</MenuItem>
          <MenuItem value="INVOICE">Invoices</MenuItem>
          <MenuItem value="BILL">Bills</MenuItem>
          <MenuItem value="RECURRING">Recurring</MenuItem>
          <MenuItem value="MANUAL">Manual</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Direction"
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as FilterDirection)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="INFLOW">Receipts</MenuItem>
          <MenuItem value="OUTFLOW">Payments</MenuItem>
        </TextField>
      </Box>

      {/* Daily View */}
      {viewMode === 'daily' && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="5%" />
                <TableCell width="15%">Date</TableCell>
                <TableCell align="right" width="20%">
                  Receipts
                </TableCell>
                <TableCell align="right" width="20%">
                  Payments
                </TableCell>
                <TableCell align="right" width="20%">
                  Net Flow
                </TableCell>
                <TableCell align="right" width="20%">
                  Closing Balance
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecast.dailyForecasts.map((day) => {
                const dateKey = day.date.toISOString().split('T')[0] ?? '';
                const isExpanded = dateKey ? expandedDays[dateKey] : false;
                const dayItems = filteredItems.filter(
                  (item) => item.expectedDate.toISOString().split('T')[0] === dateKey
                );
                const hasItems = dayItems.length > 0;

                return (
                  <React.Fragment key={dateKey}>
                    <TableRow
                      hover
                      onClick={() => hasItems && dateKey && toggleDay(dateKey)}
                      sx={{ cursor: hasItems ? 'pointer' : 'default' }}
                    >
                      <TableCell>
                        {hasItems && (
                          <IconButton size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {day.date.toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Typography>
                        {hasItems && (
                          <Typography variant="caption" color="text.secondary">
                            {dayItems.length} item{dayItems.length !== 1 ? 's' : ''}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {day.projectedReceipts > 0 && (
                          <Typography color="success.main">
                            {formatCurrency(day.projectedReceipts)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {day.projectedPayments > 0 && (
                          <Typography color="error.main">
                            {formatCurrency(day.projectedPayments)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography color={day.netCashFlow >= 0 ? 'success.main' : 'error.main'}>
                          {day.netCashFlow >= 0 ? '+' : ''}
                          {formatCurrency(day.netCashFlow)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{formatCurrency(day.closingBalance)}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* Expanded items */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0, bgcolor: 'action.hover' }}>
                          <Collapse in={isExpanded}>
                            <Table size="small">
                              <TableBody>
                                {dayItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell width="5%" />
                                    <TableCell width="30%">
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getSourceIcon(item.source)}
                                        <Box>
                                          <Typography variant="body2">{item.sourceReference}</Typography>
                                          {item.entityName && (
                                            <Typography variant="caption" color="text.secondary">
                                              {item.entityName}
                                            </Typography>
                                          )}
                                        </Box>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        label={getSourceLabel(item.source)}
                                        variant="outlined"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        label={
                                          item.riskStatus === 'OVERDUE'
                                            ? `${item.daysOverdue}d overdue`
                                            : item.riskStatus === 'AT_RISK'
                                              ? 'At risk'
                                              : 'On schedule'
                                        }
                                        color={getRiskColor(item)}
                                      />
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography
                                        color={item.direction === 'INFLOW' ? 'success.main' : 'error.main'}
                                      >
                                        {item.direction === 'INFLOW' ? '+' : '-'}
                                        {formatCurrency(item.amount)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell />
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Totals row */}
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell />
                <TableCell>
                  <Typography fontWeight="bold">Total</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography color="success.main" fontWeight="bold">
                    {formatCurrency(forecast.totalProjectedReceipts)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography color="error.main" fontWeight="bold">
                    {formatCurrency(forecast.totalProjectedPayments)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    color={forecast.netForecastedCashFlow >= 0 ? 'success.main' : 'error.main'}
                    fontWeight="bold"
                  >
                    {forecast.netForecastedCashFlow >= 0 ? '+' : ''}
                    {formatCurrency(forecast.netForecastedCashFlow)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">
                    {formatCurrency(forecast.projectedClosingBalance)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Items View */}
      {viewMode === 'items' && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Expected Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getSourceIcon(item.source)}
                      <Chip size="small" label={getSourceLabel(item.source)} variant="outlined" />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.sourceReference}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.entityName || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    {item.expectedDate.toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        item.riskStatus === 'OVERDUE'
                          ? `${item.daysOverdue}d overdue`
                          : item.riskStatus === 'AT_RISK'
                            ? `Due in ${item.daysUntilDue}d`
                            : 'On schedule'
                      }
                      color={getRiskColor(item)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={item.direction === 'INFLOW' ? 'success.main' : 'error.main'}
                      fontWeight="medium"
                    >
                      {item.direction === 'INFLOW' ? '+' : '-'}
                      {formatCurrency(item.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No items match the selected filters
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
