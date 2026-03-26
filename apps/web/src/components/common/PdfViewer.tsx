'use client';

/**
 * PdfViewer — Shared PDF viewer component
 *
 * Embeds a PDF document using the browser's native viewer (iframe).
 * Supports inline and dialog modes, show/hide toggle, and download.
 *
 * Usage:
 *   <PdfViewer url={fileUrl} fileName="offer.pdf" />
 *   <PdfViewer url={fileUrl} mode="dialog" open={open} onClose={handleClose} />
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';

// ============================================================================
// Shared iframe renderer
// ============================================================================

function PdfIframe({
  url,
  title,
  height,
}: {
  url: string;
  title: string;
  height: number | string;
}) {
  return (
    <Box
      component="iframe"
      src={url}
      sx={{
        width: '100%',
        height,
        border: 'none',
        display: 'block',
      }}
      title={title}
    />
  );
}

// ============================================================================
// Inline mode (embedded in page)
// ============================================================================

interface PdfViewerInlineProps {
  mode?: 'inline';
  url: string;
  fileName?: string;
  /** Height of the viewer in px. Default 600 */
  height?: number;
  /** Whether to show the viewer initially. Default true */
  defaultVisible?: boolean;
  /** Hide the toolbar (show/hide + download buttons). Default false */
  hideToolbar?: boolean;
}

function PdfViewerInline({
  url,
  fileName,
  height = 600,
  defaultVisible = true,
  hideToolbar = false,
}: PdfViewerInlineProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const title = fileName ?? 'PDF Document';

  return (
    <>
      {!hideToolbar && (
        <Box sx={{ display: 'flex', gap: 1, mb: visible ? 1 : 0 }}>
          <Button
            size="small"
            startIcon={visible ? <HideIcon /> : <ShowIcon />}
            onClick={() => setVisible(!visible)}
          >
            {visible ? 'Hide Document' : 'Show Document'}
          </Button>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {fileName ?? 'Download'}
          </Button>
        </Box>
      )}
      {visible && (
        <Card variant="outlined">
          <PdfIframe url={url} title={title} height={height} />
        </Card>
      )}
    </>
  );
}

// ============================================================================
// Dialog mode (opens in a modal)
// ============================================================================

interface PdfViewerDialogProps {
  mode: 'dialog';
  url: string;
  fileName?: string;
  open: boolean;
  onClose: () => void;
}

function PdfViewerDialog({ url, fileName, open, onClose }: PdfViewerDialogProps) {
  const title = fileName ?? 'PDF Document';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <IconButton
          size="small"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mr: 1 }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <PdfIframe url={url} title={title} height="100%" />
      </DialogContent>
      <DialogActions>
        <Button startIcon={<DownloadIcon />} href={url} target="_blank" rel="noopener noreferrer">
          Download
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Unified export
// ============================================================================

export type PdfViewerProps = PdfViewerInlineProps | PdfViewerDialogProps;

export function PdfViewer(props: PdfViewerProps) {
  if (props.mode === 'dialog') {
    return <PdfViewerDialog {...props} />;
  }
  return <PdfViewerInline {...props} />;
}
