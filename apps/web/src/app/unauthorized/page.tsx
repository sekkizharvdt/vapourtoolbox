'use client';

import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            maxWidth: 500,
          }}
        >
          <BlockIcon
            sx={{
              fontSize: 64,
              color: 'error.main',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom>
            Unauthorized Access
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Your email domain is not authorized to access this application.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Only @vapourdesal.com and invited client domains are allowed.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => router.push('/login')}>
              Back to Login
            </Button>
            <Button variant="outlined" onClick={() => window.location.href = 'mailto:support@vapourdesal.com'}>
              Contact Support
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>
            If you believe this is an error, please contact your administrator.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
