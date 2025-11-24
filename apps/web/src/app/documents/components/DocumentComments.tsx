'use client';

import { Box, Typography } from '@mui/material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentCommentsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentComments({ document }: DocumentCommentsProps) {
  return (
    <Box sx={{ px: 3 }}>
      <Typography variant="h6" gutterBottom>
        Comments & Resolution
      </Typography>
      <Typography color="text.secondary">
        Comment resolution interface will be implemented here
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Document: {document.documentNumber}
      </Typography>
    </Box>
  );
}
