'use client';

import { Box, Typography } from '@mui/material';
import { formatCurrency } from '@/lib/utils/formatters';

export interface DualCurrencyAmountProps {
  /** Amount in foreign currency */
  foreignAmount: number;
  /** Currency code (e.g., 'USD', 'EUR') */
  foreignCurrency: string;
  /** Amount in base currency (INR) */
  baseAmount: number;
  /** Base currency code (default: 'INR') */
  baseCurrency?: string;
  /** Exchange rate used for conversion */
  exchangeRate?: number;
  /** Whether to show exchange rate (default: true) */
  showExchangeRate?: boolean;
  /** Display variant */
  variant?: 'inline' | 'stacked';
  /** Size variant */
  size?: 'small' | 'medium';
  /** Text alignment */
  align?: 'left' | 'right' | 'center';
  /** Font weight for primary amount */
  fontWeight?: 'normal' | 'medium' | 'bold';
}

/**
 * DualCurrencyAmount - Displays foreign currency amount with INR equivalent
 *
 * For foreign currency transactions, shows:
 * - Primary: Foreign amount (e.g., $3,371.00 USD)
 * - Secondary: INR equivalent in parentheses (₹2,80,353.00)
 * - Exchange rate below (optional, @83.25)
 *
 * For INR transactions, shows single amount without dual display.
 *
 * @example
 * <DualCurrencyAmount
 *   foreignAmount={3371}
 *   foreignCurrency="USD"
 *   baseAmount={280353}
 *   exchangeRate={83.25}
 * />
 * // Output:
 * // $3,371.00 USD (₹2,80,353.00)
 * // @83.25
 */
export function DualCurrencyAmount({
  foreignAmount,
  foreignCurrency,
  baseAmount,
  baseCurrency = 'INR',
  exchangeRate,
  showExchangeRate = true,
  variant = 'inline',
  size = 'medium',
  align = 'right',
  fontWeight = 'medium',
}: DualCurrencyAmountProps) {
  // If transaction is already in base currency, show single amount
  const isBaseCurrency = foreignCurrency === baseCurrency;

  if (isBaseCurrency) {
    return (
      <Box sx={{ textAlign: align }}>
        <Typography
          variant={size === 'small' ? 'body2' : 'body1'}
          fontWeight={fontWeight}
        >
          {formatCurrency(foreignAmount, baseCurrency)}
        </Typography>
      </Box>
    );
  }

  // Foreign currency - show dual display
  const formattedForeign = formatCurrency(foreignAmount, foreignCurrency);
  const formattedBase = formatCurrency(baseAmount, baseCurrency);

  if (variant === 'stacked') {
    return (
      <Box sx={{ textAlign: align }}>
        <Typography
          variant={size === 'small' ? 'body2' : 'body1'}
          fontWeight={fontWeight}
        >
          {formattedForeign}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
        >
          {formattedBase}
        </Typography>
        {showExchangeRate && exchangeRate && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ fontSize: '0.7rem' }}
          >
            @{exchangeRate.toFixed(2)}
          </Typography>
        )}
      </Box>
    );
  }

  // Default: inline variant
  return (
    <Box sx={{ textAlign: align }}>
      <Typography
        variant={size === 'small' ? 'body2' : 'body1'}
        fontWeight={fontWeight}
        component="span"
      >
        {formattedForeign}
      </Typography>
      <Typography
        variant={size === 'small' ? 'caption' : 'body2'}
        color="text.secondary"
        component="span"
        sx={{ ml: 0.5 }}
      >
        ({formattedBase})
      </Typography>
      {showExchangeRate && exchangeRate && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ fontSize: '0.7rem' }}
        >
          @{exchangeRate.toFixed(2)}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Format exchange rate for display
 *
 * @param rate - Exchange rate value
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code (default: 'INR')
 * @param format - 'short' for "@83.25", 'long' for "1 USD = ₹83.25"
 */
export function formatExchangeRate(
  rate: number,
  fromCurrency: string,
  toCurrency: string = 'INR',
  format: 'short' | 'long' = 'short'
): string {
  if (format === 'short') {
    return `@${rate.toFixed(2)}`;
  }
  return `1 ${fromCurrency} = ${formatCurrency(rate, toCurrency)}`;
}

export default DualCurrencyAmount;
