'use client';

import { Container, Typography, Box } from '@mui/material';

export default function AccountingPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Accounting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage invoices, payments, and financial transactions
        </Typography>
      </Box>

      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Accounting Module
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This module will be implemented in Phase 3
        </Typography>
      </Box>
    </Container>
  );
}
