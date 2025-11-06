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
  Card,
  CardContent,
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
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import type { CurrencyCode, ExchangeRate, Timestamp } from '@vapour/types';

interface ExchangeRateTrendChartProps {
  rates: ExchangeRate[];
  baseCurrency: CurrencyCode;
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

interface TrendAnalysis {
  currency: CurrencyCode;
  currentRate: number;
  previousRate: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  favorability: {
    forImport: 'good' | 'bad' | 'neutral';
    forExport: 'good' | 'bad' | 'neutral';
    message: string;
  };
}

const COLORS: Record<CurrencyCode, string> = {
  INR: '#607D8B',
  USD: '#2196F3',
  EUR: '#4CAF50',
  GBP: '#FF9800',
  SGD: '#9C27B0',
  AED: '#F44336',
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
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(4) : entry.value}
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

      // Determine which currency to use as key
      const currency = rate.fromCurrency === baseCurrency ? rate.toCurrency : rate.fromCurrency;
      const rateValue = rate.fromCurrency === baseCurrency ? rate.rate : rate.inverseRate;

      if (selectedCurrencies.includes(currency)) {
        dataPoint[currency] = rateValue;
      }
    });

    return Array.from(dataByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [rates, selectedCurrencies, timeRange, baseCurrency]);

  // Calculate trend analysis
  const trendAnalysis = useMemo((): TrendAnalysis[] => {
    return selectedCurrencies.map((currency) => {
      const currencyRates = rates
        .filter(
          (r) =>
            (r.fromCurrency === currency && r.toCurrency === baseCurrency) ||
            (r.toCurrency === currency && r.fromCurrency === baseCurrency)
        )
        .sort((a, b) => {
          const dateA =
            a.effectiveFrom instanceof Object && 'toDate' in a.effectiveFrom
              ? (a.effectiveFrom as Timestamp).toDate().getTime()
              : 0;
          const dateB =
            b.effectiveFrom instanceof Object && 'toDate' in b.effectiveFrom
              ? (b.effectiveFrom as Timestamp).toDate().getTime()
              : 0;
          return dateB - dateA;
        });

      if (currencyRates.length < 2) {
        const currentRate =
          currencyRates[0]?.fromCurrency === baseCurrency
            ? currencyRates[0]?.rate || 0
            : currencyRates[0]?.inverseRate || 0;

        return {
          currency,
          currentRate,
          previousRate: currentRate,
          change: 0,
          changePercent: 0,
          trend: 'stable',
          favorability: {
            forImport: 'neutral',
            forExport: 'neutral',
            message: 'Insufficient data for trend analysis',
          },
        };
      }

      const latestRate = currencyRates[0];
      const previousRate = currencyRates[1];

      if (!latestRate || !previousRate) {
        const currentRate =
          latestRate?.fromCurrency === baseCurrency
            ? latestRate?.rate || 0
            : latestRate?.inverseRate || 0;

        return {
          currency,
          currentRate,
          previousRate: currentRate,
          change: 0,
          changePercent: 0,
          trend: 'stable',
          favorability: {
            forImport: 'neutral',
            forExport: 'neutral',
            message: 'Insufficient data for trend analysis',
          },
        };
      }

      const current =
        latestRate.fromCurrency === baseCurrency ? latestRate.rate : latestRate.inverseRate;
      const previous =
        previousRate.fromCurrency === baseCurrency ? previousRate.rate : previousRate.inverseRate;

      const change = current - previous;
      const changePercent = (change / previous) * 100;
      const trend = Math.abs(changePercent) < 0.5 ? 'stable' : change > 0 ? 'up' : 'down';

      // Favorability analysis
      let forImport: 'good' | 'bad' | 'neutral' = 'neutral';
      let forExport: 'good' | 'bad' | 'neutral' = 'neutral';
      let message = '';

      if (trend === 'down') {
        // Foreign currency is getting cheaper (INR is strengthening)
        forImport = 'good';
        forExport = 'bad';
        message = `${currency} is weakening against ${baseCurrency}. Good time to import from ${currency} zone. Consider delaying exports.`;
      } else if (trend === 'up') {
        // Foreign currency is getting expensive (INR is weakening)
        forImport = 'bad';
        forExport = 'good';
        message = `${currency} is strengthening against ${baseCurrency}. Good time to export to ${currency} zone. Consider delaying imports.`;
      } else {
        message = `${currency} is stable against ${baseCurrency}. Normal trading conditions.`;
      }

      return {
        currency,
        currentRate: current,
        previousRate: previous,
        change,
        changePercent,
        trend,
        favorability: { forImport, forExport, message },
      };
    });
  }, [rates, selectedCurrencies, baseCurrency]);

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
                name={`${currency}/${baseCurrency}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Trend Analysis Cards */}
      <Typography variant="h6" gutterBottom>
        Favorability Analysis
      </Typography>
      <Grid container spacing={2}>
        {trendAnalysis.map((analysis) => (
          <Grid size={{ xs: 12, md: 6 }} key={analysis.currency}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{analysis.currency}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {analysis.trend === 'up' ? (
                      <TrendingUp color="error" />
                    ) : analysis.trend === 'down' ? (
                      <TrendingDown color="success" />
                    ) : null}
                    <Typography
                      variant="body2"
                      color={
                        analysis.trend === 'up'
                          ? 'error.main'
                          : analysis.trend === 'down'
                            ? 'success.main'
                            : 'text.secondary'
                      }
                      fontWeight="medium"
                    >
                      {analysis.changePercent >= 0 ? '+' : ''}
                      {analysis.changePercent.toFixed(2)}%
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Rate: {analysis.currentRate.toFixed(4)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Previous Rate: {analysis.previousRate.toFixed(4)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={`Import: ${analysis.favorability.forImport}`}
                    size="small"
                    color={
                      analysis.favorability.forImport === 'good'
                        ? 'success'
                        : analysis.favorability.forImport === 'bad'
                          ? 'error'
                          : 'default'
                    }
                  />
                  <Chip
                    label={`Export: ${analysis.favorability.forExport}`}
                    size="small"
                    color={
                      analysis.favorability.forExport === 'good'
                        ? 'success'
                        : analysis.favorability.forExport === 'bad'
                          ? 'error'
                          : 'default'
                    }
                  />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {analysis.favorability.message}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
