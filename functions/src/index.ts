import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Import user management functions
export { onUserUpdate } from './userManagement';
