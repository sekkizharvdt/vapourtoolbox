'use client';

/**
 * Keyboard Shortcuts Section
 */

import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { KeyboardShortcut } from './helpers';

export function KeyboardShortcutsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Keyboard shortcuts help you navigate faster. Press <strong>Shift + ?</strong> anywhere to
        see the shortcuts help dialog.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Navigation Shortcuts
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="40%">Shortcut</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <KeyboardShortcut keys="⌘ K" description="Open command palette" />
            <KeyboardShortcut keys="G D" description="Go to Dashboard" />
            <KeyboardShortcut keys="G F" description="Go to Flow" />
            <KeyboardShortcut keys="G P" description="Go to Procurement" />
            <KeyboardShortcut keys="G R" description="Go to Proposals" />
            <KeyboardShortcut keys="G O" description="Go to Documents" />
            <KeyboardShortcut keys="G M" description="Go to Materials" />
            <KeyboardShortcut keys="G A" description="Go to Accounting" />
            <KeyboardShortcut keys="Shift ?" description="Show keyboard shortcuts help" />
            <KeyboardShortcut keys="Esc" description="Close dialogs and panels" />
          </TableBody>
        </Table>
      </TableContainer>

      <Alert severity="info">
        <Typography variant="body2">
          <strong>Sequence shortcuts:</strong> For shortcuts like &quot;G D&quot;, press G first,
          then D within 1 second.
        </Typography>
      </Alert>
    </Box>
  );
}
