/**
 * Standardised PDF Report Components
 *
 * Shared primitives for all PDF reports across the application.
 * Built on @react-pdf/renderer — import these instead of styling from scratch.
 *
 * Usage:
 *   import { ReportPage, ReportHeader, ReportSection, ... } from '@/lib/pdf/reportComponents';
 */

import React, { type ReactNode } from 'react';
import { Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

/* ─────────────────────────── Theme ──────────────────────────── */

export const REPORT_THEME = {
  primary: '#1976d2',
  primaryLight: '#e3f2fd',
  text: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  border: '#e0e0e0',
  borderDark: '#ccc',
  tableHeaderBg: '#f5f5f5',
  tableRowAltBg: '#fafafa',
  warningBg: '#fff3e0',
  warningText: '#e65100',
  successText: '#2e7d32',
  errorText: '#d32f2f',
  notesBg: '#fafafa',
  white: '#fff',
} as const;

/* ─────────────────────────── Shared Styles ──────────────────── */

const s = StyleSheet.create({
  /* Page */
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  pageLandscape: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },

  /* Header */
  header: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: `2pt solid ${REPORT_THEME.primary}`,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSimple: {
    marginBottom: 15,
    paddingBottom: 8,
    borderBottom: `2pt solid ${REPORT_THEME.primary}`,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  titleLeft: {
    fontSize: 16,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitleLeft: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  headerItem: {
    flexDirection: 'row',
  },
  headerLabel: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  logoSpacer: {
    width: 50,
    marginLeft: 12,
  },

  /* Metadata row (doc/rev/date blocks) */
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  metaBlock: {
    flex: 1,
    backgroundColor: REPORT_THEME.tableHeaderBg,
    padding: 5,
    borderRadius: 2,
  },
  metaLabel: {
    fontSize: 7,
    color: REPORT_THEME.textSecondary,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontWeight: 'bold',
  },

  /* Section */
  section: {
    marginTop: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: REPORT_THEME.primary,
    backgroundColor: REPORT_THEME.primaryLight,
    padding: 4,
  },

  /* Table */
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: REPORT_THEME.tableHeaderBg,
    borderBottom: `1pt solid ${REPORT_THEME.borderDark}`,
    paddingVertical: 3,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 2.5,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 2.5,
    backgroundColor: REPORT_THEME.tableRowAltBg,
  },
  totalRow: {
    flexDirection: 'row',
    borderTop: '1.5pt solid #333',
    paddingVertical: 3,
    fontWeight: 'bold',
  },

  /* Column widths */
  col10: { width: '10%', paddingHorizontal: 3 },
  col15: { width: '15%', paddingHorizontal: 3 },
  col20: { width: '20%', paddingHorizontal: 3 },
  col25: { width: '25%', paddingHorizontal: 3 },
  col30: { width: '30%', paddingHorizontal: 3 },
  col35: { width: '35%', paddingHorizontal: 3 },
  col40: { width: '40%', paddingHorizontal: 3 },
  col50: { width: '50%', paddingHorizontal: 3 },
  col60: { width: '60%', paddingHorizontal: 3 },
  col70: { width: '70%', paddingHorizontal: 3 },
  colRight: { textAlign: 'right' },
  colCenter: { textAlign: 'center' },

  /* Layout helpers */
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
  },

  /* Primary result banner */
  primaryResult: {
    backgroundColor: REPORT_THEME.primaryLight,
    padding: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
  },

  /* Summary cards */
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    border: `1pt solid ${REPORT_THEME.border}`,
    borderRadius: 4,
    padding: 10,
  },
  summaryCardLabel: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  summaryCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  /* Warnings */
  warning: {
    backgroundColor: REPORT_THEME.warningBg,
    padding: 5,
    marginTop: 3,
    fontSize: 8,
  },
  warningText: {
    color: REPORT_THEME.warningText,
  },

  /* Notes */
  noteSection: {
    marginTop: 8,
    padding: 6,
    backgroundColor: REPORT_THEME.notesBg,
    border: `0.5pt solid ${REPORT_THEME.border}`,
  },
  noteTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  noteText: {
    fontSize: 8,
    lineHeight: 1.4,
  },

  /* Watermark */
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    fontSize: 60,
    color: '#ddd',
    opacity: 0.3,
    transform: 'rotate(-45deg)',
    fontWeight: 'bold',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: REPORT_THEME.textSecondary,
    textAlign: 'center',
    borderTop: `0.5pt solid ${REPORT_THEME.borderDark}`,
    paddingTop: 8,
  },
  footerRow: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: REPORT_THEME.textMuted,
  },

  /* Misc */
  bold: {
    fontWeight: 'bold',
  },
  kvRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 2.5,
  },
  kvLabel: {
    width: '50%',
    paddingHorizontal: 3,
  },
  kvValue: {
    width: '50%',
    paddingHorizontal: 3,
    textAlign: 'right',
  },
});

/** Re-export the shared styles so documents can extend them if needed */
export { s as reportStyles };

/* ────────────────────────── Components ──────────────────────── */

/* ── ReportPage ─────────────────────────────────────────────── */

interface ReportPageProps {
  children: ReactNode;
  orientation?: 'portrait' | 'landscape';
  /** Extra styles merged onto the page */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
}

export function ReportPage({ children, orientation = 'portrait', style }: ReportPageProps) {
  const baseStyle = orientation === 'landscape' ? s.pageLandscape : s.page;
  return (
    <Page size="A4" orientation={orientation} style={style ? [baseStyle, style] : baseStyle}>
      {children}
    </Page>
  );
}

/* ── ReportHeader (centred, with optional logo) ─────────────── */

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  projectName?: string;
  documentNumber?: string;
  revision?: string;
  date?: string;
  logoDataUri?: string;
}

export function ReportHeader({
  title,
  subtitle,
  projectName,
  documentNumber,
  revision,
  date,
  logoDataUri,
}: ReportHeaderProps) {
  const today =
    date ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <View style={s.header}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
      {logoDataUri && <Image src={logoDataUri} style={s.logo} />}
      <View style={s.headerText}>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        {projectName && <Text style={s.subtitle}>{projectName}</Text>}
        {(documentNumber || revision) && (
          <View style={s.headerRow}>
            {documentNumber && (
              <View style={s.headerItem}>
                <Text style={s.headerLabel}>Doc No:</Text>
                <Text>{documentNumber}</Text>
              </View>
            )}
            {revision !== undefined && (
              <View style={s.headerItem}>
                <Text style={s.headerLabel}>Rev:</Text>
                <Text>{revision}</Text>
              </View>
            )}
            <View style={s.headerItem}>
              <Text style={s.headerLabel}>Date:</Text>
              <Text>{today}</Text>
            </View>
          </View>
        )}
      </View>
      {/* Spacer to keep title centred when logo is present */}
      {logoDataUri && <View style={s.logoSpacer} />}
    </View>
  );
}

/* ── ListHeader (left-aligned, for list/table exports) ──────── */

interface ListHeaderProps {
  companyName?: string;
  title: string;
  subtitle?: string;
}

export function ListHeader({ companyName = 'Vapour Toolbox', title, subtitle }: ListHeaderProps) {
  return (
    <View style={s.headerSimple}>
      <Text style={s.titleLeft}>{companyName}</Text>
      <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>{title}</Text>
      {subtitle && <Text style={s.subtitleLeft}>{subtitle}</Text>}
    </View>
  );
}

/* ── MetadataRow (block-style metadata) ─────────────────────── */

interface MetadataItem {
  label: string;
  value: string;
}

interface MetadataRowProps {
  items: MetadataItem[];
}

export function MetadataRow({ items }: MetadataRowProps) {
  return (
    <View style={s.metaRow}>
      {items.map((item, i) => (
        <View key={i} style={s.metaBlock}>
          <Text style={s.metaLabel}>{item.label}</Text>
          <Text style={s.metaValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── ReportSection ──────────────────────────────────────────── */

interface ReportSectionProps {
  title: string;
  children: ReactNode;
}

export function ReportSection({ title, children }: ReportSectionProps) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/* ── ReportTable ────────────────────────────────────────────── */

export interface TableColumn {
  key: string;
  header: string;
  /** Percentage width, e.g. '20%' */
  width: string;
  align?: 'left' | 'right' | 'center';
}

interface ReportTableProps {
  columns: TableColumn[];
  /** Array of row objects keyed by column.key */
  rows: Record<string, string | number>[];
  /** Optional total row at the bottom */
  totalRow?: Record<string, string | number>;
  /** Use alternating row colours (default: false) */
  striped?: boolean;
  /** Font size override for dense tables */
  fontSize?: number;
}

export function ReportTable({
  columns,
  rows,
  totalRow,
  striped = false,
  fontSize,
}: ReportTableProps) {
  const cellStyle = (col: TableColumn) => ({
    width: col.width,
    paddingHorizontal: 3,
    ...(col.align === 'right' ? { textAlign: 'right' as const } : {}),
    ...(col.align === 'center' ? { textAlign: 'center' as const } : {}),
    ...(fontSize ? { fontSize } : {}),
  });

  return (
    <View style={s.table}>
      {/* Header */}
      <View style={[s.tableHeader, fontSize ? { fontSize } : {}]}>
        {columns.map((col) => (
          <Text key={col.key} style={cellStyle(col)}>
            {col.header}
          </Text>
        ))}
      </View>

      {/* Rows */}
      {rows.map((row, i) => (
        <View key={i} style={striped && i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
          {columns.map((col) => (
            <Text key={col.key} style={cellStyle(col)}>
              {row[col.key] ?? ''}
            </Text>
          ))}
        </View>
      ))}

      {/* Total */}
      {totalRow && (
        <View style={s.totalRow}>
          {columns.map((col) => (
            <Text key={col.key} style={cellStyle(col)}>
              {totalRow[col.key] ?? ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/* ── KeyValueTable (label → value pairs) ────────────────────── */

interface KeyValuePair {
  label: string;
  value: string | number;
}

interface KeyValueTableProps {
  rows: KeyValuePair[];
  /** Override label/value width split. Default: 50/50 */
  labelWidth?: string;
  valueWidth?: string;
}

export function KeyValueTable({
  rows,
  labelWidth = '50%',
  valueWidth = '50%',
}: KeyValueTableProps) {
  return (
    <View style={s.table}>
      {rows.map((row, i) => (
        <View key={i} style={s.kvRow}>
          <Text style={[s.kvLabel, { width: labelWidth }]}>{row.label}</Text>
          <Text style={[s.kvValue, { width: valueWidth }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── TwoColumnLayout ────────────────────────────────────────── */

interface TwoColumnLayoutProps {
  left: ReactNode;
  right: ReactNode;
  gap?: number;
}

export function TwoColumnLayout({ left, right, gap = 20 }: TwoColumnLayoutProps) {
  return (
    <View style={[s.twoColumn, { gap }]}>
      <View style={s.column}>{left}</View>
      <View style={s.column}>{right}</View>
    </View>
  );
}

/* ── PrimaryResultBanner ────────────────────────────────────── */

interface ResultItem {
  label: string;
  value: string;
  /** Optional alignment: 'flex-start' | 'center' | 'flex-end' */
  align?: 'flex-start' | 'center' | 'flex-end';
  /** Override font size for the value */
  fontSize?: number;
  /** Override colour for the value */
  color?: string;
}

interface PrimaryResultBannerProps {
  items: ResultItem[];
}

export function PrimaryResultBanner({ items }: PrimaryResultBannerProps) {
  return (
    <View style={s.primaryResult}>
      {items.map((item, i) => (
        <View
          key={i}
          style={{
            alignItems:
              item.align ||
              (i === 0 ? 'flex-start' : i === items.length - 1 ? 'flex-end' : 'center'),
          }}
        >
          <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary }}>{item.label}</Text>
          <Text
            style={{
              fontSize: item.fontSize || 16,
              fontWeight: 'bold',
              color: item.color || REPORT_THEME.primary,
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── SummaryCards ────────────────────────────────────────────── */

interface SummaryCardItem {
  label: string;
  value: string;
  color?: string;
  borderColor?: string;
}

interface SummaryCardsProps {
  items: SummaryCardItem[];
}

export function SummaryCards({ items }: SummaryCardsProps) {
  return (
    <View style={s.summaryRow}>
      {items.map((item, i) => (
        <View
          key={i}
          style={[s.summaryCard, item.borderColor ? { borderColor: item.borderColor } : {}]}
        >
          <Text style={s.summaryCardLabel}>{item.label}</Text>
          <Text style={[s.summaryCardValue, item.color ? { color: item.color } : {}]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── WarningsBox ────────────────────────────────────────────── */

interface WarningsBoxProps {
  warnings: string[];
}

export function WarningsBox({ warnings }: WarningsBoxProps) {
  if (warnings.length === 0) return null;
  return (
    <View style={s.warning}>
      {warnings.map((w, i) => (
        <Text key={i} style={s.warningText}>
          - {w}
        </Text>
      ))}
    </View>
  );
}

/* ── NotesSection ───────────────────────────────────────────── */

interface NotesSectionProps {
  notes: string;
  title?: string;
}

export function NotesSection({ notes, title = 'NOTES:' }: NotesSectionProps) {
  return (
    <View style={s.noteSection}>
      <Text style={s.noteTitle}>{title}</Text>
      <Text style={s.noteText}>{notes}</Text>
    </View>
  );
}

/* ── Watermark ──────────────────────────────────────────────── */

interface WatermarkProps {
  text: string;
}

export function Watermark({ text }: WatermarkProps) {
  return <Text style={s.watermark}>{text}</Text>;
}

/* ── ReportFooter (centred, multi-line) ─────────────────────── */

interface ReportFooterProps {
  lines: string[];
}

export function ReportFooter({ lines }: ReportFooterProps) {
  return (
    <View style={s.footer}>
      {lines.map((line, i) => (
        <Text key={i} style={i > 0 ? { marginTop: 2 } : undefined}>
          {line}
        </Text>
      ))}
    </View>
  );
}

/* ── ListFooter (left label + right page numbers) ───────────── */

interface ListFooterProps {
  label: string;
}

export function ListFooter({ label }: ListFooterProps) {
  return (
    <View style={s.footerRow}>
      <Text>{label}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
