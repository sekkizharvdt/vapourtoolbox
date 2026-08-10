'use client';

/**
 * Report PDF export hook
 *
 * Wraps `downloadReportPDF` with the error handling every report page needs.
 * PDF generation is the one export that can fail at runtime — @react-pdf throws
 * on an unregistered font family, which once broke every report PDF in the app —
 * so a failure has to reach the user instead of vanishing into an unhandled
 * promise rejection on a click handler.
 *
 * One implementation, so the nine report pages cannot drift apart (rule 32).
 */

import { useCallback } from 'react';
import { createLogger } from '@vapour/logger';
import { useToast } from '@/components/common/Toast';
import { downloadReportPDF, type ExportSection, type ReportPDFOptions } from './exportReport';

const logger = createLogger({ context: 'ReportPDFExport' });

export type ReportPDFExporter = (
  sections: ExportSection[],
  filename: string,
  options?: ReportPDFOptions
) => Promise<void>;

export function useReportPDFExport(): ReportPDFExporter {
  const { toast } = useToast();

  return useCallback(
    async (sections, filename, options) => {
      try {
        await downloadReportPDF(sections, filename, options);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Report PDF export failed', { filename, error: message });
        toast.error(`Could not generate the PDF: ${message}`);
      }
    },
    [toast]
  );
}
