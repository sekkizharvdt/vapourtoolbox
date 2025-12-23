/**
 * Project Charter Workflow Integration Test
 *
 * Tests the complete project charter workflow:
 * 1. Create a project with charter
 * 2. Add procurement items to charter
 * 3. Add document requirements to charter
 * 4. Validate charter before submission
 * 5. Create Purchase Requests from charter items
 * 6. Track budget actuals against charter
 *
 * Prerequisites:
 * - Firebase emulators running: `firebase emulators:start`
 *
 * Run with: `pnpm test:integration`
 */

import { doc, setDoc, getDoc, updateDoc, Timestamp, collection, getDocs } from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import type { Firestore } from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  PROJECTS: 'projects',
  PURCHASE_REQUESTS: 'purchaseRequests',
  PURCHASE_REQUEST_ITEMS: 'purchaseRequestItems',
  TRANSACTIONS: 'transactions',
  DOCUMENTS: 'documents',
};

// Test data
const TEST_USER = {
  id: 'test-user-001',
  name: 'Test User',
  email: 'test@example.com',
};

const TEST_ENTITY = {
  id: 'entity-001',
  name: 'Test Entity Ltd',
};

describe('Project Charter Workflow Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
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
    }
  });

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
  // STEP 1: Create Project with Charter
  // ============================================================================

  itWithEmulator('Step 1: Create a project with initial charter', async () => {
    const projectId = 'proj-001';
    const now = Timestamp.now();

    const projectData = {
      id: projectId,
      number: 'PRJ/2024/001',
      name: 'Steam System Upgrade',
      description: 'Complete steam system upgrade for Plant A',
      entityId: TEST_ENTITY.id,
      entityName: TEST_ENTITY.name,
      status: 'ACTIVE',

      // Charter structure
      charter: {
        status: 'DRAFT',
        objectives: ['Improve steam efficiency', 'Reduce maintenance costs'],
        scope: {
          inScope: ['Steam piping', 'Control valves', 'Instrumentation'],
          outOfScope: ['Boiler replacement'],
        },
        budget: {
          totalApproved: { amount: 5000000, currency: 'INR' },
          breakdown: [
            {
              id: 'budget-001',
              category: 'EQUIPMENT',
              description: 'Control valves and instruments',
              estimatedAmount: { amount: 3000000, currency: 'INR' },
            },
            {
              id: 'budget-002',
              category: 'MATERIAL',
              description: 'Piping materials',
              estimatedAmount: { amount: 1500000, currency: 'INR' },
            },
            {
              id: 'budget-003',
              category: 'SERVICES',
              description: 'Installation services',
              estimatedAmount: { amount: 500000, currency: 'INR' },
            },
          ],
        },
        milestones: [
          {
            id: 'ms-001',
            name: 'Design Completion',
            targetDate: Timestamp.fromDate(new Date('2024-06-30')),
            status: 'PENDING',
          },
          {
            id: 'ms-002',
            name: 'Procurement Complete',
            targetDate: Timestamp.fromDate(new Date('2024-09-30')),
            status: 'PENDING',
          },
        ],
      },

      // Empty procurement items initially
      procurementItems: [],
      documentRequirements: [],

      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), projectData);

    // Verify creation
    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    expect(projectSnap.exists()).toBe(true);

    const savedProject = projectSnap.data();
    expect(savedProject?.name).toBe('Steam System Upgrade');
    expect(savedProject?.charter?.status).toBe('DRAFT');
    expect(savedProject?.charter?.budget?.totalApproved?.amount).toBe(5000000);
    expect(savedProject?.charter?.budget?.breakdown).toHaveLength(3);
  });

  // ============================================================================
  // STEP 2: Add Procurement Items to Charter
  // ============================================================================

  itWithEmulator('Step 2: Add procurement items to project charter', async () => {
    const projectId = 'proj-002';
    const now = Timestamp.now();

    // Create project first
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      status: 'ACTIVE',
      charter: { status: 'DRAFT' },
      procurementItems: [],
      createdAt: now,
      updatedAt: now,
    });

    // Add procurement items
    const procurementItems = [
      {
        id: 'proc-001',
        itemName: 'DN50 Control Valve',
        description: 'Pneumatic control valve for steam flow control',
        category: 'EQUIPMENT',
        quantity: 5,
        unit: 'NOS',
        estimatedUnitPrice: { amount: 150000, currency: 'INR' },
        estimatedTotalPrice: { amount: 750000, currency: 'INR' },
        status: 'PLANNING',
        priority: 'HIGH',
        requiredByDate: Timestamp.fromDate(new Date('2024-06-15')),
      },
      {
        id: 'proc-002',
        itemName: 'Steam Trap',
        description: 'Thermodynamic steam trap',
        category: 'EQUIPMENT',
        quantity: 20,
        unit: 'NOS',
        estimatedUnitPrice: { amount: 15000, currency: 'INR' },
        estimatedTotalPrice: { amount: 300000, currency: 'INR' },
        status: 'PLANNING',
        priority: 'MEDIUM',
        requiredByDate: Timestamp.fromDate(new Date('2024-07-01')),
      },
      {
        id: 'proc-003',
        itemName: 'CS Pipe 100NB Sch40',
        description: 'Carbon steel pipe for steam distribution',
        category: 'MATERIAL',
        quantity: 500,
        unit: 'MTR',
        estimatedUnitPrice: { amount: 2000, currency: 'INR' },
        estimatedTotalPrice: { amount: 1000000, currency: 'INR' },
        status: 'PLANNING',
        priority: 'HIGH',
        requiredByDate: Timestamp.fromDate(new Date('2024-06-01')),
      },
    ];

    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      procurementItems,
      updatedAt: Timestamp.now(),
    });

    // Verify items were added
    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    const savedProject = projectSnap.data();

    expect(savedProject?.procurementItems).toHaveLength(3);
    expect(savedProject?.procurementItems[0]?.itemName).toBe('DN50 Control Valve');
    expect(savedProject?.procurementItems[2]?.category).toBe('MATERIAL');

    // Calculate total estimated procurement cost
    const totalEstimated = procurementItems.reduce(
      (sum, item) => sum + item.estimatedTotalPrice.amount,
      0
    );
    expect(totalEstimated).toBe(2050000); // 750000 + 300000 + 1000000
  });

  // ============================================================================
  // STEP 3: Add Document Requirements
  // ============================================================================

  itWithEmulator('Step 3: Add document requirements to project charter', async () => {
    const projectId = 'proj-003';
    const now = Timestamp.now();

    // Create project
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      status: 'ACTIVE',
      documentRequirements: [],
      createdAt: now,
      updatedAt: now,
    });

    // Add document requirements
    const documentRequirements = [
      {
        id: 'doc-req-001',
        documentType: 'P&ID',
        title: 'Process & Instrumentation Diagram',
        description: 'Complete P&ID for steam system',
        status: 'NOT_SUBMITTED',
        requiredBy: Timestamp.fromDate(new Date('2024-05-01')),
        isMandatory: true,
      },
      {
        id: 'doc-req-002',
        documentType: 'ISOMETRIC',
        title: 'Piping Isometrics',
        description: 'Isometric drawings for all steam lines',
        status: 'NOT_SUBMITTED',
        requiredBy: Timestamp.fromDate(new Date('2024-05-15')),
        isMandatory: true,
      },
      {
        id: 'doc-req-003',
        documentType: 'DATASHEET',
        title: 'Equipment Datasheets',
        description: 'Datasheets for all control valves',
        status: 'NOT_SUBMITTED',
        requiredBy: Timestamp.fromDate(new Date('2024-04-30')),
        isMandatory: true,
      },
    ];

    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      documentRequirements,
      updatedAt: Timestamp.now(),
    });

    // Verify requirements were added
    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    const savedProject = projectSnap.data();

    expect(savedProject?.documentRequirements).toHaveLength(3);
    expect(savedProject?.documentRequirements[0]?.documentType).toBe('P&ID');
    expect(savedProject?.documentRequirements.every((r: { isMandatory: boolean }) => r.isMandatory)).toBe(true);
  });

  // ============================================================================
  // STEP 4: Link Documents to Requirements
  // ============================================================================

  itWithEmulator('Step 4: Link uploaded documents to requirements', async () => {
    const projectId = 'proj-004';
    const documentId = 'doc-001';
    const now = Timestamp.now();

    // Create project with a document requirement
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      status: 'ACTIVE',
      documentRequirements: [
        {
          id: 'doc-req-001',
          documentType: 'P&ID',
          title: 'Process & Instrumentation Diagram',
          status: 'NOT_SUBMITTED',
          isMandatory: true,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Create a document
    await setDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
      id: documentId,
      title: 'Steam System P&ID Rev A',
      type: 'P&ID',
      status: 'APPROVED',
      projectId,
      createdAt: now,
    });

    // Update requirement with linked document
    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      documentRequirements: [
        {
          id: 'doc-req-001',
          documentType: 'P&ID',
          title: 'Process & Instrumentation Diagram',
          status: 'APPROVED',
          isMandatory: true,
          linkedDocumentId: documentId,
          linkedDocumentTitle: 'Steam System P&ID Rev A',
        },
      ],
      updatedAt: Timestamp.now(),
    });

    // Verify linkage
    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    const savedProject = projectSnap.data();

    expect(savedProject?.documentRequirements[0]?.linkedDocumentId).toBe(documentId);
    expect(savedProject?.documentRequirements[0]?.status).toBe('APPROVED');
  });

  // ============================================================================
  // STEP 5: Create Purchase Requests from Charter Items
  // ============================================================================

  itWithEmulator('Step 5: Create PRs from charter procurement items', async () => {
    const projectId = 'proj-005';
    const now = Timestamp.now();

    // Create project with procurement items
    const procurementItems = [
      {
        id: 'proc-001',
        itemName: 'DN50 Control Valve',
        category: 'EQUIPMENT',
        quantity: 5,
        unit: 'NOS',
        status: 'PLANNING',
        estimatedUnitPrice: { amount: 150000, currency: 'INR' },
        estimatedTotalPrice: { amount: 750000, currency: 'INR' },
      },
    ];

    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      procurementItems,
      createdAt: now,
      updatedAt: now,
    });

    // Simulate PR creation (what charterProcurementService does)
    const prId = 'pr-001';
    const prNumber = 'PR/2024/06/0001';

    // Create PR
    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      id: prId,
      number: prNumber,
      title: 'Charter Item: DN50 Control Valve',
      projectId,
      projectName: 'Steam System Upgrade',
      status: 'DRAFT',
      charterItemId: 'proc-001',
      itemCount: 1,
      createdAt: now,
      createdBy: TEST_USER.id,
    });

    // Create PR Item
    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, 'pri-001'), {
      id: 'pri-001',
      purchaseRequestId: prId,
      description: 'DN50 Control Valve',
      quantity: 5,
      unit: 'NOS',
      estimatedUnitCost: 150000,
      estimatedTotalCost: 750000,
      status: 'PENDING',
    });

    // Update charter item with PR link
    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      procurementItems: [
        {
          ...procurementItems[0],
          status: 'PR_DRAFTED',
          linkedPurchaseRequestId: prId,
        },
      ],
      updatedAt: Timestamp.now(),
    });

    // Verify PR was created and linked
    const prSnap = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    expect(prSnap.exists()).toBe(true);
    expect(prSnap.data()?.charterItemId).toBe('proc-001');

    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    expect(projectSnap.data()?.procurementItems[0]?.status).toBe('PR_DRAFTED');
    expect(projectSnap.data()?.procurementItems[0]?.linkedPurchaseRequestId).toBe(prId);
  });

  // ============================================================================
  // STEP 6: Track Budget Actuals
  // ============================================================================

  itWithEmulator('Step 6: Track actual costs against budget', async () => {
    const projectId = 'proj-006';
    const now = Timestamp.now();

    // Create project with budget breakdown
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      charter: {
        budget: {
          totalApproved: { amount: 5000000, currency: 'INR' },
          breakdown: [
            {
              id: 'budget-001',
              category: 'EQUIPMENT',
              description: 'Control valves and instruments',
              estimatedAmount: { amount: 3000000, currency: 'INR' },
            },
          ],
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create transactions linked to budget line items
    const transactions = [
      {
        id: 'txn-001',
        projectId,
        budgetLineItemId: 'budget-001',
        type: 'VENDOR_BILL',
        status: 'POSTED',
        amount: 750000,
        currency: 'INR',
        description: 'Control valve order - Advance',
        createdAt: now,
      },
      {
        id: 'txn-002',
        projectId,
        budgetLineItemId: 'budget-001',
        type: 'VENDOR_PAYMENT',
        status: 'PAID',
        amount: 750000,
        currency: 'INR',
        description: 'Control valve order - Payment',
        createdAt: now,
      },
      {
        id: 'txn-003',
        projectId,
        budgetLineItemId: 'budget-001',
        type: 'VENDOR_BILL',
        status: 'POSTED',
        amount: 500000,
        currency: 'INR',
        description: 'Steam traps order',
        createdAt: now,
      },
    ];

    for (const txn of transactions) {
      await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, txn.id), txn);
    }

    // Verify transactions exist
    const txnSnap = await getDocs(collection(db, COLLECTIONS.TRANSACTIONS));
    expect(txnSnap.size).toBe(3);

    // Calculate actuals (what budgetCalculationService does)
    let actualCosts = 0;
    txnSnap.forEach((doc) => {
      const txn = doc.data();
      if (
        txn.projectId === projectId &&
        txn.budgetLineItemId === 'budget-001' &&
        ['VENDOR_BILL', 'VENDOR_PAYMENT', 'EXPENSE_CLAIM'].includes(txn.type) &&
        ['POSTED', 'PAID', 'PARTIALLY_PAID'].includes(txn.status)
      ) {
        actualCosts += txn.amount;
      }
    });

    expect(actualCosts).toBe(2000000); // 750000 + 750000 + 500000

    // Calculate budget utilization
    const budgetAmount = 3000000;
    const utilizationPercent = (actualCosts / budgetAmount) * 100;
    expect(utilizationPercent).toBeCloseTo(66.67, 1);
  });

  // ============================================================================
  // STEP 7: Sync Procurement Item Status
  // ============================================================================

  itWithEmulator('Step 7: Sync procurement item status through workflow', async () => {
    const projectId = 'proj-007';
    const now = Timestamp.now();

    // Create project with procurement item at PR_DRAFTED status
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      procurementItems: [
        {
          id: 'proc-001',
          itemName: 'DN50 Control Valve',
          status: 'PR_DRAFTED',
          linkedPurchaseRequestId: 'pr-001',
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Simulate status progression: PR_DRAFTED -> RFQ_ISSUED -> PO_PLACED -> DELIVERED
    const statusProgression = [
      { status: 'RFQ_ISSUED', linkedRFQId: 'rfq-001' },
      { status: 'PO_PLACED', linkedPOId: 'po-001' },
      { status: 'DELIVERED' },
    ];

    for (const update of statusProgression) {
      const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
      const project = projectSnap.data();
      const currentItem = project?.procurementItems[0];

      const updatedItem = {
        ...currentItem,
        status: update.status,
        ...(update.linkedRFQId && { linkedRFQId: update.linkedRFQId }),
        ...(update.linkedPOId && { linkedPOId: update.linkedPOId }),
      };

      await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
        procurementItems: [updatedItem],
        updatedAt: Timestamp.now(),
      });
    }

    // Verify final status
    const finalSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    const finalProject = finalSnap.data();
    const finalItem = finalProject?.procurementItems[0];

    expect(finalItem?.status).toBe('DELIVERED');
    expect(finalItem?.linkedPurchaseRequestId).toBe('pr-001');
    expect(finalItem?.linkedRFQId).toBe('rfq-001');
    expect(finalItem?.linkedPOId).toBe('po-001');
  });

  // ============================================================================
  // STEP 8: Charter Approval Workflow
  // ============================================================================

  itWithEmulator('Step 8: Complete charter approval workflow', async () => {
    const projectId = 'proj-008';
    const now = Timestamp.now();

    // Create project with complete charter
    await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      id: projectId,
      name: 'Steam System Upgrade',
      charter: {
        status: 'DRAFT',
        objectives: ['Improve efficiency'],
        scope: { inScope: ['Steam system'], outOfScope: ['Boiler'] },
        budget: {
          totalApproved: { amount: 5000000, currency: 'INR' },
          breakdown: [{ id: 'b1', category: 'EQUIPMENT', estimatedAmount: { amount: 5000000, currency: 'INR' } }],
        },
        milestones: [{ id: 'm1', name: 'Complete', targetDate: now, status: 'PENDING' }],
      },
      procurementItems: [
        { id: 'p1', itemName: 'Control Valve', status: 'PLANNING', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
      ],
      documentRequirements: [
        { id: 'd1', documentType: 'P&ID', status: 'APPROVED', isMandatory: true, linkedDocumentId: 'doc-1' },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Submit for approval
    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      'charter.status': 'PENDING_APPROVAL',
      'charter.submittedAt': Timestamp.now(),
      'charter.submittedBy': TEST_USER.id,
      updatedAt: Timestamp.now(),
    });

    // Verify pending status
    let projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    expect(projectSnap.data()?.charter?.status).toBe('PENDING_APPROVAL');

    // Approve charter
    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
      'charter.status': 'APPROVED',
      'charter.approvedAt': Timestamp.now(),
      'charter.approvedBy': 'approver-001',
      updatedAt: Timestamp.now(),
    });

    // Verify approved status
    projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    expect(projectSnap.data()?.charter?.status).toBe('APPROVED');
    expect(projectSnap.data()?.charter?.approvedBy).toBe('approver-001');
  });
});
