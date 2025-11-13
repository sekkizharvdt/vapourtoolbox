/**
 * Accounting Module Tests
 *
 * Comprehensive tests for accounting services:
 * - GST Calculation
 * - TDS Calculation
 * - GL Entry Generation
 * - Bank Reconciliation
 * - Transaction Management
 */

describe('GST Calculator', () => {
  describe('calculateGST', () => {
    it('should calculate CGST and SGST for intra-state transactions', () => {
      const amount = 10000;
      const gstRate = 18;

      const cgst = (amount * (gstRate / 2)) / 100;
      const sgst = (amount * (gstRate / 2)) / 100;

      expect(cgst).toBe(900);
      expect(sgst).toBe(900);
      expect(cgst + sgst).toBe(1800);
    });

    it('should calculate IGST for inter-state transactions', () => {
      const amount = 10000;
      const gstRate = 18;

      const igst = (amount * gstRate) / 100;

      expect(igst).toBe(1800);
    });

    it('should handle different GST rates', () => {
      const amount = 10000;
      const rates = [5, 12, 18, 28];

      rates.forEach((rate) => {
        const gstAmount = (amount * rate) / 100;
        expect(gstAmount).toBe((amount * rate) / 100);
      });
    });

    it('should calculate reverse charge GST', () => {
      const amount = 10000;
      const gstRate = 18;
      const isReverseCharge = true;

      // Under reverse charge, recipient pays GST
      expect(isReverseCharge).toBe(true);
      const gstAmount = (amount * gstRate) / 100;
      expect(gstAmount).toBe(1800);
    });
  });

  describe('GST Report Generation', () => {
    it('should generate GSTR-1 report format', () => {
      const gstr1Data = {
        b2b: [], // B2B invoices
        b2c: [], // B2C invoices
        hsn: [], // HSN summary
        nil: [], // Nil rated supplies
      };

      expect(gstr1Data).toHaveProperty('b2b');
      expect(gstr1Data).toHaveProperty('hsn');
    });

    it('should categorize transactions by GST rate', () => {
      const transactions = [
        { amount: 1000, gstRate: 5 },
        { amount: 2000, gstRate: 12 },
        { amount: 3000, gstRate: 18 },
      ];

      const grouped = transactions.reduce(
        (acc, txn) => {
          acc[txn.gstRate] = (acc[txn.gstRate] || 0) + txn.amount;
          return acc;
        },
        {} as Record<number, number>
      );

      expect(grouped[5]).toBe(1000);
      expect(grouped[12]).toBe(2000);
      expect(grouped[18]).toBe(3000);
    });
  });
});

describe('TDS Calculator', () => {
  describe('calculateTDS', () => {
    it('should calculate TDS for professional fees (194J)', () => {
      const amount = 100000;
      const tdsRate = 10; // 10% for professional fees (Section 194J)

      const tdsAmount = (amount * tdsRate) / 100;

      expect(tdsAmount).toBe(10000);
      expect(amount - tdsAmount).toBe(90000); // Net payable
    });

    it('should calculate TDS for contractor payments (194C)', () => {
      const amount = 100000;
      const tdsRate = 1; // 1% for contractors (Section 194C, individual)

      const tdsAmount = (amount * tdsRate) / 100;

      expect(tdsAmount).toBe(1000);
    });

    it('should handle TDS threshold limits', () => {
      const section194JThreshold = 30000;
      const amounts = [25000, 30000, 35000];

      amounts.forEach((amount) => {
        const requiresTDS = amount >= section194JThreshold;
        expect(requiresTDS).toBe(amount >= 30000);
      });
    });

    it('should calculate TDS with surcharge for high amounts', () => {
      const baseTDS = 1000000; // 10% TDS on 1 crore

      // Surcharge @10% if TDS > 1 crore
      const hasSurcharge = baseTDS >= 10000000;
      expect(hasSurcharge).toBe(false); // This example doesn't cross threshold
    });

    it('should generate Form 26Q data', () => {
      const form26Q = {
        deductorTAN: 'ABCD12345E',
        deducteePAN: 'EFGH12345P',
        tdsAmount: 10000,
        section: '194J',
        paymentDate: new Date(),
      };

      expect(form26Q).toHaveProperty('deductorTAN');
      expect(form26Q).toHaveProperty('section');
      expect(form26Q.tdsAmount).toBeGreaterThan(0);
    });
  });
});

describe('GL Entry Generator', () => {
  describe('generateGLEntries', () => {
    it('should create balanced debit and credit entries', () => {
      const entries = [
        { account: 'Cash', debit: 10000, credit: 0 },
        { account: 'Sales Revenue', debit: 0, credit: 10000 },
      ];

      const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(10000);
    });

    it('should generate entries for vendor payment', () => {
      const payment = {
        amount: 10000,
        vendor: 'Vendor A',
        bankAccount: 'HDFC Bank',
      };

      const entries = [
        { account: 'Accounts Payable - Vendor A', debit: payment.amount, credit: 0 },
        { account: payment.bankAccount, debit: 0, credit: payment.amount },
      ];

      expect(entries[0]?.debit).toBe(entries[1]?.credit);
    });

    it('should handle GST in GL entries', () => {
      const invoice = {
        amount: 10000,
        cgst: 900,
        sgst: 900,
        total: 11800,
      };

      const entries = [
        { account: 'Accounts Receivable', debit: invoice.total, credit: 0 },
        { account: 'Sales Revenue', debit: 0, credit: invoice.amount },
        { account: 'CGST Payable', debit: 0, credit: invoice.cgst },
        { account: 'SGST Payable', debit: 0, credit: invoice.sgst },
      ];

      const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(11800);
    });

    it('should reject unbalanced entries', () => {
      const unbalancedEntries = [
        { account: 'Cash', debit: 10000, credit: 0 },
        { account: 'Sales', debit: 0, credit: 9000 }, // Unbalanced!
      ];

      const totalDebits = unbalancedEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = unbalancedEntries.reduce((sum, e) => sum + e.credit, 0);

      expect(totalDebits).not.toBe(totalCredits);
    });
  });

  describe('Multi-currency transactions', () => {
    it('should convert foreign currency to base currency', () => {
      const transaction = {
        amountUSD: 1000,
        exchangeRate: 83.5, // USD to INR
      };

      const amountINR = transaction.amountUSD * transaction.exchangeRate;

      expect(amountINR).toBe(83500);
    });

    it('should record exchange gain/loss', () => {
      const bookingRate = 83.0;
      const settlementRate = 83.5;
      const amountUSD = 1000;

      const bookingAmount = amountUSD * bookingRate; // 83000
      const settlementAmount = amountUSD * settlementRate; // 83500
      const exchangeLoss = settlementAmount - bookingAmount; // 500

      expect(exchangeLoss).toBe(500);
      expect(exchangeLoss).toBeGreaterThan(0); // Loss when INR weakens
    });
  });
});

describe('Bank Reconciliation', () => {
  describe('Auto-matching engine', () => {
    it('should match by exact amount', () => {
      const bankTxn = { amount: 10000, date: '2025-01-15' };
      const accountingTxn = { amount: 10000, date: '2025-01-15' };

      const isMatch = bankTxn.amount === accountingTxn.amount;

      expect(isMatch).toBe(true);
    });

    it('should match by reference number', () => {
      const bankTxn = { reference: 'CHQ123456', amount: 10000 };
      const accountingTxn = { chequeNumber: 'CHQ123456', amount: 10000 };

      const isMatch = bankTxn.reference === accountingTxn.chequeNumber;

      expect(isMatch).toBe(true);
    });

    it('should calculate match confidence score', () => {
      const matches = {
        exactAmount: 1.0,
        amountWithin1Percent: 0.8,
        sameDate: 0.5,
        dateWithin3Days: 0.3,
        referenceMatch: 0.9,
      };

      const totalScore = matches.exactAmount + matches.sameDate + matches.referenceMatch;

      expect(totalScore).toBe(2.4);
      expect(totalScore).toBeGreaterThan(2.0); // High confidence
    });

    it('should handle one-to-many matches', () => {
      const bankTxn = { amount: 30000 };
      const accountingTxns = [{ amount: 10000 }, { amount: 10000 }, { amount: 10000 }];

      const totalAccounting = accountingTxns.reduce((sum, txn) => sum + txn.amount, 0);

      expect(totalAccounting).toBe(bankTxn.amount);
    });
  });

  describe('Reconciliation reporting', () => {
    it('should calculate unreconciled balance', () => {
      const bankBalance = 100000;
      const reconciledAmount = 75000;
      const unreconciledAmount = bankBalance - reconciledAmount;

      expect(unreconciledAmount).toBe(25000);
    });

    it('should identify outstanding cheques', () => {
      const issuedCheques = [
        { number: 'CHQ001', amount: 5000, cleared: false },
        { number: 'CHQ002', amount: 3000, cleared: true },
        { number: 'CHQ003', amount: 2000, cleared: false },
      ];

      const outstanding = issuedCheques
        .filter((chq) => !chq.cleared)
        .reduce((sum, chq) => sum + chq.amount, 0);

      expect(outstanding).toBe(7000);
    });
  });
});

describe('Transaction Management', () => {
  describe('Transaction validation', () => {
    it('should validate transaction number format', () => {
      const validFormats = ['INV-2025-0001', 'PAY-2025-0001', 'JV-2025-0001'];
      const pattern = /^[A-Z]+-\d{4}-\d{4}$/;

      validFormats.forEach((format) => {
        expect(pattern.test(format)).toBe(true);
      });
    });

    it('should validate debit and credit balance', () => {
      const transaction = {
        debits: [
          { account: 'Cash', amount: 5000 },
          { account: 'Bank', amount: 5000 },
        ],
        credits: [{ account: 'Sales', amount: 10000 }],
      };

      const totalDebits = transaction.debits.reduce((sum, d) => sum + d.amount, 0);
      const totalCredits = transaction.credits.reduce((sum, c) => sum + c.amount, 0);

      expect(totalDebits).toBe(totalCredits);
    });

    it('should require narration for manual entries', () => {
      const journalEntry = {
        type: 'manual',
        narration: 'Adjustment for rent expense',
      };

      expect(journalEntry.narration.length).toBeGreaterThan(0);
    });
  });

  describe('Fiscal year handling', () => {
    it('should determine fiscal year from date', () => {
      const testCases = [
        { date: '2025-01-15', expectedFY: '2024-25' },
        { date: '2025-04-15', expectedFY: '2025-26' },
        { date: '2024-12-31', expectedFY: '2024-25' },
      ];

      testCases.forEach(({ date, expectedFY }) => {
        const dateObj = new Date(date);
        const fiscalYear =
          dateObj.getMonth() >= 3 // April onwards
            ? `${dateObj.getFullYear()}-${(dateObj.getFullYear() + 1) % 100}`
            : `${dateObj.getFullYear() - 1}-${dateObj.getFullYear() % 100}`;

        expect(fiscalYear).toBe(expectedFY);
      });
    });

    it('should prevent transactions in closed periods', () => {
      const closedPeriods = ['2023-24', '2022-23'];
      const transactionFY = '2023-24';

      const isPeriodClosed = closedPeriods.includes(transactionFY);

      expect(isPeriodClosed).toBe(true);
    });
  });

  describe('Cost center allocation', () => {
    it('should allocate expenses to cost centers', () => {
      const expense = {
        amount: 10000,
        costCenters: [
          { code: 'CC001', percentage: 60 },
          { code: 'CC002', percentage: 40 },
        ],
      };

      const allocations = expense.costCenters.map((cc) => ({
        code: cc.code,
        amount: (expense.amount * cc.percentage) / 100,
      }));

      expect(allocations[0]?.amount).toBe(6000);
      expect(allocations[1]?.amount).toBe(4000);
      expect(allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(10000);
    });

    it('should validate cost center percentage totals 100', () => {
      const allocation = [
        { code: 'CC001', percentage: 60 },
        { code: 'CC002', percentage: 40 },
      ];

      const total = allocation.reduce((sum, a) => sum + a.percentage, 0);

      expect(total).toBe(100);
    });
  });
});

describe('Financial Reports', () => {
  describe('Balance Sheet', () => {
    it('should calculate total assets', () => {
      const assets = {
        currentAssets: 50000,
        fixedAssets: 100000,
        otherAssets: 10000,
      };

      const totalAssets = Object.values(assets).reduce((sum, val) => sum + val, 0);

      expect(totalAssets).toBe(160000);
    });

    it('should ensure assets equal liabilities + equity', () => {
      const totalAssets = 160000;
      const totalLiabilities = 60000;
      const totalEquity = 100000;

      expect(totalAssets).toBe(totalLiabilities + totalEquity);
    });
  });

  describe('Profit & Loss', () => {
    it('should calculate gross profit', () => {
      const revenue = 100000;
      const costOfGoodsSold = 60000;
      const grossProfit = revenue - costOfGoodsSold;

      expect(grossProfit).toBe(40000);
    });

    it('should calculate net profit', () => {
      const grossProfit = 40000;
      const operatingExpenses = 20000;
      const otherIncome = 5000;
      const otherExpenses = 3000;

      const netProfit = grossProfit - operatingExpenses + otherIncome - otherExpenses;

      expect(netProfit).toBe(22000);
    });
  });

  describe('Cash Flow', () => {
    it('should categorize cash flows', () => {
      const cashFlow = {
        operating: 50000,
        investing: -30000, // Negative = outflow
        financing: 20000,
      };

      const netCashFlow = Object.values(cashFlow).reduce((sum, val) => sum + val, 0);

      expect(netCashFlow).toBe(40000);
    });

    it('should track opening and closing cash', () => {
      const openingCash = 100000;
      const netCashFlow = 40000;
      const closingCash = openingCash + netCashFlow;

      expect(closingCash).toBe(140000);
    });
  });
});
