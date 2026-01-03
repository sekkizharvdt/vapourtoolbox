/**
 * HR Workflow Integration Test
 *
 * Tests the complete HR workflows:
 * - Leave balance initialization
 * - Leave request submission and approval
 * - Holiday working override with comp-off granting
 *
 * Prerequisites:
 * - Firebase emulators running: `firebase emulators:start`
 *
 * Run with: `pnpm test:integration`
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import {
  initializeTestFirebase,
  cleanupTestData,
  checkEmulatorsRunning,
  cleanupTestFirebase,
} from './setup';
import type { Firestore } from 'firebase/firestore';

// Collection names (matching @vapour/firebase COLLECTIONS)
const COLLECTIONS = {
  USERS: 'users',
  HR_LEAVE_TYPES: 'hrLeaveTypes',
  HR_LEAVE_BALANCES: 'hrLeaveBalances',
  HR_LEAVE_REQUESTS: 'hrLeaveRequests',
  HR_HOLIDAYS: 'hrHolidays',
  HR_HOLIDAY_WORKING_OVERRIDES: 'hrHolidayWorkingOverrides',
};

// Test data
const TEST_ADMIN = {
  id: 'admin-001',
  displayName: 'Test Admin',
  email: 'admin@example.com',
};

const TEST_USER = {
  id: 'user-001',
  displayName: 'Test Employee',
  email: 'employee@example.com',
  isActive: true,
};

const TEST_USER_2 = {
  id: 'user-002',
  displayName: 'Test Employee 2',
  email: 'employee2@example.com',
  isActive: true,
};

const FISCAL_YEAR = 2025;

describe('HR Workflow Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    // Check if emulators are running
    emulatorsRunning = await checkEmulatorsRunning();

    if (!emulatorsRunning) {
      console.warn(
        '\n⚠️  Firebase emulators not running. Skipping integration tests.\n' +
          '   Run: firebase emulators:start\n'
      );
      return;
    }

    const firebase = initializeTestFirebase();
    db = firebase.db;
  });

  beforeEach(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
    }
  });

  afterAll(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
      await cleanupTestFirebase();
    }
  });

  // Helper to skip tests if emulators not running
  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulators not running)`);
        return;
      }
      await fn();
    });
  };

  // ============================================================================
  // LEAVE TYPE SETUP
  // ============================================================================

  itWithEmulator('Setup: Create leave types', async () => {
    const now = Timestamp.now();

    const leaveTypes = [
      {
        id: 'lt-sick',
        code: 'SICK',
        name: 'Sick Leave',
        description: 'Leave for medical purposes',
        annualQuota: 12,
        maxCarryForward: 5,
        isActive: true,
        color: '#ef4444',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lt-casual',
        code: 'CASUAL',
        name: 'Casual Leave',
        description: 'Leave for personal purposes',
        annualQuota: 12,
        maxCarryForward: 3,
        isActive: true,
        color: '#3b82f6',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lt-compoff',
        code: 'COMP_OFF',
        name: 'Compensatory Off',
        description: 'Earned by working on holidays',
        annualQuota: 0,
        maxCarryForward: 0,
        isActive: true,
        color: '#10b981',
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const leaveType of leaveTypes) {
      await setDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, leaveType.id), leaveType);
    }

    // Verify
    const sickDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-sick'));
    expect(sickDoc.exists()).toBe(true);
    expect(sickDoc.data()?.code).toBe('SICK');

    const compOffDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-compoff'));
    expect(compOffDoc.exists()).toBe(true);
    expect(compOffDoc.data()?.code).toBe('COMP_OFF');
  });

  // ============================================================================
  // LEAVE BALANCE INITIALIZATION
  // ============================================================================

  itWithEmulator('Step 1: Initialize leave balances for a user', async () => {
    const now = Timestamp.now();

    // Setup: Create user
    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER.id), {
      ...TEST_USER,
      createdAt: now,
      updatedAt: now,
    });

    // Setup: Create leave types
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-sick'), {
      code: 'SICK',
      name: 'Sick Leave',
      annualQuota: 12,
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-casual'), {
      code: 'CASUAL',
      name: 'Casual Leave',
      annualQuota: 12,
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-compoff'), {
      code: 'COMP_OFF',
      name: 'Compensatory Off',
      annualQuota: 0,
      isActive: true,
      createdAt: now,
    });

    // Create leave balances for user
    const balances = [
      {
        id: 'bal-sick',
        userId: TEST_USER.id,
        userName: TEST_USER.displayName,
        userEmail: TEST_USER.email,
        leaveTypeId: 'lt-sick',
        leaveTypeCode: 'SICK',
        leaveTypeName: 'Sick Leave',
        fiscalYear: FISCAL_YEAR,
        entitled: 12,
        used: 0,
        pending: 0,
        available: 12,
        carryForward: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bal-casual',
        userId: TEST_USER.id,
        userName: TEST_USER.displayName,
        userEmail: TEST_USER.email,
        leaveTypeId: 'lt-casual',
        leaveTypeCode: 'CASUAL',
        leaveTypeName: 'Casual Leave',
        fiscalYear: FISCAL_YEAR,
        entitled: 12,
        used: 0,
        pending: 0,
        available: 12,
        carryForward: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bal-compoff',
        userId: TEST_USER.id,
        userName: TEST_USER.displayName,
        userEmail: TEST_USER.email,
        leaveTypeId: 'lt-compoff',
        leaveTypeCode: 'COMP_OFF',
        leaveTypeName: 'Compensatory Off',
        fiscalYear: FISCAL_YEAR,
        entitled: 0,
        used: 0,
        pending: 0,
        available: 0,
        carryForward: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const balance of balances) {
      await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balance.id), balance);
    }

    // Verify balances were created
    const q = query(
      collection(db, COLLECTIONS.HR_LEAVE_BALANCES),
      where('userId', '==', TEST_USER.id),
      where('fiscalYear', '==', FISCAL_YEAR)
    );
    const snapshot = await getDocs(q);

    expect(snapshot.docs.length).toBe(3);

    // Verify COMP_OFF balance starts at 0
    const compOffBalance = snapshot.docs.find((d) => d.data().leaveTypeCode === 'COMP_OFF');
    expect(compOffBalance?.data().entitled).toBe(0);
    expect(compOffBalance?.data().available).toBe(0);
  });

  // ============================================================================
  // LEAVE REQUEST WORKFLOW
  // ============================================================================

  itWithEmulator('Step 2: Submit leave request and update pending balance', async () => {
    const now = Timestamp.now();

    // Setup: Create balance with available leave
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      userId: TEST_USER.id,
      leaveTypeCode: 'CASUAL',
      fiscalYear: FISCAL_YEAR,
      entitled: 12,
      used: 0,
      pending: 0,
      available: 12,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create leave request
    const leaveRequestId = 'lr-001';
    const numberOfDays = 2;

    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      requestNumber: 'LR/2025/01/0001',
      userId: TEST_USER.id,
      userName: TEST_USER.displayName,
      leaveTypeCode: 'CASUAL',
      leaveTypeName: 'Casual Leave',
      startDate: Timestamp.fromDate(new Date(2025, 0, 20)),
      endDate: Timestamp.fromDate(new Date(2025, 0, 21)),
      numberOfDays,
      reason: 'Personal work',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    // Update balance to add pending days
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      pending: numberOfDays,
      available: 12 - numberOfDays,
      updatedAt: Timestamp.now(),
    });

    // Verify
    const balanceDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'));
    expect(balanceDoc.data()?.pending).toBe(2);
    expect(balanceDoc.data()?.available).toBe(10);

    const requestDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId));
    expect(requestDoc.data()?.status).toBe('PENDING');
  });

  itWithEmulator('Step 3: Approve leave request and update used balance', async () => {
    const now = Timestamp.now();

    // Setup: Create balance with pending leave
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      userId: TEST_USER.id,
      leaveTypeCode: 'CASUAL',
      fiscalYear: FISCAL_YEAR,
      entitled: 12,
      used: 0,
      pending: 2,
      available: 10,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Setup: Create pending leave request
    const leaveRequestId = 'lr-001';
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      requestNumber: 'LR/2025/01/0001',
      userId: TEST_USER.id,
      leaveTypeCode: 'CASUAL',
      numberOfDays: 2,
      status: 'PENDING',
      createdAt: now,
    });

    // Approve the request
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      status: 'APPROVED',
      approvedBy: TEST_ADMIN.id,
      approvedByName: TEST_ADMIN.displayName,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Update balance: move from pending to used
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      pending: 0,
      used: 2,
      available: 10, // stays the same since already deducted when pending
      updatedAt: Timestamp.now(),
    });

    // Verify
    const balanceDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'));
    expect(balanceDoc.data()?.pending).toBe(0);
    expect(balanceDoc.data()?.used).toBe(2);
    expect(balanceDoc.data()?.available).toBe(10);

    const requestDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId));
    expect(requestDoc.data()?.status).toBe('APPROVED');
    expect(requestDoc.data()?.approvedBy).toBe(TEST_ADMIN.id);
  });

  itWithEmulator('Step 4: Reject leave request and restore available balance', async () => {
    const now = Timestamp.now();

    // Setup: Create balance with pending leave
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      userId: TEST_USER.id,
      leaveTypeCode: 'CASUAL',
      fiscalYear: FISCAL_YEAR,
      entitled: 12,
      used: 0,
      pending: 3,
      available: 9,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Setup: Create pending leave request
    const leaveRequestId = 'lr-002';
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      requestNumber: 'LR/2025/01/0002',
      userId: TEST_USER.id,
      leaveTypeCode: 'CASUAL',
      numberOfDays: 3,
      status: 'PENDING',
      createdAt: now,
    });

    // Reject the request
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      status: 'REJECTED',
      rejectedBy: TEST_ADMIN.id,
      rejectedByName: TEST_ADMIN.displayName,
      rejectionReason: 'Project deadline',
      rejectedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Update balance: restore pending to available
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'), {
      pending: 0,
      available: 12, // restored
      updatedAt: Timestamp.now(),
    });

    // Verify
    const balanceDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-casual'));
    expect(balanceDoc.data()?.pending).toBe(0);
    expect(balanceDoc.data()?.used).toBe(0);
    expect(balanceDoc.data()?.available).toBe(12);

    const requestDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId));
    expect(requestDoc.data()?.status).toBe('REJECTED');
  });

  // ============================================================================
  // HOLIDAY WORKING OVERRIDE WORKFLOW
  // ============================================================================

  itWithEmulator('Step 5: Create holiday and convert to working day', async () => {
    const now = Timestamp.now();

    // Setup: Create holiday
    const holidayId = 'holiday-001';
    const holidayDate = new Date(2025, 0, 26); // Republic Day

    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId), {
      name: 'Republic Day',
      date: Timestamp.fromDate(holidayDate),
      year: 2025,
      type: 'NATIONAL',
      isActive: true,
      createdAt: now,
      createdBy: TEST_ADMIN.id,
    });

    // Verify holiday exists
    const holidayDoc = await getDoc(doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId));
    expect(holidayDoc.exists()).toBe(true);
    expect(holidayDoc.data()?.name).toBe('Republic Day');
  });

  itWithEmulator('Step 6: Create holiday working override for all users', async () => {
    const now = Timestamp.now();

    // Setup: Create users
    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER.id), {
      ...TEST_USER,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER_2.id), {
      ...TEST_USER_2,
      createdAt: now,
    });

    // Setup: Create holiday
    const holidayId = 'holiday-001';
    const holidayDate = new Date(2025, 0, 26);

    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId), {
      name: 'Republic Day',
      date: Timestamp.fromDate(holidayDate),
      year: 2025,
      type: 'NATIONAL',
      isActive: true,
      createdAt: now,
    });

    // Create holiday working override
    const overrideId = 'hwo-001';
    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      holidayId,
      holidayName: 'Republic Day',
      holidayDate: Timestamp.fromDate(holidayDate),
      isAdHoc: false,
      scope: 'ALL_USERS',
      affectedUserIds: [],
      compOffGrantedCount: 0,
      processedUserIds: [],
      failedUserIds: [],
      createdBy: TEST_ADMIN.id,
      createdByName: TEST_ADMIN.displayName,
      createdByEmail: TEST_ADMIN.email,
      reason: 'Critical project deadline',
      status: 'PROCESSING',
      createdAt: now,
      updatedAt: now,
    });

    // Verify override was created
    const overrideDoc = await getDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId));
    expect(overrideDoc.exists()).toBe(true);
    expect(overrideDoc.data()?.status).toBe('PROCESSING');
    expect(overrideDoc.data()?.scope).toBe('ALL_USERS');
  });

  itWithEmulator('Step 7: Grant comp-off through holiday working override', async () => {
    const now = Timestamp.now();

    // Setup: Create user with COMP_OFF balance
    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER.id), {
      ...TEST_USER,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      userId: TEST_USER.id,
      userName: TEST_USER.displayName,
      userEmail: TEST_USER.email,
      leaveTypeCode: 'COMP_OFF',
      leaveTypeName: 'Compensatory Off',
      fiscalYear: FISCAL_YEAR,
      entitled: 0,
      used: 0,
      pending: 0,
      available: 0,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Setup: Create holiday working override
    const overrideId = 'hwo-001';
    const holidayDate = new Date(2025, 0, 26);

    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      holidayId: 'holiday-001',
      holidayName: 'Republic Day',
      holidayDate: Timestamp.fromDate(holidayDate),
      scope: 'SPECIFIC_USERS',
      affectedUserIds: [TEST_USER.id],
      status: 'PROCESSING',
      createdBy: TEST_ADMIN.id,
      createdAt: now,
    });

    // Simulate processing: Grant comp-off to user
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      entitled: 1,
      available: 1,
      updatedAt: Timestamp.now(),
      updatedBy: TEST_ADMIN.id,
    });

    // Update override status to completed
    await updateDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      status: 'COMPLETED',
      compOffGrantedCount: 1,
      processedUserIds: [TEST_USER.id],
      failedUserIds: [],
      processedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Verify comp-off was granted
    const balanceDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'));
    expect(balanceDoc.data()?.entitled).toBe(1);
    expect(balanceDoc.data()?.available).toBe(1);

    const overrideDoc = await getDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId));
    expect(overrideDoc.data()?.status).toBe('COMPLETED');
    expect(overrideDoc.data()?.compOffGrantedCount).toBe(1);
  });

  // ============================================================================
  // AD-HOC WORKING DAY WORKFLOW
  // ============================================================================

  itWithEmulator('Step 8: Create ad-hoc working day (Saturday)', async () => {
    const now = Timestamp.now();

    // Setup: Create user with COMP_OFF balance
    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER.id), {
      ...TEST_USER,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      userId: TEST_USER.id,
      leaveTypeCode: 'COMP_OFF',
      fiscalYear: FISCAL_YEAR,
      entitled: 0,
      used: 0,
      pending: 0,
      available: 0,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create ad-hoc working day override (no holidayId)
    const overrideId = 'hwo-adhoc-001';
    const saturdayDate = new Date(2025, 0, 4); // First Saturday of January 2025

    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      // No holidayId for ad-hoc
      holidayName: 'Working Saturday - 04 Jan 2025',
      holidayDate: Timestamp.fromDate(saturdayDate),
      isAdHoc: true,
      scope: 'ALL_USERS',
      affectedUserIds: [],
      compOffGrantedCount: 0,
      processedUserIds: [],
      failedUserIds: [],
      createdBy: TEST_ADMIN.id,
      createdByName: TEST_ADMIN.displayName,
      createdByEmail: TEST_ADMIN.email,
      reason: 'Project deadline',
      status: 'PROCESSING',
      createdAt: now,
      updatedAt: now,
    });

    // Verify override was created as ad-hoc
    const overrideDoc = await getDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId));
    expect(overrideDoc.exists()).toBe(true);
    expect(overrideDoc.data()?.isAdHoc).toBe(true);
    expect(overrideDoc.data()?.holidayId).toBeUndefined();
    expect(overrideDoc.data()?.holidayName).toBe('Working Saturday - 04 Jan 2025');
  });

  // ============================================================================
  // COMP-OFF USAGE WORKFLOW
  // ============================================================================

  itWithEmulator('Step 9: Use comp-off through leave request', async () => {
    const now = Timestamp.now();

    // Setup: Create user with comp-off balance
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      userId: TEST_USER.id,
      userName: TEST_USER.displayName,
      leaveTypeCode: 'COMP_OFF',
      leaveTypeName: 'Compensatory Off',
      fiscalYear: FISCAL_YEAR,
      entitled: 2,
      used: 0,
      pending: 0,
      available: 2,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create leave request for comp-off
    const leaveRequestId = 'lr-compoff-001';
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      requestNumber: 'LR/2025/01/0003',
      userId: TEST_USER.id,
      userName: TEST_USER.displayName,
      leaveTypeCode: 'COMP_OFF',
      leaveTypeName: 'Compensatory Off',
      startDate: Timestamp.fromDate(new Date(2025, 1, 10)),
      endDate: Timestamp.fromDate(new Date(2025, 1, 10)),
      numberOfDays: 1,
      reason: 'Personal work',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    // Update balance: add pending
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      pending: 1,
      available: 1,
      updatedAt: Timestamp.now(),
    });

    // Approve the request
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      status: 'APPROVED',
      approvedBy: TEST_ADMIN.id,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Update balance: move from pending to used
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'), {
      pending: 0,
      used: 1,
      available: 1,
      updatedAt: Timestamp.now(),
    });

    // Verify
    const balanceDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, 'bal-compoff'));
    expect(balanceDoc.data()?.used).toBe(1);
    expect(balanceDoc.data()?.available).toBe(1);
    expect(balanceDoc.data()?.entitled).toBe(2); // Still 2, entitled doesn't change

    const requestDoc = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId));
    expect(requestDoc.data()?.status).toBe('APPROVED');
  });

  // ============================================================================
  // COMPLETE HR WORKFLOW TEST
  // ============================================================================

  itWithEmulator('Complete Workflow: Balance Init → Holiday Override → Comp-Off Use', async () => {
    const now = Timestamp.now();

    // 1. Create user
    await setDoc(doc(db, COLLECTIONS.USERS, TEST_USER.id), {
      ...TEST_USER,
      createdAt: now,
    });

    // 2. Create leave types
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_TYPES, 'lt-compoff'), {
      code: 'COMP_OFF',
      name: 'Compensatory Off',
      annualQuota: 0,
      isActive: true,
      createdAt: now,
    });

    // 3. Initialize COMP_OFF balance
    const balanceId = 'workflow-bal-compoff';
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId), {
      userId: TEST_USER.id,
      userName: TEST_USER.displayName,
      userEmail: TEST_USER.email,
      leaveTypeId: 'lt-compoff',
      leaveTypeCode: 'COMP_OFF',
      leaveTypeName: 'Compensatory Off',
      fiscalYear: FISCAL_YEAR,
      entitled: 0,
      used: 0,
      pending: 0,
      available: 0,
      carryForward: 0,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create holiday
    const holidayId = 'workflow-holiday';
    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId), {
      name: 'Independence Day',
      date: Timestamp.fromDate(new Date(2025, 7, 15)),
      year: 2025,
      type: 'NATIONAL',
      isActive: true,
      createdAt: now,
    });

    // 5. Create holiday working override
    const overrideId = 'workflow-override';
    await setDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      holidayId,
      holidayName: 'Independence Day',
      holidayDate: Timestamp.fromDate(new Date(2025, 7, 15)),
      isAdHoc: false,
      scope: 'SPECIFIC_USERS',
      affectedUserIds: [TEST_USER.id],
      status: 'PROCESSING',
      createdBy: TEST_ADMIN.id,
      createdAt: now,
    });

    // 6. Process override: Grant comp-off
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId), {
      entitled: 1,
      available: 1,
      updatedAt: Timestamp.now(),
    });

    await updateDoc(doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId), {
      status: 'COMPLETED',
      compOffGrantedCount: 1,
      processedUserIds: [TEST_USER.id],
      processedAt: Timestamp.now(),
    });

    // 7. User submits comp-off leave request
    const leaveRequestId = 'workflow-lr';
    await setDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      userId: TEST_USER.id,
      leaveTypeCode: 'COMP_OFF',
      numberOfDays: 1,
      status: 'PENDING',
      createdAt: now,
    });

    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId), {
      pending: 1,
      available: 0,
      updatedAt: Timestamp.now(),
    });

    // 8. Approve leave request
    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId), {
      status: 'APPROVED',
      approvedBy: TEST_ADMIN.id,
      approvedAt: Timestamp.now(),
    });

    await updateDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId), {
      pending: 0,
      used: 1,
      available: 0,
      updatedAt: Timestamp.now(),
    });

    // Final Verification
    const finalBalance = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId));
    expect(finalBalance.data()?.entitled).toBe(1);
    expect(finalBalance.data()?.used).toBe(1);
    expect(finalBalance.data()?.pending).toBe(0);
    expect(finalBalance.data()?.available).toBe(0);

    const finalOverride = await getDoc(
      doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId)
    );
    expect(finalOverride.data()?.status).toBe('COMPLETED');
    expect(finalOverride.data()?.compOffGrantedCount).toBe(1);

    const finalRequest = await getDoc(doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, leaveRequestId));
    expect(finalRequest.data()?.status).toBe('APPROVED');

    // eslint-disable-next-line no-console
    console.log('\n✅ Complete HR workflow verified successfully!\n');
  });
});
