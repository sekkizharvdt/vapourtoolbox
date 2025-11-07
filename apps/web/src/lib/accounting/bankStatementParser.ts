/**
 * Bank Statement CSV/Excel Parser
 *
 * Parses bank statement files (CSV, Excel) and converts them to BankTransaction format.
 * Supports multiple bank formats with customizable column mapping.
 *
 * Phase 4.2 - CSV/Excel Import
 */

import { Timestamp } from 'firebase/firestore';
import type { BankTransaction } from '@vapour/types';

/**
 * Column mapping configuration
 * Maps CSV/Excel columns to BankTransaction fields
 */
export interface ColumnMapping {
  transactionDate: string | number; // Column name or index
  description: string | number;
  debitAmount?: string | number; // Optional: some formats combine debit/credit
  creditAmount?: string | number;
  amount?: string | number; // Combined amount with +/- sign
  balance?: string | number;
  reference?: string | number;
  chequeNumber?: string | number;
  valueDate?: string | number;
}

/**
 * Import configuration
 */
export interface ImportConfig {
  columnMapping: ColumnMapping;
  dateFormat?: string; // e.g., "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"
  hasHeader?: boolean; // Whether first row is header
  skipRows?: number; // Number of rows to skip at beginning
  amountFormat?: 'separate' | 'combined'; // Separate debit/credit or combined with +/-
  amountSign?: 'positive-credit' | 'positive-debit'; // How to interpret positive amounts
  decimalSeparator?: '.' | ',';
  thousandsSeparator?: ',' | '.' | ' ' | '';
}

/**
 * Default import configurations for popular Indian banks
 */
export const BANK_PRESETS: Record<string, ImportConfig> = {
  HDFC: {
    columnMapping: {
      transactionDate: 'Date',
      description: 'Narration',
      debitAmount: 'Withdrawal Amt.',
      creditAmount: 'Deposit Amt.',
      balance: 'Closing Balance',
      reference: 'Chq./Ref.No.',
    },
    dateFormat: 'DD/MM/YYYY',
    hasHeader: true,
    amountFormat: 'separate',
    amountSign: 'positive-credit',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ICICI: {
    columnMapping: {
      transactionDate: 'Transaction Date',
      valueDate: 'Value Date',
      description: 'Description',
      debitAmount: 'Debit',
      creditAmount: 'Credit',
      balance: 'Balance',
      reference: 'Reference Number',
      chequeNumber: 'Cheque Number',
    },
    dateFormat: 'DD-MM-YYYY',
    hasHeader: true,
    amountFormat: 'separate',
    amountSign: 'positive-credit',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SBI: {
    columnMapping: {
      transactionDate: 'Txn Date',
      valueDate: 'Value Date',
      description: 'Description',
      debitAmount: 'Debit',
      creditAmount: 'Credit',
      reference: 'Ref No./Cheque No.',
      balance: 'Balance',
    },
    dateFormat: 'DD MMM YYYY',
    hasHeader: true,
    amountFormat: 'separate',
    amountSign: 'positive-credit',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  AXIS: {
    columnMapping: {
      transactionDate: 'Tran Date',
      description: 'Particulars',
      debitAmount: 'Debit',
      creditAmount: 'Credit',
      balance: 'Balance',
      chequeNumber: 'Chq/Ref Number',
    },
    dateFormat: 'DD-MM-YYYY',
    hasHeader: true,
    amountFormat: 'separate',
    amountSign: 'positive-credit',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  GENERIC: {
    columnMapping: {
      transactionDate: 0,
      description: 1,
      debitAmount: 2,
      creditAmount: 3,
      balance: 4,
    },
    dateFormat: 'DD/MM/YYYY',
    hasHeader: true,
    amountFormat: 'separate',
    amountSign: 'positive-credit',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
};

/**
 * Parsed row data
 */
export interface ParsedRow {
  rowNumber: number;
  transactionDate: Date | null;
  valueDate?: Date | null;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance?: number;
  reference?: string;
  chequeNumber?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Parse result
 */
export interface ParseResult {
  success: boolean;
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  warnings: string[];
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string, format: string = 'DD/MM/YYYY'): Date | null {
  if (!dateStr) return null;

  try {
    const cleaned = dateStr.trim();

    // Try ISO format first
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) return date;
    }

    // Parse based on format
    let day: number, month: number, year: number;

    if (format.includes('DD/MM/YYYY') || format.includes('DD-MM-YYYY')) {
      const parts = cleaned.split(/[/-]/);
      if (parts.length !== 3) return null;
      day = parseInt(parts[0]!, 10);
      month = parseInt(parts[1]!, 10) - 1; // 0-indexed
      year = parseInt(parts[2]!, 10);
    } else if (format.includes('MM/DD/YYYY') || format.includes('MM-DD-YYYY')) {
      const parts = cleaned.split(/[/-]/);
      if (parts.length !== 3) return null;
      month = parseInt(parts[0]!, 10) - 1; // 0-indexed
      day = parseInt(parts[1]!, 10);
      year = parseInt(parts[2]!, 10);
    } else if (format.includes('DD MMM YYYY')) {
      // e.g., "15 Jan 2024"
      const parts = cleaned.split(/\s+/);
      if (parts.length !== 3) return null;
      day = parseInt(parts[0]!, 10);
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      month = monthNames.indexOf(parts[1]!);
      if (month === -1) return null;
      year = parseInt(parts[2]!, 10);
    } else {
      // Default: try parsing as is
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) return date;
      return null;
    }

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;

    return date;
  } catch {
    return null;
  }
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string | undefined, config: ImportConfig): number {
  if (!amountStr || amountStr.trim() === '') return 0;

  try {
    let cleaned = amountStr.trim();

    // Remove currency symbols
    cleaned = cleaned.replace(/[₹$€£¥]/g, '');

    // Handle negative signs and brackets
    const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
    cleaned = cleaned.replace(/[()-]/g, '');

    // Handle thousands separator
    if (config.thousandsSeparator) {
      cleaned = cleaned.replace(new RegExp(`\\${config.thousandsSeparator}`, 'g'), '');
    }

    // Handle decimal separator
    if (config.decimalSeparator === ',') {
      cleaned = cleaned.replace(',', '.');
    }

    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return 0;

    return isNegative ? -amount : amount;
  } catch {
    return 0;
  }
}

/**
 * Get cell value from row
 */
function getCellValue(row: Record<string, string>, columnMapping: string | number): string {
  if (typeof columnMapping === 'number') {
    // Column index
    const keys = Object.keys(row);
    return row[keys[columnMapping]!] || '';
  } else {
    // Column name
    return row[columnMapping] || '';
  }
}

/**
 * Parse CSV text to array of rows
 */
export function parseCSV(csvText: string, hasHeader: boolean = true): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  if (hasHeader && lines.length > 0) {
    headers = parseCSVLine(lines[0]!);
    lines.shift();
  } else {
    // Use numeric indices as headers
    const firstLine = parseCSVLine(lines[0]!);
    headers = firstLine.map((_, i) => i.toString());
  }

  for (const line of lines) {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Parse bank statement file
 */
export function parseBankStatement(csvText: string, config: ImportConfig): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ParsedRow[] = [];

  try {
    // Parse CSV
    let rawRows = parseCSV(csvText, config.hasHeader);

    // Skip rows if needed
    if (config.skipRows && config.skipRows > 0) {
      rawRows = rawRows.slice(config.skipRows);
    }

    // Parse each row
    rawRows.forEach((row, index) => {
      const rowNumber = index + 1 + (config.skipRows || 0);
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      // Parse transaction date (required)
      const dateStr = getCellValue(row, config.columnMapping.transactionDate);
      const transactionDate = parseDate(dateStr, config.dateFormat);
      if (!transactionDate) {
        rowErrors.push(`Invalid transaction date: ${dateStr}`);
      }

      // Parse value date (optional)
      let valueDate: Date | null = null;
      if (config.columnMapping.valueDate) {
        const valueDateStr = getCellValue(row, config.columnMapping.valueDate);
        valueDate = parseDate(valueDateStr, config.dateFormat);
      }

      // Parse description (required)
      const description = getCellValue(row, config.columnMapping.description);
      if (!description) {
        rowErrors.push('Missing description');
      }

      // Parse amounts
      let debitAmount = 0;
      let creditAmount = 0;

      if (config.amountFormat === 'separate') {
        // Separate debit and credit columns
        if (config.columnMapping.debitAmount) {
          const debitStr = getCellValue(row, config.columnMapping.debitAmount);
          debitAmount = parseAmount(debitStr, config);
        }
        if (config.columnMapping.creditAmount) {
          const creditStr = getCellValue(row, config.columnMapping.creditAmount);
          creditAmount = parseAmount(creditStr, config);
        }
      } else if (config.amountFormat === 'combined' && config.columnMapping.amount) {
        // Combined amount column
        const amountStr = getCellValue(row, config.columnMapping.amount);
        const amount = parseAmount(amountStr, config);

        if (config.amountSign === 'positive-credit') {
          if (amount > 0) {
            creditAmount = amount;
          } else {
            debitAmount = Math.abs(amount);
          }
        } else {
          if (amount > 0) {
            debitAmount = amount;
          } else {
            creditAmount = Math.abs(amount);
          }
        }
      }

      // Both amounts are zero - warning
      if (debitAmount === 0 && creditAmount === 0) {
        rowWarnings.push('Transaction has zero amount');
      }

      // Both amounts are non-zero - error
      if (debitAmount > 0 && creditAmount > 0) {
        rowErrors.push('Transaction has both debit and credit amounts');
      }

      // Parse balance (optional)
      let balance: number | undefined;
      if (config.columnMapping.balance) {
        const balanceStr = getCellValue(row, config.columnMapping.balance);
        balance = parseAmount(balanceStr, config);
      }

      // Parse reference (optional)
      let reference: string | undefined;
      if (config.columnMapping.reference) {
        reference = getCellValue(row, config.columnMapping.reference);
      }

      // Parse cheque number (optional)
      let chequeNumber: string | undefined;
      if (config.columnMapping.chequeNumber) {
        chequeNumber = getCellValue(row, config.columnMapping.chequeNumber);
      }

      parsedRows.push({
        rowNumber,
        transactionDate,
        valueDate,
        description,
        debitAmount,
        creditAmount,
        balance,
        reference,
        chequeNumber,
        errors: rowErrors,
        warnings: rowWarnings,
      });

      // Collect errors and warnings
      rowErrors.forEach((err) => errors.push(`Row ${rowNumber}: ${err}`));
      rowWarnings.forEach((warn) => warnings.push(`Row ${rowNumber}: ${warn}`));
    });

    const validRows = parsedRows.filter((r) => r.errors.length === 0).length;

    return {
      success: errors.length === 0,
      rows: parsedRows,
      totalRows: parsedRows.length,
      validRows,
      invalidRows: parsedRows.length - validRows,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: [error instanceof Error ? error.message : 'Failed to parse file'],
      warnings,
    };
  }
}

/**
 * Convert parsed rows to BankTransaction objects
 */
export function convertToBankTransactions(
  parsedRows: ParsedRow[],
  statementId: string,
  accountId: string
): Omit<BankTransaction, 'id' | 'createdAt' | 'updatedAt' | 'isReconciled'>[] {
  return parsedRows
    .filter((row) => row.errors.length === 0 && row.transactionDate)
    .map((row) => ({
      statementId,
      accountId,
      transactionDate: Timestamp.fromDate(row.transactionDate!),
      valueDate: row.valueDate ? Timestamp.fromDate(row.valueDate) : undefined,
      description: row.description,
      reference: row.reference,
      chequeNumber: row.chequeNumber,
      debitAmount: row.debitAmount,
      creditAmount: row.creditAmount,
      balance: row.balance,
    }));
}

/**
 * Detect bank format from CSV headers
 */
export function detectBankFormat(csvText: string): string | null {
  const firstLine = csvText.split(/\r?\n/)[0];
  if (!firstLine) return null;

  const headers = parseCSVLine(firstLine).map((h) => h.toLowerCase());

  // Check each preset
  for (const [bankName, preset] of Object.entries(BANK_PRESETS)) {
    const requiredColumns = [
      preset.columnMapping.transactionDate,
      preset.columnMapping.description,
    ];

    const matches = requiredColumns.every((col) => {
      if (typeof col === 'string') {
        return headers.some((h) => h.includes(col.toLowerCase()));
      }
      return true;
    });

    if (matches) {
      return bankName;
    }
  }

  return null;
}

/**
 * Validate import configuration
 */
export function validateImportConfig(config: ImportConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.columnMapping.transactionDate) {
    errors.push('Transaction date column is required');
  }

  if (!config.columnMapping.description) {
    errors.push('Description column is required');
  }

  if (
    config.amountFormat === 'separate' &&
    !config.columnMapping.debitAmount &&
    !config.columnMapping.creditAmount
  ) {
    errors.push('At least one amount column (debit or credit) is required');
  }

  if (config.amountFormat === 'combined' && !config.columnMapping.amount) {
    errors.push('Amount column is required for combined format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
