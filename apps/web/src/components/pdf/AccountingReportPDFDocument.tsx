/**
 * Accounting Report PDF Document
 *
 * One generic, sections-driven PDF for every report under /accounting/reports.
 * It consumes the same `ExportSection[]` intermediate that the CSV and Excel
 * exports already build, so all three downloads of a report contain identical
 * numbers by construction rather than by convention.
 *
 * Statement-shaped reports (balance sheet, P&L) need no bespoke document: their
 * sections already carry the statement structure — one titled section per
 * statement group, indented "  <code> <name>" rows, and a `summary` total row —
 * which maps directly onto ReportSection + ReportTable's `totalRow`.
 *
 * Currency cells render as plain grouped numbers ("1,23,456.00") with a single
 * "All amounts in INR" note under the header, rather than prefixing every cell.
 * The ₹ glyph is never used: no custom font is registered, and referencing an
 * unregistered family makes @react-pdf throw at render time.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  ListFooter,
  REPORT_THEME,
  type TableColumn,
} from '@/lib/pdf/reportComponents';
import {
  formatCellValue,
  resolveOrientation,
  type ExportColumn,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';

const COMPANY_NAME = 'Vapour Desal Technologies Private Limited';

/** Fallback width for a column that does not declare one (mirrors the Excel default). */
const DEFAULT_COLUMN_WIDTH = 15;

const s = StyleSheet.create({
  amountsNote: {
    fontSize: 7,
    color: REPORT_THEME.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },
});

/* ─── Helpers ─────────────────────────────────────────────────── */

/**
 * The Excel exporter measures widths in characters; @react-pdf wants percentages.
 * Normalising against the section's own total keeps each table full-bleed and
 * preserves the relative emphasis the report author chose.
 */
function toTableColumns(columns: ExportColumn[]): TableColumn[] {
  const widths = columns.map((c) => c.width ?? DEFAULT_COLUMN_WIDTH);
  const total = widths.reduce((sum, w) => sum + w, 0) || columns.length;
  return columns.map((col, i) => ({
    key: col.key,
    header: col.header,
    width: `${(((widths[i] ?? DEFAULT_COLUMN_WIDTH) / total) * 100).toFixed(4)}%`,
    ...(col.align ? { align: col.align } : {}),
  }));
}

function formatRow(
  columns: ExportColumn[],
  row: Record<string, string | number | Date | null | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    out[col.key] = formatCellValue(row[col.key], col.format);
  }
  return out;
}

/** A section carrying neither rows nor a summary is a bare banner whose title
 *  duplicates the document header, so it is dropped rather than rendered. */
function hasBody(section: ExportSection): boolean {
  return section.rows.length > 0 || section.summary !== undefined;
}

/* ─── Document ────────────────────────────────────────────────── */

export interface AccountingReportPDFDocumentProps {
  sections: ExportSection[];
  /** Shown as the PDF's centred title. */
  title: string;
  /** Period, as-of date, or entity name — rendered under the title. */
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  logoDataUri?: string;
}

export function AccountingReportPDFDocument({
  sections,
  title,
  subtitle,
  orientation,
  logoDataUri,
}: AccountingReportPDFDocumentProps) {
  const bodySections = sections.filter(hasBody);

  return (
    <Document title={title}>
      <ReportPage orientation={resolveOrientation(sections, orientation)}>
        <ReportHeader
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(logoDataUri !== undefined && { logoDataUri })}
        />

        <Text style={s.amountsNote}>All amounts in INR</Text>

        {bodySections.map((section, i) => {
          const table = (
            <ReportTable
              columns={toTableColumns(section.columns)}
              rows={section.rows.map((row) => formatRow(section.columns, row))}
              {...(section.summary !== undefined && {
                totalRow: formatRow(section.columns, section.summary),
              })}
              striped
            />
          );

          return section.title ? (
            <ReportSection key={i} title={section.title}>
              {table}
            </ReportSection>
          ) : (
            <View key={i}>{table}</View>
          );
        })}

        <ListFooter label={COMPANY_NAME} />
      </ReportPage>
    </Document>
  );
}
