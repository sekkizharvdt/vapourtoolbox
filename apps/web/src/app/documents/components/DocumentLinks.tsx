'use client';

import { Box, Typography, Button, Stack, Grid, Paper, Divider } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentLinksProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentLinks({ document }: DocumentLinksProps) {
  return (
    <Box sx={{ px: 3 }}>
      <Grid container spacing={3}>
        {/* Predecessors */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignments="center" sx={{ mb: 2 }}>
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
        </Grid>

        {/* Successors */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
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
        </Grid>

        {/* Related Documents */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Related Documents
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography color="text.secondary" variant="body2">
              Related document references will be implemented here
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
