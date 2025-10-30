'use client';

import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { HourglassEmpty as HourglassIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

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
          <HourglassIcon
            sx={{
              fontSize: 64,
              color: 'warning.main',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom>
            Account Pending Approval
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Your account has been created but is awaiting administrator approval.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You will receive an email notification once your account has been approved and configured with the appropriate roles and permissions.
          </Typography>

          <Button variant="contained" onClick={handleSignOut}>
            Sign Out
          </Button>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>
            For questions, contact: support@vapourdesal.com
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
