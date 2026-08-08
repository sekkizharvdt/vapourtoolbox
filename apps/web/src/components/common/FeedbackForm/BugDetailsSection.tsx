'use client';

/**
 * Bug Details Section
 *
 * Form fields specific to bug reports: steps to reproduce, expected/actual behavior,
 * console errors, and screenshots.
 */

import { Box, Typography, TextField, Card, CardContent, Chip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CodeIcon from '@mui/icons-material/Code';
import ScreenshotIcon from '@mui/icons-material/Screenshot';
import { ConsoleErrorInstructions } from './ConsoleErrorInstructions';
import { ScreenshotUpload } from './ScreenshotUpload';

interface BugDetailsSectionProps {
  expectedBehavior: string;
  actualBehavior: string;
  consoleErrors: string;
  screenshotUrls: string[];
  isUploading: boolean;
  onExpectedChange: (value: string) => void;
  onActualChange: (value: string) => void;
  onConsoleErrorsChange: (value: string) => void;
  onScreenshotAdd: (file: File) => void;
  onScreenshotRemove: (index: number) => void;
}

export function BugDetailsSection({
  expectedBehavior,
  actualBehavior,
  consoleErrors,
  screenshotUrls,
  isUploading,
  onExpectedChange,
  onActualChange,
  onConsoleErrorsChange,
  onScreenshotAdd,
  onScreenshotRemove,
}: BugDetailsSectionProps) {
  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="error" />
              Bug Details
            </Box>
          </Typography>

          {/* "Steps to Reproduce" removed (Phase C1): answered on 5 of 168 bug
              reports over two years. Asking harder does not fix a 3% response
              rate, and a shorter form should lift the fields that do work. The
              same Firestore field still backs the feature form's required Use
              Case, so it is not dead. */}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <TextField
              fullWidth
              label="Expected Behavior"
              placeholder="What should have happened?"
              value={expectedBehavior}
              onChange={(e) => onExpectedChange(e.target.value)}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Actual Behavior"
              placeholder="What actually happened?"
              value={actualBehavior}
              onChange={(e) => onActualChange(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon color="primary" />
              Console Error Messages
            </Box>
          </Typography>

          <ConsoleErrorInstructions />

          <TextField
            fullWidth
            label="Console Errors (if any)"
            placeholder="Paste any error messages from the browser console here..."
            value={consoleErrors}
            onChange={(e) => onConsoleErrorsChange(e.target.value)}
            multiline
            rows={4}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScreenshotIcon color="primary" />
              Screenshots
            </Box>
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Screenshots help us understand the issue better. You can capture your screen using:
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Chip label="Windows: Win+Shift+S" size="small" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Mac: ⌘+Shift+4" size="small" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Or use Snipping Tool" size="small" sx={{ mb: 1 }} />
          </Box>

          <ScreenshotUpload
            screenshots={screenshotUrls}
            onAdd={onScreenshotAdd}
            onRemove={onScreenshotRemove}
            isUploading={isUploading}
          />
        </CardContent>
      </Card>
    </>
  );
}
