/**
 * CSV download for list pages.
 *
 * The accounting reports have their own exporter (`lib/accounting/reports/
 * exportReport.ts`) built around an `ExportSection[]` model with subtotals and
 * multiple blocks per file — the wrong shape for a flat list. This is the flat
 * one. Two of them is the limit: point new list pages here rather than
 * hand-rolling a third escape-and-download (rule 32).
 */

/** RFC 4180 quoting — only fields that need it get quoted. */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface ListCsvOptions {
  headers: string[];
  rows: string[][];
  /**
   * Base name, without extension or date. The download is named
   * `<filename>_YYYY-MM-DD.csv`.
   */
  filename: string;
}

/**
 * Build a CSV from headers + rows and hand it to the browser as a download.
 *
 * No-op outside a browser, so a server-render or a test importing the module
 * does not blow up on `document`.
 */
export function downloadListCSV({ headers, rows, filename }: ListCsvOptions): void {
  const csvContent = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  if (typeof document === 'undefined') return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exposed for tests; the download path above is the intended entry point. */
export function buildCsv(headers: string[], rows: string[][]): string {
  return [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');
}
