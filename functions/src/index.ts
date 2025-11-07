import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

// Import user management functions
export { onUserUpdate } from './userManagement';

// Import account balance functions
export { onTransactionWrite, recalculateAccountBalances } from './accountBalances';

// Import entity management functions
export { createEntity } from './entities/createEntity';

// Import currency exchange rate functions
export {
  fetchDailyExchangeRates,
  manualFetchExchangeRates,
  seedHistoricalExchangeRates,
} from './currency';
