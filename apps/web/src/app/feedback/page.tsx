'use client';

import { Suspense } from 'react';
import { Container, CircularProgress, Box, Divider, Typography } from '@mui/material';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { FeedbackForm } from '@/components/common/FeedbackForm';
import { UserFeedbackList } from '@/components/common/UserFeedbackList';

function FeedbackContent() {
  return <FeedbackForm />;
}

function UserSubmissions() {
  return <UserFeedbackList />;
}

export default function FeedbackPage() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <FeedbackContent />
        </Suspense>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" fontWeight={600} gutterBottom>
          Your Submissions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Track the status of your bug reports and feature requests
        </Typography>

        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <UserSubmissions />
        </Suspense>
      </Container>
    </AuthenticatedLayout>
  );
}
