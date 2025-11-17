// Firebase app instance for API routes
'use client';

import { getFirebaseClient } from '@vapour/firebase';

// Get Firebase app instance
export const firebaseApp = getFirebaseClient().app;
