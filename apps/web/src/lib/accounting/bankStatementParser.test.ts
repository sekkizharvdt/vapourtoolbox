/**
 * Bank Statement Parser Tests
 *
 * Tests for bank statement CSV parsing including:
 * - CSV parsing
 * - Date parsing
 * - Amount parsing
 * - Bank format detection
 * - Column mapping validation
 */

import {
  parseCSV,
  parseBankStatement,
  detectBankFormat,
  validateImportConfig,
  BANK_PRESETS,
  type ImportConfig,
} from './bankStatementParser';

describe('Bank Statement Parser', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV with header', () => {
      const csv = 'Date,Description,Amount\n2025-01-15,Payment,1000\n2025-01-16,Receipt,2000';
      const rows = parseCSV(csv, true);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ Date: '2025-01-15', Description: 'Payment', Amount: '1000' });
      expect(rows[1]).toEqual({ Date: '2025-01-16', Description: 'Receipt', Amount: '2000' });
    });

    it('should parse CSV without header (numeric keys)', () => {
      const csv = '2025-01-15,Payment,1000\n2025-01-16,Receipt,2000';
      const rows = parseCSV(csv, false);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ '0': '2025-01-15', '1': 'Payment', '2': '1000' });
    });

    it('should handle quoted fields', () => {
      const csv = 'Date,Description,Amount\n2025-01-15,"Payment for goods",1000';
      const rows = parseCSV(csv, true);

      expect(rows[0]!.Description).toBe('Payment for goods');
    });

    it('should handle escaped quotes in fields', () => {
      const csv = 'Date,Description,Amount\n2025-01-15,"Payment ""ref 123""",1000';
      const rows = parseCSV(csv, true);

      expect(rows[0]!.Description).toBe('Payment "ref 123"');
    });

    it('should handle commas within quoted fields', () => {
      const csv = 'Date,Description,Amount\n2025-01-15,"Payment, service",1000';
      const rows = parseCSV(csv, true);

      expect(rows[0]!.Description).toBe('Payment, service');
    });

    it('should handle empty lines', () => {
      const csv = 'Date,Description,Amount\n2025-01-15,Payment,1000\n\n2025-01-16,Receipt,2000';
      const rows = parseCSV(csv, true);

      expect(rows).toHaveLength(2);
    });

    it('should handle Windows line endings (CRLF)', () => {
      const csv = 'Date,Description,Amount\r\n2025-01-15,Payment,1000\r\n2025-01-16,Receipt,2000';
      const rows = parseCSV(csv, true);

      expect(rows).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      const rows = parseCSV('', true);

      expect(rows).toHaveLength(0);
    });

    it('should trim whitespace from values', () => {
      const csv = 'Date,Description,Amount\n  2025-01-15  ,  Payment  ,  1000  ';
      const rows = parseCSV(csv, true);

      expect(rows[0]!.Date).toBe('2025-01-15');
      expect(rows[0]!.Description).toBe('Payment');
      expect(rows[0]!.Amount).toBe('1000');
    });
  });

  describe('parseBankStatement', () => {
    const basicConfig: ImportConfig = {
      columnMapping: {
        transactionDate: 'Date',
        description: 'Description',
        debitAmount: 'Debit',
        creditAmount: 'Credit',
      },
      dateFormat: 'YYYY-MM-DD',
      hasHeader: true,
      amountFormat: 'separate',
      decimalSeparator: '.',
      thousandsSeparator: ',',
    };

    it('should parse valid bank statement', () => {
      const csv =
        'Date,Description,Debit,Credit\n2025-01-15,Payment,1000,\n2025-01-16,Receipt,,2000';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.invalidRows).toBe(0);
    });

    it('should parse DD/MM/YYYY date format', () => {
      const config: ImportConfig = {
        ...basicConfig,
        dateFormat: 'DD/MM/YYYY',
      };
      const csv = 'Date,Description,Debit,Credit\n15/01/2025,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.success).toBe(true);
      expect(result.rows[0]!.transactionDate?.getDate()).toBe(15);
      expect(result.rows[0]!.transactionDate?.getMonth()).toBe(0); // January
      expect(result.rows[0]!.transactionDate?.getFullYear()).toBe(2025);
    });

    it('should parse DD-MM-YYYY date format', () => {
      const config: ImportConfig = {
        ...basicConfig,
        dateFormat: 'DD-MM-YYYY',
      };
      const csv = 'Date,Description,Debit,Credit\n15-01-2025,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.success).toBe(true);
      expect(result.rows[0]!.transactionDate?.getDate()).toBe(15);
    });

    it('should parse DD MMM YYYY date format', () => {
      const config: ImportConfig = {
        ...basicConfig,
        dateFormat: 'DD MMM YYYY',
      };
      const csv = 'Date,Description,Debit,Credit\n15 Jan 2025,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.success).toBe(true);
      expect(result.rows[0]!.transactionDate?.getDate()).toBe(15);
      expect(result.rows[0]!.transactionDate?.getMonth()).toBe(0);
    });

    it('should error on invalid date', () => {
      const csv = 'Date,Description,Debit,Credit\ninvalid-date,Payment,1000,';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.success).toBe(false);
      expect(result.invalidRows).toBe(1);
      expect(result.errors.some((e) => e.includes('Invalid transaction date'))).toBe(true);
    });

    it('should error on missing description', () => {
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,,1000,';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing description'))).toBe(true);
    });

    it('should warn on zero amount transactions', () => {
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,Payment,,';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.warnings.some((w) => w.includes('zero amount'))).toBe(true);
    });

    it('should error when both debit and credit have values', () => {
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,Payment,1000,500';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('both debit and credit'))).toBe(true);
    });

    it('should handle combined amount format', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
          amount: 'Amount',
        },
        dateFormat: 'YYYY-MM-DD',
        hasHeader: true,
        amountFormat: 'combined',
        amountSign: 'positive-credit',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      };
      const csv = 'Date,Description,Amount\n2025-01-15,Credit,1000\n2025-01-16,Debit,-500';
      const result = parseBankStatement(csv, config);

      expect(result.success).toBe(true);
      expect(result.rows[0]!.creditAmount).toBe(1000);
      expect(result.rows[0]!.debitAmount).toBe(0);
      expect(result.rows[1]!.debitAmount).toBe(500);
      expect(result.rows[1]!.creditAmount).toBe(0);
    });

    it('should handle amounts with currency symbols', () => {
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,Payment,₹1000,';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.rows[0]!.debitAmount).toBe(1000);
    });

    it('should handle amounts with thousands separator', () => {
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,Payment,"1,000,000",';
      const result = parseBankStatement(csv, basicConfig);

      expect(result.rows[0]!.debitAmount).toBe(1000000);
    });

    it('should handle European decimal separator', () => {
      const config: ImportConfig = {
        ...basicConfig,
        decimalSeparator: ',',
        thousandsSeparator: '.',
      };
      const csv = 'Date,Description,Debit,Credit\n2025-01-15,Payment,"1.000,50",';
      const result = parseBankStatement(csv, config);

      expect(result.rows[0]!.debitAmount).toBe(1000.5);
    });

    it('should skip rows when skipRows is set', () => {
      const config: ImportConfig = {
        ...basicConfig,
        skipRows: 1, // Skip the header row we added
      };
      // After parsing CSV (which removes the first row as header), we have 2 data rows
      // Then skipRows=1 removes 1 more, leaving 1 row
      const csv = 'Date,Description,Debit,Credit\nSkip this row,Skip,0,\n2025-01-15,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.totalRows).toBe(1);
      expect(result.rows[0]!.description).toBe('Payment');
    });

    it('should parse optional fields (balance, reference, cheque)', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
          debitAmount: 'Debit',
          creditAmount: 'Credit',
          balance: 'Balance',
          reference: 'Reference',
          chequeNumber: 'Cheque',
        },
        dateFormat: 'YYYY-MM-DD',
        hasHeader: true,
        amountFormat: 'separate',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      };
      const csv =
        'Date,Description,Debit,Credit,Balance,Reference,Cheque\n2025-01-15,Payment,1000,,50000,REF123,CHQ456';
      const result = parseBankStatement(csv, config);

      expect(result.rows[0]!.balance).toBe(50000);
      expect(result.rows[0]!.reference).toBe('REF123');
      expect(result.rows[0]!.chequeNumber).toBe('CHQ456');
    });

    it('should parse value date when provided', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'TxnDate',
          valueDate: 'ValueDate',
          description: 'Description',
          debitAmount: 'Debit',
          creditAmount: 'Credit',
        },
        dateFormat: 'YYYY-MM-DD',
        hasHeader: true,
        amountFormat: 'separate',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      };
      const csv = 'TxnDate,ValueDate,Description,Debit,Credit\n2025-01-15,2025-01-16,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.rows[0]!.transactionDate?.getDate()).toBe(15);
      expect(result.rows[0]!.valueDate?.getDate()).toBe(16);
    });

    it('should handle column mapping by index', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 0,
          description: 1,
          debitAmount: 2,
          creditAmount: 3,
        },
        dateFormat: 'YYYY-MM-DD',
        hasHeader: false,
        amountFormat: 'separate',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      };
      const csv = '2025-01-15,Payment,1000,';
      const result = parseBankStatement(csv, config);

      expect(result.rows[0]!.transactionDate?.getDate()).toBe(15);
      expect(result.rows[0]!.description).toBe('Payment');
      expect(result.rows[0]!.debitAmount).toBe(1000);
    });
  });

  describe('detectBankFormat', () => {
    it('should detect HDFC format', () => {
      const csv =
        'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance';
      const format = detectBankFormat(csv);

      expect(format).toBe('HDFC');
    });

    it('should detect ICICI format', () => {
      const csv =
        'Transaction Date,Value Date,Description,Debit,Credit,Balance,Reference Number,Cheque Number';
      const format = detectBankFormat(csv);

      expect(format).toBe('ICICI');
    });

    it('should detect SBI format', () => {
      const csv = 'Txn Date,Value Date,Description,Debit,Credit,Ref No./Cheque No.,Balance';
      const format = detectBankFormat(csv);

      expect(format).toBe('SBI');
    });

    it('should detect AXIS format', () => {
      const csv = 'Tran Date,Particulars,Debit,Credit,Balance,Chq/Ref Number';
      const format = detectBankFormat(csv);

      expect(format).toBe('AXIS');
    });

    it('should fall back to GENERIC for unknown format', () => {
      // detectBankFormat returns GENERIC when no specific bank is detected
      // because GENERIC uses numeric column indices which always match
      const csv = 'Column1,Column2,Column3,Column4';
      const format = detectBankFormat(csv);

      expect(format).toBe('GENERIC');
    });

    it('should return null for empty input', () => {
      const format = detectBankFormat('');

      expect(format).toBeNull();
    });
  });

  describe('validateImportConfig', () => {
    it('should return valid for complete config', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
          debitAmount: 'Debit',
          creditAmount: 'Credit',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when transaction date column missing', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: '',
          description: 'Description',
          debitAmount: 'Debit',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transaction date column is required');
    });

    it('should error when description column missing', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: '',
          debitAmount: 'Debit',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description column is required');
    });

    it('should error when no amount columns for separate format', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one amount column (debit or credit) is required');
    });

    it('should error when amount column missing for combined format', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
        },
        amountFormat: 'combined',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount column is required for combined format');
    });

    it('should accept config with only debit column', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
          debitAmount: 'Debit',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should accept config with only credit column', () => {
      const config: ImportConfig = {
        columnMapping: {
          transactionDate: 'Date',
          description: 'Description',
          creditAmount: 'Credit',
        },
        amountFormat: 'separate',
      };

      const result = validateImportConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('BANK_PRESETS', () => {
    it('should have HDFC preset', () => {
      expect(BANK_PRESETS.HDFC).toBeDefined();
      expect(BANK_PRESETS.HDFC!.columnMapping.transactionDate).toBe('Date');
      expect(BANK_PRESETS.HDFC!.columnMapping.description).toBe('Narration');
      expect(BANK_PRESETS.HDFC!.dateFormat).toBe('DD/MM/YYYY');
    });

    it('should have ICICI preset', () => {
      expect(BANK_PRESETS.ICICI).toBeDefined();
      expect(BANK_PRESETS.ICICI!.columnMapping.transactionDate).toBe('Transaction Date');
      expect(BANK_PRESETS.ICICI!.dateFormat).toBe('DD-MM-YYYY');
    });

    it('should have SBI preset', () => {
      expect(BANK_PRESETS.SBI).toBeDefined();
      expect(BANK_PRESETS.SBI!.columnMapping.transactionDate).toBe('Txn Date');
      expect(BANK_PRESETS.SBI!.dateFormat).toBe('DD MMM YYYY');
    });

    it('should have AXIS preset', () => {
      expect(BANK_PRESETS.AXIS).toBeDefined();
      expect(BANK_PRESETS.AXIS!.columnMapping.transactionDate).toBe('Tran Date');
    });

    it('should have GENERIC preset with numeric indices', () => {
      expect(BANK_PRESETS.GENERIC).toBeDefined();
      expect(BANK_PRESETS.GENERIC!.columnMapping.transactionDate).toBe(0);
      expect(BANK_PRESETS.GENERIC!.columnMapping.description).toBe(1);
    });

    it('should have all presets with required fields', () => {
      Object.entries(BANK_PRESETS).forEach(([, preset]) => {
        expect(preset.columnMapping.transactionDate).toBeDefined();
        expect(preset.columnMapping.description).toBeDefined();
        expect(preset.amountFormat).toBeDefined();
        expect(preset.hasHeader).toBe(true);
      });
    });
  });
});
