/**
 * Transmittal Cover Sheet PDF Service
 *
 * Generates and downloads a standard engineering document transmittal
 * cover sheet using the shared PDF report system.
 */

import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import { generatePDFBlob, downloadBlob, sanitiseFilename } from '@/lib/pdf/pdfUtils';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';
import { REPORT_THEME } from '@/lib/pdf/reportComponents';
import type { DocumentTransmittal, TransmittalDocumentEntry } from '@vapour/types';

/* ─────────────────────────── Helpers ─────────────────────────── */

/**
 * Safely format a Firestore Timestamp (or Date) to a locale string.
 * Firestore returns Timestamp objects at runtime, not Date.
 */
function formatDate(raw: unknown): string {
  if (!raw) return '';
  const date =
    raw && typeof raw === 'object' && 'toDate' in raw
      ? (raw as { toDate: () => Date }).toDate()
      : raw instanceof Date
        ? raw
        : new Date(
            typeof raw === 'object' && 'seconds' in raw
              ? (raw as { seconds: number }).seconds * 1000
              : (raw as string)
          );
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Map delivery method enum to display text */
function formatDeliveryMethod(method?: string): string {
  switch (method) {
    case 'HARD_COPY':
      return 'Hard Copy';
    case 'SOFT_COPY':
      return 'Soft Copy';
    case 'BOTH':
      return 'Both';
    default:
      return method ?? '';
  }
}

/* ─────────────────────────── Styles ──────────────────────────── */

const s = StyleSheet.create({
  page: {
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
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 1,
  },
  logoSpacer: {
    width: 50,
    marginLeft: 12,
  },

  /* Key-value info table */
  infoTable: {
    marginTop: 10,
    marginBottom: 12,
    border: `1pt solid ${REPORT_THEME.border}`,
  },
  infoRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    minHeight: 20,
  },
  infoRowLast: {
    flexDirection: 'row',
    minHeight: 20,
  },
  infoLabel: {
    width: '30%',
    padding: 5,
    fontWeight: 'bold',
    backgroundColor: REPORT_THEME.tableHeaderBg,
    borderRight: `0.5pt solid ${REPORT_THEME.border}`,
  },
  infoValue: {
    width: '70%',
    padding: 5,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
    color: REPORT_THEME.primary,
    backgroundColor: REPORT_THEME.primaryLight,
    padding: 4,
  },

  /* Document list table */
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: REPORT_THEME.tableHeaderBg,
    borderBottom: `1pt solid ${REPORT_THEME.borderDark}`,
    paddingVertical: 4,
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 3,
    fontSize: 8,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 3,
    fontSize: 8,
    backgroundColor: REPORT_THEME.tableRowAltBg,
  },

  /* Column widths for document list */
  colSno: { width: '6%', paddingHorizontal: 3, textAlign: 'center' },
  colDocNo: { width: '22%', paddingHorizontal: 3 },
  colDocTitle: { width: '32%', paddingHorizontal: 3 },
  colRev: { width: '8%', paddingHorizontal: 3, textAlign: 'center' },
  colStatus: { width: '14%', paddingHorizontal: 3, textAlign: 'center' },
  colRemarks: { width: '18%', paddingHorizontal: 3 },

  /* Cover notes */
  notesSection: {
    marginTop: 10,
    padding: 8,
    backgroundColor: REPORT_THEME.notesBg,
    border: `0.5pt solid ${REPORT_THEME.border}`,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    lineHeight: 1.5,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: REPORT_THEME.textMuted,
    borderTop: `0.5pt solid ${REPORT_THEME.borderDark}`,
    paddingTop: 6,
  },
});

/* ─────────────────────── PDF Document ────────────────────────── */

interface TransmittalPdfProps {
  transmittal: DocumentTransmittal;
  documents: TransmittalDocumentEntry[];
  logoDataUri?: string;
}

function TransmittalCoverSheet({ transmittal, documents, logoDataUri }: TransmittalPdfProps) {
  const infoRows: { label: string; value: string }[] = [
    { label: 'Transmittal No.', value: transmittal.transmittalNumber },
    { label: 'Date', value: formatDate(transmittal.transmittalDate) },
    { label: 'Project', value: transmittal.projectName },
    {
      label: 'To',
      value: [transmittal.clientName, transmittal.clientContact].filter(Boolean).join(' / '),
    },
    ...(transmittal.subject ? [{ label: 'Subject', value: transmittal.subject }] : []),
    ...(transmittal.purposeOfIssue
      ? [{ label: 'Purpose of Issue', value: transmittal.purposeOfIssue }]
      : []),
    ...(transmittal.deliveryMethod
      ? [{ label: 'Delivery Method', value: formatDeliveryMethod(transmittal.deliveryMethod) }]
      : []),
  ];

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: s.page },

      /* Header */
      React.createElement(
        View,
        { style: s.header },
        logoDataUri ? React.createElement(Image, { src: logoDataUri, style: s.logo }) : null,
        React.createElement(
          View,
          { style: s.headerText },
          React.createElement(Text, { style: s.title }, 'DOCUMENT TRANSMITTAL')
        ),
        logoDataUri ? React.createElement(View, { style: s.logoSpacer }) : null
      ),

      /* Transmittal info table */
      React.createElement(
        View,
        { style: s.infoTable },
        ...infoRows.map((row, i) =>
          React.createElement(
            View,
            {
              key: i,
              style: i < infoRows.length - 1 ? s.infoRow : s.infoRowLast,
            },
            React.createElement(Text, { style: s.infoLabel }, row.label),
            React.createElement(Text, { style: s.infoValue }, row.value)
          )
        )
      ),

      /* Document list section */
      React.createElement(Text, { style: s.sectionTitle }, 'DOCUMENTS'),
      React.createElement(
        View,
        { style: s.table },

        /* Table header */
        React.createElement(
          View,
          { style: s.tableHeader },
          React.createElement(Text, { style: s.colSno }, 'S.No'),
          React.createElement(Text, { style: s.colDocNo }, 'Document Number'),
          React.createElement(Text, { style: s.colDocTitle }, 'Document Title'),
          React.createElement(Text, { style: s.colRev }, 'Rev'),
          React.createElement(Text, { style: s.colStatus }, 'Status'),
          React.createElement(Text, { style: s.colRemarks }, 'Remarks')
        ),

        /* Table rows */
        ...documents.map((doc, i) =>
          React.createElement(
            View,
            { key: i, style: i % 2 === 1 ? s.tableRowAlt : s.tableRow },
            React.createElement(Text, { style: s.colSno }, String(i + 1)),
            React.createElement(Text, { style: s.colDocNo }, doc.documentNumber),
            React.createElement(Text, { style: s.colDocTitle }, doc.documentTitle),
            React.createElement(Text, { style: s.colRev }, doc.revision),
            React.createElement(Text, { style: s.colStatus }, doc.status),
            React.createElement(Text, { style: s.colRemarks }, doc.remarks ?? '')
          )
        )
      ),

      /* Cover notes (if provided) */
      transmittal.coverNotes
        ? React.createElement(
            View,
            { style: s.notesSection },
            React.createElement(Text, { style: s.notesTitle }, 'COVER NOTES'),
            React.createElement(Text, { style: s.notesText }, transmittal.coverNotes)
          )
        : null,

      /* Footer */
      React.createElement(
        View,
        { style: s.footer, fixed: true },
        React.createElement(Text, null, 'Generated by Vapour Toolbox'),
        React.createElement(Text, {
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`,
        })
      )
    )
  );
}

/* ─────────────────────── Public API ──────────────────────────── */

/**
 * Generate a transmittal cover sheet PDF as a Blob.
 */
export async function generateTransmittalPdf(
  transmittal: DocumentTransmittal,
  documents: TransmittalDocumentEntry[]
): Promise<Blob> {
  const logoDataUri = await fetchLogoAsDataUri();
  const doc = TransmittalCoverSheet({ transmittal, documents, logoDataUri });
  return generatePDFBlob(doc);
}

/**
 * Generate and download a transmittal cover sheet PDF.
 */
export async function downloadTransmittalPdf(
  transmittal: DocumentTransmittal,
  documents: TransmittalDocumentEntry[]
): Promise<void> {
  const blob = await generateTransmittalPdf(transmittal, documents);
  const filename = sanitiseFilename(`Transmittal_${transmittal.transmittalNumber}.pdf`);
  downloadBlob(blob, filename);
}
