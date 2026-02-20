'use client';

/**
 * Parser Comparison View
 *
 * Shared component for comparing Google Document AI and Claude AI parser results.
 * Used by UploadOfferDialog (offer parsing) and ReceiptParsingUploader (receipt parsing).
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import { Speed as SpeedIcon } from '@mui/icons-material';

interface ParserResult {
  success: boolean;
  error?: string;
  processingTimeMs: number;
}

interface ParserComparisonViewProps {
  /** Google Document AI result */
  googleResult: ParserResult;
  /** Claude AI result */
  claudeResult: ParserResult;
  /** Currently selected parser */
  selectedParser: 'google' | 'claude' | null;
  /** Callback when a parser is selected */
  onSelectParser: (parser: 'google' | 'claude') => void;
  /** Total processing time in ms */
  totalProcessingTimeMs?: number;
  /** Render the detail content for Google result */
  renderGoogleDetails: () => React.ReactNode;
  /** Render the detail content for Claude result */
  renderClaudeDetails: () => React.ReactNode;
  /** Optional footer content (e.g., "Enter manually" button) */
  footer?: React.ReactNode;
}

export function ParserComparisonView({
  googleResult,
  claudeResult,
  selectedParser,
  onSelectParser,
  totalProcessingTimeMs,
  renderGoogleDetails,
  renderClaudeDetails,
  footer,
}: ParserComparisonViewProps) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Parser Comparison Results
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Both parsers analyzed your document. Compare the results below and select which one to use.
      </Typography>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {/* Google Document AI Results */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              border: selectedParser === 'google' ? 2 : 1,
              borderColor: selectedParser === 'google' ? 'primary.main' : 'divider',
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Google Document AI
                </Typography>
                <Chip
                  size="small"
                  color={googleResult.success ? 'success' : 'error'}
                  label={googleResult.success ? 'Success' : 'Failed'}
                />
              </Stack>

              {googleResult.error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {googleResult.error}
                </Alert>
              ) : (
                renderGoogleDetails()
              )}

              <Button
                variant={selectedParser === 'google' ? 'contained' : 'outlined'}
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => onSelectParser('google')}
                disabled={!googleResult.success}
              >
                {selectedParser === 'google' ? 'Selected' : 'Use These Results'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Claude AI Results */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              border: selectedParser === 'claude' ? 2 : 1,
              borderColor: selectedParser === 'claude' ? 'secondary.main' : 'divider',
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Claude AI
                </Typography>
                <Chip
                  size="small"
                  color={claudeResult.success ? 'success' : 'error'}
                  label={claudeResult.success ? 'Success' : 'Failed'}
                />
              </Stack>

              {claudeResult.error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {claudeResult.error}
                </Alert>
              ) : (
                renderClaudeDetails()
              )}

              <Button
                variant={selectedParser === 'claude' ? 'contained' : 'outlined'}
                color="secondary"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => onSelectParser('claude')}
                disabled={!claudeResult.success}
              >
                {selectedParser === 'claude' ? 'Selected' : 'Use These Results'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {totalProcessingTimeMs !== undefined && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
            <SpeedIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Total comparison time: {totalProcessingTimeMs}ms
            </Typography>
          </Stack>
        </Box>
      )}

      {footer}
    </Box>
  );
}
