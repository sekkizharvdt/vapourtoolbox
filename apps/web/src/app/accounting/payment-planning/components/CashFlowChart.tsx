'use client';

import { useMemo } from 'react';
import { Paper, Typography, Box, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import type { CashFlowForecast } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface CashFlowChartProps {
  forecast: CashFlowForecast;
}

export function CashFlowChart({ forecast }: CashFlowChartProps) {
  const theme = useTheme();

  const chartData = useMemo(() => {
    return forecast.dailyForecasts.map((day) => ({
      date: day.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      fullDate: day.date,
      receipts: day.projectedReceipts,
      payments: day.projectedPayments,
      netFlow: day.netCashFlow,
      balance: day.closingBalance,
    }));
  }, [forecast]);

  const weeklyData = useMemo(() => {
    return forecast.weeklyForecasts.map((week) => ({
      week: `Week ${week.weekNumber}`,
      weekStart: week.weekStartDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      receipts: week.totalReceipts,
      payments: week.totalPayments,
      netFlow: week.netCashFlow,
    }));
  }, [forecast]);

  return (
    <Box>
      {/* Balance Line Chart */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Projected Cash Balance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Daily closing balance over the forecast period
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="balance"
              name="Closing Balance"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Daily Inflows/Outflows Bar Chart */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Daily Cash Flow
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Expected receipts and payments by day
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Bar dataKey="receipts" name="Receipts" fill={theme.palette.success.main} />
            <Bar dataKey="payments" name="Payments" fill={theme.palette.error.main} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Weekly Summary */}
      {weeklyData.length > 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Weekly Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Aggregated receipts and payments by week
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekStart" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                labelFormatter={(_, payload) => {
                  if (payload && payload[0]) {
                    return `${payload[0].payload.week} (${payload[0].payload.weekStart})`;
                  }
                  return '';
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" />
              <Bar dataKey="receipts" name="Receipts" fill={theme.palette.success.main} />
              <Bar dataKey="payments" name="Payments" fill={theme.palette.error.main} />
              <Bar dataKey="netFlow" name="Net Flow" fill={theme.palette.info.main} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}
