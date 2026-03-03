/**
 * Accounting Report Export Utilities
 *
 * Reusable CSV and Excel export for accounting reports.
 * Supports: Balance Sheet, P&L, Trial Balance, Account Ledger, Entity Ledger.
 */

import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'date' | 'text';
}

export interface ExportSection {
  title?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number | Date | null | undefined>[];
  /** Summary row appended at bottom of section (e.g., totals) */
  summary?: Record<string, string | number | null | undefined>;
}

// ── CSV Export ──────────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCellValue(
  value: string | number | Date | null | undefined,
  format?: ExportColumn['format']
): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return value.toLocaleDateString('en-IN');
  }
  if (typeof value === 'number') {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return value.toString();
  }
  return String(value);
}

export function downloadReportCSV(sections: ExportSection[], filename: string): void {
  const lines: string[] = [];

  sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) lines.push(''); // blank line between sections

    if (section.title) {
      lines.push(escapeCsvField(section.title));
    }

    // Header row
    lines.push(section.columns.map((c) => escapeCsvField(c.header)).join(','));

    // Data rows
    section.rows.forEach((row) => {
      const csvRow = section.columns.map((col) =>
        escapeCsvField(formatCellValue(row[col.key], col.format))
      );
      lines.push(csvRow.join(','));
    });

    // Summary row
    if (section.summary) {
      const csvRow = section.columns.map((col) =>
        escapeCsvField(formatCellValue(section.summary![col.key], col.format))
      );
      lines.push(csvRow.join(','));
    }
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Excel Export ─────────────────────────────────────────────────────────────────

export async function downloadReportExcel(
  sections: ExportSection[],
  filename: string,
  sheetName: string = 'Report'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vapour Toolbox';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(sheetName);

  let currentRow = 1;

  sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) currentRow += 1; // blank row between sections

    // Section title
    if (section.title) {
      const titleRow = ws.getRow(currentRow);
      titleRow.getCell(1).value = section.title;
      titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1565C0' } };
      titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
      };
      const colCount = section.columns.length;
      for (let c = 1; c <= colCount; c++) {
        ws.getRow(currentRow).getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE3F2FD' },
        };
      }
      if (colCount > 1) {
        ws.mergeCells(currentRow, 1, currentRow, colCount);
      }
      currentRow += 1;
    }

    // Set column widths (only on first section to avoid conflicts)
    if (sectionIdx === 0) {
      ws.columns = section.columns.map((col) => ({
        width: col.width || 15,
      }));
    }

    // Header row
    const headerRow = ws.getRow(currentRow);
    section.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };
      cell.border = { bottom: { style: 'thin' } };
      cell.alignment = { horizontal: col.align || 'left' };
    });
    currentRow += 1;

    // Data rows
    section.rows.forEach((row, rowIdx) => {
      const excelRow = ws.getRow(currentRow);
      section.columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        const value = row[col.key];

        if (value instanceof Date) {
          cell.value = value;
          cell.numFmt = 'dd-mmm-yyyy';
        } else if (typeof value === 'number') {
          cell.value = value;
          if (col.format === 'currency') {
            cell.numFmt = '#,##0.00';
          }
        } else {
          cell.value = value ?? '';
        }

        cell.alignment = { horizontal: col.align || 'left' };
        cell.font = { size: 10 };

        // Alternate row shading
        if (rowIdx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAFAFA' },
          };
        }
      });
      currentRow += 1;
    });

    // Summary row
    if (section.summary) {
      const summaryRow = ws.getRow(currentRow);
      section.columns.forEach((col, i) => {
        const cell = summaryRow.getCell(i + 1);
        const value = section.summary![col.key];

        if (typeof value === 'number') {
          cell.value = value;
          if (col.format === 'currency') {
            cell.numFmt = '#,##0.00';
          }
        } else {
          cell.value = value ?? '';
        }

        cell.font = { bold: true, size: 10 };
        cell.alignment = { horizontal: col.align || 'left' };
        cell.border = { top: { style: 'medium' } };
      });
      currentRow += 1;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `${filename}.xlsx`);
}

// ── Download helper ──────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
