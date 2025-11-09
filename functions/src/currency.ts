/**
 * Currency Exchange Rate Functions
 *
 * Automatically fetches exchange rates from Reserve Bank of India (RBI)
 * and stores them in Firestore for use in the application
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Base currency for our exchange rates
 */
const BASE_CURRENCY = 'INR';

/**
 * RBI Reference Rate Configuration
 *
 * RBI publishes reference rates daily around 12:30 PM IST
 * Rates are published at: https://www.rbi.org.in/Scripts/ReferenceRateArchive.aspx
 *
 * This is the official Reserve Bank of India reference rate
 * - Free, no API key required
 * - Published every business day (Mon-Fri, excluding RBI holidays)
 * - Based on market transactions during the day
 */

/**
 * RBI rate mapping for supported currencies
 * Maps our currency codes to RBI's format
 */
const RBI_CURRENCY_MAPPING: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'Pound Sterling',
  SGD: 'Singapore Dollar',
  AED: 'U.A.E Dirham',
};

interface RBIRateData {
  currency: string;
  rate: number;
  date: string;
}

/**
 * Fetch rates from RBI website
 *
 * RBI publishes rates in multiple formats:
 * 1. Reference Rate Archive (HTML table)
 * 2. CSV downloads
 * 3. RSS feeds
 *
 * We'll use the RSS feed for reliable parsing
 */
async function fetchRBIRates(): Promise<RBIRateData[]> {
  try {
    // RBI RSS feed URL for reference rates
    // Alternative: Can use direct API if RBI provides one in the future
    const rbiUrl = 'https://www.rbi.org.in/Scripts/BS_ViewRbiReferenceRatexml.aspx';

    logger.info('Fetching rates from RBI', { url: rbiUrl });

    const response = await fetch(rbiUrl);

    if (!response.ok) {
      throw new Error(`RBI request failed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Parse XML response to extract rates
    // RBI XML format typically contains rate entries with currency name and value
    const rates: RBIRateData[] = [];

    // Simple XML parsing for RBI rate structure
    // Format: <item><title>Currency Name</title><rate>XX.XX</rate><date>...</date></item>
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      // Extract currency name
      const currencyMatch = /<title>(.*?)<\/title>/.exec(itemContent);
      // Extract rate - try multiple formats
      const rateMatch =
        /<rate>(.*?)<\/rate>/.exec(itemContent) ||
        /<description>.*?(\d+\.\d+).*?<\/description>/.exec(itemContent);
      // Extract date
      const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);

      if (currencyMatch && rateMatch) {
        const currencyName = currencyMatch[1].trim();
        const rateValue = parseFloat(rateMatch[1]);
        const dateValue = dateMatch ? dateMatch[1] : new Date().toISOString();

        // Check if this currency is in our supported list
        for (const [code, rbiName] of Object.entries(RBI_CURRENCY_MAPPING)) {
          if (currencyName.includes(rbiName)) {
            rates.push({
              currency: code,
              rate: rateValue,
              date: dateValue,
            });
            break;
          }
        }
      }
    }

    // If XML parsing didn't work, try fallback HTML parsing
    if (rates.length === 0) {
      logger.info('XML parsing yielded no results, trying HTML fallback');
      const htmlRates = await parseRBIHTMLRates(xmlText);
      rates.push(...htmlRates);
    }

    logger.info(`Successfully parsed ${rates.length} rates from RBI`);
    return rates;
  } catch (error) {
    logger.error('Error fetching RBI rates:', error);
    throw error;
  }
}

/**
 * Fallback: Parse RBI HTML table format
 * Used when RSS feed is not available
 */
async function parseRBIHTMLRates(htmlContent: string): Promise<RBIRateData[]> {
  const rates: RBIRateData[] = [];

  try {
    // RBI table typically has format: <td>Currency Name</td><td>Rate</td>
    // This is a simplified parser - may need adjustment based on actual HTML structure

    for (const [code, rbiName] of Object.entries(RBI_CURRENCY_MAPPING)) {
      // Look for currency name in HTML and extract nearby rate value
      const currencyPattern = new RegExp(`${rbiName}.*?(\\d+\\.\\d+)`, 'i');
      const match = currencyPattern.exec(htmlContent);

      if (match) {
        rates.push({
          currency: code,
          rate: parseFloat(match[1]),
          date: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    logger.error('Error parsing HTML rates:', error);
  }

  return rates;
}

/**
 * Store rates in Firestore
 *
 * IMPORTANT: Data format convention:
 * - fromCurrency: Foreign currency (USD, EUR, GBP, etc.)
 * - toCurrency: INR
 * - rate: How many INR per 1 unit of foreign currency (e.g., 83.33 INR per 1 USD)
 */
async function storeRates(rates: RBIRateData[], triggeredBy: string = 'system'): Promise<number> {
  const db = admin.firestore();
  const batch = db.batch();
  const effectiveFrom = admin.firestore.Timestamp.now();
  let storedCount = 0;

  for (const rateData of rates) {
    const rateDoc = db.collection('exchange_rates').doc();
    batch.set(rateDoc, {
      fromCurrency: rateData.currency, // USD, EUR, GBP, SGD, AED
      toCurrency: BASE_CURRENCY, // INR
      baseCurrency: BASE_CURRENCY,
      rate: rateData.rate, // INR per foreign unit (e.g., 83.33 INR per 1 USD)
      inverseRate: 1 / rateData.rate,
      effectiveFrom,
      status: 'ACTIVE',
      source: 'RBI',
      sourceReference: 'Reserve Bank of India Reference Rate',
      notes: `Fetched from RBI on ${new Date().toISOString()}`,
      createdBy: triggeredBy,
      createdAt: effectiveFrom,
      updatedAt: effectiveFrom,
    });

    storedCount++;
  }

  await batch.commit();
  return storedCount;
}

/**
 * Fetch Daily Exchange Rates from RBI
 *
 * Runs daily at 1:00 PM IST (7:30 AM UTC)
 * RBI publishes rates around 12:30 PM IST, so we fetch at 1:00 PM
 *
 * Schedule: "30 7 * * *" = Every day at 7:30 AM UTC (1:00 PM IST)
 * Timezone: UTC
 *
 * Note: RBI publishes rates only on business days (Mon-Fri, excluding RBI holidays)
 * The function will run daily but may not find new rates on weekends/holidays
 */
export const fetchDailyExchangeRates = onSchedule(
  {
    schedule: '30 7 * * *', // Daily at 7:30 AM UTC (1:00 PM IST)
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async (event) => {
    logger.info('Starting daily RBI exchange rate fetch', { timestamp: event.scheduleTime });

    try {
      const rates = await fetchRBIRates();

      if (rates.length === 0) {
        logger.warn('No rates fetched from RBI - may be a holiday or weekend');
        return;
      }

      const storedCount = await storeRates(rates, 'system');

      logger.info('Successfully stored RBI exchange rates', {
        storedCount,
        currencies: rates.map((r) => r.currency).join(', '),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching RBI exchange rates:', error);
      throw error;
    }
  }
);

/**
 * Manual Exchange Rate Fetch (HTTP Callable)
 *
 * Allows authorized users to manually trigger RBI exchange rate fetch
 * Useful for testing or when immediate rate updates are needed
 *
 * Usage from client:
 *   const functions = getFunctions();
 *   const fetchRates = httpsCallable(functions, 'manualFetchExchangeRates');
 *   const result = await fetchRates();
 */
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

    logger.info('Manual RBI exchange rate fetch triggered', {
      userId: request.auth.uid,
      email: request.auth.token.email,
    });

    try {
      const rates = await fetchRBIRates();

      if (rates.length === 0) {
        throw new HttpsError(
          'unavailable',
          'No rates available from RBI. This may be a weekend or RBI holiday.'
        );
      }

      const storedCount = await storeRates(rates, request.auth.uid);

      logger.info('Manual RBI fetch completed successfully', {
        rateCount: storedCount,
        triggeredBy: request.auth.uid,
      });

      // Convert rates to simple object for response
      const ratesObject: Record<string, number> = {};
      rates.forEach((r) => {
        ratesObject[r.currency] = r.rate;
      });

      return {
        success: true,
        rates: ratesObject,
        source: 'Reserve Bank of India',
        fetchedAt: new Date().toISOString(),
        rateCount: storedCount,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Error in manual RBI fetch:', error);
      throw new HttpsError('internal', 'Failed to fetch RBI exchange rates');
    }
  }
);
