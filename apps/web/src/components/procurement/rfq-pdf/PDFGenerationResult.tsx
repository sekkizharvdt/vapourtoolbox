'use client';

/**
 * PDF Generation Result
 *
 * Displays the results after PDF generation with download links.
 */

import {
  Box,
  Alert,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { PictureAsPdf as PdfIcon, Download as DownloadIcon } from '@mui/icons-material';
import type { PDFGenerationResultProps } from './types';

export function PDFGenerationResult({ result, onDownload }: PDFGenerationResultProps) {
  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        Successfully generated {result.totalFiles} PDF file(s)! (Version {result.pdfVersion})
      </Alert>

      {result.errors && result.errors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some PDFs could not be generated:
          <ul>
            {result.errors.map((err, i) => (
              <li key={i}>{err.error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
        Generated PDFs:
      </Typography>

      <List>
        {result.vendorPdfs?.map((pdf) => (
          <ListItem key={pdf.vendorId} disablePadding>
            <ListItemButton onClick={() => onDownload(pdf.pdfUrl)}>
              <ListItemIcon>
                <PdfIcon color="error" />
              </ListItemIcon>
              <ListItemText primary={pdf.vendorName} secondary="Click to download" />
              <DownloadIcon color="primary" />
            </ListItemButton>
          </ListItem>
        ))}

        {result.combinedPdfUrl && (
          <ListItem disablePadding>
            <ListItemButton onClick={() => onDownload(result.combinedPdfUrl!)}>
              <ListItemIcon>
                <PdfIcon color="error" />
              </ListItemIcon>
              <ListItemText primary="Combined PDF (All Vendors)" secondary="Click to download" />
              <DownloadIcon color="primary" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );
}
