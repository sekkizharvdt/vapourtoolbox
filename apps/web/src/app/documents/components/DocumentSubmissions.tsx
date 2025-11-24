'use client';

import { Box, Typography, Button, Stack } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentSubmissionsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentSubmissions({ document, onUpdate: _onUpdate }: DocumentSubmissionsProps) {
  return (
    <Box sx={{ px: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Document Submissions</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Submission
        </Button>
      </Stack>
      <Typography color="text.secondary">
        Submission workflow will be implemented here
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Document: {document.documentNumber}
      </Typography>
    </Box>
  );
}
