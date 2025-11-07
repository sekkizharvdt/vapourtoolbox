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
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'SGD'] as const;

/**
 * Base currency for our exchange rates
 */
const BASE_CURRENCY = 'INR';

/**
 * IMPORTANT: Data Storage Convention
 *
 * Even though fromCurrency=INR in Firestore, we store rates from the
 * foreign currency perspective (how many INR per 1 foreign unit) because:
 * 1. This matches Indian business expectations (1 USD = 83 INR, not 0.012)
 * 2. Makes display logic simpler
 * 3. Avoids confusing decimal rates
 *
 * Example for USD:
 * - fromCurrency: "INR" (for query filtering)
 * - toCurrency: "USD"
 * - rate: 83.33 (1 USD = 83.33 INR) ← Business rate for display
 * - inverseRate: 0.012 (1 INR = 0.012 USD) ← Raw API value
 *
 * The fromCurrency field is a query optimization, not semantic truth.
 */

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
    secrets: ['EXCHANGERATE_API_KEY'],
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
        const apiRate = data.conversion_rates[currency];

        if (!apiRate) {
          logger.warn(`Rate not found for currency: ${currency}`);
          continue;
        }

        // Convert API rate to business rate
        // API returns: 1 INR = 0.012 USD (what you GET for 1 rupee)
        // We store: 1 USD = 83.33 INR (what you PAY in rupees)
        const businessRate = 1 / apiRate;

        const rateDoc = db.collection('exchangeRates').doc();
        batch.set(rateDoc, {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
          baseCurrency: BASE_CURRENCY,
          rate: businessRate, // 83.33 (1 USD = 83.33 INR)
          inverseRate: apiRate, // 0.012 (1 INR = 0.012 USD)
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
        timestamp: effectiveFrom.toDate().toISOString(),
      });
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
    secrets: ['EXCHANGERATE_API_KEY'],
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
        const apiRate = data.conversion_rates[currency];

        if (!apiRate) {
          logger.warn(`Rate not found for currency: ${currency}`);
          continue;
        }

        // Convert API rate to business rate
        // API returns: 1 INR = 0.012 USD (what you GET for 1 rupee)
        // We store: 1 USD = 83.33 INR (what you PAY in rupees)
        const businessRate = 1 / apiRate;

        const rateDoc = db.collection('exchangeRates').doc();
        batch.set(rateDoc, {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
          baseCurrency: BASE_CURRENCY,
          rate: businessRate, // 83.33 (1 USD = 83.33 INR)
          inverseRate: apiRate, // 0.012 (1 INR = 0.012 USD)
          effectiveFrom,
          status: 'ACTIVE',
          source: 'API',
          sourceReference: 'ExchangeRate-API (Manual)',
          notes: `Manually fetched by ${request.auth.token.email || 'user'} on ${new Date().toISOString()}`,
          createdBy: request.auth.uid,
          createdAt: effectiveFrom,
          updatedAt: effectiveFrom,
        });

        rates[currency] = businessRate;
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

/**
 * Seed Historical Exchange Rates (One-Time Setup)
 *
 * Creates historical exchange rate data for the past 30 days to enable
 * trend analysis and charting. This should only be run once when setting
 * up the system or after a data migration.
 *
 * Usage from client:
 *   const functions = getFunctions();
 *   const seedRates = httpsCallable(functions, 'seedHistoricalExchangeRates');
 *   const result = await seedRates({ days: 30 });
 */
export const seedHistoricalExchangeRates = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    secrets: ['EXCHANGERATE_API_KEY'],
    timeoutSeconds: 300,
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
        'MANAGE_FINANCIAL_SETUP permission required to seed historical data'
      );
    }

    logger.info('Historical data seeding triggered', {
      userId: request.auth.uid,
      email: request.auth.token.email,
    });

    try {
      // Get number of days to seed (default 30, max 90)
      const daysToSeed = Math.min((request.data?.days as number) || 30, 90);

      // Get API key from environment
      const apiKey = process.env.EXCHANGERATE_API_KEY;

      if (!apiKey) {
        throw new HttpsError(
          'failed-precondition',
          'ExchangeRate API key not configured. Please contact system administrator.'
        );
      }

      const db = admin.firestore();
      const now = new Date();
      let totalRecordsCreated = 0;

      // Base rates (approximate current rates) - will add variations
      // Note: These are already in business format (1 USD = 83 INR)
      const baseRates: Record<string, number> = {
        USD: 83.25,
        EUR: 90.5,
        SGD: 62.3,
      };

      logger.info('Starting historical data generation', {
        days: daysToSeed,
        currencies: SUPPORTED_CURRENCIES.length,
      });

      // Generate data for each day going backwards
      for (let dayOffset = 0; dayOffset < daysToSeed; dayOffset++) {
        const historicalDate = new Date(now);
        historicalDate.setDate(historicalDate.getDate() - dayOffset);
        historicalDate.setHours(9, 0, 0, 0); // Set to 9:00 AM for consistency

        const effectiveFrom = admin.firestore.Timestamp.fromDate(historicalDate);
        const batch = db.batch();

        // Generate rates for each supported currency
        for (const currency of SUPPORTED_CURRENCIES) {
          // Add small random variation (±2%) to simulate realistic fluctuations
          const variation = 1 + (Math.random() - 0.5) * 0.04; // -2% to +2%
          const baseRate = baseRates[currency] || 1;
          const rate = parseFloat((baseRate * variation).toFixed(4));

          const rateDoc = db.collection('exchangeRates').doc();
          batch.set(rateDoc, {
            fromCurrency: BASE_CURRENCY,
            toCurrency: currency,
            baseCurrency: BASE_CURRENCY,
            rate,
            inverseRate: parseFloat((1 / rate).toFixed(6)),
            effectiveFrom,
            status: 'ACTIVE',
            source: 'HISTORICAL_SEED',
            sourceReference: `Historical data seed for ${historicalDate.toISOString().split('T')[0]}`,
            notes: `Seeded historical data by ${request.auth.token.email || 'system'} on ${new Date().toISOString()}`,
            createdBy: request.auth.uid,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          });

          totalRecordsCreated++;
        }

        await batch.commit();

        // Log progress every 5 days
        if (dayOffset % 5 === 0) {
          logger.info(`Seeding progress: ${dayOffset}/${daysToSeed} days completed`);
        }
      }

      logger.info('Historical data seeding completed successfully', {
        recordsCreated: totalRecordsCreated,
        daysSeeded: daysToSeed,
        dateRange: {
          from: new Date(now.getTime() - daysToSeed * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          to: now.toISOString().split('T')[0],
        },
        triggeredBy: request.auth.uid,
      });

      return {
        success: true,
        recordsCreated: totalRecordsCreated,
        daysSeeded: daysToSeed,
        currencies: SUPPORTED_CURRENCIES.length,
        dateRange: {
          from: new Date(now.getTime() - daysToSeed * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          to: now.toISOString().split('T')[0],
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Error in historical data seeding:', error);
      throw new HttpsError('internal', 'Failed to seed historical exchange rates');
    }
  }
);
