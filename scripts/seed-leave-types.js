/**
 * Seed Leave Types Script
 *
 * Creates initial leave type configurations for the HR module.
 *
 * Usage:
 *   node scripts/seed-leave-types.js
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS environment variable set
 *   - Firebase Admin SDK initialized
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const LEAVE_TYPES = [
  {
    code: 'SICK',
    name: 'Sick Leave',
    description: 'Leave for medical reasons or illness',
    annualQuota: 12,
    carryForwardAllowed: false,
    maxCarryForward: 0,
    isPaid: true,
    requiresApproval: true,
    minNoticeDays: 0, // Can apply same day
    maxConsecutiveDays: null,
    allowHalfDay: true,
    color: '#ef4444', // Red
    isActive: true,
  },
  {
    code: 'CASUAL',
    name: 'Casual Leave',
    description: 'Leave for personal matters or emergencies',
    annualQuota: 12,
    carryForwardAllowed: false,
    maxCarryForward: 0,
    isPaid: true,
    requiresApproval: true,
    minNoticeDays: 1, // Apply at least 1 day in advance
    maxConsecutiveDays: 3,
    allowHalfDay: true,
    color: '#3b82f6', // Blue
    isActive: true,
  },
];

async function seedLeaveTypes() {
  console.log('Starting leave types seed...\n');

  const now = admin.firestore.Timestamp.now();
  const systemUserId = 'system';

  for (const leaveType of LEAVE_TYPES) {
    try {
      // Check if leave type already exists by code
      const existingQuery = await db
        .collection('hrLeaveTypes')
        .where('code', '==', leaveType.code)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        console.log(`✓ Leave type '${leaveType.code}' already exists, skipping...`);
        continue;
      }

      // Create the leave type
      const docRef = await db.collection('hrLeaveTypes').add({
        ...leaveType,
        createdAt: now,
        updatedAt: now,
        createdBy: systemUserId,
        updatedBy: systemUserId,
      });

      console.log(
        `✓ Created leave type '${leaveType.name}' (${leaveType.code}) - ID: ${docRef.id}`
      );
    } catch (error) {
      console.error(`✗ Failed to create leave type '${leaveType.code}':`, error.message);
    }
  }

  console.log('\nLeave types seed completed!');
  console.log('\nSummary:');
  console.log(`- Sick Leave: ${LEAVE_TYPES[0].annualQuota} days/year`);
  console.log(`- Casual Leave: ${LEAVE_TYPES[1].annualQuota} days/year`);
  console.log('- Fiscal Year: January 1 - December 31');
}

// Run the seed
seedLeaveTypes()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
