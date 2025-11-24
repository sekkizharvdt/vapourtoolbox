'use client';

import { Box, Typography, Button, Stack, Paper, Divider } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentLinksProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentLinks({ document }: DocumentLinksProps) {
  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Predecessors and Successors */}
        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <Paper sx={{ p: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">Predecessors</Typography>
                <Button variant="outlined" size="small" startIcon={<AddIcon />}>
                  Add
                </Button>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Typography color="text.secondary" variant="body2">
                {document.predecessors.length === 0
                  ? 'No predecessor documents'
                  : `${document.predecessors.length} predecessor(s)`}
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <Paper sx={{ p: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">Successors</Typography>
                <Button variant="outlined" size="small" startIcon={<AddIcon />}>
                  Add
                </Button>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Typography color="text.secondary" variant="body2">
                {document.successors.length === 0
                  ? 'No successor documents'
                  : `${document.successors.length} successor(s)`}
              </Typography>
            </Paper>
          </Box>
        </Stack>

        {/* Related Documents */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Related Documents
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography color="text.secondary" variant="body2">
              Related document references will be implemented here
            </Typography>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
