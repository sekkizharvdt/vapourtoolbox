'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CurrencyCode, ExchangeRate, Timestamp } from '@vapour/types';

interface ExchangeRateTrendChartProps {
  rates: ExchangeRate[];
  baseCurrency: CurrencyCode;
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

const COLORS: Record<CurrencyCode, string> = {
  INR: '#607D8B',
  USD: '#2196F3',
  EUR: '#4CAF50',
  SGD: '#9C27B0',
};

interface CustomTooltipData {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipData> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        {payload.map(
          (entry: { name: string; value: number | string; color: string }, index: number) => (
            <Typography key={index} variant="body2" style={{ color: entry.color }}>
              1 {entry.name} = ₹{' '}
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </Typography>
          )
        )}
      </Paper>
    );
  }
  return null;
};

export default function ExchangeRateTrendChart({
  rates,
  baseCurrency,
}: ExchangeRateTrendChartProps) {
  const [selectedCurrencies, setSelectedCurrencies] = useState<CurrencyCode[]>(['USD', 'EUR']);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  // Get available foreign currencies (excluding base currency)
  const availableCurrencies = useMemo(() => {
    const currencies = new Set<CurrencyCode>();
    rates.forEach((rate) => {
      if (rate.fromCurrency !== baseCurrency) {
        currencies.add(rate.fromCurrency);
      }
      if (rate.toCurrency !== baseCurrency) {
        currencies.add(rate.toCurrency);
      }
    });
    currencies.delete(baseCurrency);
    return Array.from(currencies);
  }, [rates, baseCurrency]);

  // Process data for chart
  const chartData = useMemo(() => {
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Filter rates by selected currencies and time range
    const filteredRates = rates.filter((rate) => {
      const rateDate =
        rate.effectiveFrom instanceof Object && 'toDate' in rate.effectiveFrom
          ? (rate.effectiveFrom as Timestamp).toDate()
          : new Date();

      return (
        rateDate >= cutoffDate &&
        (selectedCurrencies.includes(rate.fromCurrency) ||
          selectedCurrencies.includes(rate.toCurrency))
      );
    });

    // Group by date
    const dataByDate = new Map<string, ChartDataPoint>();

    filteredRates.forEach((rate) => {
      const date =
        rate.effectiveFrom instanceof Object && 'toDate' in rate.effectiveFrom
          ? (rate.effectiveFrom as Timestamp).toDate().toISOString().split('T')[0]
          : '';

      if (!date) return;

      if (!dataByDate.has(date)) {
        dataByDate.set(date, { date });
      }

      const dataPoint = dataByDate.get(date)!;

      // After RBI integration: fromCurrency is foreign currency (USD, EUR, etc.)
      // rate represents how many INR per 1 unit of foreign currency
      const currency = rate.fromCurrency; // USD, EUR, GBP, SGD, AED
      const rateValue = rate.rate; // INR per foreign unit (e.g., 83.33 INR per 1 USD)

      if (selectedCurrencies.includes(currency)) {
        dataPoint[currency] = rateValue;
      }
    });

    return Array.from(dataByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [rates, selectedCurrencies, timeRange]);

  return (
    <Box>
      {/* Controls */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <FormControl fullWidth>
            <InputLabel>Currencies</InputLabel>
            <Select
              multiple
              value={selectedCurrencies}
              label="Currencies"
              onChange={(e) => setSelectedCurrencies(e.target.value as CurrencyCode[])}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableCurrencies.map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            >
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Chart */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Exchange Rate Trends (Base: {baseCurrency})
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedCurrencies.map((currency) => (
              <Line
                key={currency}
                type="monotone"
                dataKey={currency}
                stroke={COLORS[currency] || '#000'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={currency}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
}
