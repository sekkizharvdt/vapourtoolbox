/**
 * Seed Exchange Rates
 *
 * Populates initial exchange rates for testing when API key is not configured
 * This is a temporary solution until the ExchangeRate-API key is set up
 */

import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

/**
 * Sample exchange rates (approximate as of late 2024)
 * These are for testing purposes only
 */
const SAMPLE_RATES = {
  USD: 83.25, // 1 USD = 83.25 INR
  EUR: 90.5, // 1 EUR = 90.50 INR
  GBP: 105.75, // 1 GBP = 105.75 INR
  SGD: 61.8, // 1 SGD = 61.80 INR
  AED: 22.67, // 1 AED = 22.67 INR
};

/**
 * Seed exchange rates into Firestore
 * Call this function once to populate initial data
 */
export async function seedExchangeRates(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const { db } = getFirebase();
    const effectiveFrom = Timestamp.now();
    let count = 0;

    for (const [currency, rate] of Object.entries(SAMPLE_RATES)) {
      await addDoc(collection(db, COLLECTIONS.EXCHANGE_RATES), {
        fromCurrency: 'INR',
        toCurrency: currency,
        baseCurrency: 'INR',
        rate,
        inverseRate: 1 / rate,
        effectiveFrom,
        status: 'ACTIVE',
        source: 'MANUAL',
        sourceReference: 'Seed Data',
        notes: `Sample exchange rate for testing purposes. Created on ${new Date().toISOString()}`,
        createdBy: 'seed',
        createdAt: effectiveFrom,
        updatedAt: effectiveFrom,
      });
      count++;
    }

    return {
      success: true,
      count,
    };
  } catch (error) {
    console.error('[seedExchangeRates] Error:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
