/**
 * Currency Exchange Rate Functions
 *
 * Automatically fetches exchange rates from ExchangeRate-API
 * and stores them in Firestore for use in the application
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Currency codes we support
 */
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AED'] as const;
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Base currency for our exchange rates
 */
const BASE_CURRENCY = 'INR';

/**
 * ExchangeRate-API Configuration
 *
 * Free tier: 1,500 requests/month
 * Rate limit: Updated once every 24 hours
 *
 * To use this function:
 * 1. Sign up at https://www.exchangerate-api.com
 * 2. Get your free API key
 * 3. Set it as a Firebase environment variable:
 *    firebase functions:config:set exchangerate.api_key="YOUR_API_KEY"
 *
 * For local development, add to .runtimeconfig.json:
 * {
 *   "exchangerate": {
 *     "api_key": "YOUR_API_KEY"
 *   }
 * }
 */

interface ExchangeRateAPIResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

/**
 * Fetch Daily Exchange Rates
 *
 * Runs daily at 9:00 AM IST (3:30 AM UTC)
 * Fetches latest exchange rates from ExchangeRate-API
 * Stores them in Firestore exchange_rates collection
 *
 * Schedule: "30 3 * * *" = Every day at 3:30 AM UTC (9:00 AM IST)
 * Timezone: UTC
 */
export const fetchDailyExchangeRates = onSchedule(
  {
    schedule: '30 3 * * *', // Daily at 3:30 AM UTC
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async (event) => {
    logger.info('Starting daily exchange rate fetch', { timestamp: event.scheduleTime });

    try {
      // Get API key from environment config
      const apiKey = process.env.EXCHANGERATE_API_KEY;

      if (!apiKey) {
        logger.error(
          'ExchangeRate API key not configured. Please set EXCHANGERATE_API_KEY environment variable.'
        );
        return;
      }

      // Fetch rates from ExchangeRate-API
      const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ExchangeRateAPIResponse;

      if (data.result !== 'success') {
        throw new Error(`API returned non-success result: ${data.result}`);
      }

      logger.info('Successfully fetched rates from API', {
        base: data.base_code,
        lastUpdate: data.time_last_update_utc,
        rateCount: Object.keys(data.conversion_rates).length,
      });

      // Store rates in Firestore
      const db = admin.firestore();
      const batch = db.batch();
      const effectiveFrom = admin.firestore.Timestamp.now();
      let storedCount = 0;

      for (const currency of SUPPORTED_CURRENCIES) {
        const rate = data.conversion_rates[currency];

        if (!rate) {
          logger.warn(`Rate not found for currency: ${currency}`);
          continue;
        }

        const rateDoc = db.collection('exchange_rates').doc();
        batch.set(rateDoc, {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
          baseCurrency: BASE_CURRENCY,
          rate,
          inverseRate: 1 / rate,
          effectiveFrom,
          status: 'ACTIVE',
          source: 'API',
          sourceReference: 'ExchangeRate-API',
          notes: `Auto-fetched from ExchangeRate-API on ${new Date().toISOString()}`,
          createdBy: 'system',
          createdAt: effectiveFrom,
          updatedAt: effectiveFrom,
        });

        storedCount++;
      }

      await batch.commit();

      logger.info('Successfully stored exchange rates', {
        storedCount,
        currencies: SUPPORTED_CURRENCIES.join(', '),
      });

      return {
        success: true,
        storedCount,
        timestamp: effectiveFrom.toDate().toISOString(),
      };
    } catch (error) {
      logger.error('Error fetching exchange rates:', error);
      throw error;
    }
  }
);

/**
 * Manual Exchange Rate Fetch (HTTP Callable)
 *
 * Allows authorized users to manually trigger exchange rate fetch
 * Useful for testing or when immediate rate updates are needed
 *
 * Usage from client:
 *   const functions = getFunctions();
 *   const fetchRates = httpsCallable(functions, 'manualFetchExchangeRates');
 *   const result = await fetchRates();
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const manualFetchExchangeRates = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
  },
  async (request) => {
    // Check authentication
    if (!request.auth || !request.auth.token.permissions) {
      throw new HttpsError('permission-denied', 'Authentication required');
    }

    const userPermissions = request.auth.token.permissions as number;
    const MANAGE_FINANCIAL_SETUP = 64; // PERMISSION_FLAGS.MANAGE_FINANCIAL_SETUP

    if ((userPermissions & MANAGE_FINANCIAL_SETUP) !== MANAGE_FINANCIAL_SETUP) {
      throw new HttpsError(
        'permission-denied',
        'MANAGE_FINANCIAL_SETUP permission required to fetch exchange rates'
      );
    }

    logger.info('Manual exchange rate fetch triggered', {
      userId: request.auth.uid,
      email: request.auth.token.email,
    });

    try {
      // Get API key from environment config
      const apiKey = process.env.EXCHANGERATE_API_KEY;

      if (!apiKey) {
        throw new HttpsError(
          'failed-precondition',
          'ExchangeRate API key not configured. Please contact system administrator.'
        );
      }

      // Fetch rates from ExchangeRate-API
      const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new HttpsError('unavailable', `API request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as ExchangeRateAPIResponse;

      if (data.result !== 'success') {
        throw new HttpsError('unavailable', `API returned error: ${data.result}`);
      }

      // Store rates in Firestore
      const db = admin.firestore();
      const batch = db.batch();
      const effectiveFrom = admin.firestore.Timestamp.now();
      const rates: Record<string, number> = {};

      for (const currency of SUPPORTED_CURRENCIES) {
        const rate = data.conversion_rates[currency];

        if (!rate) {
          logger.warn(`Rate not found for currency: ${currency}`);
          continue;
        }

        const rateDoc = db.collection('exchange_rates').doc();
        batch.set(rateDoc, {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
          baseCurrency: BASE_CURRENCY,
          rate,
          inverseRate: 1 / rate,
          effectiveFrom,
          status: 'ACTIVE',
          source: 'API',
          sourceReference: 'ExchangeRate-API (Manual)',
          notes: `Manually fetched by ${request.auth.token.email || 'user'} on ${new Date().toISOString()}`,
          createdBy: request.auth.uid,
          createdAt: effectiveFrom,
          updatedAt: effectiveFrom,
        });

        rates[currency] = rate;
      }

      await batch.commit();

      logger.info('Manual fetch completed successfully', {
        rateCount: Object.keys(rates).length,
        triggeredBy: request.auth.uid,
      });

      return {
        success: true,
        rates,
        lastUpdate: data.time_last_update_utc,
        nextUpdate: data.time_next_update_utc,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Error in manual fetch:', error);
      throw new HttpsError('internal', 'Failed to fetch exchange rates');
    }
  }
);
