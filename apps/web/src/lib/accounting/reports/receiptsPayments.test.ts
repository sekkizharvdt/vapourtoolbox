/**
 * Receipts & Payments Report Tests
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
    COST_CENTRES: 'costCentres',
    PROJECTS: 'projects',
  },
}));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ path: name })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import { generateReceiptsPaymentsReport } from './receiptsPayments';

function mockDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function mockSnapshot(docs: ReturnType<typeof mockDoc>[]) {
  return {
    forEach: (cb: (doc: ReturnType<typeof mockDoc>) => void) => docs.forEach(cb),
    docs,
    size: docs.length,
    empty: docs.length === 0,
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const mockDb = {} as never;

// Standard accounts used across tests
function createStandardAccounts() {
  return [
    mockDoc('bank-acc', {
      code: '1000',
      name: 'Bank Account',
      accountType: 'ASSET',
      isBankAccount: true,
      openingBalance: 100000,
      currentBalance: 150000,
    }),
    mockDoc('cash-acc', {
      code: '1010',
      name: 'Petty Cash',
      accountType: 'ASSET',
      isBankAccount: false,
      openingBalance: 5000,
      currentBalance: 3000,
    }),
    mockDoc('recv-acc', {
      code: '1100',
      name: 'Accounts Receivable',
      accountType: 'ASSET',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
    mockDoc('salary-acc', {
      code: '6000',
      name: 'Salary Expense',
      accountType: 'EXPENSE',
      accountGroup: 'Salary & Wages',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
    mockDoc('gst-acc', {
      code: '2100',
      name: 'GST Payable',
      accountType: 'LIABILITY',
      accountGroup: 'Tax Liabilities',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
    mockDoc('rent-acc', {
      code: '6500',
      name: 'Office Rent',
      accountType: 'EXPENSE',
      accountGroup: 'Administrative',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
    mockDoc('loan-acc', {
      code: '2500',
      name: 'Term Loan',
      accountType: 'LIABILITY',
      accountGroup: 'Loan',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
    mockDoc('revenue-acc', {
      code: '4000',
      name: 'Service Revenue',
      accountType: 'REVENUE',
      isBankAccount: false,
      openingBalance: 0,
      currentBalance: 0,
    }),
  ];
}

function createStandardCostCentres() {
  return [
    mockDoc('cc-proj-1', {
      code: 'CC-P1',
      name: 'Project Alpha CC',
      category: 'PROJECT',
      projectId: 'proj-1',
    }),
    mockDoc('cc-overhead', {
      code: 'CC-OH',
      name: 'Overhead',
      category: 'OVERHEAD',
    }),
  ];
}

function createStandardProjects() {
  return [mockDoc('proj-1', { code: 'PROJ-001', name: 'Project Alpha' })];
}

// Setup mocks for a standard call (accounts, costCentres, projects, currentTxns, historicalTxns)
function setupMocks(
  accounts: ReturnType<typeof mockDoc>[],
  costCentres: ReturnType<typeof mockDoc>[],
  projects: ReturnType<typeof mockDoc>[],
  currentTransactions: ReturnType<typeof mockDoc>[],
  historicalTransactions: ReturnType<typeof mockDoc>[] = []
) {
  mockGetDocs
    .mockResolvedValueOnce(mockSnapshot(accounts))
    .mockResolvedValueOnce(mockSnapshot(costCentres))
    .mockResolvedValueOnce(mockSnapshot(projects))
    .mockResolvedValueOnce(mockSnapshot(currentTransactions))
    .mockResolvedValueOnce(mockSnapshot(historicalTransactions));
}

describe('Receipts & Payments Report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReceiptsPaymentsReport', () => {
    it('should generate report with correct period info', async () => {
      setupMocks(createStandardAccounts(), [], [], [], []);

      const report = await generateReceiptsPaymentsReport(mockDb, 3, 2024);

      expect(report.month).toBe(3);
      expect(report.year).toBe(2024);
      expect(report.monthName).toBe('March 2024');
      expect(report.startDate).toEqual(new Date(2024, 2, 1));
      // End of March
      expect(report.endDate.getMonth()).toBe(2);
      expect(report.endDate.getDate()).toBe(31);
    });

    it('should calculate opening balance from cash/bank accounts', async () => {
      setupMocks(createStandardAccounts(), [], [], [], []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      // bank-acc (100000) + cash-acc (5000) = 105000
      expect(report.openingBalance).toBe(105000);
      expect(report.openingBalanceByAccount).toHaveLength(2);
    });

    it('should adjust opening balance with historical transactions', async () => {
      const accounts = createStandardAccounts();
      const historical = [
        mockDoc('hist-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PAY-001',
          date: { toDate: () => new Date('2023-12-15') },
          entries: [
            { accountId: 'bank-acc', debit: 20000, credit: 0 },
            { accountId: 'recv-acc', debit: 0, credit: 20000 },
          ],
        }),
      ];

      setupMocks(accounts, [], [], [], historical);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      // Opening: 105000 + historical debit 20000 = 125000
      expect(report.openingBalance).toBe(125000);
    });

    it('should classify debit entries to cash/bank as receipts', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'RCV-001',
          date: { toDate: () => new Date('2024-01-10') },
          description: 'Payment from Client A',
          entityName: 'Client A',
          entries: [
            { accountId: 'bank-acc', debit: 75000, credit: 0, description: 'Payment received' },
            { accountId: 'recv-acc', debit: 0, credit: 75000 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.receipts.totalReceipts).toBe(75000);
    });

    it('should classify credit entries from cash/bank as payments', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'VENDOR_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PMT-001',
          date: { toDate: () => new Date('2024-01-15') },
          description: 'Salary payment',
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 40000 },
            { accountId: 'salary-acc', debit: 40000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.payments.totalPayments).toBe(40000);
      expect(report.payments.salaryWages.total).toBe(40000);
    });

    it('should categorize salary payments correctly', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'VENDOR_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PMT-001',
          date: { toDate: () => new Date('2024-01-25') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 50000 },
            { accountId: 'salary-acc', debit: 50000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.payments.salaryWages.total).toBe(50000);
      expect(report.payments.salaryWages.items).toHaveLength(1);
      expect(report.payments.salaryWages.categoryLabel).toBe('Salary & Wages');
    });

    it('should categorize tax payments correctly', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'JOURNAL_ENTRY',
          status: 'POSTED',
          transactionNumber: 'JE-001',
          date: { toDate: () => new Date('2024-01-20') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 15000 },
            { accountId: 'gst-acc', debit: 15000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.payments.dutiesTaxes.total).toBe(15000);
      expect(report.payments.dutiesTaxes.categoryLabel).toBe('Duties & Taxes');
    });

    it('should categorize loan payments correctly', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'JOURNAL_ENTRY',
          status: 'POSTED',
          transactionNumber: 'JE-002',
          date: { toDate: () => new Date('2024-01-05') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 25000 },
            { accountId: 'loan-acc', debit: 25000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.payments.loansOtherPayments.total).toBe(25000);
      expect(report.payments.loansOtherPayments.categoryLabel).toBe('Loans & Other Payments');
    });

    it('should categorize admin payments as default', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'VENDOR_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PMT-002',
          date: { toDate: () => new Date('2024-01-10') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 12000 },
            { accountId: 'rent-acc', debit: 12000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.payments.administrativeExpenses.total).toBe(12000);
    });

    it('should group receipts by project when cost centre is linked', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'RCV-001',
          date: { toDate: () => new Date('2024-01-10') },
          entries: [
            { accountId: 'bank-acc', debit: 200000, credit: 0, costCentreId: 'cc-proj-1' },
            { accountId: 'recv-acc', debit: 0, credit: 200000, costCentreId: 'cc-proj-1' },
          ],
        }),
      ];

      setupMocks(
        createStandardAccounts(),
        createStandardCostCentres(),
        createStandardProjects(),
        currentTxns,
        []
      );

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.receipts.projectReceipts).toHaveLength(1);
      expect(report.receipts.projectReceipts[0]!.projectName).toBe('Project Alpha');
      expect(report.receipts.projectReceipts[0]!.total).toBe(200000);
      expect(report.receipts.totalProjectReceipts).toBe(200000);
    });

    it('should put non-project receipts into other income', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'RCV-002',
          date: { toDate: () => new Date('2024-01-15') },
          entries: [
            { accountId: 'bank-acc', debit: 10000, credit: 0 },
            { accountId: 'revenue-acc', debit: 0, credit: 10000 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), createStandardCostCentres(), [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.receipts.otherIncome).toHaveLength(1);
      expect(report.receipts.totalOtherIncome).toBe(10000);
    });

    it('should calculate summary correctly', async () => {
      const currentTxns = [
        // Receipt
        mockDoc('txn-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'RCV-001',
          date: { toDate: () => new Date('2024-01-10') },
          entries: [
            { accountId: 'bank-acc', debit: 80000, credit: 0 },
            { accountId: 'recv-acc', debit: 0, credit: 80000 },
          ],
        }),
        // Payment
        mockDoc('txn-2', {
          type: 'VENDOR_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PMT-001',
          date: { toDate: () => new Date('2024-01-25') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 30000 },
            { accountId: 'rent-acc', debit: 30000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.summary.totalReceipts).toBe(80000);
      expect(report.summary.totalPayments).toBe(30000);
      expect(report.summary.netSurplusDeficit).toBe(50000);
      expect(report.summary.isDeficit).toBe(false);
      // Closing = opening (105000) + net (50000)
      expect(report.summary.closingBalance).toBe(155000);
    });

    it('should report deficit when payments exceed receipts', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'VENDOR_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'PMT-001',
          date: { toDate: () => new Date('2024-01-15') },
          entries: [
            { accountId: 'bank-acc', debit: 0, credit: 60000 },
            { accountId: 'salary-acc', debit: 60000, credit: 0 },
          ],
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.summary.netSurplusDeficit).toBe(-60000);
      expect(report.summary.isDeficit).toBe(true);
    });

    it('should handle empty transactions', async () => {
      setupMocks(createStandardAccounts(), [], [], [], []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.receipts.totalReceipts).toBe(0);
      expect(report.payments.totalPayments).toBe(0);
      expect(report.summary.netSurplusDeficit).toBe(0);
      expect(report.summary.closingBalance).toBe(report.openingBalance);
    });

    it('should handle transactions without entries', async () => {
      const currentTxns = [
        mockDoc('txn-1', {
          type: 'CUSTOMER_PAYMENT',
          status: 'POSTED',
          transactionNumber: 'RCV-001',
          date: { toDate: () => new Date('2024-01-10') },
        }),
      ];

      setupMocks(createStandardAccounts(), [], [], currentTxns, []);

      const report = await generateReceiptsPaymentsReport(mockDb, 1, 2024);

      expect(report.receipts.totalReceipts).toBe(0);
    });
  });
});
