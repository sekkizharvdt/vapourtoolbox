'use client';

import { Box, Typography, Button, Stack } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentSupplyListProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentSupplyList({ document }: DocumentSupplyListProps) {
  return (
    <Box sx={{ px: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Supply List</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Supply Item
        </Button>
      </Stack>
      <Typography color="text.secondary">
        Supply list management will be implemented here
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Document: {document.documentNumber} | Supply Items: {document.supplyItemCount}
      </Typography>
    </Box>
  );
}
